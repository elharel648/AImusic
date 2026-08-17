# A&R AI — container image. Built for the Hugging Face Spaces free CPU tier
# (uid-1000 user, app_port 7860) but runs on any Docker host:
#   docker build -t anr-ai . && docker run -p 7860:7860 anr-ai

# ── stage 1: the React frontend (web-react → dist, served by FastAPI at /rack)
FROM node:22-slim AS frontend
WORKDIR /build
COPY web-react/package.json web-react/package-lock.json ./
RUN npm ci
COPY web-react/ ./
RUN npm run build

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
 && pip install --no-cache-dir --user -r requirements.txt

COPY --chown=user . .
# the built frontend replaces whatever the repo checkout had (dist is gitignored)
COPY --chown=user --from=frontend /build/dist ./web-react/dist

# audio-separator: --no-deps (its samplerate==0.1.0 pin ships an x86-only
# dylib; real deps live in requirements.txt) + bake the Voc_FT model (~66 MB)
RUN pip install --no-cache-dir --user --no-deps audio-separator==0.18.0 \
 && python -c "import os; os.makedirs(os.path.expanduser('~/.cache/anr_models/sep'), exist_ok=True); \
from audio_separator.separator import Separator; \
s=Separator(model_file_dir=os.path.expanduser('~/.cache/anr_models/sep'), log_level=40); \
s.load_model('UVR-MDX-NET-Voc_FT.onnx')"
# bake the license-clean ML weights: MS-CLAP 2023 (MIT, ~450 MB via HF) and
# PANNs CNN14 (CC-BY, ~310 MB; its downloader shells out to wget — pre-fetch)
RUN python -c "import os,urllib.request; from msclap import CLAP; CLAP(version='2023', use_cuda=False); \
d=os.path.expanduser('~/panns_data'); os.makedirs(d, exist_ok=True); \
urllib.request.urlretrieve('http://storage.googleapis.com/us_audioset/youtube_corpus/v1/csv/class_labels_indices.csv', d+'/class_labels_indices.csv'); \
urllib.request.urlretrieve('https://zenodo.org/record/3987831/files/Cnn14_mAP%3D0.431.pth?download=1', d+'/Cnn14_mAP=0.431.pth')"
# bake the Beat This! checkpoint (~77 MB, MIT; code vendored in engine/vendor)
RUN python -c "import sys; sys.path.insert(0,'engine/vendor'); \
from beat_this.inference import Audio2Beats; Audio2Beats(checkpoint_path='final0', device='cpu')"

EXPOSE 7860
WORKDIR /home/user/app/engine
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "7860", "--no-access-log"]
