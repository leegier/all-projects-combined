// A2 the ask (bars 11-16), A3 alarm and chase (bars 17-22), A3d the drop (bar 23). First rough version: refined after scouting.
import { look } from './look.mjs';
const WARM = look('warm'), ALARM = look('alarm');
const ALJS = (pa = false) => `const r0 = g.render.bind(g); g.render = (a, b) => { const l = g.alert.level; g.alert.level = 2; ${pa ? "g.ui.pa('EMERGENCY LOCKDOWN. ALL INMATES TO YOUR CELLS IMMEDIATELY.');" : ''} try { r0(a, b); } finally { g.alert.level = l; } };`;
const f = (n) => n / 24;
const st = (id, n, stage, p, l, lens = 28, p2 = null, o = {}) => ({ id, dur: f(n), notes: o.notes || '', stage: { advance: 60, released: true, humans: 'hide', hour: 8.9, ...stage }, cam: { ease: 'smooth', keys: [{ p, l, lens }, { p: p2 || p, l: o.l2 || l, lens: o.lens2 || lens }] }, fx: { ...(o.alarm ? ALARM : WARM), ...(o.fx || {}) } });
const fp = (id, n, bot, at, o = {}) => ({ id, dur: f(n), notes: o.notes || '', sim: { bot, at, speed: o.speed }, cam: 'player', stage: { humans: 'hide', js: o.js }, fx: o.alarm ? ALARM : WARM, ui: !!o.ui });
const E = { area: 'eastCorr', env: 'eastCorr', player: [30, 0, 0, 0] }, I = { area: 'intake', player: [36, 0, 3, 0] }, R = { area: 'records', env: 'records', player: [47, 0, 4, 0], hour: 9 };
export const shots = [
  st('A2-01-corridor', 32, E, [24.5, 0.55, 0.9], [38, 1.7, 0], 24, [30, 0.6, 0.5]),
  st('A2-02-glass', 24, I, [35.2, 1.4, 7.4], [37.5, 1.6, 3.2], 28, [36.2, 1.4, 7.4]),
  fp('A2-03-reader', 32, 'shim', 194),
  st('A2-04-door', 24, I, [31.0, 1.5, 3.5], [44, 1.7, 6.0], 24, [32.5, 1.5, 3.6]),
  st('A2-05-records', 24, R, [44.6, 1.4, 3.4], [50, 1.5, 7], 24, [44.9, 1.4, 3.6]),
  st('A2-06-ledger', 32, R, [46.9, 1.25, 5.2], [48.3, 0.95, 5.9], 50),
  st('A2-07-sign', 24, R, [50.2, 1.6, 3.6], [51.6, 1.75, 6.4], 50),
  fp('A2-08-copy', 48, 'shim', 211.2, { ui: true }),
  st('A2-09-corridor-b', 32, E, [33, 1.2, -1.8], [36, 2.95, 2.2], 35, [34, 1.25, -1.8]),
  st('A2-10-counter', 32, I, [32.3, 1.2, 5.1], [38.5, 1.35, 5.7], 35, [33.6, 1.2, 5.1]),
  st('A2-11-records-b', 32, R, [44.6, 1.4, 3.4], [50, 1.5, 7], 24, [44.9, 1.4, 3.6]),
  fp('A2-12-detect', 48, 'shim', 213.2, { ui: true }),
  // A3
  ...Array.from({ length: 24 }, (_, i) => st(`A3-${String(i + 1).padStart(2, '0')}-red`, 16, { ...E, js: ALJS() }, [30, 1.0, -1.2], [36, 3.15, 1.85], 35, null, { alarm: true })),
  st('A3d-01-cell', 64, { area: 'hall', hour: 23, released: false, player: [0, 0, 3, 0] }, [0.55, 1.4, -6.2], [0.55, 1.3, -9.2], 35, [0.55, 1.4, -6.8], { fx: { ev: -0.5 } }),
];
