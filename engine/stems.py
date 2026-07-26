"""
Stem separation — Demucs htdemucs, two-stem mode (vocals / no_vocals), CPU.

Powers the opt-in "deep vocal analysis" path: instead of guessing vocal
sibilance/presence from the full mix, we separate the vocal and measure it
directly. To keep CPU time sane we only separate the FIRST 90 seconds
(ffmpeg pre-trim) — enough to characterize the vocal chain, which doesn't
change mid-song.

Guarded: stems_available() is False when demucs/torch aren't installed, and
separate() raises RuntimeError (never an ImportError from deep inside torch),
so the rest of the engine works without the heavy deps.
"""
from __future__ import annotations
import os
import shutil
import subprocess
import tempfile

SEP_SECONDS = 90          # analyze the first 90s only — CPU sanity
_MODEL = "htdemucs"


def stems_available() -> bool:
    try:
        import demucs.separate  # noqa: F401
        return True
    except Exception:
        return False


def separate(path: str, seconds: int = SEP_SECONDS):
    """
    Separate `path` into vocal / accompaniment stems (first `seconds` only).

    Returns (stems, cleanup):
      stems   — {"vocals": <wav path>, "no_vocals": <wav path>}
      cleanup — call it when done; removes the temp dir holding the stems.
    Raises RuntimeError if demucs is missing or produced no stems.
    """
    if not stems_available():
        raise RuntimeError("demucs not installed — deep vocal analysis unavailable")

    workdir = tempfile.mkdtemp(prefix="anr_stems_")

    def cleanup():
        shutil.rmtree(workdir, ignore_errors=True)

    try:
        # Pre-trim with ffmpeg (-t before -i stops the decode early) so Demucs
        # never sees more than `seconds` of audio.
        head = os.path.join(workdir, "head.wav")
        subprocess.run(
            ["ffmpeg", "-y", "-t", str(seconds), "-i", path, "-ac", "2", "-ar", "44100", head],
            check=True, capture_output=True,
        )

        import demucs.separate
        demucs.separate.main([
            "--two-stems", "vocals", "-n", _MODEL, "-d", "cpu",
            "-o", workdir, "--filename", "{stem}.{ext}", head,
        ])

        out = {
            "vocals": os.path.join(workdir, _MODEL, "vocals.wav"),
            "no_vocals": os.path.join(workdir, _MODEL, "no_vocals.wav"),
        }
        if not all(os.path.exists(p) for p in out.values()):
            raise RuntimeError("demucs finished but produced no stems")
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
