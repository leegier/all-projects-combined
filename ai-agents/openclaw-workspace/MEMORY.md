# MEMORY.md — MAX's Long-Term Memory

_This file is injected into MAX's context every session. Keep it current. Distilled wisdom, not raw logs._

> Related: [[SOUL.md]] | [[IDENTITY.md]] | [[MISSION.md]] | [[HEARTBEAT.md]] | [[USER.md]] | [[TEAM.md]]

---

## Channel Rules (CRITICAL)

**Never send session metadata, null JSON blocks, or debug text (NO_REPLY, HEARTBEAT_OK, etc.) to Discord or Telegram.** If session metadata is all null, you are in an internal boot/heartbeat session — work silently. Only post to channels when you have actual results (task done, blocker hit, or >8h since last contact).

### Channel Split — MANDATORY
- **Discord** = Unity/Unreal game dev updates + casual conversation ONLY
- **Telegram** = ALL money-making, stocks, freelance, financial activities ONLY
- Never mix these. Revenue reports go to Telegram. Game build updates go to Discord.

---

## Who I Am

I am MAX — an autonomous AI agent running on OpenClaw. My job is to make Lee money, build things, and operate 24/7 without hand-holding. I run on `ollama/mistral-nemo-agent:latest` as primary (free, tool-capable), `ollama/llama31-agent:latest` as fallback 1, then `anthropic/claude-sonnet-4-6` as final fallback (paid, quality-critical only). **NOTE: gemma3:27b does NOT support tools — do NOT use it as primary.**

---

## Who Lee Is

- **Name:** Lee Gierl (username: leegier2222 / THE_NYGHTSHADE_HOLLOW)
- **Location:** Windows 11, `C:\Users\Gierl`
- **Discord server:** Nightshade Hollow (guild: 1484731360382812204)
- **Telegram bot:** @MAX_MAX_MAX_BOT_BOT
- **Style:** Direct, autonomous. Hates hand-holding. Gives big directives, expects execution.
- **Goal:** Build revenue streams from nothing. Lee is not at keyboard most of the time.

---

## My Infrastructure

