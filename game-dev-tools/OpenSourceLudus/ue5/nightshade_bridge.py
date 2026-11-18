import json
import urllib.request

MCP_ENDPOINT = "http://localhost:8787/mcp"


def call_tool(tool_name, arguments, endpoint=MCP_ENDPOINT):
    payload = {
        "jsonrpc": "2.0",
        "id": "nightshade-ue5",
        "method": "tools/call",
        "params": {
            "name": tool_name,
            "arguments": arguments,
        },
    }

    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        endpoint,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def run_prefab_audit(target="WeaponAssets"):
    arguments = {
        "command": "prefab_audit",
        "target": target,
        "checks": ["naming", "collision", "performance"],
    }
    return call_tool("prefab_audit", arguments)


def run_scene_refactor(scene="Arena", dry_run=True):
    arguments = {
        "command": "scene_refactor",
        "scene": scene,
        "steps": ["remove_empty_groups", "rebuild_navigation"],
        "dry_run": dry_run,
    }
    return call_tool("scene_refactor", arguments)


def run_bulk_edit(target="WeaponAssets"):
    arguments = {
        "command": "bulk_edit_assets",
        "target": target,
        "modifications": {"damage": 42, "range": 120},
        "dry_run": True,
    }
    return call_tool("bulk_edit_assets", arguments)


if __name__ == "__main__":
    print("Running prefab audit...")
    print(json.dumps(run_prefab_audit(), indent=2))
