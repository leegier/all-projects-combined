#!/usr/bin/env node
// Assembles the trailer master from the rendered shot clips, the score and the text cue sheet.
//
//   node tools/cine/assemble-trailer.mjs --clips DIR --score WAV --out FILE [--shots FILE] [--preview]
//
//   --clips DIR     folder with one <shot id>.mp4 per shot (1920x804, 24 fps; other sizes are scaled with a warning)
//   --score WAV     the score (any ffmpeg-readable audio): resampled to 48 kHz, cut / padded to exactly 138.667 s, AAC 320k
//   --out FILE      the master (H.264 High yuv420p 1920x1080 24 fps, CRF 14, maxrate 16 Mbit/s, bt709, faststart)
//   --shots FILE    module that exports `shots` (default tools/cine/trailer/index.mjs; used by the tests). Shot lengths: `dur` in seconds (or `frames`)
//   --preview       quick 1280x536 encode of the picture area (no grain, fast preset)
// Optional: --text FILE (default trailer/text.json), --work DIR (scratch, default a temp folder; PNG title runs are re-used there), --fonts DIR (see titles.mjs),
//   --no-titles, --grade none, --grain N (strength, default 1, 0 = off), --fade-in N / --fade-out N (frames, default 24 / 24), --crf N, --preset NAME,
//   --nice N (default 10: other jobs share the machine), --dry (check and print the plan, do not encode), --print-graph, --keep (keep the scratch folder),
//   --window A:B (encode only the master frames A to B-1, e.g. 3008:3328 for the title and the end card; fades and score follow the timeline), --partial (test lists shorter than the 3200 picture frames: the black end card and the fades follow the list), --lenient (a clip that is more than 2 frames short is held on its last frame instead of aborting).
//
// What it does, in order: concat of the clips frame-exactly (3200 picture frames: each clip is trimmed to its shot length) -> a final grade (a 3D LUT: gentle S-curve, split tone
// teal shadows / warm highlights, 3 % less chroma, a lifted black) at 10 bit -> luma-weighted temporal film grain on the picture only -> fade up from black / fade to black -> 128 black
// frames (the end card) -> padded to 1920x1080 (138 px black bars) -> the typography of text.json overlaid with alpha (titles.mjs renders it, fades included) -> 8 bit with dithering.
// A shot may carry `cut: 'dissolve'` and `cutFrames: n` (even, default 8): a dissolve into that shot, centred on the cut. The total length does not change (the outgoing frame holds
// for n/2 frames while the incoming one holds back for n/2 frames; use it for short dissolves only). The contact line of the end card is skipped while text.json "contact" is empty.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import cp from 'node:child_process';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const FPS = 24, PW = 1920, PH = 804, W = 1920, H = 1080, PIC_Y = 138, PIC_FRAMES = 3200, END_FRAMES = 128, TOTAL = PIC_FRAMES + END_FRAMES;
export const AUDIO_SECONDS = TOTAL / FPS;

// ------------------------------------------------------------------------------------------------------------------------------ helpers
const sh = (cmd, args, o = {}) => new Promise((res, rej) => {
  const p = cp.spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...o.spawn });
  let out = '', err = '';
  p.stdout.on('data', (d) => { out += d; o.onOut?.(d); });
  p.stderr.on('data', (d) => { err += d; if (err.length > 200000) err = err.slice(-100000); o.onErr?.(d); });
  p.on('error', rej);
  p.on('close', (c) => (c === 0 ? res({ out, err }) : rej(new Error(`${cmd} exited with ${c}\n${err.slice(-3000)}`))));
});
const pad = (n, k) => String(n).padStart(k, '0');
const barBeat = (f) => `${Math.floor(f / 64) + 1}.${Math.floor((f % 64) / 16) + 1}`;

// ------------------------------------------------------------------------------------------------------------------------------ the plan
/** Normalises the shot list: frames, start, optional dissolve. */
export function planShots(shots) {
  let start = 0;
  const list = shots.map((s, i) => {
    const frames = s.frames ?? Math.round(s.dur * FPS);
    let dis = 0;
    const c = s.cut;
    if (i > 0 && (c === 'dissolve' || (c && c.type === 'dissolve'))) {
      dis = Math.max(2, 2 * Math.round(((typeof c === 'object' ? c.frames : s.cutFrames ?? s.cutLen) ?? 8) / 2));
    }
    const o = { id: s.id, frames, start, dis, i };
    start += frames;
    return o;
  });
  for (let i = 0; i < list.length; i++) {
    const s = list[i], hIn = s.dis / 2, hOut = (list[i + 1]?.dis || 0) / 2;
    s.hIn = hIn; s.hOut = hOut;
    if (s.frames - hIn - hOut < 1) throw new Error(`shot ${s.id}: ${s.frames} frames are too short for the dissolves around it`);
  }
  return { shots: list, total: start };
}

