"""
Instagram Carousel Generator
Generates styled HTML slides for Instagram carousels.
Usage: python generate_carousel.py "Your Topic Here"
"""

import os
import sys
import textwrap

# ─── CONFIG ──────────────────────────────────────────────────────────────────
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
HANDLE = "@leegier"
ACCENT = "#e94560"
BG = "#1a1a2e"
BG2 = "#16213e"
BG3 = "#0f3460"

# ─── SLIDE TEMPLATES ─────────────────────────────────────────────────────────

BASE_HTML = """\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>{title}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');

  * {{ box-sizing: border-box; margin: 0; padding: 0; }}

  body {{
    width: 1080px;
    height: 1080px;
    background: {bg};
    color: #ffffff;
    font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    position: relative;
  }}

  /* subtle grid overlay */
  body::before {{
    content: '';
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(233,69,96,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(233,69,96,0.04) 1px, transparent 1px);
    background-size: 60px 60px;
    pointer-events: none;
  }}

  .slide {{
    width: 960px;
    min-height: 960px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 60px;
    position: relative;
    z-index: 1;
    text-align: center;
  }}

  .accent {{ color: {accent}; }}

  .tag {{
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: {accent};
    margin-bottom: 24px;
    opacity: 0.9;
  }}

  .headline {{
    font-size: {headline_size}px;
    font-weight: 900;
    line-height: 1.1;
    letter-spacing: -1px;
    margin-bottom: 24px;
  }}

  .subline {{
    font-size: 22px;
    font-weight: 400;
    color: rgba(255,255,255,0.65);
    line-height: 1.5;
    max-width: 720px;
  }}

  .divider {{
    width: 60px;
    height: 4px;
    background: {accent};
    border-radius: 2px;
    margin: 32px auto;
  }}

  .slide-num {{
    position: absolute;
    bottom: 24px;
    right: 40px;
    font-size: 13px;
    color: rgba(255,255,255,0.3);
    font-weight: 600;
    letter-spacing: 1px;
  }}

  .handle {{
    position: absolute;
    bottom: 24px;
    left: 40px;
    font-size: 14px;
    color: rgba(255,255,255,0.35);
    font-weight: 600;
  }}

  /* Point slide */
  .point-number {{
    font-size: 80px;
    font-weight: 900;
    color: {accent};
    line-height: 1;
    margin-bottom: 16px;
    opacity: 0.9;
  }}

  .point-title {{
    font-size: 46px;
    font-weight: 800;
    line-height: 1.2;
    margin-bottom: 20px;
    letter-spacing: -0.5px;
  }}

  .point-body {{
    font-size: 22px;
    font-weight: 400;
    color: rgba(255,255,255,0.70);
    line-height: 1.6;
    max-width: 720px;
  }}

  /* CTA slide */
  .cta-box {{
    background: rgba(233,69,96,0.12);
    border: 2px solid rgba(233,69,96,0.4);
    border-radius: 20px;
    padding: 48px 64px;
    text-align: center;
    max-width: 800px;
  }}

  .cta-headline {{
    font-size: 58px;
    font-weight: 900;
    line-height: 1.1;
    margin-bottom: 20px;
    letter-spacing: -1px;
  }}

  .cta-sub {{
    font-size: 22px;
    color: rgba(255,255,255,0.65);
    margin-bottom: 36px;
    line-height: 1.5;
  }}

  .cta-handle {{
    font-size: 32px;
    font-weight: 800;
    color: {accent};
    letter-spacing: 1px;
  }}

  .follow-pill {{
    display: inline-block;
    background: {accent};
    color: #fff;
    font-size: 18px;
    font-weight: 700;
    padding: 14px 36px;
    border-radius: 40px;
    margin-top: 24px;
    letter-spacing: 1px;
    text-transform: uppercase;
  }}
</style>
</head>
<body>
<div class="slide">
  {content}
  <div class="handle">{handle}</div>
  <div class="slide-num">{slide_num}</div>
</div>
</body>
</html>
"""


def make_hook_slide(topic, hook_line, sub_line, slide_num, total):
    """Slide 1 — big hook headline."""
    content = f"""\
  <div class="tag">&#9889; Thread</div>
  <div class="headline" style="font-size:64px;">{hook_line}</div>
  <div class="divider"></div>
  <div class="subline">{sub_line}</div>"""
    return BASE_HTML.format(
        title=f"Slide {slide_num}",
        bg=f"linear-gradient(135deg, {BG} 0%, {BG3} 100%)",
        accent=ACCENT,
        headline_size=64,
        content=content,
        handle=HANDLE,
        slide_num=f"{slide_num}/{total}",
    )


