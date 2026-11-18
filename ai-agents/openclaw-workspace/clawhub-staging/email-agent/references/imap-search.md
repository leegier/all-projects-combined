# IMAP Search Syntax Reference

## Common Search Criteria

| Criteria | Example | Description |
|----------|---------|-------------|
| `UNSEEN` | `UNSEEN` | Unread messages |
| `SEEN` | `SEEN` | Read messages |
| `FROM "x"` | `FROM "boss@company.com"` | From address contains |
| `TO "x"` | `TO "me@gmail.com"` | To address contains |
| `SUBJECT "x"` | `SUBJECT "invoice"` | Subject contains |
| `SINCE "DD-Mon-YYYY"` | `SINCE "01-Mar-2026"` | After date |
| `BEFORE "DD-Mon-YYYY"` | `BEFORE "01-Apr-2026"` | Before date |
| `BODY "x"` | `BODY "payment"` | Body text contains |
| `FLAGGED` | `FLAGGED` | Starred/flagged |
| `ALL` | `ALL` | All messages |

## Combining Criteria

IMAP search uses implicit AND. Use parentheses for clarity:

```
UNSEEN FROM "client@company.com"
SINCE "01-Mar-2026" SUBJECT "invoice"
```

## Folder Names by Provider

| Provider | Sent | Archive | Trash | Spam |
|----------|------|---------|-------|------|
| Gmail | `[Gmail]/Sent Mail` | `[Gmail]/All Mail` | `[Gmail]/Trash` | `[Gmail]/Spam` |
| Outlook | `Sent Items` | `Archive` | `Deleted Items` | `Junk Email` |
| Generic | `Sent` | `Archive` | `Trash` | `Spam` |
