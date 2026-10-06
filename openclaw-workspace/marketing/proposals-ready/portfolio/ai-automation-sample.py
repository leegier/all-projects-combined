#!/usr/bin/env python3
"""
AI Customer Support Automation System
======================================
Reads incoming support tickets from a CSV (or can be wired to Zendesk/
email webhook), uses OpenAI GPT-4 to classify and draft responses,
handles simple tickets automatically, and routes complex ones to human
agents with an AI-generated summary.

SETUP:
    pip install openai python-dotenv

USAGE:
    1. Create .env file with: OPENAI_API_KEY=your-key-here
    2. Edit your company info in COMPANY_CONFIG below
    3. Run: python ai_automation_sample.py

WHAT IT DOES:
    - Classifies each ticket into a category (billing, technical, refund, general)
    - Scores urgency 1-10
    - For simple/known issues: drafts a complete customer response
    - For complex issues: generates a concise agent brief + action recommendations
    - Outputs a summary CSV with all decisions and drafted responses
    - Logs all API calls for cost tracking
"""

import csv
import json
import logging
import os
import time
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional

# Load .env if present (for local development)
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv optional

try:
    from openai import OpenAI
except ImportError:
    print("ERROR: openai package not installed. Run: pip install openai")
    exit(1)


# ─────────────────────────────────────────────
# COMPANY CONFIGURATION — customize this
# ─────────────────────────────────────────────
COMPANY_CONFIG = {
    "name": "FlowDesk",
    "product": "email automation SaaS platform",
    "support_email": "support@flowdesk.io",
    "human_escalation_threshold": 7,  # Urgency score >= this → escalate to human
    "response_tone": "professional but friendly, concise, empathetic",
}

# Categories the AI will classify tickets into
TICKET_CATEGORIES = [
    "billing",           # Invoice, payment, refund, pricing questions
    "technical_bug",     # Something broken, error messages, not working
    "how_to",            # How do I do X? Feature questions
    "account",           # Login, password, account settings
    "cancellation",      # Cancel subscription requests
    "feature_request",   # Requests for new features
    "general",           # Everything else
]

# Known canned responses — AI uses these for common issues
CANNED_RESPONSES = {
    "password_reset": "To reset your password, go to {product_url}/login and click 'Forgot Password'. You'll receive a reset link within 2 minutes. If you don't see it, check your spam folder.",
    "billing_invoice": "You can download all your invoices from Settings → Billing → Invoice History. If you need a specific invoice sent to a different email, just reply with that email address.",
    "cancel_subscription": "We're sorry to see you go! To cancel, go to Settings → Billing → Cancel Subscription. Your access continues until the end of your current billing period. If there's anything we could do better, we'd love to hear it.",
}

# OpenAI model to use
OPENAI_MODEL = "gpt-4-turbo-preview"  # or "gpt-3.5-turbo" for lower cost


# ─────────────────────────────────────────────
# LOGGING & COST TRACKING
# ─────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("ai_support.log"),
        logging.StreamHandler()
    ]
)
log = logging.getLogger(__name__)

# Track API usage costs
cost_tracker = {"total_tokens": 0, "total_cost": 0.0, "api_calls": 0}

# Rough cost estimates per 1K tokens (update as OpenAI prices change)
COST_PER_1K = {"gpt-4-turbo-preview": 0.01, "gpt-3.5-turbo": 0.001}


# ─────────────────────────────────────────────
# DATA MODELS
# ─────────────────────────────────────────────
@dataclass
class SupportTicket:
    ticket_id: str
    customer_name: str
    customer_email: str
    subject: str
    body: str
    created_at: str = ""


@dataclass
class TicketDecision:
    ticket_id: str
    customer_email: str
    subject: str
    category: str
    urgency_score: int
    action: str           # "auto_respond" | "escalate" | "needs_info"
    draft_response: str   # For auto_respond
    agent_brief: str      # For escalate
    reasoning: str
    processed_at: str = ""

    def __post_init__(self):
        if not self.processed_at:
            self.processed_at = datetime.now().isoformat()


