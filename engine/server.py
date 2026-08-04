"""
A&R AI — API server.

POST /api/analyze  (multipart: file=<audio>, genre=<str>)  ->  report JSON
GET  /            -> serves the web frontend (web/index.html)

Run:  ../.venv/bin/uvicorn server:app --reload --port 8000   (from engine/)
"""
from __future__ import annotations
import logging
import math
import os
import tempfile
import subprocess
import threading
import time
from collections import defaultdict, deque
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from analyze import (analyze, GENRE_NORMS, get_norms, measure_vocal_bands,
                     measure_vocal_performance, measure_mud, measure_tempo_key,
                     _EDM_GENRES, ANALYSIS_SR, _load)
from insights import build_insights
from llm import llm_available, llm_ready, enrich_report
from ml_tags import ml_available, ml_analyze
from stems import separate, stems_available

app = FastAPI(title="A&R AI")
_log = logging.getLogger("anr")

# CORS fails CLOSED: with no ANR_ALLOWED_ORIGINS the API is same-origin only
# (the frontend is served by this same process, so that's the normal mode).
# Cross-origin callers need an explicit ANR_ALLOWED_ORIGINS="https://a.com,https://b.com".
_ORIGINS = [o.strip() for o in os.environ.get("ANR_ALLOWED_ORIGINS", "").split(",") if o.strip()]
if _ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_ORIGINS,
        allow_methods=["*"], allow_headers=["*"],
    )

# Misconfiguration should be loud at startup, not silent at request time.
if os.environ.get("ANR_USE_LLM") == "1" and not llm_ready():
    _log.warning("ANR_USE_LLM=1 but no ANTHROPIC_API_KEY/ANTHROPIC_AUTH_TOKEN resolves — "
                 "every report will silently fall back to template text")

# ── per-IP rate limit on analysis (in-memory sliding window) ────────────────
# Analysis burns real CPU (~13s, ~60s deep); without this one looped client
# starves everyone. Defaults allow a full 12-track shoot-out with headroom.
RATE_MAX = int(os.environ.get("ANR_RATE_MAX", "20"))          # analyses per window
RATE_WINDOW = int(os.environ.get("ANR_RATE_WINDOW_SEC", "900"))   # 15 min
_rate_hits: dict[str, deque] = defaultdict(deque)


def _client_ip(request: Request) -> str:
    # Rightmost x-forwarded-for entry: that's the value OUR proxy appended
    # ($remote_addr), the only hop we trust. The leftmost is client-supplied —
    # trusting it lets anyone bypass the rate limit with a rotating header.
    fwd = request.headers.get("x-forwarded-for")
    return fwd.split(",")[-1].strip() if fwd else (request.client.host if request.client else "?")


def _rate_ok(ip: str) -> bool:
    now = time.time()
    # Evict stale IPs so a spoofed-header flood can't grow this dict forever.
    if len(_rate_hits) > 10_000:
        for k in [k for k, dq in _rate_hits.items() if not dq or dq[-1] < now - RATE_WINDOW]:
            del _rate_hits[k]
    q = _rate_hits[ip]
    while q and q[0] < now - RATE_WINDOW:
        q.popleft()
    if len(q) >= RATE_MAX:
        return False
    q.append(now)
    return True

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
_ML_LOCK = threading.Lock()   # requests run on thread-pool workers; guard the global


def _ml_submit(path: str):
    """Submit ml_analyze(path) to the warm side process. Returns a Future or None."""
    global _ML_POOL
    if not ml_available():
        return None
    try:
        with _ML_LOCK:
            if _ML_POOL is None:
                _ML_POOL = ProcessPoolExecutor(max_workers=1)
            return _ML_POOL.submit(ml_analyze, path)
    except Exception:
        with _ML_LOCK:
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
        with _ML_LOCK:
            try:
                if _ML_POOL is not None:
                    _ML_POOL.shutdown(wait=False)
            except Exception:
                pass
            _ML_POOL = None
        return ml_analyze(path) if ml_available() else {}


