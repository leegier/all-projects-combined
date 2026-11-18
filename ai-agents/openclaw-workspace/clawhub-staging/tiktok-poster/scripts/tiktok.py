#!/usr/bin/env python3
"""tiktok.py — TikTok Content Posting API client."""
import argparse, json, os, sys
from pathlib import Path
try:
    import urllib.request, urllib.parse, urllib.error
except: pass

TOKEN  = os.environ.get("TIKTOK_ACCESS_TOKEN","")
BASE   = "https://open.tiktokapis.com/v2"

def require_token():
    if not TOKEN:
        print("ERROR: TIKTOK_ACCESS_TOKEN required.")
        print("Set up at: https://developers.tiktok.com")
        print("Note: API access requires app approval (~1-2 weeks)")
        sys.exit(1)

def api_post(endpoint, body):
    require_token()
    data = json.dumps(body).encode()
    req  = urllib.request.Request(f"{BASE}/{endpoint}", data=data,
           headers={"Authorization":f"Bearer {TOKEN}","Content-Type":"application/json; charset=UTF-8"})
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        print(f"TikTok API {e.code}: {e.read().decode()}"); sys.exit(1)

def api_get(endpoint):
    require_token()
    req = urllib.request.Request(f"{BASE}/{endpoint}",
          headers={"Authorization":f"Bearer {TOKEN}"})
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        print(f"TikTok API {e.code}: {e.read().decode()}"); sys.exit(1)

def cmd_upload(args):
    video_path = Path(args.video)
    if not video_path.exists():
        print(f"Video not found: {args.video}"); sys.exit(1)
    size = video_path.stat().st_size

    # Step 1: Init upload
    init_resp = api_post("post/publish/video/init/", {
        "post_info": {
            "title": args.caption or "",
            "privacy_level": args.privacy or "PUBLIC_TO_EVERYONE",
            "disable_duet": False, "disable_comment": False, "disable_stitch": False,
        },
        "source_info": {"source": "FILE_UPLOAD", "video_size": size, "chunk_size": size, "total_chunk_count": 1}
    })
    publish_id = init_resp.get("data",{}).get("publish_id","")
    upload_url = init_resp.get("data",{}).get("upload_url","")

    if not upload_url:
        print(f"Failed to init upload: {init_resp}"); sys.exit(1)

    # Step 2: Upload file
    with open(video_path, "rb") as f:
        video_data = f.read()
    req = urllib.request.Request(upload_url, data=video_data,
          headers={"Content-Type":"video/mp4","Content-Range":f"bytes 0-{size-1}/{size}"})
    req.get_method = lambda: "PUT"
    try:
        urllib.request.urlopen(req)
    except Exception as e:
        print(f"Upload error: {e}"); sys.exit(1)

    print(f"[OK] Video uploaded. Publish ID: {publish_id}")
    print(f"     Check status: tiktok.py status --publish-id {publish_id}")

def cmd_status(args):
    resp = api_post("post/publish/status/fetch/", {"publish_id": args.publish_id})
    data = resp.get("data",{})
    print(f"Status: {data.get('status','unknown')}")
    if data.get("fail_reason"):
        print(f"Fail reason: {data['fail_reason']}")

def cmd_me(args):
    resp = api_post("user/info/query/", {"fields":["open_id","display_name","follower_count","video_count"]})
    u = resp.get("data",{}).get("user",{})
    print(f"@{u.get('display_name','?')} — {u.get('follower_count',0):,} followers, {u.get('video_count',0)} videos")

def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="command")
    ul = sub.add_parser("upload"); ul.add_argument("--video",required=True); ul.add_argument("--caption"); ul.add_argument("--privacy",default="PUBLIC_TO_EVERYONE")
    st = sub.add_parser("status"); st.add_argument("--publish-id",required=True)
    sub.add_parser("me")
    args = p.parse_args()
    {"upload":cmd_upload,"status":cmd_status,"me":cmd_me}.get(args.command, lambda _:p.print_help())(args)

if __name__ == "__main__": main()
