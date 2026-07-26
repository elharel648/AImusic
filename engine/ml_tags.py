"""
ML classification layer — Essentia pretrained models, running locally (free).

Models (MTG, Universitat Pompeu Fabra — https://essentia.upf.edu/models):
  - discogs-effnet: audio embedding trained on 3.3M Discogs releases
  - genre_discogs400: 400 fine-grained genre styles
  - voice_instrumental: vocals present vs instrumental
  - danceability

These are published, peer-reviewed models — the same lineage Spotify's retired
audio-features drew from. Everything runs on-device; no API, no per-call cost.

Models are lazy-loaded once per process (~1.5s warmup, then ~1.5s per track).
If model files are missing, ml_analyze() returns {} and the report simply
omits ML findings — never crashes.
"""
from __future__ import annotations
import json
import os

_MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")
_cache: dict = {}

# Map fine-grained Discogs-400 styles → our genre-norm buckets.
# Top-level Discogs genre (before "---") decides when no specific rule matches.
_STYLE_TO_BUCKET = {
    "Electronic---Minimal": "melodic techno", "Electronic---Techno": "melodic techno",
    "Electronic---Progressive House": "melodic techno", "Electronic---Trance": "melodic techno",
    "Electronic---House": "house", "Electronic---Deep House": "house",
    "Electronic---Tech House": "house", "Electronic---Disco": "house",
    "Electronic---Downtempo": "lo-fi", "Electronic---Trip Hop": "lo-fi",
    "Electronic---Ambient": "lo-fi", "Electronic---Chillwave": "lo-fi",
}
_TOP_TO_BUCKET = {
    "Electronic": "edm", "Hip Hop": "hip-hop", "Rock": "rock", "Pop": "pop",
    "Funk / Soul": "pop", "Reggae": "pop", "Latin": "pop",
    "Folk, World, & Country": "default", "Jazz": "default", "Classical": "default",
    "Blues": "rock", "Stage & Screen": "default", "Non-Music": "default",
    "Brass & Military": "default", "Children's": "default",
}


def _load():
    """Load models once. Raises if essentia/models unavailable (caller guards)."""
    if _cache:
        return _cache
    from essentia.standard import (MonoLoader, TensorflowPredictEffnetDiscogs,
                                   TensorflowPredict2D)
    p = lambda f: os.path.join(_MODELS_DIR, f)
    _cache["MonoLoader"] = MonoLoader
    _cache["embed"] = TensorflowPredictEffnetDiscogs(
        graphFilename=p("discogs-effnet-bs64-1.pb"), output="PartitionedCall:1")
    _cache["genre"] = TensorflowPredict2D(
        graphFilename=p("genre_discogs400-discogs-effnet-1.pb"),
        input="serving_default_model_Placeholder", output="PartitionedCall:0")
    _cache["voice"] = TensorflowPredict2D(
        graphFilename=p("voice_instrumental-discogs-effnet-1.pb"), output="model/Softmax")
    _cache["dance"] = TensorflowPredict2D(
        graphFilename=p("danceability-discogs-effnet-1.pb"), output="model/Softmax")
    _cache["labels"] = json.load(open(p("genre_discogs400-discogs-effnet-1.json")))["classes"]
    return _cache


def style_to_bucket(style: str) -> str:
    if style in _STYLE_TO_BUCKET:
        return _STYLE_TO_BUCKET[style]
    top = style.split("---")[0]
    return _TOP_TO_BUCKET.get(top, "default")


def pretty_style(style: str) -> str:
    """'Electronic---Minimal' → 'Minimal (Electronic)'"""
    parts = style.split("---")
    return f"{parts[1]} ({parts[0]})" if len(parts) == 2 else style


def ml_available() -> bool:
    try:
        return os.path.exists(os.path.join(_MODELS_DIR, "discogs-effnet-bs64-1.pb"))
    except Exception:
        return False


def ml_analyze(path: str) -> dict:
    """Genre / vocals / danceability from pretrained models. Returns {} on any failure."""
    try:
        import numpy as np
        m = _load()
        audio = m["MonoLoader"](filename=path, sampleRate=16000, resampleQuality=4)()
        if len(audio) < 16000 * 3:          # under ~3s: embeddings are meaningless
            return {}
        emb = m["embed"](audio)

        genre_probs = m["genre"](emb).mean(axis=0)
        order = np.argsort(genre_probs)[::-1]
        top = [(m["labels"][i], float(genre_probs[i])) for i in order[:3]]

        voice_probs = m["voice"](emb).mean(axis=0)   # [instrumental, voice]
        dance_probs = m["dance"](emb).mean(axis=0)   # [danceable, not]

        style, conf = top[0]
        return {
            "ml_genre_style": style,
            "ml_genre_pretty": pretty_style(style),
            "ml_genre_bucket": style_to_bucket(style),
            "ml_genre_confidence": round(conf, 3),
            "ml_genre_top3": [(pretty_style(s), round(c, 3)) for s, c in top],
            "ml_voice_prob": round(float(voice_probs[1]), 3),
            "ml_is_instrumental": bool(voice_probs[0] >= 0.5),
            "ml_danceability": round(float(dance_probs[0]), 3),
        }
    except Exception:
        return {}
