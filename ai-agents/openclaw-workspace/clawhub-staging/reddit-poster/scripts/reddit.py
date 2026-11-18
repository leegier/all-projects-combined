#!/usr/bin/env python3
"""
reddit.py — Reddit API client (OAuth2 script flow).
Requires: REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD
"""
import argparse
import base64
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

try:
    import urllib.request
    import urllib.parse
    import urllib.error
except ImportError:
    pass

CLIENT_ID     = os.environ.get("REDDIT_CLIENT_ID", "")
CLIENT_SECRET = os.environ.get("REDDIT_CLIENT_SECRET", "")
USERNAME      = os.environ.get("REDDIT_USERNAME", "")
PASSWORD      = os.environ.get("REDDIT_PASSWORD", "")
USER_AGENT    = os.environ.get("REDDIT_USER_AGENT", f"OpenClaw/1.0 (by /u/{USERNAME})")

POSTS_FILE = Path("memory/reddit-posts.md")
MEMORY     = Path("memory")

_token_cache = {}

def require_creds():
    missing = [k for k, v in [("REDDIT_CLIENT_ID", CLIENT_ID), ("REDDIT_CLIENT_SECRET", CLIENT_SECRET),
                                ("REDDIT_USERNAME", USERNAME), ("REDDIT_PASSWORD", PASSWORD)] if not v]
    if missing:
        print(f"ERROR: Missing env vars: {', '.join(missing)}")
        print("Create a Reddit app at: https://www.reddit.com/prefs/apps")
        sys.exit(1)

def get_token():
    """Get OAuth2 token via password flow."""
    if _token_cache.get("token") and _token_cache.get("expires", 0) > time.time():
        return _token_cache["token"]

    require_creds()
    creds = base64.b64encode(f"{CLIENT_ID}:{CLIENT_SECRET}".encode()).decode()
    data  = urllib.parse.urlencode({"grant_type": "password", "username": USERNAME, "password": PASSWORD}).encode()
    req   = urllib.request.Request(
        "https://www.reddit.com/api/v1/access_token",
        data=data,
        headers={"Authorization": f"Basic {creds}", "User-Agent": USER_AGENT}
    )
    try:
        with urllib.request.urlopen(req) as r:
            result = json.loads(r.read().decode())
        token = result.get("access_token")
        if not token:
            print(f"ERROR: Auth failed: {result.get('error', 'unknown')}")
            sys.exit(1)
        _token_cache["token"]   = token
        _token_cache["expires"] = time.time() + result.get("expires_in", 3600) - 60
        return token
    except urllib.error.HTTPError as e:
        print(f"Auth error {e.code}: {e.read().decode()}")
        sys.exit(1)

def api_post(endpoint, data):
    token = get_token()
    req = urllib.request.Request(
        f"https://oauth.reddit.com/{endpoint}",
        data=urllib.parse.urlencode(data).encode(),
        headers={"Authorization": f"Bearer {token}", "User-Agent": USER_AGENT}
    )
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        err = json.loads(e.read().decode())
        print(f"Reddit API Error {e.code}: {err}")
        sys.exit(1)

def api_get(endpoint, params=None):
    token = get_token()
    url = f"https://oauth.reddit.com/{endpoint}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}", "User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        print(f"Reddit API Error {e.code}: {e.read().decode()}")
        sys.exit(1)

def log_post(subreddit, title, url, post_id, post_url):
    MEMORY.mkdir(exist_ok=True)
    if not POSTS_FILE.exists():
        POSTS_FILE.write_text("# Reddit Post Log\n\n| Date | Subreddit | Title | ID | URL |\n|------|-----------|-------|-----|-----|\n")
    with open(POSTS_FILE, "a") as f:
        date  = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        title_safe = title[:50].replace("|", "-")
        f.write(f"| {date} | r/{subreddit} | {title_safe} | {post_id} | {post_url} |\n")

