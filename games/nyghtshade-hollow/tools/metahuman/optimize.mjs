#!/usr/bin/env node
// Turns a raw character export (a MetaHuman from Unreal / Maya / Blender as glTF, Mixamo, VRM …) into a web-sized GLB for Nyghtshade Hollow.
//
//   node optimize.mjs --inspect  raw.glb                      what is in the file: skeletons, meshes, textures, rig mapping, problems
//   node optimize.mjs raw.glb out.glb [options]               optimise
//
//   --tex <px>          largest texture side (default 1024; use 2048 for hero characters)
//   --format <f>        texture format: webp (default) | jpeg | png | keep
//   --tris <n>          reduce the whole character to about n triangles (default: keep the export's detail)
//   --keep-face-rig     keep the facial joints (default: collapse them into the head/jaw; the game never animates them, and ~800 joints per
//                       character are expensive to update)
//   --keep-fingers      keep the finger joints (default: collapse into the hands)
//   --keep-twist        keep twist / corrective / helper joints (default: collapse into their parent limb joint)
//   --keep-morphs       keep morph targets / blend shapes (default: removed — the game does not animate them and a MetaHuman face can carry hundreds)
//   --no-meshopt        do not compress geometry (EXT_meshopt_compression)
//   --scale <k>         multiply the whole character (e.g. 0.01 for centimetres) — normally not needed, the game measures the model
//   --report <file>     write the numbers as JSON
//
// What it does, in order:  1. merge several skeletons into one (UE exports a MetaHuman's Body and Face meshes on separate skeletons: the face would stay
// behind when the body moves)  2. collapse joints the game does not animate into their nearest kept ancestor (skin weights follow)  3. limit skinning to
// 4 influences per vertex (what three.js uses; MetaHuman has 8)  4. dedup / prune / weld  5. optional triangle budget  6. textures: resize + WebP
// 7. EXT_meshopt_compression.  Bone naming / roles come from the game's own src/chars/rigmap.js, so what it keeps is exactly what the game drives.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, simplify, textureCompress, meshopt, getBounds } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mapBones, roleOf, normalizeBoneName, isUsable } from '../../src/chars/rigmap.js';

// ---- small helpers ------------------------------------------------------------------------------------------------------------------
const MAT4_IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const mmul = (a, b) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };   // column-major a·b
function minv(m) {                                                                         // general 4x4 inverse (column-major)
  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = m;
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06; if (!det) return MAT4_IDENTITY.slice(); det = 1 / det;
  return [(a11 * b11 - a12 * b10 + a13 * b09) * det, (a02 * b10 - a01 * b11 - a03 * b09) * det, (a31 * b05 - a32 * b04 + a33 * b03) * det, (a22 * b04 - a21 * b05 - a23 * b03) * det,
    (a12 * b08 - a10 * b11 - a13 * b07) * det, (a00 * b11 - a02 * b08 + a03 * b07) * det, (a32 * b02 - a30 * b05 - a33 * b01) * det, (a20 * b05 - a22 * b02 + a23 * b01) * det,
    (a10 * b10 - a11 * b08 + a13 * b06) * det, (a01 * b08 - a00 * b10 - a03 * b06) * det, (a30 * b04 - a31 * b02 + a33 * b00) * det, (a21 * b02 - a20 * b04 - a23 * b00) * det,
    (a11 * b07 - a10 * b09 - a12 * b06) * det, (a00 * b09 - a01 * b07 + a02 * b06) * det, (a31 * b01 - a30 * b03 - a32 * b00) * det, (a20 * b03 - a21 * b01 + a22 * b00) * det];
}
const ancestors = (node) => { const out = []; for (let p = node.getParentNode(); p; p = p.getParentNode()) out.push(p); return out; };
const rootOf = (node) => { let p = node; while (p.getParentNode()) p = p.getParentNode(); return p; };
/** Move `child` under `parent` keeping its world transform (a socketed hat / hair / eye mesh must not jump when the joint it hung from is collapsed). */
function reparentKeepWorld(child, parent) {
  const w = child.getWorldMatrix(); parent.addChild(child);
  child.setMatrix(mmul(minv(parent.getWorldMatrix()), w));
}
/** Plain (unskinned) mesh nodes hung on `joint` directly or through non-joint nodes; other joints in `skip` are not entered (each is handled on its own, so a mesh goes to its own nearest joint). */
function attachmentsBelow(joint, skip) {
  const out = [];
  const walk = (n) => { for (const c of n.listChildren()) { if (skip.has(c)) continue; if (c.getMesh() && !c.getSkin()) out.push(c); else walk(c); } };
  walk(joint);
  return out;
}
const trisOf = (prim) => { const i = prim.getIndices(); return (i ? i.getCount() : prim.getAttribute('POSITION').getCount()) / 3; };

