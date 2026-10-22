// Bakes a posed body (procedural Humanoid or a skinned glTF character) into a few static, merged meshes — one per distinct material — so a
// crowd of background characters costs a handful of draw calls each, with no skinning and no per-frame animation.
//   const { parts, tris } = bakeBody(body.root, { materials, skip: (o) => o === body.blob });
//   parts = [{ geo, mat }]  geometry is expressed in `root`'s local space (so the baked group is placed exactly like the body's root).
import * as THREE from 'three';

const _inv = new THREE.Matrix4(), _toRoot = new THREE.Matrix4(), _nm = new THREE.Matrix3();
const _p = new THREE.Vector3(), _n = new THREE.Vector3(), _bp = new THREE.Vector3(), _bn = new THREE.Vector3(), _ap = new THREE.Vector3(), _an = new THREE.Vector3(), _t = new THREE.Vector3();

/** Materials with the same key render identically, so baked bodies can share one instance (fewer GPU state changes and programs). */
export function materialKey(m) {
  const id = (x) => (x ? x.uuid : '');
  return [m.type, m.color ? m.color.getHex() : '', id(m.map), id(m.normalMap), id(m.roughnessMap), id(m.metalnessMap), id(m.alphaMap), id(m.aoMap), m.roughness, m.metalness,
    m.emissive ? m.emissive.getHex() : '', m.emissiveIntensity, m.transparent ? m.opacity : 1, m.side, m.vertexColors ? 1 : 0, m.alphaTest, m.alphaToCoverage ? 1 : 0, m.depthWrite ? 1 : 0,
    m.normalScale ? m.normalScale.x : '', m.envMapIntensity].join('|');
}

const hiddenAbove = (o, root) => { for (let p = o; p; p = p.parent) { if (p.visible === false) return true; if (p === root) break; } return false; };

/** Vertex positions / normals of one mesh in root space (skinning evaluated on the CPU for SkinnedMesh). */
function evaluate(o, root) {
  const geo = o.geometry, pos = geo.attributes.position, nrm = geo.attributes.normal, n = pos.count;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3);
  _toRoot.multiplyMatrices(_inv, o.matrixWorld); _nm.getNormalMatrix(_toRoot);
  if (o.isSkinnedMesh && o.skeleton && geo.attributes.skinIndex && geo.attributes.skinWeight) {
    const si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight, bones = o.skeleton.bones, inv = o.skeleton.boneInverses;
    const B = bones.map((b, i) => new THREE.Matrix4().multiplyMatrices(b.matrixWorld, inv[i]));          // bone world * inverse bind
    for (let i = 0; i < n; i++) {
      _bp.fromBufferAttribute(pos, i).applyMatrix4(o.bindMatrix);
      if (nrm) _bn.fromBufferAttribute(nrm, i).transformDirection(o.bindMatrix); else _bn.set(0, 1, 0);
      _ap.set(0, 0, 0); _an.set(0, 0, 0);
      for (let k = 0; k < 4; k++) {
        const w = sw.getComponent(i, k); if (w === 0) continue;
        const m = B[si.getComponent(i, k)];
        _ap.addScaledVector(_t.copy(_bp).applyMatrix4(m), w);
        _an.addScaledVector(_t.copy(_bn).transformDirection(m), w);
      }
      _ap.applyMatrix4(o.bindMatrixInverse); _an.transformDirection(o.bindMatrixInverse);
      _p.copy(_ap).applyMatrix4(_toRoot); _n.copy(_an).applyMatrix3(_nm).normalize();
      P[i * 3] = _p.x; P[i * 3 + 1] = _p.y; P[i * 3 + 2] = _p.z; N[i * 3] = _n.x; N[i * 3 + 1] = _n.y; N[i * 3 + 2] = _n.z;
    }
  } else {
    for (let i = 0; i < n; i++) {
      _p.fromBufferAttribute(pos, i).applyMatrix4(_toRoot);
      if (nrm) _n.fromBufferAttribute(nrm, i).applyMatrix3(_nm).normalize(); else _n.set(0, 1, 0);
      P[i * 3] = _p.x; P[i * 3 + 1] = _p.y; P[i * 3 + 2] = _p.z; N[i * 3] = _n.x; N[i * 3 + 1] = _n.y; N[i * 3 + 2] = _n.z;
    }
  }
  return { P, N, n, flip: _toRoot.determinant() < 0 };
}

