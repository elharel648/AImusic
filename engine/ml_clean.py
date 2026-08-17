"""
ML classification layer — LICENSE-CLEAN stack, running locally (free).

Replaces the essentia(AGPL)+MTG(CC BY-NC) stack with:
  - MS-CLAP 2023 (Microsoft, MIT): zero-shot genre + danceability via
    audio↔text similarity. Checkpoint ~450 MB, auto-downloaded once.
  - PANNs CNN14 (Kong et al., code Apache-2.0, weights CC-BY): AudioSet
    tagging; the singing/rap classes are the vocal-presence witness.

Same contract as ml_tags.ml_analyze(): returns {} on any failure, and the
report simply omits ML findings — never crashes. Genre stays labeled
"(uncalibrated)" downstream, exactly like the old stack; the deep-vocal
gate keeps its conservative <=0.25 veto semantics.
"""
from __future__ import annotations

import os

import numpy as np

_cache: dict = {}

# our genre-norm buckets, described in CLAP's language. Prompt set "B",
# chosen by measurement (tools/ml-swap study, 2026-08-17): GS-EDM
# electronic-family 36/40 (set A scored 20/40; old MTG stack 40/40 — but it
# was trained on this exact domain), Jamendo cross-family parity with the
# old stack. Long, production-anchored captions beat genre names.
_BUCKET_PROMPTS = {
    "melodic techno": ["an instrumental melodic techno track with hypnotic synthesizer arpeggios and a steady four-on-the-floor kick",
                       "a dark progressive trance club track with driving electronic bass"],
    "house":          ["an instrumental house music club track with a four-on-the-floor dance beat and groovy bassline",
                       "a deep house track with electronic drums and filtered chords"],
    "edm":            ["a big room EDM festival track with heavy synthesizer drops and electronic dance beats",
                       "an energetic electronic dance music track made with synthesizers and drum machines",
                       "a dubstep or drum and bass track with heavy electronic bass"],
    "lo-fi":          ["a lo-fi chillhop instrumental beat with dusty drums and mellow keys",
                       "a downtempo ambient electronic track with soft pads"],
    "hip-hop":        ["a hip hop track with a rapper rapping over a beat",
                       "a trap song with 808 bass and rap vocals"],
    "rock":           ["a rock song played by a band with electric guitars and live drums",
                       "a metal or punk track with distorted electric guitars"],
    "pop":            ["a mainstream pop song with a lead singer singing a catchy melody",
                       "a radio pop ballad with prominent lead vocals"],
    "default":        ["a jazz recording with acoustic instruments", "an orchestral classical music piece",
                       "an acoustic folk song with guitar and voice"],
}
_DANCE_PROMPTS = ["danceable rhythmic club music", "music that is not danceable"]

# PANNs voice veto — measured on the same study: windowed vocal-prob over
# 15 s windows separates cleanly (vocal tracks min 0.087 / median 0.198;
# instrumental EDM median 0.007). Veto deep separation only below this bar.
VOICE_VETO = 0.05

# AudioSet class names whose presence witnesses vocals in a music track
_VOCAL_CLASSES = ("Singing", "Male singing", "Female singing", "Child singing",
                  "Rapping", "Mantra", "Choir")


def _load():
    if _cache:
        return _cache
    from msclap import CLAP
    from panns_inference import AudioTagging, labels as panns_labels
    _cache["clap"] = CLAP(version="2023", use_cuda=False)
    # text embeddings computed once — genre space is fixed
    buckets, prompts = [], []
    for b, ps in _BUCKET_PROMPTS.items():
        for p in ps:
            buckets.append(b); prompts.append(f"This audio is {p}.")
    emb = _cache["clap"].get_text_embeddings(prompts + [f"This audio is {p}." for p in _DANCE_PROMPTS])
    emb = emb / np.linalg.norm(np.asarray(emb), axis=1, keepdims=True)
    _cache["text_emb"] = np.asarray(emb[:len(prompts)])
    _cache["dance_emb"] = np.asarray(emb[len(prompts):])
    _cache["buckets"] = buckets
    _cache["prompts"] = prompts
    _cache["panns"] = AudioTagging(checkpoint_path=None, device="cpu")
    _cache["vocal_idx"] = [i for i, l in enumerate(panns_labels) if l in _VOCAL_CLASSES]
    return _cache


def ml_available() -> bool:
    try:
        import msclap, panns_inference  # noqa: F401
        return True
    except Exception:
        return False


def _pretty(bucket: str) -> str:
    return {"edm": "EDM (Electronic)", "melodic techno": "Melodic Techno",
            "house": "House", "lo-fi": "Lo-fi", "hip-hop": "Hip-Hop",
            "rock": "Rock", "pop": "Pop", "default": "Other"}.get(bucket, bucket)


def ml_analyze(path: str) -> dict:
    """Genre / vocals / danceability from license-clean models. {} on failure."""
    try:
        import librosa
        m = _load()

        # ── CLAP zero-shot genre + danceability ──
        a = m["clap"].get_audio_embeddings([path])
        a = np.asarray(a); a = a / np.linalg.norm(a, axis=1, keepdims=True)
        sims = (a @ m["text_emb"].T)[0]                      # cosine per prompt
        per_bucket: dict = {}
        for b, s in zip(m["buckets"], sims):
            per_bucket[b] = max(per_bucket.get(b, -1e9), float(s))
        order = sorted(per_bucket, key=per_bucket.get, reverse=True)
        # softmax over bucket maxima → a probability-shaped confidence
        vals = np.array([per_bucket[b] for b in order])
        probs = np.exp(vals * 20) / np.exp(vals * 20).sum()  # temperature per CLAP sim scale
        bucket, conf = order[0], float(probs[0])
        dsims = (a @ m["dance_emb"].T)[0]
        dance = float(np.exp(dsims[0] * 20) / (np.exp(dsims[0] * 20) + np.exp(dsims[1] * 20)))

        # ── PANNs vocal witness: max over 15 s windows (first 120 s) — a
        # chorus entrance spikes one window even when verses are sparse ──
        y, sr = librosa.load(path, sr=32000, mono=True, duration=120)
        if len(y) < sr * 3:
            return {}
        win = sr * 15
        probs = []
        for s0 in range(0, max(1, len(y) - win), win):
            clip, _ = m["panns"].inference(y[None, s0:s0 + win])
            probs.append(float(np.max(np.asarray(clip)[0][m["vocal_idx"]])))
        voice_prob = max(probs)

        return {
            "ml_genre_style": bucket,
            "ml_genre_pretty": _pretty(bucket),
            "ml_genre_bucket": bucket,
            "ml_genre_confidence": round(conf, 3),
            "ml_genre_top3": [(_pretty(b), round(float(p), 3)) for b, p in zip(order[:3], probs[:3])],
            "ml_voice_prob": round(voice_prob, 3),
            "ml_voice_veto": bool(voice_prob < VOICE_VETO),   # deep-gate, own calibrated bar
            "ml_is_instrumental": bool(voice_prob < VOICE_VETO),
            "ml_danceability": round(dance, 3),
            "ml_stack": "clean",                             # provenance marker
        }
    except Exception:
        return {}
