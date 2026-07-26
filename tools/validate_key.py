"""
Key-detection validation — GiantSteps Key dataset (604 Beatport EDM previews).

Ground truth: expert key annotations from
https://github.com/GiantSteps/giantsteps-key-dataset (annotations/key/*.key).
Audio: per-track 2-min LOFI previews from the JKU mirror (original Beatport
CDN is dead): https://www.cp.jku.at/datasets/giantsteps/backup/<id>.LOFI.mp3

Each worker: download mp3 -> ffmpeg wav -> engine analyze() -> compare key ->
delete audio. Nothing is kept on disk. Scores (MIREX convention):
  exact    same tonic + mode                       weight 1.0
  fifth    tonic a perfect fifth up/down, same mode weight 0.5
  relative relative major/minor                     weight 0.3
  parallel same tonic, other mode                   weight 0.2

Results are MERGED into engine/norms_data.json under "key_validation".

Usage:
  .venv/bin/python tools/validate_key.py [--workers 6] [--limit 0]
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
ANN_DIR = os.path.join(ROOT, "calibration", "giantsteps-key", "annotations", "key")
NORMS = os.path.join(ROOT, "engine", "norms_data.json")
MIRROR = "https://www.cp.jku.at/datasets/giantsteps/backup/%s.mp3"

PC = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5,
      "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10,
      "B": 11}


def parse_key(s):
    """'Eb minor' -> (3, 'minor') or None."""
    parts = s.strip().split()
    if len(parts) != 2 or parts[0] not in PC or parts[1] not in ("major", "minor"):
        return None
    return PC[parts[0]], parts[1]


def score(truth, est):
    """MIREX category for (root, mode) pair vs ground truth."""
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


def run_one(job):
    """(stem, truth_str) -> (category|'download_fail'|'analyze_fail', detail)."""
    stem, truth_str = job
    from analyze import analyze
    truth = parse_key(truth_str)
    if truth is None:
        return ("bad_annotation", stem)
    mp3 = wav = None
    try:
        fd, mp3 = tempfile.mkstemp(suffix=".mp3"); os.close(fd)
        part = mp3 + ".part"
        r = subprocess.run(["curl", "-sfL", "--max-time", "180", "-o", part,
                            MIRROR % stem], capture_output=True)
        if r.returncode != 0 or not os.path.exists(part) or os.path.getsize(part) < 100_000:
            if os.path.exists(part):
                os.remove(part)
            return ("download_fail", stem)
        os.replace(part, mp3)
        fd, wav = tempfile.mkstemp(suffix=".wav"); os.close(fd)
        subprocess.run(["ffmpeg", "-y", "-i", mp3, "-ac", "2", "-ar", "44100", wav],
                       check=True, capture_output=True, timeout=120)
        d = analyze(wav, "default")
        est = parse_key(str(d.get("key", "")))
        if est is None:
            return ("analyze_fail", stem)
        return (score(truth, est), f"{stem}: truth={truth_str} est={d['key']}")
    except Exception as e:
        return ("analyze_fail", f"{stem}: {e}")
    finally:
        for p in (mp3, wav, (mp3 or "") + ".part"):
            if p and os.path.exists(p):
                os.remove(p)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--limit", type=int, default=0)
    a = ap.parse_args()

    jobs = []
    for fn in sorted(os.listdir(ANN_DIR)):
        if fn.endswith(".key"):
            stem = fn[:-4]                                 # e.g. 1004923.LOFI
            truth = open(os.path.join(ANN_DIR, fn)).read().strip()
            jobs.append((stem, truth))
    if a.limit:
        jobs = jobs[:a.limit]
    print(f"validating key detection on {len(jobs)} GiantSteps tracks "
          f"({a.workers} workers)...", flush=True)

    counts, done = {}, 0
    with Pool(a.workers) as pool:
        for cat, _ in pool.imap_unordered(run_one, jobs, chunksize=1):
            done += 1
            counts[cat] = counts.get(cat, 0) + 1
            if done % 50 == 0:
                print(f"  {done}/{len(jobs)} {counts}", flush=True)

    skipped = counts.get("download_fail", 0) + counts.get("analyze_fail", 0) \
        + counts.get("bad_annotation", 0)
    n = done - skipped
    if n == 0:
        print("no tracks scored — nothing written")
        return
    exact = counts.get("exact", 0)
    fifth = counts.get("fifth", 0)
    relative = counts.get("relative", 0)
    parallel = counts.get("parallel", 0)
    mirex = (exact + 0.5 * fifth + 0.3 * relative + 0.2 * parallel) / n

    result = {
        "exact": round(100 * exact / n, 1),
        "fifth": round(100 * fifth / n, 1),
        "relative": round(100 * relative / n, 1),
        "parallel": round(100 * parallel / n, 1),
        "mirex_weighted": round(100 * mirex, 1),
        "n": n,
        "skipped": skipped,
        "source": "giantsteps_key",
    }
    out = json.load(open(NORMS)) if os.path.exists(NORMS) else {}
    out["key_validation"] = result
    out["key_validation_generated"] = str(date.today())
    with open(NORMS, "w") as f:
        json.dump(out, f, indent=2)
    print(f"\nkey_validation written to {NORMS}:")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
