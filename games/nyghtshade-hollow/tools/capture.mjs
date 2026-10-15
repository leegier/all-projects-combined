// Deterministic video capture of the bot playing the slice.
//   NH_GL=llvmpipe xvfb-run -a -s "-screen 0 1400x900x24" node tools/capture.mjs --out DIR [--route shim] [--workers 3] [--q high]
//   stages:  --stage plan | frames | audio | cards | encode | all   (default all; later stages reuse earlier output in DIR)
//   --preview SEC   one still every SEC simulated seconds (no time-lapse) for contact sheets / look review
//   --from SEC --to SEC   restrict the frame range to a window of simulated seconds
//
// How it works: the simulation is deterministic (fixed 60 Hz steps, seeded RNG, no wall clock), so a worker can re-simulate from
// t=0 in a few seconds, then render only its slice of frames. The bot drives the real input layer; this tool only decides which
// simulation steps become video frames (the bot marks stretches as time-lapse via bot.speed()). The soundtrack is rendered
// offline from the same simulation (OfflineAudioContext on the sim clock) and cut/sped to match the frame schedule.
import { open } from './lib.mjs';
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';

const A = process.argv.slice(2);
const arg = (k, d) => { const i = A.indexOf('--' + k); return i >= 0 ? (A[i + 1] && !A[i + 1].startsWith('--') ? A[i + 1] : true) : d; };
const OUT = path.resolve(arg('out', '/tmp/nh-capture'));
const ROUTE = arg('route', 'shim');
const FPS = +arg('fps', 30);
const WORKERS = +arg('workers', 3);
const Q = arg('q', 'high');
const QX = arg('qx', 'sm=1024&sunsm=1024');       // render-cost trims for the software rasteriser (shadow map sizes); the game default is 2048
const W = +arg('w', 1280), H = +arg('h', 720);
const STAGE = arg('stage', 'all');
const PREVIEW = +arg('preview', 0);
const FROM = +arg('from', 0), TO = +arg('to', 1e9);
const JPEG_Q = +arg('jpegq', 93);
const WARM = 24;                       // frames rendered (not saved) before a worker's slice so camera/light smoothing has converged
const TAIL_S = 7;                      // seconds of the end screen kept after the bot finishes
const TITLE_S = 4.5, OUTRO_S = 10, INTER_S = 4;
const PARTS = String(arg('parts', 'title,frames,outro')).split(',');          // which pieces this encode contains
const INTERLUDE = String(arg('interlude', 'FAILURE PATH|What happens when the camera sees you')).split('|');
const ALSO = arg('also', null);
const AUDIO_S = +arg('audio-s', 0);                                           // length of soundtrack to render (default: whole run + outro)                                                // plan.json of the failure-path run, for the outro stats
const STEPS_PER_S = 60;
fs.mkdirSync(OUT, { recursive: true });
const P = (...a) => path.join(OUT, ...a);
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ---------------------------------------------------------------------------------------------------------------------
async function runToEnd(page, tailSteps, onChunk) {
  const checkpoints = {};
  let steps = 0;
  for (;;) {
    const fin = await page.evaluate(() => { NH_CAP.adv(600); return NH.bot.finished; });
    steps += 600;
    if (steps % 1200 === 0) checkpoints[steps] = await page.evaluate(() => NH_CAP.state());
    if (onChunk) onChunk(steps);
    if (fin || steps > 60 * 60 * 25) break;
  }
  const finishedAt = await page.evaluate(() => NH_CAP.steps());
  // hold on the end screen
  await page.evaluate((n) => NH_CAP.adv(n), tailSteps);
  return { checkpoints, finishedAt };
}

