# Quality Standards — Reference Guide

Code review criteria, testing protocols, validation patterns, anti-patterns to avoid,
performance considerations, security basics, and maintainability rules.

---

## TABLE OF CONTENTS
1. Code Review Criteria
2. Testing Protocols
3. The Anti-Pattern Catalogue
4. Performance Standards
5. Security Checklist
6. Maintainability Rules
7. The Quality Gate
8. Automated Quality Tools

---

## 1. CODE REVIEW CRITERIA

### The Review Rubric (Pass/Fail/Improve)

**Correctness (Must Pass)**
- [ ] Does the code do what it's supposed to do?
- [ ] Edge cases handled (empty input, null, zero, overflow)?
- [ ] No off-by-one errors in loops or slices?
- [ ] All required error cases handled?

**Security (Must Pass — Any Failure = Block)**
- [ ] No hardcoded credentials, API keys, or passwords?
- [ ] All external inputs validated before use?
- [ ] SQL queries use parameterized statements (no string concatenation)?
- [ ] Sensitive data never appears in logs?
- [ ] File paths validated before opening?

**Maintainability (Must Pass)**
- [ ] Functions are single-purpose and named clearly?
- [ ] No function longer than ~50 lines (investigate, not hard rule)?
- [ ] No magic numbers — constants are named?
- [ ] No dead code (commented-out blocks, unused functions)?
- [ ] Cyclomatic complexity ≤ 10 per function?

**Reliability (Must Pass)**
- [ ] Error handling for all external calls (API, DB, file I/O)?
- [ ] Fails loudly (clear error) rather than silently (wrong result)?
- [ ] No global mutable state that could cause race conditions?
- [ ] All functions return consistent types?

**Documentation (Improve)**
- [ ] Complex logic has explanatory comments?
- [ ] Public functions have docstrings?
- [ ] Any "clever" code has a comment explaining why?

### Cyclomatic Complexity Quick Check
```python
# Cyclomatic complexity = number of decision points + 1
# Each if/elif/else/for/while/try/except adds 1

# Complexity: 1 (no branches — ideal)
def format_price(amount: float) -> str:
    return f"${amount:.2f}"

# Complexity: 4 (three branches)
def apply_discount(price: float, code: str) -> float:
    if code == 'HALF':           # +1
        return price * 0.5
    elif code == 'QUARTER':      # +1
        return price * 0.75
    elif code == 'TENOFF':       # +1
        return price - 10
    return price

# Complexity: 8+ (refactor needed — extract to lookup table)
# Too many branches in one function
def apply_discount_bad(price: float, code: str, user_type: str, is_member: bool) -> float:
    if code == 'HALF':
        if user_type == 'premium':
            if is_member:
                ...
```

---

## 2. TESTING PROTOCOLS

### Test Coverage Requirements
```
Critical paths (payment, auth, data write):  90%+ coverage required
Business logic:                              80%+ coverage required
Utilities:                                   70%+ coverage required
Configuration loading:                       100% required
```

### The Test Pyramid
```
          ┌──────────┐
          │    E2E   │  ← Few, slow, expensive. Run in CI only.
          │  Tests   │    Full workflow: purchase → confirmation email
         ─┴──────────┴─
      ┌──────────────────┐
      │ Integration Tests │  ← Some. API calls (mocked). DB operations.
      │                  │    Test that components work together.
     ─┴──────────────────┴─
   ┌──────────────────────────┐
   │      Unit Tests          │  ← Most. Fast. No external dependencies.
   │  (80% of your test suite)│    Test individual functions/methods.
   └──────────────────────────┘
```

### Unit Test Standards
```python
# Good unit test checklist:
# - Tests ONE behavior (not multiple assertions that test different things)
# - Descriptive name: test_[function]_[scenario]_[expected_result]
# - Arrange/Act/Assert structure
# - No external dependencies (mock everything external)
# - Fast: should run in <100ms

class TestCalculateRevenue:
    
    # Test naming: method_scenario_expected
    def test_calculate_revenue_with_valid_transactions_returns_correct_total(self):
        # Arrange
        transactions = [
            {'amount': 999, 'currency': 'usd'},   # $9.99
            {'amount': 4700, 'currency': 'usd'},  # $47.00
        ]
        
        # Act
        result = calculate_revenue(transactions)
        
        # Assert
        assert result['total'] == 56.99
        assert result['count'] == 2
    
    def test_calculate_revenue_with_empty_list_returns_zero(self):
        result = calculate_revenue([])
        assert result['total'] == 0.0
        assert result['count'] == 0
    
    def test_calculate_revenue_ignores_refunded_transactions(self):
        transactions = [
            {'amount': 999, 'currency': 'usd', 'refunded': False},
            {'amount': 4700, 'currency': 'usd', 'refunded': True},
        ]
        result = calculate_revenue(transactions)
        assert result['total'] == 9.99  # Only non-refunded
```

