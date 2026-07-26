"""
A&R AI — API server.

POST /api/analyze  (multipart: file=<audio>, genre=<str>)  ->  report JSON
GET  /            -> serves the web frontend (web/index.html)

Run:  ../.venv/bin/uvicorn server:app --reload --port 8000   (from engine/)
"""
from __future__ import annotations
import os
import tempfile
import subprocess
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from analyze import (analyze, GENRE_NORMS, get_norms, measure_vocal_bands,
                     measure_mud, ANALYSIS_SR, _load)
from insights import build_insights
from llm import llm_available, enrich_report
from ml_tags import ml_available, ml_analyze
from stems import separate, stems_available

app = FastAPI(title="A&R AI")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

WEB_DIR = Path(__file__).resolve().parent.parent / "web"
MAX_BYTES = 100 * 1024 * 1024  # 100 MB
ALLOWED_EXT = {".wav", ".mp3", ".flac", ".m4a", ".aac", ".ogg"}


# ── ML runs in a persistent side process so it overlaps the DSP pass ─────────
# Measured on a 200s track: ThreadPoolExecutor gave NO overlap (seq 4.58s vs
# thread-parallel 4.54s — Essentia's Python bindings hold the GIL), while a
# warm 1-worker process pool hits 3.66s ≈ max(dsp 3.56s, ml 1.04s). The worker
# loads the TF models once and stays warm; if it ever breaks we fall back to
# running ml_analyze inline (correctness over speed).
_ML_POOL: ProcessPoolExecutor | None = None


def _ml_submit(path: str):
    """Submit ml_analyze(path) to the warm side process. Returns a Future or None."""
    global _ML_POOL
    if not ml_available():
        return None
    try:
        if _ML_POOL is None:
            _ML_POOL = ProcessPoolExecutor(max_workers=1)
        return _ML_POOL.submit(ml_analyze, path)
    except Exception:
        _ML_POOL = None
        return None


def _ml_result(fut, path: str) -> dict:
    global _ML_POOL
    if fut is None:
        return ml_analyze(path) if ml_available() else {}
    try:
        return fut.result(timeout=300)
    except Exception:
        # broken/hung pool: drop it and do the work inline this once
        try:
            _ML_POOL.shutdown(wait=False)
        except Exception:
            pass
        _ML_POOL = None
        return ml_analyze(path) if ml_available() else {}


def _deep_vocal_measures(path: str) -> dict:
    """Demucs two-stem split of the first 90s, then stem-level measurements:
    sibilance/presence on the isolated vocal, low-mid mud on the accompaniment.
    These override the mix-level proxies; stem_level marks the provenance."""
    import librosa
    stems, cleanup = separate(path)
    try:
        out = {}
        v, _, vsr = _load(stems["vocals"])
        v22 = librosa.resample(v, orig_sr=vsr, target_sr=ANALYSIS_SR) if vsr != ANALYSIS_SR else v
        out.update(measure_vocal_bands(v22, ANALYSIS_SR))
        n, _, nsr = _load(stems["no_vocals"])
        n22 = librosa.resample(n, orig_sr=nsr, target_sr=ANALYSIS_SR) if nsr != ANALYSIS_SR else n
        out.update(measure_mud(n22, ANALYSIS_SR))
        out["stem_level"] = True
        return out
    finally:
        cleanup()


def _to_wav(src: str) -> str:
    """Normalize any input to a wav librosa/soundfile can read, via ffmpeg."""
    dst = src + ".conv.wav"
    subprocess.run(
        ["ffmpeg", "-y", "-i", src, "-ac", "2", "-ar", "44100", dst],
        check=True, capture_output=True,
    )
    return dst


@app.get("/api/genres")
def genres():
    return {"genres": list(GENRE_NORMS.keys())}


# Fixed measurements for the "Nightdrive" demo track — runs through the SAME
# build_insights() as a real file, so the demo report is translated identically.
import math

def _demo_curve(intro_pts: int) -> list:
    """Plausible energy envelope: quiet build through the intro, then peaks/dips."""
    out = []
    for i in range(96):
        if i < intro_pts:
            v = 0.14 + (i / intro_pts) * 0.30
        else:
            v = 0.62 + 0.38 * abs(math.sin((i - intro_pts) / 7.5)) - (0.12 if (i - intro_pts) % 23 > 18 else 0)
        out.append(round(max(0.05, min(1.0, v)), 3))
    return out

