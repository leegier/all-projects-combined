// STAND-IN characters for testing the glTF character pipeline.  These are NOT MetaHumans: rigid-skinned mannequins on skeletons that
// are named and oriented the way real exports are (MetaHuman / UE5 names with bone-aligned X axes, or Mixamo names in a scaled,
// rotated, Z-up armature with centimetre units), so loader / bone mapping / orientation fix / rig driver / LOD can be exercised
// without any licensed asset.  Runs in a browser (needs FileReader/Blob for GLTFExporter); tools/make-standin.mjs drives it.
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const QC = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1));   // canonical -> Z-up local (cyclic permutation)

/** [name, parent, role|null, x, y, z] in the canonical frame: metres, +Y up, character faces +Z (so its left side is +X). */
function jointTable(style, k, pose, wide) {
  const T = [];
  const add = (name, parent, role, x, y, z) => T.push({ name, parent, role, p: V(x * k, y * k, z * k) });
  const mh = style === 'metahuman';
  const P = (n) => (mh ? n : 'mixamorig:' + n);
  if (mh) {
    add('root', null, null, 0, 0, 0);
    add('pelvis', 'root', 'hips', 0, 0.95, 0);
    add('spine_01', 'pelvis', 'spL', 0, 1.04, 0.005); add('spine_02', 'spine_01', null, 0, 1.13, 0.01); add('spine_03', 'spine_02', 'spM', 0, 1.23, 0.01);
    add('spine_04', 'spine_03', null, 0, 1.33, 0.005); add('spine_05', 'spine_04', 'spH', 0, 1.42, 0);
    add('neck_01', 'spine_05', 'neck', 0, 1.51, 0); add('neck_02', 'neck_01', null, 0, 1.57, 0.01); add('head', 'neck_02', 'head', 0, 1.63, 0.015);
    add('FACIAL_C_FacialRoot', 'head', null, 0, 1.69, 0.04); add('FACIAL_C_Jaw', 'FACIAL_C_FacialRoot', 'jaw', 0, 1.67, 0.03);
    add('FACIAL_L_Eye', 'FACIAL_C_FacialRoot', null, 0.032, 1.71, 0.08); add('FACIAL_R_Eye', 'FACIAL_C_FacialRoot', null, -0.032, 1.71, 0.08);
  } else {
    add(P('Hips'), null, 'hips', 0, 0.95, 0);
    add(P('Spine'), P('Hips'), 'spL', 0, 1.06, 0.005); add(P('Spine1'), P('Spine'), 'spM', 0, 1.22, 0.01); add(P('Spine2'), P('Spine1'), 'spH', 0, 1.38, 0);
    add(P('Neck'), P('Spine2'), 'neck', 0, 1.52, 0.01); add(P('Head'), P('Neck'), 'head', 0, 1.62, 0.015);
    add(P('Jaw'), P('Head'), 'jaw', 0, 1.67, 0.03);
  }
  const A = pose === 'A' ? Math.PI * 0.2 : pose === 'T' ? Math.PI / 2 : 0;     // arm abduction from hanging
  for (const [s, sx] of [['L', 1], ['R', -1]]) {
    const l = s.toLowerCase();
    const dir = V(sx * Math.sin(A), -Math.cos(A), 0.03);
    const clav = V(sx * 0.03, 1.455, 0.012), sh = V(sx * 0.185 * wide, 1.445, 0), el = sh.clone().addScaledVector(dir, 0.30), wr = el.clone().addScaledVector(dir, 0.26);
    const parentSpine = mh ? 'spine_05' : P('Spine2');
    if (mh) {
      add(`clavicle_${l}`, parentSpine, 'clav' + s, clav.x, clav.y, clav.z);
      add(`upperarm_${l}`, `clavicle_${l}`, 'arm' + s, sh.x, sh.y, sh.z);
      add(`upperarm_twist_01_${l}`, `upperarm_${l}`, null, ...sh.clone().lerp(el, 0.5).toArray());
      add(`upperarm_correctiveRoot_${l}`, `upperarm_${l}`, null, sh.x, sh.y, sh.z);
      add(`lowerarm_${l}`, `upperarm_${l}`, 'fore' + s, el.x, el.y, el.z);
      add(`lowerarm_twist_01_${l}`, `lowerarm_${l}`, null, ...el.clone().lerp(wr, 0.5).toArray());
      add(`hand_${l}`, `lowerarm_${l}`, 'hand' + s, wr.x, wr.y, wr.z);
      const f = wr.clone().addScaledVector(dir, 0.07); f.z += 0.01;
      add(`index_01_${l}`, `hand_${l}`, null, f.x, f.y, f.z); add(`thumb_01_${l}`, `hand_${l}`, null, wr.x - sx * 0.02, wr.y - 0.03, wr.z + 0.03);
    } else {
      add(P(`${s === 'L' ? 'Left' : 'Right'}Shoulder`), parentSpine, 'clav' + s, clav.x, clav.y, clav.z);
      add(P(`${s === 'L' ? 'Left' : 'Right'}Arm`), P(`${s === 'L' ? 'Left' : 'Right'}Shoulder`), 'arm' + s, sh.x, sh.y, sh.z);
      add(P(`${s === 'L' ? 'Left' : 'Right'}ForeArm`), P(`${s === 'L' ? 'Left' : 'Right'}Arm`), 'fore' + s, el.x, el.y, el.z);
      add(P(`${s === 'L' ? 'Left' : 'Right'}Hand`), P(`${s === 'L' ? 'Left' : 'Right'}ForeArm`), 'hand' + s, wr.x, wr.y, wr.z);
      const f = wr.clone().addScaledVector(dir, 0.07);
      add(P(`${s === 'L' ? 'Left' : 'Right'}HandIndex1`), P(`${s === 'L' ? 'Left' : 'Right'}Hand`), null, f.x, f.y, f.z);
    }
    // legs
    const hip = V(sx * 0.09 * wide, 0.93, 0), kn = V(sx * 0.095 * wide, 0.5, 0.012), an = V(sx * 0.095 * wide, 0.085, 0), ball = V(sx * 0.095 * wide, 0.03, 0.14);
    if (mh) {
      add(`thigh_${l}`, 'pelvis', 'th' + s, hip.x, hip.y, hip.z);
      add(`thigh_twist_01_${l}`, `thigh_${l}`, null, ...hip.clone().lerp(kn, 0.5).toArray());
      add(`calf_${l}`, `thigh_${l}`, 'calf' + s, kn.x, kn.y, kn.z);
      add(`calf_twist_01_${l}`, `calf_${l}`, null, ...kn.clone().lerp(an, 0.5).toArray());
      add(`foot_${l}`, `calf_${l}`, 'foot' + s, an.x, an.y, an.z);
      add(`ball_${l}`, `foot_${l}`, 'toe' + s, ball.x, ball.y, ball.z);
      add(`ik_foot_${l}`, 'root', null, an.x, 0, an.z);
    } else {
      const n = s === 'L' ? 'Left' : 'Right';
      add(P(`${n}UpLeg`), P('Hips'), 'th' + s, hip.x, hip.y, hip.z);
      add(P(`${n}Leg`), P(`${n}UpLeg`), 'calf' + s, kn.x, kn.y, kn.z);
      add(P(`${n}Foot`), P(`${n}Leg`), 'foot' + s, an.x, an.y, an.z);
      add(P(`${n}ToeBase`), P(`${n}Foot`), 'toe' + s, ball.x, ball.y, ball.z);
    }
  }
  return T;
}

