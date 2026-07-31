"""
BPM validation — GiantSteps Tempo dataset (664 Beatport EDM previews).

Ground truth: annotations_v2/tempo/*.bpm (crowd-sourced re-annotation, one
float per file) from https://github.com/GiantSteps/giantsteps-tempo-dataset.
Audio: same JKU mirror as the key dataset; cached in calibration/
giantsteps-tempo/audio/ and reused on re-runs.

Measures the EXACT production path: resample to ANALYSIS_SR -> librosa
beat_track -> measure_tempo_key()'s dance-range fold (<70 doubled, >190
halved). Scores (MIREX convention, ±4% tolerance):
  accuracy1  estimate within 4% of ground truth
  accuracy2  within 4% of GT, or of GT*2, GT/2, GT*3, GT/3 (octave-forgiven)

Results are MERGED into engine/norms_data.json under "tempo_validation".

Usage:
  .venv/bin/python tools/validate_tempo.py [--workers 6] [--limit 0]
"""
import argparse
import json
import os
import subprocess
import sys
import tempfile
from datetime import date
from multiprocessing import Pool

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "engine"))

ROOT = os.path.join(os.path.dirname(__file__), "..")
GS = os.path.join(ROOT, "calibration", "giantsteps-tempo")
ANN_DIR = os.path.join(GS, "annotations_v2", "tempo")
AUDIO = os.path.join(GS, "audio")
NORMS = os.path.join(ROOT, "engine", "norms_data.json")
MIRROR = "https://www.cp.jku.at/datasets/giantsteps/backup/%s.mp3"
TOL = 0.04


def run_one(job):
    """(stem, truth_bpm) -> (category, detail)."""
    stem, truth = job
    import numpy as np
    import librosa
    from analyze import _load, measure_tempo_key, ANALYSIS_SR
    local = os.path.join(AUDIO, stem + ".mp3")
    wav = None
    try:
        if not os.path.exists(local):
            part = local + ".part"
            r = subprocess.run(["curl", "-sfL", "--max-time", "180", "-o", part,
                                MIRROR % stem], capture_output=True)
            if r.returncode != 0 or not os.path.exists(part) \
                    or os.path.getsize(part) < 100_000:
                if os.path.exists(part):
                    os.remove(part)
                return ("download_fail", stem)
            os.replace(part, local)
        fd, wav = tempfile.mkstemp(suffix=".wav"); os.close(fd)
        subprocess.run(["ffmpeg", "-y", "-i", local, "-ac", "2", "-ar", "44100", wav],
                       check=True, capture_output=True, timeout=120)
        # production path: same downmix, same resample, same HPSS -> tempogram
        # octave-grid estimator, same fold (analyze() lines, minus loudness/key)
        from analyze import estimate_tempo
        mono, _, sr = _load(wav)
        m22 = librosa.resample(mono, orig_sr=sr, target_sr=ANALYSIS_SR) \
            if sr != ANALYSIS_SR else mono
        perc = librosa.effects.percussive(m22)
        oenv_p = librosa.onset.onset_strength(y=perc, sr=ANALYSIS_SR, hop_length=512)
        tempo = estimate_tempo(oenv_p, ANALYSIS_SR, 512)
        if not tempo:
            tempo, _ = librosa.beat.beat_track(y=m22, sr=ANALYSIS_SR, units="time")
        est = measure_tempo_key(tempo, np.zeros(12))["bpm"]

        def within(gt):
            return abs(est - gt) <= TOL * gt
        if within(truth):
            return ("acc1", f"{stem}: gt={truth} est={est}")
        if any(within(truth * f) for f in (2.0, 0.5, 3.0, 1 / 3)):
            return ("acc2_only", f"{stem}: gt={truth} est={est}")
        return ("miss", f"{stem}: gt={truth} est={est}")
    except Exception as e:
        return ("analyze_fail", f"{stem}: {e}")
    finally:
        if wav and os.path.exists(wav):
            os.remove(wav)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--limit", type=int, default=0)
    a = ap.parse_args()
    os.makedirs(AUDIO, exist_ok=True)

    jobs = []
    for fn in sorted(os.listdir(ANN_DIR)):
        if fn.endswith(".bpm"):
            truth = float(open(os.path.join(ANN_DIR, fn)).read().strip())
            jobs.append((fn[:-4], truth))
    if a.limit:
        jobs = jobs[:a.limit]
    print(f"validating tempo on {len(jobs)} GiantSteps tracks "
          f"({a.workers} workers)...", flush=True)

    counts, done = {}, 0
    with Pool(a.workers) as pool:
        for cat, _ in pool.imap_unordered(run_one, jobs, chunksize=1):
            done += 1
            counts[cat] = counts.get(cat, 0) + 1
            if done % 50 == 0:
                print(f"  {done}/{len(jobs)} {counts}", flush=True)

    skipped = counts.get("download_fail", 0) + counts.get("analyze_fail", 0)
    n = done - skipped
    if n == 0:
        print("no tracks scored — nothing written")
        return
    acc1 = counts.get("acc1", 0)
    acc2 = acc1 + counts.get("acc2_only", 0)
    result = {
        "accuracy1": round(100 * acc1 / n, 1),
        "accuracy2": round(100 * acc2 / n, 1),
        "tolerance_pct": 4,
        "n": n,
        "skipped": skipped,
        "source": "giantsteps_tempo_v2",
    }
    out = json.load(open(NORMS)) if os.path.exists(NORMS) else {}
    out["tempo_validation"] = result
    out["tempo_validation_generated"] = str(date.today())
    with open(NORMS, "w") as f:
        json.dump(out, f, indent=2)
    print(f"\ntempo_validation written to {NORMS}:")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
