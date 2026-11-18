from pathlib import Path
import re

md = Path('output/gumroad-ai-prompt-pack.md').read_text(encoding='utf-8')

html = md
html = re.sub(r'^### (.+)$', r'<h3>\1</h3>', html, flags=re.MULTILINE)
html = re.sub(r'^## (.+)$',  r'<h2>\1</h2>', html, flags=re.MULTILINE)
html = re.sub(r'^# (.+)$',   r'<h1>\1</h1>', html, flags=re.MULTILINE)
html = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', html)

def code_block(m):
    return '<pre><code>' + m.group(1).replace('<','&lt;').replace('>','&gt;') + '</code></pre>'
html = re.sub(r'```\w*\n(.*?)```', code_block, html, flags=re.DOTALL)
html = re.sub(r'^\- (.+)$', r'<li>\1</li>', html, flags=re.MULTILINE)
html = re.sub(r'(<li>.*?</li>\n?)+', lambda m: '<ul>' + m.group(0) + '</ul>\n', html, flags=re.DOTALL)

blocks = html.split('\n\n')
result = []
for b in blocks:
    b = b.strip()
    if not b:
        continue
    if b.startswith('<'):
        result.append(b)
    else:
        result.append('<p>' + b + '</p>')
body = '\n'.join(result)

style = """
body{font-family:Georgia,serif;max-width:800px;margin:40px auto;padding:0 24px;color:#1a1a1a;line-height:1.7;font-size:1.05rem;}
h1{font-size:2rem;border-bottom:3px solid #1a1a1a;padding-bottom:10px;margin-top:2em;}
h2{font-size:1.5rem;margin-top:2em;color:#333;}
h3{font-size:1.2rem;margin-top:1.5em;}
pre{background:#f4f4f4;padding:16px;border-radius:6px;overflow-x:auto;white-space:pre-wrap;}
code{font-family:monospace;font-size:0.9em;}
ul{margin:1em 0 1em 2em;}li{margin:0.4em 0;}
strong{font-weight:700;}
@media print{body{font-size:10pt;} h1{page-break-before:always;} }
"""

page = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>AI Game Dev Prompt Pack</title>
<style>{style}</style></head>
<body>{body}</body></html>"""

Path('output/ai-prompt-pack.html').write_text(page, encoding='utf-8')
size = round(len(page)/1024, 1)
print(f"[OK] output/ai-prompt-pack.html ({size} KB) - open in browser and Print > Save as PDF")
