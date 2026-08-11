---
name: deploy-prod
description: Production deployment steps for A&R AI. GATED — never run without Harel explicitly saying deploy in this conversation. Read DEPLOY.md first.
---

# Production deploy (GATED)

**Rule zero: deploy only on an explicit instruction from Harel in the current
conversation.** "Fix everything" does not include deploy.

1. Read `DEPLOY.md` (repo root) — it is the authority: FastAPI single process,
   4+ GB RAM (Demucs+Essentia), ffmpeg required, env vars table
   (ANR_ALLOWED_ORIGINS closed by default, ANR_USE_LLM, rate limits).
2. Preflight: `.venv/bin/python -m pytest tests/ -q` green, `git status` clean,
   `main` pushed.
3. Prewarm Demucs weights so no user pays the download:
   `.venv/bin/python -c "from demucs.pretrained import get_model; get_model('htdemucs')"`
4. Target is a Hugging Face Space (Dockerfile in repo root). Push per DEPLOY.md.
5. Verify: `GET /api/health` 200, then one real analysis end-to-end, then
   `GET /api/stats` counting.
6. Report exactly what was deployed (commit hash) and the verification results.

Known debt to disclose if asked: ML model licensing (ENGINE_AUDIT.md P2) —
Essentia/Demucs weights are not commercially clean; swap plan exists.
