# SOP Creation — Reference Guide

The definitive guide to writing Standard Operating Procedures, workflow documentation, process maps,
runbooks, and operational playbooks. If you want an operation to survive team changes, document it.

---

## TABLE OF CONTENTS
1. What Makes a Great SOP
2. SOP Template Structure
3. Process Map Formats
4. Checklist Design
5. Runbook Pattern
6. Workflow Documentation
7. Decision Trees in SOPs
8. SOP Review & Maintenance
9. Example SOPs (Complete)
10. Anti-Patterns to Avoid

---

## 1. WHAT MAKES A GREAT SOP

A great SOP passes the **Stranger Test**: Could a competent person with no prior context execute
this procedure correctly and safely on their first try?

If yes — you have a great SOP.
If no — it's missing:
- Sufficient context about WHY this matters
- Clear ownership (who does this)
- Specific inputs (what you need before starting)
- Unambiguous steps (no "as appropriate" or "if needed")
- Verification checkpoints (how you know each step worked)
- Failure modes (what to do when it goes wrong)
- Success criteria (how you know the whole thing worked)

### The Five Qualities of SOP Excellence

**1. Atomic Steps**: Each step is one action. "Log in and navigate to settings" = two steps.
**2. Verb-First**: Every step starts with an action verb. "Click", "Enter", "Verify", "Copy".
**3. Expected Outcomes**: After ambiguous steps, state what success looks like: "The dashboard should show..."
**4. Decision Points are Explicit**: When the path splits, name the criteria for each branch.
**5. Version Controlled**: SOPs have version numbers and revision dates. Outdated SOPs cause incidents.

---

## 2. SOP TEMPLATE STRUCTURE

```markdown
# SOP: [Descriptive Title of the Procedure]

**Version:** 1.2  
**Owner:** [Agent or Role]  
**Last Updated:** 2024-01-15  
**Review Cycle:** Quarterly / On Process Change  
**Classification:** Internal Operations  

---

## Purpose
One or two sentences explaining what this procedure accomplishes and why it exists.

## Scope
What this SOP covers (and optionally, what it does NOT cover).

## Trigger
What initiates this procedure? (e.g., "Run every Monday at 9 AM", "Triggered by new Gumroad sale")

## Owner
Who is responsible for executing this procedure? Who is responsible for maintaining it?

## Prerequisites
What must be true BEFORE starting this procedure:
- [ ] Access to [system/account/tool]
- [ ] [Specific data or input] is available
- [ ] [Previous step/dependency] has completed successfully

## Required Access / Credentials
- System A: [where to find credentials]
- System B: [where to find credentials]

---

## Procedure

### Step 1: [Verb + Action]
**Action:** [Specific thing to do]  
**Expected result:** [What you should see/have after this step]  
**Time estimate:** ~2 minutes

### Step 2: [Verb + Action]
**Action:** [Specific thing to do]  
**Expected result:** [What you should see/have after this step]

> ⚠️ **Warning:** [Any important caution at this step]

### Step 3: [Decision Point]
**Check:** Does [condition] apply?

- **YES** → Proceed to Step 4
- **NO** → Skip to Step 7

### Step 4: [Verb + Action]
...

---

## Verification
How to confirm the procedure completed successfully:
- [ ] [Specific check 1]
- [ ] [Specific check 2]
- [ ] [Specific check 3]

## Common Failures & Recovery

| Symptom | Likely Cause | Resolution |
|---|---|---|
| [Error message] | [Root cause] | [Fix steps] |
| [Wrong output] | [Root cause] | [Fix steps] |

## Escalation
If you cannot resolve the issue after [time limit]:
1. Document what failed (screenshots, error messages)
2. Notify [Owner/Role] via [channel]
3. Do NOT [dangerous action] while waiting

## Related SOPs
- [Link to prerequisite SOP]
- [Link to related procedure]

---

**Revision History**
| Version | Date | Changes | Author |
|---|---|---|---|
| 1.0 | 2024-01-01 | Initial version | Architect |
| 1.1 | 2024-01-10 | Added failure modes | Sentinel |
| 1.2 | 2024-01-15 | Updated credentials location | Hutch |
```

---

## 3. PROCESS MAP FORMATS

### ASCII Flow Diagram (Text-Based, Version-Controllable)
```
Gumroad Sale Received
        │
        ▼
┌─────────────────┐
│ Validate webhook │
│ signature        │
└────────┬────────┘
         │
    ✓ Valid?
    ├── NO → Log error, return 400
    │
    └── YES
         │
         ▼
┌─────────────────┐
│ Extract sale     │
│ data from event  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Product exists  │
│ in our catalog? │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
   YES        NO
    │          │
    ▼          ▼
  Send       Log
  Welcome    unknown
  Email      product
    │
    ▼
┌─────────────────┐
│ Update Airtable  │
│ sale record      │
└────────┬────────┘
         │
         ▼
    Return 200
```

