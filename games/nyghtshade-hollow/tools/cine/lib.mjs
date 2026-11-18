// Cinematography helpers for tools/cine: camera paths (Catmull-Rom through keys, eased), handheld shake, keyframed scalars, per-frame specs for NH_DIR.frame().
// A camera key is { p, l, lens, roll, t } where p / l are [x,y,z] or { rel: 'player' | npcId, off: [right, up, forward] } and t (0..1) is optional (keys are evenly spaced without it).

const ease = {
  linear: (x) => x,
  smooth: (x) => x * x * (3 - 2 * x),
  cubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  in: (x) => x * x,
  out: (x) => 1 - (1 - x) * (1 - x),
  slowin: (x) => Math.pow(x, 1.7),
  slowout: (x) => 1 - Math.pow(1 - x, 1.7),
};
export const easeFn = (name) => ease[name] || ease.smooth;
const cr = (p0, p1, p2, p3, t) => { const t2 = t * t, t3 = t2 * t; return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); };
const spline = (vals, s) => {
  const n = vals.length; if (n === 1) return vals[0].slice();
  const i = Math.max(0, Math.min(n - 2, Math.floor(s))), t = Math.max(0, Math.min(1, s - i));
  const a = vals[Math.max(0, i - 1)], b = vals[i], c = vals[i + 1], d = vals[Math.min(n - 1, i + 2)];
  return b.map((_, k) => cr(a[k], b[k], c[k], d[k], t));
};
/** key index position for a normalised time u (keys may carry t) */
const segment = (keys, u) => {
  const n = keys.length; if (n === 1) return 0;
  const ts = keys.map((k, i) => (k.t !== undefined ? k.t : i / (n - 1)));
  if (u <= ts[0]) return 0; if (u >= ts[n - 1]) return n - 1;
  let j = 0; while (j < n - 2 && u > ts[j + 1]) j++;
  return j + (u - ts[j]) / Math.max(1e-9, ts[j + 1] - ts[j]);
};
const vec = (v) => (Array.isArray(v) ? v : v.off);
const wrapVec = (src, arr) => (Array.isArray(src) ? arr : { rel: src.rel, off: arr });

/** Evaluate a camera description { keys, ease } at normalised time u (0..1). Returns { p, l, lens, roll }. */
export function camAt(cam, u) {
  const keys = cam.keys, e = easeFn(cam.ease)(Math.max(0, Math.min(1, u))), s = segment(keys, e);
  const p = spline(keys.map((k) => vec(k.p)), s), l = spline(keys.map((k) => vec(k.l)), s);
  const lens = spline(keys.map((k) => [k.lens ?? keys[0].lens ?? 35]), s)[0], roll = spline(keys.map((k) => [k.roll ?? 0]), s)[0];
  return { p: wrapVec(keys[0].p, p), l: wrapVec(keys[0].l, l), lens, roll };
}

/** Keyframed scalar: number, or [{u, v}, …] (smooth between keys). */
export function keyed(v, u, def = 0) {
  if (v === undefined || v === null) return def;
  if (typeof v === 'number') return v;
  if (!v.length) return def;
  if (u <= v[0].u) return v[0].v; if (u >= v[v.length - 1].u) return v[v.length - 1].v;
  let j = 0; while (j < v.length - 2 && u > v[j + 1].u) j++;
  const a = v[j], b = v[j + 1], x = (u - a.u) / Math.max(1e-9, b.u - a.u);
  return a.v + (b.v - a.v) * ease.smooth(x);
}

/** Deterministic handheld shake: sums of sines with fixed phases. pos in metres, aim in degrees. */
export function shakeAt(cfg, t) {
  if (!cfg) return null;
  const f = cfg.freq ?? 1.1, a = cfg.pos ?? 0.01, r = cfg.aim ?? 0.25, w = (k, ph) => Math.sin(6.2831853 * f * t * k + ph);
  const n = (ph) => 0.55 * w(1, ph) + 0.3 * w(2.3, ph * 1.7 + 1) + 0.15 * w(4.1, ph * 2.3 + 2);
  return { dp: [n(0.3) * a, n(1.9) * a * 0.8, n(3.1) * a], da: [n(4.4) * r, n(5.7) * r] };
}
const sub = (a, b) => a.map((v, i) => v - b[i]), add = (a, b) => a.map((v, i) => v + b[i]), len = (a) => Math.hypot(...a);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = len(a) || 1; return a.map((v) => v / l); };
/** Apply shake to an absolute pose (only absolute positions are shaken; rel poses are returned unchanged). */
export function applyShake(pose, sh) {
  if (!sh || !Array.isArray(pose.p) || !Array.isArray(pose.l)) return pose;
  const f = norm(sub(pose.l, pose.p)), right = norm(cross(f, [0, 1, 0])), up = cross(right, f), d = len(sub(pose.l, pose.p));
  const k = Math.tan((sh.da[0] * Math.PI) / 180) * d, k2 = Math.tan((sh.da[1] * Math.PI) / 180) * d;
  return { ...pose, p: add(pose.p, sh.dp), l: add(pose.l, [right[0] * k + up[0] * k2, right[1] * k + up[1] * k2, right[2] * k + up[2] * k2]) };
}

