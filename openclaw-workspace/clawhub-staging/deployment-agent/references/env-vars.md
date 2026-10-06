# Environment Variables Guide

Never hardcode secrets in your code. Use env vars on every platform.

## Setting Env Vars

### Netlify
```bash
netlify env:set KEY value --site my-site
netlify env:list
```
Or via dashboard: Site settings → Environment variables

### Vercel
```bash
vercel env add KEY production
vercel env ls
```

### Railway
Dashboard → Your service → Variables tab

### Fly.io
```bash
fly secrets set KEY=value
fly secrets list
```

## Common Variables

| Variable | What it stores |
|----------|---------------|
| `STRIPE_SECRET_KEY` | Stripe API key |
| `GUMROAD_ACCESS_TOKEN` | Gumroad API token |
| `EMAIL_USER` / `EMAIL_PASS` | Email credentials |
| `OPENAI_API_KEY` | OpenAI API |
| `DATABASE_URL` | Database connection string |
| `JWT_SECRET` | JWT signing secret |

## Security Rules

- Never commit `.env` files to git (add to `.gitignore`)
- Use `sk_test_` Stripe keys in staging, `sk_live_` in production only
- Rotate keys if accidentally exposed
- Use platform secret managers for production — never plain env vars in source
