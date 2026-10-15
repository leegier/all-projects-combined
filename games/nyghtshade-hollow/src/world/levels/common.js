// Shared level helpers: rooms (floor/ceiling/4 walls with openings), doors, light fixtures.
import * as THREE from 'three';
import { Batch } from '../geo.js';
import { Door } from '../world.js';
import { wall, hangingTube, barsRow } from '../props.js';
import { glowSprite } from '../../core/gfx.js';

/**
 * Builds an enclosed room whose *interior* is [x0,x1]x[z0,z1]. Walls are 0.3 m thick, outside the interior.
 * ops: { n: [[from,to,h],..], s, e, w } openings per wall (coordinates along that wall).
 */
export function room(B, world, { x0, z0, x1, z1, y0 = 0, h = 3.4, floor = 'floor', ceil = 'ceiling', wallMat = 'wallGrey', ops = {}, thick = 0.3, floorSurface = true, ceilY = null, vBase = null, skip = [] }) {
  const ceilingY = ceilY === null ? y0 + h : ceilY;
  if (floor) B.slab(x0 - thick, y0 - 0.4, z0 - thick, x1 + thick, y0, z1 + thick, floor);
  if (floorSurface) world.addSurface(x0 - thick, z0 - thick, x1 + thick, z1 + thick, y0);
  if (ceil) B.slab(x0 - thick, ceilingY, z0 - thick, x1 + thick, ceilingY + 0.4, z1 + thick, ceil);
  const opt = { y0, y1: ceilingY, thick, mat: wallMat, vBase: vBase === null ? y0 : vBase };
  if (!skip.includes('n')) wall(B, world, { ...opt, dir: 'x', at: z0 - thick / 2, from: x0 - thick, to: x1 + thick, openings: ops.n || [] });
  if (!skip.includes('s')) wall(B, world, { ...opt, dir: 'x', at: z1 + thick / 2, from: x0 - thick, to: x1 + thick, openings: ops.s || [] });
  if (!skip.includes('w')) wall(B, world, { ...opt, dir: 'z', at: x0 - thick / 2, from: z0, to: z1, openings: ops.w || [] });
  if (!skip.includes('e')) wall(B, world, { ...opt, dir: 'z', at: x1 + thick / 2, from: z0, to: z1, openings: ops.e || [] });
  // baseboard grime band
  B.box((x0 + x1) / 2, y0 + 0.05, z0 + 0.04, x1 - x0, 0.1, 0.08, 'steel');
  B.box((x0 + x1) / 2, y0 + 0.05, z1 - 0.04, x1 - x0, 0.1, 0.08, 'steel');
}

/**
 * Hinged steel door in a wall. wallDir 'x' = wall runs along X (door faces ±Z). `at` = wall centre line.
 * Returns the Door. `swing` = +1/-1 which side it opens toward.
 */
export function swingDoor(world, area, id, { wallDir, at, centre, w = 1.1, h = 2.25, y = 0, hinge = -1, swing = 1, locked = false, requires = null, mat = 'door', label = 'door', angle = 1.75, glass = false, reader = false, auto = false }) {
  const group = new THREE.Group();
  const DB = new Batch();
  // panel (local: spans +x from the hinge)
  DB.box(w / 2, h / 2, 0, w, h, 0.06, mat);
  DB.box(w / 2, h * 0.55, 0, 0.5, 0.35, 0.075, glass ? 'glass' : 'steel');
  DB.box(w - 0.12, h * 0.5, 0.05, 0.05, 0.05, 0.06, 'steelLight'); // handle
  DB.box(w - 0.12, h * 0.5, -0.05, 0.05, 0.05, 0.06, 'steelLight');
  DB.build(group, { cast: true });
  const pos = new THREE.Vector3();
  if (wallDir === 'x') {
    const hx = centre + hinge * (w / 2);
    group.position.set(hx, y, at);
    group.rotation.y = hinge > 0 ? Math.PI : 0;
    pos.set(centre, y + 1, at);
  } else {
    const hz = centre + hinge * (w / 2);
    group.position.set(at, y, hz);
    group.rotation.y = hinge > 0 ? Math.PI / 2 : -Math.PI / 2;
    pos.set(at, y + 1, centre);
  }
  area.group.add(group);
  // collider across the opening
  const col = wallDir === 'x'
    ? world.addCollider(centre - w / 2, y, at - 0.05, centre + w / 2, y + h, at + 0.05, { tag: 'door' })
    : world.addCollider(at - 0.05, y, centre - w / 2, at + 0.05, y + h, centre + w / 2, { tag: 'door' });
  const d = new Door(world, id, { group, collider: col, type: 'swing', angle, speed: 2.4, locked, requires, pos, label, auto, sound: 'door' });
  // direction of swing: rotate so door opens toward `swing` side
  d.sign = wallDir === 'x' ? swing * hinge : -swing * hinge;
  d.wallDir = wallDir; d.centre = centre; d.at = at; d.width = w;
  if (reader) {
    const rb = new Batch();
    const rx = wallDir === 'x' ? centre + hinge * -(w / 2 + 0.3) : at + (swing > 0 ? -0.2 : 0.2);
    const rz = wallDir === 'x' ? at + (swing > 0 ? -0.2 : 0.2) : centre + hinge * -(w / 2 + 0.3);
    rb.box(rx, 1.3, rz, wallDir === 'x' ? 0.14 : 0.08, 0.2, wallDir === 'x' ? 0.08 : 0.14, 'black');
    rb.box(rx + (wallDir === 'x' ? 0 : (swing > 0 ? -0.045 : 0.045)), 1.34, rz + (wallDir === 'x' ? (swing > 0 ? -0.045 : 0.045) : 0), 0.05, 0.05, 0.02, 'redLamp');
    rb.build(area.group);
    d.readerPos = new THREE.Vector3(rx, 1.3, rz);
  }
  return d;
}

