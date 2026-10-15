// Static geometry batching with world-space UVs. Everything built through a Batch is merged into
// one mesh per material, which keeps draw calls low even with thousands of props.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MAT } from '../proc/materials.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

/** Rewrite UVs from world position + dominant normal axis; add white vertex colours. */
function finishGeo(g, mat, vBase = 0, shade = null, tint = null) {
  const pos = g.attributes.position, nor = g.attributes.normal;
  const tile = (mat && mat.userData.tile) || 1;
  const uv = new Float32Array(pos.count * 2);
  const col = new Float32Array(pos.count * 3);
  const noAutoUv = mat && mat.userData.keepUv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
    let u, v;
    if (ny >= nx && ny >= nz) { u = x / tile; v = z / tile; }
    else if (nx >= nz) { u = z / tile; v = (y - vBase) / tile; }
    else { u = x / tile; v = (y - vBase) / tile; }
    if (!noAutoUv) { uv[i * 2] = u; uv[i * 2 + 1] = v; }
    let c = 1;
    if (shade) { const t = THREE.MathUtils.clamp((y - shade.y0) / (shade.y1 - shade.y0 || 1), 0, 1); c = shade.a + (shade.b - shade.a) * t; }
    const tr = tint ? tint.r : 1, tg = tint ? tint.g : 1, tb = tint ? tint.b : 1;
    col[i * 3] = c * tr; col[i * 3 + 1] = c * tg; col[i * 3 + 2] = c * tb;
  }
  if (!noAutoUv) g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
  return g;
}

export class Batch {
  constructor() { this.parts = new Map(); this.count = 0; }

  _push(key, geo) {
    let a = this.parts.get(key);
    if (!a) this.parts.set(key, (a = []));
    a.push(geo);
    this.count++;
  }

  /** Axis-aligned box centred at (cx,cy,cz). opts: vBase (wall pattern base height), shade {a,b,y0,y1}, tint, rotY. */
  box(cx, cy, cz, w, h, d, key, opts = {}) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (opts.rotY) g.applyMatrix4(_m.makeRotationY(opts.rotY));
    if (opts.rotZ) g.applyMatrix4(_m.makeRotationZ(opts.rotZ));
    if (opts.rotX) g.applyMatrix4(_m.makeRotationX(opts.rotX));
    g.translate(cx, cy, cz);
    this._push(key, finishGeo(g, MAT[key], opts.vBase || 0, opts.shade || null, opts.tint ? new THREE.Color(opts.tint) : null));
    return g;
  }
  /** Box from min/max corners. */
  slab(x0, y0, z0, x1, y1, z1, key, opts = {}) {
    return this.box((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), key, opts);
  }
  cyl(cx, cy, cz, rTop, rBot, h, key, opts = {}) {
    const g = new THREE.CylinderGeometry(rTop, rBot, h, opts.seg || 10, 1, !!opts.open);
    if (opts.axis === 'x') g.rotateZ(Math.PI / 2);
    else if (opts.axis === 'z') g.rotateX(Math.PI / 2);
    g.translate(cx, cy, cz);
    this._push(key, finishGeo(g, MAT[key], 0, opts.shade || null, opts.tint ? new THREE.Color(opts.tint) : null));
    return g;
  }
  /** Arbitrary pre-built geometry placed at pos with euler rotation and scale. */
  geo(geometry, key, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1], opts = {}) {
    const g = geometry.index ? geometry.clone() : geometry.clone();
    _q.setFromEuler(_e.set(rot[0], rot[1], rot[2]));
    g.applyMatrix4(_m.compose(_p.set(pos[0], pos[1], pos[2]), _q, _s.set(scale[0], scale[1], scale[2])));
    this._push(key, finishGeo(g, MAT[key], opts.vBase || 0, opts.shade || null, opts.tint ? new THREE.Color(opts.tint) : null));
    return g;
  }
  /** A flat quad (decal / sign) facing `normal` ('+x','-x','+y','-y','+z','-z'), at p. */
  quad(px, py, pz, w, h, normal, key, opts = {}) {
    const g = new THREE.PlaneGeometry(w, h);
    const rot = { '+z': [0, 0, 0], '-z': [0, Math.PI, 0], '+x': [0, Math.PI / 2, 0], '-x': [0, -Math.PI / 2, 0], '+y': [-Math.PI / 2, 0, 0], '-y': [Math.PI / 2, 0, 0] }[normal];
    if (opts.roll) g.rotateZ(opts.roll);
    _q.setFromEuler(_e.set(rot[0], rot[1], rot[2]));
    g.applyQuaternion(_q);
    g.translate(px, py, pz);
    // decals keep the plane's own 0..1 UVs
    const m = MAT[key];
    const keep = m && (m.userData.decal || m.userData.keepUv);
    const saved = m && m.userData.keepUv;
    if (m && keep) m.userData.keepUv = true;
    finishGeo(g, m, 0, opts.shade || null, opts.tint ? new THREE.Color(opts.tint) : null);
    if (m && keep && !saved) delete m.userData.keepUv;
    this._push(key, g);
    return g;
  }

  /** Merge into meshes under `parent`. Returns created meshes. */
  build(parent, { cast = true, receive = true } = {}) {
    const meshes = [];
    for (const [key, geos] of this.parts) {
      const mat = MAT[key];
      if (!mat) throw new Error('Unknown material ' + key);
      const merged = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      const mesh = new THREE.Mesh(merged, mat);
      const decal = mat.userData.decal;
      mesh.castShadow = cast && !decal && !mat.transparent;
      mesh.receiveShadow = receive && !decal;
      if (decal) mesh.renderOrder = 2;
      if (mat.transparent && !decal) mesh.renderOrder = 3;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      mesh.name = 'batch:' + key;
      parent.add(mesh);
      meshes.push(mesh);
    }
    this.parts.clear();
    return meshes;
  }
}
