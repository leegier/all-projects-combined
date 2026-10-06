# Code Development — Reference Guide

The practitioner's playbook for writing production-quality Python, JavaScript, and Node.js code.
Read this before any coding task involving scripts, functions, classes, modules, or applications.

---

## TABLE OF CONTENTS
1. Python Best Practices & Patterns
2. JavaScript / Node.js Patterns
3. Function Design Principles
4. Class & Module Structure
5. Error Handling Patterns
6. Input Validation & Sanitization
7. Data Processing Patterns
8. File I/O Operations
9. CLI Tool Design
10. Code Formatting & Style
11. Testing Strategies
12. Performance Patterns
13. Common Algorithms & Utilities
14. Dependency Management

---

## 1. PYTHON BEST PRACTICES & PATTERNS

### Project Structure
```
project/
├── README.md
├── requirements.txt
├── .env.example
├── .gitignore
├── config.py          # All config loaded from env vars
├── main.py            # Entry point
├── src/
│   ├── __init__.py
│   ├── processor.py   # Core business logic
│   ├── utils.py       # Shared utilities
│   └── models.py      # Data models / schemas
└── tests/
    ├── test_processor.py
    └── test_utils.py
```

### The Config Pattern — Non-Negotiable
```python
# config.py
import os
from dataclasses import dataclass

@dataclass
class Config:
    api_key: str
    base_url: str
    timeout: int
    debug: bool

def load_config() -> Config:
    """Load all configuration from environment variables.
    
    Raises:
        EnvironmentError: If a required variable is missing.
    """
    required = ['API_KEY', 'BASE_URL']
    missing = [var for var in required if not os.getenv(var)]
    if missing:
        raise EnvironmentError(f"Missing required env vars: {', '.join(missing)}")
    
    return Config(
        api_key=os.environ['API_KEY'],
        base_url=os.environ['BASE_URL'],
        timeout=int(os.getenv('TIMEOUT', '30')),
        debug=os.getenv('DEBUG', 'false').lower() == 'true',
    )
```

### Logging Pattern — Always Use This
```python
import logging
import sys

def setup_logging(level: str = 'INFO') -> logging.Logger:
    """Configure structured logging for the application."""
    logging.basicConfig(
        level=getattr(logging, level.upper()),
        format='%(asctime)s | %(name)s | %(levelname)s | %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout),
        ]
    )
    return logging.getLogger(__name__)

# Usage:
logger = setup_logging()
logger.info("Processing started", extra={"record_count": 42})
logger.error("API call failed", extra={"url": url, "status": response.status_code})
```

### Dataclass Pattern — Use Instead of Raw Dicts
```python
from dataclasses import dataclass, field, asdict
from typing import Optional, List
from datetime import datetime

@dataclass
class Product:
    id: str
    title: str
    price: float
    tags: List[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.utcnow)
    description: Optional[str] = None
    
    def to_dict(self) -> dict:
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: dict) -> 'Product':
        return cls(
            id=data['id'],
            title=data['title'],
            price=float(data['price']),
            tags=data.get('tags', []),
            description=data.get('description'),
        )
    
    def validate(self) -> None:
        if not self.id:
            raise ValueError("Product ID cannot be empty")
        if self.price < 0:
            raise ValueError(f"Invalid price: {self.price}")
        if not self.title.strip():
            raise ValueError("Product title cannot be blank")
```

### Context Manager Pattern — For Resource Cleanup
```python
from contextlib import contextmanager
import sqlite3

@contextmanager
def database_connection(db_path: str):
    """Context manager that ensures DB connections are always closed."""
    conn = None
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        yield conn
        conn.commit()
    except Exception as e:
        if conn:
            conn.rollback()
        raise
    finally:
        if conn:
            conn.close()

# Usage:
with database_connection('data.db') as db:
    db.execute("INSERT INTO products VALUES (?, ?)", (id, name))
```

---

## 2. JAVASCRIPT / NODE.JS PATTERNS

