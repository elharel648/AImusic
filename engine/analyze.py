"""
A&R AI — real audio analysis engine.

Measures only the GREEN-tier (objective, defensible) metrics:
  loudness (LUFS), true peak, dynamic range, tempo (BPM), musical key,
  intro length, low-mid mud, stereo width.

No fabricated "hit potential" scores here — every number comes from the
waveform itself. The insight layer (insights.py) turns these into A&R sentences.
"""
from __future__ import annotations
import json
import os

import numpy as np
import librosa
import soundfile as sf
import pyloudnorm as pyln


# ── genre reference patterns (public-knowledge norms, not a magic hit formula) ──
# Used only to say "how far are you from what usually works", never "you will chart".
GENRE_NORMS = {
    "melodic techno": {"bpm": (120, 126), "intro_sec": (12, 20), "lufs": (-9, -7)},
    "house":          {"bpm": (120, 128), "intro_sec": (8, 16),  "lufs": (-9, -6)},
    "pop":            {"bpm": (90, 130),  "intro_sec": (0, 8),   "lufs": (-9, -7)},
    "hip-hop":        {"bpm": (70, 100),  "intro_sec": (0, 10),  "lufs": (-9, -6)},
    "edm":            {"bpm": (124, 132), "intro_sec": (8, 16),  "lufs": (-8, -5)},
    "rock":           {"bpm": (100, 140), "intro_sec": (4, 15),  "lufs": (-10, -7)},
    "lo-fi":          {"bpm": (70, 95),   "intro_sec": (0, 12),  "lufs": (-14, -10)},
    "default":        {"bpm": (90, 130),  "intro_sec": (5, 20),  "lufs": (-14, -7)},
}

PITCH_CLASSES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

# Measured norms (tools/ingest_spotify.py, tools/calibrate.py) overlay the
# curated defaults above. Provenance (n, source) rides along so the report
# can say "benchmarked against N tracks" — and never claims data we don't have.
_NORMS_FILE = os.path.join(os.path.dirname(__file__), "norms_data.json")
try:
    with open(_NORMS_FILE) as _f:
        _MEASURED = json.load(_f)
except Exception:
    _MEASURED = {}


def get_norms(genre: str) -> dict:
    base = dict(GENRE_NORMS.get(genre, GENRE_NORMS["default"]))
    hits = (_MEASURED.get("hits") or {}).get(genre)
    if hits:
        base["bpm"] = tuple(hits["bpm"])
        base["lufs"] = tuple(hits["lufs"])
        base["n_hits"] = hits["n"]
    # Tier B (FMA): our genres map onto FMA's coarser families.
    # FMA-small clips are 30s excerpts (often mid-song), so their intro/structure
    # measurements are NOT valid — we only take provenance and keep curated
    # intro norms until a full-length corpus (MTG-Jamendo) replaces them.
    _FMA_FAMILY = {"melodic techno": "Electronic", "house": "Electronic",
                   "edm": "Electronic", "lo-fi": "Electronic",
                   "hip-hop": "Hip-Hop", "pop": "Pop", "rock": "Rock"}
    fma = (_MEASURED.get("genres") or {}).get(_FMA_FAMILY.get(genre, ""))
    if fma and fma.get("full_length"):
        base["intro_sec"] = tuple(fma["intro_sec"])
        base["n_fma"] = fma["n"]
    return base


def _load(path: str):
    """Load audio. Returns (mono, stereo_or_None, sr)."""
    data, sr = sf.read(path, always_2d=True)      # shape (n, channels)
    data = data.astype(np.float32)
    stereo = data if data.shape[1] == 2 else None
    mono = data.mean(axis=1)
    return mono, stereo, sr


def measure_loudness(path: str) -> dict:
    data, sr = sf.read(path)
    meter = pyln.Meter(sr)                          # ITU-R BS.1770 / EBU R128
    loudness = meter.integrated_loudness(data)

    # True peak per ITU-R BS.1770: 4x oversampling catches inter-sample peaks
    # that plain sample-peak misses (the thing that actually clips DACs/encoders).
    from scipy.signal import resample_poly
    arr = data if data.ndim > 1 else data[:, None]
    tp = 0.0
    for ch in range(arr.shape[1]):
        over = resample_poly(arr[:, ch], up=4, down=1)
        tp = max(tp, float(np.max(np.abs(over))))
    true_peak_db = 20 * np.log10(tp) if tp > 0 else -np.inf

    # Loudness range proxy (EBU R128 LRA-style): spread of short-term loudness.
    try:
        hop = sr  # 1s windows, 3s blocks
        st = []
        for i in range(0, max(1, len(arr) - 3 * sr), hop):
            block = arr[i:i + 3 * sr]
            if len(block) >= sr:
                st.append(meter.integrated_loudness(block))
        st = [x for x in st if np.isfinite(x) and x > -70]
        lra = round(float(np.percentile(st, 95) - np.percentile(st, 10)), 1) if len(st) >= 4 else None
    except Exception:
        lra = None

    # Clamp to the EBU R128 gating floor: silence yields -inf, which would
    # crash any arithmetic downstream (a silent upload must not 500 the API).
    if not np.isfinite(loudness):
        loudness = -70.0
    if not np.isfinite(true_peak_db):
        true_peak_db = -70.0

    return {
        "lufs": round(float(loudness), 1),
        "true_peak_db": round(true_peak_db, 1),
        "clipping": bool(tp >= 10 ** (-0.3 / 20)),   # true peak above -0.3 dBTP
        "lra": lra,
    }


