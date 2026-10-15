# Database Operations — Reference Guide

Patterns for JSON file storage, SQLite, Firebase/Firestore, and Airtable. Covers data modeling, queries,
migrations, backup strategies, and schema design for small-to-medium scale systems.

---

## TABLE OF CONTENTS
1. Tool Selection Guide
2. JSON File Storage (Simple State)
3. SQLite Patterns
4. Firebase / Firestore
5. Airtable as Database
6. Data Modeling Principles
7. Schema Design Patterns
8. Query Patterns
9. Migration Strategies
10. Backup & Recovery
11. Performance Optimization
12. Common Data Operations

---

## 1. TOOL SELECTION GUIDE

| Use Case | Best Tool | Reason |
|---|---|---|
| Simple config/state (<1MB) | JSON files | Zero setup, version-controllable |
| Local app with relational data | SQLite | No server, ACID compliant, fast |
| Multi-device sync, real-time | Firestore | Managed, offline-capable, scalable |
| Non-technical user access | Airtable | GUI, formulas, good API |
| Complex analytics | SQLite or Postgres | SQL query power |
| Prototype / proof of concept | JSON files | Iterate fastest |
| Production API backend | Firestore or Postgres | Scalable, managed |

### Decision Tree
```
Is the data accessed by multiple devices/users in real-time?
  YES → Firestore
  NO → Is it just configuration or simple state?
    YES → JSON files
    NO → Is it relational data with complex queries?
      YES → SQLite (local) or Postgres (hosted)
      NO → Does a non-technical user need to view/edit it?
        YES → Airtable
        NO → SQLite
```

---

## 2. JSON FILE STORAGE

