// Scouting batch D: full-resolution checks of depth of field, motion blur and streaks.
export const defaults = { fps: 24, w: 1920, h: 804 };
const LOOK = { ev: 0.6, light: { hi: 1.8, ai: 1.6, fog: 1.3 }, bloom: 1.2,
  grade: { contrast: 1.12, sat: 0.92, vignette: 0.5, shadowTint: [-0.004, 0.006, 0.014], highlightTint: [0.03, 0.015, -0.004], blackLift: 0.01 } };
const P = (o) => ({ rel: 'player', off: o });
export const shots = [
  { id: 'D01-count-dof', dur: 3, double: true, sim: { bot: 'shim', at: 47 }, stage: { area: 'hall', lights: [{ p: P([0.6, 2.4, 1.6]), color: '#9fc4ff', intensity: 14, distance: 8 }, { p: P([-0.4, 2.2, -1.2]), color: '#ffb070', intensity: 5, distance: 6 }] },
    cam: { ease: 'smooth', keys: [{ p: P([0.0, 1.6, 2.6]), l: P([0, 1.62, 0]), lens: 85 }, { p: P([0.1, 1.62, 2.2]), l: P([0, 1.62, 0]), lens: 85 }] }, fx: { ...LOOK, dof: { focus: P([0, 1.62, 0]), fstop: 1.6 }, streak: { amount: 0.5, threshold: 2.4 } } },
  { id: 'D02-records-lamp', dur: 3, stage: { area: 'records', env: 'records', hour: 9, released: true, player: [47, 0, 5, 0], advance: 90 },
    cam: { ease: 'smooth', keys: [{ p: [51.0, 1.5, 9.8], l: [46.0, 2.6, 3.0], lens: 35 }, { p: [50.0, 1.5, 9.6], l: [46.0, 2.6, 3.0], lens: 35 }] }, fx: { ...LOOK, streak: { amount: 0.7, threshold: 2.2 }, dof: { focus: [48.3, 0.95, 5.9], fstop: 2.0 } } },
  { id: 'D03-hall-mb', dur: 3, stage: { area: 'hall', env: 'hall', hour: 7.6, released: true, player: [0, 0, 3, 0], advance: 90 },
    cam: { ease: 'linear', keys: [{ p: [-15, 1.5, 4.0], l: [-6, 1.6, 8.0], lens: 24 }, { p: [10, 1.5, 4.0], l: [19, 1.6, 8.0], lens: 24 }] }, fx: { ...LOOK, mb: 1 } },
  { id: 'D04-chapel-dolly', dur: 3, stage: { area: 'chapel', env: 'chapel', hour: 13.4, released: true, player: [-52, 0, 0, 0], advance: 90 },
    cam: { ease: 'smooth', keys: [{ p: [-52.5, 1.2, 4.5], l: [-66, 2.2, 0.5], lens: 28 }, { p: [-60, 1.2, 4.5], l: [-68, 2.2, 0.5], lens: 28 }] }, fx: { ...LOOK, streak: { amount: 0.5, threshold: 2.6 }, dof: { focus: 9, fstop: 2.8 }, mb: 1 } },
];
