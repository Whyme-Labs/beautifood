#!/usr/bin/env bash
# Render every video in every language into out/<lang>/ (pass --browser-executable=… if needed).
# Needs public/reel-clips/<lang> (REEL_LANG=<lang> node e2e/evidence/reel-clips.mjs) and public/audio/bgm.m4a.
set -euo pipefail
cd "$(dirname "$0")"
npm run -s clips
for lang in en zh; do
  mkdir -p "out/$lang"
  for id in Reel Promo30 Teaser15 feature-queue feature-table feature-assistant feature-host feature-kitchen-pos feature-owner feature-languages feature-agents; do
    npx remotion render "$id-$lang" "out/$lang/$id.mp4" --codec h264 --crf 22 --log=error "$@"
    echo "done $id-$lang"
  done
done
