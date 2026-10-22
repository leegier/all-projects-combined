"""
db.py — SQLite persistence layer for MAX agent runtime.
Goals, tasks, executions, memory. Everything survives restart.
"""

import aiosqlite
import json
import time
from pathlib import Path

DB_PATH = Path(__file__).parent / "runtime.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    priority INTEGER DEFAULT 5,
    created_at REAL,
    updated_at REAL,
    completed_at REAL,
    result TEXT
);

CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    goal_id INTEGER,
    description TEXT,
    type TEXT,
    depends_on TEXT DEFAULT '[]',
    status TEXT DEFAULT 'pending',
    result TEXT,
    error TEXT,
    model_used TEXT,
    attempts INTEGER DEFAULT 0,
    created_at REAL,
    completed_at REAL,
    FOREIGN KEY (goal_id) REFERENCES goals(id)
);

CREATE TABLE IF NOT EXISTS executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT,
    model TEXT,
    input TEXT,
    output TEXT,
    success INTEGER,
    latency_ms INTEGER,
    timestamp REAL
);

CREATE TABLE IF NOT EXISTS memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    goal_id INTEGER,
    key TEXT,
    value TEXT,
    type TEXT DEFAULT 'fact',
    created_at REAL
);

CREATE TABLE IF NOT EXISTS revenue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT,
    amount_usd REAL,
    description TEXT,
    timestamp REAL
);
"""


async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.executescript(SCHEMA)
        await db.commit()


async def create_goal(description: str, priority: int = 5) -> int:
    async with aiosqlite.connect(DB_PATH) as db:
        now = time.time()
        cursor = await db.execute(
            "INSERT INTO goals (description, status, priority, created_at, updated_at) VALUES (?, 'pending', ?, ?, ?)",
            (description, priority, now, now)
        )
        await db.commit()
        return cursor.lastrowid


async def get_active_goals():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM goals WHERE status IN ('pending', 'running') ORDER BY priority DESC, created_at ASC"
        )
        return [dict(r) for r in await cursor.fetchall()]


async def update_goal_status(goal_id: int, status: str, result: str = None):
    async with aiosqlite.connect(DB_PATH) as db:
        now = time.time()
        if status == 'completed':
            await db.execute(
                "UPDATE goals SET status=?, updated_at=?, completed_at=?, result=? WHERE id=?",
                (status, now, now, result, goal_id)
            )
        else:
            await db.execute(
                "UPDATE goals SET status=?, updated_at=? WHERE id=?",
                (status, now, goal_id)
            )
        await db.commit()


async def upsert_task(task: dict):
    async with aiosqlite.connect(DB_PATH) as db:
        now = time.time()
        await db.execute("""
            INSERT INTO tasks (id, goal_id, description, type, depends_on, status, created_at)
            VALUES (:id, :goal_id, :description, :type, :depends_on, 'pending', :now)
            ON CONFLICT(id) DO UPDATE SET description=:description
        """, {**task, 'depends_on': json.dumps(task.get('depends_on', [])), 'now': now})
        await db.commit()


async def get_tasks_for_goal(goal_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM tasks WHERE goal_id=?", (goal_id,))
        rows = [dict(r) for r in await cursor.fetchall()]
        for r in rows:
            r['depends_on'] = json.loads(r.get('depends_on') or '[]')
        return rows


async def update_task(task_id: str, status: str, result: str = None, error: str = None, model: str = None):
    async with aiosqlite.connect(DB_PATH) as db:
        now = time.time()
        await db.execute(
            "UPDATE tasks SET status=?, result=?, error=?, model_used=?, attempts=attempts+1, completed_at=? WHERE id=?",
            (status, result, error, model, now if status in ('done', 'failed') else None, task_id)
        )
        await db.commit()


async def store_memory(goal_id: int, key: str, value: str, type_: str = 'fact'):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO memory (goal_id, key, value, type, created_at) VALUES (?, ?, ?, ?, ?)",
            (goal_id, key, value, type_, time.time())
        )
        await db.commit()


async def load_memory(goal_id: int) -> dict:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT key, value FROM memory WHERE goal_id=? ORDER BY created_at DESC LIMIT 50",
            (goal_id,)
        )
        return {r['key']: r['value'] for r in await cursor.fetchall()}


async def log_execution(task_id: str, model: str, input_: str, output: str, success: bool, latency_ms: int):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO executions (task_id, model, input, output, success, latency_ms, timestamp) VALUES (?,?,?,?,?,?,?)",
            (task_id, model, input_[:2000], output[:2000] if output else '', 1 if success else 0, latency_ms, time.time())
        )
        await db.commit()


async def log_revenue(source: str, amount: float, description: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO revenue (source, amount_usd, description, timestamp) VALUES (?, ?, ?, ?)",
            (source, amount, description, time.time())
        )
        await db.commit()


async def get_stats():
    async with aiosqlite.connect(DB_PATH) as db:
        goals = (await (await db.execute("SELECT COUNT(*), status FROM goals GROUP BY status")).fetchall())
        tasks = (await (await db.execute("SELECT COUNT(*), status FROM tasks GROUP BY status")).fetchall())
        revenue = (await (await db.execute("SELECT SUM(amount_usd) FROM revenue")).fetchone())[0] or 0.0
        return {
            'goals': {r[1]: r[0] for r in goals},
            'tasks': {r[1]: r[0] for r in tasks},
            'total_revenue_usd': revenue,
        }
