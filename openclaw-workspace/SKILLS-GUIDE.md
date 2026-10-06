# SKILLS-GUIDE.md — What You Can Do & How to Do It

Read this when you need to know which skill to use and exactly how to use it for making money.

**ClawHub is empty — you are one of the first agents on the platform. Publish skills there ASAP.**

---

## MONEY-MAKING SKILLS

---

### 💰 openclaw-money-maker
**What it is:** Complete revenue playbook — platforms, strategies, APIs.
**Read MISSION.md instead** — that's the condensed version tailored to you.
**Use it:** Reference for API endpoints and platform-specific submission formats.

---

### 🎯 freelancer-bidder
**What it is:** Scans Freelancer.com for new projects matching your skills and bids automatically.
**How to use it:**
```
Read skill: freelancer-bidder
→ Authenticate with Freelancer.com API
→ Search projects: web development, landing page, automation, python, javascript
→ Filter: budget > $100, posted < 2h ago, bids < 10
→ Auto-generate proposals using freelance-proposal-engine
→ Log results to memory/freelance-log.md
```
**When:** Run every 3–4 hours via heartbeat or cron.
**Revenue:** $100–$2,000 per win.

---

### 📝 freelance-proposal-engine
**What it is:** Generates tailored, winning proposals for freelance gigs.
**How to use it:**
```
Read skill: freelance-proposal-engine
→ Input: job title, description, client's stated pain point
→ Output: personalized proposal (max 200 words, opens with their problem, ends with CTA)
→ Never use templates verbatim — always customize first 2 sentences
→ Send via freelancer-bidder or manually via platform
```
**Key:** Proposals that win mention the client's specific project by name, not generic "I can help with this."

---

### 🤖 freelance-automation-gig
**What it is:** After winning a gig, this skill helps complete the actual task automatically.
**How to use it:**
```
Read skill: freelance-automation-gig
→ Parse the client's requirements into steps
→ Use coding-agent for code work, canvas/openai-image-gen for design
→ Deliver via email (himalaya) or direct message
→ Log completion in memory/freelance-log.md
```
**Use for:** Web scraping orders, data entry, automation scripts, simple web builds.

---

### 🐙 github + gh-issues
**What it is:** Full GitHub CLI access — repos, issues, PRs, bounties.
**How to use it for bounty hunting:**
```
# Find open bounties (low competition)
gh api "search/issues?q=label:bounty+state:open+comments:<5&per_page=30"

# Filter for familiar tech
gh api "search/issues?q=label:bounty+state:open+language:javascript&per_page=30"

# Claim a bounty
gh issue comment {number} --body "/attempt #{number}"

# Submit PR with claim
gh pr create --title "Fix: {issue title}" --body "/claim #{number}\n\n{description}"
```
**Also useful:** Submit your own projects to GitHub for visibility and portfolio.
**Revenue:** $50–$2,500 per bounty. Target algora.io first.

---

### 🧩 coding-agent
**What it is:** Delegates large coding tasks to Claude Code or Codex running as a background agent.
**How to use it:**
```
Read skill: coding-agent
→ Use for: building websites, landing pages, web apps, scripts, browser extensions
→ NOT for: reading a single file, quick edits
→ Claude Code invocation: --print --permission-mode bypassPermissions
→ Pass full requirements as the prompt
→ Check output, test, then deliver to client
```
**Money use:** Build client websites (charge $299–$2,000), scripts ($100–$500), SaaS MVPs.

---

### 🎨 canvas
**What it is:** Design tool for creating graphics, images, and visual assets.
**How to use it:**
```
Read skill: canvas
→ Use for: logos, social graphics, website mockups, product thumbnails
→ Combine with openai-image-gen for AI-generated visuals
→ Export as PNG/SVG for client delivery
```
**Money use:** Offer logo packages on Fiverr ($50–$200). Include in website packages.

---

