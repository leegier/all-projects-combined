from PIL import Image, ImageDraw, ImageFont
import os, math, random

OUT = r"Z:\openclaw\workspace\marketing\product-art"
W, H = 630, 500

def gradient_bg(draw, c1, c2):
    for y in range(H):
        t = y / H
        r = int(c1[0]*(1-t) + c2[0]*t)
        g = int(c1[1]*(1-t) + c2[1]*t)
        b = int(c1[2]*(1-t) + c2[2]*t)
        draw.line([(0,y),(W,y)], fill=(r,g,b))

def add_particles(draw, color, count=60):
    for _ in range(count):
        x, y = random.randint(0,W), random.randint(0,H)
        r = random.randint(1,3)
        alpha = random.randint(80,200)
        draw.ellipse([x-r,y-r,x+r,y+r], fill=(*color[:3], alpha))

def get_font(size, bold=False):
    paths = [
        r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
        r"C:\Windows\Fonts\Arial Bold.ttf",
        r"C:\Windows\Fonts\segoeui.ttf",
    ]
    for p in paths:
        if os.path.exists(p):
            try: return ImageFont.truetype(p, size)
            except: pass
    return ImageFont.load_default()

def draw_centered_text(draw, text, y, font, color, shadow=True):
    bbox = draw.textbbox((0,0), text, font=font)
    tw = bbox[2]-bbox[0]
    x = (W - tw) // 2
    if shadow:
        draw.text((x+2,y+2), text, font=font, fill=(0,0,0,180))
    draw.text((x,y), text, font=font, fill=color)

# ── OPEN-LEE ──────────────────────────────────────────────────────────────────
img = Image.new("RGBA", (W,H), (0,0,0,255))
draw = ImageDraw.Draw(img, "RGBA")
gradient_bg(draw, (5,5,25), (20,0,50))
add_particles(draw, (80,120,255))

