# Documentation — Reference Guide

Technical writing, README files, inline comments, architecture docs, API documentation,
decision records, and onboarding guides. Good documentation multiplies your team's effectiveness.

---

## TABLE OF CONTENTS
1. README Structure & Standards
2. Inline Code Documentation
3. API Documentation
4. Architecture Documentation
5. Docstring Standards
6. Decision Records
7. Onboarding Guides
8. Documentation Anti-Patterns

---

## 1. README STRUCTURE & STANDARDS

### The Complete README Template
```markdown
# [Project Name]

One-sentence description of what this does and why it exists.

[![Tests](badge-url)](test-url) [![Version](badge)](releases)

---

## What This Does

2-3 sentences max. Explain:
- What problem it solves
- Who uses it
- What the output is

**Example:** This script pulls daily sales from Stripe and Gumroad, calculates revenue metrics,
generates a PDF report, and emails it to the founder every morning at 6 AM Mountain Time.

---

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/company/repo.git
cd repo
pip install -r requirements.txt

# 2. Configure
cp .env.example .env
# Edit .env with your API keys

# 3. Run
python main.py
```

Expected output:
```
[2024-01-15 06:00:01] INFO | Fetching transactions...
[2024-01-15 06:00:03] INFO | 47 transactions found
[2024-01-15 06:00:05] INFO | Report generated: reports/revenue-2024-01-15.pdf
[2024-01-15 06:00:06] INFO | Email sent to: josh@example.com
```

---

## Prerequisites

- Python 3.11+
- A Stripe account with API access
- A Gumroad account with API access  
- SendGrid account for email delivery

---

## Installation

```bash
pip install -r requirements.txt
```

**System dependencies** (if any):
```bash
# macOS
brew install wkhtmltopdf

# Ubuntu/Debian
apt-get install wkhtmltopdf
```

---

## Configuration

Copy `.env.example` to `.env` and fill in values:

| Variable | Required | Description | Example |
|---|---|---|---|
| `STRIPE_SECRET_KEY` | Yes | Stripe API secret key | `sk_live_...` |
| `GUMROAD_ACCESS_TOKEN` | Yes | Gumroad API token | `abc123...` |
| `SENDGRID_API_KEY` | Yes | SendGrid API key | `SG.xxx...` |
| `REPORT_RECIPIENT` | Yes | Email to send reports to | `josh@example.com` |
| `LOG_LEVEL` | No | Logging verbosity (default: INFO) | `DEBUG` |
| `BATCH_SIZE` | No | Records per API call (default: 100) | `50` |

---

## Usage

### Basic Usage
```bash
python main.py
```

### Command-Line Options
```bash
python main.py --date 2024-01-15        # Process specific date
python main.py --dry-run                 # Preview without sending
python main.py --no-email               # Generate PDF only
python main.py --verbose                 # Enable debug logging
```

### Scheduled Execution (Cron)
```bash
# Run daily at 6 AM Mountain Time
0 6 * * * /usr/bin/python3 /path/to/main.py >> /var/log/revenue-report.log 2>&1
```

---

## Project Structure

```
project/
├── README.md              # You are here
├── main.py                # Entry point
├── config.py              # Configuration loading
├── requirements.txt       # Python dependencies
├── .env.example           # Environment variable template
├── src/
│   ├── services/          # Business logic
│   │   ├── stripe_service.py
│   │   └── report_service.py
│   ├── adapters/          # External API wrappers
│   │   └── gumroad_adapter.py
│   └── utils/             # Shared utilities
│       └── logging.py
├── templates/             # Report/email templates
├── data/                  # Local data cache (gitignored)
├── reports/               # Generated reports (gitignored)
└── tests/                 # Test suite
    └── test_services.py
```

---

## How It Works

