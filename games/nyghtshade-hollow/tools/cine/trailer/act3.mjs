// Act 3: A4 chapel and the font (bars 24-31, 512 frames) + A5a the tunnel (bars 32-37, 384 frames).
// No humans on screen: staged shots use humans:'hide'; bot shots hide the cast through stage.humans:'hide' and never ask for the double.
import { look } from './look.mjs';
const F = (n) => n / 24;
const CH = { area: 'chapel', env: 'chapel', hour: 13.4, player: [-52, 0, 0, 0], humans: 'hide', advance: 90, released: true };
const OPEN = 'g.ctx.fontGroup.position.x = 2.6; g.ctx.fontCollider.enabled = false;';
const TU = { area: 'tunnel1', env: 'tunnel', hour: 13.5, player: [-55, -3.2, -12, 0], humans: 'hide', advance: 90, released: true, js: OPEN };
const lantern = (off = [0.3, 1.3, 4.0]) => ({ type: 'point', p: { rel: 'player', off }, color: '#ffa550', intensity: 14, distance: 9, decay: 1.6 });
const cam = (keys, ease = 'smooth', shake) => ({ ease, keys, ...(shake ? { shake } : {}) });

export const shots = [
  // ---------------------------------------------------------------- A4 chapel (512)
  {
    id: 'A4-01-aisle', dur: F(128), stage: CH,
    cam: cam([{ p: [-51.5, 1.2, 0], l: [-72, 4.2, 0], lens: 24 }, { p: [-58.5, 1.2, 0], l: [-72, 4.0, 0], lens: 24 }], 'smooth'),
    fx: { ...look('warm'), mb: 1 },
    notes: 'Opening of the calm: a slow 1.2 m dolly down the aisle toward the cross, colour pools on the floor. Title line sits low-left over the pews.',
  },
  {
    id: 'A4-02-pew-slide', dur: F(96), stage: CH,
    cam: cam([{ p: [-52.5, 1.0, -0.6], l: [-56, 2.6, 9.0], lens: 35 }, { p: [-61.0, 1.0, -0.6], l: [-64.5, 2.6, 9.0], lens: 35 }], 'smooth'),
    fx: { ...look('warm'), mb: 1 },
    notes: 'Slide along the pew banks toward the south wall, where the coloured glass light lands.',
  },
  {
    id: 'A4-03-candle', dur: F(64), stage: CH,
    cam: cam([{ p: [-69.2, 1.5, 2.5], l: [-71.2, 1.55, 1.3], lens: 85 }, { p: [-69.5, 1.56, 2.2], l: [-71.2, 1.55, 1.3], lens: 85 }], 'smooth'),
    fx: { ...look('warm'), dof: { focus: 3.0, fstop: 2.8 }, mb: 1 },
    notes: 'Altar candle macro: one flame in the held breath before the font; a line of text sits in the dark right third.',
  },
  {
    id: 'A4-04-altar-back', dur: F(64), stage: CH,
    cam: cam([{ p: [-72.0, 1.7, 0], l: [-50.5, 1.5, 0], lens: 24 }, { p: [-67.0, 1.5, 0], l: [-50.5, 1.5, 0], lens: 24 }]),
    fx: { ...look('warm') },
    notes: 'From the altar looking back to the bright door.',
  },
  {
    id: 'A4-05-font-wide', dur: F(64), stage: { ...CH, lights: [{ type: 'point', p: [-53.2, 2.3, -3.2], color: '#ffb36a', intensity: 7, distance: 7, decay: 1.6 }] },
    cam: cam([{ p: [-51.2, 0.6, -1.0], l: [-55, 1.0, -5.75], lens: 35 }, { p: [-52.6, 0.55, -2.9], l: [-55, 1.0, -5.75], lens: 35 }]),
    fx: { ...look('warm'), dof: { focus: 4.5, fstop: 2.8 } },
    notes: 'The font before it lifts.',
  },
  {
    id: 'A4-06-font-lift', dur: F(96), sim: { bot: 'shim', at: 313.6 }, stage: { area: 'chapel', humans: 'hide' },
    cam: cam([{ p: [-57.5, 0.7, -2.8], l: [-55, 0.7, -5.75], lens: 28 }, { p: [-57.0, 0.9, -3.2], l: [-54.2, 0.2, -5.75], lens: 28 }]),
    fx: { ...look('warm') },
    notes: 'The stone slides and the stair is revealed.',
  },

  // ---------------------------------------------------------------- A5a tunnel (384)
  {
    id: 'A5a-01-steps', dur: F(96), stage: { ...TU, lights: [{ type: 'point', p: [-55, -2.2, -13], color: '#ffa550', intensity: 12, distance: 10, decay: 1.6 }] },
    cam: cam([{ p: [-55, 1.5, -3.4], l: [-55, -0.6, -7.5], lens: 24 }, { p: [-55, 0.9, -5.6], l: [-55, -2.2, -9.5], lens: 24, t: 0.4 }, { p: [-55, -0.4, -7.4], l: [-55, -2.3, -12], lens: 24, t: 0.75 }, { p: [-55, -1.7, -9.6], l: [-55, -2.1, -20], lens: 24 }], 'smooth'),
    fx: { ...look('tunnel'), mb: 1 },
    notes: 'Down the steps.',
  },
  {
    id: 'A5a-02-straight', dur: F(96), stage: { ...TU, lights: [lantern()] },
    walk: { ease: 'smooth', keys: [{ p: [-55, -3.2, -11.0] }, { p: [-55, -3.2, -17.0] }] },
    cam: cam([{ p: [-55, -1.7, -11.0], l: [-55, -2.0, -24], lens: 24 }, { p: [-55, -1.7, -17.0], l: [-55, -2.0, -24], lens: 24 }], 'smooth'),
    fx: { ...look('tunnel'), mb: 1 },
    notes: 'The long straight.',
  },
  {
    id: 'A5a-03-corner', dur: F(80), stage: TU,
    cam: cam([{ p: [-55, -1.7, -20.4], l: [-55, -2.0, -24.5], lens: 24 }, { p: [-55.1, -1.7, -23.6], l: [-59, -2.0, -24.2], lens: 24 }, { p: [-57.7, -1.7, -24], l: [-70, -1.9, -24], lens: 24 }], 'smooth'),
    fx: { ...look('tunnel'), mb: 0.6 },
    notes: 'The corner.',
  },
  {
    id: 'A5a-04-mouth', dur: F(112), stage: { ...TU, area: 'tunnel2', outside: 'gold', player: [-67, -3.2, -24, 0], lights: [lantern([0, 1.3, 3.0])] },
    walk: { ease: 'smooth', keys: [{ p: [-67.5, -3.2, -24] }, { p: [-74.6, -3.2, -24] }] },
    cam: cam([{ p: [-67.5, -1.85, -24], l: [-90, -1.3, -24.3], lens: 24 }, { p: [-74.6, -1.8, -24], l: [-90, -1.2, -24.3], lens: 24 }], 'smooth'),
    fx: { ...look('tunnel'), mb: 1, ev: [{ u: 0, v: 0.9 }, { u: 0.55, v: 0.9 }, { u: 1, v: 1.9 }], flash: [{ u: 0, v: 0 }, { u: 0.75, v: 0 }, { u: 1, v: 0.45 }] },
    notes: 'Last shot of the tunnel: push toward the bright mouth, the light blooms to warm white on the final frames to hand over to the gold of A5b. Text can sit low-left over the dark floor.',
  },
];
