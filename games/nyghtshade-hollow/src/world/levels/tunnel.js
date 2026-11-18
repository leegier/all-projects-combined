// The baptismal tunnel: shaft + stairs under the chapel, a brick passage north then west, ending at a culvert mouth in the forest.
import * as THREE from 'three';
import { Batch } from '../geo.js';
import { MAT } from '../../proc/materials.js';
import { glowSprite } from '../../core/gfx.js';
import { pipeRun } from '../props.js';

export function buildTunnel(world, ctx) {
  const marks = ctx.marks;
  const t1 = world.addArea('tunnel1', [-56.4, -25.4, -53.6, -4.9], { neighbors: ['chapel', 'tunnel2'], reverb: 0.9, yRange: [-4.2, -0.45], tag: 'tunnel' });
  const t2 = world.addArea('tunnel2', [-77.2, -25.4, -53.6, -22.6], { neighbors: ['tunnel1', 'outside'], reverb: 0.9, yRange: [-4.2, -0.45], tag: 'tunnel' });
  t1.surface = t2.surface = 'stone';
  const FLOOR = -3.2, CEIL = -1.15;
  const B1 = new Batch(), B2 = new Batch();
  // ---- stair: x[-55.9,-54.1] z[-9.2,-5.0] ----------------------------------------------------
  {
    const B = B1;
    const steps = 18, z0 = -5.0, z1 = -9.0, dz = (z1 - z0) / steps;
    for (let i = 0; i < steps; i++) {
      const top = -(3.2 / steps) * (i + 1);
      const zc = z0 + dz * (i + 0.5);
      B.box(-55.0, top - 0.15, zc, 1.8, 0.3, Math.abs(dz) + 0.01, 'stone');
    }
    world.addSurface(-55.9, -9.2, -54.1, -5.0, FLOOR, 0, 'z');
    B.slab(-55.9, FLOOR - 0.5, -9.2, -54.1, FLOOR, -8.9, 'stone');
    // handrail rope posts + damp
    B.box(-55.85, -1.0, -6.1, 0.05, 1.0, 0.05, 'wood'); B.box(-55.85, -2.0, -8.0, 0.05, 1.0, 0.05, 'wood');
    B.box(-55.82, -1.2, -7.05, 0.04, 0.04, 2.5, 'wood', { rotX: 0.5 });
  }
  const passage = (B, area, x0, z0, x1, z1, axis, gap = null) => {
    B.slab(x0 - 0.3, FLOOR - 0.5, z0 - 0.3, x1 + 0.3, FLOOR, z1 + 0.3, 'stone');
    B.slab(x0 - 0.3, CEIL, z0 - 0.3, x1 + 0.3, CEIL + 0.5, z1 + 0.3, 'brick');
    if (axis === 'z') {
      B.slab(x0 - 0.3, FLOOR, z0 - 0.3, x0, CEIL, z1 + 0.3, 'brick');
      B.slab(x1, FLOOR, z0 - 0.3, x1 + 0.3, CEIL, z1 + 0.3, 'brick');
      world.addCollider(x0 - 0.3, -4, z0, x0, -0.9, z1, { tag: 'wall' });
      world.addCollider(x1, -4, z0, x1 + 0.3, -0.9, z1, { tag: 'wall' });
    } else {
      B.slab(x0, FLOOR, z0 - 0.3, x1, CEIL, z0, 'brick');
      const segs = gap ? [[x0, gap[0]], [gap[1], x1]] : [[x0, x1]];
      for (const [a, b] of segs) { B.slab(a, FLOOR, z1, b, CEIL, z1 + 0.3, 'brick'); world.addCollider(a, -4, z1, b, -0.9, z1 + 0.3, { tag: 'wall' }); }
      world.addCollider(x0, -4, z0 - 0.3, x1, -0.9, z0, { tag: 'wall' });
    }
    world.addSurface(x0, z0, x1, z1, FLOOR);
    // timber supports
    if (axis === 'z') for (let z = z0 + 1.5; z < z1; z += 3.2) { B.box(x0 + 0.08, (FLOOR + CEIL) / 2, z, 0.16, CEIL - FLOOR, 0.16, 'wood'); B.box(x1 - 0.08, (FLOOR + CEIL) / 2, z, 0.16, CEIL - FLOOR, 0.16, 'wood'); B.box((x0 + x1) / 2, CEIL - 0.08, z, x1 - x0, 0.16, 0.18, 'wood'); }
    else for (let x = x0 + 1.5; x < x1; x += 3.2) { B.box(x, (FLOOR + CEIL) / 2, z0 + 0.08, 0.16, CEIL - FLOOR, 0.16, 'wood'); B.box(x, (FLOOR + CEIL) / 2, z1 - 0.08, 0.16, CEIL - FLOOR, 0.16, 'wood'); B.box(x, CEIL - 0.08, (z0 + z1) / 2, 0.18, 0.16, z1 - z0, 'wood'); }
  };
  // T1: north from the shaft foot
  passage(B1, t1, -55.9, -23.1, -54.1, -9.2, 'z');
  // cables, pipe, puddles, stains
  pipeRun(B1, { from: [-54.2, -1.5, -9.2], to: [-54.2, -1.5, -23.1], r: 0.05, mat: 'pipe' });
  for (const [px, pz, s] of [[-55.0, -12.5, 1.1], [-54.9, -17.2, 1.4], [-55.1, -21.5, 0.9]]) {
    const p = new THREE.Mesh(new THREE.CircleGeometry(s * 0.5, 14), MAT.puddle);
    const col = new Float32Array(p.geometry.attributes.position.count * 3).fill(1); p.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
    p.rotation.x = -Math.PI / 2; p.position.set(px, FLOOR + 0.012, pz); p.scale.set(1.2, 1, 1); t1.group.add(p);
  }
  B1.quad(-55.0, FLOOR + 0.02, -15, 1.6, 6, '+y', 'dStain', { tint: 0x332a20 });
  // corner + T2 west
  passage(B2, t2, -76.3, -24.9, -54.1, -23.1, 'x', [-55.9, -54.1]);
  B2.slab(-54.1, FLOOR, -25.2, -53.8, CEIL, -22.8, 'brick');
  world.addCollider(-54.1, -4, -25.2, -53.8, -0.9, -22.8, { tag: 'wall' });
  // end-cap of T1 where it meets T2 — T1 is open to T2 via the shared corner so no cap.
  pipeRun(B2, { from: [-54.1, -1.5, -23.3], to: [-76.3, -1.5, -23.3], r: 0.05, mat: 'pipe' });
  for (const [px, pz, s] of [[-60, -24.1, 1.3], [-66.5, -23.9, 1.7], [-72.5, -24.1, 1.0]]) {
    const p = new THREE.Mesh(new THREE.CircleGeometry(s * 0.5, 14), MAT.puddle);
    const col = new Float32Array(p.geometry.attributes.position.count * 3).fill(1); p.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
    p.rotation.x = -Math.PI / 2; p.position.set(px, FLOOR + 0.012, pz); p.scale.set(1.4, 1, 0.9); t2.group.add(p);
  }
  // portal at the mouth (x = -76.3): stone frame + rusted gate leaning open
  B2.slab(-76.7, FLOOR - 0.5, -25.8, -76.3, CEIL + 0.9, -22.2, 'stone');
  B2.slab(-76.7, FLOOR, -25.8, -76.3, CEIL + 0.9, -25.0, 'stone');
  // (opening z[-25,-23]) sides done above; lintel:
  B2.slab(-76.7, CEIL - 0.1, -25.0, -76.3, CEIL + 0.9, -23.0, 'stone');
  B2.slab(-76.7, FLOOR, -23.0, -76.3, CEIL + 0.9, -22.2, 'stone');
  for (let k = 0; k < 8; k++) B2.cyl(-76.0, (FLOOR + CEIL) / 2, -24.85 + k * 0.1, 0.012, 0.012, CEIL - FLOOR, 'bars', { seg: 5 });
  world.addCollider(-76.7, -4, -25.8, -76.3, 2, -25.0, { tag: 'wall' });
  world.addCollider(-76.7, -4, -23.0, -76.3, 2, -22.2, { tag: 'wall' });
  // stone apron outside the portal so the floor surface continues onto the gully
  B2.slab(-78.2, FLOOR - 0.5, -25.4, -76.3, FLOOR, -22.6, 'stone');
  world.addSurface(-78.2, -25.4, -76.2, -22.6, FLOOR);
  // lamps
  t1.fixtures = []; t2.fixtures = [];
  const lamp = (B, area, x, y, z, arr) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), MAT.bulb); m.position.set(x, y, z); area.group.add(m);
    area.group.add(glowSprite(new THREE.Vector3(x, y, z), 1.3, 0xffb866, 0.55));
    B.cyl(x, y + 0.25, z, 0.012, 0.012, 0.5, 'steel', { seg: 4 });
    arr.push(world.addFixture({ pos: new THREE.Vector3(x, y - 0.1, z), color: 0xffb35a, intensity: 5.5, range: 8, flicker: 0.25, area: area.name }));
  };
  lamp(B1, t1, -55.0, -1.6, -6.6, t1.fixtures); lamp(B1, t1, -55.0, -1.6, -13.5, t1.fixtures); lamp(B1, t1, -55.0, -1.6, -21.0, t1.fixtures);
  lamp(B2, t2, -60.0, -1.6, -24.0, t2.fixtures); lamp(B2, t2, -67.0, -1.6, -24.0, t2.fixtures);
  B1.build(t1.group); B2.build(t2.group);
  marks.tunnelStart = new THREE.Vector3(-55, 0, -5.4);
  marks.tunnelFoot = new THREE.Vector3(-55, FLOOR, -9.6);
  marks.tunnelCorner = new THREE.Vector3(-55, FLOOR, -24);
  marks.tunnelMouth = new THREE.Vector3(-75.6, FLOOR, -24);
  return { t1, t2 };
}
