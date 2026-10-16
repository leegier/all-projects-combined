// Procedural vegetation: branching trunks (tapered tubes), leaf-card canopies with outward normals, spruce whorls,
// ferns and tall grass. Everything is generated from seeds, textures drawn on canvases, geometry instanced.
import * as THREE from 'three';
import { mulberry32, clamp, lerp } from '../util.js';
import { fbm } from '../proc/noise.js';

// ------------------------------------------------------------------------------------------------
// Alpha textures
// ------------------------------------------------------------------------------------------------
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function finishTex(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
const hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;

export function leafClusterTexture(seed = 1, palette = { h: 88, s: 42, l: [24, 44] }) {
  const S = 512, c = mkCanvas(S, S), g = c.getContext('2d'), r = mulberry32(seed);
  g.clearRect(0, 0, S, S);
  const leaf = (x, y, len, wid, ang, shade) => {
    g.save(); g.translate(x, y); g.rotate(ang);
    const h = palette.h + (r() - 0.5) * 22, l = lerp(palette.l[0], palette.l[1], shade);
    const gr = g.createLinearGradient(0, -wid, 0, wid);
    gr.addColorStop(0, hsl(h, palette.s, l + 8)); gr.addColorStop(0.5, hsl(h, palette.s + 6, l)); gr.addColorStop(1, hsl(h, palette.s, l - 8));
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(0, 0);
    g.bezierCurveTo(len * 0.3, -wid * 1.1, len * 0.8, -wid * 0.8, len, 0);
    g.bezierCurveTo(len * 0.8, wid * 0.8, len * 0.3, wid * 1.1, 0, 0);
    g.fill();
    g.strokeStyle = hsl(h, palette.s, l - 12, 0.7); g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(len * 0.95, 0); g.stroke();
    g.lineWidth = 0.8; g.globalAlpha = 0.5;
    for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(len * k * 0.22, 0); g.lineTo(len * (k * 0.22 + 0.16), -wid * 0.8); g.moveTo(len * k * 0.22, 0); g.lineTo(len * (k * 0.22 + 0.16), wid * 0.8); g.stroke(); }
    g.restore();
  };
  // twigs
  g.strokeStyle = 'rgba(52,36,22,0.95)'; g.lineWidth = 4;
  g.beginPath(); g.moveTo(S * 0.5, S * 0.98); g.quadraticCurveTo(S * 0.52, S * 0.55, S * 0.5, S * 0.06); g.stroke();
  for (let i = 0; i < 7; i++) { const y = S * (0.9 - i * 0.12); g.lineWidth = 2.5; g.beginPath(); g.moveTo(S * 0.5, y); g.lineTo(S * (0.5 + (i % 2 ? 0.3 : -0.3)), y - S * 0.12); g.stroke(); }
  for (let i = 0; i < 170; i++) {
    const t = Math.pow(r(), 0.7);
    const x = S * 0.5 + (r() - 0.5) * S * (0.25 + 0.7 * (1 - Math.abs(t - 0.5) * 1.6)), y = S * 0.05 + t * S * 0.92;
    leaf(x, y, 40 + r() * 34, 11 + r() * 9, r() * 6.28, r());
  }
  return finishTex(c);
}

