#!/usr/bin/env python3
"""
analytics.py — Analytics reporter for Plausible and GA4.
Plausible: no OAuth needed (API key only).
GA4: uses GOOGLE_APPLICATION_CREDENTIALS or ga4-data-api skill.
"""
import argparse
import json
import os
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

try:
    import urllib.request
    import urllib.parse
    import urllib.error
except ImportError:
    pass

PLAUSIBLE_KEY     = os.environ.get("PLAUSIBLE_API_KEY", "")
PLAUSIBLE_SITE    = os.environ.get("PLAUSIBLE_SITE_ID", "")
GA4_PROPERTY      = os.environ.get("GA4_PROPERTY_ID", "")
MEMORY            = Path("memory")

def plausible_get(endpoint, params=None):
    if not PLAUSIBLE_KEY or not PLAUSIBLE_SITE:
        return None
    url = f"https://plausible.io/api/v1/{endpoint}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {PLAUSIBLE_KEY}"})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read().decode())
    except Exception as e:
        return {"error": str(e)}

def date_range(days):
    end   = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    start = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
    return start, end

def cmd_summary(args):
    days = args.days or 7
    start, end = date_range(days)
    prev_start = (datetime.now(timezone.utc) - timedelta(days=days*2)).strftime("%Y-%m-%d")
    prev_end   = (datetime.now(timezone.utc) - timedelta(days=days+1)).strftime("%Y-%m-%d")

    if PLAUSIBLE_KEY and PLAUSIBLE_SITE:
        # Current period
        params = {"site_id": PLAUSIBLE_SITE, "period": "custom",
                  "date": f"{start},{end}", "metrics": "visitors,pageviews,bounce_rate,visit_duration"}
        curr = plausible_get("stats/aggregate", params)

        # Previous period
        params["date"] = f"{prev_start},{prev_end}"
        prev = plausible_get("stats/aggregate", params)

        def val(data, key):
            return data.get("results", {}).get(key, {}).get("value", 0) if data else 0

        def pct_change(curr_v, prev_v):
            if prev_v == 0:
                return "n/a"
            change = ((curr_v - prev_v) / prev_v) * 100
            return f"{'+' if change >= 0 else ''}{change:.0f}%"

        visitors   = val(curr, "visitors")
        pageviews  = val(curr, "pageviews")
        bounce     = val(curr, "bounce_rate")
        duration   = val(curr, "visit_duration")
        p_visitors = val(prev, "visitors")
        p_views    = val(prev, "pageviews")

        print(f"\nTraffic Summary — Last {days} days (vs. prior {days} days)\n")
        print(f"  Visitors:    {visitors:,}  ({pct_change(visitors, p_visitors)})")
        print(f"  Page views:  {pageviews:,}  ({pct_change(pageviews, p_views)})")
        print(f"  Bounce rate: {bounce}%")
        mins = duration // 60
        secs = duration % 60
        print(f"  Avg session: {mins}m {secs}s")

        # Top pages
        pages_params = {"site_id": PLAUSIBLE_SITE, "period": "custom",
                        "date": f"{start},{end}", "property": "event:page", "limit": "5"}
        pages = plausible_get("stats/breakdown", pages_params)
        if pages and "results" in pages:
            print("\n  Top pages:")
            for p in pages["results"][:5]:
                print(f"    {p.get('page','?'):<30} {p.get('visitors',0):,} visitors")

        # Sources
        src_params = {"site_id": PLAUSIBLE_SITE, "period": "custom",
                      "date": f"{start},{end}", "property": "visit:source", "limit": "5"}
        sources = plausible_get("stats/breakdown", src_params)
        if sources and "results" in sources:
            print("\n  Top sources:")
            total_v = visitors or 1
            for s in sources["results"][:5]:
                pct = (s.get("visitors", 0) / total_v) * 100
                print(f"    {s.get('source','?'):<20} {pct:.0f}%")

    else:
        print("No analytics provider configured.")
        print("Set PLAUSIBLE_API_KEY + PLAUSIBLE_SITE_ID, or use ga4-data-api skill for GA4.")

def cmd_daily(args):
    days = 1
    start, end = date_range(days)

    report = f"# Analytics — {end}\n\n"

    if PLAUSIBLE_KEY and PLAUSIBLE_SITE:
        params = {"site_id": PLAUSIBLE_SITE, "period": "day", "date": end,
                  "metrics": "visitors,pageviews,bounce_rate"}
        data = plausible_get("stats/aggregate", params)
        res  = data.get("results", {}) if data else {}
        report += f"**Visitors:** {res.get('visitors',{}).get('value',0)}\n"
        report += f"**Page views:** {res.get('pageviews',{}).get('value',0)}\n"
        report += f"**Bounce rate:** {res.get('bounce_rate',{}).get('value',0)}%\n"
    else:
        report += "No analytics provider configured.\n"

    MEMORY.mkdir(exist_ok=True)
    out = MEMORY / f"analytics-{end}.md"
    out.write_text(report, encoding="utf-8")
    print(f"[OK] Daily report saved: {out}")

def cmd_top_pages(args):
    if not (PLAUSIBLE_KEY and PLAUSIBLE_SITE):
        print("Plausible credentials required.")
        return
    days = args.days or 30
    start, end = date_range(days)
    params = {"site_id": PLAUSIBLE_SITE, "period": "custom",
              "date": f"{start},{end}", "property": "event:page",
              "limit": str(args.limit or 10)}
    data = plausible_get("stats/breakdown", params)
    pages = data.get("results", []) if data else []
    print(f"\nTop {len(pages)} pages — Last {days} days\n")
    for p in pages:
        print(f"  {p.get('page','?'):<40} {p.get('visitors',0):,} visitors")

def cmd_sources(args):
    if not (PLAUSIBLE_KEY and PLAUSIBLE_SITE):
        print("Plausible credentials required.")
        return
    days = args.days or 7
    start, end = date_range(days)
    params = {"site_id": PLAUSIBLE_SITE, "period": "custom",
              "date": f"{start},{end}", "property": "visit:source", "limit": "10"}
    data = plausible_get("stats/breakdown", params)
    sources = data.get("results", []) if data else []
    print(f"\nTraffic sources — Last {days} days\n")
    for s in sources:
        print(f"  {s.get('source','?'):<25} {s.get('visitors',0):,} visitors")

def main():
    p = argparse.ArgumentParser(description="Analytics reporter")
    sub = p.add_subparsers(dest="command")

    sm = sub.add_parser("summary")
    sm.add_argument("--days", type=int, default=7)

    sub.add_parser("daily")

    tp = sub.add_parser("top-pages")
    tp.add_argument("--days", type=int, default=30)
    tp.add_argument("--limit", type=int, default=10)

    sr = sub.add_parser("sources")
    sr.add_argument("--days", type=int, default=7)

    args = p.parse_args()
    dispatch = {"summary": cmd_summary, "daily": cmd_daily,
                "top-pages": cmd_top_pages, "sources": cmd_sources}
    if args.command in dispatch:
        dispatch[args.command](args)
    else:
        p.print_help()

if __name__ == "__main__":
    main()