def make_point_slide(number, title, body, slide_num, total):
    """Body slide — numbered key point."""
    content = f"""\
  <div class="point-number">0{number}</div>
  <div class="point-title">{title}</div>
  <div class="divider"></div>
  <div class="point-body">{body}</div>"""
    return BASE_HTML.format(
        title=f"Slide {slide_num}",
        bg=f"linear-gradient(160deg, {BG} 0%, {BG2} 100%)",
        accent=ACCENT,
        headline_size=52,
        content=content,
        handle=HANDLE,
        slide_num=f"{slide_num}/{total}",
    )


def make_cta_slide(cta_headline, cta_sub, slide_num, total):
    """Final slide — CTA."""
    content = f"""\
  <div class="cta-box">
    <div class="cta-headline">{cta_headline}</div>
    <div class="cta-sub">{cta_sub}</div>
    <div class="cta-handle">{HANDLE}</div>
    <div class="follow-pill">Follow for more</div>
  </div>"""
    return BASE_HTML.format(
        title=f"Slide {slide_num}",
        bg=f"linear-gradient(135deg, {BG} 0%, {BG3} 100%)",
        accent=ACCENT,
        headline_size=52,
        content=content,
        handle=HANDLE,
        slide_num=f"{slide_num}/{total}",
    )


# ─── CONTENT GENERATOR ───────────────────────────────────────────────────────

def generate_content(topic: str) -> dict:
    """
    Build carousel content from a topic string.
    Returns a dict with hook, points[], cta.
    """
    topic_clean = topic.strip()
    topic_upper = topic_clean.upper()

    # Try to detect a number pattern like "5 Ways..." or "7 Tips..."
    import re
    m = re.match(r"^(\d+)\s+(ways?|tips?|steps?|secrets?|rules?|hacks?|ideas?|reasons?)\s+(.+)",
                  topic_clean, re.IGNORECASE)

    if m:
        count = int(m.group(1))
        kind  = m.group(2).capitalize()
        subject = m.group(3)
    else:
        count = 5
        kind  = "Ways"
        subject = topic_clean

    # Build generic points based on topic words
    words = re.sub(r"[^a-zA-Z0-9 ]", "", subject).split()
    core = " ".join(words[:6]) if words else "this topic"

    # ── Hooks ──
    hook_line = f"{count} {kind} to<br><span class='accent'>{subject.title()}</span>"
    hook_sub  = f"Save this post — you'll want to come back to it. Here's what most people never figure out about {core.lower()}."

    # ── Generic point builder ──
    point_templates = [
        ("Automate the Boring Stuff",
         f"The first move is always automation. Set up systems that handle {core.lower()} for you around the clock — while you focus on growth."),
        ("Leverage AI Tools",
         f"Modern AI can do in 10 minutes what used to take days. Use it to accelerate every part of {core.lower()} and stay ahead of the curve."),
        ("Build Once, Earn Forever",
         f"Digital assets tied to {core.lower()} compound over time. One good product or system can pay you for years without extra work."),
        ("Scale with Systems",
         f"Stop trading time for money. Build repeatable processes around {core.lower()} so your results multiply even when you're offline."),
        ("Track, Iterate, Win",
         f"Data kills guesswork. Measure everything around {core.lower()}, cut what doesn't work, and double down on what does."),
        ("Community is the Moat",
         f"An audience that trusts you is worth more than any ad budget. Build real relationships around {core.lower()} and watch your reach compound."),
        ("The Mindset Shift",
         f"Most people fail at {core.lower()} because of limiting beliefs, not tactics. Rewire how you think about it and everything changes."),
    ]

    points = point_templates[:min(count, 5)]  # cap at 5 body slides

    # ── CTA ──
    cta_headline = "Found this useful?"
    cta_sub = f"There's a lot more where this came from. Follow for weekly breakdowns on AI, automation, and income systems that actually work."

    return {
        "hook_line": hook_line,
        "hook_sub":  hook_sub,
        "points":    points,
        "cta_headline": cta_headline,
        "cta_sub":      cta_sub,
    }


# ─── MAIN ────────────────────────────────────────────────────────────────────

def generate_carousel(topic: str, out_dir: str = OUTPUT_DIR) -> list[str]:
    """Generate all slides and save to out_dir. Returns list of file paths."""
    os.makedirs(out_dir, exist_ok=True)

    data   = generate_content(topic)
    points = data["points"]
    total  = 1 + len(points) + 1  # hook + points + cta

    files = []
    slide_num = 1

    # ── Slide 1: Hook ──
    html = make_hook_slide(
        topic,
        data["hook_line"],
        data["hook_sub"],
        slide_num, total,
    )
    path = os.path.join(out_dir, f"slide_{slide_num:02d}_hook.html")
    with open(path, "w", encoding="utf-8") as f:
        f.write(html)
    files.append(path)
    slide_num += 1

    # ── Body slides ──
    for i, (title, body) in enumerate(points, start=1):
        html = make_point_slide(i, title, body, slide_num, total)
        path = os.path.join(out_dir, f"slide_{slide_num:02d}_point{i}.html")
        with open(path, "w", encoding="utf-8") as f:
            f.write(html)
        files.append(path)
        slide_num += 1

    # ── Final slide: CTA ──
    html = make_cta_slide(data["cta_headline"], data["cta_sub"], slide_num, total)
    path = os.path.join(out_dir, f"slide_{slide_num:02d}_cta.html")
    with open(path, "w", encoding="utf-8") as f:
        f.write(html)
    files.append(path)

    return files


