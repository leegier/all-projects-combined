"""Overview PNGs of the prison occupancy grids: green = ground-floor floor, white = solid at camera height, blue = floor-1 walkway, magenta = floor-2 walkway.
Upper-floor walkways over an open ground floor mark the atria the 3-floor pans need."""
from pathlib import Path

import numpy as np
import png_util

DATA_DIR = Path(__file__).resolve().parents[1] / "data" / "navigation"
DERIVED_DIR = DATA_DIR / "derived"
g = [np.load(DATA_DIR / "occupancy" / f"occ_all_f{i}.npz") for i in range(3)]
x0, y0, c = g[0]["meta"][:3]
img = np.zeros(g[0]["occ"].shape + (3,), np.uint8); img[:] = (12, 14, 18)
img[g[0]["floor"] == 1] = (40, 110, 45)
img[(g[1]["floor"] == 1) & (g[0]["occ"] == 0)] = (50, 90, 200)
img[(g[2]["floor"] == 1) & (g[0]["occ"] == 0) & (g[1]["floor"] == 0)] = (190, 60, 190)
img[g[0]["occ"] == 1] = (225, 225, 225)
def mark(x, y, col, r=6):
    i = int((x - x0) / c); j = int((y - y0) / c); img[max(i - r, 0):i + r, max(j - r, 0):j + r] = col
for x, y in [(-23171, -10068), (-23600, -8373)]: mark(x, y, (255, 40, 40))           # front doors
for x, y in [(-22640, -8650), (-21865, -12500)]: mark(x, y, (255, 200, 0))           # security desks
img = img[::-1]
segs = [(-62000, -26000), (-26000, 10000), (10000, 46500)]
for k, (a, b) in enumerate(segs):
    ja = int((a - y0) / c); jb = int((b - y0) / c); png_util.save(DERIVED_DIR / f"occ_overview_{k}.png", img[:, ja:jb])
print("ok", img.shape)
