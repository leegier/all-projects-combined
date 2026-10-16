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
const fx = (o = {}) => ({ ...look('gold'), ...o });
const DOF = (focus, fstop = 2.4) => ({ focus, fstop });

export const shots = [
  { id: 'A5b-01-gully-rays', dur: 80 / 24, stage: GOLD,
    cam: { ease: 'smooth', keys: [{ p: P(-78.5, 1.0, -24), l: P(-92, 1.2, -27), lens: 28 }, { p: P(-82.5, 1.0, -24.2), l: P(-94, 1.4, -27.5), lens: 28 }] },
    fx: fx({ dof: DOF(9, 2.8), mb: 1 }), notes: 'First breath of daylight after the tunnel: the gully and the shafts through the trees.' },
];
