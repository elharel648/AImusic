"""
Tempo bake-off round 2 — smarter estimation on the cached envelopes.

Round 1 (tempo_experiment.py): best 43.5/51.8 (percussive + prod fold).
Round 2 candidates, all on the percussive envelope (round-1 winner):
  prior_s<x>   tempogram peak under a lognormal prior centered at 128 BPM
               (EDM-informed; product knows the genre at analysis time)
  median       frame-wise tempo, median-aggregated (robust to drops/breaks)
  octave_grid  tempogram peak, then pick among {t/2, t, 2t} the candidate
               with the strongest summed tempogram support inside 60-200

Usage:  .venv/bin/python tools/tempo_experiment2.py
"""
import os
import sys

import numpy as np
import librosa
import scipy.stats

ROOT = os.path.join(os.path.dirname(__file__), "..")
GS = os.path.join(ROOT, "calibration", "giantsteps-tempo")
ANN = os.path.join(GS, "annotations_v2", "tempo")
CACHE = os.path.join(GS, "tempo_env_cache.npz")
SR, HOP, TOL = 22050, 512, 0.04


def fold_prod(t):
    if t < 70:
        t *= 2
    elif t > 190:
        t /= 2
    return t


def main():
    truths = {fn[:-4]: float(open(os.path.join(ANN, fn)).read().strip())
              for fn in sorted(os.listdir(ANN)) if fn.endswith(".bpm")}
    z = np.load(CACHE)
    stems = [s for s in truths if f"{s}|p" in z.files]
    print(f"scoring {len(stems)} tracks (cached percussive envelopes)\n")

    freqs = librosa.tempo_frequencies(384, sr=SR, hop_length=HOP)

    def tgram(env):
        return np.mean(librosa.feature.tempogram(
            onset_envelope=env, sr=SR, hop_length=HOP, win_length=384), axis=1)

    candidates = {}

    def prior_est(env, s):
        prior = scipy.stats.lognorm(loc=0, scale=128, s=s)
        t = librosa.feature.tempo(onset_envelope=env, sr=SR, hop_length=HOP,
                                  prior=prior)
        return float(np.atleast_1d(t)[0])

    for s in (0.25, 0.4, 0.6):
        candidates[f"prior_s{s}"] = lambda env, s=s: prior_est(env, s)

    def median_est(env):
        t = librosa.feature.tempo(onset_envelope=env, sr=SR, hop_length=HOP,
                                  aggregate=None)
        return float(np.median(t))

    candidates["median"] = median_est

    def octave_grid(env):
        tg = tgram(env)
        # base peak anywhere sensible
        sel = (freqs >= 40) & (freqs <= 400)
        base = freqs[sel][int(np.argmax(tg[sel]))]
        best, best_score = base, -1.0
        for f in (0.5, 1.0, 2.0):
            cand = base * f
            if not 60 <= cand <= 200:
                continue
            # support = tempogram mass at cand and its half (beat + bar level)
            score = 0.0
            for sub in (cand, cand / 2):
                i = int(np.argmin(np.abs(freqs - sub)))
                score += tg[i]
            if score > best_score:
                best, best_score = cand, score
        return float(best)

    candidates["octave_grid"] = octave_grid

    print(f"{'acc1':>6} {'acc2':>6}  candidate      fold")
    board = []
    for name, fn in candidates.items():
        ests = {s: fn(z[f"{s}|p"]) for s in stems}
        for fold_name, fold in (("nofold", lambda t: t), ("prod", fold_prod)):
            acc1 = acc2 = 0
            for s in stems:
                gt, est = truths[s], fold(ests[s])
                if abs(est - gt) <= TOL * gt:
                    acc1 += 1; acc2 += 1
                elif any(abs(est - gt * f) <= TOL * gt * f
                         for f in (2.0, 0.5, 3.0, 1 / 3)):
                    acc2 += 1
            n = len(stems)
            board.append((100 * acc1 / n, 100 * acc2 / n, name, fold_name))
    board.sort(reverse=True)
    for a1, a2, name, fold_name in board:
        print(f"{a1:6.1f} {a2:6.1f}  {name:<13} {fold_name}")


if __name__ == "__main__":
    main()
