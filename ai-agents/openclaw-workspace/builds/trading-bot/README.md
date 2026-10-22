# Wheel Strategy Bot — Alpaca Paper Trading

Automated options income bot implementing the Wheel Strategy on TSLA and MSTR.

## Quick Start

```bash
# 1. Set up credentials
copy .env.example .env
# Edit .env with your Alpaca paper trading keys

# 2. Install dependency
pip install requests

# 3. Run status check (dry run, no orders)
python trading_bot.py --status

# 4. Run full cycle (dry run)
python trading_bot.py --once

# 5. Enable paper trading execution
python trading_bot.py --once --execute
```

## Files

| File | Purpose |
|------|---------|
| `trading_bot.py` | Main bot — Alpaca REST API, wheel logic, logging |
| `.env.example` | Credentials template |
| `setup_alpaca.md` | Full setup guide — account creation to cron job |
| `wheel_strategy.md` | Strategy explained in plain English |
| `trades.log` | Auto-generated trade/decision log |

## Strategy

1. **Sell Cash-Secured Puts** on TSLA/MSTR — collect premium, ~30 delta, ~30 DTE
2. **If assigned** → own the stock at a discount
3. **Sell Covered Calls** — collect premium until called away
4. **Repeat** — compounding premium income

## Flags

```
--status    Print account/positions/orders and exit
--once      Single cycle (market check + action), then exit
--execute   Place real orders (paper account by default)
--loop      Continuous loop every 6 hours
```

Default (no flags) = loop mode + dry run.

## Logs

All decisions logged to `trades.log`. Tail it:
```powershell
Get-Content trades.log -Wait
```
