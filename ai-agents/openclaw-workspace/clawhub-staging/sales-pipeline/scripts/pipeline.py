#!/usr/bin/env python3
"""
pipeline.py — File-based sales pipeline tracker.
Data stored in memory/pipeline.json — no external services needed.
"""
import argparse
import json
import os
import sys
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path

PIPELINE_FILE = Path("memory/pipeline.json")

STAGES = ["lead", "qualified", "proposal", "negotiation", "closed-won", "closed-lost"]
ACTIVE_STAGES = ["lead", "qualified", "proposal", "negotiation"]
WEIGHTS = {"lead": 0.10, "qualified": 0.25, "proposal": 0.50, "negotiation": 0.75, "closed-won": 1.0, "closed-lost": 0.0}

def today():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")

def load():
    if not PIPELINE_FILE.exists():
        return {"deals": []}
    return json.loads(PIPELINE_FILE.read_text(encoding="utf-8"))

def save(data):
    PIPELINE_FILE.parent.mkdir(exist_ok=True)
    PIPELINE_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")

def find_deal(data, deal_id):
    for d in data["deals"]:
        if d["id"].startswith(deal_id):
            return d
    return None

# ── Commands ───────────────────────────────────────────────────────────────

def cmd_add(args):
    data = load()
    deal = {
        "id": str(uuid.uuid4())[:8],
        "name": args.name,
        "stage": args.stage or "lead",
        "value": args.value or 0,
        "contact": args.contact or "",
        "notes": args.notes or "",
        "created": today(),
        "updated": today(),
    }
    data["deals"].append(deal)
    save(data)
    print(f"[OK] Deal added: [{deal['id']}] {deal['name']} — ${deal['value']} ({deal['stage']})")

def cmd_list(args):
    data = load()
    stage_filter = args.stage if args.stage and args.stage != "all" else None
    deals = data["deals"]

    if stage_filter:
        deals = [d for d in deals if d["stage"] == stage_filter]
    else:
        deals = [d for d in deals if d["stage"] in ACTIVE_STAGES]

    if not deals:
        print("No deals found.")
        return

    print(f"\n{'ID':<10} {'Stage':<14} {'Value':>8}  {'Name':<35} {'Contact'}")
    print("-" * 85)
    for d in sorted(deals, key=lambda x: STAGES.index(x["stage"]) if x["stage"] in STAGES else 99):
        print(f"{d['id']:<10} {d['stage']:<14} ${d['value']:>7,}  {d['name'][:34]:<35} {d.get('contact','')[:25]}")
    print(f"\nTotal: {len(deals)} deals")

def cmd_move(args):
    data = load()
    deal = find_deal(data, args.id)
    if not deal:
        print(f"Deal not found: {args.id}")
        sys.exit(1)
    old = deal["stage"]
    deal["stage"] = args.stage
    deal["updated"] = today()
    if args.notes:
        deal["notes"] = (deal.get("notes", "") + f"\n[{today()}] {args.notes}").strip()
    save(data)
    print(f"[OK] [{deal['id']}] {deal['name']}: {old} -> {args.stage}")
    if args.stage == "closed-won":
        print(f"     Closed Won! ${deal['value']:,}")
    elif args.stage == "closed-lost":
        print(f"     Marked lost. Better luck next time.")

def cmd_update(args):
    data = load()
    deal = find_deal(data, args.id)
    if not deal:
        print(f"Deal not found: {args.id}")
        sys.exit(1)
    if args.value is not None:
        deal["value"] = args.value
    if args.contact:
        deal["contact"] = args.contact
    if args.notes:
        deal["notes"] = (deal.get("notes", "") + f"\n[{today()}] {args.notes}").strip()
    if args.name:
        deal["name"] = args.name
    deal["updated"] = today()
    save(data)
    print(f"[OK] Updated: [{deal['id']}] {deal['name']}")

def cmd_followup(args):
    data = load()
    cutoff = (datetime.now(timezone.utc) - timedelta(days=3)).strftime("%Y-%m-%d")
    stale = [d for d in data["deals"]
             if d["stage"] in ACTIVE_STAGES and d.get("updated", d.get("created", "")) <= cutoff]

    if not stale:
        print("[OK] No stale deals — everything touched in last 3 days.")
        return

    print(f"\n[!] {len(stale)} deal(s) need follow-up (not updated in 3+ days):\n")
    for d in sorted(stale, key=lambda x: x.get("updated", "")):
        print(f"  [{d['id']}] {d['name']} — {d['stage']} — last update: {d.get('updated', '?')}")
        if d.get("contact"):
            print(f"         Contact: {d['contact']}")
        if d.get("notes"):
            last_note = d["notes"].strip().split("\n")[-1]
            print(f"         Notes: {last_note[:80]}")
        print()