### Complete JSON Storage Manager
```python
import json
import fcntl  # File locking (Unix)
import shutil
from pathlib import Path
from datetime import datetime
from typing import Optional, List, Any
import threading

class JSONStore:
    """
    Thread-safe JSON file storage with locking, backup, and atomic writes.
    
    Usage:
        store = JSONStore(Path('data/products.json'))
        store.set('products', [{'id': 1, 'name': 'Test'}])
        products = store.get('products', default=[])
    """
    
    def __init__(self, filepath: Path, auto_backup: bool = False):
        self._filepath = Path(filepath)
        self._auto_backup = auto_backup
        self._lock = threading.RLock()
        self._filepath.parent.mkdir(parents=True, exist_ok=True)
    
    def _load_raw(self) -> dict:
        """Load raw JSON data from disk."""
        if not self._filepath.exists():
            return {}
        try:
            with open(self._filepath, 'r', encoding='utf-8') as f:
                return json.load(f)
        except json.JSONDecodeError as e:
            raise ValueError(f"Corrupted JSON in {self._filepath}: {e}")
    
    def _save_raw(self, data: dict) -> None:
        """Atomically save data to disk."""
        # Write to temp file first
        tmp_path = self._filepath.with_suffix('.tmp')
        with open(tmp_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False, default=str)
        # Atomic rename
        tmp_path.replace(self._filepath)
    
    def get(self, key: str, default: Any = None) -> Any:
        """Get a top-level key from the store."""
        with self._lock:
            data = self._load_raw()
            return data.get(key, default)
    
    def set(self, key: str, value: Any) -> None:
        """Set a top-level key in the store."""
        with self._lock:
            if self._auto_backup:
                self._backup()
            data = self._load_raw()
            data[key] = value
            data['_updated_at'] = datetime.utcnow().isoformat()
            self._save_raw(data)
    
    def update(self, key: str, updates: dict) -> None:
        """Merge updates into a dict stored at key."""
        with self._lock:
            data = self._load_raw()
            existing = data.get(key, {})
            if not isinstance(existing, dict):
                raise TypeError(f"Cannot update non-dict value at '{key}'")
            existing.update(updates)
            data[key] = existing
            self._save_raw(data)
    
    def delete(self, key: str) -> bool:
        """Delete a key. Returns True if it existed."""
        with self._lock:
            data = self._load_raw()
            if key in data:
                del data[key]
                self._save_raw(data)
                return True
            return False
    
    def all(self) -> dict:
        """Return entire store contents."""
        with self._lock:
            return self._load_raw()
    
    def _backup(self) -> None:
        """Create a timestamped backup before modifying."""
        if self._filepath.exists():
            backup_path = self._filepath.with_suffix(f'.{datetime.now().strftime("%Y%m%d%H%M%S")}.bak')
            shutil.copy2(self._filepath, backup_path)
            # Keep only last 5 backups
            backups = sorted(self._filepath.parent.glob(f'{self._filepath.stem}.*.bak'))
            for old_backup in backups[:-5]:
                old_backup.unlink()


class JSONRecordStore:
    """
    JSON storage optimized for lists of records (like a simple collection).
    Each record must have an 'id' field.
    """
    
    def __init__(self, filepath: Path):
        self._store = JSONStore(filepath)
        self._collection_key = 'records'
    
    def _records(self) -> list:
        return self._store.get(self._collection_key, [])
    
    def find_by_id(self, record_id: str) -> Optional[dict]:
        """Find record by id. Returns None if not found."""
        return next((r for r in self._records() if r.get('id') == record_id), None)
    
    def find(self, predicate) -> List[dict]:
        """Find all records matching a predicate function."""
        return [r for r in self._records() if predicate(r)]
    
    def insert(self, record: dict) -> dict:
        """Insert a new record. Assigns id if missing."""
        if 'id' not in record:
            import uuid
            record['id'] = str(uuid.uuid4())
        record['created_at'] = datetime.utcnow().isoformat()
        records = self._records()
        records.append(record)
        self._store.set(self._collection_key, records)
        return record
    
    def update_by_id(self, record_id: str, updates: dict) -> Optional[dict]:
        """Update fields of a record by id. Returns updated record or None."""
        records = self._records()
        for i, record in enumerate(records):
            if record.get('id') == record_id:
                records[i] = {**record, **updates, 'updated_at': datetime.utcnow().isoformat()}
                self._store.set(self._collection_key, records)
                return records[i]
        return None
    
    def delete_by_id(self, record_id: str) -> bool:
        """Delete record by id. Returns True if deleted."""
        records = self._records()
        new_records = [r for r in records if r.get('id') != record_id]
        if len(new_records) < len(records):
            self._store.set(self._collection_key, new_records)
            return True
        return False
    
    def count(self) -> int:
        return len(self._records())
```

---

## 3. SQLITE PATTERNS

