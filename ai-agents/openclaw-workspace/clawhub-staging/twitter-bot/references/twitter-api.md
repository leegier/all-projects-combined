# Twitter API v2 Reference

## Auth: OAuth 1.0a (User Context)

Required for write actions (post tweets, reply). The script handles this automatically.

Keys needed:
- API Key + Secret (app credentials)
- Access Token + Secret (user credentials)

Get them at: https://developer.twitter.com/en/portal/projects-and-apps
→ Your app → Keys and Tokens → Access Token and Secret (generate for your own account)

## Free Tier Limits

| Endpoint | Free Limit |
|----------|-----------|
| POST /tweets | 500/month |
| GET /users/me | Unlimited |
| GET /users/:id/mentions | Unlimited |
| GET /tweets/:id | Unlimited |

## Key Endpoints Used

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/2/tweets` | Post tweet or reply |
| GET | `/2/users/me` | Get own user info |
| GET | `/2/users/:id/mentions` | Get mentions |
| GET | `/2/tweets/:id` | Get tweet metrics |

## Tweet Body Fields

```json
{
  "text": "Your tweet text",
  "reply": {
    "in_reply_to_tweet_id": "1234567890"
  }
}
```

## Common Error Codes

| Code | Meaning |
|------|---------|
| 401 | Auth failed — check all 4 credentials |
| 403 | App doesn't have write permissions — enable in developer portal |
| 429 | Rate limited — wait and retry |
| 453 | Access to API endpoint not available in current tier |