1. **Data Collection**: Pulls transactions from Stripe API and Gumroad API for the target date range
2. **Normalization**: Maps both API responses to a common `Transaction` schema
3. **Aggregation**: Calculates revenue totals, transaction counts, AOV, top products
4. **Report Generation**: Renders HTML template → converts to PDF via wkhtmltopdf
5. **Delivery**: Emails PDF as attachment via SendGrid

---

## Testing

```bash
# Run all tests
pytest tests/ -v

# Run with coverage
pytest tests/ --cov=src --cov-report=html

# Run specific test file
pytest tests/test_services.py -v
```

---

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for production deployment instructions.

---

## Troubleshooting

**"No transactions found for date"**
- Check that the date format is YYYY-MM-DD
- Verify API keys are correct and have read permissions
- Check if there were actually no transactions that day

**"PDF generation failed"**  
- Verify wkhtmltopdf is installed: `wkhtmltopdf --version`
- Check that the output directory exists and is writable

**"Email delivery failed"**
- Verify SENDGRID_API_KEY is valid
- Check SendGrid dashboard for delivery errors
- Verify sender domain is authenticated in SendGrid

---

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/my-change`
3. Make changes + add tests
4. Commit: `git commit -m "feat: description of change"`
5. Push: `git push origin feature/my-change`
6. Open a PR

---

## License

MIT — see [LICENSE](./LICENSE)
```

---

## 2. INLINE CODE DOCUMENTATION

### Comment the WHY, Not the WHAT
```python
# BAD: explains what the code does (obvious from reading it)
# Multiply price by tax rate
tax = price * 0.08

# GOOD: explains why this specific value/approach
# Colorado Springs sales tax rate as of 2024 — hardcoded because it rarely changes
# Update this if we expand to other cities: see PRICING.md for per-state rates
tax = price * 0.08

# BAD: restates the code
# Loop through products
for product in products:
    process(product)

# GOOD: explains the non-obvious requirement
# Process in creation order — downstream reports depend on chronological sequence
# Randomizing this would break the daily digest email ordering
for product in sorted(products, key=lambda p: p.created_at):
    process(product)
```

### NOTE/TODO/FIXME Convention
```python
# NOTE: Context that future maintainers will thank you for
# NOTE: Gumroad API returns prices in cents for USD but in full units for EUR — normalize before comparing

# TODO: Something that should be done, not blocking now
# TODO: Add caching here when transaction volume exceeds 1000/day

# FIXME: Known bug or issue that needs to be fixed
# FIXME: This will break on December 31st when year rolls over — see issue #89

# HACK: Temporary workaround
# HACK: Gumroad webhook sometimes sends duplicate events; deduplicate on order_id
# Remove this when Gumroad fixes their deduplication (reported 2024-01-15)

# SECURITY: Security-sensitive code that needs extra attention
# SECURITY: Do not log this value — it contains customer PII
```

### Section Headers in Long Files
```python
# ─────────────────────────────────────────────────────────────────────────────
# SECTION 1: Data Collection
# Fetches raw data from external APIs and normalizes to internal schema
# ─────────────────────────────────────────────────────────────────────────────

def fetch_stripe_transactions(...): ...
def fetch_gumroad_sales(...): ...

# ─────────────────────────────────────────────────────────────────────────────
# SECTION 2: Processing & Aggregation
# Calculates metrics from normalized transaction data
# ─────────────────────────────────────────────────────────────────────────────

def calculate_revenue_metrics(...): ...
```

---

## 3. API DOCUMENTATION

### Endpoint Documentation Template
```python
@app.route('/api/v1/products', methods=['GET'])
def list_products():
    """
    List all active products.
    
    Query Parameters:
        category (str, optional): Filter by product category
        limit (int, optional): Max records to return (default: 50, max: 200)
        page (int, optional): Page number for pagination (default: 1)
    
    Returns:
        200 OK:
            {
                "products": [
                    {
                        "id": "prod_abc123",
                        "title": "FamliClaw",
                        "price": 47.00,
                        "category": "productivity",
                        "status": "active"
                    }
                ],
                "total": 9,
                "page": 1,
                "has_more": false
            }
        400 Bad Request: Invalid query parameters
        401 Unauthorized: Missing or invalid API key
    
    Example:
        GET /api/v1/products?category=faith&limit=10
        
        Headers:
            Authorization: Bearer your-api-key
    """
    ...
```

