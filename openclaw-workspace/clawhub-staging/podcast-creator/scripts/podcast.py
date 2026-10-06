#!/usr/bin/env python3
"""podcast.py — Podcast episode planner, scripter, and audio generator."""
import argparse, json, os, re, subprocess, sys
from datetime import datetime, timezone
from pathlib import Path

def cmd_outline(args):
    out = Path(args.output or "output/podcast/outline.md")
    out.parent.mkdir(parents=True, exist_ok=True)
    dur = args.duration or 15
    fmt = args.format or "solo"
    n_points = max(3, dur // 3)

    content = f"""# Podcast Episode Outline

**Topic:** {args.topic}
**Format:** {fmt}
**Target Duration:** {dur} minutes
**Created:** {datetime.now(timezone.utc).strftime('%Y-%m-%d')}

---

## Hook (0:00 – 1:00)
[Opening — grab attention. Problem, story, or surprising fact.]

## Intro (1:00 – 2:00)
[Who you are, what this episode is about, what they'll learn]

## Main Content
"""
    for i in range(1, n_points + 1):
        minutes = 2 + (i-1) * (dur - 4) // n_points
        content += f"\n### Point {i} ({minutes}:00 – {minutes + (dur-4)//n_points}:00)\n"
        content += "[KEY POINT — specific insight, story, or lesson]\n"
        content += "- Sub-point or example\n- Sub-point or example\n"

    content += f"""
## Takeaway ({dur-3}:00 – {dur-1}:00)
[Single most important lesson from this episode]

## Call to Action ({dur-1}:00 – {dur}:00)
[What should listener do next? Download the game / subscribe / share / try X]

---

## Notes for Script
- Keep sentences short — they need to sound natural when spoken
- Read it aloud while writing
- Target word count: {dur * 130} words (~{dur} min at 130 wpm)
"""
    out.write_text(content, encoding="utf-8")
    print(f"[OK] Outline saved: {out}")

def cmd_script(args):
    outline_path = Path(args.outline) if args.outline else None
    outline_text = outline_path.read_text() if outline_path and outline_path.exists() else "[No outline provided]"
    host = args.host or "Host"
    out = Path(args.output or "output/podcast/script.md")
    out.parent.mkdir(parents=True, exist_ok=True)

    content = f"""# Episode Script

**Host:** {host}
**Created:** {datetime.now(timezone.utc).strftime('%Y-%m-%d')}

---

## OUTLINE REFERENCE

{outline_text}

---

## FULL SCRIPT

[Write the full spoken script here. Each paragraph = one breath / idea.]

[HOOK]
Hey, welcome back. Today I want to talk about...

[INTRO]
If you're new here — I'm {host}, and this show is about...

[MAIN CONTENT — follow your outline]

[POINT 1]
So let's start with...

[POINT 2]
The second thing I want to cover is...

[TAKEAWAY]
If you take nothing else from this episode, take this:...

[CTA]
If you enjoyed this, [subscribe / leave a review / check out the game at itch.io].
Thanks for listening. See you next time.

---
*Word count target: [calculate from outline duration × 130 wpm]*
"""
    out.write_text(content, encoding="utf-8")
    print(f"[OK] Script scaffold saved: {out}")

def cmd_show_notes(args):
    script_path = Path(args.script) if args.script else None
    title = args.title or "Episode Title"
    out   = Path(args.output or "output/podcast/show-notes.md")
    out.parent.mkdir(parents=True, exist_ok=True)

    content = f"""# {title}

**Summary:** [One-sentence description of the episode]

## Key Points

- [Point 1] (00:30)
- [Point 2] (03:00)
- [Point 3] (06:00)
- [Takeaway] (12:00)

## Links Mentioned

- [Link name](URL)

## About This Show

[Brief show description — 1-2 sentences]

---
*Episode published: {datetime.now(timezone.utc).strftime('%Y-%m-%d')}*
"""
    out.write_text(content, encoding="utf-8")
    print(f"[OK] Show notes template: {out}")

def cmd_to_audio(args):
    script_path = Path(args.script)
    if not script_path.exists():
        print(f"Script not found: {args.script}"); sys.exit(1)

    api_key  = os.environ.get("ELEVENLABS_API_KEY","")
    voice_id = os.environ.get("ELEVENLABS_VOICE_ID","pNInz6obpgDQGcFmaJgB")

    if not api_key:
        print("ERROR: ELEVENLABS_API_KEY env var required.")
        print("Alternatively, use the `sag` skill which handles TTS natively.")
        sys.exit(1)

    # Read script, strip markdown
    text = script_path.read_text(encoding="utf-8")
    text = re.sub(r'^#+\s.*$', '', text, flags=re.MULTILINE)
    text = re.sub(r'\[.*?\]', '', text)
    text = re.sub(r'\*+', '', text)
    text = re.sub(r'\n{3,}', '\n\n', text).strip()

    if len(text) > 5000:
        print(f"WARNING: Script is {len(text)} chars. ElevenLabs has a ~5000 char limit per request.")
        print("Consider splitting into segments.")

    import json as _json
    try:
        import urllib.request as _req
        body = _json.dumps({"text": text[:5000], "model_id": "eleven_multilingual_v2",
                            "voice_settings": {"stability": 0.55, "similarity_boost": 0.85}}).encode()
        request = _req.Request(
            f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
            data=body,
            headers={"xi-api-key": api_key, "Content-Type": "application/json", "Accept": "audio/mpeg"})
        with _req.urlopen(request) as r:
            audio = r.read()
        out = Path(args.output or "output/podcast/episode.mp3")
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(audio)
        print(f"[OK] Audio saved: {out} ({len(audio)/1024:.0f} KB)")
    except Exception as e:
        print(f"TTS error: {e}")

def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="command")
    ol = sub.add_parser("outline"); ol.add_argument("--topic",required=True); ol.add_argument("--format",default="solo"); ol.add_argument("--duration",type=int,default=15); ol.add_argument("--output")
    sc = sub.add_parser("script"); sc.add_argument("--outline"); sc.add_argument("--host"); sc.add_argument("--output")
    sn = sub.add_parser("show-notes"); sn.add_argument("--script"); sn.add_argument("--title"); sn.add_argument("--output")
    au = sub.add_parser("to-audio"); au.add_argument("--script",required=True); au.add_argument("--output")
    args = p.parse_args()
    {"outline":cmd_outline,"script":cmd_script,"show-notes":cmd_show_notes,"to-audio":cmd_to_audio}.get(args.command, lambda _:p.print_help())(args)

if __name__ == "__main__": main()
