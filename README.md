# A&R AI

Your AI music producer. Upload a track → get an honest, A&R-style read (grounded
in real measurements, not made-up scores) → get a Suno prompt to fix it.

## Structure

```
anr-ai/
├── engine/
│   ├── analyze.py       # real DSP: LUFS, peak, dynamics, BPM, key, intro, mud, stereo
│   ├── insights.py      # turns measurements → A&R findings + verdict + Suno prompt
│   ├── server.py        # FastAPI: POST /api/analyze, serves the web frontend
│   └── requirements.txt
├── web/
│   └── index.html       # single-file frontend (upload → analyze → report → v2 loop)
└── .venv/               # python virtualenv (not committed)
```

## Run locally

```bash
cd anr-ai
python3 -m venv .venv
.venv/bin/pip install -r engine/requirements.txt
cd engine
../.venv/bin/uvicorn server:app --reload --port 8000
# open http://127.0.0.1:8000
```

Requires `ffmpeg` on PATH (for decoding mp3/m4a/etc).

## What's real vs. not (honesty ledger)

- 🟢 **Real & shipping:** loudness (LUFS), true peak/clipping, dynamic range,
  BPM, key, intro length, low-mid mud, stereo width — all measured from the waveform.
- 🟡 **Partially shipping:** "does it sound AI-made?" — as measurable SIGNALS
  (timing rigidity, section repetition, spectral uniformity, flat dynamics),
  shown as "N signals often linked to AI", never a fake %. Thresholds are
  deliberately conservative (won't false-accuse humans) and need calibration
  against real data. Genre classification + vocal analysis still phase 2 (need ML).
- 🔴 **Deliberately excluded:** "commercial potential %", "will it chart",
  "Spotify playlist chance" — no ground truth exists; we never fake these.


## Languages (i18n)

7 languages, switchable from the header picker (choice persists in localStorage):
English, עברית (Hebrew, RTL), Español, Français, Deutsch, Português, Português (BR).

- UI strings: `web/index.html` `UI` table + `applyLang()`.
- Report text (verdict, findings, fixes, priority): `engine/i18n.py` templates, selected via the `lang` form field on `/api/analyze`.
- The **Suno prompt stays in English on purpose** — Suno responds best to English prompts.
- Hebrew triggers full RTL layout (`dir="rtl"`).


## AI-written reports (optional, off by default)

The engine's numbers are deterministic; the narrative can be written per-song by Claude:

```bash
export ANTHROPIC_API_KEY=sk-ant-...   # console.anthropic.com
export ANR_USE_LLM=1                  # explicit opt-in — this costs money (~$0.05/report on Opus)
# optional: ANR_MODEL=claude-sonnet-5  (~$0.02/report)
```

- Claude writes verdict/priority/headlines/quote/Suno prompt, grounded ONLY in the measurements.
- Scores, severities, measures, and fixes stay deterministic (engine-computed).
- Any error falls back silently to template text. Reports carry `source: "llm" | "template"`.

## Tests

```bash
.venv/bin/pytest tests/ -v     # 17 tests: accuracy vs ground truth, robustness, i18n, LLM merge/fallback
```

Real mobile-viewport check (Chrome CDP device emulation):
```bash
node tools/mobile_test.mjs "http://127.0.0.1:8000/?demo=1" /tmp/mobile.png
```

## Accuracy notes
- True peak: ITU-R BS.1770 4x oversampling (inter-sample peaks), clip threshold -0.3 dBTP.
- Key: full Krumhansl-Schmuckler 24-profile correlation, with confidence score.
- Intro: smoothed RMS + 2s sustain requirement (robust to FX one-shots).
- LRA (loudness range) + 96-point energy curve + peak moment also measured.
- 7 genre norm sets; user picks genre via chips (persisted).

## Next steps
- Calibrate AI-tell thresholds + genre norms against real tracks.
- Phase 2: trained AI-detection model (the core differentiator vs ratemysong.ai).
- Accounts / history, deploy: domain + git + host (planned).
