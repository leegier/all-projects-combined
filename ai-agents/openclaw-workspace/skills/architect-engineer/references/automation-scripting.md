# Automation & Scripting — Reference Guide

The definitive playbook for cron jobs, shell scripts, batch processes, scheduled tasks, event-driven
automation, file watchers, and pipeline architecture. Everything that runs without a human clicking buttons.

---

## TABLE OF CONTENTS
1. Shell Script Foundations
2. Cron Job Architecture
3. Python Scheduler Patterns
4. Event-Driven Automation
5. File Watcher Patterns
6. Pipeline & ETL Design
7. Task Queue Patterns
8. Webhook-Driven Automation
9. GitHub Actions Workflows
10. Monitoring & Alerting
11. Idempotency Patterns
12. Common Automation Recipes

---

## 1. SHELL SCRIPT FOUNDATIONS

### The Reliable Script Template
```bash
#!/usr/bin/env bash
# =============================================================================
# Script: process_daily_reports.sh
# Purpose: Download, process, and archive daily sales reports
# Usage: ./process_daily_reports.sh [--date YYYY-MM-DD] [--dry-run]
# Cron: 0 6 * * * /path/to/process_daily_reports.sh >> /var/log/reports.log 2>&1
# =============================================================================

set -euo pipefail  # Exit on error, undefined vars, pipe failures
IFS=$'\n\t'        # Safer word splitting

# ── Constants ──────────────────────────────────────────────────────────────
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_NAME="$(basename "$0")"
readonly LOG_FILE="/var/log/${SCRIPT_NAME%.sh}.log"
readonly DATA_DIR="${SCRIPT_DIR}/data"
readonly ARCHIVE_DIR="${SCRIPT_DIR}/archive"

# ── Defaults ───────────────────────────────────────────────────────────────
DATE="${1:-$(date +%Y-%m-%d)}"
DRY_RUN=false

# ── Logging ────────────────────────────────────────────────────────────────
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$1] $2" | tee -a "$LOG_FILE"; }
info()    { log "INFO " "$*"; }
warn()    { log "WARN " "$*" >&2; }
error()   { log "ERROR" "$*" >&2; }
success() { log "OK   " "$*"; }

# ── Cleanup Handler ────────────────────────────────────────────────────────
cleanup() {
    local exit_code=$?
    if [[ $exit_code -ne 0 ]]; then
        error "Script failed with exit code $exit_code"
        # Send alert if configured
        [[ -n "${ALERT_EMAIL:-}" ]] && echo "Script failed: ${SCRIPT_NAME}" | mail -s "CRON FAILURE" "$ALERT_EMAIL"
    fi
    # Remove temp files
    [[ -d "${TEMP_DIR:-}" ]] && rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

# ── Argument Parsing ───────────────────────────────────────────────────────
parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --date)     DATE="$2"; shift 2 ;;
            --dry-run)  DRY_RUN=true; shift ;;
            --help|-h)  usage; exit 0 ;;
            *)          error "Unknown argument: $1"; exit 1 ;;
        esac
    done
}

usage() {
    cat <<EOF
Usage: $SCRIPT_NAME [OPTIONS]

Options:
  --date DATE     Process date (YYYY-MM-DD, default: today)
  --dry-run       Preview actions without executing
  --help          Show this help

Examples:
  $SCRIPT_NAME
  $SCRIPT_NAME --date 2024-01-15
  $SCRIPT_NAME --dry-run
EOF
}

# ── Dependency Check ───────────────────────────────────────────────────────
check_dependencies() {
    local deps=("python3" "curl" "jq")
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &>/dev/null; then
            error "Required dependency not found: $dep"
            exit 1
        fi
    done
}

# ── Lock File (Prevent Concurrent Runs) ───────────────────────────────────
LOCK_FILE="/tmp/${SCRIPT_NAME%.sh}.lock"
acquire_lock() {
    if [[ -f "$LOCK_FILE" ]]; then
        local pid
        pid=$(cat "$LOCK_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            error "Another instance is running (PID: $pid). Exiting."
            exit 1
        else
            warn "Stale lock file found. Removing."
            rm -f "$LOCK_FILE"
        fi
    fi
    echo $$ > "$LOCK_FILE"
    trap 'rm -f "$LOCK_FILE"' EXIT
}

# ── Main ───────────────────────────────────────────────────────────────────
main() {
    parse_args "$@"
    check_dependencies
    acquire_lock
    
    TEMP_DIR=$(mktemp -d)
    info "Starting processing for date: $DATE"
    
    mkdir -p "$DATA_DIR" "$ARCHIVE_DIR"
    
    if $DRY_RUN; then
        info "[DRY RUN] Would process reports for $DATE"
        exit 0
    fi
    
    # Actual work here
    process_reports "$DATE"
    
    success "Completed processing for $DATE"
}

process_reports() {
    local date="$1"
    # ... implementation
}

main "$@"
```

