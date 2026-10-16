#!/usr/bin/env python3
"""deals.py — Software deal finder and ROI calculator."""
import argparse, json, re, uuid
from datetime import datetime, timezone
from pathlib import Path
try:
    import urllib.request, urllib.error
except: pass

WATCHLIST = Path("memory/deal-watchlist.json")
MEMORY = Path("memory")

def fetch(url):
    try:
        req = urllib.request.Request(url, headers={"User-Agent":"Mozilla/5.0 (DealFinder/1.0)"})
        with urllib.request.urlopen(req, timeout=12) as r:
            return r.read().decode("utf-8", errors="replace")
    except Exception as e:
        return f"ERROR:{e}"

def cmd_browse(args):
    category = args.category or "developer-tools"
    slug = category.lower().replace(" ", "-")
    print(f"Browsing AppSumo — {category}\n")
    html = fetch(f"https://appsumo.com/collections/{slug}/")
    if html.startswith("ERROR"):
        print(f"  Could not fetch AppSumo. Browse manually: https://appsumo.com/collections/{slug}/")
        print("  Also check: https://pitchground.com and https://stacksocial.com")
        return
    # Extract deal titles and prices from page
    titles = re.findall(r'"name":\s*"([^"]{10,80})"', html)[:args.limit or 10]
    prices = re.findall(r'"price":\s*"?\$?(\d+(?:\.\d+)?)"?', html)[:args.limit or 10]
    if titles:
        print(f"  Found {len(titles)} deals:\n")
        for i, t in enumerate(titles):
            price = f"${prices[i]}" if i < len(prices) else "see site"
            print(f"  {i+1:2}. {t[:60]} — {price}")
    else:
        print(f"  AppSumo page loaded but no structured data found.")
        print(f"  Browse manually: https://appsumo.com/collections/{slug}/")

def cmd_search(args):
    query = args.query or ""
    print(f"Searching for deals: {query}\n")
    print(f"  AppSumo:     https://appsumo.com/search/?query={query.replace(' ', '+')}")
    print(f"  PitchGround: https://pitchground.com/?s={query.replace(' ', '+')}")
    print(f"  StackSocial: https://stacksocial.com/search?utf8=yes&q={query.replace(' ', '+')}")
    print(f"\n  Tip: Use the ROI calculator (deals.py roi) before buying any LTD.")

def cmd_roi(args):
    ltv = args.lifetime_price
    mo  = args.monthly_price
    use = args.months_you_plan_to_use or 24
    if mo <= 0:
        print("Monthly price must be > 0"); return
    breakeven = ltv / mo
    savings   = (mo * use) - ltv
    verdict   = "STRONG BUY" if breakeven <= 3 else ("GOOD BUY" if breakeven <= 6 else "CONSIDER CAREFULLY")
    print(f"\nROI Analysis")
    print(f"  Lifetime deal:  ${ltv:.2f}")
    print(f"  Monthly cost:   ${mo:.2f}/month")
    print(f"  Break-even:     {breakeven:.1f} months")
    print(f"  Savings over {use}mo: ${savings:.2f}")
    print(f"  Verdict:        {verdict}")
    if breakeven > 6:
        print(f"  Note: Only buy if you'll actively use it for {breakeven:.0f}+ months")

def cmd_save(args):
    MEMORY.mkdir(exist_ok=True)
    wl = json.loads(WATCHLIST.read_text()) if WATCHLIST.exists() else []
    wl.append({"id": str(uuid.uuid4())[:8], "name": args.name, "url": args.url or "",
                "price": args.price or 0, "category": args.category or "", "saved": datetime.now(timezone.utc).strftime("%Y-%m-%d")})
    WATCHLIST.write_text(json.dumps(wl, indent=2))
    print(f"[OK] Saved to watchlist: {args.name} (${args.price or '?'})")

def cmd_watchlist(args):
    if not WATCHLIST.exists():
        print("Watchlist is empty."); return
    wl = json.loads(WATCHLIST.read_text())
    print(f"\nDeal Watchlist ({len(wl)} items)\n")
    for d in wl:
        print(f"  [{d['id']}] {d['name']:<40} ${d.get('price',0):<8} {d.get('category','')}")

def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="command")
    b = sub.add_parser("browse"); b.add_argument("--category"); b.add_argument("--limit", type=int)
    s = sub.add_parser("search"); s.add_argument("--query")
    r = sub.add_parser("roi"); r.add_argument("--lifetime-price",type=float,required=True); r.add_argument("--monthly-price",type=float,required=True); r.add_argument("--months-you-plan-to-use",type=int,default=24)
    sv = sub.add_parser("save"); sv.add_argument("--name",required=True); sv.add_argument("--url"); sv.add_argument("--price",type=float); sv.add_argument("--category")
    sub.add_parser("watchlist")
    args = p.parse_args()
    {"browse":cmd_browse,"search":cmd_search,"roi":cmd_roi,"save":cmd_save,"watchlist":cmd_watchlist}.get(args.command, lambda _:p.print_help())(args)

if __name__ == "__main__": main()
