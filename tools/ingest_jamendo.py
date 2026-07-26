"""
Full-length human-track norms — MTG-Jamendo (https://github.com/MTG/mtg-jamendo-dataset).

raw_30s/audio = full-length 320kbps MP3s of all Jamendo tracks >30s, split into
100 ~5.4GB tars on the fast mirror https://cdn.freesound.org/mtg-jamendo/
(verified: raw_30s_audio-00.tar -> HTTP 200, content-length 5449502720).
sha256 manifest: data/download/raw_30s_audio_sha256_tars.txt in the repo.

Pipeline per tar (peak disk ~9GB): download -> sha256 verify -> list ->
selectively extract only tracks with a mapped genre family -> verify count ->
delete tar -> analyze (ffmpeg first 240s -> wav -> engine analyze()) ->
APPEND rows to data/jamendo_rows.jsonl -> delete audio -> next tar.

Genre families (from autotagging_genre.tsv tags):
  electronic/techno/house -> Electronic   hiphop/rap -> Hip-Hop
  pop -> Pop                              rock/metal/punkrock -> Rock

--norms-only recomputes and MERGES into engine/norms_data.json:
  "genres": per-family intro_sec[p10,p90], bpm[p10,p90], lufs[p25,p75],
            full_length: true — REPLACING the FMA entry only when n >= 300
            (get_norms() only overlays intro_sec when full_length is true).
  "human_baseline_full": p95/p99 tell baseline from full-length human tracks
            (FMA per-row data is gone; existing human_baseline is untouched).

Usage:
  .venv/bin/python tools/ingest_jamendo.py [--tars 59,75,93,47,79,61]
      [--per-tar 500] [--workers 6] [--norms-only]
"""
import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
from datetime import date
from multiprocessing import Pool

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "engine"))

ROOT = os.path.join(os.path.dirname(__file__), "..")
WORK = os.path.join(ROOT, "calibration", "jamendo")
TSV = os.path.join(WORK, "autotagging_genre.tsv")
MANIFEST = os.path.join(WORK, "raw_30s_audio_sha256_tars.txt")
ROWS = os.path.join(ROOT, "data", "jamendo_rows.jsonl")
NORMS = os.path.join(ROOT, "engine", "norms_data.json")
BASE = "https://cdn.freesound.org/mtg-jamendo/raw_30s/audio/raw_30s_audio-%02d.tar"

FAMILY = {"electronic": "Electronic", "techno": "Electronic", "house": "Electronic",
          "hiphop": "Hip-Hop", "rap": "Hip-Hop", "pop": "Pop",
          "rock": "Rock", "metal": "Rock", "punkrock": "Rock"}
METRICS = ["bpm", "intro_sec", "lufs", "low_mid_ratio", "stereo_width",
           "dynamic_range_db", "timing_rigidity", "section_repetition",
           "spectral_uniformity", "duration_sec"]
MIN_FREE_GB = 8
ANALYZE_CAP_SEC = 240      # analyze first 4 min: intro/structure live there
MIN_N_REPLACE = 300        # replace FMA genre row only with this much data


def free_gb():
    st = os.statvfs(ROOT)
    return st.f_bavail * st.f_frsize / 1e9


def load_families():
    """tar path ('14/214.mp3') -> sorted list of mapped families."""
    out = {}
    with open(TSV) as f:
        next(f)
        for line in f:
            cols = line.rstrip("\n").split("\t")
            tags = [t.replace("genre---", "") for t in cols[5:]]
            fams = sorted({FAMILY[t] for t in tags if t in FAMILY})
            if fams:
                out[cols[3]] = fams
    return out


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def analyze_one(job):
    path, fams = job
    from analyze import analyze
    wav = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            wav = tmp.name
        subprocess.run(["ffmpeg", "-y", "-i", path, "-t", str(ANALYZE_CAP_SEC),
                        "-ac", "2", "-ar", "44100", wav],
                       check=True, capture_output=True, timeout=300)
        d = analyze(wav, "default")
        return {k: d.get(k) for k in METRICS} | \
            {"families": fams, "file": os.path.basename(path)}
    except Exception:
        return None
    finally:
        if wav and os.path.exists(wav):
            os.remove(wav)