# ─── CUSTOM CONTENT OVERRIDE ─────────────────────────────────────────────────
# For a specific topic, override generate_content here with hand-crafted copy.

CUSTOM_CONTENT = {
    "5 Ways AI Agents Make Money While You Sleep": {
        "hook_line": "5 Ways AI Agents<br><span class='accent'>Make Money<br>While You Sleep</span>",
        "hook_sub":  "The robots are working. Are you set up to profit? Here's how smart founders are cashing in 24/7.",
        "points": [
            ("Automated Freelance Delivery",
             "AI agents scan job boards, write proposals, and deliver finished work — design, copy, code — with zero manual input. You collect the payment."),
            ("Digital Product Sales",
             "Set up once. AI handles customer questions, upsells, and delivery. Your Gumroad or itch.io store runs itself while you sleep."),
            ("Content That Compounds",
             "AI writes, formats, and schedules posts daily. Every piece of content is a 24/7 ad for your brand — building audience and affiliate income non-stop."),
            ("Bounty & Grant Hunting",
             "Agents scan GitHub, Gitcoin, and Algora for open bounties, submit solutions, and collect payouts. It's like mining — automated."),
            ("Arbitrage & Data Plays",
             "Price monitoring bots catch deals. Data scraping agents sell insights. AI-driven arbitrage works the market every hour you're not looking."),
        ],
        "cta_headline": "Want the exact setup?",
        "cta_sub":      "Follow for weekly AI agent playbooks — real systems, real income. No fluff, just results.",
    }
}


def generate_content(topic: str) -> dict:  # noqa: F811  (redefinition is intentional)
    if topic in CUSTOM_CONTENT:
        return CUSTOM_CONTENT[topic]

    topic_clean = topic.strip()

    import re
    m = re.match(r"^(\d+)\s+(ways?|tips?|steps?|secrets?|rules?|hacks?|ideas?|reasons?)\s+(.+)",
                  topic_clean, re.IGNORECASE)
    if m:
        count   = int(m.group(1))
        kind    = m.group(2).capitalize()
        subject = m.group(3)
    else:
        count   = 5
        kind    = "Ways"
        subject = topic_clean

    words = re.sub(r"[^a-zA-Z0-9 ]", "", subject).split()
    core  = " ".join(words[:6]) if words else "this topic"

    hook_line = f"{count} {kind} to<br><span class='accent'>{subject.title()}</span>"
    hook_sub  = (f"Save this post — you'll want to come back to it. "
                 f"Here's what most people never figure out about {core.lower()}.")

    point_templates = [
        ("Automate the Boring Stuff",
         f"The first move is always automation. Set up systems that handle {core.lower()} for you "
         f"around the clock — while you focus on growth."),
        ("Leverage AI Tools",
         f"Modern AI can do in 10 minutes what used to take days. Use it to accelerate every part of "
         f"{core.lower()} and stay ahead of the curve."),
        ("Build Once, Earn Forever",
         f"Digital assets tied to {core.lower()} compound over time. One good product or system can "
         f"pay you for years without extra work."),
        ("Scale with Systems",
         f"Stop trading time for money. Build repeatable processes around {core.lower()} so your "
         f"results multiply even when you're offline."),
        ("Track, Iterate, Win",
         f"Data kills guesswork. Measure everything around {core.lower()}, cut what doesn't work, "
         f"and double down on what does."),
        ("Community is the Moat",
         f"An audience that trusts you is worth more than any ad budget. Build real relationships "
         f"around {core.lower()} and watch your reach compound."),
        ("The Mindset Shift",
         f"Most people fail at {core.lower()} because of limiting beliefs, not tactics. "
         f"Rewire how you think about it and everything changes."),
    ]

    points = point_templates[:min(count, 5)]

    return {
        "hook_line":    hook_line,
        "hook_sub":     hook_sub,
        "points":       points,
        "cta_headline": "Found this useful?",
        "cta_sub": (f"There's a lot more where this came from. Follow for weekly breakdowns on AI, "
                    f"automation, and income systems that actually work."),
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        topic = "5 Ways AI Agents Make Money While You Sleep"
        print(f"[carousel] No topic given — using demo: \"{topic}\"")
    else:
        topic = " ".join(sys.argv[1:])

    print(f"[carousel] Generating carousel: {topic!r}")
    saved = generate_carousel(topic)
    print(f"[carousel] OK {len(saved)} slides saved to: {OUTPUT_DIR}")
    for f in saved:
        print(f"  > {os.path.basename(f)}")