def _deep_vocal_measures(path: str) -> dict:
    """Demucs two-stem split of the first 90s, then stem-level measurements:
    sibilance/presence on the isolated vocal, low-mid mud on the accompaniment.
    These override the mix-level proxies; stem_level marks the provenance."""
    import numpy as np
    import librosa
    stems, cleanup = separate(path)
    try:
        out = {}
        v, _, vsr = _load(stems["vocals"])
        v22 = librosa.resample(v, orig_sr=vsr, target_sr=ANALYSIS_SR) if vsr != ANALYSIS_SR else v
        # The separated stem is DIRECT evidence of vocals — better than the
        # classifier's probability (which reads processed/chopped EDM vocals
        # as low as 0.43 on tracks with prominent singing). If the isolated
        # vocal is essentially silent (<5s of frames above -40 dBFS in the
        # 90s head), report that instead of measuring artifacts as a voice.
        vr0 = librosa.feature.rms(y=v22)[0]
        active_sec = float((vr0 > 10 ** (-40 / 20)).sum()) * 512 / ANALYSIS_SR
        if active_sec < 5.0:
            return {"stem_level": True, "vocal_stem_silent": True}
        out.update(measure_vocal_bands(v22, ANALYSIS_SR))
        out.update(measure_vocal_performance(v22, ANALYSIS_SR))
        n, _, nsr = _load(stems["no_vocals"])
        n22 = librosa.resample(n, orig_sr=nsr, target_sr=ANALYSIS_SR) if nsr != ANALYSIS_SR else n
        out.update(measure_mud(n22, ANALYSIS_SR))
        # Vocal-to-mix balance: RMS of the vocal stem vs the accompaniment,
        # in dB, measured only where the vocal is actually present (RMS gate
        # at 10% of the vocal's own peak) so verses without vocals don't
        # read as "buried".
        vr = librosa.feature.rms(y=v22)[0]
        nr = librosa.feature.rms(y=n22)[0]
        m = min(len(vr), len(nr))
        vr, nr = vr[:m], nr[:m]
        active = vr > 0.1 * (vr.max() or 1)
        if active.sum() >= 20 and float(np.median(nr[active])) > 0:
            bal = 20 * np.log10(float(np.median(vr[active]))
                                / float(np.median(nr[active])))
            out["vocal_mix_db"] = round(float(bal), 1)
        out["stem_level"] = True
        return out
    finally:
        cleanup()


def _to_wav(src: str) -> str:
    """Normalize any input to a wav librosa/soundfile can read, via ffmpeg."""
    dst = src + ".conv.wav"
    # timeout: a pathological input that hangs ffmpeg would otherwise pin a
    # thread-pool worker forever (every other ffmpeg call here has one too).
    subprocess.run(
        ["ffmpeg", "-y", "-i", src, "-ac", "2", "-ar", "44100", dst],
        check=True, capture_output=True, timeout=120,
    )
    return dst


@app.get("/api/genres")
def genres():
    return {"genres": list(GENRE_NORMS.keys())}


# Fixed measurements for the "Nightdrive" demo track — runs through the SAME
# build_insights() as a real file, so the demo report is translated identically.
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
    # plausible electronic long-term curve, with the 200-300 Hz bump that
    # matches this demo's mud finding (low_mid_ratio 0.42)
    "tonal_bands": [4.5, 6.8, 8.2, 8.6, 7.9, 6.4, 5.1, 6.5, 5.4, 1.8, 0.6, -0.4,
                    -1.2, -2.0, -2.8, -3.6, -4.4, -5.2, -6.1, -7.0, -8.0, -9.2, -10.6, -12.3],
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
    # v2 after the fixes: low-mid bump cleaned, a touch more air
    "tonal_bands": [4.5, 6.8, 8.2, 8.6, 7.9, 6.4, 5.1, 4.6, 3.4, 1.8, 0.6, -0.4,
                    -1.2, -2.0, -2.8, -3.6, -4.4, -5.2, -6.1, -5.6, -6.6, -7.8, -9.2, -10.9],
})


@app.get("/api/demo")
def demo(lang: str = "en", v: int = 1):
    raw = DEMO_RAW_V2 if v == 2 else DEMO_RAW
    report = build_insights(dict(raw), lang)
    report["_raw"] = raw
    report["filename"] = "Nightdrive (demo).wav" if v == 1 else "Nightdrive_v2 (demo).wav"
    report["meta"]["name"] = "Nightdrive" if v == 1 else "Nightdrive v2"
    return JSONResponse(report)


@app.get("/api/health")
def health():
    """Deploy probe: process is up + which optional layers are live.
    llm is llm_ready() (opt-in AND a credential resolves) — llm_available()
    alone would report true with a missing key while every report silently
    fell back to template text, which is exactly what this probe must catch."""
    return {"ok": True, "ml": ml_available(), "stems": stems_available(),
            "llm": llm_ready()}


