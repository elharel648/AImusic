---
name: validate-engine
description: Validate any engine/DSP change against ground truth BEFORE shipping — GiantSteps cached chroma for key changes, pytest suite, synthetic fixtures with known answers. A change without this gate once lost 16pp of key accuracy.
---

# Engine validation gate

Every change to analyze.py / insights.py thresholds or algorithms runs ALL of:

## 1. Unit suite (must stay 22+/22)
```bash
.venv/bin/python -m pytest tests/ -q
```

## 2. Key changes → GiantSteps offline (seconds, no downloads)
604 expert-annotated EDM tracks, chroma cached in `calibration/giantsteps-key/chroma_cache.npz`
(`{stem}|hpss_mean` keys). Ground truth: `calibration/giantsteps-key/annotations/key/*.key`.
Scoring helpers: `tools/key_experiment.py` (`parse_key`, `mirex_cat`, PROFILES).
Baseline to beat/hold: **exact 56.8% / MIREX 65.5** (hybrid, commit bc0e2ab).
Report exact + MIREX + majors-predicted count. GiantSteps is 85% minor — a
minor-only regression will LOOK fine here; always check majors count too.

## 3. Tempo changes → tools/validate_tempo.py path (GiantSteps Tempo v2, n=664)
Baseline: acc1 67.0 / acc2 79.1.

## 4. Synthetic e2e (server running)
- hard-clipped fixture → `clipping:true`, `clip_runs` in the thousands
- clean −0.2 dBTP master → `clipping:false`, `tp_hot:true`
- C-major arpeggio + 124bpm kick, genre=house → key "C major", conf 0.27, alt = relative minor
- phase-inverted pad → `phase_corr<0`, mid-band `mono_loss` ≈ −30 dB, Stereo crit finding

## Calibration honesty rules
- Confidence displayed = measured accuracy (margin-binned). New branches need their
  own measured rate (the major branch ships 0.27 because that's what it scored).
- Thresholds must cite a corpus quantile (norms_data.json) or a validation run — never a vibe.
- norms_data.json "tonal" is n≈48/family — do NOT tighten anything against it.
