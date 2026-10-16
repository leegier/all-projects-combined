# PDF Generation — Reference Guide

The definitive guide for generating professional PDFs programmatically — from KDP-ready book interiors to
branded reports and data-driven documents. Covers reportlab, wkhtmltopdf, and KDP submission specs.

---

## TABLE OF CONTENTS
1. Tool Selection Matrix
2. KDP Publishing Specifications (Critical)
3. Reportlab Core Patterns
4. Page Layout & Geometry
5. Typography & Text Styles
6. Images & Graphics
7. Tables & Data Layout
8. Color Management & Profiles
9. Multi-Page Documents
10. Cover Design Specs
11. Template-Based Generation
12. HTML-to-PDF Pipeline
13. PDF Post-Processing
14. Quality Checklist

---

## 1. TOOL SELECTION MATRIX

| Use Case | Best Tool | Why |
|---|---|---|
| KDP interior (book) | reportlab | Precise page control, CMYK support, scalable |
| Data report | reportlab | Programmatic tables, charts, dynamic content |
| Styled HTML → PDF | wkhtmltopdf or weasyprint | CSS-driven layout |
| Merge/split PDFs | pypdf or pikepdf | Battle-tested PDF manipulation |
| Cover (KDP) | Canva export OR reportlab | Must match exact bleed/spine specs |
| Workbooks/journals | reportlab | Lines, checkboxes, form fields |

### Install Requirements
```
reportlab==4.0.8
pypdf==3.17.4
Pillow==10.1.0
wkhtmltopdf (system binary)
weasyprint==60.1
```

---

## 2. KDP PUBLISHING SPECIFICATIONS (CRITICAL)

Getting these wrong = KDP rejection. Memorize them.

### Trim Sizes (Most Common)
| Size | Dimensions | Use Case |
|---|---|---|
| 6×9 | 6.000" × 9.000" | Standard nonfiction, guides |
| 5×8 | 5.000" × 8.000" | Novels, memoirs |
| 8.5×11 | 8.500" × 11.000" | Workbooks, journals, planners |
| 7×10 | 7.000" × 10.000" | Textbooks, large-format nonfiction |

### Interior Margins (KDP Required Minimums)
```
Outside margin: 0.25" minimum
Top/bottom margin: 0.25" minimum

INSIDE (gutter) margins by page count:
  24–150 pages:   0.375" 
  151–300 pages:  0.500"
  301–500 pages:  0.625"
  501–700 pages:  0.750"
  701+ pages:     0.875"

SAFE ZONE: Add 0.125" beyond minimum for visual safety.
```

### Interior File Requirements
```
- Format: PDF/X-1a preferred (PDF 1.3–1.5 acceptable)
- Resolution: 300 DPI minimum for images; 600 DPI preferred
- Color: 
  - Black & white: Grayscale (no RGB, no CMYK)  
  - Color printing: CMYK (not RGB)
- Bleed: NOT required for interiors (only covers)
- Fonts: Must be embedded (subset embedding is fine)
- Page count: Must be even (add blank page if needed)
- No crop marks in interior file
- First page = right-hand page (odd number)
```

### Cover File Requirements
```
Cover = front + spine + back as ONE flat PDF

Bleed: 0.125" on ALL sides (including outside edges)

Spine width formula: 
  B&W cream paper: page_count × 0.0025" (per page)
  B&W white paper: page_count × 0.002252" (per page)  
  Color paper:     page_count × 0.002347" (per page)

Total cover width = bleed + back + spine + front + bleed
  = 0.125 + trim_width + spine + trim_width + 0.125

Total cover height = bleed + trim_height + bleed
  = 0.125 + trim_height + 0.125

Color space: CMYK
Resolution: 300 DPI minimum
Fonts: Embedded
Format: PDF
```

### Reportlab Units — KDP Conversion
```python
from reportlab.lib.units import inch, cm, mm

# KDP 6x9 page
PAGE_WIDTH = 6 * inch   # 432 points
PAGE_HEIGHT = 9 * inch  # 648 points

# 1 inch = 72 points in reportlab
# So: 0.75" gutter = 0.75 * inch = 54 points
```

---

## 3. REPORTLAB CORE PATTERNS