DEMO_RAW = {
    "duration_sec": 238, "sample_rate": 44100, "genre_assumed": "melodic techno",
    "lufs": -11.4, "true_peak_db": -0.8, "clipping": False, "lra": 4.2,
    "dynamic_range_db": 7.1, "bpm": 124, "key": "A minor", "key_confidence": 0.86,
    "intro_sec": 34.0, "low_mid_ratio": 0.42, "stereo_width": 0.4, "is_mono": False,
    "timing_rigidity": 0.95, "section_repetition": 0.99, "spectral_uniformity": 0.97,
    "energy_curve": _demo_curve(14), "peak_moment_sec": 96.0,
    "norms": get_norms("melodic techno"),
}

# The demo's "v2" — same track after applying the fixes (shorter intro, hotter
# master, cleaner mids, humanized timing). Used so the demo loop stays honest:
# both versions run through the same engine.
DEMO_RAW_V2 = dict(DEMO_RAW)
DEMO_RAW_V2.update({
    "lufs": -8.9, "true_peak_db": -1.0, "lra": 6.8, "dynamic_range_db": 9.4,
    "intro_sec": 17.0, "low_mid_ratio": 0.31,
    "timing_rigidity": 0.72, "section_repetition": 0.9, "spectral_uniformity": 0.9,
    "energy_curve": _demo_curve(7), "peak_moment_sec": 74.0,
})


@app.get("/api/demo")
def demo(lang: str = "en", v: int = 1):
    raw = DEMO_RAW_V2 if v == 2 else DEMO_RAW
    report = build_insights(dict(raw), lang)
    report["_raw"] = raw
    report["filename"] = "Nightdrive (demo).wav" if v == 1 else "Nightdrive_v2 (demo).wav"
    report["meta"]["name"] = "Nightdrive" if v == 1 else "Nightdrive v2"
    return JSONResponse(report)


@app.post("/api/analyze")
async def analyze_endpoint(file: UploadFile = File(...), genre: str = Form("melodic techno"),
                           lang: str = Form("en"), deep: str = Form("0")):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(400, f"Unsupported format {ext}. Use WAV, MP3, FLAC, M4A.")

    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "File too large (max 100 MB).")
    if len(data) < 128:
        raise HTTPException(400, "That file is empty or too small to be audio.")

    tmp = tempfile.NamedTemporaryFile(suffix=ext, delete=False)
    tmp.write(data)
    tmp.close()
    conv = None
    try:
        path = tmp.name
        if ext != ".wav":
            conv = _to_wav(path)
            path = conv
        # ML classifiers (genre auto-detect, vocals, danceability) run in the
        # warm side process WHILE the DSP pass runs here. analyze() only needs
        # the genre for the norms overlay, so it runs against "default" and the
        # overlay is rebuilt once the detected genre is in.
        ml_fut = _ml_submit(path)
        raw = analyze(path, "default")
        ml = _ml_result(ml_fut, path)
        raw.update(ml)
        resolved_genre = genre
        if genre == "auto":
            resolved_genre = ml.get("ml_genre_bucket", "default")
        raw["genre_assumed"] = resolved_genre
        raw["norms"] = get_norms(resolved_genre)
        # Deep vocal analysis (opt-in, slow): separate the vocal with Demucs
        # and re-measure sibilance/presence on the isolated vocal, mud on the
        # accompaniment. Only when the ML layer actually hears vocals.
        if deep == "1" and raw.get("ml_voice_prob", 0) > 0.6 and stems_available():
            try:
                raw.update(_deep_vocal_measures(path))
            except Exception:
                import logging
                logging.getLogger("anr").exception("stem separation failed for %s", file.filename)
        report = build_insights(raw, lang)
        report["source"] = "template"
        if llm_available():
            # Song-specific narrative written by Claude, grounded in the raw
            # measurements. Falls back silently to the template text on error.
            report = enrich_report(report, raw, lang, genre)
        report["_raw"] = raw  # keep measurements for debugging / the compare screen
        report["filename"] = file.filename
        return JSONResponse(report)
    except subprocess.CalledProcessError:
        raise HTTPException(422, "Could not decode that audio file.")
    except HTTPException:
        raise
    except Exception:
        # Anything the decoder/DSP chokes on (corrupt wav, exotic encoding)
        # is a bad input, not a server fault — return 422, never a raw 500.
        # Log the real cause so bad-input bugs stay diagnosable.
        import logging
        logging.getLogger("anr").exception("analyze failed for %s", file.filename)
        raise HTTPException(422, "Could not analyze that file — it may be corrupt or not real audio.")
    finally:
        for p in (tmp.name, conv):
            if p and os.path.exists(p):
                os.remove(p)


@app.get("/")
def index():
    idx = WEB_DIR / "index.html"
    if idx.exists():
        return FileResponse(idx)
    return JSONResponse({"status": "A&R AI API up. Frontend not built yet."})


# serve fonts + any static assets from web/
if (WEB_DIR / "fonts").exists():
    app.mount("/fonts", StaticFiles(directory=str(WEB_DIR / "fonts")), name="fonts")
