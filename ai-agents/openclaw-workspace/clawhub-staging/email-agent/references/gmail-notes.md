# Gmail-Specific Notes

## App Password (required for IMAP/SMTP)

Gmail blocks regular passwords for IMAP. Use an App Password:

1. Go to https://myaccount.google.com/security
2. Enable 2-Step Verification (required)
3. Go to https://myaccount.google.com/apppasswords
4. Select "Mail" + "Windows Computer" → Generate
5. Use the 16-char password as `EMAIL_PASS`

## Gmail IMAP Settings

```
EMAIL_HOST=imap.gmail.com
EMAIL_PORT=993
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
```

Enable IMAP in Gmail: Settings → See all settings → Forwarding and POP/IMAP → Enable IMAP

## Gmail Sending Limits (Free)

- 500 emails/day via SMTP
- ~50/hour recommended to avoid triggering spam filters
- `email_client.py` enforces 50/hour rate limit automatically

## Prefer gog Skill for OAuth

If you want OAuth (no app password, more robust), use the `gog` skill which handles Google Workspace including Gmail via OAuth2. This skill (`email-agent`) is better suited for non-Gmail providers or when you prefer simple IMAP credentials.
