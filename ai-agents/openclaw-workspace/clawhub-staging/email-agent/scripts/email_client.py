#!/usr/bin/env python3
"""
email_client.py — IMAP/SMTP email agent for OpenClaw skills.
Usage: python email_client.py <command> [options]
Commands: read, read-full, search, send, reply, mark-read, archive, delete, batch-send
"""
import argparse
import imaplib
import smtplib
import email
import os
import csv
import time
import json
import sys
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from email.header import decode_header
from pathlib import Path

# ── Config from env ────────────────────────────────────────────────────────
HOST      = os.environ.get("EMAIL_HOST", "imap.gmail.com")
SMTP_HOST = os.environ.get("EMAIL_SMTP_HOST", "smtp.gmail.com")
PORT      = int(os.environ.get("EMAIL_PORT", 993))
SMTP_PORT = int(os.environ.get("EMAIL_SMTP_PORT", 587))
USER      = os.environ.get("EMAIL_USER", "")
PASS      = os.environ.get("EMAIL_PASS", "")

RATE_LIMIT_PER_HOUR = 50
RATE_LIMIT_DELAY    = 3600 / RATE_LIMIT_PER_HOUR  # seconds between sends

def require_creds():
    if not USER or not PASS:
        print("ERROR: EMAIL_USER and EMAIL_PASS env vars required.")
        print("For Gmail, use an App Password: https://myaccount.google.com/apppasswords")
        sys.exit(1)

def decode_str(s):
    if s is None:
        return ""
    parts = decode_header(s)
    result = []
    for part, enc in parts:
        if isinstance(part, bytes):
            result.append(part.decode(enc or "utf-8", errors="replace"))
        else:
            result.append(str(part))
    return "".join(result)

def get_imap():
    require_creds()
    conn = imaplib.IMAP4_SSL(HOST, PORT)
    conn.login(USER, PASS)
    return conn

# ── Commands ───────────────────────────────────────────────────────────────

def cmd_read(args):
    """List recent emails with subject/from/date."""
    conn = get_imap()
    conn.select("INBOX")
    criteria = "UNSEEN" if args.unread else "ALL"
    _, data = conn.search(None, criteria)
    uids = data[0].split()
    uids = uids[-args.limit:]  # most recent N

    results = []
    for uid in reversed(uids):
        _, msg_data = conn.fetch(uid, "(BODY[HEADER.FIELDS (FROM SUBJECT DATE)])")
        raw = msg_data[0][1]
        msg = email.message_from_bytes(raw)
        results.append({
            "uid": uid.decode(),
            "from": decode_str(msg["From"]),
            "subject": decode_str(msg["Subject"]),
            "date": decode_str(msg["Date"]),
        })

    conn.logout()
    for r in results:
        print(f"[{r['uid']}] {r['date'][:16]}  FROM: {r['from'][:40]}")
        print(f"       SUBJ: {r['subject']}")
        print()

def cmd_search(args):
    """Search emails by IMAP criteria."""
    conn = get_imap()
    folder = args.folder or "INBOX"
    conn.select(folder)
    _, data = conn.search(None, args.query)
    uids = data[0].split()
    uids = uids[-args.limit:]

    for uid in reversed(uids):
        _, msg_data = conn.fetch(uid, "(BODY[HEADER.FIELDS (FROM SUBJECT DATE)])")
        raw = msg_data[0][1]
        msg = email.message_from_bytes(raw)
        print(f"[{uid.decode()}] {decode_str(msg['Date'])[:16]}  {decode_str(msg['From'])[:35]}")
        print(f"       {decode_str(msg['Subject'])}")
        print()

    conn.logout()

def cmd_read_full(args):
    """Fetch and print a full email by UID."""
    conn = get_imap()
    conn.select("INBOX")
    _, msg_data = conn.fetch(args.uid.encode(), "(RFC822)")
    raw = msg_data[0][1]
    msg = email.message_from_bytes(raw)
    print(f"FROM:    {decode_str(msg['From'])}")
    print(f"TO:      {decode_str(msg['To'])}")
    print(f"SUBJECT: {decode_str(msg['Subject'])}")
    print(f"DATE:    {decode_str(msg['Date'])}")
    print("-" * 60)

    if msg.is_multipart():
        for part in msg.walk():
            ct = part.get_content_type()
            if ct == "text/plain" and "attachment" not in str(part.get("Content-Disposition", "")):
                print(part.get_payload(decode=True).decode("utf-8", errors="replace"))
                break
    else:
        print(msg.get_payload(decode=True).decode("utf-8", errors="replace"))
    conn.logout()

