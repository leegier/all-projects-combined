"""
Product covers v2 — improved based on design critique:
- Remove prices from covers
- Fix text contrast (white/bright titles on all)
- Fill Cold Email title (no hollow text)
- Better visual hierarchy and readability at thumbnail size
- Add mock preview elements to digital products
"""
import sys, io, math, random
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

from PIL import Image, ImageDraw, ImageFilter, ImageFont
from pathlib import Path

OUT = Path("Z:/openclaw/workspace/marketing/product-art")
OUT.mkdir(parents=True, exist_ok=True)

W, H = 1280, 640

def lerp_color(c1, c2, t):
    return tuple(int(c1[i] + (c2[i]-c1[i])*t) for i in range(3))

def gradient_bg(draw, w, h, c1, c2, c3=None):
    for i in range(h):
        t = i / h
        if c3 and t > 0.5:
            c = lerp_color(c2, c3, (t-0.5)*2)
        else:
            c = lerp_color(c1, c2, t * (2 if c3 else 1))
        draw.line([(0,i),(w,i)], fill=c)

def get_font(size, bold=False):
    paths = [
        "C:/Windows/Fonts/arialbd.ttf",
        "C:/Windows/Fonts/calibrib.ttf",
        "C:/Windows/Fonts/trebucbd.ttf",
        "C:/Windows/Fonts/verdanab.ttf",
        "C:/Windows/Fonts/arial.ttf",
    ]
    for p in paths:
        try:
            return ImageFont.truetype(p, size)
        except:
            pass
    return ImageFont.load_default()

def centered_text(draw, y, text, font, fill, w=W, stroke_fill=None, stroke_width=0):
    bbox = draw.textbbox((0,0), text, font=font)
    tw = bbox[2] - bbox[0]
    x = (w - tw) // 2
    if stroke_fill and stroke_width:
        draw.text((x,y), text, font=font, fill=fill, stroke_width=stroke_width, stroke_fill=stroke_fill)
    else:
        draw.text((x,y), text, font=font, fill=fill)

def shadow_text(draw, x, y, text, font, fill=(255,255,255), shadow=(0,0,0), offset=3):
    draw.text((x+offset, y+offset), text, font=font, fill=shadow)
    draw.text((x, y), text, font=font, fill=fill)

def centered_shadow(draw, y, text, font, fill, w=W, shadow=(0,0,0)):
    bbox = draw.textbbox((0,0), text, font=font)
    tw = bbox[2] - bbox[0]
    x = (w - tw) // 2
    draw.text((x+3, y+3), text, font=font, fill=shadow)
    draw.text((x, y), text, font=font, fill=fill)

