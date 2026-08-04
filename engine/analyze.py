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
    prov = {}
    hits = (_MEASURED.get("hits") or {}).get(genre)
    if hits:
        base["bpm"] = tuple(hits["bpm"])
        base["lufs"] = tuple(hits["lufs"])
        base["n_hits"] = hits["n"]
        prov["bpm"] = prov["lufs"] = {"n": hits["n"], "source": hits.get("source"),
                                      "generated": _MEASURED.get("hits_generated")}
    # Tier B: intro/structure norms need FULL tracks; our genres map onto the
    # corpus' coarser families. Entries carry full_length only when they came
    # from complete audio (MTG-Jamendo tars / Jamendo API), never 30s clips.
    _FMA_FAMILY = {"melodic techno": "Electronic", "house": "Electronic",
                   "edm": "Electronic", "lo-fi": "Electronic",
                   "hip-hop": "Hip-Hop", "pop": "Pop", "rock": "Rock"}
    fma = (_MEASURED.get("genres") or {}).get(_FMA_FAMILY.get(genre, ""))
    if fma and fma.get("full_length"):
        base["intro_sec"] = tuple(fma["intro_sec"])
        base["n_fma"] = fma["n"]
        prov["intro_sec"] = {"n": fma["n"], "source": fma.get("source"),
                             "generated": _MEASURED.get("jamendo_generated")}
    # Tonal-balance target curve: quartile band per family, measured from the
    # same full-length Jamendo corpus. Absent until enough tracks carry it.
    tn = (_MEASURED.get("tonal") or {}).get(_FMA_FAMILY.get(genre, ""))
    if tn:
        base["tonal"] = tn
        base["tonal"]["family"] = _FMA_FAMILY.get(genre, "")
    # Per-metric provenance for the report: n, source, generated date — so the
    # UI can say "measured against N tracks (updated <date>)" per number, and
    # say nothing where the norm is still curated.
    base["provenance"] = prov
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


# Key profiles from essentia key.cpp, chosen by tools/key_experiment.py on
# GiantSteps Key (604 expert-annotated tracks): EDMM + harmonic chroma + mean
# scored 57.1% exact / 65.4 MIREX vs 44.5 / 54.2 for the old Krumhansl-on-raw.
# EDMM's flat major profile biases it minor — right for EDM, risky elsewhere —
# so non-electronic genres use EDMA (same corpus, real major profile).
_EDMM_MAJOR = np.array([0.083] * 12)
_EDMM_MINOR = np.array([0.17235348, 0.04, 0.0761009, 0.12, 0.05621498, 0.08527853,
                        0.0497915, 0.13451001, 0.07458916, 0.05003023, 0.09187879, 0.05545106])
_EDMA_MAJOR = np.array([1.00, 0.29, 0.50, 0.40, 0.60, 0.56, 0.32, 0.80, 0.31, 0.45, 0.42, 0.39])
_EDMA_MINOR = np.array([1.00, 0.31, 0.44, 0.58, 0.33, 0.49, 0.29, 0.78, 0.43, 0.29, 0.53, 0.32])
_EDM_GENRES = {"melodic techno", "house", "edm", "lo-fi"}

# Margin (best correlation minus runner-up) -> measured exact-match rate on
# GiantSteps, by quartile: 0.34 / 0.50 / 0.64 / 0.81. Piecewise-linear through
# the quartile midpoints; displayed confidence is TRUE accuracy, not a vibe.
_KEY_CALIBRATION = [(0.0, 0.28), (0.046, 0.34), (0.142, 0.50),
                    (0.245, 0.64), (0.42, 0.81), (0.55, 0.88)]


def _calibrated_key_conf(margin: float) -> float:
    pts = _KEY_CALIBRATION
    if margin >= pts[-1][0]:
        return pts[-1][1]
    for (a, pa), (b, pb) in zip(pts, pts[1:]):
        if a <= margin <= b:
            return pa + (pb - pa) * (margin - a) / (b - a)
    return pts[0][1]


