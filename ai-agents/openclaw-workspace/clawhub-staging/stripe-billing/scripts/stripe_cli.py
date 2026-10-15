#!/usr/bin/env python3
"""
stripe_cli.py — Stripe API client for OpenClaw billing.
Requires: STRIPE_SECRET_KEY env var
Docs: https://stripe.com/docs/api
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
    import base64
except ImportError:
    pass

KEY = os.environ.get("STRIPE_SECRET_KEY", "")
BASE = "https://api.stripe.com/v1"

def require_key():
    if not KEY:
        print("ERROR: STRIPE_SECRET_KEY env var required.")
        print("Get it at: https://dashboard.stripe.com/apikeys")
        sys.exit(1)

def api(method, endpoint, data=None):
    require_key()
    url = f"{BASE}/{endpoint}"
    auth = base64.b64encode(f"{KEY}:".encode()).decode()
    headers = {
        "Authorization": f"Basic {auth}",
        "Content-Type": "application/x-www-form-urlencoded",
        "Stripe-Version": "2024-04-10",
    }

    body = None
    if method == "GET" and data:
        url += "?" + urllib.parse.urlencode(data)
    elif data:
        body = urllib.parse.urlencode(data).encode()

    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        err = json.loads(e.read().decode())
        msg = err.get("error", {}).get("message", str(e))
        print(f"Stripe API Error: {msg}")
        sys.exit(1)

def get_or_create_customer(email, name=""):
    """Find existing customer by email or create new one."""
    result = api("GET", "customers", {"email": email, "limit": 1})
    customers = result.get("data", [])
    if customers:
        return customers[0]
    # Create new
    data = {"email": email}
    if name:
        data["name"] = name
    return api("POST", "customers", data)

# ── Commands ───────────────────────────────────────────────────────────────

def cmd_payment_link(args):
    """Create a Stripe Payment Link."""
    # Create product + price inline
    product = api("POST", "products", {"name": args.description or "Payment"})
    price = api("POST", "prices", {
        "unit_amount": str(args.amount),
        "currency": args.currency or "usd",
        "product": product["id"],
    })
    link = api("POST", "payment_links", {
        "line_items[0][price]": price["id"],
        "line_items[0][quantity]": "1",
    })
    print(f"[OK] Payment link created:")
    print(f"     Amount: ${args.amount/100:.2f} {(args.currency or 'usd').upper()}")
    print(f"     Link:   {link['url']}")
    print(f"     ID:     {link['id']}")

def cmd_invoice(args):
    """Create and send an invoice to a customer."""
    customer = get_or_create_customer(args.customer_email, args.customer_name or "")
    cid = customer["id"]
    print(f"Customer: {customer.get('email')} ({cid})")

    # Create invoice item
    api("POST", "invoiceitems", {
        "customer": cid,
        "amount": str(args.amount),
        "currency": "usd",
        "description": args.description or "Services rendered",
    })

    # Create invoice
    due_date = int((datetime.now(timezone.utc) + timedelta(days=args.due_days or 7)).timestamp())
    invoice = api("POST", "invoices", {
        "customer": cid,
        "collection_method": "send_invoice",
        "due_date": str(due_date),
        "auto_advance": "true",
    })

    # Finalize and send
    inv_id = invoice["id"]
    api("POST", f"invoices/{inv_id}/finalize", {})
    api("POST", f"invoices/{inv_id}/send", {})

    print(f"[OK] Invoice sent to {args.customer_email}")
    print(f"     Amount: ${args.amount/100:.2f}")
    print(f"     Due:    {args.due_days or 7} days")
    print(f"     ID:     {inv_id}")

def cmd_subscription(args):
    """Subscribe a customer to a price."""
    customer = get_or_create_customer(args.customer_email)
    data = {
        "customer": customer["id"],
        "items[0][price]": args.price_id,
    }
    if args.trial_days and args.trial_days > 0:
        data["trial_period_days"] = str(args.trial_days)
    sub = api("POST", "subscriptions", data)
    print(f"[OK] Subscription created: {sub['id']}")
    print(f"     Status: {sub['status']}")
    print(f"     Customer: {args.customer_email}")

def cmd_report(args):
    """Revenue report for the last N days."""
    days = args.days or 30
    since = int((datetime.now(timezone.utc) - timedelta(days=days)).timestamp())
    charges = api("GET", "charges", {"created[gte]": str(since), "limit": "100"})
    data = charges.get("data", [])

    succeeded = [c for c in data if c["status"] == "succeeded" and not c.get("refunded")]
    refunded  = [c for c in data if c.get("amount_refunded", 0) > 0]
    gross     = sum(c["amount"] for c in succeeded) / 100
    ref_amt   = sum(c["amount_refunded"] for c in refunded) / 100
    net       = gross - ref_amt

    print(f"\nStripe Revenue — Last {days} days")
    print(f"  Charges:   {len(succeeded)}")
    print(f"  Gross:     ${gross:,.2f}")
    print(f"  Refunds:   ${ref_amt:,.2f}")
    print(f"  Net:       ${net:,.2f}")

    report = f"# Stripe Report — {datetime.now(timezone.utc).strftime('%Y-%m-%d')}\n\n"
    report += f"**Period:** Last {days} days\n"
    report += f"**Gross:** ${gross:,.2f}\n**Refunds:** ${ref_amt:,.2f}\n**Net:** ${net:,.2f}\n\n"
    report += "## Charges\n\n"
    for c in succeeded[:20]:
        dt = datetime.fromtimestamp(c["created"], tz=timezone.utc).strftime("%Y-%m-%d")
        report += f"- {dt} | ${c['amount']/100:.2f} | {c.get('description','')[:50]}\n"

    rp = Path("memory/stripe-report.md")
    rp.parent.mkdir(exist_ok=True)
    rp.write_text(report)
    print(f"\n  Report saved: {rp}")

def cmd_refund(args):
    """Issue a refund on a charge."""
    data = {"charge": args.charge_id}
    if args.amount:
        data["amount"] = str(args.amount)
    refund = api("POST", "refunds", data)
    print(f"[OK] Refund issued: {refund['id']}")
    print(f"     Amount: ${refund['amount']/100:.2f}")
    print(f"     Status: {refund['status']}")

def cmd_charges(args):
    """List recent charges."""
    result = api("GET", "charges", {"limit": str(args.limit or 10)})
    charges = result.get("data", [])
    print(f"\n{'Date':<12} {'Amount':>10} {'Status':<12} {'Description'}")
    print("-" * 70)
    for c in charges:
        dt = datetime.fromtimestamp(c["created"], tz=timezone.utc).strftime("%Y-%m-%d")
        amt = f"${c['amount']/100:.2f}"
        print(f"{dt:<12} {amt:>10} {c['status']:<12} {(c.get('description') or '')[:35]}")

# ── Main ───────────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser(description="Stripe billing CLI")
    sub = p.add_subparsers(dest="command")

    pl = sub.add_parser("payment-link")
    pl.add_argument("--amount", type=int, required=True, help="Amount in cents")
    pl.add_argument("--description")
    pl.add_argument("--currency", default="usd")

    inv = sub.add_parser("invoice")
    inv.add_argument("--customer-email", required=True)
    inv.add_argument("--customer-name")
    inv.add_argument("--amount", type=int, required=True, help="Amount in cents")
    inv.add_argument("--description")
    inv.add_argument("--due-days", type=int, default=7)

    sb = sub.add_parser("subscription")
    sb.add_argument("--customer-email", required=True)
    sb.add_argument("--price-id", required=True)
    sb.add_argument("--trial-days", type=int, default=0)

    rp = sub.add_parser("report")
    rp.add_argument("--days", type=int, default=30)

    rf = sub.add_parser("refund")
    rf.add_argument("--charge-id", required=True)
    rf.add_argument("--amount", type=int, help="Partial refund in cents (omit for full)")

    ch = sub.add_parser("charges")
    ch.add_argument("--limit", type=int, default=10)

    args = p.parse_args()
    dispatch = {
        "payment-link": cmd_payment_link, "invoice": cmd_invoice,
        "subscription": cmd_subscription, "report": cmd_report,
        "refund": cmd_refund, "charges": cmd_charges,
    }
    if args.command in dispatch:
        dispatch[args.command](args)
    else:
        p.print_help()

if __name__ == "__main__":
    main()
