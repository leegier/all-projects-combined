# ClawHub Skill Specs — 24 Skills to Build

MAX: Use `skill-creator` to build each one. Save draft to `clawhub-staging/SKILL_NAME/`.
Do NOT publish directly. Mark READY_FOR_REVIEW in CLAWHUB_PUBLISH_QUEUE.md when done.

Reference an existing well-built skill for format: `cat workspace/skills/coding-agent/SKILL.md`

---

## 1. email-agent
**Slug:** `email-agent`
**Description:** Read, draft, send, and manage emails using any SMTP/IMAP provider. Supports Gmail, Outlook, and custom servers.
**What it does:**
- Connect via IMAP/SMTP (or Gmail API)
- Read unread emails, filter by sender/subject/label
- Draft replies using LLM
- Send emails with attachments
- Mark read, move, archive, delete
**Required config:** `EMAIL_HOST`, `EMAIL_USER`, `EMAIL_PASS` or OAuth token
**Use case:** Automated client communication, cold outreach, newsletter sends
**Related:** himalaya (already installed — this is a higher-level wrapper)

---

## 2. affiliate-tracker
**Slug:** `affiliate-tracker`
**Description:** Track affiliate links, clicks, conversions, and commissions across multiple programs.
**What it does:**
- Generate and manage affiliate links (UTM parameters)
- Track click counts by scraping redirect logs or using link shortener APIs
- Aggregate commission reports from Amazon Associates, ShareASale, Impact, etc.
- Log to `memory/affiliate-report.md`
- Alert when commission threshold reached
**Required config:** Affiliate program API keys (optional — can scrape dashboards)
**Use case:** MAX's passive income tracking for any content with affiliate links

---

## 3. twitter-bot
**Slug:** `twitter-bot`
**Description:** Post tweets, reply to mentions, follow users, and schedule Twitter/X content automatically.
**What it does:**
- Post text tweets, threads, and media
- Schedule posts via queue
- Reply to mentions matching keywords
- Follow/unfollow based on criteria
- Track follower growth
**Required config:** `TWITTER_API_KEY`, `TWITTER_API_SECRET`, `TWITTER_ACCESS_TOKEN`, `TWITTER_ACCESS_SECRET`
**Use case:** Promote CLAWED game, build following for The Hollow brand, post indie dev content
**Note:** Include rate limit handling. Twitter API free tier = 500 tweets/month.

---

## 4. reddit-poster
**Slug:** `reddit-poster`
**Description:** Post to Reddit subreddits, comment, upvote, and track post performance.
**What it does:**
- Submit link or text posts to specified subreddits
- Schedule posts for optimal times (check subreddit activity)
- Monitor post karma and comments
- Cross-post to multiple subreddits
- Avoid spam detection (rate limiting, varied post times)
**Required config:** `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USERNAME`, `REDDIT_PASSWORD`
**Target subreddits for MAX:** r/indiegaming, r/gamedev, r/Unity3D, r/entrepreneur, r/SideProject
**Note:** Must follow Reddit's ToS — no spam, no vote manipulation

---

## 5. tiktok-poster
**Slug:** `tiktok-poster`
**Description:** Upload and schedule TikTok videos with captions, hashtags, and sound settings.
**What it does:**
- Upload video files to TikTok via API or browser automation
- Set caption, hashtags, privacy settings
- Schedule for best posting times
- Track views, likes, shares
**Required config:** TikTok API credentials or browser session
**Use case:** CLAWED gameplay clips, devlog shorts, "building a game" series

---

## 6. instagram-bot
**Slug:** `instagram-bot`
**Description:** Post images/reels to Instagram, manage captions, hashtags, and story uploads.
**What it does:**
- Upload images and carousel posts
- Post Reels (short videos)
- Set captions with hashtags
- Schedule posts
- Track engagement metrics
**Required config:** Instagram Basic Display API or session token
**Use case:** CLAWED screenshots, concept art, behind-the-scenes dev content

---

## 7. product-hunt-poster
**Slug:** `product-hunt-poster`
**Description:** Research, draft, and submit products to Product Hunt for launch day visibility.
**What it does:**
- Research top-performing Product Hunt listings for formatting tips
- Draft product name, tagline, description, and first comment
- Checklist: thumbnail, media, makers, topics, launch day prep
- Post via Product Hunt API or guided browser flow
- Track upvotes and comments post-launch
**Required config:** `PRODUCT_HUNT_API_TOKEN`
**Use case:** Launching CLAWED, any digital product, or ClawHub itself

