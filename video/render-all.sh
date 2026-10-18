#!/usr/bin/env bash
# Render the promo cuts and every feature demo into out/ (pass --browser-executable=… if needed).
set -euo pipefail
cd "$(dirname "$0")"
npm run -s clips
for id in Reel Promo30 Teaser15 feature-queue feature-table feature-assistant feature-host feature-kitchen-pos feature-owner feature-languages feature-agents; do
  npx remotion render "$id" "out/$id.mp4" --codec h264 --crf 23 --log=error "$@"
done
