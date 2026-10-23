#!/usr/bin/env bash
# One command to publish new ratings: rebuild data JSON from ../runs/*.json and push to GitHub Pages.
# Usage: ./publish.sh ["commit message"]
set -euo pipefail
cd "$(dirname "$0")"
python3 build_data.py
git add -A
if git diff --cached --quiet; then echo "Nothing changed; site already up to date."; exit 0; fi
git commit -q -m "${1:-Update Savor data $(date '+%Y-%m-%d %H:%M %Z')}"
git push -q origin main
echo "Pushed. GitHub Pages redeploys in about a minute: https://jcredibletech.github.io/savor/"