/** { name, parent } views of every node so src/chars/rigmap.js (pure) can run on a glTF-Transform document. */
function nodeViews(doc) {
  const nodes = doc.getRoot().listNodes(), view = new Map();
  for (const n of nodes) view.set(n, { name: n.getName(), parent: null, node: n });
  for (const n of nodes) { const p = n.getParentNode(); if (p && view.has(p)) view.get(n).parent = view.get(p); }
  return view;
}
const CORE_ROLES = new Set(['hips', 'spine', 'neck', 'head', 'jaw', 'clav', 'arm', 'fore', 'hand', 'thigh', 'calf', 'foot', 'toe']);
const FINGER = /thumb|index|middle|ring|pinky|pinkie|little|finger/;
const isFacial = (name) => /^(facial|face)_/.test(normalizeBoneName(name));

// ---- inspect ------------------------------------------------------------------------------------------------------------------------
export function inspectDocument(doc) {
  const root = doc.getRoot(), scene = root.getDefaultScene() || root.listScenes()[0], views = nodeViews(doc);
  const skins = root.listSkins().map((s, i) => {
    const joints = s.listJoints(), wrapped = joints.map((j) => views.get(j));
    const map = mapBones(wrapped), roles = wrapped.filter((w) => { const r = roleOf(w.name); return r && CORE_ROLES.has(r.role); }).length;
    return { index: i, name: s.getName(), joints: joints.length, roots: [...new Set(joints.map((j) => rootOf(j).getName()))], coreRoles: roles, rig: map.rig, usable: isUsable(map), missing: map.missing,
      facial: joints.filter((j) => isFacial(j.getName())).length, fingers: joints.filter((j) => FINGER.test(normalizeBoneName(j.getName()))).length, helpers: joints.filter((j) => { const n = normalizeBoneName(j.getName()); return roleOf(j.getName()) === null && !FINGER.test(n) && !isFacial(j.getName()); }).length };
  });
  const meshes = []; let tris = 0, verts = 0, influenceSets = 0, morphs = 0;
  for (const n of root.listNodes()) {
    const m = n.getMesh(); if (!m) continue;
    let t = 0, v = 0; const mats = new Set();
    for (const p of m.listPrimitives()) { t += trisOf(p); v += p.getAttribute('POSITION').getCount(); morphs += p.listTargets().length; if (p.getMaterial()) mats.add(p.getMaterial().getName()); if (p.getAttribute('JOINTS_1')) influenceSets = Math.max(influenceSets, 2); }
    tris += t; verts += v;
    meshes.push({ node: n.getName(), mesh: m.getName(), tris: Math.round(t), verts: v, skinned: !!n.getSkin(), skin: n.getSkin() ? root.listSkins().indexOf(n.getSkin()) : null, materials: [...mats] });
  }
  const textures = root.listTextures().map((t) => ({ name: t.getName() || t.getURI(), mime: t.getMimeType(), size: t.getSize(), kb: Math.round((t.getImage()?.byteLength || 0) / 1024) }));
  const bounds = scene ? getBounds(scene) : { min: [0, 0, 0], max: [0, 0, 0] };
  const height = Math.max(bounds.max[1] - bounds.min[1], bounds.max[2] - bounds.min[2], bounds.max[0] - bounds.min[0]);
  const warnings = [];
  const sets = new Set(root.listSkins().map((s) => s.listJoints().map((j) => root.listNodes().indexOf(j)).sort((a, b) => a - b).join(',')));
  if (sets.size > 1) warnings.push(`${sets.size} separate skeletons (one per skin): a face / hair mesh on its own skeleton would not follow the body — optimize.mjs merges them`);
  if (!skins.length) warnings.push('no skin: the game would show a static model');
  if (skins.length && !skins.some((s) => s.usable)) warnings.push('no skeleton the game can drive (hips / head / arms / legs not found by bone name)');
  if (influenceSets > 1) warnings.push('vertices use more than 4 joint influences: three.js reads 4 — optimize.mjs reduces and renormalises them');
  if (height > 10) warnings.push(`model is ${height.toFixed(0)} units tall: looks like centimetres (the game scales by measured height, so this still works)`);
  if (morphs) warnings.push(`${morphs} morph targets (blend shapes): not animated by the game and expensive — optimize.mjs removes them (--keep-morphs keeps them)`);
  const big = textures.filter((t) => Math.max(...(t.size || [0])) > 2048).length; if (big) warnings.push(`${big} textures are larger than 2048 px`);
  return { nodes: root.listNodes().length, skins, meshes, tris: Math.round(tris), verts, morphTargets: morphs, materials: root.listMaterials().length, textures, textureMB: +(textures.reduce((s, t) => s + t.kb, 0) / 1024).toFixed(1), height: +height.toFixed(3), warnings };
}