def cmd_send(args):
    """Send an email via SMTP."""
    require_creds()
    msg = MIMEMultipart()
    msg["From"]    = args.from_addr or USER
    msg["To"]      = args.to
    msg["Subject"] = args.subject
    msg.attach(MIMEText(args.body, "plain"))

    if args.attach and os.path.exists(args.attach):
        with open(args.attach, "rb") as f:
            part = MIMEBase("application", "octet-stream")
            part.set_payload(f.read())
        encoders.encode_base64(part)
        part.add_header("Content-Disposition", f"attachment; filename={Path(args.attach).name}")
        msg.attach(part)

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls()
        server.login(USER, PASS)
        server.sendmail(msg["From"], args.to, msg.as_string())

    print(f"✅ Sent to {args.to}: {args.subject}")

def cmd_reply(args):
    """Reply to an email by UID."""
    conn = get_imap()
    conn.select("INBOX")
    _, msg_data = conn.fetch(args.uid.encode(), "(RFC822)")
    raw = msg_data[0][1]
    orig = email.message_from_bytes(raw)
    conn.logout()

    to      = decode_str(orig["Reply-To"] or orig["From"])
    subject = "Re: " + decode_str(orig["Subject"]).lstrip("Re: ")
    body    = args.body + "\n\n---\nOn " + decode_str(orig["Date"]) + ", wrote:\n> " + \
              (orig.get_payload(decode=True) or b"").decode("utf-8", errors="replace")[:500]

    # Reuse send
    class FakeArgs:
        pass
    fa = FakeArgs()
    fa.to       = to
    fa.subject  = subject
    fa.body     = body
    fa.from_addr = USER
    fa.attach   = None
    cmd_send(fa)

def cmd_mark_read(args):
    conn = get_imap()
    conn.select("INBOX")
    conn.store(args.uid.encode(), "+FLAGS", "\\Seen")
    conn.logout()
    print(f"✅ Marked UID {args.uid} as read")

def cmd_archive(args):
    conn = get_imap()
    conn.select("INBOX")
    conn.copy(args.uid.encode(), "[Gmail]/All Mail")
    conn.store(args.uid.encode(), "+FLAGS", "\\Deleted")
    conn.expunge()
    conn.logout()
    print(f"✅ Archived UID {args.uid}")

def cmd_delete(args):
    conn = get_imap()
    conn.select("INBOX")
    conn.store(args.uid.encode(), "+FLAGS", "\\Deleted")
    conn.expunge()
    conn.logout()
    print(f"✅ Deleted UID {args.uid}")

def cmd_batch_send(args):
    """Send personalized emails from a CSV with a template."""
    require_creds()
    template = Path(args.template).read_text()
    sent = 0
    failed = 0

    with open(args.csv, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            body = template
            for k, v in row.items():
                body = body.replace(f"{{{k}}}", v)

            subject_line = body.split("\n")[0].replace("SUBJECT:", "").strip()
            body_content = "\n".join(body.split("\n")[1:]).strip()

            class FakeArgs:
                pass
            fa = FakeArgs()
            fa.to       = row["email"]
            fa.subject  = subject_line
            fa.body     = body_content
            fa.from_addr = USER
            fa.attach   = None

            try:
                cmd_send(fa)
                sent += 1
                time.sleep(RATE_LIMIT_DELAY)
            except Exception as e:
                print(f"❌ Failed to send to {row['email']}: {e}")
                failed += 1

    print(f"\n📧 Batch complete: {sent} sent, {failed} failed")

# ── Main ───────────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser(description="Email agent CLI")
    sub = p.add_subparsers(dest="command")

    r = sub.add_parser("read")
    r.add_argument("--limit", type=int, default=10)
    r.add_argument("--unread", action="store_true")

    s = sub.add_parser("search")
    s.add_argument("--query", required=True)
    s.add_argument("--folder", default="INBOX")
    s.add_argument("--limit", type=int, default=20)

    rf = sub.add_parser("read-full")
    rf.add_argument("--uid", required=True)

    snd = sub.add_parser("send")
    snd.add_argument("--to", required=True)
    snd.add_argument("--subject", required=True)
    snd.add_argument("--body", required=True)
    snd.add_argument("--from", dest="from_addr")
    snd.add_argument("--attach")

    rep = sub.add_parser("reply")
    rep.add_argument("--uid", required=True)
    rep.add_argument("--body", required=True)

    mr = sub.add_parser("mark-read")
    mr.add_argument("--uid", required=True)

    ar = sub.add_parser("archive")
    ar.add_argument("--uid", required=True)

    dl = sub.add_parser("delete")
    dl.add_argument("--uid", required=True)

    bs = sub.add_parser("batch-send")
    bs.add_argument("--csv", required=True)
    bs.add_argument("--template", required=True)

    args = p.parse_args()
    dispatch = {
        "read": cmd_read, "search": cmd_search, "read-full": cmd_read_full,
        "send": cmd_send, "reply": cmd_reply, "mark-read": cmd_mark_read,
        "archive": cmd_archive, "delete": cmd_delete, "batch-send": cmd_batch_send,
    }
    if args.command in dispatch:
        dispatch[args.command](args)
    else:
        p.print_help()

if __name__ == "__main__":
    main()
