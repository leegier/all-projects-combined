#!/usr/bin/env python3
"""
Email Outreach Automation Script
=================================
Reads a contact list from CSV, sends personalized emails via Gmail API,
tracks sent contacts to prevent duplicates, and logs all activity.

SETUP:
1. pip install -r requirements.txt
2. Enable Gmail API at https://console.cloud.google.com/
3. Download credentials.json and place in this directory
4. Update config.py or the CONFIG section below
5. Run: python automation_script.py

Author: Portfolio Sample (ready-to-use, fully functional)
"""

import csv
import json
import logging
import os
import smtplib
import time
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import Optional


# ─────────────────────────────────────────────
# CONFIGURATION — edit these before running
# ─────────────────────────────────────────────
CONFIG = {
    # SMTP settings (using Gmail as example)
    "smtp_host": "smtp.gmail.com",
    "smtp_port": 587,
    "sender_email": "your-email@gmail.com",   # Replace with your email
    "sender_password": "your-app-password",    # Use Gmail App Password (not your real password)
    "sender_name": "Your Name",

    # Files
    "contacts_csv": "contacts.csv",            # Path to your contacts file
    "sent_log": "sent_contacts.json",          # Tracks who was already emailed
    "activity_log": "outreach_activity.log",   # Human-readable log

    # Email content
    "subject_template": "Quick question about {company}",
    "body_template": """Hi {first_name},

I came across {company} and was impressed by what you're building in the {industry} space.

I specialize in {service_pitch}, and I've helped companies like yours {benefit_statement}.

Would you be open to a 15-minute call this week? I have a few ideas specific to {company} that I think you'd find valuable.

Best,
{sender_name}

P.S. If now isn't the right time, just reply and I'll follow up in a few months.""",

    # Rate limiting — be a good citizen
    "delay_between_emails": 3,    # Seconds between sends (avoid spam triggers)
    "max_emails_per_run": 50,     # Safety cap per run
    "dry_run": True,              # Set to False to actually send emails
}

# Personalization variables to use in templates:
# {first_name}, {last_name}, {company}, {industry}, {email}
# Plus any custom columns from your CSV

# ─────────────────────────────────────────────
# LOGGING SETUP
# ─────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(CONFIG["activity_log"]),
        logging.StreamHandler()  # Also print to console
    ]
)
log = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# SENT TRACKER — prevents duplicate sends
# ─────────────────────────────────────────────
class SentTracker:
    """Tracks which contacts have been emailed to prevent duplicates."""

    def __init__(self, filepath: str):
        self.filepath = Path(filepath)
        self.sent: dict = self._load()

    def _load(self) -> dict:
        if self.filepath.exists():
            with open(self.filepath, "r") as f:
                return json.load(f)
        return {}

    def _save(self):
        with open(self.filepath, "w") as f:
            json.dump(self.sent, f, indent=2)

    def mark_sent(self, email: str, contact_data: dict):
        self.sent[email.lower()] = {
            "sent_at": datetime.now().isoformat(),
            "name": f"{contact_data.get('first_name', '')} {contact_data.get('last_name', '')}".strip(),
            "company": contact_data.get("company", ""),
        }
        self._save()

    def was_sent(self, email: str) -> bool:
        return email.lower() in self.sent

    def total_sent(self) -> int:
        return len(self.sent)


