// First-person arms (Maddox: heavy, tattooed forearms, rolled D.O.C. sleeves, scarred knuckles). Lives on camera layer 1 and
// is composited in its own pass so it never clips into walls.
import * as THREE from 'three';
import { TEX } from '../proc/textures.js';
import { damp, lerp, hash01 } from '../util.js';
import { fbm } from '../proc/noise.js';

function inkTexture() {
  const W = 512, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const img = g.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const n = fbm(x / W, y / H, 6, 4, 3), f = hash01(x * 0.73 + y * 1.37);
    const i = (y * W + x) * 4, k = 0.9 + (n - 0.5) * 0.28 + (f - 0.5) * 0.07;
    img.data[i] = 190 * k; img.data[i + 1] = 138 * k; img.data[i + 2] = 110 * k; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // blackwork sleeve: soft ink wash + hard outlines. v: 0 elbow -> 1 wrist (sleeve fades before the wrist)
  g.save();
  const ink = (a) => `rgba(16,20,34,${a})`;
  g.filter = 'blur(6px)';
  for (let i = 0; i < 46; i++) { const x = hash01(i) * W, y = hash01(i + 70) * H * 0.7, r = 26 + hash01(i + 5) * 46; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, ink(0.78)); gr.addColorStop(1, ink(0)); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  g.filter = 'none';
  g.lineCap = 'round'; g.lineJoin = 'round';
  // flames / thorns outlines
  g.strokeStyle = ink(0.95); g.lineWidth = 3.4;
  for (let k = 0; k < 34; k++) { const x = hash01(k + 11) * W, y = hash01(k + 41) * H * 0.7, h = 40 + hash01(k) * 56; g.beginPath(); g.moveTo(x, y + h); g.bezierCurveTo(x - 16, y + h * 0.5, x + 18, y + h * 0.4, x + 4, y); g.bezierCurveTo(x + 14, y + h * 0.4, x + 22, y + h * 0.6, x, y + h); g.stroke(); }
  // roman numerals + script + skull window (skin shows through)
  g.fillStyle = 'rgba(190,138,110,0.95)'; g.beginPath(); g.ellipse(150, 230, 46, 58, 0.2, 0, 6.283); g.fill();
  g.strokeStyle = ink(1); g.lineWidth = 4; g.beginPath(); g.ellipse(150, 230, 46, 58, 0.2, 0, 6.283); g.stroke();
  g.fillStyle = ink(0.95); g.beginPath(); g.arc(134, 218, 9, 0, 6.283); g.arc(166, 218, 9, 0, 6.283); g.fill(); g.fillRect(142, 252, 5, 18); g.fillRect(153, 252, 5, 18);
  g.beginPath(); g.moveTo(148, 236); g.lineTo(144, 244); g.lineTo(152, 244); g.closePath(); g.fill();
  g.font = 'bold 34px "Times New Roman",serif'; g.fillStyle = 'rgba(190,138,110,0.9)'; g.fillRect(270, 150, 190, 44); g.fillStyle = ink(1); g.fillText('MMXVII', 280, 184);
  g.font = 'italic 24px serif'; g.fillStyle = 'rgba(190,138,110,0.9)'; g.fillRect(260, 300, 220, 36); g.fillStyle = ink(1); g.fillText('keep your word', 268, 328);
  // bare wrist
  const gr = g.createLinearGradient(0, H * 0.68, 0, H); gr.addColorStop(0, 'rgba(190,138,110,0)'); gr.addColorStop(0.7, 'rgba(190,138,110,1)'); gr.addColorStop(1, 'rgba(190,138,110,1)');
  g.fillStyle = gr; g.fillRect(0, H * 0.68, W, H * 0.32);
  g.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}