# Three node circles
nodes = [(W//2-160, 180), (W//2+160, 180), (W//2, 80)]
colors = [(0,180,255), (180,0,255), (255,100,0)]
for (nx,ny), nc in zip(nodes, colors):
    for r in range(40,5,-8):
        alpha = int(60 * (40-r)/35)
        draw.ellipse([nx-r,ny-r,nx+r,ny+r], fill=(*nc, alpha))
    draw.ellipse([nx-14,ny-14,nx+14,ny+14], fill=(*nc,230))

# Converging lines to center
cx, cy = W//2, 260
for (nx,ny), nc in zip(nodes, colors):
    for i in range(3):
        offset = (i-1)*4
        draw.line([(nx+offset,ny),(cx+offset,cy)], fill=(*nc,120), width=2)

# Beam burst at center
for angle in range(0,360,15):
    rad = math.radians(angle)
    ex = cx + int(math.cos(rad)*90)
    ey = cy + int(math.sin(rad)*90)
    draw.line([(cx,cy),(ex,ey)], fill=(200,220,255,60), width=1)
draw.ellipse([cx-20,cy-20,cx+20,cy+20], fill=(255,255,255,200))

# Text
f_big = get_font(64, bold=True)
f_sub = get_font(22)
f_tag = get_font(18)
draw_centered_text(draw, "OPEN-LEE", 350, f_big, (255,255,255))
draw_centered_text(draw, "Multi-AI Consensus Engine", 430, f_sub, (160,200,255))
draw_centered_text(draw, "Claude  •  Gemma  •  Mistral", 460, f_tag, (120,160,220))

img.convert("RGB").save(os.path.join(OUT,"open-lee-cover.png"))
print("OPEN-LEE done")

# ── AI PROMPT VAULT ──────────────────────────────────────────────────────────
img = Image.new("RGBA", (W,H), (0,0,0,255))
draw = ImageDraw.Draw(img, "RGBA")
gradient_bg(draw, (15,8,0), (40,20,0))
add_particles(draw, (200,150,0))

# Vault door shape
vx, vy, vr = W//2, 190, 90
draw.ellipse([vx-vr-10,vy-vr-10,vx+vr+10,vy+vr+10], fill=(60,40,0,255))
draw.ellipse([vx-vr,vy-vr,vx+vr,vy+vr], fill=(100,70,0,255))
draw.ellipse([vx-70,vy-70,vx+70,vy+70], fill=(160,110,0,255))
draw.ellipse([vx-50,vy-50,vx+50,vy+50], fill=(220,160,0,255))
draw.ellipse([vx-30,vy-30,vx+30,vy+30], fill=(255,200,50,255))
# Handle
draw.rectangle([vx+30,vy-5,vx+65,vy+5], fill=(255,220,100))
# Glow rays
for angle in range(0,360,30):
    rad = math.radians(angle)
    ex = vx + int(math.cos(rad)*130)
    ey = vy + int(math.sin(rad)*130)
    draw.line([(vx,vy),(ex,ey)], fill=(255,180,0,50), width=2)

# Text lines streaming out
for i, line in enumerate(["PROMPT_001: Write viral...", "PROMPT_047: Generate SEO...", "PROMPT_112: Cold email..."]):
    draw.text((vx+95, vy-20+i*22), line, font=get_font(13), fill=(255,200,80,160))

f_big = get_font(56, bold=True)
f_sub = get_font(22)
f_tag = get_font(17)
draw_centered_text(draw, "AI PROMPT VAULT", 350, f_big, (255,210,50))
draw_centered_text(draw, "500+ Premium AI Prompts", 420, f_sub, (220,170,40))
draw_centered_text(draw, "ChatGPT  •  Claude  •  Gemini", 450, f_tag, (180,140,30))

img.convert("RGB").save(os.path.join(OUT,"ai-prompt-vault-cover.png"))
print("AI PROMPT VAULT done")

# ── BRAXTON ──────────────────────────────────────────────────────────────────
img = Image.new("RGBA", (W,H), (0,0,0,255))
draw = ImageDraw.Draw(img, "RGBA")
gradient_bg(draw, (0,15,5), (0,30,10))
add_particles(draw, (0,255,80), count=40)

# Terminal window
tx, ty, tw, th = 120, 80, 390, 260
draw.rounded_rectangle([tx,ty,tx+tw,ty+th], radius=8, fill=(10,20,12), outline=(0,200,60), width=2)
# Title bar
draw.rounded_rectangle([tx,ty,tx+tw,ty+30], radius=8, fill=(0,50,20))
draw.text((tx+12, ty+8), "● ● ●", font=get_font(12), fill=(0,180,60))
draw.text((tx+tw//2-35, ty+8), "BRAXTON v1.0", font=get_font(13), fill=(0,220,80))

# Chat lines
lines = [
    ("> You: Explain quantum computing",    (180,255,180)),
    ("> AI:  Sure! At the quantum level...", (0,200,70)),
    ("> You: Keep it simple",               (180,255,180)),
    ("> AI:  Like flipping many coins...",  (0,200,70)),
    ("> _",                                 (0,255,80)),
]
for i, (line, col) in enumerate(lines):
    draw.text((tx+14, ty+38+i*38), line, font=get_font(14), fill=col)

# Padlock
lx, ly = W//2, 380
draw.rectangle([lx-16,ly-10,lx+16,ly+16], fill=(0,180,60))
draw.arc([lx-12,ly-26,lx+12,ly-4], start=0, end=180, fill=(0,180,60), width=5)
draw.ellipse([lx-4,ly-2,lx+4,ly+6], fill=(0,40,0))

f_big = get_font(62, bold=True)
f_sub = get_font(20)
f_tag = get_font(16)
draw_centered_text(draw, "BRAXTON", 410, f_big, (0,255,80))
draw_centered_text(draw, "Private Local AI Chat", 478, f_sub, (0,200,60))

img.convert("RGB").save(os.path.join(OUT,"braxton-cover.png"))
print("BRAXTON done")

# ── CLAWED ────────────────────────────────────────────────────────────────────
img = Image.new("RGBA", (W,H), (0,0,0,255))
draw = ImageDraw.Draw(img, "RGBA")
gradient_bg(draw, (15,5,5), (40,0,0))
add_particles(draw, (200,50,50), count=50)

# Prison bars
bar_color = (80,80,100)
for bx in range(60, W-60, 60):
    draw.rectangle([bx-4, 60, bx+4, 320], fill=bar_color)
draw.rectangle([60, 60, W-60, 75], fill=bar_color)
draw.rectangle([60, 305, W-60, 320], fill=bar_color)

# Character silhouette (simple)
px, py = W//2, 200
draw.ellipse([px-20,py-50,px+20,py-10], fill=(220,160,120))  # head
draw.rectangle([px-25,py-10,px+25,py+60], fill=(80,80,80))   # body
draw.rectangle([px-25,py+60,px-10,py+110], fill=(60,60,60))  # leg L
draw.rectangle([px+10,py+60,px+25,py+110], fill=(60,60,60))  # leg R

# Claw marks
for i in range(3):
    sx = W//2 - 30 + i*30
    draw.line([(sx,80),(sx-15,200)], fill=(255,50,50,180), width=3)

f_big = get_font(72, bold=True)
f_sub = get_font(22)
f_tag = get_font(17)
draw_centered_text(draw, "CLAWED", 340, f_big, (255,60,60))
draw_centered_text(draw, "Prison Survival RPG", 425, f_sub, (220,100,100))
draw_centered_text(draw, "Early Access  •  $2.99", 458, f_tag, (180,80,80))

img.convert("RGB").save(os.path.join(OUT,"clawed-cover.png"))
print("CLAWED done")

print("\nAll covers generated.")