### Basic Document Setup
```python
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak,
    Table, TableStyle, Image, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from pathlib import Path

def build_document(
    output_path: Path,
    content: list,
    page_width_in: float = 6.0,
    page_height_in: float = 9.0,
    margin_top_in: float = 0.75,
    margin_bottom_in: float = 0.75,
    margin_left_in: float = 0.875,   # gutter (inside)
    margin_right_in: float = 0.625,  # outside
) -> Path:
    """Build a PDF document from a list of flowable content elements."""
    
    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=(page_width_in * inch, page_height_in * inch),
        topMargin=margin_top_in * inch,
        bottomMargin=margin_bottom_in * inch,
        leftMargin=margin_left_in * inch,
        rightMargin=margin_right_in * inch,
        title="Document Title",
        author="Ten Life Creatives",
    )
    
    doc.build(content, onFirstPage=add_header_footer, onLaterPages=add_header_footer)
    return output_path
```

### Style Registry
```python
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY

def build_style_registry() -> dict:
    """Create a complete style registry for consistent document formatting."""
    base = getSampleStyleSheet()
    
    styles = {
        # Chapter title
        'h1': ParagraphStyle(
            'H1',
            fontName='Helvetica-Bold',
            fontSize=24,
            leading=30,
            spaceAfter=18,
            spaceBefore=24,
            alignment=TA_LEFT,
        ),
        # Section heading
        'h2': ParagraphStyle(
            'H2',
            fontName='Helvetica-Bold',
            fontSize=16,
            leading=20,
            spaceAfter=10,
            spaceBefore=16,
            alignment=TA_LEFT,
        ),
        # Body text — use JUSTIFY for book interiors
        'body': ParagraphStyle(
            'Body',
            fontName='Helvetica',
            fontSize=11,
            leading=16,           # leading = line height; typically 1.4-1.5x font size
            spaceAfter=8,
            alignment=TA_JUSTIFY,
        ),
        # First paragraph after heading — no indent
        'body_first': ParagraphStyle(
            'BodyFirst',
            parent=base['Normal'],
            fontName='Helvetica',
            fontSize=11,
            leading=16,
            firstLineIndent=0,
            alignment=TA_JUSTIFY,
        ),
        # Indented body paragraph (standard for book chapters)
        'body_indent': ParagraphStyle(
            'BodyIndent',
            fontName='Helvetica',
            fontSize=11,
            leading=16,
            firstLineIndent=0.3 * inch,
            alignment=TA_JUSTIFY,
        ),
        # Caption below image/table
        'caption': ParagraphStyle(
            'Caption',
            fontName='Helvetica-Oblique',
            fontSize=9,
            leading=12,
            alignment=TA_CENTER,
            textColor=colors.grey,
        ),
        # Callout box text
        'callout': ParagraphStyle(
            'Callout',
            fontName='Helvetica',
            fontSize=11,
            leading=16,
            leftIndent=18,
            rightIndent=18,
            borderPad=8,
        ),
        # Page header/footer
        'page_number': ParagraphStyle(
            'PageNumber',
            fontName='Helvetica',
            fontSize=9,
            alignment=TA_CENTER,
            textColor=colors.grey,
        ),
    }
    return styles
```

---

## 4. PAGE LAYOUT & GEOMETRY

### Header/Footer Functions
```python
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.pdfgen import canvas as pdfcanvas

def add_header_footer(canvas, doc):
    """Called on every page. Adds page numbers and optional header."""
    canvas.saveState()
    
    page_width = doc.pagesize[0]
    page_height = doc.pagesize[1]
    
    # Footer: page number centered
    canvas.setFont('Helvetica', 9)
    canvas.setFillColor(colors.grey)
    canvas.drawCentredString(
        page_width / 2,
        0.5 * inch,
        str(canvas.getPageNumber())
    )
    
    # Header: title on even pages, chapter on odd pages
    if canvas.getPageNumber() > 1:
        canvas.setFont('Helvetica-Oblique', 8)
        if canvas.getPageNumber() % 2 == 0:  # Even = left page
            canvas.drawString(doc.leftMargin, page_height - 0.5 * inch, "Book Title")
        else:  # Odd = right page
            canvas.drawRightString(
                page_width - doc.rightMargin,
                page_height - 0.5 * inch,
                "Chapter Name"
            )
    
    canvas.restoreState()

def add_decorative_rule(canvas, y_position: float, page_width: float, margin: float):
    """Draw a horizontal rule across the page within margins."""
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor('#333333'))
    canvas.setLineWidth(0.5)
    canvas.line(margin, y_position, page_width - margin, y_position)
    canvas.restoreState()
```

