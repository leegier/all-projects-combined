"""
dag.py — Dependency graph resolver.
Given a list of tasks, determines what can run now vs what is blocked.
"""

from typing import Optional


def get_ready_tasks(tasks: list[dict]) -> list[dict]:
    """
    Return all tasks that are pending and have all dependencies satisfied.
    A dependency is satisfied if its status == 'done'.
    """
    done_ids = {t["id"] for t in tasks if t["status"] == "done"}
    pending = [t for t in tasks if t["status"] == "pending"]

    ready = []
    for task in pending:
        deps = task.get("depends_on") or []
        if isinstance(deps, str):
            import json
            deps = json.loads(deps)
        if all(d in done_ids for d in deps):
            ready.append(task)

    return ready


def is_goal_complete(tasks: list[dict]) -> bool:
    """All tasks are done."""
    return bool(tasks) and all(t["status"] == "done" for t in tasks)


def is_goal_failed(tasks: list[dict]) -> bool:
    """Any task failed and nothing is running or pending that can unblock things."""
    failed = {t["id"] for t in tasks if t["status"] == "failed"}
    if not failed:
        return False

    # Check if any pending task depends exclusively on failed tasks
    done_ids = {t["id"] for t in tasks if t["status"] == "done"}
    pending = [t for t in tasks if t["status"] == "pending"]

    # If there are no pending tasks and goal isn't complete, it's failed
    running = [t for t in tasks if t["status"] == "running"]
    if not pending and not running:
        return not is_goal_complete(tasks)

    return False


def topological_order(tasks: list[dict]) -> list[dict]:
    """
    Kahn's algorithm — returns tasks in dependency order (safe execution order).
    Used for visualization / dry-run display. Does not modify task state.
    """
    task_map = {t["id"]: t for t in tasks}
    in_degree = {t["id"]: 0 for t in tasks}
    children: dict[str, list[str]] = {t["id"]: [] for t in tasks}

    for t in tasks:
        deps = t.get("depends_on") or []
        if isinstance(deps, str):
            import json
            deps = json.loads(deps)
        for dep in deps:
            if dep in children:
                children[dep].append(t["id"])
                in_degree[t["id"]] += 1

    queue = [tid for tid, deg in in_degree.items() if deg == 0]
    order = []

    while queue:
        tid = queue.pop(0)
        order.append(task_map[tid])
        for child in children[tid]:
            in_degree[child] -= 1
            if in_degree[child] == 0:
                queue.append(child)

    # Any tasks not in order have a cycle — append them at the end
    ordered_ids = {t["id"] for t in order}
    for t in tasks:
        if t["id"] not in ordered_ids:
            order.append(t)

    return order


def find_cycle(tasks: list[dict]) -> Optional[list[str]]:
    """
    Returns the first cycle found as a list of task IDs, or None if no cycles.
    """
    task_map = {t["id"]: t for t in tasks}
    visited = set()
    stack = set()

    def dfs(tid: str, path: list) -> Optional[list]:
        if tid in stack:
            cycle_start = path.index(tid)
            return path[cycle_start:]
        if tid in visited:
            return None
        visited.add(tid)
        stack.add(tid)
        path.append(tid)

        task = task_map.get(tid)
        if task:
            deps = task.get("depends_on") or []
            if isinstance(deps, str):
                import json
                deps = json.loads(deps)
            for dep in deps:
                result = dfs(dep, path)
                if result:
                    return result

        path.pop()
        stack.discard(tid)
        return None

    for t in tasks:
        if t["id"] not in visited:
            cycle = dfs(t["id"], [])
            if cycle:
                return cycle

    return None
