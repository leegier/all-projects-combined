---
name: deal-finder
description: Find deals on software licenses, hosting, domains, and developer tools from AppSumo, PitchGround, and other deal aggregators. Calculates ROI vs monthly subscription cost. Use when looking for cheap software alternatives, lifetime deals on tools, discounted hosting, or domain deals. Triggers on: "find deals on", "AppSumo deals", "lifetime deal", "cheap software", "deals on developer tools", "discount on hosting", "find a deal for", or any software deal discovery task.
---

# deal-finder

Discover software deals and lifetime licenses from deal aggregators.

## Sources

| Site | Best for |
|------|---------|
| AppSumo | Lifetime SaaS deals, indie tools |
| PitchGround | International SaaS deals |
| StackSocial | Dev tools, education |
| Humble Bundle | Dev software bundles |
| GitHub Student Pack | Free tools for students |

## Commands

### Browse Current Deals

```bash
python scripts/deals.py browse --category "developer-tools" --limit 10
python scripts/deals.py browse --category "marketing" --limit 10
```

### Search for a Specific Tool Type

```bash
python scripts/deals.py search --query "project management"
python scripts/deals.py search --query "email marketing"
```

### Calculate ROI

```bash
python scripts/deals.py roi \
  --lifetime-price 59 \
  --monthly-price 29 \
  --months-you-plan-to-use 24
```

Output:
```
ROI Analysis
  Lifetime deal: $59
  Monthly cost:  $29/month
  Break-even:    2.0 months
  Savings over 24 months: $637
  Verdict: STRONG BUY if you'll use it for 3+ months
```

### Save a Deal to Watchlist

```bash
python scripts/deals.py save \
  --name "EmailOctopus LTD" \
  --url "https://appsumo.com/..." \
  --price 49 \
  --category "email-marketing"
```

### View Watchlist

```bash
python scripts/deals.py watchlist
```

---

## ROI Rule of Thumb

- Break-even < 3 months = strong buy
- Break-even 3–6 months = good buy if you need it now
- Break-even > 6 months = only if you're certain you'll use it long-term
- Always check if the tool has an active team and recent updates before LTD
