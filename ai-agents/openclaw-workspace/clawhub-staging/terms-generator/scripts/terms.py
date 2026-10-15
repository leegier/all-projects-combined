#!/usr/bin/env python3
"""
terms.py — Generate Terms of Service + Privacy Policy documents.
No external dependencies.
"""
import argparse
from datetime import datetime, timezone
from pathlib import Path

DISCLAIMER = "\n> ⚠️ **LEGAL DISCLAIMER:** This document is a template for reference only. It is NOT legal advice. Have this reviewed by a licensed attorney before publishing.\n"

def build_tos(name, company, website, email, product_type, jurisdiction, date, collects_payments):
    refund = ""
    if product_type == "game":
        refund = """
### Refunds
Digital game purchases are generally non-refundable once downloaded. Refund requests may be considered within 14 days of purchase if the product is materially defective. Contact {email} to request a refund.
""".format(email=email)
    elif product_type == "saas":
        refund = """
### Subscriptions and Billing
Subscriptions are billed in advance. You may cancel at any time; cancellation takes effect at the end of the current billing period. No refunds for partial periods.
"""

    payment_clause = ""
    if collects_payments:
        payment_clause = """
### Payment Processing
Payments are processed by third-party payment processors (e.g., Stripe, Gumroad). We do not store your payment card information. Your use of payment services is subject to those processors' terms.
"""

    return f"""# Terms of Service — {name}

**Last Updated:** {date}
**Effective Date:** {date}

{DISCLAIMER}

## 1. Agreement to Terms

By accessing or using {name} ("the Service") operated by {company} ("we," "us," or "our"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.

## 2. Description of Service

{name} is a {product_type} available at {website}. We reserve the right to modify, suspend, or discontinue the Service at any time without notice.

## 3. User Responsibilities

You agree to:
- Use the Service only for lawful purposes
- Not attempt to reverse engineer, hack, or disrupt the Service
- Not impersonate any person or entity
- Comply with all applicable laws and regulations

## 4. Intellectual Property

All content, trademarks, and intellectual property associated with {name} are owned by {company} or its licensors. You may not copy, reproduce, or distribute any part of the Service without written permission.

## 5. User Content

If the Service allows you to submit content, you retain ownership of your content but grant {company} a worldwide, royalty-free license to use, display, and distribute it in connection with the Service.
{refund}{payment_clause}
## 6. Disclaimer of Warranties

THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. {company.upper()} DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF HARMFUL COMPONENTS.

## 7. Limitation of Liability

TO THE MAXIMUM EXTENT PERMITTED BY LAW, {company.upper()} SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES ARISING FROM YOUR USE OF THE SERVICE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.

## 8. Governing Law

These Terms are governed by the laws of **{jurisdiction}**, without regard to conflict of law principles.

## 9. Changes to Terms

We may update these Terms at any time. Continued use of the Service after changes constitutes acceptance. We will notify users of material changes by posting the new Terms at {website}.

## 10. Contact

Questions about these Terms? Contact us at: **{email}**
"""

def build_privacy(name, company, website, email, product_type, jurisdiction, date):
    type_data = {
        "game":         "purchase records, gameplay data, crash reports, and device information",
        "saas":         "account information, usage data, payment records, and communications",
        "content-site": "account information, submitted content, comments, and analytics",
        "mobile-app":   "device information, usage data, location (if permitted), and crash reports",
    }.get(product_type, "usage data and account information")

    gdpr_clause = ""
    if "EU" in jurisdiction or "Europe" in jurisdiction or True:  # include by default
        gdpr_clause = """
## GDPR Rights (EU/EEA Residents)

If you are located in the European Union or European Economic Area, you have the right to:
- **Access** your personal data
- **Correct** inaccurate data
- **Delete** your data ("right to be forgotten")
- **Restrict** or **object** to processing
- **Data portability**

To exercise these rights, contact us at {email}.
""".format(email=email)

    ccpa_clause = """
## CCPA Rights (California Residents)

California residents have the right to know what personal information we collect, request deletion of personal information, and opt out of the sale of personal information. We do not sell personal information. To exercise these rights, contact us at {email}.
""".format(email=email)

    return f"""---

# Privacy Policy — {name}

**Last Updated:** {date}

{DISCLAIMER}

## 1. Introduction

{company} ("we," "us," or "our") operates {name} at {website}. This Privacy Policy explains how we collect, use, and protect your information.

## 2. Information We Collect

We may collect the following information:
- **Information you provide:** Email address, name, and payment information when you purchase or register
- **Automatically collected:** {type_data}
- **Cookies and analytics:** We may use analytics tools to understand how the Service is used

## 3. How We Use Your Information

We use collected information to:
- Provide and improve the Service
- Process transactions and send receipts
- Respond to inquiries and provide support
- Send product updates (you may opt out at any time)
- Comply with legal obligations

## 4. Sharing Your Information

We do not sell your personal information. We may share information with:
- **Service providers** (payment processors, hosting) who assist in operating the Service
- **Legal authorities** if required by law

## 5. Data Retention

We retain personal data only as long as necessary to provide the Service or as required by law. You may request deletion at any time.

## 6. Security

We implement reasonable security measures to protect your information. No system is completely secure; we cannot guarantee absolute security.

## 7. Third-Party Links

The Service may contain links to third-party websites. We are not responsible for their privacy practices.
{gdpr_clause}{ccpa_clause}
## 8. Children's Privacy

The Service is not directed to children under 13. We do not knowingly collect information from children under 13. If you believe a child has provided us information, contact us at {email}.

## 9. Changes to This Policy

We may update this Privacy Policy. We will notify you of significant changes by posting the updated policy at {website}.

## 10. Contact

Privacy questions? Contact us at: **{email}**
"""

def cmd_generate(args):
    date     = datetime.now(timezone.utc).strftime("%B %d, %Y")
    pays     = args.collects_payments and args.collects_payments.lower() in ("true", "yes", "1")
    tos      = build_tos(args.product_name, args.company_name, args.website, args.email,
                         args.product_type or "game", args.jurisdiction or "Illinois, USA", date, pays)
    privacy  = build_privacy(args.product_name, args.company_name, args.website, args.email,
                              args.product_type or "game", args.jurisdiction or "Illinois, USA", date)
    combined = tos + "\n\n" + privacy

    out = Path(args.output or "output/legal-docs.md")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(combined, encoding="utf-8")
    print(f"[OK] Legal docs generated: {out}")
    print(f"     Contains: Terms of Service + Privacy Policy")
    print(f"     Product: {args.product_name} ({args.product_type})")
    print(f"\n     REMINDER: Have these reviewed by a licensed attorney before publishing.")

def main():
    p = argparse.ArgumentParser(description="Terms of Service + Privacy Policy generator")
    sub = p.add_subparsers(dest="command")

    gen = sub.add_parser("generate")
    gen.add_argument("--product-name", required=True)
    gen.add_argument("--product-type", default="game", choices=["game","saas","content-site","mobile-app"])
    gen.add_argument("--company-name", required=True)
    gen.add_argument("--website", required=True)
    gen.add_argument("--email", required=True)
    gen.add_argument("--jurisdiction", default="Illinois, USA")
    gen.add_argument("--collects-payments", default="false")
    gen.add_argument("--output", default="output/legal-docs.md")

    args = p.parse_args()
    if args.command == "generate":
        cmd_generate(args)
    else:
        p.print_help()

if __name__ == "__main__":
    main()
