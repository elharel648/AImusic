#!/bin/sh
# A&R AI production launcher — no --reload, configurable workers/port.
# Default bind is loopback (matches the DEPLOY.md nginx/systemd setup);
# set HOST=0.0.0.0 only when the app is meant to be directly exposed.
# Usage: ./run_prod.sh   (env: PORT=8000 WORKERS=1 HOST=127.0.0.1)
set -e
cd "$(dirname "$0")/engine"
exec ../.venv/bin/uvicorn server:app \
  --host "${HOST:-127.0.0.1}" \
  --port "${PORT:-8000}" \
  --workers "${WORKERS:-1}" \
  --no-access-log
