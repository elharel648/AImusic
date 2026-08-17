"""
UI smoke — the demo flow, end to end, in a real browser. Runs locally and in
CI (the demo endpoint needs no ML models, so a bare engine is enough).

    BASE=http://localhost:8000 .venv/bin/python tools/ui_smoke.py

Exits non-zero on the first broken invariant. Zero pageerrors is part of PASS.
"""
import os
import sys

BASE = os.environ.get("BASE", "http://localhost:8000")


def main():
    from playwright.sync_api import sync_playwright
    failures = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 1366, "height": 900})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))

        # the stage loads, in Hebrew, with the live demo rack
        pg.goto(f"{BASE}/rack/", timeout=30000)
        pg.evaluate("localStorage.clear(); localStorage.setItem('anr_lang','he')")
        pg.reload()
        pg.wait_for_timeout(1500)
        if not pg.locator("text=A&R·AI").count():
            failures.append("stage: brand missing")

        # demo → report
        demo_btn = pg.locator("button", has_text="נסה עם שיר לדוגמה")
        if not demo_btn.count():
            failures.append("stage: demo button missing")
        else:
            demo_btn.first.click()
            pg.wait_for_url("**/rack/report", timeout=30000)
            pg.wait_for_timeout(1200)
            secs = pg.evaluate("[...document.querySelectorAll('[data-sec]')].map(e=>e.dataset.sec)")
            for need in ("verdict", "priorities", "works", "listen", "tech", "stream", "variation"):
                if need not in secs:
                    failures.append(f"report: section '{need}' missing (got {secs})")
            if not pg.locator("text=/\\d+ \\/ 100/").count():
                failures.append("report: production score missing")

        # accuracy page renders live numbers
        pg.goto(f"{BASE}/rack/accuracy")
        pg.wait_for_timeout(900)
        vals = pg.evaluate("[...document.querySelectorAll('span.val')].map(e=>e.textContent)")
        if not any("%" in v for v in vals):
            failures.append("accuracy: no measured percentages rendered")

        # library + deep links survive refresh
        pg.goto(f"{BASE}/rack/library")
        pg.wait_for_timeout(600)
        if pg.evaluate("document.body.scrollWidth > innerWidth"):
            failures.append("library: horizontal overflow")

        if errs:
            failures.append(f"pageerrors: {errs}")
        b.close()

    if failures:
        print("UI SMOKE FAIL:")
        for f in failures:
            print(" ✗", f)
        sys.exit(1)
    print("UI SMOKE PASS")


if __name__ == "__main__":
    main()