async function stagePlan() {
  log('plan: simulating the bot run headlessly …');
  const t = await open({ port: 8090, query: `bot=${ROUTE}&annotate&capture&manual&q=low`, width: W, height: H, log: false });
  await t.page.evaluate(() => NH_CAP.begin());
  const { checkpoints, finishedAt } = await runToEnd(t.page, TAIL_S * STEPS_PER_S);
  const plan = await t.page.evaluate(() => NH_CAP.plan());
  const totalSteps = await t.page.evaluate(() => NH.bot.steps);
  plan.checkpoints = checkpoints; plan.finishedAt = finishedAt; plan.totalSteps = finishedAt + TAIL_S * STEPS_PER_S;
  fs.writeFileSync(P('plan.json'), JSON.stringify(plan, null, 1));
  log(`plan: bot finished at step ${finishedAt} (${(finishedAt / 60).toFixed(1)} s sim), ${plan.results.filter((r) => r.ok).length}/${plan.results.length} checks, stuck ${plan.stuck}`);
  await t.close();
  return plan;
}

function buildSchedule(plan) {
  const frames = [];
  if (PREVIEW > 0) {
    let k = 0;
    for (let s = Math.max(0, FROM * STEPS_PER_S); s <= Math.min(plan.totalSteps, TO * STEPS_PER_S); s += PREVIEW * STEPS_PER_S) frames.push({ step: Math.round(s), speed: 1, i: k++ });
    return frames;
  }
  const sl = plan.speedLog;
  const speedAt = (step) => { let v = 1; for (const e of sl) { if (e.step <= step) v = e.speed; else break; } return v; };
  let step = 0;
  while (step <= plan.totalSteps) {
    const v = speedAt(step);
    frames.push({ step: Math.round(step), speed: v });
    step += (STEPS_PER_S / FPS) * v;
  }
  const lo = FROM * STEPS_PER_S, hi = TO * STEPS_PER_S;
  return frames.map((f, i) => ({ ...f, i })).filter((f) => f.step >= lo && f.step <= hi);
}

