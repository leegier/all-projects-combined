"""Reusable client for the UnrealMCP socket bridge (127.0.0.1:55557)."""
import socket, json

HOST, PORT = "127.0.0.1", 55557

def send(command, params=None, timeout=30.0):
    payload = {"type": command, "params": params or {}}
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(timeout)
    s.connect((HOST, PORT))
    s.sendall((json.dumps(payload) + "\n").encode("utf-8"))
    buf = ""
    while True:
        chunk = s.recv(16384).decode("utf-8")
        if not chunk:
            break
        buf += chunk
        try:
            res = json.loads(buf.strip())
            s.close()
            return res
        except json.JSONDecodeError:
            continue
    s.close()
    return {"status": "error", "error": "incomplete"}

if __name__ == "__main__":
    import sys
    # Inspect a few existing trees: mesh path + transform
    res = send("get_actors_in_level")
    actors = res.get("result", {}).get("actors", []) if isinstance(res.get("result"), dict) else res.get("result", [])
    if not isinstance(actors, list):
        actors = []
    trees = [a for a in actors if "Foliage_Tree" in (a.get("name") or "")]
    print(f"Found {len(trees)} Foliage_Tree actors. Inspecting first 6:\n")
    for t in trees[:6]:
        nm = t.get("name")
        props = send("get_actor_properties", {"name": nm})
        pr = props.get("result", {})
        # Try to surface mesh + transform compactly
        mesh = None
        for key in ("StaticMesh", "static_mesh", "mesh"):
            if isinstance(pr, dict) and key in pr:
                mesh = pr[key]; break
        print(f"--- {nm} ---")
        print("  location:", t.get("location"), " rotation:", t.get("rotation"), " scale:", t.get("scale"))
        # dump compact props keys
        if isinstance(pr, dict):
            keys = list(pr.keys())
            print("  prop keys:", keys[:25])
            if mesh: print("  MESH:", mesh)
            # print any value containing a /Game/ path
            for k, v in pr.items():
                if isinstance(v, str) and "/Game/" in v:
                    print(f"    {k} = {v}")
                elif isinstance(v, dict):
                    for kk, vv in v.items():
                        if isinstance(vv, str) and "/Game/" in vv:
                            print(f"    {k}.{kk} = {vv}")
        print()
