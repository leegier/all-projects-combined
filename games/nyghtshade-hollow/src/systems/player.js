// First-person player controller (Maddox "Ghost" Thatcher — big, slow to stop, loud when he runs).
import * as THREE from 'three';
import { clamp, damp, lerp, angleDiff } from '../util.js';

const WALK = 2.45, SPRINT = 4.5, CROUCH = 1.25;

export class Player {
  constructor(game) {
    this.game = game;
    this.pos = new THREE.Vector3(0, 0, 0);
    this.prevPos = this.pos.clone();
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.radius = 0.38;
    this.crouch = 0;               // 0..1 stance blend
    this.eyeStand = 1.86; this.eyeCrouch = 1.12;
    this.eyeCap = 9;                // low-ceiling clamp (tunnel)
    this.bobPhase = 0; this.bobAmp = 0;
    this.stepDist = 0;
    this.speed = 0;
    this.sprinting = false;
    this.noise = 0;                 // 0..1 how loud we are right now
    this.frozen = false;            // cinematic / dialogue lock
    this.stamina = 100; this.staminaLock = false; this.staminaDelay = 0;
    this.area = null;
    this.lying = 0;                 // 0..1 lying on the bunk (camera low + eyes)
    this.breath = 0;
    this.eyePos = new THREE.Vector3();
    this.prevEye = new THREE.Vector3();
    this.fovKick = 0;
    this.onStairs = false;
    this.surface = 'concrete';
    this.hidden = false;
  }
  get eyeHeight() {
    const h = lerp(this.eyeStand, this.eyeCrouch, this.crouch);
    return Math.min(h, this.eyeCap) - this.lying * 1.2;
  }
  teleport(x, y, z, yaw = null) {
    this.pos.set(x, y, z); this.prevPos.copy(this.pos); this.vel.set(0, 0, 0);
    if (yaw !== null) this.yaw = yaw;
    this.prevEye.copy(this.pos); this.prevEye.y += this.eyeHeight;
  }
  addLook(dx, dy, sens = 0.0022) {
    this.yaw -= dx * sens;
    this.pitch = clamp(this.pitch - dy * sens, -1.35, 1.35);
  }
  forward(out = new THREE.Vector3()) { return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }

