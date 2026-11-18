import os
import sys
import json
import urllib.request
import urllib.error
import base64
from pathlib import Path

# Fix Windows console encoding
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

API_KEY = os.environ.get("OPENAI_API_KEY", "")
OUT_DIR = Path("Z:/openclaw/workspace/marketing/product-art")
OUT_DIR.mkdir(parents=True, exist_ok=True)

PRODUCTS = [
    {
        "name": "clawed-cover",
        "prompt": "Dark cinematic game cover art for a prison escape survival RPG called CLAWED. A lone prisoner in tattered orange jumpsuit crouching in shadows of a brutal concrete prison corridor, dramatic spotlight from above, guards silhouetted in the background, atmospheric fog, gritty noir style, ultra detailed, game cover composition with space at top for title text, dark color palette with deep blues and orange highlights"
    },
    {
        "name": "clawed-screenshot1",
        "prompt": "3D game screenshot of a dark prison escape game, top-down/isometric view, prisoner character sneaking past guard in dimly lit cell block, concrete walls, security cameras, dramatic lighting, modern game aesthetic, cinematic quality"
    },
    {
        "name": "ai-prompt-vault-cover",
        "prompt": "Sleek futuristic digital product cover art for 'AI Prompt Vault' — a premium collection of AI prompts. Glowing vault door opening to reveal cascading streams of golden text prompts and neural network patterns, deep space dark background, purple and gold color scheme, professional digital product art, sharp clean design"
    },
    {
        "name": "cold-email-arsenal-cover",
        "prompt": "Professional business product cover art for 'Cold Email Arsenal' — a collection of cold email templates. Open laptop with glowing email interface, stacks of gold coins appearing from sent emails, modern minimal design, dark background with electric blue and gold accents, business professional aesthetic, sharp marketing visual"
    },
    {
        "name": "open-lee-cover",
        "prompt": "Futuristic AI technology cover art for 'OPEN-LEE — Multi-AI Consensus Engine'. Multiple AI brain nodes connecting in a neural network pattern, holographic interface showing different AI models voting and converging on one answer, deep blue and cyan color scheme, cutting edge tech aesthetic, clean modern design"
    }
]

def generate_image(prompt, filename):
    print(f"Generating: {filename}...")
    
    data = json.dumps({
        "model": "dall-e-3",
        "prompt": prompt,
        "n": 1,
        "size": "1792x1024",
        "quality": "hd",
        "style": "vivid",
        "response_format": "b64_json"
    }).encode("utf-8")
    
    req = urllib.request.Request(
        "https://api.openai.com/v1/images/generations",
        data=data,
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json"
        }
    )
    
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            img_data = base64.b64decode(result["data"][0]["b64_json"])
            out_path = OUT_DIR / f"{filename}.png"
            out_path.write_bytes(img_data)
            print(f"  ✓ Saved: {out_path}")
            return str(out_path)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"  FAILED HTTP {e.code}: {body[:300]}")
        return None
    except Exception as e:
        print(f"  FAILED: {e}")
        return None

results = []
for product in PRODUCTS:
    path = generate_image(product["prompt"], product["name"])
    results.append({"name": product["name"], "path": path})

print("\n--- SUMMARY ---")
for r in results:
    status = "OK" if r["path"] else "FAIL"
    print(f"  [{status}] {r['name']}: {r['path'] or 'FAILED'}")
