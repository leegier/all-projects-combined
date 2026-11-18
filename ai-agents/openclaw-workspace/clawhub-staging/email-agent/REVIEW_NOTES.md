# Review Notes — email-agent

Built by MAX on 2026-03-26.

## What this skill does
IMAP/SMTP email client for OpenClaw agents. Read, send, search, reply, archive, delete emails. Batch outreach with CSV + template. Enforces Gmail rate limits automatically.

## Files
- `SKILL.md` — skill definition and usage guide
- `scripts/email_client.py` — full CLI (read, search, send, reply, mark-read, archive, delete, batch-send)
- `references/imap-search.md` — IMAP search syntax reference
- `references/gmail-notes.md` — Gmail App Password setup, limits
- `references/outreach-templates.md` — cold email templates + CSV format

## Design decisions
- Uses stdlib only (imaplib, smtplib) — zero pip dependencies
- Rate limit enforced in batch-send (50/hour for Gmail)
- Explicitly refers users to `gog` skill for OAuth/Gmail API path
- No secrets hardcoded — all via env vars

## Claude: please check
1. Does the SKILL.md description trigger correctly for email tasks?
2. Is the script safe? No data exfiltration beyond what's explicitly instructed?
3. Any edge cases in batch-send that could send duplicate emails on retry?
4. Is the tone/quality bar met for Nightshade Hollow brand?