### 🖼️ openai-image-gen
**What it is:** Generates images via OpenAI DALL-E or compatible API.
**How to use it:**
```
Read skill: openai-image-gen
→ Requires: OPENAI_API_KEY in environment
→ Use for: product mockups, hero images for landing pages, blog post visuals
→ Generate 3–5 variants, pick best
→ Use in client deliverables, digital products, and content
```
**Money use:** Add "custom AI images" as upsell to website packages (+$50–$100).

---

### 📦 clawhub
**What it is:** CLI to publish, search, and install skills on the ClawHub marketplace.
**CRITICAL — ClawHub is EMPTY. You can be first.**
**How to publish skills:**
```
# Login (one time)
npx clawhub@latest login

# Create a new skill using skill-creator first, then:
npx clawhub@latest publish ./skills/my-skill \
  --slug my-skill-name \
  --name "My Skill Name" \
  --version 1.0.0 \
  --changelog "Initial release"

# Check existing skills
npx clawhub@latest search "keyword"
```
**What to publish first:**
1. A polished version of `freelancer-bidder` with better docs
2. A "website-builder" skill for OpenClaw agents
3. A "stripe-checkout" integration skill
**Revenue:** $20–$500 per skill download. First 10 publishers get maximum visibility.

---

### 🛠️ skill-creator
**What it is:** Creates and packages new AgentSkills — the format ClawHub accepts.
**How to use it:**
```
Read skill: skill-creator
→ Input: what you want the skill to do, what CLIs/APIs it needs
→ Output: a complete skill directory with SKILL.md + package.json
→ Structure: skills/my-skill/SKILL.md + _meta.json
→ Publish immediately to ClawHub via clawhub skill
```
**Money use:** Create custom skills for clients ($200–$500 each). Publish to ClawHub for passive income.

---

### 📊 nano-pdf
**What it is:** Edit and generate PDFs via natural language commands.
**How to use it:**
```
Read skill: nano-pdf
→ nano-pdf "Add a header saying 'Invoice #001' to report.pdf"
→ nano-pdf "Extract all tables from this PDF to JSON"
→ nano-pdf "Create a PDF invoice from this data..."
```
**Money use:** Offer "PDF report generation" as a Fiverr gig ($50–$150). Use for client invoice delivery.

---

### 💬 wacli (WhatsApp)
**What it is:** Send WhatsApp messages via CLI for outreach and client comms.
**How to use it:**
```
Read skill: wacli
→ wacli send --to "+1XXXXXXXXXX" --message "Hi, following up on your project..."
→ Use for: client follow-ups, lead outreach, delivery notifications
→ NOT for: spam. Only message people who have been clients or opted in.
```
**Money use:** Follow up on freelance proposals, notify clients of deliverables.

---

### 🔍 blogwatcher
**What it is:** Monitors RSS/Atom feeds for new posts. Subscribe to any blog.
**How to use it:**
```
Read skill: blogwatcher
→ blogwatcher add https://feeds.feedburner.com/TechCrunch "TechCrunch"
→ blogwatcher check → returns new posts since last check
→ Monitor for: competitor moves, new bounties posted, trends to write about
```
**Money use:** Find trending topics early → write content → post on OpenClawLog/Medium first → traffic + affiliate clicks.

---

### 📰 summarize
**What it is:** Summarizes long documents, articles, web pages.
**How to use it:**
```
Read skill: summarize
→ Input: URL, file path, or pasted text
→ Output: bullet-point summary
→ Use before writing blog posts (summarize 3 sources, then synthesize)
→ Use to speed-read client briefs
```
**Money use:** Research acceleration — 10x your content output by summarizing instead of reading in full.

---

### 🔗 xurl
**What it is:** HTTP requests from the CLI — GET, POST, headers, auth.
**How to use it:**
```
Read skill: xurl
→ xurl get "https://api.example.com/data" --header "Authorization: Bearer TOKEN"
→ xurl post "https://api.example.com/submit" --json '{"key":"value"}'
→ Use for: calling platform APIs, PayAClaw submissions, Gumroad API, custom integrations
```
**Money use:** Automate everything — submit to platforms, check status, fetch data without a browser.

---

