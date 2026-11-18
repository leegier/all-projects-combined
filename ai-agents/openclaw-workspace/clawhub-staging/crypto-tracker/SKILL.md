---
name: crypto-tracker
description: Track cryptocurrency prices and portfolio value using CoinGecko API (free, no API key). Alerts on significant price moves. Use when checking crypto prices, calculating portfolio value from a holdings list, setting price alerts, or getting a daily summary of crypto positions. Triggers on: "check crypto prices", "Bitcoin price", "my crypto portfolio", "crypto alert", "how much is my crypto worth", "ETH price", "track my holdings", or any cryptocurrency price tracking task. Read-only — no trading, no wallet access.
---

# crypto-tracker

Real-time crypto prices and portfolio tracking via CoinGecko (free, no API key needed).

## Commands

### Check Prices

```bash
python scripts/crypto.py prices --coins "bitcoin,ethereum,solana"
python scripts/crypto.py prices --coins "bitcoin" --currency eur
```

### Portfolio Value

Define holdings in `memory/crypto-holdings.json`:
```json
{"bitcoin": 0.05, "ethereum": 1.2, "solana": 10}
```

Then:
```bash
python scripts/crypto.py portfolio
```

Output:
```
Portfolio Summary
  Bitcoin (0.05 BTC):   $3,412.50
  Ethereum (1.2 ETH):   $2,870.40
  Solana (10 SOL):      $1,423.00
  Total:                $7,705.90  (+2.3% today)
```

### Set Price Alert

```bash
python scripts/crypto.py alert --coin bitcoin --above 80000
python scripts/crypto.py alert --coin ethereum --below 2000
```

Alerts shown on next `portfolio` or `prices` run.

### Daily Summary (for heartbeat)

```bash
python scripts/crypto.py daily
```

Saves to `memory/crypto-YYYY-MM-DD.md`.

---

## Notes

- All data from CoinGecko free API — no key required
- Prices are spot prices, not financial advice
- No wallet connection, no private keys — read-only price data only
