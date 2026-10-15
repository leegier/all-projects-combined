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
function shirtTexture(kind, color) {
  return canvasTex('shirt:' + kind + color, 256, 256, (g, w, h) => {
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    if (kind === 'guard') {
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(w * 0.48, 0, 4, h);               // placket
      g.fillStyle = '#c9b16a'; g.fillRect(w * 0.62, h * 0.18, 34, 26);                 // badge
      g.fillStyle = '#12100c'; g.font = 'bold 14px Arial'; g.fillText('CO', w * 0.645, h * 0.18 + 19);
      g.fillStyle = '#c9b16a'; g.fillRect(w * 0.1, h * 0.2, 36, 8);                    // name tape
    } else {
      g.fillStyle = 'rgba(20,12,6,0.9)'; g.font = 'bold 30px "Arial Narrow", Arial'; g.textAlign = 'center';
      g.fillText('D.O.C.', w * 0.5, h * 0.62);
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
    this.rig.scale.setScalar(s);
    const skinTex = TEX[L.skin];
    const skin = new THREE.MeshStandardMaterial({ map: skinTex.map, normalMap: skinTex.normalMap, normalScale: new THREE.Vector2(0.4, 0.4), roughness: 0.62, metalness: 0 });
    const tex = shirtTexture(L.shirt[0], L.shirt[1]);
    const shirt = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, normalMap: TEX.blanket.normalMap, normalScale: new THREE.Vector2(0.55, 0.55) });
    const pants = new THREE.MeshStandardMaterial({ map: pantsTexture(L.pants), roughness: 0.95, normalMap: TEX.blanket.normalMap, normalScale: new THREE.Vector2(0.5, 0.5) });
    const boots = new THREE.MeshStandardMaterial({ color: L.boots || 0x1a1410, roughness: 0.55 });
    const mats = [skin, shirt, pants, boots];
    const add = (parent, geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = false; parent.add(m); return m; };
    const J = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

    this.hips = J(this.rig, 0, 0.95, 0);
    add(this.hips, new THREE.CapsuleGeometry(0.17 * wide, 0.12, 4, 12), pants, 0, 0.02, 0).scale.set(1.15, 1, 0.82);
    this.spine = J(this.hips, 0, 0.12, 0);
    const torsoLen = 0.45;   // spine origin (waist) -> neck base
    const abd = add(this.spine, new THREE.CapsuleGeometry(0.135 * wide, 0.1, 6, 14), shirt, 0, 0.1, 0); abd.scale.set(1.12, 1, 0.82);
    const chest = add(this.spine, new THREE.CapsuleGeometry(0.15 * wide, 0.12, 6, 16), shirt, 0, 0.27, 0); chest.scale.set(L.wide ? 1.3 : 1.18, 1, L.wide ? 0.95 : 0.8);
    const yoke = add(this.spine, new THREE.SphereGeometry(0.17 * wide, 16, 10), shirt, 0, 0.425, -0.005); yoke.scale.set(L.wide ? 1.5 : 1.35, 0.3, 0.76);
    const torso = chest;
    if (L.apron) add(this.spine, new THREE.BoxGeometry(0.36, 0.5, 0.04), new THREE.MeshStandardMaterial({ color: 0xe8e4d6, roughness: 0.9 }), 0, 0.22, 0.17);
    if (L.belt) {
      add(this.hips, new THREE.BoxGeometry(0.36 * wide, 0.06, 0.24), new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 0.5 }), 0, 0.1, 0);
      add(this.hips, new THREE.BoxGeometry(0.07, 0.14, 0.07), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 }), 0.19, 0.06, 0.06); // radio/cuff pouch
      add(this.spine, new THREE.BoxGeometry(0.05, 0.1, 0.03), new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.4 }), -0.13, 0.4, 0.13);  // shoulder radio
    }
    this.neck = J(this.spine, 0, torsoLen, 0);
    add(this.neck, new THREE.CylinderGeometry(0.052 * wide, 0.066 * wide, 0.11, 14), skin, 0, 0.02, 0);
    this.head = J(this.neck, 0, 0.055, 0);
    const SKIN = { skinLight: 0xd3a68b, skinMid: 0xb27f62, skinDark: 0x7b5038, skinOld: 0xc9a28f };
    const skinCol = new THREE.Color(SKIN[L.skin] || 0xb27f62);
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
      for (const sx of [-1, 1]) { add(this.head, new THREE.TorusGeometry(0.0225, 0.0028, 8, 18), gm, sx * 0.0345, 0.142, 0.099); add(this.head, new THREE.BoxGeometry(0.004, 0.003, 0.09), gm, sx * 0.076, 0.144, 0.056); }
      add(this.head, new THREE.BoxGeometry(0.018, 0.003, 0.003), gm, 0, 0.147, 0.099);
    }
    if (L.cig) {
      this.cig = add(this.head, new THREE.CylinderGeometry(0.0035, 0.0035, 0.07, 8), new THREE.MeshStandardMaterial({ color: 0xe8e4d8 }), 0.012, 0.0745, 0.128);
      this.cig.rotation.x = Math.PI / 2;
      add(this.head, new THREE.SphereGeometry(0.005, 8, 6), new THREE.MeshStandardMaterial({ color: 0x331100, emissive: 0xff5a10, emissiveIntensity: 3 }), 0.012, 0.0745, 0.165);
    }

    // arms
    const armMat = L.tattoo ? new THREE.MeshStandardMaterial({ map: tattooTexture(5), roughness: 0.6 }) : skin;
    const mkArm = (side) => {
      const sh = J(this.spine, side * 0.215 * wide, torsoLen - 0.03, 0);
      const upper = add(sh, new THREE.CapsuleGeometry(0.058 * (L.wide ? 1.2 : 1), 0.26, 4, 10), shirt, 0, -0.17, 0);
      const el = J(sh, 0, -0.34, 0);
      add(el, new THREE.CapsuleGeometry(0.048 * (L.wide ? 1.2 : 1), 0.24, 4, 10), armMat, 0, -0.15, 0);
      const hand = J(el, 0, -0.32, 0);
      add(hand, new THREE.SphereGeometry(0.05, 14, 10), armMat, 0, -0.02, 0).scale.set(0.9, 1.15, 0.62);
      for (let f = 0; f < 4; f++) { const fg = add(hand, new THREE.CapsuleGeometry(0.0125, 0.045, 3, 8), armMat, (f - 1.5) * 0.02, -0.085, 0.004); fg.rotation.x = 0.12; }
      const thb = add(hand, new THREE.CapsuleGeometry(0.0135, 0.04, 3, 8), armMat, -side * 0.045, -0.04, 0.014); thb.rotation.z = side * 0.6;
      return { sh, el, hand };
    };
    this.lArm = mkArm(-1); this.rArm = mkArm(1);
    // legs
    const mkLeg = (side) => {
      const hip = J(this.hips, side * 0.1 * wide, -0.02, 0);
      add(hip, new THREE.CapsuleGeometry(0.075 * wide, 0.34, 4, 10), pants, 0, -0.24, 0);
      const knee = J(hip, 0, -0.47, 0);
      add(knee, new THREE.CapsuleGeometry(0.06 * wide, 0.34, 4, 10), pants, 0, -0.22, 0);
      const ankle = J(knee, 0, -0.46, 0);
      add(ankle, new THREE.BoxGeometry(0.11, 0.08, 0.27), boots, 0, -0.02, 0.07);
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
    this.hips.position.y = 0.95 + C.hipsY;
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