---

## 2. CRON JOB ARCHITECTURE

### Cron Syntax Reference
```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6, 0=Sunday)
│ │ │ │ │
* * * * * command

Common patterns:
  0 6 * * *       Daily at 6:00 AM
  0 6 * * 1       Every Monday at 6:00 AM
  0 */4 * * *     Every 4 hours
  */15 * * * *    Every 15 minutes
  0 9,17 * * 1-5  9 AM and 5 PM on weekdays
  0 0 1 * *       First day of every month
  0 0 * * 0       Every Sunday at midnight
```

### Cron Best Practices
```bash
# 1. Always use full paths in cron jobs (cron has minimal PATH)
# BAD:
0 6 * * * python3 my_script.py

# GOOD:
0 6 * * * /usr/bin/python3 /home/user/scripts/my_script.py

# 2. Redirect output to log files
0 6 * * * /usr/bin/python3 /scripts/daily.py >> /var/log/daily.log 2>&1

# 3. Load environment from .env file in script, not in crontab
# In your script:
from dotenv import load_dotenv
load_dotenv('/home/user/.env')

# 4. Use flock to prevent overlapping runs
0 * * * * /usr/bin/flock -n /tmp/myjob.lock /scripts/hourly.sh

# 5. Add health check ping (e.g., healthchecks.io)
0 6 * * * /scripts/daily.sh && curl -fsS https://hc-ping.com/YOUR-UUID > /dev/null

# 6. Set cron's PATH explicitly at top of crontab
PATH=/usr/local/bin:/usr/bin:/bin
MAILTO=""  # Suppress email output
```

### Crontab Management
```bash
# Edit crontab
crontab -e

# List current crontab
crontab -l

# Backup crontab
crontab -l > ~/crontab-backup-$(date +%Y%m%d).txt

# Install from file
crontab ~/my-crontab.txt

# Remove all cron jobs (CAREFUL)
crontab -r
```

---

## 3. PYTHON SCHEDULER PATTERNS

### APScheduler (Best for Python Apps)
```python
from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.events import EVENT_JOB_ERROR, EVENT_JOB_EXECUTED
import logging

logger = logging.getLogger(__name__)

def setup_scheduler() -> BackgroundScheduler:
    """Configure and return an APScheduler instance."""
    scheduler = BackgroundScheduler(timezone='America/Denver')
    
    # Add error listener
    def on_job_event(event):
        if event.exception:
            logger.error(f"Job {event.job_id} failed: {event.exception}")
        else:
            logger.info(f"Job {event.job_id} executed successfully")
    
    scheduler.add_listener(on_job_event, EVENT_JOB_ERROR | EVENT_JOB_EXECUTED)
    
    return scheduler

# Job definitions
scheduler = setup_scheduler()

# Daily at 6 AM Mountain Time
scheduler.add_job(
    func=daily_report_job,
    trigger=CronTrigger(hour=6, minute=0, timezone='America/Denver'),
    id='daily_report',
    name='Daily Revenue Report',
    max_instances=1,          # Prevent concurrent runs
    coalesce=True,            # If missed, run once (not multiple times)
    misfire_grace_time=3600,  # Allow up to 1 hour late
)

# Every 15 minutes
scheduler.add_job(
    func=health_check_job,
    trigger=IntervalTrigger(minutes=15),
    id='health_check',
    name='System Health Check',
    max_instances=1,
)

# Monday 9 AM
scheduler.add_job(
    func=weekly_strategy_memo,
    trigger=CronTrigger(day_of_week='mon', hour=9, minute=0),
    id='weekly_memo',
    name='Weekly Strategy Memo',
)

scheduler.start()

# Clean shutdown
import signal
def shutdown(signum, frame):
    scheduler.shutdown(wait=True)
    sys.exit(0)

signal.signal(signal.SIGTERM, shutdown)
signal.signal(signal.SIGINT, shutdown)
```

