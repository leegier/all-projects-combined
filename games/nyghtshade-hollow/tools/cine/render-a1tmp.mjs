// Renders a shot list from the real game to one mezzanine video per shot (or, with --scout, to a few preview stills per shot).
//   NH_GL=llvmpipe xvfb-run -a node tools/cine/render.mjs SHOTS.mjs --out DIR [--only id1,id2|prefix*] [--workers 2] [--fps 24] [--w 1920] [--h 804] [--q high]
//        --scout [--scale 0.5] [--sheet NAME]     3 stills per shot (start / middle / end) instead of video, plus a contact sheet
//        --list                                    print the shots and their frame counts
//        --force                                   re-render shots whose mezzanine already exists
// A shots file exports `shots` (and optionally `defaults`): see tools/cine/shots-trailer.mjs.  Every shot starts in a fresh page, so a shot renders the same whatever else was rendered
// before it.  Frames are screenshots of the real WebGL canvas (and, with `ui: true`, the DOM HUD); the simulation advances in real time between frames (fractional steps carried over).
import { open } from '../lib.mjs';
import { frameSpec } from './lib.mjs';
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import { pathToFileURL } from 'node:url';

const A = process.argv.slice(2);
const arg = (k, d) => { const i = A.indexOf('--' + k); return i >= 0 ? (A[i + 1] && !A[i + 1].startsWith('--') ? A[i + 1] : true) : d; };
const file = A.find((a) => !a.startsWith('--') && /\.m?js$/.test(a));
if (!file) { console.error('usage: render.mjs SHOTS.mjs --out DIR [options]'); process.exit(1); }
const mod = await import(pathToFileURL(path.resolve(file)).href);
const defaults = mod.defaults || {};
const FPS = +arg('fps', defaults.fps || 24), SCALE = +arg('scale', 1), Q = arg('q', defaults.q || 'high');
const W = Math.round(+arg('w', defaults.w || 1920) * SCALE), H = Math.round(+arg('h', defaults.h || 804) * SCALE);
const OUT = path.resolve(arg('out', '/tmp/nh-cine'));
const WORKERS = +arg('workers', 2), SCOUT = !!arg('scout', false), FORCE = !!arg('force', false);
const PB = +(process.env.NH_PORT || 8300);
const QX = arg('qx', defaults.qx || 'sm=2048&sunsm=2048&grain=0');
fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

let shots = mod.shots;
const only = arg('only', null);
if (only && only !== true) { const pats = String(only).split(','); shots = shots.filter((s) => pats.some((p) => (p.endsWith('*') ? s.id.startsWith(p.slice(0, -1)) : s.id === p))); }
const frames = (s) => Math.max(1, Math.round(s.dur * FPS));
if (arg('list', false)) { let tot = 0; for (const s of shots) { tot += frames(s); console.log(s.id.padEnd(28), String(s.dur).padStart(5), 's', String(frames(s)).padStart(5), 'frames', s.sim && s.sim.bot ? `bot ${s.sim.bot}@${s.sim.at}s` : 'staged'); } console.log(`${shots.length} shots, ${tot} frames = ${(tot / FPS).toFixed(1)} s at ${FPS} fps`); process.exit(0); }

const mezz = (s) => path.join(OUT, s.id + '.mp4'), scoutDir = path.join(OUT, 'scout');
if (SCOUT) { fs.mkdirSync(scoutDir, { recursive: true }); }

function ffmpegPipe(outFile) {
  const args = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', 'pipe:0', '-an',
    '-vf', 'scale=in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv420p', '-c:v', 'libx264', '-preset', 'fast', '-crf', '9', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-r', String(FPS), '-movflags', '+faststart', outFile];
  const p = cp.spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => { p.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))); p.on('error', rej); });
  return { write: (b) => new Promise((res, rej) => { p.stdin.write(b, (e) => (e ? rej(e) : res())); }), end: async () => { p.stdin.end(); await done; } };
}