export class Viewmodel {
  constructor(parent) {
    this.root = new THREE.Group();
    parent.add(this.root);
    const ink = inkTexture();
    const skin = new THREE.MeshStandardMaterial({ map: ink, normalMap: TEX.skinMid.normalMap, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.58, fog: false });
    const skinPlain = new THREE.MeshStandardMaterial({ color: 0xa87860, normalMap: TEX.skinMid.normalMap, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.55, fog: false });
    const sleeve = new THREE.MeshStandardMaterial({ color: 0x9a5a22, roughness: 0.95, fog: false });
    const hem = new THREE.MeshStandardMaterial({ color: 0x6c3d15, roughness: 0.95, fog: false });
    const mk = (side) => {
      const g = new THREE.Group();
      // forearm: lathe (axis along -z), elbow end at origin → wrist at z = -0.30
      const prof = [[0.058, 0], [0.063, 0.04], [0.06, 0.09], [0.052, 0.17], [0.045, 0.23], [0.04, 0.29], [0.0385, 0.31]].map(([r, l]) => new THREE.Vector2(r, l));
      const lg = new THREE.LatheGeometry(prof, 20); lg.rotateX(-Math.PI / 2);
      const fore = new THREE.Mesh(lg, skin); g.add(fore);
      // rolled sleeve at the elbow end
      const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.074, 0.07, 0.085, 22), sleeve); sl.rotation.x = Math.PI / 2; sl.position.z = -0.01; g.add(sl);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.012, 8, 24), hem); rim.position.z = -0.055; g.add(rim);
      // hand: a clenched fist seen from behind/above — back of hand, four knuckles, curled proximal phalanges, wrapped thumb
      const hand = new THREE.Group(); hand.position.z = -0.31; g.add(hand);
      const back = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), skinPlain); back.scale.set(0.047, 0.027, 0.062); back.position.set(0, 0.004, -0.048); hand.add(back);
      const wristBlend = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), skin); wristBlend.scale.set(0.04, 0.034, 0.03); wristBlend.position.set(0, 0, -0.008); hand.add(wristBlend);
      for (let f = 0; f < 4; f++) {
        const fx = (f - 1.5) * 0.0215 * -side * -1, big = 1 - Math.abs(f - 1.5) * 0.06;
        const kn = new THREE.Mesh(new THREE.SphereGeometry(0.0158 * big, 14, 10), skinPlain); kn.position.set(fx, 0.014, -0.098 + Math.abs(f - 1.5) * 0.004); hand.add(kn);
        // proximal phalanx pitched down in front of the knuckle
        const l1 = 0.04 * big;
        const p1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.0128 * big, l1, 4, 10), skinPlain); p1.position.set(fx, 0.0, -0.112 + Math.abs(f - 1.5) * 0.004); p1.rotation.x = -0.35; p1.position.y = -0.006; p1.position.z -= 0.012;
        hand.add(p1);
        const p2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.0118 * big, 0.028, 4, 10), skinPlain); p2.position.set(fx, -0.032, -0.108 + Math.abs(f - 1.5) * 0.004); p2.rotation.x = -1.2; hand.add(p2);
        // knuckle wear
        const scar = new THREE.Mesh(new THREE.SphereGeometry(0.0062, 8, 6), hem); scar.position.set(fx, 0.0295, -0.098 + Math.abs(f - 1.5) * 0.004); scar.scale.set(1, 0.4, 1); if (f % 2 === 0) hand.add(scar);
      }
      const th = new THREE.Mesh(new THREE.CapsuleGeometry(0.0148, 0.052, 4, 10), skinPlain); th.position.set(-side * 0.047, 0.004, -0.078); th.rotation.set(-1.25, 0, side * 0.35); hand.add(th);
      const thTip = new THREE.Mesh(new THREE.SphereGeometry(0.0138, 10, 8), skinPlain); thTip.position.set(-side * 0.038, -0.008, -0.108); hand.add(thTip);
      this.root.add(g);
      g.userData.hand = hand;
      return g;
    };
    this.L = mk(-1); this.R = mk(1);
    // tray (carried)
    this.tray = new THREE.Group();
    const tr = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, 0.28), new THREE.MeshStandardMaterial({ color: 0x777c80, roughness: 0.35, metalness: 0.8, fog: false })); this.tray.add(tr);
    const food = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 0.1), new THREE.MeshStandardMaterial({ color: 0xc9b47a, roughness: 0.9, fog: false })); food.position.set(-0.08, 0.02, -0.02); this.tray.add(food);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.07, 12), new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.4, fog: false })); cup.position.set(0.12, 0.045, 0.02); this.tray.add(cup);
    this.tray.visible = false; this.root.add(this.tray);
    // mop stick
    this.mop = new THREE.Group();
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.5, 8), new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.8, fog: false })); this.mop.add(stick);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 0.1), new THREE.MeshStandardMaterial({ color: 0xcfc7b0, roughness: 1, fog: false })); head.position.y = -0.74; this.mop.add(head);
    this.mop.visible = false; this.root.add(this.mop);
    this.paper = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.005, 0.28), new THREE.MeshStandardMaterial({ color: 0xd8d0b4, roughness: 0.9, fog: false })); this.paper.visible = false; this.root.add(this.paper);
    this.root.traverse((o) => o.layers.set(1));
    this.act = 'none'; this.actT = 0; this.visible = true; this.reach = 0;
    this.pose = { L: [0, 0, 0, 0, 0, 0], R: [0, 0, 0, 0, 0, 0] };
    // start in the rest pose so the first frame isn't a lerp from the origin
    this.restApply(0);
  }
  restApply() {
    const r = this.restPose(0, 0, 0);
    this.L.position.set(r.L[0], r.L[1], r.L[2]); this.L.rotation.set(r.L[3], r.L[4], r.L[5]);
    this.R.position.set(r.R[0], r.R[1], r.R[2]); this.R.rotation.set(r.R[3], r.R[4], r.R[5]);
  }
  restPose(walkX, walkY, swing) {
    return {
      L: [-0.255 + walkX, -0.345 + walkY, -0.215 + swing * 0.4, 0.42 + swing * 0.5, -0.2, 0.03],
      R: [0.255 - walkX, -0.345 + walkY, -0.215 - swing * 0.4, 0.42 - swing * 0.5, 0.2, -0.03],
    };
  }
  /** act: 'none' | 'reach' | 'hold' | 'mop' | 'tray' | 'lift' | 'eat' | 'paper' | 'shim' */
  update(dt, g) {
    const p = g.player;
    this.root.visible = this.visible && g.mode !== 'title' && g.mode !== 'dialogue' && !(g.cine && !g.cine.showArms);
    if (!this.root.visible) return;
    this.actT += dt;
    const bob = p.bobAmp, ph = p.bobPhase;
    const sprint = p.sprinting ? 1 : 0;
    const crouch = p.crouch;
    const walkX = Math.sin(ph) * 0.012 * bob, walkY = Math.abs(Math.sin(ph)) * 0.022 * bob + crouch * 0.025;
    const breath = Math.sin(p.breath) * 0.0035;
    const swing = Math.cos(ph) * 0.1 * bob * (1 + sprint);
    const a = this.act, t = this.actT;
    let { L, R } = this.restPose(walkX, walkY + breath, swing);
    L = L.slice(); R = R.slice();
    this.tray.visible = a === 'tray' || a === 'eat'; this.mop.visible = a === 'mop'; this.paper.visible = a === 'paper';
    if (a === 'reach') { R = [0.225, -0.31, -0.24, 0.6, 0.05, -0.02]; }
    if (a === 'hold' || a === 'lift') { const k = Math.sin(t * 6) * 0.008; L = [-0.15, -0.3 + k, -0.34, 0.75, -0.15, 0]; R = [0.15, -0.3 - k, -0.34, 0.75, 0.15, 0]; if (a === 'lift') { const s = Math.sin(t * 4) * 0.02; L[1] += s; R[1] += s; L[2] = -0.2; R[2] = -0.2; L[3] = 0.4; R[3] = 0.4; } }
    if (a === 'tray') { L = [-0.2, -0.36, -0.27, 0.5, -0.1, 0]; R = [0.2, -0.36, -0.27, 0.5, 0.1, 0]; this.tray.position.set(0, -0.37 + walkY, -0.62); this.tray.rotation.set(0.04, 0, 0); }
    if (a === 'eat') { const k = (Math.sin(t * 5) * 0.5 + 0.5); L = [-0.2, -0.37, -0.27, 0.5, -0.1, 0]; R = [0.12 - k * 0.04, -0.3 + k * 0.18, -0.3 - k * 0.12, 0.8 + k * 0.5, 0.1, 0]; this.tray.position.set(-0.05, -0.4, -0.58); }
    if (a === 'mop') { const s = Math.sin(t * 3.2); L = [-0.12, -0.3, -0.38, 0.62, -0.1, 0]; R = [0.16 + s * 0.05, -0.2, -0.48, 0.85, 0.1, 0]; this.mop.position.set(0.02 + s * 0.2, -0.25, -0.9); this.mop.rotation.set(0.6, 0, s * 0.3); }
    if (a === 'paper') { L = [-0.12, -0.24, -0.4, 0.7, -0.15, 0]; R = [0.12, -0.24, -0.4, 0.7, 0.15, 0]; this.paper.position.set(0, -0.2, -0.6); this.paper.rotation.set(0.6, 0, 0); }
    if (a === 'shim') { const k = Math.sin(t * 25) * 0.004; R = [0.1, -0.16 + k, -0.5, 0.95, 0.05, 0]; }
    const set = (arm, v) => {
      arm.position.x = damp(arm.position.x, v[0], 14, dt); arm.position.y = damp(arm.position.y, v[1], 14, dt); arm.position.z = damp(arm.position.z, v[2], 14, dt);
      arm.rotation.x = damp(arm.rotation.x, v[3], 14, dt); arm.rotation.y = damp(arm.rotation.y, v[4], 14, dt); arm.rotation.z = damp(arm.rotation.z, v[5], 14, dt);
    };
    set(this.L, L); set(this.R, R);
  }
}
