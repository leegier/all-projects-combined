# TOOLS.md — Your Setup Notes

Skills define *how* tools work. This file is for *your* specifics — unique to your setup.

## TTS Voice (ElevenLabs)

- **Provider:** ElevenLabs
- **API Key:** in `C:\Users\Gierl\.openclaw\openclaw.json` → env.ELEVENLABS_API_KEY
- **Voice ID:** `pNInz6obpgDQGcFmaJgB` — Adam (Dominant, Firm, deep male)
- **Auto TTS:** always on — every reply goes out as audio
- **Speed:** 0.85
- **Stability:** 0.55, **Similarity:** 0.85, **Style:** 0.35
- **Model:** eleven_multilingual_v2
- **Note:** Old ID `yoZ06aMxZJJ28mfd3POQ` is DEAD — redirected to Riley (female). Never use it.

## Discord

- **Guild:** THE_NYGHTSHADE_HOLLOW (`1484731360382812204`)
- **#general channel ID:** `1484731361272139838`
- **Bot username:** @MAX
- **Bot user ID:** `1485367231427903579`

## Telegram

- **Bot:** @MAX_MAX_MAX_BOT_BOT
- **Bot token:** in openclaw.json → channels.telegram.botToken

## Gateway

- **URL:** http://127.0.0.1:18789
- **Token:** `4503b9af0c6c27ff36bf4ef43dc3748bda660ccfec5aaacb`
- **Send Discord message:** `openclaw message send --channel discord --target "1484731361272139838" --message "text"`

## Unity Projects

| Project | Path | Purpose |
|---------|------|---------|
| CLAWED scripts | `Z:\Dev\UNITY\BETTERNOW` | All C# gameplay scripts, active build target |
| CLAWED assets | `Z:\Dev\UNITY\CLAUDE\CLAUDE` | 19 Unity asset packages pending import |
| Unity exe | `Z:\Dev\UNITY\Unity Hub\6000.4.0f1\Editor\Unity.exe` | Batch mode builds |

## Drives

| Drive | Purpose |
|-------|---------|
| C:\ | System, user home (`C:\Users\Gierl`) |
| Z:\ | PRIMARY — all OpenClaw/workspace files |
| X:\ | Storage (477 GB free) |

## Mission Control

- **URL:** http://localhost:3333
- **Config:** `Z:\openclaw\workspace\mission-control\mc-config.json`
