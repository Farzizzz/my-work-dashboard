#!/usr/bin/env bash
# Author: Farz Owasil (my-work-dashboard template)
# deploy.sh - push the code and publish the private web app. The FIRST run creates one deployment
# and saves its id in .deployment-id; every later run updates THAT deployment, so the URL never
# changes. Never use `clasp deploy` / Deploy ▸ New deployment yourself - that makes a new URL.
# Usage: ./deploy.sh "what changed"
set -euo pipefail
cd "$(dirname "$0")"
DESC="${1:-update $(date '+%Y-%m-%d %H:%M')}"
clasp push --force
if [ -s .deployment-id ]; then
  ID="$(tr -d '[:space:]' < .deployment-id)"
  clasp update-deployment "$ID" --description "$DESC"
else
  OUT="$(clasp create-deployment --description "$DESC")"
  echo "$OUT"
  ID="$(printf '%s' "$OUT" | grep -oE 'AKfyc[A-Za-z0-9_-]+' | head -1)"
  [ -n "$ID" ] || { echo "Could not read the deployment id from clasp output above." >&2; exit 1; }
  printf '%s\n' "$ID" > .deployment-id
fi
URL="https://script.google.com/macros/s/${ID}/exec"
printf '%s\n' "$URL" > .web-url
echo "Live (private to you): $URL"