def estimate_tempo(oenv_perc: np.ndarray, sr: int = 22050, hop: int = 512) -> float:
    """Tempo from the PERCUSSIVE onset envelope: global tempogram peak, then
    pick among {t/2, t, 2t} the octave with the strongest beat+bar support
    inside 60-200 BPM. Chosen by tools/tempo_experiment2.py on GiantSteps
    Tempo v2 (n=664): 66.7% acc1 / 78.9% acc2 vs 40.5 / 52.3 for the old
    beat_track path. Returns 0.0 when the envelope is degenerate."""
    if oenv_perc.size < 64 or float(np.max(oenv_perc)) == 0.0:
        return 0.0
    win = 384
    tg = np.mean(librosa.feature.tempogram(
        onset_envelope=oenv_perc, sr=sr, hop_length=hop, win_length=win), axis=1)
    freqs = librosa.tempo_frequencies(win, sr=sr, hop_length=hop)
    sel = (freqs >= 40) & (freqs <= 400)
    base = float(freqs[sel][int(np.argmax(tg[sel]))])
    best, best_score = base, -1.0
    for f in (0.5, 1.0, 2.0):
        cand = base * f
        if not 60 <= cand <= 200:
            continue
        score = 0.0
        for sub in (cand, cand / 2):         # beat level + bar level
            i = int(np.argmin(np.abs(freqs - sub)))
            score += float(tg[i])
        if score > best_score:
            best, best_score = cand, score
    return best


def measure_tempo_key(tempo: float, chroma_frames: np.ndarray,
                      genre: str = "default") -> dict:
    """Key/BPM from precomputed beat-track tempo + HARMONIC chroma
    (percussion-free; computed once in analyze())."""
    tempo = float(np.atleast_1d(tempo)[0])
    # Fold obvious half/double-time errors into the plausible dance range.
    if tempo < 70:
        tempo *= 2
    elif tempo > 190:
        tempo /= 2

    if chroma_frames.ndim == 1:              # already-pooled vector (server re-pick)
        chroma = chroma_frames
    else:
        chroma = chroma_frames.mean(axis=1) if chroma_frames.size else np.zeros(12)
    if chroma.std() == 0:
        return {"bpm": int(round(tempo)), "key": "—", "key_confidence": 0.0}
    major, minor = ((_EDMM_MAJOR, _EDMM_MINOR) if genre in _EDM_GENRES
                    else (_EDMA_MAJOR, _EDMA_MINOR))
    scores = []
    for root in range(12):
        for profile, mode in ((major, "major"), (minor, "minor")):
            if profile.std() == 0:      # EDMM major is flat: correlation undefined,
                continue                # minor-vs-minor margin still ranks tonics
            r = float(np.corrcoef(chroma, np.roll(profile, root))[0, 1])
            scores.append((r, root, mode))
    scores.sort(reverse=True)
    (r1, root, mode), (r2, root2, mode2) = scores[0], scores[1]
    conf = _calibrated_key_conf(r1 - r2)
    out = {
        "bpm": int(round(tempo)),
        "key": f"{PITCH_CLASSES[root]} {mode}",
        "key_confidence": round(conf, 2),
    }
    if conf < 0.55:                     # genuinely uncertain -> name the rival
        out["key_alt"] = f"{PITCH_CLASSES[root2]} {mode2}"
    return out


def measure_codec_impact(path: str) -> dict:
    """What streaming delivery does to the master: encode AAC 256k, decode,
    re-measure oversampled true peak. Lossy encoding overshoots peaks — a
    master that is clean in WAV can clip after the codec. This runs the real
    encoder (measured, never predicted); returns {} if ffmpeg is unavailable."""
    import subprocess
    import tempfile
    m4a = wav = None
    try:
        fd, m4a = tempfile.mkstemp(suffix=".m4a"); os.close(fd)
        fd, wav = tempfile.mkstemp(suffix=".wav"); os.close(fd)
        subprocess.run(["ffmpeg", "-y", "-i", path, "-c:a", "aac", "-b:a", "256k", m4a],
                       check=True, capture_output=True, timeout=600)
        subprocess.run(["ffmpeg", "-y", "-i", m4a, wav],
                       check=True, capture_output=True, timeout=600)
        data, sr = sf.read(wav, always_2d=True)
        from scipy.signal import resample_poly
        tp = 0.0
        for ch in range(data.shape[1]):
            over = resample_poly(data[:, ch].astype(np.float32), up=4, down=1)
            tp = max(tp, float(np.max(np.abs(over))))
        tp_db = round(float(20 * np.log10(tp)), 1) if tp > 0 else -70.0
        return {"codec_peak_db": tp_db, "codec_clips": bool(tp_db > 0.0)}
    except Exception:
        return {}
    finally:
        for p in (m4a, wav):
            if p and os.path.exists(p):
                os.remove(p)


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


def _smooth(x: np.ndarray, win: int) -> np.ndarray:
    win = max(1, int(win))
    x = np.asarray(x, dtype=float)
    if x.size < win:
        return x
    return np.convolve(x, np.ones(win) / win, mode="same")


