// Small shared helpers: seeded RNG, math, event bus.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const saturate = (v) => clamp(v, 0, 1);
export const smoothstep = (a, b, v) => { const t = saturate((v - a) / (b - a)); return t * t * (3 - 2 * t); };
/** Frame-rate independent exponential smoothing. */
export const damp = (cur, target, lambda, dt) => lerp(cur, target, 1 - Math.exp(-lambda * dt));
export function dampAngle(cur, target, lambda, dt) {
  let d = ((target - cur + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return cur + d * (1 - Math.exp(-lambda * dt));
}
export const angleDiff = (a, b) => ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
export const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
export const fmtClock = (h) => {
  const hh = Math.floor(h) % 24, mm = Math.floor((h % 1) * 60);
  return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
};
export const hash01 = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

export class Emitter {
  constructor() { this._h = new Map(); }
  on(ev, fn) { (this._h.get(ev) || this._h.set(ev, []).get(ev)).push(fn); return () => this.off(ev, fn); }
  off(ev, fn) { const a = this._h.get(ev); if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } }
  emit(ev, ...args) { const a = this._h.get(ev); if (a) for (const f of a.slice()) f(...args); }
}
