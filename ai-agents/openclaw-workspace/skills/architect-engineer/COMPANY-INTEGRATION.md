# Architect Engineer — Company Integration Guide
## Bridging the Architect Charter to the Architect-Engineer Skill
### Ten Life Creatives — Architect Agent Context

---

## 1. Role Mapping

The Architect builds everything technical at Ten Life Creatives. Here's how the charter maps to reference files:

| Charter Area | Primary Reference File(s) | Secondary |
|---|---|---|
| **PDF Product Generation** | `pdf-generation.md` | `template-systems.md` |
| **Script & Automation Building** | `automation-scripting.md` | `code-development.md` |
| **API Integrations** | `api-integration.md` | `code-development.md` |
| **Database Operations** | `database-ops.md` | `code-development.md` |
| **SOP & Process Docs** | `sop-creation.md` | `documentation.md` |
| **System Design** | `system-design.md` | `ip-packaging.md` |
| **Debugging & Fixing** | `debugging.md` | `quality-standards.md` |
| **Code Reviews** | `quality-standards.md` | `version-control.md` |
| **Git & Deployment** | `version-control.md` | `deployment.md` |
| **IP Packaging** | `ip-packaging.md` | `documentation.md` |
| **Templates** | `template-systems.md` | `pdf-generation.md` |

---

## 2. Our Technical Stack

### Languages & Runtimes
- **Python 3.11+** — Primary language for scripts, automation, PDF generation
- **Node.js 18+** — When required for JS ecosystem tools
- **Bash/Zsh** — System scripts, cron jobs, deployment

### Hosting & Infrastructure
- **Replit** — Primary deployment for bots, webhooks, scheduled scripts
- **Joshua's Mac mini** — Local execution for CPU-intensive tasks (PDF generation)
- **GitHub** — Source control, Actions for CI/CD
- **macOS Darwin 25.2.0 (arm64)** — Primary development environment

### Key Services & APIs
| Service | Purpose | Auth Method | Key Storage |
|---|---|---|---|
| Stripe | Payment processing | API key | Replit Secrets |
| Gumroad | Product sales | Access token | Replit Secrets |
| Airtable | CRM / tracking | Personal access token | Replit Secrets |
| SendGrid | Email delivery | API key | Replit Secrets |
| OpenClaw/openclaw | Agent platform | Managed | Platform |

### Data Storage Approach
- **JSON files** — Transient state, small configs (<1MB)
- **SQLite** — Product catalog, transaction history, local reports
- **Airtable** — CRM records (leads, clients, pipeline)
- **Firebase** (when needed) — Multi-device sync for user-facing apps

---

## 3. Our Products (Know These)

### Digital Products (Gumroad)
| Product | Tech Stack | Key Components |
|---|---|---|
| FamliClaw | Python, PDF | AI-generated family org toolkit |
| Legacy Letters | PDF, Python | Memoir writing journal, fillable |
| Social Media Playbook | PDF, Markdown | Creator toolkit |
| Reddit Master | PDF | Reddit growth guide |
| First Job Playbook | PDF | Career guide, fillable exercises |
| Budget Binder | PDF | Personal finance journal, tracking pages |
| Anxiety Unpack | PDF | Faith-based workbook |
| Pray Deeper | PDF | Prayer journal |
| Scripture Cards | PDF | Devotional card set |

### Services
- **Good Neighbor Design** — Web design for local Colorado businesses ($99/mo)
- **Prayful** — Bible study app (iOS + Web) — in development

### Technical Projects
- **AgentReach** — OpenClaw driver system (own repo, always commit after changes)
- **Revenue Monitor** — Automated daily revenue tracking
- **Product Builder** — Template-based digital product generation pipeline

---

## 4. Standard Project Patterns

### New Script Checklist
When building any new script:
1. Start with the config pattern from `code-development.md`
2. Add logging from day one — never add it retroactively
3. Create `.env.example` before touching `.env`
4. Write the README before the code gets complex
5. Add error handling for every external call
6. Commit after each working increment

### Standard .env.example Template
```bash
# Required
STRIPE_SECRET_KEY=sk_live_xxxxx
GUMROAD_ACCESS_TOKEN=xxxxxxxx
SENDGRID_API_KEY=SG.xxxxxxxxxx
AIRTABLE_API_KEY=patxxxxxxxx.xxxxx
AIRTABLE_BASE_ID=appxxxxxxxx

# Optional
ENVIRONMENT=production
LOG_LEVEL=INFO
TIMEZONE=America/Denver
ALERT_EMAIL=josh@tenlifecreatives.com
```

### Standard Git Commit Format
```bash
# Always push AgentReach changes immediately after they work
git add -A && git commit -m "feat: description" && git push

# Format: <type>(<scope>): <description>
# Types: feat, fix, docs, refactor, chore, test
```

---

## 5. KDP PDF Standards Reference

### Our Standard Book Sizes
| Product Type | Trim Size | Interior |
|---|---|---|
| Workbooks & Journals | 8.5×11 | B&W, white paper |
| Guides & Playbooks | 6×9 | B&W, cream paper |
| Card decks | 5×5 or 5.5×8.5 | Color |

### Gutter Margins by Page Count
- < 150 pages: 0.5" gutter (0.375" min + 0.125" safety)
- 150-300 pages: 0.625" gutter
- 300-500 pages: 0.75" gutter

---

## 6. Ten Life Creatives Engineering Commandments

From Hutch Commandments applied to engineering:

1. **Build for the next agent, not just yourself.** Zero-context operability always.
2. **No single-use scripts.** Everything parameterized and reusable.
3. **Commit after every working increment.** Git history is documentation.
4. **AgentReach changes = commit immediately.** The repo must never fall behind.
5. **API costs are real money.** Cache results, batch calls, respect rate limits.
6. **If it runs in production, it has error handling.** No exceptions.
7. **Config in environment variables.** Never in code.

---

## 7. Cost-Conscious Engineering

Josh has zero runway. Every API call has a cost. Apply these rules:

**Before making API calls:**
- Can this be cached? Cache it.
- Can multiple calls be batched? Batch them.
- Is this call necessary? Sometimes it isn't.

**Rate limit budgets (be conservative):**
- Gumroad: 2 req/sec
- Airtable: 5 req/sec
- OpenAI: 1 req/sec for non-critical tasks
- Stripe: 100 req/sec (not usually an issue)

**Data storage costs:**
- Firestore free tier: 50K reads/day, 20K writes/day
- Stay within free tiers wherever possible
- Use SQLite instead of Firestore for local-only data

---

## 8. Escalation to Hutch

Escalate to Hutch (main session) when:
- Architecture decision would cost real money (>$10/mo)
- Breaking change to an existing, working system
- New external service integration not in our approved stack
- Security concern with any deployed system

Don't escalate:
- Bug fixes in existing systems
- New scripts that don't change existing behavior
- Documentation improvements
- Refactoring with full test coverage
