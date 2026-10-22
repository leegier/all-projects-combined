#!/usr/bin/env python3
"""
lead_finder.py — Find and score freelance leads from public sources.
Sources: Upwork RSS, Reddit /r/forhire, HN "Who's Hiring", Algora bounties.
Public data only — no login, no private profile scraping.
"""
import argparse
import json
import re
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

try:
    import urllib.request
    import urllib.parse
    import urllib.error
    import xml.etree.ElementTree as ET
except ImportError:
    pass

LEADS_FILE = Path("memory/leads.json")
MEMORY = Path("memory")

PRIMARY_SKILLS = ["unity", "c#", "csharp", "game", "gamedev", "game dev", "unreal", "python", "automation"]

def fetch(url, timeout=12):
    try:
        req = urllib.request.Request(url, headers={
            "User-Agent": "LeadFinder/1.0 (job research bot)",
            "Accept": "application/rss+xml, application/xml, text/html, */*"
        })
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read().decode("utf-8", errors="replace")
    except Exception as e:
        return f"ERROR:{e}"

def score_lead(title, description, budget_text, posted_age_hours, source_url):
    score = 0
    text = (title + " " + description + " " + budget_text).lower()

    # Budget
    budget_match = re.search(r'\$(\d[\d,]*)', budget_text)
    if budget_match:
        amount = int(budget_match.group(1).replace(",", ""))
        if amount >= 500:
            score += 50
        elif amount >= 200:
            score += 30
        elif amount >= 50:
            score += 10

    # Recency
    if posted_age_hours is not None:
        if posted_age_hours <= 24:
            score += 20
        elif posted_age_hours <= 72:
            score += 10

    # Skill match
    if any(skill in text for skill in PRIMARY_SKILLS):
        score += 20

    # Urgency signals
    if any(w in text for w in ["urgent", "asap", "immediately", "rush", "today"]):
        score += 15

    # Red flags (lower score)
    if any(w in text for w in ["unpaid", "exposure", "revenue share only", "no budget"]):
        score -= 30

    return max(0, min(100, score))

def parse_rss_items(xml_text, source):
    """Parse RSS feed and return list of lead dicts."""
    leads = []
    try:
        root = ET.fromstring(xml_text)
        ns = {"atom": "http://www.w3.org/2005/Atom"}
        # Handle both RSS and Atom
        items = root.findall(".//item") or root.findall(".//atom:entry", ns)
        for item in items[:20]:
            def get(tag):
                el = item.find(tag) or item.find(f"atom:{tag}", ns)
                return (el.text or "").strip() if el is not None else ""

            title = get("title")
            desc  = get("description") or get("summary") or get("content")
            link  = get("link") or get("url")
            pub   = get("pubDate") or get("published") or get("updated")

            # Parse age
            age_hours = None
            if pub:
                for fmt in ["%a, %d %b %Y %H:%M:%S %z", "%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%SZ"]:
                    try:
                        dt = datetime.strptime(pub.strip(), fmt)
                        if dt.tzinfo is None:
                            dt = dt.replace(tzinfo=timezone.utc)
                        age_hours = (datetime.now(timezone.utc) - dt).total_seconds() / 3600
                        break
                    except ValueError:
                        continue

            # Extract budget from text
            budget_text = " ".join(re.findall(r'\$[\d,]+(?:\s*[-–]\s*\$[\d,]+)?', desc))

            s = score_lead(title, desc, budget_text, age_hours, link)
            leads.append({
                "title": title[:100],
                "url": link,
                "source": source,
                "budget": budget_text or "not listed",
                "age_hours": round(age_hours, 1) if age_hours else None,
                "score": s,
                "snippet": re.sub(r'<[^>]+>', '', desc)[:200].strip(),
            })
    except ET.ParseError:
        pass
    return leads

def scan_upwork(skills):
    """Fetch Upwork RSS for given skills."""
    leads = []
    query = urllib.parse.quote(" OR ".join(skills[:3]))
    url = f"https://www.upwork.com/ab/feed/jobs/rss?q={query}&sort=recency&paging=0%3B10"
    xml = fetch(url)
    if not xml.startswith("ERROR"):
        leads = parse_rss_items(xml, "upwork")
    return leads

def scan_reddit_forhire():
    """Fetch r/forhire new posts via RSS."""
    url = "https://www.reddit.com/r/forhire/new.rss?limit=25"
    xml = fetch(url)
    if xml.startswith("ERROR"):
        return []
    leads = parse_rss_items(xml, "reddit/forhire")
    # Only keep [HIRING] posts
    return [l for l in leads if "[hiring]" in l["title"].lower() or "hiring" in l["title"].lower()]

