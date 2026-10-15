"""
executor.py — Runs a single task using LLM reasoning + real tool execution.
The LLM decides WHAT to do. The tools actually DO it.
Two-phase execution: Plan → Act.
"""

import json
import re
import time
import traceback
import aiohttp
import asyncio
from db import update_task, store_memory, log_execution, load_memory
from tools import execute_tool, TOOLS

ROUTER_URL = "http://127.0.0.1:11435"
OLLAMA_URL = "http://127.0.0.1:11434"
DEFAULT_MODEL = "llama31-agent:latest"

# Available tools description for the LLM
TOOLS_DESCRIPTION = """You have access to these tools. To use one, respond with a JSON block:
{"tool": "tool_name", "args": {"key": "value"}}

Available tools:
- shell: Run a shell command. Args: command (str), cwd (str, optional)
- write_file: Write content to a file. Args: path (str), content (str)
- read_file: Read a file. Args: path (str)
- append_file: Append to a file. Args: path (str), content (str)
- http_request: Make HTTP request. Args: url (str), method (str), headers (dict), body (dict)
- github_search_bounties: Search GitHub for bounties. Args: query (str)
- github_get_issue: Get issue details. Args: owner (str), repo (str), number (int)
- gumroad_list_products: List Gumroad products. No args.
- gumroad_create_product: Create Gumroad product. Args: name (str), price (int, cents), description (str)
- itchio_push: Upload game to itch.io. Args: directory (str), target (str like 'user/game:channel')
- devto_publish_article: Publish to dev.to. Args: title (str), body_markdown (str), tags (list), published (bool)
- telegram_send: Send Telegram message. Args: message (str)
- log_freelance: Log freelance activity. Args: platform (str), job_title (str), bid_amount (str), status (str)
- write_article: Write article to content pipeline. Args: filename (str), content (str)

IMPORTANT: You must respond with EXACTLY ONE tool call as a JSON object, OR a final answer.
If you are done and have a final answer, respond with: {"done": true, "result": "summary of what was accomplished"}
Do NOT wrap in markdown code blocks. Just raw JSON.
"""

# System prompts per task type — now with tool awareness
SYSTEM_PROMPTS = {
    "research": (
        "You are an autonomous research agent with real tools. "
        "Use http_request to fetch web pages. Use github_search_bounties to find bounties. "
        "Use shell to run CLI commands. Execute real actions, don't just describe them.\n\n"
        + TOOLS_DESCRIPTION
    ),
    "write": (
        "You are an autonomous content writer with real tools. "
        "Use write_file or write_article to save your output. "
        "Use http_request to research topics first. Always save your work to disk.\n\n"
        + TOOLS_DESCRIPTION
    ),
    "code": (
        "You are an autonomous software engineer with real tools. "
        "Use write_file to create code files. Use shell to run builds, tests, installs. "
        "Actually write and execute code, don't just describe it.\n\n"
        + TOOLS_DESCRIPTION
    ),
    "browse": (
        "You are an autonomous web agent with real tools. "
        "Use http_request to fetch web pages and APIs. "
        "Extract real data from responses.\n\n"
        + TOOLS_DESCRIPTION
    ),
    "api": (
        "You are an autonomous API agent with real tools. "
        "Use http_request for API calls. Use gumroad_create_product, itchio_push, "
        "devto_publish_article for platform-specific actions. Execute real API calls.\n\n"
        + TOOLS_DESCRIPTION
    ),
    "analyze": (
        "You are an autonomous analyst with real tools. "
        "Use read_file to read data. Use write_file to save reports. "
        "Produce actionable analysis with real outputs.\n\n"
        + TOOLS_DESCRIPTION
    ),
    "message": (
        "You are an autonomous communication agent with real tools. "
        "Use telegram_send to send messages. Use write_file to save drafts. "
        "Use log_freelance to track proposals.\n\n"
        + TOOLS_DESCRIPTION
    ),
    "execute": (
        "You are an autonomous execution agent with real tools. "
        "Use shell to run commands. Use write_file to save outputs. "
        "Use the platform tools (gumroad, itchio, devto) to publish and sell.\n\n"
        + TOOLS_DESCRIPTION
    ),
}


async def _call_router(messages: list, model_hint: str = None) -> tuple[str, str]:
    """Call model router, return (content, model_used). Falls back to direct Ollama."""
    payload = {
        "messages": messages,
        "max_tokens": 2048,
        "temperature": 0.3,
    }

    # Try router first
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{ROUTER_URL}/v1/chat/completions",
                json=payload,
                timeout=aiohttp.ClientTimeout(total=90),
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    content = data["choices"][0]["message"]["content"]
                    if content and content.strip():
                        return content, data.get("model", "router:auto")
    except Exception:
        pass

    # Direct Ollama fallback
    ollama_payload = {
        "model": model_hint or DEFAULT_MODEL,
        "messages": messages,
        "stream": False,
        "options": {"temperature": 0.3, "num_predict": 2048},
    }
    async with aiohttp.ClientSession() as session:
        async with session.post(
            f"{OLLAMA_URL}/api/chat",
            json=ollama_payload,
            timeout=aiohttp.ClientTimeout(total=120),
        ) as resp:
            resp.raise_for_status()
            data = await resp.json()
            return data["message"]["content"], model_hint or DEFAULT_MODEL


