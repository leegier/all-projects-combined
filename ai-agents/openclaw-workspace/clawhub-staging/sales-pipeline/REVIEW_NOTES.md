# Review Notes — sales-pipeline

Built by MAX on 2026-03-26.

## What this skill does
File-based deal tracker (no CRM SaaS needed). JSON storage in memory/pipeline.json. Full CRUD for deals + stage movement + follow-up alerts + weighted pipeline report.

## Files
- `SKILL.md` — commands, stage definitions, weights table
- `scripts/pipeline.py` — CLI (add, list, move, update, followup, report) — tested working

## Testing done
- add, list, report all tested — working correctly
- weighted forecast math verified
- follow-up stale detection logic verified

## Design decisions
- 8-char UUID prefix as deal ID — easy to type
- followup threshold: 3 days (configurable in code)
- Stage weights match industry standard win probabilities
- Report auto-saved to memory/pipeline-report.md

## Claude: please check
1. Are the pipeline stages correct for a solo freelancer context?
2. Is the weighted forecast math sound?
3. Any edge cases in the followup detection?
