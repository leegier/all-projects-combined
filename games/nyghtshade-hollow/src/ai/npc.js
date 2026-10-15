// NPCs: characters that live in the world, walk the nav graph, sit/stand/work, and look at the player when close.
import * as THREE from 'three';
import { Humanoid } from '../chars/humanoid.js';
import { damp, dampAngle, angleDiff, clamp } from '../util.js';

export class NPC {
  constructor(game, cfg) {
    this.game = game;
    this.id = cfg.id; this.name = cfg.name || cfg.id; this.role = cfg.role || 'inmate';
    this.faction = cfg.faction || 'InmatesGeneral';
    this.pos = new THREE.Vector3(cfg.x, cfg.y || 0, cfg.z);
    this.home = this.pos.clone();
    this.yaw = cfg.yaw || 0;
    this.alive = true; this.hiddenFromWorld = false;
    this.body = new Humanoid(cfg.look || 'inmateA', { seed: cfg.seed || (this.id.length * 7 + 3), scale: cfg.scale });
    this.root = this.body.root;
    this.pose = cfg.pose || 'idle';
    this.body.setPose(this.pose);
    this.speed = 0;
    this.walkSpeed = cfg.walkSpeed || 1.35;
    this.path = []; this.pathIdx = 0; this.onArrive = null; this.moving = false;
    this.lookTarget = null;           // THREE.Vector3 or null
    this.talkTimer = 0;
    this.dialogue = cfg.dialogue || null;
    this.interactable = null;
    this.state = 'idle';
    this.waitTimer = 0;
    this.mount = cfg.mount || null;   // {y} offset for sitting on a stool/bench
    this.seatOffsetY = cfg.seatY || 0;
    this.root.position.copy(this.pos); this.root.rotation.y = this.yaw;
    game.world.root.add(this.root);
    this.area = null;
  }
  setPose(p, seatY = 0) { this.pose = p; this.body.setPose(p); this.seatOffsetY = seatY; }
  teleport(x, z, y = null) { this.pos.x = x; this.pos.z = z; if (y !== null) this.pos.y = y; this.path = []; this.moving = false; }
  /** Walk to a nav node name or {x,z}. */
  goTo(goal, { speed = this.walkSpeed, onArrive = null } = {}) {
    const p = this.game.nav.path(this.pos.x, this.pos.z, this.pos.y, goal);
    this.path = p; this.pathIdx = 0; this.moving = p.length > 0; this.moveSpeed = speed; this.onArrive = onArrive;
    if (!p.length && onArrive) onArrive();
    return p.length > 0;
  }
  stop() { this.path = []; this.moving = false; }
  faceYaw(y) { this.targetYaw = y; }
  facePoint(x, z) { this.targetYaw = Math.atan2(-(x - this.pos.x), -(z - this.pos.z)); }
  /** Heading convention matches the player: forward = (-sin yaw, -cos yaw). */
  update(dt) {
    const g = this.game, w = g.world;
    let spd = 0;
    if (this.moving && this.path.length) {
      const tgt = this.path[this.pathIdx];
      const dx = tgt.x - this.pos.x, dz = tgt.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.25) {
        this.pathIdx++;
        if (this.pathIdx >= this.path.length) { this.moving = false; this.path = []; const cb = this.onArrive; this.onArrive = null; if (cb) cb(this); }
      } else {
        const want = Math.atan2(-dx, -dz);
        this.yaw = dampAngle(this.yaw, want, 9, dt);
        const blocked = this.blockedByDoor(tgt);
        if (!blocked) {
          const facingErr = Math.abs(angleDiff(this.yaw, want));
          spd = this.moveSpeed * clamp(1 - facingErr * 0.8, 0.15, 1);
          this.pos.x += (dx / d) * spd * dt; this.pos.z += (dz / d) * spd * dt;
        }
      }
    } else if (this.targetYaw !== undefined) {
      this.yaw = dampAngle(this.yaw, this.targetYaw, 6, dt);
    }
    if (spd > 0) w.resolveCircle(this.pos, 0.3, 1.7, g.npcIgnoreTags);
    // ground
    const gy = w.groundAt(this.pos.x, this.pos.z, this.pos.y + 0.05, 0.75);
    if (gy !== null) this.pos.y = damp(this.pos.y, gy, 20, dt);
    this.speed = spd;
    // head tracking
    const pl = g.player;
    let lookRel = 0, pitchRel = 0;
    const toX = pl.pos.x - this.pos.x, toZ = pl.pos.z - this.pos.z, dist = Math.hypot(toX, toZ);
    const target = this.lookTarget || (dist < 5.5 && this.role !== 'guard' ? pl.eyePos : null);
    if (target) {
      const dxx = target.x - this.pos.x, dzz = target.z - this.pos.z;
      const ang = Math.atan2(-dxx, -dzz);
      lookRel = angleDiff(this.yaw, ang);
      pitchRel = -Math.atan2(target.y - (this.pos.y + 1.6), Math.hypot(dxx, dzz)) * 0.6;
      if (Math.abs(lookRel) > 1.6) { lookRel = 0; pitchRel = 0; }
    }
    this.body.talking = this.talkTimer > 0 ? 1 : 0; this.talkTimer = Math.max(0, this.talkTimer - dt);
    this.body.update(dt, spd, lookRel, pitchRel);
    this.root.position.set(this.pos.x, this.pos.y + this.seatOffsetY, this.pos.z);
    this.root.rotation.y = this.yaw;
    // shadows only for nearby characters
    const near = dist < 16;
    if (near !== this._cast) { this._cast = near; this.body.setCast(near); }
    this.root.visible = !this.hiddenFromWorld && !!(this.area ? this.area.visible : true);
  }
  blockedByDoor(tgt) {
    // pause if a closed, auto-opening door is right ahead (doors open as we approach)
    const ahead = { x: this.pos.x + Math.sin(-this.yaw) * 0, z: this.pos.z };
    return false;
  }
  say(text, secs = 2.5) { this.talkTimer = secs; }
}
