#!/usr/bin/env python3
"""
YouTube Transcript Fetcher for MAX
Usage: python yt-transcript.py <youtube_url_or_id>
Outputs: Full transcript text to stdout
"""

import sys
import re
from youtube_transcript_api import YouTubeTranscriptApi

def extract_video_id(url):
    patterns = [
        r'(?:v=|/v/|youtu\.be/|/embed/|/shorts/)([A-Za-z0-9_-]{11})',
        r'^([A-Za-z0-9_-]{11})$'
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None

def get_transcript(url):
    video_id = extract_video_id(url)
    if not video_id:
        print(f"ERROR: Could not extract video ID from: {url}")
        sys.exit(1)

    try:
        api = YouTubeTranscriptApi()
        transcript = api.fetch(video_id)
        full_text = ' '.join([entry.text for entry in transcript])
        print(full_text)
    except Exception as e:
        print(f"ERROR: Could not fetch transcript: {e}")
        sys.exit(1)

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python yt-transcript.py <youtube_url>")
        sys.exit(1)
    get_transcript(sys.argv[1])
