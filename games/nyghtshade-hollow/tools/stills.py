#!/usr/bin/env python3
"""Pick stills from a finished capture.  python3 tools/stills.py CAPTURE_DIR OUT_DIR  t1:name1 t2:name2 ...
t = simulated seconds; the frame whose step is closest is copied to OUT_DIR/name.jpg (re-encoded at q=90, 1280x720)."""
import sys, json, os
from PIL import Image
cap, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
sched = json.load(open(os.path.join(cap, 'schedule.json')))
for spec in sys.argv[3:]:
    t, name = spec.split(':', 1)
    target = float(t) * 60
    f = min(sched, key=lambda f: abs(f['step'] - target))
    src = os.path.join(cap, 'frames', f"f_{f['i']:06d}.jpg")
    Image.open(src).convert('RGB').save(os.path.join(out, name + '.jpg'), quality=90, optimize=True)
    print(name, 'sim', round(f['step'] / 60, 1), 's <-', os.path.basename(src))
