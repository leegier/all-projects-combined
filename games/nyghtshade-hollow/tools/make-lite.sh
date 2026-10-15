#!/usr/bin/env bash
# 854x480 preview of the playtest video (chapter markers kept) — small enough to open anywhere / commit.
#   bash tools/make-lite.sh media/nyghtshade-hollow-playtest.mp4 media/nyghtshade-hollow-playtest-lite.mp4
set -euo pipefail
IN=${1:?usage: make-lite.sh IN.mp4 OUT.mp4}; OUT=${2:?usage: make-lite.sh IN.mp4 OUT.mp4}
# light spatial/temporal denoise first: film grain is the most expensive thing to encode at low bitrates
ffmpeg -y -loglevel error -i "$IN" -map 0:v:0 -map 0:a:0 -map_chapters 0 \
  -vf "scale=854:480:flags=lanczos,hqdn3d=2:2:6:6,format=yuv420p" \
  -c:v libx264 -preset slow -crf 30 -maxrate 1400k -bufsize 2800k -profile:v main -g 60 \
  -c:a aac -b:a 96k -ac 2 -movflags +faststart "$OUT"
ls -la "$OUT"
