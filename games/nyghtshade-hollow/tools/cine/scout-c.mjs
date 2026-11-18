// Scouting batch C: bot-driven cutaways (the real playthrough seen from outside, Maddox's double visible) and corrected static angles.
export const defaults = { fps: 24, w: 1920, h: 804 };
const LOOK = { ev: 0.6, light: { hi: 1.8, ai: 1.6, fog: 1.3 }, bloom: 1.2, streak: { amount: 0.45, threshold: 2.8, len: 1 },
  grade: { contrast: 1.12, sat: 0.92, vignette: 0.5, shadowTint: [-0.004, 0.006, 0.014], highlightTint: [0.03, 0.015, -0.004], blackLift: 0.01 } };
const P = (o) => ({ rel: 'player', off: o });
const N = (id, o) => ({ rel: id, off: o });
const B = (id, at, p, l, lens, area, extra = {}) => ({ id, dur: 3, double: true, sim: { bot: 'shim', at }, stage: { area }, cam: { ease: 'smooth', keys: [{ p, l, lens }, { p: extra.p2 || p, l: extra.l2 || l, lens }] }, fx: LOOK });
const T = (id, stage, p, l, lens = 24, p2 = null) => ({ id, dur: 3, stage: { advance: 90, released: true, ...stage }, cam: { ease: 'smooth', keys: [{ p, l, lens }, { p: p2 || p, l, lens }] }, fx: LOOK });
export const shots = [
  B('C01-count-bars', 47, P([0.0, 1.55, 2.8]), P([0, 1.6, 0]), 35, 'hall'),
  B('C02-hall-walk', 62, P([0.9, 1.9, -2.4]), P([0, 1.5, 3]), 35, 'hall'),
  B('C03-chow-tray', 108, P([-0.9, 1.7, -1.4]), P([0.3, 1.4, 3]), 35, 'canteen'),
  B('C04-cutter-portrait', 140, N('cutter', [1.3, 1.2, 1.6]), N('cutter', [0, 1.15, 0]), 50, 'canteen'),
  B('C05-pruitt-desk', 192, N('pruitt', [1.8, 1.0, 2.4]), N('pruitt', [0, 1.4, 0]), 35, 'intake'),
  B('C06-records-sweep', 208, [44.8, 1.3, 4.2], [51.4, 2.9, 2.6], 24, 'records'),
  B('C07-harrington-pew', 292, N('harrington', [1.4, 1.25, 1.8]), N('harrington', [0, 1.2, 0]), 50, 'chapel'),
  B('C08-font-wide', 318, [-49.5, 1.8, 0.5], [-55, 0.7, -5.75], 24, 'chapel'),
  B('C09-tunnel-follow', 340, P([0.5, 1.5, -2.2]), P([0, 1.3, 3]), 28, 'tunnel1'),
  B('C10-gully', 385, P([1.0, 1.7, -3.0]), P([0, 1.6, 4]), 28, 'outside'),
  B('C11-clearing-talk', 405, N('harrington', [2.5, 1.2, 3.0]), N('harrington', [0, 1.2, 0]), 35, 'outside'),
  { id: 'C12-ending-own', dur: 3, sim: { bot: 'shim', at: 428 }, stage: { area: 'outside' }, cam: 'player', fx: { ev: 0.2 } },
  T('T01-tunnel-view', { area: 'tunnel1', env: 'tunnel', hour: 13.5, player: [-55, -3.2, -8, 0] }, [-55, -1.9, -7.0], [-55, -2.3, -24], 24, [-55, -1.9, -9.0]),
  T('T02-records-a', { area: 'records', env: 'records', hour: 9, player: [47, 0, 5, 0] }, [44.8, 1.2, 4.0], [51.4, 2.9, 2.6], 24),
  T('T03-records-b', { area: 'records', env: 'records', hour: 9, player: [47, 0, 5, 0] }, [51.0, 1.5, 9.8], [46.0, 2.6, 3.0], 24),
  T('T04-harrington-front', { area: 'chapel', env: 'chapel', hour: 13.4, player: [-52, 0, 0, 0] }, [-62.0, 1.3, 3.0], [-58.75, 1.2, 4.2], 50),
  T('T05-aisle-dolly', { area: 'chapel', env: 'chapel', hour: 13.4, player: [-52, 0, 0, 0] }, [-52.5, 1.2, 4.5], [-66, 2.2, 0.5], 28, [-60, 1.2, 4.5]),
  T('T06-font-closer', { area: 'chapel', env: 'chapel', hour: 13.4, player: [-52, 0, 0, 0] }, [-52.2, 1.3, -2.6], [-55, 0.7, -5.75], 35),
];
