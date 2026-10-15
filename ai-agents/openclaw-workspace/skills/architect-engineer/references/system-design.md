# System Design — Reference Guide

Architecture decisions, service design, component structure, scalability planning, and integration
patterns. The decisions made here shape everything downstream.

---

## TABLE OF CONTENTS
1. Architecture Decision Framework
2. Component Design Principles
3. Service Boundary Decisions
4. Data Flow Architecture
5. Integration Patterns
6. Scalability Planning
7. Technology Selection Matrix
8. Dependency Management
9. Configuration Architecture
10. Observability Design
11. Ten Life Creatives System Patterns
12. Architecture Documentation

---

## 1. ARCHITECTURE DECISION FRAMEWORK

### The ADR Format (Architecture Decision Record)
Every significant technical decision should be documented:

```markdown
# ADR-001: Use SQLite for Product Catalog Storage

## Status
Accepted

## Context
We need to store product metadata (title, price, description, tags) locally for the PDF generator 
and reporting tools. Data is accessed read-heavy, updated infrequently, and fits on a single machine.
No multi-server replication needed at this scale.

## Decision
Use SQLite with WAL mode rather than a hosted database (Firestore, Postgres).

## Consequences
**Good:**
- Zero infrastructure cost
- Works offline, no network latency
- Simple backup (copy one file)
- Full SQL query capability
- ACID compliant

**Bad:**
- Not suitable if we need multi-server writes in future
- No real-time sync to external systems

## Alternatives Considered
- Firestore: Better for multi-device sync, but adds cost and network dependency
- JSON files: Simpler but no query capability for reporting
- Postgres (Supabase): More powerful but over-engineered for current scale

## Review Date
Reconsider if concurrent users exceed 100 or if we add server-side APIs.
```

### Decision Criteria Scoring
When choosing between technical approaches, score each on:

| Criterion | Weight | Notes |
|---|---|---|
| Development speed | 25% | How fast can we ship it? |
| Maintenance burden | 25% | How much ongoing work? |
| Cost at scale | 20% | Stays affordable as we grow? |
| Technical debt | 15% | Easy to change later? |
| Team familiarity | 15% | Do we know this already? |

Score each option 1-5 on each criterion, multiply by weight, sum for total.

---

## 2. COMPONENT DESIGN PRINCIPLES

### The Module Boundary Rule
A module/component has clear boundaries when you can answer YES to all:
1. Can it be tested in isolation (no external dependencies in tests)?
2. Can it be replaced with a different implementation without touching other modules?
3. Does it have a single, clearly named responsibility?
4. Would its interface (inputs/outputs) still make sense to a stranger?

### Dependency Direction
```
┌─────────────────────────────────────────────┐
│              Application Layer               │  ← Orchestrates
│    (main.py, CLI, scheduled jobs, APIs)      │
└─────────────────┬───────────────────────────┘
                  │ depends on
┌─────────────────▼───────────────────────────┐
│              Service Layer                   │  ← Business logic
│    (ReportService, EmailService, etc.)       │
└─────────────────┬───────────────────────────┘
                  │ depends on
┌─────────────────▼───────────────────────────┐
│           Infrastructure Layer               │  ← External systems
│    (Database, API clients, File I/O)         │
└─────────────────────────────────────────────┘
```

Dependencies flow DOWN, never up. Application calls Services. Services call Infrastructure.
Infrastructure never calls Services.

### Interface Before Implementation
```python
# Define the interface (what it does) before building it (how it does it)
from abc import ABC, abstractmethod

class NotificationService(ABC):
    """Interface: anything that can send notifications."""
    
    @abstractmethod
    def send(self, recipient: str, subject: str, body: str) -> bool:
        """Send a notification. Returns True if sent successfully."""
        pass

class EmailNotificationService(NotificationService):
    """Concrete: sends notifications via email."""
    def send(self, recipient, subject, body): ...

class TelegramNotificationService(NotificationService):
    """Concrete: sends notifications via Telegram."""
    def send(self, recipient, subject, body): ...

# Application code depends on the interface, not the concrete class
# This means you can swap implementations without changing callers
def run_report_job(notifier: NotificationService):
    ...
    notifier.send(OWNER_EMAIL, "Report Ready", "Your daily report is ready.")
```

---

## 3. SERVICE BOUNDARY DECISIONS

