"""
Live full-length human-track norms — Jamendo API (https://developer.jamendo.com/v3.0).

Unlike the static MTG-Jamendo dataset (ingest_jamendo.py), the Jamendo API is a
LIVE catalog: artists upload continuously, so norms can be refreshed on a
schedule. Free tier: client_id from https://devportal.jamendo.com, 35,000
requests/month (one page of 200 tracks = 1 request; audio streams come from
Jamendo's CDN).

Pipeline per genre family: query /tracks (fuzzytags per family, order
popularity_month by default) -> skip ids already in data/jamendo_rows.jsonl
(MTG-Jamendo files are named by the same track id) -> download stream (mp32
VBR) -> ffmpeg first 240s -> wav -> engine analyze() -> APPEND rows to
data/jamendo_rows.jsonl -> write_norms() merges into engine/norms_data.json
exactly like the tar pipeline (full_length: true, n >= 300 replaces FMA).

Usage:
  JAMENDO_CLIENT_ID=xxxx .venv/bin/python tools/ingest_jamendo_api.py \
      [--per-family 300] [--order popularity_month] \
      [--datebetween 2025-01-01_2026-07-27] [--workers 4] [--min-sec 90]
"""
import argparse
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.parse
import urllib.request
from multiprocessing import Pool

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "engine"))

import ingest_jamendo as ij

API = "https://api.jamendo.com/v3.0/tracks"
PAGE = 200                       # API max per request
FAMILY_TAGS = {                  # family -> Jamendo genre tags (OR via fuzzytags)
    "Electronic": ["electronic", "techno", "house"],
    "Hip-Hop": ["hiphop", "rap"],
    "Pop": ["pop"],
    "Rock": ["rock", "metal", "punkrock"],
}


def api_page(client_id, tags, order, offset, datebetween, retries=3):
    params = {
        "client_id": client_id, "format": "json", "limit": PAGE,
        "offset": offset, "fuzzytags": "+".join(tags), "order": order,
        "audioformat": "mp32", "include": "musicinfo",
    }
    if datebetween:
        params["datebetween"] = datebetween
    url = API + "?" + urllib.parse.urlencode(params, safe="+")
    # The API transiently returns errors or empty first pages under load
    # (observed: fuzzytags=hiphop+rap -> 0 results once, 200 seconds later),
    # so empty page-0 responses are retried too, not just HTTP failures.
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                body = json.load(r)
            if body.get("headers", {}).get("status") != "success":
                raise RuntimeError(f"Jamendo API error: {body.get('headers')}")
            results = body.get("results", [])
            if results or offset > 0:
                return results
        except Exception as e:
            if attempt == retries - 1:
                raise
            print(f"  api_page retry {attempt + 1}: {e}", flush=True)
        time.sleep(5 * (attempt + 1))
    return []


def known_ids():
    """Track ids already analyzed (both tar and API rows share id-based names)."""
    ids = set()
    if os.path.exists(ij.ROWS):
        for line in open(ij.ROWS):
            try:
                ids.add(os.path.splitext(json.loads(line)["file"])[0])
            except Exception:
                continue
    return ids


def analyze_one(job):
    tid, url, fam = job
    from analyze import analyze
    mp3 = wav = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
            mp3 = tmp.name
        subprocess.run(["curl", "-sfL", "--retry", "2", "-o", mp3, url],
                       check=True, timeout=600)
        if os.path.getsize(mp3) < 100_000:
            return None
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            wav = tmp.name
        subprocess.run(["ffmpeg", "-y", "-i", mp3, "-t", str(ij.ANALYZE_CAP_SEC),
                        "-ac", "2", "-ar", "44100", wav],
                       check=True, capture_output=True, timeout=300)
        d = analyze(wav, "default")
        return {k: d.get(k) for k in ij.METRICS} | \
            {"families": [fam], "file": f"{tid}.mp3", "source": "jamendo_api"}
    except Exception:
        return None
    finally:
        for p in (mp3, wav):
            if p and os.path.exists(p):
                os.remove(p)


def run_family(fam, tags, client_id, per_family, order, datebetween,
               workers, min_sec, seen):
    jobs, offset = [], 0
    while len(jobs) < per_family:
        page = api_page(client_id, tags, order, offset, datebetween)
        if not page:
            break
        for t in page:
            tid = str(t.get("id", ""))
            if (tid and tid not in seen and t.get("audio")
                    and float(t.get("duration") or 0) >= min_sec):
                seen.add(tid)
                jobs.append((tid, t["audio"], fam))
                if len(jobs) >= per_family:
                    break
        offset += PAGE
        time.sleep(0.5)                       # stay polite on the free tier
    if not jobs:
        print(f"[{fam}] nothing new (all {offset} listed tracks known/short)")
        return 0
    print(f"[{fam}] analyzing {len(jobs)} new tracks ({workers} workers)...",
          flush=True)
    done = ok = 0
    with Pool(workers) as pool, open(ij.ROWS, "a") as out:
        for res in pool.imap_unordered(analyze_one, jobs, chunksize=2):
            done += 1
            if done % 25 == 0:
                print(f"  [{fam}] {done}/{len(jobs)}", flush=True)
            if res:
                ok += 1
                out.write(json.dumps(res) + "\n")
    print(f"[{fam}] DONE — {ok} rows appended", flush=True)
    return ok


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--client-id", default=os.environ.get("JAMENDO_CLIENT_ID"))
    ap.add_argument("--per-family", type=int, default=300)
    ap.add_argument("--order", default="popularity_month")
    ap.add_argument("--datebetween", default=None,
                    help="yyyy-mm-dd_yyyy-mm-dd release-date window")
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--min-sec", type=int, default=90,
                    help="skip tracks shorter than this (jingles/loops)")
    ap.add_argument("--families", default=None,
                    help="comma list to limit run (e.g. Hip-Hop,Rock)")
    a = ap.parse_args()
    if a.families:
        wanted = set(a.families.split(","))
        unknown = wanted - set(FAMILY_TAGS)
        if unknown:
            sys.exit(f"unknown families: {unknown} (have {list(FAMILY_TAGS)})")
        for fam in list(FAMILY_TAGS):
            if fam not in wanted:
                del FAMILY_TAGS[fam]
    if not a.client_id:
        sys.exit("need a client id: JAMENDO_CLIENT_ID env var or --client-id "
                 "(free at https://devportal.jamendo.com)")
    seen = known_ids()
    print(f"{len(seen)} tracks already analyzed")
    total = sum(run_family(fam, tags, a.client_id, a.per_family, a.order,
                           a.datebetween, a.workers, a.min_sec, seen)
                for fam, tags in FAMILY_TAGS.items())
    if total:
        ij.write_norms()
    else:
        print("no new rows — norms untouched")


if __name__ == "__main__":
    main()
