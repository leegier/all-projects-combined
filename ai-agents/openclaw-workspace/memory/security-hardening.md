# Security Hardening Log — 2026-03-28

## Status: HARDENED ✅

### Changes Made

#### Telegram (was open, now locked)
- `allowFrom`: `["*"]` → `["7615833146"]` (Lee's Telegram user ID only)
- `dmPolicy`: `"open"` → `"allowlist"`
- `groupPolicy`: `"open"` → `"deny"`

#### Discord (already secure)
- `groupPolicy`: `"allowlist"` ✅
- `guilds`: locked to `1484731360382812204` (Nightshade Hollow) ✅
- `requireMention`: false (OK within trusted guild)

### Remaining Gaps

| Item | Risk | Fix |
|------|------|-----|
| Gateway exposed on 127.0.0.1 only | LOW — localhost only | ✅ Already safe |
| Browser sessions isolated? | MEDIUM | Use agent-browser skill, not system Chrome |
| API keys in openclaw.json | MEDIUM | Keys are local only, no cloud sync |
| Prompt injection via Telegram | LOW — allowlist now active | Monitor |

### Whisper Installed
- Version: openai-whisper-20250625
- Script: `Z:\openclaw\workspace\scripts\transcribe.py`
- Models available: tiny (72MB), base, small, medium, large
- Base model recommended for voice memos

### Next: Obsidian Memory Graph
- Install Obsidian
- Configure vault at `Z:\openclaw\workspace\obsidian-vault\`
- Connect daily memory files
