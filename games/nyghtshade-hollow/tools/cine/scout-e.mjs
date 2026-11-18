// Scouting batch E: faces. 85 mm close-ups of the cast, camera and lights placed relative to each character.
export const defaults = { fps: 24, w: 1920, h: 804 };
const LOOK = { ev: 0.5, light: { hi: 1.5, ai: 1.4, fog: 1.2 }, bloom: 1.15,
  grade: { contrast: 1.12, sat: 0.94, vignette: 0.5, shadowTint: [-0.004, 0.006, 0.014], highlightTint: [0.03, 0.015, -0.004], blackLift: 0.01 } };
const N = (id, o) => ({ rel: id, off: o });
const face = (id, npc, area, env, hour, head, side = 0.55, dist = 1.5, stage = {}) => ({
  id, dur: 3, stage: { area, env, hour, released: true, player: [0, 0, 0, 0], advance: 60, hide: [], show: [npc],
    lights: [{ p: N(npc, [0.9, head + 0.9, 1.3]), color: '#ffe2b8', intensity: 7, distance: 6 }, { p: N(npc, [-0.9, head + 0.8, -1.0]), color: '#8fb4ff', intensity: 9, distance: 6 }], ...stage },
  cam: { ease: 'smooth', keys: [{ p: N(npc, [side, head + 0.08, dist]), l: N(npc, [0, head, 0]), lens: 85 }, { p: N(npc, [side * 0.9, head + 0.08, dist * 0.93]), l: N(npc, [0, head, 0]), lens: 85 }] },
  fx: { ...LOOK, dof: { focus: N(npc, [0, head, 0]), fstop: 2.0 }, streak: { amount: 0.35, threshold: 3 } } });
export const shots = [
  face('E01-harrington', 'harrington', 'chapel', 'chapel', 13.4, 1.22),
  face('E02-cutter', 'cutter', 'canteen', 'canteen', 7.4, 1.25),
  face('E03-pruitt', 'pruitt', 'intake', 'intake', 8.7, 1.65),
  face('E04-reyes', 'reyes', 'hall', 'hall', 6.4, 1.65, 0.55, 1.5, { released: false }),
  face('E05-tuck', 'tuck', 'canteen', 'canteen', 7.4, 1.65),
];
