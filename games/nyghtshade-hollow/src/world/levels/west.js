// West wing: sally port, corridor, library and the chapel (stained glass, pews, altar, the baptismal font that hides the tunnel).
import * as THREE from 'three';
import { Batch } from '../geo.js';
import { MAT } from '../../proc/materials.js';
import { DECALS } from '../../proc/textures.js';
import { glowSprite } from '../../core/gfx.js';
import { wall, pew, pipeRun, wallSign, locker, steelTable } from '../props.js';
import { room, swingDoor, slideGate, ceilingLight } from './common.js';

function shelfRow(B, world, x, z, len, { alongX = true, h = 2.1, depth = 0.4, facing = '+z' } = {}) {
  const sx = alongX ? len : depth, sz = alongX ? depth : len;
  B.box(x, h / 2, z, sx, h, sz, 'woodDark');
  // spines on the face
  const nx = alongX ? 0 : (facing === '+x' ? 1 : -1), nz = alongX ? (facing === '+z' ? 1 : -1) : 0;
  for (let s = 0; s < Math.ceil(len / 1.0); s++) {
    const off = -len / 2 + 0.5 + s * 1.0;
    const px = x + (alongX ? off : nx * (depth / 2 + 0.003)), pz = z + (alongX ? nz * (depth / 2 + 0.003) : off);
    B.quad(px, 1.05, pz, Math.min(1.0, len - s * 1.0), 1.9, facing, 'books');
  }
  world.addCollider(x - sx / 2, 0, z - sz / 2, x + sx / 2, h, z + sz / 2, { sight: false });
}

