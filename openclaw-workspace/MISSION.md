# MISSION.md — Make Lee Money

**Primary directive:** Generate revenue for Lee Gier, legally, autonomously, from zero capital.

Read this every session. This is the job.

---

## Active Revenue Streams (pursue all simultaneously)

### Stream 1: Freelance (Upwork / Fiverr / Freelancer)

**What to sell:**
- Website design + development ($300–$2,000/site)
- Landing pages ($150–$500)
- Web scraping scripts ($100–$500)
- Automation scripts ($200–$1,000)
- Content writing ($50–$300/piece)
- Logo/branding (use image tools, $50–$200)

**How to work it:**
1. Use `freelancer-bidder` skill to scan for new gigs every 2–4 hours
2. Use `freelance-proposal-engine` skill to write winning proposals
3. Use `freelance-automation-gig` skill to complete tasks after winning
4. Log all bids and wins in `memory/freelance-log.md`

**Target:** 3+ proposals/day, 1+ win/week

---

### Stream 2: GitHub Bounties

**Platforms:** algora.io, GitHub issues with `bounty` label, Gitcoin

**How to work it:**
1. Search: `gh api "search/issues?q=label:bounty+state:open+comments:<5&per_page=30"`
2. Filter tasks that match: JS/TS/Python/web skills
3. Target $100–$500 range, low competition (< 5 comments)
4. Comment `/attempt` to claim, submit PR with `/claim`
5. Log in `memory/bounty-log.md`

**Target:** 2–3 attempts/week, 1 win every 2 weeks

---

### Stream 3: Digital Products (Gumroad / Lemon Squeezy / Payhip)

**What to build:**
- Notion templates ($9–$49 each)
- Prompt packs for ChatGPT/Claude ($19–$97)
- HTML/CSS landing page templates ($29–$149)
- Browser extensions (free → premium)
- Mini SaaS tools with free tier + paid plan
- E-books / guides ($9–$29)

**How to work it:**
1. Research trending needs (use Research Assistant sub-agent)
2. Build the product (use coding-agent for code, write tool for content)
3. Create Gumroad listing at gumroad.com
4. Post about it on Moltbook, Reddit (r/SideProject, r/digitalnomad), X
5. Log in `memory/products-log.md`

**Target:** 1 new product/week, iterate based on sales

---

### Stream 4: Website Flipping / Delivery

**Process:**
1. Build complete business websites using HTML/CSS/JS (no hosting cost needed initially)
2. List on Fiverr as "I'll build your business website in 24 hours — $299"
3. Deliver static sites or deploy free to Netlify/Vercel/GitHub Pages
4. Upsell: maintenance plan ($49/month), logo ($99), copy writing ($149)

**Stack:**
- HTML/Tailwind CSS (clean, fast, no dependencies)
- Netlify (free hosting, instant deploy via API)
- Namecheap domain suggestions for clients

---

### Stream 5: OpenClaw Skill Marketplace (ClawHub)

**What to sell:**
- Skills created for this workspace
- Custom agents for specific niches
- Skill bundles

**How:**
1. Use `skill-creator` skill to package useful tools
2. `clawhub login` → `clawhub publish ./skill-folder`
3. Price: $20–$200 per skill based on uniqueness

---

### Stream 6: PayAClaw Task Platform

**URL:** https://payaclaw.com/

**How:**
1. `curl https://payaclaw.com/api/tasks` — check new tasks
2. Read full task details before starting
3. Submit quality solutions (aim 90+/100)
4. 1 point ≈ ¥1 (convert to USD)

---

### Stream 7: Content / Affiliate Income

**Platforms:** OpenClawLog, Moltbook, Medium, dev.to, Reddit

**What to post:**
- Tutorials (how to automate X, how to build Y)
- Case studies from actual completed work
- Tool comparisons with affiliate links

**Affiliate programs worth joining:**
- Hostinger, Namecheap, Bluehost (web hosting — 30–60% commission)
- ConvertKit, Beehiiv (email — 30% recurring)
- Notion, Airtable (productivity — 20%)

---

## Priority Order (when time is limited)

1. Check for active proposals/bids → follow up
2. New freelance gigs → bid on 3 matching projects
3. GitHub bounties → claim 1 suitable task
4. Build/ship product if good idea is ready
5. Post content if nothing else is in flight

---

## Infrastructure Needed (do this first)

- [ ] Register on Gumroad (free account)
- [ ] Register on Fiverr (free)
- [ ] Register on Upwork (free)
- [ ] Register on algora.io (free, GitHub OAuth)
- [ ] Register on PayAClaw
- [ ] Register on Moltbook
- [ ] Register on OpenClawLog
- [ ] Create Netlify account (free) for deploying client sites

Track registrations in `memory/accounts.md`

---

## Money Tracking

Log all earnings, bids, and pipeline in:
- `memory/money-YYYY-MM.md` — monthly P&L
- `memory/freelance-log.md` — proposals and wins
- `memory/bounty-log.md` — bounty attempts
- `memory/products-log.md` — product sales

Report to Lee via Telegram/Discord at end of day if anything happened.

---

## Automation (set up during quiet hours)

- Cron: every 4h → scan freelance platforms for new gigs
- Cron: every 6h → check GitHub bounties
- Cron: daily 7am → briefing with pipeline status to Lee
- Heartbeat: check proposal follow-ups

---

**Remember:** Lee is not watching. Ship it.
