---
name: podcast-creator
description: Plan, script, and produce podcast episodes — from outline to finished audio using ElevenLabs TTS (via the sag skill). Use when creating a podcast episode, writing an episode script, converting a script to audio, or generating show notes and chapter markers. Triggers on: "create a podcast episode", "write a podcast script", "record an episode", "make a podcast about", "podcast episode on", "show notes for episode", or any podcast production task.
---

# podcast-creator

Plan, script, and produce podcast episodes with optional TTS audio.

## Workflow

1. **Outline** the episode topic and key points
2. **Script** the full episode (host monologue or interview format)
3. **Generate audio** via ElevenLabs TTS (requires `sag` skill)
4. **Write show notes** and chapter markers
5. **Package** for RSS/upload

---

## Commands

### Generate Episode Outline

```bash
python scripts/podcast.py outline \
  --topic "Building CLAWED — 4 Months of Solo Unity Dev" \
  --format solo \
  --duration 15 \
  --output "output/podcast/ep01-outline.md"
```

Formats: `solo` (monologue), `interview` (Q&A), `breakdown` (step-by-step)

### Write Episode Script

```bash
python scripts/podcast.py script \
  --outline "output/podcast/ep01-outline.md" \
  --host "Lee" \
  --output "output/podcast/ep01-script.md"
```

### Generate Show Notes

```bash
python scripts/podcast.py show-notes \
  --script "output/podcast/ep01-script.md" \
  --title "Ep 1: Building CLAWED" \
  --output "output/podcast/ep01-show-notes.md"
```

### Convert Script to Audio (requires ElevenLabs)

Use the `sag` skill:
```bash
# sag will use the configured TTS voice
# Read the script file and pass to sag for audio generation
```

Or via environment:
```
ELEVENLABS_API_KEY=your_key
ELEVENLABS_VOICE_ID=pNInz6obpgDQGcFmaJgB
```

```bash
python scripts/podcast.py to-audio \
  --script "output/podcast/ep01-script.md" \
  --output "output/podcast/ep01.mp3"
```

---

## Episode Ideas for MAX

| Title | Show | Est. length |
|-------|------|-------------|
| Building CLAWED — 4 months solo | Indie Dev Diaries | 15 min |
| How I Made $X with AI Agents | AI Money Maker | 10 min |
| 5 Unity Mistakes That Wasted My Time | Unity Tips | 8 min |
| Lessons from Shipping My First Game | Indie Dev Diaries | 20 min |

---

## Show Notes Format

```markdown
## Episode Title

**Summary:** One-sentence description

**Key points:**
- Point 1 (00:30)
- Point 2 (03:15)
- Point 3 (07:00)

**Links:**
- [Game on itch.io](URL)
- [Resource mentioned](URL)

**Transcript:** [link or inline]
```
