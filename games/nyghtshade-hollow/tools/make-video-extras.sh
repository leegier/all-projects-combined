#!/usr/bin/env bash
# Alternate-route clips for the playtest video: the keycard and bribe ways into Records (the golden path shows the shim).
#   NH_PORT=8400 NH_GL=llvmpipe xvfb-run -a -s "-screen 0 1400x900x24" bash tools/make-video-extras.sh OUTDIR [WORKERS]
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=${1:?usage: make-video-extras.sh OUTDIR [WORKERS]}; W=${2:-2}
CAP="node tools/capture.mjs"
G=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$OUT/shim/audio/gain.json','utf8')).gainDb)")
clip() { # route from to audio-seconds piece-name interlude
  local r=$1 a=$2 b=$3 as=$4 name=$5 inter=$6
  mkdir -p "$OUT/$r"
  [ -f "$OUT/$r/plan.json" ] || $CAP --out "$OUT/$r" --route "$r" --stage plan
  $CAP --out "$OUT/$r" --route "$r" --stage audio --audio-s "$as"
  $CAP --out "$OUT/$r" --route "$r" --stage frames --workers "$W" --from "$a" --to "$b" --resume
  $CAP --out "$OUT/$r" --route "$r" --stage cards --parts interlude --interlude "$inter"
  $CAP --out "$OUT/$r" --route "$r" --stage encode --parts interlude,frames --name "$name" --gain-db "$G" --interlude "$inter"
}
clip keycard 178.5 199 205 K.mp4 "ALTERNATE ROUTE · KEYCARD|Buy the keycard from Cutter (60 DC), swipe the reader"
clip bribe   186   206 212 R.mp4 "ALTERNATE ROUTE · BRIBE|Pay Pruitt 40 DC to look the other way"