### Integration Test Standards
```python
# Integration tests verify that components work together correctly
# Use real (but test/sandbox) credentials when possible
# Use fixtures for database state

@pytest.fixture(scope='session')
def test_db(tmp_path_factory):
    """Session-scoped test database."""
    db_path = tmp_path_factory.mktemp('data') / 'test.db'
    db = ProductDatabase(db_path)
    # Seed with test data
    db.upsert_product({
        'id': 'test_prod_001',
        'title': 'Test Product',
        'price': 47.00,
        'status': 'active',
    })
    yield db
    db_path.unlink()  # Cleanup

class TestProductDatabase:
    def test_get_active_products_returns_only_active(self, test_db):
        products = test_db.get_active_products()
        assert all(p['status'] == 'active' for p in products)
    
    def test_upsert_product_updates_existing(self, test_db):
        test_db.upsert_product({'id': 'test_prod_001', 'title': 'Updated Title', 'price': 57.00, 'status': 'active'})
        product = test_db.get_product('test_prod_001')
        assert product['title'] == 'Updated Title'
        assert product['price'] == 57.00
```

---

## 3. THE ANTI-PATTERN CATALOGUE

### Anti-Pattern 1: God Function
```python
# BAD: One function that does everything
def process_and_send_weekly_report():
    # Fetches data
    # Calculates metrics
    # Generates PDF
    # Formats email
    # Sends email
    # Updates database
    # Logs results
    # (200 lines of mixed concerns)

# GOOD: Each step is its own function
def run_weekly_report_pipeline():
    transactions = fetch_weekly_transactions()
    metrics = calculate_revenue_metrics(transactions)
    pdf_path = generate_report_pdf(metrics)
    email_body = format_report_email(metrics, pdf_path)
    send_email(REPORT_RECIPIENT, email_body, attachment=pdf_path)
    record_report_sent(metrics)
```

### Anti-Pattern 2: Boolean Parameter Flags
```python
# BAD: boolean flags that change behavior fundamentally
def generate_report(data, pdf=False, email=False, csv=False):
    if pdf:
        ...
    if email:
        ...
    if csv:
        ...

# GOOD: separate functions for separate behaviors
def generate_pdf_report(data) -> Path: ...
def generate_csv_export(data) -> Path: ...
def email_report(report_path: Path, recipient: str) -> None: ...
```

### Anti-Pattern 3: Returning None for Errors
```python
# BAD: None is ambiguous (not found? error? empty?)
def get_product(product_id: str):
    result = db.query("SELECT * FROM products WHERE id = ?", product_id)
    if not result:
        return None  # Was it not found? Did it error? We don't know.

# GOOD: raise specific exceptions for specific failure modes
def get_product(product_id: str) -> Product:
    result = db.query("SELECT * FROM products WHERE id = ?", product_id)
    if result is None:
        raise ProductNotFoundError(f"Product '{product_id}' not found")
    return Product.from_dict(result)

# For optional data, use Optional type hint:
def find_product(product_id: str) -> Optional[Product]:
    """Returns None if product doesn't exist (expected outcome)."""
    result = db.query("SELECT * FROM products WHERE id = ?", product_id)
    return Product.from_dict(result) if result else None
```

### Anti-Pattern 4: Magic Numbers
```python
# BAD: what does 0.08 mean? 86400? 3?
if elapsed > 86400:
    tax = price * 0.08
    if retry_count > 3:
        fail()

# GOOD: named constants
SECONDS_PER_DAY = 86400
COLORADO_SALES_TAX_RATE = 0.08  # As of 2024
MAX_RETRY_ATTEMPTS = 3

if elapsed > SECONDS_PER_DAY:
    tax = price * COLORADO_SALES_TAX_RATE
    if retry_count > MAX_RETRY_ATTEMPTS:
        fail()
```

### Anti-Pattern 5: Mutable Default Arguments (Python)
```python
# BAD: default list is created ONCE and shared across all calls
def append_to_list(item, items=[]):  # ← This is a bug!
    items.append(item)
    return items

append_to_list('a')  # Returns ['a']
append_to_list('b')  # Returns ['a', 'b'] ← Bug! 

# GOOD: use None as default, create fresh list inside function
def append_to_list(item, items=None):
    if items is None:
        items = []
    items.append(item)
    return items
```

### Anti-Pattern 6: Bare Except Clauses
```python
# BAD: catches everything, hides bugs
try:
    process_order(order)
except:  # Catches KeyboardInterrupt, SystemExit, MemoryError...
    pass   # Silently fails!

# ALSO BAD: catches Exception but does nothing useful
try:
    process_order(order)
except Exception:
    print("Something went wrong")  # What went wrong? We'll never know.

# GOOD: specific exceptions with meaningful handling
try:
    process_order(order)
except ValidationError as e:
    logger.warning(f"Order validation failed: {e}")
    notify_customer_of_invalid_order(order)
except PaymentError as e:
    logger.error(f"Payment failed for order {order.id}: {e}")
    mark_order_as_failed(order.id, str(e))
except Exception as e:
    logger.error(f"Unexpected error processing order {order.id}: {e}", exc_info=True)
    raise  # Re-raise unexpected errors — don't swallow them
```

