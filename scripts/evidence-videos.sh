#!/usr/bin/env bash
# Convert the persona videos recorded by `pnpm test:evidence` (test-results/**/video-<name>/*.webm)
# into H.264 MP4s at docs/evidence/videos/<name>.mp4.
set -euo pipefail
cd "$(dirname "$0")/.."
FFMPEG=${FFMPEG:-ffmpeg}
OUT=docs/evidence/videos
mkdir -p "$OUT"
found=0
while IFS= read -r dir; do
  name=$(basename "$dir"); name=${name#video-}
  webm=$(ls -t "$dir"/*.webm 2>/dev/null | head -1 || true)
  [ -n "$webm" ] || continue
  found=1
  # even dimensions for yuv420p; cap height at 1280 so phone videos stay small
  "$FFMPEG" -nostdin -y -loglevel error -i "$webm" -vf "scale='trunc(min(iw,iw*1280/ih)/2)*2':'trunc(min(ih,1280)/2)*2'" \
    -c:v libx264 -crf 28 -preset veryfast -pix_fmt yuv420p -movflags +faststart -an "$OUT/$name.mp4"
  echo "$OUT/$name.mp4"
done < <(find test-results -type d -name 'video-*' | sort)
[ "$found" = 1 ] || { echo "no recorded videos under test-results/ (run pnpm test:evidence first)" >&2; exit 1; }