### Callout Box / Sidebar
```python
from reportlab.platypus import Flowable
from reportlab.lib import colors

class CalloutBox(Flowable):
    """A styled callout/tip box with background color."""
    
    def __init__(self, text: str, title: str = None, width: float = None,
                 bg_color=None, border_color=None):
        Flowable.__init__(self)
        self.text = text
        self.title = title
        self.width = width or 4.5 * inch
        self.bg_color = bg_color or colors.HexColor('#F5F5F5')
        self.border_color = border_color or colors.HexColor('#DDDDDD')
        self.padding = 12
    
    def wrap(self, available_width, available_height):
        self.width = available_width
        # Estimate height based on text length
        self.height = 80 + (len(self.text) / 60) * 14
        return (self.width, self.height)
    
    def draw(self):
        # Background
        self.canv.setFillColor(self.bg_color)
        self.canv.roundRect(0, 0, self.width, self.height, 6, fill=1, stroke=0)
        
        # Border
        self.canv.setStrokeColor(self.border_color)
        self.canv.setLineWidth(1)
        self.canv.roundRect(0, 0, self.width, self.height, 6, fill=0, stroke=1)
        
        # Title
        y = self.height - self.padding - 14
        if self.title:
            self.canv.setFont('Helvetica-Bold', 11)
            self.canv.setFillColor(colors.HexColor('#222222'))
            self.canv.drawString(self.padding, y, self.title)
            y -= 18
        
        # Text
        self.canv.setFont('Helvetica', 10)
        self.canv.setFillColor(colors.HexColor('#444444'))
        self.canv.drawString(self.padding, y, self.text[:80])  # Simplified — use paragraphs for real impl
```

---

## 5. TYPOGRAPHY & TEXT STYLES

### Font Registration
```python
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

def register_custom_fonts(font_dir: Path) -> None:
    """Register TTF fonts for use in PDF generation."""
    fonts_to_register = [
        ('Merriweather', 'Merriweather-Regular.ttf'),
        ('Merriweather-Bold', 'Merriweather-Bold.ttf'),
        ('Merriweather-Italic', 'Merriweather-Italic.ttf'),
        ('OpenSans', 'OpenSans-Regular.ttf'),
        ('OpenSans-Bold', 'OpenSans-Bold.ttf'),
    ]
    
    for font_name, filename in fonts_to_register:
        font_path = font_dir / filename
        if font_path.exists():
            pdfmetrics.registerFont(TTFont(font_name, str(font_path)))
        else:
            import warnings
            warnings.warn(f"Font file not found: {font_path}. Using Helvetica fallback.")

# Text formatting in reportlab uses XML-like tags in Paragraph
def format_paragraph_text(text: str) -> str:
    """
    Reportlab Paragraph supports these inline tags:
    <b>bold</b>
    <i>italic</i>
    <u>underline</u>
    <font color="red" size="14">styled</font>
    <br/> for line break
    """
    return text  # Pass through — formatting applied via style or inline tags
```

### Typography Best Practices for Books
```
BODY TEXT:
  - Font size: 10–12pt (11pt is standard)
  - Leading: 1.4–1.5x font size (11pt font → 15–16pt leading)
  - Justified alignment for book interiors
  - First paragraph after heading: no indent
  - Subsequent paragraphs: 0.25–0.375" first-line indent
  - No extra space between paragraphs in book style

HEADINGS:
  - Chapter titles: 18–24pt, bold or display font
  - Section heads: 13–16pt, bold
  - Subheads: 11–13pt, bold or small caps
  - Always visually heavier than body text

LINE LENGTH (ideal):
  - 55–75 characters per line
  - This is why 6×9 with 0.75" margins works — gives ideal line length

WIDOWS & ORPHANS:
  - Widow: last line of paragraph at top of page → bad
  - Orphan: first line of paragraph at bottom of page → bad
  - Reportlab: use keepWithNext=1 on paragraphs to prevent
```

