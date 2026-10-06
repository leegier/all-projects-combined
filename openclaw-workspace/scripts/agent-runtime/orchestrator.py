"""
orchestrator.py — Main runtime loop.
Polls for active goals → plans tasks → executes via DAG → marks complete.
Auto-replenishes goals so MAX never goes idle. Runs all day.
Restart-safe (picks up where it left off via DB state).
"""

import asyncio
import random
import time
import traceback
from db import (
    init_db, get_active_goals, create_goal, update_goal_status,
    get_tasks_for_goal, upsert_task, get_stats,
)
from planner import plan_goal
from dag import get_ready_tasks, is_goal_complete, is_goal_failed
from executor import execute_tasks_parallel

POLL_INTERVAL = 5        # seconds between goal queue checks
MAX_PARALLEL_TASKS = 3   # max tasks running at once per goal
MAX_GOALS_RUNNING = 2    # process this many goals concurrently

# ── Revenue goal templates — MAX cycles through these ────────────────────────
REVENUE_GOALS = [
    # ── Gumroad digital products (highest priority — direct revenue) ──
    (10, "List AI Prompt Vault on Gumroad at $9.99 — read E:/openclaw/workspace/products/ai-prompt-vault/product.md for content, then call gumroad_create_product API with name='AI Prompt Vault', price=999, and a compelling description. Save listing confirmation to E:/openclaw/workspace/revenue-log.md"),
    (10, "List Cold Email Arsenal on Gumroad at $14.99 — read E:/openclaw/workspace/products/cold-email-arsenal/product.md, call gumroad_create_product API with price=1499. Save confirmation."),
    (10, "List Automation Blueprint on Gumroad at $19.99 — read E:/openclaw/workspace/products/automation-blueprint/The-Automation-Blueprint.md, call gumroad_create_product with price=1999."),
    (10, "Package and list ebook-ai-side-hustles on Gumroad at $7.99 — read E:/openclaw/workspace/products/ebook-ai-side-hustles/, create product listing via API."),
    # ── itch.io game upload ──
    (10, "Upload CLAWED demo to itch.io — use itchio_push tool with directory='E:/Dev/UNITY/BETTERNOW/Builds/CLAWED_v0.1' and target='THE-FORGE-IDE-GAMEDEV/clawed:windows'. Log result."),
    # ── Content / SEO articles ──
    (7, "Write and publish dev.to article: 'Building a Prison RPG in Unreal Engine 5' — write 2000+ word article covering the design of The Hollow Penitentiary, Victorian Gothic style, 50K+ assets, UE5.7. Publish via devto_publish_article tool with tags=['gamedev','unrealengine','indiedev','ai']."),
    (7, "Write and publish dev.to article: 'How I Built 60+ AI Agents to Make Money While I Sleep' — cover the OpenClaw platform, MAX orchestrator, sub-agents, local LLMs. Publish via devto_publish_article."),
    (7, "Write and publish dev.to article: 'Running Local LLMs for Game Dev: Ollama + Llama 3.1 Guide' — practical tutorial, cover setup, use cases, performance. Publish via devto_publish_article."),
    (7, "Write and publish dev.to article: 'Autonomous AI Agents That Actually Do Things: Beyond ChatGPT' — cover tool-use agents, DAG execution, real automation. Publish via devto_publish_article."),
    # ── GitHub bounties ──
    (8, "Search GitHub for open bounties — use github_search_bounties tool with query 'label:bounty state:open' and also 'label:reward state:open'. Filter for $50+ bounties. Save findings to E:/openclaw/workspace/bounty-log.md with links, amounts, and difficulty assessment."),
    (8, "Search Anthropic ecosystem for bounties — use github_search_bounties with queries targeting anthropics, modelcontextprotocol, claude-dev orgs. Log actionable bounties to E:/openclaw/workspace/bounty-log.md"),
    # ── Fiverr gig copy ──
    (8, "Write 3 Fiverr gig descriptions and save to E:/openclaw/workspace/fiverr-gigs/ — (1) local-ai-setup.md: Local AI/LLM Setup & Configuration $50-200, (2) ue5-environments.md: UE5 Environment & Level Design $100-500, (3) ai-document-automation.md: AI-Powered Document Automation $25-75. Each needs title, description, FAQ, pricing tiers."),
    # ── Upwork proposals ──
    (6, "Write 3 Upwork proposal templates and save to E:/openclaw/workspace/proposals/ — (1) python-automation.md, (2) ai-integration.md, (3) game-dev.md. Each template should have intro, relevant experience, approach, timeline, pricing."),
    # ── Product README/landing pages ──
    (5, "Create sales README for AI Prompt Vault — write to E:/openclaw/workspace/products/ai-prompt-vault/README.md with product features, pricing ($9.99), use cases, preview of prompts included."),
    (5, "Create sales README for Cold Email Arsenal — write to E:/openclaw/workspace/products/cold-email-arsenal/README.md with product features, templates preview, pricing ($14.99)."),
    # ── Status / reporting ──
    (4, "Send status report via Telegram — use telegram_send tool to message Lee with: completed goals today, revenue actions taken, products listed, articles published, bounties found."),
]

_used_goals = set()  # Track which goals we've already seeded this session


