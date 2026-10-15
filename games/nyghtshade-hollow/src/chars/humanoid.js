// Procedural humanoid: jointed capsule rig with a pose-blending animator (walk / idle / sit / lie / pray / mop / talk).
import * as THREE from 'three';
import { TEX } from '../proc/textures.js';
import { buildHead } from './head.js';
import { damp, lerp, hash01 } from '../util.js';

const texCache = new Map();
function canvasTex(key, w, h, draw) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  texCache.set(key, t); return t;
}
function fabricNoise(g, w, h, strength = 22) {
  const img = g.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (hash01(i * 0.37) - 0.5) * strength;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
}

/** Capsule whose two end radii differ (thigh/forearm style).  Axis = Y, centred on the origin. */
function taperedCapsule(r0, r1, len, radial = 14, cap = 5) {
  const pts = [];
  for (let i = 0; i <= cap; i++) { const a = -Math.PI / 2 + (i / cap) * (Math.PI / 2); pts.push(new THREE.Vector2(Math.max(1e-4, r1 * Math.cos(a)), -len / 2 + r1 * Math.sin(a))); }
  for (let i = 0; i <= cap; i++) { const a = (i / cap) * (Math.PI / 2); pts.push(new THREE.Vector2(Math.max(1e-4, r0 * Math.cos(a)), len / 2 + r0 * Math.sin(a))); }
  return new THREE.LatheGeometry(pts, radial);
}
let blobTex = null;
function blobShadowTexture() {
  if (blobTex) return blobTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  gr.addColorStop(0, 'rgba(0,0,0,0.62)'); gr.addColorStop(0.45, 'rgba(0,0,0,0.38)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  blobTex = new THREE.CanvasTexture(c); return blobTex;
}
function shirtTexture(kind, color, plain = false) {
  return canvasTex('shirt:' + kind + color + (plain ? 'p' : ''), 256, 256, (g, w, h) => {
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    // weave / folds: soft horizontal bands darker toward the belt
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(0,0,0,0.22)'); gr.addColorStop(0.5, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    if (!plain) {
      if (kind === 'guard') {
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(w * 0.5 - 1.5, 0, 3, h);                 // placket (front centre)
        g.fillStyle = '#c9b16a'; g.fillRect(w * 0.6, h * 0.46, 30, 24);                       // badge, wearer's left chest
        g.fillStyle = '#12100c'; g.font = 'bold 13px Arial'; g.fillText('CO', w * 0.6 + 6, h * 0.46 + 17);
        g.fillStyle = '#c9b16a'; g.fillRect(w * 0.4 - 28, h * 0.46, 30, 7);                   // name tape
        g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(w * 0.6 - 4, h * 0.5 - 6, 38, 2);
      } else {
        g.fillStyle = 'rgba(24,14,8,0.92)'; g.font = 'bold 34px "Arial Narrow", Arial'; g.textAlign = 'center';
        for (const cx of [0, w]) { g.save(); g.translate(cx, h * 0.54); g.scale(0.55, 1); g.fillText('D.O.C.', 0, 0); g.restore(); }   // back stencil
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(w * 0.58, h * 0.44, 30, 26);               // breast pocket
      }
    }
    fabricNoise(g, w, h);
    g.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 24; i++) g.fillRect(hash01(i) * w, hash01(i + 9) * h, 3 + hash01(i + 3) * 30, 1 + hash01(i + 5) * 2);
  });
}
function pantsTexture(color) {
  return canvasTex('pants' + color, 128, 128, (g, w, h) => { g.fillStyle = color; g.fillRect(0, 0, w, h); fabricNoise(g, w, h, 20); });
}
function tattooTexture(seed) {
  return canvasTex('tat' + seed, 256, 128, (g, w, h) => {
    g.fillStyle = '#c28a68'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(20,28,40,0.75)'; g.lineWidth = 2.2;
    for (let i = 0; i < 26; i++) { const x = hash01(i + seed) * w, y = hash01(i + seed + 40) * h; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 14, y - 12, x + 24, y + 14, x + 36 * hash01(i), y + 20); g.stroke(); }
    g.font = 'bold 18px serif'; g.fillStyle = 'rgba(20,28,40,0.8)'; g.fillText('NH', 16, 40); g.fillText('1106553', 100, 100);
    fabricNoise(g, w, h, 14);
  });
}