### Anti-Pattern 7: String Concatenation for SQL
```python
# BAD: SQL injection vulnerability
user_id = request.get_json()['user_id']
result = db.execute(f"SELECT * FROM users WHERE id = '{user_id}'")
# If user_id = "' OR '1'='1" → returns ALL users!

# GOOD: parameterized queries
result = db.execute("SELECT * FROM users WHERE id = ?", (user_id,))
```

---

## 4. PERFORMANCE STANDARDS

### Performance Budgets
```
Script startup time:         < 2 seconds
API response time:           < 500ms for 95th percentile
Database query time:         < 100ms for simple queries
PDF generation:              < 30 seconds for 50-page report
Batch processing:            > 1000 records/minute
Memory usage (scripts):      < 512MB
```

### Profiling Before Optimizing
```python
import cProfile
import pstats

def profile_function(func, *args, **kwargs):
    """Profile a function call and print top 20 slowest operations."""
    profiler = cProfile.Profile()
    profiler.enable()
    result = func(*args, **kwargs)
    profiler.disable()
    
    stats = pstats.Stats(profiler)
    stats.sort_stats('cumulative')
    stats.print_stats(20)  # Top 20 by cumulative time
    
    return result

# Usage:
profile_function(generate_monthly_report, start_date, end_date, output_dir)
```

---

## 5. SECURITY CHECKLIST

Before any code is deployed:
```
CREDENTIALS:
- [ ] No API keys, passwords, or tokens in source code
- [ ] All secrets loaded from environment variables
- [ ] .gitignore includes .env and all credential files
- [ ] Secrets rotated if they may have been exposed

INPUT VALIDATION:
- [ ] All user inputs validated before processing
- [ ] File paths validated (no path traversal: ../../../etc/passwd)
- [ ] Numeric inputs validated for range (no negative counts, etc.)
- [ ] String inputs sanitized for use in filenames

SQL / INJECTION:
- [ ] All SQL queries use parameterized statements
- [ ] No string concatenation in SQL
- [ ] No dynamic code execution (eval, exec) on user input

NETWORKING:
- [ ] All external requests use HTTPS
- [ ] SSL certificate verification enabled (default)
- [ ] Request timeouts set on all external calls
- [ ] Webhook signatures verified before processing

LOGGING:
- [ ] No sensitive data in log output
- [ ] No passwords, tokens, or full credit card numbers logged
- [ ] Error messages don't expose internal system details
```

---

## 6. MAINTAINABILITY RULES

### The 6-Month Stranger Test
Would you, 6 months from now with no context, understand this code?

Rules to pass the test:
1. Variable and function names explain their purpose without comments
2. Complex logic has a WHY comment
3. Non-obvious data structures are documented
4. File and module structure is logical (related things are near each other)
5. Configuration is separate from logic

### Code Age — What to Refactor
Refactor when:
- You read a section and think "what does this do?"
- You need to change behavior but aren't sure what breaks
- The same bug has appeared in this section 2+ times
- Adding a feature requires changing 5+ places

Don't refactor when:
- The code works and you're in the middle of something else
- You're adding a feature (make it work first, then clean up)
- There are no tests to verify your refactor didn't break anything

---

## 7. THE QUALITY GATE

Minimum bar for any code leaving the Architect agent:

```python
QUALITY_GATE = {
    'tests_pass': True,           # All existing tests pass
    'no_hardcoded_secrets': True, # No credentials in code
    'error_handling': True,       # External calls have error handling
    'readme_updated': True,       # If interface changed, docs updated
    'no_dead_code': True,         # No commented-out code blocks
    'no_debug_prints': True,      # No print() statements left in
    'type_hints_present': True,   # Function signatures have types
}
```

---

## 8. AUTOMATED QUALITY TOOLS

```bash
# Python linting + formatting
pip install black isort flake8 mypy

# Format code
black --line-length 100 src/
isort src/

# Check for style issues
flake8 --max-line-length 100 src/

# Type checking
mypy src/ --ignore-missing-imports

# Security scanning
pip install bandit
bandit -r src/ -ll  # Report medium and high severity only

# Test coverage
pytest tests/ --cov=src --cov-report=term-missing --cov-fail-under=80

# Pre-commit hook setup
pip install pre-commit
# .pre-commit-config.yaml:
repos:
  - repo: https://github.com/psf/black
    rev: 23.9.1
    hooks:
      - id: black
        args: [--line-length, "100"]
  - repo: https://github.com/pycqa/isort
    rev: 5.12.0
    hooks:
      - id: isort
  - repo: https://github.com/pycqa/flake8
    rev: 6.1.0
    hooks:
      - id: flake8
```