### Module Structure (ESM)
```javascript
// Always use ESM modules in modern Node.js
// package.json: { "type": "module" }

// config.js
export const config = {
    apiKey: process.env.API_KEY ?? (() => { throw new Error('API_KEY required') })(),
    baseUrl: process.env.BASE_URL ?? 'https://api.example.com',
    timeout: parseInt(process.env.TIMEOUT ?? '30000'),
};

// main.js
import { processRecords } from './src/processor.js';
import { config } from './config.js';
import { logger } from './src/utils.js';

async function main() {
    logger.info('Starting processing...');
    try {
        const results = await processRecords(config);
        logger.info(`Completed: ${results.length} records processed`);
    } catch (error) {
        logger.error('Fatal error:', error.message);
        process.exit(1);
    }
}

main();
```

### Async/Await Error Handling — Always Explicit
```javascript
// BAD: unhandled promise rejection
async function fetchData(url) {
    const response = await fetch(url);
    return response.json();
}

// GOOD: explicit error handling with context
async function fetchData(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeout ?? 30000);
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} from ${url}: ${await response.text()}`);
        }
        
        return await response.json();
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error(`Request to ${url} timed out after ${options.timeout}ms`);
        }
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}
```

### Batch Processing Pattern
```javascript
// Process large arrays in configurable batches
async function processBatch(items, processor, batchSize = 10, delayMs = 1000) {
    const results = [];
    const errors = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        
        const batchResults = await Promise.allSettled(
            batch.map(item => processor(item))
        );
        
        batchResults.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                results.push(result.value);
            } else {
                errors.push({ item: batch[index], error: result.reason.message });
            }
        });
        
        // Respect rate limits between batches
        if (i + batchSize < items.length && delayMs > 0) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
    
    return { results, errors };
}
```

---

## 3. FUNCTION DESIGN PRINCIPLES

### The Single Responsibility Rule
```python
# BAD: one function doing everything
def process_order(order_data):
    # validates the order
    if not order_data.get('customer_id'):
        raise ValueError("no customer")
    # calculates tax
    tax = order_data['subtotal'] * 0.08
    # sends confirmation email
    send_email(order_data['email'], "Order confirmed")
    # saves to database
    db.save(order_data)
    return {"status": "ok", "tax": tax}

# GOOD: each function has one job
def validate_order(order_data: dict) -> None:
    """Validate order fields. Raises ValueError on invalid data."""
    required = ['customer_id', 'email', 'subtotal', 'items']
    missing = [f for f in required if not order_data.get(f)]
    if missing:
        raise ValueError(f"Order missing required fields: {missing}")
    if order_data['subtotal'] < 0:
        raise ValueError("Order subtotal cannot be negative")

def calculate_order_tax(subtotal: float, tax_rate: float = 0.08) -> float:
    """Calculate tax amount for an order subtotal."""
    return round(subtotal * tax_rate, 2)

def save_order(order_data: dict, db_conn) -> str:
    """Persist order to database. Returns order ID."""
    ...

def send_order_confirmation(email: str, order_id: str) -> None:
    """Send confirmation email to customer."""
    ...
```

### Function Signature Best Practices
```python
from typing import Optional, List, Dict, Union
from pathlib import Path

# Use type hints everywhere
def generate_report(
    data: List[Dict],
    output_path: Path,
    title: str,
    include_charts: bool = True,
    page_size: str = 'A4',
    max_rows: Optional[int] = None,
) -> Path:
    """
    Generate a PDF report from structured data.
    
    Args:
        data: List of dicts, each representing one row
        output_path: Where to save the generated PDF
        title: Report title shown on page 1
        include_charts: Whether to render chart visualizations
        page_size: Page size spec ('A4', 'letter', etc.)
        max_rows: Cap record count (None = all rows)
    
    Returns:
        Path to the generated PDF file
    
    Raises:
        ValueError: If data is empty or output_path has wrong extension
        IOError: If output directory doesn't exist or isn't writable
    """
    if not data:
        raise ValueError("Cannot generate report from empty data")
    if output_path.suffix.lower() != '.pdf':
        raise ValueError(f"output_path must end in .pdf, got: {output_path.suffix}")
    ...
