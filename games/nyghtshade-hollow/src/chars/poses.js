// Pose table + per-frame joint targets shared by the procedural Humanoid and glTF characters (GltfHuman).
// Angles are radians about the rig's lateral (X) axis unless a key says otherwise; the rig faces +Z, +Y is up.
//   *Thigh: negative = leg forward · *Knee: positive = calf folds back · *Upper: negative = arm forward/up · *Elbow: negative = forearm up
//   *UpperZ: about the forward axis (arm abduction) · hipsY: metres the pelvis sinks · spine/head: forward bend
export const POSES = {
  idle: {},
  sit: { hipsY: -0.5, lThigh: -1.55, rThigh: -1.55, lKnee: 1.5, rKnee: 1.5, lUpper: -0.4, rUpper: -0.4, lElbow: -1.0, rElbow: -1.0 },
  lie: { lie: 1 },
  lean: { lean: 1, lUpper: 0.1, rUpper: -0.2, rElbow: -1.2 },
  pray: { hipsY: -0.42, lThigh: -0.2, rThigh: -0.2, lKnee: 2.4, rKnee: 2.4, spine: 0.3, head: 0.45, lUpper: -0.9, rUpper: -0.9, lElbow: -1.7, rElbow: -1.7, lUpperZ: 0.2, rUpperZ: -0.2 },
  mop: { spine: 0.28, lUpper: -0.8, rUpper: -0.9, lElbow: -0.6, rElbow: -0.5, mop: 1 },
  hands: { lUpper: -3.0, rUpper: -3.0, lElbow: -0.3, rElbow: -0.3 },
  talk: { talk: 1 },
  stand: {},
  read: { lUpper: -0.7, rUpper: -0.7, lElbow: -1.6, rElbow: -1.6, head: 0.35 },
  ground: { hipsY: -0.86, lThigh: -1.4, rThigh: -1.25, lKnee: 0.45, rKnee: 0.7, spine: -0.08, head: 0.05, lUpper: 0.2, rUpper: -0.35, lElbow: -0.5, rElbow: -1.0 },
  type: { spine: 0.08, lUpper: -0.7, rUpper: -0.7, lElbow: -1.3, rElbow: -1.3, type: 1 },
};

/** Joint targets for a pose at time `st.t` (walk phase `st.phase`, walk blend `st.walkAmt`). Returns { P, T, wa, walkOk }. */
export function poseTargets(pose, st) {
  const P = POSES[pose] || POSES.idle;
  const w = st.walkAmt;
  const s = Math.sin(st.phase), c = Math.cos(st.phase);
  const breathe = Math.sin(st.t * 1.7 + st.seed) * 0.012;
  const shift = Math.sin(st.t * 0.4 + st.seed * 3.1) * 0.03;
  const talk = P.talk || st.talking ? Math.max(P.talk || 0, st.talking) : 0;
  const g = (k, d = 0) => (P[k] !== undefined ? P[k] : d);
  const walkOk = pose === 'idle' || pose === 'stand' || pose === 'talk';
  const wa = walkOk ? w : 0;
  const T = {
    hipsY: g('hipsY') + Math.abs(s) * -0.03 * wa,
    spine: g('spine') + breathe + st.stoop * (1 - wa * 0.3) + (g('mop') ? Math.sin(st.t * 2.2) * 0.05 : 0),
    head: g('head') + st.stoop * -0.4 + Math.sin(st.t * 0.6 + st.seed) * 0.03,
    lThigh: g('lThigh') + s * 0.62 * wa, rThigh: g('rThigh') - s * 0.62 * wa,
    lKnee: g('lKnee') + Math.max(0, -c) * 0.8 * wa, rKnee: g('rKnee') + Math.max(0, c) * 0.8 * wa,
    lUpper: g('lUpper', 0.05) - s * 0.55 * wa + (talk ? Math.sin(st.t * 2.3) * 0.18 - 0.2 : 0),
    rUpper: g('rUpper', 0.05) + s * 0.55 * wa + (talk ? Math.sin(st.t * 2.9 + 1) * 0.28 - 0.5 : 0),
    lElbow: g('lElbow', -0.15) - (wa > 0.1 ? 0.3 * wa : 0), rElbow: g('rElbow', -0.15) - (wa > 0.1 ? 0.3 * wa : 0) - (talk ? 0.5 : 0),
    lUpperZ: g('lUpperZ', 0.05) + shift * 0.3, rUpperZ: g('rUpperZ', -0.05) + shift * 0.3,
  };
  if (P.mop) { T.lUpper = -0.9 + Math.sin(st.t * 2.2) * 0.12; T.rUpper = -0.95 + Math.sin(st.t * 2.2) * 0.12; }
  if (P.type) { T.lElbow = -1.3 + Math.sin(st.t * 11) * 0.06; T.rElbow = -1.3 + Math.sin(st.t * 13 + 1) * 0.06; }
  return { P, T, wa, walkOk, talk };
}