def submit_post(subreddit, title, url=None, text=None):
    """Submit a link or text post."""
    data = {
        "sr": subreddit,
        "title": title,
        "kind": "link" if url else "self",
        "resubmit": "true",
        "nsfw": "false",
        "spoiler": "false",
    }
    if url:
        data["url"] = url
    if text:
        data["text"] = text

    result = api_post("api/submit", data)
    # Check for errors
    errors = result.get("json", {}).get("errors", [])
    if errors:
        print(f"ERROR posting to r/{subreddit}: {errors}")
        return None

    post_data = result.get("json", {}).get("data", {})
    post_url = post_data.get("url", "")
    post_id  = post_data.get("id", "")
    return post_id, post_url

# ── Commands ───────────────────────────────────────────────────────────────

def cmd_post(args):
    text = None
    if args.text:
        p = Path(args.text)
        text = p.read_text() if p.exists() else args.text

    result = submit_post(args.subreddit, args.title, url=args.url, text=text)
    if result:
        post_id, post_url = result
        print(f"[OK] Posted to r/{args.subreddit}")
        print(f"     {post_url}")
        log_post(args.subreddit, args.title, args.url or "", post_id, post_url)
    else:
        print(f"Failed to post to r/{args.subreddit}")

def cmd_crosspost(args):
    subs  = [s.strip() for s in args.subreddits.split(",")]
    delay = args.delay or 3600

    print(f"Cross-posting to {len(subs)} subreddits (delay: {delay}s between each)\n")
    for i, sub in enumerate(subs):
        print(f"  [{i+1}/{len(subs)}] Posting to r/{sub}...")
        result = submit_post(sub, args.title, url=args.url, text=args.text)
        if result:
            post_id, post_url = result
            print(f"         [OK] {post_url}")
            log_post(sub, args.title, args.url or "", post_id, post_url)
        else:
            print(f"         [FAIL] r/{sub}")

        if i < len(subs) - 1:
            print(f"  Waiting {delay}s before next post...")
            time.sleep(delay)

def cmd_stats(args):
    result = api_get(f"by_id/t3_{args.post_id}")
    posts  = result.get("data", {}).get("children", [])
    if not posts:
        print(f"Post not found: {args.post_id}")
        return
    post = posts[0].get("data", {})
    print(f"Title:    {post.get('title','')[:80]}")
    print(f"Score:    {post.get('score', 0)} ({post.get('upvote_ratio', 0)*100:.0f}% upvoted)")
    print(f"Comments: {post.get('num_comments', 0)}")
    print(f"URL:      https://reddit.com{post.get('permalink','')}")

def cmd_subreddit_info(args):
    result = api_get(f"r/{args.name}/about")
    data   = result.get("data", {})
    print(f"r/{args.name}")
    print(f"  Subscribers: {data.get('subscribers', 0):,}")
    print(f"  Description: {(data.get('public_description') or '')[:200]}")
    print(f"  NSFW: {data.get('over18', False)}")
    print(f"  Rules URL: https://reddit.com/r/{args.name}/about/rules")

def cmd_history(args):
    if not POSTS_FILE.exists():
        print("No posts logged yet.")
        return
    print(POSTS_FILE.read_text())

# ── Main ───────────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser(description="Reddit poster CLI")
    sub = p.add_subparsers(dest="command")

    po = sub.add_parser("post")
    po.add_argument("--subreddit", required=True)
    po.add_argument("--title", required=True)
    po.add_argument("--url")
    po.add_argument("--text")

    cp = sub.add_parser("crosspost")
    cp.add_argument("--title", required=True)
    cp.add_argument("--subreddits", required=True, help="Comma-separated list")
    cp.add_argument("--url")
    cp.add_argument("--text")
    cp.add_argument("--delay", type=int, default=3600, help="Seconds between posts")

    st = sub.add_parser("stats")
    st.add_argument("--post-id", required=True)

    si = sub.add_parser("subreddit-info")
    si.add_argument("--name", required=True)

    sub.add_parser("history")

    args = p.parse_args()
    dispatch = {
        "post": cmd_post, "crosspost": cmd_crosspost, "stats": cmd_stats,
        "subreddit-info": cmd_subreddit_info, "history": cmd_history,
    }
    if args.command in dispatch:
        dispatch[args.command](args)
    else:
        p.print_help()

if __name__ == "__main__":
    main()
