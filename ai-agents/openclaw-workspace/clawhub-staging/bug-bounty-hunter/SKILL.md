---
name: bug-bounty-hunter
description: Research and report security vulnerabilities for authorized bug bounty programs on HackerOne, Bugcrowd, and Intigriti. Use when looking for open bug bounty programs, doing passive recon on a target, drafting a vulnerability report, or tracking bounty submissions and payouts. Triggers on: "find bug bounty programs", "recon this target", "draft a vuln report", "check my bounty submissions", "CVSS score this vulnerability", "passive recon", "look for XSS/IDOR/SSRF on", "bug bounty". ONLY for authorized programs — never for unauthorized testing.
---

# bug-bounty-hunter

Research and report vulnerabilities for **authorized** bug bounty programs only.

⚠️ **Ethics Rule — Non-Negotiable:** Only test targets explicitly listed in a program's scope. Never test systems without written authorization. Violating this causes legal liability and harms the security community.

---

## Workflow

1. **Find programs** → filter by payout, scope, competition
2. **Passive recon** → enumerate attack surface without touching the target
3. **Research vulnerabilities** → identify common classes for this target type
4. **Draft report** → CVSS-scored, professional format
5. **Log submission** → track in `memory/bounty-log.md`

---

## Step 1 — Find Programs

```bash
python scripts/bounty_recon.py programs --min-payout 100 --platform hackerone
python scripts/bounty_recon.py programs --min-payout 500 --type web
```

Also browse manually:
- HackerOne: https://hackerone.com/programs (filter: accepting submissions + web)
- Bugcrowd: https://bugcrowd.com/programs
- Intigriti: https://app.intigriti.com/programs

Good targets for beginners: programs with "web" scope, $100–500 payouts, low competition.

---

## Step 2 — Passive Recon (No Touching the Target)

Passive only — no active scanning, no sending requests to the target.

```bash
python scripts/bounty_recon.py recon --domain example.com
```

This script queries:
- **crt.sh** — subdomains via certificate transparency logs
- **web.archive.org** — historical URLs (may reveal old endpoints)
- **dns.google** — DNS records (A, MX, TXT, CNAME)
- **Wayback CDX API** — URL enumeration from crawl history

Output saved to `memory/recon-TARGET.md`.

---

## Step 3 — Vulnerability Research

Common vulnerability classes by target type — see `references/vuln-classes.md`.

Key checks for web targets:
- **IDOR**: Can you access other users' data by changing an ID in a URL/API?
- **XSS**: Does reflected/stored user input appear unescaped in HTML?
- **SSRF**: Can you make the server fetch an internal URL?
- **Auth bypass**: Can you skip authentication steps?
- **Exposed secrets**: Check JS files, `.env`, `.git` for leaked keys

---

## Step 4 — Draft Vulnerability Report

```bash
python scripts/bounty_recon.py report \
  --title "Stored XSS in user profile bio" \
  --cvss "7.2" \
  --severity high \
  --target "example.com" \
  --steps "1. Go to /profile/edit\n2. Enter <script>alert(1)</script> in bio\n3. Visit /profile/USERNAME" \
  --impact "Attacker can steal session cookies from any user who views the profile"
```

Output: formatted Markdown report saved to `memory/report-SLUG.md`, ready to paste into HackerOne/Bugcrowd submission form.

---

## Step 5 — Track Submissions

```bash
python scripts/bounty_recon.py log --target example.com --title "Stored XSS" --status submitted --payout 0
python scripts/bounty_recon.py log-update --title "Stored XSS" --status resolved --payout 350
python scripts/bounty_recon.py stats
```

Log stored in `memory/bounty-log.md`.

---

## References

- Vulnerability class guide: see `references/vuln-classes.md`
- CVSS scoring quick reference: see `references/cvss-guide.md`
- Report writing template: see `references/report-template.md`
