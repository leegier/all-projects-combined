---
name: deployment-agent
description: Deploy web apps and static sites to Netlify, Vercel, Railway, or Fly.io via CLI. Builds the project, deploys, sets environment variables, and reports the live URL. Use when deploying a website, landing page, or web app to a hosting platform. Triggers on: "deploy to Netlify", "deploy to Vercel", "push to production", "deploy my site", "host this website", "deploy this landing page", "Fly.io deploy", "Railway deploy", or any web deployment task.
---

# deployment-agent

Deploy web projects to hosting platforms via their CLIs.

## Prerequisites

Install the platform CLI you need (one-time):

```bash
npm install -g netlify-cli          # Netlify
npm install -g vercel               # Vercel
npm install -g @railway/cli         # Railway
curl -L https://fly.io/install.sh | sh  # Fly.io
```

---

## Deploy to Netlify

```bash
python scripts/deploy.py netlify \
  --dir "Z:\openclaw\workspace\output" \
  --site-name "clawed-game"
```

Or for a build-first project:
```bash
python scripts/deploy.py netlify \
  --dir "./my-project" \
  --build-cmd "npm run build" \
  --publish-dir "dist"
```

### Netlify Direct (static site, no build)

```bash
netlify deploy --dir "output" --prod --site clawed-game
```

---

## Deploy to Vercel

```bash
python scripts/deploy.py vercel --dir "./my-app" --prod
```

---

## Deploy to Fly.io

```bash
python scripts/deploy.py fly --dir "./my-app" --app-name "my-app"
```

Requires `fly.toml` in the project directory.

---

## Deploy to Railway

```bash
python scripts/deploy.py railway --dir "./my-app"
```

---

## Check Deployment Status

```bash
python scripts/deploy.py status --platform netlify --site clawed-game
```

---

## References

- Platform comparison: see `references/platform-comparison.md`
- Environment variables guide: see `references/env-vars.md`
