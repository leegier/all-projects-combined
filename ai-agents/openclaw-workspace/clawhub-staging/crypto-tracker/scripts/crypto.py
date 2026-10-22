#!/usr/bin/env python3
"""crypto.py — Crypto price tracker via CoinGecko (no API key needed)."""
import argparse, json
from datetime import datetime, timezone
from pathlib import Path
try:
    import urllib.request, urllib.error
except: pass

MEMORY   = Path("memory")
HOLDINGS = MEMORY / "crypto-holdings.json"
ALERTS   = MEMORY / "crypto-alerts.json"
BASE     = "https://api.coingecko.com/api/v3"

def cg(endpoint, params=None):
    from urllib.parse import urlencode
    url = f"{BASE}/{endpoint}"
    if params: url += "?" + urlencode(params)
    req = urllib.request.Request(url, headers={"Accept":"application/json","User-Agent":"CryptoTracker/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=12) as r:
            return json.loads(r.read().decode())
    except Exception as e:
        return {"error": str(e)}

def get_prices(coins, currency="usd"):
    return cg("simple/price", {"ids": ",".join(coins), "vs_currencies": currency,
                                "include_24hr_change": "true"})

def cmd_prices(args):
    coins    = [c.strip().lower() for c in (args.coins or "bitcoin,ethereum").split(",")]
    currency = args.currency or "usd"
    data     = get_prices(coins, currency)
    if "error" in data:
        print(f"Error: {data['error']}"); return
    print(f"\nPrices ({currency.upper()})\n")
    for coin in coins:
        d   = data.get(coin, {})
        prc = d.get(currency, 0)
        chg = d.get(f"{currency}_24h_change", 0)
        sign = "+" if chg >= 0 else ""
        print(f"  {coin.capitalize():<15} ${prc:>12,.2f}   {sign}{chg:.1f}% (24h)")

def cmd_portfolio(args):
    if not HOLDINGS.exists():
        print("No holdings file. Create memory/crypto-holdings.json:")
        print('  {"bitcoin": 0.05, "ethereum": 1.2}'); return
    holdings = json.loads(HOLDINGS.read_text())
    coins    = list(holdings.keys())
    data     = get_prices(coins)
    if "error" in data:
        print(f"Error fetching prices: {data['error']}"); return
    total = 0
    print("\nPortfolio Summary\n")
    for coin, amount in holdings.items():
        d   = data.get(coin, {})
        prc = d.get("usd", 0)
        val = prc * amount
        chg = d.get("usd_24h_change", 0)
        total += val
        print(f"  {coin.capitalize():<15} ({amount} {coin[:3].upper()}): ${val:>10,.2f}  ({'+' if chg>=0 else ''}{chg:.1f}%)")
    print(f"\n  Total: ${total:,.2f}")
    # Check alerts
    alerts = json.loads(ALERTS.read_text()) if ALERTS.exists() else []
    for a in alerts:
        coin_price = data.get(a["coin"], {}).get("usd", 0)
        if a.get("above") and coin_price > a["above"]:
            print(f"\n  [ALERT] {a['coin']} above ${a['above']:,.0f} — current: ${coin_price:,.2f}")
        if a.get("below") and coin_price < a["below"]:
            print(f"\n  [ALERT] {a['coin']} below ${a['below']:,.0f} — current: ${coin_price:,.2f}")

def cmd_alert(args):
    MEMORY.mkdir(exist_ok=True)
    alerts = json.loads(ALERTS.read_text()) if ALERTS.exists() else []
    entry  = {"coin": args.coin.lower()}
    if args.above: entry["above"] = args.above
    if args.below: entry["below"] = args.below
    # Remove existing alert for this coin+direction
    alerts = [a for a in alerts if not (a["coin"] == entry["coin"] and
              ("above" in entry and "above" in a or "below" in entry and "below" in a))]
    alerts.append(entry)
    ALERTS.write_text(json.dumps(alerts, indent=2))
    detail = f"above ${args.above:,}" if args.above else f"below ${args.below:,}"
    print(f"[OK] Alert set: {args.coin} {detail}")

def cmd_daily(args):
    if not HOLDINGS.exists():
        print("No holdings configured."); return
    holdings = json.loads(HOLDINGS.read_text())
    data     = get_prices(list(holdings.keys()))
    total    = sum(data.get(c,{}).get("usd",0) * amt for c, amt in holdings.items())
    date     = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    report   = f"# Crypto — {date}\n\n**Total: ${total:,.2f}**\n\n"
    for coin, amount in holdings.items():
        prc = data.get(coin,{}).get("usd",0)
        report += f"- {coin}: ${prc:,.2f} × {amount} = ${prc*amount:,.2f}\n"
    out = MEMORY / f"crypto-{date}.md"
    MEMORY.mkdir(exist_ok=True)
    out.write_text(report)
    print(f"[OK] Daily report: {out} (Total: ${total:,.2f})")

def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="command")
    pr = sub.add_parser("prices"); pr.add_argument("--coins",default="bitcoin,ethereum"); pr.add_argument("--currency",default="usd")
    sub.add_parser("portfolio"); sub.add_parser("daily")
    al = sub.add_parser("alert"); al.add_argument("--coin",required=True); al.add_argument("--above",type=float); al.add_argument("--below",type=float)
    args = p.parse_args()
    {"prices":cmd_prices,"portfolio":cmd_portfolio,"alert":cmd_alert,"daily":cmd_daily}.get(args.command, lambda _:p.print_help())(args)

if __name__ == "__main__": main()