// ---- skinning: remap joints, merge duplicates, keep the 4 strongest influences --------------------------------------------------------------
/** map: Int32Array old joint index -> new joint index (the primitive's skin).  Writes JOINTS_0 / WEIGHTS_0 and removes the other sets. */
function remapSkinning(doc, prim, map) {
  const sets = []; for (let i = 0; i < 4; i++) { const J = prim.getAttribute('JOINTS_' + i), W = prim.getAttribute('WEIGHTS_' + i); if (J && W) sets.push([J, W]); }
  if (!sets.length) return;
  const n = sets[0][0].getCount(), outJ = new Uint16Array(n * 4), outW = new Float32Array(n * 4), jt = [0, 0, 0, 0], wt = [0, 0, 0, 0], acc = new Map();
  for (let v = 0; v < n; v++) {
    acc.clear();
    for (const [J, W] of sets) {
      J.getElement(v, jt); W.getElement(v, wt);
      for (let k = 0; k < 4; k++) if (wt[k] > 0) { const t = map[jt[k]]; acc.set(t, (acc.get(t) || 0) + wt[k]); }
    }
    const top = [...acc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    let sum = 0; for (const [, w] of top) sum += w;
    for (let k = 0; k < top.length; k++) { outJ[v * 4 + k] = top[k][0]; outW[v * 4 + k] = sum > 0 ? top[k][1] / sum : (k === 0 ? 1 : 0); }
  }
  prim.setAttribute('JOINTS_0', doc.createAccessor().setType('VEC4').setArray(outJ).setBuffer(prim.getAttribute('POSITION').getBuffer()));
  prim.setAttribute('WEIGHTS_0', doc.createAccessor().setType('VEC4').setArray(outW).setBuffer(prim.getAttribute('POSITION').getBuffer()));
  for (let i = 1; i < 4; i++) { prim.setAttribute('JOINTS_' + i, null); prim.setAttribute('WEIGHTS_' + i, null); }
}
const skinnedNodes = (doc, skin) => doc.getRoot().listNodes().filter((n) => n.getSkin() === skin && n.getMesh());
const ibmOf = (skin) => { const a = skin.getInverseBindMatrices(); const joints = skin.listJoints(); return joints.map((_, i) => (a ? Array.from(a.getElement(i, new Array(16))) : MAT4_IDENTITY.slice())); };
function setJointsAndIBM(doc, skin, joints, ibms) {
  for (const j of skin.listJoints()) skin.removeJoint(j);
  for (const j of joints) skin.addJoint(j);
  const flat = new Float32Array(joints.length * 16); ibms.forEach((m, i) => flat.set(m, i * 16));
  skin.setInverseBindMatrices(doc.createAccessor().setType('MAT4').setArray(flat).setBuffer(doc.getRoot().listBuffers()[0]));
}

// ---- 1. merge skeletons -------------------------------------------------------------------------------------------------------------------
/** Several skins (UE: Body + Face) -> the one with the most body bones, everything else re-skinned onto it by joint name.  Returns a log. */
export function unifySkeletons(doc, log = () => {}) {
  const root = doc.getRoot(), skins = root.listSkins();
  if (skins.length < 2) return false;
  const score = (s) => s.listJoints().filter((j) => { const r = roleOf(j.getName()); return r && CORE_ROLES.has(r.role) && r.role !== 'jaw'; }).length;
  const primary = [...skins].sort((a, b) => score(b) - score(a) || b.listJoints().length - a.listJoints().length)[0];
  const pj = primary.listJoints(), pibm = ibmOf(primary);
  const byName = new Map(); pj.forEach((j, i) => { const k = normalizeBoneName(j.getName()); if (!byName.has(k)) byName.set(k, i); });
  const headIdx = pj.findIndex((j) => roleOf(j.getName())?.role === 'head');
  if (headIdx < 0) { log('merge: primary skeleton has no head joint — skeletons left as they are'); return false; }
  let jawIdx = pj.findIndex((j) => roleOf(j.getName())?.role === 'jaw');
  const joints = pj.slice(), ibms = pibm.slice();
  const dropNodes = [];
  for (const sec of skins) {
    if (sec === primary) continue;
    const sj = sec.listJoints(), sibm = ibmOf(sec), map = new Int32Array(sj.length).fill(-1), forced = new Map();
    // the face skeleton's jaw becomes a new joint under the primary head when the primary has none
    {
      const jaw = sj.find((j) => roleOf(j.getName())?.role === 'jaw');
      if (jaw && jawIdx >= 0) forced.set(jaw, jawIdx);                                    // already created (or the primary has one)
      else if (jaw) {
        const created = doc.createNode(jaw.getName()), W = (n) => n.getWorldMatrix(), headNode = pj[headIdx];
        const local = mmul(minv(W(headNode)), W(jaw));
        created.setMatrix(local); headNode.addChild(created);
        // IBM = inverse(world at bind) in the shared mesh space, derived from the primary head: IBM_n = W_n^-1 · W_head · IBM_head
        const ibm = mmul(mmul(minv(W(created)), W(headNode)), pibm[headIdx]);
        joints.push(created); ibms.push(ibm); jawIdx = joints.length - 1; forced.set(jaw, jawIdx);
        log(`merge: new jaw joint "${jaw.getName()}" under "${headNode.getName()}"`);
      }
    }
    sj.forEach((j, i) => {
      let target = -1; const chain = [j, ...ancestors(j)];
      for (const c of chain) {
        if (forced.has(c)) { target = forced.get(c); break; }
        const pi = pj.indexOf(c); if (pi >= 0) { target = pi; break; }                 // the very same node is a joint of the primary
        const byN = byName.get(normalizeBoneName(c.getName())); if (byN !== undefined) { target = byN; break; }              // same joint name on the primary skeleton
      }
      map[i] = target >= 0 ? target : headIdx;
    });
    const nodes = skinnedNodes(doc, sec);
    for (const n of nodes) {
      for (const p of n.getMesh().listPrimitives()) remapSkinning(doc, p, map);
      n.setSkin(primary);
    }
    sj.forEach((j, i) => { if (!pj.includes(j)) { const dest = joints[map[i]]; for (const a of attachmentsBelow(j, new Set(sj))) reparentKeepWorld(a, dest); } });     // sockets: hats, hair, eyes hung on the face skeleton
    for (const j of sj) if (!pj.includes(j) && !forced.has(j)) dropNodes.push(j);
    log(`merge: skin "${sec.getName() || '#' + skins.indexOf(sec)}" (${sj.length} joints, ${nodes.length} mesh nodes) re-skinned onto "${primary.getName() || 'primary'}"`);
    sec.dispose();
  }
  setJointsAndIBM(doc, primary, joints, ibms);
  // the extra skeletons' joint nodes go; mesh nodes that hung under them are kept (a skinned mesh ignores its own transform)
  const scene = root.getDefaultScene() || root.listScenes()[0];
  for (const j of dropNodes) for (const c of j.listChildren()) if (c.getMesh()) { j.removeChild(c); scene.addChild(c); }
  for (const j of dropNodes) j.dispose();
  for (const n of root.listNodes()) if (n.getMesh() && n.getSkin()) { n.setTranslation([0, 0, 0]); n.setRotation([0, 0, 0, 1]); n.setScale([1, 1, 1]); }
  return true;
}

// ---- 2. collapse joints the game does not animate -------------------------------------------------------------------------------------------
export function collapseJoints(doc, { keepFace = false, keepFingers = false, keepTwist = false } = {}, log = () => {}) {
  let removed = 0, before = 0;
  for (const skin of doc.getRoot().listSkins()) {
    const joints = skin.listJoints(), ibm = ibmOf(skin); before += joints.length;
    const keep = new Set();
    joints.forEach((j) => {
      const name = j.getName(), r = roleOf(name), n = normalizeBoneName(name);
      const essential = r && CORE_ROLES.has(r.role);
      if (essential || (keepFace && isFacial(name)) || (keepFingers && FINGER.test(n)) || (keepTwist && r === null && !isFacial(name) && !FINGER.test(n))) { keep.add(j); for (const a of ancestors(j)) if (joints.includes(a)) keep.add(a); }
    });
    if (!keep.size) continue;
    const newJoints = joints.filter((j) => keep.has(j)), newIndex = new Map(newJoints.map((j, i) => [j, i]));
    const map = new Int32Array(joints.length);
    joints.forEach((j, i) => {
      if (newIndex.has(j)) { map[i] = newIndex.get(j); return; }
      const a = ancestors(j).find((p) => newIndex.has(p)); map[i] = a ? newIndex.get(a) : 0;
    });
    for (const n of skinnedNodes(doc, skin)) for (const p of n.getMesh().listPrimitives()) remapSkinning(doc, p, map);
    const dropped = joints.filter((j) => !keep.has(j));
    for (const j of dropped) { const dest = ancestors(j).find((p) => keep.has(p)); if (dest) for (const a of attachmentsBelow(j, new Set(dropped))) reparentKeepWorld(a, dest); }      // keep socketed meshes where they are
    setJointsAndIBM(doc, skin, newJoints, joints.map((j, i) => ({ j, i })).filter(({ j }) => keep.has(j)).map(({ i }) => ibm[i]));
    for (const j of dropped) { for (const c of j.listChildren()) if (c.getMesh()) { j.removeChild(c); (doc.getRoot().getDefaultScene() || doc.getRoot().listScenes()[0]).addChild(c); } }
    for (const j of dropped) j.dispose();
    removed += dropped.length;
  }
  log(`joints: ${before} -> ${before - removed} (${removed} collapsed into their nearest kept parent)`);
  return removed;
}

/** Skinned meshes whose vertices use more than 4 joints (MetaHuman: 8) are reduced to 4 even if nothing was collapsed. */
function limitInfluences(doc, log = () => {}) {
  let n = 0;
  for (const node of doc.getRoot().listNodes()) {
    const skin = node.getSkin(), mesh = node.getMesh(); if (!skin || !mesh) continue;
    const ident = new Int32Array(skin.listJoints().length).map((_, i) => i);
    for (const p of mesh.listPrimitives()) if (p.getAttribute('JOINTS_1')) { remapSkinning(doc, p, ident); n++; }
  }
  if (n) log(`skinning: ${n} primitives reduced to 4 influences per vertex`);
}

// ---- morph targets ---------------------------------------------------------------------------------------------------------------------
/** Blend shapes are not animated by the game; a MetaHuman face export can carry hundreds (memory, and they block simplification). */
export function stripMorphTargets(doc, log = () => {}) {
  let n = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const p of mesh.listPrimitives()) for (const t of p.listTargets()) { p.removeTarget(t); t.dispose(); n++; }
    mesh.setWeights([]);
  }
  if (n) log(`morph targets: ${n} removed`);
  return n;
}

