// World: areas (visibility groups), AABB colliders with a spatial hash, walkable surfaces/ramps,
// line-of-sight queries, doors, interactables and the fixture registry used by the light rig.
import * as THREE from 'three';
import { Emitter, damp, clamp } from '../util.js';

const CELL = 6;
const key = (cx, cz) => cx * 73856093 ^ cz * 19349663;

export class World extends Emitter {
  constructor(scene) {
    super();
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.name = 'world';
    scene.add(this.root);
    this.areas = new Map();
    this.colliders = [];
    this.grid = new Map();
    this.surfaces = [];
    this.doors = new Map();
    this.interactables = [];
    this.fixtures = [];
    this.waypoints = new Map();
    this.stamp = 1;
    this.volumes = [];
  }

  // ---- areas ---------------------------------------------------------------------------------
  /** bounds = [x0,z0,x1,z1], yRange = [yMin,yMax]. neighbors = areas that must stay visible too. */
  addArea(name, bounds, { yRange = [-1, 12], neighbors = [], ambient = null, reverb = 0.3, tag = 'indoor' } = {}) {
    const group = new THREE.Group();
    group.name = 'area:' + name;
    this.root.add(group);
    const a = { name, group, bounds, yRange, neighbors, ambient, reverb, tag, visible: true, interior: null };
    this.areas.set(name, a);
    return a;
  }
  areaAt(x, z, y = 0) {
    let best = null;
    for (const a of this.areas.values()) {
      const [x0, z0, x1, z1] = a.bounds;
      if (x >= x0 && x <= x1 && z >= z0 && z <= z1 && y >= a.yRange[0] && y <= a.yRange[1]) {
        if (!best || (x1 - x0) * (z1 - z0) < (best.bounds[2] - best.bounds[0]) * (best.bounds[3] - best.bounds[1])) best = a;
      }
    }
    return best;
  }
  setActiveArea(name) {
    const act = new Set();
    const add = (n, depth) => {
      if (act.has(n) || !this.areas.has(n)) return;
      act.add(n);
      if (depth > 0) this.areas.get(n).neighbors.forEach((m) => add(m, depth - 1));
    };
    add(name, 1);
    for (const a of this.areas.values()) {
      const v = act.has(a.name);
      if (v !== a.visible) { a.visible = v; a.group.visible = v; }
    }
    this.activeAreas = act;
  }

  // ---- colliders -----------------------------------------------------------------------------
  addCollider(x0, y0, z0, x1, y1, z1, { tag = 'wall', sight = true, enabled = true } = {}) {
    const c = { id: this.colliders.length, x0: Math.min(x0, x1), y0: Math.min(y0, y1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), y1: Math.max(y0, y1), z1: Math.max(z0, z1), tag, sight, enabled, stamp: 0 };
    this.colliders.push(c);
    const cx0 = Math.floor(c.x0 / CELL), cx1 = Math.floor(c.x1 / CELL), cz0 = Math.floor(c.z0 / CELL), cz1 = Math.floor(c.z1 / CELL);
    for (let cx = cx0; cx <= cx1; cx++) for (let cz = cz0; cz <= cz1; cz++) {
      const k = key(cx, cz);
      let arr = this.grid.get(k);
      if (!arr) this.grid.set(k, (arr = []));
      arr.push(c);
    }
    return c;
  }
  _near(x0, z0, x1, z1) {
    const out = [];
    const st = ++this.stamp;
    for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++) for (let cz = Math.floor(z0 / CELL); cz <= Math.floor(z1 / CELL); cz++) {
      const arr = this.grid.get(key(cx, cz));
      if (!arr) continue;
      for (const c of arr) if (c.stamp !== st) { c.stamp = st; out.push(c); }
    }
    return out;
  }
  /** Push a circle (feet y, height h) out of colliders. Returns true if it moved. Mutates pos.x/z. */
  resolveCircle(pos, r, h = 1.8, ignoreTags = null) {
    let moved = false;
    for (let it = 0; it < 3; it++) {
      let any = false;
      for (const c of this._near(pos.x - r, pos.z - r, pos.x + r, pos.z + r)) {
        if (!c.enabled || (ignoreTags && ignoreTags.has(c.tag))) continue;
        if (pos.y + h <= c.y0 + 0.05 || pos.y + 0.35 >= c.y1) continue;
        const nx = clamp(pos.x, c.x0, c.x1), nz = clamp(pos.z, c.z0, c.z1);
        let dx = pos.x - nx, dz = pos.z - nz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2), push = r - d;
          pos.x += (dx / d) * push; pos.z += (dz / d) * push;
        } else {
          // centre inside the box: exit by shortest axis
          const l = pos.x - c.x0, rr = c.x1 - pos.x, t = pos.z - c.z0, b = c.z1 - pos.z;
          const m = Math.min(l, rr, t, b);
          if (m === l) pos.x = c.x0 - r; else if (m === rr) pos.x = c.x1 + r; else if (m === t) pos.z = c.z0 - r; else pos.z = c.z1 + r;
        }
        any = moved = true;
      }
      if (!any) break;
    }
    return moved;
  }
  /** True if a segment is blocked by a sight-blocking collider (3D). */
  blocked(ax, ay, az, bx, by, bz) {
    for (const c of this._near(Math.min(ax, bx) - 0.1, Math.min(az, bz) - 0.1, Math.max(ax, bx) + 0.1, Math.max(az, bz) + 0.1)) {
      if (!c.enabled || !c.sight) continue;
      if (segBox(ax, ay, az, bx, by, bz, c)) return true;
    }
    return false;
  }

  // ---- surfaces ------------------------------------------------------------------------------
  /** Flat floor (yA) or ramp along `axis` from yA at min coord to yB at max coord. */
  addSurface(x0, z0, x1, z1, yA, yB = yA, axis = 'x', fn = null) {
    const s = { x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), yA, yB, axis, fn };
    this.surfaces.push(s);
    return s;
  }
  surfaceY(s, x, z) {
    if (s.fn) return s.fn(x, z);
    if (s.yA === s.yB) return s.yA;
    const t = s.axis === 'x' ? (x - s.x0) / (s.x1 - s.x0) : (z - s.z0) / (s.z1 - s.z0);
    return s.yA + (s.yB - s.yA) * clamp(t, 0, 1);
  }
  /** Highest walkable surface at (x,z) that is not more than `maxUp` above yRef. null if none. */
  groundAt(x, z, yRef, maxUp = 0.7) {
    let best = null;
    for (const s of this.surfaces) {
      if (x < s.x0 || x > s.x1 || z < s.z0 || z > s.z1) continue;
      const y = this.surfaceY(s, x, z);
      if (y <= yRef + maxUp && (best === null || y > best)) best = y;
    }
    return best;
  }

  // ---- registry ------------------------------------------------------------------------------
  addInteractable(def) {
    const it = Object.assign({ radius: 2.2, enabled: true, priority: 0, hold: 0, label: 'Use', height: 1.2 }, def);
    it.pos = def.pos.clone ? def.pos.clone() : new THREE.Vector3(...def.pos);
    this.interactables.push(it);
    return it;
  }
  removeInteractable(it) { const i = this.interactables.indexOf(it); if (i >= 0) this.interactables.splice(i, 1); }
  addFixture(f) {
    const fx = Object.assign({ color: 0xdfeee8, intensity: 18, range: 14, on: 1, flicker: 0, shadow: false, area: null, warmth: 0 }, f);
    fx.pos = f.pos.clone ? f.pos.clone() : new THREE.Vector3(...f.pos);
    this.fixtures.push(fx);
    return fx;
  }
  addWaypoint(name, x, z, y = 0) { this.waypoints.set(name, { name, x, z, y, links: new Set() }); }
  link(a, b) { this.waypoints.get(a).links.add(b); this.waypoints.get(b).links.add(a); }

  update(dt) {
    for (const d of this.doors.values()) d.update(dt);
  }
}

