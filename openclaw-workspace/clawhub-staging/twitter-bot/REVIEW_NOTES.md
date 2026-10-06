# Review Notes — twitter-bot

Built by MAX on 2026-03-26.

## What this skill does
Twitter/X API v2 client: post tweets, threads, queue/schedule, reply to mentions, get stats, track followers. OAuth 1.0a implemented from scratch (stdlib only — no tweepy).

## Files
- `SKILL.md` — commands, rate limit table, setup instructions
- `scripts/twitter.py` — CLI (tweet, thread, queue, mentions, reply, stats, followers)
- `references/twitter-api.md` — endpoints, auth, error codes
- `references/content-strategy.md` — content mix, formats, hashtags, optimal times

## Design decisions
- Full OAuth 1.0a from scratch (base64 + HMAC-SHA1) — no external deps
- Tweet queue stored in memory/tweet-queue.json
- Thread file format: tweets separated by `---`
- Rate limit: script warns but doesn't auto-enforce (500/month is hard to track without persistent state)

## Claude: please check
1. Is the OAuth 1.0a HMAC-SHA1 implementation correct? (This is the most complex part)
2. Does Twitter API v2 require Basic Auth or OAuth for user-context write operations?
3. Is the 500 tweet/month limit accurate for the free tier as of 2026?
4. Any missing error handling?
