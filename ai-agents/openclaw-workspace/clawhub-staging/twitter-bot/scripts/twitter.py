#!/usr/bin/env python3
"""
twitter.py — Twitter/X API v2 client for OpenClaw.
Requires: TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET
"""
import argparse
import base64
import hashlib
import hmac
import json
import os
import sys
import time
import urllib.parse
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path

# ── OAuth 1.0a ─────────────────────────────────────────────────────────────

API_KEY    = os.environ.get("TWITTER_API_KEY", "")
API_SECRET = os.environ.get("TWITTER_API_SECRET", "")
TOKEN      = os.environ.get("TWITTER_ACCESS_TOKEN", "")
TOKEN_SEC  = os.environ.get("TWITTER_ACCESS_SECRET", "")

QUEUE_FILE = Path("memory/tweet-queue.json")
MEMORY     = Path("memory")

def require_creds():
    missing = [k for k, v in [("TWITTER_API_KEY", API_KEY), ("TWITTER_API_SECRET", API_SECRET),
                                ("TWITTER_ACCESS_TOKEN", TOKEN), ("TWITTER_ACCESS_SECRET", TOKEN_SEC)] if not v]
    if missing:
        print(f"ERROR: Missing env vars: {', '.join(missing)}")
        print("Set up at: https://developer.twitter.com/en/portal/dashboard")
        sys.exit(1)

def oauth1_header(method, url, params=None):
    """Generate OAuth 1.0a Authorization header."""
    nonce     = base64.b64encode(os.urandom(32)).decode().rstrip("=").replace("+", "").replace("/", "")[:32]
    timestamp = str(int(time.time()))

    oauth_params = {
        "oauth_consumer_key": API_KEY,
        "oauth_nonce": nonce,
        "oauth_signature_method": "HMAC-SHA1",
        "oauth_timestamp": timestamp,
        "oauth_token": TOKEN,
        "oauth_version": "1.0",
    }

    all_params = {**(params or {}), **oauth_params}
    sorted_params = "&".join(f"{urllib.parse.quote(k, safe='')}={urllib.parse.quote(str(v), safe='')}"
                             for k, v in sorted(all_params.items()))
    base_string = "&".join([
        method.upper(),
        urllib.parse.quote(url, safe=""),
        urllib.parse.quote(sorted_params, safe=""),
    ])
    signing_key = f"{urllib.parse.quote(API_SECRET, safe='')}&{urllib.parse.quote(TOKEN_SEC, safe='')}"
    sig = base64.b64encode(hmac.new(signing_key.encode(), base_string.encode(), hashlib.sha1).digest()).decode()

    oauth_params["oauth_signature"] = sig
    header = "OAuth " + ", ".join(f'{urllib.parse.quote(k, safe="")}="{urllib.parse.quote(str(v), safe="")}"'
                                   for k, v in sorted(oauth_params.items()))
    return header

def v2_post(endpoint, body):
    """POST to Twitter API v2 with OAuth 1.0a."""
    require_creds()
    url = f"https://api.twitter.com/2/{endpoint}"
    data = json.dumps(body).encode()
    auth = oauth1_header("POST", url)
    req = urllib.request.Request(url, data=data, headers={
        "Authorization": auth,
        "Content-Type": "application/json",
    })
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        err = json.loads(e.read().decode())
        print(f"Twitter API Error {e.code}: {err}")
        sys.exit(1)

def v2_get(endpoint, params=None):
    """GET from Twitter API v2 with OAuth 1.0a."""
    require_creds()
    url = f"https://api.twitter.com/2/{endpoint}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    auth = oauth1_header("GET", url, params)
    req = urllib.request.Request(url, headers={"Authorization": auth})
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        err = json.loads(e.read().decode())
        print(f"Twitter API Error {e.code}: {err}")
        sys.exit(1)

# ── Commands ───────────────────────────────────────────────────────────────

def cmd_tweet(args):
    if len(args.text) > 280:
        print(f"ERROR: Tweet too long ({len(args.text)} chars, max 280)")
        sys.exit(1)
    result = v2_post("tweets", {"text": args.text})
    tweet_id = result.get("data", {}).get("id", "")
    print(f"[OK] Tweet posted: https://twitter.com/i/web/status/{tweet_id}")

def cmd_thread(args):
    thread_file = Path(args.file)
    if not thread_file.exists():
        print(f"ERROR: File not found: {args.file}")
        sys.exit(1)
    tweets = [t.strip() for t in thread_file.read_text().split("---") if t.strip()]
    if not tweets:
        print("ERROR: No tweets found in file (separate with ---)")
        sys.exit(1)

    print(f"Posting thread: {len(tweets)} tweets")
    last_id = None
    for i, text in enumerate(tweets):
        if len(text) > 280:
            print(f"WARNING: Tweet {i+1} is {len(text)} chars (truncating to 280)")
            text = text[:277] + "..."
        body = {"text": text}
        if last_id:
            body["reply"] = {"in_reply_to_tweet_id": last_id}
        result = v2_post("tweets", body)
        last_id = result.get("data", {}).get("id", "")
        print(f"  [{i+1}/{len(tweets)}] https://twitter.com/i/web/status/{last_id}")
        if i < len(tweets) - 1:
            time.sleep(2)  # brief pause between tweets

