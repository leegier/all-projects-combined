// Procedural head sculpt: an ellipsoid displaced by gaussian "features" (brow, sockets, nose, cheekbones, lips, chin, jaw),
// with vertex-colour shading for lips/sockets/stubble, eye spheres with painted irises, lids, brows, ears, and
// hair/beard shells that follow the face surface. All dimensions are metres in head space (+z = face, +y = up).
import * as THREE from 'three';
import { mulberry32, hash01, clamp, lerp } from '../util.js';
import { fbm } from '../proc/noise.js';

const HALF = new THREE.Vector3(0.078, 0.112, 0.097);   // skull half-extents

// [x, y, z, radius, amplitude]; x mirrored when mirror=true  (positions in the unit-sphere frame)
const FEATURES = [
  [0.0, 0.30, 0.94, 0.30, 0.050, false],     // brow ridge (centre)
  [0.40, 0.29, 0.86, 0.26, 0.075, true],     // brow ridge (sides)
  [0.0, 0.58, 0.82, 0.34, 0.030, false],     // forehead
  [0.37, 0.15, 0.91, 0.15, -0.105, true],    // eye sockets
  [0.0, 0.12, 0.98, 0.10, 0.055, false],     // nose bridge
  [0.0, -0.09, 1.01, 0.095, 0.125, false],   // nose tip
  [0.15, -0.11, 0.95, 0.085, 0.055, true],   // nose wings
  [0.065, -0.185, 0.97, 0.05, -0.04, true],  // nostrils
  [0.0, -0.215, 0.96, 0.10, -0.03, false],   // philtrum dip
  [0.55, -0.01, 0.78, 0.22, 0.055, true],    // cheekbones
  [0.46, -0.28, 0.78, 0.22, -0.035, true],   // cheek hollows
  [0.0, -0.345, 0.96, 0.095, 0.040, false],  // upper lip
  [0.0, -0.455, 0.94, 0.105, 0.052, false],  // lower lip
  [0.0, -0.405, 0.97, 0.05, -0.050, false],  // mouth groove
  [0.18, -0.405, 0.92, 0.07, -0.025, true],  // mouth corners
  [0.0, -0.64, 0.80, 0.17, 0.095, false],    // chin
  [0.0, -0.535, 0.92, 0.10, -0.03, false],   // under-lip dip
  [0.56, -0.46, 0.40, 0.30, 0.045, true],    // jaw angle
  [0.78, 0.18, 0.52, 0.22, -0.035, true],    // temples
  [0.0, 0.25, -0.88, 0.42, 0.040, false],    // back of skull
];

function featureField(p) {
  let d = 0;
  for (const [fx, fy, fz, r, a, mir] of FEATURES) {
    const dx0 = p.x - fx, dy = p.y - fy, dz = p.z - fz;
    let e = Math.exp(-(dx0 * dx0 + dy * dy + dz * dz) / (2 * r * r)) * a;
    if (mir) { const dx1 = p.x + fx; e += Math.exp(-(dx1 * dx1 + dy * dy + dz * dz) / (2 * r * r)) * a; }
    d += e;
  }
  return d;
}

