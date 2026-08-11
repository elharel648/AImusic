---
name: run-app
description: Launch the A&R AI dev server and drive it in a real browser — upload a WAV, wait for the report, screenshot and assert. Use before claiming ANY frontend change works.
---

# Run & drive the app

## Server
```bash
lsof -ti:8000 -sTCP:LISTEN | xargs -r kill
cd engine && ../.venv/bin/uvicorn server:app --reload --port 8000   # background
# poll until: curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/ == 200
```
`--reload` watches Python only; index.html is served fresh per request (hard-refresh the browser).

## Drive (proven pattern — Playwright is in .venv, chromium installed)
```python
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch()
    pg=b.new_page(viewport={"width":1440,"height":1000}, color_scheme="dark")
    errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.add_init_script("localStorage.setItem('anr_lang','he'); localStorage.setItem('anr_rmode','basic'); localStorage.setItem('anr_gt_seen','1');")
    pg.goto("http://localhost:8000")
    pg.set_input_files("#file", "test.wav")          # or pg.click("#demoBtn") — no audio path
    pg.wait_for_selector("#s-report.active", timeout=120000)
    # ... evaluate/screenshot ... ALWAYS print errs at the end — must be empty
```
Mobile: `ctx=b.new_context(**p.devices['iPhone 13'])`. Check `document.body.scrollWidth <= innerWidth`.

## Synthesize test audio (soundfile + numpy in .venv)
Clipped master / C-major house / phase-inverted pad recipes live in git history
(commit 19718ea era, scratchpad scripts) — 45-50s, 44.1k stereo, deterministic.

## Rules
- JS syntax gate before any browser run: extract `<script>` → `node --check`.
- Screenshots → scratchpad dir, NEVER the repo root (they've leaked before).
- Zero `pageerror`s is part of "works".