// ---- the whole pipeline --------------------------------------------------------------------------------------------------------------------
export async function makeIO() {
  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready]);
  return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
}

export async function optimizeFile(inPath, outPath, o = {}) {
  const opt = { tex: 1024, format: 'webp', tris: 0, keepFace: false, keepFingers: false, keepTwist: false, keepMorphs: false, meshopt: true, scale: 1, ...o };
  const log = opt.log || ((m) => console.log('  ' + m));
  const io = await makeIO(), doc = await io.read(inPath), t0 = Date.now();
  const before = inspectDocument(doc);
  const inBytes = fs.statSync(inPath).size;
  if (!opt.keepMorphs) stripMorphTargets(doc, log);
  unifySkeletons(doc, log);
  collapseJoints(doc, opt, log);
  limitInfluences(doc, log);
  if (opt.scale !== 1) { const sc = doc.getRoot().getDefaultScene() || doc.getRoot().listScenes()[0]; for (const n of sc.listChildren()) { n.setScale(n.getScale().map((v) => v * opt.scale)); n.setTranslation(n.getTranslation().map((v) => v * opt.scale)); } }
  await doc.transform(dedup(), prune(), weld());
  if (opt.tris > 0) {
    const have = inspectDocument(doc).tris;
    if (have > opt.tris) { const ratio = Math.max(0.05, opt.tris / have); log(`triangles: ${have} -> ~${opt.tris} (ratio ${ratio.toFixed(2)})`); await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.02, lockBorder: true })); }
  }
  if (opt.format !== 'keep') {
    const px = opt.tex;
    await doc.transform(textureCompress({ encoder: sharp, targetFormat: opt.format === 'png' ? undefined : opt.format, resize: [px, px], quality: opt.format === 'jpeg' ? 88 : 90 }));
  }
  await doc.transform(prune());
  if (opt.meshopt) await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await io.write(outPath, doc);
  const after = inspectDocument(await io.read(outPath));
  const outBytes = fs.statSync(outPath).size;
  const report = { input: path.basename(inPath), output: path.basename(outPath), ms: Date.now() - t0, bytes: { in: inBytes, out: outBytes }, before: { joints: before.skins.map((s) => s.joints), tris: before.tris, textureMB: before.textureMB, warnings: before.warnings },
    after: { joints: after.skins.map((s) => s.joints), tris: after.tris, textureMB: after.textureMB, usable: after.skins.map((s) => s.usable), warnings: after.warnings }, options: opt };
  delete report.options.log;
  return report;
}

