# ClawHub Skill Publishing Queue

## THE RULE — READ THIS FIRST

**MAX builds. Claude reviews. Nothing publishes without approval.**

This is non-negotiable. Nightshade Hollow's reputation is on the line with every published skill.
A bad skill = bad reviews = brand damage. Don't rush it.

---

## Workflow

```
MAX drafts skill → saves to clawhub-staging/SKILL_NAME/ → marks status READY_FOR_REVIEW
    ↓
Claude reviews: quality, accuracy, no harmful code, good docs
    ↓
Claude marks APPROVED or returns with CHANGES_NEEDED notes
    ↓
MAX applies changes if any → publishes via skill-creator
    ↓
Mark status: PUBLISHED + add clawhub URL
```

---

## Quality Bar (What Claude will check)

Before any skill goes live, it must pass:

1. **Accurate description** — does what it says, no exaggeration
2. **Working SKILL.md** — clear instructions, real examples, correct metadata
3. **No broken dependencies** — any required bins/APIs are documented
4. **No harmful code** — no data exfiltration, no destructive commands
5. **Professional tone** — no typos, no vague instructions, no placeholder text left in
6. **Correct pricing** — free for simple tools, premium only if genuinely valuable
7. **Brand safe** — nothing embarrassing, illegal, or that could get The Hollow flagged

---

## The 24 Skills MAX Needs to Build

| # | Skill Slug | Category | Priority | Status |
|---|-----------|----------|----------|--------|
| 1 | `email-agent` | Comms/Revenue | HIGH | 📋 READY_FOR_REVIEW |
| 2 | `affiliate-tracker` | Revenue | HIGH | ?? READY_FOR_REVIEW |
| 3 | `twitter-bot` | Social/Marketing | HIGH | 📋 READY_FOR_REVIEW |
| 4 | `reddit-poster` | Social/Marketing | HIGH | 📋 READY_FOR_REVIEW |
| 5 | `tiktok-poster` | Social/Marketing | MEDIUM | ?? READY_FOR_REVIEW |
| 6 | `instagram-bot` | Social/Marketing | MEDIUM | ?? READY_FOR_REVIEW |
| 7 | `product-hunt-poster` | Launch/Marketing | HIGH | 📋 READY_FOR_REVIEW |
| 8 | `gumroad-manager` | Revenue | HIGH | 📋 READY_FOR_REVIEW |
| 9 | `stripe-billing` | Revenue | HIGH | 📋 READY_FOR_REVIEW |
| 10 | `bug-bounty-hunter` | Revenue/Security | HIGH | 📋 READY_FOR_REVIEW |
| 11 | `deployment-agent` | DevOps | MEDIUM | ?? READY_FOR_REVIEW |
| 12 | `ci-cd-helper` | DevOps | MEDIUM | ?? READY_FOR_REVIEW |
| 13 | `analytics-reporter` | Business Intel | MEDIUM | ?? READY_FOR_REVIEW |
| 14 | `competitor-tracker` | Business Intel | MEDIUM | ?? READY_FOR_REVIEW |
| 15 | `deal-finder` | Revenue | LOW | ?? READY_FOR_REVIEW |
| 16 | `crypto-tracker` | Finance | LOW | ?? READY_FOR_REVIEW |
| 17 | `podcast-creator` | Content | MEDIUM | ?? READY_FOR_REVIEW |
| 18 | `ebook-writer` | Content/Products | HIGH | 📋 READY_FOR_REVIEW |
| 19 | `course-creator` | Content/Products | HIGH | ?? READY_FOR_REVIEW |
| 20 | `landing-page-builder` | Revenue | HIGH | 📋 READY_FOR_REVIEW |
| 21 | `sales-pipeline` | Revenue | HIGH | 📋 READY_FOR_REVIEW |
| 22 | `lead-generator` | Revenue | HIGH | 📋 READY_FOR_REVIEW |
| 23 | `nda-drafter` | Legal/Client | MEDIUM | 📋 READY_FOR_REVIEW |
| 24 | `terms-generator` | Legal/Client | MEDIUM | 📋 READY_FOR_REVIEW |

---

## Status Legend

- 🔲 NOT STARTED — not yet built
- 🔨 IN PROGRESS — MAX is building it
- 📋 READY_FOR_REVIEW — draft saved to clawhub-staging/, awaiting Claude
- ✏️ CHANGES_NEEDED — Claude returned notes, MAX fixing
- ✅ APPROVED — Claude signed off, ready to publish
- 🚀 PUBLISHED — live on ClawHub

---

## Where to Save Drafts

Each skill draft goes in its own folder:
```
workspace/clawhub-staging/EMAIL-AGENT/
    SKILL.md        ← the skill definition (required)
    handler.js      ← skill logic (if needed)
    README.md       ← extra docs (optional)
    REVIEW_NOTES.md ← MAX's notes for Claude
```

When draft is ready: update the table above, change status to 📋 READY_FOR_REVIEW.
Lee will trigger Claude to review next time he's in Claude Code.


