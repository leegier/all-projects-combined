---
name: ci-cd-helper
description: Generate GitHub Actions workflow YAML files, trigger pipeline runs, and monitor CI/CD status via the GitHub API. Use when setting up automated testing, build, or deployment pipelines, creating a GitHub Actions workflow, checking pipeline status, or cancelling a failed run. Triggers on: "set up GitHub Actions", "create a CI pipeline", "add automated tests", "GitHub Actions workflow", "check pipeline status", "trigger a build", "CI/CD", or any continuous integration task.
---

# ci-cd-helper

Generate and manage GitHub Actions CI/CD pipelines.

## Generate Workflow Files

```bash
python scripts/cicd.py generate \
  --type unity-build \
  --output ".github/workflows/unity-build.yml"

python scripts/cicd.py generate \
  --type node-test \
  --output ".github/workflows/test.yml"

python scripts/cicd.py generate \
  --type python-test \
  --output ".github/workflows/test.yml"

python scripts/cicd.py generate \
  --type deploy-netlify \
  --output ".github/workflows/deploy.yml"
```

## Available Templates

| Type | What it does |
|------|-------------|
| `unity-build` | Build Unity project on push to main |
| `node-test` | npm install + test on PR |
| `python-test` | pip install + pytest on PR |
| `deploy-netlify` | Deploy to Netlify on push to main |
| `deploy-vercel` | Deploy to Vercel on push to main |
| `release-tag` | Create GitHub Release on version tag |

## Trigger a Workflow Run

```bash
python scripts/cicd.py trigger \
  --repo owner/repo \
  --workflow build.yml \
  --branch main
```

Requires `GITHUB_TOKEN` env var.

## Check Run Status

```bash
python scripts/cicd.py status --repo owner/repo --limit 5
```

## Cancel a Run

```bash
python scripts/cicd.py cancel --repo owner/repo --run-id 12345678
```
