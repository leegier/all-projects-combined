// Act 3: A4 chapel and the font (bars 24-31, 512 frames) + A5a the tunnel (bars 32-37, 384 frames).
// No humans on screen: staged shots use humans:'hide'; bot shots hide the cast through stage.humans:'hide' and never ask for the double.
import { look } from './look.mjs';
const F = (n) => n / 24;
const CH = { area: 'chapel', env: 'chapel', hour: 13.4, player: [-52, 0, 0, 0], humans: 'hide', advance: 90, released: true };
// the font already slid aside (as it stands after the font cinematic), for staged tunnel shots
const OPEN = 'g.ctx.fontGroup.position.x = 2.6; g.ctx.fontCollider.enabled = false;';
// the game's culvert portal is built from one solid stone slab plus the frame slabs that leave the opening: drop the two big faces of the solid slab so the opening is really open
const PORTAL = `const grp = g.world.areas.get('tunnel2').group;
grp.traverse((o) => { if (!o.isMesh || !o.geometry) return; const geo = o.geometry, pos = geo.attributes.position, idx = geo.index; if (!pos || !idx) return;
  const big = (a, b, c) => { const x = [a, b, c].map((i) => pos.getX(i)), y = [a, b, c].map((i) => pos.getY(i)), z = [a, b, c].map((i) => pos.getZ(i));
    return x.every((v) => Math.abs(v - x[0]) < 1e-3) && (Math.abs(x[0] + 76.3) < 0.02 || Math.abs(x[0] + 76.7) < 0.02) && Math.max(...z) - Math.min(...z) > 3.4 && Math.max(...y) - Math.min(...y) > 2.5; };
  const arr = idx.array; for (let t = 0; t < arr.length; t += 3) if (big(arr[t], arr[t + 1], arr[t + 2])) arr[t + 1] = arr[t + 2] = arr[t]; idx.needsUpdate = true; });`;
const TU = { area: 'tunnel1', env: 'tunnel', hour: 13.5, player: [-55, -3.2, -12, 0], humans: 'hide', advance: 90, released: true, js: OPEN };
const lantern = (off = [0.3, 1.3, 4.0], intensity = 14) => ({ type: 'point', p: { rel: 'player', off }, color: '#ffa550', intensity, distance: 9, decay: 1.6 });
const cam = (keys, ease = 'smooth', shake) => ({ ease, keys, ...(shake ? { shake } : {}) });