export function buildWest(world, ctx) {
  const marks = ctx.marks;
  // ===================== sally + corridor =====================================================
  const corr = world.addArea('westCorr', [-50.4, -2.4, -18.3, 2.4], { neighbors: ['hall', 'library', 'chapel'], reverb: 0.55, yRange: [-0.5, 5] });
  {
    const B = new Batch();
    room(B, world, { x0: -50, z0: -2, x1: -18.6, z1: 2, h: 3.4, wallMat: 'wallRed', skip: ['e', 'w'], ops: { n: [[-34.1, -31.9, 2.3]] } });
    wall(B, world, { dir: 'z', at: -24.15, from: -2, to: 2, y0: 0, y1: 3.4, thick: 0.3, mat: 'wallRed', openings: [[-1.35, 1.35, 3.1]] });
    pipeRun(B, { from: [-50, 3.15, -1.75], to: [-18.6, 3.15, -1.75], r: 0.07, mat: 'pipe' });
    pipeRun(B, { from: [-50, 3.05, 1.7], to: [-18.6, 3.05, 1.7], r: 0.05, mat: 'pipeRed' });
    for (let x = -28; x > -50; x -= 3.2) B.quad(x, 0.012, 1.55, 1.6, 0.08, '+y', 'dPoolWarm', { tint: 0x998800 });
    B.quad(-30, 0.012, 0, 7, 2.4, '+y', 'dStain', { tint: 0x666666 });
    B.quad(-41, 0.012, 0.6, 4, 2, '+y', 'dStain2', { tint: 0x555555 });
    corr.fixtures = [-21.5, -28, -33, -38.5, -44, -48.4].map((x, i) => ceilingLight(world, corr, B, { x, y: 3.3, z: 0, len: 1.3, intensity: 22, range: 9, flicker: i === 3 ? 0.8 : 0, poolW: 5, poolD: 2.6, drop: 0.35 }));
    wallSign(corr.group, [{ text: 'LIBRARY', size: 0.4 }, { text: '13:00 – 15:00', size: 0.16 }], { x: -33, y: 2.6, z: -2.0, w: 1.2, h: 0.5, facing: '+z', bg: '#d6d0b8', fg: '#111' });
    wallSign(corr.group, [{ text: 'CHAPEL', size: 0.46 }, { text: 'SERVICES DAILY · SILENCE', size: 0.13 }], { x: -49.82, y: 2.55, z: 2.2, w: 1.5, h: 0.5, facing: '+x', bg: '#d6d0b8', fg: '#111', accent: '#7a0f0f' });
    ctx.alarmLamps = ctx.alarmLamps || [];
    for (const x of [-22.6, -35, -47]) { const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), MAT.redLamp.clone()); lamp.position.set(x, 3.15, 1.85); corr.group.add(lamp); ctx.alarmLamps.push(lamp); }
    B.build(corr.group);
    ctx.sallyG1W = slideGate(world, corr, 'gate-sallyW-1', { wallDir: 'z', at: -18.3, centre: 0, w: 2.7, h: 3.1, label: 'sally gate', slideSign: -1 });
    ctx.sallyG2W = slideGate(world, corr, 'gate-sallyW-2', { wallDir: 'z', at: -24.15, centre: 0, w: 2.7, h: 3.1, label: 'checkpoint gate', slideSign: -1 });
    ctx.libraryDoor = swingDoor(world, corr, 'door-library', { wallDir: 'x', at: -2.15, centre: -33, w: 2.0, h: 2.3, hinge: -1, swing: -1, label: 'library door' });
  }

  // ===================== library ===============================================================
  const lib = world.addArea('library', [-40.4, -12.6, -27.6, -2.0], { neighbors: ['westCorr'], reverb: 0.4, yRange: [-0.5, 5] });
  {
    const B = new Batch();
    room(B, world, { x0: -40, z0: -12.3, x1: -28, z1: -2.3, h: 3.6, floor: 'floorDark', wallMat: 'wallGreen', skip: ['s'], ops: {} });
    for (let i = 0; i < 3; i++) shelfRow(B, world, -37.5 + i * 3.4, -9.6, 2.4, { alongX: true, facing: '+z' });
    for (let i = 0; i < 3; i++) shelfRow(B, world, -37.5 + i * 3.4, -11.9, 2.4, { alongX: true, facing: '-z' });
    shelfRow(B, world, -39.8, -6.3, 5.0, { alongX: false, facing: '+x' });
    // reading tables + warm lamps
    for (const [tx, tz] of [[-34, -5.2], [-30, -6.4]]) {
      steelTable(B, world, tx, 0, tz, { alongX: true, mat: 'woodDark', w: 2.0, d: 0.9 });
      B.cyl(tx - 0.4, 0.88, tz, 0.04, 0.06, 0.2, 'steel', { seg: 8 });
      B.box(tx - 0.4, 1.0, tz, 0.2, 0.08, 0.2, 'bulb');
      lib.fixtures = lib.fixtures || [];
      lib.fixtures.push(world.addFixture({ pos: new THREE.Vector3(tx - 0.4, 1.15, tz), color: 0xffc27a, intensity: 6, range: 5.5, area: 'library' }));
      B.box(tx + 0.3, 0.8, tz + 0.1, 0.3, 0.02, 0.22, 'paper');
    }
    lib.fixtures.push(ceilingLight(world, lib, B, { x: -34, y: 3.5, z: -7.5, len: 1.4, intensity: 14, range: 8, color: 0xcfe6dc, flicker: 0.3, poolW: 5, poolD: 3, drop: 0.35 }));
    wallSign(lib.group, [{ text: 'QUIET', size: 0.6 }], { x: -34, y: 2.75, z: -2.45, w: 1.0, h: 0.4, facing: '+z', bg: '#d6d0b8', fg: '#111' });
    B.quad(-34, 0.014, -6, 6, 4, '+y', 'dStain', { tint: 0x776655 });
    B.build(lib.group);
    marks.librarian = new THREE.Vector3(-36.2, 0, -5.0);
  }

  // ===================== chapel =================================================================
  const chap = world.addArea('chapel', [-72.4, -10.6, -49.8, 10.6], { neighbors: ['westCorr', 'tunnel1'], reverb: 1.0, yRange: [-0.5, 12] });
  chap.surface = 'stone';
  {
    const B = new Batch();
    const X0 = -72, X1 = -50.3, Z0 = -10, Z1 = 10, H = 8.4;
    // floor in pieces around the (hidden) tunnel shaft: x[-55.9,-54.1] z[-9.2,-5.0]
    const hole = { x0: -55.9, x1: -54.1, z0: -9.2, z1: -5.0 };
    const floorPieces = [
      [X0 - 0.3, Z0 - 0.3, hole.x0, Z1 + 0.3], [hole.x1, Z0 - 0.3, X1 + 0.3, Z1 + 0.3],
      [hole.x0, hole.z1, hole.x1, Z1 + 0.3], [hole.x0, Z0 - 0.3, hole.x1, hole.z0],
    ];
    for (const [a, b, c, d] of floorPieces) { B.slab(a, -0.4, b, c, 0, d, 'flag'); world.addSurface(a, b, c, d, 0); }
    // shaft walls (brick) around the hole, going down 3.4
    B.slab(hole.x0 - 0.1, -3.6, hole.z0, hole.x0, 0, hole.z1, 'brick');
    B.slab(hole.x1, -3.6, hole.z0, hole.x1 + 0.1, 0, hole.z1, 'brick');
    B.slab(hole.x0, -3.6, hole.z1, hole.x1, 0, hole.z1 + 0.1, 'brick');
    B.slab(hole.x0, -3.6, hole.z0 - 0.1, hole.x1, 0, hole.z0, 'brick');
    ctx.chapelHole = hole;
    // ceiling + beams
    B.slab(X0 - 0.3, H, Z0 - 0.3, X1 + 0.3, H + 0.4, Z1 + 0.3, 'plaster');
    for (let x = -70; x < -50.5; x += 2.6) { B.box(x, H - 0.35, 0, 0.3, 0.7, Z1 * 2 + 0.2, 'woodDark'); B.box(x, H - 1.5, -7, 0.3, 0.3, 0.3, 'woodDark', { rotZ: 0 }); }
    for (let z = -8; z <= 8; z += 4) B.box((X0 + X1) / 2, H - 0.7, z, X1 - X0, 0.22, 0.22, 'woodDark');
    // arches along both side walls
    for (const sd of [-1, 1]) for (let x = -70; x < -51; x += 4.2) {
      B.box(x, 3.9, sd * 9.7, 0.6, 7.8, 0.6, 'plaster');
      B.box(x + 2.1, 3.9, sd * 9.85, 3.4, 7.8, 0.2, 'plaster');
    }
    // walls
    const wm = { y0: 0, y1: H, thick: 0.3, mat: 'plaster' };
    wall(B, world, { ...wm, dir: 'x', at: Z0 - 0.15, from: X0 - 0.3, to: X1 + 0.3 });
    wall(B, world, { ...wm, dir: 'x', at: Z1 + 0.15, from: X0 - 0.3, to: X1 + 0.3 });
    wall(B, world, { ...wm, dir: 'z', at: X0 - 0.15, from: Z0, to: Z1 });
    wall(B, world, { ...wm, dir: 'z', at: X1 + 0.15, from: Z0, to: Z1, openings: [[-1.05, 1.05, 2.8]] });
    // wainscot
    for (const [a, b, c, d] of [[X0, Z0, X1, Z0 + 0.06], [X0, Z1 - 0.06, X1, Z1], [X0, Z0, X0 + 0.06, Z1]]) B.slab(a, 0, b, c, 1.1, d, 'woodDark');
    // stained glass windows (tall, high on N/S walls) with coloured pane planes
    ctx.chapelGlass = [];
    for (const sd of [-1, 1]) for (let i = 0; i < 4; i++) {
      const wx = -67 + i * 5.3, zz = sd < 0 ? Z0 + 0.03 : Z1 - 0.03;
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 4.2), ctx.glassMat);
      pane.position.set(wx, 5.1, zz); pane.rotation.y = sd < 0 ? 0 : Math.PI; chap.group.add(pane);
      B.box(wx, 7.35, zz, 2.2, 0.2, 0.22, 'stone'); B.box(wx, 2.95, zz, 2.2, 0.2, 0.3, 'stone');
      B.box(wx - 1.0, 5.1, zz, 0.2, 4.4, 0.22, 'stone'); B.box(wx + 1.0, 5.1, zz, 0.2, 4.4, 0.22, 'stone');
      for (let k = 1; k <= 3; k++) B.box(wx, 2.95 + k * 1.05, zz - sd * 0.0, 1.9, 0.07, 0.1, 'steel');
      B.box(wx, 5.1, zz, 0.07, 4.2, 0.1, 'steel');
    }
    // altar end
    B.slab(-72, 0, -4.2, -67.6, 0.35, 4.2, 'stone');             // chancel step
    B.slab(-71.6, 0.35, -1.6, -70.2, 1.2, 1.6, 'stone');         // altar
    B.slab(-71.7, 1.2, -1.7, -70.1, 1.28, 1.7, 'paper', { tint: 0xddd5c0 });
    world.addCollider(-72, 0, -4.2, -67.6, 0.35, 4.2, { sight: false });
    world.addCollider(-71.6, 0, -1.6, -70.2, 1.2, 1.6, { sight: false });
    // cross
    B.box(-71.85, 5.6, 0, 0.14, 3.6, 0.28, 'wood'); B.box(-71.85, 6.5, 0, 0.14, 0.28, 1.5, 'wood');
    // pulpit
    B.slab(-67, 0, -8.2, -65.2, 0.4, -6.4, 'woodDark'); B.slab(-67, 0.4, -8.2, -65.2, 1.35, -8.0, 'woodDark'); B.slab(-67, 0.4, -6.6, -65.2, 1.35, -6.4, 'woodDark'); B.slab(-67, 0.4, -8.2, -66.8, 1.35, -6.4, 'woodDark');
    B.box(-66.1, 1.45, -7.3, 1.1, 0.06, 0.8, 'woodDark', { rotX: -0.25 });
    world.addCollider(-67, 0, -8.2, -65.2, 1.4, -6.4, { sight: false });
    // pews
    for (let r = 0; r < 6; r++) {
      if (r < 4) pew(B, world, -63 + r * 1.7, 0, -4.9, { len: 3.4 }); // left bank (stops short of the font shaft)
      pew(B, world, -63 + r * 1.7, 0, 4.9, { len: 3.4 });
    }
    // font (stone) — built on a lid so the whole thing can slide away
    ctx.fontGroup = new THREE.Group();
    { // placed at hole centre
      const fb = new Batch();
      const cx = (hole.x0 + hole.x1) / 2, cz = (hole.z0 + hole.z1) / 2;
      fb.slab(hole.x0 - 0.15, -0.12, hole.z0 - 0.15, hole.x1 + 0.15, 0.04, hole.z1 + 0.15, 'stone');
      fb.cyl(cx, 0.42, cz + 1.35, 0.5, 0.62, 0.84, 'stone', { seg: 8 });
      fb.cyl(cx, 0.9, cz + 1.35, 0.72, 0.5, 0.16, 'stone', { seg: 8 });
      fb.cyl(cx, 0.98, cz + 1.35, 0.6, 0.6, 0.04, 'glass', { seg: 8 });
      fb.cyl(cx, 1.2, cz + 1.35, 0.03, 0.03, 0.4, 'steel', { seg: 6 });
      fb.box(cx, 1.38, cz + 1.35, 0.5, 0.05, 0.05, 'steel');
      fb.build(ctx.fontGroup);
      chap.group.add(ctx.fontGroup);
      ctx.fontCollider = world.addCollider(hole.x0 - 0.15, 0, hole.z0 - 0.15, hole.x1 + 0.15, 1.2, hole.z1 + 0.15, { sight: false, tag: 'font' });
      ctx.fontHomeX = ctx.fontGroup.position.x;
      marks.font = new THREE.Vector3(cx, 0.9, cz + 1.35 + 0);
    }
    // candles + sanctuary lamp
    chap.fixtures = [];
    const candleSpots = [[-71.2, 1.28, -1.3], [-71.2, 1.28, 1.3], [-60, 1.0, -9.5], [-52, 1.0, 9.5], [-66, 1.0, 9.5], [-60, 1.0, 9.5], [-54.5, 1.3, -9.4]];
    ctx.candles = [];
    for (const [cx, cy, cz] of candleSpots) {
      B.cyl(cx, cy + 0.18, cz, 0.025, 0.028, 0.36, 'wax', { seg: 8 });
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), MAT.candleFlame);
      flame.scale.set(0.8, 1.6, 0.8); flame.position.set(cx, cy + 0.4, cz); chap.group.add(flame);
      const sp = glowSprite(new THREE.Vector3(cx, cy + 0.42, cz), 0.8, 0xffb866, 0.8); chap.group.add(sp);
      const fx = world.addFixture({ pos: new THREE.Vector3(cx, cy + 0.6, cz), color: 0xffa94d, intensity: 3.2, range: 7, flicker: 0.35, area: 'chapel' });
      chap.fixtures.push(fx); ctx.candles.push({ flame, sp, fx });
    }
    chap.fixtures.push(ceilingLight(world, chap, B, { x: -66, y: 7.4, z: 0, len: 0.1, intensity: 0.001, range: 1, pool: false, glow: 0 })); // dummy to keep array valid
    chap.fixtures.pop(); world.fixtures.pop();
    B.build(chap.group);
    // chapel hanging lamps (warm, dim)
    for (const [lx, lz] of [[-64, -3], [-64, 3], [-57, -3], [-57, 3]]) {
      const fx = world.addFixture({ pos: new THREE.Vector3(lx, 5.8, lz), color: 0xffd7a0, intensity: 38, range: 12, area: 'chapel' });
      chap.fixtures.push(fx);
      const sp = glowSprite(new THREE.Vector3(lx, 5.85, lz), 1.5, 0xffd7a0, 0.6); chap.group.add(sp);
      const b2 = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), MAT.bulb); b2.position.set(lx, 5.9, lz); chap.group.add(b2);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 2.4, 4), MAT.steel); rod.position.set(lx, 7.2, lz); chap.group.add(rod);
    }
    wallSign(chap.group, [{ text: 'BE STILL', size: 0.55 }, { text: 'AND KNOW', size: 0.4 }], { x: -49.82, y: 3.0, z: -4.5, w: 1.4, h: 0.9, facing: '+x', bg: '#d6d0b8', fg: '#111' });
    marks.harringtonPew = new THREE.Vector3(-58.75, 0, 4.2);
    marks.altarTop = new THREE.Vector3(-70.9, 1.3, 0);
    ctx.chapelDoor = swingDoor(world, chap, 'door-chapel', { wallDir: 'z', at: -50.15, centre: 0, w: 2.0, h: 2.8, locked: true, label: 'chapel doors', swing: 1 });
  }
  return { corr, lib, chap };
}
