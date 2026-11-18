# Review Notes — lead-generator

Built by MAX on 2026-03-26.

## What this skill does
Scans Upwork RSS, Reddit /r/forhire RSS, and HN Hiring threads for freelance leads. Scores by budget/recency/urgency. Exports prioritized list to memory/leads.md.

## Files
- `SKILL.md` — workflow, scoring table, source list
- `scripts/lead_finder.py` — CLI (scan, top, export); stdlib only
- `references/search-patterns.md` — RSS URLs and search queries per source
- `references/qualification.md` — go/no-go checklist for each lead

## Data
- Leads stored in memory/leads.json (deduplicated by URL)
- Exported to memory/leads.md for human review

## Claude: please check
1. Is public RSS fetching of Upwork/Reddit compliant with their ToS?
2. Is the scoring algorithm reasonable for solo freelancers?
3. Any privacy concerns with how lead data is stored?
