#!/usr/bin/env python3
"""
bounty_recon.py — Passive recon + report drafting for bug bounty hunters.
All recon is PASSIVE (public APIs only, no direct target requests).
"""
import argparse
import json
import os
import sys
import re
from datetime import datetime
from pathlib import Path
try:
    import urllib.request
    import urllib.parse
    import urllib.error
except ImportError:
    pass

MEMORY = Path("memory")

def fetch_json(url):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "BugBountyRecon/1.0"})
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read().decode())
    except Exception as e:
        return {"error": str(e)}

def fetch_text(url):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "BugBountyRecon/1.0"})
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.read().decode("utf-8", errors="replace")
    except Exception as e:
        return f"ERROR: {e}"

# ── Commands ───────────────────────────────────────────────────────────────

def cmd_programs(args):
    """List bug bounty programs from public sources."""
    print("💰 Open Bug Bounty Programs\n")
    print("Fetching from HackerOne public directory...\n")
    # HackerOne has a public GraphQL API for disclosed programs
    data = fetch_json("https://hackerone.com/programs.json?state=public_mode&order_direction=DESC&order_field=started_accepting_at")
    programs = data.get("results", []) if isinstance(data, dict) else []
    if programs:
        for p in programs[:15]:
            name = p.get("name", "unknown")
            url = f"https://hackerone.com/{p.get('handle', '')}"
            print(f"  • {name:<40} {url}")
    else:
        print("  Could not fetch live list. Browse manually:")
        print("  • HackerOne: https://hackerone.com/programs?state=public_mode")
        print("  • Bugcrowd:  https://bugcrowd.com/programs")
        print("  • Intigriti: https://app.intigriti.com/programs")
        print()
    print("\nFilter tips:")
    print("  - Filter by 'web' assets for quickest wins")
    print("  - Look for programs with 'Accepting' status and medium response time")
    print(f"  - Min payout filter: >${args.min_payout}")

def cmd_recon(args):
    """Passive recon on a domain using public sources only."""
    domain = args.domain
    print(f"🔍 Passive recon: {domain}\n")
    print("⚠️  PASSIVE ONLY — using public APIs, not touching the target directly.\n")

    results = {"domain": domain, "timestamp": datetime.utcnow().isoformat(), "subdomains": [], "dns": {}, "wayback_urls": []}

    # 1. Certificate Transparency (crt.sh)
    print("1. Subdomains via crt.sh...")
    crt = fetch_json(f"https://crt.sh/?q=%.{domain}&output=json")
    if isinstance(crt, list):
        seen = set()
        for entry in crt:
            name = entry.get("name_value", "")
            for sub in name.split("\n"):
                sub = sub.strip().lstrip("*.")
                if sub.endswith(domain) and sub not in seen:
                    seen.add(sub)
                    results["subdomains"].append(sub)
        print(f"   Found {len(results['subdomains'])} subdomains")
    else:
        print("   crt.sh unavailable")

    # 2. DNS records via Google DNS
    print("2. DNS records (Google DNS-over-HTTPS)...")
    for rtype in ["A", "MX", "TXT", "CNAME", "NS"]:
        dns = fetch_json(f"https://dns.google/resolve?name={domain}&type={rtype}")
        answers = dns.get("Answer", [])
        if answers:
            results["dns"][rtype] = [a.get("data", "") for a in answers]
            print(f"   {rtype}: {results['dns'][rtype][:3]}")

    # 3. Wayback Machine URLs
    print("3. Historical URLs (Wayback CDX)...")
    wb = fetch_text(f"http://web.archive.org/cdx/search/cdx?url=*.{domain}/*&output=text&fl=original&collapse=urlkey&limit=100")
    if not wb.startswith("ERROR"):
        urls = [u.strip() for u in wb.strip().split("\n") if u.strip()]
        results["wayback_urls"] = urls[:50]
        print(f"   Found {len(urls)} historical URLs (showing top 50)")
        # Surface interesting paths
        interesting = [u for u in urls if any(x in u for x in ["admin", "api", "backup", ".env", "config", "upload", "login"])]
        if interesting:
            print(f"   ⚠️  Interesting paths: {interesting[:5]}")
    else:
        print("   Wayback unavailable")

    # Save report
    MEMORY.mkdir(exist_ok=True)
    report_path = MEMORY / f"recon-{domain.replace('.', '-')}.md"
    with open(report_path, "w") as f:
        f.write(f"# Passive Recon — {domain}\n\n")
        f.write(f"**Date:** {results['timestamp'][:10]}\n\n")
        f.write(f"## Subdomains ({len(results['subdomains'])})\n\n")
        for s in results["subdomains"][:30]:
            f.write(f"- `{s}`\n")
        f.write("\n## DNS Records\n\n")
        for rtype, vals in results["dns"].items():
            f.write(f"**{rtype}:** {', '.join(vals[:3])}\n")
        f.write("\n## Interesting Wayback URLs\n\n")
        interesting = [u for u in results["wayback_urls"] if any(x in u for x in ["admin", "api", "backup", ".env", "config", "upload", "login"])]
        for u in interesting[:20]:
            f.write(f"- {u}\n")
    print(f"\n✅ Report saved: {report_path}")