/** Segment vs AABB (slab test). */
function segBox(ax, ay, az, bx, by, bz, c) {
  let t0 = 0, t1 = 1;
  const d = [bx - ax, by - ay, bz - az], o = [ax, ay, az], lo = [c.x0, c.y0, c.z0], hi = [c.x1, c.y1, c.z1];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) { if (o[i] < lo[i] || o[i] > hi[i]) return false; }
    else {
      let a = (lo[i] - o[i]) / d[i], b = (hi[i] - o[i]) / d[i];
      if (a > b) { const t = a; a = b; b = t; }
      if (a > t0) t0 = a;
      if (b < t1) t1 = b;
      if (t0 > t1) return false;
    }
  }
  return true;
}

// ------------------------------------------------------------------------------------------------
// Doors
// ------------------------------------------------------------------------------------------------
export class Door extends Emitter {
  /**
   * type 'slide': group slides along `axis` ('x'|'z') by `travel` metres.
   * type 'swing': group rotates about Y by `angle`.
   */
  constructor(world, id, { group, collider, type = 'slide', axis = 'x', travel = 1.0, angle = 1.7, speed = 1.6, locked = false, requires = null, pos, sound = 'door', label = 'door', auto = false, sightWhenOpen = false }) {
    super();
    Object.assign(this, { world, id, group, collider, type, axis, travel, angle, speed, locked, requires, sound, label, auto, sightWhenOpen });
    this.pos = pos.clone ? pos.clone() : new THREE.Vector3(...pos);
    this.open = 0; this.target = 0;
    this.home = group.position.clone();
    this.homeRot = group.rotation.y;
    this.sign = 1;
    world.doors.set(id, this);
  }
  setOpen(v, silent = false) {
    const t = v ? 1 : 0;
    if (t === this.target) return;
    this.target = t;
    if (!silent) this.world.emit('door', this, t);
  }
  get isOpen() { return this.open > 0.6; }
  update(dt) {
    if (this.open === this.target) return;
    const step = (this.type === 'slide' ? this.speed / this.travel : this.speed / this.angle) * dt;
    this.open = this.open < this.target ? Math.min(this.target, this.open + step) : Math.max(this.target, this.open - step);
    const e = this.open * this.open * (3 - 2 * this.open);
    if (this.type === 'slide') {
      if (this.axis === 'x') this.group.position.x = this.home.x + this.sign * this.travel * e;
      else this.group.position.z = this.home.z + this.sign * this.travel * e;
    } else {
      this.group.rotation.y = this.homeRot + this.sign * this.angle * e;
    }
    if (this.collider) this.collider.enabled = this.open < 0.55;
    if (this.collider && this.sightWhenOpen === false) this.collider.sight = this.open < 0.3;
  }
}
