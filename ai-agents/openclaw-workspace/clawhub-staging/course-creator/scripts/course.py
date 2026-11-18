#!/usr/bin/env python3
"""
course.py — Online course scaffolder and exporter.
Creates structured course content in Markdown, JSON, or HTML.
"""
import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path

def cmd_outline(args):
    out = Path(args.output or f"output/course/curriculum.md")
    out.parent.mkdir(parents=True, exist_ok=True)

    n = args.modules or 8
    content = f"""# Course Curriculum — {args.title}

**Audience:** {args.audience}
**Outcome:** {args.outcome}
**Modules:** {n}
**Created:** {datetime.now(timezone.utc).strftime('%Y-%m-%d')}

---

## Modules Overview

"""
    # Generate placeholder module structure
    for i in range(1, n + 1):
        content += f"### Module {i}: [MODULE TITLE]\n\n"
        content += f"**Goal:** What the student can do after this module\n\n"
        for j in range(1, 4):
            content += f"- Lesson {i}.{j}: [LESSON TITLE] (XX min)\n"
        content += f"- Quiz: Module {i} Check\n\n"

    content += """---

## Instructions for MAX

Fill in each [MODULE TITLE] and [LESSON TITLE] based on the course topic.
Then run `course.py lesson` for each lesson to generate the content.
Run `course.py quiz` after each module to generate quiz questions.
Run `course.py export` when all lessons are written.
"""
    out.write_text(content, encoding="utf-8")
    print(f"[OK] Curriculum scaffold saved: {out}")
    print(f"     Next: edit curriculum.md, then run `lesson` for each lesson")

def cmd_lesson(args):
    course_dir = Path(args.course_dir)
    mod_dir = course_dir / f"module-{args.module:02d}"
    mod_dir.mkdir(parents=True, exist_ok=True)
    lesson_file = mod_dir / f"lesson-{args.lesson:02d}.md"

    content = f"""# Module {args.module}, Lesson {args.lesson}: {args.title}

**Duration:** {args.duration or '15 min'}
**Module:** {args.module}

---

## Learning Objective

By the end of this lesson, you will be able to: [COMPLETE THIS]

---

## Introduction

[Hook — why this matters, 2-3 sentences]

---

## Core Content

### [Section 1 Title]

[Content — 150-300 words]

### [Section 2 Title]

[Content — 150-300 words]

### [Section 3 Title]

[Content — 150-300 words]

---

## Key Takeaway

[One sentence — the single most important thing from this lesson]

---

## Action Step

[One specific thing to do right now — must be completable in 5-15 min]

---

## Resources

- [Link or reference relevant to this lesson]
"""
    lesson_file.write_text(content, encoding="utf-8")
    print(f"[OK] Lesson scaffold created: {lesson_file}")

def cmd_quiz(args):
    course_dir = Path(args.course_dir)
    mod_dir = course_dir / f"module-{args.module:02d}"
    mod_dir.mkdir(parents=True, exist_ok=True)
    quiz_file = mod_dir / "quiz.md"

    count = args.count or 4
    content = f"""# Module {args.module} Quiz

**Questions:** {count}

---

"""
    for i in range(1, count + 1):
        content += f"""## Question {i}

[QUESTION TEXT]

A) [Option A]
B) [Option B]
C) [Option C]
D) [Option D]

**Correct Answer:** [A/B/C/D]
**Explanation:** [Why this is correct]

---

"""
    quiz_file.write_text(content, encoding="utf-8")
    print(f"[OK] Quiz scaffold created: {quiz_file}")

def cmd_export(args):
    course_dir = Path(args.course_dir)
    fmt = args.format or "markdown"
    out_dir = course_dir / "export"
    out_dir.mkdir(exist_ok=True)

    # Collect all lessons
    modules = sorted(course_dir.glob("module-*/"))
    all_lessons = []
    for mod in modules:
        lessons = sorted(mod.glob("lesson-*.md"))
        quiz    = mod / "quiz.md"
        for l in lessons:
            all_lessons.append({"file": l, "content": l.read_text(encoding="utf-8")})
        if quiz.exists():
            all_lessons.append({"file": quiz, "content": quiz.read_text(encoding="utf-8"), "is_quiz": True})

    if fmt == "markdown":
        combined = "\n\n---\n\n".join(l["content"] for l in all_lessons)
        out = out_dir / "course-complete.md"
        out.write_text(combined, encoding="utf-8")
        print(f"[OK] Markdown export: {out} ({len(all_lessons)} files combined)")

    elif fmt == "json":
        structure = []
        for mod in modules:
            mod_data = {"module": mod.name, "lessons": []}
            for l in sorted(mod.glob("lesson-*.md")):
                mod_data["lessons"].append({"file": l.name, "content": l.read_text(encoding="utf-8")})
            structure.append(mod_data)
        out = out_dir / "course.json"
        out.write_text(json.dumps(structure, indent=2), encoding="utf-8")
        print(f"[OK] JSON export: {out}")

    elif fmt == "html":
        body = ""
        for l in all_lessons:
            # Basic md -> html
            text = l["content"]
            import re
            text = re.sub(r'^## (.+)$', r'<h2>\1</h2>', text, flags=re.MULTILINE)
            text = re.sub(r'^# (.+)$',  r'<h1>\1</h1>', text, flags=re.MULTILINE)
            text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
            body += f"<section>{text}</section>\n\n"
        html = f"<!DOCTYPE html><html><head><meta charset='UTF-8'><title>Course</title></head><body>{body}</body></html>"
        out = out_dir / "course.html"
        out.write_text(html, encoding="utf-8")
        print(f"[OK] HTML export: {out}")

def main():
    p = argparse.ArgumentParser(description="Online course scaffolder")
    sub = p.add_subparsers(dest="command")

    ol = sub.add_parser("outline")
    ol.add_argument("--title", required=True)
    ol.add_argument("--audience", default="")
    ol.add_argument("--outcome", default="")
    ol.add_argument("--modules", type=int, default=8)
    ol.add_argument("--output")

    ls = sub.add_parser("lesson")
    ls.add_argument("--course-dir", required=True)
    ls.add_argument("--module", type=int, required=True)
    ls.add_argument("--lesson", type=int, required=True)
    ls.add_argument("--title", required=True)
    ls.add_argument("--duration")

    qz = sub.add_parser("quiz")
    qz.add_argument("--course-dir", required=True)
    qz.add_argument("--module", type=int, required=True)
    qz.add_argument("--count", type=int, default=4)

    ex = sub.add_parser("export")
    ex.add_argument("--course-dir", required=True)
    ex.add_argument("--format", default="markdown", choices=["markdown", "json", "html"])

    args = p.parse_args()
    dispatch = {"outline": cmd_outline, "lesson": cmd_lesson, "quiz": cmd_quiz, "export": cmd_export}
    if args.command in dispatch:
        dispatch[args.command](args)
    else:
        p.print_help()

if __name__ == "__main__":
    main()