async function probeClip(file) {
  const { out } = await sh('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-count_packets', '-show_entries', 'stream=width,height,r_frame_rate,codec_name,pix_fmt,nb_read_packets,color_space', '-of', 'json', file]);
  const st = JSON.parse(out).streams?.[0];
  if (!st) throw new Error(`${file}: no video stream`);
  const [a, b] = String(st.r_frame_rate).split('/').map(Number);
  return { w: st.width, h: st.height, fps: a / (b || 1), frames: +st.nb_read_packets, pix: st.pix_fmt, codec: st.codec_name };
}

// ------------------------------------------------------------------------------------------------------------------------------ the grade (a .cube 3D LUT, gamma-encoded full range RGB in and out)
export const GRADE = { s: 0.17, lift: 0.004, sat: 0.965, shadow: [-0.002, 0.004, 0.011], highlight: [0.016, 0.008, -0.004] };
export function makeCube(file, g = GRADE, N = 33) {
  const curve = (x) => x - (g.s * Math.sin(2 * Math.PI * x)) / (2 * Math.PI);
  const cl = (x) => Math.min(1, Math.max(0, x));
  const rows = [`# nyghtshade hollow trailer grade`, `LUT_3D_SIZE ${N}`];
  for (let b = 0; b < N; b++) for (let gg = 0; gg < N; gg++) for (let r = 0; r < N; r++) {
    const c = [r, gg, b].map((v) => curve(v / (N - 1)));
    const L = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], ws = (1 - L) * (1 - L), wh = L * L;
    const o = c.map((v, k) => {
      let x = L + (v - L) * g.sat;
      x += g.shadow[k] * ws + g.highlight[k] * wh;
      return cl(g.lift + x * (1 - g.lift));
    });
    rows.push(o.map((v) => v.toFixed(6)).join(' '));
  }
  fs.writeFileSync(file, rows.join('\n') + '\n');
}

// ------------------------------------------------------------------------------------------------------------------------------ the filter graph
const CONV_IN = 'zscale=min=709:pin=709:tin=709:m=gbr:p=709:t=709:rin=tv:r=pc:dither=error_diffusion,format=gbrp10le';
const CONV_OUT = 'zscale=min=gbr:pin=709:tin=709:m=709:p=709:t=709:rin=pc:r=tv:dither=error_diffusion,format=yuv444p10le';
const CONV_FINAL = 'zscale=min=709:pin=709:tin=709:m=709:p=709:t=709:rin=tv:r=tv:dither=error_diffusion,format=yuv420p';

