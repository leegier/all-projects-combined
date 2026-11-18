// Guard AI — patrol / look-around / suspicion meter / chase / search / return. Vision is a cone with line-of-sight;
// guards only react to what the player is *not allowed* to be doing (restricted area, sprinting in sight, noise).
import * as THREE from 'three';
import { NPC } from './npc.js';
import { angleDiff, clamp, dampAngle } from '../util.js';
import { coneBeam } from '../core/gfx.js';

const _eye = new THREE.Vector3();

export class Guard extends NPC {
  constructor(game, cfg) {
    super(game, { ...cfg, role: 'guard', faction: 'Guards', look: cfg.look || 'guard', walkSpeed: cfg.walkSpeed || 1.25 });
    this.route = cfg.route || [];          // [{node, wait, look: yaw|null}]
    this.routeIdx = 0;
    this.fov = cfg.fov || 1.9;             // full cone in radians (~109°)
    this.range = cfg.range || 15;
    this.detect = 0;                       // 0..1
    this.mode = 'patrol';                  // patrol | wait | suspicious | chase | search | distracted | escort | station
    this.modeT = 0;
    this.lastSeen = new THREE.Vector3();
    this.distractedUntil = 0;
    this.station = cfg.station || null;    // {yaw} if standing post
    this.canChase = cfg.canChase !== false;
    this.catchDist = 1.15;
    this.sawPlayerRestricted = false;
    this.catchCooldown = 0;
    this.nextWait = 0;
    if (!this.station) this.nextPatrol();
    else { this.mode = 'station'; this.targetYaw = this.station.yaw; }
  }
  eyePos() { return _eye.set(this.pos.x, this.pos.y + 1.62, this.pos.z); }
  nextPatrol() {
    if (!this.route.length) return;
    const r = this.route[this.routeIdx % this.route.length];
    this.mode = 'patrol';
    this.goTo(r.node, { speed: this.walkSpeed, onArrive: () => {
      this.mode = 'wait'; this.modeT = r.wait || 1.5; this.targetYaw = r.look !== undefined && r.look !== null ? r.look : undefined;
      this.lookSweep = r.sweep || 0;
      this.routeIdx++;
    } });
  }
  /** 0..1 how well the guard could see the player right now (ignores permission). */
  visionOf(pl) {
    const ex = this.pos.x, ez = this.pos.z;
    const dx = pl.pos.x - ex, dz = pl.pos.z - ez, d = Math.hypot(dx, dz);
    if (d > this.range) return 0;
    const ang = Math.atan2(-dx, -dz);
    const off = Math.abs(angleDiff(this.yaw, ang));
    const inCone = off < this.fov / 2;
    const pe = pl.eyePos;
    const e = this.eyePos();
    if (Math.abs(pl.pos.y - this.pos.y) > 3.0) return 0;
    if (this.game.world.blocked(e.x, e.y, e.z, pe.x, pe.y - 0.1, pe.z)) return 0;
    let v = inCone ? 1 : 0;
    // hearing (no cone): loud movement close by
    const hear = d < 8 ? clamp(pl.noise * (1 - d / 8) * 1.1 - 0.15, 0, 1) : 0;
    v = Math.max(v * (1 - d / this.range) ** 0.7, hear * 0.7);
    const crouchF = 1 - pl.crouch * 0.45;
    const light = this.game.lightLevelAt(pl.pos);
    return clamp(v * crouchF * (0.55 + light * 0.6), 0, 1);
  }
  update(dt) {
    const g = this.game, pl = g.player;
    this.modeT -= dt; this.catchCooldown -= dt;
    const t = g.time;
    if (this.mode === 'distracted') {
      this.detect = 0;
      if (t > this.distractedUntil) { this.mode = this.station ? 'station' : 'patrol'; if (!this.station) this.nextPatrol(); }
      super.update(dt); return;
    }
    if (this.mode === 'escort' || this.frozenAI) { super.update(dt); return; }
    const vis = g.mode === 'play' && !pl.frozen ? this.visionOf(pl) : 0;
    const restricted = g.isRestricted(pl);
    const suspiciousAct = pl.sprinting && vis > 0.2;
    let rate = 0;
    if (restricted) rate = 1.35;
    else if (suspiciousAct) rate = 0.3;
    else if (g.alert.level >= 2) rate = 0.9;
    if (vis > 0 && rate > 0) { this.detect = clamp(this.detect + vis * rate * dt * 1.5, 0, 1.0); this.lastSeen.copy(pl.pos); }
    else this.detect = clamp(this.detect - dt * (this.mode === 'chase' ? 0.05 : 0.35), 0, 1);

    switch (this.mode) {
      case 'patrol': case 'wait': case 'station':
        if (this.mode === 'wait') {
          if (this.lookSweep) this.targetYaw = (this.targetYaw ?? this.yaw) + Math.sin(this.modeT * 2.5) * 0.0 ;
          if (this.modeT <= 0) this.nextPatrol();
        }
        if (this.detect > 0.4 && this.mode !== 'station' || (this.mode === 'station' && this.detect > 0.4)) {
          this.prevMode = this.mode; this.mode = 'suspicious'; this.modeT = 2.2; this.stop();
          g.events.emit('guardSuspicious', this);
        }
        break;
      case 'suspicious':
        this.facePoint(this.lastSeen.x, this.lastSeen.z);
        if (this.detect >= 1 && this.canChase) { this.startChase(); }
        else if (this.modeT <= 0 && this.detect < 0.3) { this.mode = this.station ? 'station' : 'patrol'; if (this.station) this.targetYaw = this.station.yaw; else this.nextPatrol(); }
        break;
      case 'chase':
        this.chaseStep(dt, vis);
        break;
      case 'search':
        if (this.modeT <= 0) { this.mode = this.station ? 'station' : 'patrol'; if (this.station) { this.goTo(this.station.node, { onArrive: () => { this.targetYaw = this.station.yaw; } }); } else this.nextPatrol(); g.events.emit('guardGaveUp', this); }
        else if (this.detect > 0.5) this.startChase();
        break;
    }
    super.update(dt);
  }
  startChase() {
    this.mode = 'chase'; this.modeT = 0; this.chaseRepath = 0; this.lostT = 0;
    this.game.alert.raise(55, 'guard spotted you');
    this.game.events.emit('chaseStart', this);
  }
  chaseStep(dt, vis) {
    const g = this.game, pl = g.player;
    this.moveSpeed = 3.6;
    this.chaseRepath -= dt;
    const d = Math.hypot(pl.pos.x - this.pos.x, pl.pos.z - this.pos.z);
    if (vis > 0.15) { this.lostT = 0; this.lastSeen.copy(pl.pos); } else this.lostT += dt;
    if (d < this.catchDist && Math.abs(pl.pos.y - this.pos.y) < 1.5 && this.catchCooldown <= 0) { this.stop(); g.arrest(this); return; }
    if (this.chaseRepath <= 0) {
      this.chaseRepath = 0.4;
      const tgt = vis > 0.15 || d < 12 ? { x: pl.pos.x, z: pl.pos.z, y: pl.pos.y } : { x: this.lastSeen.x, z: this.lastSeen.z, y: this.lastSeen.y };
      // direct line if clear
      if (d < 7 && this.game.nav.walkable(this.pos.x, this.pos.z, tgt.x, tgt.z, this.pos.y, 0.3)) { this.path = [{ x: tgt.x, z: tgt.z, y: tgt.y }]; this.pathIdx = 0; this.moving = true; this.moveSpeed = 3.6; }
      else this.goTo(tgt, { speed: 3.6 });
    }
    g.alert.raise(0, 'chase');
    if (this.lostT > 5.5) { this.mode = 'search'; this.modeT = 7; this.detect = 0.2; this.goTo({ x: this.lastSeen.x, z: this.lastSeen.z, y: this.lastSeen.y }, { speed: 2.0 }); }
  }
  /** Bribed / otherwise occupied. */
  distract(seconds) { this.mode = 'distracted'; this.distractedUntil = this.game.time + seconds; this.detect = 0; this.stop(); }
}

