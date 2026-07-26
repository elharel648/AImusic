"""
AI-music baseline — measure our AI-tells on real Suno/Udio generations.

Source: SONICS (https://huggingface.co/datasets/awsaf49/sonics, CC BY-NC 4.0)
~49k fully-synthetic full-length songs (Suno v2-v3.5, Udio v32/v130) in ten
independent ~3GB zips. Pipeline per part: download -> verify -> extract ->
sample N tracks -> analyze -> APPEND rows -> delete audio. Peak disk ~7GB.

Output: engine/norms_data.json "ai_baseline" — the distribution of every
AI-tell metric across real AI music. Together with "human_baseline" (FMA)
this turns each tell threshold into a measured two-population statement.
Research/eval use of an NC-licensed corpus; aggregate stats only, no audio kept.

Usage:
  .venv/bin/python tools/ingest_sonics.py [--per-part 1000] [--parts 1-10] [--workers 6]
"""
import argparse
import json
import os
import random
import shutil
import subprocess
import sys
import tempfile
from datetime import date
from multiprocessing import Pool

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "engine"))

BASE = "https://huggingface.co/datasets/awsaf49/sonics/resolve/main/fake_songs/part_%02d.zip"
ROOT = os.path.join(os.path.dirname(__file__), "..")
WORK = os.path.join(ROOT, "calibration", "sonics")
ROWS = os.path.join(ROOT, "data", "sonics_rows.jsonl")
NORMS = os.path.join(ROOT, "engine", "norms_data.json")
METRICS = ["bpm", "lufs", "true_peak_db", "dynamic_range_db", "intro_sec",
           "low_mid_ratio", "stereo_width", "timing_rigidity",
           "section_repetition", "spectral_uniformity", "duration_sec"]
MIN_FREE_GB = 8


def free_gb():
    st = os.statvfs(ROOT)
    return st.f_bavail * st.f_frsize / 1e9


def analyze_one(path):
    from analyze import analyze
    wav = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            wav = tmp.name
        subprocess.run(["ffmpeg", "-y", "-i", path, "-ac", "2", "-ar", "44100", wav],
                       check=True, capture_output=True, timeout=120)
        d = analyze(wav, "default")
        return {k: d.get(k) for k in METRICS} | {"file": os.path.basename(path)}
    except Exception:
        return None
    finally:
        if wav and os.path.exists(wav):
            os.remove(wav)


def run_part(idx, per_part, workers):
    if free_gb() < MIN_FREE_GB:
        print(f"ABORT part {idx}: only {free_gb():.1f}GB free (< {MIN_FREE_GB})", flush=True)
        return False
    os.makedirs(WORK, exist_ok=True)
    zpath = os.path.join(WORK, f"part_{idx:02d}.zip")
    xdir = os.path.join(WORK, f"part_{idx:02d}")
    print(f"[part {idx}] downloading...", flush=True)
    subprocess.run(["curl", "-sL", "-o", zpath, BASE % idx], check=True, timeout=5400)
    if os.path.getsize(zpath) < 1e9:
        print(f"ABORT part {idx}: zip only {os.path.getsize(zpath)/1e6:.0f}MB — bad download", flush=True)
        os.remove(zpath)
        return False
    # verify it's a readable standalone archive BEFORE deleting anything
    lst = subprocess.run(["bsdtar", "-tf", zpath], capture_output=True, text=True)
    names = [l for l in lst.stdout.splitlines() if l.lower().endswith((".mp3", ".wav", ".flac", ".ogg"))]
    if lst.returncode != 0 or len(names) < 100:
        print(f"ABORT part {idx}: archive unreadable or too few audio files ({len(names)})", flush=True)
        return False
    sample = set(random.Random(42 + idx).sample(names, min(per_part, len(names))))
    print(f"[part {idx}] extracting {len(sample)} of {len(names)} tracks...", flush=True)
    os.makedirs(xdir, exist_ok=True)
    subprocess.run(["bsdtar", "-xf", zpath, "-C", xdir] + sorted(sample), check=True, timeout=1800)
    os.remove(zpath)                      # zip verified + extracted -> safe to free 3GB now
    paths = []
    for r, _, fs in os.walk(xdir):
        paths += [os.path.join(r, f) for f in fs if f.lower().endswith((".mp3", ".wav", ".flac", ".ogg"))]
    print(f"[part {idx}] analyzing {len(paths)} tracks ({workers} workers)...", flush=True)
    done = ok = 0
    with Pool(workers) as pool, open(ROWS, "a") as out:
        for res in pool.imap_unordered(analyze_one, paths, chunksize=2):
            done += 1
            if done % 100 == 0:
                print(f"  [part {idx}] {done}/{len(paths)}", flush=True)
            if res:
                ok += 1
                out.write(json.dumps(res) + "\n")
    shutil.rmtree(xdir)
    print(f"[part {idx}] DONE — {ok} rows appended", flush=True)
    return True


def pct(vals, q):
    vals = sorted(v for v in vals if v is not None)
    if not vals:
        return None
    i = min(len(vals) - 1, max(0, int(round(q / 100 * (len(vals) - 1)))))
    return vals[i]


def write_baseline():
    rows = [json.loads(l) for l in open(ROWS)] if os.path.exists(ROWS) else []
    if not rows:
        print("no rows — baseline not written")
        return
    base = {}
    for k in METRICS:
        if k in ("duration_sec",):
            continue
        col = [r.get(k) for r in rows]
        base[k] = {p: pct(col, q) for p, q in
                   (("p05", 5), ("p25", 25), ("p50", 50), ("p75", 75), ("p95", 95))}
    base["n"] = len(rows)
    base["source"] = "sonics_suno_udio"
    out = json.load(open(NORMS)) if os.path.exists(NORMS) else {}
    out["ai_baseline"] = base
    out["ai_baseline_generated"] = str(date.today())
    with open(NORMS, "w") as f:
        json.dump(out, f, indent=2)
    print(f"ai_baseline written: n={len(rows)}")
    for k in ("timing_rigidity", "section_repetition", "spectral_uniformity", "dynamic_range_db"):
        print(f"  {k}: {base[k]}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--per-part", type=int, default=1000)
    ap.add_argument("--parts", default="1-10")
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--baseline-only", action="store_true")
    a = ap.parse_args()
    if not a.baseline_only:
        lo, hi = (a.parts.split("-") + [a.parts.split("-")[0]])[:2]
        for i in range(int(lo), int(hi) + 1):
            if not run_part(i, a.per_part, a.workers):
                print(f"stopping at part {i}", flush=True)
                break
    write_baseline()


if __name__ == "__main__":
    main()