### Swimlane Diagram (Markdown Table)
```markdown
| Step | Trigger | Agent | Action | Output |
|---|---|---|---|---|
| 1 | New week starts (Mon 9 AM) | Navigator | Run weekly review | Draft strategy memo |
| 2 | Memo drafted | Hutch | Review and approve | Approved memo |
| 3 | Memo approved | Scribe | Format for Notion | Published memo |
| 4 | Published | Social | Tweet key insight | Tweet + engagement |
```

---

## 4. CHECKLIST DESIGN

### The Effective Checklist Manifesto (from Atul Gawande)
Good checklists are:
- **Short** (5-9 items per section, not 50)
- **Specific** (not "check everything is OK")
- **Binary** (pass/fail, not "review and consider")
- **Ordered** by execution sequence
- **Tested** with a real person doing the real task

### Pre-Publish Checklist Pattern
```markdown
## Pre-Publish Checklist: Digital Product

**Product:** ____________  
**Publisher:** ____________  
**Date:** ____________  

### Content Quality
- [ ] Title is specific and benefit-focused (not generic)
- [ ] Description is 200+ words with keywords
- [ ] All placeholder text replaced with real content
- [ ] No typos in first 3 paragraphs (most visible)
- [ ] Price matches our pricing strategy document

### File Quality  
- [ ] File opens without errors on a clean machine
- [ ] File is under 50MB (Gumroad limit)
- [ ] File name: `[Product-Name]-v1.0.pdf` (no spaces)
- [ ] Cover image is 1280×720px minimum

### Platform Setup
- [ ] Product is in the correct category
- [ ] Tags are set (minimum 3)
- [ ] Thank-you page URL is set
- [ ] Gumroad analytics enabled

### Final Check
- [ ] Purchased product yourself (test transaction)
- [ ] Received test download email
- [ ] Download link works
- [ ] File contains all expected content

**Result:** ☐ PUBLISH  ☐ HOLD — Reason: ____________
```

---

## 5. RUNBOOK PATTERN

### Runbook vs SOP: The Difference
- **SOP**: Routine operations — how to do something that happens regularly
- **Runbook**: Incident response — what to do when something breaks

```markdown
# Runbook: Stripe Webhook Processing Failure

**Severity:** High (lost revenue tracking)  
**Owner:** Architect Agent  
**Escalate after:** 30 minutes without resolution  

## Symptoms
- Sales not appearing in Airtable despite Gumroad sales
- Error logs show: "Webhook signature verification failed"
- Webhook endpoint returning 500 errors

## Immediate Actions (First 5 Minutes)

### Step 1: Verify the problem
```bash
# Check last 50 webhook logs
tail -50 /var/log/webhooks.log | grep ERROR

# Check if endpoint is reachable
curl -I https://yourapp.com/webhooks/gumroad
# Expected: HTTP 200 or 405 (Method Not Allowed on GET)
```

### Step 2: Check signature secret
The webhook secret may have changed in Gumroad settings.
1. Log into Gumroad → Settings → Advanced
2. Copy current webhook secret
3. Compare to GUMROAD_WEBHOOK_SECRET in .env
4. If different → update .env → restart app

### Step 3: Check for 5xx errors
If server is returning 5xx:
```bash
# Check app logs for exceptions
grep -n "Exception\|Error\|Traceback" /var/log/app.log | tail -20
```

## Recovery Procedures

### If signature mismatch:
1. Get correct secret from Gumroad dashboard
2. Update environment variable
3. Restart application: `systemctl restart myapp`
4. Test with Gumroad's "Ping" feature in webhook settings

### If app is crashing on receipt:
1. Check logs for the specific error
2. Look up the error in Debugging SOP
3. If data issue: manually process the missed webhooks:
   ```bash
   python scripts/replay_webhooks.py --date today
   ```

## Post-Incident
- [ ] Document root cause in incidents log
- [ ] Add test case to prevent recurrence
- [ ] Update this runbook if the fix required new steps
```

---

## 6. WORKFLOW DOCUMENTATION

### The Workflow Canvas
Document every significant workflow with:

```markdown
# Workflow: New Digital Product Launch

## Overview
From finished product file to live on Gumroad with promotion running.
Target time: 4 hours (assuming file is complete and reviewed).

## Participants
| Role | Responsibility |
|---|---|
| Publisher | Upload, configure, QA |
| Scribe | Write listing copy |
| Sentinel | Final QA review |
| Social | Schedule promotion |

## Workflow Map
See: [link to flow diagram]

## Phase 1: Preparation (Publisher + Scribe, parallel)

**Publisher does:**
1. Prepare cover image (1280×720, brand colors)
2. Stage product on Gumroad (draft, not published)
3. Set pricing per [pricing strategy doc]
4. Configure tags, categories, thank-you page

**Scribe does:**
1. Write product title (formula: [Outcome] + [Method] + [Audience])
2. Write 300-word description (Pain → Bridge → Solution → Proof → CTA)
3. Write 3 bullet points (feature-benefit pairs)
4. Write email subject line options (3 variations)

**Sync point:** Both complete → Sentinel review

## Phase 2: QA (Sentinel)
Run Pre-Publish Checklist (see SOP: Pre-Publish Digital Product)
- PASS → Proceed to Phase 3
- FAIL → Return to Phase 1 with specific feedback

## Phase 3: Launch (Publisher)
1. Publish product on Gumroad
2. Confirm live URL
3. Make test purchase
4. Trigger Social agent with launch brief

## Phase 4: Promotion (Social)
[See Social Media Launch SOP]

## Success Criteria
- [ ] Product is live and purchasable
- [ ] Test purchase completed successfully
- [ ] Promotion scheduled for 3 platforms
- [ ] Product added to product catalog in Airtable

## Common Problems
| Problem | Action |
|---|---|
| Gumroad rejects file | Check file size (<600MB) and format |
| Cover not displaying | Re-upload as JPEG, 1280×720 min |
| Pricing not saving | Clear browser cache, try incognito |
```

