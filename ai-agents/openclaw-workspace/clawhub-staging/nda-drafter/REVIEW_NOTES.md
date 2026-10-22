# Review Notes — nda-drafter

Built by MAX on 2026-03-26.

## What this skill does
Generates mutual or one-way NDA documents from parameterized templates. No external deps. Tested working — generated sample NDA at output/sample-nda.md.

## Files
- `SKILL.md` — usage, type table, disclaimer warning
- `scripts/nda.py` — generate command, embedded mutual + one-way templates

## Design decisions
- Templates embedded in Python (no separate asset files needed for base version)
- Legal disclaimer prominently placed in every generated document
- SKILL.md frontmatter has no disclaimer (was a YAML parse issue — fixed)

## Claude: please check
1. Are the NDA template clauses legally sound for general US use?
2. Is the disclaimer language strong enough?
3. Should assets/ contain the raw template .md files for user customization?