def measure_dynamics(mono: np.ndarray, sr: int) -> dict:
    """Crude but honest dynamic-range proxy: loud vs quiet RMS spread (dB)."""
    rms = librosa.feature.rms(y=mono, frame_length=2048, hop_length=512)[0]
    rms = rms[rms > 0]
    if rms.size == 0:
        return {"dynamic_range_db": 0.0}
    loud = np.percentile(rms, 95)
    quiet = np.percentile(rms, 10)
    dr = 20 * np.log10(loud / quiet) if quiet > 0 else 0.0
    return {"dynamic_range_db": round(float(dr), 1)}


# Krumhansl-Schmuckler key profiles (perceptual weights from probe-tone studies)
_KS_MAJOR = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
_KS_MINOR = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])


def measure_tempo_key(tempo: float, chroma_frames: np.ndarray) -> dict:
    """Key/BPM from precomputed beat-track tempo + chroma (computed once in analyze())."""
    tempo = float(np.atleast_1d(tempo)[0])
    # Fold obvious half/double-time errors into the plausible dance range.
    if tempo < 70:
        tempo *= 2
    elif tempo > 190:
        tempo /= 2

    # Key via full Krumhansl-Schmuckler: correlate mean chroma against all
    # 24 rotated major/minor profiles, best correlation wins.
    chroma = chroma_frames.mean(axis=1) if chroma_frames.size else np.zeros(12)
    if chroma.std() == 0:
        return {"bpm": int(round(tempo)), "key": "—", "key_confidence": 0.0}
    best = (-2.0, 0, "major")
    for root in range(12):
        for profile, mode in ((_KS_MAJOR, "major"), (_KS_MINOR, "minor")):
            rolled = np.roll(profile, root)
            r = float(np.corrcoef(chroma, rolled)[0, 1])
            if r > best[0]:
                best = (r, root, mode)
    r, root, mode = best
    return {
        "bpm": int(round(tempo)),
        "key": f"{PITCH_CLASSES[root]} {mode}",
        "key_confidence": round(max(0.0, r), 2),
    }