export const shots = [
  // ---------------------------------------------------------------- A4 chapel (512)
  {
    id: 'A4-01-aisle', dur: F(128), stage: CH,
    cam: cam([{ p: [-51.5, 1.2, 0], l: [-72, 3.9, 0], lens: 24 }, { p: [-58.5, 1.2, 0], l: [-72, 2.9, 0], lens: 26 }], 'smooth'),
    fx: { ...look('warm'), mb: 0.6 },
    notes: 'Opening of the calm: a slow 1.2 m dolly down the aisle toward the cross, stained-glass colour pools on the floor, the shaft on the right. Title line sits low-left over the pews.',
  },
  {
    id: 'A4-02-pew-slide', dur: F(80), stage: CH,
    cam: cam([{ p: [-52.0, 0.85, 0.5], l: [-62, 1.0, -5.0], lens: 32 }, { p: [-57.5, 0.85, 0.5], l: [-67, 1.1, -5.0], lens: 32 }], 'smooth'),
    fx: { ...look('warm'), mb: 0.6, dof: { focus: 9, fstop: 3.2 } },
    notes: 'Low slide along the north pew bank: the pews recede into the colour pools and the shaft. Text sits upper-left over the dark wall.',
  },
  {
    id: 'A4-03-candle', dur: F(64), stage: CH,
    cam: cam([{ p: [-70.9, 1.72, -3.4], l: [-69.6, 1.9, 9.0], lens: 50 }, { p: [-70.7, 1.72, -3.3], l: [-69.2, 1.9, 9.0], lens: 50 }], 'smooth'),
    fx: { ...look('warm'), dof: { focus: { keys: [{ u: 0, v: 2.1 }, { u: 0.4, v: 2.1 }, { u: 0.9, v: 13 }, { u: 1, v: 13 }] }, fstop: 1.8 }, mb: 0.6 },
    notes: 'Rack focus: the altar candle sharp, then the glass-coloured light on the far wall as the focus pulls through. A line of text sits in the dark lower right.',
  },
  {
    id: 'A4-04-altar-back', dur: F(80), stage: CH,
    cam: cam([{ p: [-69.4, 1.6, 0], l: [-50.5, 1.9, 0], lens: 24 }, { p: [-64.4, 1.5, 0], l: [-50.5, 1.9, 0], lens: 24 }]),
    fx: { ...look('warm'), mb: 0.6 },
    notes: 'From the altar looking back down the aisle to the bright door, the colour pools leading the eye. Text lower third over the floor.',
  },
  {
    id: 'A4-05-font-wide', dur: F(64), stage: { ...CH, lights: [{ type: 'spot', p: [-51.5, 7, -1.5], target: [-55, 0.8, -5.75], color: '#ffd7a0', intensity: 220, distance: 18, angle: 0.3, penumbra: 0.9 }, { type: 'point', p: [-53.2, 1.6, -3.2], color: '#ffb36a', intensity: 5, distance: 6, decay: 1.6 }] },
    cam: cam([{ p: [-51.2, 0.6, -1.0], l: [-55, 1.0, -5.75], lens: 35 }, { p: [-52.6, 0.55, -2.9], l: [-55, 1.0, -5.75], lens: 35 }]),
    fx: { ...look('warm'), dof: { focus: 4.5, fstop: 2.8 }, mb: 0.6 },
    notes: 'The font before it lifts, held in a shaft of window light. Text upper-left.',
  },
  {
    id: 'A4-06-font-lift', dur: F(96), sim: { bot: 'shim', at: 313.4 },
    stage: { area: 'chapel', humans: 'hide', js: 'g.gfx.u.letter.value = 0; Object.defineProperty(g, "letter", { get() { return 0; }, set() {}, configurable: true });', lights: [{ type: 'point', p: [-55, -1.4, -6.8], color: '#ffa550', intensity: 10, distance: 5, decay: 1.6 }] },
    cam: cam([{ p: [-57.8, 0.75, -2.6], l: [-55, 0.9, -5.75], lens: 28 }, { p: [-57.2, 1.5, -3.0], l: [-54.6, -1.0, -7.2], lens: 28 }], 'smooth'),
    fx: { ...look('warm'), mb: 0.6 },
    notes: 'The hero beat: the stone font slides aside and the stair is revealed in the floor. Text line sits upper-right over the wall. Hands over to A5a by going down the same stair.',
  },

  // ---------------------------------------------------------------- A5a tunnel (384)
  {
    id: 'A5a-01-steps', dur: F(96), stage: { ...TU, lights: [{ type: 'point', p: [-55, -2.2, -13], color: '#ffa550', intensity: 12, distance: 10, decay: 1.6 }] },
    cam: cam([{ p: [-55, 1.5, -3.4], l: [-55, -0.6, -7.5], lens: 24 }, { p: [-55, 0.9, -5.6], l: [-55, -2.2, -9.5], lens: 24, t: 0.4 }, { p: [-55, -0.4, -7.4], l: [-55, -2.3, -12], lens: 24, t: 0.75 }, { p: [-55, -1.7, -9.6], l: [-55, -2.1, -20], lens: 24 }], 'smooth'),
    fx: { ...look('tunnel'), mb: 0.5 },
    notes: 'Down the steps.',
  },
  {
    id: 'A5a-02-straight', dur: F(96), stage: { ...TU, lights: [lantern()] },
    walk: { ease: 'smooth', keys: [{ p: [-55, -3.2, -11.0] }, { p: [-55, -3.2, -17.0] }] },
    cam: cam([{ p: [-55, -1.7, -11.0], l: [-55, -2.0, -24], lens: 24 }, { p: [-55, -1.7, -17.0], l: [-55, -2.0, -24], lens: 24 }], 'smooth'),
    fx: { ...look('tunnel'), mb: 0.4 },
    notes: 'The long straight.',
  },
  {
    id: 'A5a-03-corner', dur: F(80), stage: TU,
    cam: cam([{ p: [-55.3, -2.2, -16.6], l: [-55, -2.2, -24.5], lens: 24 }, { p: [-55.3, -2.2, -22.6], l: [-58, -2.1, -24.2], lens: 24 }, { p: [-57.7, -2.2, -24], l: [-70, -1.9, -24], lens: 24 }], 'smooth'),
    fx: { ...look('tunnel'), mb: 0.4 },
    notes: 'The corner.',
  },
  {
    id: 'A5a-04-mouth', dur: F(112), stage: { ...TU, area: 'tunnel2', env: 'outsideGold', outside: 'gold', camOutside: true, player: [-67, -3.2, -24, 0], js: OPEN + PORTAL, lights: [lantern([0, 1.3, 3.0])] },
    walk: { ease: 'smooth', keys: [{ p: [-64.5, -3.2, -24] }, { p: [-73.4, -3.2, -24] }] },
    cam: cam([{ p: [-64.5, -1.85, -24], l: [-90, -1.3, -24.3], lens: 24 }, { p: [-73.4, -1.8, -24], l: [-90, -1.2, -24.3], lens: 24 }], 'smooth'),
    fx: { ...look('tunnel'), mb: 0.5, ev: [{ u: 0, v: 0.9 }, { u: 0.55, v: 0.9 }, { u: 1, v: 1.9 }], flash: [{ u: 0, v: 0 }, { u: 0.7, v: 0 }, { u: 1, v: 0.85 }] },
    notes: 'Last shot of the tunnel: push toward the bright mouth, the light blooms to warm white on the final frames to hand over to the gold of A5b. Text can sit low-left over the dark floor.',
  },
];
