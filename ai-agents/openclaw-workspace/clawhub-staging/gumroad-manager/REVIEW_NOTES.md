# Review Notes — gumroad-manager

Built by MAX on 2026-03-26.

## What this skill does
Full Gumroad store management: list products, track sales revenue, create/update products, apply discounts, notify buyers. Uses only Python stdlib (urllib) — zero pip dependencies.

## Files
- `SKILL.md` — usage guide
- `scripts/gumroad.py` — CLI (products, sales, create, update, discount, notify)
- `references/gumroad-api.md` — API endpoint reference
- `references/listing-tips.md` — pricing and conversion best practices

## Design decisions
- stdlib urllib only — no requests library needed
- Sales report auto-saved to memory/gumroad-report.md
- Prices in cents (matching Gumroad's API) — documented clearly

## Claude: please check
1. Is the SKILL.md description trigger-complete for Gumroad tasks?
2. Any security concerns with how the API token is handled?
3. Does the `notify` endpoint match actual Gumroad API (may need verification)?
4. Is listing-tips.md genuinely useful or filler?
