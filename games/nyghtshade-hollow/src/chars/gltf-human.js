// glTF characters (MetaHuman exports and anything else with a humanoid skeleton) with the same interface as the procedural Humanoid:
//   new GltfHuman(template, look, { seed, scale })  →  root / blob / setPose / setCast / update(dt, speed, lookRel, pitchRel) / talking
// A *template* is a loaded glTF analysed once (bones mapped, oriented to stand on +Y facing +Z, measured); instances are cheap skinned clones.
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { damp, hash01 } from '../util.js';
import { poseTargets } from './poses.js';
import { mapBones, isUsable } from './rigmap.js';
import { RigDriver } from './rigdriver.js';
import { blobShadowTexture } from './humanoid.js';

const wp = (o) => o.getWorldPosition(new THREE.Vector3());

export function collectBones(root) {
  const set = new Set();
  root.traverse((o) => { if (o.isBone) set.add(o); if (o.isSkinnedMesh && o.skeleton) for (const b of o.skeleton.bones) set.add(b); });
  return [...set];
}

/** Rotation that stands the model up (hips→head = +Y) and turns it to face +Z (foot→toe), from the rest-pose bone positions. */
export function orientationFix(map) {
  const q = new THREE.Quaternion();
  if (!map.hips || !map.head) return q;
  const up = wp(map.head).sub(wp(map.hips));
  if (up.lengthSq() < 1e-8) return q;
  up.normalize();
  let fwd = null;
  for (const s of ['L', 'R']) {
    const f = map[s].foot, t = map[s].toe;
    if (f && t) { const d = wp(t).sub(wp(f)); d.addScaledVector(up, -d.dot(up)); if (d.lengthSq() > 1e-10) { fwd = (fwd || new THREE.Vector3()).add(d.normalize()); } }
  }
  if (!fwd || fwd.lengthSq() < 1e-8) { fwd = new THREE.Vector3(0, 0, 1); fwd.addScaledVector(up, -fwd.dot(up)); if (fwd.lengthSq() < 1e-8) fwd.set(1, 0, 0).addScaledVector(up, -up.x); }
  fwd.normalize();
  const x = new THREE.Vector3().crossVectors(up, fwd).normalize();
  const m = new THREE.Matrix4().makeBasis(x, up, fwd);          // rig axes → model axes
  q.setFromRotationMatrix(m).invert();                           // model → rig
  return q;
}

const HAIR = /hair|lash|brow|beard|fuzz|stubble|moustache|mustache|peachfuzz|cards/;
const SHELL = /eyeshell|eye_shell|cornea|occlusion|tearline|lacrimal|eyeedge|eye_edge/;
const DETAIL = /lash|teeth|tongue|saliva|eyeedge|eye_edge|lacrimal|occlusion|cartilage|fuzz|brow|tearline/;

/** Make glTF materials behave in this renderer: cut-out hair cards with alpha-to-coverage, see-through eye shells, sane skin. */
export function fixMaterials(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = false;
    if (o.isSkinnedMesh) o.frustumCulled = false;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const nm0 = String(o.name || '').toLowerCase();
    o.userData.detail = DETAIL.test(nm0);
    for (const m of mats) {
      if (!m || m.userData._nhFixed) continue;
      m.userData._nhFixed = true;
      const nm = nm0 + ' ' + String(m.name || '').toLowerCase();
      if (m.map) m.map.anisotropy = 4;
      if (HAIR.test(nm) && !SHELL.test(nm)) {
        m.alphaTest = m.alphaTest > 0 ? m.alphaTest : 0.35; m.transparent = false; m.depthWrite = true; m.side = THREE.DoubleSide; m.alphaToCoverage = true;
        if (m.color && m.map == null) m.color.multiplyScalar(0.8);
      } else if (SHELL.test(nm)) {
        m.transparent = true; m.opacity = Math.min(m.opacity ?? 1, 0.22); m.depthWrite = false; if ('roughness' in m) m.roughness = 0.05;
      } else if ('roughness' in m) {
        if (/skin|body|head|face|arm|leg/.test(nm)) { m.roughness = Math.max(m.roughness ?? 0.6, 0.5); m.metalness = 0; }
        m.envMapIntensity = m.envMapIntensity ?? 1;
      }
      m.needsUpdate = true;
    }
    if (DETAIL.test(nm0)) o.userData.detail = true;
  });
}

/**
 * Analyse a loaded glTF scene once.  The returned template owns a wrapper group (orientation baked in) that is only ever cloned.
 * @returns {{root:THREE.Group, map:object, usable:boolean, minY:number, height:number, rig:string, clips:THREE.AnimationClip[], bones:number, tris:number}}
 */
