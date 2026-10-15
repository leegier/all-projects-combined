#!/usr/bin/env python3
"""Contact sheets for reviewing captured frames.  python3 tools/montage.py DIR OUTPREFIX [cols=2] [rows=3] [width=640]"""
import sys, glob, os
from PIL import Image, ImageDraw
d, outp = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 2
rows = int(sys.argv[4]) if len(sys.argv) > 4 else 3
tw = int(sys.argv[5]) if len(sys.argv) > 5 else 640
files = sorted(glob.glob(os.path.join(d, '*.jpg')))
th = tw * 9 // 16
per = cols * rows
for si in range(0, len(files), per):
    sheet = Image.new('RGB', (cols * tw, rows * th), (0, 0, 0))
    for k, f in enumerate(files[si:si + per]):
        im = Image.open(f).convert('RGB').resize((tw, th), Image.LANCZOS)
        dr = ImageDraw.Draw(im); dr.rectangle([0, 0, 112, 16], fill=(0, 0, 0)); dr.text((4, 2), os.path.basename(f)[:-4], fill=(255, 255, 0))
        sheet.paste(im, ((k % cols) * tw, (k // cols) * th))
    sheet.save(f'{outp}_{si // per:02d}.jpg', quality=90)
print(len(files), 'frames ->', (len(files) + per - 1) // per, 'sheets')
