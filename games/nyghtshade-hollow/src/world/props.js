// Reusable prop builders. Each takes a Batch (merged into the area mesh) and a World (colliders).
import * as THREE from 'three';
import { MAT, signMaterial } from '../proc/materials.js';
import { Batch } from './geo.js';

/** Walls with optional openings. dir 'x' = wall runs along X at fixed z. Each opening = [from,to,height]. */
export function wall(B, world, { dir, at, from, to, y0 = 0, y1, thick = 0.3, mat, vBase, openings = [], collide = true, shade = null, sight = true }) {
  const segs = [];
  let cur = from;
  const ops = openings.slice().sort((a, b) => a[0] - b[0]);
  for (const [a, b, h] of ops) {
    if (a > cur) segs.push([cur, a, y0, y1]);
    if (h < y1 - y0 - 0.01) segs.push([a, b, y0 + h, y1]); // lintel
    cur = b;
  }
  if (cur < to) segs.push([cur, to, y0, y1]);
  const o = { vBase: vBase === undefined ? y0 : vBase, shade };
  for (const [a, b, ya, yb] of segs) {
    if (b - a < 0.001) continue;
    if (dir === 'x') {
      B.slab(a, ya, at - thick / 2, b, yb, at + thick / 2, mat, o);
      if (collide) world.addCollider(a, ya, at - thick / 2, b, yb, at + thick / 2, { sight });
    } else {
      B.slab(at - thick / 2, ya, a, at + thick / 2, yb, b, mat, o);
      if (collide) world.addCollider(at - thick / 2, ya, a, at + thick / 2, yb, b, { sight });
    }
  }
}

/** Vertical bars between two points on a line, for cell fronts & gates. */
export function barsRow(B, { dir, at, from, to, y0, y1, spacing = 0.12, r = 0.016 }) {
  const n = Math.round((to - from) / spacing);
  for (let i = 0; i <= n; i++) {
    const p = from + (i / n) * (to - from);
    if (dir === 'x') B.cyl(p, (y0 + y1) / 2, at, r, r, y1 - y0, 'bars', { seg: 6 });
    else B.cyl(at, (y0 + y1) / 2, p, r, r, y1 - y0, 'bars', { seg: 6 });
  }
  // horizontal rails
  const len = to - from, mid = (from + to) / 2;
  for (const yy of [y0 + 0.04, (y0 + y1) / 2, y1 - 0.04]) {
    if (dir === 'x') B.box(mid, yy, at, len, 0.05, 0.05, 'bars');
    else B.box(at, yy, mid, 0.05, 0.05, len, 'bars');
  }
}

export function bunk(B, x, y, z, { dir = 1, alongX = true, made = true, upper = true } = {}) {
  // steel frame bunk: 0.9 x 2.0, lower and upper berth
  const L = 2.0, W = 0.85;
  const sx = alongX ? L : W, sz = alongX ? W : L;
  for (const [yy, lbl] of [[0.45, 'lo'], [1.45, 'up']]) {
    if (lbl === 'up' && !upper) continue;
    B.box(x, y + yy, z, sx, 0.05, sz, 'steel');
    B.box(x, y + yy + 0.1, z, sx - 0.06, 0.13, sz - 0.06, 'mattress', { tint: 0xdddddd });
  }
  // blankets (folded at foot)
  const bx = alongX ? sx - 0.55 : sx - 0.1, bz = alongX ? sz - 0.1 : sz - 0.55;
  B.box(x + (alongX ? 0.2 * dir : 0), y + 0.45 + 0.19, z + (alongX ? 0 : 0.2 * dir), bx, 0.045, bz, 'blanket');
  if (upper) B.box(x + (alongX ? 0.2 * dir : 0), y + 1.45 + 0.19, z + (alongX ? 0 : 0.2 * dir), bx, 0.045, bz, 'blanket');
  // pillow
  B.box(x - (alongX ? 0.82 * dir : 0), y + 0.45 + 0.2, z - (alongX ? 0 : 0.82 * dir), alongX ? 0.32 : 0.45, 0.09, alongX ? 0.45 : 0.32, 'white');
  // posts
  for (const sxp of [-1, 1]) for (const szp of [-1, 1]) B.box(x + sxp * (sx / 2 - 0.03), y + 0.9, z + szp * (sz / 2 - 0.03), 0.05, upper ? 1.8 : 0.9, 0.05, 'steel');
}

