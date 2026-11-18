// Procedural pose driver for an arbitrary humanoid skeleton (MetaHuman, Mixamo, Rigify, VRM…).
// glTF exports from MetaHuman carry the skeleton but no animation, so the same pose table the procedural Humanoid uses
// (poses.js) is applied to whatever bones rigmap.js found.  Bone local axes differ between rigs, so every rotation is expressed
// about the *rig's* axes (X lateral, Y up, Z forward) converted into each bone's rest frame:  q = rest · Rx(θx) · Ry(θy) · Rz(θz).
import * as THREE from 'three';

const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), AZ = new THREE.Vector3(0, 0, 1), DOWN = new THREE.Vector3(0, -1, 0);
const _q = new THREE.Quaternion(), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _v = new THREE.Vector3(), _w = new THREE.Vector3();

const wpos = (b, out = new THREE.Vector3()) => b.getWorldPosition(out);
const wquat = (b, out = new THREE.Quaternion()) => b.getWorldQuaternion(out);

class Joint {
  constructor(bone) {
    this.bone = bone;
    this.restQ = bone.quaternion.clone(); this.restPos = bone.position.clone();
    const iq = wquat(bone).invert();
    this.ax = AX.clone().applyQuaternion(iq); this.ay = AY.clone().applyQuaternion(iq); this.az = AZ.clone().applyQuaternion(iq);
  }
  /** rotation = rest · Rx · Ry · Rz  (radians; zero terms are skipped) */
  rot(x = 0, y = 0, z = 0) {
    const q = this.bone.quaternion.copy(this.restQ);
    if (x) q.multiply(_qa.setFromAxisAngle(this.ax, x));
    if (y) q.multiply(_qa.setFromAxisAngle(this.ay, y));
    if (z) q.multiply(_qa.setFromAxisAngle(this.az, z));
  }
}

/** Swing an upper-arm bone so the arm hangs straight down (turns T-/A-pose rest poses into the hanging pose the pose table assumes). */
function hangArm(arm, fore) {
  wpos(arm, _v); wpos(fore, _w);
  const dir = _w.sub(_v).normalize();
  const ang = dir.angleTo(DOWN);
  if (ang < 0.035) return;
  const delta = _qa.setFromUnitVectors(dir, DOWN);
  const world = wquat(arm).premultiply(delta);
  const parent = arm.parent ? wquat(arm.parent) : _qb.identity();
  arm.quaternion.copy(parent.invert().multiply(world));
  arm.updateMatrixWorld(true);
}

export class RigDriver {
  /**
   * @param {THREE.Object3D} space  the rig group: its world transform must be identity while this constructor runs (rest data is read in this space)
   * @param {object} map  result of mapBones()
   * @param {{groundY?:number}} opts  groundY = rest-pose floor height in rig space (model min Y)
   */
  constructor(space, map, opts = {}) {
    this.space = space; this.map = map;
    space.updateMatrixWorld(true);
    // left/right by geometry so the pose table's "l" side is always the −X side whatever the rig calls it
    const side = (a, b) => (wpos(a).x <= wpos(b).x ? [a, b] : [b, a]);
    const [armN, armP] = side(map.L.arm, map.R.arm);
    // the forearm is the arm's child
    const foreOf = (arm) => [map.L.fore, map.R.fore].find((f) => f && f.parent === arm) || (arm === map.L.arm ? map.L.fore : map.R.fore);
    const fN = foreOf(armN), fP = foreOf(armP);
    if (fN) hangArm(armN, fN);
    if (fP) hangArm(armP, fP);
    space.updateMatrixWorld(true);
    const [thN, thP] = side(map.L.thigh, map.R.thigh);
    const calfOf = (th) => [map.L.calf, map.R.calf].find((c) => c && c.parent === th) || (th === map.L.thigh ? map.L.calf : map.R.calf);
    const footOf = (c) => [map.L.foot, map.R.foot].find((f) => f && f.parent === c) || (c === map.L.calf ? map.L.foot : map.R.foot);
    const cN = calfOf(thN), cP = calfOf(thP);
    this.j = {
      hips: new Joint(map.hips), head: new Joint(map.head), jaw: map.jaw ? new Joint(map.jaw) : null,
      spine: map.spine.map((b) => new Joint(b)), neck: map.neck.map((b) => new Joint(b)),
      armN: new Joint(armN), armP: new Joint(armP), foreN: fN ? new Joint(fN) : null, foreP: fP ? new Joint(fP) : null,
      thN: new Joint(thN), thP: new Joint(thP), calfN: cN ? new Joint(cN) : null, calfP: cP ? new Joint(cP) : null,
      footN: cN && footOf(cN) ? new Joint(footOf(cN)) : null, footP: cP && footOf(cP) ? new Joint(footOf(cP)) : null,
    };
    // measurements in rig units (metres once the rig is scaled)
    const hp = wpos(map.hips);
    const gy = opts.groundY ?? Math.min(...[this.j.footN, this.j.footP].filter(Boolean).map((j) => wpos(j.bone).y), hp.y);
    this.hipsH = hp.y - gy;
    this.L1 = cN ? wpos(thN).distanceTo(wpos(cN)) : this.hipsH * 0.5;
    this.L2 = cN && this.j.footN ? wpos(cN).distanceTo(wpos(this.j.footN.bone)) : this.hipsH * 0.45;
    this.legScale = (this.L1 + this.L2) / 0.86;
    // soles: rest height of the ankle and of the ball of each foot above the floor (rig space), for the ground lock in apply()
    this.soles = [this.j.footN, this.j.footP].filter(Boolean).map((fj) => {
      const toe = [map.L.toe, map.R.toe].find((t) => t && t.parent === fj.bone) || (fj.bone === map.L.foot ? map.L.toe : fj.bone === map.R.foot ? map.R.toe : null);
      return { foot: fj.bone, toe: toe || null, ankleH: wpos(fj.bone).y - gy, ballH: toe ? wpos(toe).y - gy : 0 };
    });
    // hips translation: a metre of world "up" expressed in the hips' parent space
    const p = map.hips.parent;
    if (p) { const inv = p.matrixWorld.clone().invert(); this.hipsUp = _v.set(0, 1, 0).applyMatrix4(inv).sub(_w.set(0, 0, 0).applyMatrix4(inv)).clone(); }
    else this.hipsUp = new THREE.Vector3(0, 1, 0);
  }

