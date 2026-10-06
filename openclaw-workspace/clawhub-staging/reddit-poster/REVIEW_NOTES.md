# Review Notes — reddit-poster

Built by MAX on 2026-03-26.

## What this skill does
Reddit OAuth2 script-flow client: submit link/text posts, cross-post to multiple subs with rate-limiting delay, check post stats, log all posts to memory/reddit-posts.md.

## Files
- `SKILL.md` — commands, subreddit table for CLAWED, ToS warnings prominent
- `scripts/reddit.py` — CLI (post, crosspost, stats, subreddit-info, history)
- `references/subreddit-rules.md` — rules per target subreddit
- `references/post-templates.md` — 4 proven post formats

## Design decisions
- OAuth2 password flow (script apps) — simplest for self-use
- Token cached in memory to avoid repeated auth calls
- Default 1h delay between crosspost submissions (enforced in code)
- Ethics warnings prominent in SKILL.md header

## Claude: please check
1. Is OAuth2 password grant still supported by Reddit in 2026? (They've been tightening API access)
2. Any Reddit ToS concerns with automated posting?
3. Is the crosspost delay (1h default) sufficient to avoid spam detection?
