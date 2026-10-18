#!/usr/bin/env bash
# Copy the persona recordings into public/clips, re-encoded with a keyframe every
# half second so Remotion can seek them cheaply, plus small copies for montage walls.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p public/clips/small
for f in ../docs/evidence/videos/*.mp4; do
  n=$(basename "$f")
  [ public/clips/$n -nt "$f" ] || ffmpeg -loglevel error -y -i "$f" -c:v libx264 -preset veryfast -crf 20 -g 15 -pix_fmt yuv420p -an "public/clips/$n"
  [ public/clips/small/$n -nt "$f" ] || ffmpeg -loglevel error -y -i "$f" -vf "scale='min(480,iw)':-2" -c:v libx264 -preset veryfast -crf 26 -g 10 -pix_fmt yuv420p -an "public/clips/small/$n"
done