### When to Split into Separate Services
Split into separate modules/services when:
- Two components have DIFFERENT change rates (one changes weekly, other is stable)
- Two components have DIFFERENT owners (one team vs another)
- One component could be reused by other systems independently
- Splitting would reduce test time or deploy time meaningfully

### When NOT to Split
Don't split when:
- The components always change together
- Splitting creates more coupling (shared data, constant cross-calls)
- The system is small (<5,000 lines) — premature decomposition adds overhead
- You're prototyping — wait until boundaries become obvious

### Monolith-First Rule
Build a monolith first. Extract services only when:
1. You can draw a clean boundary with minimal data sharing
2. You have a measurable performance or team-scaling reason
3. The extracted service will be deployed independently

---

## 4. DATA FLOW ARCHITECTURE

### The Data Flow Map Template
For every system, document the data flow:

```
┌──────────────┐     ┌────────────────┐     ┌──────────────────┐
│   Data       │     │   Processing   │     │   Output         │
│   Sources    │────▶│   Pipeline     │────▶│   Destinations   │
└──────────────┘     └────────────────┘     └──────────────────┘

Sources:
  - Stripe API (sales data)
  - Gumroad API (product/sale data)
  - Manual CSV exports

Pipeline:
  1. Fetch from sources (raw data)
  2. Normalize to common schema
  3. Validate and clean
  4. Aggregate / calculate metrics
  5. Generate output artifacts

Destinations:
  - PDF report → email attachment
  - Summary → Airtable record
  - JSON cache → local filesystem
  - Alert → Telegram message
```

### Event-Driven Data Flow
```
External Event (Stripe webhook)
    ↓
Event Receiver (validates signature, enqueues)
    ↓
Event Queue (in-memory or file-based)
    ↓
Event Handler (business logic, side effects)
    ↓
Side Effects:
  - Update database
  - Send confirmation email
  - Update Airtable
  - Log for reporting
```

---

## 5. INTEGRATION PATTERNS

### The Adapter Pattern (Wrapping External APIs)
```python
# The problem: your code depends on Gumroad's API shape
# If Gumroad changes their API, you have to update everywhere it's used

# Solution: wrap external API in an adapter that speaks YOUR language

class GumroadAdapter:
    """Adapts Gumroad API responses to our internal Product schema."""
    
    def __init__(self, gumroad_client: GumroadClient):
        self._client = gumroad_client
    
    def get_products(self) -> List[Product]:
        """Get products from Gumroad, normalized to our Product model."""
        raw = self._client.get('/products')  # Gumroad's format
        return [self._to_product(p) for p in raw.get('products', [])]
    
    def _to_product(self, raw: dict) -> Product:
        """Convert Gumroad product dict to our Product model."""
        return Product(
            id=raw['id'],
            title=raw['name'],  # Gumroad calls it 'name', we call it 'title'
            price=raw['price'] / 100,  # Gumroad stores cents
            description=raw.get('description', ''),
            tags=raw.get('tags', []),
        )
```

### The Repository Pattern (Database Abstraction)
```python
# Abstract database operations behind a repository interface
# Code never knows if data comes from SQLite, Firestore, or JSON files

class ProductRepository(ABC):
    @abstractmethod
    def find_by_id(self, id: str) -> Optional[Product]: ...
    
    @abstractmethod
    def find_active(self) -> List[Product]: ...
    
    @abstractmethod
    def save(self, product: Product) -> None: ...
    
    @abstractmethod
    def delete(self, id: str) -> None: ...

class SQLiteProductRepository(ProductRepository):
    """Products stored in SQLite."""
    def __init__(self, db: SQLiteDB): self._db = db
    
    def find_by_id(self, id: str) -> Optional[Product]:
        row = self._db.execute_one("SELECT * FROM products WHERE id = ?", (id,))
        return Product.from_dict(row) if row else None
    
    def find_active(self) -> List[Product]:
        rows = self._db.execute("SELECT * FROM products WHERE status = 'active'")
        return [Product.from_dict(r) for r in rows]
    
    def save(self, product: Product) -> None:
        self._db.execute_write(
            "INSERT OR REPLACE INTO products VALUES (:id, :title, :price, :status)",
            product.to_dict()
        )
    
    def delete(self, id: str) -> None:
        self._db.execute_write("DELETE FROM products WHERE id = ?", (id,))
```

