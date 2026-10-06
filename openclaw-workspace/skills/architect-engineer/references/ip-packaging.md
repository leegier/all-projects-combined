# IP Packaging — Reference Guide

Abstracting internal systems into sellable products: documentation for external users, license
structures, distribution packaging, versioning, and turning operational tools into commercial assets.

---

## TABLE OF CONTENTS
1. The IP Extraction Framework
2. Abstraction Principles
3. External Documentation Standards
4. Versioning & Release Management
5. License Selection
6. Distribution Packaging
7. Pricing Architecture for Tools
8. From Internal Tool to Product
9. Quality Bar for Commercial Products
10. Ten Life Creatives IP Pipeline

---

## 1. THE IP EXTRACTION FRAMEWORK

### What's Packageable
Internal systems become sellable products when they have:
1. **Repeatability**: The tool solves a problem that recurs for others, not just you
2. **Generalizability**: Configuration or parameterization makes it work for different businesses
3. **Completeness**: It does a full job (not just one step of a larger workflow)
4. **Documentability**: You can explain how to use it without a 2-hour call

### The IP Audit Process
For every internal tool, ask:
```
1. What problem does this solve?
   → If it's a specific, named problem that others Google for → extractable

2. How much of this is company-specific?
   → If <30% of the logic is specific to us → packageable
   → If >70% is specific to us → probably not worth packaging

3. Who else has this problem?
   → Identify 3 specific types of businesses who would pay for this
   → If you can't name 3 → reconsider

4. What would we charge for it?
   → Use the 10x value rule: price = 10% of the value it creates
   → If fair price is < $10 → probably not worth packaging as software
   
5. What's the support burden?
   → Would customers need hand-holding to use this?
   → If yes → add documentation until the answer is no
```

---

## 2. ABSTRACTION PRINCIPLES

### The Configuration-First Pattern
```python
# INTERNAL (not packageable):
# All company-specific values hardcoded

STRIPE_KEY = "sk_live_ourkey"
OWNER_EMAIL = "josh@tenlifecreatives.com"
REPORT_TITLE = "Ten Life Creatives Daily Revenue"
PRODUCTS = ['FamliClaw', 'Legacy Letters', 'Scripture Cards']

# PACKAGED (abstractable):
# All specifics in config, loaded from environment or config file

class Config:
    stripe_key: str           # User provides their own
    owner_email: str          # User sets their email
    report_title: str         # User sets their title
    products: List[str]       # User defines their products
    currency: str = 'USD'
    timezone: str = 'UTC'
    report_format: str = 'pdf'
```

### The Plugin Architecture Pattern
```python
# Allow customers to extend behavior without modifying core code

class ReportPlugin(ABC):
    """Base class for report customization plugins."""
    
    @abstractmethod
    def get_title(self) -> str: ...
    
    @abstractmethod
    def get_data_sources(self) -> List[DataSource]: ...
    
    @abstractmethod
    def get_metrics(self, transactions: List[Transaction]) -> Dict: ...
    
    def get_template(self) -> str:
        """Override to use custom report template."""
        return 'default'

# User implements their own plugin:
class MyBusinessReportPlugin(ReportPlugin):
    def get_title(self): return "My Business Daily Summary"
    def get_data_sources(self): return [StripeSource(os.environ['STRIPE_KEY'])]
    def get_metrics(self, txns): return calculate_my_metrics(txns)
```

### Removing Hard Dependencies
```python
# BEFORE (internal tool):
from internal.airtable_client import OurAirtableClient
from internal.sendgrid import send_josh_email

# AFTER (packageable):
# Use standard interfaces that users can implement
from typing import Protocol

class RecordStorage(Protocol):
    """Any storage backend: Airtable, SQLite, CSV, whatever."""
    def save(self, data: dict) -> str: ...
    def find(self, query: dict) -> List[dict]: ...

class EmailSender(Protocol):
    """Any email backend: SendGrid, Mailchimp, SMTP, whatever."""
    def send(self, to: str, subject: str, body: str) -> bool: ...
```

---

## 3. EXTERNAL DOCUMENTATION STANDARDS

### The Three-Tier Documentation Structure
```
Tier 1: README (5-minute onramp)
  - What it does (1 sentence)
  - Quick start (5 commands, working in 5 min)
  - Key concepts (3-5 bullets)

Tier 2: User Guide (30-minute mastery)
  - Installation (all platforms)
  - Configuration (every option explained)
  - Usage examples (real use cases, not toy examples)
  - Troubleshooting (10 most common issues)

Tier 3: Reference (look things up)
  - Complete API/CLI reference
  - All configuration options
  - Architecture explanation (for integrators)
  - Changelog
```

