---
name: course-creator
description: Structure, write, and export online course content including modules, lessons, quizzes, and resources. Outputs structured Markdown or JSON ready for Teachable, Gumroad, or Notion. Use when building an online course to sell, creating a curriculum, writing lesson scripts, or generating quiz questions. Triggers on: "create an online course", "write a course", "build a curriculum", "course outline", "lesson plan", "quiz questions for", "make a course about", or any online course creation task.
---

# course-creator

Design and write complete online course content — modules, lessons, quizzes, and resources.

## Workflow

1. **Define** the course (topic, audience, outcome, module count)
2. **Generate curriculum** — modules and lessons
3. **Write lessons** — one at a time, structured format
4. **Generate quizzes** — 3–5 questions per module
5. **Export** to Markdown, JSON (Teachable/Gumroad), or Notion format

---

## Step 1 — Define

Tell the agent:
- **Topic:** what the course teaches
- **Audience:** who it's for (beginner/intermediate, background)
- **Outcome:** what they can do after completing
- **Format:** mini-course (3–5 modules) or full course (8–12 modules)

---

## Step 2 — Generate Curriculum

```bash
python scripts/course.py outline \
  --title "Build and Ship a Unity Game in 30 Days" \
  --audience "Aspiring indie developers with basic programming knowledge" \
  --outcome "Ship a working game on itch.io" \
  --modules 8 \
  --output "output/course-unity/curriculum.md"
```

---

## Step 3 — Write a Lesson

```bash
python scripts/course.py lesson \
  --course-dir "output/course-unity" \
  --module 1 \
  --lesson 1 \
  --title "Setting Up Unity and Your First Scene" \
  --duration "15 min"
```

Saves to `output/course-unity/module-01/lesson-01.md`.

---

## Step 4 — Generate Quiz

```bash
python scripts/course.py quiz \
  --course-dir "output/course-unity" \
  --module 1 \
  --count 4
```

---

## Step 5 — Export

```bash
# Full Markdown bundle (zip-ready for Gumroad)
python scripts/course.py export --course-dir "output/course-unity" --format markdown

# JSON for Teachable import
python scripts/course.py export --course-dir "output/course-unity" --format json

# Single HTML file for preview
python scripts/course.py export --course-dir "output/course-unity" --format html
```

---

## Pricing Guide

| Course type | Length | Price range |
|-------------|--------|-------------|
| Mini-course (3–5 modules) | 1–3 hrs | $9–$29 |
| Full course (8–12 modules) | 4–10 hrs | $29–$99 |
| Bootcamp (15+ modules) | 15+ hrs | $99–$299 |

## High-Value Course Ideas for MAX

| Title | Audience | Est. Price |
|-------|----------|-----------|
| Build a Unity Game in 30 Days | Indie devs | $49 |
| Make Money With AI Agents | Non-tech entrepreneurs | $29 |
| Freelancing With AI Tools | Freelancers | $19 |
| From Zero to Shipped: Indie Game Dev | Beginners | $39 |

---

## Assets

See `assets/lesson-template.md` for the standard lesson structure.
