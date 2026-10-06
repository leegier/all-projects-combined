---
name: lead-generator
description: Find potential clients and freelance leads from public sources — job boards, GitHub, indie game communities, and web search. Scores leads by budget fit and urgency, exports a prioritized list to memory/leads.md. Use when prospecting for new clients, finding businesses that need Unity/dev work, looking for people who posted "hiring" on job boards, or building a cold outreach list. Triggers on: "find me leads", "find potential clients", "who needs Unity work", "prospect for freelance jobs", "build a lead list", "find businesses that need", "look for hiring posts", or any request to source new client opportunities.
---

# lead-generator

Find and score potential clients from public sources. No unauthorized scraping — public data only.

## Sources

| Source | Best for |
|--------|---------|
| GitHub Issues (Algora) | Dev bounties with posted budgets |
| Upwork RSS | Live job postings by skill |
| Reddit (`/r/forhire`, `/r/gamedev`) | Posted "Hiring" threads |
| Hacker News "Who's Hiring" | Tech companies with open budgets |
| itch.io games list | Game devs who might need help |

---

## Commands

### Scan for Leads

```bash
python scripts/lead_finder.py scan --skills "Unity,C#,game-dev" --limit 20
```

Checks all configured sources and returns scored leads.

### Score a Specific URL

```bash
python scripts/lead_finder.py score --url "https://www.upwork.com/jobs/~xyz"
```

### Export Lead List

```bash
python scripts/lead_finder.py export
```

Saves current leads to `memory/leads.md`, sorted by score (highest first).

### View Top Leads

```bash
python scripts/lead_finder.py top --limit 10
```

---

## Lead Scoring

Each lead is scored 0–100:

| Factor | Points |
|--------|--------|
| Budget posted ($200+) | +30 |
| Budget posted ($500+) | +50 |
| Posted within 24h | +20 |
| Posted within 3 days | +10 |
| Matches primary skill | +20 |
| Client has history/reviews | +10 |
| "Urgent" or "ASAP" in post | +15 |

Score ≥ 70 = hot lead → feed to `cold-outreach` or `freelance-proposal-engine` skill immediately.

---

## Workflow with Other Skills

```
lead-generator scan
    → top leads exported to memory/leads.md
    → for each hot lead (score >= 70):
        → freelance-proposal-engine: draft bid
        → OR cold-outreach: send email
```

---

## References

- Source-specific search patterns: see `references/search-patterns.md`
- Lead qualification checklist: see `references/qualification.md`
