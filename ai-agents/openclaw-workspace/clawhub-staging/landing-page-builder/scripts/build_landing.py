#!/usr/bin/env python3
"""
build_landing.py — Generate a self-contained landing page HTML file.
No external dependencies required.
"""
import argparse
import os
from pathlib import Path
from datetime import datetime, timezone

def build_html(args):
    name        = args.name
    tagline     = args.tagline
    description = args.description
    benefits    = [b.strip() for b in args.benefits.split("|")] if args.benefits else []
    cta         = args.cta or f"Get {name}"
    cta_url     = args.cta_url or "#"
    price       = f"${args.price}" if args.price else "Free"
    color       = args.color or "#2563eb"
    year        = datetime.now(timezone.utc).year

    # Derive accent color (lighten the primary slightly)
    benefit_icons = ["🔒", "⚔️", "🧠", "🎮", "🚀", "💡", "🛡️", "⚡", "🎯", "🌟"]

    benefit_cards = ""
    for i, b in enumerate(benefits):
        icon = benefit_icons[i % len(benefit_icons)]
        benefit_cards += f"""
        <div class="benefit-card">
          <div class="benefit-icon">{icon}</div>
          <div class="benefit-text">{b}</div>
        </div>"""

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="{description}">
  <meta property="og:title" content="{name}">
  <meta property="og:description" content="{tagline}">
  <title>{name}</title>
  <style>
    :root {{
      --primary: {color};
      --text: #f0f0f0;
      --bg: #0d0d0d;
      --card-bg: #1a1a1a;
      --accent: #e8c97a;
    }}
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
    }}
    a {{ color: var(--accent); text-decoration: none; }}

    /* Hero */
    .hero {{
      background: linear-gradient(135deg, var(--primary) 0%, #0d0d0d 100%);
      min-height: 90vh;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 60px 24px;
    }}
    .hero-inner {{ max-width: 700px; }}
    .hero h1 {{
      font-size: clamp(2.5rem, 8vw, 5rem);
      font-weight: 900;
      letter-spacing: -1px;
      margin-bottom: 20px;
      line-height: 1.1;
    }}
    .hero .tagline {{
      font-size: clamp(1.1rem, 3vw, 1.5rem);
      opacity: 0.85;
      margin-bottom: 16px;
    }}
    .hero .desc {{
      font-size: 1rem;
      opacity: 0.65;
      margin-bottom: 40px;
      max-width: 500px;
      margin-left: auto;
      margin-right: auto;
    }}
    .btn {{
      display: inline-block;
      background: var(--accent);
      color: #0d0d0d;
      font-weight: 700;
      font-size: 1.1rem;
      padding: 16px 40px;
      border-radius: 50px;
      transition: transform 0.15s, box-shadow 0.15s;
      box-shadow: 0 4px 24px rgba(232,201,122,0.3);
    }}
    .btn:hover {{
      transform: translateY(-2px);
      box-shadow: 0 8px 32px rgba(232,201,122,0.5);
      color: #0d0d0d;
    }}

    /* Screenshot placeholder */
    .screenshot {{
      text-align: center;
      padding: 60px 24px 0;
      max-width: 900px;
      margin: 0 auto;
    }}
    .screenshot-placeholder {{
      background: var(--card-bg);
      border: 2px dashed #333;
      border-radius: 12px;
      height: 400px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #555;
      font-size: 1.1rem;
    }}

    /* Features */
    .features {{
      padding: 80px 24px;
      max-width: 900px;
      margin: 0 auto;
      text-align: center;
    }}
    .features h2 {{
      font-size: 2rem;
      margin-bottom: 48px;
      opacity: 0.9;
    }}
    .benefits-grid {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 24px;
      text-align: left;
    }}
    .benefit-card {{
      background: var(--card-bg);
      border-radius: 12px;
      padding: 24px;
      border: 1px solid #2a2a2a;
    }}
    .benefit-icon {{ font-size: 2rem; margin-bottom: 12px; }}
    .benefit-text {{ font-size: 0.95rem; opacity: 0.8; font-weight: 500; }}

    /* Social proof */
    .social-proof {{
      background: var(--card-bg);
      padding: 80px 24px;
      text-align: center;
    }}
    .social-proof h2 {{ font-size: 1.8rem; margin-bottom: 48px; opacity: 0.9; }}
    .testimonials {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 24px;
      max-width: 900px;
      margin: 0 auto;
    }}
    .testimonial {{
      background: var(--bg);
      border-radius: 12px;
      padding: 24px;
      border: 1px solid #2a2a2a;
      text-align: left;
    }}
    .testimonial .quote {{ font-style: italic; opacity: 0.8; margin-bottom: 16px; }}
    .testimonial .author {{ font-weight: 700; font-size: 0.85rem; opacity: 0.6; }}

    /* Pricing */
    .pricing {{
      padding: 80px 24px;
      text-align: center;
    }}
    .pricing h2 {{ font-size: 2rem; margin-bottom: 16px; }}
    .price-box {{
      display: inline-block;
      background: var(--card-bg);
      border-radius: 16px;
      padding: 48px;
      border: 2px solid var(--primary);
      margin-top: 32px;
    }}
    .price-tag {{
      font-size: 4rem;
      font-weight: 900;
      color: var(--accent);
      margin-bottom: 8px;
    }}
    .price-note {{ opacity: 0.6; margin-bottom: 32px; font-size: 0.9rem; }}

    /* Footer */
    footer {{
      padding: 40px 24px;
      text-align: center;
      border-top: 1px solid #1a1a1a;
      opacity: 0.5;
      font-size: 0.85rem;
    }}

    @media (max-width: 600px) {{
      .hero h1 {{ font-size: 2.5rem; }}
      .price-tag {{ font-size: 3rem; }}
    }}
  </style>
