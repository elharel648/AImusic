# A&R AI — production deployment

The app is one FastAPI process serving both the API and the frontend
(`web/index.html`). Analysis is CPU-bound (~13s per track, ~60s with deep
vocal mode); the endpoint runs it off the event loop, so the page stays
responsive while tracks are being analyzed.

## Requirements

- Linux VPS (or macOS), **4+ GB RAM** (Demucs + Essentia models), 2+ cores recommended
- Python 3.9+
- **ffmpeg** on PATH (decode/convert + the real-AAC codec check): `apt install ffmpeg`

## Setup

```bash
git clone <repo> anr-ai && cd anr-ai
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m pytest tests/ -q        # 22 tests must pass
```

First deep-mode analysis downloads Demucs weights (~80 MB). Prewarm so no
user pays that cost:

```bash
.venv/bin/python -c "from demucs.pretrained import get_model; get_model('htdemucs')"
```

## Environment variables

| var | default | meaning |
|---|---|---|
| `ANR_ALLOWED_ORIGINS` | unset = same-origin only | CORS fails **closed**: unset means no cross-origin access (the app serves its own frontend, so nothing is needed). Set only if another site must call the API. |
| `ANR_RATE_MAX` | `20` | analyses allowed per IP per window |
| `ANR_RATE_WINDOW_SEC` | `900` | rate-limit window (seconds) |
| `ANR_USE_LLM` | off | `1` enables the Claude-written narrative |
| `ANTHROPIC_API_KEY` | — | required when `ANR_USE_LLM=1`; set a spend limit in the Anthropic console |

## Run

```bash
./run_prod.sh          # uvicorn, no --reload, port 8000
```

One worker is right for small boxes: concurrency comes from the thread pool,
and heavy DSP releases the GIL. On 8+ cores you can try `WORKERS=2` (each
worker loads its own ML models — budget ~2 GB RAM per worker).

Health probe for your host / uptime monitor: `GET /api/health`
→ `{"ok":true,"ml":true,"stems":true,"llm":false}` — alert if `ok` is not
true or `ml`/`stems` flip to false after a deploy. `llm` is true only when
`ANR_USE_LLM=1` **and** a credential actually resolves — a missing/expired
key shows here instead of silently degrading every report to template text.

## systemd unit

```ini
# /etc/systemd/system/anr.service
[Unit]
Description=A&R AI
After=network.target

[Service]
User=anr
WorkingDirectory=/home/anr/anr-ai/engine
Environment=ANR_ALLOWED_ORIGINS=https://yourdomain.com
ExecStart=/home/anr/anr-ai/.venv/bin/uvicorn server:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

## nginx in front (TLS + upload size)

```nginx
server {
    server_name yourdomain.com;
    client_max_body_size 100M;          # matches the app's own limit
    proxy_read_timeout 180s;            # deep mode can take ~60s

    location / {
        proxy_pass http://127.0.0.1:8000;
        # $remote_addr, NOT $proxy_add_x_forwarded_for: append mode keeps the
        # client's own (spoofable) value in the header, which would let anyone
        # bypass the per-IP rate limit with a rotating X-Forwarded-For.
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;   # og:image/canonical URLs
        proxy_set_header Host $host;
    }
}
```

Then `certbot --nginx -d yourdomain.com` for HTTPS.

## Notes

- Audio is analyzed in temp files and deleted immediately — nothing is stored
  (this is a published product promise; keep it true).
- The social share card is `web/og.png`; regenerate after a rebrand with
  `node tools/make_og.mjs <card.html> web/og.png`. `og:url`/`og:image`/canonical
  URLs are filled per-request from the Host header — no domain is baked in.
- `server.log` is dev-only noise and gitignored; in production journald
  (`journalctl -u anr`) is the log.
- The norms/accuracy data lives in `engine/norms_data.json`; refresh it
  monthly with `JAMENDO_CLIENT_ID=… tools/ingest_jamendo_api.py` if you want
  the "updated <date>" provenance to stay fresh.
