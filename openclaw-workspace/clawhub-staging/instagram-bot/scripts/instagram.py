#!/usr/bin/env python3
"""instagram.py — Instagram Graph API client for posting content."""
import argparse, json, os, sys
try:
    import urllib.request, urllib.parse, urllib.error
except: pass

TOKEN   = os.environ.get("INSTAGRAM_ACCESS_TOKEN","")
USER_ID = os.environ.get("INSTAGRAM_USER_ID","")
BASE    = "https://graph.facebook.com/v19.0"

def require_creds():
    if not TOKEN or not USER_ID:
        print("ERROR: INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_USER_ID required.")
        print("Setup: https://developers.facebook.com/docs/instagram-api/getting-started")
        sys.exit(1)

def api_post(endpoint, params):
    require_creds()
    params["access_token"] = TOKEN
    data = urllib.parse.urlencode(params).encode()
    req  = urllib.request.Request(f"{BASE}/{endpoint}", data=data)
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        print(f"Instagram API {e.code}: {e.read().decode()}"); sys.exit(1)

def api_get(endpoint, params=None):
    require_creds()
    p = {"access_token": TOKEN, **(params or {})}
    url = f"{BASE}/{endpoint}?" + urllib.parse.urlencode(p)
    try:
        with urllib.request.urlopen(url) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        print(f"Instagram API {e.code}: {e.read().decode()}"); sys.exit(1)

def publish(container_id):
    resp = api_post(f"{USER_ID}/media_publish", {"creation_id": container_id})
    media_id = resp.get("id","")
    print(f"[OK] Published. Media ID: {media_id}")
    return media_id

def cmd_photo(args):
    # Step 1: Create container
    container = api_post(f"{USER_ID}/media", {"image_url": args.image_url, "caption": args.caption or ""})
    cid = container.get("id","")
    if not cid:
        print(f"Failed to create container: {container}"); sys.exit(1)
    print(f"Container created: {cid}")
    publish(cid)

def cmd_carousel(args):
    urls = [u.strip() for u in args.image_urls.split(",")]
    # Create item containers
    item_ids = []
    for url in urls:
        resp = api_post(f"{USER_ID}/media", {"image_url": url, "is_carousel_item": "true"})
        if resp.get("id"):
            item_ids.append(resp["id"])
    if not item_ids:
        print("Failed to create carousel items"); sys.exit(1)
    # Create carousel container
    container = api_post(f"{USER_ID}/media", {
        "media_type": "CAROUSEL",
        "caption": args.caption or "",
        "children": ",".join(item_ids),
    })
    cid = container.get("id","")
    if not cid:
        print(f"Carousel container failed: {container}"); sys.exit(1)
    publish(cid)

def cmd_reel(args):
    container = api_post(f"{USER_ID}/media", {
        "media_type": "REELS",
        "video_url": args.video_url,
        "caption": args.caption or "",
        "share_to_feed": "true",
    })
    cid = container.get("id","")
    if not cid:
        print(f"Reel container failed: {container}"); sys.exit(1)
    print(f"Reel uploading (async)... Container: {cid}")
    print("Check status in a few minutes, then publish manually if needed.")
    # Note: Reels need status check before publish due to processing time

def cmd_stats(args):
    resp = api_get(f"{USER_ID}", {"fields":"username,followers_count,media_count,biography"})
    print(f"@{resp.get('username','?')}")
    print(f"  Followers: {resp.get('followers_count',0):,}")
    print(f"  Posts:     {resp.get('media_count',0)}")

def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="command")
    ph = sub.add_parser("photo"); ph.add_argument("--image-url",required=True); ph.add_argument("--caption")
    cr = sub.add_parser("carousel"); cr.add_argument("--image-urls",required=True); cr.add_argument("--caption")
    re = sub.add_parser("reel"); re.add_argument("--video-url",required=True); re.add_argument("--caption")
    sub.add_parser("stats")
    args = p.parse_args()
    {"photo":cmd_photo,"carousel":cmd_carousel,"reel":cmd_reel,"stats":cmd_stats}.get(args.command, lambda _:p.print_help())(args)

if __name__ == "__main__": main()
