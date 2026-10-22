# Vulnerability Report Template

Use this as the base when drafting reports. The `report` command generates this automatically.

---

## [SEVERITY] — [VULNERABILITY TYPE] in [COMPONENT]

**Target:** program-name.com
**Severity:** High (CVSS 7.4)
**Date:** YYYY-MM-DD

### Summary

One-sentence description of what the vulnerability is and what it allows.

### Steps to Reproduce

1. Log in as a normal user at https://target.com/login
2. Navigate to /profile/edit
3. In the "bio" field, enter: `<script>alert(document.cookie)</script>`
4. Save and visit /profile/YOUR_USERNAME
5. JavaScript executes — cookie is accessible to attacker

### Impact

Describe the real-world impact. Be specific:
- "An attacker can steal session cookies from any user who views the victim's profile, allowing full account takeover."
- NOT: "This is bad and could cause issues."

### Proof of Concept

Include a screenshot or video if possible. Paste any relevant requests/responses.

### Remediation

Specific fix recommendation:
- "Sanitize bio field output using `htmlspecialchars()` before rendering."
- "Implement a Content Security Policy header."

### References

- https://owasp.org/www-community/attacks/xss/
- CWE-79: Improper Neutralization of Input During Web Page Generation

---

## Writing Tips

- **Be specific** — include exact URLs, parameters, payloads
- **Show impact** — "can steal cookies" beats "executes JavaScript"
- **Be professional** — no "lol easy bug" energy
- **No speculation** — only claim what you can prove with your PoC
- **Short is fine** — 200 words + clear steps + screenshot beats 1000 words
