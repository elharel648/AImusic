# A&R AI — container image. Built for the Hugging Face Spaces free CPU tier
# (uid-1000 user, app_port 7860) but runs on any Docker host:
#   docker build -t anr-ai . && docker run -p 7860:7860 anr-ai
FROM python:3.9-slim

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# HF Spaces runs the container as uid 1000 with no root fallback
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

WORKDIR /home/user/app

COPY --chown=user requirements.txt ./
# CPU-only torch first: the default PyPI wheel drags in ~5 GB of CUDA libs
RUN pip install --no-cache-dir --user torch==2.8.0 torchaudio==2.8.0 \
      --index-url https://download.pytorch.org/whl/cpu \
 && grep -v essentia requirements.txt > /tmp/req.txt \
 && pip install --no-cache-dir --user -r /tmp/req.txt
# essentia ships wheels for a narrow platform set; the engine degrades
# gracefully without it (ml_available() gate), so don't fail the build
RUN pip install --no-cache-dir --user essentia-tensorflow==2.1b6.dev1389 \
 || echo "WARNING: essentia-tensorflow unavailable - ML tagging disabled"

COPY --chown=user . .

# bake the Demucs weights (~80 MB) into the image so no user pays the
# first-analysis download cost
RUN python -c "from demucs.pretrained import get_model; get_model('htdemucs')"

EXPOSE 7860
WORKDIR /home/user/app/engine
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "7860", "--no-access-log"]
