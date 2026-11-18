#!/usr/bin/env python3
"""
transcribe.py — Whisper voice memo transcriber for MAX
Usage: python transcribe.py <audio_file>
Outputs: plain text transcript to stdout
"""

import sys
import os
import whisper

def transcribe(audio_path: str, model_size: str = "base") -> str:
    if not os.path.exists(audio_path):
        print(f"ERROR: File not found: {audio_path}", file=sys.stderr)
        sys.exit(1)

    print(f"Loading Whisper model ({model_size})...", file=sys.stderr)
    model = whisper.load_model(model_size)

    print(f"Transcribing: {audio_path}", file=sys.stderr)
    result = model.transcribe(audio_path)

    return result["text"].strip()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python transcribe.py <audio_file> [model_size]")
        print("Model sizes: tiny, base, small, medium, large")
        print("Default: base (best balance of speed/accuracy)")
        sys.exit(1)

    audio_file = sys.argv[1]
    model = sys.argv[2] if len(sys.argv) > 2 else "base"

    transcript = transcribe(audio_file, model)
    print(transcript)