def cmd_report(args):
    """Generate a formatted vulnerability report."""
    slug = re.sub(r"[^a-z0-9-]", "-", args.title.lower())[:40]
    MEMORY.mkdir(exist_ok=True)
    report_path = MEMORY / f"report-{slug}.md"

    severity_map = {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🔵", "info": "⚪"}
    icon = severity_map.get(args.severity.lower(), "🟡")

    content = f"""# Vulnerability Report — {args.title}

**Target:** {args.target}
**Severity:** {icon} {args.severity.upper()} (CVSS {args.cvss})
**Date:** {datetime.utcnow().strftime('%Y-%m-%d')}
**Status:** Draft

---

## Summary

{args.title} was discovered on {args.target}. This vulnerability allows an attacker to {args.impact.lower()}.

## Vulnerability Details

**Type:** {args.title.split()[0] if args.title else "Unknown"}
**CVSS Score:** {args.cvss}
**Affected Component:** {args.target}

## Steps to Reproduce

{chr(10).join(f'{i+1}. {step.strip()}' for i, step in enumerate(args.steps.split(r"\n")) if step.strip())}

## Impact

{args.impact}

## Remediation

[Describe fix — e.g., sanitize input, enforce authorization checks, restrict SSRF to allowlisted URLs]

## References

- OWASP: https://owasp.org/www-project-top-ten/
- CWE: https://cwe.mitre.org/

---
*Report generated by bug-bounty-hunter skill. Review before submission.*
"""
    report_path.write_text(content)
    print(f"✅ Report drafted: {report_path}")
    print(f"\n--- PREVIEW ---\n{content[:500]}...")

def cmd_log(args):
    """Log a bounty submission."""
    MEMORY.mkdir(exist_ok=True)
    log_path = MEMORY / "bounty-log.md"

    entry = f"| {datetime.utcnow().strftime('%Y-%m-%d')} | {args.target} | {args.title} | {args.status} | ${args.payout} |\n"

    if not log_path.exists():
        log_path.write_text("# Bounty Log\n\n| Date | Target | Title | Status | Payout |\n|------|--------|-------|--------|--------|\n")

    with open(log_path, "a") as f:
        f.write(entry)
    print(f"✅ Logged: {args.title} ({args.status}, ${args.payout})")

def cmd_log_update(args):
    """Update status/payout of a logged submission."""
    log_path = MEMORY / "bounty-log.md"
    if not log_path.exists():
        print("No bounty log found. Use `log` first.")
        return
    content = log_path.read_text()
    if args.title in content:
        # Simple line replace
        lines = content.split("\n")
        for i, line in enumerate(lines):
            if args.title in line:
                parts = line.split("|")
                if len(parts) >= 6:
                    parts[4] = f" {args.status} "
                    parts[5] = f" ${args.payout} "
                    lines[i] = "|".join(parts)
        log_path.write_text("\n".join(lines))
        print(f"✅ Updated: {args.title} → {args.status}, ${args.payout}")
    else:
        print(f"Entry not found: {args.title}")

def cmd_stats(args):
    """Show bounty hunting stats."""
    log_path = MEMORY / "bounty-log.md"
    if not log_path.exists():
        print("No bounty log yet.")
        return
    lines = log_path.read_text().split("\n")
    data_lines = [l for l in lines if l.startswith("|") and "Date" not in l and "---" not in l and l.strip() != "|"]
    total = len(data_lines)
    resolved = sum(1 for l in data_lines if "resolved" in l.lower())
    earnings = sum(int(m.group(1)) for l in data_lines for m in [re.search(r'\$(\d+)', l)] if m)
    print(f"📊 Bounty Stats")
    print(f"  Submissions:  {total}")
    print(f"  Resolved:     {resolved}")
    print(f"  Total earned: ${earnings}")

# ── Main ───────────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser(description="Bug bounty passive recon + report tool")
    sub = p.add_subparsers(dest="command")

    pg = sub.add_parser("programs")
    pg.add_argument("--min-payout", type=int, default=100)
    pg.add_argument("--platform", default="hackerone")
    pg.add_argument("--type", default="web")

    rc = sub.add_parser("recon")
    rc.add_argument("--domain", required=True)

    rp = sub.add_parser("report")
    rp.add_argument("--title", required=True)
    rp.add_argument("--cvss", required=True)
    rp.add_argument("--severity", required=True, choices=["critical","high","medium","low","info"])
    rp.add_argument("--target", required=True)
    rp.add_argument("--steps", required=True)
    rp.add_argument("--impact", required=True)

    lg = sub.add_parser("log")
    lg.add_argument("--target", required=True)
    lg.add_argument("--title", required=True)
    lg.add_argument("--status", default="submitted")
    lg.add_argument("--payout", type=int, default=0)

    lu = sub.add_parser("log-update")
    lu.add_argument("--title", required=True)
    lu.add_argument("--status", required=True)
    lu.add_argument("--payout", type=int, default=0)

    sub.add_parser("stats")

    args = p.parse_args()
    dispatch = {
        "programs": cmd_programs, "recon": cmd_recon, "report": cmd_report,
        "log": cmd_log, "log-update": cmd_log_update, "stats": cmd_stats,
    }
    if args.command in dispatch:
        dispatch[args.command](args)
    else:
        p.print_help()

if __name__ == "__main__":
    main()