/**
 * @param {THREE.Object3D} root  a posed body; its current world matrices are used (updated here)
 * @param {{materials?:Map<string,THREE.Material>, skip?:(o:THREE.Object3D)=>boolean}} opts  `materials` is the shared dedupe cache (pass the same Map for every bake)
 * @returns {{parts:{geo:THREE.BufferGeometry, mat:THREE.Material}[], tris:number, box:THREE.Box3}}
 */
export function bakeBody(root, { materials = new Map(), skip = null } = {}) {
  root.updateMatrixWorld(true);
  _inv.copy(root.matrixWorld).invert();
  const groups = new Map();
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.position || (skip && skip(o)) || hiddenAbove(o, root)) return;
    const geo = o.geometry, mats = Array.isArray(o.material) ? o.material : [o.material];
    const ev = evaluate(o, root), uv = geo.attributes.uv, col = geo.attributes.color;
    const ranges = Array.isArray(o.material) && geo.groups.length ? geo.groups.map((g) => ({ mat: mats[g.materialIndex], start: g.start, count: g.count })) : [{ mat: mats[0], start: 0, count: geo.index ? geo.index.count : ev.n }];
    for (const r of ranges) {
      if (!r.mat || r.mat.visible === false) continue;
      const key = materialKey(r.mat);
      let g = groups.get(key);
      if (!g) { if (!materials.has(key)) materials.set(key, r.mat); g = { mat: materials.get(key), P: [], N: [], U: [], C: [], I: [], v: 0, colors: !!r.mat.vertexColors }; groups.set(key, g); }
      const base = g.v;
      g.P.push(ev.P); g.N.push(ev.N);
      const U = new Float32Array(ev.n * 2); if (uv) for (let i = 0; i < ev.n; i++) { U[i * 2] = uv.getX(i); U[i * 2 + 1] = uv.getY(i); } g.U.push(U);
      if (g.colors) { const C = new Float32Array(ev.n * 3).fill(1); if (col) for (let i = 0; i < ev.n; i++) { C[i * 3] = col.getX(i); C[i * 3 + 1] = col.getY(i); C[i * 3 + 2] = col.getZ(i); } g.C.push(C); }
      const idx = new Uint32Array(r.count);
      for (let i = 0; i < r.count; i++) idx[i] = base + (geo.index ? geo.index.getX(r.start + i) : r.start + i);
      if (ev.flip) for (let i = 0; i < r.count; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
      g.I.push(idx); g.v += ev.n;
    }
  });
  const parts = []; let tris = 0; const box = new THREE.Box3();
  for (const g of groups.values()) {
    const cat = (arrs, Type, len) => { const out = new Type(len); let o = 0; for (const a of arrs) { out.set(a, o); o += a.length; } return out; };
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(cat(g.P, Float32Array, g.v * 3), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(cat(g.N, Float32Array, g.v * 3), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(cat(g.U, Float32Array, g.v * 2), 2));
    if (g.colors) geo.setAttribute('color', new THREE.BufferAttribute(cat(g.C, Float32Array, g.v * 3), 3));
    const total = g.I.reduce((s, a) => s + a.length, 0), I = cat(g.I, Uint32Array, total);
    geo.setIndex(new THREE.BufferAttribute(g.v > 65535 ? I : new Uint16Array(I), 1));
    geo.computeBoundingSphere(); geo.computeBoundingBox(); box.union(geo.boundingBox);
    tris += total / 3; parts.push({ geo, mat: g.mat });
  }
  return { parts, tris: Math.round(tris), box };
}