### Database Manager
```python
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import List, Dict, Optional, Any

class SQLiteDB:
    """
    Production-ready SQLite manager with connection pooling,
    migrations, and full CRUD operations.
    """
    
    def __init__(self, db_path: Path, enable_wal: bool = True):
        self._path = Path(db_path)
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db(enable_wal)
    
    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self._path), timeout=10)
        conn.row_factory = sqlite3.Row  # Dict-like row access
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("PRAGMA journal_mode = WAL")   # Concurrent reads
        conn.execute("PRAGMA synchronous = NORMAL")  # Safe + faster
        return conn
    
    @contextmanager
    def transaction(self):
        """Context manager for database transactions."""
        conn = self._connect()
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
    
    def execute(self, sql: str, params: tuple = ()) -> List[Dict]:
        """Execute a query and return results as list of dicts."""
        with self.transaction() as conn:
            cursor = conn.execute(sql, params)
            return [dict(row) for row in cursor.fetchall()]
    
    def execute_one(self, sql: str, params: tuple = ()) -> Optional[Dict]:
        """Execute and return first result or None."""
        results = self.execute(sql, params)
        return results[0] if results else None
    
    def execute_write(self, sql: str, params: tuple = ()) -> int:
        """Execute a write query. Returns lastrowid."""
        with self.transaction() as conn:
            cursor = conn.execute(sql, params)
            return cursor.lastrowid
    
    def execute_many(self, sql: str, params_list: List[tuple]) -> int:
        """Execute a write query for multiple rows. Returns rows affected."""
        with self.transaction() as conn:
            cursor = conn.executemany(sql, params_list)
            return cursor.rowcount
    
    def _init_db(self, enable_wal: bool):
        """Run schema migrations on startup."""
        with self.transaction() as conn:
            if enable_wal:
                conn.execute("PRAGMA journal_mode = WAL")
            self._run_migrations(conn)
    
    def _run_migrations(self, conn: sqlite3.Connection):
        """Run pending schema migrations."""
        # Create migrations tracking table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS _migrations (
                id INTEGER PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                applied_at TEXT NOT NULL
            )
        """)
        
        # Get applied migrations
        applied = {row[0] for row in conn.execute("SELECT name FROM _migrations")}
        
        # Apply pending migrations in order
        for migration in self.get_migrations():
            if migration['name'] not in applied:
                conn.executescript(migration['sql'])
                conn.execute(
                    "INSERT INTO _migrations (name, applied_at) VALUES (?, datetime('now'))",
                    (migration['name'],)
                )
    
    def get_migrations(self) -> List[Dict]:
        """Override in subclass to define schema migrations."""
        return []


class ProductDatabase(SQLiteDB):
    """Product catalog database for Ten Life Creatives."""
    
    def get_migrations(self):
        return [
            {
                'name': '001_create_products',
                'sql': """
                    CREATE TABLE IF NOT EXISTS products (
                        id TEXT PRIMARY KEY,
                        title TEXT NOT NULL,
                        description TEXT,
                        price REAL NOT NULL CHECK(price >= 0),
                        category TEXT,
                        status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'active', 'archived')),
                        gumroad_id TEXT UNIQUE,
                        created_at TEXT NOT NULL DEFAULT (datetime('now')),
                        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
                    );
                    CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
                    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
                """
            },
            {
                'name': '002_create_sales',
                'sql': """
                    CREATE TABLE IF NOT EXISTS sales (
                        id TEXT PRIMARY KEY,
                        product_id TEXT NOT NULL REFERENCES products(id),
                        amount REAL NOT NULL,
                        currency TEXT DEFAULT 'usd',
                        customer_email TEXT,
                        platform TEXT,
                        sale_date TEXT NOT NULL,
                        created_at TEXT NOT NULL DEFAULT (datetime('now'))
                    );
                    CREATE INDEX IF NOT EXISTS idx_sales_product ON sales(product_id);
                    CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
                """
            },
        ]
    
    def get_product(self, product_id: str) -> Optional[Dict]:
        return self.execute_one("SELECT * FROM products WHERE id = ?", (product_id,))
    
    def get_active_products(self) -> List[Dict]:
        return self.execute("SELECT * FROM products WHERE status = 'active' ORDER BY title")
    
    def upsert_product(self, product: dict) -> None:
        self.execute_write("""
            INSERT INTO products (id, title, description, price, category, status, gumroad_id)
            VALUES (:id, :title, :description, :price, :category, :status, :gumroad_id)
            ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                description = excluded.description,
                price = excluded.price,
                status = excluded.status,
                updated_at = datetime('now')
        """, product)
    
    def get_revenue_by_period(self, start_date: str, end_date: str) -> Dict:
        result = self.execute_one("""
            SELECT 
                COUNT(*) as transaction_count,
                SUM(amount) as total_revenue,
                AVG(amount) as avg_order_value,
                COUNT(DISTINCT customer_email) as unique_customers
            FROM sales
            WHERE sale_date BETWEEN ? AND ?
        """, (start_date, end_date))
        return result or {}
```

---

## 4. FIREBASE / FIRESTORE

