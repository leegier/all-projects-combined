// C-Block: the two-tier cell hall. Interior x[-18,18] z[-10,10]. North/south cell rows (12 cells each, two tiers),
// open day-room floor, glass watch booth, catwalk decks, two stairs and the end-gates to the east/west wings.
import * as THREE from 'three';
import { Batch } from '../geo.js';
import { MAT } from '../../proc/materials.js';
import { DECALS } from '../../proc/textures.js';
import { Door } from '../world.js';
import { glowSprite } from '../../core/gfx.js';
import { wall, barsRow, bunk, toiletSink, deskShelf, steelTable, pipeRun, wallSign, hangingTube } from '../props.js';

export const HALL = { x0: -18, x1: 18, z0: -10, z1: 10, roof: 9.2, tier: 3.7, cellH: 3.3, upperTop: 7.0 };

export function buildHall(world, ctx) {
  const area = world.addArea('hall', [-18.6, -10.6, 18.6, 10.6], { neighbors: ['eastGate', 'westGate'], reverb: 0.75, yRange: [-0.5, 12] });
  const B = new Batch();
  const { x0, x1, z0, z1, roof, tier, cellH, upperTop } = HALL;

  // ---- floor / roof ------------------------------------------------------------------------
  B.slab(x0 - 0.6, -0.4, z0 - 0.6, x1 + 0.6, 0, z1 + 0.6, 'floor');
  world.addSurface(x0 - 0.6, z0 - 0.6, x1 + 0.6, z1 + 0.6, 0);
  B.slab(x0 - 0.6, roof, z0 - 0.6, x1 + 0.6, roof + 0.4, z1 + 0.6, 'ceiling');
  // ---- outer walls -------------------------------------------------------------------------
  const gateOpen = [[-1.35, 1.35, 3.1]];
  for (const [y0, y1] of [[0, tier], [tier, roof]]) {
    wall(B, world, { dir: 'x', at: z0 - 0.3, from: x0 - 0.6, to: x1 + 0.6, y0, y1, thick: 0.6, mat: 'wallGreen' });
    wall(B, world, { dir: 'x', at: z1 + 0.3, from: x0 - 0.6, to: x1 + 0.6, y0, y1, thick: 0.6, mat: 'wallGreen' });
    wall(B, world, { dir: 'z', at: x0 - 0.3, from: z0, to: z1, y0, y1, thick: 0.6, mat: 'wallGreen', openings: y0 === 0 ? gateOpen : [] });
    wall(B, world, { dir: 'z', at: x1 + 0.3, from: z0, to: z1, y0, y1, thick: 0.6, mat: 'wallGreen', openings: y0 === 0 ? gateOpen : [] });
  }
  // clerestory windows above the cell blocks (y 7.7 - 9.0): frames only, panes are emissive "sky" planes
  const winMat = ctx.windowMat;
  for (const side of [-1, 1]) {
    const zz = side < 0 ? z0 + 0.02 : z1 - 0.02;
    for (let i = 0; i < 6; i++) {
      const cx = -15 + i * 6;
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.3), winMat);
      pane.position.set(cx, 8.35, zz);
      pane.rotation.y = side < 0 ? 0 : Math.PI;
      area.group.add(pane);
      // frame + bars
      B.box(cx, 9.02, zz, 3.9, 0.12, 0.2, 'steel'); B.box(cx, 7.68, zz, 3.9, 0.12, 0.2, 'steel');
      B.box(cx - 1.9, 8.35, zz, 0.12, 1.4, 0.2, 'steel'); B.box(cx + 1.9, 8.35, zz, 0.12, 1.4, 0.2, 'steel');
      for (let b = 1; b < 6; b++) B.box(cx - 1.8 + b * 0.6, 8.35, zz - side * 0.04, 0.035, 1.3, 0.04, 'bars');
      B.box(cx, 8.35, zz - side * 0.04, 3.6, 0.04, 0.04, 'bars');
      // window light spill streaks on the wall below
      B.quad(cx, 6.6, zz - side * 0.02 * -1 + (side < 0 ? 0.03 : -0.03), 2.4, 1.8, side < 0 ? '+z' : '-z', 'dStreak', { tint: 0x777777 });
    }
  }
  // roof trusses
  for (let i = -5; i <= 5; i++) {
    const x = i * 3.4;
    B.box(x, roof - 0.35, 0, 0.3, 0.55, z1 * 2 + 0.2, 'steel');
    B.box(x, roof - 0.7, 0, 0.12, 0.12, z1 * 2, 'steel');
    for (let d = -4; d <= 4; d++) B.box(x, roof - 0.55, d * 2.2, 0.1, 0.5, 0.1, 'steel', { rotX: d % 2 ? 0.55 : -0.55 });
  }
  pipeRun(B, { from: [x0, roof - 1.0, z0 + 3.4], to: [x1, roof - 1.0, z0 + 3.4], r: 0.12, mat: 'pipe' });
  pipeRun(B, { from: [x0, roof - 1.3, z0 + 3.7], to: [x1, roof - 1.3, z0 + 3.7], r: 0.07, mat: 'pipeRed' });
  pipeRun(B, { from: [x0, roof - 1.1, z1 - 3.4], to: [x1, roof - 1.1, z1 - 3.4], r: 0.1, mat: 'pipe' });

  // ---- tier decks + catwalks ---------------------------------------------------------------
  for (const side of [-1, 1]) {
    const zc0 = side < 0 ? z0 : 5.5, zc1 = side < 0 ? -5.5 : z1;           // cell strip
    const zd0 = side < 0 ? -5.5 : 4.0, zd1 = side < 0 ? -4.0 : 5.5;        // catwalk
    B.slab(x0, cellH, zc0, x1, tier, zc1, 'ceiling', { vBase: 0 });         // ground cells' ceiling / upper cells' floor
    B.slab(x0, upperTop, zc0, x1, upperTop + 0.3, zc1, 'ceiling');
    // catwalk deck (grating) with steel edge
    B.slab(x0, tier - 0.14, zd0, x1, tier, zd1, 'grating');
    B.slab(x0, tier - 0.5, zd0, x1, tier - 0.14, zd0 + 0.1, 'steel');
    B.slab(x0, tier - 0.5, zd1 - 0.1, x1, tier - 0.14, zd1, 'steel');
    world.addSurface(x0, zd0, x1, zd1, tier);
    world.addSurface(x0, zc0, x1, zc1, tier); // upper-cell fronts are barred; surface lets fall-through logic ignore
    // support columns
    for (let c = -4; c <= 4; c++) {
      const cx = c * 4.0 + 0.0;
      B.box(cx, tier / 2, side < 0 ? zd1 - 0.12 : zd0 + 0.12, 0.28, tier, 0.28, 'steel');
      world.addCollider(cx - 0.14, 0, (side < 0 ? zd1 - 0.12 : zd0 + 0.12) - 0.14, cx + 0.14, tier, (side < 0 ? zd1 - 0.12 : zd0 + 0.12) + 0.14, { sight: false });
    }
    // railing on the hall-side edge (gap for stair arrival)
    const rz = side < 0 ? zd1 - 0.04 : zd0 + 0.04;
    const stairX = side < 0 ? [-16.3, -14.8] : [14.8, 16.3];
    const spans = [[x0, stairX[0]], [stairX[1], x1]];
    for (const [a, b] of spans) {
      B.box((a + b) / 2, tier + 1.0, rz, b - a, 0.06, 0.06, 'rail');
      B.box((a + b) / 2, tier + 0.55, rz, b - a, 0.04, 0.04, 'rail');
      for (let p = a; p <= b + 0.01; p += 1.5) B.box(p, tier + 0.5, rz, 0.05, 1.0, 0.05, 'rail');
      // chain-mesh panel (see-through sliver)
      for (let q = a + 0.1; q < b; q += 0.2) B.cyl(q, tier + 0.55, rz, 0.01, 0.01, 0.95, 'bars', { seg: 4 });
      world.addCollider(a, tier, rz - 0.08, b, tier + 1.1, rz + 0.08, { sight: false, tag: 'rail' });
    }
  }

  // ---- stairs ------------------------------------------------------------------------------
  const stair = (xa, xb, zStart, zEnd, side) => {
    const steps = 20, run = Math.abs(zEnd - zStart), dz = (zEnd - zStart) / steps;
    for (let i = 0; i < steps; i++) {
      const zc = zStart + dz * (i + 0.5);
      const yTop = (tier / steps) * (i + 1);
      B.box((xa + xb) / 2, yTop - 0.04, zc, xb - xa, 0.08, Math.abs(dz) + 0.01, 'grating');
      B.box((xa + xb) / 2, yTop / 2, zc + dz * 0.5 - Math.sign(dz) * 0.0, xb - xa, yTop - 0.08, 0.04, 'steel');
    }
    // stringers
    for (const sx of [xa, xb]) {
      const len = Math.hypot(run, tier);
      B.box(sx, tier / 2 - 0.1, (zStart + zEnd) / 2, 0.08, 0.3, len, 'steel', { rotX: Math.atan2(tier, run) * (zEnd < zStart ? 1 : -1) });
      // handrail posts and rail
      for (let i = 0; i <= 4; i++) {
        const t = i / 4, zz = zStart + (zEnd - zStart) * t, yy = tier * t;
        B.box(sx, yy + 0.55, zz, 0.05, 1.1, 0.05, 'rail');
      }
      B.box(sx, tier / 2 + 1.05, (zStart + zEnd) / 2, 0.06, 0.06, Math.hypot(run, tier), 'rail', { rotX: Math.atan2(tier, run) * (zEnd < zStart ? 1 : -1) });
      world.addCollider(sx - 0.05, 0, Math.min(zStart, zEnd), sx + 0.05, tier + 1.1, Math.max(zStart, zEnd), { sight: false, tag: 'rail' });
    }
    world.addSurface(xa, Math.min(zStart, zEnd), xb, Math.max(zStart, zEnd), zEnd < zStart ? tier : 0, zEnd < zStart ? 0 : tier, 'z');
    // `addSurface(... yA at min z, yB at max z)`: for north stair (zEnd<zStart) top is at min z
  };
  stair(-16.3, -14.8, 1.6, -4.0, -1);   // north stair: rises toward -z
  stair(14.8, 16.3, -1.6, 4.0, 1);      // south stair: rises toward +z

  // ---- cell rows ---------------------------------------------------------------------------
  const cellDoors = [];
  for (const side of [-1, 1]) {
    const back = side < 0 ? z0 : z1, front = side < 0 ? -5.5 : 5.5;
    const toward = -side; // direction from back wall into the cell (+z for north row)
    for (let level = 0; level < 2; level++) {
      const yb = level === 0 ? 0 : tier, ytop = level === 0 ? cellH : upperTop;
      // partitions
      for (let i = 0; i <= 12; i++) {
        const px = x0 + i * 3;
        if (level === 1 && side < 0 && px < -12.4) continue;
        wall(B, world, { dir: 'z', at: px, from: Math.min(back, front), to: Math.max(back, front), y0: yb, y1: ytop, thick: 0.22, mat: 'wallGrey', vBase: yb, sight: true });
      }
      // front bars + doors + cell contents
      for (let i = 0; i < 12; i++) {
        const cx = x0 + i * 3 + 1.5;
        if (level === 1 && side < 0 && cx < -12.4) continue;
        const idx = i + 1;
        const doorW = 1.0;
        // left & right bar panels beside the door opening
        barsRow(B, { dir: 'x', at: front, from: cx - 1.4, to: cx - doorW / 2 - 0.02, y0: yb, y1: ytop, spacing: 0.11 });
        barsRow(B, { dir: 'x', at: front, from: cx + doorW / 2 + 0.02, to: cx + 1.4, y0: yb, y1: ytop, spacing: 0.11 });
        B.box(cx, ytop - 0.1, front, 3, 0.2, 0.2, 'steel');           // header beam
        B.box(cx, yb + 0.1, front, 3, 0.2, 0.2, 'steel');             // sill
        world.addCollider(cx - 1.4, yb, front - 0.05, cx - doorW / 2, ytop, front + 0.05, { sight: false, tag: 'bars' });
        world.addCollider(cx + doorW / 2, yb, front - 0.05, cx + 1.4, ytop, front + 0.05, { sight: false, tag: 'bars' });
        // door (sliding bar panel)
        const dg = new THREE.Group();
        const DB = new Batch();
        barsRow(DB, { dir: 'x', at: 0, from: -doorW / 2, to: doorW / 2, y0: 0.05, y1: ytop - yb - 0.15, spacing: 0.1 });
        DB.box(0, 1.0, 0, 0.1, 0.16, 0.08, 'steelLight'); // lock plate
        DB.build(dg);
        dg.position.set(cx, yb, front + toward * 0.07);
        area.group.add(dg);
        const col = world.addCollider(cx - doorW / 2, yb, front - 0.06, cx + doorW / 2, ytop, front + 0.06, { sight: false, tag: 'celldoor' });
        const door = new Door(world, `cell-${side < 0 ? 'N' : 'S'}${level}-${idx}`, { group: dg, collider: col, type: 'slide', axis: 'x', travel: 1.05, speed: 1.4, pos: new THREE.Vector3(cx, yb + 1, front), sound: 'celldoor', label: 'cell door', sightWhenOpen: true });
        door.sign = -1;
        door.cellNo = `${side < 0 ? 'C' : 'D'}-${level + 1}${String(idx).padStart(2, '0')}`;
        door.side = side; door.level = level; door.index = i;
        cellDoors.push(door);
        // cell contents (ground cell of the player is hand-dressed later in game via marks)
        const bz = back + toward * 0.0;
        const cell0 = cx - 1.5;
        bunk(B, cell0 + 0.55, yb, back + toward * 1.15, { alongX: false, dir: toward, upper: true });
        toiletSink(B, cx + 1.2, yb, back + toward * 0.0, { facing: toward > 0 ? '+z' : '-z' });
        deskShelf(B, cx + 1.45, yb, back + toward * 2.4, { facing: '-x', w: 1.1 });
        // floor inside cell (upper uses slab already) + grime
        // number plate above the door
        // cell lamp (emissive caged bulb) just inside the front
        B.box(cx, ytop - 0.18, front + toward * 0.6, 0.18, 0.1, 0.18, 'steel');
        B.quad(cx - 1.0, yb + 0.03, back + toward * 2.5, 1.6, 1.6, '+y', 'dStain', { tint: 0x555555 });
      }
    }
  }

  // number plates drawn once per door (small signs above the doors, ground level only)
  for (const d of cellDoors) {
    if (d.level !== 0) continue;
    const front = d.side < 0 ? -5.5 : 5.5;
    wallSign(area.group, [{ text: d.cellNo, size: 0.5 }], { x: d.home.x, y: 2.95, z: front + (d.side < 0 ? 0.13 : -0.13), w: 0.5, h: 0.22, facing: d.side < 0 ? '+z' : '-z', bg: '#1a1a1a', fg: '#c9bfa0', border: false });
  }
  ctx.cellDoors = cellDoors;

  // ---- watch booth -------------------------------------------------------------------------
  {
    const bx0 = -2.6, bx1 = 2.6, bz0 = -1.5, bz1 = 1.5;
    B.slab(bx0, 0, bz0, bx1, 1.0, bz1, 'wallGrey');
    B.slab(bx0 - 0.1, 2.7, bz0 - 0.1, bx1 + 0.1, 2.95, bz1 + 0.1, 'steel');
    for (const [a, b, c, d] of [[bx0, bz0, bx1, bz0], [bx0, bz1, bx1, bz1], [bx0, bz0, bx0, bz1], [bx1, bz0, bx1, bz1]]) {
      const w = Math.abs(c - a) || 0.06, dd = Math.abs(d - b) || 0.06;
      B.box((a + c) / 2, 1.85, (b + d) / 2, w, 1.7, dd, 'glass');
      for (let k = 0; k <= 4; k++) {
        const t = k / 4;
        B.box(a + (c - a) * t, 1.85, b + (d - b) * t, 0.07, 1.7, 0.07, 'steel');
      }
    }
    world.addCollider(bx0, 0, bz0, bx1, 2.8, bz1, { sight: false });
    // desk + monitors inside
    B.box(0, 0.78, -1.1, 3.2, 0.06, 0.7, 'woodDark');
    B.box(0, 0.4, -1.1, 3.0, 0.76, 0.6, 'pipe');
    for (const mx of [-1.1, 0, 1.1]) {
      B.box(mx, 1.12, -1.2, 0.5, 0.34, 0.04, 'black');
      B.box(mx, 1.12, -1.17, 0.46, 0.3, 0.01, 'screenGreen');
    }
    B.box(0, 0.5, -0.2, 0.5, 0.06, 0.5, 'black');
    B.cyl(0, 0.25, -0.2, 0.04, 0.04, 0.5, 'steel');
    B.quad(0, 2.0, bz0 + 0.12, 1.2, 0.5, '+z', 'dStain2', { tint: 0x222222 });
    ctx.boothPos = new THREE.Vector3(0, 0, 0);
    // booth light
    hangingTube(world, area, B, { x: 0, y: 2.55, z: 0, len: 1.4, kind: 'tube', color: 0xcfe8ff, intensity: 8, range: 6, glow: 0.4 });
  }

  // ---- day-room: tables, benches, wall fixtures -------------------------------------------
  for (const [tx, tz] of [[-9, -1.9], [-9, 1.9], [9, -1.9], [9, 1.9], [-6.6, 3.7], [6.6, -3.7]]) steelTable(B, world, tx, 0, tz, { alongX: true });
  // payphones and notice board on end walls
  ctx.phoneBank = new THREE.Vector3(x1 - 0.25, 1.3, -6.2 + 3.2);
  for (let i = 0; i < 3; i++) {
    const py = -3.4 - i * 0.0, pz = 3.4 + i * 0.7 - 1.7;
    B.box(x1 - 0.12, 1.35, pz, 0.14, 0.34, 0.26, 'steelLight');
    B.box(x1 - 0.09, 1.52, pz, 0.04, 0.11, 0.2, 'black');
    B.cyl(x1 - 0.14, 1.35, pz + 0.15, 0.02, 0.02, 0.28, 'black', { axis: 'z' });
    B.box(x1 - 0.14, 1.28, pz + 0.0, 0.16, 0.2, 0.02, 'steel');
  }
  wallSign(area.group, ['ROUTINE', { text: 'COUNT 0600 · CHOW 0700 · WORK 0800', size: 0.1 }, { text: 'YARD 1000 · CHOW 1200 · CHAPEL 1300', size: 0.1 }, { text: 'GYM 1500 · VISIT 1600 · LIGHTS OUT 2200', size: 0.1 }], { x: x1 - 0.02, y: 1.7, z: -3.6, w: 1.4, h: 0.9, facing: '-x', bg: '#d9d4bd', accent: '#7a0f0f' });
  wallSign(area.group, [{ text: 'C BLOCK', size: 0.5 }, { text: 'NO WARNING SHOTS', size: 0.18, color: '#9a1b1b' }], { x: x0 + 0.02, y: 4.4, z: -2.9, w: 1.6, h: 0.9, facing: '+x', bg: '#d7d0b8', accent: '#111', fg: '#111' });
  wallSign(area.group, [{ text: 'EXIT →', size: 0.6, color: '#d4ffe0' }], { x: x1 - 0.02, y: 3.35, z: -2.0, w: 1.0, h: 0.35, facing: '-x', bg: '#0a2a14', fg: '#9ff7b5', border: false });
  // wall clock (live, set by game)
  ctx.clockMesh = null;
  // water fountain
  B.box(x1 - 0.3, 0.85, 4.6, 0.5, 0.2, 0.45, 'steelLight');
  B.box(x1 - 0.18, 0.4, 4.6, 0.24, 0.8, 0.3, 'steel');
  ctx.fountainPos = new THREE.Vector3(x1 - 0.7, 1.0, 4.6);
  // drain grates + stains
  for (const gx of [-12, -4, 4, 12]) B.quad(gx, 0.012, 0, 0.9, 0.9, '+y', 'dStain2', { tint: 0x222222 });
  B.quad(-2, 0.014, 5.0, 4, 3, '+y', 'dStain', { tint: 0x888888 });
  B.quad(6, 0.014, -4.5, 5, 3, '+y', 'dStain', { tint: 0x777777 });
  B.quad(-10, 0.014, -3.3, 3, 2, '+y', 'dStain2', { tint: 0x555555 });
  // base skirting with grime band along the cell-row baseboards
  for (const zz of [-5.5, 5.5]) B.box(0, 0.05, zz + (zz < 0 ? 0.0 : 0.0), 36, 0.1, 0.22, 'steel');

  // ---- lights ------------------------------------------------------------------------------
  const lightPos = [];
  for (const zz of [-2.4, 2.4]) for (let i = -2; i <= 2; i++) lightPos.push([i * 6.6 + (zz > 0 ? 3.3 : 0), zz]);
  ctx.hallFixtures = [];
  for (const [lx, lz] of lightPos) {
    if (Math.abs(lx) < 3 && Math.abs(lz) < 3 && Math.abs(lx) < 4.5 && Math.abs(lz) < 2.6) continue;
    const fx = hangingTube(world, area, B, { x: lx, y: 7.7, z: lz, len: 1.6, along: 'x', intensity: 140, range: 17, flicker: Math.abs(lx) > 12 ? 0.6 : 0 });
    fx.pos.y = 6.7;
    const sp = glowSprite(new THREE.Vector3(lx, 7.62, lz), 3.2, 0xdff4ec, 0.55);
    area.group.add(sp); fx.sprite = sp;
    // hanging chains
    B.cyl(lx - 0.7, 8.4, lz, 0.01, 0.01, 1.6, 'steel', { seg: 4 }); B.cyl(lx + 0.7, 8.4, lz, 0.01, 0.01, 1.6, 'steel', { seg: 4 });
    // pooled light on the floor (fake)
    B.quad(lx, 0.02, lz, 7.5, 4.5, '+y', 'dPool');
    ctx.hallFixtures.push(fx);
  }
  // under-tier lights on the ground-level strips
  for (const side of [-1, 1]) for (let i = -2; i <= 2; i++) {
    const lx = i * 7.2, lz = side * 4.75;
    const fx = hangingTube(world, area, B, { x: lx, y: 3.2, z: lz, len: 1.1, along: 'x', intensity: 26, range: 8 });
    fx.pos.y = 2.9;
    area.group.add(glowSprite(new THREE.Vector3(lx, 3.14, lz), 1.8, 0xdff4ec, 0.4));
    B.quad(lx, 0.02, lz, 5, 2.5, '+y', 'dPool', { tint: 0xaaaaaa });
  }
  // cell-front wall lamps (emissive only)
  for (const d of cellDoors) {
    if (d.level !== 0) continue;
    B.box(d.home.x + 0.9, 3.0, d.side < 0 ? -5.45 : 5.45, 0.14, 0.1, 0.1, 'tube');
  }

  // ---- decals on cell block walls ---------------------------------------------------------
  B.quad(-5.5, 1.6, -9.98, 4, 1.7, '+z', 'dStreak', { tint: 0x555555 });
  B.quad(11, 1.8, 9.98, 3, 2, '-z', 'dStreak', { tint: 0x555555 });

  B.build(area.group);
  // dust and light shafts
  ctx.hallArea = area;
  return area;
}