### Simple Schedule Library (Lightweight Alternative)
```python
import schedule
import time
import threading

def run_scheduler():
    """Run schedule in background thread."""
    schedule.every().day.at("06:00").do(daily_job)
    schedule.every().monday.at("09:00").do(weekly_job)
    schedule.every(15).minutes.do(health_check)
    
    while True:
        schedule.run_pending()
        time.sleep(60)  # Check every minute

# Start in background
scheduler_thread = threading.Thread(target=run_scheduler, daemon=True)
scheduler_thread.start()
```

---

## 4. EVENT-DRIVEN AUTOMATION

### File System Events (watchdog)
```python
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileCreatedEvent
from pathlib import Path
import time

class DropFolderHandler(FileSystemEventHandler):
    """Watch a folder and process any files dropped into it."""
    
    def __init__(self, processor_fn, accepted_extensions: list = None):
        self._processor = processor_fn
        self._extensions = accepted_extensions or ['.csv', '.json', '.pdf']
        self._processed = set()  # Track to avoid double-processing
    
    def on_created(self, event):
        if event.is_directory:
            return
        
        path = Path(event.src_path)
        
        # Skip if wrong extension
        if path.suffix.lower() not in self._extensions:
            return
        
        # Skip if already processed
        if str(path) in self._processed:
            return
        
        # Wait for file to finish writing
        time.sleep(0.5)
        if not path.exists() or path.stat().st_size == 0:
            return
        
        logger.info(f"New file detected: {path.name}")
        self._processed.add(str(path))
        
        try:
            self._processor(path)
        except Exception as e:
            logger.error(f"Failed to process {path.name}: {e}")

def watch_folder(folder: Path, processor_fn, recursive: bool = False) -> Observer:
    """Start watching a folder for new files. Returns observer for cleanup."""
    folder.mkdir(parents=True, exist_ok=True)
    
    handler = DropFolderHandler(processor_fn)
    observer = Observer()
    observer.schedule(handler, str(folder), recursive=recursive)
    observer.start()
    
    logger.info(f"Watching folder: {folder}")
    return observer
```

---

## 5. PIPELINE & ETL DESIGN

### Data Pipeline Pattern
```python
from dataclasses import dataclass
from typing import Callable, List, Any
import time

@dataclass
class PipelineStage:
    name: str
    processor: Callable
    skip_on_error: bool = False

class DataPipeline:
    """
    Linear data processing pipeline.
    Each stage transforms data and passes to the next.
    """
    
    def __init__(self, name: str):
        self.name = name
        self.stages: List[PipelineStage] = []
        self.stats = {
            'started_at': None,
            'completed_at': None,
            'records_in': 0,
            'records_out': 0,
            'errors': 0,
            'stages': {},
        }
    
    def add_stage(self, name: str, processor: Callable, skip_on_error: bool = False):
        self.stages.append(PipelineStage(name, processor, skip_on_error))
        return self  # Allow chaining
    
    def run(self, input_data: Any) -> Any:
        """Run all pipeline stages sequentially."""
        self.stats['started_at'] = time.time()
        data = input_data
        
        if isinstance(data, list):
            self.stats['records_in'] = len(data)
        
        for stage in self.stages:
            stage_start = time.time()
            try:
                logger.info(f"[{self.name}] Running stage: {stage.name}")
                data = stage.processor(data)
                self.stats['stages'][stage.name] = {
                    'status': 'success',
                    'duration_s': time.time() - stage_start,
                }
            except Exception as e:
                self.stats['stages'][stage.name] = {
                    'status': 'error',
                    'error': str(e),
                    'duration_s': time.time() - stage_start,
                }
                self.stats['errors'] += 1
                logger.error(f"[{self.name}] Stage '{stage.name}' failed: {e}")
                
                if not stage.skip_on_error:
                    raise
        
        if isinstance(data, list):
            self.stats['records_out'] = len(data)
        self.stats['completed_at'] = time.time()
        
        duration = self.stats['completed_at'] - self.stats['started_at']
        logger.info(f"[{self.name}] Pipeline complete in {duration:.2f}s")
        
        return data

# Example usage:
def build_sales_report_pipeline() -> DataPipeline:
    return (
        DataPipeline("SalesReport")
        .add_stage("fetch_transactions", fetch_from_stripe)
        .add_stage("filter_this_month", lambda data: [d for d in data if is_this_month(d['created'])])
        .add_stage("enrich_with_products", enrich_with_product_data)
        .add_stage("calculate_metrics", calculate_revenue_metrics)
        .add_stage("generate_pdf", generate_report_pdf)
        .add_stage("send_email", send_report_email, skip_on_error=True)
    )
```