@app.post("/api/analyze")
async def analyze_endpoint(request: Request, file: UploadFile = File(...),
                           genre: str = Form("melodic techno"),
                           lang: str = Form("en"), deep: str = Form("0"),
                           purpose: str = Form("main")):
    if not _rate_ok(_client_ip(request)):
        raise HTTPException(429, "Rate limit reached — try again in a few minutes.")
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(400, f"Unsupported format {ext}. Use WAV, MP3, FLAC, M4A.")

    # Reject oversized uploads from the declared length before reading a byte,
    # then stream to disk in chunks with a running count — never buffer the
    # whole body in RAM (20 concurrent 100MB reads would OOM a 4GB box).
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > MAX_BYTES + 1_000_000:
        raise HTTPException(413, "File too large (max 100 MB).")

    tmp = tempfile.NamedTemporaryFile(suffix=ext, delete=False)
    size = 0
    try:
        while chunk := await file.read(1 << 20):
            size += len(chunk)
            if size > MAX_BYTES:
                tmp.close()
                raise HTTPException(413, "File too large (max 100 MB).")
            tmp.write(chunk)
        tmp.close()
        if size < 128:
            raise HTTPException(400, "That file is empty or too small to be audio.")
    except HTTPException:
        if os.path.exists(tmp.name):
            os.remove(tmp.name)
        raise

    try:
        # The whole DSP pipeline is CPU-bound sync code. Run it OFF the event
        # loop so one 13-60s analysis doesn't freeze every other request
        # (including serving the page itself).
        return await run_in_threadpool(_analyze_sync, tmp.name, ext, file.filename,
                                       genre, lang, deep, purpose)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
        raise HTTPException(422, "Could not decode that audio file.")
    except HTTPException:
        raise
    except Exception:
        import logging
        logging.getLogger("anr").exception("analyze failed for %s", file.filename)
        raise HTTPException(422, "Could not analyze that file — it may be corrupt or not real audio.")
    finally:
        if os.path.exists(tmp.name):
            os.remove(tmp.name)


def _analyze_sync(tmp_path: str, ext: str, filename: str | None,
                  genre: str, lang: str, deep: str, purpose: str):
    conv = None
    try:
        path = tmp_path
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
        # Key profiles are genre-dependent (EDM genres use the minor-leaning
        # EDMM, everything else EDMA). The DSP pass ran as "default", so once
        # the genre is resolved, re-pick the key from the stored harmonic
        # chroma — a 24-correlation pass, effectively free.
        if raw.get("_chroma_h") and resolved_genre in _EDM_GENRES:
            import numpy as _np
            raw.pop("key_alt", None)      # else a stale runner-up from the
            raw.update(measure_tempo_key(raw["bpm"], _np.array(raw["_chroma_h"]),
                                         resolved_genre))
        # Deep vocal analysis (opt-in, slow): separate the vocal with Demucs
        # and re-measure sibilance/presence on the isolated vocal, mud on the
        # accompaniment.
        # The user's toggle is an explicit "this track has vocals" — so the
        # classifier only vetoes the 60s Demucs run when it's SURE there are
        # none (<=0.25; measured: instrumentals ~0.10, real vocal EDM 0.43+).
        # The separated stem itself then decides, and whatever happened is
        # reported back as deep_status — a silent skip looks like a broken
        # feature and violates the honesty promise.
        # A reference upload only feeds the A/B panel — the client reads _raw.
        # Skip the slow narrative layers (Demucs, LLM); measurements stay full.
        if purpose == "reference":
            deep = "0"
        deep_status = None
        if deep == "1":
            if not stems_available():
                deep_status = "unavailable"
            elif raw.get("ml_voice_prob", 0) <= 0.25:
                deep_status = "no_vocals"
            else:
                try:
                    dv = _deep_vocal_measures(path)
                    raw.update(dv)
                    deep_status = "no_vocals" if dv.get("vocal_stem_silent") else "ran"
                except Exception:
                    import logging
                    logging.getLogger("anr").exception("stem separation failed for %s", filename)
                    deep_status = "failed"
        report = build_insights(raw, lang)
        if deep_status:
            report["deep_status"] = deep_status
        report["source"] = "template"
        if llm_available() and purpose != "reference":
            # Song-specific narrative written by Claude, grounded in the raw
            # measurements. Falls back silently to the template text on error.
            report = enrich_report(report, raw, lang, genre)
        report["_raw"] = raw  # keep measurements for debugging / the compare screen
        report["filename"] = filename
        return JSONResponse(report)
    finally:
        # tmp file is the endpoint's to clean; the converted wav is ours
        if conv and os.path.exists(conv):
            os.remove(conv)


@app.get("/")
def index(request: Request):
    idx = WEB_DIR / "index.html"
    if not idx.exists():
        return JSONResponse({"status": "A&R AI API up. Frontend not built yet."})
    # og:image / og:url / canonical need ABSOLUTE urls (crawlers don't resolve
    # relative ones). No domain is baked in: __ORIGIN__ placeholders in the
    # HTML are filled from the request, so the same build works on any host.
    scheme = request.headers.get("x-forwarded-proto",
                                 request.url.scheme).split(",")[0].strip()
    host = request.headers.get("host") or request.url.netloc
    html = idx.read_text(encoding="utf-8").replace("__ORIGIN__", f"{scheme}://{host}")
    return HTMLResponse(html)


@app.get("/og.png")
def og_image():
    """Social share card (og:image / twitter:image)."""
    from fastapi.responses import FileResponse
    img = WEB_DIR / "og.png"
    if img.exists():
        return FileResponse(img, media_type="image/png")
    raise HTTPException(404, "not found")


# serve fonts + any static assets from web/
if (WEB_DIR / "fonts").exists():
    app.mount("/fonts", StaticFiles(directory=str(WEB_DIR / "fonts")), name="fonts")
