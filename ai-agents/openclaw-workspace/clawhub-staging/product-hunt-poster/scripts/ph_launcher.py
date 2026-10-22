#!/usr/bin/env python3
"""
ph_launcher.py — Product Hunt launch assistant.
Requires: PRODUCT_HUNT_API_TOKEN for submit/monitor (research/draft/checklist work without it).
"""
import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    import urllib.request
    import urllib.parse
    import urllib.error
except ImportError:
    pass

TOKEN  = os.environ.get("PRODUCT_HUNT_API_TOKEN", "")
MEMORY = Path("memory")

def graphql(query, variables=None):
    if not TOKEN:
        print("ERROR: PRODUCT_HUNT_API_TOKEN required for this command.")
        print("Get it at: https://www.producthunt.com/v2/oauth/applications")
        sys.exit(1)
    payload = json.dumps({"query": query, "variables": variables or {}}).encode()
    req = urllib.request.Request(
        "https://api.producthunt.com/v2/api/graphql",
        data=payload,
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        print(f"PH API Error {e.code}: {e.read().decode()}")
        sys.exit(1)

def cmd_research(args):
    """Fetch top recent launches in a category."""
    q = """
    query($topic: String!, $limit: Int!) {
      posts(topic: $topic, order: VOTES, first: $limit) {
        edges {
          node {
            id name tagline votesCount commentsCount
            url createdAt
          }
        }
      }
    }"""
    result = graphql(q, {"topic": args.category or "developer-tools", "limit": args.limit or 10})
    posts = result.get("data", {}).get("posts", {}).get("edges", [])
    if not posts:
        print("No results. Try a different category.")
        return
    print(f"\nTop {len(posts)} launches in '{args.category}':\n")
    for p in posts:
        n = p["node"]
        print(f"  {n['votesCount']:4d} votes | {n['name'][:30]:<30} | {n['tagline'][:55]}")
        print(f"              {n['url']}\n")

def cmd_draft(args):
    """Generate a formatted PH launch draft."""
    MEMORY.mkdir(exist_ok=True)
    slug = re.sub(r"[^a-z0-9-]", "-", (args.name or "product").lower())

    description = ""
    if args.description_file and Path(args.description_file).exists():
        description = Path(args.description_file).read_text()

    maker_comment = ""
    if args.maker_comment_file and Path(args.maker_comment_file).exists():
        maker_comment = Path(args.maker_comment_file).read_text()

    draft = f"""# Product Hunt Launch Draft — {args.name}

Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d')}

---

## Listing Details

**Name:** {args.name}
**Tagline:** {args.tagline or '[WRITE TAGLINE — max 60 chars, verb-led, specific benefit]'}
**Category:** {args.category or '[e.g., Games, Developer Tools, Productivity]'}

**Tagline check:**
- Length: {len(args.tagline or '')} chars (max 60) {'✅' if len(args.tagline or '') <= 60 else '❌ TOO LONG'}
- No buzzwords check: manual review needed

---

## Description

{description or '[Paste your product description here — 100-300 words. Lead with the problem, explain the solution, end with a call to action.]'}

---

## First Comment (Maker Comment)

Post this within 2 minutes of launch. This is your origin story.

{maker_comment or '''[Write 3-5 paragraphs:
1. Why you built this (personal story)
2. What makes it different
3. What you learned building it
4. What you\'re looking for from the PH community
5. Link to try it + "Ask me anything!"]'''}

---

## Launch Assets Checklist

- [ ] Thumbnail: 240×240px, high contrast, product name visible
- [ ] Gallery image 1: Hero shot / main feature
- [ ] Gallery image 2: Key feature #2 or how-it-works
- [ ] Gallery image 3: Use case or result
- [ ] Video (optional but +30% upvotes): 30-60 sec demo

---

## Distribution Plan (Day Of)

- [ ] Post in Slack/Discord communities you're part of
- [ ] Tweet at 12:01 AM PST with PH link
- [ ] Email list (if any)
- [ ] Message 10+ friends directly (personal ask is 10x more effective than broadcast)
- [ ] Post in relevant subreddits AFTER hitting front page

---

## Draft saved to: memory/ph-draft-{slug}.md
"""
    out = MEMORY / f"ph-draft-{slug}.md"
    out.write_text(draft)
    print(f"[OK] Draft saved: {out}")
    print(f"\nTagline: {args.tagline}")
    print(f"Length:  {len(args.tagline or '')} chars")

def cmd_checklist(args):
    """Print pre-launch checklist."""
    print(f"\n🚀 Product Hunt Launch Checklist — {args.name or 'Your Product'}\n")
    items = [
        ("24h before launch", [
            "Thumbnail ready (240×240px PNG)",
            "Gallery images ready (1280×960px)",
            "Description written and spell-checked",
            "First maker comment drafted",
            "URL live and working",
            "Account email verified on PH",
            "Set launch date to Tuesday/Wednesday/Thursday",
        ]),
        ("At launch (12:01 AM PST)", [
            "Submit product on Product Hunt",
            "Post first maker comment immediately",
            "Tweet the PH link",
            "Message close contacts personally",
        ]),
        ("During launch day", [
            "Reply to every comment within 1 hour",
            "Post updates as milestones hit (#1 in category, etc.)",
            "Share PH link in relevant communities (not spammy)",
            "Monitor upvote count every 30 min",
        ]),
    ]
    for section, checks in items:
        print(f"  [{section}]")
        for c in checks:
            print(f"    [ ] {c}")
        print()

def cmd_submit(args):
    """Submit product to Product Hunt via API."""
    q = """
    mutation createPost($input: PostCreateInput!) {
      postCreate(input: $input) {
        post { id name url votesCount }
        errors { field message }
      }
    }"""
    variables = {
        "input": {
            "name": args.name,
            "tagline": args.tagline,
            "url": args.url,
        }
    }
    result = graphql(q, variables)
    errors = result.get("data", {}).get("postCreate", {}).get("errors", [])
    if errors:
        print(f"Submit errors: {errors}")
        sys.exit(1)
    post = result.get("data", {}).get("postCreate", {}).get("post", {})
    print(f"[OK] Submitted: {post.get('name')}")
    print(f"     URL: {post.get('url')}")
    print(f"     ID:  {post.get('id')}")

def cmd_monitor(args):
    """Check upvotes/comments on a live post."""
    q = """
    query($id: ID!) {
      post(id: $id) { name votesCount commentsCount url }
    }"""
    result = graphql(q, {"id": args.post_id})
    post = result.get("data", {}).get("post", {})
    if not post:
        print(f"Post not found: {args.post_id}")
        return
    print(f"{post['name']}: {post['votesCount']} upvotes, {post['commentsCount']} comments")
    print(f"URL: {post['url']}")

def main():
    p = argparse.ArgumentParser(description="Product Hunt launch assistant")
    sub = p.add_subparsers(dest="command")

    rs = sub.add_parser("research")
    rs.add_argument("--category", default="developer-tools")
    rs.add_argument("--limit", type=int, default=10)

    dr = sub.add_parser("draft")
    dr.add_argument("--name", required=True)
    dr.add_argument("--tagline")
    dr.add_argument("--category")
    dr.add_argument("--description-file")
    dr.add_argument("--maker-comment-file")

    cl = sub.add_parser("checklist")
    cl.add_argument("--name")

    sm = sub.add_parser("submit")
    sm.add_argument("--name", required=True)
    sm.add_argument("--tagline", required=True)
    sm.add_argument("--url", required=True)
    sm.add_argument("--thumbnail")

    mn = sub.add_parser("monitor")
    mn.add_argument("--post-id", required=True)

    args = p.parse_args()
    dispatch = {
        "research": cmd_research, "draft": cmd_draft, "checklist": cmd_checklist,
        "submit": cmd_submit, "monitor": cmd_monitor,
    }
    if args.command in dispatch:
        dispatch[args.command](args)
    else:
        p.print_help()

if __name__ == "__main__":
    main()
