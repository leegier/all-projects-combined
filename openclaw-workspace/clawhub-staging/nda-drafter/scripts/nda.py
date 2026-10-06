#!/usr/bin/env python3
"""
nda.py — Generate NDA documents from templates.
No external dependencies.
"""
import argparse
from datetime import datetime, timezone
from pathlib import Path

DISCLAIMER = """
---
⚠️ LEGAL DISCLAIMER: This document is a template generated for reference purposes only.
It does NOT constitute legal advice. Have this agreement reviewed by a licensed attorney
in your jurisdiction before signing or enforcing. Laws vary by location.
---
"""

MUTUAL_TEMPLATE = """# MUTUAL NON-DISCLOSURE AGREEMENT

**Effective Date:** {date}

This Mutual Non-Disclosure Agreement ("Agreement") is entered into as of {date} by and between:

**Party A:** {party_a}
**Party B:** {party_b}

(each a "Party," collectively the "Parties")

## 1. Purpose

The Parties wish to explore a potential business relationship involving: {purpose} (the "Purpose"). In connection with the Purpose, each Party may disclose confidential information to the other.

## 2. Definition of Confidential Information

"Confidential Information" means any non-public information disclosed by either Party to the other, either directly or indirectly, in writing, orally, or by inspection of tangible objects, that is designated as confidential or that reasonably should be understood to be confidential given the nature of the information and the circumstances of disclosure.

## 3. Obligations

Each receiving Party agrees to:
(a) Hold the disclosing Party's Confidential Information in strict confidence;
(b) Not disclose the Confidential Information to any third party without prior written consent;
(c) Use the Confidential Information solely for the Purpose;
(d) Protect the Confidential Information using at least the same degree of care used to protect its own confidential information, but no less than reasonable care.

## 4. Exclusions

This Agreement does not apply to information that:
(a) Is or becomes publicly available through no fault of the receiving Party;
(b) Was rightfully known to the receiving Party before disclosure;
(c) Is independently developed by the receiving Party without use of Confidential Information;
(d) Is required to be disclosed by law or court order, provided the receiving Party gives prompt written notice.

## 5. Term

This Agreement shall remain in effect for **{duration}** from the Effective Date, unless terminated earlier by written agreement of both Parties. Obligations with respect to Confidential Information disclosed during the term shall survive termination for an additional two (2) years.

## 6. Return of Information

Upon written request, each Party shall promptly return or destroy all Confidential Information received from the other Party and certify such destruction or return in writing.

## 7. Remedies

Each Party acknowledges that breach of this Agreement may cause irreparable harm for which monetary damages would be inadequate. Each Party shall be entitled to seek equitable relief, including injunction and specific performance, without waiving any other rights or remedies.

## 8. Governing Law

This Agreement shall be governed by and construed in accordance with the laws of **{jurisdiction}**, without regard to conflict of law principles.

## 9. Entire Agreement

This Agreement constitutes the entire agreement between the Parties with respect to its subject matter and supersedes all prior agreements and understandings.

---

**PARTY A:**

Signature: ___________________________
Name: {party_a}
Date: ___________________

**PARTY B:**

Signature: ___________________________
Name: {party_b}
Date: ___________________
{disclaimer}"""

ONE_WAY_TEMPLATE = """# NON-DISCLOSURE AGREEMENT

**Effective Date:** {date}

This Non-Disclosure Agreement ("Agreement") is entered into as of {date} by and between:

**Disclosing Party:** {party_a}
**Receiving Party:** {party_b}

## 1. Purpose

The Disclosing Party wishes to disclose certain confidential information to the Receiving Party in connection with: {purpose} (the "Purpose").

## 2. Definition of Confidential Information

"Confidential Information" means any non-public information disclosed by the Disclosing Party, in any form, that is designated as confidential or that reasonably should be understood to be confidential.

## 3. Obligations of Receiving Party

The Receiving Party agrees to:
(a) Keep all Confidential Information strictly confidential;
(b) Not disclose Confidential Information to any third party without prior written consent from the Disclosing Party;
(c) Use Confidential Information solely for the Purpose;
(d) Protect Confidential Information with at least the same care it uses for its own confidential information, but no less than reasonable care.

## 4. Exclusions

Obligations do not apply to information that:
(a) Is or becomes publicly available through no fault of the Receiving Party;
(b) Was rightfully known to the Receiving Party prior to disclosure;
(c) Is independently developed without use of Confidential Information;
(d) Is required to be disclosed by applicable law, regulation, or court order.

## 5. Term

This Agreement is effective for **{duration}** from the Effective Date. Obligations survive termination for two (2) additional years.

## 6. Return or Destruction

Upon request, the Receiving Party shall return or certifiably destroy all Confidential Information.

## 7. Remedies

Breach may cause irreparable harm. The Disclosing Party is entitled to seek equitable relief without waiving other remedies.

## 8. Governing Law

Governed by the laws of **{jurisdiction}**.

## 9. Entire Agreement

This Agreement is the entire agreement on its subject matter.

---

**DISCLOSING PARTY:**

Signature: ___________________________
Name: {party_a}
Date: ___________________

**RECEIVING PARTY:**

Signature: ___________________________
Name: {party_b}
Date: ___________________
{disclaimer}"""

def cmd_generate(args):
    date  = datetime.now(timezone.utc).strftime("%B %d, %Y")
    tmpl  = MUTUAL_TEMPLATE if (args.type or "mutual") == "mutual" else ONE_WAY_TEMPLATE
    doc   = tmpl.format(
        date=date,
        party_a=args.party_a,
        party_b=args.party_b,
        purpose=args.purpose,
        duration=args.duration or "1 year",
        jurisdiction=args.jurisdiction or "the State of Illinois, USA",
        disclaimer=DISCLAIMER,
    )

    out = Path(args.output or "output/nda.md")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(doc, encoding="utf-8")
    nda_type = "Mutual" if (args.type or "mutual") == "mutual" else "One-Way"
    print(f"[OK] {nda_type} NDA generated: {out}")
    print(f"     Parties: {args.party_a} / {args.party_b}")
    print(f"     Duration: {args.duration or '1 year'} | Jurisdiction: {args.jurisdiction}")
    print(f"\n     REMINDER: Have this reviewed by a licensed attorney before use.")

def main():
    p = argparse.ArgumentParser(description="NDA document generator")
    sub = p.add_subparsers(dest="command")

    gen = sub.add_parser("generate")
    gen.add_argument("--party-a", required=True, help="Disclosing party / Party A name")
    gen.add_argument("--party-b", required=True, help="Receiving party / Party B name")
    gen.add_argument("--purpose", required=True, help="Purpose of disclosure")
    gen.add_argument("--duration", default="1 year", help="Agreement term (e.g. '2 years')")
    gen.add_argument("--jurisdiction", default="the State of Illinois, USA")
    gen.add_argument("--type", default="mutual", choices=["mutual", "one-way"])
    gen.add_argument("--output", default="output/nda.md")

    args = p.parse_args()
    if args.command == "generate":
        cmd_generate(args)
    else:
        p.print_help()

if __name__ == "__main__":
    main()