export function spruceTexture(seed = 3) {
  const W = 512, H = 256, c = mkCanvas(W, H), g = c.getContext('2d'), r = mulberry32(seed);
  g.clearRect(0, 0, W, H);
  const stem = (x0, y0, x1, y1) => { g.strokeStyle = 'rgba(58,40,24,0.95)'; g.lineWidth = 3.5; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
  stem(4, H * 0.5, W - 20, H * 0.5 + 8);
  const needles = (x, y, side, len, shade) => {
    for (let k = 0; k < 9; k++) {
      const a = (side * (0.9 + r() * 0.5)) + (r() - 0.5) * 0.4, l = len * (0.7 + r() * 0.5);
      g.strokeStyle = hsl(112 + r() * 18, 34 + r() * 14, 16 + shade * 22 + r() * 8, 0.95); g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l * 0.45, y + Math.sin(a) * l); g.stroke();
    }
  };
  for (let i = 0; i < 46; i++) {
    const t = i / 46, x = 10 + t * (W - 40), y = H * 0.5 + t * 8;
    const len = lerp(110, 34, t) * (0.8 + r() * 0.3);
    // side twigs
    for (const side of [-1, 1]) {
      const tw = len * (0.9 + r() * 0.2), ex = x + tw * 0.3, ey = y + side * tw;
      g.strokeStyle = 'rgba(50,38,24,0.9)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + tw * 0.15, y + side * tw * 0.5, ex, ey); g.stroke();
      for (let k = 0; k < 7; k++) { const u = k / 6, px = lerp(x, ex, u), py = lerp(y, ey, u); needles(px, py, side, len * 0.5, 0.5 + 0.5 * (1 - t) + u * 0.2); }
    }
  }
  return finishTex(c);
}

export function grassTexture(seed = 5, warm = 0.0) {
  const W = 256, H = 256, c = mkCanvas(W, H), g = c.getContext('2d'), r = mulberry32(seed);
  g.clearRect(0, 0, W, H);
  for (let b = 0; b < 38; b++) {
    const bx = 8 + r() * (W - 16), h = 90 + r() * 150, lean = (r() - 0.5) * 70, w = 3 + r() * 5;
    const gr = g.createLinearGradient(0, H, 0, H - h);
    gr.addColorStop(0, hsl(95, 45, 14)); gr.addColorStop(0.6, hsl(72 + warm * 10, 52, 34)); gr.addColorStop(1, hsl(52 + warm * 14, 60, 56 + warm * 8));
    g.fillStyle = gr; g.beginPath(); g.moveTo(bx - w, H);
    g.quadraticCurveTo(bx + lean * 0.3, H - h * 0.55, bx + lean, H - h);
    g.quadraticCurveTo(bx + lean * 0.3 + w * 0.5, H - h * 0.55, bx + w, H); g.fill();
  }
  return finishTex(c);
}

export function fernTexture(seed = 9) {
  const S = 256, c = mkCanvas(S, S), g = c.getContext('2d'), r = mulberry32(seed);
  g.clearRect(0, 0, S, S);
  for (let f = 0; f < 9; f++) {
    const ang = -Math.PI / 2 + (f - 4) * 0.26 + (r() - 0.5) * 0.1, len = S * (0.62 + r() * 0.3);
    g.save(); g.translate(S / 2, S * 0.97); g.rotate(ang + Math.PI / 2);
    g.strokeStyle = hsl(98, 40, 22); g.lineWidth = 2.2; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * 0.25, -len * 0.45, len * 0.1, -len); g.stroke();
    for (let k = 1; k < 24; k++) {
      const u = k / 24, y = -len * u, x = len * 0.1 * u * u * 2 + len * 0.25 * Math.sin(u * 2.2) * 0.2, ll = (1 - u * 0.85) * len * 0.22;
      g.strokeStyle = hsl(88 + u * 20, 48, 24 + u * 18); g.lineWidth = 2.4 * (1 - u * 0.6);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x - ll, y - ll * 0.35); g.moveTo(x, y); g.lineTo(x + ll, y - ll * 0.35); g.stroke();
    }
    g.restore();
  }
  return finishTex(c);
}

// ------------------------------------------------------------------------------------------------
// Geometry accumulators
// ------------------------------------------------------------------------------------------------
class Acc {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.col = []; this.idx = []; this.n = 0; }
  vert(p, n, u, v, c) { this.pos.push(p.x, p.y, p.z); this.nor.push(n.x, n.y, n.z); this.uv.push(u, v); this.col.push(c.r, c.g, c.b); return this.n++; }
  tri(a, b, c) { this.idx.push(a, b, c); }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}
const WHITE = new THREE.Color(1, 1, 1);

