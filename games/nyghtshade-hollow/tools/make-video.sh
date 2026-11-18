#!/usr/bin/env bash
# Records the whole playtest video: golden path (shim route) + failure-path interlude (camera alarm -> arrest) + report card.
#   NH_GL=llvmpipe xvfb-run -a -s "-screen 0 1400x900x24" bash tools/make-video.sh OUTDIR [WORKERS]
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=${1:?usage: make-video.sh OUTDIR [WORKERS]}; W=${2:-3}
mkdir -p "$OUT/shim" "$OUT/alarm"
CAP="node tools/capture.mjs"
echo "== plans"
$CAP --out "$OUT/shim"  --route shim  --stage plan
$CAP --out "$OUT/alarm" --route alarm --stage plan
echo "== soundtracks (offline render)"
$CAP --out "$OUT/alarm" --route alarm --stage audio --audio-s 232
$CAP --out "$OUT/shim"  --route shim  --stage audio
echo "== frames: golden path"
$CAP --out "$OUT/shim"  --route shim  --stage frames --workers "$W" --resume
echo "== frames: failure path"
$CAP --out "$OUT/alarm" --route alarm --stage frames --workers "$W" --from 186 --to 223 --resume
G=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$OUT/shim/audio/gain.json','utf8')).gainDb)")
echo "== cards + encode (soundtrack gain $G dB)"
$CAP --out "$OUT/shim"  --route shim  --stage cards --parts title,outro --also "$OUT/alarm/plan.json"
$CAP --out "$OUT/alarm" --route alarm --stage cards --parts interlude
$CAP --out "$OUT/shim"  --route shim  --stage encode --parts title,frames --name A.mp4 --gain-db $G
$CAP --out "$OUT/alarm" --route alarm --stage encode --parts interlude,frames --name B.mp4 --gain-db $G --interlude "FAILURE PATH|What happens when the camera sees you"
$CAP --out "$OUT/shim"  --route shim  --stage encode --parts outro --name C.mp4 --gain-db $G --also "$OUT/alarm/plan.json"
printf "file '%s'\nfile '%s'\nfile '%s'\n" "$OUT/shim/A.mp4" "$OUT/alarm/B.mp4" "$OUT/shim/C.mp4" > "$OUT/concat.txt"
node tools/chapters.mjs "$OUT/shim" "$OUT/alarm" "$OUT/chapters.ffmeta"
ffmpeg -y -f concat -safe 0 -i "$OUT/concat.txt" -i "$OUT/chapters.ffmeta" -map 0 -map_metadata 1 -map_chapters 1 -c copy -movflags +faststart "$OUT/nyghtshade-hollow-playtest.mp4"
ls -la "$OUT/nyghtshade-hollow-playtest.mp4"
