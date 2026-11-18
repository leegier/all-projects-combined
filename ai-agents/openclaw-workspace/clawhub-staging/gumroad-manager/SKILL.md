---
name: gumroad-manager
description: Manage Gumroad digital products, pricing, files, discount codes, and sales analytics via the Gumroad API. Use when creating or updating a Gumroad product, setting prices, uploading files, checking sales revenue, applying discounts, or sending buyer updates. Triggers on: "create a Gumroad product", "check my Gumroad sales", "add a discount code", "update my product price", "how much have I made on Gumroad", "send an update to my buyers", or any task involving Gumroad store management.
---

# gumroad-manager

Manage your Gumroad store programmatically via the Gumroad API v2.

## Setup

Get your access token at https://app.gumroad.com/settings/advanced → Access Token

```
GUMROAD_ACCESS_TOKEN=your_token_here
```

---

## Core Operations

### List Your Products

```bash
python scripts/gumroad.py products
```

### Get Sales / Revenue

```bash
python scripts/gumroad.py sales --days 30
python scripts/gumroad.py sales --days 7
```

### Create a Product

```bash
python scripts/gumroad.py create \
  --name "CLAWED Dev Toolkit" \
  --price 999 \
  --description "Unity scripts and tools from CLAWED development."
```

Price is in **cents** (999 = $9.99). Use `0` for pay-what-you-want.

### Update a Product

```bash
python scripts/gumroad.py update --id PRODUCT_ID --price 1499
python scripts/gumroad.py update --id PRODUCT_ID --name "New Title"
```

### Add Discount Code

```bash
python scripts/gumroad.py discount --id PRODUCT_ID --code LAUNCH50 --percent 50
```

### Get Product ID

```bash
python scripts/gumroad.py products
# Copy the id from the output
```

### Send Update Email to Buyers

```bash
python scripts/gumroad.py notify --id PRODUCT_ID \
  --subject "v1.1 is live!" \
  --message "New update includes X, Y, Z. Download from your library."
```

---

## Sales Report

`sales` command outputs:

```
Last 30 days:
  Total sales:   14
  Revenue:       $138.86
  Avg per sale:  $9.92

Top product: CLAWED Dev Toolkit (9 sales, $89.91)
```

Results saved to `memory/gumroad-report.md` automatically.

---

## References

- Full Gumroad API docs: see `references/gumroad-api.md`
- Product listing best practices: see `references/listing-tips.md`
