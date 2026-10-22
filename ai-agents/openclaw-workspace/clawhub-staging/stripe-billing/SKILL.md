---
name: stripe-billing
description: Create payment links, invoices, subscriptions, and revenue reports via the Stripe API. Use when billing a client, setting up recurring payments, generating an invoice, creating a checkout link, issuing a refund, or checking revenue. Triggers on: "create an invoice", "send a payment link", "set up a subscription", "charge a client", "how much did I make on Stripe", "issue a refund", "create a checkout", or any Stripe billing task.
---

# stripe-billing

Bill clients and manage revenue via Stripe API v1.

## Setup

```
STRIPE_SECRET_KEY=sk_live_...   # or sk_test_... for testing
```

Get your key: https://dashboard.stripe.com/apikeys

Test mode first — use `sk_test_` key until ready to go live.

---

## Core Operations

### Create a Payment Link (fastest way to get paid)

```bash
python scripts/stripe_cli.py payment-link \
  --amount 80000 \
  --description "Unity consulting — 4 hours @ $200/hr" \
  --currency usd
```

Returns a Stripe-hosted URL. Send to client — they pay with card. Funds in your account within 2 business days.

Amount is in **cents** (80000 = $800.00).

### Create and Send an Invoice

```bash
python scripts/stripe_cli.py invoice \
  --customer-email "client@company.com" \
  --customer-name "Acme Corp" \
  --amount 150000 \
  --description "Website automation build — March 2026" \
  --due-days 7
```

Stripe creates the customer (if new), creates the invoice, and sends it by email automatically.

### Create a Subscription

```bash
python scripts/stripe_cli.py subscription \
  --customer-email "client@company.com" \
  --price-id price_xxx \
  --trial-days 0
```

First create a Price in Stripe dashboard or via API, then subscribe a customer to it.

### Revenue Report

```bash
python scripts/stripe_cli.py report --days 30
python scripts/stripe_cli.py report --days 7
```

Outputs total charges, refunds, net revenue. Saved to `memory/stripe-report.md`.

### Issue a Refund

```bash
python scripts/stripe_cli.py refund --charge-id ch_xxx --amount 50000
```

Partial refund (50000 cents = $500). Omit `--amount` for full refund.

### List Recent Charges

```bash
python scripts/stripe_cli.py charges --limit 10
```

---

## References

- Stripe API object reference: see `references/stripe-objects.md`
- Common error codes: see `references/stripe-errors.md`