/** Sliding steel gate / door. axis = direction it slides. */
export function slideGate(world, area, id, { wallDir, at, centre, w = 2.6, h = 3.0, y = 0, slideSign = 1, bars = true, locked = false, label = 'gate', travel = null, speed = 1.3 }) {
  const group = new THREE.Group();
  const DB = new Batch();
  if (bars) {
    barsRow(DB, { dir: 'x', at: 0, from: -w / 2, to: w / 2, y0: 0.05, y1: h - 0.1, spacing: 0.13, r: 0.02 });
    DB.box(0, h - 0.06, 0, w, 0.12, 0.1, 'steel'); DB.box(0, 0.08, 0, w, 0.16, 0.1, 'steel');
    DB.box(0, h / 2, 0, w, 0.1, 0.06, 'steel');
    DB.box(w * 0.2, h * 0.5, 0.04, 0.35, 0.3, 0.05, 'steelLight');
  } else {
    DB.box(0, h / 2, 0, w, h, 0.1, 'door');
  }
  DB.build(group);
  if (wallDir === 'x') { group.position.set(centre, y, at); }
  else { group.position.set(at, y, centre); group.rotation.y = Math.PI / 2; }
  area.group.add(group);
  const col = wallDir === 'x'
    ? world.addCollider(centre - w / 2, y, at - 0.08, centre + w / 2, y + h, at + 0.08, { tag: 'door', sight: !bars })
    : world.addCollider(at - 0.08, y, centre - w / 2, at + 0.08, y + h, centre + w / 2, { tag: 'door', sight: !bars });
  const d = new Door(world, id, { group, collider: col, type: 'slide', axis: wallDir === 'x' ? 'x' : 'z', travel: travel || w - 0.1, speed, locked, pos: wallDir === 'x' ? new THREE.Vector3(centre, y + 1, at) : new THREE.Vector3(at, y + 1, centre), label, sightWhenOpen: bars, sound: 'gate' });
  d.sign = slideSign;
  d.width = w;
  return d;
}

/** Ceiling-mounted tube + sprite + floor pool; registers a fixture. */
export function ceilingLight(world, area, B, { x, y, z, along = 'x', len = 1.4, intensity = 30, range = 10, color = 0xdff4ec, flicker = 0, poolW = 4.5, poolD = 2.6, drop = 0.4, warm = false, glow = 0.55, pool = true, priority = 0 }) {
  const fx = hangingTube(world, area, B, { x, y, z, len, along, color, intensity, range, flicker, priority });
  fx.pos.y = y - drop;
  const sp = glowSprite(new THREE.Vector3(x, y - 0.06, z), 2.2, color, glow);
  area.group.add(sp); fx.sprite = sp;
  if (pool) B.quad(x, (y > 3 ? 0 : 0) + 0.02, z, along === 'x' ? poolW : poolD, along === 'x' ? poolD : poolW, '+y', warm ? 'dPoolWarm' : 'dPool');
  return fx;
}