### README Template for Commercial Products
```markdown
# ProductName — [Tagline]

**What it does:** [One sentence. Outcome-focused.]

**Who it's for:** [Specific audience — "Gumroad sellers with 3+ products" not "online sellers"]

**Why it matters:** [The pain it eliminates. Be specific.]

---

## See It In Action

[GIF or screenshot of output — visual proof it works]

---

## Installation

```bash
pip install productname
```

Takes < 2 minutes. Works on Mac, Windows, Linux.

---

## 5-Minute Quick Start

```bash
# Step 1: Create config file
productname init

# Step 2: Add your API keys
# Edit the generated config.yaml

# Step 3: Run
productname run

# See your report at: output/report.pdf
```

---

## What You'll Get

[Screenshot or description of exact output]

---

## Configuration

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `stripe_key` | Yes | — | Your Stripe secret key |
| `report_format` | No | `pdf` | Output format: pdf, html, csv |
| `timezone` | No | `UTC` | Your timezone (America/Denver, etc.) |

Full configuration reference → [docs link]

---

## Troubleshooting

**"API key invalid"** → Make sure you're using the secret key (starts with `sk_`), not the publishable key

**"No transactions found"** → Check your date range. Default is yesterday UTC.

**"PDF not opening"** → Requires a PDF viewer. Download Adobe Reader or use Preview on Mac.

---

## Support

- Email: support@company.com (responds within 24 hours)
- Issues: github.com/company/productname/issues
- Docs: docs.company.com/productname
```

---

## 4. VERSIONING & RELEASE MANAGEMENT

### Semantic Versioning (SemVer)
```
MAJOR.MINOR.PATCH

MAJOR: Breaking change (existing configs/integrations won't work without updates)
MINOR: New feature (backward compatible — existing users unaffected)  
PATCH: Bug fix (backward compatible — safe to auto-update)

Examples:
  1.0.0 → Initial release
  1.0.1 → Fixed bug where report failed on December 31st
  1.1.0 → Added CSV export format (new feature)
  2.0.0 → Changed config file format (breaking — requires migration)
```

### CHANGELOG Format
```markdown
# Changelog

All notable changes to this project will be documented in this file.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

## [Unreleased]

## [1.2.0] — 2024-01-15

### Added
- CSV export format in addition to PDF
- Configurable date range via CLI flags
- Support for multiple Stripe accounts

### Changed
- Report generation is now 40% faster due to parallel API fetching
- Default timezone changed from UTC to system timezone

### Fixed
- Report failed when transaction currency was not USD
- Duplicate transactions when Stripe and Gumroad had overlapping products

### Deprecated
- `--format text` flag will be removed in v2.0.0. Use `--format csv` instead.

## [1.1.0] — 2024-01-01

### Added
- Email delivery with configurable recipient
...
```

### Version Bump Script
```python
import re
from pathlib import Path

def bump_version(file_path: Path, bump_type: str) -> str:
    """Bump version in a Python file. bump_type: major|minor|patch"""
    content = file_path.read_text()
    match = re.search(r'__version__\s*=\s*["\'](\d+)\.(\d+)\.(\d+)["\']', content)
    if not match:
        raise ValueError("No version string found")
    
    major, minor, patch = int(match.group(1)), int(match.group(2)), int(match.group(3))
    
    if bump_type == 'major':
        major, minor, patch = major + 1, 0, 0
    elif bump_type == 'minor':
        minor, patch = minor + 1, 0
    elif bump_type == 'patch':
        patch += 1
    
    new_version = f'{major}.{minor}.{patch}'
    new_content = re.sub(
        r'(__version__\s*=\s*["\'])(\d+\.\d+\.\d+)(["\'])',
        f'\\g<1>{new_version}\\3',
        content
    )
    file_path.write_text(new_content)
    return new_version
```

---

## 5. LICENSE SELECTION

### License Options for Ten Life Creatives Products

**For commercial tools and paid products:**
```
Proprietary / Commercial License:
  - Users purchase a license to use the software
  - No redistribution, no open-sourcing, no resale
  - Standard for SaaS tools and commercial software packages
  
Template:
  Copyright (C) 2024 Ten Life Creatives. All rights reserved.
  
  This software is proprietary and confidential. Unauthorized copying,
  distribution, or use is strictly prohibited. Licensed users may use
  this software for their own business operations only.
  
  License key required for operation. See LICENSE.md for terms.
```

