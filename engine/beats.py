"""Beat This! (CPJKU, MIT) — transformer beat/downbeat tracker, CPU-capable.

BPM = 60 / median inter-beat interval, which is robust to a few missed or
extra beats. Lazy singleton: the 77 MB checkpoint loads on first use and the
module degrades to None (librosa tempogram fallback) when torch/beat_this is
unavailable — analysis must never fail because a model is missing.

Window cap: the first BEATS_WINDOW_SEC seconds. Tempo is global; the cap keeps
production latency flat on long tracks. The validation set (GiantSteps Tempo,
2-minute previews) is unaffected by the cap, so the measured accuracy is the
production path's accuracy.
"""
from __future__ import annotations

import os
import sys

import numpy as np

BEATS_WINDOW_SEC = 180

_A2B = None
_FAILED = False


def _ensure():
    global _A2B, _FAILED
    if _A2B is not None or _FAILED:
        return _A2B
    try:
        try:
            from beat_this.inference import Audio2Beats
        except Exception:
            # vendored copy (Python-3.9-compatible patch) rides in the repo
            sys.path.insert(0, os.path.join(os.path.dirname(__file__), "vendor"))
            from beat_this.inference import Audio2Beats
        import torch
        torch.set_num_threads(max(1, (os.cpu_count() or 4) // 2))
        _A2B = Audio2Beats(checkpoint_path="final0", device="cpu", dbn=False)
    except Exception:
        _FAILED = True
    return _A2B


def beat_this_bpm(y: np.ndarray, sr: int):
    """Mono float array -> (bpm, n_beats) or None when the tracker can't help."""
    a2b = _ensure()
    if a2b is None:
        return None
    try:
        yw = np.asarray(y[: int(BEATS_WINDOW_SEC * sr)], dtype=np.float32)
        if yw.size < sr * 8:                      # under ~8s there is no tempo
            return None
        beats, _downbeats = a2b(yw, sr)
        ibi = np.diff(beats)
        if len(ibi) < 8:
            return None
        bpm = 60.0 / float(np.median(ibi))
        if not (30.0 < bpm < 300.0):
            return None
        return bpm, int(len(beats))
    except Exception:
        return None
