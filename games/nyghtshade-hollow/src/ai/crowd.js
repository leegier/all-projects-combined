// Background crowd: the other inmates of C-Block.  One resident per cell (45 besides the player) plus two kitchen hands live their day by the
// routine slot — standing at their cell doors for count, asleep after lights-out, at the day-room tables at free time, in the mess hall at chow,
// on the pews during chapel — so the block is never empty.  Purely visual: no AI, no shared RNG (positions come from hashes of fixed indices),
// not part of game.npcs, drawn as baked static meshes (chars/bake.js) so a resident costs a handful of draw calls and no per-frame animation.
// Bodies are the procedural Humanoid at crowd level of detail, or the glTF characters (MetaHuman exports) when the character library has any.
import * as THREE from 'three';
import { Humanoid, blobShadowTexture } from '../chars/humanoid.js';
import { characters } from '../chars/library.js';
import { bakeBody } from '../chars/bake.js';
import { hash01 } from '../util.js';
import { SLOT } from '../systems/routine.js';
import { HALL } from '../world/levels/hall.js';

const yawToward = (sx, sz, tx, tz) => Math.atan2(-(tx - sx), -(tz - sz));          // engine heading: forward = (-sin yaw, -cos yaw)
const PLAYER_CELL = 'cell-N0-7';

// ---- the pool of faces/builds ----------------------------------------------------------------------------------------------------
const SKINS = ['skinMid', 'skinLight', 'skinDark', 'skinLight', 'skinMid', 'skinOld', 'skinDark', 'skinMid'];
const HAIR = [0x2a2018, 0x1a1410, 0x3a2a1c, 0x5a4a3a, 0x8a8478, 0xc8c4bc, 0x241a12, 0x4a3426];
const SHIRTS = ['#9a5a22', '#a66524', '#8e5120', '#a2601f', '#945824', '#9c5c20'];
const PANTS = ['#8a5220', '#7a4719', '#85501f'];
export const CROWD_POOL = 16;
/** Deterministic look k of the pool: skin, hair, beard, build, height, shirt shade, tattoos, glasses — all from hashes of k. */
export function crowdLook(k) {
  const h = (a) => hash01(k * 17.31 + a * 3.77 + 0.5);
  const skin = SKINS[(k * 3 + 1) % SKINS.length];
  const L = { base: ['inmateA', 'inmateB', 'inmateC'][k % 3], skin, shirt: ['inmate', h(1) < 0.2 ? '#c9c4b4' : SHIRTS[k % SHIRTS.length]], pants: PANTS[(k + 1) % PANTS.length], scale: 0.94 + h(2) * 0.15, iris: ['#5b3a24', '#3f5a6a', '#4a6070', '#2a2a22'][k % 4], stubble: h(9) * 0.7 };
  const style = k % 6;
  if (skin === 'skinOld') { L.thin = true; L.hair = 0xc8c4bc; L.hairStyle = 'sides'; L.stoop = 0.06; L.stubble = 0; }
  else if (h(10) < 0.15) L.bald = true;
  else { L.hair = HAIR[(k * 5 + 2) % HAIR.length]; L.hairStyle = ['short', 'sides', 'slick', 'short', 'short', 'sides'][style]; }
  const hairCol = L.hair || 0x2a2018;
  if (h(3) < 0.26) L.beard = hairCol; else if (h(4) < 0.24) L.goatee = hairCol;
  if (h(5) < 0.2) L.wide = true; else if (h(6) < 0.22) L.slim = true;
  if (h(7) < 0.12) L.tattoo = true;
  if (h(8) < 0.1) L.glasses = true;
  return L;
}
const cookLook = (k) => ({ ...crowdLook(40 + k), base: 'tuck', shirt: ['inmate', '#d8d6cc'], hairnet: true, apron: true, hair: null, bald: false, beard: null, goatee: null });