async def auto_replenish_goals():
    """If goal queue is low, seed new revenue goals from templates."""
    global _used_goals
    stats = await get_stats()
    active_count = stats['goals'].get('pending', 0) + stats['goals'].get('running', 0)

    if active_count >= 3:
        return  # Enough work queued

    # Pick goals we haven't used yet, prioritized by priority
    available = [(p, d) for i, (p, d) in enumerate(REVENUE_GOALS) if i not in _used_goals]

    if not available:
        # All goals used — reset and go again
        _used_goals.clear()
        available = list(enumerate(REVENUE_GOALS))
        available = [(p, d) for _, (p, d) in available]

    # Sort by priority descending
    available.sort(key=lambda x: x[0], reverse=True)

    added = 0
    need = 3 - active_count
    for priority, description in available:
        if added >= need:
            break
        goal_id = await create_goal(description, priority)
        # Track which template we used
        for i, (p, d) in enumerate(REVENUE_GOALS):
            if d == description:
                _used_goals.add(i)
                break
        print(f"[Auto-Seed] Goal {goal_id} (pri={priority}): {description[:70]}...")
        added += 1


async def process_goal(goal: dict):
    """Full lifecycle for a single goal: plan → execute → complete."""
    goal_id = goal["id"]
    description = goal["description"]
    print(f"\n[Orchestrator] ▶ Goal {goal_id}: {description[:80]}")

    await update_goal_status(goal_id, "running")

    try:
        # Load existing tasks (restart-safe: skip re-planning if tasks exist)
        tasks = await get_tasks_for_goal(goal_id)
        if not tasks:
            print(f"[Orchestrator]   Planning tasks for goal {goal_id}...")
            planned = await plan_goal(goal_id, description)
            for t in planned:
                await upsert_task(t)
            tasks = await get_tasks_for_goal(goal_id)
            print(f"[Orchestrator]   {len(tasks)} tasks created")

        # DAG execution loop
        max_rounds = 20
        for round_num in range(max_rounds):
            tasks = await get_tasks_for_goal(goal_id)

            if is_goal_complete(tasks):
                print(f"[Orchestrator] ✓ Goal {goal_id} complete ({round_num} rounds)")
                result_summary = _summarize_results(tasks)
                await update_goal_status(goal_id, "completed", result=result_summary)
                return

            if is_goal_failed(tasks):
                failed = [t["id"] for t in tasks if t["status"] == "failed"]
                print(f"[Orchestrator] ✗ Goal {goal_id} failed — stuck tasks: {failed}")
                await update_goal_status(goal_id, "failed")
                return

            ready = get_ready_tasks(tasks)
            if not ready:
                # Nothing ready — wait for running tasks to finish
                running = [t for t in tasks if t["status"] == "running"]
                if running:
                    await asyncio.sleep(2)
                    continue
                else:
                    # Deadlock — no ready, no running, not done, not failed
                    print(f"[Orchestrator] ⚠ Goal {goal_id} deadlocked")
                    await update_goal_status(goal_id, "failed")
                    return

            print(f"[Orchestrator]   Round {round_num+1}: running {len(ready)} tasks: "
                  f"{[t['id'] for t in ready]}")

            await execute_tasks_parallel(
                tasks=ready,
                goal_description=description,
                goal_id=goal_id,
                max_parallel=MAX_PARALLEL_TASKS,
            )

        # Exceeded max rounds
        print(f"[Orchestrator] ⚠ Goal {goal_id} exceeded max rounds — marking failed")
        await update_goal_status(goal_id, "failed")

    except Exception as e:
        print(f"[Orchestrator] ✗ Goal {goal_id} crashed: {e}")
        traceback.print_exc()
        await update_goal_status(goal_id, "failed")


def _summarize_results(tasks: list[dict]) -> str:
    """Concatenate task results into a short summary."""
    parts = []
    for t in tasks:
        if t.get("result"):
            parts.append(f"[{t['id']}] {t['result'][:300]}")
    return "\n---\n".join(parts)[:2000]


async def run():
    """Main orchestrator loop — runs all day, auto-replenishes goals."""
    print("[Orchestrator] Initializing database...")
    await init_db()
    print("[Orchestrator] Runtime started. Polling for goals every "
          f"{POLL_INTERVAL}s...")
    print(f"[Orchestrator] {len(REVENUE_GOALS)} revenue goal templates loaded.")
    print("[Orchestrator] Auto-replenish: ON — MAX will never go idle.\n")

    active_goals: dict[int, asyncio.Task] = {}
    replenish_counter = 0

    while True:
        try:
            # Auto-replenish every 6th poll (30 seconds)
            replenish_counter += 1
            if replenish_counter % 6 == 0:
                await auto_replenish_goals()

            goals = await get_active_goals()
            for goal in goals:
                gid = goal["id"]
                # Skip already-running goals
                if gid in active_goals and not active_goals[gid].done():
                    continue
                # Cap concurrent goals
                running_count = sum(1 for t in active_goals.values() if not t.done())
                if running_count >= MAX_GOALS_RUNNING:
                    break
                # Launch goal processing
                task = asyncio.create_task(process_goal(goal))
                active_goals[gid] = task

            # Cleanup finished tasks
            active_goals = {k: v for k, v in active_goals.items() if not v.done()}

        except Exception as e:
            print(f"[Orchestrator] Poll error: {e}")

        await asyncio.sleep(POLL_INTERVAL)


async def add_goal_cli(description: str, priority: int = 5):
    """Helper: add a goal from the command line."""
    await init_db()
    goal_id = await create_goal(description, priority)
    print(f"Goal created: id={goal_id}")
    return goal_id


async def stats_cli():
    """Helper: print current stats."""
    await init_db()
    s = await get_stats()
    print(f"Goals:  {s['goals']}")
    print(f"Tasks:  {s['tasks']}")
    print(f"Revenue: ${s['total_revenue_usd']:.2f}")


if __name__ == "__main__":
    import sys

    if len(sys.argv) >= 3 and sys.argv[1] == "add":
        description = " ".join(sys.argv[2:])
        asyncio.run(add_goal_cli(description))
    elif len(sys.argv) >= 2 and sys.argv[1] == "stats":
        asyncio.run(stats_cli())
    else:
        asyncio.run(run())
