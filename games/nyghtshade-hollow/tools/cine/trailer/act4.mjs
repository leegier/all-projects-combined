// Authored by a picture agent: see BRIEF.md.
// A5b "four hours" (bars 38-47, 640 frames) and AT "title plate" (bars 48-50, 192 frames): out of the tunnel into the golden forest, the clearing, the oak, the pull-back toward the prison in the haze.
import { look } from './look.mjs';

// the game's terrain height (src/world/levels/outside.js), ported so cameras can sit a fixed distance above the ground
const CL = [-102, -32], PATH = [[-76.3, -24], [-84, -24], [-91, -26.5], [-97, -30], [-101, -32]];
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
function polyDist(x, z) {
  let best = 1e9, bs = 0, acc = 0, total = 0; const lens = [];
  for (let i = 0; i < PATH.length - 1; i++) { const l = Math.hypot(PATH[i + 1][0] - PATH[i][0], PATH[i + 1][1] - PATH[i][1]); lens.push(l); total += l; }
  for (let i = 0; i < PATH.length - 1; i++) {
    const [ax, az] = PATH[i], [bx, bz] = PATH[i + 1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)), d = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
    if (d < best) { best = d; bs = (acc + lens[i] * t) / total; }
    acc += lens[i];
  }
  return [best, bs];
}
export function terrain(x, z) {
  let h = Math.sin(x * 0.043 + 1.3) * Math.cos(z * 0.051 + 0.4) * 1.3 + Math.sin(x * 0.11 + z * 0.083) * 0.45 + Math.sin(z * 0.2 + x * 0.13) * 0.18;
  h += 0.8;
  const flat = 1 - sstep(13, 26, Math.hypot(x - CL[0], z - CL[1]));
  h = lerp(h, 0.25 + Math.sin(x * 0.2) * Math.cos(z * 0.18) * 0.08, flat);
  const [d, s] = polyDist(x, z);
  let mask = 1 - sstep(1.9, 7.5 + s * 5, d);
  mask *= sstep(-75.6, -77.4, x);
  h = lerp(h, lerp(-3.45, 0.2, sstep(0.05, 0.92, s)), mask);
  if (x > -76.3) h = Math.max(h, 0.6);
  return h;
}
const P = (x, dy, z) => [x, terrain(x, z) + dy, z];                   // a point dy metres above the ground

const GOLD = { area: 'outside', env: 'outsideGold', outside: 'gold', hour: 14.5, player: [-100, 0, -29, 0], humans: 'hide', released: true, advance: 90 };
// the two men under the oak, placed exactly as the game's ending cinematic places them (makeEnding in src/story/cinematics.js); only ever seen from behind, far, against the sun
const MEN = { ...GOLD, humans: 'show', npcs: [['harrington', -103.6, -32.2, 'ground', -92, -20], ['maddox', -102.1, -32.6, 'ground', -92, -20]] };
const fx = (o = {}) => ({ ...look('gold'), ...o });
const DOF = (focus, fstop = 2.4) => ({ focus, fstop });