/** World rotation of a bone's local frame: MetaHuman/UE style = X along the bone; Mixamo/Blender style = Y along the bone. */
function frameQuat(style, dir, side) {
  const along = dir.clone().normalize();
  let ref = V(0, 0, 1); if (Math.abs(along.dot(ref)) > 0.9) ref = V(1, 0, 0);
  const m = new THREE.Matrix4();
  if (style === 'metahuman') {                       // x = along the bone, z = forward-ish, y = z × x
    const x = along, z = ref.clone().addScaledVector(x, -ref.dot(x)).normalize(), y = new THREE.Vector3().crossVectors(z, x);
    m.makeBasis(x, y, z);
  } else {                                           // y = along the bone, x = lateral-ish, z = x × y
    const y = along, x = V(side || 1, 0, 0).addScaledVector(y, -(side || 1) * y.x).normalize(), z = new THREE.Vector3().crossVectors(x, y);
    m.makeBasis(x, y, z);
  }
  return new THREE.Quaternion().setFromRotationMatrix(m);
}

function buildSkeleton(style, table, toLocal, quatLocal) {
  const byName = new Map(), bones = [];
  const kids = new Map(); for (const j of table) { if (!kids.has(j.parent)) kids.set(j.parent, []); kids.get(j.parent).push(j); }
  // frames from the *canonical* directions to each joint's main child
  const worldQ = new Map();
  for (const j of table) {
    const ch = (kids.get(j.name) || []).filter((c) => !/twist|corrective|ik_|index|thumb|FACIAL_L|FACIAL_R/i.test(c.name));
    let dir;
    if (ch.length) dir = ch[0].p.clone().sub(j.p);
    else { const par = table.find((t) => t.name === j.parent); dir = par ? j.p.clone().sub(par.p) : V(0, 1, 0); if (dir.lengthSq() < 1e-8) dir = V(0, 1, 0); }
    if (/^root$/.test(j.name)) dir = V(0, 1, 0);
    const side = /(_l$|Left)/.test(j.name) ? 1 : /(_r$|Right)/.test(j.name) ? -1 : 1;
    worldQ.set(j.name, quatLocal(frameQuat(style, dir, side)));
  }
  for (const j of table) {
    const b = new THREE.Bone(); b.name = j.name; byName.set(j.name, b); bones.push(b);
    const wp = toLocal(j.p), wq = worldQ.get(j.name);
    if (!j.parent) { b.position.copy(wp); b.quaternion.copy(wq); continue; }
    const pp = toLocal(table.find((t) => t.name === j.parent).p), pq = worldQ.get(j.parent);
    b.position.copy(wp).sub(pp).applyQuaternion(pq.clone().invert());
    b.quaternion.copy(pq.clone().invert().multiply(wq));
    byName.get(j.parent).add(b);
  }
  return { bones, byName, roots: bones.filter((b) => !b.parent) };
}

