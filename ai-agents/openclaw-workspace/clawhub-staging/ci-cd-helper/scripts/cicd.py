#!/usr/bin/env python3
"""cicd.py — GitHub Actions workflow generator and manager."""
import argparse, json, os, sys
from pathlib import Path
try:
    import urllib.request, urllib.parse, urllib.error
except: pass

TOKEN = os.environ.get("GITHUB_TOKEN","")
BASE  = "https://api.github.com"

TEMPLATES = {
"unity-build": """name: Unity Build
on:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: {lfs: true}
      - uses: game-ci/unity-builder@v4
        env:
          UNITY_LICENSE: ${{ secrets.UNITY_LICENSE }}
        with:
          targetPlatform: StandaloneWindows64
      - uses: actions/upload-artifact@v4
        with:
          name: Build
          path: build/
""",
"node-test": """name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: {node-version: '20'}
      - run: npm ci
      - run: npm test
""",
"python-test": """name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: {python-version: '3.12'}
      - run: pip install -r requirements.txt
      - run: pytest
""",
"deploy-netlify": """name: Deploy to Netlify
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run build
        if: hashFiles('package.json') != ''
      - uses: netlify/actions/cli@master
        with:
          args: deploy --dir=dist --prod
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
""",
"deploy-vercel": """name: Deploy to Vercel
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm i -g vercel && vercel --prod --token=${{ secrets.VERCEL_TOKEN }}
""",
"release-tag": """name: Release
on:
  push:
    tags: ['v*']
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: softprops/action-gh-release@v2
        with:
          files: |
            dist/**
            *.zip
""",
}

def gh(method, path, data=None):
    if not TOKEN:
        print("ERROR: GITHUB_TOKEN required"); sys.exit(1)
    url = f"{BASE}/{path}"
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers={
        "Authorization": f"Bearer {TOKEN}", "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json"})
    req.get_method = lambda: method
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read().decode()) if r.status != 204 else {}
    except urllib.error.HTTPError as e:
        print(f"GitHub API {e.code}: {e.read().decode()}"); sys.exit(1)

def cmd_generate(args):
    tmpl = TEMPLATES.get(args.type)
    if not tmpl:
        print(f"Unknown type: {args.type}. Available: {', '.join(TEMPLATES)}")
        sys.exit(1)
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(tmpl, encoding="utf-8")
    print(f"[OK] Workflow generated: {out}")

def cmd_trigger(args):
    gh("POST", f"repos/{args.repo}/actions/workflows/{args.workflow}/dispatches",
       {"ref": args.branch or "main"})
    print(f"[OK] Triggered {args.workflow} on {args.branch or 'main'}")

def cmd_status(args):
    runs = gh("GET", f"repos/{args.repo}/actions/runs?per_page={args.limit or 5}")
    for r in runs.get("workflow_runs", []):
        print(f"  [{r['id']}] {r['name']:<30} {r['status']:<12} {r['conclusion'] or '...'} — {r['head_branch']}")

def cmd_cancel(args):
    gh("POST", f"repos/{args.repo}/actions/runs/{args.run_id}/cancel")
    print(f"[OK] Run {args.run_id} cancellation requested")

def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="command")
    g = sub.add_parser("generate"); g.add_argument("--type",required=True); g.add_argument("--output",required=True)
    t = sub.add_parser("trigger"); t.add_argument("--repo",required=True); t.add_argument("--workflow",required=True); t.add_argument("--branch",default="main")
    s = sub.add_parser("status"); s.add_argument("--repo",required=True); s.add_argument("--limit",type=int,default=5)
    c = sub.add_parser("cancel"); c.add_argument("--repo",required=True); c.add_argument("--run-id",required=True)
    args = p.parse_args()
    {"generate":cmd_generate,"trigger":cmd_trigger,"status":cmd_status,"cancel":cmd_cancel}.get(args.command, lambda _: p.print_help())(args)

if __name__ == "__main__": main()
