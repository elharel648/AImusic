---
name: run-app
description: Launch the A&R AI dev server and drive the React app in a real browser — upload a WAV, wait for the report, screenshot and assert. Use before claiming ANY frontend change works.
---

# Run & drive the app

## Build + server
```bash
cd web-react && npm run build          # FastAPI serves dist/ — rebuild after ANY frontend change
lsof -ti:8000 -sTCP:LISTEN | xargs -r kill
cd engine && ../.venv/bin/uvicorn server:app --reload --port 8000   # background
# poll until: curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/api/health == 200
```
The app lives at **/rack/** (`/` 308-redirects there). `--reload` watches Python only.

## Drive (proven pattern — Playwright is in .venv, chromium installed)
```python
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch()
    ctx=b.new_context(viewport={"width":1440,"height":1000}, permissions=['clipboard-write','clipboard-read'])
    pg=ctx.new_page()
    errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto("http://localhost:8000/rack/")
    pg.evaluate("localStorage.clear(); localStorage.setItem('anr_lang','he'); localStorage.setItem('anr_rmode','pro')")
    pg.reload()
    pg.set_input_files("input[type=file]", "test.wav")   # or click the demo button
    pg.wait_for_url("**/rack/report", timeout=120000)
    # ... assert sections via [data-sec=...] / screenshot ... ALWAYS print errs — must be empty
```
- i18n gotcha: selectors by text must use the REAL string values from
  `src/i18n/strings.js` / `rack.js` (e.g. mode_pro he = "האולפן המלא", wt_btn he = "תראה לי איך").
- Mobile: `ctx=b.new_context(**p.devices['iPhone 13'])`; assert `document.body.scrollWidth <= innerWidth`.
- Routes: `/rack/` analyze · `/rack/report` · `/rack/library` · `/rack/compare` · `/rack/batch`.
  Deep links survive refresh (SPA fallback). Share links: `/rack/report#r=…` restores read-only.

## Synthesize test audio (soundfile + numpy in .venv)
Clipped master / C-major house / phase-inverted pad recipes live in git history
(commit 19718ea era, scratchpad scripts) — 45-50s, 44.1k stereo, deterministic.

## Rules
- Screenshots → scratchpad dir, NEVER the repo root (they've leaked before).
- Zero `pageerror`s is part of "works".
- Genre chips / deep toggle state persist in localStorage (`anr_*`) — clear between test runs.
