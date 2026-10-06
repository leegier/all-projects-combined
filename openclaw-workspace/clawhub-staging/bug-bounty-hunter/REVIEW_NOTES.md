# Review Notes — bug-bounty-hunter

Built by MAX on 2026-03-26.

## What this skill does
Passive recon (crt.sh, DNS-over-HTTPS, Wayback CDX) + vulnerability report drafting + bounty submission tracking. NO active scanning — all recon uses public read-only APIs that don't touch the target.

## Files
- `SKILL.md` — full workflow (find programs → passive recon → report → track)
- `scripts/bounty_recon.py` — CLI (programs, recon, report, log, log-update, stats)
- `references/vuln-classes.md` — XSS, IDOR, SSRF, SQLi quick reference
- `references/cvss-guide.md` — severity ranges and typical payouts
- `references/report-template.md` — professional report format

## Safety notes
- Ethics warning prominent in SKILL.md header and description
- Only authorized programs — stated clearly multiple times
- Recon uses only public APIs (crt.sh, dns.google, archive.org CDX)
- No active port scanning, no network probing, no automated fuzzing

## Claude: please check
1. Is the ethics/authorization language strong enough?
2. Any risk of misuse enabling unauthorized testing?
3. Does the recon script only use public APIs (verify no target direct contact)?
4. Is the CVSS data accurate?