/** Ceiling camera with a sweeping vision cone. Detection raises a full alarm. */
export class SecurityCam {
  constructor(game, { head, pos, baseYaw, sweep = 0.95, range = 10, fov = 0.9, area = 'records' }) {
    Object.assign(this, { game, head, pos: pos.clone(), baseYaw, sweep, range, fov, area });
    this.enabled = true; this.detect = 0; this.yaw = baseYaw; this.alarmed = false;
    // visual cone (soft additive beam; brightens + reddens as detection rises)
    this.cone = coneBeam(range, fov / 2, 0xffd070, 0.0);
    head.add(this.cone);
  }
  /** Would the sweeping cone cover (x,z) `dt` seconds from now? (used by the playtest bot) */
  covers(x, z, dt = 0) {
    const t = this.game.time + dt, yaw = this.baseYaw + Math.sin(t * 0.4) * this.sweep;
    const dx = x - this.pos.x, dz = z - this.pos.z, d = Math.hypot(dx, dz);
    if (d > this.range + 0.8) return false;
    return Math.abs(angleDiff(yaw, Math.atan2(-dx, -dz))) < this.fov / 2 + 0.12;
  }
  update(dt) {
    const g = this.game;
    const t = g.time;
    this.yaw = this.baseYaw + Math.sin(t * 0.4) * this.sweep;
    this.head.rotation.y = this.yaw;
    this.head.rotation.x = -0.28;
    const pl = g.player;
    let vis = 0;
    if (this.enabled && g.mode === 'play' && pl.area && pl.area.name === this.area) {
      const dx = pl.pos.x - this.pos.x, dz = pl.pos.z - this.pos.z, d = Math.hypot(dx, dz);
      const ang = Math.atan2(-dx, -dz);
      const off = Math.abs(angleDiff(this.yaw, ang));
      if (d < this.range && off < this.fov / 2 && !g.world.blocked(this.pos.x, this.pos.y, this.pos.z, pl.eyePos.x, pl.eyePos.y - 0.2, pl.eyePos.z)) vis = (1 - d / this.range) * 0.6 + 0.4 - pl.crouch * 0.2;
    }
    this.detect = Math.max(0, Math.min(1, this.detect + (vis > 0 ? vis * dt * 0.5 : -dt * 0.5)));
    const u = this.cone.material.uniforms;
    u.intensity.value = this.enabled ? 0.028 + this.detect * 0.16 : 0;
    u.color.value.setHex(this.detect > 0.45 ? 0xff3a2a : 0xffd070);
    if (this.detect >= 1 && !this.alarmed) { this.alarmed = true; g.cameraAlarm(this); }
    if (this.detect < 0.2) this.alarmed = false;
  }
}