export function toiletSink(B, x, y, z, { facing = '+z' } = {}) {
  // wall-mounted steel combo unit, x,z = back centre against wall; facing = direction it faces
  const f = { '+z': [0, 1], '-z': [0, -1], '+x': [1, 0], '-x': [-1, 0] }[facing];
  const px = x + f[0] * 0.2, pz = z + f[1] * 0.2;
  B.box(px, y + 0.45, pz, f[0] ? 0.4 : 0.5, 0.9, f[0] ? 0.5 : 0.4, 'steelLight');
  B.box(px + f[0] * 0.07, y + 0.52, pz + f[1] * 0.07, f[0] ? 0.3 : 0.4, 0.07, f[0] ? 0.4 : 0.3, 'black'); // toilet bowl hole
  B.box(px, y + 1.0, pz, f[0] ? 0.4 : 0.5, 0.12, f[0] ? 0.5 : 0.4, 'steelLight'); // sink
}

export function deskShelf(B, x, y, z, { facing = '+z', w = 1.2 } = {}) {
  const f = { '+z': [0, 1], '-z': [0, -1], '+x': [1, 0], '-x': [-1, 0] }[facing];
  const px = x + f[0] * 0.25, pz = z + f[1] * 0.25;
  B.box(px, y + 0.78, pz, f[0] ? 0.5 : w, 0.05, f[0] ? w : 0.5, 'steel');
  B.box(x + f[0] * 0.06, y + 1.5, z + f[1] * 0.06, f[0] ? 0.12 : w, 0.04, f[0] ? w : 0.12, 'steel');
  B.box(x + f[0] * 0.08, y + 1.64, z + f[1] * 0.08, f[0] ? 0.16 : 0.5, 0.2, f[0] ? 0.5 : 0.16, 'paper'); // books/papers
}

export function stool(B, x, y, z, h = 0.45) { B.cyl(x, y + h, z, 0.17, 0.17, 0.05, 'steel', { seg: 12 }); B.cyl(x, y + h / 2, z, 0.03, 0.03, h, 'steel', { seg: 6 }); }

/** Steel dayroom table with attached stools (4 posts). */
export function steelTable(B, world, x, y, z, { w = 2.4, d = 0.8, stools = true, alongX = true, mat = 'steelLight' } = {}) {
  const sx = alongX ? w : d, sz = alongX ? d : w;
  B.box(x, y + 0.76, z, sx, 0.05, sz, mat);
  B.box(x, y + 0.38, z, alongX ? w - 0.5 : 0.06, 0.04, alongX ? 0.06 : w - 0.5, 'steel');
  for (const a of [-1, 1]) for (const b of [-1, 1]) B.box(x + a * (sx / 2 - 0.08), y + 0.38, z + b * (sz / 2 - 0.08), 0.06, 0.76, 0.06, 'steel');
  if (stools) {
    const off = alongX ? [[-w * 0.25, d / 2 + 0.34], [w * 0.25, d / 2 + 0.34], [-w * 0.25, -d / 2 - 0.34], [w * 0.25, -d / 2 - 0.34]]
      : [[d / 2 + 0.34, -w * 0.25], [d / 2 + 0.34, w * 0.25], [-d / 2 - 0.34, -w * 0.25], [-d / 2 - 0.34, w * 0.25]];
    for (const [ox, oz] of off) stool(B, x + ox, y, z + oz);
  }
  world.addCollider(x - sx / 2, y, z - sz / 2, x + sx / 2, y + 0.8, z + sz / 2, { sight: false });
}

export function locker(B, world, x, y, z, { w = 0.5, h = 1.9, d = 0.5, mat = 'pipe' } = {}) {
  B.box(x, y + h / 2, z, w, h, d, mat);
  B.box(x, y + h * 0.82, z, w * 0.5, 0.012, d + 0.01, 'black'); // vent slits
  world.addCollider(x - w / 2, y, z - d / 2, x + w / 2, y + h, z + d / 2);
}