</head>
<body>

  <!-- HERO -->
  <section class="hero">
    <div class="hero-inner">
      <h1>{name}</h1>
      <p class="tagline">{tagline}</p>
      <p class="desc">{description}</p>
      <a href="{cta_url}" class="btn">{cta}</a>
    </div>
  </section>

  <!-- SCREENSHOT -->
  <div class="screenshot">
    <div class="screenshot-placeholder">
      <!-- Replace with: <img src="screenshot.png" alt="{name} gameplay" style="width:100%;border-radius:12px;"> -->
      📸 Add a screenshot or gameplay GIF here
    </div>
  </div>

  <!-- FEATURES -->
  <section class="features">
    <h2>What You Get</h2>
    <div class="benefits-grid">
      {benefit_cards}
    </div>
  </section>

  <!-- SOCIAL PROOF -->
  <section class="social-proof">
    <h2>What Players Are Saying</h2>
    <div class="testimonials">
      <div class="testimonial">
        <p class="quote">"Replace this with a real review from a playtester or early access player."</p>
        <p class="author">— Beta Tester, GameDev Community</p>
      </div>
      <div class="testimonial">
        <p class="quote">"Add another real testimonial here. Even one genuine quote converts well."</p>
        <p class="author">— Indie Gamer, itch.io</p>
      </div>
    </div>
  </section>

  <!-- PRICING -->
  <section class="pricing">
    <h2>Get Early Access</h2>
    <div class="price-box">
      <div class="price-tag">{price}</div>
      <p class="price-note">One-time purchase · All future updates included</p>
      <a href="{cta_url}" class="btn">{cta}</a>
    </div>
  </section>

  <!-- FOOTER -->
  <footer>
    <p>&copy; {year} {name}. All rights reserved.</p>
    <p><a href="mailto:YOUR_EMAIL">Contact</a></p>
  </footer>

</body>
</html>"""
    return html

def main():
    p = argparse.ArgumentParser(description="Generate a landing page HTML file")
    p.add_argument("--name", required=True, help="Product/game name")
    p.add_argument("--tagline", required=True, help="One-line hook")
    p.add_argument("--description", required=True, help="Short paragraph description")
    p.add_argument("--benefits", help="Pipe-separated benefits: 'Feature 1|Feature 2|Feature 3'")
    p.add_argument("--cta", help="Call to action button text")
    p.add_argument("--cta-url", help="CTA button URL")
    p.add_argument("--price", help="Price (e.g. 2.99)")
    p.add_argument("--color", default="#1a1a2e", help="Primary brand color (hex)")
    p.add_argument("--output", default="output/landing.html", help="Output file path")
    args = p.parse_args()

    html = build_html(args)
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    print(f"[OK] Landing page generated: {out}")
    print(f"   Open in browser: file://{out.resolve()}")
    size_kb = len(html.encode()) / 1024
    print(f"   Size: {size_kb:.1f} KB (self-contained, no dependencies)")

if __name__ == "__main__":
    main()
