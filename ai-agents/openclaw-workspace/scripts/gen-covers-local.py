"""
Generate stylish product cover art using PIL/Pillow only.
No API keys needed. Outputs 1280x640 covers for itch.io.
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

def gradient_bg(draw, w, h, c1, c2, c3=None, vertical=True):
    for i in range(h if vertical else w):
        t = i / (h if vertical else w)
        if c3 and t > 0.5:
            c = lerp_color(c2, c3, (t-0.5)*2)
        else:
            c = lerp_color(c1, c2, t * (2 if c3 else 1))
        if vertical:
            draw.line([(0,i),(w,i)], fill=c)
        else:
            draw.line([(i,0),(i,h)], fill=c)

def add_noise(img, amount=8):
    pix = img.load()
    for y in range(img.height):
        for x in range(img.width):
            n = random.randint(-amount, amount)
            r,g,b = pix[x,y][:3]
            pix[x,y] = (max(0,min(255,r+n)), max(0,min(255,g+n)), max(0,min(255,b+n)))

def draw_grid(draw, w, h, color=(255,255,255,15)):
    for x in range(0, w, 60):
        draw.line([(x,0),(x,h)], fill=color, width=1)
    for y in range(0, h, 60):
        draw.line([(0,y),(w,y)], fill=color, width=1)

def draw_circuit(draw, w, h, color, n=12):
    """Draw circuit-board-like lines"""
    for _ in range(n):
        x = random.randint(0, w)
        y = random.randint(0, h)
        length = random.randint(40, 200)
        direction = random.choice(['h','v'])
        if direction == 'h':
            draw.line([(x,y),(x+length,y)], fill=color, width=1)
            draw.ellipse([x+length-3,y-3,x+length+3,y+3], fill=color)
        else:
            draw.line([(x,y),(x,y+length)], fill=color, width=1)
            draw.ellipse([x-3,y+length-3,x+3,y+length+3], fill=color)

def draw_glow_rect(img, x1, y1, x2, y2, color, blur=20):
    overlay = Image.new('RGBA', img.size, (0,0,0,0))
    d = ImageDraw.Draw(overlay)
    d.rectangle([x1,y1,x2,y2], fill=(*color,120))
    overlay = overlay.filter(ImageFilter.GaussianBlur(blur))
    img.paste(Image.new('RGBA', img.size, (0,0,0,0)), mask=overlay)
    img.alpha_composite(overlay)

def get_font(size, bold=False):
    # Try to find a decent font
    paths = [
        "C:/Windows/Fonts/arialbd.ttf",
        "C:/Windows/Fonts/arial.ttf", 
        "C:/Windows/Fonts/calibrib.ttf",
        "C:/Windows/Fonts/trebucbd.ttf",
        "C:/Windows/Fonts/verdanab.ttf",
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
    if stroke_fill:
        draw.text((x,y), text, font=font, fill=stroke_fill, stroke_width=stroke_width, stroke_fill=stroke_fill)
    draw.text((x,y), text, font=font, fill=fill)

# ============================================================
# 1. CLAWED — Dark prison escape game
# ============================================================
def make_clawed():
    img = Image.new('RGBA', (W, H))
    draw = ImageDraw.Draw(img)
    
    # Dark gradient: near-black to dark navy
    gradient_bg(draw, W, H, (8,5,15), (15,20,45), (5,10,25))
    
    # Prison bars effect
    for x in range(0, W, 80):
        for alpha in [40, 25, 15]:
            draw.rectangle([x-2, 0, x+2, H], fill=(180,160,100,alpha))
    
    # Orange spotlight from top center
    for r in range(300, 0, -20):
        alpha = max(0, int(60 * (1 - r/300)))
        draw.ellipse([W//2 - r*2, -r, W//2 + r*2, r], fill=(255,120,20,alpha))
    
    # Ground shadow
    for y in range(H-150, H):
        t = (y - (H-150)) / 150
        draw.line([(0,y),(W,y)], fill=(0,0,0,int(200*t)))
    
    # Circuit/crack details
    draw_circuit(draw, W, H, (255,140,30,60), n=20)
    
    # Glowing title
    f_huge = get_font(140, bold=True)
    f_sub = get_font(36)
    f_tag = get_font(24)
    
    # Title glow
    for offset in range(20, 0, -4):
        centered_text(draw, H//2 - 100, "CLAWED", f_huge, (255,100,0,int(15*offset/20)))
    centered_text(draw, H//2 - 100, "CLAWED", f_huge, (255,220,100), stroke_fill=(180,60,0), stroke_width=3)
    
    # Subtitle
    centered_text(draw, H//2 + 65, "PRISON ESCAPE SURVIVAL RPG", f_sub, (200,180,140))
    
    # Tag
    centered_text(draw, H - 60, "EARLY ACCESS  |  WINDOWS  |  $2.99", f_tag, (150,130,100))
    
    # Version badge
    draw.rectangle([W-160, H-50, W-20, H-15], fill=(255,100,20,180))
    draw.text((W-150, H-45), "v0.1 ALPHA", font=get_font(22), fill=(255,255,255))
    
    path = OUT / "clawed-cover.png"
    img.convert('RGB').save(path, quality=95)
    print(f"  OK: {path}")
    return str(path)

# ============================================================
# 2. AI Prompt Vault (mariah)
# ============================================================
def make_prompt_vault():
    img = Image.new('RGBA', (W, H))
    draw = ImageDraw.Draw(img)
    
    # Deep purple/indigo gradient
    gradient_bg(draw, W, H, (10,5,30), (25,10,60), (5,15,40))
    
    # Grid overlay
    draw_grid(draw, W, H, (180,100,255,12))
    
    # Central vault glow
    for r in range(250, 0, -15):
        alpha = max(0, int(40 * (1 - r/250)))
        draw.ellipse([W//2-r, H//2-r, W//2+r, H//2+r], fill=(140,60,255,alpha))
    
    # Vault door outline (hexagon-ish)
    vault_x, vault_y = W//2, H//2 - 30
    size = 130
    points = [(vault_x + int(size*math.cos(math.radians(60*i-90))), 
               vault_y + int(size*math.sin(math.radians(60*i-90)))) for i in range(6)]
    draw.polygon(points, outline=(200,120,255,220), fill=(20,10,50,200))
    # Inner vault
    size2 = 90
    points2 = [(vault_x + int(size2*math.cos(math.radians(60*i-90))),
                vault_y + int(size2*math.sin(math.radians(60*i-90)))) for i in range(6)]
    draw.polygon(points2, outline=(255,200,100,180), fill=(30,15,65,220))
    # Lock symbol
    draw.ellipse([vault_x-18, vault_y-28, vault_x+18, vault_y+8], outline=(255,200,100,200), width=4)
    draw.rectangle([vault_x-14, vault_y+2, vault_x+14, vault_y+28], fill=(255,200,100,200))
    
    # Floating prompt snippets
    f_mono = get_font(18)
    snippets = ["Write a killer hook...", "Act as a CEO...", "Summarize this into...", 
                "Generate 10 ideas for...", "You are an expert..."]
    positions = [(80,80),(900,120),(60,420),(950,380),(400,520)]
    for txt, (x,y) in zip(snippets, positions):
        draw.text((x,y), txt, font=f_mono, fill=(180,140,255,150))
    
    # Title
    f_huge = get_font(100, bold=True)
    f_sub = get_font(34)
    f_tag = get_font(22)
    
    for offset in range(15, 0, -3):
        centered_text(draw, 40, "AI PROMPT VAULT", f_huge, (160,80,255,int(20*offset/15)))
    centered_text(draw, 40, "AI PROMPT VAULT", f_huge, (240,200,255), stroke_fill=(100,40,200), stroke_width=2)
    centered_text(draw, 155, "500+ BATTLE-TESTED PROMPTS FOR EVERY USE CASE", f_sub, (180,150,220))
    centered_text(draw, H-50, "ChatGPT  |  Claude  |  Gemini  |  $19.00", f_tag, (140,110,200))
    
    path = OUT / "ai-prompt-vault-cover.png"
    img.convert('RGB').save(path, quality=95)
    print(f"  OK: {path}")
    return str(path)

# ============================================================
# 3. Cold Email Arsenal
# ============================================================
def make_cold_email():
    img = Image.new('RGBA', (W, H))
    draw = ImageDraw.Draw(img)
    
    # Dark teal/navy
    gradient_bg(draw, W, H, (5,15,30), (10,30,50), (2,20,40))
    
    # Circuit board lines
    draw_circuit(draw, W, H, (0,200,150,50), n=25)
    draw_grid(draw, W, H, (0,180,120,10))
    
    # Email envelope shape on right
    env_x, env_y = W - 320, H//2 - 80
    env_w, env_h = 260, 180
    draw.rectangle([env_x, env_y, env_x+env_w, env_y+env_h], 
                   outline=(0,220,160,200), fill=(5,30,50,230), width=3)
    # Envelope flap
    draw.polygon([(env_x, env_y), (env_x+env_w//2, env_y+env_h//2-10), (env_x+env_w, env_y)],
                 outline=(0,220,160,200), fill=(0,180,130,100))
    # $ signs flying out
    f_money = get_font(40, bold=True)
    for i, (mx, my) in enumerate([(W-150, H//2-140),(W-80,H//2-180),(W-200,H//2-160)]):
        alpha = 200 - i*30
        draw.text((mx, my), "$", font=f_money, fill=(50,255,150,alpha))
    
    # Left side: stacked "emails"
    for i in range(5, 0, -1):
        ox = 60 + i*8
        oy = H//2 - 60 + i*8
        draw.rectangle([ox, oy, ox+200, oy+120], 
                      fill=(10,40,60, 180), outline=(0,180,130,120), width=1)
    
    # Title
    f_huge = get_font(90, bold=True)
    f_sub = get_font(32)
    f_tag = get_font(22)
    
    for offset in range(15, 0, -3):
        centered_text(draw, 50, "COLD EMAIL ARSENAL", f_huge, (0,220,160,int(15*offset/15)))
    centered_text(draw, 50, "COLD EMAIL ARSENAL", f_huge, (100,255,200), stroke_fill=(0,120,90), stroke_width=2)
    centered_text(draw, 155, "27 PROVEN TEMPLATES THAT BOOK MEETINGS", f_sub, (80,220,160))
    centered_text(draw, H-50, "Sales  |  B2B  |  Freelance  |  $27.00", f_tag, (60,180,130))
    
    path = OUT / "cold-email-cover.png"
    img.convert('RGB').save(path, quality=95)
    print(f"  OK: {path}")
    return str(path)

# ============================================================
# 4. OPEN-LEE Multi-AI Consensus Engine
# ============================================================
def make_openlee():
    img = Image.new('RGBA', (W, H))
    draw = ImageDraw.Draw(img)
    
    # Deep blue/cyan
    gradient_bg(draw, W, H, (3,8,25), (5,20,50), (0,15,35))
    draw_grid(draw, W, H, (0,150,255,10))
    
    # Central node (the consensus)
    cx, cy = W//2, H//2 + 20
    draw.ellipse([cx-40,cy-40,cx+40,cy+40], fill=(0,180,255,220), outline=(100,220,255,255), width=3)
    draw.text((cx-12, cy-12), "AI", font=get_font(28, bold=True), fill=(255,255,255))
    
    # Satellite nodes (different AI models)
    models = ["GPT", "CLD", "GEM", "LLM", "MIS"]
    colors = [(100,200,100), (255,180,50), (200,100,255), (255,100,100), (50,220,200)]
    angle_step = 360 / len(models)
    radius = 180
    for i, (m, col) in enumerate(zip(models, colors)):
        angle = math.radians(i * angle_step - 90)
        nx = cx + int(radius * math.cos(angle))
        ny = cy + int(radius * math.sin(angle))
        # Connection line
        for t_step in range(20):
            t = t_step / 20
            lx = int(cx + (nx-cx)*t)
            ly = int(cy + (ny-cy)*t)
            draw.ellipse([lx-2,ly-2,lx+2,ly+2], fill=(*col, int(100*(1-t))))
        # Node
        draw.ellipse([nx-25,ny-25,nx+25,ny+25], fill=(*col,200), outline=(255,255,255,180), width=2)
        draw.text((nx-15, ny-10), m, font=get_font(18, bold=True), fill=(0,0,0))
    
    # Title
    f_huge = get_font(80, bold=True)
    f_name = get_font(54, bold=True)
    f_sub = get_font(28)
    f_tag = get_font(20)
    
    for offset in range(12, 0, -3):
        centered_text(draw, 25, "OPEN-LEE", f_huge, (0,180,255,int(20*offset/12)))
    centered_text(draw, 25, "OPEN-LEE", f_huge, (100,220,255), stroke_fill=(0,80,160), stroke_width=2)
    centered_text(draw, 110, "MULTI-AI CONSENSUS ENGINE", f_sub, (80,180,220))
    centered_text(draw, H-45, "GPT + Claude + Gemini + More  |  $19.00", f_tag, (60,150,200))
    
    path = OUT / "openlee-cover.png"
    img.convert('RGB').save(path, quality=95)
    print(f"  OK: {path}")
    return str(path)

# ============================================================
# Run all
# ============================================================
print("Generating product covers...")
make_clawed()
make_prompt_vault()
make_cold_email()
make_openlee()
print("\nAll done! Files in:", OUT)