### API Error Response Standard
```python
def api_error(message: str, code: str, status_code: int, details: dict = None) -> tuple:
    """
    Standard error response format.
    
    Always returns:
        {
            "error": {
                "code": "PRODUCT_NOT_FOUND",
                "message": "Product with ID 'xyz' was not found",
                "details": {}
            }
        }
    """
    response = {
        'error': {
            'code': code,
            'message': message,
        }
    }
    if details:
        response['error']['details'] = details
    
    return jsonify(response), status_code
```

---

## 4. DOCSTRING STANDARDS

### Google Style Docstrings (Recommended)
```python
def generate_monthly_report(
    start_date: date,
    end_date: date,
    output_dir: Path,
    include_charts: bool = True,
) -> Path:
    """Generate a PDF revenue report for the given date range.
    
    Fetches transaction data from Stripe and Gumroad, calculates revenue metrics,
    and generates a formatted PDF report. The report is saved to `output_dir`.
    
    Args:
        start_date: First day of the reporting period (inclusive).
        end_date: Last day of the reporting period (inclusive).
        output_dir: Directory where the PDF will be saved.
        include_charts: Whether to include revenue trend charts. Charts require
            matplotlib which adds ~2 seconds to generation time. Default: True.
    
    Returns:
        Path to the generated PDF file.
        
        The filename format is: `revenue-report-YYYY-MM-DD-to-YYYY-MM-DD.pdf`
    
    Raises:
        ValueError: If start_date is after end_date, or if no transactions
            are found for the specified period.
        IOError: If output_dir doesn't exist or isn't writable.
        APIError: If Stripe or Gumroad API calls fail after 3 retry attempts.
    
    Example:
        >>> report_path = generate_monthly_report(
        ...     start_date=date(2024, 1, 1),
        ...     end_date=date(2024, 1, 31),
        ...     output_dir=Path('reports/'),
        ... )
        >>> print(report_path)
        reports/revenue-report-2024-01-01-to-2024-01-31.pdf
    
    Note:
        This function makes API calls with a total timeout of ~60 seconds.
        For large date ranges (>6 months), consider using generate_chunked_report()
        which processes month-by-month to avoid timeouts.
    """
```

---

## 5. DOCUMENTATION ANTI-PATTERNS

### The Seven Deadly Documentation Sins

**1. The Stale Documentation Sin**
README says "Run `python app.py`" but the entry point was renamed to `main.py` 6 months ago.
Fix: Update docs as part of the same PR that changes the code. No exceptions.

**2. The Obvious Comment Sin**
```python
# Set x to 5
x = 5
```
Fix: Delete it. Comments that restate code add noise, not value.

**3. The Missing Example Sin**
"The function accepts a configuration object."
Fix: Show an example. Always. Even one line of example is worth three paragraphs of prose.

**4. The Inside-Out Sin**
Documentation written for someone who already knows the system.
Fix: Write for a competent stranger. What would they need to get started in 10 minutes?

**5. The Assumption Sin**
"Requires Stripe API access" — but doesn't say where to get it or what permissions are needed.
Fix: Link to setup guides. List exact permission scopes needed.

**6. The Prose Substitute Sin**
Using prose paragraphs to explain what a table would show clearly.
Fix: Use tables for structured information, bullet lists for options, code blocks for commands.

**7. The Never-Updated Architecture Diagram Sin**
Architecture diagram from 2022 that shows systems that no longer exist.
Fix: Date all diagrams. Include "Last verified: YYYY-MM-DD" at the bottom.
