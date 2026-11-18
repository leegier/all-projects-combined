# Deployment — Reference Guide

Replit deployment, environment configuration, production vs dev configs, secrets management,
health checks, rollback strategies, and monitoring setup.

---

## REPLIT DEPLOYMENT

### Replit Configuration (.replit)
```toml
# .replit
run = "python main.py"
language = "python3"
entrypoint = "main.py"

[env]
PYTHONPATH = "."
TZ = "America/Denver"

[nix]
channel = "stable-22_11"

[deployment]
run = ["sh", "-c", "python main.py"]
deploymentTarget = "cloudrun"
ignorePorts = false
```

### replit.nix (System Dependencies)
```nix
{ pkgs }: {
  deps = [
    pkgs.python311
    pkgs.python311Packages.pip
    pkgs.wkhtmltopdf          # For HTML-to-PDF
    pkgs.ghostscript           # For PDF processing
    pkgs.sqlite                # SQLite CLI tools
  ];
}
```

### Environment Variables in Replit
```
1. Go to project → Secrets (padlock icon)
2. Add each secret as key/value pair
3. Access in Python: os.environ['KEY_NAME']
4. Never put secrets in code or .replit file
5. Use .env for local dev, Replit Secrets for deployment

Required secrets for typical Ten Life app:
  STRIPE_SECRET_KEY
  GUMROAD_ACCESS_TOKEN
  SENDGRID_API_KEY
  AIRTABLE_API_KEY
  AIRTABLE_BASE_ID
  WEBHOOK_SECRET
```

### Health Check Endpoint
```python
from flask import Flask, jsonify
import time

app = Flask(__name__)
START_TIME = time.time()

@app.route('/health')
def health():
    """Health check endpoint for uptime monitoring."""
    return jsonify({
        'status': 'healthy',
        'uptime_seconds': round(time.time() - START_TIME),
        'version': '1.2.0',
        'timestamp': time.time(),
    }), 200

@app.route('/ready')
def readiness():
    """Readiness check — are all dependencies available?"""
    checks = {}
    
    # Check database
    try:
        db.execute("SELECT 1")
        checks['database'] = 'ok'
    except Exception as e:
        checks['database'] = f'error: {e}'
    
    # Check external APIs
    try:
        response = requests.get('https://api.gumroad.com/v2/products',
                                headers={'Authorization': f'Bearer {GUMROAD_KEY}'},
                                timeout=5)
        checks['gumroad_api'] = 'ok' if response.status_code in (200, 401) else f'error: {response.status_code}'
    except Exception as e:
        checks['gumroad_api'] = f'error: {e}'
    
    all_ok = all(v == 'ok' for v in checks.values())
    status_code = 200 if all_ok else 503
    
    return jsonify({'status': 'ready' if all_ok else 'not_ready', 'checks': checks}), status_code
```

---

## ENVIRONMENT CONFIGURATION

### The Three Environments
```python
import os

ENVIRONMENT = os.getenv('ENVIRONMENT', 'development')

# Environment-specific behavior
if ENVIRONMENT == 'production':
    LOG_LEVEL = 'INFO'
    DEBUG = False
    STRIPE_KEY = os.environ['STRIPE_SECRET_KEY']  # Live key
    WEBHOOK_VALIDATION = True
    
elif ENVIRONMENT == 'staging':
    LOG_LEVEL = 'DEBUG'
    DEBUG = True
    STRIPE_KEY = os.environ['STRIPE_TEST_KEY']     # Test key
    WEBHOOK_VALIDATION = True

else:  # development
    LOG_LEVEL = 'DEBUG'
    DEBUG = True
    STRIPE_KEY = os.getenv('STRIPE_TEST_KEY', 'sk_test_fake')
    WEBHOOK_VALIDATION = False  # Skip webhook validation locally
```

### .env.example Template
```bash
# Copy this to .env and fill in values
# NEVER commit .env to git

# Required
STRIPE_SECRET_KEY=sk_live_xxxxx
GUMROAD_ACCESS_TOKEN=xxxxxxxx
SENDGRID_API_KEY=SG.xxxxxxxxxx
AIRTABLE_API_KEY=patxxxxxxxx.xxxxx
AIRTABLE_BASE_ID=appxxxxxxxx

# Optional
ENVIRONMENT=production
LOG_LEVEL=INFO
WEBHOOK_SECRET=your_webhook_secret
ALERT_EMAIL=alerts@yourcompany.com
BATCH_SIZE=100
TIMEZONE=America/Denver
```

---

## SECRETS MANAGEMENT

### Never-In-Code Rules
```python
# WRONG — never do this
STRIPE_KEY = "sk_live_abc123xyz"

# WRONG — even as "default"
STRIPE_KEY = os.getenv('STRIPE_KEY', 'sk_live_abc123xyz')

# RIGHT — fail loudly if missing
STRIPE_KEY = os.environ['STRIPE_KEY']  # Raises KeyError if not set

# RIGHT — optional with safe default
NOTIFICATION_EMAIL = os.getenv('NOTIFICATION_EMAIL')  # None if not set
```

### Scanning for Leaked Secrets
```bash
# Before committing, scan for potential secrets
git diff HEAD | grep -i -E "(api.?key|secret|password|token|auth)\s*=\s*['\"][^'\"]{8,}"

# Better: install git-secrets
brew install git-secrets
git secrets --install
git secrets --register-aws

# Or use truffleHog
pip install trufflehog
trufflehog git file://. --only-verified
```

---

## ROLLBACK STRATEGY

### Code Rollback
```bash
# Tag before deploying
git tag -a v1.2.0-pre-deploy -m "Before deploying pdf-export feature"
git push origin v1.2.0-pre-deploy

# If deployment fails: rollback to tag
git checkout v1.1.5
# Redeploy the checked-out version

# Find last known-good commit
git log --oneline -20
git checkout abc1234  # Specific commit
```

### Data Rollback
```python
# Always backup before data migrations
def migrate_add_category_field():
    """Migration: add 'category' field to products table."""
    
    # 1. Backup first
    backup_path = backup_sqlite_db(DB_PATH, BACKUP_DIR)
    logger.info(f"Backup created: {backup_path}")
    
    try:
        # 2. Run migration
        with db.transaction() as conn:
            conn.execute("ALTER TABLE products ADD COLUMN category TEXT")
        logger.info("Migration complete")
    
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        logger.info(f"Rollback: restore from {backup_path}")
        # Restore from backup
        restore_sqlite_backup(backup_path, DB_PATH)
        raise
```

---

## DEPLOYMENT CHECKLIST

Before deploying any update:
- [ ] Tests passing locally
- [ ] No secrets in committed code
- [ ] .env.example updated if new env vars added
- [ ] Database migrations included (if needed)
- [ ] Backup taken of production database
- [ ] Version tag created in git
- [ ] README updated if behavior changed
- [ ] Health check endpoint verified working locally
- [ ] Rollback procedure documented for this deploy

After deploying:
- [ ] Health endpoint returns 200
- [ ] Log output looks normal (no errors)
- [ ] Spot-check key functionality
- [ ] Monitor for 15 minutes post-deploy