/** Builds the whole filtergraph. inputs: clip index = shot index; extra: { audio, titles } = input indexes. */
export function buildGraph(P, fix, o) {
  const L = [], shots = P.shots, picFrames = P.total, audioSec = (picFrames + END_FRAMES) / FPS;
  shots.forEach((s, i) => {
    const uses = ['body']; if (s.dis) uses.push('head'); if (shots[i + 1]?.dis) uses.push('tail');
    const f = [];
    if (fix[i].fps) f.push('fps=24');
    if (fix[i].scale) f.push(`scale=${PW}:${PH}:flags=lanczos`);
    if (fix[i].hold) f.push(`tpad=stop_mode=clone:stop=${fix[i].hold}`);
    f.push('setsar=1', 'format=yuv420p');
    if (uses.length === 1) L.push(`[${i}:v]${f.join(',')}[s${i}body]`);
    else L.push(`[${i}:v]${f.join(',')},split=${uses.length}${uses.map((u) => `[s${i}${u}]`).join('')}`);
  });
  const seq = [];
  shots.forEach((s, i) => {
    if (s.dis) {
      const p = shots[i - 1], h = s.dis / 2, n = s.dis;
      L.push(`[s${p.i}tail]trim=start_frame=${p.frames - h}:end_frame=${p.frames},setpts=N/(24*TB),tpad=stop_mode=clone:stop=${h},setpts=N/(24*TB)[xa${i}]`);
      L.push(`[s${i}head]trim=start_frame=0:end_frame=${h},setpts=N/(24*TB),tpad=start_mode=clone:start=${h},setpts=N/(24*TB)[xb${i}]`);
      L.push(`[xa${i}][xb${i}]blend=all_expr='A*(1-(N+1)/${n + 1})+B*((N+1)/${n + 1})',setpts=N/(24*TB)[x${i}]`);
      seq.push(`[x${i}]`);
    }
    L.push(`[s${i}body]trim=start_frame=${s.hIn}:end_frame=${s.frames - s.hOut},setpts=N/(24*TB)[b${i}]`);
    seq.push(`[b${i}]`);
  });
  L.push(`${seq.join('')}concat=n=${seq.length}:v=1:a=0[pic]`);

  const totalFrames = picFrames + END_FRAMES, [wa, wb] = o.window || [0, totalFrames];
  let cur = 'pic';
  const step = (chain, label) => { L.push(`[${cur}]${chain}[${label}]`); cur = label; };
  if (wa > 0 || wb < picFrames) step(`trim=start_frame=${wa}:end_frame=${Math.min(wb, picFrames)},setpts=N/(24*TB)`, 'win');
  if (o.grade) step(`${CONV_IN},lut3d=file=grade.cube:interp=tetrahedral,${CONV_OUT}`, 'graded');
  else step('format=yuv444p10le', 'graded');
  if (o.grain > 0) {
    const sd = Math.round(18 * o.grain);   // noise filter strength (uniform noise on the 10 bit luma plane): about 3 / 255 standard deviation in the mid-tones at 1.0 (measured), less in deep shadows and highlights
    L.push(`color=c=0x808080:s=${PW}x${PH}:r=24,format=yuv444p10le,noise=c0s=${sd}:c0f=t+u:c1s=0:c2s=0,gblur=sigma=0.55:planes=1[gr]`);
    const u = '((A-64)/876)';
    L.push(`[${cur}][gr]blend=c0_expr='A+(B-504)*(0.35+0.65*4*${u}*(1-${u}))':c1_expr=A:c2_expr=A:shortest=1[grained]`); cur = 'grained';
  }
  const fades = [];
  if (o.fadeIn > 0 && wa === 0) fades.push(`fade=t=in:s=0:n=${o.fadeIn}`);
  if (o.fadeOut > 0 && wb >= picFrames && picFrames - o.fadeOut >= wa) fades.push(`fade=t=out:s=${picFrames - o.fadeOut - wa}:n=${o.fadeOut}`);
  if (fades.length) step(fades.join(','), 'faded');
  step(`${wb > picFrames ? `tpad=stop_mode=add:stop=${Math.min(wb, totalFrames) - picFrames}:color=black,` : ''}pad=${W}:${H}:0:${PIC_Y}:black,setsar=1`, 'full');
  if (o.titles !== undefined) {
    L.push(`[${o.titles}:v]scale=in_range=pc:out_range=tv:out_color_matrix=bt709:flags=accurate_rnd+full_chroma_int,format=yuva444p10le[ttl]`);
    L.push(`[${cur}][ttl]overlay=0:0:format=yuv444p10:alpha=straight:eof_action=pass:repeatlast=0[titled]`); cur = 'titled';
  }
  if (o.preview) step(`crop=${W}:${PH}:0:${PIC_Y},scale=1280:536:flags=lanczos`, 'pv');
  step(`${CONV_FINAL},setsar=1`, 'vout');
  L.push(`[${o.audio}:a]aresample=48000:resampler=soxr,aformat=channel_layouts=stereo,apad=whole_dur=${audioSec.toFixed(6)},atrim=start=${(wa / FPS).toFixed(6)}:end=${(wb / FPS).toFixed(6)},asetpts=N/SR/TB${wa === 0 ? ',afade=t=in:d=0.02' : ''}${wb >= totalFrames ? `,afade=t=out:st=${(audioSec - 0.05 - wa / FPS).toFixed(4)}:d=0.05` : ''}[aout]`);
  return L.join(';\n');
}

// ------------------------------------------------------------------------------------------------------------------------------ titles as a PNG sequence
function titleSequence(manifest, titlesDir, seqDir) {
  fs.rmSync(seqDir, { recursive: true, force: true }); fs.mkdirSync(seqDir, { recursive: true });
  const blank = path.join(titlesDir, 'blank.png');
  if (!fs.existsSync(blank)) cp.execFileSync('convert', ['-size', `${W}x${H}`, 'xc:none', `PNG32:${blank}`]);
  const map = new Array(TOTAL).fill(blank);
  for (const r of manifest.runs) for (let f = r.start; f < r.start + r.count && f < TOTAL; f++) map[f] = path.join(titlesDir, r.file);
  for (let f = 0; f < TOTAL; f++) fs.symlinkSync(map[f], path.join(seqDir, `t_${pad(f + 1, 4)}.png`));
}

