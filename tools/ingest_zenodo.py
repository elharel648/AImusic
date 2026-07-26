"""
Tier A v2 — per-genre hit norms from the Zenodo 900k Spotify snapshot.

Source: https://zenodo.org/records/11453410 (CC BY 4.0, collected June 2024,
~900k tracks with tempo/loudness/key + Top-200 chart columns).

"Hit" = charted on a Top-200 (chart column) OR popularity >= 50 — actual
commercial performance, not our judgement. Tracks are deduped by track_id
(chart rows repeat per region/date).

Writes/updates the "hits" section of engine/norms_data.json (merge-friendly:
other sections are preserved). Percentiles: BPM p10-p90, loudness p25-p75.

Usage:  .venv/bin/python tools/ingest_zenodo.py [--csv data/spotify_900k.csv]
"""
import argparse
import ast
import csv
import json
import os
from datetime import date

# micro-genre -> our product buckets; first match wins (ordered by specificity)
RULES = [
    ("melodic techno", ["melodic techno", "melodic house"]),
    ("lo-fi",          ["lo-fi", "lofi", "chillhop"]),
    ("house",          ["deep house", "tech house", "progressive house", "house"]),
    ("edm",            ["edm", "big room", "electro house", "festival", "slap house",
                        "future bass", "dubstep", "trance"]),
    ("melodic techno", ["techno"]),          # generic techno after the house/edm rules
    ("hip-hop",        ["hip hop", "hip-hop", "rap", "trap", "drill", "grime"]),
    ("rock",           ["rock", "metal", "punk", "grunge", "shoegaze"]),
    ("pop",            ["pop"]),             # broadest — last
]


def bucket_of(genres_field: str):
    try:
        genres = ast.literal_eval(genres_field) if genres_field else []
    except (ValueError, SyntaxError):
        return None
    joined = [g.lower() for g in genres if isinstance(g, str)]
    for bucket, needles in RULES:
        for g in joined:
            if any(n in g for n in needles):
                return bucket
    return None


def pct(vals, q):
    vals = sorted(vals)
    if not vals:
        return None
    i = min(len(vals) - 1, max(0, int(round(q / 100 * (len(vals) - 1)))))
    return vals[i]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", default=os.path.join(os.path.dirname(__file__), "..", "data", "spotify_900k.csv"))
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "engine", "norms_data.json"))
    ap.add_argument("--min-popularity", type=int, default=50)
    a = ap.parse_args()

    seen, by_bucket = set(), {}
    total = hits = 0
    with open(a.csv, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            total += 1
            tid = row.get("track_id")
            if not tid or tid in seen:
                continue
            seen.add(tid)
            try:
                pop = float(row.get("popularity") or 0)
                tempo = float(row.get("tempo") or 0)
                loud = float(row.get("loudness") or 0)
            except ValueError:
                continue
            charted = (row.get("chart") or "").strip() != ""
            if not (charted or pop >= a.min_popularity):
                continue
            if not (40 <= tempo <= 220) or not (-30 <= loud <= 0):
                continue      # sanity: drop obvious feature glitches
            b = bucket_of(row.get("genres") or "")
            if b is None:
                continue
            hits += 1
            by_bucket.setdefault(b, []).append((tempo, loud))

    out_hits = {}
    for b, rows in sorted(by_bucket.items()):
        bpms = [r[0] for r in rows]
        louds = [r[1] for r in rows]
        out_hits[b] = {
            "bpm": [int(pct(bpms, 10)), int(pct(bpms, 90))],
            "lufs": [round(pct(louds, 25), 1), round(pct(louds, 75), 1)],
            "n": len(rows),
            "source": "zenodo_900k_2024",
        }
        print(f"{b:15s} n={len(rows):6d}  bpm={out_hits[b]['bpm']}  loud={out_hits[b]['lufs']}")

    print(f"\nrows={total}  unique hit tracks bucketed={hits}")
    out = {}
    if os.path.exists(a.out):
        out = json.load(open(a.out))
    out["hits"] = out_hits
    out["hits_generated"] = str(date.today())
    with open(a.out, "w") as fo:
        json.dump(out, fo, indent=2)
    print(f"wrote {a.out}")


if __name__ == "__main__":
    main()
