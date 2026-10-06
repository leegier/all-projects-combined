---
name: nda-drafter
description: Generate professional Non-Disclosure Agreements (NDAs) customized to the parties, project, duration, and jurisdiction. Produces mutual or one-way NDA in Markdown or plain text, ready to sign. Includes a legal disclaimer. Use when protecting a business idea before sharing it with a contractor, client, or partner; when a client asks you to sign an NDA; or when creating an NDA template for repeated use. Triggers on: "draft an NDA", "create a non-disclosure agreement", "write an NDA", "I need an NDA before sharing my idea", "mutual NDA", "one-way NDA", or any non-disclosure agreement task.
---

# nda-drafter

Generate customized NDA documents in minutes.

⚠️ **NOT LEGAL ADVICE.** Always have agreements reviewed by a licensed attorney.

## Usage

```bash
python scripts/nda.py generate \
  --party-a "Lee Gierl" \
  --party-b "Contractor Name / Company Inc." \
  --purpose "Development of a mobile game concept and related IP" \
  --duration "2 years" \
  --jurisdiction "State of Illinois, USA" \
  --type mutual \
  --output "output/nda-contractor-2026-03.md"
```

**Types:**
- `mutual` — both parties agree to keep each other's information confidential (default)
- `one-way` — only Party B keeps Party A's information confidential (disclosing party → receiving party)

---

## Output

Generates a complete NDA including:
- Definitions of Confidential Information
- Obligations of receiving party
- Exclusions (public knowledge, independently developed, required by law)
- Term and termination
- Remedies (injunctive relief)
- Governing law
- Signature block

---

## Common Use Cases

| Scenario | Type | Duration |
|----------|------|---------|
| Sharing game concept with contractor | One-way | 1-2 years |
| Mutual collaboration with partner | Mutual | 2 years |
| Client sharing their business idea | One-way | 1 year |
| Pre-employment contractor | One-way | 2 years |

---

## Templates

See `assets/nda-mutual-template.md` and `assets/nda-one-way-template.md` for base templates.
The generate script fills in the placeholders.