# ============================================================
# 1. CLAWED — Dark prison escape game (improved)
# ============================================================
def make_clawed():
    img = Image.new('RGB', (W, H))
    draw = ImageDraw.Draw(img)
    
    gradient_bg(draw, W, H, (8,5,18), (18,22,55), (4,8,22))
    
    # Prison bars
    for x in range(0, W, 75):
        draw.rectangle([x-3, 0, x+3, H], fill=(150,130,80))
        draw.rectangle([x-2, 0, x+2, H], fill=(100,85,50))
    
    # Horizontal bar
    for bary in [H//3, H*2//3]:
        draw.rectangle([0, bary-6, W, bary+6], fill=(130,110,65))
    
    # Orange spotlight
    overlay = Image.new('RGBA', (W, H), (0,0,0,0))
    od = ImageDraw.Draw(overlay)
    for r in range(350, 0, -5):
        a = max(0, int(35 * (1 - r/350)))
        od.ellipse([W//2-r*1.8, -r//2, W//2+r*1.8, r], fill=(255,120,20,a))
    img.paste(img, mask=Image.new('L', (W,H), 0))
    base = img.convert('RGBA')
    base.alpha_composite(overlay)
    img = base.convert('RGB')
    draw = ImageDraw.Draw(img)
    
    # Dark vignette
    vig = Image.new('RGBA', (W, H), (0,0,0,0))
    vd = ImageDraw.Draw(vig)
    for r in range(min(W,H)//2, 0, -10):
        a = max(0, int(120 * (1 - r/(min(W,H)//2))))
        vd.ellipse([W//2-r, H//2-r, W//2+r, H//2+r], fill=(0,0,0,a))
    # Flip the vignette to darken edges
    img_rgba = img.convert('RGBA')
    # Instead just darken edges
    for y in range(H):
        for step in range(80):
            if y < step or y > H-step:
                t = 1 - y/80 if y < 80 else 1 - (H-y)/80
    
    # Title - big, white with orange stroke — very readable
    f_huge = get_font(150, bold=True)
    f_sub = get_font(38)
    f_tag = get_font(26)
    
    centered_text(draw, H//2 - 115, "CLAWED", f_huge, (255,255,255), 
                  stroke_fill=(200,70,0), stroke_width=5)
    centered_text(draw, H//2 + 60, "PRISON ESCAPE SURVIVAL RPG", f_sub, (255,200,120),
                  stroke_fill=(0,0,0), stroke_width=2)
    centered_text(draw, H - 55, "EARLY ACCESS  |  WINDOWS", f_tag, (160,140,100))
    
    # Alpha badge
    badge_x = W - 170
    draw.rectangle([badge_x, H-55, badge_x+150, H-15], fill=(220,80,0))
    draw.text((badge_x+10, H-48), "v0.1 ALPHA", font=get_font(24, bold=True), fill=(255,255,255))
    
    path = OUT / "clawed-cover.png"
    img.save(path, quality=95)
    print(f"  OK: clawed-cover.png")

# ============================================================
# 2. AI Prompt Vault — bright title, show product preview
# ============================================================
def make_prompt_vault():
    img = Image.new('RGB', (W, H))
    draw = ImageDraw.Draw(img)
    
    gradient_bg(draw, W, H, (12,5,35), (28,12,70), (8,18,45))
    
    # Subtle grid
    for x in range(0, W, 55):
        draw.line([(x,0),(x,H)], fill=(100,50,180,), width=1)
    for y in range(0, H, 55):
        draw.line([(0,y),(W,y)], fill=(100,50,180), width=1)
    
    # Central glow
    ov = Image.new('RGBA', (W,H),(0,0,0,0))
    od = ImageDraw.Draw(ov)
    for r in range(280,0,-10):
        a = max(0, int(50*(1-r/280)))
        od.ellipse([W//2-r,H//2+10-r,W//2+r,H//2+10+r], fill=(130,50,255,a))
    img_rgba = img.convert('RGBA')
    img_rgba.alpha_composite(ov)
    img = img_rgba.convert('RGB')
    draw = ImageDraw.Draw(img)
    
    # Vault hexagon — larger, more defined
    cx, cy = W//2, H//2 + 30
    size = 150
    pts = [(cx+int(size*math.cos(math.radians(60*i-90))),
            cy+int(size*math.sin(math.radians(60*i-90)))) for i in range(6)]
    draw.polygon(pts, outline=(220,160,255), fill=(20,8,55))
    # Gear ring
    size2 = 115
    pts2 = [(cx+int(size2*math.cos(math.radians(60*i-90))),
             cy+int(size2*math.sin(math.radians(60*i-90)))) for i in range(6)]
    draw.polygon(pts2, outline=(255,220,100), fill=(30,12,65))
    # Lock body
    draw.ellipse([cx-22,cy-32,cx+22,cy+10], outline=(255,220,100), width=4)
    draw.rectangle([cx-18,cy+5,cx+18,cy+35], fill=(255,220,100))
    draw.ellipse([cx-7,cy+10,cx+7,cy+25], fill=(50,20,100))
    
    # Floating prompt cards on the sides — pushed down to avoid subtitle overlap
    f_card = get_font(16)
    cards = [
        (50, 260, "Write a killer hook for..."),
        (50, 310, "Act as a senior copywriter..."),
        (50, 360, "Summarize this in 3 bullets:"),
        (W-380, 260, "Generate 10 startup ideas..."),
        (W-380, 310, "You are a cold email expert..."),
        (W-380, 360, "Rewrite this for LinkedIn:"),
    ]
    for cx2, cy2, txt in cards:
        draw.rectangle([cx2, cy2, cx2+300, cy2+34], fill=(30,15,65), outline=(150,80,255))
        draw.text((cx2+10, cy2+8), txt, font=f_card, fill=(200,170,255))
    
    # Title — WHITE, big, readable
    f_huge = get_font(110, bold=True)
    f_sub = get_font(32)
    f_tag = get_font(24)
    
    # Use character spacing fix — draw word by word
    title_parts = ["AI  PROMPT  VAULT"]
    centered_text(draw, 28, "AI  PROMPT  VAULT", f_huge, (255,255,255),
                  stroke_fill=(100,30,200), stroke_width=4)
    centered_text(draw, 145, "500+ BATTLE-TESTED PROMPTS FOR ANY TASK", f_sub, (220,190,255),
                  stroke_fill=(0,0,0), stroke_width=2)
    centered_text(draw, H-48, "ChatGPT  |  Claude  |  Gemini  |  Any AI", f_tag, (160,130,220))
    
    path = OUT / "ai-prompt-vault-cover.png"
    img.save(path, quality=95)
    print(f"  OK: ai-prompt-vault-cover.png")

# ============================================================
# 3. Cold Email Arsenal — SOLID filled title, premium feel
# ============================================================
def make_cold_email():
    img = Image.new('RGB', (W, H))
    draw = ImageDraw.Draw(img)
    
    gradient_bg(draw, W, H, (3,12,25), (8,28,48), (2,18,38))
    
    # Subtle circuit traces
    random.seed(42)
    for _ in range(30):
        x = random.randint(0, W)
        y = random.randint(0, H)
        l = random.randint(30, 150)
        if random.random() > 0.5:
            draw.line([(x,y),(x+l,y)], fill=(0,140,100), width=1)
        else:
            draw.line([(x,y),(x,y+l)], fill=(0,140,100), width=1)
    
    # Right side: layered email mockups
    for i in range(5, 0, -1):
        bx = W - 400 + i*12
        by = 140 + i*15
        draw.rectangle([bx, by, bx+320, by+220],
                       fill=(8,35,55), outline=(0,160,120))
        # Fake email header lines
        draw.rectangle([bx+10, by+15, bx+200, by+28], fill=(0,180,130))
        draw.rectangle([bx+10, by+40, bx+280, by+50], fill=(30,60,70))
        draw.rectangle([bx+10, by+60, bx+250, by+70], fill=(25,55,65))
        draw.rectangle([bx+10, by+80, bx+230, by+90], fill=(25,55,65))
    
    # Dollar signs — moved to bottom-right to avoid title collision
    f_dollar = get_font(55, bold=True)
    for dx, dy in [(W-95, H-160),(W-60, H-210),(W-135, H-180)]:
        draw.text((dx+2,dy+2), "$", font=f_dollar, fill=(0,0,0))
        draw.text((dx,dy), "$", font=f_dollar, fill=(50,255,160))
    
    # Left side: checklist — moved down so no overlap with subtitle
    f_check = get_font(22)
    items = [
        "Cold Intro  ->  Opens deals",
        "Follow-Up  ->  Books calls",
        "Break-Up   ->  Re-engages",
        "Referral   ->  Warms leads",
        "Re-Engage  ->  Wins back lost",
    ]
    check_x = 60
    for i, item in enumerate(items):
        cy2 = 230 + i * 50
        # Check circle
        draw.ellipse([check_x, cy2+2, check_x+22, cy2+24], fill=(0,200,140))
        draw.text((check_x+5, cy2+2), "v", font=get_font(18, bold=True), fill=(255,255,255))
        draw.text((check_x+32, cy2), item, font=f_check, fill=(160,220,200))
    
    # Title — SOLID filled, white, high contrast
    f_huge = get_font(96, bold=True)
    f_sub = get_font(32)
    f_tag = get_font(24)
    
    # Strong title — clear space below it for subtitle
    centered_text(draw, 30, "COLD EMAIL ARSENAL", f_huge, (255,255,255),
                  stroke_fill=(0,100,70), stroke_width=4)
    centered_text(draw, 140, "27 PROVEN TEMPLATES THAT BOOK MEETINGS", f_sub, (100,255,190),
                  stroke_fill=(0,0,0), stroke_width=2)
    centered_text(draw, H-48, "Sales  |  SaaS  |  B2B  |  Freelance", f_tag, (70,190,140))
    
    path = OUT / "cold-email-cover.png"
    img.save(path, quality=95)
    print(f"  OK: cold-email-cover.png")

# ============================================================
# 4. OPEN-LEE — cleaner node diagram, better labels
# ============================================================
def make_openlee():
    img = Image.new('RGB', (W, H))
    draw = ImageDraw.Draw(img)
    
    gradient_bg(draw, W, H, (3,8,28), (5,22,55), (0,15,38))
    
    # Grid
    for x in range(0, W, 55):
        draw.line([(x,0),(x,H)], fill=(0,80,160), width=1)
    for y in range(0, H, 55):
        draw.line([(0,y),(W,y)], fill=(0,80,160), width=1)
    
    # Node diagram — right half
    cx, cy = W * 3//4, H//2 + 10
    
    # Connection lines first (behind nodes)
    models = [
        ("GPT-4", (80,200,100)),
        ("Claude", (255,160,50)),
        ("Gemini", (200,100,255)),
        ("Llama", (255,100,100)),
        ("Mistral", (50,220,210)),
    ]
    radius = 190
    angles = [i * 360 / len(models) - 90 for i in range(len(models))]
    
    for i, ((name, col), angle) in enumerate(zip(models, angles)):
        nx = cx + int(radius * math.cos(math.radians(angle)))
        ny = cy + int(radius * math.sin(math.radians(angle)))
        # Gradient line
        steps = 30
        for s in range(steps):
            t = s / steps
            lx = int(cx*(1-t) + nx*t)
            ly = int(cy*(1-t) + ny*t)
            a = int(180 * (1-t) + 80*t)
            draw.ellipse([lx-2,ly-2,lx+2,ly+2], fill=(*col,))
    
    # Outer nodes
    f_node = get_font(18, bold=True)
    for (name, col), angle in zip(models, angles):
        nx = cx + int(radius * math.cos(math.radians(angle)))
        ny = cy + int(radius * math.sin(math.radians(angle)))
        # Glow
        for gr in range(35, 0, -5):
            draw.ellipse([nx-gr-20,ny-gr-20,nx+gr+20,ny+gr+20], fill=(*col[:3], int(8*gr/35)))
        # Node circle
        draw.ellipse([nx-28,ny-28,nx+28,ny+28], fill=(*col, 255), outline=(255,255,255))
        # Name
        bbox = draw.textbbox((0,0), name, font=f_node)
        tw = bbox[2]-bbox[0]
        draw.text((nx-tw//2+1, ny-9+1), name, font=f_node, fill=(0,0,0))
        draw.text((nx-tw//2, ny-9), name, font=f_node, fill=(255,255,255))
    
    # Central consensus node
    for gr in range(60, 0, -5):
        draw.ellipse([cx-gr-30,cy-gr-30,cx+gr+30,cy+gr+30], fill=(0,150,255, int(8*gr/60)))
    draw.ellipse([cx-38,cy-38,cx+38,cy+38], fill=(0,180,255), outline=(255,255,255), width=3)
    f_center = get_font(16, bold=True)
    draw.text((cx-26,cy-18), "BEST", font=f_center, fill=(255,255,255))
    draw.text((cx-30,cy+2), "ANSWER", font=f_center, fill=(255,255,255))
    
    # Left side: value props
    f_val = get_font(24)
    f_icon = get_font(28, bold=True)
    props = [
        ("Ask once,", "get consensus from all AIs"),
        ("Compare", "answers side by side"),
        ("Smarter", "results, every time"),
    ]
    for i, (head, sub) in enumerate(props):
        py = 180 + i * 90
        draw.text((60, py), ">>", font=f_icon, fill=(0,180,255))
        draw.text((100, py), head, font=get_font(26, bold=True), fill=(200,235,255))
        draw.text((100, py+30), sub, font=get_font(22), fill=(130,180,220))
    
    # Title
    f_huge = get_font(100, bold=True)
    f_name = get_font(36)
    f_sub = get_font(28)
    f_tag = get_font(22)
    
    centered_text(draw, 18, "OPEN-LEE", f_huge, (255,255,255),
                  stroke_fill=(0,80,180), stroke_width=4)
    centered_text(draw, 128, "MULTI-AI CONSENSUS ENGINE", f_sub, (100,210,255),
                  stroke_fill=(0,0,0), stroke_width=2)
    centered_text(draw, 172, "GPT + Claude + Gemini + Llama + More", f_tag, (80,170,220))
    centered_text(draw, H-45, "One question. Five AI minds. One best answer.", f_tag, (60,150,210))
    
    path = OUT / "openlee-cover.png"
    img.save(path, quality=95)
    print(f"  OK: openlee-cover.png")

print("Generating v2 covers...")
make_clawed()
make_prompt_vault()
make_cold_email()
make_openlee()
print("\nAll done! Files in:", OUT)
