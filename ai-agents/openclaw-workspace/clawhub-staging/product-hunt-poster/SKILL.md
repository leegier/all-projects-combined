---
name: product-hunt-poster
description: Research, plan, and submit products to Product Hunt for maximum launch day visibility. Drafts the product name, tagline, description, first comment, and launch checklist. Use when launching a game, tool, skill, or digital product on Product Hunt, preparing a PH launch, or researching what makes top PH listings succeed. Triggers on: "post to Product Hunt", "launch on Product Hunt", "PH launch", "submit my product to Product Hunt", "research top Product Hunt listings", "prepare a Product Hunt launch", or any Product Hunt launch task.
---

# product-hunt-poster

Plan and execute a Product Hunt launch for maximum upvotes.

## What Makes a Great PH Launch

- **Timing:** Tuesday–Thursday, go live at 12:01 AM PST
- **Thumbnail:** 240×240px logo, bold colors, clear product name
- **Tagline:** Under 60 chars. Verb-led. Specific benefit. No buzzwords.
- **Gallery:** 3–5 images or GIF showing the product in use
- **First comment:** Maker comment posted within minutes of launch — tells the origin story

---

## Workflow

### Step 1 — Research Successful Listings

```bash
python scripts/ph_launcher.py research --category "developer-tools" --limit 10
```

Fetches top recent launches from Product Hunt API for inspiration.

### Step 2 — Draft Launch Copy

```bash
python scripts/ph_launcher.py draft \
  --name "CLAWED" \
  --category "Games" \
  --tagline "Escape the prison. Built solo in Unity." \
  --description-file posts/clawed-ph-description.txt \
  --maker-comment-file posts/clawed-ph-comment.txt
```

Saves formatted draft to `memory/ph-draft-SLUG.md`.

### Step 3 — Launch Checklist

```bash
python scripts/ph_launcher.py checklist --name "CLAWED"
```

Prints a pre-launch checklist to verify before going live.

### Step 4 — Submit via API

```bash
python scripts/ph_launcher.py submit \
  --name "CLAWED" \
  --tagline "Escape the prison. Built solo in Unity." \
  --url "https://itch.io/game/clawed" \
  --thumbnail "assets/clawed-ph-icon.png"
```

Requires `PRODUCT_HUNT_API_TOKEN` (get at https://www.producthunt.com/v2/oauth/applications).

### Step 5 — Monitor After Launch

```bash
python scripts/ph_launcher.py monitor --post-id 12345
```

Checks upvote count and comment count every 30 min during launch day.

---

## Tagline Formula

`[Verb] [specific outcome] [without/for] [target user]`

Examples:
- "Escape the prison. Built solo in Unity." ✅
- "The AI agent platform for solopreneurs" ✅
- "Revolutionary AI-powered game development tool" ❌ (buzzwords)

---

## References

- Launch day timeline: see `references/launch-timeline.md`
- Top listing analysis: see `references/what-works.md`