### 📧 himalaya (Email)
**What it is:** Send and manage emails via IMAP/SMTP from the terminal.
**How to use it:**
```
Read skill: himalaya
→ himalaya send --to "client@example.com" --subject "Your website is ready" --body-file ./message.txt
→ himalaya list → check inbox for new client messages
→ himalaya search "invoice" → find specific emails
→ Requires: IMAP/SMTP config (Gmail, Outlook)
```
**Money use:** Cold outreach to businesses offering websites. Follow up with prospects. Deliver work.

---

### 💬 slack
**What it is:** Send messages and notifications via Slack.
**How to use it:**
```
Read skill: slack
→ Use webhook: curl -X POST $SLACK_WEBHOOK -d '{"text":"..."}'
→ Use for: notifying Lee of earnings, project updates, error alerts
→ Set up Lee's Slack workspace → post daily revenue reports
```

---

### 📓 notion
**What it is:** Create and manage Notion pages, databases, and documents.
**How to use it:**
```
Read skill: notion
→ Requires: NOTION_API_KEY + integration setup
→ Create pages: for client deliverables, project tracking
→ Use for: building Notion templates to sell ($9–$49 each)
→ notion create-page --title "..." --content "..."
```
**Money use:** Build Notion templates (CRM, project tracker, habit tracker) → sell on Gumroad.

---

### 📋 trello
**What it is:** Manage Trello boards — cards, lists, labels.
**How to use it:**
```
Read skill: trello
→ Requires: TRELLO_API_KEY + TRELLO_TOKEN
→ Use for: tracking client projects, freelance pipeline, bounty queue
→ Create board: "MAX Revenue Pipeline" → lists: Prospecting, Proposed, Active, Delivered, Paid
```

---

### 🔊 sag (ElevenLabs TTS)
**What it is:** Text-to-speech using your ElevenLabs voice (already configured: Sam Elliott voice).
**How to use it:**
```
# Your API key is already in env: ELEVENLABS_API_KEY
sag "Update for Lee: You have two new proposals submitted today."
sag speak -v "pqHfZKP75CvOlQylNhV4" "Message here"
```
**Already auto-enabled** — every reply you send goes through TTS automatically.
**Use explicitly for:** Special announcements, earnings reports, alerts to Lee.

---

### ✨ gemini
**What it is:** Google Gemini AI via CLI — free tier available, large context window.
**How to use it:**
```
Read skill: gemini
→ gemini "Write a landing page headline for a dog grooming service"
→ gemini --model gemini-2.0-flash "Summarize this: [paste text]"
→ Use as ANOTHER free AI tier between Ollama and Claude
→ Gemini 1.5 Flash is free with Google account
```
**Money use:** Use for content generation, proposal writing, research summaries — FREE.
**Model fallback:** Add Gemini between Ollama and Claude for better quality at zero cost.

---

### 🎤 openai-whisper
**What it is:** Local speech-to-text — transcribe audio files without API cost.
**How to use it:**
```
Read skill: openai-whisper
→ whisper audio.mp3 → outputs transcript
→ whisper meeting.wav --output-format txt
→ No API key needed — runs 100% local
```
**Money use:** Offer "meeting transcription" as a Fiverr gig ($25–$75/hour of audio). Process client audio files, deliver clean transcripts.

---

### 🏥 healthcheck
**What it is:** Security auditing — checks firewall, SSH config, update status, exposure.
**How to use it:**
```
Read skill: healthcheck
→ Run on any server/PC to assess security posture
→ Output: list of vulnerabilities + hardening recommendations
→ Can be scheduled as a cron job
```
**Money use:** Offer "security audit" as a Fiverr gig ($50–$200). Run the tool, package the report as PDF (nano-pdf), deliver.

---

### 🗺️ goplaces
**What it is:** Google Places API — search businesses, get reviews, details.
**How to use it:**
```
Read skill: goplaces
→ Requires: Google Places API key
→ goplaces search "restaurants in Austin TX" --max 20
→ goplaces details --place-id "..."
→ goplaces reviews --place-id "..."
```
**Money use:** Build a lead-gen tool — extract local business info, offer website-building outreach. "Found 47 plumbers in Dallas with no website — pitch them."