export const shots = [
  { id: 'A5b-01-gully-flare', dur: 64 / 24, stage: GOLD,
    cam: { ease: 'smooth', keys: [{ p: P(-79, 0.7, -24), l: P(-92, 1.3, -27), lens: 24 }, { p: P(-83.5, 0.9, -24.3), l: P(-93, 1.4, -27.4), lens: 24 }], shake: { freq: 1.6, pos: 0.012, aim: 0.12 } },
    fx: fx({ ev: [{ u: 0, v: 2.4 }, { u: 0.5, v: 0.45 }, { u: 1, v: 0.1 }], dof: DOF(10, 2.8), mb: 1 }),
    notes: 'The cut out of the tunnel: the frame starts blown out and settles into the gully, shafts of sun across the path. Text can sit lower-left over the dark grass.' },
  { id: 'A5b-02-path-push', dur: 80 / 24, stage: GOLD,
    cam: { ease: 'smooth', keys: [{ p: P(-87, 1.3, -25), l: P(-98, 1.7, -30.5), lens: 28 }, { p: P(-92.5, 1.3, -27.7), l: P(-100, 1.9, -31.5), lens: 28 }] },
    fx: fx({ dof: DOF(12, 2.8), mb: 1 }),
    notes: 'Push along the trodden path toward the old tree, god rays raking left to right. Text fits upper left in the foliage shade.' },
  { id: 'A5b-03-lantern', dur: 64 / 24, sim: { bot: 'shim', at: 380 }, stage: { area: 'outside', humans: 'hide' },
    cam: { ease: 'smooth', keys: [{ p: { rel: 'player', off: [2.2, 0.7, 6.5] }, l: { rel: 'player', off: [0, 0.9, 3.5] }, lens: 50 }, { p: { rel: 'player', off: [2.2, 0.7, 6.5] }, l: { rel: 'player', off: [0, 0.9, 3.5] }, lens: 50 }] },
    fx: fx({ dof: DOF(4, 2.0), mb: 1 }),
    notes: 'The lantern flame (the real lantern of the tunnel walk, carried by nobody we show) glowing ahead in the gully. Text upper right.' },
  { id: 'A5b-04-clearing-reveal', dur: 112 / 24, stage: GOLD,
    cam: { ease: 'smooth', keys: [{ p: P(-93, 0.45, -27.3), l: P(-104, 1.6, -34.2), lens: 24 }, { p: P(-95.5, 2.4, -28.5), l: P(-105, 1.8, -34.5), lens: 26 }] },
    fx: fx({ ev: 0.3, dof: DOF(12, 3.2), mb: 1 }),
    notes: 'Crane up out of the ferns to reveal the clearing, the oak, the crate. Text lower third over the lawn.' },
  { id: 'A5b-05-crate-backlit', dur: 48 / 24, stage: GOLD,
    cam: { ease: 'smooth', keys: [{ p: P(-107.8, 0.35, -37.2), l: P(-104.2, 0.8, -33.6), lens: 50 }, { p: P(-106.8, 0.4, -36.3), l: P(-104.2, 0.8, -33.6), lens: 50 }] },
    fx: fx({ dof: DOF(4.5, 2.0), mb: 1 }),
    notes: 'Detail: the crate and blanket at the foot of the oak against the low sun. Text upper left.' },
  { id: 'A5b-06-silhouettes', dur: 80 / 24, stage: MEN,
    cam: { ease: 'smooth', keys: [{ p: P(-112.5, 1.1, -37.5), l: P(-103, 2.3, -32.2), lens: 28 }, { p: P(-111.3, 1.2, -36.3), l: P(-103, 2.3, -32.2), lens: 28 }] },
    fx: fx({ dof: DOF(12, 2.4), mb: 1 }),
    notes: 'The only people in the trailer: two backlit shapes under the oak, seen from behind at 10 m, the sun beside them. Text on the left over the dark trunk.' },
  { id: 'A5b-07-oak-flare', dur: 64 / 24, stage: GOLD,
    cam: { ease: 'smooth', keys: [{ p: P(-114, 0.8, -46), l: P(-105.5, 6, -35), lens: 24 }, { p: P(-113.2, 1.3, -45), l: P(-105.5, 6.4, -35), lens: 24 }] },
    fx: fx({ dof: DOF(15, 2.8), mb: 1 }),
    notes: 'The low sun burning through the oak crown, streak flares on the leaves. Text lower right.' },
  { id: 'A5b-08-pull-back', dur: 128 / 24, stage: MEN,
    cam: { ease: 'smooth', keys: [{ p: P(-110.5, 1.4, -30.5), l: P(-102.8, 1.2, -32.4), lens: 22 }, { p: P(-114, 5.6, -26.5), l: P(-97.5, 2.8, -28.5), lens: 17 }] },
    fx: fx({ dof: DOF(11, 4), mb: 1 }),
    notes: 'The last image of the story: rising and drawing back from the two men over the clearing toward the prison in the haze (the game\'s own third ending shot). Text lower left.' },
  { id: 'AT-01-tower-haze', dur: 192 / 24, stage: GOLD,
    cam: { ease: 'smooth', keys: [{ p: P(-102, 1.4, -27), l: P(-91, 6.5, -15), lens: 28 }, { p: P(-103.5, 1.9, -27.5), l: P(-92.5, 6.2, -15), lens: 28 }] },
    fx: fx({ ev: [{ u: 0, v: 0.1 }, { u: 0.875, v: 0.1 }, { u: 1, v: -5 }], dof: DOF(20, 4), mb: 1 }),
    notes: 'Title plate: a slow drift toward the guard tower glowing in the haze, the tower held in the right third so the middle of the frame stays calm for the lockup; fades to black over the last 24 frames.' },
];
