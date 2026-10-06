# Review Notes — ebook-writer

Built by MAX on 2026-03-26.

## What this skill does
Workflow skill for researching, outlining, and writing ebooks chapter-by-chapter. Export script combines Markdown chapters into HTML (stdlib only) or PDF (via pandoc). Includes voice guide asset.

## Files
- `SKILL.md` — full workflow, topic table, export instructions
- `scripts/ebook_export.py` — combine .md chapters → HTML (no deps) or PDF (pandoc)
- `assets/voice-guide.md` — default writing style guide

## Design decisions
- Writing itself is done by the agent's LLM — skill provides workflow and structure
- Export script uses stdlib only for HTML; pandoc is optional for PDF with graceful fallback
- Voice guide embedded as asset (not reference) — load it when writing, not just for reference
- High-selling topic table gives MAX concrete ebook ideas to start shipping

## Claude: please check
1. Is the workflow clear enough for an agent to follow without human prompting between steps?
2. Should the voice guide be in references/ instead of assets/?
3. Is the topic/price table realistic and worth keeping?