export function pew(B, world, x, y, z, { len = 3.0, alongX = false } = {}) {
  const sx = alongX ? len : 0.9, sz = alongX ? 0.9 : len;
  // seat, back, kneeler, ends
  if (alongX) {
    B.box(x, y + 0.45, z, len, 0.06, 0.45, 'woodDark');
    B.box(x, y + 0.85, z - 0.24, len, 0.8, 0.07, 'woodDark', { rotX: -0.08 });
    B.box(x, y + 0.12, z + 0.4, len, 0.06, 0.25, 'woodDark');
    for (const e of [-1, 1]) B.box(x + e * (len / 2 - 0.04), y + 0.55, z, 0.07, 1.1, 0.95, 'woodDark');
  } else {
    B.box(x, y + 0.45, z, 0.45, 0.06, len, 'woodDark');
    B.box(x - 0.24, y + 0.85, z, 0.07, 0.8, len, 'woodDark', { rotZ: 0.08 });
    B.box(x + 0.4, y + 0.12, z, 0.25, 0.06, len, 'woodDark');
    for (const e of [-1, 1]) B.box(x, y + 0.55, z + e * (len / 2 - 0.04), 0.95, 1.1, 0.07, 'woodDark');
  }
  world.addCollider(x - sx / 2, y, z - sz / 2, x + sx / 2, y + 1.0, z + sz / 2, { sight: false });
}

export function filingCabinet(B, world, x, y, z, { facing = '+z', w = 0.5, h = 1.35 } = {}) {
  const f = { '+z': [0, 1], '-z': [0, -1], '+x': [1, 0], '-x': [-1, 0] }[facing];
  const sx = f[0] ? 0.6 : w, sz = f[0] ? w : 0.6;
  B.box(x, y + h / 2, z, sx, h, sz, 'pipe');
  for (let i = 0; i < 4; i++) {
    const yy = y + 0.2 + i * 0.3;
    B.box(x + f[0] * 0.31, yy, z + f[1] * 0.31, f[0] ? 0.02 : w * 0.85, 0.24, f[0] ? w * 0.85 : 0.02, 'steel');
    B.box(x + f[0] * 0.325, yy + 0.06, z + f[1] * 0.325, f[0] ? 0.02 : 0.18, 0.025, f[0] ? 0.18 : 0.02, 'steelLight');
  }
  world.addCollider(x - sx / 2, y, z - sz / 2, x + sx / 2, y + h, z + sz / 2);
}

export function pipeRun(B, { from, to, r = 0.07, mat = 'pipe', bracketEvery = 2.5 }) {
  const [x0, y0, z0] = from, [x1, y1, z1] = to;
  const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
  const len = Math.hypot(dx, dy, dz);
  const g = new THREE.CylinderGeometry(r, r, len, 8, 1);
  const dir = new THREE.Vector3(dx, dy, dz).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const e = new THREE.Euler().setFromQuaternion(q);
  B.geo(g, mat, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], [e.x, e.y, e.z]);
  g.dispose();
  const n = Math.floor(len / bracketEvery);
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    B.box(x0 + dx * t, y0 + dy * t, z0 + dz * t, r * 2.6, r * 2.6, r * 2.6, 'steel');
  }
}

/** A flat sign on a wall. */
export function wallSign(parent, text, { x, y, z, w = 0.8, h = 0.4, facing = '+z', bg, fg, accent, font } = {}) {
  const mat = signMaterial(text, { w: 512, h: Math.round(512 * h / w), bg, fg, accent, font });
  const geo = new THREE.PlaneGeometry(w, h);
  // vertex colours expected by material
  const col = new Float32Array(geo.attributes.position.count * 3).fill(1);
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.Mesh(geo, mat);
  const rot = { '+z': 0, '-z': Math.PI, '+x': Math.PI / 2, '-x': -Math.PI / 2 }[facing];
  m.rotation.y = rot;
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

/** Caged industrial light fixture. Returns {mesh,fixture-ready position}. kind: 'tube' | 'bulb' */
export function hangingTube(world, area, B, { x, y, z, len = 1.3, kind = 'tube', along = 'x', color = 0xdff4ec, intensity = 16, range = 13, flicker = 0, glow = 0.7, priority = 0 }) {
  const mat = kind === 'tube' ? (color === 0xffd9a0 ? MAT.tubeWarm : MAT.tube) : MAT.bulb;
  const geo = kind === 'tube' ? new THREE.BoxGeometry(along === 'x' ? len : 0.1, 0.06, along === 'x' ? 0.1 : len) : new THREE.SphereGeometry(0.09, 10, 8);
  const own = mat.clone();
  const m = new THREE.Mesh(geo, own);
  m.position.set(x, y, z);
  area.group.add(m);
  // housing
  B.box(x, y + 0.07, z, along === 'x' ? len + 0.12 : 0.22, 0.05, along === 'x' ? 0.22 : len + 0.12, 'steel');
  const fx = world.addFixture({ pos: new THREE.Vector3(x, y - 0.35, z), color, intensity, range, flicker, area: area.name, mesh: m, baseEI: own.emissiveIntensity, priority });
  return fx;
}
