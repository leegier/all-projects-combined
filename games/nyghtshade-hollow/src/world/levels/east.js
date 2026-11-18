// East wing: sally port, main corridor, mess hall (canteen + kitchen + commissary), Intake lobby and the Records Room.
import * as THREE from 'three';
import { Batch } from '../geo.js';
import { MAT } from '../../proc/materials.js';
import { glowSprite } from '../../core/gfx.js';
import { wall, steelTable, locker, filingCabinet, pipeRun, wallSign, stool, hangingTube } from '../props.js';
import { room, swingDoor, slideGate, ceilingLight } from './common.js';

export function buildEast(world, ctx) {
  const marks = ctx.marks;

  // ======================= sally port + corridor ===========================================
  const corr = world.addArea('eastCorr', [18.3, -2.4, 50.4, 2.4], { neighbors: ['hall', 'canteen', 'intake', 'records'], reverb: 0.55, yRange: [-0.5, 5] });
  {
    const B = new Batch();
    room(B, world, { x0: 18.6, z0: -2, x1: 50, z1: 2, h: 3.4, wallMat: 'wallBlue', floor: 'floor', skip: ['w'], ops: { n: [[28, 30.1, 2.3]], s: [[34, 38, 2.7]], e: [] } });
    // partition between the sally port and the corridor proper
    wall(B, world, { dir: 'z', at: 24.15, from: -2, to: 2, y0: 0, y1: 3.4, thick: 0.3, mat: 'wallBlue', openings: [[-1.35, 1.35, 3.1]] });
    // yellow lane lines + stains
    for (let x = 25; x < 50; x += 3.2) B.quad(x, 0.012, 1.55, 1.6, 0.08, '+y', 'dPoolWarm', { tint: 0x998800 });
    B.quad(32, 0.012, -0.5, 6, 2.2, '+y', 'dStain', { tint: 0x777777 });
    B.quad(44, 0.012, 0.8, 4, 2, '+y', 'dStain2', { tint: 0x555555 });
    B.quad(21, 0.012, 0, 3, 2.4, '+y', 'dStain', { tint: 0x666666 });
    // pipes + conduits
    pipeRun(B, { from: [18.6, 3.15, -1.75], to: [50, 3.15, -1.75], r: 0.07, mat: 'pipe' });
    pipeRun(B, { from: [18.6, 3.05, -1.55], to: [50, 3.05, -1.55], r: 0.04, mat: 'pipeRed' });
    pipeRun(B, { from: [18.6, 3.2, 1.8], to: [50, 3.2, 1.8], r: 0.05, mat: 'pipe' });
    // lights
    const xs = [21.5, 27, 32.5, 38, 43.5, 48];
    corr.fixtures = xs.map((x, i) => ceilingLight(world, corr, B, { x, y: 3.3, z: 0, len: 1.3, intensity: 22, range: 9, flicker: i === 4 ? 0.7 : 0, poolW: 5, poolD: 2.6, drop: 0.35 }));
    // alarm beacons (turned on by AlertSystem)
    ctx.alarmLamps = ctx.alarmLamps || [];
    for (const x of [23.6, 36, 49.4]) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), MAT.redLamp.clone());
      lamp.position.set(x, 3.15, 1.85); corr.group.add(lamp);
      ctx.alarmLamps.push(lamp);
    }
    // wall furniture
    wallSign(corr.group, [{ text: 'SALLY PORT', size: 0.4 }, { text: 'ONE GATE AT A TIME', size: 0.16, color: '#9a1b1b' }], { x: 21, y: 2.35, z: -1.84, w: 1.4, h: 0.5, facing: '+z', bg: '#d6d0b8', fg: '#111' });
    wallSign(corr.group, [{ text: 'CHOW HALL', size: 0.4 }, { text: '→', size: 0.35 }], { x: 29, y: 2.6, z: -2.0 + 0.0, w: 1.2, h: 0.55, facing: '+z', bg: '#1d2a40', fg: '#e8e2d0', border: false });
    wallSign(corr.group, [{ text: 'INTAKE · PROPERTY', size: 0.32 }, { text: 'AUTHORIZED PERSONNEL', size: 0.14 }], { x: 36, y: 2.95, z: 2.16, w: 1.9, h: 0.5, facing: '-z', bg: '#d6d0b8', fg: '#111', accent: '#7a0f0f' });
    wallSign(corr.group, [{ text: 'VISITATION', size: 0.34 }, { text: 'RESTRICTED — NOT IN THIS DEMO', size: 0.12, color: '#9a1b1b' }], { x: 49.8, y: 2.5, z: 0, w: 1.6, h: 0.6, facing: '-x', bg: '#d6d0b8', fg: '#111' });
    wallSign(corr.group, ['CAMERA ACTIVE'], { x: 20.0, y: 2.95, z: 1.82, w: 0.9, h: 0.25, facing: '-z', bg: '#1a1a1a', fg: '#c93030', border: false });
    // security camera (decor) in sally port
    B.box(20.5, 3.15, -1.8, 0.28, 0.14, 0.14, 'black'); B.cyl(20.5, 3.3, -1.8, 0.03, 0.03, 0.2, 'steel');
    B.build(corr.group);
    // doors
    ctx.sallyG1 = slideGate(world, corr, 'gate-sally-1', { wallDir: 'z', at: 18.3, centre: 0, w: 2.7, h: 3.1, label: 'sally gate', slideSign: 1 });
    ctx.sallyG2 = slideGate(world, corr, 'gate-sally-2', { wallDir: 'z', at: 24.15, centre: 0, w: 2.7, h: 3.1, label: 'checkpoint gate', slideSign: 1 });
    ctx.visitDoor = swingDoor(world, corr, 'door-visit', { wallDir: 'z', at: 50.15, centre: 0, w: 1.8, h: 2.4, locked: true, label: 'visitation door', swing: -1 });
    ctx.canteenDoor = swingDoor(world, corr, 'door-canteen', { wallDir: 'x', at: -2.15, centre: 29.05, w: 2.0, h: 2.3, hinge: -1, swing: -1, label: 'mess hall door' });
  }
  marks.sallyPort = new THREE.Vector3(21, 0, 0);

  // ======================= mess hall ========================================================
  const can = world.addArea('canteen', [24, -16.6, 42.4, -2.0], { neighbors: ['eastCorr'], reverb: 0.6, yRange: [-0.5, 6] });
  {
    const B = new Batch();
    can.surface = 'concrete';
    room(B, world, { x0: 24.3, z0: -16.3, x1: 42, z1: -2.3, h: 4.2, floor: 'lino', wallMat: 'wallGreen', skip: ['s'], ops: {} });
    // high windows east wall
    for (const z of [-13, -8, -4]) {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.9), ctx.windowMat);
      pane.position.set(41.98, 3.3, z); pane.rotation.y = -Math.PI / 2; can.group.add(pane);
      B.box(41.9, 3.3, z, 0.12, 1.1, 2.0, 'steel');
      for (let b = -4; b <= 4; b++) B.box(41.86, 3.3, z + b * 0.2, 0.04, 0.9, 0.04, 'bars');
    }
    // serving counter + kitchen
    B.slab(25.6, 0, -14.2, 34.5, 0.92, -13.5, 'steelLight');
    B.slab(25.5, 0.92, -14.3, 34.6, 0.97, -13.4, 'steel');
    B.slab(25.6, 1.5, -14.15, 34.5, 1.55, -13.6, 'glass');
    B.box(30, 2.3, -14.0, 9, 0.5, 0.04, 'steel');
    for (let i = 0; i < 4; i++) { // hot pans
      B.box(26.8 + i * 2.0, 0.99, -13.9, 1.2, 0.1, 0.5, 'steel');
      B.box(26.8 + i * 2.0, 1.04, -13.9, 1.1, 0.04, 0.42, i % 2 ? 'canvasOrange' : 'paper');
    }
    for (let i = 0; i < 6; i++) B.box(34.2 - i * 0.02, 0.975 + i * 0.012, -13.75, 0.4, 0.015, 0.3, 'steelLight');   // trays stack
    world.addCollider(25.5, 0, -14.3, 34.6, 1.6, -13.4, { sight: false });
    // kitchen back: stoves, hood, prep tables, hanging pots
    B.slab(25, 0, -16.3, 33, 0.9, -15.4, 'steel');
    for (let i = 0; i < 4; i++) { B.cyl(26 + i * 1.6, 1.0, -15.85, 0.28, 0.28, 0.2, 'steelLight', { seg: 14 }); }
    B.slab(24.8, 2.2, -16.3, 33.4, 2.9, -15.0, 'steel');
    B.slab(34.7, 0, -16.3, 36, 2.4, -14.8, 'steel');
    for (let i = 0; i < 5; i++) B.cyl(26 + i * 1.4, 2.1, -15.0, 0.12, 0.14, 0.18, 'steelLight', { seg: 10 });
    B.slab(36.2, 0, -16.3, 41.8, 0.9, -15.0, 'steelLight');
    world.addCollider(25, 0, -16.3, 33, 1.0, -15.4, { sight: false });
    world.addCollider(34.7, 0, -16.3, 36, 2.4, -14.8, { sight: false });
    world.addCollider(36.2, 0, -16.3, 41.8, 0.95, -15.0, { sight: false });
    // dining tables
    const tables = [[28.4, -6.8], [33, -6.8], [37.6, -6.8], [28.4, -10.6], [33, -10.6], [37.6, -10.6]];
    for (const [tx, tz] of tables) {
      steelTable(B, world, tx, 0, tz, { alongX: true });
      B.box(tx - 0.5, 0.8, tz + 0.12, 0.34, 0.025, 0.24, 'steelLight'); // tray
      B.box(tx + 0.4, 0.8, tz - 0.1, 0.34, 0.025, 0.24, 'steelLight');
    }
    marks.tables = tables;
    // commissary window
    B.slab(40.4, 0, -12.2, 42, 1.05, -8.4, 'steelLight');
    B.slab(40.4, 1.05, -12.2, 42, 3.0, -12.0, 'steel'); B.slab(40.4, 1.05, -8.6, 42, 3.0, -8.4, 'steel');
    B.slab(40.5, 1.6, -12.0, 41.9, 3.0, -8.6, 'black');
    B.slab(40.5, 1.55, -12.0, 40.9, 3.0, -8.6, 'glass');
    for (let b = 0; b < 9; b++) B.box(40.5, 2.3, -12.0 + b * 0.4, 0.03, 1.4, 0.03, 'bars');
    world.addCollider(40.4, 0, -12.2, 42, 3.0, -8.4, { sight: false });
    wallSign(can.group, [{ text: 'COMMISSARY', size: 0.42 }, { text: 'CASH · DC ONLY · NO CREDIT', size: 0.14, color: '#9a1b1b' }], { x: 40.35, y: 2.95, z: -10.3, w: 2.0, h: 0.55, facing: '-x', bg: '#d6d0b8', fg: '#111' });
    // shelves of goods inside window (emissive-ish lit)
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) B.box(41.4, 1.45 + r * 0.32, -11.6 + c * 0.55, 0.26, 0.22, 0.3, (r + c) % 3 === 0 ? 'canvasOrange' : (r + c) % 3 === 1 ? 'white' : 'leather');
    // water fountain + bucket + mop
    B.box(24.9, 0.9, -3.2, 0.5, 0.22, 0.5, 'steelLight'); B.box(24.9, 0.45, -3.2, 0.3, 0.9, 0.3, 'steel');
    marks.fountain2 = new THREE.Vector3(25.5, 1.0, -3.2);
    B.cyl(40.2, 0.2, -3.2, 0.24, 0.2, 0.4, 'canvasOrange', { seg: 10 });
    B.cyl(40.5, 0.65, -3.0, 0.015, 0.015, 1.3, 'wood', { seg: 5, tint: 0xaa9977 });
    marks.mop = new THREE.Vector3(40.4, 0.9, -3.3);
    // grime on lino: stain spots needing mopping (decals toggled by game)
    marks.stains = [[30.5, -4.6], [35.5, -4.4], [39, -5.0], [33.5, -8.5]].map(([x, z]) => new THREE.Vector3(x, 0.02, z));
    marks.stainMeshes = [];
    // signs
    wallSign(can.group, [{ text: 'MESS HALL', size: 0.5 }, { text: 'NO TRADING FOOD', size: 0.16, color: '#9a1b1b' }], { x: 33, y: 3.5, z: -2.45, w: 2.2, h: 0.7, facing: '+z', bg: '#d6d0b8', fg: '#111' });
    wallSign(can.group, [{ text: 'SERVE LINE', size: 0.36 }], { x: 30, y: 2.85, z: -14.22, w: 1.2, h: 0.3, facing: '+z', bg: '#1a1a1a', fg: '#d6d0b8', border: false });
    // roof detail
    pipeRun(B, { from: [24.3, 3.9, -3], to: [42, 3.9, -3], r: 0.08, mat: 'pipe' });
    pipeRun(B, { from: [24.3, 3.8, -13], to: [42, 3.8, -13], r: 0.06, mat: 'pipe' });
    // lights (bright, institutional)
    can.fixtures = [];
    for (const lx of [28.5, 33.5, 38.5]) for (const lz of [-6.5, -11]) {
      can.fixtures.push(ceilingLight(world, can, B, { x: lx, y: 4.1, z: lz, len: 1.5, intensity: 70, range: 11, poolW: 5, poolD: 3, drop: 0.4, glow: 0.5 }));
    }
    can.fixtures.push(ceilingLight(world, can, B, { x: 30, y: 3.2, z: -15.6, len: 1.2, intensity: 22, range: 6, color: 0xffd9a0, warm: true, poolW: 4, poolD: 2, drop: 0.3 }));
    B.quad(32, 0.014, -8.5, 10, 6, '+y', 'dStain', { tint: 0x887766 });
    B.build(can.group);
    marks.tray = new THREE.Vector3(31, 1.05, -13.1);
    marks.commissary = new THREE.Vector3(40.0, 1.3, -10.3);
    marks.tuck = new THREE.Vector3(29.5, 0, -14.9);
    marks.cutterSeat = new THREE.Vector3(37.6, 0, -6.05);
  }

  // ======================= intake lobby =====================================================
  const intake = world.addArea('intake', [29.7, 2.0, 44.6, 10.4], { neighbors: ['eastCorr', 'records'], reverb: 0.5, yRange: [-0.5, 5] });
  {
    const B = new Batch();
    room(B, world, { x0: 30, z0: 2.3, x1: 44, z1: 10, h: 3.4, floor: 'floorDark', wallMat: 'wallGrey', skip: ['n'], ops: { e: [[5.5, 6.55, 2.3]] } });
    // processing desk (counter with glass) across the room
    B.slab(32, 0, 5.6, 40, 1.05, 6.3, 'steelLight');
    B.slab(31.9, 1.05, 5.55, 40.1, 1.12, 6.35, 'woodDark');
    B.slab(32, 1.12, 5.7, 40, 2.4, 5.78, 'glass');
    for (let k = 0; k <= 8; k++) B.box(32 + k, 1.75, 5.74, 0.05, 1.3, 0.05, 'steel');
    B.slab(31.8, 1.12, 5.6, 32.0, 2.4, 5.8, 'steel');
    world.addCollider(31.9, 0, 5.55, 40.1, 1.2, 6.35, { sight: false });
    world.addCollider(31.9, 0, 5.55, 32.1, 2.4, 6.35, { sight: false });   // east/west ends
    // gap in the counter at x[40.1,41.5] leads behind the desk (staff only)
    B.slab(40.1, 0, 5.55, 41.2, 1.05, 6.3, 'steelLight');
    world.addCollider(40.1, 0, 5.55, 41.2, 1.2, 6.3, { sight: false });
    // staff side: desk, chair, computer, filing, lamp
    B.slab(33, 0, 7.6, 39, 0.8, 8.6, 'woodDark');
    B.box(36, 1.2, 8.2, 0.6, 0.4, 0.05, 'black'); B.box(36, 1.2, 8.18, 0.55, 0.35, 0.01, 'screenGreen');
    B.box(34, 0.9, 8.1, 0.4, 0.12, 0.3, 'paper'); B.cyl(38.2, 0.95, 8.1, 0.05, 0.07, 0.35, 'steel', { seg: 8 });
    B.box(38.2, 1.15, 8.1, 0.2, 0.08, 0.15, 'bulb');
    world.addCollider(33, 0, 7.6, 39, 0.9, 8.6, { sight: false });
    filingCabinet(B, world, 33.0, 0, 9.7, { facing: '-z', w: 0.5 });
    filingCabinet(B, world, 33.6, 0, 9.7, { facing: '-z', w: 0.5 });
    filingCabinet(B, world, 41, 0, 9.7, { facing: '-z', w: 0.5 });
    // benches (waiting) + holding cage
    for (const bz of [3.2, 4.3]) { B.slab(30.4, 0.42, bz, 32.8, 0.5, bz + 0.4, 'woodDark'); B.box(31.0, 0.2, bz + 0.2, 0.1, 0.4, 0.3, 'steel'); B.box(32.2, 0.2, bz + 0.2, 0.1, 0.4, 0.3, 'steel'); world.addCollider(30.4, 0, bz, 32.8, 0.5, bz + 0.4, { sight: false }); }
    // cage SE corner
    for (let k = 0; k <= 14; k++) { B.cyl(41.4 + k * 0.1, 1.2, 8.0, 0.012, 0.012, 2.4, 'bars', { seg: 5 }); }
    for (let k = 0; k <= 10; k++) B.cyl(41.4, 1.2, 8.0 + k * 0.2, 0.012, 0.012, 2.4, 'bars', { seg: 5 });
    B.box(42.1, 2.4, 8.0, 1.5, 0.05, 0.05, 'bars'); B.box(41.4, 2.4, 9.0, 0.05, 0.05, 2.0, 'bars');
    world.addCollider(41.35, 0, 7.95, 42.9, 2.4, 8.05, { sight: false, tag: 'bars' });
    world.addCollider(41.35, 0, 7.95, 41.45, 2.4, 10.0, { sight: false, tag: 'bars' });
    B.slab(42.9, 0.42, 9.4, 44, 0.5, 9.9, 'woodDark');
    // posters
    wallSign(intake.group, [{ text: 'INTAKE', size: 0.55 }, { text: 'PROPERTY · PHOTO · PRINTS', size: 0.14 }], { x: 37, y: 2.65, z: 9.84, w: 2.2, h: 0.7, facing: '-z', bg: '#d6d0b8', fg: '#111', accent: '#7a0f0f' });
    wallSign(intake.group, [{ text: 'NO WEAPONS', size: 0.3 }, { text: 'NO CELL PHONES', size: 0.3 }, { text: 'NO EXCEPTIONS', size: 0.2, color: '#9a1b1b' }], { x: 30.17, y: 1.9, z: 7.6, w: 1.2, h: 0.9, facing: '+x', bg: '#d6d0b8', fg: '#111' });
    wallSign(intake.group, [{ text: 'RECORDS', size: 0.36 }, { text: 'KEYCARD REQUIRED', size: 0.13, color: '#9a1b1b' }], { x: 43.82, y: 2.55, z: 6.0, w: 1.0, h: 0.4, facing: '-x', bg: '#1a1a1a', fg: '#d6d0b8', border: false });
    pipeRun(B, { from: [30, 3.2, 2.5], to: [44, 3.2, 2.5], r: 0.05, mat: 'pipe' });
    intake.fixtures = [];
    for (const [lx, lz] of [[33.5, 4.4], [38, 4.2], [37, 8.4], [41.5, 4.2]]) intake.fixtures.push(ceilingLight(world, intake, B, { x: lx, y: 3.3, z: lz, len: 1.3, intensity: 26, range: 9, flicker: lx > 41 ? 0.5 : 0, poolW: 4, poolD: 2.4, drop: 0.35 }));
    B.quad(37, 0.014, 4.0, 8, 2.6, '+y', 'dStain', { tint: 0x666666 });
    B.build(intake.group);
    marks.pruittDesk = new THREE.Vector3(36, 0, 7.0);
    marks.pruittFace = new THREE.Vector3(36, 1.5, 5.0);
    marks.intakeDeskFront = new THREE.Vector3(36, 1.2, 4.9);
    ctx.recordsDoor = swingDoor(world, intake, 'door-records', { wallDir: 'z', at: 44.15, centre: 6.02, w: 1.05, h: 2.3, locked: true, requires: 'keycard', hinge: 1, swing: 1, reader: true, label: 'Records Room door' });
  }

  // ======================= records room ====================================================
  const rec = world.addArea('records', [44, 2.0, 52.2, 10.4], { neighbors: ['intake'], reverb: 0.35, yRange: [-0.5, 5] });
  {
    const B = new Batch();
    room(B, world, { x0: 44.3, z0: 2.3, x1: 51.8, z1: 10, h: 3.4, floor: 'floorDark', wallMat: 'wallGrey', skip: ['n', 'w'], ops: {} });
    // back wall of lobby side seals west wall: opening is the door
    // rows of cabinets
    for (let i = 0; i < 6; i++) filingCabinet(B, world, 45.0 + i * 0.55, 0, 9.65, { facing: '-z', w: 0.5 });
    for (let i = 0; i < 5; i++) filingCabinet(B, world, 51.55, 0, 3.4 + i * 0.55, { facing: '-x', w: 0.5 });
    // shelves w/ boxes
    for (let i = 0; i < 4; i++) { B.slab(44.4, 0.3 + i * 0.5, 2.4, 44.9, 0.34 + i * 0.5, 4.8, 'steel'); for (let j = 0; j < 4; j++) B.box(44.65, 0.5 + i * 0.5, 2.8 + j * 0.55, 0.3, 0.3, 0.4, (i + j) % 2 ? 'paper' : 'canvasOrange'); }
    world.addCollider(44.3, 0, 2.3, 44.9, 2.0, 4.8, { sight: false });
    // central table with the ledger
    B.slab(47, 0, 5.2, 49.6, 0.85, 6.6, 'woodDark');
    B.box(48.3, 0.88, 5.9, 0.5, 0.05, 0.36, 'leather'); B.box(48.3, 0.915, 5.9, 0.46, 0.02, 0.32, 'paper');
    B.box(47.4, 0.9, 5.5, 0.3, 0.06, 0.22, 'paper'); B.cyl(49.2, 0.95, 6.2, 0.05, 0.06, 0.2, 'steel', { seg: 8 });
    B.box(49.2, 1.12, 6.2, 0.16, 0.08, 0.12, 'bulb');
    world.addCollider(47, 0, 5.2, 49.6, 0.9, 6.6, { sight: false });
    marks.ledger = new THREE.Vector3(48.3, 0.95, 5.9);
    // terminal desk
    B.slab(49.8, 0, 8.7, 51.6, 0.8, 9.6, 'woodDark');
    B.box(50.7, 1.15, 9.3, 0.6, 0.4, 0.05, 'black'); B.box(50.7, 1.15, 9.27, 0.55, 0.35, 0.01, 'screenGreen');
    world.addCollider(49.8, 0, 8.7, 51.6, 0.9, 9.6, { sight: false });
    // ceiling camera (sweeping) mount in NE corner
    B.box(51.55, 3.15, 2.55, 0.16, 0.16, 0.16, 'steel');
    marks.camPos = new THREE.Vector3(51.4, 3.0, 2.6);
    ctx.recCamHead = new THREE.Group(); ctx.recCamHead.position.copy(marks.camPos); rec.group.add(ctx.recCamHead);
    { const cb = new Batch(); cb.box(0, 0, -0.15, 0.14, 0.14, 0.36, 'black'); cb.box(0, 0, -0.34, 0.1, 0.1, 0.05, 'steel'); cb.box(0, 0, -0.36, 0.04, 0.04, 0.02, 'redLamp'); cb.build(ctx.recCamHead); }
    wallSign(rec.group, [{ text: 'RECORDS', size: 0.5 }, { text: 'STATE PROPERTY', size: 0.15 }], { x: 47.5, y: 2.6, z: 9.84, w: 1.8, h: 0.55, facing: '-z', bg: '#d6d0b8', fg: '#111', accent: '#7a0f0f' });
    wallSign(rec.group, [{ text: 'TRANSFER ORDERS', size: 0.28 }, { text: 'PENDING — A. THORNE', size: 0.14 }, { text: '15 OCT', size: 0.2 }], { x: 51.62, y: 1.75, z: 6.4, w: 1.2, h: 0.8, facing: '-x', bg: '#d6d0b8', fg: '#111', accent: '#7a0f0f' });
    rec.fixtures = [ceilingLight(world, rec, B, { x: 47.5, y: 3.3, z: 6.4, len: 1.3, intensity: 20, range: 8, poolW: 4, poolD: 2.4, drop: 0.35, color: 0xcfe6dc, flicker: 0.25 })];
    rec.fixtures.push(world.addFixture({ pos: new THREE.Vector3(49.2, 1.3, 6.2), color: 0xffc56e, intensity: 5, range: 4.5, area: 'records' }));
    rec.fixtures.push(world.addFixture({ pos: new THREE.Vector3(50.7, 1.15, 9.0), color: 0x6dffa8, intensity: 2.2, range: 3, area: 'records' }));
    B.quad(48, 0.014, 6, 4.5, 3, '+y', 'dStain', { tint: 0x666666 });
    B.build(rec.group);
  }
  return { corr, can, intake, rec };
}