/** Returns { geo (indexed, with uv + color), base (function(u,v) -> unit direction) }. */
export function buildHeadGeometry({ seg = 72, rings = 56, skinCol = new THREE.Color(0xb98a70), stubble = 0, scalpDark = 0, flush = 0.15, seed = 1 } = {}) {
  const g = new THREE.SphereGeometry(1, seg, rings);
  const pos = g.attributes.position, nor = g.attributes.normal;
  const col = new Float32Array(pos.count * 3);
  const dir = new THREE.Vector3(), p = new THREE.Vector3();
  const lip = skinCol.clone().multiply(new THREE.Color(0.8, 0.5, 0.5)), dark = skinCol.clone().multiplyScalar(0.38), flushC = skinCol.clone().multiply(new THREE.Color(1.12, 0.82, 0.8));
  const mix = new THREE.Color();
  const rnd = mulberry32(seed);
  for (let i = 0; i < pos.count; i++) {
    dir.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    // jaw taper: narrower below the cheekbones, longer chin direction
    const taper = 1 - 0.28 * clamp((-dir.y - 0.1) / 0.9, 0, 1);
    const front = clamp(dir.z, 0, 1);
    const f = featureField(dir);
    p.copy(dir).multiplyScalar(1 + f);
    p.x *= taper * HALF.x; p.y *= HALF.y; p.z *= HALF.z * (1 + 0.08 * front * clamp(-dir.y, 0, 1));
    pos.setXYZ(i, p.x, p.y, p.z);
    // vertex colour: lips, sockets, cheeks, stubble/scalp
    mix.copy(skinCol);
    const gx = (cx, cy, cz, r) => { const ax = Math.abs(dir.x); return Math.exp(-((ax - Math.abs(cx)) ** 2 + (dir.y - cy) ** 2 + (dir.z - cz) ** 2) / (2 * r * r)); };
    const lipW = Math.max(gx(0, -0.345, 0.96, 0.075), gx(0, -0.455, 0.94, 0.085)) * (dir.z > 0 ? 1 : 0);
    mix.lerp(lip, clamp(lipW * 0.75, 0, 0.75));
    mix.lerp(dark, clamp(gx(0.37, 0.15, 0.91, 0.14) * 0.45, 0, 0.45));
    mix.lerp(flushC, clamp(gx(0.55, -0.12, 0.8, 0.2) * flush, 0, 0.5));
    if (stubble > 0) { const sw = clamp(gx(0, -0.55, 0.8, 0.5) * 1.1 + gx(0.5, -0.35, 0.7, 0.3), 0, 1) * stubble; mix.lerp(dark, sw * 0.45 * (0.7 + 0.3 * rnd())); }
    if (scalpDark > 0) { const sw = clamp((dir.y - 0.25) * 2.2 + (-dir.z - 0.2) * 1.0, 0, 1) * scalpDark; mix.lerp(dark, sw * 0.5); }
    col[i * 3] = mix.r; col[i * 3 + 1] = mix.g; col[i * 3 + 2] = mix.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/** Shell following the head surface where `pred(unitDir)` is true (hair/beard). offset in metres along normals. */
export function buildShell(headGeo, pred, offset = 0.012, { jitter = 0.0, seed = 3 } = {}) {
  const pos = headGeo.attributes.position, nor = headGeo.attributes.normal, idx = headGeo.index;
  const dir = new THREE.Vector3();
  const keep = new Uint8Array(pos.count);
  const rnd = mulberry32(seed);
  for (let i = 0; i < pos.count; i++) { dir.set(pos.getX(i) / HALF.x, pos.getY(i) / HALF.y, pos.getZ(i) / HALF.z).normalize(); keep[i] = pred(dir) ? 1 : 0; }
  const map = new Int32Array(pos.count).fill(-1); const P = [], N = [], U = []; const uvIn = headGeo.attributes.uv;
  const I = [];
  for (let t = 0; t < idx.count; t += 3) {
    const a = idx.getX(t), b = idx.getX(t + 1), c = idx.getX(t + 2);
    if (!(keep[a] && keep[b] && keep[c])) continue;
    for (const v of [a, b, c]) {
      if (map[v] < 0) {
        map[v] = P.length / 3;
        const j = 1 + (rnd() - 0.5) * jitter;
        P.push(pos.getX(v) + nor.getX(v) * offset * j, pos.getY(v) + nor.getY(v) * offset * j, pos.getZ(v) + nor.getZ(v) * offset * j);
        N.push(nor.getX(v), nor.getY(v), nor.getZ(v)); U.push(uvIn.getX(v) * 6, uvIn.getY(v) * 6);
      }
      I.push(map[v]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.setIndex(I);
  return g;
}

let eyeTex = null, hairTexCache = new Map();
export function eyeTexture(iris = '#5b3a24') {
  if (eyeTex && eyeTex._iris === iris) return eyeTex;
  const W = 256, H = 128, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.fillStyle = '#e6e2d8'; g.fillRect(0, 0, W, H);
  // faint veins
  g.strokeStyle = 'rgba(180,70,60,0.22)'; g.lineWidth = 1;
  for (let i = 0; i < 18; i++) { const a = hash01(i) * 6.28; g.beginPath(); g.moveTo(W * 0.25 + Math.cos(a) * 28, H * 0.5 + Math.sin(a) * 28); g.lineTo(W * 0.25 + Math.cos(a) * 62, H * 0.5 + Math.sin(a) * 62); g.stroke(); }
  const cx = W * 0.25, cy = H * 0.5;
  const gr = g.createRadialGradient(cx, cy, 2, cx, cy, 26); gr.addColorStop(0, '#0a0806'); gr.addColorStop(0.32, iris); gr.addColorStop(0.8, '#1a1008'); gr.addColorStop(1, '#0e0b08');
  g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, 26, 0, 6.283); g.fill();
  g.fillStyle = '#050403'; g.beginPath(); g.arc(cx, cy, 9, 0, 6.283); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.arc(cx - 8, cy - 9, 4, 0, 6.283); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t._iris = iris; eyeTex = t; return t;
}

export function hairTexture(base = '#2a2018', seed = 1) {
  const key = base + seed; if (hairTexCache.has(key)) return hairTexCache.get(key);
  const S = 256, c = document.createElement('canvas'); c.width = S; c.height = S; const g = c.getContext('2d'), r = mulberry32(seed);
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 1400; i++) {
    const x = r() * S, y = r() * S, l = 14 + r() * 40;
    const k = (r() - 0.5) * 60;
    g.strokeStyle = `rgba(${128 + k},${128 + k},${128 + k},0.22)`; g.lineWidth = 1 + r();
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 6, y + l); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  hairTexCache.set(key, t); return t;
}

/** Assemble the full head group. opts: skin: texture set, skinCol, hair, beard, stubble, glasses... Returns {group, eyes[], lids[], jaw} */
export function buildHead(opts) {
  const {
    skinTex, skinCol = new THREE.Color(0xb98a70), stubble = 0, scalpDark = 0, hairColor = null, hairStyle = 'none', beardColor = null, beardStyle = 'none',
    irisColor = '#5b3a24', browColor = 0x2a1c12, seed = 1, age = 0,
  } = opts;
  const grp = new THREE.Group();
  const geo = buildHeadGeometry({ skinCol, stubble, scalpDark, seed, flush: 0.12 + age * 0.1 });
  const mat = new THREE.MeshStandardMaterial({ normalMap: skinTex.normalMap, normalScale: new THREE.Vector2(0.5, 0.5), vertexColors: true, roughness: 0.55, metalness: 0 });
  const skull = new THREE.Mesh(geo, mat); skull.castShadow = true; grp.add(skull);
  // ears
  const earMat = new THREE.MeshStandardMaterial({ color: skinCol.clone().multiply(new THREE.Color(1.05, 0.9, 0.88)), roughness: 0.6 });
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 10), earMat); e.scale.set(0.38, 1.15, 0.72); e.position.set(sx * 0.077, -0.004, -0.006); e.rotation.z = sx * 0.1; grp.add(e);
  }
  // eyes (white + iris painted), lids and brows
  const eyeMat = new THREE.MeshStandardMaterial({ map: eyeTexture(irisColor), roughness: 0.18, metalness: 0 });
  const lidMat = new THREE.MeshStandardMaterial({ color: skinCol.clone().multiplyScalar(0.96), roughness: 0.6, side: THREE.DoubleSide });
  const eyes = [], lids = [];
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.0128, 20, 14), eyeMat);
    eye.position.set(sx * 0.0345, 0.027, 0.084); eye.rotation.y = -Math.PI / 2 + sx * 0.06;   // iris (u=0.25) toward +z
    grp.add(eye); eyes.push(eye);
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.0138, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.46), lidMat);
    lid.position.copy(eye.position); lid.rotation.x = 0.55; grp.add(lid); lids.push(lid);
    const lidL = new THREE.Mesh(new THREE.SphereGeometry(0.0137, 16, 8, 0, Math.PI * 2, Math.PI * 0.62, Math.PI * 0.2), lidMat);
    lidL.position.copy(eye.position); grp.add(lidL);
    const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.0046, 0.036, 3, 8), new THREE.MeshStandardMaterial({ color: browColor, roughness: 0.9 }));
    brow.rotation.z = Math.PI / 2 + sx * -0.16; brow.rotation.y = 0; brow.position.set(sx * 0.0385, 0.0555, 0.0895); brow.scale.set(1, 1, 0.8);
    grp.add(brow);
  }
  // hair / beard shells that follow the skull
  if (hairColor && hairStyle !== 'none') {
    const hm = new THREE.MeshStandardMaterial({ map: hairTexture('#' + new THREE.Color(hairColor).getHexString(), seed), roughness: 0.85, side: THREE.DoubleSide });
    const pred = hairStyle === 'short' ? (d) => (d.y > 0.32 - Math.max(0, d.z) * 0.38 || (d.y > -0.15 && d.z < -0.15 && Math.abs(d.x) < 0.98))
      : hairStyle === 'sides' ? (d) => (d.y > -0.12 && d.y < 0.55 && (d.z < 0.05 || Math.abs(d.x) > 0.88) && !(d.y > 0.5))
        : hairStyle === 'slick' ? (d) => (d.y > 0.38 - Math.max(0, d.z) * 0.22 || (d.y > -0.1 && d.z < -0.1))
          : () => false;
    const shell = new THREE.Mesh(buildShell(geo, pred, hairStyle === 'short' ? 0.0075 : 0.011, { jitter: 0.4, seed }), hm); shell.castShadow = true; grp.add(shell);
  }
  if (beardColor && beardStyle !== 'none') {
    const bm = new THREE.MeshStandardMaterial({ map: hairTexture('#' + new THREE.Color(beardColor).getHexString(), seed + 7), roughness: 0.95, side: THREE.DoubleSide });
    const mouth = (d) => Math.hypot(d.x, d.y + 0.405, d.z - 0.95) < 0.075;
    const pred = beardStyle === 'full' ? (d) => (((d.y < -0.2 && d.z > -0.1 && Math.abs(d.x) < 0.92) || (d.y < -0.26 && d.y > -0.3 && Math.abs(d.x) < 0.5 && d.z > 0.8)) && !mouth(d) && !(d.y > -0.3 && d.z > 0.9 && Math.abs(d.x) < 0.11 && false))
      : beardStyle === 'goatee' ? (d) => ((d.y < -0.52 && d.z > 0.4 && Math.abs(d.x) < 0.32) || (d.y < -0.28 && d.y > -0.33 && Math.abs(d.x) < 0.3 && d.z > 0.88 && !mouth(d)))
        : () => false;
    const bshell = new THREE.Mesh(buildShell(geo, pred, beardStyle === 'full' ? 0.012 : 0.009, { jitter: 0.5, seed: seed + 5 }), bm); bshell.castShadow = true; grp.add(bshell);
  }
  return { group: grp, eyes, lids, skull };
}
