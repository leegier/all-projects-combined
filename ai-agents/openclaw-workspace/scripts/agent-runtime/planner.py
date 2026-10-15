"""
planner.py — LLM-powered task decomposer.
Given a goal description, asks the model to break it into ordered tasks with
dependencies. Returns a validated list ready to upsert into the DB.
"""

import json
import re
import uuid
import aiohttp

OLLAMA_URL = "http://127.0.0.1:11434"
ROUTER_URL = "http://127.0.0.1:11435"

PLAN_SYSTEM = """You are a task planning engine for an autonomous agent that has REAL tools.
The agent can: run shell commands, write files, make HTTP requests, call GitHub/Gumroad/itch.io/dev.to APIs,
send Telegram messages, and upload products. Plan tasks that USE these capabilities.

DO NOT plan tasks that just "research" or "analyze" — plan tasks that EXECUTE real actions.
Every task should produce a tangible output: a file written, an API call made, a product listed, a message sent.

Return ONLY a JSON array. No markdown, no explanation, just the array.

Each task object:
{
  "id": "t_<short_slug>",
  "description": "Specific action to execute (be concrete — name the tool, API, or command)",
  "type": "research|write|code|browse|api|analyze|message|execute",
  "depends_on": ["t_other_id"]   // empty array if no deps
}

Task types:
- execute: Run commands, upload products, call platform APIs (DEFAULT — use this most)
- api: Platform-specific API calls (Gumroad, itch.io, dev.to, GitHub)
- write: Write articles, copy, product descriptions (saves to disk)
- code: Write and run code/scripts
- research: ONLY when you genuinely need to look something up first
- message: Send notifications (Telegram, Discord)
- browse: Fetch web pages via HTTP
- analyze: Last resort — only if no action is possible

Rules:
- 3-8 tasks per goal (no busywork)
- depends_on must only reference IDs in the same plan
- Prefer "execute" and "api" types — these DO things
- IDs must be unique, slug-style (t_upload_itchio, t_create_gumroad_product, etc.)
"""


async def call_llm(prompt: str, system: str = PLAN_SYSTEM) -> str:
    """Try router first, fall back to direct Ollama."""
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": prompt},
    ]
    payload = {"messages": messages, "max_tokens": 1024, "temperature": 0.3}

    # Try router
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{ROUTER_URL}/v1/chat/completions",
                json=payload,
                timeout=aiohttp.ClientTimeout(total=30),
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    content = data["choices"][0]["message"]["content"]
                    if content and content.strip():
                        return content
    except Exception:
        pass

    # Fall back to direct Ollama (llama31-agent)
    ollama_payload = {
        "model": "llama31-agent:latest",
        "messages": messages,
        "stream": False,
        "options": {"temperature": 0.3, "num_predict": 1024},
    }
    async with aiohttp.ClientSession() as session:
        async with session.post(
            f"{OLLAMA_URL}/api/chat",
            json=ollama_payload,
            timeout=aiohttp.ClientTimeout(total=60),
        ) as resp:
            resp.raise_for_status()
            data = await resp.json()
            return data["message"]["content"]


def _extract_json(text: str) -> list:
    """Pull JSON array out of LLM response even if surrounded by prose."""
    # Try direct parse first
    text = text.strip()
    try:
        result = json.loads(text)
        if isinstance(result, list):
            return result
    except json.JSONDecodeError:
        pass

    # Extract from code fence
    fence = re.search(r"```(?:json)?\s*(\[.*?\])\s*```", text, re.DOTALL)
    if fence:
        return json.loads(fence.group(1))

    # Extract bare array
    match = re.search(r"\[.*\]", text, re.DOTALL)
    if match:
        return json.loads(match.group(0))

    raise ValueError(f"No JSON array found in LLM response: {text[:200]}")


VALID_TYPES = {"research", "write", "code", "browse", "api", "analyze", "message", "execute"}


def _validate_tasks(tasks: list, goal_id: int) -> list:
    """Normalize and validate task list. Assigns goal_id, ensures unique IDs."""
    seen_ids = set()
    valid = []

    for t in tasks:
        if not isinstance(t, dict):
            continue

        task_id = str(t.get("id", "")).strip()
        if not task_id or not re.match(r"^t_[\w-]+$", task_id):
            task_id = f"t_{uuid.uuid4().hex[:8]}"

        # Deduplicate IDs
        if task_id in seen_ids:
            task_id = f"{task_id}_{uuid.uuid4().hex[:4]}"
        seen_ids.add(task_id)

        task_type = t.get("type", "analyze")
        if task_type not in VALID_TYPES:
            task_type = "analyze"

        depends_on = t.get("depends_on", [])
        if not isinstance(depends_on, list):
            depends_on = []

        valid.append({
            "id": task_id,
            "goal_id": goal_id,
            "description": str(t.get("description", "")).strip()[:500],
            "type": task_type,
            "depends_on": depends_on,
        })

    return valid


async def plan_goal(goal_id: int, description: str) -> list[dict]:
    """
    Decompose a goal into tasks.
    Returns a list of task dicts ready for db.upsert_task().
    """
    prompt = f"Goal: {description}\n\nDecompose this into tasks."
    raw = await call_llm(prompt)
    tasks_raw = _extract_json(raw)
    tasks = _validate_tasks(tasks_raw, goal_id)

    if not tasks:
        # Fallback: single task if planner returns nothing usable
        tasks = [{
            "id": f"t_{uuid.uuid4().hex[:8]}",
            "goal_id": goal_id,
            "description": description,
            "type": "analyze",
            "depends_on": [],
        }]

    return tasks
