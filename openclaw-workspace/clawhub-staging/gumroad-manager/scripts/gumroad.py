#!/usr/bin/env python3
"""
gumroad.py — Gumroad API v2 client for OpenClaw skills.
Requires: GUMROAD_ACCESS_TOKEN env var
Docs: https://app.gumroad.com/api
"""
import argparse
import os
import sys
import json
from datetime import datetime, timedelta
from pathlib import Path
try:
    import urllib.request
    import urllib.parse
    import urllib.error
except ImportError:
    pass

TOKEN = os.environ.get("GUMROAD_ACCESS_TOKEN", "")
BASE  = "https://api.gumroad.com/v2"

def require_token():
    if not TOKEN:
        print("ERROR: GUMROAD_ACCESS_TOKEN env var required.")
        print("Get it at: https://app.gumroad.com/settings/advanced")
        sys.exit(1)

def api(method, endpoint, data=None):
    require_token()
    url = f"{BASE}/{endpoint}"
    params = {"access_token": TOKEN}
    if data:
        params.update(data)

    encoded = urllib.parse.urlencode(params).encode()
    req = urllib.request.Request(url, data=encoded if method == "POST" else None)
    req.add_header("Content-Type", "application/x-www-form-urlencoded")

    if method == "GET":
        url += "?" + urllib.parse.urlencode(params)
        req = urllib.request.Request(url)

    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"API Error {e.code}: {body}")
        sys.exit(1)

def cmd_products(args):
    res = api("GET", "products")
    products = res.get("products", [])
    if not products:
        print("No products found.")
        return
    print(f"{'ID':<20} {'Name':<35} {'Price':<10} {'Sales'}")
    print("-" * 75)
    for p in products:
        price = f"${p.get('price', 0)/100:.2f}"
        print(f"{p['id']:<20} {p['name'][:34]:<35} {price:<10} {p.get('sales_count', 0)}")

def cmd_sales(args):
    days = args.days or 30
    after = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")
    res = api("GET", "sales", {"after": after})
    sales = res.get("sales", [])

    total_revenue = sum(s.get("price", 0) for s in sales) / 100
    print(f"\nLast {days} days:")
    print(f"  Total sales:   {len(sales)}")
    print(f"  Revenue:       ${total_revenue:.2f}")
    if sales:
        print(f"  Avg per sale:  ${total_revenue/len(sales):.2f}")

    # Group by product
    by_product = {}
    for s in sales:
        pid = s.get("product_permalink", "unknown")
        pname = s.get("product_name", "unknown")
        by_product.setdefault(pid, {"name": pname, "count": 0, "revenue": 0})
        by_product[pid]["count"] += 1
        by_product[pid]["revenue"] += s.get("price", 0) / 100

    if by_product:
        top = max(by_product.values(), key=lambda x: x["revenue"])
        print(f"\n  Top product: {top['name']} ({top['count']} sales, ${top['revenue']:.2f})")

    # Save report
    report_path = Path("memory/gumroad-report.md")
    report_path.parent.mkdir(exist_ok=True)
    with open(report_path, "w") as f:
        f.write(f"# Gumroad Report — {datetime.utcnow().strftime('%Y-%m-%d')}\n\n")
        f.write(f"**Period:** Last {days} days\n")
        f.write(f"**Sales:** {len(sales)}\n")
        f.write(f"**Revenue:** ${total_revenue:.2f}\n\n")
        f.write("## By Product\n\n")
        for pid, d in by_product.items():
            f.write(f"- **{d['name']}**: {d['count']} sales, ${d['revenue']:.2f}\n")
    print(f"\n  Report saved to {report_path}")

def cmd_create(args):
    data = {
        "name": args.name,
        "price": str(args.price),
    }
    if args.description:
        data["description"] = args.description
    res = api("POST", "products", data)
    p = res.get("product", {})
    print(f"✅ Created product: {p.get('name')}")
    print(f"   ID:  {p.get('id')}")
    print(f"   URL: {p.get('short_url')}")

def cmd_update(args):
    data = {}
    if args.price is not None:
        data["price"] = str(args.price)
    if args.name:
        data["name"] = args.name
    if args.description:
        data["description"] = args.description
    res = api("POST", f"products/{args.id}", data)
    p = res.get("product", {})
    print(f"✅ Updated: {p.get('name')} — ${p.get('price', 0)/100:.2f}")

def cmd_discount(args):
    data = {
        "name": args.code,
        "amount_off": str(args.percent) if args.percent else "0",
        "offer_type": "percent",
        "product_ids[]": args.id,
    }
    res = api("POST", "offer_codes", data)
    print(f"✅ Discount code created: {args.code} ({args.percent}% off)")

def cmd_notify(args):
    data = {
        "subject": args.subject,
        "message": args.message,
    }
    res = api("POST", f"products/{args.id}/notify_followers", data)
    print(f"✅ Notification sent to buyers of product {args.id}")

def main():
    p = argparse.ArgumentParser(description="Gumroad manager CLI")
    sub = p.add_subparsers(dest="command")

    sub.add_parser("products")

    sl = sub.add_parser("sales")
    sl.add_argument("--days", type=int, default=30)

    cr = sub.add_parser("create")
    cr.add_argument("--name", required=True)
    cr.add_argument("--price", type=int, required=True, help="Price in cents (999 = $9.99)")
    cr.add_argument("--description")

    up = sub.add_parser("update")
    up.add_argument("--id", required=True)
    up.add_argument("--name")
    up.add_argument("--price", type=int)
    up.add_argument("--description")

    dc = sub.add_parser("discount")
    dc.add_argument("--id", required=True)
    dc.add_argument("--code", required=True)
    dc.add_argument("--percent", type=int, default=50)

    nt = sub.add_parser("notify")
    nt.add_argument("--id", required=True)
    nt.add_argument("--subject", required=True)
    nt.add_argument("--message", required=True)

    args = p.parse_args()
    dispatch = {
        "products": cmd_products, "sales": cmd_sales, "create": cmd_create,
        "update": cmd_update, "discount": cmd_discount, "notify": cmd_notify,
    }
    if args.command in dispatch:
        dispatch[args.command](args)
    else:
        p.print_help()

if __name__ == "__main__":
    main()
