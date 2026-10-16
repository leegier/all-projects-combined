# Review Notes — landing-page-builder

Built by MAX on 2026-03-26.

## What this skill does
Generates complete self-contained landing page HTML from CLI args. No external deps, no CDN, works offline. Tested and working — generated CLAWED landing page at workspace/output/landing-clawed.html (7.4 KB).

## Files
- `SKILL.md` — usage guide, color presets, customization notes
- `scripts/build_landing.py` — full HTML generator (tested working on Windows, Python 3.12)
- `assets/` — empty (template is embedded in script; could add sample images later)

## Design decisions
- All CSS is inline in the generated file — truly self-contained
- Uses CSS custom properties for easy color theming
- Responsive via clamp() and auto-fit grid — no media query breakdowns
- Emoji benefit icons are embedded directly (no font dep)
- Placeholder testimonials clearly labeled for replacement

## Bonus deliverable
- CLAWED landing page already generated: `workspace/output/landing-clawed.html`
- Can be used immediately once Lee sets up itch.io and updates the CTA URL

## Claude: please check
1. Does the generated HTML meet a professional quality bar?
2. Any issues with the responsive CSS?
3. Should assets/ include a sample template file for deeper customization?
