#!/usr/bin/env python3
"""
ebook_export.py — Combine Markdown chapter files into HTML or PDF.
HTML: no dependencies. PDF: requires pandoc installed.
Usage:
  python ebook_export.py --input output/ebook-slug/ --format html --output output/ebook.html
  python ebook_export.py --input output/ebook-slug/ --format pdf  --output output/ebook.pdf
"""
import argparse
import os
import re
import subprocess
import sys
from pathlib import Path
from datetime import datetime, timezone

def md_to_html_basic(md_text):
    """Very basic Markdown → HTML (headings, bold, italic, code, paragraphs)."""
    html = md_text
    # Headings
    html = re.sub(r'^### (.+)$', r'<h3>\1</h3>', html, flags=re.MULTILINE)
    html = re.sub(r'^## (.+)$',  r'<h2>\1</h2>', html, flags=re.MULTILINE)
    html = re.sub(r'^# (.+)$',   r'<h1>\1</h1>', html, flags=re.MULTILINE)
    # Bold/italic
    html = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', html)
    html = re.sub(r'\*(.+?)\*',     r'<em>\1</em>', html)
    # Inline code
    html = re.sub(r'`(.+?)`', r'<code>\1</code>', html)
    # Code blocks
    html = re.sub(r'```[\w]*\n(.*?)```', r'<pre><code>\1</code></pre>', html, flags=re.DOTALL)
    # Horizontal rule
    html = re.sub(r'^---$', r'<hr>', html, flags=re.MULTILINE)
    # Paragraphs (blank-line separated blocks not already tagged)
    blocks = html.split('\n\n')
    result = []
    for block in blocks:
        block = block.strip()
        if not block:
            continue
        if block.startswith('<'):
            result.append(block)
        else:
            lines = block.split('\n')
            # Bullet list
            if all(l.startswith('- ') or l.startswith('* ') for l in lines if l.strip()):
                items = ''.join(f'<li>{l.lstrip("-* ").strip()}</li>' for l in lines if l.strip())
                result.append(f'<ul>{items}</ul>')
            else:
                result.append(f'<p>{" ".join(lines)}</p>')
    return '\n'.join(result)

def collect_chapters(input_dir):
    """Collect .md files sorted by filename."""
    p = Path(input_dir)
    files = sorted(p.glob("*.md"))
    if not files:
        print(f"No .md files found in {input_dir}")
        sys.exit(1)
    return files

def build_html(files, title="Ebook"):
    chapters_html = ""
    for f in files:
        content = f.read_text(encoding="utf-8")
        chapters_html += f'<article class="chapter">\n{md_to_html_basic(content)}\n</article>\n\n'

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
  <style>
    body {{ font-family: Georgia, 'Times New Roman', serif; max-width: 720px; margin: 0 auto; padding: 40px 24px; color: #1a1a1a; line-height: 1.8; font-size: 1.05rem; }}
    h1 {{ font-size: 2rem; margin-top: 2em; border-bottom: 2px solid #1a1a1a; padding-bottom: 0.3em; }}
    h2 {{ font-size: 1.5rem; margin-top: 1.8em; color: #333; }}
    h3 {{ font-size: 1.2rem; margin-top: 1.5em; }}
    p {{ margin: 1em 0; }}
    ul, ol {{ margin: 1em 0 1em 2em; }}
    li {{ margin: 0.4em 0; }}
    code {{ background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }}
    pre {{ background: #f4f4f4; padding: 16px; border-radius: 6px; overflow-x: auto; }}
    pre code {{ background: none; padding: 0; }}
    hr {{ border: none; border-top: 1px solid #ddd; margin: 3em 0; }}
    .chapter {{ margin-bottom: 4em; }}
    @media print {{
      body {{ font-size: 11pt; }}
      .chapter {{ page-break-after: always; }}
    }}
  </style>
</head>
<body>
{chapters_html}
</body>
</html>"""

def main():
    p = argparse.ArgumentParser(description="Export ebook chapters to HTML or PDF")
    p.add_argument("--input",  required=True, help="Directory containing chapter .md files")
    p.add_argument("--format", required=True, choices=["html", "pdf"], help="Output format")
    p.add_argument("--output", required=True, help="Output file path")
    p.add_argument("--title",  default="",    help="Ebook title for HTML metadata")
    args = p.parse_args()

    files = collect_chapters(args.input)
    print(f"Found {len(files)} chapter(s): {[f.name for f in files]}")

    # Derive title from first file's first heading if not given
    title = args.title
    if not title and files:
        first = files[0].read_text(encoding="utf-8")
        m = re.search(r'^# (.+)$', first, re.MULTILINE)
        if m:
            title = m.group(1)

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)

    if args.format == "html":
        html = build_html(files, title=title or "Ebook")
        out.write_text(html, encoding="utf-8")
        size_kb = len(html.encode()) / 1024
        print(f"[OK] HTML exported: {out} ({size_kb:.1f} KB)")

    elif args.format == "pdf":
        # Requires pandoc
        try:
            subprocess.run(["pandoc", "--version"], capture_output=True, check=True)
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("ERROR: pandoc not found. Install from https://pandoc.org/installing.html")
            print("Falling back to HTML export...")
            html_out = out.with_suffix(".html")
            html = build_html(files, title=title or "Ebook")
            html_out.write_text(html, encoding="utf-8")
            print(f"[OK] HTML saved instead: {html_out}")
            return

        # Combine all md files into one temp file
        combined = "\n\n---\n\n".join(f.read_text(encoding="utf-8") for f in files)
        tmp = out.parent / "_combined.md"
        tmp.write_text(combined, encoding="utf-8")

        cmd = ["pandoc", str(tmp), "-o", str(out),
               "--pdf-engine=xelatex",
               f"--metadata=title:{title}",
               "--toc"]
        result = subprocess.run(cmd, capture_output=True, text=True)
        tmp.unlink(missing_ok=True)

        if result.returncode == 0:
            print(f"[OK] PDF exported: {out}")
        else:
            print(f"ERROR: pandoc failed: {result.stderr}")
            sys.exit(1)

if __name__ == "__main__":
    main()