/** Tapered tube along `pts` with per-point radius. */
function tube(acc, pts, radii, seg = 8, tint = WHITE, uvScale = 1) {
  const frames = [];
  let n0 = new THREE.Vector3(1, 0, 0);
  for (let i = 0; i < pts.length; i++) {
    const t = (i < pts.length - 1 ? pts[i + 1].clone().sub(pts[i]) : pts[i].clone().sub(pts[i - 1])).normalize();
    if (Math.abs(t.dot(n0)) > 0.95) n0 = new THREE.Vector3(0, 0, 1);
    const b = new THREE.Vector3().crossVectors(t, n0).normalize();
    const nn = new THREE.Vector3().crossVectors(b, t).normalize();
    frames.push([nn, b]); n0 = nn;
  }
  const base = acc.n; let dist = 0;
  for (let i = 0; i < pts.length; i++) {
    if (i > 0) dist += pts[i].distanceTo(pts[i - 1]);
    const [nn, b] = frames[i];
    for (let s = 0; s <= seg; s++) {
      const a = (s / seg) * Math.PI * 2, cx = Math.cos(a), sx = Math.sin(a);
      const nor = nn.clone().multiplyScalar(cx).addScaledVector(b, sx);
      const p = pts[i].clone().addScaledVector(nor, radii[i]);
      acc.vert(p, nor, (s / seg) * 2 * uvScale, dist * 0.45 * uvScale, tint);
    }
  }
  for (let i = 0; i < pts.length - 1; i++) for (let s = 0; s < seg; s++) {
    const a = base + i * (seg + 1) + s, b = a + 1, c = a + seg + 1, d = c + 1;
    acc.tri(a, c, b); acc.tri(b, c, d);
  }
}

/** Quad card centred at c with half-axes U (width) and V (height); normals all = nrm. */
function card(acc, c, U, V, nrm, tint) {
  const corners = [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]];
  const ids = corners.map(([su, sv, u, v]) => acc.vert(c.clone().addScaledVector(U, su).addScaledVector(V, sv), nrm, u, v, tint));
  acc.tri(ids[0], ids[1], ids[2]); acc.tri(ids[0], ids[2], ids[3]);
}

const randUnit = (r) => { const u = r() * 2 - 1, a = r() * 6.2832, s = Math.sqrt(1 - u * u); return new THREE.Vector3(s * Math.cos(a), u, s * Math.sin(a)); };

// ------------------------------------------------------------------------------------------------
// Broadleaf (oak) tree
// ------------------------------------------------------------------------------------------------
/**
 * Returns { bark: BufferGeometry, leaves: BufferGeometry }.
 * opts: { height, trunkR, crownR, limbs, leafCards, seed, leafSize, lean }
 */
