#!/usr/bin/env python3
"""
Quality Gate - 20-point automated article checker for Content Machine.
Reads an HTML article file, runs all checks, outputs PASS/FAIL with details.
Usage: python quality_gate.py <article.html> [--amazon-tag TAG]
"""

import sys
import re
import os
import json
from html.parser import HTMLParser

class ArticleParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags = []
        self.current_tag = None
        self.current_attrs = {}
        self.text_content = []
        self.h1_texts = []
        self.h2_texts = []
        self.images = []
        self.links = []
        self.scripts = []
        self.meta_tags = []
        self.in_tag = None

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        self.tags.append(tag)
        self.in_tag = tag

        if tag == 'img':
            self.images.append(attrs_dict)
        elif tag == 'a':
            self.links.append(attrs_dict)
        elif tag == 'script':
            self.scripts.append(attrs_dict)
        elif tag == 'meta':
            self.meta_tags.append(attrs_dict)

    def handle_endtag(self, tag):
        self.in_tag = None

    def handle_data(self, data):
        self.text_content.append(data.strip())
        if self.in_tag == 'h1':
            self.h1_texts.append(data.strip())
        elif self.in_tag == 'h2':
            self.h2_texts.append(data.strip())


def count_words(text_parts):
    return sum(len(part.split()) for part in text_parts if part)