---

## 6. IMAGES & GRAPHICS

### Image Insertion
```python
from reportlab.platypus import Image
from PIL import Image as PILImage
from pathlib import Path

def insert_image(
    image_path: Path,
    max_width: float,
    max_height: float,
    center: bool = True
) -> Image:
    """Insert image with preserved aspect ratio, scaled to fit."""
    
    # Get actual dimensions
    with PILImage.open(image_path) as img:
        orig_width, orig_height = img.size
        dpi = img.info.get('dpi', (72, 72))[0]
    
    # Convert pixels to points at document DPI
    img_width_pts = (orig_width / dpi) * 72
    img_height_pts = (orig_height / dpi) * 72
    
    # Scale to fit within bounds while preserving aspect ratio
    scale = min(max_width / img_width_pts, max_height / img_height_pts, 1.0)
    final_width = img_width_pts * scale
    final_height = img_height_pts * scale
    
    img = Image(str(image_path), width=final_width, height=final_height)
    if center:
        img.hAlign = 'CENTER'
    return img

def check_image_dpi(image_path: Path, min_dpi: int = 300) -> bool:
    """Verify image meets minimum DPI for print quality."""
    with PILImage.open(image_path) as img:
        dpi = img.info.get('dpi', (72, 72))
        return min(dpi) >= min_dpi
```

---

## 7. TABLES & DATA LAYOUT

### Table Creation Pattern
```python
from reportlab.platypus import Table, TableStyle
from reportlab.lib import colors

def build_data_table(
    headers: list,
    rows: list,
    col_widths: list = None,
    stripe: bool = True,
) -> Table:
    """Build a styled data table."""
    
    data = [headers] + rows
    
    table = Table(data, colWidths=col_widths, repeatRows=1)
    
    style_commands = [
        # Header row
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2C3E50')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        
        # Data rows
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('TOPPADDING', (0, 1), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        
        # Grid
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#DDDDDD')),
        ('LINEBELOW', (0, 0), (-1, 0), 1.5, colors.HexColor('#2C3E50')),
        
        # Alignment
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]
    
    # Alternating row colors
    if stripe:
        for i in range(1, len(rows) + 1):
            if i % 2 == 0:
                style_commands.append(
                    ('BACKGROUND', (0, i), (-1, i), colors.HexColor('#F8F9FA'))
                )
    
    table.setStyle(TableStyle(style_commands))
    return table
```

---

## 8. COLOR MANAGEMENT & PROFILES

### KDP Color Requirements
```python
from reportlab.lib.colors import Color, CMYKColor, HexColor

# For PRINT: Use CMYK values (0–1 range)
BLACK = CMYKColor(0, 0, 0, 1)           # Pure black
DARK_GREY = CMYKColor(0, 0, 0, 0.7)     # 70% black
LIGHT_GREY = CMYKColor(0, 0, 0, 0.15)   # 15% black
WHITE = CMYKColor(0, 0, 0, 0)

# Brand blues in CMYK
NAVY = CMYKColor(0.89, 0.72, 0, 0.38)
TEAL = CMYKColor(0.85, 0, 0.25, 0.2)

# For black & white KDP interior:
# ONLY use grayscale values — no color elements
BW_HEADING = CMYKColor(0, 0, 0, 0.9)    # Near-black for headings
BW_BODY = CMYKColor(0, 0, 0, 1)          # True black for body text
BW_RULE = CMYKColor(0, 0, 0, 0.3)        # Light grey for dividers

# For screen/ebooks: Use RGB
SCREEN_ACCENT = HexColor('#2563EB')
SCREEN_TEXT = HexColor('#1A1A1A')
SCREEN_MUTED = HexColor('#6B7280')
```

