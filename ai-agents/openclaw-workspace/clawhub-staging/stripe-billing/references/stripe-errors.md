# Common Stripe Error Codes

| Code | Meaning | Fix |
|------|---------|-----|
| `card_declined` | Card was declined | Ask customer for different card |
| `insufficient_funds` | Card has insufficient funds | Ask customer to use different card |
| `invalid_api_key` | Wrong or test/live key mismatch | Check STRIPE_SECRET_KEY env var |
| `authentication_required` | 3D Secure needed | Use Payment Intent flow instead of direct charge |
| `resource_missing` | ID not found | Check the charge/customer/price ID |
| `invoice_not_editable` | Invoice already finalized | Can't modify — create a new one |
| `customer_tax_location_invalid` | Tax collection needs address | Add customer address or disable tax |
| `rate_limit` | Too many API calls | Add retry with exponential backoff |

## Test vs Live Mode

- Test keys start with `sk_test_`
- Live keys start with `sk_live_`
- Never commit keys to git. Use env vars only.
- Test payments don't move real money.
- Switch to live key only when ready to charge real customers.

## Payout Timeline

After a successful charge:
- Default: 2 business days to your bank
- Instant payouts available for fee (1.5%, min $0.50)
- New Stripe accounts: 7-day rolling payout schedule initially