```

---

## 4. CLASS & MODULE STRUCTURE

### Service Class Pattern
```python
class EmailService:
    """
    Handles all email sending operations via SendGrid API.
    
    Usage:
        service = EmailService(api_key=config.sendgrid_key)
        service.send_transactional(to='user@example.com', template_id='d-xxx')
    """
    
    def __init__(self, api_key: str, from_email: str = 'noreply@company.com'):
        self._api_key = api_key
        self._from_email = from_email
        self._client = self._init_client()
        self._logger = logging.getLogger(self.__class__.__name__)
    
    def _init_client(self):
        """Initialize the SendGrid client. Private — don't call externally."""
        import sendgrid
        return sendgrid.SendGridAPIClient(api_key=self._api_key)
    
    def send_transactional(
        self, 
        to: str, 
        template_id: str, 
        dynamic_data: dict = None
    ) -> bool:
        """Send a transactional email using a SendGrid template."""
        ...
    
    def send_batch(
        self, 
        recipients: List[str], 
        subject: str, 
        body: str
    ) -> Dict[str, bool]:
        """Send the same email to multiple recipients. Returns success map."""
        ...
    
    @staticmethod
    def validate_email(email: str) -> bool:
        """Basic email format validation."""
        import re
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return bool(re.match(pattern, email))
```

---

## 5. ERROR HANDLING PATTERNS

### Exception Hierarchy
```python
# Define custom exceptions for your domain
class AppError(Exception):
    """Base exception for all application errors."""
    pass

class ConfigurationError(AppError):
    """Raised when configuration is invalid or missing."""
    pass

class APIError(AppError):
    """Raised when an external API call fails."""
    def __init__(self, message: str, status_code: int = None, response_body: str = None):
        super().__init__(message)
        self.status_code = status_code
        self.response_body = response_body

class ValidationError(AppError):
    """Raised when input data fails validation."""
    def __init__(self, field: str, message: str):
        super().__init__(f"Validation failed for '{field}': {message}")
        self.field = field

class RateLimitError(APIError):
    """Raised when rate limit is hit. Includes retry-after info."""
    def __init__(self, retry_after: int = 60):
        super().__init__(f"Rate limit hit. Retry after {retry_after}s", status_code=429)
        self.retry_after = retry_after
```

### Retry Pattern with Exponential Backoff
```python
import time
import random
from functools import wraps

def with_retry(max_attempts=3, base_delay=1.0, max_delay=60.0, exceptions=(Exception,)):
    """Decorator that retries a function with exponential backoff."""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_attempts):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    if attempt == max_attempts - 1:
                        raise
                    
                    # Exponential backoff with jitter
                    delay = min(base_delay * (2 ** attempt) + random.uniform(0, 1), max_delay)
                    logging.warning(
                        f"Attempt {attempt + 1}/{max_attempts} failed for {func.__name__}: {e}. "
                        f"Retrying in {delay:.1f}s"
                    )
                    time.sleep(delay)
        return wrapper
    return decorator

# Usage:
@with_retry(max_attempts=3, base_delay=2.0, exceptions=(APIError, ConnectionError))
def call_external_api(url: str, data: dict) -> dict:
    ...
```

---

## 6. INPUT VALIDATION & SANITIZATION

### Validation Functions
```python
import re
from pathlib import Path

def validate_file_path(path_str: str, must_exist: bool = True, extensions: list = None) -> Path:
    """Validate a file path string and return Path object."""
    path = Path(path_str)
    if must_exist and not path.exists():
        raise FileNotFoundError(f"File not found: {path}")
    if extensions and path.suffix.lower() not in extensions:
        raise ValueError(f"Expected file type {extensions}, got {path.suffix}")
    return path

def validate_positive_int(value: any, name: str) -> int:
    """Validate and convert to positive integer."""
    try:
        n = int(value)
    except (TypeError, ValueError):
        raise ValueError(f"'{name}' must be an integer, got: {type(value).__name__}")
    if n <= 0:
        raise ValueError(f"'{name}' must be positive, got: {n}")
    return n