const mat = (name, color, extra = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0, ...extra }); m.name = name; return m; };

/** One SkinnedMesh per material: shapes[]: { geo (canonical frame), bone (role) } merged with rigid weights. */
function skinnedMesh(name, material, shapes, ctx) {
  const geos = shapes.map(({ geo, role }) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    g.deleteAttribute('uv');
    const bi = ctx.indexOfRole(role);
    const n = g.attributes.position.count;
    const p = g.attributes.position;
    for (let i = 0; i < n; i++) { const v = ctx.toLocal(V(p.getX(i), p.getY(i), p.getZ(i))); p.setXYZ(i, v.x, v.y, v.z); }
    const nrm = g.attributes.normal;
    for (let i = 0; i < n; i++) { const v = V(nrm.getX(i), nrm.getY(i), nrm.getZ(i)).applyQuaternion(ctx.frameQ).normalize(); nrm.setXYZ(i, v.x, v.y, v.z); }
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { si[i * 4] = bi; sw[i * 4] = 1; }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    return g;
  });
  const mesh = new THREE.SkinnedMesh(mergeVertices(mergeGeometries(geos, false), 1e-4), material); mesh.name = name; mesh.frustumCulled = false;
  return mesh;
}

const capsule = (a, b, ra, rb, wide = 1, deep = 1) => {          // tapered capsule between two canonical points
  const len = a.distanceTo(b);
  const parts = [new THREE.CylinderGeometry(rb, ra, len, 12, 1, false), new THREE.SphereGeometry(ra, 12, 7).translate(0, -len / 2, 0), new THREE.SphereGeometry(rb, 12, 7).translate(0, len / 2, 0)];
  const geo = mergeGeometries(parts.map((x) => (x.index ? x.toNonIndexed() : x)), false);
  geo.scale(wide, 1, deep);
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize()));
  const mid = a.clone().add(b).multiplyScalar(0.5); geo.translate(mid.x, mid.y, mid.z);
  return geo;
};
const ellipsoid = (c, rx, ry, rz, q = null) => { const g = new THREE.SphereGeometry(1, 16, 10); g.scale(rx, ry, rz); if (q) g.applyQuaternion(q); g.translate(c.x, c.y, c.z); return g; };
const box = (c, w, h, d) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(c.x, c.y, c.z); return g; };

/**
 * spec: { id, style: 'metahuman'|'mixamo', pose: 'A'|'T', height, wide, units: 1|100, zup: bool, skin, shirt, pants, hair, shoes }
 * Returns a Group holding the armature and the skinned meshes, ready for GLTFExporter.
 */