---

### 🖥️ http-static-server
**What it is:** Instantly serve a static HTML/CSS/JS website locally.
**How to use it:**
```
Read skill: http-static-server
→ http-static-server ./my-website --port 8080
→ Use to preview sites before delivering to clients
→ For deployment: push to Netlify/Vercel (free)
```
**Money use:** Build + preview client sites locally, then deploy for free.

---

### 🎬 video-frames
**What it is:** Extracts frames/clips from videos using ffmpeg.
**How to use it:**
```
Read skill: video-frames
→ Requires: ffmpeg installed
→ Extract frame: ffmpeg -i video.mp4 -ss 00:01:30 -frames:v 1 frame.png
→ Extract clip: ffmpeg -i video.mp4 -ss 00:01:00 -t 30 clip.mp4
```
**Money use:** Offer video thumbnail creation ($15–$30/video) as quick Fiverr gig. Extract key frames, enhance with image-gen.

---

### 📸 camsnap
**What it is:** Capture frames from RTSP cameras.
**How to use it:**
```
Read skill: camsnap
→ Requires: RTSP camera URL
→ Use for Lee's home network cameras (see NETWORK.md)
→ camsnap snap rtsp://192.168.1.X/stream → captures frame
```

---

### 🔮 oracle
**What it is:** Bundles multiple files + a prompt into one AI query — like a super-powered context window.
**How to use it:**
```
Read skill: oracle
→ oracle "Analyze these files and suggest improvements" *.js *.html
→ Use when you need AI to review an entire project at once
→ Perfect for: code review gigs, security audits, documentation generation
```
**Money use:** Feed client's entire codebase → generate audit report → charge for it.

---

### 📊 model-usage
**What it is:** Tracks per-model token usage and cost.
**How to use it:**
```
Read skill: model-usage
→ Run periodically to see Claude vs Ollama cost breakdown
→ Report to Lee weekly: "This week: $X on Claude, $0 on Ollama"
→ Use to optimize: shift more tasks to Ollama if Claude costs are rising
```

---

### 🤖 agent-orchestrator + agent-team-orchestration
**What it is:** Meta-skills for running multiple sub-agents in parallel on a complex task.
**How to use it:**
```
Read skill: agent-orchestrator
→ Use when a task needs 3+ parallel agents working simultaneously
→ Example: "Research 5 niches, find best opportunity, build MVP, write copy" — all at once
→ Assign: Research Assistant researches, Content Writer writes, coding-agent builds
→ Aggregate results, present to Lee
```
**Money use:** 10x output speed — complete large client projects faster by parallelizing.

---

### 🔍 subagent-driven-development
**What it is:** Breaks large coding projects into sub-tasks and runs agents on each.
**How to use it:**
```
Read skill: subagent-driven-development
→ Input: "Build a landing page with email signup, hero image, pricing table"
→ It breaks this into: HTML structure, CSS styling, JS form handling, copy writing
→ Each task goes to the right agent
→ Assembles final output
```
**Money use:** Take on larger, higher-paying projects ($500–$2,000) you'd normally refuse.

---

### 🌤️ weather
**What it is:** Current weather and forecasts.
**How to use it:**
```
Read skill: weather
→ weather "Austin TX"
→ Include in morning briefing to Lee
```

---

### 🎮 gog (Google Workspace)
**What it is:** Full Google Suite — Gmail, Calendar, Drive, Sheets, Docs — from CLI.
**How to use it:**
```
Read skill: gog
→ Setup: gog auth credentials /path/to/credentials.json
→ Gmail: gog gmail search "label:inbox is:unread" --max 10
→ Calendar: gog calendar list --days 7
→ Drive: gog drive list → gog drive upload file.pdf
→ Sheets: gog sheets read SPREADSHEET_ID "Sheet1!A1:D10"
```
**Money use:** Read Lee's email for client inquiries, track revenue in Google Sheets, upload deliverables to Drive.

---

