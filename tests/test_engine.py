"""
Engine test suite — verifies the analysis engine against synthetic ground truth.

Every fixture is generated, so tests are deterministic and need no copyrighted audio.
Run:  .venv/bin/pytest tests/ -v
"""
import sys
import os
import numpy as np
import soundfile as sf
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "engine"))

from analyze import analyze, GENRE_NORMS          # noqa: E402
from insights import build_insights                # noqa: E402
from i18n import LANGS                             # noqa: E402

SR = 44100


def _write(tmp_path, name, data, sr=SR):
    p = str(tmp_path / name)
    sf.write(p, data, sr)
    return p


def make_track(dur=32.0, intro=8.0, bpm=124, chord=(220.0, 261.63, 329.63), level=0.5):
    """Synthetic track: quiet intro then chord + kick at a known tempo."""
    t = np.linspace(0, dur, int(SR * dur), endpoint=False)
    env = np.where(t < intro, 0.08, level)
    tone = sum(a * np.sin(2 * np.pi * f * t) for a, f in zip((0.4, 0.3, 0.25), chord))
    beat = 60.0 / bpm
    kick = np.zeros_like(t)
    for i in range(int(dur / beat)):
        p = int(i * beat * SR)
        if p < len(t) - 3000:
            kick[p:p + 3000] += np.sin(2 * np.pi * 58 * t[:3000]) * np.exp(-t[:3000] * 14) * 0.7
    mono = (tone + kick) * env
    mono /= np.max(np.abs(mono)) * 1.15
    return np.stack([mono, np.roll(mono, 60)], axis=1)


# ── accuracy against known ground truth ──────────────────────────────────────

def test_key_bpm_intro(tmp_path):
    p = _write(tmp_path, "am.wav", make_track())
    d = analyze(p, "melodic techno")
    assert d["key"] == "A minor", f"expected A minor, got {d['key']}"
    assert 118 <= d["bpm"] <= 130, f"bpm off: {d['bpm']}"
    assert 6.0 <= d["intro_sec"] <= 10.5, f"intro off: {d['intro_sec']}"


def test_clipping_detected(tmp_path):
    t = np.linspace(0, 10, SR * 10, endpoint=False)
    hot = np.clip(np.sin(2 * np.pi * 220 * t) * 1.4, -1.0, 1.0)   # hard-clipped
    p = _write(tmp_path, "hot.wav", np.stack([hot, hot], axis=1))
    d = analyze(p)
    assert d["clipping"] is True
    assert d["true_peak_db"] >= -0.3


def test_energy_curve_shape(tmp_path):
    p = _write(tmp_path, "c.wav", make_track())
    d = analyze(p)
    assert len(d["energy_curve"]) == 96
    assert all(0.0 <= v <= 1.0 for v in d["energy_curve"])
    assert d["peak_moment_sec"] >= 0


# ── robustness: inputs that must not crash ───────────────────────────────────

def test_mono_file(tmp_path):
    t = np.linspace(0, 12, SR * 12, endpoint=False)
    p = _write(tmp_path, "mono.wav", 0.4 * np.sin(2 * np.pi * 261.63 * t))
    d = analyze(p)
    assert d["is_mono"] is True
    build_insights(d)   # full pipeline must survive


def test_short_file(tmp_path):
    t = np.linspace(0, 3, SR * 3, endpoint=False)
    p = _write(tmp_path, "short.wav", 0.4 * np.sin(2 * np.pi * 440 * t))
    d = analyze(p)
    build_insights(d)


def test_near_silence(tmp_path):
    """Silence produces LUFS of -inf — pipeline must not crash on it."""
    p = _write(tmp_path, "quiet.wav", np.zeros(SR * 8, dtype=np.float32) + 1e-6)
    d = analyze(p)
    rep = build_insights(d)
    assert isinstance(rep["overall"], int)


# ── i18n: full report must build in every supported language ─────────────────

