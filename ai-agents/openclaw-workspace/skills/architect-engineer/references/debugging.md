# Debugging — Reference Guide

Systematic error diagnosis, root cause analysis, stack trace interpretation, logging strategies,
testing protocols, and fix verification. Debug fast, fix right, prevent recurrence.

---

## TABLE OF CONTENTS
1. The Debugging Mindset
2. Systematic Debugging Protocol
3. Reading Stack Traces
4. Common Python Error Patterns
5. Common Node.js Error Patterns
6. API & Network Debugging
7. Database Debugging
8. Logging for Debuggability
9. Testing After Fixes
10. The Five Whys
11. Debugging Tools Reference
12. Error Pattern Library

---

## 1. THE DEBUGGING MINDSET

### The Prime Directive
**Never guess. Hypothesize, then prove.**

Bad debugging: "It's probably the database. Let me try restarting that."
Good debugging: "The error occurs after the database call. Let me add logging to verify this hypothesis."

### The Three Questions
Before touching any code:
1. **What was the expected behavior?**
2. **What is the actual behavior?**
3. **What changed recently?** (Most bugs are regressions)

### The Scientific Method Applied
```
1. Observe: What exactly is the error? (Full message, line number, conditions)
2. Hypothesize: What could cause this? (List 2-3 candidates)
3. Test: Design the simplest test that proves/disproves hypothesis #1
4. Conclude: Was your hypothesis right? If not, test hypothesis #2
5. Fix: Change ONLY what's needed to fix the verified root cause
6. Verify: Confirm the fix resolves the exact error without introducing new ones
```

---

## 2. SYSTEMATIC DEBUGGING PROTOCOL

### Step 1: Reproduce the Error
You cannot fix what you cannot reproduce. Get:
- Exact error message (full text, not paraphrase)
- Exact line number and file
- Input that triggers it
- Conditions when it happens (always? sometimes? only in production?)

If you cannot reproduce it: add logging, run again, collect data.

### Step 2: Isolate the Scope
Binary-search the failure:
```python
# The problem is somewhere in this 500-line function
# Strategy: find the exact line by adding checkpoints

def process_order(order_data):
    logger.debug("CHECKPOINT 1: Starting process_order")
    
    validated = validate_order(order_data)
    logger.debug(f"CHECKPOINT 2: Validation complete: {validated}")
    
    tax = calculate_tax(validated['subtotal'])
    logger.debug(f"CHECKPOINT 3: Tax calculated: {tax}")
    
    saved_id = save_to_db(validated)  # <-- Error is between CP3 and this line if CP3 printed
    logger.debug(f"CHECKPOINT 4: Saved with ID: {saved_id}")
    
    send_email(order_data['email'])
    logger.debug("CHECKPOINT 5: Email sent")
```

### Step 3: Read the Full Error Message
Don't skim error messages. Read them completely:
- Exception type (KeyError, TypeError, AttributeError...)
- Error message text
- Full stack trace from TOP to BOTTOM
- YOUR code in the stack trace (not library internals — usually)
- The LAST line in your code before the exception = where to look first

### Step 4: Form Hypotheses
Look at the error type:
- **KeyError**: Accessing dict key that doesn't exist
- **AttributeError**: Calling method/attribute that doesn't exist
- **TypeError**: Wrong type passed to function
- **ValueError**: Right type, wrong value
- **ImportError**: Module not found
- **FileNotFoundError**: Path doesn't exist
- **PermissionError**: Don't have access to that file/resource
- **ConnectionError**: Network connection failed
- **TimeoutError**: Operation took too long

### Step 5: Add Targeted Logging
```python
# Before the failing line, log everything relevant:
logger.debug(f"About to call save_order with: type={type(order_data)}, keys={list(order_data.keys())}")
logger.debug(f"order_id={order_data.get('id')!r}, customer={order_data.get('customer_id')!r}")

save_order(order_data)  # <-- This is failing
```

