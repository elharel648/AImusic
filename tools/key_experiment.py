"""
Key-detection algorithm bake-off — GiantSteps Key ground truth, offline.

Requires calibration/giantsteps-key/audio/*.mp3 (one-time download; see
validate_key.py header for the JKU mirror). Features are extracted ONCE per
track into calibration/giantsteps-key/chroma_cache.npz, then every candidate
is scored on the same vectors, so re-runs are seconds:

  chroma variants: raw chroma_cqt vs HPSS-harmonic; mean vs median pooling
  profiles: krumhansl (current), temperley, shaath, edma, edmm
            (values verbatim from essentia src/algorithms/tonal/key.cpp)

Also reports confidence calibration for the winner: exact-accuracy inside
margin buckets (margin = best correlation minus best rival with a different
tonic/mode), so the UI can say "certain" only when it's actually right.

Usage:
  .venv/bin/python tools/key_experiment.py [--workers 3] [--limit 0]
"""
import argparse
import json
import os
import subprocess
import sys
import tempfile
from multiprocessing import Pool

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "engine"))

ROOT = os.path.join(os.path.dirname(__file__), "..")
GS = os.path.join(ROOT, "calibration", "giantsteps-key")
AUDIO = os.path.join(GS, "audio")
ANN = os.path.join(GS, "annotations", "key")
CACHE = os.path.join(GS, "chroma_cache.npz")

PROFILES = {          # essentia key.cpp verbatim
    "krumhansl": ([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88],
                  [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]),
    "temperley": ([5.0, 2.0, 3.5, 2.0, 4.5, 4.0, 2.0, 4.5, 2.0, 3.5, 1.5, 4.0],
                  [5.0, 2.0, 3.5, 4.5, 2.0, 4.0, 2.0, 4.5, 3.5, 2.0, 1.5, 4.0]),
    "shaath":    ([6.6, 2.0, 3.5, 2.3, 4.6, 4.0, 2.5, 5.2, 2.4, 3.7, 2.3, 3.4],
                  [6.5, 2.7, 3.5, 5.4, 2.6, 3.5, 2.5, 5.2, 4.0, 2.7, 4.3, 3.2]),
    "edma":      ([1.00, 0.29, 0.50, 0.40, 0.60, 0.56, 0.32, 0.80, 0.31, 0.45, 0.42, 0.39],
                  [1.00, 0.31, 0.44, 0.58, 0.33, 0.49, 0.29, 0.78, 0.43, 0.29, 0.53, 0.32]),
    "edmm":      ([0.083] * 12,
                  [0.17235348, 0.04, 0.0761009, 0.12, 0.05621498, 0.08527853,
                   0.0497915, 0.13451001, 0.07458916, 0.05003023, 0.09187879, 0.05545106]),
}
VARIANTS = ["raw_mean", "raw_median", "hpss_mean", "hpss_median"]

PC = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5,
      "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10,
      "B": 11}


def parse_key(s):
    parts = s.strip().split()
    if len(parts) != 2 or parts[0] not in PC or parts[1] not in ("major", "minor"):
        return None
    return PC[parts[0]], parts[1]


def mirex_cat(truth, est):
    tr, tm = truth
    er, em = est
    if tr == er and tm == em:
        return "exact"
    if tm == em and (er - tr) % 12 in (5, 7):
        return "fifth"
    if tm != em:
        if tm == "major" and em == "minor" and (er - tr) % 12 == 9:
            return "relative"
        if tm == "minor" and em == "major" and (er - tr) % 12 == 3:
            return "relative"
        if tr == er:
            return "parallel"
    return "other"


def extract_one(job):
    """mp3 -> {variant: 12-dim chroma} (all four variants at once)."""
    import librosa
    stem, path = job
    wav = None
    try:
        fd, wav = tempfile.mkstemp(suffix=".wav")
        os.close(fd)
        subprocess.run(["ffmpeg", "-y", "-i", path, "-ac", "1", "-ar", "22050", wav],
                       check=True, capture_output=True, timeout=180)
        y, sr = librosa.load(wav, sr=22050, mono=True)
        raw = librosa.feature.chroma_cqt(y=y, sr=sr)
        harm = librosa.effects.harmonic(y)
        hp = librosa.feature.chroma_cqt(y=harm, sr=sr)
        return stem, {
            "raw_mean": raw.mean(axis=1), "raw_median": np.median(raw, axis=1),
            "hpss_mean": hp.mean(axis=1), "hpss_median": np.median(hp, axis=1),
        }
    except Exception:
        return stem, None
    finally:
        if wav and os.path.exists(wav):
            os.remove(wav)