export function makeStandIn(spec) {
  const k = (spec.height || 1.78) / 1.78, wide = spec.wide || 1;
  const table = jointTable(spec.style, k, spec.pose || 'A', wide);
  const role = new Map(table.filter((j) => j.role).map((j) => [j.role, j]));
  const unit = spec.units || 1;
  // canonical (Y up, faces +Z, left = +X) -> armature-local frame.  zup (Blender-style): X forward, Y left, Z up; the armature node then stands it
  // back up with Rx(-90deg), so in the scene the figure faces +X (sideways relative to what the game expects) and is scaled 1/unit.
  const zup = !!spec.zup;
  const toLocal = zup ? (p) => V(p.z, p.x, p.y).multiplyScalar(unit) : (p) => p.clone().multiplyScalar(unit);
  const qLocal = zup ? (q) => QC.clone().multiply(q) : (q) => q.clone();
  // split: the head/face lives on its own skeleton (root > pelvis > spine > neck > head > FACIAL_*), like a separately exported MetaHuman Face mesh
  const split = !!spec.split, isFace = (j) => /^FACIAL_/.test(j.name), core = new Set(['root', 'pelvis', 'spine_01', 'spine_02', 'spine_03', 'spine_04', 'spine_05', 'neck_01', 'neck_02', 'head']);
  const bodyTable = split ? table.filter((j) => !isFace(j)) : table, faceTable = split ? table.filter((j) => isFace(j) || core.has(j.name)) : null;
  const group = new THREE.Group(); group.name = 'StandIn_' + spec.id;
  const mkArmature = (name) => { const a = new THREE.Group(); a.name = name; if (zup) { a.rotation.x = -Math.PI / 2; a.scale.setScalar(1 / unit); } else if (unit !== 1) a.scale.setScalar(1 / unit); group.add(a); return a; };
  const frameQ = zup ? QC : new THREE.Quaternion();
  const mkSide = (tbl, armature) => {
    const sk = buildSkeleton(spec.style, tbl, toLocal, qLocal), rl = new Map(tbl.filter((j) => j.role).map((j) => [j.role, j]));
    for (const r of sk.roots) armature.add(r);
    armature.updateMatrixWorld(true);
    return { sk, armature, skeleton: new THREE.Skeleton(sk.bones), ctx: { toLocal, frameQ, indexOfRole: (r) => { const j = rl.get(r); if (!j) throw new Error('no role ' + r); return sk.bones.indexOf(sk.byName.get(j.name)); } } };
  };
  const body = mkSide(bodyTable, mkArmature('Armature'));
  const face = split ? mkSide(faceTable, mkArmature('Armature_Face')) : body;
  if (spec.attach) {                                  // plain (unskinned) meshes hung on bones, like a socketed hat / hair / eyes: they must stay with the head / arm after optimising
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.03 * unit, 0.03 * unit, 0.012 * unit), mat('M_badge', 0xc9b16a)); badge.name = 'StaticBadge'; badge.position.set(0.02 * unit, 0, 0.05 * unit);
    (face.sk.byName.get('FACIAL_L_Eye') || face.sk.byName.get('head')).add(badge);
    const radio = new THREE.Mesh(new THREE.BoxGeometry(0.05 * unit, 0.1 * unit, 0.03 * unit), mat('M_radio', 0x222222)); radio.name = 'StaticRadio'; radio.position.set(0.02 * unit, 0, 0.04 * unit);
    (body.sk.byName.get('upperarm_twist_01_l') || body.sk.byName.get('upperarm_l')).add(radio);
  }
  const at = (r) => role.get(r).p;
  const w = wide, tint = spec.skin || 0xc89a7c;
  const skinShapes = [], shirtShapes = [], pantsShapes = [], shoeShapes = [];
  // torso
  pantsShapes.push({ geo: ellipsoid(at('hips').clone().add(V(0, 0.03 * k, 0)), 0.165 * w * k, 0.13 * k, 0.11 * k), role: 'hips' });
  shirtShapes.push({ geo: capsule(at('spL'), at('spM'), 0.145 * w * k, 0.155 * w * k, 1, 0.72), role: 'spL' });
  shirtShapes.push({ geo: capsule(at('spM').clone().add(V(0, 0.03 * k, 0)), at('spH').clone().add(V(0, 0.03 * k, 0)), 0.16 * w * k, 0.175 * w * k, 1.05, 0.7), role: 'spH' });
  skinShapes.push({ geo: capsule(at('neck'), at('head'), 0.05 * k, 0.047 * k), role: 'neck' });
  skinShapes.push({ geo: ellipsoid(at('head').clone().add(V(0, 0.075 * k, 0.012 * k)), 0.082 * k, 0.108 * k, 0.098 * k), role: 'head' });
  skinShapes.push({ geo: ellipsoid(at('head').clone().add(V(0, 0.07 * k, 0.098 * k)), 0.012 * k, 0.022 * k, 0.02 * k), role: 'head' });           // nose
  skinShapes.push({ geo: ellipsoid(at('head').clone().add(V(0.083 * k, 0.07 * k, 0.0)), 0.01 * k, 0.03 * k, 0.018 * k), role: 'head' });          // ears
  skinShapes.push({ geo: ellipsoid(at('head').clone().add(V(-0.083 * k, 0.07 * k, 0.0)), 0.01 * k, 0.03 * k, 0.018 * k), role: 'head' });
  skinShapes.push({ geo: ellipsoid(at('jaw').clone().add(V(0, -0.012 * k, 0.04 * k)), 0.05 * k, 0.034 * k, 0.05 * k), role: 'jaw' });
  for (const s of ['L', 'R']) {
    const sx = s === 'L' ? 1 : -1;
    shirtShapes.push({ geo: ellipsoid(at('arm' + s), 0.062 * k, 0.062 * k, 0.062 * k), role: 'arm' + s });
    shirtShapes.push({ geo: capsule(at('arm' + s), at('fore' + s).clone().lerp(at('arm' + s), 0.1), 0.056 * k, 0.047 * k), role: 'arm' + s });
    skinShapes.push({ geo: capsule(at('fore' + s), at('hand' + s), 0.043 * k, 0.034 * k), role: 'fore' + s });
    const hd = at('hand' + s).clone().sub(at('fore' + s)).normalize();
    skinShapes.push({ geo: ellipsoid(at('hand' + s).clone().addScaledVector(hd, 0.05 * k), 0.032 * k, 0.062 * k, 0.022 * k, new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), hd)), role: 'hand' + s });
    pantsShapes.push({ geo: capsule(at('th' + s), at('calf' + s), 0.083 * w * k, 0.058 * k), role: 'th' + s });
    pantsShapes.push({ geo: capsule(at('calf' + s), at('foot' + s).clone().add(V(0, 0.03 * k, 0)), 0.056 * k, 0.04 * k), role: 'calf' + s });
    shoeShapes.push({ geo: box(at('foot' + s).clone().add(V(0, -0.03 * k, 0.06 * k)), 0.092 * k, 0.07 * k, 0.24 * k), role: 'foot' + s });
    shoeShapes.push({ geo: box(at('toe' + s).clone().add(V(0, 0.005 * k, 0.025 * k)), 0.088 * k, 0.045 * k, 0.07 * k), role: 'toe' + s });
  }
  const meshes = [];
  const addMesh = (name, material, shapes, onFace) => {
    const side = onFace ? face : body; const m = skinnedMesh(name, material, shapes, side.ctx); side.armature.add(m); meshes.push({ m, side });
    if (onFace && spec.morphs && /^(Face_skin|Body_skin|Eyes)$/.test(name)) {                       // fake blend shapes (a real MetaHuman face export carries hundreds)
      const pos = m.geometry.attributes.position, list = [], names = [];
      for (let k = 0; k < spec.morphs; k++) { const a = new Float32Array(pos.count * 3); for (let i = 0; i < pos.count; i++) a[i * 3 + 1] = Math.sin(i * 0.1 + k) * 0.0005 * unit; list.push(new THREE.Float32BufferAttribute(a, 3)); names.push('mouth_' + k); }
      m.geometry.morphAttributes.position = list; m.updateMorphTargets(); m.morphTargetInfluences = names.map(() => 0);
      m.morphTargetDictionary = Object.fromEntries(names.map((n, i) => [n, i]));
    }
  };
  const faceRole = (sh) => sh.role === 'head' || sh.role === 'jaw';
  if (split) {
    addMesh('Body_skin', mat('M_skin', tint, { roughness: 0.55 }), skinShapes.filter((x) => !faceRole(x)), false);
    addMesh('Face_skin', mat('M_skin', tint, { roughness: 0.55 }), skinShapes.filter(faceRole), true);
  } else addMesh('Body_skin', mat('M_skin', tint, { roughness: 0.55 }), skinShapes, false);
  addMesh('Clothes_top', mat('M_shirt', spec.shirt ?? 0xc8651b), shirtShapes, false);
  addMesh('Clothes_bottom', mat('M_pants', spec.pants ?? 0xc8651b), pantsShapes, false);
  addMesh('Shoes', mat('M_shoes', spec.shoes ?? 0x15110e, { roughness: 0.9 }), shoeShapes, false);
  // hair cap (cut-out hair material in real exports), eyes, shells, teeth, lashes
  const head = at('head');
  if (spec.hair !== null) {
    const cap = new THREE.SphereGeometry(1, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.56); cap.scale(0.089 * k, 0.1 * k, 0.106 * k); cap.translate(head.x, head.y + 0.092 * k, head.z - 0.002 * k);
    addMesh('Hair_cards', mat('M_hair_cards', spec.hair ?? 0x2a1d14, { side: THREE.DoubleSide, roughness: 0.8 }), [{ geo: cap, role: 'head' }], true);
  }
  const eyes = [], shells = [], lashes = [];
  for (const sx of [-1, 1]) {
    const c = head.clone().add(V(sx * 0.033 * k, 0.088 * k, 0.074 * k));
    eyes.push({ geo: ellipsoid(c, 0.0125 * k, 0.0125 * k, 0.0125 * k), role: 'head' });
    shells.push({ geo: ellipsoid(c.clone().add(V(0, 0, 0.002 * k)), 0.0145 * k, 0.0145 * k, 0.0145 * k), role: 'head' });
    lashes.push({ geo: box(c.clone().add(V(0, 0.016 * k, 0.008 * k)), 0.032 * k, 0.003 * k, 0.012 * k), role: 'head' });
  }
  addMesh('Eyes', mat('M_eye', 0x3a2a1c, { roughness: 0.3 }), eyes, true);
  addMesh('EyeshellL', mat('M_eyeshell', 0xffffff, { transparent: true, opacity: 0.4, roughness: 0.05 }), shells, true);
  addMesh('Lashes', mat('M_lashes', 0x120d0a), lashes, true);
  addMesh('Teeth', mat('M_teeth', 0xf1ead8), [{ geo: box(at('jaw').clone().add(V(0, 0.004 * k, 0.062 * k)), 0.05 * k, 0.012 * k, 0.012 * k), role: 'jaw' }], true);
  group.updateMatrixWorld(true);
  for (const { m, side } of meshes) m.bind(side.skeleton);
  return group;
}

