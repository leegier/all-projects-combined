#!/usr/bin/env python3
"""
deploy.py — Web deployment CLI wrapper for Netlify, Vercel, Railway, Fly.io.
Requires platform CLIs to be installed (see SKILL.md).
"""
import argparse
import subprocess
import sys
import os
from pathlib import Path

def run(cmd, cwd=None):
    print(f"  $ {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=cwd, capture_output=False, text=True)
    return result.returncode

def check_cli(name, test_cmd):
    result = subprocess.run(test_cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"ERROR: {name} CLI not found. Install with:")
        installs = {
            "netlify": "npm install -g netlify-cli",
            "vercel": "npm install -g vercel",
            "railway": "npm install -g @railway/cli",
            "fly": "curl -L https://fly.io/install.sh | sh",
        }
        print(f"  {installs.get(name, 'see platform docs')}")
        sys.exit(1)

def cmd_netlify(args):
    check_cli("netlify", ["netlify", "--version"])
    deploy_dir = args.dir or "."

    if args.build_cmd:
        print(f"Building: {args.build_cmd}")
        code = run(args.build_cmd.split(), cwd=deploy_dir)
        if code != 0:
            print("Build failed.")
            sys.exit(1)

    publish = args.publish_dir or deploy_dir
    cmd = ["netlify", "deploy", "--dir", publish, "--prod"]
    if args.site_name:
        cmd += ["--site", args.site_name]

    print(f"\nDeploying to Netlify ({publish})...")
    code = run(cmd, cwd=deploy_dir)
    if code == 0:
        print("\n[OK] Deployed to Netlify.")
    else:
        print("\nDeploy failed. Check netlify login status: netlify status")

def cmd_vercel(args):
    check_cli("vercel", ["vercel", "--version"])
    deploy_dir = args.dir or "."
    cmd = ["vercel"]
    if args.prod:
        cmd.append("--prod")
    print(f"\nDeploying to Vercel ({deploy_dir})...")
    code = run(cmd, cwd=deploy_dir)
    if code == 0:
        print("\n[OK] Deployed to Vercel.")

def cmd_fly(args):
    check_cli("fly", ["fly", "version"])
    deploy_dir = args.dir or "."
    fly_toml = Path(deploy_dir) / "fly.toml"
    if not fly_toml.exists():
        print("ERROR: fly.toml not found in project directory.")
        print("Run: fly launch (first time) or ensure fly.toml exists")
        sys.exit(1)
    cmd = ["fly", "deploy"]
    if args.app_name:
        cmd += ["--app", args.app_name]
    print(f"\nDeploying to Fly.io ({deploy_dir})...")
    code = run(cmd, cwd=deploy_dir)
    if code == 0:
        print("\n[OK] Deployed to Fly.io.")

def cmd_railway(args):
    check_cli("railway", ["railway", "--version"])
    deploy_dir = args.dir or "."
    print(f"\nDeploying to Railway ({deploy_dir})...")
    code = run(["railway", "up"], cwd=deploy_dir)
    if code == 0:
        print("\n[OK] Deployed to Railway.")

def cmd_status(args):
    platform = args.platform
    if platform == "netlify":
        check_cli("netlify", ["netlify", "--version"])
        cmd = ["netlify", "status"]
        if args.site:
            cmd += ["--site", args.site]
        run(cmd)
    elif platform == "vercel":
        check_cli("vercel", ["vercel", "--version"])
        run(["vercel", "ls"])
    elif platform == "fly":
        check_cli("fly", ["fly", "version"])
        run(["fly", "status"])
    elif platform == "railway":
        check_cli("railway", ["railway", "--version"])
        run(["railway", "status"])

def main():
    p = argparse.ArgumentParser(description="Web deployment CLI wrapper")
    sub = p.add_subparsers(dest="command")

    nl = sub.add_parser("netlify")
    nl.add_argument("--dir", default=".")
    nl.add_argument("--site-name")
    nl.add_argument("--build-cmd")
    nl.add_argument("--publish-dir")

    vc = sub.add_parser("vercel")
    vc.add_argument("--dir", default=".")
    vc.add_argument("--prod", action="store_true")

    fl = sub.add_parser("fly")
    fl.add_argument("--dir", default=".")
    fl.add_argument("--app-name")

    rw = sub.add_parser("railway")
    rw.add_argument("--dir", default=".")

    st = sub.add_parser("status")
    st.add_argument("--platform", required=True, choices=["netlify", "vercel", "fly", "railway"])
    st.add_argument("--site")

    args = p.parse_args()
    dispatch = {
        "netlify": cmd_netlify, "vercel": cmd_vercel,
        "fly": cmd_fly, "railway": cmd_railway, "status": cmd_status,
    }
    if args.command in dispatch:
        dispatch[args.command](args)
    else:
        p.print_help()

if __name__ == "__main__":
    main()
