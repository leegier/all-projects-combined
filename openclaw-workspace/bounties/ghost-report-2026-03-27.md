# GHOST Bounty Hunt Report — 2026-03-27

**Agent:** GHOST  
**Scan Time:** 2026-03-27 08:53 CDT  
**Sources Scanned:** GitHub API (label:bounty, state:open), Algora.io  

---

## Summary

Found **5 open bounties** posted within the last 24 hours, all from the `claude-builders-bounty` repo, powered by Opire. All are under $300, all opened 2026-03-27T00:55Z. Total potential: **$575**.

Algora.io returned mostly marketing content — requires JavaScript rendering to expose individual bounties. No actionable leads from that source today.

---

## All Bounties Found

| # | Title | $ | Tech | Comments | Build Time | URL |
|---|-------|---|------|----------|------------|-----|
| 1 | CHANGELOG: Generate from git history | $50 | Bash/Python/SKILL.md | 28 | ~45 min | https://github.com/claude-builders-bounty/claude-builders-bounty/issues/1 |
| 2 | TEMPLATE: CLAUDE.md for Next.js + SQLite SaaS | $75 | Documentation | 23 | ~45 min | https://github.com/claude-builders-bounty/claude-builders-bounty/issues/2 |
| 3 | HOOK: Pre-tool-use hook blocking destructive commands | $100 | Python/Bash | 32 | ~90 min | https://github.com/claude-builders-bounty/claude-builders-bounty/issues/3 |
| 4 | AGENT: Claude Code PR review sub-agent | $150 | Python/JS CLI | 26 | ~2 hr | https://github.com/claude-builders-bounty/claude-builders-bounty/issues/4 |
| 5 | WORKFLOW: n8n + Claude Code weekly dev summary | $200 | n8n JSON/workflow | 25 | ~3 hr | https://github.com/claude-builders-bounty/claude-builders-bounty/issues/5 |

⚠️ **Claimant Note:** All issues have 23–32 comments, suggesting heavy interest. Opire bounties are won by best submission on merge, not first-claim. Quality > speed.

---

## TOP 3 Opportunities Ranked

### 🥇 #1 — $50 | CHANGELOG Generator
**URL:** https://github.com/claude-builders-bounty/claude-builders-bounty/issues/1  
**Why:** Pure bash/Python + SKILL.md. Zero dependencies. Completely buildable in 45 min. Best submission wins — most people will phone it in with a simple `git log` one-liner.  
**Edge:** A well-structured Python script with smart commit categorization + Claude Code SKILL.md = premium submission.  
**Action:** ✅ **FULL SOLUTION WRITTEN BELOW**

---

### 🥈 #2 — $75 | CLAUDE.md Template for Next.js + SQLite
**URL:** https://github.com/claude-builders-bounty/claude-builders-bounty/issues/2  
**Why:** Pure documentation. No runtime, no tests. Just opinionated writing. MAX can produce a world-class CLAUDE.md in 30 minutes.  
**Acceptance criteria:** Covers project structure, naming conventions, DB migration rules, dev commands, anti-patterns. Must be opinionated (not generic).  
**Action:** Queue for next session. Write it and submit PR.

---

### 🥉 #3 — $100 | Pre-tool-use Hook (Safety Filter)
**URL:** https://github.com/claude-builders-bounty/claude-builders-bounty/issues/3  
**Why:** Small Python script. Blocks `rm -rf`, `DROP TABLE`, `git push --force`, `TRUNCATE`, `DELETE FROM` without WHERE. Logs to `~/.claude/hooks/blocked.log`.  
**Acceptance criteria:** Follows Claude Code hooks format, clear error message, README in 2 commands.  
**Action:** Queue for next session. 90 min build.

---

## ✅ COMPLETE SOLUTION: Bounty #1 — $50 CHANGELOG Generator

**Issue:** https://github.com/claude-builders-bounty/claude-builders-bounty/issues/1  
**Payout:** $50 via Opire  
**Claim step:** Comment `/opire try` on the issue, then submit PR.

---

### File: `changelog.sh` (bash wrapper)

```bash
#!/usr/bin/env bash
# changelog.sh — Generate CHANGELOG.md from git history
# Usage: bash changelog.sh [since-tag]

set -e

PYTHON=$(which python3 2>/dev/null || which python 2>/dev/null)
if [ -z "$PYTHON" ]; then
  echo "Error: Python 3 required" >&2
  exit 1
fi

"$PYTHON" "$(dirname "$0")/generate_changelog.py" "$@"
```

---

### File: `generate_changelog.py` (main script)

