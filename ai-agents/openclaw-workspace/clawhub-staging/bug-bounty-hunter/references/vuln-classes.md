# Vulnerability Classes — Quick Reference

## Web Application (Most Common Bounties)

### IDOR (Insecure Direct Object Reference)
- **What:** Accessing another user's data by changing an ID
- **Where to look:** `/api/users/{id}`, `/orders/{id}`, `/files/{id}`
- **Test:** Change numeric/UUID to another value — does it return another user's data?
- **Typical payout:** $100–500 (medium)

### XSS (Cross-Site Scripting)
- **Stored XSS:** User input saved to DB and rendered to other users — highest impact
- **Reflected XSS:** Input in URL reflected in response
- **Where to look:** Profile fields, comments, search params, error messages
- **Test payload:** `<script>alert(document.domain)</script>` or `"><img src=x onerror=alert(1)>`
- **Typical payout:** $50–300 reflected, $200–1000+ stored

### SSRF (Server-Side Request Forgery)
- **What:** Making the server fetch an attacker-controlled URL
- **Where to look:** URL input fields, webhook URLs, image import, PDF generators
- **Test:** Point to `http://169.254.169.254/` (AWS metadata) or `http://localhost/admin`
- **Typical payout:** $200–2000 (high if internal network access)

### SQLi (SQL Injection)
- **Where to look:** Search fields, login forms, URL parameters
- **Quick test:** `'` or `1' OR '1'='1` — look for database errors
- **Typical payout:** $500–5000 (often critical)

### Auth Bypass
- **What:** Accessing protected resources without proper authentication
- **Where to look:** Password reset flows, OAuth edge cases, JWT alg:none
- **Test:** Intercept and modify auth tokens, skip steps in multi-step flows

### Information Disclosure
- **What:** Sensitive data exposed unintentionally
- **Examples:** `.env` files, `/.git/config`, stack traces, debug endpoints, API keys in JS
- **Where to look:** Common paths (`/.git`, `/.env`, `/debug`, `/phpinfo.php`)
- **Typical payout:** $50–500

---

## Recon → Vuln Mapping

| Recon Finding | Potential Vulnerability |
|---------------|------------------------|
| Old API endpoint in Wayback | IDOR, auth bypass, deprecated auth |
| `admin` subdomain | Weak auth, info disclosure |
| AWS metadata URL accessible | SSRF → credential theft |
| `.git` directory exposed | Source code disclosure, secrets |
| Staging subdomain | Lower security controls, test data |