def _worst_spans(vals: np.ndarray, hop_sec: float, thresh: float,
                 min_dur: float = 3.0, max_spans: int = 2,
                 duration: float | None = None) -> list:
    """Contiguous stretches where a per-frame signal stays above thresh for at
    least min_dur seconds — worst (highest mean) first. This is what lets a
    finding say WHERE the problem lives ("mostly 1:12-1:45") instead of only
    that it exists; the player loops these. If the stretches cover most of the
    track the problem is global, not local — return nothing rather than point
    at everywhere."""
    vals = np.asarray(vals, dtype=float)
    if vals.size == 0:
        return []
    above = vals >= thresh
    spans, i, n = [], 0, len(vals)
    while i < n:
        if above[i]:
            j = i
            while j < n and above[j]:
                j += 1
            if (j - i) * hop_sec >= min_dur:
                spans.append((float(vals[i:j].mean()), i * hop_sec, j * hop_sec))
            i = j
        else:
            i += 1
    if duration and sum(b - a for _, a, b in spans) > 0.7 * duration:
        return []
    spans.sort(reverse=True)
    return [[round(a, 1), round(b, 1)] for _, a, b in spans[:max_spans]]


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
    out = {"low_mid_ratio": round(float(band / total), 3),
           "mud_peak_hz": int(round(peak_hz / 5) * 5)}
    # WHERE the mud lives: per-frame band share (smoothed ~1.5s), kept where it
    # exceeds both the finding threshold and this track's own average.
    hop_sec = 512 / sr
    ratio_t = S[sel].sum(axis=0) / (S.sum(axis=0) + 1e-12)
    spans = _worst_spans(_smooth(ratio_t, 1.5 / hop_sec), hop_sec,
                         thresh=max(0.35, float(band / total)),
                         duration=len(mono) / sr)
    if spans:
        out["mud_spans"] = spans
    return out


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


def measure_low_end(mono: np.ndarray, sr: int) -> dict:
    """Kick-bass interaction in 40-120 Hz: how much sustained bass fills the
    space BETWEEN kick hits (masking risk), and where the bass actually peaks."""
    S = np.abs(librosa.stft(mono, n_fft=4096)) ** 2
    freqs = librosa.fft_frequencies(sr=sr, n_fft=4096)
    sel = (freqs >= 40) & (freqs <= 120)
    if not sel.any() or S[sel].sum() == 0:
        return {"kick_bass_overlap": 0.0, "bass_peak_hz": 60}
    low = S[sel].sum(axis=0)                                  # low-band energy per frame
    peak_hz = float(freqs[sel][S[sel].mean(axis=1).argmax()])
    try:
        on = librosa.onset.onset_detect(
            onset_envelope=librosa.onset.onset_strength(S=librosa.power_to_db(S[sel])),
            sr=sr, units="frames")
    except Exception:
        on = np.array([], dtype=int)
    if len(on) < 8:
        return {"kick_bass_overlap": 0.0, "bass_peak_hz": int(round(peak_hz / 5) * 5)}
    hit = np.zeros(len(low), dtype=bool)
    for f in on:
        hit[max(0, f - 1):f + 3] = True                        # ~90ms around each kick
    between, at = low[~hit], low[hit]
    if not len(between) or not len(at) or np.median(at) == 0:
        return {"kick_bass_overlap": 0.0, "bass_peak_hz": int(round(peak_hz / 5) * 5)}
    ratio = float(np.median(between) / np.median(at))
    out = {"kick_bass_overlap": round(min(1.0, ratio), 2),
           "bass_peak_hz": int(round(peak_hz / 5) * 5)}
    # WHERE the masking is worst: the same overlap re-measured in 8s windows
    # (1s step); sustained windows above the flag threshold become loop spans.
    hop_sec = 1024 / sr
    w, step = max(1, int(8.0 / hop_sec)), max(1, int(1.0 / hop_sec))
    win_vals = []
    for i in range(0, max(1, len(low) - w), step):
        bl, al = low[i:i + w][~hit[i:i + w]], low[i:i + w][hit[i:i + w]]
        if len(bl) >= 4 and len(al) >= 4 and np.median(al) > 0:
            win_vals.append(min(1.0, float(np.median(bl) / np.median(al))))
        else:
            win_vals.append(0.0)
    dur = len(mono) / sr
    spans = _worst_spans(np.array(win_vals), 1.0, thresh=max(0.8, ratio),
                         min_dur=8.0, duration=dur)
    if spans:                                # windows look 8s ahead of their start
        out["lowend_spans"] = [[a, round(min(dur, b + 8.0), 1)] for a, b in spans]
    return out


