// A short "day in C-Block" reel that shows the crowd living by the prison clock: count at the cell doors, chow in the mess hall, the day room at free time,
// the chapel, lights out.  The camera is authored per shot (position, look-at and the prison hour are interpolated per frame); each frame advances the real
// simulation a few steps, so doors, routine events and the crowd's staggered arrivals/departures run exactly as in the game.
//   NH_GL=llvmpipe xvfb-run -a node tools/crowd-reel.mjs OUT_DIR [fps=15] [q=high]      then   bash tools/make-reel.sh OUT_DIR out.mp4 [fps]
import { open } from './lib.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const out = process.argv[2] || path.join(os.tmpdir(), 'crowd-reel'), fps = +process.argv[3] || 15, quality = process.argv[4] || 'high';
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
const dt = 1 / fps;
// shot = { title, sub, secs, area, pos (where the player stands, so the right area is active), hour:[from,to], from/to:{p,l,fov} }
const SHOTS = [
  { title: 'COUNT', sub: '06:00 · every man at his cell door', secs: 9, area: 'hall', pos: [0, 0, 3], hour: [5.93, 6.42], from: { p: [16.8, 1.65, -2.6], l: [11.0, 1.5, -6.2], fov: 58 }, to: { p: [-3.5, 1.65, -2.6], l: [-9.0, 1.5, -6.2], fov: 58 } },
  { title: 'COUNT', sub: 'both rows, both tiers', secs: 6, area: 'hall', pos: [0, 0, 3], hour: [6.42, 6.6], hold: true, from: { p: [-12.5, 1.9, -2.2], l: [3.0, 2.6, 6.0], fov: 66 }, to: { p: [-12.5, 1.9, -2.2], l: [3.0, 2.6, 6.0], fov: 66 } },
  { title: 'CHOW', sub: '07:00 · the mess hall fills', secs: 9, area: 'canteen', pos: [30, 0, -4], hour: [6.97, 7.45], from: { p: [25.2, 1.9, -3.6], l: [31, 1.1, -10.0], fov: 62 }, to: { p: [26.6, 1.7, -8.2], l: [33, 1.1, -13.0], fov: 60 } },
  { title: 'FREE TIME', sub: '18:00 · the day room', secs: 9, area: 'hall', pos: [0, 0, 3], hour: [17.97, 18.45], from: { p: [-15.7, 2.0, 0.6], l: [-6.5, 1.0, 1.6], fov: 60 }, to: { p: [-5.0, 2.2, 5.0], l: [8.0, 1.0, -1.5], fov: 60 } },
  { title: 'CHAPEL', sub: '13:00 · the pews and the library', secs: 7, area: 'chapel', pos: [-52, 0, 0], hour: [13.0, 13.45], from: { p: [-52.2, 2.2, 0.2], l: [-62.5, 0.9, 3.8], fov: 62 }, to: { p: [-54.0, 2.0, -1.0], l: [-63.5, 0.9, 5.0], fov: 60 } },
  { title: 'LIGHTS OUT', sub: '22:00 · asleep', secs: 8, area: 'hall', pos: [0, 0, 3], hour: [21.8, 22.5], from: { p: [-6.0, 1.6, -4.6], l: [-10.8, 0.9, -8.5], fov: 55 }, to: { p: [2.0, 1.6, -4.6], l: [-2.8, 0.9, -8.5], fov: 55 } },
];

const t = await open({ query: `auto&manual&nostart&q=${quality}`, log: true });
const { page } = t;
await page.evaluate(() => {
  NH.ui.show('u-disc', false); NH.ui.hud(false); NH.ui.el('u-title').classList.remove('on');
  const d = document.createElement('div'); d.id = 'reel-cap';
  d.style.cssText = 'position:absolute;left:44px;bottom:70px;color:#e4dccb;font:700 40px "Arial Narrow",Arial,sans-serif;letter-spacing:3px;text-shadow:0 2px 8px #000,0 0 22px #000;pointer-events:none';
  d.innerHTML = '<div id="reel-t"></div><div id="reel-s" style="font-size:20px;font-weight:400;letter-spacing:1px;opacity:.85"></div>';
  document.getElementById('ui').appendChild(d);
});
let n = 0, prevArea = null;
for (const [si, s] of SHOTS.entries()) {
  const frames = Math.min(Math.round(s.secs * fps), +process.env.REEL_FRAMES || 1e9);                 // REEL_FRAMES=2: smoke test with two frames per shot
  for (let i = 0; i < frames; i++) {
    const k = i / (frames - 1), e = k * k * (3 - 2 * k), L = (a, b) => a + (b - a) * e;
    const hour = s.hour[0] + (s.hour[1] - s.hour[0]) * k;
    await page.evaluate(({ s, hour, e, first, clock, steps }) => {
      const g = NH, r = g.routine, lerp = (a, b) => a + (b - a) * e, V = (a, b) => [0, 1, 2].map((j) => lerp(a[j], b[j]));
      if (first) { g.cine = null; g.mode = 'cine'; g.player.frozen = true; g.letter = 1; g.fade = 0; g.fadeTarget = 0; g.eyelid = 0; g.blur = 0; g.outsideMode = 'night'; g.viewmodel.visible = false; g.world.setActiveArea(s.area); g.applyEnv(s.env || s.area); g.player.teleport(s.pos[0], s.pos[1], s.pos[2], 0); }
      r.paused = true; r.hour = hour; r._evaluate(false);                                   // fires the slot events (PA, doors, presence) like the real clock
      const slot = r.slot, locked = slot === 'LightsOut' || (slot === 'Count' && (hour < 6.75 || (hour >= 21 && hour < 21.95)));
      g.story.cellsReleased = !locked;
      g.story.updateNpcPresence();
      const p = V(s.from.p, s.to.p), l = V(s.from.l, s.to.l), P3 = g.player.pos.constructor;
      g.camOverride = { pos: new P3(...p), look: new P3(...l), fov: lerp(s.from.fov, s.to.fov), roll: 0 };
      g.advance(steps);                                                                       // the clock runs ~2.4× faster than real time in the reel, the crowd keeps pace
      document.getElementById('reel-t').textContent = s.title + '  ·  ' + clock;
      document.getElementById('reel-s').textContent = s.sub;
    }, { s, hour, e, first: i === 0, steps: Math.round((60 / fps) * 2.4), clock: `${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.floor((hour % 1) * 60)).padStart(2, '0')}` });
    await page.evaluate(() => { NH.stepEnv(5, true); for (let j = 0; j < 2; j++) NH.render(1, 1 / 15); });
    fs.writeFileSync(`${out}/frame_${String(n++).padStart(5, '0')}.png`, await page.screenshot());
    if (n % 24 === 0) console.log(`shot ${si + 1}/${SHOTS.length} frame ${n}`);
  }
}
await t.close();
console.log(`${n} frames in ${out} (${(n / fps).toFixed(1)} s at ${fps} fps)`);