---

## 7. DECISION TREES IN SOPS

### When to Use Decision Trees
Use a decision tree in your SOP when:
- There are 3+ branches of different actions
- The path depends on checking a condition
- You want to prevent decision paralysis

### Decision Tree Format
```markdown
## Decision: How to Handle Failed Payment

**Start:** Payment failed notification received

1. Is this the customer's first payment attempt?
   - YES → Proceed to Step 2
   - NO → Skip to Step 5

2. Was the failure due to insufficient funds?
   - YES → Send "retry payment" email → Wait 24 hours → Step 3
   - NO → Proceed to Step 4

3. Did customer retry within 24 hours?
   - YES → Close incident (resolved)
   - NO → Send "update payment method" email → Step 6

4. Was the failure due to card declined/expired?
   - YES → Send "update card" email → Step 6
   - NO → Unknown failure → Escalate to Stripe support

5. (Repeat customer) Has payment failed 3+ times this month?
   - YES → Flag account, notify Hutch
   - NO → Send friendly retry reminder → Step 6

6. 7-day follow-up: Did customer update payment?
   - YES → Close incident
   - NO → Cancel subscription, send cancellation email
```

---

## 8. SOP REVIEW & MAINTENANCE

### When to Update an SOP
- Tool or platform interface changed
- New failure mode discovered in production
- Faster/better approach identified
- New person confused by existing SOP
- Annual review (at minimum)

### SOP Audit Checklist
```
Quarterly SOP Audit:
- [ ] Does this SOP still match reality? (Did the process change?)
- [ ] Are all linked systems/tools still the same?
- [ ] Do credentials still work?
- [ ] Have new failure modes been discovered? Add them.
- [ ] Can a new team member follow this cold?
- [ ] Is there a newer/better way to do this?
- [ ] Update version number and revision date
```

---

## 9. EXAMPLE SOPs (COMPLETE)

### SOP: Weekly Revenue Report

**Version:** 1.0 | **Owner:** Analyst Agent | **Trigger:** Every Monday 8 AM

**Prerequisites:**
- [ ] Stripe API key configured
- [ ] Gumroad API key configured
- [ ] Email configured for delivery

**Procedure:**

**Step 1:** Run revenue collection script
```bash
python scripts/collect_revenue.py --period week
# Expected: "Collected 47 transactions. Saved to data/revenue_2024-01-15.json"
```

**Step 2:** Verify data completeness
- Open `data/revenue_2024-01-15.json`
- Confirm `transaction_count` > 0
- If 0: check API keys in .env, re-run script

**Step 3:** Generate PDF report
```bash
python scripts/generate_report.py --input data/revenue_2024-01-15.json --output reports/
# Expected: "Report generated: reports/revenue-report-2024-01-15.pdf"
```

**Step 4:** Email report to Hutch
```bash
python scripts/email_report.py --file reports/revenue-report-2024-01-15.pdf
# Expected: "Sent to: josh@example.com"
```

**Verification:**
- [ ] PDF exists in reports/ folder
- [ ] Email received by Hutch
- [ ] Report shows correct date range
- [ ] Numbers match Stripe dashboard (spot check)

---

## 10. ANTI-PATTERNS TO AVOID

### The Seven Deadly SOP Sins

**1. The Assumed Knowledge Sin**
"Configure the database as appropriate."
Fix: Specify exactly which database, what configuration, with example values.

**2. The Missing Failure Mode Sin**
No section on what to do when things go wrong.
Fix: Every SOP needs at minimum 3 common failure scenarios and their fixes.

**3. The Stale SOP Sin**
SOP was accurate in 2022, tool has completely changed since.
Fix: Version numbers, dates, and mandatory quarterly review cycles.

**4. The Book-Length SOP Sin**
50-step SOPs nobody reads.
Fix: Split into multiple linked SOPs. Each SOP should fit on 2 printed pages.

**5. The Passive Voice Sin**
"The export should be configured..." — by whom?
Fix: "Analyst Agent: configure the export by..."

**6. The Missing Trigger Sin**
SOP describes HOW but not WHEN or WHY.
Fix: Every SOP starts with: what triggers it, and what happens if it's not run.

**7. The No-Verification Sin**
Steps execute but nobody checks if they worked.
Fix: Every 3-5 steps, add a verification checkpoint with expected state.