async function worker(id, todo, all, plan, nameFn) {
  const t = await open({ port: 8100 + id, query: `bot=${ROUTE}&annotate&capture&manual&q=${Q}&${QX}`, width: W, height: H, log: false });
  const { page } = t;
  await page.evaluate(() => NH_CAP.begin());
  let cur = 0;
  const lead = PREVIEW > 0 ? 2 : WARM;
  // catch up silently (no rendering) to `step`, verifying determinism against the plan's checkpoints
  const catchUp = async (step) => {
    while (cur < step) {
      const n = Math.min(600, step - cur);
      await page.evaluate((n) => NH_CAP.adv(n), n); cur += n;
      const cpnt = plan.checkpoints[cur];
      if (cpnt) {
        const s = await page.evaluate(() => NH_CAP.state());
        if (JSON.stringify(s) !== JSON.stringify(cpnt)) { console.error('DETERMINISM MISMATCH at step', cur, '\n plan  ', JSON.stringify(cpnt), '\n worker', JSON.stringify(s)); process.exit(3); }
      }
    }
  };
  const render = async (f, prevStep) => {
    const n = Math.max(0, f.step - cur);
    const dt = Math.max(1 / 60, Math.min(0.25, (f.step - prevStep) / 60 || 1 / FPS));
    await page.evaluate(([n, dt, sp]) => { NH_CAP.speed = sp; NH_CAP.run(n, dt); }, [n, dt, f.speed]);
    cur = f.step;
  };
  const t0 = Date.now();
  let prev = null, done = 0;
  for (const f of todo) {
    if (!prev || f.i !== prev.i + 1) {
      // discontinuity (worker start or a resumed gap): render a few frames ahead so camera/light smoothing has converged
      const w0 = Math.max(0, all.findIndex((x) => x.i === f.i) - lead);
      await catchUp(all[w0].step);
      let ps = cur;
      for (let j = w0; j < all.findIndex((x) => x.i === f.i); j++) { if (all[j].step < cur) continue; await render(all[j], ps); ps = all[j].step; }
    }
    await render(f, prev ? prev.step : cur);
    const buf = await page.screenshot({ type: 'jpeg', quality: JPEG_Q });
    fs.writeFileSync(nameFn(f), buf);
    prev = f; done++;
    if (done % 50 === 0) log(`worker ${id}: ${done}/${todo.length} frames, ${((Date.now() - t0) / done / 1000).toFixed(2)} s/frame, step ${cur}`);
  }
  log(`worker ${id}: finished ${todo.length} frames in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  await t.close();
}

async function stageFrames(plan) {
  const dir = PREVIEW > 0 ? P('preview') : P('frames');
  const resume = !!arg('resume', false);
  if (!resume) { fs.rmSync(dir, { recursive: true, force: true }); }
  fs.mkdirSync(dir, { recursive: true });
  const all = buildSchedule(plan);
  fs.writeFileSync(P(PREVIEW > 0 ? 'preview.json' : 'schedule.json'), JSON.stringify(all));
  const nameFn = PREVIEW > 0 ? (f) => path.join(dir, `p_${String(Math.round(f.step / 6)).padStart(6, '0')}.jpg`) : (f) => path.join(dir, `f_${String(f.i).padStart(6, '0')}.jpg`);
  const todo = all.filter((f) => !(resume && fs.existsSync(nameFn(f)) && fs.statSync(nameFn(f)).size > 1000));
  log(`frames: ${all.length} frames (${(all.length / FPS).toFixed(1)} s of video at ${FPS} fps), ${todo.length} to render, ${WORKERS} workers, q=${Q}&${QX}, ${W}x${H}`);
  const chunk = Math.ceil(todo.length / WORKERS);
  const jobs = [];
  for (let i = 0; i < WORKERS; i++) {
    const part = todo.slice(i * chunk, (i + 1) * chunk);
    if (!part.length) continue;
    jobs.push(worker(i, part, all, plan, nameFn));
  }
  await Promise.all(jobs);
}

// ---------------------------------------------------------------------------------------------------------------------
async function stageAudio(plan) {
  log('audio: simulating with the offline soundtrack attached …');
  const dur = AUDIO_S || plan.totalSteps / STEPS_PER_S + OUTRO_S + 2;
  const t = await open({ port: 8095, query: `bot=${ROUTE}&annotate&capture&manual&q=low`, width: W, height: H, log: false });
  await t.page.evaluate((d) => NH_CAP.begin({ audioSeconds: d }), dur);
  let steps = 0;
  const total = Math.round(dur * STEPS_PER_S) - 60;
  while (steps < total) { const n = Math.min(600, total - steps); await t.page.evaluate((n) => NH_CAP.adv(n), n); steps += n; }
  const st = await t.page.evaluate(() => NH_CAP.state());
  log('audio: sim done (', st.t, 's ), rendering offline …');
  const t0 = Date.now();
  const info = await t.page.evaluate(() => NH_CAP.renderAudio());
  log(`audio: rendered ${(info.length / info.sampleRate).toFixed(1)} s in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  fs.mkdirSync(P('audio'), { recursive: true });
  const fd = fs.openSync(P('audio', 'main.pcm'), 'w');
  const CH = 1 << 19;
  for (let i = 0; i < info.length; i += CH) {
    const b64 = await t.page.evaluate(([i, n]) => NH_CAP.audioChunk(i, n), [i, CH]);
    fs.writeSync(fd, Buffer.from(b64, 'base64'));
  }
  fs.closeSync(fd);
  fs.writeFileSync(P('audio', 'info.json'), JSON.stringify(info));
  {   // integrated loudness of the raw render -> make-up gain that lands the master near -16 LUFS (web-video level)
    const r = cp.spawnSync('ffmpeg', ['-hide_banner', '-f', 's16le', '-ar', '44100', '-ac', '2', '-i', P('audio', 'main.pcm'), '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 28 });
    const m = /Integrated loudness:\s+I:\s+(-?[\d.]+) LUFS/.exec(r.stderr || '');
    const I = m ? +m[1] : -23;
    fs.writeFileSync(P('audio', 'gain.json'), JSON.stringify({ lufs: I, gainDb: Math.max(0, Math.min(14, +(-16 - I).toFixed(1))) }));
    log(`audio: integrated ${I} LUFS -> make-up gain ${(-16 - I).toFixed(1)} dB`);
  }
  await t.close();
}

// ---------------------------------------------------------------------------------------------------------------------
function cardHtml(kind, plan) {
  if (kind === 'title') {
    return `<div style="text-align:center;font-family:'Arial Narrow',Arial"><h1 style="font-size:6.4vmin">PLAYTEST <span>RECORDING</span></h1><h2>Nyghtshade Hollow · The Intake</h2>
      <div style="margin:6vmin auto 0;display:grid;grid-template-columns:auto auto;gap:1.4vmin 3vmin;justify-content:center;text-align:left;font-size:1.9vmin;letter-spacing:.1em;color:#bdb6a6">
        <span style="color:#5fd07a">✔ green ticks</span><span>live assertions from the test bot, evaluated as they happen</span>
        <span style="color:#ffd66b">▌ yellow caption</span><span>the system being exercised at that moment</span>
        <span style="color:#d8222c">● ▶▶ badge</span><span>real time ×1, or time-lapse (the bot is walking / waiting)</span>
        <span style="color:#d8d2c4">controls</span><span>the bot drives the real input layer · fixed 60 Hz deterministic simulation</span></div>
      <p style="margin-top:5vmin;font-size:1.6vmin;letter-spacing:.5em;color:#8d8678;text-transform:uppercase">Route: shim · 1280×720 · software-rendered WebGL</p></div>`;
  }
  if (kind === 'interlude') {
    return `<div style="text-align:center"><h1 style="font-size:6vmin">${INTERLUDE[0].replace(/(\S+)$/, '<span>$1</span>')}</h1><h2 style="letter-spacing:.5em">${INTERLUDE[1] || ''}</h2></div>`;
  }
  const also = ALSO && fs.existsSync(ALSO) ? JSON.parse(fs.readFileSync(ALSO, 'utf8')) : null;
  const okN = (p) => p.results.filter((r) => r.ok).length;
  const mins = Math.floor(plan.finishedAt / 3600), secs = String(Math.round((plan.finishedAt / 60) % 60)).padStart(2, '0');
  const stat = (v, label, col = '') => `<div style="border-top:1px solid rgba(255,255,255,.28);padding-top:1.4vmin"><b style="display:block;font-size:4.6vmin;font-weight:400;${col}">${v}</b><span style="font-size:1.55vmin;letter-spacing:.2em;color:#8d8678">${label}</span></div>`;
  const feats = ['11-slot routine clock · PA · doors', 'Survival, pickups, chow tray', 'Branching dialogue + reputation', 'DC economy, commissary, bribes', 'Guard AI vision cones + cameras', 'Records: keycard / shim / bribe', 'Journal, objectives, minimap', 'Chapel · font · tunnel · clearing'];
  return `<div style="text-align:center;font-family:'Arial Narrow',Arial">
    <h1 style="animation-duration:1.2s;font-size:5.6vmin">PLAYTEST <span>REPORT</span></h1>
    <h2 style="animation-duration:1.4s">Nyghtshade Hollow · The Intake</h2>
    <div style="margin:5vmin auto 0;display:grid;grid-template-columns:repeat(4,23vmin);gap:2.4vmin;color:#d8d2c4;justify-content:center">
      ${stat(okN(plan) + '/' + plan.results.length, 'GOLDEN PATH CHECKS', 'color:#5fd07a')}${stat(also ? okN(also) + '/' + also.results.length : '—', 'FAILURE PATH CHECKS', 'color:#5fd07a')}${stat(plan.stuck + (also ? also.stuck : 0), 'STUCK EVENTS')}${stat(mins + ':' + secs, 'GAME TIME (M:S)')}</div>
    <div style="margin:5vmin auto 0;display:grid;grid-template-columns:repeat(2,44vmin);gap:1.2vmin 3vmin;justify-content:center;text-align:left;font-size:1.95vmin;letter-spacing:.08em;color:#d8d2c4">
      ${feats.map((f) => `<div><span style="color:#5fd07a;margin-right:1.2vmin">✔</span>${f}</div>`).join('')}</div>
    <p style="margin-top:5vmin;font-size:1.6vmin;letter-spacing:.3em;color:#8d8678;text-transform:uppercase;line-height:2.2">Keycard · Shim · Bribe routes verified end-to-end · fixed 60 Hz deterministic simulation</p></div>`;
}

async function stageCards(plan) {
  log('cards:', PARTS.filter((x) => x !== 'frames').join(', '));
  fs.rmSync(P('cards'), { recursive: true, force: true }); fs.mkdirSync(P('cards'), { recursive: true });
  const t = await open({ port: 8096, query: `bot=${ROUTE}&annotate&capture&manual&q=low`, width: W, height: H, log: false });
  const shoot = async (kind, secs, prefix, animSecs) => {
    await t.page.evaluate((html) => NH_CAP.showCard(html), cardHtml(kind, plan));
    const n = Math.round(secs * FPS), anim = Math.round(animSecs * FPS);
    let last = null;
    for (let i = 0; i < n; i++) {
      const file = P('cards', `${prefix}_${String(i).padStart(4, '0')}.jpg`);
      if (i < anim) { await t.page.evaluate((tt) => NH_CAP.cardFrame(tt), i / FPS); last = await t.page.screenshot({ type: 'jpeg', quality: 95 }); }
      fs.writeFileSync(file, last);
    }
  };
  if (PARTS.includes('title')) await shoot('title', TITLE_S, 't', 4.2);
  if (PARTS.includes('interlude')) await shoot('interlude', INTER_S, 'i', 3.2);
  if (PARTS.includes('outro')) await shoot('outro', OUTRO_S, 'o', 4.2);
  await t.close();
}

// ---------------------------------------------------------------------------------------------------------------------
function sh(cmd, args, opts = {}) {
  const r = cp.spawnSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28, ...opts });
  if (r.status !== 0) { console.error(cmd, args.join(' ').slice(0, 300), '\n', String(r.stderr).slice(-1500)); throw new Error(cmd + ' failed'); }
  return r;
}

function stageEncode(plan) {
  const hasFrames = PARTS.includes('frames');
  const frames = hasFrames ? JSON.parse(fs.readFileSync(P('schedule.json'), 'utf8')) : [];
  const nMain = frames.length;
  log(`encode: parts ${PARTS.join('+')} (${nMain} main frames)`);
  const seq = P('seq'); fs.rmSync(seq, { recursive: true, force: true }); fs.mkdirSync(seq);
  let n = 0;
  const link = (src) => fs.symlinkSync(src, path.join(seq, `${String(n++).padStart(6, '0')}.jpg`));
  const cards = (prefix, secs) => { for (let i = 0; i < Math.round(secs * FPS); i++) link(P('cards', `${prefix}_${String(i).padStart(4, '0')}.jpg`)); };
  if (PARTS.includes('title')) cards('t', TITLE_S);
  if (PARTS.includes('interlude')) cards('i', INTER_S);
  for (const f of frames) link(P('frames', `f_${String(f.i).padStart(6, '0')}.jpg`));
  if (PARTS.includes('outro')) cards('o', OUTRO_S);
  const totalFrames = n;
  // ---- audio assembly: constant-speed runs of frames -> slice of the sim soundtrack, tempo-matched --------------------
  const pcm = P('audio', 'main.pcm');
  const segDir = P('audio', 'seg'); fs.rmSync(segDir, { recursive: true, force: true }); fs.mkdirSync(segDir, { recursive: true });
  const parts = [];
  const silence = (secs, name) => { const f = path.join(segDir, name); sh('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-t', secs.toFixed(4), '-c:a', 'pcm_s16le', f]); parts.push(f); };
  if (PARTS.includes('title')) silence(TITLE_S, 'a_title.wav');
  if (PARTS.includes('interlude')) silence(INTER_S, 'a_inter.wav');
  let i = 0, si = 0;
  while (i < nMain) {
    let j = i + 1;
    while (j < nMain && frames[j].speed === frames[i].speed && frames[j].step - frames[j - 1].step === frames[i].speed * (STEPS_PER_S / FPS)) j++;
    const v = frames[i].speed, count = j - i;
    const srcStart = frames[i].step / STEPS_PER_S, srcLen = count * v * (STEPS_PER_S / FPS) / STEPS_PER_S, outLen = count / FPS;
    const f = path.join(segDir, `a_${String(si++).padStart(3, '0')}.wav`);
    const af = [];
    if (v !== 1) af.push(`atempo=${v}`, 'lowpass=f=2600', 'volume=0.5');
    af.push('afade=t=in:d=0.03', `afade=t=out:st=${Math.max(0, outLen - 0.03).toFixed(4)}:d=0.03`);
    sh('ffmpeg', ['-y', '-f', 's16le', '-ar', '44100', '-ac', '2', '-ss', srcStart.toFixed(4), '-t', srcLen.toFixed(4), '-i', pcm, '-af', af.join(','), '-t', outLen.toFixed(4), '-ar', '44100', '-ac', '2', '-c:a', 'pcm_s16le', f]);
    parts.push(f); i = j;
  }
  if (PARTS.includes('outro')) {
    // the soundtrack keeps running past the end of the bot run
    const tailStart = plan.totalSteps / STEPS_PER_S;
    const fo = path.join(segDir, 'a_outro.wav');
    sh('ffmpeg', ['-y', '-f', 's16le', '-ar', '44100', '-ac', '2', '-ss', tailStart.toFixed(4), '-t', OUTRO_S.toFixed(4), '-i', pcm, '-af', `afade=t=out:st=${(OUTRO_S - 2.5).toFixed(2)}:d=2.5`, '-ar', '44100', '-ac', '2', '-c:a', 'pcm_s16le', fo]);
    parts.push(fo);
  }
  const list = P('audio', 'list.txt'); fs.writeFileSync(list, parts.map((f) => `file '${f}'`).join('\n'));
  const wav = P('audio', 'final.wav');
  // master: loudness-normalise so the piece sits at a normal listening level, with a true-peak ceiling
  let gainDb = arg('gain-db', null);
  if (gainDb === null || gainDb === true) { try { gainDb = JSON.parse(fs.readFileSync(P('audio', 'gain.json'), 'utf8')).gainDb; } catch (e) { gainDb = 0; } }
  log(`encode: soundtrack make-up gain ${gainDb} dB`);
  sh('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-af', `volume=${gainDb}dB,alimiter=limit=0.9:attack=3:release=60:level=disabled`, '-ar', '44100', '-c:a', 'pcm_s16le', wav]);
  // ---- video -------------------------------------------------------------------------------------------------------
  const crf = String(arg('crf', 22));
  const mp4 = P(arg('name', 'nyghtshade-hollow-playtest.mp4'));
  log(`encode: ${totalFrames} frames (${(totalFrames / FPS).toFixed(1)} s) -> ${mp4}`);
  sh('ffmpeg', ['-y', '-framerate', String(FPS), '-i', path.join(seq, '%06d.jpg'), '-i', wav,
    '-vf', 'format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', crf, '-maxrate', String(arg('maxrate', '6M')), '-bufsize', '12M', '-profile:v', 'high', '-r', String(FPS), '-g', String(FPS * 2), '-movflags', '+faststart',
    '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-ac', '2', '-shortest', mp4]);
  const sz = fs.statSync(mp4).size;
  log(`encode: done ${(sz / 1e6).toFixed(1)} MB`);
}

// ---------------------------------------------------------------------------------------------------------------------
const stages = STAGE === 'all' ? ['plan', 'frames', 'audio', 'cards', 'encode'] : STAGE.split(',');
let plan = null;
const loadPlan = () => (plan = JSON.parse(fs.readFileSync(P('plan.json'), 'utf8')));
if (stages.includes('plan')) plan = await stagePlan(); else loadPlan();
if (stages.includes('frames')) await stageFrames(plan);
if (stages.includes('audio')) await stageAudio(plan);
if (stages.includes('cards')) await stageCards(plan);
if (stages.includes('encode')) stageEncode(plan);
log('done');
process.exit(0);
