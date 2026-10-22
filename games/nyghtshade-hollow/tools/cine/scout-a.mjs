// Scouting batch A: the hall at count, to find the angles the trailer will use.   node tools/cine/render.mjs tools/cine/scout-a.mjs --scout --scale 0.5 --out /tmp/cine-a --sheet a
export const defaults = { fps: 24, w: 1920, h: 804 };
const hall = (o = {}) => ({ area: 'hall', env: 'hall', hour: 6.4, released: false, player: [0, 0, 3, 0], advance: 90, ...o });
const S = (id, cam, stage = hall(), extra = {}) => ({ id, dur: 4, stage, cam: { ease: 'smooth', ...cam }, ...extra });
export const shots = [
  S('A01-east-end-wide', { keys: [{ p: [17.2, 1.7, 2.6], l: [-6, 3.0, -2.5], lens: 24 }, { p: [16.2, 1.7, 2.4], l: [-6, 3.0, -2.5], lens: 24 }] }),
  S('A02-row-dolly', { keys: [{ p: [-15, 1.3, -4.2], l: [-6, 1.6, -8.2], lens: 28 }, { p: [3, 1.3, -4.2], l: [12, 1.6, -8.2], lens: 28 }] }),
  S('A03-upper-tier-down', { keys: [{ p: [-16.4, 6.3, -5.6], l: [2, 0.6, 1.5], lens: 24 }, { p: [-14.4, 6.3, -5.6], l: [2, 0.6, 1.5], lens: 24 }] }),
  S('A04-door-closeup', { keys: [{ p: [4.4, 1.55, -4.6], l: [6.0, 1.5, -8.2], lens: 50 }, { p: [4.8, 1.55, -4.7], l: [6.0, 1.5, -8.2], lens: 50 }] }),
  S('A05-routine-board', { keys: [{ p: [14.8, 1.7, -1.6], l: [18.5, 1.7, -3.6], lens: 35 }, { p: [15.6, 1.7, -2.1], l: [18.5, 1.7, -3.6], lens: 35 }] }),
  S('A06-south-row-low', { keys: [{ p: [-12, 0.7, 4.8], l: [-4, 1.5, 8.2], lens: 24 }, { p: [-2, 0.7, 4.8], l: [6, 1.5, 8.2], lens: 24 }] }),
  S('A07-booth-glass', { keys: [{ p: [8, 1.4, 5.5], l: [1, 1.5, 0], lens: 35 }, { p: [6, 1.4, 5.0], l: [1, 1.5, 0], lens: 35 }] }),
  S('A08-stairs-up', { keys: [{ p: [-10, 0.9, -1.0], l: [-15.5, 4.0, -5.8], lens: 24 }, { p: [-12, 0.9, -1.0], l: [-15.5, 4.0, -5.8], lens: 24 }] }),
  S('A09-daylight-shafts', { keys: [{ p: [-14, 1.5, 6.0], l: [2, 2.6, -4], lens: 24 }, { p: [-10, 1.5, 6.0], l: [2, 2.6, -4], lens: 24 }] }, hall({ hour: 9.5, released: true })),
  S('A10-cell-interior', { keys: [{ p: [0.4, 1.5, -9.3], l: [0.9, 1.4, -6.0], lens: 24 }, { p: [0.5, 1.5, -9.2], l: [1.0, 1.4, -6.0], lens: 24 }] }, hall({ hour: 6.2 })),
  S('A11-tally-wall', { keys: [{ p: [1.3, 1.5, -7.2], l: [0.125, 1.55, -8.6], lens: 28 }, { p: [1.0, 1.5, -7.6], l: [0.125, 1.55, -8.6], lens: 28 }] }, hall({ hour: 6.2 })),
  S('A12-guard-reyes', { keys: [{ p: [-12.5, 1.5, -2.2], l: [-16.5, 1.4, -4.85], lens: 50 }, { p: [-12.8, 1.5, -2.4], l: [-16.5, 1.4, -4.85], lens: 50 }] }, hall({ advance: 30 })),
];
