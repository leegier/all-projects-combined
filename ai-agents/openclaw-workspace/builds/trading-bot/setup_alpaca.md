# Alpaca Paper Trading — Setup Guide

## Step 1: Create a Free Alpaca Account

1. Go to **https://alpaca.markets**
2. Click **"Get Started for Free"**
3. Sign up with your email
4. Verify your email address
5. Complete the onboarding form (US only; basic personal info)
6. You'll land on the Alpaca dashboard

> **Paper trading is completely free** — no real money, no brokerage approval needed.

---

## Step 2: Get Your API Keys

1. In the Alpaca dashboard, click **"Paper Trading"** in the left sidebar
   - This switches you to the paper trading environment
2. Click **"API Keys"** (or the key icon in the top right)
3. Click **"+ Generate New Key"**
4. **Copy both values immediately** — the secret is shown only once:
   - **API Key ID** (starts with `PK...`)
   - **API Secret Key** (long alphanumeric string)
5. Store them somewhere safe (password manager recommended)

> ⚠️ If you lose the secret key, you must regenerate a new pair.

---

## Step 3: Configure the Bot

1. Navigate to the bot directory:
   ```
   cd Z:\openclaw\workspace\builds\trading-bot
   ```

2. Copy the example env file:
   ```
   copy .env.example .env
   ```

3. Open `.env` in a text editor and fill in your keys:
   ```
   ALPACA_API_KEY=PKxxxxxxxxxxxxxxxx
   ALPACA_API_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ALPACA_BASE_URL=https://paper-api.alpaca.markets
   ```

---

## Step 4: Install Dependencies

The bot uses only Python standard library + `requests`. Install requests if needed:

```bash
pip install requests
```

Verify Python is installed:
```bash
python --version
# Should be Python 3.8+
```

---

## Step 5: Run the Bot

### Dry Run (default — safe, no orders placed)
```bash
python trading_bot.py
```

### Status Report Only
```bash
python trading_bot.py --status
```

### Single Check (for cron/OpenClaw scheduling)
```bash
python trading_bot.py --once
```

### Enable Real Order Placement (paper trading)
```bash
python trading_bot.py --execute
```
> This places real orders on your **paper trading** account. No real money involved.

### Continuous Loop Mode (runs every 6 hours)
```bash
python trading_bot.py --loop
```

---

## Step 6: Set Up as OpenClaw Cron Job

### Option A: Via OpenClaw CLI (recommended)

Add to your OpenClaw config to run every 6 hours during market hours:

```bash
openclaw cron add \
  --schedule "0 8,14,20 * * 1-5" \
  --command "python Z:\openclaw\workspace\builds\trading-bot\trading_bot.py --once --execute" \
  --label "wheel-bot"
```

Schedule breakdown:
- `0 8,14,20 * * 1-5` = Run at 8am, 2pm, 8pm on weekdays (Mon–Fri)
- Adjust times to your timezone

### Option B: Windows Task Scheduler

1. Open Task Scheduler (search in Start Menu)
2. Create Basic Task:
   - **Name:** Wheel Bot
   - **Trigger:** Daily, repeat every 6 hours
   - **Action:** Start a program
     - Program: `python`
     - Arguments: `Z:\openclaw\workspace\builds\trading-bot\trading_bot.py --once --execute`
     - Start in: `Z:\openclaw\workspace\builds\trading-bot`

### Option C: Manual cron entry (via openclaw.json)

Add to your crons in `openclaw.json`:
```json
{
  "crons": [
    {
      "id": "wheel-bot",
      "schedule": "0 */6 * * 1-5",
      "command": "python Z:\\openclaw\\workspace\\builds\\trading-bot\\trading_bot.py --once --execute",
      "label": "Wheel Strategy Bot"
    }
  ]
}
```

---

## Step 7: Monitor the Bot

All trades and decisions are logged to:
```
Z:\openclaw\workspace\builds\trading-bot\trades.log
```

Tail the log in real time (PowerShell):
```powershell
Get-Content trades.log -Wait
```

---

## Notes on Options Trading with Alpaca

- Alpaca supports **options trading** on paper accounts
- You need to enable options in your account settings under **"Trading" → "Options"**
- The paper account comes pre-funded with **$100,000 virtual cash**
- Options require Level 2 approval on live accounts (not needed for paper)

---

## Upgrading to Live Trading (When Ready)

1. Complete full Alpaca account verification (ID, SSN, etc.)
2. Fund your account
3. Request options trading approval (Level 2 for CSPs/CCs)
4. Change your `.env`:
   ```
   ALPACA_BASE_URL=https://api.alpaca.markets
   ```
5. Use live API keys (generate separately from paper keys)

> ⚠️ **This involves real money. Start with paper trading for at least 3 months.**