### Firestore Client
```python
import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore_v1 import CollectionReference, DocumentSnapshot
from typing import List, Dict, Optional, Any
from datetime import datetime

def init_firestore(service_account_path: str = None) -> firestore.Client:
    """Initialize Firestore client."""
    if not firebase_admin._apps:
        if service_account_path:
            cred = credentials.Certificate(service_account_path)
        else:
            cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred)
    return firestore.client()

class FirestoreCollection:
    """
    Simplified Firestore collection operations.
    """
    
    def __init__(self, db: firestore.Client, collection_name: str):
        self._db = db
        self._name = collection_name
        self._collection = db.collection(collection_name)
    
    def get_by_id(self, doc_id: str) -> Optional[Dict]:
        doc = self._collection.document(doc_id).get()
        if doc.exists:
            return {'id': doc.id, **doc.to_dict()}
        return None
    
    def create(self, data: dict, doc_id: str = None) -> str:
        """Create document. Returns document ID."""
        data = {**data, 'created_at': firestore.SERVER_TIMESTAMP}
        if doc_id:
            self._collection.document(doc_id).set(data)
            return doc_id
        else:
            ref = self._collection.add(data)[1]
            return ref.id
    
    def update(self, doc_id: str, updates: dict) -> None:
        updates['updated_at'] = firestore.SERVER_TIMESTAMP
        self._collection.document(doc_id).update(updates)
    
    def delete(self, doc_id: str) -> None:
        self._collection.document(doc_id).delete()
    
    def query(self, filters: List[tuple] = None, order_by: str = None, 
              limit: int = None) -> List[Dict]:
        """
        Query with filters. Each filter is (field, operator, value).
        Operators: ==, !=, <, <=, >, >=, in, array_contains
        """
        query = self._collection
        
        if filters:
            for field, op, value in filters:
                query = query.where(field, op, value)
        
        if order_by:
            desc = order_by.startswith('-')
            field = order_by.lstrip('-')
            direction = firestore.Query.DESCENDING if desc else firestore.Query.ASCENDING
            query = query.order_by(field, direction=direction)
        
        if limit:
            query = query.limit(limit)
        
        return [{'id': doc.id, **doc.to_dict()} for doc in query.stream()]
    
    def batch_create(self, records: List[dict]) -> List[str]:
        """Create multiple documents in a batch."""
        batch = self._db.batch()
        ids = []
        
        for i, record in enumerate(records):
            ref = self._collection.document()
            batch.set(ref, {**record, 'created_at': firestore.SERVER_TIMESTAMP})
            ids.append(ref.id)
            
            # Firestore batch limit is 500
            if (i + 1) % 499 == 0:
                batch.commit()
                batch = self._db.batch()
        
        batch.commit()
        return ids
    
    def listen(self, callback, filters: List[tuple] = None):
        """Real-time listener for collection changes."""
        query = self._collection
        if filters:
            for field, op, value in filters:
                query = query.where(field, op, value)
        
        def on_snapshot(docs, changes, read_time):
            for change in changes:
                doc_data = {'id': change.document.id, **change.document.to_dict()}
                callback(change.type.name, doc_data)
        
        return query.on_snapshot(on_snapshot)
```

---

## 5. AIRTABLE AS DATABASE

### Airtable Record Manager
```python
class AirtableCollection:
    """Treat an Airtable table as a simple database collection."""
    
    def __init__(self, client: AirtableClient, table_name: str):
        self._client = client
        self._table = table_name
    
    def find_all(self, filter_formula: str = None) -> List[Dict]:
        """Return all records as simplified dicts."""
        records = self._client.list_records(self._table, filter_formula)
        return [self._flatten(r) for r in records]
    
    def find_by_field(self, field: str, value: str) -> Optional[Dict]:
        """Find first record where field equals value."""
        formula = f"{{{field}}}='{value}'"
        records = self.find_all(filter_formula=formula)
        return records[0] if records else None
    
    def create(self, fields: dict) -> Dict:
        record = self._client.create_record(self._table, fields)
        return self._flatten(record)
    
    def update(self, record_id: str, fields: dict) -> Dict:
        record = self._client.update_record(self._table, record_id, fields)
        return self._flatten(record)
    
    def _flatten(self, record: dict) -> dict:
        """Flatten Airtable record to simple dict with id field."""
        return {'id': record['id'], **record.get('fields', {})}
```

