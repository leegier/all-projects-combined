# Instagram Carousel Generator

Generate polished, dark-themed Instagram carousel slides as HTML files — ready to screenshot or print to PNG.

## What It Does

- Takes a **topic string** as input
- Generates **7 slides** (hook + 5 key points + CTA)
- Outputs clean `1080×1080` HTML files styled for Instagram
- Dark background (`#1a1a2e`), white text, red accent (`#e94560`)
- CTA slide locked to `@leegier` with "Follow for more"

---

## Quick Start

```bash
# No install needed — pure Python standard library

# Generate a carousel (Windows)
python generate_carousel.py "5 Ways to Build Passive Income Online"

# Or run without args to use the built-in demo topic
python generate_carousel.py
```

Slides are saved to `output/` in the same folder as the script.

---

## Output Files

Each run creates numbered HTML files:

```
output/
  slide_01_hook.html       ← Big hook headline
  slide_02_point1.html     ← Key point #1
  slide_03_point2.html     ← Key point #2
  slide_04_point3.html     ← Key point #3
  slide_05_point4.html     ← Key point #4
  slide_06_point5.html     ← Key point #5
  slide_07_cta.html        ← Follow CTA
```

---

## Turning HTML into Images

### Option A — Browser screenshot (free, manual)
1. Open each `.html` file in Chrome/Edge
2. Right-click → Inspect → toggle device toolbar → set to `1080×1080`
3. Screenshot (`Ctrl+Shift+P` → "Capture screenshot")

### Option B — puppeteer (Node.js, automated)
```bash
npm i puppeteer
node -e "
const p = require('puppeteer');
(async () => {
  const b = await p.launch();
  const pg = await b.newPage();
  await pg.setViewport({width:1080,height:1080});
  for (let i=1; i<=7; i++) {
    await pg.goto('file://Z:/openclaw/workspace/builds/carousel-generator/output/slide_0'+i+'_hook.html');
    await pg.screenshot({path:'slide_'+i+'.png'});
  }
  await b.close();
})();
"
```

### Option C — wkhtmltoimage (standalone binary)
```bash
wkhtmltoimage --width 1080 --height 1080 output/slide_01_hook.html slide_01.png
```

---

## Customizing Topics

### Auto-detected number patterns
Topics starting with a number are auto-parsed:
```bash
python generate_carousel.py "7 Habits of Highly Effective Founders"
python generate_carousel.py "3 Reasons Most Businesses Fail"
```

### Adding custom hand-crafted copy
Edit the `CUSTOM_CONTENT` dict near the bottom of the script:

```python
CUSTOM_CONTENT = {
    "Your Topic Here": {
        "hook_line": "Your Hook<br><span class='accent'>Goes Here</span>",
        "hook_sub":  "Compelling subtitle that makes people want to keep swiping.",
        "points": [
            ("Point One Title", "Detailed explanation of point one goes here."),
            ("Point Two Title", "Detailed explanation of point two goes here."),
            # ... up to 5 points
        ],
        "cta_headline": "Want more like this?",
        "cta_sub": "Follow for weekly breakdowns.",
    }
}
```

---

## Customizing Style

At the top of `generate_carousel.py`:

```python
HANDLE = "@leegier"       # Your Instagram handle
ACCENT = "#e94560"        # Accent/highlight color
BG     = "#1a1a2e"        # Primary background
BG2    = "#16213e"        # Secondary background
BG3    = "#0f3460"        # Tertiary background
```

---

## Demo Carousel

A pre-built demo carousel is included in `output/`:

**Topic:** *5 Ways AI Agents Make Money While You Sleep*

| Slide | Content |
|-------|---------|
| 01    | Hook: "5 Ways AI Agents Make Money While You Sleep" |
| 02    | Automated Freelance Delivery |
| 03    | Digital Product Sales |
| 04    | Content That Compounds |
| 05    | Bounty & Grant Hunting |
| 06    | Arbitrage & Data Plays |
| 07    | CTA: Follow @leegier |

---

## Requirements

- Python 3.10+ (uses `list[str]` type hints)
- No external packages — standard library only
- Works on Windows, macOS, Linux

---

## File Structure

```
carousel-generator/
  generate_carousel.py   ← Main script
  README.md              ← This file
  output/                ← Generated slides (auto-created)
```
