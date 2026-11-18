# Bounty Hunt Results - April 13, 2026

## PRIORITY TARGETS (Fastest Cash)

### 1. Expensify/App - "$250 Saved search highlight bug" (ONE-LINE FIX)
- **Repo:** Expensify/App
- **Issue:** https://github.com/Expensify/App/issues/87769
- **Bounty:** $250
- **What:** Saved search tab doesn't highlight as active on mobile. Fix is a one-line guard condition in `SearchPageTabSelector.tsx`.
- **Difficulty:** EASY - literally one line of code change
- **Claude can write fix:** YES - the solution is already described in the issue
- **Language:** TypeScript/React Native
- **How to claim:** Submit PR, Expensify pays on merge. Must follow their contributor guide.
- **RECOMMENDED: START HERE**

### 2. Expensify/App - "$250 Legacy Fireworks Empty State"
- **Repo:** Expensify/App
- **Issue:** https://github.com/Expensify/App/issues/87766
- **Bounty:** $250
- **What:** Remove a legacy oversized "Fireworks" illustration from the Home page empty state array. It's 164x148 when everything else is 68x68.
- **Difficulty:** EASY - remove one entry from an array + cleanup
- **Claude can write fix:** YES
- **Language:** TypeScript/React Native
- **How to claim:** Submit PR following Expensify contributor guidelines

### 3. Expensify/App - 221 MORE $250 bounties
- **Repo:** Expensify/App
- **Issue list:** https://github.com/Expensify/App/issues?q=is%3Aissue+is%3Aopen+label%3A%22Help+Wanted%22
- **Bounty:** $250 each (223 total open issues = $55,750 in available bounties)
- **What:** Mix of bugs - UI glitches, broken buttons, wrong states. Many are simple CSS/layout/logic fixes.
- **Difficulty:** EASY to MEDIUM (varies per issue)
- **Claude can write fix:** YES for most UI bugs
- **Language:** TypeScript, React Native, JavaScript
- **GOLD MINE: Pick 3-4 easy bugs, knock them out fast**

---

## MEDIUM TARGETS (Higher Pay, More Work)

### 4. Cal.com - "$200 Guest availability on reschedule"
- **Repo:** calcom/cal.com
- **Issue:** https://github.com/calcom/cal.com/issues/16378
- **Bounty:** $200 (via Algora)
- **What:** When host reschedules, check if guest is a Cal.com user and respect their availability.
- **Difficulty:** MEDIUM - requires understanding Cal.com's booking/availability system
- **Claude can write fix:** YES with codebase context
- **Language:** TypeScript, Next.js
- **How to claim:** Submit PR with `/claim #16378` in PR body

### 5. Cal.com - "$200 Proton Calendar Integration"
- **Repo:** calcom/cal.com
- **Issue:** https://github.com/calcom/cal.com/issues/5756
- **Bounty:** $200 (via Algora)
- **What:** Integrate Proton Calendar with Cal.com for availability checks.
- **Difficulty:** MEDIUM-HARD - requires understanding Proton Calendar API + Cal.com integration patterns
- **Claude can write fix:** YES with API docs
- **Language:** TypeScript, Next.js

### 6. Cal.com - "$50 Booking questions in routing forms"
- **Repo:** calcom/cal.com
- **Issue:** https://github.com/calcom/cal.com/issues/18987
- **Bounty:** $50 (via Algora)
- **What:** Unify booking question UI between event types and routing forms.
- **Difficulty:** MEDIUM - code reuse/refactoring task
- **Claude can write fix:** YES
- **Language:** TypeScript, Next.js

---

## HIGH-VALUE TARGETS (Bigger Payoff, Bigger Effort)

### 7. Twenty CRM - "$2,500 IMAP Integration"
- **Repo:** twentyhq/twenty
- **Issue:** Available via https://algora.io/twentyhq/home
- **Bounty:** $2,500 (via Algora)
- **What:** Build IMAP email integration for Twenty CRM (open-source Salesforce alternative, YC S23)
- **Difficulty:** HARD - full email sync integration
- **Claude can write fix:** Partially - would need architecture guidance
- **Language:** TypeScript, React

### 8. Archestra - "$500 Agent schedule triggers"
- **Repo:** archestra-ai/archestra
- **Issue:** https://github.com/archestra-ai/archestra/issues/3378
- **Bounty:** $500 (via Algora)
- **What:** Implement schedule-based triggers for AI agents
- **Difficulty:** MEDIUM-HARD
- **Language:** TypeScript

---

## ACTION PLAN (Get Cash Fastest)

### Immediate (Today):
1. Fork Expensify/App
2. Fix issue #87769 (saved search highlight) - ONE LINE FIX = $250
3. Fix issue #87766 (fireworks illustration) - EASY removal = $250
4. Submit both PRs following Expensify contributor guide
5. Browse remaining 221 Expensify issues for more quick wins

### This Week:
6. Pick 2-3 more easy Expensify bugs = $500-$750
7. Tackle Cal.com #16378 ($200) if Expensify PRs are in review

### Realistic Quick Earnings:
- 2 easy Expensify bugs today = $500
- 3-4 more this week = $750-$1,000
- Cal.com bounty = $200
- **Total potential this week: $1,200-$1,700**

---

## PLATFORMS TO MONITOR

| Platform | URL | Notes |
|----------|-----|-------|
| Algora | https://algora.io/bounties/ | Main OSS bounty aggregator |
| Expensify | https://github.com/Expensify/App/issues?q=label%3A%22Help+Wanted%22 | 223 open $250 bounties |
| Cal.com | https://algora.io/cal/bounties?status=open | $25-$200 bounties |
| BountyHub | https://www.bountyhub.dev/en | Aggregator |
| IssueHunt | https://oss.issuehunt.io/ | Crowdfunded bounties |
| CodeBounty | https://www.codebounty.ai/ | Pre-funded bounties |
| Boss.dev | https://www.boss.dev/ | GitHub bounty integration |

---

## IMPORTANT NOTES

- Expensify pays REAL CASH for merged PRs. They have a well-established contributor program.
- Algora bounties pay via bank transfer after PR merge (2-5 days).
- Always read the contributor guide before submitting.
- Include `/claim #ISSUE` in PR body for Algora bounties.
- Expensify requires proposals before working - comment on the issue first.
- Multiple people may compete for the same bounty - speed matters.
- Your claude-builders-bounty repo bounties ($575) are ones YOU posted, not claimable by you.
