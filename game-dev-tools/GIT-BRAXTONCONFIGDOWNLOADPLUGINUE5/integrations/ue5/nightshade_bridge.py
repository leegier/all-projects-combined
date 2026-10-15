import requests
import os

MCP_ENDPOINT = os.getenv("NYGHTSHADE_MCP", "http://localhost:8787/mcp")


def call_nightshade(tool_name, payload):
    """Sends a Ludus-style tool call to the MCP server."""
    body = {
        "jsonrpc": "2.0",
        "id": f"ue5-{tool_name}-{payload.get('target', 'unknown')}",
        "method": "tools/call",
        "params": {
            "name": tool_name,
            "arguments": payload
        }
    }

    response = requests.post(MCP_ENDPOINT, json=body, timeout=20)
    response.raise_for_status()
    return response.json()


def format_structured(structured):
    if not structured:
        return "No structured content available."

    lines = ["Structured diff:"]
    diff_lines = structured.get("diff", [])
    if diff_lines:
        lines += [f"  • {line}" for line in diff_lines]

    lines.append("Logs:")
    log_lines = structured.get("logs", [])
    if log_lines:
        lines += [f"  ○ {line}" for line in log_lines]

    lines.append("Affected assets:")
    for asset in structured.get("affectedAssets", []):
        lines.append(f"  - {asset}")

    return "\n".join(lines)


def apply_to_unreal(response_json):
    """Applies structured changes or logs them."""
    structured = response_json.get("result", {}).get("structuredContent")
    summary = format_structured(structured)

    try:
        import unreal  # type: ignore

        unreal.log("[Nightshade] Applying latest tool diff:\n" + summary)
        # TODO: use EditorAssetLibrary/EditorLevelLibrary to apply diffs deterministically.
    except ImportError:
        print("[Nightshade] Unreal unavailable – logging diff only.")
        print(summary)


def bulk_edit_assets(target, modifications, dry_run=True):
    payload = {
        "command": "bulk_edit",
        "target": target,
        "modifications": modifications,
        "dry_run": dry_run
    }
    return call_nightshade("bulk_edit_assets", payload)


def generate_variants(target, count=3, constraints=None):
    payload = {
        "command": "generate_variants",
        "target": target,
        "count": count,
        "constraints": constraints or ["naming_conventions", "balance_budget"]
    }
    return call_nightshade("generate_variants", payload)


def normalize_dps(target, target_dps=25, tolerance=2):
    payload = {
        "command": "normalize_dps",
        "target": target,
        "target_dps": target_dps,
        "tolerance": tolerance,
        "dry_run": True
    }
    return call_nightshade("normalize_dps", payload)


def prefab_audit(target, checks=None):
    payload = {
        "command": "prefab_audit",
        "target": target,
        "checks": checks or ["naming", "collision", "performance"]
    }
    return call_nightshade("prefab_audit", payload)


def scene_refactor(scene, steps=None, dry_run=True):
    payload = {
        "command": "scene_refactor",
        "scene": scene,
        "steps": steps or ["remove_empty_groups", "rebuild_navigation"],
        "dry_run": dry_run
    }
    return call_nightshade("scene_refactor", payload)


def example():
    """Demonstrate several Ludus-style calls."""
    for tool_call in [
        bulk_edit_assets("WeaponAssets", {"damage": 50, "spread": "tight"}, dry_run=True),
        generate_variants("LevelBundles"),
        normalize_dps("WeaponAssets", target_dps=30),
        prefab_audit("PlayerPrefabs"),
        scene_refactor("AutonomousArena")
    ]:
        apply_to_unreal(tool_call)


if __name__ == "__main__":
    example()