export function analyzeTemplate(scene, clips = []) {
  scene.updateMatrixWorld(true);
  const bones = collectBones(scene);
  const map = mapBones(bones);
  const usable = isUsable(map);
  const wrap = new THREE.Group(); wrap.name = 'nh-template';
  wrap.add(scene);
  if (usable) wrap.quaternion.copy(orientationFix(map));
  wrap.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(wrap, true);
  fixMaterials(wrap);
  let tris = 0; wrap.traverse((o) => { if (o.isMesh && o.geometry) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
  // things that make a character look wrong or run slowly, with the fix (tools/metahuman/optimize.mjs)
  const warnings = [], skeletons = new Set(); let skinned = 0;
  wrap.traverse((o) => { if (o.isSkinnedMesh && o.skeleton) { skinned++; skeletons.add(o.skeleton.bones.map((b) => b.id).sort((a, b) => a - b).join(',')); } });
  if (!skinned) warnings.push('no skinned mesh: the character is static');
  if (skeletons.size > 1) warnings.push(`${skeletons.size} separate skeletons (a face or hair mesh on its own skeleton does not follow the body) — run tools/metahuman/optimize.mjs`);
  if (!usable) warnings.push(`skeleton not recognised (missing: ${map.missing.join(', ') || 'bone names'}) — static pose`);
  if (bones.length > 300) warnings.push(`${bones.length} bones: slow to animate — run tools/metahuman/optimize.mjs (collapses the facial rig)`);
  if (tris > 120000) warnings.push(`${Math.round(tris / 1000)}k triangles per character: heavy for a crowd — run tools/metahuman/optimize.mjs --tris 30000`);
  return { root: wrap, map: { rig: map.rig, missing: map.missing }, usable, minY: box.min.y, height: Math.max(0.01, box.max.y - box.min.y), rig: map.rig, clips, bones: bones.length, tris: Math.round(tris), warnings };
}

export class GltfHuman {
  /**
   * @param {object} template  from analyzeTemplate
   * @param {string} look      look name (used for the height scale of the procedural LOOKS table)
   * @param {{seed?:number, scale?:number, height?:number}} opts  height = target height in metres (default 1.78 × scale)
   */
  constructor(template, look = 'inmateA', opts = {}) {
    this.isGltf = true; this.look = look; this.template = template;
    this.root = new THREE.Group();
    this.flip = new THREE.Group(); this.flip.rotation.y = Math.PI; this.root.add(this.flip);    // engine heading: forward = local −Z
    this.rig = new THREE.Group();
    const bs = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, fog: false }));
    bs.rotation.x = -Math.PI / 2; bs.position.y = 0.012; bs.scale.set(0.95, 0.8, 1); bs.renderOrder = 2; this.blob = bs; this.root.add(bs);
    const inst = this.inst = cloneSkinned(template.root);
    const h = (opts.height || 1.78) * (opts.scale || 1);
    const s = h / template.height;
    inst.scale.setScalar(s); inst.position.set(0, -template.minY * s, 0);
    this.rig.add(inst);
    this.rig.updateMatrixWorld(true);                                   // rig is still parentless: its world space IS the rig space
    this.driver = null;
    if (template.usable) {
      const map = mapBones(collectBones(inst));
      try { this.driver = new RigDriver(this.rig, map, { groundY: 0 }); } catch (e) { console.warn('[NH] character rig could not be driven:', e.message); }
    }
    this.flip.add(this.rig);
    this.height = h; this.heightRatio = h / 1.78;                       // same meaning as Humanoid.heightRatio
    // animation state (same variables as Humanoid)
    this.pose = 'idle'; this.cur = {}; this.seed = opts.seed || 1; this.phase = hash01(this.seed) * 6.28; this.walkAmt = 0; this.speed = 0;
    this.t = 0; this.talking = 0; this.stoop = 0; this.lookYaw = 0; this.lookPitch = 0; this._lie = 0; this._lean = 0; this._lod = 0;
    this.detail = []; inst.traverse((o) => { if (o.isMesh && o.userData.detail) this.detail.push(o); });
  }
  setPose(p) { this.pose = p; }
  setCast(v) { this.inst.traverse((o) => { if (o.isMesh) o.castShadow = v; }); }
  /** 0 = full detail, 1 = far (lashes, teeth, brows hidden). */
  setLod(level) { if (level === this._lod) return; this._lod = level; for (const m of this.detail) m.visible = level === 0; }
  update(dt, speed, lookRel = 0, pitchRel = 0) {
    this.t += dt;
    this.speed = damp(this.speed, speed, 8, dt);
    this.walkAmt = damp(this.walkAmt, Math.min(1, this.speed / 1.6), 8, dt);
    this.phase += this.speed * dt * 3.3;
    const { P, T, wa, walkOk, talk } = poseTargets(this.pose, { t: this.t, phase: this.phase, walkAmt: this.walkAmt, talking: this.talking, seed: this.seed, stoop: this.stoop });
    for (const key of Object.keys(T)) this.cur[key] = this.cur[key] === undefined ? T[key] : damp(this.cur[key], T[key], 12, dt);
    this.lookYaw = damp(this.lookYaw, Math.max(-1.0, Math.min(1.0, lookRel)), 6, dt);
    this.lookPitch = damp(this.lookPitch, Math.max(-0.4, Math.min(0.4, pitchRel)), 6, dt);
    if (this.driver) this.driver.apply(this.cur, { pose: this.pose, phase: this.phase, wa, walkOk, lookYaw: this.lookYaw, lookPitch: this.lookPitch, talk, t: this.t });
    else this.inst.position.y = -this.template.minY * this.inst.scale.y + Math.abs(Math.sin(this.phase)) * 0.03 * wa;   // rig not mappable: still stands, bobs while walking
    // lie / lean act on the whole rig, as in Humanoid
    this._lie = damp(this._lie, P.lie ? 1 : 0, 6, dt);
    this.rig.rotation.x = -this._lie * Math.PI / 2;
    this.rig.position.y = this._lie * 0.22;
    this._lean = damp(this._lean, P.lean ? 1 : 0, 6, dt);
    this.rig.rotation.z = this._lean * 0.08;
  }
}
