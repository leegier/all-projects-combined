# 🎯 GHOST BOUNTY REPORT — Live Intel
**Generated:** 2026-03-29 14:38 CDT  
**Agent:** GHOST (bounty hunter sub-agent)  
**Mission:** $500 by Friday

---

## 📋 EXISTING PR STATUS (openclaw/openclaw)

| PR | Title | State | Merged? | Status |
|----|-------|-------|---------|--------|
| #205 | — | **404 NOT FOUND** | — | ❌ PR does not exist in this repo |
| #206 | feat: Introduce allowFromGroups filter for telegram bot | **closed** | No | ⚠️ Closed, NOT merged |
| #208 | — | **404 NOT FOUND** | — | ❌ PR does not exist in this repo |

**Assessment:**
- PR #206 exists but was **closed without merge** (state: closed, merged: false, merged_at: null)
- PRs #205 and #208 return 404 — they do not exist on `openclaw/openclaw`
- **Zero bounty payout from existing PRs** — they're dead ends

---

## 🔥 TOP 3 BOUNTIES TO CHASE TODAY

### 🥇 #1 — [BOUNTY $100] Python Refactor (Algora — ApexOpsStudio)
- **URL:** https://github.com/ApexOpsStudio/ai-gitops-test-target/issues/3
- **Amount:** $100 (posted via `/bounty 100` Algora command)
- **Repo:** ApexOpsStudio/ai-gitops-test-target
- **Task:** Refactor Python CLI app — extract scattered validation logic from `add.py`, `list.py`, `done.py` into `utils/validation.py` and `utils/paths.py`. Pure refactor, no behavior changes.
- **Stack:** Python
- **Difficulty:** ⭐⭐ EASY — it's a straight mechanical refactor. No logic changes, just file reorganization and import updates.
- **Time estimate:** 1–2 hours
- **How to claim:** Comment `/algora start` or open a PR — Algora auto-pays on merge

---

### 🥈 #2 — [BOUNTY $75] CLAUDE.md Template for Next.js + SQLite SaaS
- **URL:** https://github.com/claude-builders-bounty/claude-builders-bounty/issues/2
- **Amount:** $75 (Opire platform)
- **Repo:** claude-builders-bounty/claude-builders-bounty
- **Task:** Write an opinionated `CLAUDE.md` file for a Next.js 15 App Router + SQLite (better-sqlite3/Turso) project. Must cover: folder structure, naming conventions, DB migration rules, dev commands, anti-patterns.
- **Stack:** Documentation / Markdown
- **Difficulty:** ⭐ TRIVIAL — this is literally writing a markdown file with good opinions about Next.js + SQLite
- **Time estimate:** 45 minutes – 1.5 hours
- **How to claim:** Comment `/opire try` on the issue → submit PR → auto-paid on merge

---

### 🥉 #3 — [BOUNTY $50] SKILL: Generate CHANGELOG from git history
- **URL:** https://github.com/claude-builders-bounty/claude-builders-bounty/issues/1
- **Amount:** $50 (Opire platform)
- **Repo:** claude-builders-bounty/claude-builders-bounty
- **Task:** Create a Bash/Python script or Claude Code `SKILL.md` that auto-generates a structured `CHANGELOG.md` from git history. Must: fetch commits since last tag, auto-categorize (Added/Fixed/Changed/Removed), output proper format, include README.
- **Stack:** Python or Bash — MAX is literally running these right now
- **Difficulty:** ⭐⭐ EASY — can be done in Python with `gitpython` or raw `git log` parsing
- **Time estimate:** 1–2 hours
- **How to claim:** Comment `/opire try` → submit PR → auto-paid on merge

---

## 💰 BONUS: Additional Bounties Found

### $200 — Cap Deeplinks + Raycast Extension
- **URL:** https://github.com/CapSoftware/Cap/issues/1540
- **Stack:** Rust/TypeScript (harder — skip for now)
- **Difficulty:** ⭐⭐⭐⭐ — needs Electron deeplinks + Raycast Swift/TS work

### $15 each — Databuddy Feature Flag Folders
- **URL:** https://github.com/databuddy-analytics/Databuddy/issues/271
- Too small relative to effort

### ~$100+ — Archestra Notion Connector
- **URL:** https://github.com/archestra-ai/archestra/issues/3556  
- TypeScript/Python Notion API integration into a complex codebase
- **Difficulty:** ⭐⭐⭐ Medium-hard

---

## 📊 STRATEGY: $500 by Friday

| Bounty | Amount | Time | Platform | Confidence |
|--------|--------|------|----------|-----------|
| ApexOps Python Refactor | $100 | 1-2h | Algora | HIGH |
| Next.js CLAUDE.md | $75 | 1h | Opire | HIGH |
| CHANGELOG SKILL | $50 | 1-2h | Opire | HIGH |
| **TOTAL (bottom 3)** | **$225** | **4-5h** | — | ✅ |

To hit $500, pick up 2–3 more from the 263 open Algora issues. Check:
- https://github.com/search?q=label%3A%22%F0%9F%92%8E+Bounty%22+state%3Aopen+is%3Aissue&type=issues

**Immediate actions:**
1. `/opire try` on issues #1 and #2 at claude-builders-bounty
2. Submit PR to ApexOpsStudio/ai-gitops-test-target
3. Make sure `daddy-gier` GitHub account has Algora + Opire connected for payouts

---

## ⚠️ NOTES
- **BountySource.com** is dead — fetch failed (site appears offline/defunct)
- **Brave API key not configured** — web searches failed, used GitHub API + web_fetch instead
- **Algora UI** is JS-rendered SPA — direct fetch returns only marketing page. Used GitHub API label search instead (263 total open bounties found)
- PR #205 and #208 don't exist on openclaw/openclaw — suspect they were submitted to wrong repo or never existed
