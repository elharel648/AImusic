"""
Tier A calibration — hit-grade norms from real commercial tracks.

Source: Spotify tracks dataset (114k commercial tracks with audio features,
collected from the official Spotify Web API before its 2024 deprecation;
huggingface.co/datasets/maharshipandya/spotify-tracks-dataset).

We keep only tracks with popularity >= MIN_POP (real, listened-to releases),
map Spotify's fine genres onto the product's genre buckets, and store
percentile ranges for BPM and loudness in engine/norms_data.json under "hits".

Note on loudness: Spotify's `loudness` is the track's average loudness in dB
(ReplayGain-style) — a close cousin of integrated LUFS. We treat it as the
commercial-loudness reference and say so in provenance.

Usage:  .venv/bin/python tools/ingest_spotify.py [--csv data/spotify_tracks.csv] [--min-pop 50]
"""
import argparse
import csv
import json
import os
from datetime import date

BUCKETS = {
    "melodic techno": ["techno", "minimal-techno", "trance", "progressive-house"],
    "house":          ["house", "deep-house", "disco"],
    "pop":            ["pop", "dance", "synth-pop", "indie-pop"],
    "hip-hop":        ["hip-hop"],
    "edm":            ["edm", "electro", "club"],
    "rock":           ["rock", "alt-rock", "hard-rock", "indie", "punk-rock"],
    "lo-fi":          ["chill", "ambient", "trip-hop"],
}


def pct(vals, q):
    vals = sorted(vals)
    if not vals:
        return None
    i = min(len(vals) - 1, max(0, int(round(q / 100 * (len(vals) - 1)))))
    return vals[i]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", default=os.path.join(os.path.dirname(__file__), "..", "data", "spotify_tracks.csv"))
    ap.add_argument("--min-pop", type=int, default=50)
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "engine", "norms_data.json"))
    a = ap.parse_args()

    src_to_bucket = {s: b for b, srcs in BUCKETS.items() for s in srcs}
    rows = {b: {"tempo": [], "loud": []} for b in BUCKETS}

    with open(a.csv, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            b = src_to_bucket.get(r["track_genre"])
            if b is None or int(r["popularity"]) < a.min_pop:
                continue
            try:
                tempo, loud = float(r["tempo"]), float(r["loudness"])
            except ValueError:
                continue
            if 40 <= tempo <= 220 and -30 <= loud <= 0:      # sanity gates
                rows[b]["tempo"].append(tempo)
                rows[b]["loud"].append(loud)

    hits = {}
    for b, d in rows.items():
        if len(d["tempo"]) < 100:      # don't ship thin statistics
            continue
        hits[b] = {
            "bpm": [int(pct(d["tempo"], 10)), int(pct(d["tempo"], 90))],
            "lufs": [round(pct(d["loud"], 25), 1), round(pct(d["loud"], 75), 1)],
            "n": len(d["tempo"]),
            "min_popularity": a.min_pop,
            "source": "spotify-tracks-dataset",
        }

    # merge-friendly: preserve other sections (e.g. future FMA "genres"/"human_baseline")
    out = {}
    if os.path.exists(a.out):
        out = json.load(open(a.out))
    out["hits"] = hits
    out["generated"] = str(date.today())
    with open(a.out, "w") as f:
        json.dump(out, f, indent=2)
    print(f"wrote {a.out}")
    for b, v in hits.items():
        print(f"  {b:15s} n={v['n']:5d}  bpm {v['bpm']}  loudness {v['lufs']}")


if __name__ == "__main__":
    main()
