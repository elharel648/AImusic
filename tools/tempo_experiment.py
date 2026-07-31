"""
Tempo-estimation bake-off — GiantSteps Tempo ground truth, offline.

Requires calibration/giantsteps-tempo/audio/*.mp3 (cached by validate_tempo).
Onset envelopes (raw + percussive-only via HPSS) are extracted ONCE per track
into tempo_env_cache.npz; every estimator then scores on the same envelopes:

  estimators: beat_track (current production), feature.tempo (tempogram peak),
              each on raw and percussive envelopes
  folds:      none | production fold (<70 x2, >190 /2)

Scored per MIREX: accuracy1 (±4%), accuracy2 (octave-forgiven). The winner's
numbers go into the report only after validate_tempo.py re-measures the real
production path end-to-end.

Usage:
  .venv/bin/python tools/tempo_experiment.py [--workers 5] [--limit 0]
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
GS = os.path.join(ROOT, "calibration", "giantsteps-tempo")
ANN = os.path.join(GS, "annotations_v2", "tempo")
AUDIO = os.path.join(GS, "audio")
CACHE = os.path.join(GS, "tempo_env_cache.npz")
SR = 22050
HOP = 512
TOL = 0.04


def extract_one(job):
    import librosa
    stem, path = job
    wav = None
    try:
        fd, wav = tempfile.mkstemp(suffix=".wav"); os.close(fd)
        subprocess.run(["ffmpeg", "-y", "-i", path, "-ac", "1", "-ar", str(SR), wav],
                       check=True, capture_output=True, timeout=120)
        y, _ = librosa.load(wav, sr=SR, mono=True)
        oenv = librosa.onset.onset_strength(y=y, sr=SR, hop_length=HOP)
        perc = librosa.effects.percussive(y)
        oenv_p = librosa.onset.onset_strength(y=perc, sr=SR, hop_length=HOP)
        return stem, oenv.astype(np.float32), oenv_p.astype(np.float32)
    except Exception:
        return stem, None, None
    finally:
        if wav and os.path.exists(wav):
            os.remove(wav)


def fold_prod(t):
    if t < 70:
        t *= 2
    elif t > 190:
        t /= 2
    return t


def main():
    import librosa
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=5)
    ap.add_argument("--limit", type=int, default=0)
    a = ap.parse_args()

    truths = {}
    for fn in sorted(os.listdir(ANN)):
        if fn.endswith(".bpm"):
            truths[fn[:-4]] = float(open(os.path.join(ANN, fn)).read().strip())

    cache = {}
    if os.path.exists(CACHE):
        z = np.load(CACHE)
        stems = {k.rsplit("|", 1)[0] for k in z.files}
        cache = {s: (z[s + "|r"], z[s + "|p"]) for s in stems
                 if s + "|r" in z.files and s + "|p" in z.files}
    todo = [(s, os.path.join(AUDIO, s + ".mp3")) for s in truths
            if s not in cache and os.path.exists(os.path.join(AUDIO, s + ".mp3"))]
    if a.limit:
        todo = todo[:a.limit]
    if todo:
        print(f"extracting envelopes for {len(todo)} tracks "
              f"({a.workers} workers, {len(cache)} cached)...", flush=True)
        done = 0
        with Pool(a.workers) as pool:
            for stem, oenv, oenv_p in pool.imap_unordered(extract_one, todo, chunksize=4):
                done += 1
                if done % 50 == 0:
                    print(f"  {done}/{len(todo)}", flush=True)
                if oenv is not None:
                    cache[stem] = (oenv, oenv_p)
        flat = {}
        for s, (r, p) in cache.items():
            flat[s + "|r"] = r
            flat[s + "|p"] = p
        np.savez_compressed(CACHE, **flat)
        print(f"cached {len(cache)} tracks -> {CACHE}", flush=True)

    stems = [s for s in truths if s in cache]
    print(f"\nscoring {len(stems)} tracks\n", flush=True)

    def est_bt(env):
        t, _ = librosa.beat.beat_track(onset_envelope=env, sr=SR, hop_length=HOP)
        return float(np.atleast_1d(t)[0])

    def est_tg(env):
        t = librosa.feature.tempo(onset_envelope=env, sr=SR, hop_length=HOP)
        return float(np.atleast_1d(t)[0])

    estimators = {"beat_track": est_bt, "tempogram": est_tg}
    board = []
    for name, fn in estimators.items():
        for env_name, idx in (("raw", 0), ("perc", 1)):
            raw_est = {s: fn(cache[s][idx]) for s in stems}
            for fold_name, fold in (("nofold", lambda t: t), ("prod", fold_prod)):
                acc1 = acc2 = 0
                for s in stems:
                    gt, est = truths[s], fold(raw_est[s])
                    if abs(est - gt) <= TOL * gt:
                        acc1 += 1
                        acc2 += 1
                    elif any(abs(est - gt * f) <= TOL * gt * f
                             for f in (2.0, 0.5, 3.0, 1 / 3)):
                        acc2 += 1
                n = len(stems)
                board.append((100 * acc1 / n, 100 * acc2 / n,
                              name, env_name, fold_name))
    board.sort(reverse=True)
    print(f"{'acc1':>6} {'acc2':>6}  estimator    envelope  fold")
    for a1, a2, name, env_name, fold_name in board:
        print(f"{a1:6.1f} {a2:6.1f}  {name:<11} {env_name:<8} {fold_name}")


if __name__ == "__main__":
    main()
