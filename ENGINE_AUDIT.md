# Engine Audit — Findings, Fixes & Roadmap (2026-08-09)

Four-track deep audit: full codebase trace, MIR state-of-the-art survey, mix-analysis
science review, and model/licensing/confidence research. All claims below are sourced —
see the research citations inline. Grades are honest, not generous.

## What was FIXED in this audit round (validated, shipped)

| # | Defect | Fix | Validation |
|---|--------|-----|------------|
| P0-1 | EDM mode structurally incapable of major keys (flat EDMM major profile skipped) | EDMM-minor primary; flip to EDMA-major only when EDMA major-vs-minor margin > 0.12. Major branch ships conf **0.27 (measured)** + relative minor as rival | GiantSteps n=604 cached chroma: exact 56.8% / MIREX 65.5 vs 57.1 / 65.4 minor-only; major precision 10/37 exact, 12/37 relative-minor confusion |
| P0-2 | "LRA" displayed without EBU Tech 3342's −20 LU relative gate | Relative gate added (energy-mean ref of abs-gated blocks) | Synthetic + e2e |
| P0-3 | "Clipping" (crit, score 30) fired on any master hotter than −0.3 dBTP | Real clipping = ≥8 runs of ≥4 consecutive pinned samples; `clip_runs` + `tp_hot` now separate measurements | Hard-clipped fixture: 4,529 runs → crit. Clean −0.2 dBTP master: no longer "clipping" |
| P0-4 | Genre-blind tempo octave fold (65 BPM trap → "130") | Fold recorded (`bpm_folded_from`); server un-folds when the resolved genre's measured BPM range says raw was right. `bpm_alt` (half/double-time) always shipped — MIREX two-candidate convention | e2e |
| P0-5 | Mud threshold 0.35 sits ABOVE our own corpus p90 (0.17–0.28) — flagship finding almost never fired | Bar = measured human-master p90 per family (floor 0.30), score scaled from the bar | norms_data quantiles |
| P0-6 | Stereo = one unclamped scalar; **no mono-compatibility measurement at all** | Width clamped; `phase_corr`; per-band correlation + **measured mono-sum loss** (windowed cross-spectra); new Stereo finding (crit on negative correlation / ≥6 dB band loss) in 7 languages | Inverted-pad fixture: corr −0.72, mid-band −32.4 dB, crit fires |
| P0-7 | Honesty gaps | Deep vocal "first 90 seconds" disclosed in voc_stem_why (7 langs); Spotify API `loudness` no longer worn as a measured LUFS range (curated until cross-validated); About-page "904,000 tracks" → honest per-genre n; genre softmax labeled "(uncalibrated)"; Suno prompt uses measured `mud_peak_hz` | e2e + 22/22 tests |

## Capability grades (post-fix)

A−: LUFS · B+: true peak (4×) · B: LRA (now gated), energy curve, streaming table, codec check, norms plumbing
B−: tempo (validated EDM-only), intro heuristic (self-consistent, unvalidated), vocal stem metrics (90 s window, A440 assumption), ML tags (uncalibrated, license debt), AI tells (honestly self-disarmed)
C+: key (57% exact EDM — SOTA CNN is ~68%), mud/sibilance thresholds (now corpus-anchored), tonal curves (n=48!), kick-bass overlap (unvalidated)
Now measured (was E): mono compatibility.

## P1 — build soon (validated payoff, license-clean)

1. **Beat This! (CPJKU, MIT, CPU-capable)** for beats/downbeats; derive BPM from beat intervals + EDM range prior (76.5% acc1 achievable vs our 67.0). Also unlocks bar-snapped intro/peak times.
2. **Tuning-reference estimation** before pyin cents (A≠440 masters currently read as out-of-tune).
3. **Tonal curves need n≥500/family** — rerun Jamendo ingest wider before trusting corridor comparisons.
4. **Non-EDM key ground truth** (e.g. McGill Billboard) — our calibration is EDM-only, applied everywhere.
5. **PLR/PSR** (arithmetic on existing measurements; PSR<8 in loud sections = defensible over-compression evidence — AES e-brief 19324).

## P2 — strategic (licensing swap plan)

Current model stack is NOT commercially clean:
- Essentia library **AGPL** + MTG models **CC BY-NC-SA** (genre/voice/dance heads) → replace with **LAION CLAP** (Apache/CC0) zero-shot + calibration, and **PANNs CNN14** (CC-BY) as singing-presence witness. Or license from UPF (offered, worth a quote).
- Demucs **htdemucs weights "scientific purposes only"** (facebookresearch/demucs#327) → replace with an **MIT checkpoint from ZFTurbo/Music-Source-Separation-Training** (Mel-RoFormer family, higher SDR than htdemucs); benchmark CPU cost first, GGML port exists.
- madmom (if ever considered): model files CC BY-NC-SA — avoid; Beat This! covers it under MIT.
- Structure labeling (all-in-one, MIT): EDM cross-domain HR.5F drops to .635 (Raveform 2026) — only with in-domain validation, labels always "producer's read", with a "no clear drop found" path.

## DO NOT BUILD (evidence-based)

- **Overall mix-quality score as measurement** — best signal-feature↔preference correlation in the literature is r≈0.52; any 0–100 is judgment (ours is labeled as such; keep it that way).
- **Hit prediction** — no credible validation exists anywhere; the one vendor who claims it is the industry's cautionary tale.
- **Per-source masking attribution from a stereo mix** ("bass masks the kick") — validated metrics need stems; separation-based is estimate-on-estimate. Kick-bass overlap stays a flagged heuristic, conservative threshold.
- **Warmth/fullness scores** — no accepted objective correlates (descriptor studies inconsistent).
- **Sub-second structure-boundary claims** — human agreement itself fails at ±0.5 s; bar-level honesty only.
- **Emotion/mood as measurement** — genre-correlated guesses; producer's-read label at most.

## Worth knowing

- Punch has a *validated* perceptual model (Fenton & Lee, r=0.84 vs listeners) — the one perceptual metric worth adding as "measured-adjacent".
- Our margin→accuracy key calibration is legitimate published methodology (histogram binning, Zadrozny & Elkan 2001). Conformal prediction sets are the natural next step ("A minor — or possibly C major" with guaranteed coverage).
- Numeric uncertainty display *protects* trust when the product is wrong (Joslyn & LeClerc 2012); vague verbal hedges corrode it (van der Bles, PNAS 2020). Percentages need a reference class ("on tracks with evidence this strong we're right ~9 in 10").
