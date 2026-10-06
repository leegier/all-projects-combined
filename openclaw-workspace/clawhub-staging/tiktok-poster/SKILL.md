---
name: tiktok-poster
description: Upload and schedule TikTok videos with captions, hashtags, and sound settings via the TikTok Content Posting API. Use when posting game clips, devlog videos, or marketing content to TikTok. Triggers on: "post to TikTok", "upload TikTok video", "schedule TikTok", "TikTok devlog", "post a TikTok about", or any TikTok video posting task.
---

# tiktok-poster

Post videos to TikTok via the official Content Posting API.

## Setup

TikTok requires developer app approval for the Content Posting API:
1. Create a TikTok developer account: https://developers.tiktok.com
2. Create an app and request `video.upload` + `video.publish` scopes
3. Complete OAuth flow to get access token

```
TIKTOK_ACCESS_TOKEN=...
TIKTOK_CLIENT_KEY=...
TIKTOK_CLIENT_SECRET=...
```

**Note:** Personal use posting requires app review (~1-2 weeks). For immediate posting, use the TikTok mobile app or a third-party scheduler like Buffer or Later.

---

## Commands

### Upload a Video

```bash
python scripts/tiktok.py upload \
  --video "output/clawed-gameplay.mp4" \
  --caption "Building a prison game solo in Unity 🔒 #indiedev #gamedev #unity" \
  --privacy "PUBLIC_TO_EVERYONE"
```

Privacy options: `PUBLIC_TO_EVERYONE`, `MUTUAL_FOLLOW_FRIENDS`, `SELF_ONLY`

### Check Upload Status

```bash
python scripts/tiktok.py status --publish-id abc123
```

### Get Account Info

```bash
python scripts/tiktok.py me
```

---

## Video Requirements

| Spec | Requirement |
|------|-------------|
| Format | MP4, MOV, WebM |
| Duration | 3 sec – 10 min |
| Size | Max 4 GB |
| Resolution | Min 360×360, max 4K |
| Aspect ratio | 9:16 recommended (vertical) |

---

## Content Strategy for CLAWED

Best-performing formats for indie game devs:
- **Before/after** — "My game 1 day in vs. 4 months in"
- **Bug → fix** — funny glitch becoming a feature
- **Process timelapse** — Unity scene building in 60 seconds
- **Reactions** — first playtesters playing CLAWED

Use trending sounds. Post 3–5x/week while building audience.

---

## Alternative: Buffer or Later

If API approval is pending, use:
- Buffer: https://buffer.com (supports TikTok scheduling)
- Later: https://later.com
Both have free tiers.