def measure_intro(mono: np.ndarray, sr: int) -> dict:
    """
    Intro length = time until the first *sustained* energy arrival.
    Robust version: smoothed RMS + onset density must BOTH rise and STAY up
    for >=2s, so a one-shot FX hit no longer ends the intro early.
    """
    hop = 512
    rms = librosa.feature.rms(y=mono, hop_length=hop)[0]
    times = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=hop)
    if len(rms) < 20:
        return {"intro_sec": 0.0}

    # smooth (~0.35s window) to kill transients
    win = max(3, int(0.35 * sr / hop))
    kernel = np.ones(win) / win
    smooth = np.convolve(rms, kernel, mode="same")

    opening = np.median(smooth[: max(1, len(smooth) // 20)])
    peak_level = np.percentile(smooth, 90)
    threshold = opening + 0.45 * (peak_level - opening)

    hold = max(1, int(2.0 * sr / hop))       # must stay above for 2s
    above = smooth >= threshold
    for i in range(len(above) - hold):
        if above[i] and above[i:i + hold].mean() > 0.8:
            return {"intro_sec": round(float(times[i]), 1)}
    return {"intro_sec": 0.0}


def measure_energy_curve(mono: np.ndarray, sr: int, points: int = 96) -> dict:
    """Normalized energy envelope over time — powers the structure strip in the UI."""
    rms = librosa.feature.rms(y=mono, hop_length=1024)[0]
    if len(rms) < points:
        rms = np.pad(rms, (0, points - len(rms)))
    block = len(rms) // points
    curve = [float(rms[i * block:(i + 1) * block].max()) for i in range(points)]
    mx = max(curve) or 1.0
    curve = [round(c / mx, 3) for c in curve]
    peak_idx = int(np.argmax(curve))
    dur = len(mono) / sr
    return {"energy_curve": curve, "peak_moment_sec": round(peak_idx / points * dur, 1)}


def measure_mud(mono: np.ndarray, sr: int) -> dict:
    """Energy ratio in the 200-350 Hz low-mid 'mud' band vs full spectrum."""
    S = np.abs(librosa.stft(mono)) ** 2
    freqs = librosa.fft_frequencies(sr=sr)
    total = S.sum()
    if total == 0:
        return {"low_mid_ratio": 0.0}
    sel = (freqs >= 200) & (freqs <= 350)
    band = S[sel].sum()
    # the actual peak of the mud, not the band center — so the EQ prescription
    # can name this track's real problem frequency
    peak_hz = float(freqs[sel][S[sel].mean(axis=1).argmax()]) if sel.any() else 250.0
    return {"low_mid_ratio": round(float(band / total), 3),
            "mud_peak_hz": int(round(peak_hz / 5) * 5)}


def measure_stereo(stereo, mono, sr) -> dict:
    """Stereo width via L/R correlation. 1.0 = mono, lower = wider."""
    if stereo is None:
        return {"stereo_width": 0.0, "is_mono": True}
    L, R = stereo[:, 0], stereo[:, 1]
    if np.std(L) == 0 or np.std(R) == 0:
        return {"stereo_width": 0.0, "is_mono": True}
    corr = float(np.corrcoef(L, R)[0, 1])
    width = round(1 - corr, 2)          # 0 = fully correlated (mono-ish), higher = wider
    return {"stereo_width": width, "is_mono": False}


def measure_ai_tells(mono: np.ndarray, sr: int, beats: np.ndarray, chroma_frames: np.ndarray) -> dict:
    """
    Measure acoustic signatures often associated with AI-generated music.
    These are SIGNALS, not proof — each is a real, defensible measurement:
      - timing_rigidity: how perfectly onsets snap to a grid (humans drift)
      - section_repetition: how identical the track's repeated chunks are
      - spectral_flatness: unusually even spectral energy over time
    Beats and chroma are precomputed once in analyze() and shared with tempo/key.
    """
    out = {}

    # 1) Timing rigidity — deviation of onsets from the beat grid.
    try:
        onsets = librosa.onset.onset_detect(y=mono, sr=sr, units="time")
        if len(beats) > 4 and len(onsets) > 8:
            # for each onset, distance to nearest beat, normalized by beat period
            period = np.median(np.diff(beats)) or 0.5
            devs = [min(abs(o - b) for b in beats) / period for o in onsets]
            # low mean deviation = suspiciously tight to the grid
            out["timing_rigidity"] = round(float(1 - min(1.0, np.mean(devs) * 4)), 2)
        else:
            out["timing_rigidity"] = 0.0
    except Exception:
        out["timing_rigidity"] = 0.0

    # 2) Section repetition — self-similarity of successive fixed windows.
    try:
        chroma = chroma_frames
        n = chroma.shape[1]
        if n > 20:
            w = n // 8
            blocks = [chroma[:, i * w:(i + 1) * w].mean(axis=1) for i in range(8)]
            sims = []
            for i in range(len(blocks)):
                for j in range(i + 1, len(blocks)):
                    a, b = blocks[i], blocks[j]
                    d = np.linalg.norm(a) * np.linalg.norm(b)
                    if d > 0:
                        sims.append(float(np.dot(a, b) / d))
            out["section_repetition"] = round(float(np.mean(sims)) if sims else 0.0, 2)
        else:
            out["section_repetition"] = 0.0
    except Exception:
        out["section_repetition"] = 0.0

    # 3) Spectral flatness variance — AI mixes are often unusually consistent.
    try:
        flat = librosa.feature.spectral_flatness(y=mono)[0]
        # low temporal variance of flatness = suspiciously uniform texture
        out["spectral_uniformity"] = round(float(1 - min(1.0, np.std(flat) * 40)), 2)
    except Exception:
        out["spectral_uniformity"] = 0.0

    return out


ANALYSIS_SR = 22050  # spectral features run at 22k — 2x+ faster, no accuracy loss for these


def analyze(path: str, genre: str = "melodic techno") -> dict:
    mono, stereo, sr = _load(path)
    duration = round(len(mono) / sr, 1)

    # Loudness / peak / stereo need the full-rate signal (ITU-R spec, inter-sample
    # peaks, L/R correlation). Everything spectral runs on a 22k downmix, and the
    # two expensive features (beat grid, chroma) are computed ONCE and shared.
    m22 = librosa.resample(mono, orig_sr=sr, target_sr=ANALYSIS_SR) if sr != ANALYSIS_SR else mono
    try:
        tempo, beats = librosa.beat.beat_track(y=m22, sr=ANALYSIS_SR, units="time")
    except Exception:
        tempo, beats = 0.0, np.array([])
    try:
        chroma = librosa.feature.chroma_cqt(y=m22, sr=ANALYSIS_SR)
    except Exception:
        chroma = np.zeros((12, 0))

    out = {"duration_sec": duration, "sample_rate": sr, "genre_assumed": genre}
    out.update(measure_loudness(path))
    out.update(measure_dynamics(m22, ANALYSIS_SR))
    out.update(measure_tempo_key(tempo, chroma))
    out.update(measure_intro(m22, ANALYSIS_SR))
    out.update(measure_mud(m22, ANALYSIS_SR))
    out.update(measure_stereo(stereo, mono, sr))
    out.update(measure_ai_tells(m22, ANALYSIS_SR, beats, chroma))
    out.update(measure_energy_curve(m22, ANALYSIS_SR))
    out["norms"] = get_norms(genre)
    return out


if __name__ == "__main__":
    import sys, json
    if len(sys.argv) < 2:
        print("usage: python analyze.py <audiofile> [genre]")
        sys.exit(1)
    genre = sys.argv[2] if len(sys.argv) > 2 else "melodic techno"
    print(json.dumps(analyze(sys.argv[1], genre), indent=2))
