"""
Stem separation — UVR MDX-Net "Voc_FT" via audio-separator, two-stem
(vocals / instrumental), CPU. LICENSE-CLEAN: audio-separator code is MIT;
the model is trained by the UVR team, whose stated grant is
"For all third-party application developers who wish to use our models,
please honor the MIT license by providing credit to UVR and its developers."
(github.com/Anjok07/ultimatevocalremovergui README). Credit is shown in the
product's accuracy page. This replaces Demucs htdemucs, whose weights are
"scientific purposes only" — validated before the swap: vocal-stem
agreement with htdemucs corr 0.985/0.971 on two vocal tracks; 90 s
separates in ~40 s CPU (htdemucs was ~34 s).

Powers the opt-in "deep vocal analysis" path: instead of guessing vocal
sibilance/presence from the full mix, we separate the vocal and measure it
directly. To keep CPU time sane we only separate the FIRST 90 seconds
(ffmpeg pre-trim) — enough to characterize the vocal chain.

Guarded: stems_available() is False when audio_separator/onnxruntime are
missing, and separate() raises RuntimeError (never an ImportError from deep
inside a backend), so the rest of the engine works without the heavy deps.
"""
from __future__ import annotations
import os
import shutil
import subprocess
import tempfile

SEP_SECONDS = 90          # analyze the first 90s only — CPU sanity
_MODEL_FILE = "UVR-MDX-NET-Voc_FT.onnx"
_MODEL_DIR = os.path.expanduser("~/.cache/anr_models/sep")
_sep = None               # persistent Separator — the model loads once (~11 s)


def stems_available() -> bool:
    try:
        import audio_separator.separator  # noqa: F401
        return True
    except Exception:
        return False


def _get_separator():
    global _sep
    if _sep is None:
        from audio_separator.separator import Separator
        os.makedirs(_MODEL_DIR, exist_ok=True)
        _sep = Separator(model_file_dir=_MODEL_DIR, output_dir=_MODEL_DIR,
                         log_level=40)
        _sep.load_model(_MODEL_FILE)
    return _sep


def separate(path: str, seconds: int = SEP_SECONDS):
    """
    Separate `path` into vocal / accompaniment stems (first `seconds` only).

    Returns (stems, cleanup):
      stems   — {"vocals": <wav path>, "no_vocals": <wav path>}
      cleanup — call it when done; removes the temp dir holding the stems.
    Raises RuntimeError if the backend is missing or produced no stems.
    """
    if not stems_available():
        raise RuntimeError("audio-separator not installed — deep vocal analysis unavailable")

    workdir = tempfile.mkdtemp(prefix="anr_stems_")

    def cleanup():
        shutil.rmtree(workdir, ignore_errors=True)

    try:
        # Pre-trim with ffmpeg (-t before -i stops the decode early) so the
        # separator never sees more than `seconds` of audio.
        head = os.path.join(workdir, "head.wav")
        subprocess.run(
            ["ffmpeg", "-y", "-t", str(seconds), "-i", path, "-ac", "2", "-ar", "44100", head],
            check=True, capture_output=True,
        )

        sep = _get_separator()
        sep.output_dir = workdir                      # route this call's stems
        if hasattr(sep, "model_instance") and sep.model_instance is not None:
            sep.model_instance.output_dir = workdir   # 0.18 keeps its own copy
        outs = sep.separate(head)

        vocals = next((o for o in outs if "(Vocals)" in o), None)
        inst = next((o for o in outs if "(Instrumental)" in o), None)
        out = {
            "vocals": os.path.join(workdir, vocals) if vocals else "",
            "no_vocals": os.path.join(workdir, inst) if inst else "",
        }
        if not all(p and os.path.exists(p) for p in out.values()):
            raise RuntimeError("separation finished but produced no stems")
        return out, cleanup
    except Exception:
        cleanup()
        raise


if __name__ == "__main__":
    import sys, time
    t0 = time.perf_counter()
    stems, cleanup = separate(sys.argv[1])
    print(f"separated in {time.perf_counter() - t0:.1f}s -> {stems}")
    cleanup()