def _extract_tool_call(text: str) -> dict | None:
    """Extract a tool call JSON from LLM response."""
    text = text.strip()

    # Strip markdown code fences if present
    text = re.sub(r'^```(?:json)?\s*', '', text)
    text = re.sub(r'\s*```$', '', text)
    text = text.strip()

    # Try direct parse
    try:
        obj = json.loads(text)
        if isinstance(obj, dict) and ("tool" in obj or "done" in obj):
            return obj
    except json.JSONDecodeError:
        pass

    # Try to find JSON object in text
    match = re.search(r'\{[^{}]*"(?:tool|done)"[^{}]*\}', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    # Try more aggressive extraction — find any JSON object
    for match in re.finditer(r'\{.*?\}', text, re.DOTALL):
        try:
            obj = json.loads(match.group(0))
            if isinstance(obj, dict) and ("tool" in obj or "done" in obj):
                return obj
        except json.JSONDecodeError:
            continue

    return None


MAX_TOOL_ROUNDS = 5  # Max tool calls per task before forcing completion


async def execute_task(task: dict, goal_description: str, memory: dict) -> str:
    """
    Execute a single task using LLM + real tools.
    The LLM plans actions, tools execute them, results feed back.
    Returns result string.
    """
    task_id = task["id"]
    task_type = task.get("type", "analyze")
    description = task["description"]
    goal_id = task["goal_id"]

    system = SYSTEM_PROMPTS.get(task_type, SYSTEM_PROMPTS["analyze"])

    # Build context from memory
    memory_context = ""
    if memory:
        snippets = list(memory.items())[:10]
        memory_context = "\n\nPrior results from this goal:\n" + "\n".join(
            f"- {k}: {str(v)[:200]}" for k, v in snippets
        )

    user_msg = (
        f"Goal: {goal_description}\n\n"
        f"Your current task: {description}\n"
        f"{memory_context}\n\n"
        f"Execute this task NOW using your tools. Do not describe what you would do — actually do it."
    )

    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": user_msg},
    ]

    all_results = []
    t0 = time.time()

    try:
        for round_num in range(MAX_TOOL_ROUNDS):
            content, model_used = await _call_router(messages)

            # Try to extract a tool call
            tool_call = _extract_tool_call(content)

            if tool_call and tool_call.get("done"):
                # LLM says it's done
                result_text = tool_call.get("result", content)
                if all_results:
                    result_text = f"{result_text}\n\nActions taken:\n" + "\n".join(
                        f"- {r}" for r in all_results
                    )
                latency_ms = int((time.time() - t0) * 1000)
                await log_execution(task_id, model_used, user_msg, result_text, True, latency_ms)
                await store_memory(goal_id, f"result:{task_id}", result_text[:500], type_="result")
                await update_task(task_id, status="done", result=result_text, model=model_used)
                return result_text

            elif tool_call and tool_call.get("tool"):
                # Execute the tool
                tool_name = tool_call["tool"]
                tool_args = tool_call.get("args", {})
                print(f"    [Executor] {task_id} round {round_num+1}: {tool_name}({list(tool_args.keys())})")

                tool_result = await execute_tool(tool_name, **tool_args)
                result_str = json.dumps(tool_result, indent=2)[:3000]
                action_summary = f"{tool_name}({', '.join(f'{k}={repr(v)[:50]}' for k,v in tool_args.items())})"
                all_results.append(action_summary)

                # Feed result back to LLM
                messages.append({"role": "assistant", "content": content})
                messages.append({"role": "user", "content": (
                    f"Tool result from {tool_name}:\n{result_str}\n\n"
                    f"Continue with your task. Use another tool or respond with "
                    f'{{"done": true, "result": "summary"}} if finished.'
                )})

            else:
                # LLM didn't use a tool — treat as final answer
                result_text = content
                if all_results:
                    result_text = f"{content}\n\nActions taken:\n" + "\n".join(
                        f"- {r}" for r in all_results
                    )
                latency_ms = int((time.time() - t0) * 1000)
                await log_execution(task_id, model_used, user_msg, result_text, True, latency_ms)
                await store_memory(goal_id, f"result:{task_id}", result_text[:500], type_="result")
                await update_task(task_id, status="done", result=result_text, model=model_used)
                return result_text

        # Hit max rounds — compile what we have
        result_text = f"Max tool rounds reached. Actions completed:\n" + "\n".join(
            f"- {r}" for r in all_results
        )
        latency_ms = int((time.time() - t0) * 1000)
        await log_execution(task_id, model_used, user_msg, result_text, True, latency_ms)
        await store_memory(goal_id, f"result:{task_id}", result_text[:500], type_="result")
        await update_task(task_id, status="done", result=result_text, model=model_used)
        return result_text

    except Exception as e:
        latency_ms = int((time.time() - t0) * 1000)
        error_msg = f"{str(e)}\n{traceback.format_exc()}"
        await log_execution(task_id, "unknown", user_msg, "", False, latency_ms)
        await update_task(task_id, status="failed", error=error_msg[:1000])
        raise RuntimeError(f"Task {task_id} failed: {error_msg[:200]}")


async def execute_tasks_parallel(
    tasks: list[dict],
    goal_description: str,
    goal_id: int,
    max_parallel: int = 3,
) -> dict[str, str]:
    """Execute multiple independent tasks in parallel (up to max_parallel)."""
    memory = await load_memory(goal_id)
    results = {}

    for task in tasks:
        await update_task(task["id"], status="running")

    semaphore = asyncio.Semaphore(max_parallel)

    async def run_one(task):
        async with semaphore:
            try:
                result = await execute_task(task, goal_description, memory)
                results[task["id"]] = result
            except RuntimeError as e:
                results[task["id"]] = f"ERROR: {e}"

    await asyncio.gather(*[run_one(t) for t in tasks])
    return results
