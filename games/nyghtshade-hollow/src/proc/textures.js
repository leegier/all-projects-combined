// Procedural PBR texture library. Everything the prison looks like is generated here at load time
// (albedo + tangent-space normal + ORM) so the slice ships as a single self-contained file.
import * as THREE from 'three';
import { fbm, ridged, ihash } from './noise.js';
import { clamp, smoothstep } from '../util.js';

const cache = new Map();

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/**
 * Generic surface generator. `fn(x,y,u,v,o)` fills `o` = {r,g,b (0..1), h (height), rough, metal}.
 * Returns three CanvasTextures: map (sRGB), normalMap, ormMap (G = roughness, B = metal).
 */
function surface(size, fn, { normalStrength = 2.2, repeat = true } = {}) {
  const albedo = canvas(size), orm = canvas(size), nrm = canvas(size);
  const a = albedo.getContext('2d').createImageData(size, size);
  const m = orm.getContext('2d').createImageData(size, size);
  const n = nrm.getContext('2d').createImageData(size, size);
  const hgt = new Float32Array(size * size);
  const o = { r: 0, g: 0, b: 0, h: 0, rough: 0.8, metal: 0, ao: 1 };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      o.rough = 0.8; o.metal = 0; o.ao = 1; o.h = 0;
      fn(x, y, x / size, y / size, o);
      const i = (y * size + x) * 4;
      a.data[i] = clamp(o.r, 0, 1) * 255; a.data[i + 1] = clamp(o.g, 0, 1) * 255; a.data[i + 2] = clamp(o.b, 0, 1) * 255; a.data[i + 3] = 255;
      m.data[i] = clamp(o.ao, 0, 1) * 255; m.data[i + 1] = clamp(o.rough, 0.04, 1) * 255; m.data[i + 2] = clamp(o.metal, 0, 1) * 255; m.data[i + 3] = 255;
      hgt[y * size + x] = o.h;
    }
  }
  const wrap = (v) => (v + size) % size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const hl = hgt[y * size + wrap(x - 1)], hr = hgt[y * size + wrap(x + 1)];
      const hu = hgt[wrap(y - 1) * size + x], hd = hgt[wrap(y + 1) * size + x];
      let nx = (hl - hr) * normalStrength, ny = (hd - hu) * normalStrength, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      const i = (y * size + x) * 4;
      n.data[i] = (nx / l * 0.5 + 0.5) * 255; n.data[i + 1] = (ny / l * 0.5 + 0.5) * 255; n.data[i + 2] = (nz / l * 0.5 + 0.5) * 255; n.data[i + 3] = 255;
    }
  }
  albedo.getContext('2d').putImageData(a, 0, 0);
  orm.getContext('2d').putImageData(m, 0, 0);
  nrm.getContext('2d').putImageData(n, 0, 0);
  const mk = (c, srgb) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = THREE.RepeatWrapping; t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    t.anisotropy = 8;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  };
  return { map: mk(albedo, true), normalMap: mk(nrm, false), ormMap: mk(orm, false) };
}

const mix = (a, b, t) => a + (b - a) * t;
const speck = (x, y, s) => ihash(x, y, s);