| Thing | Where |
|-------|-------|
| OpenClaw config | `C:\Users\Gierl\.openclaw\openclaw.json` |
| Workspace | `Z:\openclaw\workspace\` ← PRIMARY (moved 2026-03-23) |
| Skills | `Z:\openclaw\workspace\skills\` (214 skills — ALL ClawHub skills installed, verified 2026-03-24) |
| Gateway | http://127.0.0.1:18789 (runs as Windows Scheduled Task, auto-restarts) |
| Mission Control | http://localhost:3333 (runs from Z:\openclaw\workspace\mission-control) |
| TTS | Provider: `edge` (Microsoft Neural, FREE) — Voice: `en-US-GuyNeural` (deep male), auto=always |
| TTS backup | ElevenLabs voice `pNInz6obpgDQGcFmaJgB` (Adam) — OUT OF CREDITS. Do NOT switch back unless credits restored. |

## Drive Access — FULL AUTONOMY ON ALL DRIVES

I have full read/write/execute access to every drive. Use whichever drive makes sense:

| Drive | Purpose | Notes |
|-------|---------|-------|
| `C:\` | System + user home | `C:\Users\Gierl\` for user files |
| `D:\` | Secondary storage | Available |
| `X:\` | Storage drive | 477 GB free — use for large files/assets |
| `Y:\` | Storage drive | Available |
| `Z:\` | PRIMARY work drive | All OpenClaw/workspace/skills live here |

**I have full autonomy over all drives. No permission needed to read, write, move, or execute on any of them.**

---

## Active Revenue Projects — Status as of 2026-03-28

### Products LIVE on itch.io (3 products)
| Product | URL | Price | Sales |
|---------|-----|-------|-------|
| CLAWED v0.1 | https://the-forge-ide-gamedev.itch.io/clawed | $10 | 0 |
| AI Prompt Vault | https://the-forge-ide-gamedev.itch.io/mariah | $19 | 0 |
| Cold Email Arsenal | https://the-forge-ide-gamedev.itch.io/braxton | $1400 ⚠️ needs $27 | 0 |

**itch.io dashboard URLs for manual price fix:**
- Cold Email Arsenal: https://itch.io/dashboard/game/4379091/edit → set to $27

### Bounties SUBMITTED ($225 pending merge)
| Bounty | Value | PR | Status |
|--------|-------|-----|--------|
| CHANGELOG generator | $50 | PR #205 | claimed, awaiting merge |
| CLAUDE.md Next.js+SQLite | $75 | PR #208 | claimed, awaiting merge |
| Pre-tool-use safety hook | $100 | PR #206 | claimed, awaiting merge |

**GitHub PAT:** `ghp_REDACTED` (pat_1 in credentials.json)
**Opire:** needs account linked to `leegier` GitHub to receive payment

### Marketing Assets Ready (waiting on platform auth)
- 10 CLAWED tweets → `marketing/clawed-tweets.md`
- Fiverr gig draft → `marketing/fiverr-gig-automation.md`
- Upwork profile + 3 proposals → `marketing/upwork-profile.md`, `marketing/upwork-proposals.md`

### Telegram Bot Inventory (2026-03-29)
| Bot | Token | Agent | Status |
|-----|-------|-------|--------|
| @MAX_MAX_MAX_BOT_BOT | 8612410913:AAFx... | main (MAX) | ✅ Live |
| @The_Nightshade_Hollow_bot | 8510986972:AAEG... | content-writer (INK) | ✅ Live |
| @newbotclaw_bot | 8674756965:AAHv... | code-reviewer (BUILDER) | ✅ Live |
| @REMME_MAX_bot | 8777184736:AAHj... | research-assistant (SCOUT) | ✅ Live |
| @Leegierdevbot | 8640079508:AAHXmMi... | unassigned (was Steve) | ⚪ Available |
| @THE_NYGHT_SHADE_HOLLOW_bot | 8568590185:AAG6... | unassigned | ⚪ Available |

### Messaging Status (2026-03-29)
- **Telegram BROKEN** — Lee must message `@MAX_MAX_MAX_BOT_BOT` first to register chat ID.
- **Discord WORKING** — messages send successfully to #general (1484731361272139838)
- **Discord #mission-control** — bot needs Manage Channels permission to create it (Server Settings → Roles → @MAX)

---

### 1. CLAWED (TOP PRIORITY — two parallel projects)
- **What:** Prison survival RPG — player escapes from prison avoiding guards
- **Unity project (scripts/build):** `Z:\Dev\UNITY\BETTERNOW` — Unity 6000.4.0f1 + URP
- **Unity project (assets/new):** `Z:\Dev\UNITY\CLAUDE\CLAUDE` (productName: CLAUDE — 19 asset packages pending import)
- **UE5 project (ACTIVE):** `Z:\Gierl\Projects\CLAWED\CLAWED\` — has DataTables (Factions, NPCArchetypes, PrisonRoutine, etc.) and compiled binaries. Lee is actively working this. UE5 is Claude's domain — MAX does not touch it.
- **Status:** Core scripts written, scene builder script ready, needs compile + scene build
- **Tasks:** Read `CLAWED_TASKS.md` every session and work the task list
- **Revenue:** Sell on itch.io at $2.99 early access → fund UE5 version
- **Unity exe:** `Z:\Dev\UNITY\Unity Hub\6000.4.0f1\Editor\Unity.exe`
- **Git:** initialized at project root, branch `main`
- **Key scripts location:** `Z:\Dev\UNITY\BETTERNOW\Assets\CLAWED\Scripts\`
- **Auto scene builder:** `CLAWED.Editor.CLAWEDSceneBuilder.BuildScene` (run via -executeMethod)

**Asset packages pending import into CLAUDE project (Z:\Dev\UNITY\CLAUDE\CLAUDE\Assets\):**
Modular Brick Houses, Modular Industrial Catwalk Kit Free, Mines and Cave Set, Music - Ancient Library, LockDown Prison, Desks Starter Collection, Male Character Vocalizations SFX LITE, Interiors A, Furnished Cabin, IvyLite, Horror SFX, Flooded Grounds, Insurgent LITE, Footsteps Essentials, Horror Game Essentials, Exterior Swimming Pool, Free Sound Effects Pack, FREE Casual Game SFX Pack, Free Sample Animation Set

### 2. Freelance Pipeline
- Platforms: Fiverr, Upwork, Freelancer, Algora (bounties)
- Status: Accounts not yet registered — MAX should do this
- Skills: `freelancer-bidder`, `freelance-proposal-engine`, `openclaw-money-maker`

### 3. Digital Products
- Platform: Gumroad, Lemon Squeezy
- Status: Not yet set up
- Skills: `canvas`, `openai-image-gen`, `massblogger`

### 4. ClawHub Skills Publishing — **REVIEW GATE IN PLACE**
- ClawHub marketplace was EMPTY when last checked — first publisher wins
- 24 skills to build — full specs in `CLAWHUB_SKILL_SPECS.md`
- Build order and status tracked in `CLAWHUB_PUBLISH_QUEUE.md`
- **CRITICAL RULE: MAX drafts → Claude reviews → THEN publish. Never auto-publish.**
- Brand name on the line: Nightshade Hollow. Nothing sloppy goes out.
- Save all skill drafts to `workspace/clawhub-staging/SKILL_NAME/`
- Mark READY_FOR_REVIEW when done — Lee triggers Claude Code to review

---

## Platform Accounts (track status here)

| Platform | Status | Username |
|----------|--------|----------|
| Fiverr | NOT registered | — |
| Upwork | NOT registered | — |
| Freelancer | NOT registered | — |
| Gumroad | NOT registered | — |
| Lemon Squeezy | NOT registered | — |
| Algora (bounties) | NOT registered | — |
| PayAClaw | NOT registered | — |
| itch.io | NOT registered | — |
| Netlify | NOT registered | — |

---

## Model Strategy

- **PRIMARY: `ollama/mistral-nemo-agent:latest`** — all tasks (heartbeats, research, code, proposals, content)
- **FALLBACK 1: `ollama/llama31-agent:latest`** — if mistral-nemo fails
- **FALLBACK 2: `anthropic/claude-sonnet-4-6`** — only if Ollama errors 2+ times or quality is critical
- **BANNED: `gemma3:27b`** — does NOT support tools, causes error 400 on every tool call. NEVER use as primary.
- **Goal:** Near-zero API cost until Lee has steady revenue

---

## Mission Control (2026-03-28)
- URL: http://localhost:3333
- New screens added: /team (11 agent cards, live status) and /calendar (cron + heartbeat schedule)
- Config: Z:\openclaw\workspace\mission-control\mc-config.json
- To start: `node server.js` from mission-control directory

## Key Lessons Learned

- Gateway auto-restarts via Windows Scheduled Task — no manual restart needed after config changes (just wait ~30s)
- ClawHub install command: `clawhub install SLUG --workdir Z:/openclaw/workspace --no-input --force`
- Bundled skills are at `C:\Users\Gierl\AppData\Roaming\npm\node_modules\openclaw\skills\`
- Workspace skills are at `Z:\openclaw\workspace\skills\` (214 skills as of 2026-03-23)
- Mission Control token: `4503b9af0c6c27ff36bf4ef43dc3748bda660ccfec5aaacb` (in mc-config.json)
- Kill port conflicts: `powershell -Command "Stop-Process -Id PID -Force"`
- PNTERTHANG.unitypackage = 8.5 GB asset pack ALREADY imported into BETTERNOW project
- Bridge Telegram ↔ Discord: relay messages between channels (already in SOUL.md)
- **MODEL FIX (2026-03-23):** gemma3:27b BREAKS ALL TOOL CALLS (error 400). Primary is now `ollama/mistral-nemo-agent:latest`. Never revert to gemma3.
- **SESSION RESET (2026-03-23):** Telegram session was reset fresh. Start new sessions clean.
- When messages go unanswered — check if model is failing silently (empty content []) and escalate to Claude.

---

## Skills Inventory (116+ installed)

Key revenue skills:
- `openclaw-money-maker` — main revenue coordination
- `freelancer-bidder` — auto-bid on freelance gigs
- `freelance-proposal-engine` — write winning proposals
- `proposal-writer` — professional proposal generation
- `cold-outreach` — cold email/DM campaigns
- `github` + `gh-issues` — GitHub bounties via Algora
- `coding-agent` — write and ship code
- `canvas` — design graphics for products
- `openai-image-gen` — generate images for products/content
- `massblogger` — bulk content creation
- `postthatlater` + `xreply` + `social-poster` — social media posting
- `linkedin-poster` — LinkedIn content
- `youtube-uploader` — YouTube video publishing
- `content-scheduler` — schedule content across platforms
- `seo-optimizer` — SEO for content/products
- `sag` — ElevenLabs TTS (voice for content)
- `skill-creator` — build + publish ClawHub skills (passive income)
- `playwright-pro` — browser automation (register accounts, submit forms)
- `himalaya` — email management
- `email-marketer` — email campaigns
- `notion` + `trello` + `project-manager` — project tracking
- `invoice-generator` + `contract-generator` — client billing/legal docs
- `client-onboarding` — new client workflows
- `crm-manager` — track leads and clients
- `funnel-builder` — sales funnel automation
- `chatbot-builder` — build chatbots to sell
- `customer-support` — automated customer support
- `vulnerability-scanner` + `code-auditor` — security work/bounties
- `website-monitor` + `uptime-checker` — monitoring services to sell
- `news-aggregator` + `stock-watcher` + `price-monitor` — market intelligence
- `self-improving-agent` — self-improvement/error capture (★2.6k)
- `proactive-agent` — proactive behavior patterns (★611)
- `free-ride` — access free AI models via OpenRouter
- `auto-updater` — keep skills auto-updated
- `skill-vetter` — security vet new skills before install
- `clawdhub` — skill manager CLI
- `web-scraper` — scrape web data for research/products
- `time-tracker` — track billable hours
- `api-tester` + `load-tester` — QA services to sell
- `docker-manager` + `database-manager` — devops services

Full list: `ls Z:\openclaw\workspace\skills\` (214 skills as of 2026-03-23)

---

## Sub-Agents (LIVE — Real OpenClaw Agents)

Use: `openclaw agent --to <ID> --message "task" --deliver`

| Name | Agent ID | Specialty |
|------|----------|-----------|
| 🔍 SCOUT | `research-assistant` | Web research, market data, current info |
| 🧠 DEEP | `research-bot` | Multi-source deep dives, credibility checks |
| ✍️ INK | `content-writer` | Blog posts, social copy, itch.io listings |
| 🛠️ LINT | `code-reviewer` | Unity C# bugs, compile errors, code audits |
| 👻 GHOST | `security-scanner` | Bug bounties, vulnerability research |

**After every delegation: check `AGENT_FAILURES.md`. If updated → post to Discord `1484731361272139838` immediately.**
**Test protocol:** `Z:\openclaw\workspace\AGENT_TEST.md`
**Failure log:** `Z:\openclaw\workspace\AGENT_FAILURES.md`

---

## Daily Memory Files

- `memory/2026-03-23.md` — full session log (reboot, fixes, sub-agents created)
- `memory/accounts.md` — platform registration tracker (all pending)
- `memory/money-2026-03.md` — March 2026 P&L (currently $0)
- `memory/heartbeat-state.json` — last check timestamps

---

_Update this file when: milestones hit, accounts registered, strategy changes, lessons learned._
_Do NOT put: raw session logs, temporary notes, things that belong in daily files._
**Full protocol: Z:\openclaw\workspace\TEAM.md**
**Test protocol: Z:\openclaw\workspace\AGENT_TEST.md**
**Failure log: Z:\openclaw\workspace\AGENT_FAILURES.md**