def cmd_report(args):
    data = load()
    deals = data["deals"]
    active = [d for d in deals if d["stage"] in ACTIVE_STAGES]
    won    = [d for d in deals if d["stage"] == "closed-won"]
    lost   = [d for d in deals if d["stage"] == "closed-lost"]

    total_value = sum(d["value"] for d in active)
    weighted    = sum(d["value"] * WEIGHTS.get(d["stage"], 0) for d in active)

    # By stage
    by_stage = {}
    for stage in ACTIVE_STAGES:
        stage_deals = [d for d in active if d["stage"] == stage]
        by_stage[stage] = {"count": len(stage_deals), "value": sum(d["value"] for d in stage_deals)}

    # Win rate (last 30 days)
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
    recent_closed = [d for d in deals if d["stage"] in ["closed-won","closed-lost"] and d.get("updated","") >= cutoff]
    win_rate = (len([d for d in recent_closed if d["stage"] == "closed-won"]) / len(recent_closed) * 100) if recent_closed else 0
    avg_deal = (sum(d["value"] for d in won) / len(won)) if won else 0

    lines = [
        "# Pipeline Report\n",
        f"**Date:** {today()}",
        f"**Active deals:** {len(active)}",
        f"**Total pipeline value:** ${total_value:,}",
        f"**Weighted forecast:** ${weighted:,.0f}",
        "",
        "## By Stage\n",
    ]
    for stage in ACTIVE_STAGES:
        s = by_stage[stage]
        lines.append(f"- **{stage.capitalize()}** ({s['count']}): ${s['value']:,}")

    lines += [
        "",
        "## Performance\n",
        f"- Win rate (30d): {win_rate:.0f}% ({len([d for d in recent_closed if d['stage']=='closed-won'])}/{len(recent_closed)} closed)",
        f"- Avg deal size (all won): ${avg_deal:,.0f}",
        f"- Total won (all time): ${sum(d['value'] for d in won):,}",
        f"- Total lost (all time): {len(lost)} deals",
    ]

    report = "\n".join(lines)
    report_path = Path("memory/pipeline-report.md")
    report_path.parent.mkdir(exist_ok=True)
    report_path.write_text(report, encoding="utf-8")

    # Print to console
    print("\nPipeline Summary")
    print(f"  Active deals:       {len(active)}")
    print(f"  Total value:        ${total_value:,}")
    print(f"  Weighted forecast:  ${weighted:,.0f}")
    print()
    print("  By stage:")
    for stage in ACTIVE_STAGES:
        s = by_stage[stage]
        if s["count"] > 0:
            print(f"    {stage.capitalize():<15} ({s['count']}): ${s['value']:,}")
    print()
    print(f"  Win rate (30d):     {win_rate:.0f}%")
    print(f"  Avg deal size:      ${avg_deal:,.0f}")
    print(f"\n  Report saved: {report_path}")

# ── Main ───────────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser(description="Sales pipeline tracker")
    sub = p.add_subparsers(dest="command")

    ad = sub.add_parser("add")
    ad.add_argument("--name", required=True)
    ad.add_argument("--stage", default="lead", choices=STAGES)
    ad.add_argument("--value", type=int, default=0)
    ad.add_argument("--contact")
    ad.add_argument("--notes")

    ls = sub.add_parser("list")
    ls.add_argument("--stage", default=None, help="Filter by stage (or 'all')")

    mv = sub.add_parser("move")
    mv.add_argument("--id", required=True)
    mv.add_argument("--stage", required=True, choices=STAGES)
    mv.add_argument("--notes")

    up = sub.add_parser("update")
    up.add_argument("--id", required=True)
    up.add_argument("--name")
    up.add_argument("--value", type=int)
    up.add_argument("--contact")
    up.add_argument("--notes")

    sub.add_parser("followup")
    sub.add_parser("report")

    args = p.parse_args()
    dispatch = {
        "add": cmd_add, "list": cmd_list, "move": cmd_move,
        "update": cmd_update, "followup": cmd_followup, "report": cmd_report,
    }
    if args.command in dispatch:
        dispatch[args.command](args)
    else:
        p.print_help()

if __name__ == "__main__":
    main()