// ---- command line -----------------------------------------------------------------------------------------------------------------------
function cli(argv) {
  const o = {}, pos = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--inspect') o.inspect = true;
    else if (a === '--keep-face-rig') o.keepFace = true; else if (a === '--keep-fingers') o.keepFingers = true; else if (a === '--keep-twist') o.keepTwist = true; else if (a === '--keep-morphs') o.keepMorphs = true; else if (a === '--no-meshopt') o.meshopt = false;
    else if (a === '--tex') o.tex = +argv[++i]; else if (a === '--format') o.format = argv[++i]; else if (a === '--tris') o.tris = +argv[++i]; else if (a === '--scale') o.scale = +argv[++i]; else if (a === '--report') o.report = argv[++i];
    else if (a.startsWith('--')) { console.error('unknown option', a); process.exit(2); } else pos.push(a);
  }
  return { o, pos };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {          // run as a command (works with Windows paths too)
  const { o, pos } = cli(process.argv.slice(2));
  if (o.inspect) {
    if (!pos[0]) { console.error('usage: node optimize.mjs --inspect file.glb'); process.exit(2); }
    const info = inspectDocument(await (await makeIO()).read(pos[0]));
    console.log(JSON.stringify(info, null, 2));
  } else {
    if (pos.length < 2) { console.error('usage: node optimize.mjs in.glb out.glb [--tex 1024] [--tris 30000] [--format webp|jpeg|png|keep] [--keep-face-rig] [--keep-fingers] [--keep-twist] [--keep-morphs] [--no-meshopt] [--scale k] [--report file.json]'); process.exit(2); }
    console.log(`optimizing ${pos[0]}`);
    const rep = await optimizeFile(pos[0], pos[1], o);
    console.log(`  ${(rep.bytes.in / 1048576).toFixed(1)} MB -> ${(rep.bytes.out / 1048576).toFixed(2)} MB, ${rep.before.tris} -> ${rep.after.tris} triangles, joints ${rep.before.joints.join('+')} -> ${rep.after.joints.join('+')}, textures ${rep.before.textureMB} -> ${rep.after.textureMB} MB (${(rep.ms / 1000).toFixed(1)} s)`);
    for (const w of rep.after.warnings) console.log('  warning:', w);
    if (o.report) fs.writeFileSync(o.report, JSON.stringify(rep, null, 2));
  }
}
