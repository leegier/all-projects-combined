---
name: affiliate-tracker
description: Track affiliate links, click counts, conversions, and commissions across multiple programs. Generates UTM-tagged links, logs affiliate activity, and produces revenue reports. Use when managing affiliate income, tracking which links drive sales, aggregating commission data, or getting alerts when thresholds are hit. Triggers on: "track my affiliate links", "affiliate commission report", "how much did I make from affiliates", "add an affiliate link", "UTM link generator", "affiliate income", or any affiliate marketing tracking task.
---

# affiliate-tracker

Track affiliate links and commission income. All data stored locally in `memory/affiliates.json`.

## Setup

No API keys required for basic tracking. Optional integrations for Amazon Associates and ShareASale via their reporting APIs.

---

## Commands

### Add an Affiliate Link

```bash
python scripts/affiliate.py add \
  --program "Amazon Associates" \
  --product "Unity Game Dev Book" \
  --base-url "https://amazon.com/dp/B0XXXXX" \
  --tag "nightshade-20" \
  --commission-rate 4.5
```

Generates a UTM-tagged link and saves it to your tracker.

### List All Links

```bash
python scripts/affiliate.py list
python scripts/affiliate.py list --program "Amazon Associates"
```

### Log a Click / Conversion

```bash
python scripts/affiliate.py log-click --id LINK_ID
python scripts/affiliate.py log-conversion --id LINK_ID --amount 29.99
```

Use these when you manually spot a conversion in your affiliate dashboard.

### Revenue Report

```bash
python scripts/affiliate.py report
python scripts/affiliate.py report --days 30
```

Output:
```
Affiliate Income Report — Last 30 days

  Amazon Associates:   $12.40  (8 clicks, 2 conversions)
  Gumroad affiliate:   $45.00  (3 conversions)
  Total:               $57.40

  Top link: "Unity Book" — $12.40 (4.5% of $275.60 in sales)
```

### Set Alert Threshold

```bash
python scripts/affiliate.py alert --threshold 100
```

Saves alert config — when total monthly commissions cross $100, reminder is shown on next report run.

---

## Supported Programs

| Program | Commission | Setup |
|---------|-----------|-------|
| Amazon Associates | 1–10% | Add `&tag=YOUR-TAG` to links |
| Gumroad affiliate | 30–50% | Use Gumroad referral URL |
| ShareASale | Varies | Add `afftrack=` parameter |
| Impact.com | Varies | Use publisher link |
| Custom / any | Any | Manual tracking |

---

## References

- UTM parameter guide: see `references/utm-guide.md`
- Affiliate program comparison: see `references/programs.md`
