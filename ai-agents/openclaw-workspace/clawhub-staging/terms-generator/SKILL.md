---
name: terms-generator
description: Generate Terms of Service and Privacy Policy documents for websites, apps, games, and SaaS products. Covers GDPR basics (EU) and CCPA basics (California). Use when launching a product, game, or website that needs legal documents, when a client needs ToS/Privacy Policy, or when updating legal docs for a new product. Triggers on: "generate terms of service", "write a privacy policy", "I need terms and conditions", "legal docs for my game", "terms of service for my app", "GDPR privacy policy", "create ToS", or any terms/privacy policy task.
---

# terms-generator

Generate Terms of Service and Privacy Policy documents for any product type.

⚠️ **NOT LEGAL ADVICE.** Review with a licensed attorney before publishing.

## Usage

```bash
# Game on itch.io
python scripts/terms.py generate \
  --product-name "CLAWED" \
  --product-type game \
  --company-name "Nightshade Hollow" \
  --website "https://nightshadehollow.itch.io/clawed" \
  --email "leegier6@gmail.com" \
  --jurisdiction "Illinois, USA" \
  --output "output/clawed-legal.md"

# SaaS app
python scripts/terms.py generate \
  --product-name "MyApp" \
  --product-type saas \
  --company-name "MyCompany LLC" \
  --website "https://myapp.com" \
  --email "legal@myapp.com" \
  --collects-payments true \
  --output "output/myapp-legal.md"
```

## Product Types

| Type | What's covered |
|------|---------------|
| `game` | Game purchase, refund policy, user content, age restrictions |
| `saas` | Subscriptions, data processing, API access, service levels |
| `content-site` | Comments, user submissions, copyright |
| `mobile-app` | App store compliance, push notifications, location data |

## Output

Single Markdown file containing:
1. **Terms of Service** — usage rules, prohibited conduct, disclaimers, limitation of liability
2. **Privacy Policy** — data collected, how it's used, third parties, GDPR/CCPA rights, contact

---

## Data Collection Defaults by Type

| Type | Collects |
|------|---------|
| `game` | Purchase records, crash reports |
| `saas` | Account info, usage data, payments |
| `content-site` | Account info, submitted content, analytics |
| `mobile-app` | Device info, location (if enabled), usage |