def measure_transients(mono: np.ndarray, sr: int) -> dict:
    """Punch: how sharply onsets rise above the surrounding energy (crest of the
    onset-strength envelope). Soft attack reads as a weak, washed kick/snare."""
    env = librosa.onset.onset_strength(y=mono, sr=sr)
    if env.size < 16 or env.mean() == 0:
        return {"transient_strength": 0.5}
    crest = float(np.percentile(env, 98) / (env.mean() + 1e-9))
    return {"transient_strength": round(min(1.0, crest / 8.0), 2)}   # ~8x crest = very punchy


def measure_vocal_performance(vocal: np.ndarray, sr: int) -> dict:
    """Intonation measurements on an ISOLATED vocal stem (Demucs output).
    pyin f0 on voiced frames -> deviation from the nearest equal-tempered
    semitone, in cents. Returns {} when there isn't enough voiced material
    (<3s), so a sparse/ad-lib vocal never produces a confident-sounding number.
      pitch_dev_cents    median |deviation| — intonation accuracy
      pitch_within_10c   share of voiced frames within ±10 cents — near 1.0
                         with tiny dev reads as hard-tuned (autotune/AI)
    """
    try:
        f0, voiced, _ = librosa.pyin(vocal, fmin=80, fmax=800, sr=sr,
                                     frame_length=2048)
    except Exception:
        return {}
    f0 = f0[(voiced) & np.isfinite(f0)]
    if f0.size < int(3.0 * sr / 512):            # < ~3s of voiced frames
        return {}
    midi = 12 * np.log2(f0 / 440.0) + 69
    dev_cents = 100 * (midi - np.round(midi))
    out = {
        "pitch_dev_cents": round(float(np.median(np.abs(dev_cents))), 1),
        "pitch_within_10c": round(float(np.mean(np.abs(dev_cents) <= 10)), 2),
        "voiced_sec": round(float(f0.size * 512 / sr), 1),
    }
    # Delivery dynamics: p90-p10 spread of the active vocal's RMS, in dB.
    # A human performance breathes (verses soft, hooks loud) — a spread under
    # ~4 dB reads as one flat intensity the whole way through.
    rms = librosa.feature.rms(y=vocal)[0]
    act = rms[rms > 10 ** (-40 / 20)]
    if act.size >= 40:                            # ≥ ~1s of audible vocal
        lo, hi = np.percentile(20 * np.log10(act), [10, 90])
        out["vocal_dyn_db"] = round(float(hi - lo), 1)
    return out


def measure_vocal_bands(mono: np.ndarray, sr: int) -> dict:
    """Mix-level vocal proxies (interpreted only when the ML layer hears vocals):
    presence 2-5 kHz and sibilance 5.5-9 kHz as shares of total energy."""
    S = np.abs(librosa.stft(mono)) ** 2
    freqs = librosa.fft_frequencies(sr=sr)
    total = S.sum()
    if total == 0:
        return {"presence_ratio": 0.0, "sibilance_ratio": 0.0}
    sib_sel = (freqs >= 5500) & (freqs <= 9000)
    sib = float(S[sib_sel].sum() / total)
    out = {"presence_ratio": round(float(S[(freqs >= 2000) & (freqs <= 5000)].sum() / total), 3),
           "sibilance_ratio": round(sib, 3)}
    # WHERE the sibilance bites: per-frame share (smoothed ~1s), kept where it
    # exceeds both the finding threshold and this track's own average.
    hop_sec = 512 / sr
    ratio_t = S[sib_sel].sum(axis=0) / (S.sum(axis=0) + 1e-12)
    spans = _worst_spans(_smooth(ratio_t, 1.0 / hop_sec), hop_sec,
                         thresh=max(0.10, sib), min_dur=2.0,
                         duration=len(mono) / sr)
    if spans:
        out["sib_spans"] = spans
    return out


# Tonal balance: 24 log-spaced bands, 30 Hz – 16 kHz. Measured on the FULL-RATE
# signal (the 22k downmix has no air band). Centers are geometric means.
TONAL_EDGES = np.geomspace(30.0, 16000.0, 25)
TONAL_CENTERS = [float(round((lo * hi) ** 0.5)) for lo, hi in zip(TONAL_EDGES[:-1], TONAL_EDGES[1:])]