---

## 6. SCALABILITY PLANNING

### Scale-First vs Solve-First
```
Current Scale → Right Tool → When to Re-evaluate
─────────────────────────────────────────────────
0–100 requests/day    → Local scripts, JSON files → 1,000 req/day
1K–10K requests/day   → Single server, SQLite      → 100K req/day
100K+ requests/day    → Database server, queues    → 10M req/day
10M+ requests/day     → Distributed system         → Never (re-architect)
```

For Ten Life Creatives at current scale: JSON files and SQLite are correct.
Do NOT over-engineer to Firestore or Postgres until you hit 1K+ daily active users.

### Bottleneck Identification Checklist
Before optimizing, identify the actual bottleneck:
1. **I/O bound**: Waiting for disk reads/writes → async I/O, caching
2. **Network bound**: Waiting for API calls → batching, parallel requests, caching
3. **CPU bound**: Computation is slow → profile, optimize algorithm, parallel processing
4. **Memory bound**: Running out of RAM → streaming, chunking, pagination

---

## 7. TECHNOLOGY SELECTION MATRIX

### Language Choice
```
Python:     Data processing, scripts, PDF generation, automation, APIs
Node.js:    Web servers, real-time features, JavaScript-heavy apps
Bash:       System admin, cron jobs, file operations, deployment
SQL:        Data queries, reporting, analytics
```

### Storage Choice
```
JSON files:      Config, state, <10K records, no relationships
SQLite:          <10M records, relational data, local access only
Firestore:       Multi-device sync, real-time, mobile apps
Postgres:        Complex queries, large datasets, team access
Redis:           Caching, sessions, rate limiting, pub/sub
```

### Task Execution Choice
```
Direct function call:  Simple, synchronous, small tasks
Background thread:     Non-blocking, same process
Cron/APScheduler:      Scheduled recurring tasks
Message queue:         Decoupled async processing, retry logic
GitHub Actions:        CI/CD, triggered workflows, external events
```

---

## 8. DEPENDENCY MANAGEMENT

### Principle of Least Dependency
Before adding a new library:
1. Can this be done with stdlib in <20 lines? If yes → use stdlib
2. Is this library actively maintained? (commits in last 6 months)
3. How many transitive dependencies does it add?
4. What's the security track record?

### Dependency Audit Checklist
```bash
# Python: check for security vulnerabilities
pip install pip-audit
pip-audit

# Check outdated packages
pip list --outdated

# Generate requirements with exact versions
pip freeze > requirements.txt

# Check what uses each package (before removing)
pip show requests | grep Requires
```

### Vendoring Critical Dependencies
For production scripts that must run reliably:
```bash
# Option 1: Pin exact versions
requests==2.31.0
python-dotenv==1.0.1

# Option 2: Vendor the package (copy into your repo)
# Use sparingly — only for truly critical, small deps
# pip download requests --no-deps -d vendor/
```

---

## 9. CONFIGURATION ARCHITECTURE

### The Config Hierarchy
```
Defaults (in code)
  ↓ overridden by
Config file (config.yaml or config.json)
  ↓ overridden by
Environment variables
  ↓ overridden by
CLI arguments
```

### Config Schema Validation
```python
from dataclasses import dataclass, field
from typing import Optional
import os

@dataclass
class AppConfig:
    # Required — will raise if missing
    stripe_key: str = field(default_factory=lambda: os.environ['STRIPE_SECRET_KEY'])
    
    # Optional with defaults
    log_level: str = field(default_factory=lambda: os.getenv('LOG_LEVEL', 'INFO'))
    batch_size: int = field(default_factory=lambda: int(os.getenv('BATCH_SIZE', '100')))
    debug: bool = field(default_factory=lambda: os.getenv('DEBUG', '').lower() == 'true')
    
    # Optional — None if not set
    webhook_url: Optional[str] = field(default_factory=lambda: os.getenv('WEBHOOK_URL'))
    
    def __post_init__(self):
        """Validate config after initialization."""
        if not self.stripe_key.startswith('sk_'):
            raise ValueError("STRIPE_SECRET_KEY looks wrong — should start with 'sk_'")
        if self.batch_size < 1 or self.batch_size > 1000:
            raise ValueError(f"BATCH_SIZE must be 1-1000, got {self.batch_size}")
        if self.log_level not in ('DEBUG', 'INFO', 'WARNING', 'ERROR'):
            raise ValueError(f"Invalid LOG_LEVEL: {self.log_level}")
```