export function buildBroadleaf({ height = 6, trunkR = 0.35, crownR = 4, limbs = 6, leafCards = 380, seed = 1, leafSize = 1.5, hue = 0 } = {}) {
  const r = mulberry32(seed);
  const bark = new Acc(), leaves = new Acc();
  const tips = [];
  const jitter = (v, k) => v.add(new THREE.Vector3((r() - 0.5) * k, (r() - 0.5) * k * 0.5, (r() - 0.5) * k));
  // trunk with slight S-bend + root flare
  const trunkPts = [], trunkR_ = [];
  const N = 9, bend = new THREE.Vector3((r() - 0.5) * 0.9, 0, (r() - 0.5) * 0.9);
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    trunkPts.push(new THREE.Vector3(bend.x * Math.sin(t * 2.4) * t, t * height * 0.62 - 0.15, bend.z * Math.sin(t * 2.1) * t));
    trunkR_.push(trunkR * (1 + (1 - t) * (1 - t) * 0.9) * (1 - t * 0.38));
  }
  tube(bark, trunkPts, trunkR_, 12, WHITE, 1);
  // roots
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * 6.283 + r() * 0.5, dir = new THREE.Vector3(Math.cos(a), -0.08, Math.sin(a));
    const pts = [new THREE.Vector3(0, 0.55, 0).addScaledVector(dir, trunkR * 0.5), new THREE.Vector3(0, 0.12, 0).addScaledVector(dir, trunkR * 1.5), new THREE.Vector3(0, -0.05, 0).addScaledVector(dir, trunkR * 2.8), new THREE.Vector3(0, -0.25, 0).addScaledVector(dir, trunkR * 4.2)];
    tube(bark, pts, [trunkR * 0.42, trunkR * 0.3, trunkR * 0.18, trunkR * 0.06], 7, WHITE, 0.6);
  }
  const top = trunkPts[trunkPts.length - 1].clone();
  // limbs: recursive
  const limb = (start, dir, len, rad, depth) => {
    const pts = [], rads = [];
    const segs = 6, bendv = randUnit(r).multiplyScalar(0.22);
    let p = start.clone(), d = dir.clone();
    for (let i = 0; i <= segs; i++) {
      pts.push(p.clone()); rads.push(Math.max(0.012, rad * (1 - i / segs * 0.85)));
      d.add(bendv.clone().multiplyScalar(0.25)).add(new THREE.Vector3(0, 0.035, 0)).normalize();
      p.addScaledVector(d, len / segs);
    }
    tube(bark, pts, rads, depth > 1 ? 7 : 5, WHITE, 0.7);
    if (depth > 0) {
      const subs = depth === 2 ? 3 : 2;
      for (let s = 0; s < subs; s++) {
        const idx = 2 + Math.floor(r() * 3), sp = pts[idx];
        const nd = randUnit(r).add(d.clone().multiplyScalar(1.6)).normalize();
        limb(sp, nd, len * (0.55 + r() * 0.2), rad * 0.5, depth - 1);
      }
    } else tips.push(p.clone());
    tips.push(pts[Math.max(0, pts.length - 2)].clone());
  };
  for (let l = 0; l < limbs; l++) {
    const a = (l / limbs) * 6.283 + r() * 0.8, up = 0.55 + r() * 0.5;
    const start = trunkPts[Math.floor(N * (0.62 + r() * 0.38))].clone();
    const dir = new THREE.Vector3(Math.cos(a), up, Math.sin(a)).normalize();
    limb(start, dir, crownR * (0.55 + r() * 0.35), trunkR * (0.5 + r() * 0.12), 2);
  }
  // leaf-card canopy: clusters placed near limb tips and inside a spheroid, normals outward from crown centre
  const centre = top.clone().add(new THREE.Vector3(0, crownR * 0.2, 0));
  const spots = [];
  for (const t of tips) spots.push(t.clone());
  while (spots.length < leafCards) {
    const v = randUnit(r); v.y = Math.abs(v.y) * 0.85 + 0.05;
    const rad = crownR * (0.35 + 0.65 * Math.pow(r(), 0.6));
    spots.push(centre.clone().addScaledVector(v, rad).add(new THREE.Vector3(0, crownR * 0.05, 0)));
  }
  for (const s of spots) {
    for (let k = 0; k < 2; k++) {
      const p = s.clone().add(new THREE.Vector3((r() - 0.5) * 0.7, (r() - 0.5) * 0.5, (r() - 0.5) * 0.7));
      const out = p.clone().sub(centre).normalize().add(randUnit(r).multiplyScalar(0.35)).normalize();
      const up = new THREE.Vector3(0, 1, 0), U = new THREE.Vector3().crossVectors(out, up);
      if (U.lengthSq() < 1e-4) U.set(1, 0, 0);
      U.normalize();
      const V = new THREE.Vector3().crossVectors(U, out).normalize();
      const rot = r() * 6.283, c0 = Math.cos(rot), s0 = Math.sin(rot);
      const U2 = U.clone().multiplyScalar(c0).addScaledVector(V, s0), V2 = V.clone().multiplyScalar(c0).addScaledVector(U, -s0);
      const sz = leafSize * (0.75 + r() * 0.6);
      const shade = 0.78 + r() * 0.42 + (p.y - centre.y) / crownR * 0.12;
      const tint = new THREE.Color(shade * (1 + hue * 0.1), shade, shade * (1 - hue * 0.1));
      // normal: blend of outward and card facing so lighting is soft across the crown
      const nrm = out.clone().multiplyScalar(0.8).add(new THREE.Vector3(0, 0.45, 0)).normalize();
      card(leaves, p, U2.multiplyScalar(sz * 0.5), V2.multiplyScalar(sz * 0.5), nrm, tint);
    }
  }
  return { bark: bark.build(), leaves: leaves.build() };
}