```python
#!/usr/bin/env python3
"""
generate_changelog.py — Generate a structured CHANGELOG.md from git history.

Usage:
    python generate_changelog.py              # since last tag
    python generate_changelog.py v1.2.0       # since specific tag
    python generate_changelog.py v1.2.0 v1.3.0  # between two tags

Output: CHANGELOG.md in current directory
"""

import subprocess
import sys
import re
from datetime import datetime
from pathlib import Path


# ─── Category rules ────────────────────────────────────────────────────────────
# Matches against commit message prefix (conventional commits) or keywords

CATEGORY_RULES = [
    ("Added",   [r"^feat", r"^add", r"^new", r"\badd\b", r"\bnew feature\b"]),
    ("Fixed",   [r"^fix", r"^bug", r"^hotfix", r"^patch", r"\bfix\b", r"\bbug\b"]),
    ("Changed", [r"^refactor", r"^perf", r"^update", r"^change", r"^improve",
                 r"^style", r"^chore", r"\bupdate\b", r"\bimprove\b", r"\brefactor\b"]),
    ("Removed", [r"^remove", r"^delete", r"^deprecate", r"\bremove\b", r"\bdelete\b",
                 r"\bdeprecate\b"]),
]


def run(cmd: list[str]) -> str:
    result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return result.stdout.strip()


def get_last_tag() -> str | None:
    try:
        return run(["git", "describe", "--tags", "--abbrev=0"])
    except subprocess.CalledProcessError:
        return None


def get_commits(since: str | None, until: str | None = None) -> list[dict]:
    """Fetch commits between two refs (or since beginning)."""
    fmt = "%H\x1F%s\x1F%an\x1F%ad"
    date_fmt = "--date=short"

    if since and until:
        range_spec = f"{since}..{until}"
    elif since:
        range_spec = f"{since}..HEAD"
    else:
        range_spec = "HEAD"

    log_cmd = ["git", "log", range_spec, f"--format={fmt}", date_fmt]
    try:
        output = run(log_cmd)
    except subprocess.CalledProcessError:
        return []

    if not output:
        return []

    commits = []
    for line in output.splitlines():
        parts = line.split("\x1F")
        if len(parts) == 4:
            sha, subject, author, date = parts
            commits.append({
                "sha": sha[:8],
                "subject": subject.strip(),
                "author": author.strip(),
                "date": date.strip(),
            })
    return commits


def categorize(subject: str) -> str:
    """Classify a commit subject into Added/Fixed/Changed/Removed."""
    lower = subject.lower()
    for category, patterns in CATEGORY_RULES:
        for pattern in patterns:
            if re.search(pattern, lower):
                return category
    return "Changed"  # default bucket


def format_entry(commit: dict) -> str:
    """Format a single commit as a CHANGELOG bullet."""
    # Strip conventional commit prefix: feat(scope): message → message
    subject = re.sub(r"^[a-z]+(\([^)]+\))?:\s*", "", commit["subject"], flags=re.IGNORECASE)
    subject = subject[0].upper() + subject[1:] if subject else commit["subject"]
    return f"- {subject} ([`{commit['sha']}`])"


def generate_changelog(since_tag: str | None, until_tag: str | None = None) -> str:
    commits = get_commits(since_tag, until_tag)

    if not commits:
        return "No commits found in the specified range.\n"

    # Bucket commits
    buckets: dict[str, list[str]] = {"Added": [], "Fixed": [], "Changed": [], "Removed": []}
    for commit in commits:
        category = categorize(commit["subject"])
        buckets[category].append(format_entry(commit))

    # Determine version header
    today = datetime.now().strftime("%Y-%m-%d")
    if until_tag:
        version_header = f"## [{until_tag}] — {today}"
    else:
        version_header = f"## [Unreleased] — {today}"
        if since_tag:
            version_header += f"\n\n> Changes since `{since_tag}`"

    lines = [version_header, ""]

    for section in ["Added", "Fixed", "Changed", "Removed"]:
        entries = buckets[section]
        if entries:
            lines.append(f"### {section}")
            lines.extend(entries)
            lines.append("")

    return "\n".join(lines)


def load_existing_changelog(path: Path) -> str:
    """Load existing CHANGELOG.md content below the first ## header (if any)."""
    if not path.exists():
        return ""
    content = path.read_text(encoding="utf-8")
    # Find first ## section — preserve everything from the second one onward
    parts = re.split(r"\n(?=## )", content, maxsplit=1)
    if len(parts) > 1:
        return "\n" + parts[1]
    return ""


def main():
    args = sys.argv[1:]
    since_tag = None
    until_tag = None

    if len(args) == 0:
        since_tag = get_last_tag()
        if since_tag:
            print(f"📌 Generating changelog since last tag: {since_tag}")
        else:
            print("📌 No tags found — generating changelog for entire history")
    elif len(args) == 1:
        since_tag = args[0]
        print(f"📌 Generating changelog since: {since_tag}")
    elif len(args) == 2:
        since_tag, until_tag = args
        print(f"📌 Generating changelog from {since_tag} to {until_tag}")
    else:
        print("Usage: python generate_changelog.py [since-tag] [until-tag]")
        sys.exit(1)

    new_section = generate_changelog(since_tag, until_tag)

    output_path = Path("CHANGELOG.md")
    existing = load_existing_changelog(output_path)

    header = "# Changelog\n\nAll notable changes to this project will be documented here.\n\n"
    full_content = header + new_section + existing

    output_path.write_text(full_content, encoding="utf-8")
    print(f"✅ CHANGELOG.md written ({len(new_section.splitlines())} lines in new section)")
    print(f"📄 Output: {output_path.resolve()}")


if __name__ == "__main__":
    main()
```