def run_tar(idx, families, sha_by_name, per_tar, workers):
    if free_gb() < MIN_FREE_GB:
        print(f"ABORT tar {idx}: only {free_gb():.1f}GB free (< {MIN_FREE_GB})", flush=True)
        return False
    os.makedirs(WORK, exist_ok=True)
    name = f"raw_30s_audio-{idx:02d}.tar"
    tpath = os.path.join(WORK, name)
    xdir = os.path.join(WORK, f"x{idx:02d}")

    print(f"[tar {idx}] downloading {name} ({free_gb():.1f}GB free)...", flush=True)
    part = tpath + ".part"
    subprocess.run(["curl", "-sfL", "--retry", "3", "-o", part, BASE % idx],
                   check=True, timeout=7200)
    size = os.path.getsize(part)
    if size < 4e9:
        print(f"ABORT tar {idx}: only {size/1e9:.2f}GB — bad download", flush=True)
        os.remove(part)
        return False
    os.replace(part, tpath)
    print(f"[tar {idx}] verifying sha256 of {size/1e9:.2f}GB...", flush=True)
    if sha256_of(tpath) != sha_by_name[name]:
        print(f"ABORT tar {idx}: sha256 mismatch", flush=True)
        os.remove(tpath)
        return False

    lst = subprocess.run(["bsdtar", "-tf", tpath], capture_output=True, text=True)
    members = [l for l in lst.stdout.splitlines() if l.endswith(".mp3")]
    if lst.returncode != 0 or len(members) < 100:
        print(f"ABORT tar {idx}: unreadable or too few members ({len(members)})", flush=True)
        return False
    wanted = sorted(m for m in members if m in families)[:per_tar]
    if not wanted:
        print(f"ABORT tar {idx}: no genre-mapped tracks in listing", flush=True)
        return False
    print(f"[tar {idx}] extracting {len(wanted)} of {len(members)} tracks...", flush=True)
    os.makedirs(xdir, exist_ok=True)
    subprocess.run(["bsdtar", "-xf", tpath, "-C", xdir] + wanted,
                   check=True, timeout=3600)
    got = sum(len(fs) for _, _, fs in os.walk(xdir))
    if got < len(wanted):
        print(f"ABORT tar {idx}: extracted {got} < expected {len(wanted)}", flush=True)
        return False
    os.remove(tpath)                     # extraction verified -> free ~5.4GB

    jobs = [(os.path.join(xdir, m), families[m]) for m in wanted]
    print(f"[tar {idx}] analyzing {len(jobs)} tracks ({workers} workers)...", flush=True)
    done = ok = 0
    with Pool(workers) as pool, open(ROWS, "a") as out:
        for res in pool.imap_unordered(analyze_one, jobs, chunksize=2):
            done += 1
            if done % 50 == 0:
                print(f"  [tar {idx}] {done}/{len(jobs)}", flush=True)
            if res:
                ok += 1
                out.write(json.dumps(res) + "\n")
    shutil.rmtree(xdir)
    print(f"[tar {idx}] DONE — {ok} rows appended, {free_gb():.1f}GB free", flush=True)
    return True


def pct(vals, q):
    vals = sorted(v for v in vals if v is not None)
    if not vals:
        return None
    i = min(len(vals) - 1, max(0, int(round(q / 100 * (len(vals) - 1)))))
    return vals[i]


def write_norms():
    rows = [json.loads(l) for l in open(ROWS)] if os.path.exists(ROWS) else []
    if not rows:
        print("no rows — norms not written")
        return
    by_fam = {}
    for r in rows:
        for fam in r.get("families", []):
            by_fam.setdefault(fam, []).append(r)

    out = json.load(open(NORMS)) if os.path.exists(NORMS) else {}
    out.setdefault("genres", {})
    for fam, frows in sorted(by_fam.items()):
        col = lambda k: [r[k] for r in frows]
        entry = {
            "bpm": [int(pct(col("bpm"), 10)), int(pct(col("bpm"), 90))],
            "intro_sec": [round(pct(col("intro_sec"), 10), 1),
                          round(pct(col("intro_sec"), 90), 1)],
            "lufs": [round(pct(col("lufs"), 25), 1), round(pct(col("lufs"), 75), 1)],
            "low_mid_ratio_p90": round(pct(col("low_mid_ratio"), 90), 3),
            "n": len(frows), "source": "mtg_jamendo", "full_length": True,
        }
        if len(frows) >= MIN_N_REPLACE:
            out["genres"][fam] = entry
            print(f"{fam}: n={len(frows)} -> REPLACED (intro {entry['intro_sec']}, "
                  f"bpm {entry['bpm']}, lufs {entry['lufs']})")
        else:
            print(f"{fam}: n={len(frows)} < {MIN_N_REPLACE} -> FMA row kept "
                  f"(measured intro {entry['intro_sec']})")

    # Full-length human tell baseline. FMA per-row data was deleted, so this is
    # a SEPARATE section; the 30s-clip human_baseline stays untouched.
    col = lambda k: [r[k] for r in rows]
    hb = {k: {"p95": round(pct(col(k), 95), 3), "p99": round(pct(col(k), 99), 3)}
          for k in ("timing_rigidity", "section_repetition", "spectral_uniformity")}
    hb["dynamic_range_db_p05"] = round(pct(col("dynamic_range_db"), 5), 2)
    hb["n"] = len(rows)
    hb["source"] = "mtg_jamendo"
    hb["analyzed_first_sec"] = ANALYZE_CAP_SEC
    out["human_baseline_full"] = hb
    out["jamendo_generated"] = str(date.today())
    with open(NORMS, "w") as f:
        json.dump(out, f, indent=2)
    print(f"wrote {NORMS} (human_baseline_full n={len(rows)})")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tars", default="59,75,93,47,79,61")
    ap.add_argument("--per-tar", type=int, default=500)
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--norms-only", action="store_true")
    a = ap.parse_args()
    if not a.norms_only:
        families = load_families()
        sha_by_name = dict(
            (l.split()[1], l.split()[0]) for l in open(MANIFEST) if l.strip())
        for idx in [int(t) for t in a.tars.split(",")]:
            if not run_tar(idx, families, sha_by_name, a.per_tar, a.workers):
                print(f"stopping at tar {idx}", flush=True)
                break
    write_norms()


if __name__ == "__main__":
    main()