// ---------------------------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------------------------
const GEN = {
  /** Poured concrete floor, 4 m tile, expansion joints, cracks, stains, scuff streaks. */
  concrete(size = 1024) {
    return surface(size, (x, y, u, v, o) => {
      const big = fbm(u, v, 3, 4, 11);
      const mid = fbm(u, v, 12, 4, 23);
      const fine = speck(x, y, 5) * 0.5 + speck(x >> 1, y >> 1, 9) * 0.5;
      let g = 0.27 + (big - 0.5) * 0.1 + (mid - 0.5) * 0.07 + (fine - 0.5) * 0.07;
      let r = g * 0.97, b = g * 1.04;
      let h = (mid - 0.5) * 0.3 + (fine - 0.5) * 0.25;
      let rough = 0.62 + (mid - 0.5) * 0.25;
      // stains: oily brown / damp
      const st = smoothstep(0.58, 0.72, fbm(u, v, 5, 5, 41));
      r *= 1 - st * 0.35; g *= 1 - st * 0.33; b *= 1 - st * 0.3; rough -= st * 0.22;
      // scuff streaks (anisotropic)
      const sc = fbm(u * 0.1 + v * 8, v * 0.6, 8, 3, 61);
      const scuff = smoothstep(0.62, 0.78, sc);
      g *= 1 - scuff * 0.1; rough += scuff * 0.1;
      // cracks
      const cr = ridged(u + fbm(u, v, 6, 2, 3) * 0.05, v, 7, 3, 77);
      if (cr > 0.994) { g *= 0.6; r *= 0.6; b *= 0.6; h -= 0.7; rough = 0.9; }
      // expansion joints every 1/2 tile
      const jx = Math.min(Math.abs(u - 0.5), Math.min(u, 1 - u) + 0.0), jy = Math.min(Math.abs(v - 0.5), Math.min(v, 1 - v) + 0.0);
      const jd = Math.min(Math.min(u, 1 - u, Math.abs(u - 0.5)), Math.min(v, 1 - v, Math.abs(v - 0.5))) * size;
      if (jd < 2.0) { g *= 0.6; r *= 0.6; b *= 0.6; h -= 1.0; rough = 0.95; }
      else if (jd < 4.5) { h -= 0.2; }
      o.r = r; o.g = g; o.b = b; o.h = h; o.rough = rough;
    }, { normalStrength: 3.0 });
  },

  /** Painted cinder-block wall. Tile = 3.2 m wide; v=1 is 3.2 m up and the top row is plain so
   *  ClampToEdge continues the paint above. Variant picks palette. */
  block(size = 1024, variant = 'green') {
    const pal = {
      green: { low: [0.13, 0.20, 0.19], high: [0.60, 0.58, 0.49], stripe: [0.04, 0.05, 0.05] },
      grey: { low: [0.22, 0.23, 0.24], high: [0.46, 0.47, 0.46], stripe: [0.08, 0.04, 0.04] },
      red: { low: [0.24, 0.07, 0.06], high: [0.55, 0.52, 0.45], stripe: [0.05, 0.05, 0.05] },
      blue: { low: [0.10, 0.15, 0.24], high: [0.58, 0.60, 0.58], stripe: [0.04, 0.04, 0.05] },
    }[variant];
    const bw = size / 8, bh = size / 16; // 0.4 x 0.2 m blocks
    return surface(size, (x, y, u, v, o) => {
      const hFromFloor = (1 - v) * 3.2; // metres above floor (canvas y=0 is top)
      const row = Math.floor(y / bh), off = (row % 2) * (bw / 2);
      const bx = ((x + off) % bw), by = y % bh;
      const mortar = bx < 3 || by < 3 || bx > bw - 1 || by > bh - 1;
      const bId = Math.floor((x + off) / bw) + row * 17;
      const bv = ihash(bId, row, 3);
      const paint = hFromFloor < 1.25 ? pal.low : pal.high;
      let r = paint[0], g = paint[1], b = paint[2];
      const tone = (bv - 0.5) * 0.05;
      r += tone; g += tone; b += tone;
      const big = fbm(u, v, 4, 4, 9), mid = fbm(u, v, 14, 4, 31), fine = speck(x, y, 7);
      const k = 1 + (big - 0.5) * 0.25 + (mid - 0.5) * 0.18 + (fine - 0.5) * 0.08;
      r *= k; g *= k; b *= k;
      let h = (fine - 0.5) * 0.2 + (mid - 0.5) * 0.2;
      let rough = 0.82 - (mid - 0.5) * 0.2;
      // black separator stripe at 1.25 m
      if (Math.abs(hFromFloor - 1.27) < 0.045) { r = pal.stripe[0]; g = pal.stripe[1]; b = pal.stripe[2]; rough = 0.45; }
      // grime toward the floor, scuffs
      const grime = smoothstep(0.55, 0.0, hFromFloor) * (0.35 + 0.5 * fbm(u, v, 10, 3, 5));
      r *= 1 - grime * 0.55; g *= 1 - grime * 0.55; b *= 1 - grime * 0.55;
      // water streaks hanging from above (not above 2.9 m so clamp stretch stays clean)
      const sx = fbm(u * 12, 0.31, 12, 2, 19);
      const streak = smoothstep(0.62, 0.8, sx) * smoothstep(2.9, 1.6, hFromFloor) * smoothstep(0.1, 1.2, hFromFloor) * (0.5 + 0.5 * fbm(u * 6, v * 1.2, 6, 3, 2));
      r *= 1 - streak * 0.28; g *= 1 - streak * 0.26; b *= 1 - streak * 0.24;
      // peeling paint to grey concrete / primer
      const peel = smoothstep(0.70, 0.78, fbm(u, v, 9, 5, 71)) * smoothstep(3.0, 0.8, hFromFloor);
      if (peel > 0.5) { const c = 0.33 + (fine - 0.5) * 0.1; r = c * 1.02; g = c; b = c * 0.96; rough = 0.95; h -= 0.6; }
      // gloss paint is slightly shiny lower
      if (!mortar) rough -= hFromFloor < 1.25 ? 0.12 : 0;
      if (mortar) { const c = 0.20 + (fine - 0.5) * 0.06; r = r * 0.35 + c * 0.65 * 0.9; g = g * 0.35 + c * 0.65 * 0.9; b = b * 0.35 + c * 0.65 * 0.9; h -= 1.0; rough = 0.95; }
      if (hFromFloor > 3.0) { // plain top row so clamping continues cleanly
        const t = smoothstep(3.0, 3.18, hFromFloor);
        r = mix(r, pal.high[0] * 0.92, t); g = mix(g, pal.high[1] * 0.92, t); b = mix(b, pal.high[2] * 0.92, t);
      }
      o.r = r; o.g = g; o.b = b; o.h = h; o.rough = rough;
    }, { normalStrength: 2.6, repeat: false });
  },

  /** Aged plaster (chapel). */
  plaster(size = 1024) {
    return surface(size, (x, y, u, v, o) => {
      const big = fbm(u, v, 3, 5, 3), mid = fbm(u, v, 10, 5, 8), fine = speck(x, y, 2);
      let k = 0.62 + (big - 0.5) * 0.3 + (mid - 0.5) * 0.15 + (fine - 0.5) * 0.05;
      let r = k * 0.96, g = k * 0.9, b = k * 0.78;
      const damp = smoothstep(0.55, 0.78, fbm(u, v, 4, 5, 55));
      r *= 1 - damp * 0.45; g *= 1 - damp * 0.4; b *= 1 - damp * 0.3;
      const cr = ridged(u + fbm(u, v, 5, 2, 1) * 0.06, v, 5, 4, 91);
      let h = (mid - 0.5) * 0.5 + (fine - 0.5) * 0.15;
      if (cr > 0.982) { r *= 0.3; g *= 0.3; b *= 0.3; h -= 1; }
      o.r = r; o.g = g; o.b = b; o.h = h; o.rough = 0.88;
    }, { normalStrength: 2.0 });
  },

  /** Old fired brick (tunnel + chapel exterior). 2 m tile, 8 x 16 bricks. */
  brick(size = 1024) {
    const bw = size / 8, bh = size / 16;
    return surface(size, (x, y, u, v, o) => {
      const row = Math.floor(y / bh), off = (row % 2) * (bw / 2);
      const bx = (x + off) % bw, by = y % bh;
      const id = Math.floor((x + off) / bw) + row * 31;
      const mortar = bx < 5 || by < 5;
      const bv = ihash(id, 4, 1), cv = ihash(id, 8, 2);
      let r = 0.36 + bv * 0.18, g = 0.14 + bv * 0.07, b = 0.10 + bv * 0.05;
      if (cv > 0.8) { r *= 0.6; g *= 0.65; b *= 0.7; }
      const fine = speck(x, y, 3), mid = fbm(u, v, 14, 4, 5), big = fbm(u, v, 4, 4, 12);
      const k = 0.85 + (mid - 0.5) * 0.4 + (fine - 0.5) * 0.22;
      r *= k; g *= k; b *= k;
      let h = (fine - 0.5) * 0.5 + (mid - 0.5) * 0.4;
      let rough = 0.9;
      const moist = smoothstep(0.5, 0.75, big);
      r *= 1 - moist * 0.4; g *= 1 - moist * 0.3; b *= 1 - moist * 0.25;
      if (mortar) { const c = 0.34 + (fine - 0.5) * 0.12; r = c; g = c * 0.97; b = c * 0.9; h -= 1.3; rough = 0.97; }
      // moss/efflorescence
      const moss = smoothstep(0.7, 0.86, fbm(u, v, 6, 5, 97));
      g += moss * 0.06; r *= 1 - moss * 0.2;
      o.r = r; o.g = g; o.b = b; o.h = h; o.rough = rough - moist * 0.25;
    }, { normalStrength: 3.2 });
  },

  /** Checker lino (canteen). 2.4 m tile, 8 x 8 squares. */
  lino(size = 1024) {
    const sq = size / 8;
    return surface(size, (x, y, u, v, o) => {
      const cx = Math.floor(x / sq), cy = Math.floor(y / sq);
      const dark = (cx + cy) % 2 === 0;
      let r = dark ? 0.12 : 0.62, g = dark ? 0.2 : 0.58, b = dark ? 0.17 : 0.47;
      const fine = speck(x, y, 4), mid = fbm(u, v, 16, 3, 6), big = fbm(u, v, 3, 4, 14);
      const k = 1 + (mid - 0.5) * 0.2 + (fine - 0.5) * 0.06;
      r *= k; g *= k; b *= k;
      const gx = x % sq, gy = y % sq;
      let h = 0, rough = 0.28 + (big - 0.5) * 0.3;
      if (gx < 2 || gy < 2) { r *= 0.35; g *= 0.35; b *= 0.35; h = -1; rough = 0.8; }
      const wear = smoothstep(0.55, 0.75, fbm(u, v, 5, 5, 19));
      r = mix(r, r * 0.6 + 0.05, wear); g = mix(g, g * 0.6 + 0.05, wear); b = mix(b, b * 0.6 + 0.05, wear);
      rough += wear * 0.4;
      o.r = r; o.g = g; o.b = b; o.h = h; o.rough = rough;
    }, { normalStrength: 1.5 });
  },

  /** Dark worn steel with scratches. 1 m tile. */
  steel(size = 512, tone = 0.12) {
    return surface(size, (x, y, u, v, o) => {
      const brushed = fbm(u * 0.15, v * 14, 14, 3, 5);
      const fine = speck(x, y, 7);
      let k = tone + (brushed - 0.5) * 0.06 + (fine - 0.5) * 0.02;
      let rough = 0.42 + (brushed - 0.5) * 0.3;
      let h = (brushed - 0.5) * 0.3;
      const scr = fbm(u * 0.4 + v * 30, v * 0.4 - u * 6, 9, 2, 4);
      if (scr > 0.78) { k += 0.1; rough += 0.1; }
      const rust = smoothstep(0.66, 0.82, fbm(u, v, 9, 5, 33)) * 0.75;
      let r = k, g = k, b = k * 1.06;
      r = mix(r, 0.36 * (0.7 + fine * 0.5), rust); g = mix(g, 0.16 * (0.7 + fine * 0.5), rust); b = mix(b, 0.07, rust);
      o.r = r; o.g = g; o.b = b; o.h = h - rust * 0.4; o.rough = mix(rough, 0.85, rust); o.metal = mix(0.95, 0.15, rust);
    }, { normalStrength: 1.4 });
  },

  /** Floor grating / catwalk plate. */
  grating(size = 512) {
    const cell = size / 16;
    return surface(size, (x, y, u, v, o) => {
      const cx = x % cell, cy = y % cell;
      const hole = cx > 3 && cx < cell - 3 && cy > 3 && cy < cell - 3;
      const fine = speck(x, y, 2);
      let k = 0.2 + (fine - 0.5) * 0.04 + (fbm(u, v, 6, 3, 8) - 0.5) * 0.08;
      if (hole) { k = 0.015; }
      o.r = k; o.g = k; o.b = k * 1.05; o.h = hole ? -1.2 : 0.25;
      o.rough = hole ? 1 : 0.5; o.metal = hole ? 0 : 0.85;
    }, { normalStrength: 2.5 });
  },

  /** Varnished wood (pews, benches, desks). 1 m tile. */
  wood(size = 512, tone = 1) {
    return surface(size, (x, y, u, v, o) => {
      const grain = fbm(u * 0.12, v * 9, 10, 4, 12) * 0.6 + fbm(u * 0.25, v * 40, 32, 2, 3) * 0.4;
      const ring = Math.sin((v * 22 + fbm(u * 0.5, v, 3, 3, 17) * 4) * Math.PI);
      let k = 0.22 + grain * 0.2 + ring * 0.03;
      const fine = speck(x, y, 6);
      const r = (k * 1.25 + 0.04) * tone, g = (k * 0.78) * tone, b = k * 0.48 * tone;
      const worn = smoothstep(0.6, 0.78, fbm(u, v, 5, 4, 3));
      o.r = mix(r, r * 1.35, worn); o.g = mix(g, g * 1.35, worn); o.b = mix(b, b * 1.3, worn);
      o.h = (grain - 0.5) * 0.5 + (fine - 0.5) * 0.1;
      o.rough = 0.5 + worn * 0.35 + (fine - 0.5) * 0.1;
    }, { normalStrength: 1.8 });
  },

  /** Woven fabric / mattress ticking. */
  fabric(size = 512, base = [0.2, 0.22, 0.2], stripes = false) {
    return surface(size, (x, y, u, v, o) => {
      const wv = (Math.sin(x * 1.4) * Math.sin(y * 1.4)) * 0.5 + 0.5;
      const fine = speck(x, y, 3);
      let k = 0.85 + (wv - 0.5) * 0.25 + (fine - 0.5) * 0.1 + (fbm(u, v, 6, 4, 4) - 0.5) * 0.25;
      let [r, g, b] = base;
      if (stripes && (Math.floor(u * 8) % 2 === 0)) { r *= 1.5; g *= 1.45; b *= 1.4; }
      const st = smoothstep(0.58, 0.74, fbm(u, v, 4, 5, 77));
      r *= k * (1 - st * 0.4); g *= k * (1 - st * 0.4); b *= k * (1 - st * 0.35);
      o.r = r; o.g = g; o.b = b; o.h = (wv - 0.5) * 0.6; o.rough = 0.95;
    }, { normalStrength: 1.6 });
  },

  /** Chapel flagstones. 4 m tile, ~1 m slabs, worn. */
  flagstone(size = 1024) {
    return surface(size, (x, y, u, v, o) => {
      const s = size / 4;
      const row = Math.floor(y / s), off = (row % 2) * (s / 2);
      const bx = (x + off) % s, by = y % s;
      const id = Math.floor((x + off) / s) + row * 7;
      const edge = Math.min(bx, by, s - bx, s - by);
      const k0 = 0.30 + ihash(id, 3, 5) * 0.12;
      const fine = speck(x, y, 3), mid = fbm(u, v, 18, 4, 5), big = fbm(u, v, 3, 4, 2);
      let k = k0 + (mid - 0.5) * 0.12 + (fine - 0.5) * 0.04 + (big - 0.5) * 0.1;
      let h = (mid - 0.5) * 0.5 + (fine - 0.5) * 0.15 + smoothstep(0, 18, edge) * 0.4;
      if (edge < 3) { k *= 0.4; h -= 1.1; }
      const wear = smoothstep(0.5, 0.8, fbm(u, v, 4, 4, 91));
      o.r = k * (1.0 - wear * 0.1); o.g = k * 0.97; o.b = k * 0.92;
      o.h = h; o.rough = 0.55 + wear * 0.3 + (mid - 0.5) * 0.2;
    }, { normalStrength: 2.4 });
  },

  /** Forest floor / dirt + leaf litter + grass. 8 m tile. */
  ground(size = 1024) {
    return surface(size, (x, y, u, v, o) => {
      const big = fbm(u, v, 4, 5, 7), mid = fbm(u, v, 16, 4, 13), fine = speck(x, y, 5);
      const grass = smoothstep(0.38, 0.62, fbm(u, v, 5, 5, 31));
      let r = mix(0.20, 0.13, grass) + (mid - 0.5) * 0.08 + (fine - 0.5) * 0.04;
      let g = mix(0.14, 0.20, grass) + (mid - 0.5) * 0.08 + (fine - 0.5) * 0.04;
      let b = mix(0.08, 0.06, grass) + (mid - 0.5) * 0.03;
      const leaf = smoothstep(0.66, 0.78, fbm(u, v, 12, 4, 43));
      r = mix(r, 0.34 * (0.7 + fine * 0.6), leaf * 0.7); g = mix(g, 0.16, leaf * 0.7); b = mix(b, 0.05, leaf * 0.7);
      o.r = r * (0.8 + big * 0.4); o.g = g * (0.8 + big * 0.4); o.b = b * (0.8 + big * 0.4);
      o.h = (mid - 0.5) * 0.6 + (fine - 0.5) * 0.3;
      o.rough = 0.95;
    }, { normalStrength: 2.2 });
  },

  /** Tree bark. */
  bark(size = 512) {
    return surface(size, (x, y, u, v, o) => {
      const r1 = ridged(u * 0.3, v, 8, 4, 5);
      const k = 0.12 + r1 * 0.12 + (speck(x, y, 3) - 0.5) * 0.03;
      o.r = k * 1.1; o.g = k * 0.82; o.b = k * 0.6; o.h = r1 * 1.4; o.rough = 0.95;
    }, { normalStrength: 3 });
  },

  /** Plain painted metal (pipes, doors). tint rgb. */
  paintedMetal(size = 512, tint = [0.18, 0.2, 0.2]) {
    return surface(size, (x, y, u, v, o) => {
      const fine = speck(x, y, 9), mid = fbm(u, v, 10, 4, 4), big = fbm(u, v, 3, 4, 3);
      let k = 0.9 + (mid - 0.5) * 0.3;
      let r = tint[0] * k, g = tint[1] * k, b = tint[2] * k;
      const rust = smoothstep(0.64, 0.8, fbm(u, v, 10, 5, 55)) * (0.3 + big * 0.6);
      r = mix(r, 0.34 * (0.6 + fine * 0.5), rust * 0.9); g = mix(g, 0.15, rust * 0.9); b = mix(b, 0.06, rust * 0.9);
      o.r = r; o.g = g; o.b = b; o.h = (fine - 0.5) * 0.2 - rust * 0.5; o.rough = mix(0.5, 0.9, rust); o.metal = mix(0.7, 0.2, rust);
    }, { normalStrength: 1.6 });
  },

  /** Skin (for heads/hands); tone 0..1 (light..dark). */
  skin(size = 256, tone = 0.4, stubble = 0.0, age = 0.0) {
    const base = [mix(0.78, 0.38, tone), mix(0.56, 0.24, tone), mix(0.45, 0.17, tone)];
    return surface(size, (x, y, u, v, o) => {
      const fine = speck(x, y, 3), mid = fbm(u, v, 10, 3, 6);
      const k = 1 + (mid - 0.5) * 0.18 + (fine - 0.5) * 0.06;
      let r = base[0] * k, g = base[1] * k, b = base[2] * k;
      const flush = fbm(u, v, 5, 3, 21);
      r *= 1 + (flush - 0.5) * 0.2; g *= 1 - (flush - 0.5) * 0.1;
      if (stubble > 0 && fine > 0.55) { const s = (fine - 0.55) * stubble; r *= 1 - s * 0.9; g *= 1 - s * 0.9; b *= 1 - s * 0.85; }
      if (age > 0) { const w = smoothstep(0.6, 0.75, ridged(u, v * 3, 12, 3, 4)); r *= 1 - w * age * 0.3; g *= 1 - w * age * 0.32; b *= 1 - w * age * 0.3; }
      o.r = r; o.g = g; o.b = b; o.h = (fine - 0.5) * 0.3 + (mid - 0.5) * 0.3; o.rough = 0.6;
    }, { normalStrength: 1.0 });
  },
};