def measure_tonal_bands(mono: np.ndarray, sr: int) -> dict:
    """Long-term tonal balance: mean power per log band, in dB relative to the
    curve's own mean — loudness-independent, so a quiet demo and a hot master
    with the same tone yield the same curve. Comparable across tracks and to
    the per-genre corpus curves in norms_data.json ("tonal")."""
    try:
        S = np.abs(librosa.stft(mono, n_fft=4096, hop_length=2048)) ** 2
        freqs = librosa.fft_frequencies(sr=sr, n_fft=4096)
        pw = S.mean(axis=1)
        bands = []
        for lo, hi in zip(TONAL_EDGES[:-1], TONAL_EDGES[1:]):
            sel = (freqs >= lo) & (freqs < hi)
            bands.append(float(pw[sel].mean()) if sel.any() else float("nan"))
        b = np.array(bands)
        # bands above nyquist (low-sr sources): carry the last real value so the
        # normalization isn't dragged by a fake -120 dB tail
        for i in range(1, len(b)):
            if np.isnan(b[i]):
                b[i] = b[i - 1]
        b = 10 * np.log10(np.maximum(b, 1e-12))
        b -= b.mean()
        return {"tonal_bands": [round(float(x), 1) for x in b]}
    except Exception:
        return {}


ANALYSIS_SR = 22050  # spectral features run at 22k — 2x+ faster, no accuracy loss for these


def analyze(path: str, genre: str = "melodic techno") -> dict:
    mono, stereo, sr = _load(path)
    duration = round(len(mono) / sr, 1)

    # Loudness / peak / stereo need the full-rate signal (ITU-R spec, inter-sample
    # peaks, L/R correlation). Everything spectral runs on a 22k downmix, and the
    # two expensive features (beat grid, chroma) are computed ONCE and shared.
    m22 = librosa.resample(mono, orig_sr=sr, target_sr=ANALYSIS_SR) if sr != ANALYSIS_SR else mono
    # beats: the beat GRID for timing_rigidity (its human baselines were
    # measured with this exact grid — do not change its source).
    try:
        bt_tempo, beats = librosa.beat.beat_track(y=m22, sr=ANALYSIS_SR, units="time")
    except Exception:
        bt_tempo, beats = 0.0, np.array([])
    try:
        chroma = librosa.feature.chroma_cqt(y=m22, sr=ANALYSIS_SR)
    except Exception:
        chroma = np.zeros((12, 0))
    # One HPSS pass, both halves used: harmonic -> key chroma (validated
    # +12.6pt exact), percussive -> tempo (validated +26pt acc1). AI tells
    # keep the RAW chroma — their human baselines were measured on it.
    try:
        harm, perc = librosa.effects.hpss(m22)
        chroma_h = librosa.feature.chroma_cqt(y=harm, sr=ANALYSIS_SR)
        oenv_p = librosa.onset.onset_strength(y=perc, sr=ANALYSIS_SR, hop_length=512)
        tempo = estimate_tempo(oenv_p, ANALYSIS_SR, 512) or bt_tempo
    except Exception:
        chroma_h = chroma
        tempo = bt_tempo

    out = {"duration_sec": duration, "sample_rate": sr, "genre_assumed": genre}
    # Pooled harmonic chroma rides along so the server can re-pick the key with
    # the right genre profile after auto-detect resolves (12 floats, negligible).
    out["_chroma_h"] = [round(float(x), 5) for x in
                        (chroma_h.mean(axis=1) if chroma_h.size else np.zeros(12))]
    out.update(measure_loudness(path))
    out.update(measure_codec_impact(path))
    out.update(measure_dynamics(m22, ANALYSIS_SR))
    out.update(measure_tempo_key(tempo, chroma_h, genre))
    out.update(measure_intro(m22, ANALYSIS_SR))
    out.update(measure_mud(m22, ANALYSIS_SR))
    out.update(measure_stereo(stereo, mono, sr))
    out.update(measure_ai_tells(m22, ANALYSIS_SR, beats, chroma))
    out.update(measure_energy_curve(m22, ANALYSIS_SR))
    out.update(measure_low_end(m22, ANALYSIS_SR))
    out.update(measure_transients(m22, ANALYSIS_SR))
    out.update(measure_vocal_bands(m22, ANALYSIS_SR))
    out.update(measure_tonal_bands(mono, sr))
    out["norms"] = get_norms(genre)
    return out


if __name__ == "__main__":
    import sys, json
    if len(sys.argv) < 2:
        print("usage: python analyze.py <audiofile> [genre]")
        sys.exit(1)
    genre = sys.argv[2] if len(sys.argv) > 2 else "melodic techno"
    print(json.dumps(analyze(sys.argv[1], genre), indent=2))
