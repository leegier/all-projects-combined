import sys
import json
import urllib.request
import urllib.parse
import time
from pathlib import Path

# Fix Windows console encoding
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

OUT_DIR = Path("Z:/openclaw/workspace/marketing/product-art")
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Pollinations.ai — free, no auth, no rate limit issues
# URL format: https://image.pollinations.ai/prompt/{encoded_prompt}?width=1792&height=1024&model=flux&seed=42&nologo=true

PRODUCTS = [
    {
        "name": "clawed-cover",
        "prompt": "Dark cinematic game cover art, prison escape survival RPG, lone prisoner in orange jumpsuit crouching in shadows of brutal concrete prison corridor, dramatic spotlight from above, guards silhouetted in background, atmospheric fog, gritty noir style, ultra detailed, dark color palette with deep blues and orange highlights, 4k game cover"
    },
    {
        "name": "clawed-gameplay",
        "prompt": "3D game screenshot top-down view prison escape game, prisoner character sneaking past guard in dimly lit cell block, concrete walls, security cameras, dramatic lighting, modern game aesthetic, cinematic quality, dark atmospheric"
    },
    {
        "name": "ai-prompt-vault-cover",
        "prompt": "Sleek futuristic digital product cover art for AI Prompt Vault, glowing vault door opening revealing cascading streams of golden text and neural network patterns, deep space dark background, purple and gold color scheme, professional digital product marketing art, sharp clean design"
    },
    {
        "name": "cold-email-cover",
        "prompt": "Professional business product cover art for Cold Email Arsenal, open laptop with glowing email interface, stacks of gold coins appearing from sent emails, modern minimal design, dark background with electric blue and gold accents, business professional aesthetic, sharp marketing visual"
    },
    {
        "name": "openlee-cover",
        "prompt": "Futuristic AI technology cover art for Multi-AI Consensus Engine, multiple AI brain nodes connecting in neural network, holographic interface showing different AI models converging on one answer, deep blue and cyan color scheme, cutting edge tech aesthetic, clean modern design"
    }
]

def generate_image(prompt, filename, seed=42):
    print(f"Generating: {filename}...")
    encoded = urllib.parse.quote(prompt)
    url = f"https://image.pollinations.ai/prompt/{encoded}?width=1792&height=1024&model=flux&seed={seed}&nologo=true&enhance=true"
    
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            img_data = resp.read()
            if len(img_data) < 10000:
                print(f"  WARN: Image too small ({len(img_data)} bytes), may have failed")
            out_path = OUT_DIR / f"{filename}.jpg"
            out_path.write_bytes(img_data)
            print(f"  OK: Saved {out_path} ({len(img_data)//1024}KB)")
            return str(out_path)
    except Exception as e:
        print(f"  FAILED: {e}")
        return None

results = []
for i, product in enumerate(PRODUCTS):
    path = generate_image(product["prompt"], product["name"], seed=i*17+42)
    results.append({"name": product["name"], "path": path})
    if i < len(PRODUCTS) - 1:
        time.sleep(2)  # Be polite

print("\n--- SUMMARY ---")
for r in results:
    status = "OK" if r["path"] else "FAIL"
    print(f"  [{status}] {r['name']}: {r['path'] or 'FAILED'}")