// ---------------------------------------------------------------------------------------------
// Decal / overlay canvases (alpha textures)
// ---------------------------------------------------------------------------------------------
function alphaTex(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.anisotropy = 4;
  return t;
}

const DECAL = {
  /** Irregular dark stain blotch, transparent edges. */
  stain(seed = 1, tint = [20, 14, 8]) {
    const s = 256, c = canvas(s), g = c.getContext('2d');
    const img = g.createImageData(s, s);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const u = x / s - 0.5, v = y / s - 0.5;
      const d = Math.hypot(u, v) * 2;
      const n = fbm(x / s, y / s, 6, 5, seed);
      const a = smoothstep(1.0, 0.25, d + (n - 0.5) * 0.9) * (0.4 + 0.6 * n);
      const i = (y * s + x) * 4;
      img.data[i] = tint[0]; img.data[i + 1] = tint[1]; img.data[i + 2] = tint[2]; img.data[i + 3] = clamp(a, 0, 1) * 255;
    }
    g.putImageData(img, 0, 0);
    return alphaTex(c);
  },
  /** Vertical water streak. */
  streak(seed = 1) {
    const w = 128, h = 512, c = canvas(w, h), g = c.getContext('2d');
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x / w - 0.5;
      const n = fbm(x / w, y / h, 4, 4, seed);
      const wob = (fbm(0.3, y / h, 4, 3, seed + 3) - 0.5) * 0.5;
      const a = smoothstep(0.35, 0.0, Math.abs(u + wob)) * smoothstep(0, 0.2, y / h) * (0.35 + 0.65 * n) * (1 - (y / h) * 0.6);
      const i = (y * w + x) * 4;
      img.data[i] = 14; img.data[i + 1] = 12; img.data[i + 2] = 8; img.data[i + 3] = clamp(a, 0, 1) * 180;
    }
    g.putImageData(img, 0, 0);
    return alphaTex(c);
  },
  /** Soft radial glow (additive sprites, floor light pools). */
  glow(size = 128) {
    const c = canvas(size), g = c.getContext('2d');
    const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.45)');
    gr.addColorStop(0.6, 'rgba(255,255,255,0.1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, size, size);
    return alphaTex(c);
  },
  /** Elongated soft rectangle (light pools from fluorescent tubes). */
  pool(w = 256, h = 128) {
    const c = canvas(w, h), g = c.getContext('2d');
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = (x / w - 0.5) * 2, v = (y / h - 0.5) * 2;
      const a = Math.pow(saturateLocal(1 - Math.hypot(u * 0.8, v)), 1.8);
      const i = (y * w + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = a * 255;
    }
    g.putImageData(img, 0, 0);
    return alphaTex(c);
  },
  /** Barred window pattern used as spot-light cookie (RGB). */
  windowCookie() {
    const s = 512, c = canvas(s), g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, s, s);
    g.fillStyle = '#fff';
    const cols = 4, rows = 3, pad = 28, gap = 18;
    const cw = (s - pad * 2 - gap * (cols - 1)) / cols, rh = (s - pad * 2 - gap * (rows - 1)) / rows;
    for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) g.fillRect(pad + q * (cw + gap), pad + r * (rh + gap), cw, rh);
    g.filter = 'blur(6px)';
    g.drawImage(c, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  },
  /** Stained-glass cookie (colour). */
  stainedGlass() {
    const s = 512, c = canvas(s), g = c.getContext('2d');
    g.fillStyle = '#050505'; g.fillRect(0, 0, s, s);
    const cols = ['#b22a2a', '#2c4aa6', '#c9a227', '#2a7a4a', '#7a2a8a'];
    for (let i = 0; i < 3; i++) {
      const x0 = 70 + i * 140, w = 110;
      for (let r = 0; r < 5; r++) {
        g.fillStyle = cols[(i * 2 + r * 3) % cols.length];
        const y0 = 40 + r * 85;
        g.beginPath(); g.moveTo(x0, y0 + 80); g.lineTo(x0, y0 + 20); g.quadraticCurveTo(x0 + w / 2, y0 - 12, x0 + w, y0 + 20); g.lineTo(x0 + w, y0 + 80); g.closePath(); g.fill();
      }
    }
    g.filter = 'blur(5px)'; g.drawImage(c, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  },
  /** Rows of book spines (library shelves). */
  books() {
    const w = 512, h = 256, c = canvas(w, h), g = c.getContext('2d');
    g.fillStyle = '#0c0805'; g.fillRect(0, 0, w, h);
    const cols = ['#5a1f1f', '#1f3a4f', '#3b3b24', '#4a2d12', '#222a33', '#6a5a2a', '#2c1a2c', '#1d3a2a', '#7a7468', '#3a1010'];
    for (let r = 0; r < 4; r++) {
      let x = 4;
      const y0 = r * 64 + 6;
      while (x < w - 6) {
        const bw = 6 + Math.floor(ihash(x, r, 4) * 14), bh = 40 + Math.floor(ihash(x, r, 5) * 18);
        g.fillStyle = cols[Math.floor(ihash(x, r, 6) * cols.length)];
        g.fillRect(x, y0 + (58 - bh), bw, bh);
        g.fillStyle = 'rgba(210,190,130,0.35)'; g.fillRect(x + 1, y0 + (58 - bh) + 6, bw - 2, 2);
        g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x + bw - 1, y0 + (58 - bh), 1, bh);
        x += bw + 1;
      }
      g.fillStyle = '#2a1a0c'; g.fillRect(0, r * 64 + 62, w, 4);
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  },
  /** Tally marks scratched on a wall (fives). */
  tally(count = 3290, seed = 3) {
    const w = 512, h = 256, c = canvas(w, h), g = c.getContext('2d');
    g.clearRect(0, 0, w, h);
    g.strokeStyle = 'rgba(15,12,10,0.8)'; g.lineWidth = 2.2; g.lineCap = 'round';
    let n = 0, rnd = ihash;
    for (let gy = 0; gy < 6 && n < count; gy++) for (let gx = 0; gx < 13 && n < count; gx++) {
      const bx = 14 + gx * 38 + (rnd(gx, gy, seed) - 0.5) * 3, by = 18 + gy * 40 + (rnd(gy, gx, seed + 1) - 0.5) * 3;
      for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(bx + k * 6, by); g.lineTo(bx + k * 6 + (rnd(k, gx + gy, seed) - 0.5) * 2, by + 26); g.stroke(); }
      g.beginPath(); g.moveTo(bx - 4, by + 21); g.lineTo(bx + 24, by + 5); g.stroke();
      n += 5;
    }
    return alphaTex(c);
  },
  /** Scratched / sprayed graffiti-ish scrawl. */
  scrawl(text = 'NH', color = 'rgba(150,25,25,0.85)', font = 'bold 90px "Arial Narrow", Impact, sans-serif', w = 512, h = 256) {
    const c = canvas(w, h), g = c.getContext('2d');
    g.clearRect(0, 0, w, h);
    g.save(); g.translate(w / 2, h / 2); g.rotate(-0.06);
    g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = color; g.fillText(text, 0, 0);
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(0,0,0,${0.2 + ihash(i, 1, 1) * 0.6})`; g.fillRect((ihash(i, 2, 1) - 0.5) * w, (ihash(i, 3, 1) - 0.5) * h, 1 + ihash(i, 4, 1) * 7, 1 + ihash(i, 5, 1) * 2); }
    g.restore();
    return alphaTex(c);
  },
};
function saturateLocal(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

// ---------------------------------------------------------------------------------------------
// Signs / printed matter drawn from text
// ---------------------------------------------------------------------------------------------
export function signTexture(lines, { w = 512, h = 256, bg = '#e8e2d0', fg = '#111', accent = null, font = 'bold', border = true, fontFamily = '"Arial Narrow", "Helvetica Neue", Arial, sans-serif', grime = true } = {}) {
  const key = 'sign:' + JSON.stringify([lines, w, h, bg, fg, accent, font, border]);
  if (cache.has(key)) return cache.get(key);
  const c = canvas(w, h), g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  if (border) { g.strokeStyle = accent || fg; g.lineWidth = Math.round(h * 0.035); g.strokeRect(g.lineWidth, g.lineWidth, w - g.lineWidth * 2, h - g.lineWidth * 2); }
  const arr = Array.isArray(lines) ? lines : [lines];
  const sizes = arr.map((l, i) => (typeof l === 'object' ? l.size : (i === 0 ? 0.3 : 0.17)) * h);
  const total = sizes.reduce((a, b) => a + b * 1.15, 0);
  let y = (h - total) / 2;
  arr.forEach((l, i) => {
    const t = typeof l === 'object' ? l.text : l;
    const col = typeof l === 'object' && l.color ? l.color : (i === 0 && accent ? accent : fg);
    g.font = `${font} ${Math.round(sizes[i])}px ${fontFamily}`;
    g.textAlign = 'center'; g.textBaseline = 'top'; g.fillStyle = col;
    g.fillText(t, w / 2, y); y += sizes[i] * 1.15;
  });
  if (grime) {
    const img = g.getImageData(0, 0, w, h);
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const n = fbm(xx / w, yy / h, 5, 4, 8) * 0.5 + ihash(xx, yy, 3) * 0.12;
      const f = 1 - smoothstep(0.55, 0.8, n) * 0.25 - ihash(xx, yy, 7) * 0.05;
      const i = (yy * w + xx) * 4;
      img.data[i] *= f; img.data[i + 1] *= f; img.data[i + 2] *= f;
    }
    g.putImageData(img, 0, 0);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  cache.set(key, t);
  return t;
}

/** A CanvasTexture you can redraw each frame (monitors, clocks...). */
export function liveCanvas(w, h) {
  const c = canvas(w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return { canvas: c, ctx: c.getContext('2d'), texture: t };
}

// ---------------------------------------------------------------------------------------------
// Public registry
// ---------------------------------------------------------------------------------------------
const SURFACE_JOBS = [
  ['concrete', () => GEN.concrete(1024)],
  ['blockGreen', () => GEN.block(1024, 'green')],
  ['blockGrey', () => GEN.block(1024, 'grey')],
  ['blockRed', () => GEN.block(1024, 'red')],
  ['blockBlue', () => GEN.block(1024, 'blue')],
  ['plaster', () => GEN.plaster(1024)],
  ['brick', () => GEN.brick(1024)],
  ['lino', () => GEN.lino(1024)],
  ['steel', () => GEN.steel(512, 0.12)],
  ['steelLight', () => GEN.steel(512, 0.3)],
  ['grating', () => GEN.grating(512)],
  ['wood', () => GEN.wood(512, 1)],
  ['woodDark', () => GEN.wood(512, 0.7)],
  ['mattress', () => GEN.fabric(512, [0.34, 0.33, 0.28], true)],
  ['blanket', () => GEN.fabric(512, [0.17, 0.21, 0.16], false)],
  ['flagstone', () => GEN.flagstone(1024)],
  ['ground', () => GEN.ground(1024)],
  ['bark', () => GEN.bark(512)],
  ['pipe', () => GEN.paintedMetal(512, [0.17, 0.2, 0.2])],
  ['pipeRed', () => GEN.paintedMetal(512, [0.34, 0.06, 0.05])],
  ['skinLight', () => GEN.skin(256, 0.1, 0.4, 0.2)],
  ['skinMid', () => GEN.skin(256, 0.35, 0.5, 0.1)],
  ['skinDark', () => GEN.skin(256, 0.8, 0.4, 0.0)],
  ['skinOld', () => GEN.skin(256, 0.12, 0.3, 1.0)],
];

export const TEX = {};
export const DECALS = {};

/** Generates every texture. Yields to the event loop so a loading bar can animate. */
export async function loadAllTextures(onProgress = () => {}) {
  const total = SURFACE_JOBS.length + 9;
  let done = 0;
  const tick = async (name) => { done++; onProgress(done / total, name); await new Promise((r) => setTimeout(r, 0)); };
  for (const [name, job] of SURFACE_JOBS) {
    TEX[name] = job();
    await tick(name);
  }
  DECALS.stain = DECALS_BUILD('stain', 1); await tick('stain');
  DECALS.stain2 = DECALS_BUILD('stain', 7, [34, 8, 6]); await tick('stain2');
  DECALS.streak = DECALS_BUILD('streak', 4); await tick('streak');
  DECALS.glow = DECALS_BUILD('glow'); await tick('glow');
  DECALS.pool = DECALS_BUILD('pool'); await tick('pool');
  DECALS.window = DECALS_BUILD('windowCookie'); await tick('window');
  DECALS.glass = DECALS_BUILD('stainedGlass'); await tick('glass');
  DECALS.tally = DECALS_BUILD('tally', 3290); await tick('tally');
  DECALS.books = DECALS_BUILD('books'); await tick('books');
  return TEX;
}
function DECALS_BUILD(name, ...args) { return DECAL[name](...args); }
export { DECAL, GEN };