### Step 6: Fix Minimum Viable Change
Fix only what's broken. Don't refactor while debugging.
One fix per bug. Multiple changes obscure causation.

### Step 7: Verify the Fix
```python
# After fixing:
# 1. Does the specific error no longer occur?
# 2. Does the function now produce correct output?
# 3. Do all existing tests pass?
# 4. Does the fix break anything adjacent?
```

---

## 3. READING STACK TRACES

### Python Stack Trace Anatomy
```
Traceback (most recent call last):      ← Read from bottom up
  File "main.py", line 42, in main      ← Entry point call
    result = process_data(records)
  File "src/processor.py", line 87, in process_data    ← Calling function
    return normalize_records(data)
  File "src/processor.py", line 134, in normalize_records  ← Where it failed
    return [schema[key] for key in row]
  File "src/processor.py", line 134, in <listcomp>
    return [schema[key] for key in row]
KeyError: 'email'                       ← The actual error, read this FIRST
                                        ← Then look at line 134 in processor.py
```

**Strategy**: 
1. Read the error type + message FIRST (bottom)
2. Find YOUR code in the stack (not library code)
3. Look at the last line of your code = where to fix

### Handling "Chained Exceptions"
```
During handling of the above exception, another exception occurred:
```
When you see this: the original exception (above) caused a second one (below). Fix the original.

---

## 4. COMMON PYTHON ERROR PATTERNS

### KeyError — Accessing Missing Dict Key
```python
# Error: KeyError: 'email'
data = {'name': 'John', 'age': 30}
email = data['email']  # KeyError!

# Fix 1: Use .get() with default
email = data.get('email', '')           # Returns '' if missing

# Fix 2: Check before accessing
if 'email' in data:
    email = data['email']

# Fix 3: Better — validate input at the entry point
def process_record(record: dict) -> None:
    required = ['name', 'email', 'age']
    missing = [k for k in required if k not in record]
    if missing:
        raise ValueError(f"Record missing required fields: {missing}")
    # Now safe to access
    email = record['email']
```

### AttributeError — Calling Non-Existent Method/Property
```python
# Error: AttributeError: 'NoneType' object has no attribute 'title'
product = get_product(product_id)  # Returns None if not found
print(product.title)               # AttributeError!

# Fix: Handle None explicitly
product = get_product(product_id)
if product is None:
    raise NotFoundError(f"Product {product_id} not found")
print(product.title)  # Safe now

# Or use Optional pattern with guard
from typing import Optional
def get_product_title(product_id: str) -> Optional[str]:
    product = get_product(product_id)
    return product.title if product else None
```

### TypeError — Wrong Type
```python
# Error: TypeError: can only concatenate str (not "int") to str
user_id = 42
message = "User ID: " + user_id   # TypeError!

# Fix: Convert explicitly
message = "User ID: " + str(user_id)
# Or better: use f-strings
message = f"User ID: {user_id}"
```

### UnicodeDecodeError — File Encoding
```python
# Error: UnicodeDecodeError: 'utf-8' codec can't decode byte 0xe2
with open('data.csv', 'r') as f:  # Default encoding = 'utf-8' on some systems
    data = f.read()

# Fix: Specify encoding explicitly
with open('data.csv', 'r', encoding='utf-8', errors='replace') as f:
    data = f.read()

# Or: detect encoding
import chardet
with open('data.csv', 'rb') as f:
    raw = f.read()
encoding = chardet.detect(raw)['encoding']
data = raw.decode(encoding)
```

### RecursionError — Infinite Recursion
```python
# Error: RecursionError: maximum recursion depth exceeded
def count_down(n):
    return count_down(n - 1)  # Missing base case!

# Fix: Add base case
def count_down(n):
    if n <= 0:        # Base case
        return 0
    return count_down(n - 1)

# Or: Convert recursion to iteration
def count_down(n):
    while n > 0:
        n -= 1
    return 0
```

---

## 5. COMMON NODE.JS ERROR PATTERNS