export const LOOKS = {
  guard: { skin: 'skinMid', shirt: ['guard', '#1c2a40'], pants: '#141a26', hat: '#101722', boots: 0x0a0a0a, belt: true, scale: 1.0 },
  guardLight: { skin: 'skinLight', shirt: ['guard', '#24324a'], pants: '#171d2b', hat: '#131b29', boots: 0x0a0a0a, belt: true, scale: 1.02 },
  inmateA: { skin: 'skinMid', shirt: ['inmate', '#9a5a22'], pants: '#8a5220', scale: 1.0 },
  inmateB: { skin: 'skinDark', shirt: ['inmate', '#a66524'], pants: '#8a5220', scale: 1.04, bald: true },
  inmateC: { skin: 'skinLight', shirt: ['inmate', '#8e5120'], pants: '#7a4719', scale: 0.98, hair: 0x2a2018 },
  cutter: { skin: 'skinLight', shirt: ['inmate', '#c9c4b4'], pants: '#8a5220', scale: 0.97, hair: 0x15110d, hairStyle: 'slick', goatee: 0x15110d, slim: true, cig: true, iris: '#3f5a6a', stubble: 0.7 },
  tuck: { skin: 'skinDark', shirt: ['inmate', '#d8d6cc'], pants: '#8a5220', scale: 1.08, wide: true, hairnet: true, apron: true },
  harrington: { skin: 'skinOld', shirt: ['inmate', '#7b7568'], pants: '#6a5438', scale: 0.93, beard: 0xdddad2, hair: 0xd8d6d0, hairStyle: 'sides', thin: true, glasses: true, stoop: 0.12, iris: '#4a6070', stubble: 0.0 },
  maddox: { skin: 'skinLight', shirt: ['inmate', '#9a5a22'], pants: '#8a5220', scale: 1.1, wide: true, tattoo: true, bald: true },
};

const POSES = {
  idle: {},
  sit: { hipsY: -0.5, lThigh: -1.55, rThigh: -1.55, lKnee: 1.5, rKnee: 1.5, lUpper: -0.4, rUpper: -0.4, lElbow: -1.0, rElbow: -1.0 },
  lie: { lie: 1 },
  lean: { lean: 1, lUpper: 0.1, rUpper: -0.2, rElbow: -1.2 },
  pray: { hipsY: -0.42, lThigh: -0.2, rThigh: -0.2, lKnee: 2.4, rKnee: 2.4, spine: 0.3, head: 0.45, lUpper: -0.9, rUpper: -0.9, lElbow: -1.7, rElbow: -1.7, lUpperZ: 0.2, rUpperZ: -0.2 },
  mop: { spine: 0.28, lUpper: -0.8, rUpper: -0.9, lElbow: -0.6, rElbow: -0.5, mop: 1 },
  hands: { lUpper: -3.0, rUpper: -3.0, lElbow: -0.3, rElbow: -0.3 },
  talk: { talk: 1 },
  stand: {},
  read: { lUpper: -0.7, rUpper: -0.7, lElbow: -1.6, rElbow: -1.6, head: 0.35 },
  ground: { hipsY: -0.86, lThigh: -1.4, rThigh: -1.25, lKnee: 0.45, rKnee: 0.7, spine: -0.08, head: 0.05, lUpper: 0.2, rUpper: -0.35, lElbow: -0.5, rElbow: -1.0 },
  type: { spine: 0.08, lUpper: -0.7, rUpper: -0.7, lElbow: -1.3, rElbow: -1.3, type: 1 },
};

