"""
Corpus calibration — derive genre norms + human AI-tell baselines from real audio.

Corpus: FMA-small (Free Music Archive) — 8,000 thirty-second clips, CC-licensed,
8 balanced genres, all human-made (pre-AI-music era). https://github.com/mdeff/fma

Outputs engine/norms_data.json:
  {
    "genres": { "<fma-genre>": {"bpm":[lo,hi], "intro_sec":[lo,hi], "lufs":[lo,hi],
                                 "n": N, "source": "fma_small"} },
    "human_baseline": { "timing_rigidity": {"p95":..,"p99":..}, ... , "n": N },
    "intro_capped_at": 25,
    "generated": "<iso date>"
  }

Notes on honesty:
  - Clips are 30s → intro percentiles are capped at 25s and flagged.
  - FMA are independent releases, not major-label masters → LUFS norms are
    reported as measured (they document the corpus, not chart masters).

Usage:
  .venv/bin/python tools/calibrate.py --audio calibration/fma_small \
      --tracks calibration/fma_metadata/tracks.csv [--limit 100] [--workers 6]
"""
import argparse
import csv
import json
import os
import subprocess
import sys
import tempfile
from datetime import date
from multiprocessing import Pool

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "engine"))

FMA_GENRES = {"Electronic", "Hip-Hop", "Pop", "Rock"}   # mappable to product genres
METRICS = ["bpm", "intro_sec", "lufs", "low_mid_ratio", "stereo_width",
           "dynamic_range_db", "timing_rigidity", "section_repetition",
           "spectral_uniformity"]
INTRO_CAP = 25.0   # 30s clips: intro beyond ~25s is right-censored


def load_genre_map(tracks_csv):
    """track_id -> genre_top from FMA's multi-header tracks.csv."""
    out = {}
    with open(tracks_csv, newline="", encoding="utf-8") as f:
        rows = csv.reader(f)
        h1 = next(rows); h2 = next(rows); next(rows)          # 3 header rows
        col = next(i for i, (a, b) in enumerate(zip(h1, h2))
                   if a == "track" and b == "genre_top")
        for r in rows:
            if r and r[0].isdigit() and len(r) > col and r[col]:
                out[int(r[0])] = r[col]
    return out


def analyze_one(args):
    path, genre = args
    from analyze import analyze
    try:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            wav = tmp.name
        subprocess.run(["ffmpeg", "-y", "-i", path, "-ac", "2", "-ar", "44100", wav],
                       check=True, capture_output=True, timeout=60)
        d = analyze(wav, "default")
        os.remove(wav)
        return genre, {k: d.get(k) for k in METRICS}
    except Exception:
        try: os.remove(wav)
        except Exception: pass
        return None


def pct(vals, q):
    vals = sorted(v for v in vals if v is not None)
    if not vals:
        return None
    i = min(len(vals) - 1, max(0, int(round(q / 100 * (len(vals) - 1)))))
    return vals[i]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--audio", required=True)
    ap.add_argument("--tracks", required=True)
    ap.add_argument("--limit", type=int, default=0, help="max tracks per genre (0 = all)")
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "engine", "norms_data.json"))
    a = ap.parse_args()

    genre_of = load_genre_map(a.tracks)
    jobs, per_genre = [], {}
    for root, _, files in os.walk(a.audio):
        for fn in sorted(files):
            if not fn.endswith(".mp3"):
                continue
            tid = int(fn.split(".")[0])
            g = genre_of.get(tid)
            if g is None:
                continue
            if a.limit and per_genre.get(g, 0) >= a.limit:
                continue
            per_genre[g] = per_genre.get(g, 0) + 1
            jobs.append((os.path.join(root, fn), g))

    print(f"analyzing {len(jobs)} tracks across {len(per_genre)} genres "
          f"({a.workers} workers)...", flush=True)

    by_genre, all_rows, done = {}, [], 0
    with Pool(a.workers) as pool:
        for res in pool.imap_unordered(analyze_one, jobs, chunksize=4):
            done += 1
            if done % 200 == 0:
                print(f"  {done}/{len(jobs)}", flush=True)
            if res is None:
                continue
            g, row = res
            all_rows.append(row)
            if g in FMA_GENRES:
                by_genre.setdefault(g, []).append(row)

    genres_out = {}
    for g, rows in by_genre.items():
        col = lambda k: [r[k] for r in rows]
        genres_out[g] = {
            "bpm": [int(pct(col("bpm"), 10)), int(pct(col("bpm"), 90))],
            "intro_sec": [round(pct(col("intro_sec"), 10), 1),
                          round(min(pct(col("intro_sec"), 90), INTRO_CAP), 1)],
            "lufs": [round(pct(col("lufs"), 25), 1), round(pct(col("lufs"), 75), 1)],
            "low_mid_ratio_p90": round(pct(col("low_mid_ratio"), 90), 3),
            "n": len(rows), "source": "fma_small",
            # 30s excerpts: intro/structure stats are right-censored and often
            # mid-song — consumers must not treat them as full-track norms.
            "full_length": False,
        }

    col = lambda k: [r[k] for r in all_rows]
    baseline = {k: {"p95": round(pct(col(k), 95), 3), "p99": round(pct(col(k), 99), 3)}
                for k in ("timing_rigidity", "section_repetition", "spectral_uniformity")}
    baseline["dynamic_range_db_p05"] = round(pct(col("dynamic_range_db"), 5), 2)
    baseline["n"] = len(all_rows)

    # merge-friendly: preserve other sections (e.g. Tier A "hits")
    out = {}
    if os.path.exists(a.out):
        out = json.load(open(a.out))
    out.update({"genres": genres_out, "human_baseline": baseline,
                "intro_capped_at": INTRO_CAP, "generated": str(date.today())})
    with open(a.out, "w") as f:
        json.dump(out, f, indent=2)
    print(f"wrote {a.out}")
    print(json.dumps(out, indent=2)[:1200])


if __name__ == "__main__":
    main()