# ─────────────────────────────────────────────
# AI ENGINE
# ─────────────────────────────────────────────
class SupportAI:
    """GPT-4 powered ticket classifier and response generator."""

    def __init__(self, api_key: Optional[str] = None):
        self.client = OpenAI(api_key=api_key or os.environ.get("OPENAI_API_KEY"))
        if not os.environ.get("OPENAI_API_KEY") and not api_key:
            log.warning("OPENAI_API_KEY not set — using demo mode (mock responses)")
            self.demo_mode = True
        else:
            self.demo_mode = False

    def _call_api(self, system_prompt: str, user_content: str) -> str:
        """Make a GPT-4 API call with cost tracking."""
        if self.demo_mode:
            return self._mock_response(user_content)

        try:
            response = self.client.chat.completions.create(
                model=OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content}
                ],
                temperature=0.3,  # Lower = more consistent/deterministic
                max_tokens=800,
                response_format={"type": "json_object"}
            )

            # Track costs
            usage = response.usage
            tokens = usage.total_tokens
            cost = (tokens / 1000) * COST_PER_1K.get(OPENAI_MODEL, 0.01)
            cost_tracker["total_tokens"] += tokens
            cost_tracker["total_cost"] += cost
            cost_tracker["api_calls"] += 1
            log.debug(f"API call: {tokens} tokens, ${cost:.4f}")

            return response.choices[0].message.content

        except Exception as e:
            log.error(f"OpenAI API error: {e}")
            raise

    def _mock_response(self, content: str) -> str:
        """Demo mode — returns realistic mock responses without API key."""
        log.info("[DEMO MODE] Returning mock AI response")
        return json.dumps({
            "category": "how_to",
            "urgency_score": 4,
            "action": "auto_respond",
            "draft_response": f"Hi there,\n\nThank you for reaching out to {COMPANY_CONFIG['name']} support!\n\nI'd be happy to help you with this. [This is a demo response — connect your OpenAI API key to generate real responses.]\n\nBest regards,\n{COMPANY_CONFIG['name']} Support Team",
            "agent_brief": "Demo mode — ticket needs review.",
            "reasoning": "Demo mode active — mock classification applied."
        })

    def analyze_ticket(self, ticket: SupportTicket) -> TicketDecision:
        """Analyze a ticket and decide how to handle it."""

        system_prompt = f"""You are a senior customer support AI for {COMPANY_CONFIG['name']}, a {COMPANY_CONFIG['product']}.

Your job is to analyze support tickets and return a JSON decision object.

Categories: {', '.join(TICKET_CATEGORIES)}

Rules:
- If urgency >= {COMPANY_CONFIG['human_escalation_threshold']}: action = "escalate"
- For billing/refund disputes over $100: action = "escalate"
- For simple how_to or account questions: action = "auto_respond"
- For vague/incomplete tickets: action = "needs_info"

Response tone: {COMPANY_CONFIG['response_tone']}

Return ONLY valid JSON with these fields:
{{
  "category": "<one of the categories above>",
  "urgency_score": <integer 1-10>,
  "action": "<auto_respond|escalate|needs_info>",
  "draft_response": "<complete email response ready to send to customer, or empty string if escalating>",
  "agent_brief": "<2-3 sentence summary for human agent if escalating, else empty>",
  "reasoning": "<brief internal note explaining your decision>"
}}"""

        user_content = f"""Support Ticket:
Customer: {ticket.customer_name} ({ticket.customer_email})
Subject: {ticket.subject}
Message:
{ticket.body}

Today's date: {datetime.now().strftime('%B %d, %Y')}"""

        raw = self._call_api(system_prompt, user_content)

        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            log.error(f"Failed to parse AI response as JSON: {raw[:200]}")
            data = {
                "category": "general",
                "urgency_score": 5,
                "action": "escalate",
                "draft_response": "",
                "agent_brief": "AI parsing error — manual review required.",
                "reasoning": "JSON parse error"
            }

        return TicketDecision(
            ticket_id=ticket.ticket_id,
            customer_email=ticket.customer_email,
            subject=ticket.subject,
            category=data.get("category", "general"),
            urgency_score=int(data.get("urgency_score", 5)),
            action=data.get("action", "escalate"),
            draft_response=data.get("draft_response", ""),
            agent_brief=data.get("agent_brief", ""),
            reasoning=data.get("reasoning", "")
        )


# ─────────────────────────────────────────────
# SAMPLE DATA (demo tickets for testing)
# ─────────────────────────────────────────────
SAMPLE_TICKETS = [
    SupportTicket(
        ticket_id="TKT-001",
        customer_name="Jennifer Walsh",
        customer_email="j.walsh@example.com",
        subject="How do I set up automated follow-ups?",
        body="Hi, I just signed up and I'm trying to set up a follow-up sequence for new leads but I can't figure out where to find it in the dashboard. I watched the onboarding video but I'm still confused. Can you walk me through it?"
    ),
    SupportTicket(
        ticket_id="TKT-002",
        customer_name="Marcus Chen",
        customer_email="m.chen@startup.io",
        subject="URGENT - All my emails stopped sending!!",
        body="This is critical. I have a campaign running and all email sending just stopped about 2 hours ago. I'm not getting any error messages, they just show 'pending' forever. This is causing us to lose deals. I need this fixed NOW. Our trial ends tomorrow and I was about to upgrade but not if the product doesn't work."
    ),
    SupportTicket(
        ticket_id="TKT-003",
        customer_name="Sarah O'Brien",
        customer_email="sarah@marketingco.com",
        subject="Invoice question",
        body="Hi, I need a copy of my March invoice for our accounting department. Also, is it possible to have future invoices sent to billing@marketingco.com instead of my personal email? Thank you"
    ),
    SupportTicket(
        ticket_id="TKT-004",
        customer_name="David Kim",
        customer_email="d.kim@enterprise.com",
        subject="Need to cancel my subscription",
        body="Hi, I need to cancel my subscription. We're switching to an internal solution that our IT team built. Nothing wrong with your product, just a company policy change. Can you confirm cancellation and that I won't be charged next month? My renewal is on the 15th."
    ),
    SupportTicket(
        ticket_id="TKT-005",
        customer_name="Amanda Ross",
        customer_email="amanda@consulting.biz",
        subject="Feature request - Bulk email import",
        body="Love the product! One thing that would make it perfect: being able to import email threads from Gmail in bulk. Right now I have to copy-paste them one at a time which takes forever. Would this be possible to add? Happy to beta test it if you build it!"
    ),
]