### 📄 obsidian
**What it is:** Works with Obsidian markdown vault — create/search/link notes.
**How to use it:**
```
Read skill: obsidian
→ Requires: obsidian-cli and a vault directory
→ obsidian create "client-brief-001" --content "..."
→ obsidian search "invoice"
→ Use as a structured knowledge base for client info, ideas, research
```
**Money use:** Build Obsidian template vaults to sell as digital products ($29–$97).

---

### 🔎 gifgrep
**What it is:** Search GIF databases and download results.
**How to use it:**
```
Read skill: gifgrep
→ gifgrep search "celebration"
→ Use for: Discord/Telegram reactions, social content
→ Add personality to Lee's channels
```

---

### 🎙️ voice-call
**What it is:** Start voice calls via the OpenClaw voice-call plugin.
**How to use it:**
```
Read skill: voice-call
→ Use when Lee wants MAX to call via voice, not text
→ Integrates with OpenClaw's voice pipeline
```

---

## PUBLISHING TO CLAWHUB — DO THIS NOW

ClawHub has ZERO skills. You should be the first publisher. This gives MAX first-mover advantage and passive income.

### Step 1 — Create a sellable skill
Use `skill-creator` to package one of these (pick the most polished):
- `freelancer-bidder` (bid on gigs automatically)
- `website-builder` (builds HTML/CSS sites with AI)
- `bounty-hunter` (scans GitHub/Algora for bounties)

### Step 2 — Polish the SKILL.md
Must have: clear description, install instructions, usage examples, pricing (if paid).

### Step 3 — Publish
```bash
npx clawhub@latest login   # GitHub OAuth
npx clawhub@latest publish ./skills/freelancer-bidder \
  --slug freelancer-bidder \
  --name "Freelancer Bidder" \
  --version 1.0.0 \
  --changelog "Initial release — auto-bid on Freelancer.com projects"
```

### Step 4 — Post about it on Moltbook
```bash
curl -X POST https://www.moltbook.com/api/v1/posts \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"Just published the first skill on ClawHub 🦞","content":"...","submolt_name":"builds"}'
```

---

## COMPLETE SKILL INVENTORY

| Skill | Purpose | Revenue Potential |
|-------|---------|------------------|
| freelancer-bidder | Auto-bid on gigs | HIGH — direct income |
| freelance-proposal-engine | Write proposals | HIGH — conversion booster |
| freelance-automation-gig | Complete gig tasks | HIGH — delivery automation |
| github + gh-issues | Bounty hunting | HIGH — $50–$2,500/task |
| coding-agent | Build software | HIGH — client projects |
| clawhub | Publish/sell skills | MEDIUM — passive income |
| skill-creator | Create skills | MEDIUM — productize expertise |
| openai-image-gen | Generate images | MEDIUM — upsell to clients |
| canvas | Design work | MEDIUM — logo/graphics gigs |
| nano-pdf | PDF generation | MEDIUM — invoice/report gigs |
| openai-whisper | Transcription | MEDIUM — audio gig |
| healthcheck | Security audits | MEDIUM — audit gig |
| himalaya | Email outreach | MEDIUM — lead generation |
| wacli | WhatsApp outreach | MEDIUM — follow-ups |
| goplaces | Local biz leads | MEDIUM — lead sourcing |
| notion | Template building | MEDIUM — digital products |
| obsidian | Vault templates | MEDIUM — digital products |
| http-static-server | Preview/serve sites | SUPPORT |
| blogwatcher | Trend monitoring | SUPPORT |
| summarize | Research speed | SUPPORT |
| xurl | API calls | SUPPORT |
| gog | Google Workspace | SUPPORT |
| gemini | Free AI tier | COST SAVING |
| model-usage | Cost tracking | COST SAVING |
| sag | TTS (already on) | DELIVERY |
| agent-orchestrator | Parallelization | SPEED MULTIPLIER |
| subagent-driven-development | Complex projects | SCOPE MULTIPLIER |
| agent-team-orchestration | Team management | SCOPE MULTIPLIER |
| slack | Notifications | COMMS |
| trello | Pipeline tracking | TRACKING |
| video-frames | Video work | LOW |
| weather | Daily briefing | UTILITY |
| discord | Discord ops | COMMS |
| voice-call | Voice mode | COMMS |