def check_article(filepath, amazon_tag=None):
    with open(filepath, 'r', encoding='utf-8') as f:
        html = f.read()

    parser = ArticleParser()
    parser.feed(html)

    results = []
    passes = 0
    total = 0

    def check(name, condition, detail=""):
        nonlocal passes, total
        total += 1
        status = "PASS" if condition else "FAIL"
        if condition:
            passes += 1
        results.append({"check": name, "status": status, "detail": detail})

    # 1. H1 present
    check("H1 present", len(parser.h1_texts) >= 1,
          f"Found {len(parser.h1_texts)} H1 tags")

    # 2. H1 contains keyword-like text (>3 words)
    h1_word_count = count_words(parser.h1_texts)
    check("H1 keyword-rich", h1_word_count >= 3,
          f"H1 has {h1_word_count} words")

    # 3. Min 2500 words
    total_words = count_words(parser.text_content)
    check("Min 2500 words", total_words >= 2500,
          f"Article has {total_words} words")

    # 4. Has H2 subheadings
    check("H2 subheadings present", len(parser.h2_texts) >= 3,
          f"Found {len(parser.h2_texts)} H2 tags")

    # 5. H2 starts with quotable answer (bold text within 2-3 sentences)
    bold_pattern = re.findall(r'<h2[^>]*>.*?</h2>\s*<p>\s*<(?:strong|b)>', html, re.DOTALL | re.IGNORECASE)
    check("H2 followed by bold answer", len(bold_pattern) >= 1,
          f"Found {len(bold_pattern)} H2s with bold lead-in")

    # 6. FAQPage JSON-LD schema
    faq_schema = 'FAQPage' in html
    check("FAQPage schema", faq_schema)

    # 7. dateModified schema
    date_modified = 'dateModified' in html
    check("dateModified schema", date_modified)

    # 8. Min 4 images
    check("Min 4 images", len(parser.images) >= 4,
          f"Found {len(parser.images)} images")

    # 9. First image eager, rest lazy
    if len(parser.images) >= 1:
        first_eager = parser.images[0].get('loading', 'eager') != 'lazy'
        rest_lazy = all(img.get('loading') == 'lazy' for img in parser.images[1:]) if len(parser.images) > 1 else True
        check("Image loading (1 eager + lazy)", first_eager and rest_lazy,
              f"First eager: {first_eager}, rest lazy: {rest_lazy}")
    else:
        check("Image loading (1 eager + lazy)", False, "No images found")

    # 10. 5+ internal links
    internal_links = [l for l in parser.links if l.get('href', '').startswith('/') or l.get('href', '').startswith('#')]
    check("5+ internal links", len(internal_links) >= 5,
          f"Found {len(internal_links)} internal links")

    # 11. Amazon affiliate links present
    amazon_links = [l for l in parser.links if 'amazon' in l.get('href', '').lower()]
    check("Amazon affiliate links", len(amazon_links) >= 1,
          f"Found {len(amazon_links)} Amazon links")

    # 12. Amazon tag correct (if specified)
    if amazon_tag:
        correct_tags = [l for l in amazon_links if f"tag={amazon_tag}" in l.get('href', '')]
        check("Amazon tag correct", len(correct_tags) == len(amazon_links),
              f"{len(correct_tags)}/{len(amazon_links)} have correct tag '{amazon_tag}'")
    else:
        check("Amazon tag correct", True, "No tag specified, skipping")

    # 13. Comparison table present
    has_table = '<table' in html.lower()
    check("Comparison table present", has_table)

    # 14. Table has concrete numbers
    table_match = re.search(r'<table.*?</table>', html, re.DOTALL | re.IGNORECASE)
    if table_match:
        table_text = table_match.group()
        has_numbers = bool(re.search(r'\$[\d,.]+|\d+\s*(oz|lb|kg|inch|cm|mm|GB|TB|MHz|GHz|W|hr|hours)', table_text))
        check("Table has concrete numbers", has_numbers)
    else:
        check("Table has concrete numbers", False, "No table found")

    # 15. Author box present (last element or near end)
    author_pattern = re.search(r'(?:author|bio|about.the.author)', html.lower())
    check("Author box present", author_pattern is not None)

    # 16. Meta description present
    meta_desc = [m for m in parser.meta_tags if m.get('name', '').lower() == 'description']
    check("Meta description present", len(meta_desc) >= 1)

    # 17. Meta description max 155 chars
    if meta_desc:
        desc_len = len(meta_desc[0].get('content', ''))
        check("Meta description <= 155 chars", desc_len <= 155,
              f"Length: {desc_len}")
    else:
        check("Meta description <= 155 chars", False, "No meta description")

    # 18. No self-promotional listicles (neutral ranking)
    promo_patterns = re.findall(r'(?:our pick|we recommend|editor.s choice|#1 pick)', html.lower())
    check("Neutral ranking (no promo)", len(promo_patterns) == 0,
          f"Found {len(promo_patterns)} promotional phrases")

    # 19. rel=nofollow on affiliate links
    aff_links_nofollow = [l for l in amazon_links if 'nofollow' in l.get('rel', '')]
    check("Affiliate links have nofollow",
          len(aff_links_nofollow) == len(amazon_links) if amazon_links else True,
          f"{len(aff_links_nofollow)}/{len(amazon_links)} have nofollow")

    # 20. No duplicate H2s
    h2_lower = [h.lower() for h in parser.h2_texts]
    check("No duplicate H2s", len(h2_lower) == len(set(h2_lower)),
          f"{len(h2_lower)} H2s, {len(set(h2_lower))} unique")

    # Summary
    print(f"\n{'='*60}")
    print(f"QUALITY GATE REPORT: {os.path.basename(filepath)}")
    print(f"{'='*60}")
    for r in results:
        icon = "+" if r['status'] == 'PASS' else "X"
        detail = f" -- {r['detail']}" if r['detail'] else ""
        print(f"  [{icon}] {r['check']}{detail}")
    print(f"{'='*60}")
    print(f"SCORE: {passes}/{total}")
    verdict = "PASS" if passes >= 16 else "FAIL"
    print(f"VERDICT: {verdict}")
    print(f"{'='*60}\n")

    # Write JSON report
    report_path = filepath.replace('.html', '-qa-report.json')
    with open(report_path, 'w') as f:
        json.dump({
            "file": filepath,
            "score": f"{passes}/{total}",
            "verdict": verdict,
            "word_count": total_words,
            "checks": results
        }, f, indent=2)
    print(f"Report saved: {report_path}")

    return verdict == "PASS"


if __name__ == '__main__':
    if len(sys.argv) < 2 or sys.argv[1] in ('--help', '-h'):
        print("Usage: python quality_gate.py <article.html> [--amazon-tag TAG]")
        sys.exit(0 if '--help' in sys.argv or '-h' in sys.argv else 1)

    filepath = sys.argv[1]
    amazon_tag = None
    if '--amazon-tag' in sys.argv:
        idx = sys.argv.index('--amazon-tag')
        if idx + 1 < len(sys.argv):
            amazon_tag = sys.argv[idx + 1]

    success = check_article(filepath, amazon_tag)
    sys.exit(0 if success else 1)