---

## 10. OBSERVABILITY DESIGN

### The Three Pillars
```
Logs:    What happened (structured, searchable)
Metrics: How much/how fast (counters, gauges, timers)
Traces:  Where time was spent (request tracing)
```

### Structured Logging Pattern
```python
import json
import logging

class StructuredLogger:
    """Emit JSON-structured log lines for easy parsing."""
    
    def __init__(self, name: str):
        self._name = name
    
    def _emit(self, level: str, message: str, **context):
        entry = {
            'timestamp': datetime.utcnow().isoformat(),
            'level': level,
            'logger': self._name,
            'message': message,
            **context,
        }
        print(json.dumps(entry))
    
    def info(self, msg, **ctx): self._emit('INFO', msg, **ctx)
    def warn(self, msg, **ctx): self._emit('WARN', msg, **ctx)
    def error(self, msg, **ctx): self._emit('ERROR', msg, **ctx)
    
    def timed(self, operation: str):
        """Context manager for timing operations."""
        import time
        start = time.monotonic()
        yield
        duration_ms = (time.monotonic() - start) * 1000
        self.info(f"{operation} completed", duration_ms=round(duration_ms, 2))

# Usage:
logger = StructuredLogger('ReportGenerator')
with logger.timed('pdf_generation'):
    generate_pdf(data)
```

---

## 11. TEN LIFE CREATIVES SYSTEM PATTERNS

### Platform Integration Architecture
```
                    ┌─────────────────────────────────────┐
                    │        OpenClaw Agent Layer          │
                    │  (Hutch, Closer, Publisher, etc.)    │
                    └──────────────┬──────────────────────┘
                                   │
                    ┌──────────────▼──────────────────────┐
                    │        Service Layer                  │
                    │  (GumroadService, StripeService,      │
                    │   AirtableService, EmailService)      │
                    └──────────────┬──────────────────────┘
                                   │
          ┌───────────────────┬────┴────┬─────────────────┐
          ▼                   ▼         ▼                  ▼
    ┌──────────┐      ┌──────────┐ ┌──────────┐   ┌──────────┐
    │ Gumroad  │      │  Stripe  │ │ Airtable │   │ SendGrid │
    │   API    │      │   API    │ │   API    │   │   API    │
    └──────────┘      └──────────┘ └──────────┘   └──────────┘
```

### Standard Project Structure
```
project/
├── README.md              # Setup and usage guide
├── requirements.txt       # Pinned dependencies
├── .env.example           # Required env vars with comments
├── config.py              # Config loading from env
├── main.py                # Entry point / CLI
├── src/
│   ├── services/          # Business logic
│   │   ├── gumroad.py
│   │   ├── stripe_service.py
│   │   └── report_service.py
│   ├── models/            # Data classes
│   │   └── product.py
│   ├── adapters/          # External API wrappers
│   │   └── gumroad_adapter.py
│   └── utils/             # Shared utilities
│       ├── logging.py
│       └── helpers.py
├── data/                  # Local data files
│   └── .gitkeep
└── tests/
    └── test_services.py
```

---

## 12. ARCHITECTURE DOCUMENTATION

### System Overview Template
```markdown
# [System Name] — Architecture Overview

## Purpose
One sentence: what does this system do?

## Components
| Component | Responsibility | Technology |
|---|---|---|
| main.py | Entry point, CLI | Python |
| ReportService | PDF generation logic | Python + reportlab |
| StripeClient | Stripe API integration | Python + requests |
| ProductDB | Product catalog storage | SQLite |

## Data Flow
[ASCII diagram of how data flows through the system]

## External Dependencies
| Service | Purpose | Auth Method |
|---|---|---|
| Stripe | Payment data | API key |
| SendGrid | Email delivery | API key |

## Configuration
Required environment variables:
- STRIPE_SECRET_KEY: Stripe API key
- SENDGRID_API_KEY: SendGrid API key

## How to Run
[Quick start steps]

## How to Test
[Test instructions]

## Known Limitations
[Current constraints and future improvement opportunities]
```
