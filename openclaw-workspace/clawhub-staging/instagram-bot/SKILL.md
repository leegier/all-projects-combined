---
name: instagram-bot
description: Post images, carousels, and Reels to Instagram via the Instagram Graph API (requires Facebook/Meta Business account). Use when posting game screenshots, devlog images, or marketing content to Instagram. Triggers on: "post to Instagram", "upload Instagram photo", "post a Reel", "Instagram carousel", "schedule Instagram post", or any Instagram content posting task.
---

# instagram-bot

Post to Instagram via the Meta Graph API.

## Setup Requirements

Instagram Graph API requires a Meta Business account:
1. Connect Instagram to a Facebook Page
2. Create a Meta Developer app: https://developers.facebook.com
3. Get a long-lived Page Access Token
4. Enable `instagram_content_publish` permission

```
INSTAGRAM_ACCESS_TOKEN=...
INSTAGRAM_USER_ID=...
```

**Alternative:** Use Buffer, Later, or Hootsuite for simpler scheduling without API setup.

---

## Commands

### Post a Photo

```bash
python scripts/instagram.py photo \
  --image-url "https://your-server.com/screenshot.jpg" \
  --caption "First look at CLAWED — prison survival game 🔒 #indiedev #gamedev #unity3d"
```

Note: Image must be a **public URL** (not a local file path). Upload to Imgur, Cloudinary, or your own server first.

### Post a Carousel (multiple images)

```bash
python scripts/instagram.py carousel \
  --image-urls "https://url1.jpg,https://url2.jpg,https://url3.jpg" \
  --caption "Progress on CLAWED — 3 months of development 🎮"
```

### Post a Reel

```bash
python scripts/instagram.py reel \
  --video-url "https://your-server.com/gameplay.mp4" \
  --caption "Guard AI in action — #indiegame #gamedev"
```

### Get Account Stats

```bash
python scripts/instagram.py stats
```

---

## Image Requirements

| Type | Specs |
|------|-------|
| Photo | JPG/PNG, min 320px, max 1440px wide, 8MB |
| Carousel | 2–10 images, same specs |
| Reel | MP4/MOV, 9:16, 3 sec–15 min, 1GB |

---

## Hashtag Strategy for Indie Games

High-reach: `#indiedev` `#gamedev` `#indiegame` `#madewithunity`
Mid-reach: `#unity3d` `#gamedevelopment` `#indiegames` `#pixelart`
Niche: `#survivalgame` `#horrorgame` `#prison`

Mix: 5 high + 5 mid + 5 niche = best reach without looking spammy.