  /**
   * Apply the damped joint values C (see poses.js) to the skeleton.
   * @param {object} C  current joint values (hipsY, spine, head, lThigh…rUpperZ)
   * @param {object} x  { pose, phase, wa, walkOk, lookYaw, lookPitch, talk, t }
   */
  apply(C, x) {
    const j = this.j;
    // pelvis height: pose offset (scaled to this rig's legs); standing / walking poses are then ground-locked (below), or planted by leg geometry if the feet are unknown
    let plant = 0;
    if (x.walkOk && x.wa > 0.01 && !this.soles.length) {
      const drop = (a, k) => this.L1 * Math.cos(a) + this.L2 * Math.cos(a + k);
      plant = Math.max(drop(C.lThigh, C.lKnee), drop(C.rThigh, C.rKnee)) - (this.L1 + this.L2);
    }
    const dy = C.hipsY * this.legScale + plant;
    j.hips.bone.position.copy(j.hips.restPos).addScaledVector(this.hipsUp, dy);
    j.hips.rot(0, 0, Math.sin(x.phase) * 0.03 * x.wa);
    // spine: bend and counter-twist shared across the chain
    const ns = j.spine.length || 1, twist = Math.sin(x.phase) * -0.08 * x.wa;
    for (const s of j.spine) s.rot(C.spine / ns, twist / ns, 0);
    // neck + head
    const pitch = C.head + x.lookPitch, yaw = x.lookYaw;
    const nn = j.neck.length;
    for (const n of j.neck) n.rot(pitch * 0.4 / nn, yaw * 0.4 / nn, 0);
    j.head.rot(pitch * (nn ? 0.6 : 1), yaw * (nn ? 0.6 : 1), 0);
    if (j.jaw) j.jaw.rot(x.talk ? (0.07 + 0.07 * Math.max(0, Math.sin(x.t * 13 + Math.sin(x.t * 3.1) * 2))) * x.talk : 0, 0, 0);
    // legs (−X side = "l")
    j.thN.rot(C.lThigh); j.thP.rot(C.rThigh);
    if (j.calfN) j.calfN.rot(C.lKnee); if (j.calfP) j.calfP.rot(C.rKnee);
    const ank = x.pose === 'pray' ? 0 : 0.35;
    if (j.footN) j.footN.rot(-(C.lThigh + C.lKnee) * ank); if (j.footP) j.footP.rot(-(C.rThigh + C.rKnee) * ank);
    // arms
    j.armN.rot(C.lUpper, 0, C.lUpperZ); j.armP.rot(C.rUpper, 0, C.rUpperZ);
    if (j.foreN) j.foreN.rot(C.lElbow); if (j.foreP) j.foreP.rot(C.rElbow);
    if (x.walkOk && this.soles.length) this._groundLock();
  }

  /** Standing/walking: lower or raise the pelvis so the lowest sole point of either foot rests exactly on the floor (one foot is always planted). */
  _groundLock() {
    const sp = this.space;
    let low = Infinity;
    for (const s of this.soles) {
      (s.toe || s.foot).updateWorldMatrix(true, false);          // refreshes the whole chain above it (pelvis -> thigh -> calf -> foot -> ball) only
      low = Math.min(low, sp.worldToLocal(wpos(s.foot, _v)).y - s.ankleH);
      if (s.toe) low = Math.min(low, sp.worldToLocal(wpos(s.toe, _v)).y - s.ballH);
    }
    if (Number.isFinite(low)) this.j.hips.bone.position.addScaledVector(this.hipsUp, -low);
  }
}