// ------------------------------------------------------------------------------------------------------------------------------ main
export async function assemble(opts) {
  const log = opts.log || console.log;
  const clipsDir = path.resolve(opts.clips), out = path.resolve(opts.out);
  const shotsFile = path.resolve(opts.shots || path.join(HERE, 'trailer', 'index.mjs'));
  const { shots: rawShots } = await import(pathToFileURL(shotsFile).href);
  if (!rawShots?.length) throw new Error(`${shotsFile} has no shots yet (an empty \`shots\` list)`);
  const P = planShots(rawShots);
  if (P.total !== PIC_FRAMES && !opts.partial) throw new Error(`the shots add up to ${P.total} frames, the picture must be ${PIC_FRAMES} (bars 1-50)`);
  const score = path.resolve(opts.score);
  if (!fs.existsSync(score)) throw new Error(`score not found: ${score}`);

  // clips
  const missing = P.shots.filter((s) => !fs.existsSync(path.join(clipsDir, s.id + '.mp4')));
  if (missing.length) throw new Error(`${missing.length} clips are missing in ${clipsDir}: ${missing.slice(0, 8).map((s) => s.id + '.mp4').join(', ')}${missing.length > 8 ? ' ...' : ''}`);
  const probes = await Promise.all(P.shots.map((s) => probeClip(path.join(clipsDir, s.id + '.mp4'))));
  const fix = [], problems = [];
  P.shots.forEach((s, i) => {
    const p = probes[i];
    fix[i] = { fps: Math.abs(p.fps - FPS) > 0.01, scale: p.w !== PW || p.h !== PH };
    if (fix[i].scale) log(`warning: ${s.id}: ${p.w}x${p.h}, scaled to ${PW}x${PH}`);
    if (fix[i].fps) log(`warning: ${s.id}: ${p.fps} fps, converted to 24`);
    const d = p.frames - s.frames;
    if (d > 0) log(`note: ${s.id}: clip has ${d} frame(s) more than the shot (${p.frames} vs ${s.frames}); trimmed`);
    if (d < 0) {
      if (-d <= 2 || opts.lenient) log(`warning: ${s.id}: clip is ${-d} frame(s) short (${p.frames} vs ${s.frames}); the last frame is held`);
      else problems.push(`${s.id}: clip has ${p.frames} frames, the shot needs ${s.frames}`);
    }
    if (d < 0 && (-d <= 2 || opts.lenient)) fix[i].hold = -d;
  });
  if (problems.length) throw new Error('clips with the wrong length (--lenient holds the last frame instead):\n  ' + problems.join('\n  '));

  // work folder
  const work = path.resolve(opts.work || path.join(os.tmpdir(), 'nh-assemble-' + crypto.createHash('sha1').update(out).digest('hex').slice(0, 8)));
  fs.mkdirSync(work, { recursive: true });
  let window = null;
  if (opts.window) { const [a, b] = String(opts.window).split(':').map(Number); if (!(a >= 0 && b > a && a < P.total && b <= P.total + END_FRAMES)) throw new Error('--window A:B needs 0 <= A < ' + P.total + ' and A < B <= ' + (P.total + END_FRAMES)); window = [a, b]; }
  const o = { window, grade: opts.grade !== 'none', grain: opts.preview && opts.grain === undefined ? 0 : (opts.grain ?? 1), fadeIn: opts.fadeIn ?? 24, fadeOut: opts.fadeOut ?? 24, preview: !!opts.preview };
  if (o.grade) makeCube(path.join(work, 'grade.cube'));

  // titles
  let T = null;
  if (!opts.noTitles) {
    const { ensureTitles } = await import('./titles.mjs');
    const textFile = path.resolve(opts.text || path.join(HERE, 'trailer', 'text.json'));
    const r = await ensureTitles({ textFile, outDir: path.join(work, 'titles'), fontsDir: opts.fonts, log });
    T = r;
    titleSequence(r.manifest, path.join(work, 'titles'), path.join(work, 'tseq'));
    log(`titles: ${r.T.cues.length} cues, contact line ${r.T.contact ? 'set' : 'empty (skipped)'}`);
  }

  const args = ['-hide_banner', '-y', '-loglevel', 'error', '-stats'];
  P.shots.forEach((s) => args.push('-threads', '1', '-i', path.join(clipsDir, s.id + '.mp4')));
  const audioIdx = P.shots.length; args.push('-i', score);
  let titlesIdx; if (T) { titlesIdx = P.shots.length + 1; args.push('-framerate', '24', '-start_number', String((window ? window[0] : 0) + 1), '-i', 'tseq/t_%04d.png'); }
  const graph = buildGraph(P, fix, { ...o, audio: audioIdx, titles: titlesIdx });
  fs.writeFileSync(path.join(work, 'graph.txt'), graph);
  if (opts.printGraph) log(graph);
  const crf = opts.crf ?? (opts.preview ? 23 : 14), preset = opts.preset ?? (opts.preview ? 'veryfast' : 'medium');
  args.push('-filter_complex_script', 'graph.txt', '-map', '[vout]', '-map', '[aout]', '-frames:v', String(window ? window[1] - window[0] : P.total + END_FRAMES), '-r', '24', '-fps_mode', 'cfr');
  args.push('-c:v', 'libx264', '-preset', preset, '-crf', String(crf), '-profile:v', 'high', '-level:v', opts.preview ? '4.0' : '4.1', '-pix_fmt', 'yuv420p', '-g', '48', '-bf', '3');
  if (!opts.preview) args.push('-maxrate', '16M', '-bufsize', '32M', '-tune', o.grain > 0 ? 'grain' : 'film');
  args.push('-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv');
  args.push('-c:a', 'aac', '-b:a', opts.preview ? '192k' : '320k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', '-metadata', 'title=NYGHTSHADE HOLLOW - Trailer', out);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  log(`plan: ${P.shots.length} shots, ${P.total} picture frames + ${END_FRAMES} black = ${P.total + END_FRAMES} frames (${((P.total + END_FRAMES) / FPS).toFixed(3)} s); ${P.shots.filter((s) => s.dis).length} dissolves; grade ${o.grade ? 'on' : 'off'}, grain ${o.grain}; ${opts.preview ? 'PREVIEW 1280x536' : '1920x1080'} crf ${crf} ${preset}`);
  if (opts.dry) return { plan: P, args, graph };

  const t0 = Date.now(); let last = 0;
  const cmd = opts.nice === 0 ? 'ffmpeg' : 'nice', cargs = opts.nice === 0 ? args : ['-n', String(opts.nice ?? 10), 'ffmpeg', ...args];
  await sh(cmd, cargs, {
    spawn: { cwd: work },
    onErr: (d) => {
      const m = /frame=\s*(\d+).*?fps=\s*([\d.]+)/.exec(String(d).split('\r').filter(Boolean).pop() || '');
      if (m && Date.now() - last > 15000) { last = Date.now(); const f = +m[1], fps = +m[2] || 1; log(`  frame ${f}/${P.total + END_FRAMES} (${((f / (P.total + END_FRAMES)) * 100).toFixed(0)} %, ${fps} fps, about ${Math.round((P.total + END_FRAMES - f) / fps / 60)} min left)`); }
    },
  });
  log(`encoded ${out} in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  if (!opts.keep && !opts.work) fs.rmSync(work, { recursive: true, force: true });
  return { out };
}

async function main() {
  const A = process.argv.slice(2), has = (k) => A.includes('--' + k);
  const arg = (k, d) => { const i = A.indexOf('--' + k); return i >= 0 && A[i + 1] !== undefined && !A[i + 1].startsWith('--') ? A[i + 1] : d; };
  const num = (k) => (arg(k) === undefined ? undefined : Number(arg(k)));
  if (has('help') || !arg('clips') || !arg('score') || !arg('out')) {
    console.error('usage: node tools/cine/assemble-trailer.mjs --clips DIR --score WAV --out FILE [--shots FILE] [--preview]  (more options: see the header of the file)');
    process.exit(has('help') ? 0 : 1);
  }
  await assemble({
    clips: arg('clips'), score: arg('score'), out: arg('out'), shots: arg('shots'), preview: has('preview'), text: arg('text'), work: arg('work'), fonts: arg('fonts'),
    noTitles: has('no-titles'), grade: arg('grade'), grain: num('grain'), fadeIn: num('fade-in'), fadeOut: num('fade-out'), crf: num('crf'), preset: arg('preset'), nice: num('nice'),
    dry: has('dry'), window: arg('window'), partial: has('partial'), printGraph: has('print-graph'), keep: has('keep'), lenient: has('lenient'),
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(e.message || e); process.exit(1); });
