// First-person arms (Maddox: huge, tattooed forearms with D.O.C. sleeves). Lives on camera layer 1 and is composited in its own pass.
import * as THREE from 'three';
import { TEX } from '../proc/textures.js';
import { damp, lerp } from '../util.js';

function tattooSkin() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#b98363'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(${60 + Math.random() * 0},${30},${20},${Math.random() * 0.06})`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
  g.strokeStyle = 'rgba(14,22,34,0.82)'; g.lineWidth = 2.6; g.lineCap = 'round';
  // sleeve of ink: barbed wire, skull outline, script
  for (let i = 0; i < 30; i++) { const y = 20 + i * 7; g.beginPath(); g.moveTo(0, y); for (let x = 0; x < 256; x += 16) g.lineTo(x + 8, y + (x % 32 ? 5 : -5)); g.stroke(); }
  g.fillStyle = 'rgba(14,22,34,0.85)'; g.font = 'bold 22px "Times New Roman",serif'; g.fillText('NH', 100, 90); g.font = 'italic 16px serif'; g.fillText('1106553', 80, 150);
  g.beginPath(); g.arc(150, 190, 22, 0, 6.28); g.stroke(); g.beginPath(); g.arc(142, 188, 4, 0, 6.28); g.arc(158, 188, 4, 0, 6.28); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}

