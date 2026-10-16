# The Wheel Strategy — Plain English

## What Is It?

The Wheel is a **systematic income strategy** for stocks you'd be happy to own long-term. Instead of just buying and holding, you rent out the right to buy your stock — collecting premium income whether the market goes up, down, or sideways.

It's called "the wheel" because it has two phases that cycle continuously:

```
Phase 1: Sell Cash-Secured Puts
        ↓  (if assigned = stock bought)
Phase 2: Sell Covered Calls
        ↓  (if called away = stock sold)
        ↑  (loop back to Phase 1)
```

---

## Phase 1: Selling Cash-Secured Puts (CSP)

**What you're doing:** You promise to buy 100 shares at a specific price (the "strike price") by a specific date. In exchange, someone pays you cash upfront (the "premium").

**Example with TSLA at $250:**
- You sell a put with a $230 strike, 30 days out
- You collect $400 in premium immediately
- You set aside $23,000 in cash as collateral (100 shares × $230)

**Two outcomes:**
1. **TSLA stays above $230** → Put expires worthless. You keep the $400. Start over.
2. **TSLA drops below $230** → You buy 100 shares at $230. Your effective cost: $230 - $4/share = **$226/share** (premium lowers your cost basis).

**Why it works:** You only pick stocks you'd genuinely want to own. If you get assigned, you're not upset — you just own a good stock at a discount.

---

## Phase 2: Selling Covered Calls (CC)

**What you're doing:** You own 100 shares and you promise to sell them at a specific price by a specific date. Someone pays you cash for that right.

**Example — you now own 100 TSLA at $226 cost basis:**
- TSLA is now at $235
- You sell a call with a $245 strike, 30 days out
- You collect $350 in premium immediately

**Two outcomes:**
1. **TSLA stays below $245** → Call expires worthless. You keep $350. Sell another call next month.
2. **TSLA rises above $245** → Your shares are called away at $245. You made: ($245 - $226) × 100 + $350 = **$2,250 profit**. Go back to Phase 1.

---

## Why This Strategy Beats Just Holding

| Scenario | Just Holding | Wheel Strategy |
|----------|-------------|----------------|
| Stock goes up | ✅ Profit | ✅ Profit (capped) + premium income |
| Stock goes sideways | 😐 Nothing | ✅ Collect premium both phases |
| Stock goes down | ❌ Unrealized loss | 😐 Own it at a lower cost basis |

The wheel underperforms in **extreme bull runs** (calls cap your upside) but outperforms in flat and mildly bearish markets.

---

## The Numbers: Why TSLA and MSTR?

Both are **high IV (implied volatility)** stocks. High IV = higher option premiums = more income.

**Rough monthly yields:**
- TSLA: 3–8% monthly premium on CSPs (depending on market conditions)
- MSTR: 5–15% monthly (very high IV due to Bitcoin exposure)

**Annualized that's 36–90%+ in premium income** — on top of any stock appreciation.

> ⚠️ High IV = high reward AND high risk. These stocks can move 20-30% in a month. Only run this on stocks you're genuinely comfortable owning.

---

## Strike Selection — How the Bot Picks

**For Cash-Secured Puts:**
- Target ~30 delta (roughly 30% chance of ending in-the-money)
- Strike ~5-8% below current price (out-of-the-money buffer)
- Expiration ~30 days out (sweet spot for theta decay)

**For Covered Calls:**
- Target ~30 delta
- Strike ~5% above your cost basis (profit if called away)
- Expiration ~30 days out

**Why 30 delta?** It's the "Goldilocks zone" — high enough premium to matter, low enough to expire worthless most of the time (~70% probability).

---

## Risk Management Rules

1. **Only sell puts on stocks you'd own** — never speculate with the wheel
2. **Keep full cash collateral** — never margin on CSPs
3. **Profit take at 50%** — close the position when you've made half the max profit (capture it and move on)
4. **Roll before expiry** — if a put goes deep ITM, roll it out to a further expiration rather than take assignment at a terrible price
5. **One position per stock** — don't layer multiple expirations until experienced
6. **Position size** — never more than 10-15% of portfolio in one underlying

---

## Real Talk: The Risks

**Assignment risk:** Stock can drop 30-40%. You'll own it at a loss. Plan for this.

**Gap risk:** Stocks can gap down overnight (earnings, news). Your put could go from OTM to deep ITM overnight.

**Opportunity cost:** You'll miss big upside moves. Covered calls cap your gains.

**Capital intensive:** One contract = 100 shares. At TSLA $250, one CSP requires $23,000+ collateral. Start with smaller positions.

---

## The Mental Model

Think of yourself as an **insurance company**, not a trader.

- Insurance companies collect premiums continuously
- They pay out occasionally when bad events happen
- Over time, they make money because premiums exceed payouts
- They only insure things they've carefully evaluated

That's the wheel. Collect premium. Get assigned occasionally. Sell calls to recover. Repeat.

The edge is **time decay (theta)** — options lose value as expiration approaches. You're on the right side of that.

---

## Key Terms Glossary

| Term | Meaning |
|------|---------|
| **Option contract** | Right to buy (call) or sell (put) 100 shares at a set price |
| **Strike price** | The price the option is exercised at |
| **Premium** | The cash you collect for selling an option |
| **Expiration date** | When the option contract ends |
| **ITM (In the Money)** | Put: stock below strike. Call: stock above strike |
| **OTM (Out of the Money)** | Opposite of ITM — option likely expires worthless |
| **Delta** | Probability-ish metric: 0.30 delta = ~30% chance of expiring ITM |
| **Theta** | Time decay — how much an option loses value per day |
| **IV (Implied Volatility)** | Market's expectation of future volatility — higher IV = higher premiums |
| **Assignment** | Your obligation gets exercised — you buy or sell shares |
| **Roll** | Buy back your option and sell a new one at a different strike/date |
| **DTE** | Days to expiration |

---

## Getting Started Checklist

- [ ] Open Alpaca paper trading account
- [ ] Enable options trading in account settings
- [ ] Start with $100K paper account
- [ ] Run bot in dry-run mode for 1-2 weeks — watch what it would do
- [ ] Enable `--execute` flag on paper account
- [ ] Run for 1-3 months, track P&L
- [ ] Review results before touching real money

**Paper trade for at least 3 months before using real money.**
