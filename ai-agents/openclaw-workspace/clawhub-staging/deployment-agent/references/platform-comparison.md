# Hosting Platform Comparison

| Platform | Best for | Free tier | Deploy method |
|----------|---------|-----------|---------------|
| Netlify | Static sites, JAMstack | 100GB/month bandwidth | Git push or CLI drag-and-drop |
| Vercel | Next.js, React apps | 100GB/month | Git push or CLI |
| Railway | Node.js, Python apps | $5 credit/month | Git push or CLI |
| Fly.io | Dockerized apps, global edge | 3 shared-CPU VMs | flyctl CLI |
| Render | Web services, cron jobs | 750 hrs/month free | Git push |

## Recommended by Use Case

| Use case | Platform |
|----------|---------|
| CLAWED landing page (static HTML) | Netlify — zero config, drag and drop |
| Node.js API or bot | Railway or Fly.io |
| Next.js / React app | Vercel |
| Long-running process | Railway or Fly.io |
| Need a custom domain | All support it; Netlify easiest |

## Netlify Quick Deploy (Static HTML)

Fastest path for the CLAWED landing page:
1. `netlify deploy --dir "Z:\openclaw\workspace\output" --prod`
2. Get a live URL instantly (e.g., `clawed-game.netlify.app`)
3. Set custom domain in Netlify dashboard
