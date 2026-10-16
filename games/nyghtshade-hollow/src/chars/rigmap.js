// Finds the bones a pose driver needs in a loaded humanoid skeleton, whatever the naming scheme:
//   MetaHuman / UE5 mannequin (pelvis, spine_01…05, neck_01, head, clavicle_l, upperarm_l, lowerarm_l, hand_l, thigh_l, calf_l, foot_l, ball_l)
//   Mixamo (mixamorig:Hips, Spine1, LeftArm, LeftForeArm, LeftUpLeg, LeftLeg, LeftToeBase)   Rigify (thigh.L, shin.L, upper_arm.L, forearm.L)
//   VRM / Unity humanoid (hips, spine, chest, upperChest, neck, head, leftUpperArm, leftLowerArm, leftUpperLeg, leftLowerLeg, leftToes)
// Pure functions over anything with { name, parent, children } so they run (and are unit-tested) without WebGL.

const JUNK = /^(mch|org|ctrl|tweak)_|twist|corrective|correctiveroot|(^|_)ik(_|$)|pole|helper|proxy|dummy|nub|(^|_)end$|_end(_|$)|roll|target|socket|attach|weapon|cloth/;
const FINGER = /thumb|index|middle|ring|pinky|pinkie|little|finger/;

export function normalizeBoneName(n) {
  return String(n || '').toLowerCase()
    .replace(/^(mixamorig:?|bip0?1[ _]?|armature[|.:_]|skel[|.:_]|cc_base_|def[-_.])/, '')
    .replace(/^j_bip_([lrc])_/, (m, side) => (side === 'c' ? '' : side + '_'))        // VRoid: J_Bip_L_UpperArm -> l_upperarm (the side letter stays)
    .replace(/[\s.\-|:]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

/** 'L' | 'R' | null from a normalized name. */
export function sideOf(nn) {
  if (/(^|_)(l|left)(_|$)/.test(nn) || /^left[a-z]/.test(nn) || /[a-z]left$/.test(nn)) return 'L';
  if (/(^|_)(r|right)(_|$)/.test(nn) || /^right[a-z]/.test(nn) || /[a-z]right$/.test(nn)) return 'R';
  return null;
}

/** Role of one bone by name, or null.  Roles: hips, spine, neck, head, jaw, clav, arm, fore, hand, thigh, calf, foot, toe. */
export function roleOf(name) {
  const nn = normalizeBoneName(name);
  if (!nn || JUNK.test(nn)) return null;
  const side = sideOf(nn);
  const core = nn.replace(/(^|_)(l|r|left|right)(?=_|$)/g, '$1').replace(/^(left|right)/, '').replace(/(left|right)$/, '').replace(/_+/g, '_').replace(/^_|_$/g, '');
  const finger = FINGER.test(core);
  if (/^(pelvis|hips?|hip)$/.test(core)) return { role: 'hips', side: null };
  if (/^(spine|chest|upperchest|upper_chest|spine_?\d+|chest_?\d+)$/.test(core)) return { role: 'spine', side: null };
  if (/^neck(_?\d+)?$/.test(core)) return { role: 'neck', side: null };
  if (/^head$/.test(core)) return { role: 'head', side: null };
  if (/jaw/.test(core) && !/(lower|upper)?lip|chin|cheek|teeth/.test(core.replace('jaw', ''))) return { role: 'jaw', side: null };
  if (finger) return null;
  if (/^(clavicle|shoulder|collar|collarbone)$/.test(core) && side) return { role: 'clav', side };
  if (/^(lowerarm|lower_arm|forearm|fore_arm)$/.test(core) && side) return { role: 'fore', side };
  if (/^(upperarm|upper_arm|arm)$/.test(core) && side) return { role: 'arm', side };
  if (/^hand$/.test(core) && side) return { role: 'hand', side };
  if (/^(thigh|upleg|up_leg|upperleg|upper_leg)$/.test(core) && side) return { role: 'thigh', side };
  if (/^(calf|shin|lowerleg|lower_leg|leg)$/.test(core) && side) return { role: 'calf', side };
  if (/^foot$/.test(core) && side) return { role: 'foot', side };
  if (/^(ball|toe|toes|toebase|toe_base)$/.test(core) && side) return { role: 'toe', side };
  return null;
}

const depthOf = (b) => { let d = 0; for (let p = b.parent; p; p = p.parent) d++; return d; };
const isAncestor = (a, b) => { for (let p = b.parent; p; p = p.parent) if (p === a) return true; return false; };

/**
 * mapBones(bones) -> { hips, spine: Bone[] (waist → chest), neck: Bone[], head, jaw, L: {clav, arm, fore, hand, thigh, calf, foot, toe}, R: {...}, rig, missing: string[] }
 * `bones` = every skeleton bone (or any Object3D with a name).  When several bones fit a role (MetaHuman has twist/corrective helpers
 * that are filtered out, but also spine_01…05 / neck_01…02) the chain is returned in hierarchy order.
 */
export function mapBones(bones) {
  const found = { hips: [], spine: [], neck: [], head: [], jaw: [], L: {}, R: {} };
  for (const b of bones) {
    const r = roleOf(b.name);
    if (!r) continue;
    if (r.side) { const slot = found[r.side]; if (!slot[r.role] || depthOf(b) < depthOf(slot[r.role])) slot[r.role] = b; }
    else found[r.role].push(b);
  }
  const byDepth = (a, b) => depthOf(a) - depthOf(b);
  const hips = found.hips.sort(byDepth)[0] || null;
  const head = found.head.sort(byDepth)[0] || null;
  const spine = found.spine.filter((b) => !hips || isAncestor(hips, b)).sort(byDepth);
  const neck = found.neck.filter((b) => !hips || isAncestor(hips, b)).sort(byDepth);
  const jaw = found.jaw.find((b) => /^(facial_c_)?jaw$/.test(normalizeBoneName(b.name))) || found.jaw.sort(byDepth)[0] || null;      // MetaHuman: FACIAL_C_Jaw, not its helpers
  // arms must hang below the last spine bone, legs below the hips: drop duplicates that live elsewhere in the hierarchy
  const names = bones.map((b) => normalizeBoneName(b.name));
  const rig = names.some((n) => n === 'pelvis') && names.some((n) => /^spine_0?1$/.test(n)) ? 'metahuman'
    : bones.some((b) => /^mixamorig/i.test(b.name)) ? 'mixamo'
    : names.some((n) => /^upper_arm_(l|r)$/.test(n)) && names.some((n) => /^shin_(l|r)$/.test(n)) ? 'rigify'
    : names.some((n) => n === 'upperchest' || n === 'lefthand' || n === 'lefthand') && names.some((n) => n === 'leftupperleg') ? 'vrm' : 'generic';
  const missing = [];
  if (!hips) missing.push('hips');
  if (!head) missing.push('head');
  for (const s of ['L', 'R']) for (const r of ['arm', 'fore', 'thigh', 'calf', 'foot']) if (!found[s][r]) missing.push(`${s}.${r}`);
  return { hips, spine, neck, head, jaw, L: found.L, R: found.R, rig, missing };
}

/** A map is usable if the driver can animate legs and arms from it. */
export function isUsable(map) { return !!(map.hips && map.head && map.L.thigh && map.R.thigh && map.L.calf && map.R.calf && map.L.arm && map.R.arm); }
