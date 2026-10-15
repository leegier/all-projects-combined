# Upwork Proposals — Python Automation / Scripting Jobs

3 ready-to-adapt proposals. Swap in the client's specific task where marked [TASK].
Each under 300 words.

---

## Proposal 1 — Web Scraping / Data Extraction Job

**Best for:** Jobs asking to scrape websites, extract product data, pull competitor prices, aggregate listings, etc.

---

Hey —

I read through your post and this is exactly the kind of problem I work on every day.

You need [TASK — e.g., "competitor pricing pulled from 5 websites into a spreadsheet automatically"]. I can build that. Here's my approach:

1. Identify the data structure on each target site
2. Build a scraper using Playwright or BeautifulSoup (depending on whether the site needs JavaScript rendered)
3. Output clean CSV/JSON or push directly to Google Sheets
4. Set it up to run on a schedule so you're not touching it manually

A few quick questions to scope it accurately:
- Are any of the target sites heavily JavaScript-dependent or behind login?
- How often do you need the data refreshed — daily, hourly, on-demand?
- Where do you want the output — Sheets, CSV, database?

I've built scrapers for e-commerce, real estate, job boards, and lead databases. I know how to handle rate limiting and anti-bot measures without getting blocked.

I can start immediately and have a working prototype to you within 24–48 hours depending on complexity. Happy to do a quick chat first if that helps.

What does your timeline look like?

— Lee

---

## Proposal 2 — Workflow / Process Automation Job

**Best for:** Jobs about automating repetitive tasks, replacing manual steps, saving time on business processes

---

Hey —

Saw your post — [TASK — e.g., "you're manually moving data between your CRM and spreadsheet every day"] is a perfect candidate for automation. This is what I spend most of my time on.

Here's how I'd approach it:

- Map exactly what you're doing manually, step by step
- Write a Python script that replicates those steps programmatically
- Add error handling so it fails gracefully instead of silently corrupting data
- Document it so your team can maintain it without needing me on retainer

Depending on the tools involved, I'd likely use the relevant APIs (most SaaS tools have them), Selenium if browser automation is needed, or something lighter if the data's already accessible.

I don't pad timelines. If it's a 2-hour job, I'll tell you that and charge accordingly. If it's complex, I'll break it into phases so you see progress fast.

Quick questions:
- What tools are currently involved? (CRM, spreadsheets, email, etc.)
- How often does this process run?
- Is this Windows or Mac/Linux environment?

Ready to start this week. What's your deadline?

— Lee

---

## Proposal 3 — AI / LLM Integration Job

**Best for:** Jobs about adding AI features, integrating ChatGPT/Claude into tools, building internal AI workflows

---

Hey —

This is a good use case for LLM integration and I've built similar things before.

You're looking to [TASK — e.g., "automatically classify incoming support emails and route them to the right team"]. Here's the short version of how I'd build it:

- Connect to your email source via IMAP/Gmail API
- Pass each message through an LLM (OpenAI or Claude depending on cost/quality tradeoffs)
- Return structured output (category, priority, suggested response draft)
- Route or tag in your existing system via API

The tricky part is usually prompt engineering — getting consistent, reliable output from the model without it hallucinating categories or missing context. I've done this tuning before and know what works.

What I'd need from you:
- Sample emails (anonymized is fine) to build and test against
- The categories/labels you want applied
- Where you want the output to land (email client, spreadsheet, Slack, webhook?)

Realistically this is a 3–5 day build for a solid v1. I can show you a working prototype on day 2.

Want to set up a quick 15-minute call to confirm scope?

— Lee