export class Humanoid {
  constructor(look = 'inmateA', opts = {}) {
    const L = typeof look === 'string' ? LOOKS[look] : look;
    this.look = L; this.name = opts.name || look;
    const s = (L.scale || 1) * (opts.scale || 1);
    const wide = L.wide ? 1.22 : L.slim ? 0.88 : L.thin ? 0.9 : 1;
    this.root = new THREE.Group();
    // Engine heading convention: forward = (-sin yaw, -cos yaw) = local -Z, so the rig (modelled facing +Z) is flipped.
    this.flip = new THREE.Group(); this.flip.rotation.y = Math.PI; this.root.add(this.flip);
    this.rig = new THREE.Group(); this.flip.add(this.rig);
    const bs = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, fog: false }));
    bs.rotation.x = -Math.PI / 2; bs.position.y = 0.012; bs.scale.set(0.95, 0.8, 1); bs.renderOrder = 2; this.blob = bs; this.root.add(bs);
    this.rig.scale.setScalar(s);
    const skinTex = TEX[L.skin];
    const SKIN = { skinLight: 0xd3a68b, skinMid: 0xb27f62, skinDark: 0x7b5038, skinOld: 0xc9a28f };
    const skinCol = new THREE.Color(SKIN[L.skin] || 0xb27f62);
    const skinFlat = new THREE.MeshStandardMaterial({ color: skinCol.clone().multiply(new THREE.Color(1.04, 0.95, 0.92)), roughness: 0.6, metalness: 0 });
    const skin = new THREE.MeshStandardMaterial({ map: skinTex.map, normalMap: skinTex.normalMap, normalScale: new THREE.Vector2(0.4, 0.4), roughness: 0.62, metalness: 0 });
    const tex = shirtTexture(L.shirt[0], L.shirt[1]);
    const sleeveTex = shirtTexture(L.shirt[0], L.shirt[1], true);
    const shirt = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, normalMap: TEX.blanket.normalMap, normalScale: new THREE.Vector2(0.55, 0.55) });
    const sleeve = new THREE.MeshStandardMaterial({ map: sleeveTex, roughness: 0.92, normalMap: TEX.blanket.normalMap, normalScale: new THREE.Vector2(0.55, 0.55) });
    const pants = new THREE.MeshStandardMaterial({ map: pantsTexture(L.pants), roughness: 0.95, normalMap: TEX.blanket.normalMap, normalScale: new THREE.Vector2(0.5, 0.5) });
    const boots = new THREE.MeshStandardMaterial({ color: L.boots || 0x1a1410, roughness: 0.55 });
    const mats = [skin, shirt, sleeve, pants, boots];
    const add = (parent, geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = false; parent.add(m); return m; };
    const J = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

    this.hips = J(this.rig, 0, 0.95, 0);
    add(this.hips, new THREE.CapsuleGeometry(0.118 * wide, 0.05, 6, 14), pants, 0, 0.035, 0).scale.set(1.3, 1, 0.9);
    this.spine = J(this.hips, 0, 0.12, 0);
    const torsoLen = 0.45;   // spine origin (waist) -> neck base
    const TP = [[0.152, -0.1], [0.14, -0.04], [0.124, 0.0], [0.122, 0.06], [0.128, 0.14], [0.145, 0.22], [0.158, 0.3], [0.158, 0.35], [0.146, 0.395], [0.11, 0.425], [0.07, 0.445], [0.054, 0.455]];
    const torso = add(this.spine, new THREE.LatheGeometry(TP.map(([r, y]) => new THREE.Vector2(r, y)), 30, Math.PI), shirt, 0, 0, 0);
    torso.scale.set(1.1 * wide, 1, L.wide ? 0.92 : 0.78);
    const yoke = add(this.spine, new THREE.SphereGeometry(0.17 * wide, 18, 10), shirt, 0, 0.392, -0.004); yoke.scale.set(1.28, 0.27, L.wide ? 0.78 : 0.66);
    if (L.apron) {
      const am = new THREE.MeshStandardMaterial({ map: canvasTex('apron', 128, 256, (g, w, h) => { g.fillStyle = '#e6e2d4'; g.fillRect(0, 0, w, h); fabricNoise(g, w, h, 16); g.fillStyle = 'rgba(120,90,40,0.18)'; for (let i = 0; i < 14; i++) g.fillRect(hash01(i + 3) * w, h * (0.25 + hash01(i + 8) * 0.7), 4 + hash01(i) * 22, 2 + hash01(i + 5) * 9); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, h * 0.5 - 1, w, 2); }), roughness: 0.95, side: THREE.DoubleSide });
      const bib = add(this.spine, new THREE.CylinderGeometry(0.168, 0.19, 0.5, 20, 1, true, -0.95, 1.9), am, 0, 0.08, 0);
      bib.scale.set(1.45, 1, 0.94);
      const ties = new THREE.MeshStandardMaterial({ color: 0xcfcabb, roughness: 0.9 });
      for (const sx of [-1, 1]) { const st = add(this.spine, new THREE.BoxGeometry(0.014, 0.19, 0.008), ties, sx * 0.07, 0.385, 0.1); st.rotation.z = sx * 0.28; }
    }
    if (L.belt) {
      add(this.hips, new THREE.CylinderGeometry(0.166 * wide, 0.166 * wide, 0.05, 22), new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 0.5 }), 0, 0.105, 0).scale.set(1.1, 1, 0.82);
      add(this.hips, new THREE.BoxGeometry(0.07, 0.14, 0.07), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 }), 0.19, 0.06, 0.06); // radio/cuff pouch
      add(this.spine, new THREE.BoxGeometry(0.05, 0.1, 0.03), new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.4 }), -0.13, 0.4, 0.13);  // shoulder radio
    }
    this.neck = J(this.spine, 0, torsoLen, 0);
    add(this.neck, new THREE.CylinderGeometry(0.056 * wide, 0.07 * wide, 0.12, 16), skinFlat, 0, 0.02, 0);
    this.head = J(this.neck, 0, 0.05, 0); this.head.scale.setScalar(1.08);
    const hh = buildHead({
      skinTex, skinCol, stubble: L.stubble ?? (L.thin ? 0.2 : 0.55), scalpDark: L.bald ? 0.75 : 0,
      hairColor: L.hair || null, hairStyle: L.hair ? (L.hairStyle || (L.thin ? 'sides' : 'short')) : 'none',
      beardColor: L.beard || L.goatee || null, beardStyle: L.beard ? 'full' : L.goatee ? 'goatee' : 'none',
      irisColor: L.iris || '#5b3a24', browColor: L.hair || 0x2a1c12, seed: opts.seed || 3, age: L.thin ? 1 : 0,
    });
    hh.group.position.y = 0.115; this.head.add(hh.group);
    this.headParts = hh;
    if (L.hat) {
      const hm = new THREE.MeshStandardMaterial({ color: L.hat, roughness: 0.85 });
      const crown = add(this.head, new THREE.CylinderGeometry(0.1, 0.108, 0.07, 22), hm, 0, 0.235, 0.002);
      add(this.head, new THREE.CylinderGeometry(0.104, 0.104, 0.012, 22), hm, 0, 0.205, 0.002);
      const visor = add(this.head, new THREE.BoxGeometry(0.17, 0.008, 0.075), hm, 0, 0.205, 0.115); visor.rotation.x = 0.12;
      add(this.head, new THREE.BoxGeometry(0.04, 0.026, 0.004), new THREE.MeshStandardMaterial({ color: 0xc9b16a, metalness: 0.8, roughness: 0.3 }), 0, 0.237, 0.108);
    } else if (L.hairnet) {
      add(this.head, new THREE.SphereGeometry(0.108, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshStandardMaterial({ color: 0xd9d6cc, roughness: 0.9, transparent: true, opacity: 0.8 }), 0, 0.125, -0.012).scale.set(0.8, 1.16, 1.02);
    }
    if (L.glasses) {
      const gm = new THREE.MeshStandardMaterial({ color: 0x15130f, roughness: 0.4, metalness: 0.5 });
      for (const sx of [-1, 1]) { add(this.head, new THREE.TorusGeometry(0.0215, 0.0017, 8, 24), gm, sx * 0.0345, 0.142, 0.099); add(this.head, new THREE.BoxGeometry(0.003, 0.0022, 0.09), gm, sx * 0.076, 0.144, 0.056); }
      add(this.head, new THREE.BoxGeometry(0.018, 0.003, 0.003), gm, 0, 0.147, 0.099);
    }
    if (L.cig) {
      this.cig = add(this.head, new THREE.CylinderGeometry(0.0035, 0.0035, 0.07, 8), new THREE.MeshStandardMaterial({ color: 0xe8e4d8 }), 0.012, 0.0745, 0.128);
      this.cig.rotation.x = Math.PI / 2;
      add(this.head, new THREE.SphereGeometry(0.005, 8, 6), new THREE.MeshStandardMaterial({ color: 0x331100, emissive: 0xff5a10, emissiveIntensity: 3 }), 0.012, 0.0745, 0.165);
    }

    // arms
    const armMat = L.tattoo ? new THREE.MeshStandardMaterial({ map: tattooTexture(5), roughness: 0.6 }) : skinFlat;
    const mkArm = (side) => {
      const sh = J(this.spine, side * 0.185 * wide, torsoLen - 0.085, 0);
      const aw = L.wide ? 1.2 : 1;
      add(sh, taperedCapsule(0.062 * aw, 0.05 * aw, 0.34, 16), sleeve, 0, -0.17, 0);
      const el = J(sh, 0, -0.34, 0);
      add(el, taperedCapsule(0.048 * aw, 0.034 * aw, 0.32, 16), armMat, 0, -0.16, 0);
      if (L.shirt[0] === 'guard') add(el, taperedCapsule(0.052 * aw, 0.044 * aw, 0.2, 16), sleeve, 0, -0.1, 0);   // long sleeve to the wrist-ish
      const hand = J(el, 0, -0.32, 0);
      add(hand, new THREE.SphereGeometry(0.05, 14, 10), armMat, 0, -0.02, 0).scale.set(0.9, 1.15, 0.62);
      for (let f = 0; f < 4; f++) { const fg = add(hand, new THREE.CapsuleGeometry(0.0125, 0.045, 3, 8), armMat, (f - 1.5) * 0.02, -0.085, 0.004); fg.rotation.x = 0.12; }
      const thb = add(hand, new THREE.CapsuleGeometry(0.0135, 0.04, 3, 8), armMat, -side * 0.045, -0.04, 0.014); thb.rotation.z = side * 0.6;
      return { sh, el, hand };
    };
    this.lArm = mkArm(-1); this.rArm = mkArm(1);
    // legs
    const mkLeg = (side) => {
      const hip = J(this.hips, side * 0.09 * wide, -0.02, 0);
      add(hip, taperedCapsule(0.094 * wide, 0.062 * wide, 0.45, 18), pants, 0, -0.225, 0);
      const knee = J(hip, 0, -0.45, 0);
      add(knee, taperedCapsule(0.062 * wide, 0.042 * wide, 0.41, 18), pants, 0, -0.205, 0);
      const ankle = J(knee, 0, -0.41, 0);
      const boot = add(ankle, new THREE.CapsuleGeometry(0.046, 0.15, 4, 12), boots, 0, -0.03, 0.075); boot.rotation.x = Math.PI / 2; boot.scale.set(1.12, 1, 0.66);
      add(ankle, new THREE.CylinderGeometry(0.05, 0.056, 0.09, 12), boots, 0, 0.02, -0.005);
      add(ankle, new THREE.BoxGeometry(0.1, 0.018, 0.25), new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.9 }), 0, -0.065, 0.07);
      return { hip, knee, ankle };
    };
    this.lLeg = mkLeg(-1); this.rLeg = mkLeg(1);
    this.mats = mats;

    // animation state
    this.pose = 'idle'; this.cur = {}; this.phase = hash01(opts.seed || 1) * 6.28; this.walkAmt = 0; this.speed = 0;
    this.t = 0; this.talking = 0; this.seed = opts.seed || 1;
    this.stoop = L.stoop || 0;
    this.lookYaw = 0; this.lookPitch = 0; this.targetLookYaw = 0;
    this.root.traverse((o) => { if (o.isMesh) o.matrixAutoUpdate = true; });
  }
  setPose(p) { this.pose = p; }
  setCast(v) { this.root.traverse((o) => { if (o.isMesh) o.castShadow = v; }); }
  /** speed in m/s drives the walk cycle. lookAtYaw: relative yaw (radians) the head turns toward. */
  update(dt, speed, lookRel = 0, pitchRel = 0) {
    this.t += dt;
    this.speed = damp(this.speed, speed, 8, dt);
    this.walkAmt = damp(this.walkAmt, Math.min(1, this.speed / 1.6), 8, dt);
    this.phase += this.speed * dt * 3.3;
    const P = POSES[this.pose] || POSES.idle;
    const w = this.walkAmt;
    const s = Math.sin(this.phase), c = Math.cos(this.phase);
    const breathe = Math.sin(this.t * 1.7 + this.seed) * 0.012;
    const shift = Math.sin(this.t * 0.4 + this.seed * 3.1) * 0.03;
    const talk = P.talk || this.talking ? Math.max(P.talk || 0, this.talking) : 0;
    const g = (k, d = 0) => (P[k] !== undefined ? P[k] : d);
    const walkOk = this.pose === 'idle' || this.pose === 'stand' || this.pose === 'talk';
    const wa = walkOk ? w : 0;
    const T = {
      hipsY: g('hipsY') + Math.abs(s) * -0.03 * wa,
      spine: g('spine') + breathe + this.stoop * (1 - wa * 0.3) + (g('mop') ? Math.sin(this.t * 2.2) * 0.05 : 0),
      head: g('head') + this.stoop * -0.4 + Math.sin(this.t * 0.6 + this.seed) * 0.03,
      lThigh: g('lThigh') + s * 0.62 * wa, rThigh: g('rThigh') - s * 0.62 * wa,
      lKnee: g('lKnee') + Math.max(0, -c) * 0.8 * wa, rKnee: g('rKnee') + Math.max(0, c) * 0.8 * wa,
      lUpper: g('lUpper', 0.05) - s * 0.55 * wa + (talk ? Math.sin(this.t * 2.3) * 0.18 - 0.2 : 0),
      rUpper: g('rUpper', 0.05) + s * 0.55 * wa + (talk ? Math.sin(this.t * 2.9 + 1) * 0.28 - 0.5 : 0),
      lElbow: g('lElbow', -0.15) - (wa > 0.1 ? 0.3 * wa : 0), rElbow: g('rElbow', -0.15) - (wa > 0.1 ? 0.3 * wa : 0) - (talk ? 0.5 : 0),
      lUpperZ: g('lUpperZ', 0.05) + shift * 0.3, rUpperZ: g('rUpperZ', -0.05) + shift * 0.3,
    };
    if (P.mop) { T.lUpper = -0.9 + Math.sin(this.t * 2.2) * 0.12; T.rUpper = -0.95 + Math.sin(this.t * 2.2) * 0.12; }
    if (P.type) { T.lElbow = -1.3 + Math.sin(this.t * 11) * 0.06; T.rElbow = -1.3 + Math.sin(this.t * 13 + 1) * 0.06; }
    const k = 12;
    for (const key of Object.keys(T)) this.cur[key] = this.cur[key] === undefined ? T[key] : damp(this.cur[key], T[key], k, dt);
    const C = this.cur;
    let plant = 0;   // keep the lowest foot on the floor while the legs swing
    if (walkOk && wa > 0.01) {
      const drop = (a, k) => 0.45 * Math.cos(a) + 0.41 * Math.cos(a + k);
      plant = Math.max(drop(C.lThigh, C.lKnee), drop(C.rThigh, C.rKnee)) - 0.86;
    }
    this.hips.position.y = 0.95 + C.hipsY + plant;
    this.hips.rotation.z = Math.sin(this.phase) * 0.03 * wa;
    this.spine.rotation.x = C.spine;
    this.spine.rotation.y = Math.sin(this.phase) * -0.08 * wa;
    this.lookYaw = damp(this.lookYaw, Math.max(-1.0, Math.min(1.0, lookRel)), 6, dt);
    this.lookPitch = damp(this.lookPitch, Math.max(-0.4, Math.min(0.4, pitchRel)), 6, dt);
    this.head.rotation.set(C.head + this.lookPitch, this.lookYaw, 0);
    this.lLeg.hip.rotation.x = C.lThigh; this.rLeg.hip.rotation.x = C.rThigh;
    this.lLeg.knee.rotation.x = C.lKnee; this.rLeg.knee.rotation.x = C.rKnee;
    this.lLeg.ankle.rotation.x = -(C.lThigh + C.lKnee) * 0.35 * (this.pose === 'pray' ? 0 : 1) - (this.pose === 'sit' ? 0 : 0);
    this.rLeg.ankle.rotation.x = -(C.rThigh + C.rKnee) * 0.35 * (this.pose === 'pray' ? 0 : 1);
    this.lArm.sh.rotation.set(C.lUpper, 0, C.lUpperZ); this.rArm.sh.rotation.set(C.rUpper, 0, C.rUpperZ);
    this.lArm.el.rotation.x = C.lElbow; this.rArm.el.rotation.x = C.rElbow;
    // lie / lean
    const wantLie = P.lie ? 1 : 0;
    this._lie = damp(this._lie || 0, wantLie, 6, dt);
    this.rig.rotation.x = -this._lie * Math.PI / 2;
    this.rig.position.y = this._lie * 0.22;
    this._lean = damp(this._lean || 0, P.lean ? 1 : 0, 6, dt);
    this.rig.rotation.z = this._lean * 0.08;
  }
}
