#!/bin/sh
# Deploy A&R AI to a Hugging Face Space (Docker runtime, free CPU tier).
#
# One-time setup:
#   1. Free account: https://huggingface.co/join
#   2. WRITE token:  https://huggingface.co/settings/tokens
# Then, from anywhere in the repo:
#   HF_TOKEN=hf_xxx ./tools/deploy_hf.sh <hf-username> [space-name]
#
# Uploads the tracked files of HEAD via the HF API (no git history), so the
# 18 MB Essentia model is stored as LFS automatically — a plain `git push`
# to HF would reject any blob over 10 MB anywhere in history.
set -e
cd "$(dirname "$0")/.."

[ -n "$HF_TOKEN" ] || { echo "error: set HF_TOKEN (write token from huggingface.co/settings/tokens)" >&2; exit 1; }
[ -n "$1" ] || { echo "usage: HF_TOKEN=hf_xxx $0 <hf-username> [space-name]" >&2; exit 1; }
REPO_ID="$1/${2:-anr-ai}"

STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
git archive HEAD | tar -x -C "$STAGE"

# HF Spaces reads its runtime config from README frontmatter; prepend it
{
  printf -- '---\ntitle: A&R AI\nemoji: 🎧\ncolorFrom: purple\ncolorTo: blue\nsdk: docker\napp_port: 7860\npinned: false\n---\n\n'
  cat README.md
} > "$STAGE/README.md"

.venv/bin/pip install -q "huggingface_hub>=0.34"
REPO_ID="$REPO_ID" STAGE="$STAGE" .venv/bin/python - <<'EOF'
import os
from huggingface_hub import HfApi

repo_id = os.environ["REPO_ID"]
api = HfApi(token=os.environ["HF_TOKEN"])
api.create_repo(repo_id, repo_type="space", space_sdk="docker", exist_ok=True)
api.upload_folder(folder_path=os.environ["STAGE"], repo_id=repo_id,
                  repo_type="space", commit_message="deploy via tools/deploy_hf.sh")
subdomain = repo_id.replace("/", "-").replace("_", "-").replace(".", "-").lower()
print(f"\nSpace page: https://huggingface.co/spaces/{repo_id}")
print(f"Direct app: https://{subdomain}.hf.space  (live once the build finishes)")
EOF
