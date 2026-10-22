#!/usr/bin/env bash
# Encode the frames written by tools/crowd-reel.mjs:  bash tools/make-reel.sh FRAMES_DIR OUT.mp4 [fps=15]   (silent, 1280x720, 30 fps, fades in/out)
set -euo pipefail
DIR=${1:?usage: make-reel.sh FRAMES_DIR OUT.mp4 [fps]}; OUT=${2:?usage: make-reel.sh FRAMES_DIR OUT.mp4 [fps]}; FPS=${3:-15}
N=$(ls "$DIR"/frame_*.png | wc -l); DUR=$(python3 -c "print($N/$FPS)")
ffmpeg -y -loglevel error -framerate "$FPS" -i "$DIR/frame_%05d.png" \
  -vf "fps=30,fade=t=in:st=0:d=0.6,fade=t=out:st=$(python3 -c "print(max(0,$DUR-0.8))"):d=0.8,format=yuv420p" \
  -c:v libx264 -preset slow -crf 24 -profile:v high -movflags +faststart "$OUT"
ls -la "$OUT"
