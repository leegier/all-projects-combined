# Version Control — Reference Guide

Git workflows, commit standards, branching strategies, GitHub operations, and release management.
The disciplines that keep code history clean and collaboration smooth.

---

## CORE GIT WORKFLOWS

### Daily Git Protocol
```bash
# Morning: sync with remote
git fetch origin
git status

# Before ANY work: create a branch (never work on main)
git checkout -b feature/add-pdf-export

# Work, stage, commit incrementally
git add src/pdf_generator.py    # Stage specific files
git add -p                       # Interactive staging (review each change)
git commit -m "feat: add A4 page size support to PDF generator"

# Push to remote
git push origin feature/add-pdf-export

# When done: merge back (or PR)
git checkout main
git merge --no-ff feature/add-pdf-export
git push origin main
```

### Commit Message Format (Conventional Commits)
```
<type>(<scope>): <short description>

Types:
  feat:     New feature
  fix:      Bug fix
  docs:     Documentation only
  style:    Formatting, no logic change
  refactor: Code restructure, no feature/fix
  test:     Adding or fixing tests
  chore:    Build process, dependencies, tooling

Examples:
  feat(pdf): add KDP cover generation with spine calculator
  fix(api): handle 429 rate limit errors with exponential backoff
  docs(readme): add deployment instructions for Replit
  refactor(database): extract SQLite connection into context manager
  chore(deps): upgrade reportlab to 4.0.8

Rules:
  - Present tense, imperative: "add" not "added" or "adds"
  - No period at end of subject line
  - 72 characters max for subject line
  - Add body for non-obvious changes
```

### Commit Body Format
```bash
git commit -m "fix(webhooks): resolve Gumroad signature verification failure

The webhook secret comparison was using string comparison instead of
hmac.compare_digest(), making it vulnerable to timing attacks and also
failing when the secret had trailing whitespace.

Root cause: secret loaded from .env with strip() missing.

- Add hmac.compare_digest() for timing-safe comparison  
- Add .strip() when loading WEBHOOK_SECRET from environment
- Add test case for whitespace-padded secrets

Fixes #47"
```

---

## BRANCHING STRATEGY

### Simple (Recommended for Solo/Small Teams)
```
main          ← Always deployable, protected
  └── feature/description    ← Feature branches
  └── fix/description        ← Bug fix branches
  └── chore/description      ← Maintenance
```

### Rules
1. Never commit directly to `main`
2. Branches are short-lived (days, not months)
3. Merge frequently — long-lived branches = merge hell
4. Delete branches after merging

---

## GITHUB OPERATIONS

### Common GitHub CLI Commands
```bash
# Create PR
gh pr create --title "feat: add PDF export" --body "Adds KDP-ready PDF export..." --base main

# List open PRs  
gh pr list

# View PR
gh pr view 42

# Merge PR
gh pr merge 42 --squash --delete-branch

# Create release
gh release create v1.2.0 --title "v1.2.0" --notes "Added PDF export feature"

# Clone repo
gh repo clone username/repo-name
```

### GitHub Actions Workflow (CI)
```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
          cache: 'pip'
      
      - name: Install dependencies
        run: pip install -r requirements.txt -r requirements-dev.txt
      
      - name: Run tests
        run: pytest tests/ -v --tb=short
        env:
          STRIPE_SECRET_KEY: ${{ secrets.STRIPE_TEST_KEY }}
      
      - name: Check code style
        run: |
          black --check --line-length 100 src/
          isort --check src/
```

---

## GITIGNORE PATTERNS

### Python Project .gitignore
```gitignore
# Python
__pycache__/
*.pyc
*.pyo
*.pyd
.Python
*.egg-info/
dist/
build/
.eggs/

# Virtual environments
venv/
env/
.venv/
.env/

# Environment variables — NEVER commit
.env
*.env
.env.local
.env.production

# IDE
.idea/
.vscode/
*.swp
*.swo
.DS_Store

# Data files (project-specific)
data/*.json
data/*.csv
reports/*.pdf
*.log

# Secrets
*.pem
*.key
credentials.json
service-account.json
```

---

## GIT RECOVERY OPERATIONS

### Undo Last Commit (Not Pushed Yet)
```bash
# Undo commit but keep changes staged
git reset --soft HEAD~1

# Undo commit and unstage changes (files still modified)
git reset HEAD~1

# NUCLEAR: Undo commit and discard all changes (IRREVERSIBLE)
git reset --hard HEAD~1
```

### Fix Last Commit Message
```bash
git commit --amend -m "correct message here"
# Only do this before pushing!
```

### Recover Deleted File
```bash
# Find when file was deleted
git log --all --full-history -- "path/to/deleted-file.py"

# Restore it from the commit before deletion
git checkout <commit-hash>~1 -- "path/to/deleted-file.py"
```

### Stash Uncommitted Changes
```bash
# Save current work temporarily
git stash push -m "WIP: half-done PDF feature"

# List stashes
git stash list

# Apply latest stash
git stash pop

# Apply specific stash
git stash apply stash@{2}
```

---

## TAGGING & RELEASES

```bash
# Create annotated tag (preferred for releases)
git tag -a v1.0.0 -m "Initial release: PDF generator with KDP support"
git push origin v1.0.0

# List tags
git tag -l

# Tag past commit
git tag -a v1.0.0 abc1234 -m "Tagging past commit"

# Delete tag
git tag -d v1.0.0
git push origin --delete v1.0.0
```

---

## REPOSITORY MAINTENANCE

```bash
# Check repo health
git fsck

# Clean up unreferenced objects
git gc --aggressive

# Show repo size
git count-objects -vH

# Find large files in history
git rev-list --all | xargs -l git ls-tree -r --long | sort -rnk4 | head -20
```
