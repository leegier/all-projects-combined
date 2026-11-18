"""Compare textures exported by mhue with the source images the CUE4Parse fixture project cooked them from.
usage: python3 -I cmp_png.py <exported Textures dir> <fixture SourceTextures dir>     (needs Pillow; exit 0 = all within tolerance)"""
import os, sys
from PIL import Image

out, src = sys.argv[1], sys.argv[2]
# (exported name, source image, channels compared, max mean abs diff).  BC formats are lossy; BGRA8 / G8 must be bit-exact.
CASES = [("T_BC1", "rgb.png", "RGBA", 3), ("T_BC3", "rgba.png", "RGBA", 3), ("T_BC7", "rgba.png", "RGBA", 3),
         ("T_BGRA8", "rgba.png", "RGBA", 0), ("T_G8", "grayscale.png", "L", 0), ("T_BC4", "grayscale.png", "L", 3),
         ("T_Mips", "rgb.png", "RGBA", 3), ("T_Streaming", "streaming.png", "RGBA", 3), ("T_BC5", "normal.png", "RG", 1)]
bad = 0
for name, ref, mode, tol in CASES:
    a, b = Image.open(os.path.join(out, name + ".png")), Image.open(os.path.join(src, ref))
    if mode == "RG":
        pa, pb = a.convert("RGB").split()[:2], b.convert("RGB").split()[:2]
    else:
        pa, pb = a.convert(mode).split(), b.convert(mode).split()
    if a.size != b.size:
        print(f"{name:12s} SIZE {a.size} != {b.size}  BAD"); bad += 1; continue
    d = [abs(x - y) for ca, cb in zip(pa, pb) for x, y in zip(ca.get_flattened_data() if hasattr(ca, 'get_flattened_data') else ca.getdata(), cb.get_flattened_data() if hasattr(cb, 'get_flattened_data') else cb.getdata())]
    mean = sum(d) / len(d)
    ok = mean <= tol
    bad += not ok
    print(f"{name:12s} {a.size[0]}x{a.size[1]:<4d} vs {ref:14s} mean|diff|={mean:5.2f} max={max(d):3d} {'ok' if ok else 'BAD'}")
sys.exit(1 if bad else 0)
