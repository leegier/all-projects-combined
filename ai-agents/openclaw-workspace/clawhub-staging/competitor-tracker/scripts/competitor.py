#!/usr/bin/env python3
"""competitor.py — Track competitor products and prices via public web pages."""
import argparse, json, re, uuid
from datetime import datetime, timezone
from pathlib import Path
try:
    import urllib.request, urllib.error
except: pass

DATA = Path("memory/competitors.json")
MEMORY = Path("memory")

def today(): return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")

def load():
    if not DATA.exists(): return {"competitors": []}
    return json.loads(DATA.read_text())

def save(d):
    MEMORY.mkdir(exist_ok=True)
    DATA.write_text(json.dumps(d, indent=2))

def fetch(url):
    try:
        req = urllib.request.Request(url, headers={"User-Agent":"Mozilla/5.0 (compatible; CompetitorTracker/1.0)"})
        with urllib.request.urlopen(req, timeout=12) as r:
            return r.read().decode("utf-8", errors="replace")
    except Exception as e:
        return f"ERROR:{e}"

def extract_signals(html, platform):
    signals = {}
    # Price
    m = re.search(r'\$(\d+(?:\.\d{2})?)', html)
    if m: signals["price"] = float(m.group(1))
    # Rating
    m = re.search(r'(\d\.\d)\s*(?:out of|/)\s*5', html, re.IGNORECASE)
    if m: signals["rating"] = float(m.group(1))
    # Review count
    m = re.search(r'([\d,]+)\s*(?:reviews?|ratings?)', html, re.IGNORECASE)
    if m: signals["reviews"] = int(m.group(1).replace(",",""))
    # Featured / top seller
    if re.search(r'featured|top seller|bestseller|#1', html, re.IGNORECASE):
        signals["featured"] = True
    return signals

def cmd_add(args):
    d = load()
    entry = {"id": str(uuid.uuid4())[:8], "name": args.name, "url": args.url,
             "platform": args.platform or "generic", "notes": args.notes or "",
             "added": today(), "last_check": None, "last_signals": {}}
    d["competitors"].append(entry)
    save(d)
    print(f"[OK] Added: [{entry['id']}] {args.name} ({args.platform})")

def cmd_check(args):
    d = load()
    if not d["competitors"]:
        print("No competitors tracked. Use `add` first."); return
    changes = []
    for c in d["competitors"]:
        html = fetch(c["url"])
        if html.startswith("ERROR"):
            print(f"  [{c['id']}] {c['name']} — fetch error"); continue
        signals = extract_signals(html, c["platform"])
        prev    = c.get("last_signals", {})
        c["last_check"]   = today()
        # Detect changes
        for key, val in signals.items():
            if key in prev and prev[key] != val:
                changes.append(f"  [{c['name']}] {key}: {prev[key]} -> {val}")
        c["last_signals"] = signals
        print(f"  [{c['id']}] {c['name']:<30} {json.dumps(signals)}")
    save(d)
    if changes:
        print(f"\n[!] Changes detected:")
        for ch in changes: print(ch)
    else:
        print("\nNo changes since last check.")

def cmd_list(args):
    d = load()
    if not d["competitors"]:
        print("No competitors tracked."); return
    for c in d["competitors"]:
        print(f"  [{c['id']}] {c['name']:<30} {c['platform']:<10} {c['url'][:60]}")

def cmd_report(args):
    d = load()
    report = f"# Competitor Intel — {today()}\n\n"
    for c in d["competitors"]:
        report += f"## {c['name']}\n"
        report += f"- URL: {c['url']}\n"
        report += f"- Platform: {c['platform']}\n"
        report += f"- Last check: {c.get('last_check','never')}\n"
        sig = c.get("last_signals", {})
        if sig:
            for k, v in sig.items():
                report += f"- {k}: {v}\n"
        if c.get("notes"): report += f"- Notes: {c['notes']}\n"
        report += "\n"
    out = Path("memory/competitor-intel.md")
    out.parent.mkdir(exist_ok=True)
    out.write_text(report)
    print(f"[OK] Report saved: {out}")

def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="command")
    a = sub.add_parser("add"); a.add_argument("--name",required=True); a.add_argument("--url",required=True); a.add_argument("--platform",default="generic"); a.add_argument("--notes")
    sub.add_parser("check"); sub.add_parser("list"); sub.add_parser("report")
    args = p.parse_args()
    {"add":cmd_add,"check":cmd_check,"list":cmd_list,"report":cmd_report}.get(args.command, lambda _:p.print_help())(args)

if __name__ == "__main__": main()
