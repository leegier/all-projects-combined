---
name: email-agent
description: Read, draft, send, and manage emails via IMAP/SMTP or Gmail API. Use when an agent needs to check inbox, filter/search emails, draft AI-assisted replies, send messages with attachments, or manage email state (read, archive, move, delete). Supports Gmail, Outlook, and any IMAP/SMTP server. Triggers on: "check my email", "send an email", "draft a reply", "read unread messages", "email outreach", "cold email", "forward this to", "archive emails from", or any task involving sending or receiving email.
---

# email-agent

Manage email programmatically using IMAP/SMTP (universal) or Gmail API (OAuth, recommended for Gmail).

## Setup

### Option A — IMAP/SMTP (any provider)

Required env vars:
```
EMAIL_HOST=imap.gmail.com        # or outlook.office365.com, etc.
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_PORT=993                   # IMAP SSL
EMAIL_SMTP_PORT=587              # SMTP TLS
EMAIL_USER=you@gmail.com
EMAIL_PASS=your-app-password     # Gmail: use App Password, not account password
```

For Gmail App Password: https://myaccount.google.com/apppasswords

### Option B — Gmail API (OAuth — no password needed)

Use the `gog` skill (Google Workspace CLI) — it handles Gmail via OAuth automatically.
This skill uses the IMAP/SMTP path. Use `gog` for Gmail OAuth.

---

## Core Operations

### Read Unread Emails

```bash
python scripts/email_client.py read --limit 10
```

Returns: subject, from, date, snippet for each message.

### Search Emails

```bash
python scripts/email_client.py search --query "from:client@company.com" --limit 20
python scripts/email_client.py search --query "subject:invoice" --limit 5
python scripts/email_client.py search --query "UNSEEN" --folder INBOX
```

### Read Full Email

```bash
python scripts/email_client.py read-full --uid 12345
```

### Send Email

```bash
python scripts/email_client.py send \
  --to "recipient@example.com" \
  --subject "Your Subject" \
  --body "Message body here" \
  --from "you@gmail.com"
```

With attachment:
```bash
python scripts/email_client.py send \
  --to "client@company.com" \
  --subject "Invoice #001" \
  --body "Please find the invoice attached." \
  --attach "/path/to/invoice.pdf"
```

### Reply to Email

```bash
python scripts/email_client.py reply --uid 12345 --body "Thanks, I'll look into this."
```

### Mark as Read / Archive / Delete

```bash
python scripts/email_client.py mark-read --uid 12345
python scripts/email_client.py archive --uid 12345
python scripts/email_client.py delete --uid 12345
```

---

## AI-Assisted Drafting

When drafting replies or cold emails, use the agent's own language model — no extra tool needed.

**Pattern for drafting a reply:**
1. Read the original email with `read-full`
2. Summarize context + ask LLM to draft a reply in the appropriate tone
3. Show draft to user (or send autonomously if confidence is high and task permits)

**Pattern for cold outreach:**
1. Load prospect info (name, company, pain point)
2. Draft a personalized 3-sentence email: hook → value → CTA
3. Send via `send` command
4. Log to `memory/outreach-log.md`

---

## Batch Operations

For sending multiple emails (outreach campaigns, newsletters):

```bash
python scripts/email_client.py batch-send --csv contacts.csv --template templates/outreach.txt
```

CSV format: `name,email,company,custom1`
Template placeholders: `{name}`, `{company}`, `{custom1}`

**Rate limit:** Max 50 emails/hour for Gmail SMTP free tier. Script enforces this automatically.

---

## References

- Full IMAP search syntax: see `references/imap-search.md`
- Gmail-specific notes and App Password setup: see `references/gmail-notes.md`
- Outreach templates: see `references/outreach-templates.md`
