"""Offline prison route planner on the real-geometry occupancy grids (occ_all_f*.npz, 40 cm cells).
free = ground-floor floor surface and nothing solid at camera height. Clearance = grid distance to the nearest solid/no-floor cell.
Reports connectivity from outside the front entrance to every cell-block atrium and writes centreline routes."""
from pathlib import Path

import numpy as np, json, heapq, collections
DATA_DIR = Path(__file__).resolve().parents[1] / "data" / "navigation"
g0 = np.load(DATA_DIR / "occupancy" / "occ_all_f0.npz"); x0, y0, c = [float(v) for v in g0["meta"][:3]]
occ = g0["occ"].astype(bool); flo = g0["floor"].astype(bool)
nx, ny = occ.shape
def ij(x, y): return int((x - x0) / c), int((y - y0) / c)
def xy(i, j): return x0 + (i + 0.5) * c, y0 + (j + 0.5) * c
# fill 1-cell pinholes in the floor mask (sampling gaps), never across solid cells
f = flo.copy(); nb = np.zeros_like(f, np.int8)
for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)): nb += np.roll(np.roll(flo, di, 0), dj, 1)
f |= (nb >= 3) & ~occ
free = f & ~occ
# clearance (chessboard distance, in cells) via repeated erosion
clr = np.zeros(free.shape, np.int16); cur = free.copy(); k = 0
while cur.any() and k < 60:
    k += 1; clr[cur] = k
    e = cur.copy()
    for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)): e &= np.roll(np.roll(cur, di, 0), dj, 1)
    cur = e
np.save(DATA_DIR / "derived" / "clr_f0.npy", clr)
def comp_from(seed, minclr):
    ok = clr >= minclr; seen = np.zeros(ok.shape, bool); q = collections.deque([seed]); seen[seed] = True
    while q:
        i, j = q.popleft()
        for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            a, b = i + di, j + dj
            if 0 <= a < nx and 0 <= b < ny and ok[a, b] and not seen[a, b]: seen[a, b] = True; q.append((a, b))
    return seen
def nearest_free(x, y, minclr, r=40):
    i, j = ij(x, y); best = None
    for a in range(max(i - r, 0), min(i + r, nx)):
        for b in range(max(j - r, 0), min(j + r, ny)):
            if clr[a, b] >= minclr:
                d = (a - i) ** 2 + (b - j) ** 2
                if best is None or d < best[0]: best = (d, (a, b))
    return best[1] if best else None
if __name__ == "__main__":
    print("free cells", int(free.sum()), "max clearance", int(clr.max()))
    for name, x, y in [("door_164_inside", -23300, -8373), ("door_164_outside", -23950, -8373), ("door_158_west", -23171, -10400), ("door_158_east", -23171, -9800)]:
        i, j = ij(x, y); print(name, "clr", int(clr[i, j]), "occ", int(occ[i, j]), "floor", int(flo[i, j]))
    # occupancy strip across door 164 (x from -24400 to -22800 at y -8373) and door 158 (y -10600..-9600 at x -23171)
    print("strip164", "".join("#" if occ[ij(x, -8373)] else ("." if flo[ij(x, -8373)] else " ") for x in range(-24400, -22800, 40)))
    print("strip158", "".join("#" if occ[ij(-23171, y)] else ("." if flo[ij(-23171, y)] else " ") for y in range(-10800, -9500, 40)))
def strip_x(y, xa, xb): return "".join("#" if occ[ij(x, y)] else ("." if flo[ij(x, y)] else " ") for x in range(xa, xb, 40))
def strip_y(x, ya, yb): return "".join("#" if occ[ij(x, y)] else ("." if flo[ij(x, y)] else " ") for y in range(ya, yb, 40))