### Color Profile Embedding
```python
# For KDP submissions, ensure CMYK profile
# reportlab does not embed ICC profiles by default
# Solution: use CMYK colors throughout and convert at export
# OR: open in Acrobat/Ghostscript and convert to PDF/X-1a

# Ghostscript conversion command for PDF/X-1a:
GS_CONVERT_CMD = """
gs -dBATCH -dNOPAUSE -dNOOUTERSAVE \
   -sDEVICE=pdfwrite \
   -dPDFSETTINGS=/prepress \
   -sOutputFile="{output}" \
   "{input}"
"""
```

---

## 9. MULTI-PAGE DOCUMENTS

### Chapter Structure Pattern
```python
from reportlab.platypus import PageBreak, CondPageBreak, KeepTogether

def build_book_content(chapters: list, styles: dict) -> list:
    """Build complete book content as flowable list."""
    content = []
    
    for i, chapter in enumerate(chapters):
        # Force new page for each chapter (on odd page for book layout)
        if i > 0:
            content.append(PageBreak())
        
        # Chapter number
        content.append(Paragraph(f"Chapter {i + 1}", styles['chapter_number']))
        content.append(Spacer(1, 0.1 * inch))
        
        # Chapter title
        content.append(Paragraph(chapter['title'], styles['h1']))
        content.append(Spacer(1, 0.3 * inch))
        
        # Chapter content
        for block in chapter['content']:
            if block['type'] == 'paragraph':
                content.append(Paragraph(block['text'], styles['body']))
            elif block['type'] == 'heading':
                # Keep heading with at least 2 lines of following text
                content.append(KeepTogether([
                    Paragraph(block['text'], styles['h2']),
                    Spacer(1, 0.1 * inch),
                ]))
            elif block['type'] == 'callout':
                content.append(Spacer(1, 0.15 * inch))
                content.append(CalloutBox(block['text'], title=block.get('title')))
                content.append(Spacer(1, 0.15 * inch))
            elif block['type'] == 'image':
                content.append(Spacer(1, 0.1 * inch))
                content.append(insert_image(Path(block['path']), 4.0 * inch, 3.0 * inch))
                if block.get('caption'):
                    content.append(Paragraph(block['caption'], styles['caption']))
                content.append(Spacer(1, 0.1 * inch))
    
    return content
```

---

## 10. COVER DESIGN SPECS

### KDP Cover Calculator
```python
def calculate_kdp_cover_dimensions(
    trim_width_in: float,
    trim_height_in: float,
    page_count: int,
    paper: str = 'white'
) -> dict:
    """Calculate complete KDP cover dimensions including bleed and spine."""
    
    bleed = 0.125  # inches on each side
    
    # Spine width lookup (inches per page)
    spine_per_page = {
        'white': 0.002252,
        'cream': 0.0025,
        'color': 0.002347,
    }
    
    spine_width = page_count * spine_per_page.get(paper, 0.002252)
    
    total_width = bleed + trim_width_in + spine_width + trim_width_in + bleed
    total_height = bleed + trim_height_in + bleed
    
    return {
        'total_width_in': round(total_width, 4),
        'total_height_in': round(total_height, 4),
        'total_width_px_300dpi': round(total_width * 300),
        'total_height_px_300dpi': round(total_height * 300),
        'spine_width_in': round(spine_width, 4),
        'spine_width_px_300dpi': round(spine_width * 300),
        'bleed_in': bleed,
        'front_cover_starts_at_in': round(bleed + trim_width_in + spine_width, 4),
    }

# Example: 6x9, 120 pages, white paper
# total_width_in = 0.125 + 6 + 0.270 + 6 + 0.125 = 12.52"
# spine_width_in = 120 * 0.002252 = 0.2702"
```

---

## 11. TEMPLATE-BASED GENERATION

### Parameterized Document Template
```python
from jinja2 import Environment, FileSystemLoader
import json

class PDFDocumentBuilder:
    """Build PDFs from templates with variable substitution."""
    
    def __init__(self, template_dir: Path):
        self.template_dir = template_dir
        self.jinja_env = Environment(loader=FileSystemLoader(str(template_dir)))
    
    def render_template(self, template_name: str, variables: dict) -> str:
        """Render a Jinja2 template to HTML string."""
        template = self.jinja_env.get_template(template_name)
        return template.render(**variables)
    
    def build_from_config(self, config_path: Path) -> Path:
        """Build a PDF document from a JSON config file."""
        config = json.loads(config_path.read_text())
        
        # Load content
        content_blocks = self._load_content(config['content'])
        
        # Build styles
        styles = build_style_registry()
        
        # Assemble flowables
        flowables = self._assemble_flowables(content_blocks, styles)
        
        # Output path
        output_path = Path(config.get('output', 'output.pdf'))
        
        return build_document(output_path, flowables, **config.get('page', {}))
```

