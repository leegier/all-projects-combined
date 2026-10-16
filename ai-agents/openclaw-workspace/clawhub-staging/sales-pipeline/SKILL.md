---
name: sales-pipeline
description: Track freelance deals and client opportunities from first contact to closed and paid. File-based CRM — no external services needed. Use when adding a new lead, moving a deal through stages, checking what needs follow-up, forecasting revenue, or reviewing win rates. Triggers on: "add a deal", "update my pipeline", "what deals need follow-up", "how much is in my pipeline", "mark this as closed", "new lead from", "track this client", "sales pipeline", "deal tracker", or any request to manage client deal flow.
---

# sales-pipeline

File-based deal tracker. No SaaS, no external CRM — everything lives in `memory/pipeline.json`.

## Pipeline Stages

```
Lead → Qualified → Proposal → Negotiation → Closed Won | Closed Lost
```

---

## Commands

### Add a Deal

```bash
python scripts/pipeline.py add \
  --name "Acme Corp - Unity Plugin" \
  --stage lead \
  --value 800 \
  --contact "john@acme.com" \
  --notes "Found via Upwork, needs C# NavMesh work"
```

### List All Deals

```bash
python scripts/pipeline.py list
python scripts/pipeline.py list --stage proposal
python scripts/pipeline.py list --stage all
```

### Move a Deal to Next Stage

```bash
python scripts/pipeline.py move --id DEAL_ID --stage proposal
python scripts/pipeline.py move --id DEAL_ID --stage closed-won
python scripts/pipeline.py move --id DEAL_ID --stage closed-lost --notes "Budget cut"
```

### Update a Deal

```bash
python scripts/pipeline.py update --id DEAL_ID --value 1200 --notes "Scope expanded"
python scripts/pipeline.py update --id DEAL_ID --contact "sarah@acme.com"
```

### Follow-Up Check

```bash
python scripts/pipeline.py followup
```

Shows all active deals not touched in 3+ days — the ones you're probably forgetting.

### Pipeline Report

```bash
python scripts/pipeline.py report
```

Outputs:
```
Pipeline Summary
  Total active deals:  6
  Total value:         $4,850
  Weighted forecast:   $2,180

  By stage:
    Lead (2):          $800
    Qualified (2):     $1,800
    Proposal (1):      $1,200
    Negotiation (1):   $1,050

  Win rate (last 30d): 40%  (2/5 closed)
  Avg deal size:       $720
```

Report saved to `memory/pipeline-report.md`.

---

## Data Storage

All deals stored in `memory/pipeline.json`. Edit directly if needed — it's plain JSON.

Format:
```json
{
  "deals": [
    {
      "id": "abc123",
      "name": "Acme Corp - Unity Plugin",
      "stage": "proposal",
      "value": 800,
      "contact": "john@acme.com",
      "notes": "Sent proposal 2026-03-25",
      "created": "2026-03-24",
      "updated": "2026-03-25"
    }
  ]
}
```

---

## Stage Weights (for forecasting)

| Stage | Probability |
|-------|------------|
| Lead | 10% |
| Qualified | 25% |
| Proposal | 50% |
| Negotiation | 75% |
| Closed Won | 100% |
| Closed Lost | 0% |
