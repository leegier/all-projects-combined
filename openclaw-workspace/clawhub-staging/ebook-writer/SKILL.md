---
name: ebook-writer
description: Research, outline, and write complete ebooks on any topic. Exports to Markdown, clean HTML, or PDF (via pandoc). Use when creating a digital product to sell on Gumroad or Lemon Squeezy, writing a guide, writing a tutorial book, or producing long-form content as a downloadable product. Triggers on: "write an ebook", "create a guide", "write a book about", "make a PDF product", "write a tutorial guide", "I want to sell an ebook about", or any request to produce a multi-chapter document for sale or distribution.
---

# ebook-writer

Research, outline, and write complete ebooks ready to sell as digital products.

## Workflow

1. **Define** — topic, audience, outcome, chapter count
2. **Outline** — generate chapter structure
3. **Write** — draft each chapter
4. **Export** — Markdown → HTML or PDF

---

## Step 1 — Define Your Ebook

Tell the agent:
- **Topic**: what the book is about
- **Audience**: who will read it (beginner devs, solopreneurs, indie gamers, etc.)
- **Outcome**: what the reader can do after finishing
- **Length**: short (5–8 chapters) or full (10–15 chapters)

Example:
> "Write an ebook about making money with AI agents. Audience: non-technical entrepreneurs. Outcome: reader has 3 income streams set up. Short format."

---

## Step 2 — Generate Outline

The agent will produce a chapter list. Confirm or adjust before writing begins.

Example output:
```
Chapter 1: What AI Agents Actually Are (and Why They Print Money)
Chapter 2: The 5 Fastest Ways to Earn With Agents Today
Chapter 3: Setting Up Your First Agent in 30 Minutes
...
```

---

## Step 3 — Write Chapters

Each chapter:
- 600–1200 words (readable in ~5 min)
- Concrete examples, not theory
- Ends with one actionable takeaway
- Written in the voice defined in `assets/voice-guide.md`

Write one chapter at a time, review, then continue.

---

## Step 4 — Export

### To Markdown (default)
Chapters are written as `.md` files in `output/ebook-SLUG/`.

### To HTML (single file)
```bash
python scripts/ebook_export.py --input "output/ebook-SLUG/" --format html --output "output/ebook-SLUG.html"
```

### To PDF (requires pandoc)
```bash
python scripts/ebook_export.py --input "output/ebook-SLUG/" --format pdf --output "output/ebook-SLUG.pdf"
```

Install pandoc: https://pandoc.org/installing.html

---

## Selling on Gumroad

1. Zip the PDF: `Compress-Archive output/ebook-SLUG.pdf output/ebook-SLUG.zip`
2. Upload to Gumroad via `gumroad-manager` skill
3. Set price: $5–$29 depending on depth
4. Write product description using the ebook intro as the blurb

---

## High-Selling Ebook Topics (for MAX)

| Topic | Target audience | Price range |
|-------|----------------|-------------|
| Make Money With AI Agents | Non-tech entrepreneurs | $9–$19 |
| Unity Game Dev for Beginners | Aspiring indie devs | $9–$29 |
| Freelancing With AI Tools | Freelancers | $7–$15 |
| Build and Launch a Micro-SaaS | Developers | $15–$29 |
| The Solopreneur's Automation Playbook | Founders | $9–$19 |

---

## Voice Guide

See `assets/voice-guide.md` for writing style defaults.
