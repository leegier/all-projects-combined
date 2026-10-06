# Gumroad API v2 Reference

Base URL: `https://api.gumroad.com/v2`
Auth: `access_token` query param or POST body field

## Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/products` | List all products |
| POST | `/products` | Create a product |
| PUT | `/products/:id` | Update a product |
| DELETE | `/products/:id` | Delete a product |
| GET | `/sales` | List sales (supports `after`, `before` date filters) |
| POST | `/offer_codes` | Create discount code |
| POST | `/products/:id/notify_followers` | Email buyers |

## Product Fields

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | Product title |
| `price` | integer | In cents. 0 = pay what you want |
| `description` | string | HTML supported |
| `short_url` | string | Gumroad product URL (read-only) |
| `sales_count` | integer | Total all-time sales |
| `published` | boolean | Whether listed publicly |

## Rate Limits

- 1,000 requests/hour per token
- No per-endpoint limits documented; stay under 1 req/second for safety

## Error Handling

All errors return `{ "success": false, "message": "..." }`
Script exits with code 1 on any API error.