async function renderShot(shot, port) {
  const t0 = Date.now(), n = frames(shot), bot = shot.sim && shot.sim.bot;
  const query = `cine&${bot ? `bot=${bot}&capture` : 'auto&nostart'}&manual&q=${shot.q || Q}&w=${W}&h=${H}&${QX}${shot.qx ? '&' + shot.qx : ''}`;
  const t = await open({ port, query, width: W, height: H, log: false });
  const { page } = t;
  try {
    await page.evaluate(() => { NH.ui.show('u-disc', false); NH.ui.el('u-title').classList.remove('on'); });
    if (shot.ui !== true) await page.addStyleTag({ content: '#ui{visibility:hidden !important}' });
    if (bot) {
      await page.evaluate(() => { NH_CAP.begin(); NH_CAP.recOn = false; });
      const target = Math.round((shot.sim.at || 0) * 60);
      await page.evaluate(() => NH_CAP.settle(true));
      for (let cur = 0; cur < target;) { const k = Math.min(600, target - cur); await page.evaluate((k) => NH_CAP.adv(k), k); cur += k; }
      await page.evaluate(() => NH_CAP.settle(false));
      if (shot.stage) await page.evaluate((s) => NH_DIR.stageBot && NH_DIR.stageBot(s), shot.stage);
    } else {
      await page.evaluate((s) => NH_DIR.stage(s), { advance: 60, ...(shot.stage || {}) });
    }
    const spec0 = frameSpec(shot, 0, n, FPS, defaults);
    // warm-up: lights, camera smoothing and shadow maps converge on the first frame without the simulation moving
    for (let k = 0; k < (shot.warm ?? 4); k++) await page.evaluate((f) => NH_DIR.frame({ ...f, steps: 0, dt: 0.05 }), spec0);
    let cum = 0, done = 0;
    const stepsFor = (i) => { cum += (60 / FPS) * (shot.sim && shot.sim.speed !== undefined ? shot.sim.speed : 1); const k = Math.floor(cum + 1e-6) - done; done += k; return k; };
    if (SCOUT) {
      const picks = [0, Math.floor((n - 1) / 2), Math.max(0, n - 2)];
      for (let i = 0; i < n; i++) {
        const want = picks.indexOf(i);
        const spec = { ...frameSpec(shot, i, n, FPS, defaults), steps: stepsFor(i), noRender: want < 0 };
        await page.evaluate((f) => NH_DIR.frame(f), spec);
        if (want >= 0) fs.writeFileSync(path.join(scoutDir, `${shot.id}_${'abc'[want]}.png`), await page.screenshot({ type: 'png', timeout: 300000 }));
        if (i > 0 && i >= picks[2]) break;
      }
      log(`scout ${shot.id} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    } else {
      const enc = ffmpegPipe(mezz(shot) + '.part.mp4');
      for (let i = 0; i < n; i++) {
        const spec = { ...frameSpec(shot, i, n, FPS, defaults), steps: stepsFor(i) };
        await page.evaluate((f) => NH_DIR.frame(f), spec);
        let buf; for (let a = 0; ; a++) { try { buf = await page.screenshot({ type: 'png', timeout: 300000 }); break; } catch (e) { if (a >= 2) throw e; log(`${shot.id}: screenshot retry ${a + 1}`); } }
        await enc.write(buf);
        if ((i + 1) % 48 === 0) log(`${shot.id}: ${i + 1}/${n} frames, ${((Date.now() - t0) / (i + 1) / 1000).toFixed(2)} s/frame`);
      }
      await enc.end();
      fs.renameSync(mezz(shot) + '.part.mp4', mezz(shot));
      fs.writeFileSync(path.join(OUT, shot.id + '.json'), JSON.stringify({ id: shot.id, frames: n, fps: FPS, w: W, h: H, secs: +((Date.now() - t0) / 1000).toFixed(1) }));
      log(`done ${shot.id}: ${n} frames in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    }
  } finally { await t.close(); }
}

const queue = shots.filter((s) => SCOUT || FORCE || !fs.existsSync(mezz(s)));
log(`${queue.length} of ${shots.length} shots to render (${queue.reduce((a, s) => a + (SCOUT ? 3 : frames(s)), 0)} ${SCOUT ? 'stills' : 'frames'}), ${W}x${H}${SCALE !== 1 ? ' (scaled)' : ''}, ${FPS} fps, ${WORKERS} workers, q=${Q}`);
let next = 0, failed = 0;
await Promise.all(Array.from({ length: Math.min(WORKERS, queue.length) }, async (_, w) => {
  while (next < queue.length) {
    const s = queue[next++];
    try { await renderShot(s, PB + w); } catch (e) { failed++; console.error('FAILED', s.id, String(e.stack || e).split('\n').slice(0, 4).join(' | ')); }
  }
}));
if (SCOUT) {
  const sheet = arg('sheet', 'sheet');
  const names = shots.flatMap((s) => ['a', 'b', 'c'].map((k) => path.join(scoutDir, `${s.id}_${k}.png`))).filter((f) => fs.existsSync(f));
  if (names.length) {
    const r = cp.spawnSync('montage', ['-background', 'black', '-tile', '3x', '-geometry', `${Math.min(640, W)}x${Math.round(Math.min(640, W) * H / W)}+3+3`, '-fill', 'yellow', '-pointsize', '12', ...names.flatMap((f) => ['-label', path.basename(f, '.png'), f]), path.join(OUT, `${sheet}.jpg`)], { encoding: 'utf8' });
    log(r.status === 0 ? `contact sheet ${path.join(OUT, sheet + '.jpg')}` : 'montage failed: ' + r.stderr);
  }
}
log(failed ? `${failed} shot(s) failed` : 'done');
process.exit(failed ? 1 : 0);