---

### File: `SKILL.md` (Claude Code skill for `/generate-changelog`)

```markdown
# generate-changelog

Generate a structured `CHANGELOG.md` from this project's git history.

## Trigger

User says: `/generate-changelog`, "generate changelog", "update changelog", or "create changelog"

## Steps

1. Check if `generate_changelog.py` exists in the repo root. If not, write it from the template in this skill.
2. Run: `python generate_changelog.py` (no args = auto-detects last git tag)
3. Show the user the new CHANGELOG.md section.
4. Ask if they want to commit it: `git add CHANGELOG.md && git commit -m "docs: update CHANGELOG"`

## Optional Args

- `/generate-changelog v1.2.0` — since a specific tag
- `/generate-changelog v1.2.0 v1.3.0` — between two tags

## What it does

- Fetches commits since last `git tag` (or full history if no tags)
- Auto-categorizes into: **Added** / **Fixed** / **Changed** / **Removed**
- Uses conventional commit prefixes (`feat:`, `fix:`, `refactor:`, etc.)
- Falls back to keyword matching for non-conventional commits
- Prepends new section to existing CHANGELOG.md (preserves history)
- Outputs formatted Markdown per Keep a Changelog spec

## Dependencies

- Python 3.8+
- Git (must be run inside a git repo)
```

---

### File: `README.md`

```markdown
# generate-changelog

Auto-generate a structured `CHANGELOG.md` from your git history in seconds.

## Setup

```bash
# 1. Clone or copy the script
git clone https://github.com/YOUR_USERNAME/generate-changelog

# 2. Run it in your project
python generate_changelog.py
```

That's it. Output is written to `CHANGELOG.md`.

## Usage

```bash
# Since last git tag (default)
python generate_changelog.py

# Since a specific tag
python generate_changelog.py v1.2.0

# Between two tags
python generate_changelog.py v1.2.0 v1.3.0

# Or use the bash wrapper
bash changelog.sh
```

## Output Format

Follows [Keep a Changelog](https://keepachangelog.com) spec:

```markdown
# Changelog

## [Unreleased] — 2026-03-27

> Changes since `v1.2.0`

### Added
- New user authentication flow

### Fixed
- Null pointer in payment module

### Changed
- Improved database query performance
```

## How it categorizes commits

| Prefix/Keyword | Category |
|---|---|
| `feat:`, `add`, `new` | Added |
| `fix:`, `bug:`, `hotfix:` | Fixed |
| `refactor:`, `perf:`, `update:`, `chore:` | Changed |
| `remove:`, `delete:`, `deprecate:` | Removed |

Supports [Conventional Commits](https://conventionalcommits.org) natively.
Falls back to keyword matching for non-conventional repos.

## Requirements

- Python 3.8+
- Git
```

---

## Claim Instructions

1. Fork `claude-builders-bounty/claude-builders-bounty`
2. Comment `/opire try` on Issue #1: https://github.com/claude-builders-bounty/claude-builders-bounty/issues/1
3. Create branch `feat/changelog-skill`
4. Add files: `generate_changelog.py`, `changelog.sh`, `SKILL.md`, `README.md`
5. Include sample output in the PR description (run on a real repo)
6. Submit PR → payment auto-releases on merge via Opire

---

## Notes for Lee

- All 5 bounties are from ONE repo posted today. Legit Opire-powered bounties.
- High comment counts = competition but Opire pays best PR, not first comment.
- The $75 CLAUDE.md template (#2) is also a slam dunk — pure writing, no code.
- The $100 Python hook (#3) is also straightforward — small script.
- Recommend submitting #1, #2, and #3 all this session. Total potential: **$225**.
- Need Lee's GitHub account (daddy-gier) credentials or a fork workflow to submit PRs.
- Payment via Opire → needs Opire account linked to GitHub.

**Total bounties in range:** $575  
**Buildable under 2hr:** $225 (#1 + #2 + #3)  
**Easiest win:** #1 at $50 (solution complete above)