**For open-source tools and community products:**
```
MIT License (recommended for tools):
  - Free to use, modify, distribute
  - Must include copyright notice
  - No warranty
  - Best for tools, libraries, utilities
  
Apache 2.0 (recommended for larger projects):
  - Like MIT but with patent protection clause
  - Good if you want broader protection
```

---

## 6. DISTRIBUTION PACKAGING

### Python Package (PyPI)
```toml
# pyproject.toml
[build-system]
requires = ["setuptools>=68", "wheel"]
build-backend = "setuptools.backends.legacy:build"

[project]
name = "revenue-reporter"
version = "1.2.0"
description = "Daily revenue report generator for Gumroad + Stripe sellers"
readme = "README.md"
requires-python = ">=3.10"
license = {text = "Proprietary"}
authors = [{name = "Ten Life Creatives", email = "hello@tenlifecreatives.com"}]

dependencies = [
    "requests>=2.31.0",
    "reportlab>=4.0.8",
    "python-dotenv>=1.0.0",
    "click>=8.1.0",
]

[project.scripts]
revenue-reporter = "revenue_reporter.cli:main"

[project.urls]
Homepage = "https://tenlifecreatives.com/tools/revenue-reporter"
Documentation = "https://docs.tenlifecreatives.com/revenue-reporter"
```

### Standalone Executable (PyInstaller)
```bash
# Create single-file executable (no Python installation required)
pip install pyinstaller

pyinstaller \
  --onefile \
  --name revenue-reporter \
  --hidden-import=reportlab \
  --add-data "templates:templates" \
  main.py

# Output: dist/revenue-reporter (Mac/Linux) or dist/revenue-reporter.exe (Windows)
```

### ZIP Bundle (Simplest)
```python
def create_distribution_bundle(version: str) -> Path:
    """Create a ZIP bundle with all necessary files."""
    bundle_name = f"revenue-reporter-v{version}"
    bundle_dir = Path(f"dist/{bundle_name}")
    bundle_dir.mkdir(parents=True, exist_ok=True)
    
    # Copy essential files
    files_to_include = [
        'main.py', 'config.py', 'requirements.txt',
        '.env.example', 'README.md', 'LICENSE.md',
    ]
    for file in files_to_include:
        shutil.copy(file, bundle_dir / file)
    
    # Copy directories
    for dir_name in ['src', 'templates']:
        shutil.copytree(dir_name, bundle_dir / dir_name)
    
    # Create ZIP
    zip_path = Path(f"dist/{bundle_name}.zip")
    shutil.make_archive(str(zip_path.with_suffix('')), 'zip', 'dist', bundle_name)
    shutil.rmtree(bundle_dir)
    
    return zip_path
```

---

## 7. TEN LIFE CREATIVES IP PIPELINE

### Internal Tools → Product Candidates

| Internal Tool | Status | Package Potential | Why |
|---|---|---|---|
| Daily revenue report | Active | High | Every solo founder wants this |
| Gumroad product sync | Active | Medium | Useful but narrow audience |
| PDF product generator | Active | High | Universal need for KDP sellers |
| Airtable CRM integration | Active | Medium | Competitive space |
| Webhook processing pipeline | Active | High | Every SaaS builder needs this |
| Auto-publishing workflow | Active | High | Publishers want automation |

### Packaging Decision Criteria
Score each tool on (1-5 scale):
- Market size (how many people have this problem?)
- Pain level (how much do they hate the current solution?)
- Uniqueness (how different is our approach?)
- Documentation effort (how hard to explain to strangers?)
- Support burden (how often would users get stuck?)

Products with total score ≥ 18/25 → prioritize packaging.

---

## 8. QUALITY BAR FOR COMMERCIAL PRODUCTS

Before any tool ships as a commercial product:
- [ ] README passes the "stranger test" (someone unfamiliar can set up in 10 min)
- [ ] All configuration options documented with examples
- [ ] 10 most common errors have clear fix instructions
- [ ] Tests cover happy path and 5 main failure modes
- [ ] No company-specific data in the codebase
- [ ] License header in every source file
- [ ] Version number in `__version__` and pyproject.toml
- [ ] CHANGELOG.md exists and is current
- [ ] .env.example has every required variable with descriptions
- [ ] GitHub repo has description, tags, and homepage link