def estimate(chroma, major, minor):
    """-> (root, mode, margin) — margin vs best rival with different key."""
    scores = []
    for root in range(12):
        for profile, mode in ((major, "major"), (minor, "minor")):
            r = float(np.corrcoef(chroma, np.roll(profile, root))[0, 1])
            scores.append((r, root, mode))
    scores.sort(reverse=True)
    best = scores[0]
    return best[1], best[2], best[0] - scores[1][0]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--limit", type=int, default=0)
    a = ap.parse_args()

    truths = {}
    for fn in sorted(os.listdir(ANN)):
        if fn.endswith(".key"):
            t = parse_key(open(os.path.join(ANN, fn)).read())
            if t:
                truths[fn[:-4]] = t

    cache = {}
    if os.path.exists(CACHE):
        loaded = np.load(CACHE)
        cache = {k.rsplit("|", 1)[0]: {} for k in loaded.files}
        for k in loaded.files:
            stem, var = k.rsplit("|", 1)
            cache[stem][var] = loaded[k]
    todo = [(s, os.path.join(AUDIO, s + ".mp3")) for s in truths
            if s not in cache and os.path.exists(os.path.join(AUDIO, s + ".mp3"))]
    if a.limit:
        todo = todo[:a.limit]
    if todo:
        print(f"extracting chroma for {len(todo)} tracks ({a.workers} workers, "
              f"{len(cache)} cached)...", flush=True)
        done = 0
        with Pool(a.workers) as pool:
            for stem, feats in pool.imap_unordered(extract_one, todo, chunksize=4):
                done += 1
                if done % 50 == 0:
                    print(f"  {done}/{len(todo)}", flush=True)
                if feats:
                    cache[stem] = feats
        flat = {f"{s}|{v}": c[v] for s, c in cache.items() for v in VARIANTS if v in c}
        np.savez_compressed(CACHE, **flat)
        print(f"cached {len(cache)} tracks -> {CACHE}", flush=True)

    stems = [s for s in truths if s in cache and cache[s].get("raw_mean") is not None]
    print(f"\nscoring {len(stems)} tracks x {len(PROFILES)} profiles x "
          f"{len(VARIANTS)} chroma variants\n")
    W = {"exact": 1.0, "fifth": 0.5, "relative": 0.3, "parallel": 0.2, "other": 0.0}
    board = []
    details = {}
    for prof, (maj, mino) in PROFILES.items():
        for var in VARIANTS:
            cats, rows = {}, []
            for s in stems:
                root, mode, margin = estimate(cache[s][var], maj, mino)
                c = mirex_cat(truths[s], (root, mode))
                cats[c] = cats.get(c, 0) + 1
                rows.append((margin, c))
            n = len(stems)
            mirex = sum(W[c] * k for c, k in cats.items()) / n
            exact = 100 * cats.get("exact", 0) / n
            board.append((100 * mirex, exact, prof, var))
            details[(prof, var)] = rows
    board.sort(reverse=True)
    print(f"{'MIREX':>6} {'exact%':>7}  profile      chroma")
    for mirex, exact, prof, var in board:
        print(f"{mirex:6.1f} {exact:7.1f}  {prof:<12} {var}")

    mirex, exact, prof, var = board[0]
    rows = sorted(details[(prof, var)], reverse=True)
    print(f"\nconfidence calibration for winner ({prof}/{var}), by margin quartile:")
    q = len(rows) // 4
    for i in range(4):
        chunk = rows[i * q:(i + 1) * q] or rows[i * q:]
        ex = 100 * sum(1 for _, c in chunk if c == "exact") / max(1, len(chunk))
        lo, hi = chunk[-1][0], chunk[0][0]
        print(f"  margin {lo:.3f}-{hi:.3f}: exact {ex:.1f}%  (n={len(chunk)})")


if __name__ == "__main__":
    main()