export class Viewmodel {
  constructor(parent) {
    this.root = new THREE.Group();
    parent.add(this.root);
    const skin = new THREE.MeshStandardMaterial({ map: tattooSkin(), normalMap: TEX.skinMid.normalMap, normalScale: new THREE.Vector2(0.35, 0.35), roughness: 0.62, fog: false });
    const sleeve = new THREE.MeshStandardMaterial({ color: 0x8a5220, roughness: 0.95, fog: false });
    const mk = (side) => {
      const g = new THREE.Group();
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.085, 0.34, 12), sleeve); upper.position.set(0, 0.0, 0.0); upper.rotation.x = 0; g.add(upper);
      const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.32, 6, 14), skin); fore.position.set(0, -0.0, -0.3); fore.rotation.x = Math.PI / 2; g.add(fore);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.062, 14, 10), skin); hand.scale.set(1.0, 0.7, 1.35); hand.position.set(0, -0.0, -0.52); g.add(hand);
      for (let f = 0; f < 4; f++) { const fi = new THREE.Mesh(new THREE.CapsuleGeometry(0.0125, 0.05, 3, 6), skin); fi.rotation.x = Math.PI / 2; fi.position.set((f - 1.5) * 0.024, -0.012, -0.585); g.add(fi); }
      const th = new THREE.Mesh(new THREE.CapsuleGeometry(0.014, 0.05, 3, 6), skin); th.rotation.set(Math.PI / 2, 0, side * 0.5); th.position.set(-side * 0.052, -0.02, -0.53); g.add(th);
      // sleeve cuff
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.07, 0.12, 14), sleeve); cuff.rotation.x = Math.PI / 2; cuff.position.set(0, 0, -0.1); g.add(cuff);
      this.root.add(g);
      return g;
    };
    this.L = mk(-1); this.R = mk(1);
    // tray (carried)
    this.tray = new THREE.Group();
    const tr = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, 0.28), new THREE.MeshStandardMaterial({ color: 0x777c80, roughness: 0.35, metalness: 0.8, fog: false })); this.tray.add(tr);
    const food = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 0.1), new THREE.MeshStandardMaterial({ color: 0xc9b47a, roughness: 0.9, fog: false })); food.position.set(-0.08, 0.02, -0.02); this.tray.add(food);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.07, 10), new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.4, fog: false })); cup.position.set(0.12, 0.045, 0.02); this.tray.add(cup);
    this.tray.visible = false; this.root.add(this.tray);
    // mop stick
    this.mop = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.5, 6), new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.8, fog: false })); this.mop.visible = false; this.root.add(this.mop);
    this.paper = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.005, 0.28), new THREE.MeshStandardMaterial({ color: 0xd8d0b4, roughness: 0.9, fog: false })); this.paper.visible = false; this.root.add(this.paper);
    this.root.traverse((o) => o.layers.set(1));
    this.reach = 0; this.act = 'none'; this.actT = 0; this.sway = new THREE.Vector2();
    this.visible = true;
  }
  /** act: 'none' | 'reach' | 'hold' (hands working) | 'mop' | 'tray' | 'lift' | 'eat' | 'paper' | 'shim' */
  update(dt, g) {
    const p = g.player;
    this.root.visible = this.visible && g.mode !== 'title' && !(g.cine && !g.cine.showArms);
    if (!this.root.visible) return;
    this.actT += dt;
    const bob = p.bobAmp, ph = p.bobPhase;
    const sprint = p.sprinting ? 1 : 0;
    const crouch = p.crouch;
    this.sway.x = damp(this.sway.x, 0, 8, dt);
    const base = (side) => ({ x: side * 0.25, y: -0.3 + crouch * 0.03, z: -0.26 });
    this.reach = damp(this.reach, this.act === 'reach' ? 1 : 0, 9, dt);
    const L = this.L, R = this.R;
    const walkX = Math.sin(ph) * 0.02 * bob, walkY = Math.abs(Math.sin(ph)) * 0.02 * bob;
    const breath = Math.sin(p.breath) * 0.003;
    // idle posture: forearms low, angled slightly inward
    const setArm = (arm, side, tx, ty, tz, rx, ry, rz) => {
      arm.position.x = damp(arm.position.x, tx, 14, dt); arm.position.y = damp(arm.position.y, ty, 14, dt); arm.position.z = damp(arm.position.z, tz, 14, dt);
      arm.rotation.x = damp(arm.rotation.x, rx, 14, dt); arm.rotation.y = damp(arm.rotation.y, ry, 14, dt); arm.rotation.z = damp(arm.rotation.z, rz, 14, dt);
    };
    const swing = Math.cos(ph) * 0.12 * bob * (1 + sprint);
    let la = [-0.27 + walkX, -0.34 + walkY + breath, -0.18 + swing * 0.5, 0.15 + swing * 0.4, 0.22, 0.05], ra = [0.27 - walkX, -0.34 + walkY + breath, -0.18 - swing * 0.5, 0.15 - swing * 0.4, -0.22, -0.05];
    const a = this.act, t = this.actT;
    this.tray.visible = a === 'tray' || a === 'eat'; this.mop.visible = a === 'mop'; this.paper.visible = a === 'paper' || a === 'shim' ? a === 'paper' : false;
    if (this.reach > 0.01 && (a === 'reach')) { ra = [lerp(ra[0], 0.12, this.reach), lerp(ra[1], -0.16, this.reach), lerp(ra[2], -0.5, this.reach), lerp(ra[3], 0.55, this.reach), lerp(ra[4], -0.05, this.reach), 0]; }
    if (a === 'hold' || a === 'lift') { const k = Math.sin(t * 6) * 0.01; la = [-0.16, -0.28 + k, -0.38, 0.5, 0.25, 0]; ra = [0.16, -0.28 - k, -0.38, 0.5, -0.25, 0]; if (a === 'lift') { const s = Math.sin(t * 4) * 0.02; la[1] += s; ra[1] += s; la[2] = -0.2; ra[2] = -0.2; } }
    if (a === 'tray') { la = [-0.2, -0.36, -0.24, 0.35, 0.2, 0]; ra = [0.2, -0.36, -0.24, 0.35, -0.2, 0]; this.tray.position.set(0, -0.34 + walkY, -0.55); this.tray.rotation.set(0.05, 0, 0); }
    if (a === 'eat') { const k = (Math.sin(t * 5) * 0.5 + 0.5); la = [-0.2, -0.36, -0.24, 0.35, 0.2, 0]; ra = [0.1 - k * 0.05, -0.3 + k * 0.2, -0.3 - k * 0.1, 0.6 + k * 0.5, -0.1, 0]; this.tray.position.set(-0.05, -0.38, -0.5); }
    if (a === 'mop') { const s = Math.sin(t * 3.2); la = [-0.14, -0.3, -0.34, 0.5, 0.0, 0]; ra = [0.16 + s * 0.05, -0.18, -0.46, 0.7, -0.1, 0]; this.mop.position.set(0.02 + s * 0.2, -0.25, -0.85); this.mop.rotation.set(0.6, 0, s * 0.3); }
    if (a === 'paper') { la = [-0.12, -0.2, -0.38, 0.5, 0.2, 0]; ra = [0.12, -0.2, -0.38, 0.5, -0.2, 0]; this.paper.position.set(0, -0.2, -0.58); this.paper.rotation.set(0.6, 0, 0); }
    if (a === 'shim') { const k = Math.sin(t * 25) * 0.004; ra = [0.1, -0.12 + k, -0.55, 0.75, -0.1, 0]; }
    setArm(L, -1, ...la); setArm(R, 1, ...ra);
  }
}