---

## 6. TASK QUEUE PATTERNS

### Simple In-Process Queue
```python
import queue
import threading
from typing import Callable
from dataclasses import dataclass, field

@dataclass
class Task:
    id: str
    func: Callable
    args: tuple = field(default_factory=tuple)
    kwargs: dict = field(default_factory=dict)
    priority: int = 5  # Lower = higher priority

class TaskQueue:
    """Simple priority task queue with worker threads."""
    
    def __init__(self, num_workers: int = 2):
        self._queue = queue.PriorityQueue()
        self._workers = []
        self._running = False
        self._num_workers = num_workers
        self._results = {}
        self._lock = threading.Lock()
    
    def start(self):
        self._running = True
        for i in range(self._num_workers):
            worker = threading.Thread(target=self._worker_loop, daemon=True, name=f"Worker-{i}")
            worker.start()
            self._workers.append(worker)
    
    def stop(self, wait: bool = True):
        self._running = False
        if wait:
            self._queue.join()
    
    def submit(self, task: Task):
        self._queue.put((task.priority, task))
    
    def _worker_loop(self):
        while self._running:
            try:
                _, task = self._queue.get(timeout=1)
                try:
                    result = task.func(*task.args, **task.kwargs)
                    with self._lock:
                        self._results[task.id] = {'status': 'done', 'result': result}
                except Exception as e:
                    logger.error(f"Task {task.id} failed: {e}")
                    with self._lock:
                        self._results[task.id] = {'status': 'error', 'error': str(e)}
                finally:
                    self._queue.task_done()
            except queue.Empty:
                continue
```

---

## 7. IDEMPOTENCY PATTERNS

### Idempotent Job Execution
```python
import hashlib
import json
from pathlib import Path
from datetime import datetime, timezone

class JobStateManager:
    """
    Track job execution state to ensure idempotency.
    Jobs that have already run successfully won't run again.
    """
    
    def __init__(self, state_file: Path):
        self._state_file = state_file
        self._state = self._load()
    
    def _load(self) -> dict:
        if self._state_file.exists():
            return json.loads(self._state_file.read_text())
        return {'jobs': {}}
    
    def _save(self):
        self._state_file.parent.mkdir(parents=True, exist_ok=True)
        self._state_file.write_text(json.dumps(self._state, indent=2, default=str))
    
    def job_key(self, job_name: str, params: dict = None) -> str:
        """Generate a unique key for a job + params combination."""
        content = json.dumps({'job': job_name, 'params': params or {}}, sort_keys=True)
        return hashlib.sha256(content.encode()).hexdigest()[:16]
    
    def should_run(self, job_name: str, params: dict = None) -> bool:
        """Return True if this job should run (hasn't succeeded yet today)."""
        key = self.job_key(job_name, params)
        job_state = self._state['jobs'].get(key, {})
        
        if job_state.get('status') != 'success':
            return True
        
        # Check if it ran today
        last_run = job_state.get('completed_at', '')
        if last_run:
            last_run_date = datetime.fromisoformat(last_run).date()
            if last_run_date < datetime.now(timezone.utc).date():
                return True  # New day, run again
        
        return False
    
    def mark_started(self, job_name: str, params: dict = None):
        key = self.job_key(job_name, params)
        self._state['jobs'][key] = {
            'status': 'running',
            'started_at': datetime.now(timezone.utc).isoformat(),
        }
        self._save()
    
    def mark_success(self, job_name: str, params: dict = None, result: dict = None):
        key = self.job_key(job_name, params)
        self._state['jobs'][key] = {
            'status': 'success',
            'completed_at': datetime.now(timezone.utc).isoformat(),
            'result': result or {},
        }
        self._save()
    
    def mark_failure(self, job_name: str, params: dict = None, error: str = None):
        key = self.job_key(job_name, params)
        self._state['jobs'].setdefault(key, {})['status'] = 'failed'
        self._state['jobs'][key]['error'] = error
        self._state['jobs'][key]['failed_at'] = datetime.now(timezone.utc).isoformat()
        self._save()
```

---

## 8. COMMON AUTOMATION RECIPES