### Unhandled Promise Rejection
```javascript
// Error: UnhandledPromiseRejectionWarning
async function fetchData() {
    const result = await apiCall();  // If this throws, it's unhandled!
    return result;
}

// Fix: Always handle async errors
async function fetchData() {
    try {
        const result = await apiCall();
        return result;
    } catch (error) {
        logger.error(`fetchData failed: ${error.message}`);
        throw error;  // Re-throw so callers know it failed
    }
}

// Or: Use global handler during development (not production)
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason);
});
```

### Cannot Read Property of Undefined
```javascript
// Error: TypeError: Cannot read property 'name' of undefined
const user = getUser(userId);
console.log(user.name);  // Fails if getUser returns undefined!

// Fix: Optional chaining (ES2020+)
console.log(user?.name ?? 'Unknown');

// Fix: Explicit guard
if (!user) {
    throw new Error(`User ${userId} not found`);
}
console.log(user.name);
```

---

## 6. API & NETWORK DEBUGGING

### Diagnosing API Failures
```python
# Bad: only logs the exception message
try:
    response = requests.get(url)
except Exception as e:
    logger.error(f"API call failed: {e}")

# Good: log everything needed to diagnose
import requests

def debug_api_call(url: str, params: dict = None) -> dict:
    logger.debug(f"API Request: GET {url}")
    logger.debug(f"Params: {params}")
    
    try:
        response = requests.get(url, params=params, timeout=30)
        
        logger.debug(f"Response status: {response.status_code}")
        logger.debug(f"Response headers: {dict(response.headers)}")
        
        if response.status_code != 200:
            logger.error(f"Unexpected status {response.status_code}: {response.text[:500]}")
            logger.error(f"Request URL: {response.url}")  # Shows final URL after redirects
        
        return response.json()
    
    except requests.Timeout:
        logger.error(f"Timeout after 30s: {url}")
        raise
    except requests.ConnectionError as e:
        logger.error(f"Connection failed to {url}: {e}")
        raise
    except ValueError as e:
        logger.error(f"Response is not JSON: {response.text[:200]}")
        raise
```

### curl Equivalents for Testing
```bash
# Test API endpoint manually
curl -X GET "https://api.example.com/v1/products" \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -v  # -v for verbose headers

# Test POST
curl -X POST "https://api.example.com/v1/products" \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title": "Test", "price": 9.99}' \
  -v

# Test webhook manually
curl -X POST "http://localhost:5000/webhooks/gumroad" \
  -H "Content-Type: application/json" \
  -d '{"type": "sale", "product": {"id": "abc123"}}'
```

---

## 7. DATABASE DEBUGGING

### SQLite Debugging
```python
# Enable SQLite query logging
import sqlite3
import logging

conn = sqlite3.connect('data.db')
conn.set_trace_callback(lambda sql: logging.debug(f"SQL: {sql}"))

# Check if data actually exists
cursor = conn.execute("SELECT COUNT(*) FROM products")
count = cursor.fetchone()[0]
print(f"Products in DB: {count}")  # Is it 0 when you expect records?

# Explain query plan (check if index is being used)
cursor = conn.execute("""
    EXPLAIN QUERY PLAN 
    SELECT * FROM sales WHERE sale_date > '2024-01-01'
""")
for row in cursor:
    print(row)  # Look for "SCAN TABLE" (bad) vs "SEARCH TABLE USING INDEX" (good)
```

---

## 8. LOGGING FOR DEBUGGABILITY

### Log Levels and When to Use Them
```python
logger.debug("Starting validation loop, item_count=42")      # Verbose internal state
logger.info("Payment processed: $9.99 from customer@x.com") # Normal events worth knowing
logger.warning("API quota 80% used, slowing requests")       # Something to watch
logger.error("Database write failed, order_id=abc123")       # Error but not crashing
logger.critical("Cannot start — missing required env vars")  # System cannot operate
```