def scan_hn_hiring():
    """Fetch latest HN 'Who is Hiring' thread via Algolia API."""
    url = 'https://hn.algolia.com/api/v1/search?query=who+is+hiring&tags=story&numericFilters=created_at_i%3E1700000000'
    data = fetch(url)
    if data.startswith("ERROR"):
        return []
    try:
        j = json.loads(data)
        hits = j.get("hits", [])[:3]
        leads = []
        for h in hits:
            title = h.get("title", "")
            if "who is hiring" in title.lower():
                leads.append({
                    "title": title,
                    "url": f"https://news.ycombinator.com/item?id={h.get('objectID','')}",
                    "source": "hackernews",
                    "budget": "varies",
                    "age_hours": None,
                    "score": 40,
                    "snippet": "HN Who's Hiring thread — search for Unity/game/automation roles",
                })
        return leads
    except Exception:
        return []

def load_leads():
    if not LEADS_FILE.exists():
        return []
    return json.loads(LEADS_FILE.read_text())

def save_leads(leads):
    MEMORY.mkdir(exist_ok=True)
    # Deduplicate by URL
    seen = set()
    unique = []
    for l in leads:
        if l["url"] not in seen:
            seen.add(l["url"])
            unique.append(l)
    LEADS_FILE.write_text(json.dumps(unique, indent=2))
    return unique

def cmd_scan(args):
    skills = [s.strip().lower() for s in args.skills.split(",")]
    print(f"Scanning for leads: {skills}\n")

    all_leads = []

    print("  Upwork RSS...", end=" ", flush=True)
    upwork = scan_upwork(skills)
    print(f"{len(upwork)} found")
    all_leads.extend(upwork)

    print("  Reddit /r/forhire...", end=" ", flush=True)
    reddit = scan_reddit_forhire()
    print(f"{len(reddit)} hiring posts")
    all_leads.extend(reddit)

    print("  Hacker News Hiring...", end=" ", flush=True)
    hn = scan_hn_hiring()
    print(f"{len(hn)} threads")
    all_leads.extend(hn)

    # Filter by skill relevance
    skill_leads = [l for l in all_leads if any(s in (l["title"] + l["snippet"]).lower() for s in skills)]
    other_leads = [l for l in all_leads if l not in skill_leads]
    combined = skill_leads + other_leads

    # Save and display
    combined = sorted(combined, key=lambda x: x["score"], reverse=True)[:args.limit]
    saved = save_leads(load_leads() + combined)

    print(f"\nTop leads (score >= 50):\n")
    hot = [l for l in combined if l["score"] >= 50]
    if hot:
        for l in hot[:10]:
            age = f"{l['age_hours']:.0f}h ago" if l["age_hours"] else "age unknown"
            print(f"  [{l['score']:3d}] {l['title'][:60]}")
            print(f"         {l['source']} | {l['budget']} | {age}")
            print(f"         {l['url'][:80]}\n")
    else:
        print("  No high-score leads found this scan.")

    print(f"Total leads in memory: {len(saved)}")

def cmd_top(args):
    leads = sorted(load_leads(), key=lambda x: x["score"], reverse=True)[:args.limit]
    if not leads:
        print("No leads. Run `scan` first.")
        return
    print(f"\nTop {len(leads)} leads:\n")
    for l in leads:
        print(f"  [{l['score']:3d}] {l['title'][:65]}")
        print(f"         {l['source']} | {l['budget']}")
        print(f"         {l['url'][:80]}\n")

def cmd_export(args):
    leads = sorted(load_leads(), key=lambda x: x["score"], reverse=True)
    if not leads:
        print("No leads to export.")
        return
    md = "# Lead List\n\n"
    md += f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d')}\n\n"
    md += f"Total: {len(leads)} leads\n\n"
    md += "| Score | Source | Title | Budget | URL |\n"
    md += "|-------|--------|-------|--------|-----|\n"
    for l in leads:
        title = l['title'][:50].replace("|", "-")
        md += f"| {l['score']} | {l['source']} | {title} | {l['budget']} | {l['url']} |\n"
    out = Path("memory/leads.md")
    out.write_text(md)
    print(f"[OK] Exported {len(leads)} leads to {out}")

def main():
    p = argparse.ArgumentParser(description="Lead generator — find freelance clients")
    sub = p.add_subparsers(dest="command")

    sc = sub.add_parser("scan")
    sc.add_argument("--skills", default="Unity,C#,game-dev")
    sc.add_argument("--limit", type=int, default=20)

    tp = sub.add_parser("top")
    tp.add_argument("--limit", type=int, default=10)

    sub.add_parser("export")

    args = p.parse_args()
    dispatch = {"scan": cmd_scan, "top": cmd_top, "export": cmd_export}
    if args.command in dispatch:
        dispatch[args.command](args)
    else:
        p.print_help()

if __name__ == "__main__":
    main()
