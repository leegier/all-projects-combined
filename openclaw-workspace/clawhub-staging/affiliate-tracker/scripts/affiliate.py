#!/usr/bin/env python3
"""
affiliate.py — Affiliate link tracker and commission reporter.
No external dependencies. All data in memory/affiliates.json.
"""
import argparse
import json
import re
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path

DATA_FILE = Path("memory/affiliates.json")
MEMORY    = Path("memory")

def today():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")

def load():
    if not DATA_FILE.exists():
        return {"links": [], "config": {"alert_threshold": 0}}
    return json.loads(DATA_FILE.read_text(encoding="utf-8"))

def save(data):
    MEMORY.mkdir(exist_ok=True)
    DATA_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")

def make_utm_link(base_url, program, product):
    """Append UTM parameters to a base URL."""
    sep = "&" if "?" in base_url else "?"
    prog_slug = re.sub(r"[^a-z0-9]", "-", program.lower())[:20]
    prod_slug  = re.sub(r"[^a-z0-9]", "-", product.lower())[:30]
    return f"{base_url}{sep}utm_source={prog_slug}&utm_medium=affiliate&utm_campaign={prod_slug}"

# ── Commands ───────────────────────────────────────────────────────────────

def cmd_add(args):
    data = load()
    link_id = str(uuid.uuid4())[:8]
    tracked_url = make_utm_link(args.base_url, args.program, args.product)
    entry = {
        "id": link_id,
        "program": args.program,
        "product": args.product,
        "base_url": args.base_url,
        "tracked_url": tracked_url,
        "tag": args.tag or "",
        "commission_rate": args.commission_rate or 0,
        "clicks": 0,
        "conversions": 0,
        "total_sales": 0.0,
        "total_commission": 0.0,
        "created": today(),
        "events": [],
    }
    data["links"].append(entry)
    save(data)
    print(f"[OK] Link added: [{link_id}] {args.product} ({args.program})")
    print(f"     Tracked URL: {tracked_url}")
    print(f"     Commission rate: {args.commission_rate or 0}%")

def cmd_list(args):
    data = load()
    links = data["links"]
    if args.program:
        links = [l for l in links if args.program.lower() in l["program"].lower()]
    if not links:
        print("No affiliate links found.")
        return
    print(f"\n{'ID':<10} {'Program':<22} {'Product':<30} {'Clicks':>7} {'Conv':>5} {'Commission':>12}")
    print("-" * 95)
    for l in links:
        print(f"{l['id']:<10} {l['program'][:21]:<22} {l['product'][:29]:<30} {l['clicks']:>7} {l['conversions']:>5} ${l['total_commission']:>10.2f}")

def _find_link(data, link_id):
    for l in data["links"]:
        if l["id"].startswith(link_id):
            return l
    return None

def cmd_log_click(args):
    data = load()
    link = _find_link(data, args.id)
    if not link:
        print(f"Link not found: {args.id}")
        return
    link["clicks"] += 1
    link["events"].append({"type": "click", "date": today()})
    save(data)
    print(f"[OK] Click logged for [{args.id}] {link['product']} (total: {link['clicks']})")

def cmd_log_conversion(args):
    data = load()
    link = _find_link(data, args.id)
    if not link:
        print(f"Link not found: {args.id}")
        return
    amount = args.amount or 0
    commission = amount * (link["commission_rate"] / 100)
    link["conversions"]    += 1
    link["total_sales"]    += amount
    link["total_commission"] += commission
    link["events"].append({"type": "conversion", "date": today(), "amount": amount, "commission": commission})
    save(data)
    print(f"[OK] Conversion: ${amount:.2f} sale → ${commission:.2f} commission for [{args.id}] {link['product']}")

def cmd_report(args):
    data = load()
    days = args.days or 30
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")

    # Group by program
    by_program = {}
    for l in data["links"]:
        prog = l["program"]
        if prog not in by_program:
            by_program[prog] = {"clicks": 0, "conversions": 0, "commission": 0.0}
        # Filter events by date
        recent_events = [e for e in l.get("events", []) if e.get("date", "") >= cutoff]
        by_program[prog]["clicks"]      += sum(1 for e in recent_events if e["type"] == "click")
        by_program[prog]["conversions"] += sum(1 for e in recent_events if e["type"] == "conversion")
        by_program[prog]["commission"]  += sum(e.get("commission", 0) for e in recent_events if e["type"] == "conversion")

    total = sum(p["commission"] for p in by_program.values())

    print(f"\nAffiliate Income — Last {days} days\n")
    for prog, stats in sorted(by_program.items(), key=lambda x: -x[1]["commission"]):
        if stats["clicks"] > 0 or stats["conversions"] > 0:
            print(f"  {prog:<25} ${stats['commission']:>8.2f}  ({stats['clicks']} clicks, {stats['conversions']} conversions)")
    print(f"\n  Total: ${total:.2f}")

    # Alert check
    threshold = data.get("config", {}).get("alert_threshold", 0)
    if threshold > 0 and total >= threshold:
        print(f"\n  [ALERT] Commission threshold reached: ${total:.2f} >= ${threshold:.2f}")

    # Save report
    rp = Path("memory/affiliate-report.md")
    rp.parent.mkdir(exist_ok=True)
    with open(rp, "w") as f:
        f.write(f"# Affiliate Report — {today()}\n\n**Period:** Last {days} days\n**Total:** ${total:.2f}\n\n")
        for prog, stats in sorted(by_program.items(), key=lambda x: -x[1]["commission"]):
            f.write(f"- **{prog}:** ${stats['commission']:.2f} ({stats['conversions']} conversions)\n")
    print(f"\n  Report saved: {rp}")

def cmd_alert(args):
    data = load()
    if "config" not in data:
        data["config"] = {}
    data["config"]["alert_threshold"] = args.threshold
    save(data)
    print(f"[OK] Alert threshold set: ${args.threshold:.2f}/month")

# ── Main ───────────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser(description="Affiliate link tracker")
    sub = p.add_subparsers(dest="command")

    ad = sub.add_parser("add")
    ad.add_argument("--program", required=True)
    ad.add_argument("--product", required=True)
    ad.add_argument("--base-url", required=True)
    ad.add_argument("--tag", help="Affiliate tag/ID (e.g. nightshade-20)")
    ad.add_argument("--commission-rate", type=float, default=0)

    ls = sub.add_parser("list")
    ls.add_argument("--program")

    lc = sub.add_parser("log-click")
    lc.add_argument("--id", required=True)

    cv = sub.add_parser("log-conversion")
    cv.add_argument("--id", required=True)
    cv.add_argument("--amount", type=float, required=True)

    rp = sub.add_parser("report")
    rp.add_argument("--days", type=int, default=30)

    al = sub.add_parser("alert")
    al.add_argument("--threshold", type=float, required=True)

    args = p.parse_args()
    dispatch = {
        "add": cmd_add, "list": cmd_list, "log-click": cmd_log_click,
        "log-conversion": cmd_log_conversion, "report": cmd_report, "alert": cmd_alert,
    }
    if args.command in dispatch:
        dispatch[args.command](args)
    else:
        p.print_help()

if __name__ == "__main__":
    main()