---

## 8. gumroad-manager
**Slug:** `gumroad-manager`
**Description:** Manage Gumroad products, pricing, discounts, and sales analytics via the Gumroad API.
**What it does:**
- Create and update products (name, price, description, files)
- Apply discount codes
- Pull sales data and revenue reports
- Check subscriber/follower count
- Send updates to buyers
**Required config:** `GUMROAD_ACCESS_TOKEN`
**Use case:** MAX's digital product store — ebooks, templates, tools

---

## 9. stripe-billing
**Slug:** `stripe-billing`
**Description:** Create charges, manage subscriptions, send invoices, and track Stripe revenue.
**What it does:**
- Create payment links and checkout sessions
- Set up and manage subscriptions
- Generate and send invoices
- Query revenue by period
- Handle refunds and disputes
**Required config:** `STRIPE_SECRET_KEY`
**Use case:** Billing clients for freelance work, recurring service payments

---

## 10. bug-bounty-hunter
**Slug:** `bug-bounty-hunter`
**Description:** Discover, research, and report security vulnerabilities for bug bounty programs on HackerOne, Bugcrowd, and Intigriti.
**What it does:**
- List open bug bounty programs matching scope/payout criteria
- Research target using passive recon (DNS, Shodan, crt.sh, Wayback Machine)
- Identify common vulnerability classes to test (XSS, IDOR, SQLi, SSRF)
- Draft professional vulnerability report using CVSS scoring
- Track submissions and payouts in `memory/bounty-log.md`
**Required config:** HackerOne/Bugcrowd account credentials (optional)
**Note:** ONLY authorized programs. No unauthorized testing. Include ethics reminder in SKILL.md.

---

## 11. deployment-agent
**Slug:** `deployment-agent`
**Description:** Deploy web apps and static sites to Netlify, Vercel, Railway, or Fly.io via CLI.
**What it does:**
- Build project (`npm run build`, etc.)
- Deploy to chosen platform
- Set environment variables
- Roll back to previous version if deploy fails
- Report deployment URL when done
**Required config:** Platform API tokens
**Use case:** Deploy CLAWED marketing site, client websites, landing pages

---

## 12. ci-cd-helper
**Slug:** `ci-cd-helper`
**Description:** Set up and manage GitHub Actions, GitLab CI, and basic CI/CD pipelines.
**What it does:**
- Generate workflow YAML files for common patterns (test, build, deploy)
- Trigger pipeline runs via API
- Monitor run status and report failures
- Cache busting, secrets management guidance
**Required config:** GitHub token
**Use case:** Automate CLAWED Unity builds, client project pipelines

---

## 13. analytics-reporter
**Slug:** `analytics-reporter`
**Description:** Pull and summarize analytics from Google Analytics 4, Plausible, or Umami.
**What it does:**
- Fetch page views, sessions, bounce rate, top pages
- Compare to previous period
- Format as daily/weekly summary report
- Send to Telegram or log to memory
**Required config:** GA4 API or Plausible API key
**Use case:** Track CLAWED itch.io page traffic, client website performance

---

## 14. competitor-tracker
**Slug:** `competitor-tracker`
**Description:** Monitor competitor products, prices, reviews, and rankings automatically.
**What it does:**
- Scrape competitor itch.io pages for ratings, downloads, price changes
- Track Steam reviews for similar games
- Monitor Upwork/Fiverr competitor gig changes
- Alert when competitor drops price or gets featured
- Log to `memory/competitor-intel.md`
**Required config:** None (uses web scraping)
**Use case:** Stay ahead of similar indie games and freelance competitors

---

## 15. deal-finder
**Slug:** `deal-finder`
**Description:** Find deals on software licenses, hosting, domains, and tools using discount aggregators.
**What it does:**
- Check AppSumo, PitchGround, StackSocial for relevant deals
- Filter by category (dev tools, marketing, productivity)
- Alert on deals matching saved criteria
- Calculate ROI vs. monthly subscription cost
**Required config:** None
**Use case:** Reduce operational costs for Lee's tools

---

## 16. crypto-tracker
**Slug:** `crypto-tracker`
**Description:** Track cryptocurrency prices, portfolio value, and DeFi positions.
**What it does:**
- Fetch prices from CoinGecko API (free, no key needed)
- Calculate portfolio value from holdings list
- Alert on significant price moves (>10%)
- Daily summary to Telegram
**Required config:** Holdings list in config (no wallet connection needed)
**Note:** No trading, no wallet access, read-only price data only