export const STAND_INS = [
  { id: 'mh-a', style: 'metahuman', pose: 'A', height: 1.82, wide: 1.04, skin: 0xd9ae92, shirt: 0xc8651b, pants: 0xc8651b, hair: 0x2a1d14, looks: ['inmateA', 'inmateB'] },
  { id: 'mh-b', style: 'metahuman', pose: 'T', height: 1.74, wide: 0.95, skin: 0x7a5038, shirt: 0xc8651b, pants: 0xc8651b, hair: 0x120d0a, looks: ['inmateB', 'inmateC', 'cutter'] },
  { id: 'mx-a', style: 'mixamo', pose: 'A', height: 1.86, wide: 1.1, units: 100, zup: true, skin: 0xb98468, shirt: 0x1c2a44, pants: 0x1c2a44, hair: 0x1a1410, looks: ['guard', 'guardLight'] },
  { id: 'mx-b', style: 'mixamo', pose: 'T', height: 1.70, wide: 0.92, units: 100, zup: true, skin: 0xcaa089, shirt: 0x6e665a, pants: 0x54483a, hair: 0xc9c6c0, looks: ['tuck', 'harrington', 'maddox', 'inmateA', 'inmateC'] },
];

/** "Raw exports" for the optimizer tests: not in the game manifest.  mh-split = body and face on two separate skeletons (as UE exports a MetaHuman's Body and Face meshes). */
export const RAW_EXPORTS = [
  { id: 'mh-split', style: 'metahuman', pose: 'A', height: 1.8, wide: 1.0, skin: 0xcda085, shirt: 0xc8651b, pants: 0xc8651b, hair: 0x2a1d14, split: true, morphs: 12, attach: true },
  { id: 'mh-single', style: 'metahuman', pose: 'A', height: 1.8, wide: 1.0, skin: 0xcda085, shirt: 0xc8651b, pants: 0xc8651b, hair: 0x2a1d14 },
];

export async function exportGlb(group) {
  const ex = new GLTFExporter();
  return new Promise((res, rej) => ex.parse(group, (buf) => res(buf), rej, { binary: true, onlyVisible: false }));
}

function b64(buf) { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }

window.makeStandIns = async (which = 'game') => {
  const out = {};
  for (const spec of which === 'raw' ? RAW_EXPORTS : STAND_INS) { const g = makeStandIn(spec); out[spec.id] = b64(await exportGlb(g)); }
  return out;
};
window.STAND_INS = STAND_INS; window.RAW_EXPORTS = RAW_EXPORTS;