  update(dt, inp, world) {
    this.prevPos.copy(this.pos);
    this.prevEye.copy(this.eyePos);
    const g = this.game;
    const locked = this.frozen || g.mode !== 'play';
    // stance
    const wantCrouch = !locked && inp.held.crouch;
    this.crouch = damp(this.crouch, wantCrouch ? 1 : 0, 10, dt);
    // movement intent
    let mx = locked ? 0 : inp.mx, my = locked ? 0 : inp.my;
    const mag = Math.hypot(mx, my);
    if (mag > 1) { mx /= mag; my /= mag; }
    const wantSprint = !locked && inp.held.sprint && my > 0.1 && !this.staminaLock && this.crouch < 0.4 && this.lying < 0.1;
    this.sprinting = wantSprint && mag > 0.1;
    let target = lerp(this.sprinting ? SPRINT : WALK, CROUCH, this.crouch);
    if (g.survival && g.survival.hunger < 12) target *= 0.85;
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const wx = (-sy * my + cy * mx), wz = (-cy * my - sy * mx);
    const tvx = wx * target, tvz = wz * target;
    const accel = mag > 0.05 ? 11 : 9;
    this.vel.x = damp(this.vel.x, tvx, accel, dt);
    this.vel.z = damp(this.vel.z, tvz, accel, dt);
    this.speed = Math.hypot(this.vel.x, this.vel.z);

    // stamina
    if (this.sprinting && this.speed > 2.5) {
      this.stamina = Math.max(0, this.stamina - 20 * dt); this.staminaDelay = 0.9;
      if (this.stamina <= 0.5) this.staminaLock = true;
    } else {
      this.staminaDelay -= dt;
      if (this.staminaDelay <= 0) this.stamina = Math.min(100, this.stamina + (this.speed < 0.3 ? 22 : 12) * dt * (g.survival && g.survival.thirst < 15 ? 0.5 : 1));
      if (this.staminaLock && this.stamina > 28) this.staminaLock = false;
    }

    // integrate with collisions (axis-separated so we slide along walls)
    const ox = this.pos.x, oz = this.pos.z;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    world.resolveCircle(this.pos, this.radius, 1.9 - this.crouch * 0.6, g.playerIgnoreTags);
    // npc soft push
    for (const n of g.npcs) {
      if (!n.alive || n.hiddenFromWorld) continue;
      const dx = this.pos.x - n.pos.x, dz = this.pos.z - n.pos.z;
      const r = this.radius + 0.32, d2 = dx * dx + dz * dz;
      if (d2 < r * r && Math.abs(this.pos.y - n.pos.y) < 1.5) {
        const d = Math.sqrt(d2) || 0.001;
        const push = r - d;
        this.pos.x += (dx / d) * push * 0.7; this.pos.z += (dz / d) * push * 0.7;
        n.pos.x -= (dx / d) * push * 0.3; n.pos.z -= (dz / d) * push * 0.3;
      }
    }
    world.resolveCircle(this.pos, this.radius, 1.9 - this.crouch * 0.6, g.playerIgnoreTags);
    // actual horizontal speed after collisions (so bobbing/footsteps stop when we're pressed on a wall)
    const adx = this.pos.x - ox, adz = this.pos.z - oz;
    const real = Math.hypot(adx, adz) / Math.max(dt, 1e-5);
    this.speed = Math.min(this.speed, real + 0.3);

    // ground following
    const gy = world.groundAt(this.pos.x, this.pos.z, this.pos.y + 0.05, 0.75);
    if (gy !== null) {
      if (gy > this.pos.y) this.pos.y = damp(this.pos.y, gy, 22, dt) + 0.0; else { this.vel.y -= 22 * dt; this.pos.y = Math.max(gy, this.pos.y + this.vel.y * dt); if (this.pos.y === gy) this.vel.y = 0; }
      if (Math.abs(gy - this.pos.y) < 0.002) this.pos.y = gy;
    } else { this.vel.y -= 22 * dt; this.pos.y += this.vel.y * dt; if (this.pos.y < -30) this.pos.y = 0; }

    // area + surface type
    const a = world.areaAt(this.pos.x, this.pos.z, this.pos.y + 1);
    if (a) { this.area = a; }
    this.surface = this.area ? (this.area.surface || 'concrete') : 'concrete';
    if (this.pos.y > 3.0 && this.area && this.area.name === 'hall') this.surface = 'metal';

    // head bob & footsteps
    const moving = this.speed > 0.4;
    const bobTarget = moving ? (this.sprinting ? 1 : 0.55 - this.crouch * 0.25) : 0;
    this.bobAmp = damp(this.bobAmp, bobTarget, 8, dt);
    this.bobPhase += this.speed * dt * (this.sprinting ? 1.5 : 1.55);
    this.breath += dt * (this.sprinting ? 2.4 : 0.9);
    this.stepDist += this.speed * dt;
    const stride = this.sprinting ? 1.7 : this.crouch > 0.5 ? 1.2 : 1.35;
    if (this.stepDist > stride && moving) {
      this.stepDist = 0;
      g.events.emit('step', { who: 'player', pos: this.pos, surface: this.surface, loud: this.sprinting ? 1 : this.crouch > 0.5 ? 0.25 : 0.6 });
    }
    // noise
    const nt = !moving ? 0 : this.sprinting ? 1 : this.crouch > 0.5 ? 0.12 : 0.42;
    this.noise = damp(this.noise, nt, 6, dt);
    this.fovKick = damp(this.fovKick, this.sprinting && this.speed > 3 ? 1 : 0, 5, dt);

    // eye
    this.eyePos.set(this.pos.x, this.pos.y + this.eyeHeight + Math.sin(this.bobPhase * 2) * 0.035 * this.bobAmp + Math.sin(this.breath) * 0.004, this.pos.z);
    this.eyePos.x += Math.cos(this.bobPhase) * 0.02 * this.bobAmp * cy;
    this.eyePos.z -= Math.cos(this.bobPhase) * 0.02 * this.bobAmp * sy * -1;
  }

  /** Writes the interpolated camera pose. */
  applyCamera(camera, alpha) {
    camera.position.lerpVectors(this.prevEye, this.eyePos, alpha);
    const roll = Math.cos(this.bobPhase) * 0.004 * this.bobAmp + this.lying * 0.0;
    camera.rotation.set(this.pitch + Math.sin(this.bobPhase * 2) * 0.003 * this.bobAmp, this.yaw, roll, 'YXZ');
    camera.fov = lerp(72, 79, this.fovKick);
    camera.updateProjectionMatrix();
  }
}