### What to Always Log
```python
# Log these in every significant function:
# 1. Inputs (at DEBUG level)
logger.debug(f"process_order called: order_id={order.id}, amount=${order.total:.2f}")

# 2. Key decisions
logger.info(f"Order {order.id}: applying discount code {order.discount_code!r}")

# 3. External calls (before and after)
logger.debug(f"Calling Stripe API: create_payment_intent amount={amount}")
result = stripe.PaymentIntent.create(amount=amount)
logger.debug(f"Stripe response: intent_id={result.id}, status={result.status}")

# 4. Errors with full context
except Exception as e:
    logger.error(
        f"Order processing failed: {e}",
        extra={
            'order_id': order.id,
            'customer': order.customer_email,
            'step': 'payment_capture',
            'traceback': traceback.format_exc(),
        }
    )
```

---

## 9. THE FIVE WHYS

Use for root cause analysis on recurring bugs:

```
Bug: Revenue report script crashed overnight

Why #1: Why did the script crash?
  → KeyError: 'email' in line 134

Why #2: Why was 'email' key missing?
  → Some Gumroad sales don't have customer email (anonymous purchases)

Why #3: Why did we assume email would always be present?
  → We wrote the script assuming all sales had emails

Why #4: Why didn't this fail before?
  → It's our first anonymous sale — new feature Gumroad added

Why #5: Why don't we handle optional fields?
  → We don't have a schema validation layer in the data ingestion

Root Cause: Missing input validation for optional API fields.

Fix: Add validation/defaults for all optional Gumroad fields at ingestion.
Preventive: Add schema validation layer to ingestion pipeline.
```

---

## 10. ERROR PATTERN LIBRARY

### Pattern: "It works on my machine"
**Symptom**: Works locally, fails in production
**Cause**: Environment differences (different Python version, different env vars, different OS, different file permissions)
**Debug**: 
1. Print Python version: `python3 --version`
2. Compare .env files (without exposing secrets)
3. Check file paths (absolute vs relative, case sensitivity on Linux)
4. Check file permissions: `ls -la script.py`

### Pattern: "It worked yesterday"
**Symptom**: Previously working code now failing
**Cause**: Something changed — external API response format, dependency update, data format
**Debug**:
1. `git log --oneline -20` — What changed?
2. Check API changelog for recent updates
3. Log actual API response to see if format changed
4. `pip list --outdated` — Any auto-updated packages?

### Pattern: "It fails randomly"
**Symptom**: Non-deterministic failures
**Cause**: Race conditions, network timeouts, resource limits, timezone issues
**Debug**:
1. Add timestamps to all log entries
2. Log the exact input for each attempt
3. Check if it correlates with time of day, load, external API availability
4. Look for shared mutable state between threads

### Pattern: "It's slow in production"
**Symptom**: Performance acceptable locally, terrible in production
**Cause**: Missing indexes on large tables, N+1 query problem, no connection pooling
**Debug**:
```python
import cProfile
cProfile.run('your_slow_function()', sort='cumulative')

# Or time individual sections:
import time
t0 = time.perf_counter()
result = slow_operation()
logger.info(f"slow_operation took {time.perf_counter()-t0:.3f}s")
```

---

## 11. DEBUGGING TOOLS REFERENCE

### Python
```bash
# Interactive debugger
import pdb; pdb.set_trace()  # Drops into interactive debugger
# Or: python3 -m pdb script.py

# Modern: use breakpoint() (Python 3.7+)
breakpoint()

# Profile slow code
python3 -m cProfile -s cumulative slow_script.py | head -30

# Check memory usage
pip install memory_profiler
python3 -m memory_profiler script.py
```

### System-Level
```bash
# Watch log file in real-time
tail -f /var/log/app.log

# Find which process is using a port
lsof -i :8080

# Check file permissions
ls -la /path/to/file

# Trace system calls (Linux)
strace python3 script.py 2>&1 | grep -E "open|read|write|Error"

# Test DNS / network
ping api.example.com
nslookup api.example.com
curl -v https://api.example.com/health
```