---

## 6. DATA MODELING PRINCIPLES

### Naming Conventions
```
Tables/Collections:  plural, snake_case (products, sales_transactions, email_subscribers)
Columns/Fields:     snake_case (first_name, created_at, product_id)
IDs:                Always string, preferably UUIDs or platform IDs
Timestamps:         ISO 8601 format: "2024-01-15T14:30:00Z"
Status fields:      Use enums with explicit valid values
Booleans:          is_active, has_paid, was_refunded (prefix with verb)
Foreign keys:       parent_table_name + _id (product_id, customer_id)
```

### Standard Field Patterns
```python
# Every table should have:
STANDARD_FIELDS = {
    'id':         'TEXT PRIMARY KEY',           # Unique identifier
    'created_at': "TEXT DEFAULT (datetime('now'))",  # Creation timestamp
    'updated_at': "TEXT DEFAULT (datetime('now'))",  # Last modification
}

# Soft delete pattern (don't actually delete data)
SOFT_DELETE_FIELDS = {
    'deleted_at': 'TEXT',                        # NULL = active
    'is_deleted': 'INTEGER DEFAULT 0',
}
```

---

## 7. BACKUP & RECOVERY

### Automated Backup Script
```python
import shutil
import gzip
from datetime import datetime
from pathlib import Path

def backup_sqlite_db(db_path: Path, backup_dir: Path, keep_n: int = 7) -> Path:
    """Create compressed backup of SQLite database."""
    backup_dir.mkdir(parents=True, exist_ok=True)
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_name = f"{db_path.stem}_{timestamp}.db.gz"
    backup_path = backup_dir / backup_name
    
    # Compress and copy
    with open(db_path, 'rb') as f_in:
        with gzip.open(backup_path, 'wb') as f_out:
            shutil.copyfileobj(f_in, f_out)
    
    # Prune old backups
    existing = sorted(backup_dir.glob(f"{db_path.stem}_*.db.gz"))
    for old_backup in existing[:-keep_n]:
        old_backup.unlink()
    
    return backup_path

def restore_sqlite_backup(backup_path: Path, target_path: Path) -> None:
    """Restore a compressed backup to target path."""
    # Safety: rename existing to .bak first
    if target_path.exists():
        target_path.rename(target_path.with_suffix('.db.bak'))
    
    with gzip.open(backup_path, 'rb') as f_in:
        with open(target_path, 'wb') as f_out:
            shutil.copyfileobj(f_in, f_out)
```

---

## 8. PERFORMANCE OPTIMIZATION

### SQLite Performance Tips
```python
# 1. Use WAL mode (allows concurrent reads while writing)
conn.execute("PRAGMA journal_mode = WAL")

# 2. Create indexes on frequently queried columns
conn.execute("CREATE INDEX idx_sales_date ON sales(sale_date)")
conn.execute("CREATE INDEX idx_products_status ON products(status)")

# 3. Use parameterized queries (security + performance)
# BAD: f"SELECT * FROM products WHERE id = '{product_id}'"
# GOOD:
cursor.execute("SELECT * FROM products WHERE id = ?", (product_id,))

# 4. Batch inserts instead of row-by-row
conn.executemany("INSERT INTO sales VALUES (?, ?, ?)", [(r['id'], r['amount'], r['date']) for r in records])

# 5. Use EXPLAIN QUERY PLAN to understand slow queries
results = conn.execute("EXPLAIN QUERY PLAN SELECT * FROM sales WHERE sale_date > ?", ('2024-01-01',))
for row in results:
    print(row)

# 6. Limit what you SELECT — don't SELECT * in production
# BAD: SELECT * FROM products  
# GOOD: SELECT id, title, price FROM products WHERE status = 'active'

# 7. Vacuum periodically to reclaim space
conn.execute("VACUUM")
```

---

*Last updated: Ten Life Creatives — Architect Agent Reference Library*
