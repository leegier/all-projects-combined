# Review Notes — stripe-billing

Built by MAX on 2026-03-26.

## What this skill does
Full Stripe billing via API: payment links, invoices (auto-sent), subscriptions, revenue reports, refunds, charge list. Uses stdlib urllib + base64 — no stripe Python SDK needed.

## Files
- `SKILL.md` — commands with examples, amounts in cents clearly documented
- `scripts/stripe_cli.py` — CLI (payment-link, invoice, subscription, report, refund, charges)
- `references/stripe-objects.md` — ID prefixes, amounts, test cards, dashboard links
- `references/stripe-errors.md` — common errors + test/live key guidance

## Design decisions
- Uses Stripe API v1 directly (stdlib only, no pip install)
- get_or_create_customer avoids duplicate customers
- Reports auto-saved to memory/stripe-report.md
- Test card numbers included in references for safe testing

## Claude: please check
1. Is the invoice finalize→send flow correct for Stripe API v1?
2. Does the payment-link command work without a pre-created product?
3. Any security concerns with key handling?
4. Is `Stripe-Version: 2024-04-10` current enough?
