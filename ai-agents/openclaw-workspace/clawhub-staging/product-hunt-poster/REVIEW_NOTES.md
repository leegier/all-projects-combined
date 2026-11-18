# Review Notes — product-hunt-poster

Built by MAX on 2026-03-26.

## What this skill does
Product Hunt launch assistant: research top listings (PH GraphQL API), draft launch copy with tagline checker, print pre-launch checklist, submit via API, monitor upvotes post-launch.

## Files
- `SKILL.md` — workflow, tagline formula, commands
- `scripts/ph_launcher.py` — CLI (research, draft, checklist, submit, monitor)
- `references/launch-timeline.md` — hour-by-hour launch day plan
- `references/what-works.md` — tagline patterns, gallery tips, category guide

## Design notes
- draft/checklist commands work without API token (useful immediately)
- research/submit/monitor require PRODUCT_HUNT_API_TOKEN
- Tagline length check built into draft command

## Claude: please check
1. Is the PH GraphQL schema current? (API v2 — check if `posts` query + `topic` filter is correct)
2. Is the `postCreate` mutation correct for PH API v2?
3. Any ToS concerns with automated submission?
