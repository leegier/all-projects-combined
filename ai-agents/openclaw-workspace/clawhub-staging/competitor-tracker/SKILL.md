---
name: competitor-tracker
description: Monitor competitor products, prices, reviews, and rankings on itch.io, Steam, Upwork, and Fiverr. Alerts when a competitor drops price, gets featured, or gains reviews. Logs findings to memory/competitor-intel.md. Use when researching competing games, monitoring freelance competitor gigs, tracking price changes, or getting notified of competitor updates. Triggers on: "track my competitors", "monitor competitor prices", "watch this itch.io game", "competitor analysis", "who are my competitors", "check competitor reviews", or any competitive intelligence task.
---

# competitor-tracker

Monitor competitor products and gigs. Passive web fetching only — no accounts required.

## Commands

### Add a Competitor to Watch

```bash
python scripts/competitor.py add \
  --name "Prison Architect" \
  --url "https://store.steampowered.com/app/233450/" \
  --platform steam \
  --notes "Direct competitor — prison management genre"

python scripts/competitor.py add \
  --name "Unity Dev Gig" \
  --url "https://www.fiverr.com/username/unity-game-development" \
  --platform fiverr
```

### Check All Competitors

```bash
python scripts/competitor.py check
```

Fetches each tracked URL and compares to last seen state. Reports changes in price, rating, review count.

### Generate Intel Report

```bash
python scripts/competitor.py report
```

Saves full competitor snapshot to `memory/competitor-intel.md`.

### List Tracked Competitors

```bash
python scripts/competitor.py list
```

---

## What Gets Tracked

| Platform | Tracks |
|----------|--------|
| itch.io | Price, rating, download count |
| Steam | Price, review score, review count |
| Fiverr | Gig price, reviews, level |
| Upwork | Hourly rate, job success score |
| Generic URL | Title, price mentions, review counts |

---

## Alert on Changes

Changes since last check are flagged automatically:
- Price drops > 20%
- Review count jumps > 10
- New "Featured" or "Top Seller" badge detected
