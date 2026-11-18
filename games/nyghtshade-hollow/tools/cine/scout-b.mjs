// Scouting batch B: the look. Same hall camera with different cine looks, then the other locations.
export const defaults = { fps: 24, w: 1920, h: 804 };
const LOOK = { ev: 0.7, light: { hi: 1.9, ai: 1.7, fog: 1.4 }, bloom: 1.25, streak: { amount: 0.5, threshold: 2.6, len: 1 },
  grade: { contrast: 1.12, sat: 0.92, vignette: 0.5, shadowTint: [-0.004, 0.006, 0.014], highlightTint: [0.03, 0.015, -0.004], blackLift: 0.01 } };
const hall = (o = {}) => ({ area: 'hall', env: 'hall', hour: 7.6, released: true, player: [0, 0, 3, 0], advance: 90, ...o });
const S = (id, cam, stage, fx = LOOK, extra = {}) => ({ id, dur: 4, stage, cam: { ease: 'smooth', ...cam }, fx, ...extra });
export const shots = [
  S('B01-booth-plain', { keys: [{ p: [8, 1.4, 5.5], l: [1, 1.5, 0], lens: 35 }, { p: [6, 1.4, 5.0], l: [1, 1.5, 0], lens: 35 }] }, hall(), {}),
  S('B02-booth-look', { keys: [{ p: [8, 1.4, 5.5], l: [1, 1.5, 0], lens: 35 }, { p: [6, 1.4, 5.0], l: [1, 1.5, 0], lens: 35 }] }, hall()),
  S('B03-tier-look', { keys: [{ p: [-16.4, 6.3, -5.6], l: [2, 0.6, 1.5], lens: 24 }, { p: [-14.4, 6.3, -5.6], l: [2, 0.6, 1.5], lens: 24 }] }, hall()),
  S('B04-row-look', { keys: [{ p: [-15, 1.3, -4.2], l: [-6, 1.6, -8.2], lens: 28 }, { p: [3, 1.3, -4.2], l: [12, 1.6, -8.2], lens: 28 }] }, hall({ hour: 6.4, released: false })),
  S('B05-canteen-wide', { keys: [{ p: [25.2, 2.0, -3.6], l: [33, 1.2, -11.0], lens: 24 }, { p: [26.6, 1.9, -4.6], l: [33, 1.2, -11.0], lens: 24 }] }, { area: 'canteen', env: 'canteen', hour: 7.3, released: true, player: [30, 0, -4, 0], advance: 90 }),
  S('B06-chapel-nave', { keys: [{ p: [-51.2, 1.7, 0.2], l: [-66, 2.4, 0.4], lens: 24 }, { p: [-52.4, 1.7, 0.4], l: [-66, 2.4, 0.4], lens: 24 }] }, { area: 'chapel', env: 'chapel', hour: 13.4, released: true, player: [-52, 0, 0, 0], advance: 90 }),
  S('B07-chapel-glass', { keys: [{ p: [-56, 1.4, 6.5], l: [-64.6, 3.2, -8], lens: 28 }, { p: [-56, 1.4, 5.5], l: [-64.6, 3.2, -8], lens: 28 }] }, { area: 'chapel', env: 'chapel', hour: 13.4, released: true, player: [-52, 0, 0, 0], advance: 90 }),
  S('B08-tunnel', { keys: [{ p: [-55, 1.5, -8], l: [-55, 1.3, -24], lens: 24 }, { p: [-55, 1.5, -9], l: [-55, 1.3, -24], lens: 24 }] }, { area: 'tunnel1', env: 'tunnel', hour: 13.5, released: true, player: [-55, -3.4, -8, 0], advance: 90 }),
  S('B09-records-cam', { keys: [{ p: [45.4, 2.2, 8.8], l: [51.0, 2.8, 3.0], lens: 24 }, { p: [45.6, 2.2, 8.6], l: [51.0, 2.8, 3.0], lens: 24 }] }, { area: 'records', env: 'records', hour: 9.0, released: true, player: [47, 0, 5, 0], advance: 90 }),
  S('B10-intake-pruitt', { keys: [{ p: [34.2, 1.5, 9.0], l: [36, 1.5, 6.4], lens: 35 }, { p: [34.6, 1.5, 8.8], l: [36, 1.5, 6.4], lens: 35 }] }, { area: 'intake', env: 'intake', hour: 8.7, released: true, player: [36, 0, 4, 0], advance: 90 }),
  S('B11-clearing-gold', { keys: [{ p: [-98.4, 2.4, -28.4], l: [-103, 1.0, -32.4], lens: 35 }, { p: [-99.7, 2.3, -29.7], l: [-103, 1.0, -32.4], lens: 35 }] }, { area: 'outside', env: 'outsideGold', outside: 'gold', hour: 14.5, released: true, player: [-98, 0, -29, 0], advance: 90, js: "g.story.npcMap.harrington.hiddenFromWorld=false; g.story.npcMap.maddox.hiddenFromWorld=false;" }),
  S('B12-forest-gully', { keys: [{ p: [-79, 2.0, -24], l: [-96, 2.5, -27], lens: 28 }, { p: [-82, 2.0, -24], l: [-96, 2.5, -27], lens: 28 }] }, { area: 'outside', env: 'outsideGold', outside: 'gold', hour: 14.5, released: true, player: [-80, 0, -24, 0], advance: 90 }),
];