@pytest.mark.parametrize("lang", LANGS)
def test_all_languages(tmp_path, lang):
    p = _write(tmp_path, "l.wav", make_track(dur=16))
    rep = build_insights(analyze(p), lang)
    assert rep["verdict"] and rep["priority"]
    for f in rep["findings"]:
        assert f["k"] and f["headline"] and f["why"]
    assert rep["ai_signals"]["headline"]
    assert rep["streaming"]["headline"] and len(rep["streaming"]["platforms"]) == 6
    # Suno prompt must stay English regardless of language
    assert "bpm" in rep["suno_prompt"]


# ── genre norms sanity ───────────────────────────────────────────────────────

def test_genre_norms_complete():
    for g, n in GENRE_NORMS.items():
        assert set(n) == {"bpm", "intro_sec", "lufs"}, f"{g} malformed"
        assert n["bpm"][0] < n["bpm"][1]
        assert n["lufs"][0] < n["lufs"][1]


# ── ML character finding (unit — no model needed, keys injected) ─────────────

def test_character_finding_excluded_from_overall(tmp_path):
    p = _write(tmp_path, "ch.wav", make_track(dur=16))
    raw = analyze(p)
    base = build_insights(dict(raw))["overall"]
    raw_ml = dict(raw, ml_genre_pretty="Minimal (Electronic)", ml_genre_confidence=0.42,
                  ml_voice_prob=0.1, ml_is_instrumental=True, ml_danceability=0.9)
    rep = build_insights(raw_ml)
    ch = [f for f in rep["findings"] if f["id"] == "Character"]
    assert len(ch) == 1
    assert rep["findings"][-1]["id"] == "Character"      # always last
    assert rep["overall"] == base                        # low confidence must not drag score
    assert rep["meta"]["genre"] == "Minimal (Electronic)"


def test_report_json_serializable(tmp_path):
    """The full report (with _raw) must survive stdlib json — numpy bools don't."""
    import json
    p = _write(tmp_path, "js.wav", make_track(dur=16))
    raw = analyze(p)
    rep = build_insights(raw)
    rep["_raw"] = raw
    json.dumps(rep)   # raises TypeError if any numpy type leaks through


# ── streaming readiness ──────────────────────────────────────────────────────

def test_streaming_quiet_vs_loud():
    """A quiet master must flag the down-only platforms; a loud one passes everywhere."""
    from insights import _streaming
    from i18n import t
    L = lambda _s, **v: t("en", _s, **v)
    base = {"true_peak_db": -2.0, "clipping": False, "duration_sec": 200}
    quiet = _streaming("en", dict(base, lufs=-18.0), L)
    assert quiet["level"] in ("warn", "crit")
    flagged = {p["name"] for p in quiet["platforms"] if p["mode"] == "quiet"}
    assert "YouTube" in flagged          # never boosts quiet tracks
    assert "Spotify" not in flagged      # boosts, so not flagged
    loud = _streaming("en", dict(base, lufs=-9.0), L)
    assert loud["level"] == "good"
    assert all(p["mode"] == "down" for p in loud["platforms"])
    assert all(c["ok"] for c in loud["checks"])


def test_stems_import_and_guard(monkeypatch):
    """stems must import without demucs installed, and separate() must raise a
    clean RuntimeError (not an ImportError from inside torch) when it's missing."""
    import stems
    assert isinstance(stems.stems_available(), bool)
    monkeypatch.setattr(stems, "stems_available", lambda: False)
    with pytest.raises(RuntimeError):
        stems.separate("/nonexistent.wav")


def test_ml_style_bucket_mapping():
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "engine"))
    from ml_tags import style_to_bucket
    assert style_to_bucket("Electronic---Minimal") == "melodic techno"
    assert style_to_bucket("Electronic---Deep House") == "house"
    assert style_to_bucket("Hip Hop---Trap") == "hip-hop"
    assert style_to_bucket("Rock---Shoegaze") == "rock"
    assert style_to_bucket("Classical---Baroque") == "default"
