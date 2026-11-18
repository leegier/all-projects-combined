---
name: reddit-poster
description: Post to Reddit subreddits, monitor post performance, and track karma. Use when sharing a project on Reddit, submitting to r/gamedev or r/indiegaming, cross-posting to multiple subreddits, or checking how a post is performing. Follows Reddit ToS — no spam, no vote manipulation, respects rate limits. Triggers on: "post to Reddit", "share on Reddit", "submit to r/gamedev", "cross-post to subreddits", "check my Reddit post karma", "post my game to Reddit", or any Reddit content task.
---

# reddit-poster

Post content to Reddit via the official API. Follows Reddit ToS strictly.

⚠️ **Reddit Rules — Non-Negotiable:**
- Never post identical content to multiple subreddits in the same day (considered spam)
- Always read subreddit rules before posting (check sidebar)
- No vote manipulation — never ask for upvotes
- Minimum account age/karma requirements vary by subreddit

---

## Setup

Create a Reddit app at https://www.reddit.com/prefs/apps (select "script"):

```
REDDIT_CLIENT_ID=...
REDDIT_CLIENT_SECRET=...
REDDIT_USERNAME=your_username
REDDIT_PASSWORD=your_password
REDDIT_USER_AGENT="OpenClaw/1.0 (by /u/your_username)"
```

---

## Commands

### Submit a Post

```bash
# Link post
python scripts/reddit.py post \
  --subreddit "gamedev" \
  --title "I made a prison survival game solo in Unity — CLAWED [Early Access]" \
  --url "https://itch.io/your-game-url"

# Text post
python scripts/reddit.py post \
  --subreddit "indiegaming" \
  --title "Made my first game solo — here's what I learned" \
  --text posts/devlog.txt
```

### Cross-Post to Multiple Subreddits

```bash
python scripts/reddit.py crosspost \
  --title "CLAWED — prison survival game I built solo in Unity" \
  --url "https://itch.io/..." \
  --subreddits "gamedev,indiegaming,Unity3D,SideProject" \
  --delay 3600
```

`--delay` = seconds between posts (default 3600 = 1h). Prevents spam detection.

### Check Post Performance

```bash
python scripts/reddit.py stats --post-id abc123
```

### Get Subreddit Info

```bash
python scripts/reddit.py subreddit-info --name gamedev
```

Shows subscriber count, posting rules summary, current top posts.

### Track Your Posts

```bash
python scripts/reddit.py history
```

Shows all posts logged in `memory/reddit-posts.md`.

---

## Best Subreddits for CLAWED / Indie Dev

| Subreddit | Subscribers | Best post type |
|-----------|-------------|---------------|
| r/gamedev | 1M+ | Devlogs, technical posts, lessons learned |
| r/indiegaming | 200k+ | Game announcements, trailers, demos |
| r/Unity3D | 300k+ | Screenshots, Unity-specific content |
| r/SideProject | 150k+ | Launch posts, milestone shares |
| r/indiegamedev | 50k+ | WIP, feedback requests |
| r/screenshotsaturday | Active | Screenshots every Saturday |

---

## References

- Subreddit rules quick reference: see `references/subreddit-rules.md`
- Post templates: see `references/post-templates.md`