# ─────────────────────────────────────────────
# CSV READER
# ─────────────────────────────────────────────
def load_contacts(filepath: str) -> list[dict]:
    """
    Load contacts from CSV file.
    Expected columns: first_name, last_name, email, company, industry
    Any extra columns are available as template variables.
    """
    contacts = []
    filepath = Path(filepath)

    if not filepath.exists():
        log.error(f"Contacts file not found: {filepath}")
        log.info("Creating a sample contacts.csv for you...")
        _create_sample_csv(filepath)
        log.info(f"Sample CSV created at {filepath} — edit it with your real contacts")
        return []

    with open(filepath, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Clean up whitespace
            contact = {k.strip().lower(): v.strip() for k, v in row.items()}
            if contact.get("email"):  # Skip rows without email
                contacts.append(contact)

    log.info(f"Loaded {len(contacts)} contacts from {filepath}")
    return contacts


def _create_sample_csv(filepath: Path):
    """Creates a sample CSV if none exists."""
    sample_data = [
        ["first_name", "last_name", "email", "company", "industry"],
        ["Sarah", "Johnson", "sarah@acmecorp.com", "Acme Corp", "SaaS"],
        ["Marcus", "Lee", "marcus@novex.io", "Novex", "Fintech"],
        ["Jennifer", "Walsh", "j.walsh@stackr.com", "Stackr", "E-commerce"],
    ]
    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerows(sample_data)


# ─────────────────────────────────────────────
# EMAIL BUILDER
# ─────────────────────────────────────────────
def build_email(contact: dict, config: dict) -> tuple[str, str]:
    """
    Render email subject and body with contact data.
    Returns (subject, body_html) tuple.
    """
    # Add sender name to template vars
    template_vars = {**contact, "sender_name": config["sender_name"]}

    # Fill in any missing template vars with sensible defaults
    template_vars.setdefault("industry", "your industry")
    template_vars.setdefault("company", "your company")
    template_vars.setdefault("service_pitch", "automation and development solutions")
    template_vars.setdefault("benefit_statement", "save 20+ hours per week and scale faster")

    try:
        subject = config["subject_template"].format(**template_vars)
        body = config["body_template"].format(**template_vars)
    except KeyError as e:
        log.warning(f"Missing template variable {e} for {contact.get('email')} — using fallback")
        subject = f"Quick question for you"
        body = config["body_template"].format(**{
            **template_vars,
            str(e).strip("'"): f"[{str(e).strip(chr(39))}]"
        })

    return subject, body


# ─────────────────────────────────────────────
# EMAIL SENDER
# ─────────────────────────────────────────────
class EmailSender:
    """Handles SMTP connection and sending."""

    def __init__(self, config: dict):
        self.config = config
        self.connection: Optional[smtplib.SMTP] = None

    def connect(self):
        """Open SMTP connection."""
        log.info(f"Connecting to {self.config['smtp_host']}:{self.config['smtp_port']}...")
        self.connection = smtplib.SMTP(self.config["smtp_host"], self.config["smtp_port"])
        self.connection.ehlo()
        self.connection.starttls()
        self.connection.login(self.config["sender_email"], self.config["sender_password"])
        log.info("SMTP connection established ✓")

    def disconnect(self):
        if self.connection:
            self.connection.quit()
            log.info("SMTP connection closed")

    def send(self, to_email: str, subject: str, body: str) -> bool:
        """Send a single email. Returns True on success."""
        if self.config.get("dry_run"):
            log.info(f"[DRY RUN] Would send to: {to_email} | Subject: {subject}")
            return True

        try:
            msg = MIMEMultipart("alternative")
            msg["From"] = f"{self.config['sender_name']} <{self.config['sender_email']}>"
            msg["To"] = to_email
            msg["Subject"] = subject

            # Plain text version
            msg.attach(MIMEText(body, "plain"))

            # Optional HTML version (simple formatting)
            html_body = body.replace("\n", "<br>")
            msg.attach(MIMEText(f"<html><body><p>{html_body}</p></body></html>", "html"))

            self.connection.sendmail(self.config["sender_email"], to_email, msg.as_string())
            return True

        except smtplib.SMTPException as e:
            log.error(f"SMTP error sending to {to_email}: {e}")
            return False


# ─────────────────────────────────────────────
# MAIN RUNNER
# ─────────────────────────────────────────────
def run_outreach(config: dict = None):
    """Main entry point. Runs the full outreach sequence."""
    if config is None:
        config = CONFIG

    log.info("=" * 60)
    log.info("EMAIL OUTREACH AUTOMATION — STARTING RUN")
    log.info(f"Mode: {'DRY RUN (no emails sent)' if config.get('dry_run') else 'LIVE — emails will be sent'}")
    log.info("=" * 60)

    # Load contacts
    contacts = load_contacts(config["contacts_csv"])
    if not contacts:
        log.warning("No contacts loaded. Exiting.")
        return

    # Initialize tracker and sender
    tracker = SentTracker(config["sent_log"])
    sender = EmailSender(config)

    # Connect to SMTP (skip in dry run)
    if not config.get("dry_run"):
        try:
            sender.connect()
        except Exception as e:
            log.error(f"Failed to connect to SMTP: {e}")
            log.error("Check your sender_email and sender_password in CONFIG")
            return

    # Track stats
    stats = {"sent": 0, "skipped_duplicate": 0, "failed": 0, "total": len(contacts)}

    try:
        for contact in contacts:
            email = contact.get("email", "").strip()

            if not email:
                log.warning(f"Skipping row with missing email: {contact}")
                stats["failed"] += 1
                continue

            # Check if already sent
            if tracker.was_sent(email):
                log.info(f"SKIP (already sent): {email}")
                stats["skipped_duplicate"] += 1
                continue

            # Safety cap
            if stats["sent"] >= config["max_emails_per_run"]:
                log.info(f"Reached max_emails_per_run limit ({config['max_emails_per_run']}). Stopping.")
                break

            # Build and send
            subject, body = build_email(contact, config)
            success = sender.send(email, subject, body)

            if success:
                tracker.mark_sent(email, contact)
                stats["sent"] += 1
                name = f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip()
                log.info(f"✓ Sent to: {name} <{email}> at {contact.get('company', 'N/A')}")
            else:
                stats["failed"] += 1

            # Rate limiting — be polite
            if stats["sent"] < len(contacts):
                time.sleep(config["delay_between_emails"])

    finally:
        sender.disconnect()

    # Summary
    log.info("=" * 60)
    log.info("RUN COMPLETE")
    log.info(f"  Sent:       {stats['sent']}")
    log.info(f"  Duplicates: {stats['skipped_duplicate']}")
    log.info(f"  Failed:     {stats['failed']}")
    log.info(f"  Total ever: {tracker.total_sent()}")
    log.info("=" * 60)

    return stats


# ─────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────
if __name__ == "__main__":
    print("\nEmail Outreach Automation Script")
    print("─" * 40)
    print(f"Config: {CONFIG['contacts_csv']}")
    print(f"Mode: {'DRY RUN' if CONFIG['dry_run'] else 'LIVE'}")
    print()

    if CONFIG["dry_run"]:
        print("⚠️  DRY RUN MODE — no emails will actually be sent")
        print("   Set CONFIG['dry_run'] = False to go live\n")

    run_outreach()