def cmd_queue(args):
    MEMORY.mkdir(exist_ok=True)
    queue = json.loads(QUEUE_FILE.read_text()) if QUEUE_FILE.exists() else []

    if args.run:
        now = datetime.now(timezone.utc).isoformat()
        due = [t for t in queue if t.get("send_at", "") <= now and not t.get("sent")]
        if not due:
            print("No tweets due right now.")
            return
        for item in due:
            result = v2_post("tweets", {"text": item["text"]})
            tweet_id = result.get("data", {}).get("id", "")
            item["sent"] = True
            item["tweet_id"] = tweet_id
            print(f"[OK] Sent: https://twitter.com/i/web/status/{tweet_id}")
        QUEUE_FILE.write_text(json.dumps(queue, indent=2))
        return

    if args.text:
        queue.append({"text": args.text, "send_at": args.send_at or "", "sent": False,
                      "queued_at": datetime.now(timezone.utc).isoformat()})
        QUEUE_FILE.write_text(json.dumps(queue, indent=2))
        print(f"[OK] Queued: {args.text[:60]}... (send at: {args.send_at or 'manual'})")
        return

    # List queue
    pending = [t for t in queue if not t.get("sent")]
    print(f"Queue: {len(pending)} pending")
    for t in pending:
        print(f"  [{t.get('send_at','manual')}] {t['text'][:60]}")

def cmd_mentions(args):
    # Get own user ID first
    me = v2_get("users/me")
    uid = me.get("data", {}).get("id")
    result = v2_get(f"users/{uid}/mentions", {"max_results": str(args.limit or 10),
                                               "tweet.fields": "created_at,author_id"})
    tweets = result.get("data", [])
    if not tweets:
        print("No recent mentions.")
        return
    print(f"\nRecent mentions ({len(tweets)}):\n")
    for t in tweets:
        print(f"  [{t['id']}] {t['text'][:100]}")

def cmd_reply(args):
    result = v2_post("tweets", {"text": args.text, "reply": {"in_reply_to_tweet_id": args.tweet_id}})
    tweet_id = result.get("data", {}).get("id", "")
    print(f"[OK] Replied: https://twitter.com/i/web/status/{tweet_id}")

def cmd_stats(args):
    result = v2_get(f"tweets/{args.tweet_id}", {"tweet.fields": "public_metrics,created_at"})
    t = result.get("data", {})
    m = t.get("public_metrics", {})
    print(f"Tweet: {t.get('text','')[:80]}")
    print(f"  Likes:    {m.get('like_count', 0)}")
    print(f"  Retweets: {m.get('retweet_count', 0)}")
    print(f"  Replies:  {m.get('reply_count', 0)}")
    print(f"  Impressions: {m.get('impression_count', 0)}")

def cmd_followers(args):
    me = v2_get("users/me", {"user.fields": "public_metrics"})
    u = me.get("data", {})
    m = u.get("public_metrics", {})
    print(f"@{u.get('username','?')} — {m.get('followers_count', 0):,} followers")
    print(f"  Following: {m.get('following_count', 0):,}")
    print(f"  Tweets:    {m.get('tweet_count', 0):,}")

# ── Main ───────────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser(description="Twitter/X bot CLI")
    sub = p.add_subparsers(dest="command")

    tw = sub.add_parser("tweet")
    tw.add_argument("--text", required=True)

    th = sub.add_parser("thread")
    th.add_argument("--file", required=True)

    qu = sub.add_parser("queue")
    qu.add_argument("--text")
    qu.add_argument("--send-at")
    qu.add_argument("--run", action="store_true")

    mn = sub.add_parser("mentions")
    mn.add_argument("--limit", type=int, default=10)

    rp = sub.add_parser("reply")
    rp.add_argument("--tweet-id", required=True)
    rp.add_argument("--text", required=True)

    st = sub.add_parser("stats")
    st.add_argument("--tweet-id", required=True)

    sub.add_parser("followers")

    args = p.parse_args()
    dispatch = {
        "tweet": cmd_tweet, "thread": cmd_thread, "queue": cmd_queue,
        "mentions": cmd_mentions, "reply": cmd_reply,
        "stats": cmd_stats, "followers": cmd_followers,
    }
    if args.command in dispatch:
        dispatch[args.command](args)
    else:
        p.print_help()

if __name__ == "__main__":
    main()
