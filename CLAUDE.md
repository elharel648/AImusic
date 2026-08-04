# A&R AI — Working Rules

Read `PRODUCT_BIBLE.md` first. It is the constitution; these are the bylaws.

## The one sentence
**Every number is measured. Never invented.** If it can't be measured honestly, it is not displayed — no fake scores, no hit probability, no invented confidence.

## Product laws (from the Bible — enforced in code review)
1. **Producer speaks before engineer** — prose verdict/insight first, measured evidence second, in every component. Never lead with a chart or a raw number.
2. **Understanding before information** — new report sections default to "full studio" (pro) mode only; the basic mode tells one story: verdict → weakness → hear → fix → regenerate.
3. **Measured vs. judgment are labeled** — measured values carry the "✓ measured" tag; 0-100 scores/thresholds/recipes carry "producer's read". Never let judgment wear a measurement's badge.

## Engineering conventions
- **Single-file frontend**: `web/index.html` (CSS + JS inline). Engine: `engine/*.py` (FastAPI, `../.venv/bin/uvicorn server:app --reload --port 8000` from `engine/`).
- **i18n**: every user-facing string exists in ALL 6 languages (en/he/es/fr/de/pt) in the `UI` object. Anchored python replaces with `assert count==1` are the safe way to edit the giant lang lines.
- **Timeline direction**: media timelines are always LTR, even in Hebrew (Material Design bidi; Hebrew is called out explicitly). Chrome/labels stay RTL. Time strings get `dir="ltr"`.
- **Motion**: transform/opacity only; UI moves <300ms; ease-out (`--ease: cubic-bezier(.2,0,0,1)`); hover effects gated to `(hover:hover) and (pointer:fine)`; playhead motion is information — keep it under `prefers-reduced-motion`, kill decoration instead.
- **`hidden` attribute vs CSS**: any class that sets `display` must also ship `.cls[hidden]{display:none}`.
- **Verify in a real browser** before claiming done: Playwright is in `.venv` (pattern: upload a synthesized WAV via `set_input_files("#file", ...)`, wait for `#s-report.active`, screenshot + read it). JS syntax check: extract the `<script>` and `node --check`.
- **Chapters/markers on the timeline come only from measured anchors** (intro_sec, peak_moment_sec, finding spans). Never invent a "drop" or a section the engine didn't measure.

## Commit style
Batch feature commits on `main`, short imperative title + honest body. The user (Harel, Hebrew, casual) asks for commits explicitly ("תעלה לגיט") — production deploy (HF Spaces) is separately gated and never automatic.