---

## 12. HTML-TO-PDF PIPELINE

### wkhtmltopdf Usage
```python
import subprocess
import tempfile
from pathlib import Path

def html_to_pdf(
    html_content: str,
    output_path: Path,
    page_size: str = 'Letter',
    margin_in: float = 0.75,
) -> Path:
    """Convert HTML string to PDF using wkhtmltopdf."""
    
    # Write HTML to temp file
    with tempfile.NamedTemporaryFile(suffix='.html', mode='w', delete=False) as f:
        f.write(html_content)
        html_path = f.name
    
    try:
        cmd = [
            'wkhtmltopdf',
            '--page-size', page_size,
            '--margin-top', f'{margin_in}in',
            '--margin-bottom', f'{margin_in}in',
            '--margin-left', f'{margin_in}in',
            '--margin-right', f'{margin_in}in',
            '--encoding', 'UTF-8',
            '--print-media-type',
            '--no-outline',
            html_path,
            str(output_path),
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        
        if result.returncode != 0:
            raise RuntimeError(f"wkhtmltopdf failed: {result.stderr}")
        
        return output_path
    finally:
        Path(html_path).unlink(missing_ok=True)
```

---

## 13. PDF POST-PROCESSING

### Merge, Split, Compress
```python
from pypdf import PdfWriter, PdfReader
from pathlib import Path

def merge_pdfs(input_paths: list, output_path: Path) -> Path:
    """Merge multiple PDFs into one."""
    writer = PdfWriter()
    for path in input_paths:
        reader = PdfReader(str(path))
        for page in reader.pages:
            writer.add_page(page)
    with open(output_path, 'wb') as f:
        writer.write(f)
    return output_path

def ensure_even_pages(pdf_path: Path) -> Path:
    """Add blank page if PDF has odd page count (required for KDP)."""
    reader = PdfReader(str(pdf_path))
    if len(reader.pages) % 2 != 0:
        writer = PdfWriter()
        for page in reader.pages:
            writer.add_page(page)
        # Add blank page at end
        from reportlab.pdfgen import canvas as pdfcanvas
        import io
        packet = io.BytesIO()
        c = pdfcanvas.Canvas(packet, pagesize=reader.pages[0].mediabox)
        c.save()
        packet.seek(0)
        blank_reader = PdfReader(packet)
        writer.add_page(blank_reader.pages[0])
        output_path = pdf_path.with_stem(pdf_path.stem + '_even')
        with open(output_path, 'wb') as f:
            writer.write(f)
        return output_path
    return pdf_path
```

---

## 14. QUALITY CHECKLIST

Before submitting any PDF to KDP or delivering to client:

**Interior File:**
- [ ] Page size matches selected trim size (exact, no rounding)
- [ ] All margins meet KDP minimums for page count
- [ ] No content in bleed/margin area
- [ ] All fonts embedded (Check: File → Properties → Fonts in Acrobat)
- [ ] Images are 300 DPI or higher
- [ ] Color space is correct (grayscale for B&W, CMYK for color)
- [ ] Page count is even
- [ ] First page is right-hand (odd)
- [ ] No crop marks
- [ ] File size under 650 MB (KDP limit)
- [ ] PDF version 1.3–1.7

**Cover File:**
- [ ] Dimensions match calculated cover size exactly
- [ ] Bleed extends 0.125" on all four sides
- [ ] No critical content within 0.25" of trim lines
- [ ] Spine text is centered within spine width
- [ ] Title/author on spine is readable at 100%
- [ ] Back cover has ISBN barcode space (lower right)
- [ ] CMYK color mode
- [ ] 300 DPI everywhere
- [ ] Fonts embedded

---

*Reference: KDP Paperback Content Guidelines (kdp.amazon.com/en_US/help/topic/G201953020)*
