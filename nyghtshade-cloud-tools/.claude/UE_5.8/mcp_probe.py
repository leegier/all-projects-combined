import socket, json, sys

def send(command, params=None):
    payload = {"type": command, "params": params or {}}
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(20.0)
    s.connect(("127.0.0.1", 55557))
    s.sendall((json.dumps(payload) + "\n").encode("utf-8"))
    buf = ""
    while True:
        chunk = s.recv(8192).decode("utf-8")
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

print("=== PING ===")
try:
    print(json.dumps(send("ping"), indent=2)[:500])
except Exception as e:
    print("PING FAILED:", e); sys.exit(1)

print("\n=== ACTORS IN LEVEL ===")
res = send("get_actors_in_level")
actors = res.get("result", {}).get("actors", []) if isinstance(res.get("result"), dict) else res.get("result", [])
if not isinstance(actors, list):
    actors = []
print("TOTAL ACTORS:", len(actors))
# Summarize by class
from collections import Counter
classes = Counter()
landscape = []
for a in actors:
    cls = a.get("class") or a.get("type") or "?"
    classes[cls] += 1
    nm = (a.get("name") or "")
    if any(k in cls.lower() or k in nm.lower() for k in ["landscape","terrain","prison","tree","water","river","castle"]):
        landscape.append((nm, cls, a.get("location")))
print("\n--- CLASS COUNTS ---")
for cls, n in classes.most_common():
    print(f"{n:5d}  {cls}")
print("\n--- KEY ACTORS (landscape/prison/tree/water/castle) ---")
for nm, cls, loc in landscape[:60]:
    print(f"{cls:28s} {nm:40s} {loc}")
