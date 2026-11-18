#!/usr/bin/env bash
# Assemble the 10-minute cut: title -> 5 min gameplay + testing (from the bot playtest recording) -> title -> dialogue movie -> end card.
# usage: assemble-trailer.sh SHOTS_DIR DRAMA.wav TIMELINE.json PLAYTEST.mp4 OUT.mp4
set -euo pipefail
SHOTS=$1 DRAMA=$2 TL=$3 PLAY=$4 OUT=$5
W=$(mktemp -d); F=/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf; FS=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf
V="-c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -r 24"; A="-c:a aac -b:a 160k -ar 48000 -ac 2"
card() { # name seconds title subtitle
  ffmpeg -v error -y -f lavfi -i color=black:s=1280x720:r=24:d=$2 -f lavfi -i anullsrc=r=48000:cl=stereo -t $2 \
    -vf "drawtext=fontfile=$F:text='$3':fontcolor=0xd8d0c0:fontsize=58:x=(w-tw)/2:y=h/2-60:alpha='min(1,t/1.2)*min(1,($2-t)/1.0)',drawtext=fontfile=$FS:text='$4':fontcolor=0x9a2020:fontsize=26:x=(w-tw)/2:y=h/2+30:alpha='min(1,t/1.2)*min(1,($2-t)/1.0)'" \
    $V $A "$W/$1.mp4"; }
card 00 7 'NYGHTSHADE HOLLOW' 'PART ONE  -  GAMEPLAY AND LIVE TESTING'
i=0; for r in "4 209" "437 41" "236 37" "478 10"; do set -- $r; i=$((i+1))
  ffmpeg -v error -y -ss $1 -t $2 -i "$PLAY" -vf "scale=1280:720:flags=lanczos,fade=in:st=0:d=0.4,fade=out:st=$(($2-1)).5:d=0.5" -af "afade=in:d=0.4,afade=out:st=$(($2-1)).4:d=0.6" $V $A "$W/g$i.mp4"; done
card 05 7 'FOUR HOURS' 'PART TWO  -  THE DIALOGUE MOVIE'
# dialogue picture: shots in order, letterboxed 1280x536 -> 1280x720, burned subtitles, mixed drama audio
ls "$SHOTS"/S*.mp4 | sort | sed "s/^/file '/;s/$/'/" > "$W/list.txt"
python3 - "$TL" "$W/subs.ass" <<'PY'
import json,sys
tl=json.load(open(sys.argv[1])); o=open(sys.argv[2],'w')
o.write("[Script Info]\nPlayResX: 1280\nPlayResY: 720\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Italic, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV\nStyle: D,DejaVu Sans,30,&H00E8E8E8,&H00000000,&H80000000,0,0,1,2,0,2,80,80,30\n\n[Events]\nFormat: Layer, Start, End, Style, Text\n")
f=lambda t:"%d:%02d:%05.2f"%(t//3600,t%3600//60,t%60)
for x in tl:
    if 'speaker' in x: o.write(f"Dialogue: 0,{f(x['start'])},{f(x['end']+0.3)},D,{{\\c&H6060C0&}}{x['speaker'].title()}{{\\c&HE8E8E8&}}  {x['text']}\n")
PY
ffmpeg -v error -y -f concat -safe 0 -i "$W/list.txt" -i "$DRAMA" -map 0:v -map 1:a -vf "pad=1280:720:0:92:black,ass=$W/subs.ass" -shortest $V $A "$W/m.mp4"
card 99 8 'NYGHTSHADE HOLLOW' 'IN DEVELOPMENT'
ls "$W"/00.mp4 "$W"/g*.mp4 "$W"/05.mp4 "$W"/m.mp4 "$W"/99.mp4 | sed "s/^/file '/;s/$/'/" > "$W/all.txt"
ffmpeg -v error -y -f concat -safe 0 -i "$W/all.txt" -c copy -movflags +faststart "$OUT"
rm -rf "$W"; ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT"