// ------------------------------------------------------------------------------------------------
// Conifer (spruce)
// ------------------------------------------------------------------------------------------------
export function buildSpruce({ height = 9, trunkR = 0.26, seed = 1, whorls = 15, branchLen = 2.7 } = {}) {
  const r = mulberry32(seed);
  const bark = new Acc(), leaves = new Acc();
  const pts = [], rads = [];
  const N = 8, lean = new THREE.Vector3((r() - 0.5) * 0.3, 0, (r() - 0.5) * 0.3);
  for (let i = 0; i <= N; i++) { const t = i / N; pts.push(new THREE.Vector3(lean.x * t * t, t * height, lean.z * t * t)); rads.push(trunkR * (1 - t * 0.93) + 0.015); }
  tube(bark, pts, rads, 8, WHITE, 1);
  for (let w = 0; w < whorls; w++) {
    const t = 0.16 + (w / (whorls - 1)) * 0.82;
    const y = t * height, prof = Math.pow(1 - t, 0.82) * 0.95 + 0.07;
    const count = Math.max(4, Math.round(7 - t * 3));
    const rot0 = r() * 6.283;
    for (let b = 0; b < count; b++) {
      const a = rot0 + (b / count) * 6.283 + (r() - 0.5) * 0.4;
      const len = branchLen * prof * (0.85 + r() * 0.3);
      const out = new THREE.Vector3(Math.cos(a), -0.28 - r() * 0.18, Math.sin(a)).normalize();
      const base = new THREE.Vector3(lean.x * t * t, y + (r() - 0.5) * 0.25, lean.z * t * t);
      // two hinged cards (inner flat, outer drooping) + a vertical card for volume
      const shade = 0.75 + r() * 0.45;
      const tint = new THREE.Color(shade * 0.92, shade, shade * 0.88);
      const o2 = new THREE.Vector3(out.x, out.y - 0.45, out.z).normalize();
      const sideN = new THREE.Vector3(-out.z, 0, out.x).normalize();
      const nrm = new THREE.Vector3(out.x * 0.45, 0.88, out.z * 0.45).normalize();
      const p1 = base.clone().addScaledVector(out, len * 0.3), p2 = base.clone().addScaledVector(out, len * 0.6).addScaledVector(o2, len * 0.22);
      card(leaves, p1, out.clone().multiplyScalar(len * 0.3), sideN.clone().multiplyScalar(len * 0.36), nrm, tint);
      card(leaves, p2, o2.clone().multiplyScalar(len * 0.3), sideN.clone().multiplyScalar(len * 0.3), nrm, tint);
      card(leaves, p1.clone().add(new THREE.Vector3(0, 0.04, 0)), out.clone().multiplyScalar(len * 0.32), new THREE.Vector3(0, len * 0.26, 0), nrm, tint);
    }
  }
  // leader tip
  card(leaves, new THREE.Vector3(lean.x, height * 1.0, lean.z), new THREE.Vector3(0.5, 0, 0), new THREE.Vector3(0, 0.9, 0), new THREE.Vector3(0, 1, 0), new THREE.Color(1, 1, 1));
  return { bark: bark.build(), leaves: leaves.build() };
}

// ------------------------------------------------------------------------------------------------
// Ground cover builders (instanced tufts)
// ------------------------------------------------------------------------------------------------
export function tuftGeometry(w = 0.8, h = 0.7, crossed = 3) {
  const acc = new Acc();
  for (let i = 0; i < crossed; i++) {
    const a = (i / crossed) * Math.PI;
    const U = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(w / 2), V = new THREE.Vector3(0, h / 2, 0);
    card(acc, new THREE.Vector3(0, h / 2, 0), U, V, new THREE.Vector3(0, 1, 0), WHITE);
  }
  return acc.build();
}
