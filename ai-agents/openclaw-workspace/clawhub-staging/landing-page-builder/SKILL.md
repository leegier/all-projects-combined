---
name: landing-page-builder
description: Generate complete, high-converting landing page HTML files for any product, service, or game. Use when creating a marketing page, product launch page, game landing page, lead capture page, or client website. No external dependencies — outputs a single self-contained HTML file with responsive CSS. Triggers on: "build a landing page", "create a marketing page", "make a product page", "I need a website for", "landing page for my game", "one-page site for", or any request to create a standalone promotional web page.
---

# landing-page-builder

Generate a complete, self-contained landing page HTML file from a product description.

## Usage

```bash
python scripts/build_landing.py \
  --name "CLAWED" \
  --tagline "Escape the prison. Avoid the guards. Stay alive." \
  --description "A top-down stealth survival game set in a brutal maximum security prison. Early Access — your feedback shapes the game." \
  --benefits "Stealth-first gameplay|Guard AI that adapts|Inventory & crafting|Dark, atmospheric horror" \
  --cta "Download on itch.io — $2.99" \
  --cta-url "https://itch.io/..." \
  --price "2.99" \
  --color "#1a1a2e" \
  --output "output/landing-clawed.html"
```

Output: a single `.html` file saved to `output/`. Open in any browser — no server needed.

---

## Template Features

- **Hero section** — product name, tagline, primary CTA button
- **Features/benefits** — icon grid (pipe-separated list)
- **Social proof** — placeholder testimonial block (replace with real reviews)
- **Pricing section** — price + CTA button
- **Footer** — brand name + copyright
- **Responsive** — works on mobile and desktop
- **SEO meta tags** — title, description, og:image ready
- **No external dependencies** — no CDN, no JS frameworks, works offline

---

## Customization

After generation, open the HTML file and edit:
- Replace `YOUR_EMAIL` in footer
- Add real screenshots/images (replace placeholder `[SCREENSHOT]` comment)
- Swap placeholder testimonials for real reviews
- Adjust colors via CSS variables at the top of `<style>`

---

## Color Presets

| Theme | `--color` value |
|-------|----------------|
| Dark horror (CLAWED) | `#1a1a2e` |
| Professional SaaS | `#2563eb` |
| Warm/creative | `#d97706` |
| Green/growth | `#059669` |
| Minimal white | `#ffffff` |

---

## Assets

The `assets/` folder contains a base HTML template (`base-template.html`) that the script uses. Edit it directly for deeper customization.
