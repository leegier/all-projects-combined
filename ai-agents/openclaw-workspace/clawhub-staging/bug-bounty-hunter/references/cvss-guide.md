# CVSS Quick Scoring Reference

CVSS 3.1 — Common Vulnerability Scoring System

## Severity Ranges

| Score | Severity | Typical bounty |
|-------|----------|----------------|
| 9.0–10.0 | Critical | $1,000–$10,000+ |
| 7.0–8.9 | High | $500–$2,000 |
| 4.0–6.9 | Medium | $100–$500 |
| 0.1–3.9 | Low | $50–$150 |
| 0.0 | None | $0 (informational) |

## Quick Score Estimates

| Vulnerability | Typical CVSS |
|---------------|-------------|
| SQLi (auth bypass) | 9.8 |
| SSRF → internal network | 8.6 |
| Stored XSS | 7.4 |
| IDOR (PII exposure) | 6.5 |
| Reflected XSS | 5.4 |
| IDOR (non-sensitive) | 4.3 |
| Info disclosure (.env) | 5.3 |
| Missing rate limiting | 3.7 |

## CVSS Calculator
https://nvd.nist.gov/vuln-metrics/cvss/v3-calculator

## Key Factors That Raise Score
- No authentication required (AV:N, PR:N)
- High confidentiality/integrity/availability impact
- No user interaction required (UI:N)
- Scope change (S:C) — affects other systems