# ─────────────────────────────────────────────
# PIPELINE
# ─────────────────────────────────────────────
def load_tickets_from_csv(filepath: str) -> list[SupportTicket]:
    """Load tickets from CSV file."""
    tickets = []
    path = Path(filepath)

    if not path.exists():
        log.info(f"No CSV found at {filepath} — using built-in sample tickets")
        return []

    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            tickets.append(SupportTicket(
                ticket_id=row.get("ticket_id", f"TKT-{len(tickets)+1:03d}"),
                customer_name=row.get("customer_name", ""),
                customer_email=row.get("customer_email", ""),
                subject=row.get("subject", ""),
                body=row.get("body", ""),
                created_at=row.get("created_at", "")
            ))

    return tickets


def save_decisions(decisions: list[TicketDecision], filepath: str):
    """Save all decisions to CSV."""
    if not decisions:
        return

    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(asdict(decisions[0]).keys()))
        writer.writeheader()
        for d in decisions:
            writer.writerow(asdict(d))

    log.info(f"Decisions saved to {filepath}")


def run_pipeline(tickets: Optional[list[SupportTicket]] = None):
    """Process all tickets through the AI pipeline."""
    if tickets is None:
        tickets = load_tickets_from_csv("tickets.csv")
        if not tickets:
            log.info("Using built-in sample tickets for demo")
            tickets = SAMPLE_TICKETS

    log.info("=" * 60)
    log.info("AI SUPPORT AUTOMATION — STARTING PIPELINE")
    log.info(f"Tickets to process: {len(tickets)}")
    log.info("=" * 60)

    ai = SupportAI()
    decisions = []

    for i, ticket in enumerate(tickets, 1):
        log.info(f"\n[{i}/{len(tickets)}] Processing: {ticket.ticket_id}")
        log.info(f"  Subject: {ticket.subject[:60]}")

        try:
            decision = ai.analyze_ticket(ticket)
            decisions.append(decision)

            log.info(f"  Category:      {decision.category}")
            log.info(f"  Urgency:       {decision.urgency_score}/10")
            log.info(f"  Action:        {decision.action.upper()}")

            if decision.action == "auto_respond":
                log.info(f"  ✉️  Draft ready: {len(decision.draft_response)} chars")
            elif decision.action == "escalate":
                log.info(f"  🚨 ESCALATE: {decision.agent_brief[:80]}")
            else:
                log.info(f"  ❓ NEEDS INFO")

        except Exception as e:
            log.error(f"Failed to process {ticket.ticket_id}: {e}")
            decisions.append(TicketDecision(
                ticket_id=ticket.ticket_id,
                customer_email=ticket.customer_email,
                subject=ticket.subject,
                category="general",
                urgency_score=5,
                action="escalate",
                draft_response="",
                agent_brief=f"Processing error: {str(e)[:100]}",
                reasoning="Pipeline error"
            ))

        # Rate limiting for API
        if i < len(tickets):
            time.sleep(0.5)

    # Save output
    save_decisions(decisions, "support_decisions.csv")

    # Summary
    log.info("\n" + "=" * 60)
    log.info("PIPELINE COMPLETE")
    action_counts = {}
    for d in decisions:
        action_counts[d.action] = action_counts.get(d.action, 0) + 1

    for action, count in action_counts.items():
        log.info(f"  {action}: {count} tickets")

    if cost_tracker["api_calls"] > 0:
        log.info(f"\n  API calls:    {cost_tracker['api_calls']}")
        log.info(f"  Total tokens: {cost_tracker['total_tokens']:,}")
        log.info(f"  Est. cost:    ${cost_tracker['total_cost']:.4f}")

    log.info("  Output:       support_decisions.csv")
    log.info("=" * 60)

    return decisions


if __name__ == "__main__":
    print("\nAI Customer Support Automation")
    print("─" * 40)
    print(f"Company: {COMPANY_CONFIG['name']}")
    print(f"Model: {OPENAI_MODEL}")
    print()

    if not os.environ.get("OPENAI_API_KEY"):
        print("⚠️  No OPENAI_API_KEY found — running in demo mode")
        print("   Create .env with OPENAI_API_KEY=your-key to go live\n")

    run_pipeline()
