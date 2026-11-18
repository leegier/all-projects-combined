# Stripe Key Objects

## IDs Cheat Sheet

| Object | ID Prefix | Example |
|--------|-----------|---------|
| Customer | `cus_` | `cus_abc123` |
| Charge | `ch_` | `ch_abc123` |
| Invoice | `in_` | `in_abc123` |
| Payment Intent | `pi_` | `pi_abc123` |
| Payment Link | `plink_` | `plink_abc123` |
| Price | `price_` | `price_abc123` |
| Product | `prod_` | `prod_abc123` |
| Subscription | `sub_` | `sub_abc123` |
| Refund | `re_` | `re_abc123` |

## Amount Convention

All amounts in **cents** (integers):
- $1.00 = 100
- $9.99 = 999
- $800.00 = 80000

## Currency

Default: `usd`. Stripe supports 135+ currencies. Use 3-letter ISO codes.

## Useful Dashboard Links

- Test mode payments: https://dashboard.stripe.com/test/payments
- Live payments: https://dashboard.stripe.com/payments
- Invoices: https://dashboard.stripe.com/invoices
- API keys: https://dashboard.stripe.com/apikeys
- Webhooks: https://dashboard.stripe.com/webhooks

## Test Card Numbers

| Card | Number | Use for |
|------|--------|---------|
| Visa success | 4242 4242 4242 4242 | Successful payment |
| Decline | 4000 0000 0000 0002 | Card declined |
| Auth required | 4000 0025 0000 3155 | 3D Secure |

Use any future expiry, any 3-digit CVC, any 5-digit ZIP.