def sanitize_filename(name: str) -> str:
    """Make a string safe for use as a filename."""
    # Remove characters that are illegal in filenames
    safe = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '', name)
    # Replace spaces with underscores
    safe = re.sub(r'\s+', '_', safe.strip())
    # Limit length
    return safe[:200] or 'unnamed'

def validate_dict_schema(data: dict, schema: dict) -> None:
    """
    Validate dict against a schema.
    Schema format: {'field': {'type': str, 'required': True, 'min': 0}}
    """
    for field, rules in schema.items():
        if rules.get('required') and field not in data:
            raise ValidationError(field, "Required field is missing")
        if field in data:
            expected_type = rules.get('type')
            if expected_type and not isinstance(data[field], expected_type):
                raise ValidationError(field, f"Expected {expected_type.__name__}, got {type(data[field]).__name__}")
            if 'min' in rules and data[field] < rules['min']:
                raise ValidationError(field, f"Value {data[field]} below minimum {rules['min']}")
            if 'max' in rules and data[field] > rules['max']:
                raise ValidationError(field, f"Value {data[field]} exceeds maximum {rules['max']}")
```

---

## 7. DATA PROCESSING PATTERNS

### Chunked Processing for Large Datasets
```python
from typing import Generator, Iterable, TypeVar
T = TypeVar('T')

def chunked(iterable: Iterable[T], size: int) -> Generator[List[T], None, None]:
    """Split an iterable into chunks of given size."""
    chunk = []
    for item in iterable:
        chunk.append(item)
        if len(chunk) == size:
            yield chunk
            chunk = []
    if chunk:
        yield chunk

def process_large_file(filepath: Path, processor_fn, chunk_size: int = 1000) -> dict:
    """Process a large file in chunks, aggregating results."""
    stats = {'processed': 0, 'errors': 0, 'skipped': 0}
    
    with open(filepath) as f:
        lines = (line.strip() for line in f if line.strip())
        for chunk in chunked(lines, chunk_size):
            for line in chunk:
                try:
                    processor_fn(line)
                    stats['processed'] += 1
                except ValidationError:
                    stats['skipped'] += 1
                except Exception as e:
                    logger.error(f"Processing error: {e} | Input: {line[:100]}")
                    stats['errors'] += 1
    
    return stats
```

### JSON Processing Patterns
```python
import json
from pathlib import Path
from typing import Optional

def load_json_safe(filepath: Path) -> Optional[dict]:
    """Load JSON file with graceful error handling."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return None
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in {filepath}: {e}")

def save_json(data: dict, filepath: Path, pretty: bool = True) -> None:
    """Save dict to JSON file, creating parent dirs if needed."""
    filepath = Path(filepath)
    filepath.parent.mkdir(parents=True, exist_ok=True)
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2 if pretty else None, ensure_ascii=False, default=str)

def merge_json_files(paths: List[Path]) -> dict:
    """Deep merge multiple JSON files. Later files override earlier ones."""
    result = {}
    for path in paths:
        data = load_json_safe(path) or {}
        result = deep_merge(result, data)
    return result

def deep_merge(base: dict, override: dict) -> dict:
    """Deep merge two dicts, override wins on conflicts."""
    result = base.copy()
    for key, value in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = deep_merge(result[key], value)
        else:
            result[key] = value
    return result
```

---

## 8. FILE I/O OPERATIONS

### Safe File Operations
```python
import shutil
from pathlib import Path
import tempfile

def safe_write(filepath: Path, content: str, encoding: str = 'utf-8') -> None:
    """Write file atomically — write to temp then rename (prevents partial writes)."""
    filepath = Path(filepath)
    filepath.parent.mkdir(parents=True, exist_ok=True)
    
    # Write to temp file first
    with tempfile.NamedTemporaryFile(
        mode='w', 
        encoding=encoding,
        dir=filepath.parent,
        delete=False,
        suffix='.tmp'
    ) as tmp:
        tmp.write(content)
        tmp_path = Path(tmp.name)
    
    # Atomic rename
    tmp_path.replace(filepath)

def safe_copy(src: Path, dst: Path) -> None:
    """Copy file, creating destination directory if needed."""
    dst = Path(dst)
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)

def ensure_dir(path: Path) -> Path:
    """Create directory and parents if they don't exist. Returns path."""
    Path(path).mkdir(parents=True, exist_ok=True)
    return Path(path)