---

---

## NEW SKILLS (added 2026-03-22)

### 🧠 self-improving-agent (★2.6k — highest rated on ClawHub)
**What it is:** Captures errors, learns from mistakes, improves over time automatically.
**How to use:** Activate every session. It hooks into your error log and proposes fixes.
```
Read skill: self-improving-agent → run improvement cycle → log to memory/self-improve.md
```
**Revenue impact:** HIGH — better performance = better client outcomes = more referrals

---

### ⚡ proactive-agent (★611)
**What it is:** Patterns for being proactive — scanning, noticing, acting without being asked.
**How to use:** Read once, internalize the patterns. Apply them during heartbeats.
**Revenue impact:** HIGH — autonomous execution without waiting for Lee

---

### 🆓 free-ride
**What it is:** Access free AI models via OpenRouter (GPT-4o-mini, Llama, etc.)
**How to use:** Use when Ollama is unavailable and Claude is too expensive.
```
Read skill: free-ride → set OPENROUTER_API_KEY → route tasks to free models
```
**Revenue impact:** COST SAVING — keeps MAX running when Ollama is down

---

### 🔄 auto-updater
**What it is:** Checks for skill updates daily and installs them automatically.
**How to use:** Run once to configure, then it runs on its own schedule.
```
Read skill: auto-updater → configure → it handles itself
```

---

### 🕵️ skill-vetter
**What it is:** Security-vets ClawHub skills before install (catches malicious code).
**How to use:** Before installing ANY new skill: `Read skill: skill-vetter → vet SKILL_SLUG`

---

### 🌐 web-scraper
**What it is:** Scrapes websites for data — prices, job listings, contacts, content.
**How to use:**
```
Read skill: web-scraper
→ Scrape Fiverr for top-selling gig titles in your category
→ Scrape Upwork for top freelancer profiles to model proposals after
→ Scrape itch.io for top-selling indie games in the survival genre
→ Output to memory/market-research.md
```
**Revenue impact:** HIGH — market intelligence without subscriptions

---

### 📤 social-poster + linkedin-poster + youtube-uploader
**What they are:** Post content to social platforms automatically.
**How to use:**
```
Read skill: social-poster
→ Post CLAWED game screenshots to Twitter/X with #indiedev #unity #gamedev
→ Post devlog updates to LinkedIn
→ Upload CLAWED gameplay videos to YouTube (use youtube-uploader)
→ Schedule with content-scheduler for consistent posting
```
**Revenue impact:** HIGH — organic traffic → itch.io page → sales

---

### 📅 content-scheduler
**What it is:** Schedule content posts across platforms for consistent publishing.
**How to use:** Create a content calendar in memory/content-calendar.md, then use this skill to post on schedule.

---

### 🔍 seo-optimizer
**What it is:** Optimize content for search engines — titles, descriptions, tags.
**How to use:**
```
Read skill: seo-optimizer
→ Optimize CLAWED itch.io page title/description
→ Research keywords: "prison escape game", "survival stealth game"
→ Apply to any blog posts or product pages
```

---

### 🥶 cold-outreach
**What it is:** Automated cold email/DM campaigns to potential clients.
**How to use:**
```
Read skill: cold-outreach
→ Find 10 small businesses without websites
→ Draft personalized outreach email offering to build their site for $500
→ Send via himalaya skill
→ Track responses in memory/outreach-log.md
```
**Revenue impact:** HIGH — direct path to clients without platforms

---

### 📝 proposal-writer
**What it is:** Write professional project proposals for freelance clients.
**Use with:** freelance-proposal-engine (that one auto-bids, this one writes custom proposals)
**How to use:** `Read skill: proposal-writer → client context → generate proposal → review → send`

---

### 🧾 invoice-generator + contract-generator
**What they are:** Generate professional invoices and contracts for clients.
**How to use:**
```
Read skill: invoice-generator → fill in client/amount/services → generate PDF → send via email
Read skill: contract-generator → fill in scope/timeline/payment → generate contract → send for signature
```
**Revenue impact:** MEDIUM — professionalism = client trust = better rates

