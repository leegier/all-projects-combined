"""
tools.py — Real execution tools for MAX.
These give MAX the ability to actually DO things: run commands, write files,
make HTTP requests, call platform APIs, and upload products.
"""

import asyncio
import aiohttp
import json
import os
import subprocess
import time
from pathlib import Path

# ── Paths ─────────────────────────────────────────────────────────────────────
WORKSPACE = Path("E:/openclaw/workspace")
PRODUCTS_DIR = WORKSPACE / "products"
BUTLER_BIN = WORKSPACE / "butler-bin" / "windows-amd64" / "butler.exe"
OUTPUT_DIR = WORKSPACE / "output"
FREELANCE_LOG = WORKSPACE / "freelance-log.md"
CONTENT_DIR = WORKSPACE / "content-pipeline" / "output"

# ── Credentials (loaded once) ────────────────────────────────────────────────
_creds = None

def _load_creds():
    global _creds
    if _creds is None:
        creds_path = WORKSPACE / "credentials.json"
        if creds_path.exists():
            _creds = json.loads(creds_path.read_text())
        else:
            _creds = {}
    return _creds


# ── Shell execution ──────────────────────────────────────────────────────────

async def run_shell(command: str, cwd: str = None, timeout: int = 120) -> dict:
    """Run a shell command and return stdout/stderr/exit code."""
    try:
        proc = await asyncio.create_subprocess_shell(
            command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=cwd or str(WORKSPACE),
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        return {
            "exit_code": proc.returncode,
            "stdout": stdout.decode("utf-8", errors="replace")[:5000],
            "stderr": stderr.decode("utf-8", errors="replace")[:2000],
        }
    except asyncio.TimeoutError:
        proc.kill()
        return {"exit_code": -1, "stdout": "", "stderr": "TIMEOUT"}
    except Exception as e:
        return {"exit_code": -1, "stdout": "", "stderr": str(e)}


# ── File I/O ─────────────────────────────────────────────────────────────────

async def write_file(path: str, content: str) -> dict:
    """Write content to a file, creating dirs as needed."""
    try:
        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")
        return {"success": True, "path": str(p), "size": len(content)}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def read_file(path: str) -> dict:
    """Read a file and return its contents."""
    try:
        p = Path(path)
        if not p.exists():
            return {"success": False, "error": f"File not found: {path}"}
        content = p.read_text(encoding="utf-8", errors="replace")
        return {"success": True, "content": content[:10000]}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def append_file(path: str, content: str) -> dict:
    """Append content to a file."""
    try:
        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        with open(p, "a", encoding="utf-8") as f:
            f.write(content)
        return {"success": True, "path": str(p)}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ── HTTP requests ────────────────────────────────────────────────────────────

async def http_request(url: str, method: str = "GET", headers: dict = None,
                       body: dict = None, timeout: int = 30) -> dict:
    """Make an HTTP request and return status + body."""
    try:
        async with aiohttp.ClientSession() as session:
            kwargs = {"timeout": aiohttp.ClientTimeout(total=timeout)}
            if headers:
                kwargs["headers"] = headers
            if body and method.upper() in ("POST", "PUT", "PATCH"):
                kwargs["json"] = body

            async with session.request(method.upper(), url, **kwargs) as resp:
                text = await resp.text()
                return {
                    "status": resp.status,
                    "body": text[:5000],
                    "headers": dict(resp.headers),
                }
    except Exception as e:
        return {"status": 0, "error": str(e)}


# ── GitHub API ───────────────────────────────────────────────────────────────

async def github_search_bounties(query: str = "label:bounty state:open") -> dict:
    """Search GitHub issues for bounties."""
    creds = _load_creds()
    token = creds.get("platforms", {}).get("github", {}).get("pat_1", "")
    headers = {"Authorization": f"token {token}", "Accept": "application/vnd.github.v3+json"}
    url = f"https://api.github.com/search/issues?q={query}&per_page=20&sort=created&order=desc"
    return await http_request(url, headers=headers)


async def github_get_issue(owner: str, repo: str, number: int) -> dict:
    """Get details of a specific GitHub issue."""
    creds = _load_creds()
    token = creds.get("platforms", {}).get("github", {}).get("pat_1", "")
    headers = {"Authorization": f"token {token}", "Accept": "application/vnd.github.v3+json"}
    url = f"https://api.github.com/repos/{owner}/{repo}/issues/{number}"
    return await http_request(url, headers=headers)


# ── Gumroad API ──────────────────────────────────────────────────────────────

async def gumroad_list_products() -> dict:
    """List all Gumroad products."""
    creds = _load_creds()
    token = creds.get("platforms", {}).get("gumroad", {}).get("access_token", "")
    url = f"https://api.gumroad.com/v2/products?access_token={token}"
    return await http_request(url)


async def gumroad_create_product(name: str, price: int, description: str,
                                  preview_url: str = None) -> dict:
    """Create a new product on Gumroad. Price in cents."""
    creds = _load_creds()
    token = creds.get("platforms", {}).get("gumroad", {}).get("access_token", "")
    body = {
        "access_token": token,
        "name": name,
        "price": price,
        "description": description,
    }
    if preview_url:
        body["preview_url"] = preview_url
    return await http_request(
        "https://api.gumroad.com/v2/products",
        method="POST",
        body=body,
    )


# ── itch.io Butler ───────────────────────────────────────────────────────────

async def itchio_push(directory: str, target: str) -> dict:
    """Push a directory to itch.io using butler.
    target format: 'user/game:channel' e.g. 'THE-FORGE-IDE-GAMEDEV/clawed:windows'
    """
    creds = _load_creds()
    api_key = creds.get("platforms", {}).get("itchio", {}).get("api_key", "")
    env = os.environ.copy()
    env["BUTLER_API_KEY"] = api_key

    cmd = f'"{BUTLER_BIN}" push "{directory}" "{target}"'
    try:
        proc = await asyncio.create_subprocess_shell(
            cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=300)
        return {
            "exit_code": proc.returncode,
            "stdout": stdout.decode("utf-8", errors="replace")[:3000],
            "stderr": stderr.decode("utf-8", errors="replace")[:2000],
        }
    except asyncio.TimeoutError:
        return {"exit_code": -1, "stderr": "Butler upload timed out"}
    except Exception as e:
        return {"exit_code": -1, "stderr": str(e)}


# ── dev.to API ───────────────────────────────────────────────────────────────

async def devto_publish_article(title: str, body_markdown: str,
                                 tags: list = None, published: bool = True) -> dict:
    """Publish an article to dev.to."""
    # dev.to API key should be in credentials
    creds = _load_creds()
    api_key = creds.get("platforms", {}).get("devto", {}).get("api_key", "")
    if not api_key:
        # Try environment
        api_key = os.environ.get("DEVTO_API_KEY", "")

    headers = {
        "api-key": api_key,
        "Content-Type": "application/json",
    }
    body = {
        "article": {
            "title": title,
            "body_markdown": body_markdown,
            "published": published,
            "tags": tags or ["gamedev", "ai", "programming"],
        }
    }
    return await http_request(
        "https://dev.to/api/articles",
        method="POST",
        headers=headers,
        body=body,
    )


# ── Telegram notifications ───────────────────────────────────────────────────

async def telegram_send(message: str) -> dict:
    """Send a message via MAX's Telegram bot."""
    creds = _load_creds()
    token = creds.get("platforms", {}).get("telegram", {}).get("bot_token", "")
    # First get the chat ID by checking updates
    url = f"https://api.telegram.org/bot{token}/getUpdates"
    updates = await http_request(url)

    # Try to extract chat_id from last message
    chat_id = None
    try:
        data = json.loads(updates.get("body", "{}"))
        results = data.get("result", [])
        if results:
            chat_id = results[-1].get("message", {}).get("chat", {}).get("id")
    except:
        pass

    if not chat_id:
        return {"success": False, "error": "No chat_id found — Lee needs to /start the bot first"}

    send_url = f"https://api.telegram.org/bot{token}/sendMessage"
    return await http_request(
        send_url,
        method="POST",
        body={"chat_id": chat_id, "text": message, "parse_mode": "Markdown"},
    )


# ── Freelance log ────────────────────────────────────────────────────────────

async def log_freelance_activity(platform: str, job_title: str, bid_amount: str,
                                  status: str, notes: str = "") -> dict:
    """Log freelance activity to the tracking file."""
    entry = (
        f"\n| {time.strftime('%Y-%m-%d %H:%M')} | {platform} | {job_title} | "
        f"{bid_amount} | {status} | {notes} |"
    )
    return await append_file(str(FREELANCE_LOG), entry)


# ── Content pipeline ─────────────────────────────────────────────────────────

async def write_article(filename: str, content: str) -> dict:
    """Write an article to the content pipeline output."""
    path = CONTENT_DIR / filename
    return await write_file(str(path), content)


# ── Tool dispatcher ──────────────────────────────────────────────────────────

TOOLS = {
    "shell": run_shell,
    "write_file": write_file,
    "read_file": read_file,
    "append_file": append_file,
    "http_request": http_request,
    "github_search_bounties": github_search_bounties,
    "github_get_issue": github_get_issue,
    "gumroad_list_products": gumroad_list_products,
    "gumroad_create_product": gumroad_create_product,
    "itchio_push": itchio_push,
    "devto_publish_article": devto_publish_article,
    "telegram_send": telegram_send,
    "log_freelance": log_freelance_activity,
    "write_article": write_article,
}


async def execute_tool(tool_name: str, **kwargs) -> dict:
    """Execute a named tool with kwargs. Returns result dict."""
    if tool_name not in TOOLS:
        return {"error": f"Unknown tool: {tool_name}. Available: {list(TOOLS.keys())}"}
    try:
        result = await TOOLS[tool_name](**kwargs)
        return result
    except Exception as e:
        return {"error": f"Tool {tool_name} failed: {str(e)}"}