---

## 17. podcast-creator
**Slug:** `podcast-creator`
**Description:** Plan, script, and produce podcast episodes — from outline to edited audio using TTS.
**What it does:**
- Generate episode outline from topic
- Write full script optimized for audio
- Convert to speech using ElevenLabs TTS (via `sag` skill)
- Export MP3 with metadata tags
- Generate show notes and chapter markers
- Create RSS-compatible episode entry
**Required config:** `ELEVENLABS_API_KEY` (already set)
**Use case:** "Building CLAWED" devlog podcast, "AI Money Maker" show for MAX

---

## 18. ebook-writer
**Slug:** `ebook-writer`
**Description:** Research, outline, and write ebooks on any topic — export to Markdown, HTML, or PDF.
**What it does:**
- Research topic using web search
- Generate chapter outline
- Write full chapters with LLM
- Format as clean Markdown
- Export to PDF via pandoc or HTML
- Generate cover page description (for openai-image-gen to create art)
**Required config:** None
**Use case:** Sell ebooks on Gumroad — "Make Money with AI Agents", "Unity Game Dev Guide", etc.

---

## 19. course-creator
**Slug:** `course-creator`
**Description:** Structure and write online course content — modules, lessons, quizzes, and resources.
**What it does:**
- Define course topic, audience, and outcome
- Generate full curriculum with modules and lessons
- Write lesson scripts and slide notes
- Create quiz questions per module
- Export as structured Markdown or JSON for Teachable/Gumroad
**Required config:** None
**Use case:** "Build and Ship a Unity Game in 30 Days" course — sell for $29-99

---

## 20. landing-page-builder
**Slug:** `landing-page-builder`
**Description:** Generate high-converting landing page HTML/CSS for any product or service.
**What it does:**
- Input: product name, target audience, key benefits, CTA, price
- Output: complete single-page HTML with hero, features, testimonials, CTA, footer
- Uses URP-safe CSS (no external dependencies needed)
- Mobile responsive
- Includes basic SEO meta tags
**Required config:** None
**Use case:** CLAWED game landing page, client websites, lead capture pages
**Output:** Save to `workspace/output/landing-SLUG.html`

---

## 21. sales-pipeline
**Slug:** `sales-pipeline`
**Description:** Track deals from lead to close — stages, values, follow-ups, and forecasting.
**What it does:**
- Define pipeline stages (Lead → Qualified → Proposal → Negotiation → Closed)
- Add, update, and move deals between stages
- Set follow-up reminders
- Calculate pipeline value and close rate
- Store in `memory/pipeline.json`, report in `memory/pipeline-report.md`
**Required config:** None (file-based, no external CRM needed)
**Use case:** MAX's freelance deal tracking

---

## 22. lead-generator
**Slug:** `lead-generator`
**Description:** Find potential clients and leads using web search, LinkedIn, and job boards.
**What it does:**
- Search for businesses matching criteria (e.g., "small business no website", "hiring Unity developer")
- Extract contact info from public sources
- Score leads by fit (budget, urgency, match)
- Export to `memory/leads.md` in prioritized list
- Feed top leads into `cold-outreach` skill
**Required config:** None (uses web scraping and search)
**Note:** Only public data. No unauthorized scraping of private profiles.

---

## 23. nda-drafter
**Slug:** `nda-drafter`
**Description:** Generate professional Non-Disclosure Agreements customized to the project and parties.
**What it does:**
- Input: party names, effective date, purpose, duration, jurisdiction
- Output: complete NDA document in Markdown or plain text
- Covers: confidential information definition, obligations, exclusions, term, remedies
- Includes mutual and one-way variants
**Required config:** None
**Note:** DISCLAIMER must be included: "This is not legal advice. Review with a licensed attorney before signing."
**Use case:** Protect Lee's ideas when working with clients or contractors

---

## 24. terms-generator
**Slug:** `terms-generator`
**Description:** Generate Terms of Service and Privacy Policy documents for websites, apps, and games.
**What it does:**
- Input: business name, product type, jurisdiction (US/EU/etc.), data collected
- Output: complete Terms of Service + Privacy Policy in Markdown
- Covers GDPR basics for EU, CCPA basics for California
- Separate templates for: SaaS, game, content site, mobile app
**Required config:** None
**Note:** DISCLAIMER must be included: "This is not legal advice. Review with a licensed attorney."
**Use case:** CLAWED game on itch.io, any product/website Lee ships