### Recipe: Daily Revenue Summary
```python
def daily_revenue_summary():
    """Pull last 24h transactions and email summary."""
    state = JobStateManager(Path('state/jobs.json'))
    
    if not state.should_run('daily_revenue_summary'):
        logger.info("Daily revenue summary already ran today. Skipping.")
        return
    
    state.mark_started('daily_revenue_summary')
    
    try:
        # Fetch data
        transactions = stripe_service.get_last_24h_charges()
        
        # Calculate metrics
        total_revenue = sum(t['amount'] for t in transactions) / 100
        transaction_count = len(transactions)
        
        # Build report
        summary = {
            'date': datetime.now().strftime('%Y-%m-%d'),
            'total_revenue': f"${total_revenue:.2f}",
            'transaction_count': transaction_count,
            'average_order_value': f"${total_revenue/transaction_count:.2f}" if transaction_count else '$0.00',
        }
        
        # Send email
        email_service.send_report(to=OWNER_EMAIL, subject="Daily Revenue Summary", data=summary)
        
        state.mark_success('daily_revenue_summary', result=summary)
        logger.info(f"Daily revenue summary sent: {summary}")
    
    except Exception as e:
        state.mark_failure('daily_revenue_summary', error=str(e))
        raise
```

### Recipe: Auto-Archive Old Files
```bash
#!/usr/bin/env bash
# Archive files older than N days to compressed archive

WATCH_DIR="/data/reports"
ARCHIVE_DIR="/data/archive"
MAX_AGE_DAYS=30
DATE=$(date +%Y%m%d)

mkdir -p "$ARCHIVE_DIR"

# Find and archive old files
find "$WATCH_DIR" -type f -mtime "+$MAX_AGE_DAYS" | while read -r file; do
    relative_path="${file#$WATCH_DIR/}"
    archive_name="${DATE}_$(basename "$file").gz"
    
    gzip -c "$file" > "$ARCHIVE_DIR/$archive_name"
    
    if [[ $? -eq 0 ]]; then
        rm -f "$file"
        echo "Archived: $relative_path → $archive_name"
    else
        echo "ERROR: Failed to archive $file" >&2
    fi
done

# Remove archives older than 1 year
find "$ARCHIVE_DIR" -type f -name "*.gz" -mtime "+365" -delete
```

### Recipe: Sync Files to Remote
```bash
#!/usr/bin/env bash
# Rsync local directory to remote server

SOURCE_DIR="/data/exports/"
REMOTE_HOST="user@backup.server.com"
REMOTE_DIR="/backups/exports/"
LOG_FILE="/var/log/sync.log"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

log "Starting sync..."

rsync \
    --archive \
    --compress \
    --delete \
    --exclude='*.tmp' \
    --exclude='.DS_Store' \
    --log-file="$LOG_FILE" \
    "$SOURCE_DIR" \
    "$REMOTE_HOST:$REMOTE_DIR"

if [[ $? -eq 0 ]]; then
    log "Sync completed successfully"
else
    log "ERROR: Sync failed with exit code $?"
    exit 1
fi
```

---

## 9. MONITORING & ALERTING

### Simple Health Check Monitor
```python
import requests
import smtplib
from email.message import EmailMessage

def check_endpoint_health(url: str, expected_status: int = 200, timeout: int = 10) -> bool:
    """Check if an endpoint is responding correctly."""
    try:
        response = requests.get(url, timeout=timeout)
        return response.status_code == expected_status
    except requests.RequestException:
        return False

def send_alert(subject: str, body: str, to_email: str):
    """Send an email alert."""
    msg = EmailMessage()
    msg['Subject'] = f"[ALERT] {subject}"
    msg['From'] = SMTP_FROM
    msg['To'] = to_email
    msg.set_content(body)
    
    with smtplib.SMTP_SSL(SMTP_HOST, 465) as server:
        server.login(SMTP_USER, SMTP_PASS)
        server.send_message(msg)

def run_health_checks():
    """Run all health checks and alert on failures."""
    checks = [
        ('Main Website', 'https://yoursite.com', 200),
        ('API Health', 'https://api.yoursite.com/health', 200),
        ('Gumroad Webhook', 'https://yoursite.com/webhooks/gumroad', 405),  # 405 = exists but POST only
    ]
    
    failures = []
    for name, url, expected in checks:
        if not check_endpoint_health(url, expected):
            failures.append(f"{name}: {url}")
            logger.error(f"Health check FAILED: {name} ({url})")
    
    if failures:
        send_alert(
            subject="Health Check Failures",
            body=f"The following endpoints are failing:\n\n" + "\n".join(failures),
            to_email=ALERT_EMAIL,
        )
```

---

*Last updated: Ten Life Creatives — Architect Agent Reference Library*
