---
name: analytics-reporter
description: Pull and summarize analytics from Google Analytics 4 (GA4) or Plausible Analytics. Generates daily or weekly reports with page views, sessions, top pages, traffic sources, and period-over-period comparison. Use when checking website or landing page traffic, generating a weekly analytics summary, or monitoring which content drives the most traffic. Triggers on: "check my analytics", "website traffic report", "GA4 report", "Plausible report", "how many visitors did I get", "traffic summary", "analytics this week", or any web analytics task.
---

# analytics-reporter

Pull and summarize web analytics. Supports GA4 and Plausible.

## Setup

### Option A — Plausible (easiest, no OAuth)

```
PLAUSIBLE_API_KEY=your_key
PLAUSIBLE_SITE_ID=yourdomain.com
```

Get key at: https://plausible.io/settings/api-keys

### Option B — Google Analytics 4

Use the `ga4-data-api` skill (already installed) which handles the OAuth flow.
This skill wraps it with a simpler reporting interface.

```
GA4_PROPERTY_ID=123456789
```

---

## Commands

### Quick Traffic Summary

```bash
python scripts/analytics.py summary --days 7
python scripts/analytics.py summary --days 30
```

Output:
```
Traffic Summary — Last 7 days (vs. prior 7 days)

  Visitors:    1,243  (+12%)
  Page views:  3,891  (+8%)
  Bounce rate: 62%    (-3%)
  Avg session: 2m 14s

  Top pages:
    /             847 views
    /clawed       312 views
    /blog/post-1  198 views

  Top sources:
    Direct        41%
    Twitter       28%
    Reddit        18%
    Google        13%
```

### Daily Report (send to memory)

```bash
python scripts/analytics.py daily
```

Saves to `memory/analytics-YYYY-MM-DD.md`.

### Top Pages

```bash
python scripts/analytics.py top-pages --days 30 --limit 10
```

### Traffic Sources

```bash
python scripts/analytics.py sources --days 7
```

---

## Automation

Add to heartbeat to get weekly analytics without asking:
```
# Every Monday morning
python analytics.py summary --days 7
```