---

### 🤝 client-onboarding
**What it is:** Automated client onboarding workflow — intake form, welcome email, project kickoff.
**How to use:** Run when a new client says yes. Gets everything set up without manual work.

---

### 📊 crm-manager
**What it is:** Track leads, clients, follow-ups, deal stages.
**How to use:**
```
Read skill: crm-manager
→ Track all active outreach in CRM
→ Set follow-up reminders for non-responders (3 days, 7 days)
→ Log won/lost deals to memory/crm.md
```

---

### 🔄 funnel-builder
**What it is:** Build sales funnels — landing page → email capture → product sale.
**How to use:** Use to build a funnel for CLAWED (game page → email list → launch announcement)

---

### 📧 email-marketer
**What it is:** Email marketing campaigns — sequences, broadcasts, automations.
**How to use:** Build an email list from CLAWED itch.io page. Send launch updates, devlogs, new versions.

---

### 🤖 chatbot-builder
**What it is:** Build chatbots for websites. SELLABLE PRODUCT.
**Revenue opportunity:** Build a simple customer support chatbot, sell it to small businesses for $200-500/mo.
**How to use:** `Read skill: chatbot-builder → build demo → package → list on Fiverr/Upwork`

---

### 🎧 customer-support
**What it is:** Automated customer support workflows.
**How to use:** Use for CLAWED players who report bugs. Auto-triage and respond.

---

### 🔒 vulnerability-scanner + code-auditor
**What they are:** Security scanning tools. Use for bug bounty work.
**How to use:**
```
Read skill: vulnerability-scanner → target: public bug bounty programs (HackerOne, Bugcrowd)
→ Scan for common vulnerabilities (XSS, SQLi, IDOR)
→ Write report → submit → collect bounty
```
**Revenue impact:** HIGH — bounties range $50-$50,000 per finding

---

### 📡 website-monitor + uptime-checker
**What they are:** Monitor website uptime and performance.
**Revenue opportunity:** Offer monitoring as a service to clients for $29/mo. Pure passive income.

---

### 📰 news-aggregator
**What it is:** Aggregate news from RSS feeds and sources.
**How to use:** Track indie game news, freelance market trends, AI news for daily briefings.

---

### 📈 stock-watcher + price-monitor
**What they are:** Watch prices — stocks, crypto, products.
**How to use:** Monitor competitor game prices on itch.io, Steam. Track when to lower/raise CLAWED price.

---

### ⏱️ time-tracker
**What it is:** Track time spent on tasks. Use for client billing and self-analysis.

---

### 🧪 api-tester + load-tester
**What they are:** Test APIs and load capacity. SELLABLE SERVICE.
**Revenue opportunity:** Offer QA testing services to developers on Upwork for $50-200/project.

---

### 🐳 docker-manager + database-manager
**What they are:** Manage Docker containers and databases.
**Use for:** Running MAX's own services, client infrastructure work, DevOps freelance gigs.

---

## SKILL COUNT: 152 installed

| New Skill | Revenue Use | Priority |
|-----------|------------|----------|
| self-improving-agent | Better performance | CRITICAL |
| proactive-agent | Autonomous execution | CRITICAL |
| cold-outreach | Direct client acquisition | HIGH |
| web-scraper | Market research | HIGH |
| social-poster / linkedin / youtube | CLAWED marketing | HIGH |
| seo-optimizer | Product discoverability | HIGH |
| vulnerability-scanner | Bug bounties | HIGH |
| chatbot-builder | Sellable product | HIGH |
| website-monitor | Recurring revenue service | MEDIUM |
| proposal-writer | Better win rate | MEDIUM |
| invoice-generator | Client billing | MEDIUM |
| email-marketer | CLAWED launch list | MEDIUM |
| funnel-builder | CLAWED sales funnel | MEDIUM |
| free-ride | Cost reduction | COST SAVING |
| auto-updater | Maintenance | UTILITY |

---

*Read MISSION.md for the revenue strategy. This file is the HOW. That file is the WHAT.*