// ---- what everyone does in each state ----------------------------------------------------------------------------------------------
// counts per state; the rest of the residents are elsewhere (yard, work detail, infirmary…) and not visible.
const PLAN = {
  after: { hall: 6, cellSit: 8, cellLie: 6 },                                   // count cleared, doors open
  [SLOT.Chow]: { canteen: 19, queue: 5, commissary: 2, cellSit: 3 },
  [SLOT.WorkDetail]: { hall: 4, cellSit: 6, cellLie: 4 },
  [SLOT.Yard]: { hall: 3, cellSit: 8, cellLie: 6 },
  [SLOT.FreeTime]: { hall: 21, canteen: 5, cellSit: 8, cellLie: 4 },
  [SLOT.Chapel]: { chapel: 8, library: 4, hall: 10, cellSit: 8, cellLie: 4 },
  [SLOT.Library]: { library: 4, hall: 12, cellSit: 8, cellLie: 4 },
  [SLOT.Gym]: { hall: 12, cellSit: 8, cellLie: 4 },
  [SLOT.Visitation]: { hall: 10, cellSit: 8, cellLie: 4 },
};
const FIXED = ['count', 'lights', 'lockdown'];

export class Crowd {
  constructor(game) {
    this.g = game; this.agents = []; this.members = []; this.spots = { hall: [], canteen: [], queue: [], commissary: [], library: [], chapel: [] };
    this.bakes = new Map(); this.materials = new Map(); this.plans = {}; this.state = null; this.soft = true;
    this.stats = { residents: 0, staff: 0, bakes: 0, tris: 0, bakeMs: 0 };
    this.root = new THREE.Group(); this.root.name = 'crowd'; game.world.root.add(this.root);
    this.blobGeo = new THREE.PlaneGeometry(1, 1);
    this.blobMat = new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, fog: false });
  }

  // ---- layout --------------------------------------------------------------------------------------------------------------------------
  /** Creates the residents, their stations and the per-state plans (cheap).  bake() then builds the bodies. */
  build() {
    const g = this.g, w = g.world, doors = [...(g.ctx.cellDoors || [])].sort((a, b) => a.side - b.side || a.level - b.level || a.index - b.index);
    const sleeperCells = new Set(g.npcs.filter((n) => n.sleeper).map((n) => 'cell-N0-' + n.cellIndex));       // their NPCs lie in these bunks
    const taken = g.npcs.filter((n) => n.pose === 'sit' || n.pose === 'pray' || n.pose === 'lie').map((n) => [n.pos.x, n.pos.z]);
    const free = (x, z, r = 0.55) => !taken.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < r);
    // residents: one per cell, the player's own cell excluded
    for (const d of doors) {
      if (d.id === PLAYER_CELL) continue;
      const side = d.side, back = side < 0 ? HALL.z0 : HALL.z1, front = side < 0 ? -5.5 : 5.5, cx = d.pos.x, yb = d.pos.y - 1, yaw = side < 0 ? Math.PI : 0;
      const i = this.agents.length, occupied = sleeperCells.has(d.id);
      this.agents.push({
        i, id: d.id, look: crowdLook((i * 7 + 3) % CROWD_POOL), lookIdx: (i * 7 + 3) % CROWD_POOL, seed: 11 + Math.floor(i / CROWD_POOL) * 23 + (i % 5), staff: false,
        cell: {
          stand: { x: cx, y: yb, z: front + side * 0.85, yaw, pose: 'idle', area: 'hall' },
          lie: occupied ? null : { x: cx - 0.95, y: yb + 0.44, z: back - side * 2.05, yaw, pose: 'lie', area: 'hall', seatY: 0.44 },
          sit: occupied ? null : { x: cx - 0.95, y: yb, z: back - side * 1.85, yaw, pose: 'sit', area: 'hall', sway: 0.012 },
        },
      });
    }
    this.stats.residents = this.agents.length;
    // kitchen hands
    this.cooks = [[26.9, -14.85], [32.6, -14.85]].map(([x, z], k) => {
      const a = { i: this.agents.length, id: 'cook' + k, look: cookLook(k), lookIdx: 100 + k, seed: 61 + k * 9, staff: true, station: { x, y: 0, z, yaw: Math.PI, pose: 'idle', area: 'canteen', sway: 0.006 } };
      this.agents.push(a); return a;
    });
    this.stats.staff = this.cooks.length;
    // seats
    const stools = (tx, tz, dx = 0.6, dz = 0.74) => [[tx - dx, tz + dz], [tx + dx, tz + dz], [tx - dx, tz - dz], [tx + dx, tz - dz]];
    const seat = (area, list, tx, tz, [sx, sz]) => {
      if (!free(sx, sz)) return;
      const s = { x: sx, y: 0, z: sz, yaw: yawToward(sx, sz, tx, tz), pose: 'sit', area, sway: 0.012 };
      s.collider = w.addCollider(sx - 0.2, 0, sz - 0.2, sx + 0.2, 1.4, sz + 0.2, { tag: 'crowd', sight: false, enabled: false });
      list.push(s);
    };
    for (const [tx, tz] of [[-9, -1.9], [-9, 1.9], [9, -1.9], [9, 1.9], [-6.6, 3.7], [6.6, -3.7]]) for (const p of stools(tx, tz)) seat('hall', this.spots.hall, tx, tz, p);
    for (const [tx, tz] of g.marks.tables || []) for (const p of stools(tx, tz)) seat('canteen', this.spots.canteen, tx, tz, p);
    for (const [tx, tz] of [[-34, -5.2], [-30, -6.4]]) for (const p of stools(tx, tz, 0.5, 0.79)) seat('library', this.spots.library, tx, tz, p);
    const stand = (area, list, x, z, yaw) => { const s = { x, y: 0, z, yaw, pose: 'idle', area, sway: 0.006 }; s.collider = w.addCollider(x - 0.22, 0, z - 0.22, x + 0.22, 1.9, z + 0.22, { tag: 'crowd', sight: false, enabled: false }); list.push(s); };
    for (const x of [26.4, 27.6, 28.8, 32.4, 33.6]) stand('canteen', this.spots.queue, x, -12.85, 0);            // serving line, facing the counter
    for (const z of [-7.5, -6.7]) stand('canteen', this.spots.commissary, 39.6, z, yawToward(39.6, z, 40.6, -9.6));      // waiting beside the commissary window (never in front of it)
    for (let r = 0; r < 6; r++) for (const [bz, bank] of [[4.9, 'R'], [-4.9, 'L']]) {                              // chapel pews (the left bank stops short of the font)
      if (bank === 'L' && r >= 4) continue;
      for (const dz of [-1.1, 0, 1.1]) {
        const sx = -63 + r * 1.7, sz = bz + dz;
        if (!free(sx, sz, 0.8)) continue;
        const s = { x: sx + 0.02, y: 0, z: sz, yaw: Math.PI / 2, pose: 'sit', area: 'chapel', sway: 0.008 };
        s.collider = w.addCollider(sx - 0.2, 0, sz - 0.2, sx + 0.2, 1.4, sz + 0.2, { tag: 'crowd', sight: false, enabled: false });
        this.spots.chapel.push(s);
      }
    }
    this.areas = Object.fromEntries([...w.areas.entries()]);
    // members (visuals) and plans
    for (const a of this.agents) {
      const group = new THREE.Group(); group.rotation.order = 'YXZ'; group.visible = false; group.name = 'crowd:' + a.id; this.root.add(group);
      const blob = new THREE.Mesh(this.blobGeo, this.blobMat); blob.rotation.x = -Math.PI / 2; blob.scale.set(0.95, 0.8, 1); blob.renderOrder = 2; group.add(blob);
      this.members.push({ agent: a, group, blob, meshes: [], cache: new Map(), cur: null, next: undefined, switchAt: 0, cast: false, phase: hash01(a.i * 9.1) * 6.28 });
    }
    const residents = this.agents.filter((a) => !a.staff);
    const plan = (fn) => this.agents.map((a) => (a.staff ? null : fn(a)));
    this.plans.count = plan((a) => a.cell.stand);
    this.plans.lights = plan((a) => a.cell.lie);
    this.plans.lockdown = plan((a) => a.cell.sit);
    let salt = 1;
    for (const [state, cfg] of Object.entries(PLAN)) {
      const res = new Array(this.agents.length).fill(null), order = residents.map((a) => a.i).sort((a, b) => hash01(a * 3.31 + salt) - hash01(b * 3.31 + salt));
      let k = 0;
      const take = (list, n) => { const sp = list.map((s, j) => [s, hash01(j * 5.7 + salt * 2.3)]).sort((a, b) => a[1] - b[1]).map((x) => x[0]); for (let j = 0; j < Math.min(n || 0, sp.length) && k < order.length; j++) res[order[k++]] = sp[j]; };
      take(this.spots.hall, cfg.hall); take(this.spots.canteen, cfg.canteen); take(this.spots.queue, cfg.queue); take(this.spots.commissary, cfg.commissary); take(this.spots.library, cfg.library); take(this.spots.chapel, cfg.chapel);
      for (let j = 0; j < (cfg.cellSit || 0) && k < order.length; j++) { const a = this.agents[order[k++]]; res[a.i] = a.cell.sit; }
      for (let j = 0; j < (cfg.cellLie || 0) && k < order.length; j++) { const a = this.agents[order[k++]]; res[a.i] = a.cell.lie; }
      if (state === SLOT.Chow || state === SLOT.WorkDetail) for (const c of this.cooks) res[c.i] = c.station;
      this.plans[state] = res; salt++;
    }
  }

  // ---- bodies ---------------------------------------------------------------------------------------------------------------------
  /** The body a resident is baked from: a library character (shared by everyone mapped to the same file + variant) or a procedural Humanoid of their own. */
  makeBody(a) {
    if (characters.enabled) {
      const spec = characters.specFor(a.look.base, a.seed);
      if (spec) {
        const key = `gltf:${spec.id}:${a.seed % 2}`;
        if (!this._shared) this._shared = new Map();
        if (!this._shared.has(key)) { const b = characters.create(a.look.base, { seed: a.seed, scale: 1, crowd: true }); if (b) b.setLod(1); this._shared.set(key, b); }
        const b = this._shared.get(key);
        if (b) { a.bodyKey = key; return b; }
      }
    }
    a.bodyKey = null;
    return new Humanoid(a.look, { seed: a.seed, lod: 'crowd' });
  }
  bakeKey(a, pose) { return a.bodyKey ? `${a.bodyKey}:${pose}` : `${a.lookIdx}:${a.seed}:${pose}`; }
  /** Builds every body the plans need (one body per resident, posed and baked once per pose it uses). */
  bake(progress = () => {}) {
    const t0 = performance.now();
    this.bakes.clear(); this.stats.bakes = 0; this.stats.tris = 0; this._shared = new Map();
    this.agents.forEach((a, n) => {
      const poses = new Set();
      for (const plan of Object.values(this.plans)) { const s = plan[a.i]; if (s) poses.add(s.pose); }
      const body = this.makeBody(a);
      for (const pose of poses) {
        const key = this.bakeKey(a, pose); if (this.bakes.has(key)) continue;
        body.setPose(pose); body.cur = {}; body._lie = 0; body._lean = 0; body.talking = 0; body.update(5, 0, 0, 0);       // jump straight to the pose
        const res = bakeBody(body.root, { materials: this.materials, skip: (o) => o === body.blob });
        this.bakes.set(key, res); this.stats.bakes++; this.stats.tris += res.tris;
      }
      if (!a.bodyKey) body.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      progress((n + 1) / this.agents.length);
    });
    this._shared = null;
    for (const m of this.members) { this.depart(m); m.cache.clear(); m.next = undefined; }
    for (const list of Object.values(this.spots)) for (const sp of list) { sp.occ = 0; if (sp.collider) sp.collider.enabled = false; }
    this.state = null;
    this.stats.bakeMs = performance.now() - t0; this.stats.materials = this.materials.size;
    this.update(0);                                                                      // place everyone for the current state
    this.snap();
  }

  // ---- simulation -----------------------------------------------------------------------------------------------------------------
  stateNow() {
    const g = this.g, r = g.routine, st = g.story;
    if (r.lockdown) return 'lockdown';
    const slot = r.slot, locked = (slot === SLOT.Count || slot === SLOT.LightsOut) && !st.cellsReleased;
    if (locked) return slot === SLOT.LightsOut ? 'lights' : 'count';
    if (slot === SLOT.Count || slot === SLOT.LightsOut) return 'after';
    return slot;
  }
  enter(state, T) {
    const first = this.state === null; this.state = state;
    const plan = this.plans[state] || this.plans[SLOT.FreeTime];
    this.members.forEach((m, i) => {
      const target = plan[i] || null;
      if (m.next === undefined ? target === m.cur : target === m.next) return;
      m.next = target;
      if (first || !this.soft) { m.leaveAt = T; m.switchAt = T; }
      else { m.leaveAt = T + 0.3 + hash01(i * 5.17 + state.length * 1.3) * 3; m.switchAt = T + 3.6 + hash01(i * 7.31 + state.length * 2.1) * 5; }      // everyone leaves first, then arrives: nobody shares a seat
    });
  }
  /** Apply every pending change now (tools / tests / jumps in time). */
  snap() { for (const m of this.members) if (m.next !== undefined) { this.depart(m); this.arrive(m); } }
  seatTaken(s, on) { if (s && s.collider) { s.occ = (s.occ || 0) + (on ? 1 : -1); s.collider.enabled = s.occ > 0; } }
  depart(m) {
    if (!m.cur) return;
    this.seatTaken(m.cur, false);
    for (const mesh of m.meshes) m.group.remove(mesh);
    m.meshes = []; m.cur = null; m.group.visible = false;
  }
  arrive(m) {
    const s = m.next; m.next = undefined;
    if (!s) return;
    const key = this.bakeKey(m.agent, s.pose), bake = this.bakes.get(key);
    if (!bake) return;
    let ms = m.cache.get(key);
    if (!ms) { ms = bake.parts.map((p) => { const mesh = new THREE.Mesh(p.geo, p.mat); mesh.receiveShadow = false; mesh.castShadow = false; return mesh; }); m.cache.set(key, ms); }
    for (const mesh of ms) { mesh.castShadow = m.cast; m.group.add(mesh); }
    m.meshes = ms; m.cur = s;
    m.group.position.set(s.x, s.y + (s.seatY || 0), s.z); m.group.rotation.set(0, s.yaw, 0);
    m.group.scale.setScalar(m.agent.bodyKey ? 0.95 + hash01(m.agent.i * 4.7 + 1.3) * 0.1 : 1);                  // residents that share a baked body still differ in height
    m.blob.position.y = 0.012 - (s.seatY || 0);
    this.seatTaken(s, true);
    this.show(m);
  }
  /** A resident is drawn when placed and when the area they are in is drawn. */
  show(m) { const s = m.cur, area = s && this.areas[s.area]; m.group.visible = !!s && (!area || area.visible); return m.group.visible; }
  update(dt) {
    const g = this.g, T = g.time, st = this.stateNow();
    if (st !== this.state) this.enter(st, T);
    const pl = g.player.pos;
    for (const m of this.members) {
      if (m.next !== undefined) { if (m.cur && T >= m.leaveAt) this.depart(m); if (T >= m.switchAt) this.arrive(m); }
      const s = m.cur;
      if (!this.show(m)) continue;
      const near = (s.x - pl.x) ** 2 + (s.z - pl.z) ** 2 < 144 && Math.abs(s.y - pl.y) < 4.5;
      if (near !== m.cast) { m.cast = near; for (const mesh of m.meshes) mesh.castShadow = near; }
      if (s.sway) m.group.rotation.x = Math.sin(T * 0.8 + m.phase) * s.sway;
    }
  }
  /** Residents currently shown (in an area that is drawn). */
  get visibleCount() { return this.members.reduce((n, m) => n + (m.cur && m.group.visible ? 1 : 0), 0); }
  get placedCount() { return this.members.reduce((n, m) => n + (m.cur ? 1 : 0), 0); }
}
