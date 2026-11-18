# Bounty: Coolify OAuth-Only Registration — $50 via Algora

**Issue:** https://github.com/coollabsio/coolify/issues/8042  
**Status:** ✅ PR SUBMITTED — awaiting merge  
**Date:** 2026-03-29

---

## Summary

Implemented two new admin settings for Coolify's instance configuration:

1. **Allow OAuth2-Only Self-Registration** (`is_oauth_registration_enabled`)  
   Users can self-register via OAuth2 even when general registration is disabled.

2. **Restrict OAuth2 Users to OAuth2 Login Only** (`is_oauth_login_only`)  
   Blocks password authentication for users who registered via OAuth2 (no password set).

---

## Links

| Item | URL |
|------|-----|
| Fork | https://github.com/leegier/coolify |
| Branch | `feature/oauth-only-registration` |
| PR | https://github.com/coollabsio/coolify/pull/9283 |
| Bounty comment (/opire try) | https://github.com/coollabsio/coolify/issues/8042#issuecomment-4150960745 |

---

## Files Changed

| File | Change |
|------|--------|
| `database/migrations/2026_03_29_000001_add_oauth_registration_settings_to_instance_settings.php` | New migration — adds 2 boolean columns |
| `app/Http/Controllers/OauthController.php` | OAuth callback checks new `is_oauth_registration_enabled` flag |
| `app/Providers/FortifyServiceProvider.php` | Blocks password login for OAuth-only users; passes new settings to login view |
| `app/Livewire/Settings/Advanced.php` | New Livewire properties + rules + mount + save |
| `resources/views/livewire/settings/advanced.blade.php` | Two new admin UI checkboxes |
| `resources/views/auth/login.blade.php` | Shows OAuth-only message when applicable |
| `lang/en.json` | Added `auth.registration_oauth_only` translation |

---

## Implementation Logic

### OAuth Registration Flow
```
OAuth callback → user not found?
  → is_registration_enabled OR is_oauth_registration_enabled?
    YES → create user
    NO  → abort(403)
```

### OAuth Login-Only Flow
```
Password login → user found?
  → is_oauth_login_only AND user.password is empty?
    YES → return null (block login)
    NO  → verify password normally
```

---

## Next Steps
- Monitor PR for review/merge
- If merged: bounty paid via Algora to daddy-gier account
- If changes requested: address and push to same branch