/** Everything NH_DIR.frame() needs for output frame i of n of a shot. */
export function frameSpec(shot, i, n, fps, defaults = {}) {
  const dur = n / fps, u = n > 1 ? i / n : 0, t = i / fps, fx = { ...(defaults.fx || {}), ...(shot.fx || {}) };
  const fpv = shot.cam === 'player';                                   // first-person: the game's own camera, effects only
  const pose = (uu, tt) => applyShake(camAt(shot.cam, uu), shakeAt(shot.cam.shake, tt));
  const cur = fpv ? { p: [0, 0, 0], l: [0, 0, -1], lens: 35, roll: 0 } : pose(u, t);
  const spec = { fpv, p: cur.p, l: cur.l, lens: cur.lens, roll: cur.roll, dt: 1 / fps, area: fpv ? undefined : shot.stage && shot.stage.area, env: fpv ? undefined : shot.stage && shot.stage.env, outside: fpv ? undefined : shot.stage && (shot.stage.camOutside ?? shot.stage.area === 'outside') };
  if (shot.sim && shot.sim.bot) spec.bot = true;
  if (shot.hours) spec.hour = shot.hours[0] + (shot.hours[1] - shot.hours[0]) * u;
  if (shot.releaseAt !== undefined) spec.released = u >= shot.releaseAt;
  if (shot.double) spec.double = true;
  if (shot.walk) {                                                     // the player stand-in walks a path (staged shots): position, heading from the motion, speed in m/s
    const w = { keys: shot.walk.keys.map((k) => ({ p: k.p, l: k.p, t: k.t })), ease: shot.walk.ease || 'linear' };
    const at = (uu) => camAt(w, Math.max(0, Math.min(1, uu))).p, a = at(u), b = at(u + 1 / n), dx = b[0] - a[0], dz = b[2] - a[2], d = Math.hypot(dx, dz);
    spec.pl = { pos: a, yaw: d > 1e-6 ? Math.atan2(-dx, -dz) : (shot.walk.yaw ?? 0), speed: d * fps };
    if (d < 1e-6 && shot.walk.yaw !== undefined) spec.pl.yaw = shot.walk.yaw;
    if (shot.walk.yaw !== undefined && shot.walk.fixedYaw) spec.pl.yaw = shot.walk.yaw;
  }
  // lens / depth of field
  if (fx.dof && !fpv) {
    const d = fx.dof, focus = typeof d.focus === 'object' && !Array.isArray(d.focus) && d.focus.keys ? keyed(d.focus.keys, u) : d.focus;
    spec.dof = { focus, fstop: keyed(d.fstop, u, 2), maxR: d.maxR, boost: d.boost, taps: d.taps };
  }
  // motion blur: the pose half a shutter-interval earlier (180 degrees = half the frame time)
  if (fx.mb && !fpv) { const dt = 0.5 / fps; const pu = Math.max(0, u - dt / dur), pt = t - dt; const pv = pose(pu, pt); spec.prev = { p: pv.p, l: pv.l, lens: pv.lens, roll: pv.roll }; spec.mb = fx.mb === true ? 1 : fx.mb; }
  if (fx.streak) spec.streak = fx.streak;
  if (fx.grade) spec.grade = fx.grade;
  if (fx.light) spec.light = fx.light;
  spec.ev = keyed(fx.ev, u, 0); spec.bloom = keyed(fx.bloom, u, 1);
  if (fx.eyelid !== undefined) spec.eyelid = keyed(fx.eyelid, u, 0);
  if (fx.blur !== undefined) spec.blur = keyed(fx.blur, u, 0);
  if (fx.flash !== undefined) spec.flash = keyed(fx.flash, u, 0);
  return spec;
}

export const seconds = (s) => s;