def find_files(directory: Path, pattern: str = '*', recursive: bool = True) -> List[Path]:
    """Find all files matching a glob pattern in a directory."""
    directory = Path(directory)
    if recursive:
        return sorted(directory.rglob(pattern))
    return sorted(directory.glob(pattern))
```

---

## 9. CLI TOOL DESIGN

### Argparse Pattern for CLI Tools
```python
import argparse
import sys
from pathlib import Path

def create_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description='Tool description here',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python main.py --input data.csv --output reports/
  python main.py --input data.csv --format pdf --verbose
        """
    )
    
    # Required arguments
    parser.add_argument(
        '--input', '-i',
        type=Path,
        required=True,
        help='Path to input file (.csv or .json)'
    )
    
    # Optional with default
    parser.add_argument(
        '--output', '-o',
        type=Path,
        default=Path('./output'),
        help='Output directory (default: ./output)'
    )
    
    # Choice argument
    parser.add_argument(
        '--format', '-f',
        choices=['pdf', 'html', 'json'],
        default='pdf',
        help='Output format (default: pdf)'
    )
    
    # Flag
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Enable verbose output'
    )
    
    return parser

def main():
    parser = create_parser()
    args = parser.parse_args()
    
    # Validate inputs after parsing
    if not args.input.exists():
        parser.error(f"Input file not found: {args.input}")
    
    # Run the actual logic
    ...

if __name__ == '__main__':
    main()
```

---

## 10. CODE FORMATTING & STYLE

### Python Style Rules
- Follow PEP 8 strictly
- Line length: 100 characters max
- Use Black for formatting: `black --line-length 100 .`
- Use isort for imports: `isort .`
- Import order: stdlib → third-party → local

### Import Organization
```python
# Standard library
import os
import sys
import json
import logging
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timedelta

# Third-party
import requests
from reportlab.platypus import SimpleDocTemplate
from dotenv import load_dotenv

# Local
from config import load_config
from src.utils import setup_logging
from src.models import Product
```

### Naming Conventions
```python
# Variables and functions: snake_case
user_count = 42
def calculate_total_price(): ...

# Constants: SCREAMING_SNAKE_CASE
MAX_RETRY_ATTEMPTS = 3
DEFAULT_TIMEOUT_SECONDS = 30
API_BASE_URL = 'https://api.example.com/v1'

# Classes: PascalCase
class ProductCatalog: ...
class EmailService: ...

# Private methods/attributes: single underscore prefix
def _internal_helper(): ...
self._private_data = {}

# Magic/dunder methods: double underscore
def __init__(self): ...
def __repr__(self): ...
```

---

## 11. TESTING STRATEGIES

### Unit Test Template
```python
import pytest
from unittest.mock import Mock, patch, MagicMock
from pathlib import Path

# Group tests by the unit being tested
class TestProductValidator:
    """Tests for the Product.validate() method."""
    
    def test_valid_product_passes(self):
        product = Product(id='p1', title='Test Product', price=9.99)
        product.validate()  # Should not raise
    
    def test_empty_id_raises_value_error(self):
        product = Product(id='', title='Test', price=9.99)
        with pytest.raises(ValueError, match="ID cannot be empty"):
            product.validate()
    
    def test_negative_price_raises_value_error(self):
        product = Product(id='p1', title='Test', price=-1.0)
        with pytest.raises(ValueError, match="Invalid price"):
            product.validate()
    
    def test_blank_title_raises_value_error(self):
        product = Product(id='p1', title='   ', price=9.99)
        with pytest.raises(ValueError, match="title cannot be blank"):
            product.validate()


class TestEmailService:
    """Tests for the EmailService class."""
    
    @pytest.fixture
    def service(self):
        return EmailService(api_key='test-key-123')
    
    @patch('src.email_service.sendgrid.SendGridAPIClient')
    def test_send_transactional_success(self, mock_sg_class, service):
        mock_client = Mock()
        mock_client.send.return_value = Mock(status_code=202)
        mock_sg_class.return_value = mock_client
        
        result = service.send_transactional(
            to='user@example.com',
            template_id='d-123abc',
        )
        assert result is True
    
    def test_validate_email_format(self, service):
        assert service.validate_email('valid@example.com') is True
        assert service.validate_email('invalid-email') is False
        assert service.validate_email('@example.com') is False
```

---

## 12. PERFORMANCE PATTERNS

### Caching with functools
```python
from functools import lru_cache, cached_property
import time

# In-memory cache for expensive function calls
@lru_cache(maxsize=128)
def fetch_config_from_api(endpoint: str) -> dict:
    """Cached API config fetch — same endpoint returns cached result."""
    ...

# Property that's computed once and cached
class ReportGenerator:
    def __init__(self, data_path: Path):
        self._data_path = data_path
    
    @cached_property
    def raw_data(self) -> List[dict]:
        """Load data once, cache for the lifetime of this object."""
        return load_json_safe(self._data_path) or []
    
    @cached_property
    def processed_data(self) -> List[dict]:
        """Process raw data once, cache result."""
        return [self._process_record(r) for r in self.raw_data]
```

### Generator Patterns for Memory Efficiency
```python
def stream_csv_rows(filepath: Path) -> Generator[dict, None, None]:
    """Stream CSV rows as dicts without loading entire file into memory."""
    import csv
    with open(filepath, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            yield dict(row)

# Process 1M rows without memory issues
for row in stream_csv_rows(Path('large_file.csv')):
    process_row(row)
```

---

## 13. COMMON ALGORITHMS & UTILITIES

### Text Processing
```python
import re
from unicodedata import normalize

def slugify(text: str) -> str:
    """Convert text to URL-safe slug."""
    text = normalize('NFKD', text).encode('ascii', 'ignore').decode()
    text = re.sub(r'[^\w\s-]', '', text.lower())
    return re.sub(r'[-\s]+', '-', text).strip('-')

def truncate_text(text: str, max_length: int, suffix: str = '...') -> str:
    """Truncate text at word boundary."""
    if len(text) <= max_length:
        return text
    truncated = text[:max_length - len(suffix)]
    last_space = truncated.rfind(' ')
    if last_space > 0:
        truncated = truncated[:last_space]
    return truncated + suffix

def word_count(text: str) -> int:
    """Count words in text."""
    return len(re.findall(r'\b\w+\b', text))
```

### Date/Time Utilities
```python
from datetime import datetime, timezone, timedelta

def utc_now() -> datetime:
    """Get current UTC datetime (timezone-aware)."""
    return datetime.now(timezone.utc)

def format_date(dt: datetime, fmt: str = '%Y-%m-%d') -> str:
    return dt.strftime(fmt)

def days_until(target_date: datetime) -> int:
    delta = target_date.date() - utc_now().date()
    return delta.days

def human_readable_delta(seconds: int) -> str:
    """Convert seconds to human-readable duration."""
    intervals = [('day', 86400), ('hour', 3600), ('minute', 60), ('second', 1)]
    for name, count in intervals:
        value = seconds // count
        if value:
            return f"{value} {name}{'s' if value != 1 else ''}"
    return "0 seconds"
```

---

## 14. DEPENDENCY MANAGEMENT

### requirements.txt Format
```
# Core dependencies — pin exact versions for reproducibility
requests==2.31.0
python-dotenv==1.0.0
reportlab==4.0.8

# Optional/development dependencies in requirements-dev.txt
pytest==7.4.3
black==23.9.1
isort==5.12.0
mypy==1.6.1
```

### Checking for Missing Dependencies
```python
def check_dependencies(required_packages: List[str]) -> None:
    """Check all required packages are importable. Fail loudly if not."""
    import importlib
    missing = []
    for package in required_packages:
        try:
            importlib.import_module(package)
        except ImportError:
            missing.append(package)
    
    if missing:
        raise ImportError(
            f"Missing required packages: {', '.join(missing)}. "
            f"Run: pip install {' '.join(missing)}"
        )
```

---

*Last updated: Ten Life Creatives — Architect Agent Reference Library*
