---
name: twitter-bot
description: Post tweets, threads, and media to Twitter/X. Schedule content, reply to mentions, and track follower growth via the Twitter API v2. Use when posting a tweet, scheduling a thread, promoting a product on X, replying to mentions, or automating Twitter content. Triggers on: "post a tweet", "tweet this", "post to X", "schedule a Twitter thread", "reply to mentions", "promote CLAWED on Twitter", "build my Twitter following", or any task involving Twitter/X content.
---

# twitter-bot

Post and manage Twitter/X content via API v2.

## Setup

Requires a Twitter Developer account with a Project + App:
https://developer.twitter.com/en/portal/dashboard

```
TWITTER_API_KEY=...
TWITTER_API_SECRET=...
TWITTER_ACCESS_TOKEN=...
TWITTER_ACCESS_SECRET=...
```

Free tier: 500 tweets/month write access. Read is unlimited.

---

## Commands

### Post a Tweet

```bash
python scripts/twitter.py tweet --text "Just shipped CLAWED v0.1 — prison survival game. Free download this week. #indiedev #gamedev #unity"
```

Max 280 characters. Returns tweet URL.

### Post a Thread

```bash
python scripts/twitter.py thread --file threads/clawed-launch.txt
```

Thread file format — one tweet per `---` separator:
```
Just shipped my first game: CLAWED 🔒

Prison survival. Stealth mechanics. Guard AI. Made solo in Unity. 1/5
---
The whole thing started as a joke — "what if I made a game where you're ACTUALLY in prison"

Turned into 4 months of building. 2/5
---
...
```

### Schedule a Tweet (queue)

```bash
python scripts/twitter.py queue --text "Drop 👇" --send-at "2026-03-27T09:00:00"
python scripts/twitter.py queue --run   # process the queue, send due tweets
```

Queue stored in `memory/tweet-queue.json`.

### Reply to Mentions

```bash
python scripts/twitter.py mentions --limit 10
python scripts/twitter.py reply --tweet-id 1234567890 --text "Thanks! Download link in bio 🙏"
```

### Track Stats

```bash
python scripts/twitter.py stats --tweet-id 1234567890
python scripts/twitter.py followers
```

---

## Rate Limits (Free Tier)

| Action | Limit |
|--------|-------|
| Tweets per month | 500 |
| Reads per month | Unlimited |
| Replies | Count toward 500 |
| Retweets | Count toward 500 |

Script enforces limits — will warn before posting if close to cap.

---

## References

- Twitter API v2 endpoints: see `references/twitter-api.md`
- Content strategy for indie devs: see `references/content-strategy.md`
