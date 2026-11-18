#!/usr/bin/env node
// Quality control of a trailer master:  node tools/cine/qc-trailer.mjs FILE [--no-sheet] [--cols 4] [--json FILE]
//
// Reports: ffprobe facts against the delivery spec (H.264 High yuv420p 1920x1080 24 fps, 3328 frames = 138.667 s, bt709 tags, AAC 48 kHz stereo, faststart, bitrate cap),
// frame timing regularity, EBU R128 loudness and true peak (ebur128), black frames (blackdetect) and frozen picture (freezedetect) measured on the picture area (the 804 px between the
// bars) with every interval flagged unless it is intended (fade up at the start, the drop of bar 23, the black end), silences of the score (silencedetect), and a contact sheet of the
// frame at every bar start (52 tiles) saved next to the file as FILE.contact.jpg. Writes FILE.qc.json. Exit code 1 when a hard spec check fails, 0 otherwise (flags are warnings).
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import { fileURLToPath } from 'node:url';

const FPS = 24, BAR = 64, TOTAL = 3328, DUR = TOTAL / FPS;
const bb = (t) => { const f = Math.round(t * FPS); return `bar ${Math.floor(f / BAR) + 1}.${Math.floor((f % BAR) / 16) + 1} (frame ${f}, ${t.toFixed(2)} s)`; };
const sh = (cmd, args) => new Promise((res, rej) => {
  const p = cp.spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '', err = ''; p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => { err += d; if (err.length > 5e6) err = err.slice(-2e6); });
  p.on('error', rej); p.on('close', (c) => (c === 0 ? res({ out, err }) : rej(new Error(`${cmd} exited with ${c}\n${err.slice(-1500)}`))));
});

export async function qc(file, { sheet = true, cols = 4, jsonFile } = {}) {
  const R = { file: path.resolve(file), checks: [], flags: [], info: {} };
  const pass = (name, ok, detail, hard = true) => { R.checks.push({ name, ok, detail, hard }); };
  const flag = (m) => R.flags.push(m);
  if (!fs.existsSync(file)) throw new Error('file not found: ' + file);

  // ---- ffprobe facts
  const pr = JSON.parse((await sh('ffprobe', ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', file])).out);
  const v = pr.streams.find((s) => s.codec_type === 'video'), a = pr.streams.find((s) => s.codec_type === 'audio'), fmt = pr.format;
  const preview = v && v.width === 1280 && v.height === 536;
  R.info.mode = preview ? 'preview (1280x536 picture crop)' : 'master';
  R.info.format = { duration: +fmt.duration, size: +fmt.size, bitrate: +fmt.bit_rate, container: fmt.format_name };
  if (!v) { pass('video stream', false, 'none'); } else {
    R.info.video = { codec: v.codec_name, profile: v.profile, level: v.level, pix_fmt: v.pix_fmt, w: v.width, h: v.height, fps: v.r_frame_rate, avg_fps: v.avg_frame_rate, frames: +v.nb_frames, color_range: v.color_range, color_space: v.color_space, color_transfer: v.color_transfer, color_primaries: v.color_primaries, bitrate: +v.bit_rate };
    pass('video codec H.264 High', v.codec_name === 'h264' && v.profile === 'High', `${v.codec_name} ${v.profile} level ${v.level}`);
    pass('pixel format yuv420p', v.pix_fmt === 'yuv420p', v.pix_fmt);
    pass(preview ? 'resolution 1280x536 (preview)' : 'resolution 1920x1080', preview || (v.width === 1920 && v.height === 1080), `${v.width}x${v.height}`);
    pass('frame rate 24', v.r_frame_rate === '24/1' && v.avg_frame_rate === '24/1', `r ${v.r_frame_rate}, avg ${v.avg_frame_rate}`);
    pass(`${TOTAL} frames`, +v.nb_frames === TOTAL, `${v.nb_frames}`);
    pass('colour tags bt709 / tv range', v.color_space === 'bt709' && v.color_transfer === 'bt709' && v.color_primaries === 'bt709' && v.color_range === 'tv', `${v.color_space}/${v.color_transfer}/${v.color_primaries}/${v.color_range}`);
  }
  const dur = +fmt.duration;
  pass(`duration ${DUR.toFixed(3)} s (within one frame)`, Math.abs(dur - DUR) <= 1 / FPS + 0.002, `${dur.toFixed(3)} s`);
  if (!a) pass('audio stream', false, 'none');
  else {
    R.info.audio = { codec: a.codec_name, sample_rate: +a.sample_rate, channels: a.channels, bitrate: +a.bit_rate, duration: +a.duration };
    pass('audio AAC 48 kHz stereo', a.codec_name === 'aac' && +a.sample_rate === 48000 && a.channels === 2, `${a.codec_name} ${a.sample_rate} Hz ${a.channels} ch ${(a.bit_rate / 1000).toFixed(0)} kbit/s`);
    pass('audio and video end together (0.1 s)', Math.abs(+a.duration - (v ? +v.duration : dur)) < 0.1, `audio ${(+a.duration).toFixed(3)} s, video ${v ? (+v.duration).toFixed(3) : '?'} s`);
    if (!preview) pass('audio bitrate >= 300 kbit/s', a.bit_rate >= 300000, `${(a.bit_rate / 1000).toFixed(0)} kbit/s`, false);
  }
  // faststart: moov before mdat
  {
    const fd = fs.openSync(file, 'r'), head = Buffer.alloc(1 << 16); fs.readSync(fd, head, 0, head.length, 0); fs.closeSync(fd);
    const at = (s) => head.indexOf(s); const moov = at('moov'), mdat = at('mdat');
    pass('faststart (moov before mdat)', moov > 0 && (mdat < 0 || moov < mdat), `moov at ${moov}, mdat at ${mdat}`);
  }
  // packets: bitrate and timing regularity
  {
    const pk = (await sh('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'packet=pts_time,size', '-of', 'csv=p=0', file])).out.trim().split('\n').map((l) => l.split(',').map(Number)).filter((r) => r.length >= 2 && !r.some(Number.isNaN));
    pk.sort((x, y) => x[0] - y[0]);
    let worst = 0, worstAt = 0, j = 0, sum = 0;
    for (let i = 0; i < pk.length; i++) { sum += pk[i][1]; while (pk[i][0] - pk[j][0] >= 2) { sum -= pk[j][1]; j++; } const rate = (sum * 8) / Math.min(2, Math.max(pk[i][0], 0.5)) / 1e6; if (rate > worst) { worst = rate; worstAt = pk[i][0]; } }
    const gaps = []; for (let i = 1; i < pk.length; i++) { const d = pk[i][0] - pk[i - 1][0]; if (Math.abs(d - 1 / FPS) > 0.001) gaps.push([pk[i][0], d]); }
    const avg = pk.reduce((s, p) => s + p[1], 0) * 8 / (pk.length / FPS) / 1e6;
    R.info.bitrate = { avgMbit: +avg.toFixed(2), worst2sMbit: +worst.toFixed(2), worstAt };
    pass(`video bitrate (avg ${avg.toFixed(1)} Mbit/s, worst 2 s window ${worst.toFixed(1)} Mbit/s at ${bb(worstAt)})`, preview || worst < 20, 'cap 16 Mbit/s maxrate, windows may exceed it slightly (buffer 32 Mbit)', false);
    pass('constant frame spacing (1/24 s)', gaps.length === 0, gaps.length ? `${gaps.length} irregular intervals, first at ${bb(gaps[0][0])}` : 'all regular');
  }

  // ---- loudness + silence (one audio pass)
  if (a) {
    const { err } = await sh('ffmpeg', ['-hide_banner', '-nostats', '-loglevel', 'info', '-i', file, '-vn', '-af', 'ebur128=peak=true,silencedetect=n=-55dB:d=0.4', '-f', 'null', '-']);
    const sum = err.slice(err.lastIndexOf('Summary:'));
    const num = (re) => { const m = re.exec(sum); return m ? +m[1] : null; };
    const loud = { integrated: num(/I:\s+(-?[\d.]+) LUFS/), range: num(/LRA:\s+(-?[\d.]+) LU/), truePeak: num(/Peak:\s+(-?[\d.]+) dBFS/) };
    R.info.loudness = loud;
    if (loud.integrated !== null) {
      pass(`integrated loudness ${loud.integrated} LUFS (target -14 to -18)`, loud.integrated <= -12 && loud.integrated >= -24, `${loud.integrated} LUFS, loudness range ${loud.range} LU`, false);
      if (loud.integrated > -12) flag(`loud: ${loud.integrated} LUFS is hotter than -12; YouTube turns it down to -14`);
      if (loud.integrated < -20) flag(`quiet: ${loud.integrated} LUFS; YouTube leaves quieter material alone, so it will sound low next to other videos`);
    }
    if (loud.truePeak !== null) { pass(`true peak ${loud.truePeak} dBTP (limit -1.0)`, loud.truePeak <= -1.0, `${loud.truePeak} dBTP`, false); if (loud.truePeak > -1) flag(`true peak ${loud.truePeak} dBTP is above -1 dBTP (lossy encoders overshoot; lower the master by ${(loud.truePeak + 1).toFixed(1)} dB)`); }
    const sil = []; for (const m of err.matchAll(/silence_start: (-?[\d.]+)[\s\S]*?silence_end: ([\d.]+) \| silence_duration: ([\d.]+)/g)) sil.push({ from: +m[1], to: +m[2], dur: +m[3] });
    if (/silence_start: (-?[\d.]+)(?![\s\S]*silence_end)/.test(err.slice(err.lastIndexOf('silence_start')))) { const m = /silence_start: (-?[\d.]+)/g; let x, last; while ((x = m.exec(err))) last = +x[1]; if (last !== undefined && !sil.some((s) => Math.abs(s.from - last) < 0.01)) sil.push({ from: last, to: dur, dur: dur - last }); }
    R.info.silences = sil;
    for (const s of sil) {
      const f0 = s.from * FPS, intended = (f0 < 24 && s.to < 3) || (s.from <= 1408 / FPS + 0.6 && s.to >= 1408 / FPS && s.dur < 4) || s.from >= 3150 / FPS;
      if (!intended) flag(`silence of ${s.dur.toFixed(1)} s from ${bb(s.from)} to ${bb(s.to)} (the intended silences are the first moments, the drop of bar 23 and the end)`);
    }
  }

  // ---- black and freeze on the picture area
  {
    const crop = preview ? 'null' : 'crop=1920:804:0:138';
    const { err } = await sh('ffmpeg', ['-hide_banner', '-nostats', '-loglevel', 'info', '-i', file, '-an', '-vf', `${crop},blackdetect=d=0.08:pic_th=0.97:pix_th=0.10,freezedetect=n=0.005:d=1.0`, '-f', 'null', '-']);
    const blacks = [...err.matchAll(/black_start:([\d.]+) black_end:([\d.]+) black_duration:([\d.]+)/g)].map((m) => ({ from: +m[1], to: +m[2], dur: +m[3] }));
    const fs0 = [...err.matchAll(/freeze_start: ([\d.]+)/g)].map((m) => +m[1]), fe = [...err.matchAll(/freeze_end: ([\d.]+)/g)].map((m) => +m[1]);
    const freezes = fs0.map((s, i) => ({ from: s, to: fe[i] ?? dur, dur: (fe[i] ?? dur) - s }));
    R.info.black = blacks; R.info.freeze = freezes;
    const dropFrom = 1408 / FPS, dropTo = 1472 / FPS;
    const isEndBlack = (s) => s.from >= 3140 / FPS;
    const isStart = (s) => s.from < 0.2 && s.to < 1.8;
    const isDrop = (s) => s.from >= dropFrom - 0.5 && s.to <= dropTo + 0.5;
    for (const s of blacks) {
      if (isEndBlack(s)) R.info.endBlack = s;
      else if (isStart(s)) R.info.startBlack = s;
      else if (isDrop(s)) R.info.dropBlack = s;
      else flag(`UNINTENDED black picture for ${s.dur.toFixed(2)} s, ${bb(s.from)} to ${bb(s.to)}`);
    }
    for (const s of freezes) {
      if (isEndBlack(s) || isDrop(s) || isStart(s)) continue;
      flag(`UNINTENDED frozen picture for ${s.dur.toFixed(2)} s, ${bb(s.from)} to ${bb(s.to)}`);
    }
    pass('black end (the picture is black from the fade-out on)', !!R.info.endBlack || preview, R.info.endBlack ? `black from ${bb(R.info.endBlack.from)} to the end` : 'no black end found', false);
    if (!R.info.startBlack) flag('the first frames are not black: no fade up from black was detected at the start');
  }

  // ---- contact sheet of every bar start
  if (sheet && v) {
    const out = file.replace(/\.[^.]+$/, '') + '.contact.jpg', font = ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf'].find((f) => fs.existsSync(f));
    const rows = Math.ceil(52 / cols), tw = Math.round(1920 / cols / 1.2 / 2) * 2, th = Math.round((tw * 9) / 16 / 2) * 2;
    const lab = font ? `,drawtext=fontfile=${font}:text='bar %{eif\\:n+1\\:d}':x=8:y=6:fontsize=${Math.round(th / 11)}:fontcolor=yellow:box=1:boxcolor=black@0.6:boxborderw=3` : '';
    const vf = `select=not(mod(n\\,${BAR})),scale=${tw}:${th}:force_original_aspect_ratio=decrease,pad=${tw}:${th}:(ow-iw)/2:(oh-ih)/2:black${lab},tile=${cols}x${rows}:padding=3:margin=3:color=0x202020`;
    await sh('ffmpeg', ['-hide_banner', '-y', '-loglevel', 'error', '-i', file, '-an', '-vf', vf, '-frames:v', '1', '-fps_mode', 'passthrough', '-q:v', '3', out]);
    R.info.contactSheet = out;
  }

  // ---- verdict
  const hardFail = R.checks.filter((c) => c.hard && !c.ok);
  R.ok = hardFail.length === 0;
  const lines = [`QC ${R.file} [${R.info.mode}]`];
  for (const c of R.checks) lines.push(`  ${c.ok ? 'ok   ' : c.hard ? 'FAIL ' : 'warn '} ${c.name}${c.ok ? '' : ': ' + c.detail}`);
  if (R.info.loudness) lines.push(`  loudness: integrated ${R.info.loudness.integrated} LUFS, range ${R.info.loudness.range} LU, true peak ${R.info.loudness.truePeak} dBTP`);
  if (R.info.silences?.length) lines.push(`  silences: ${R.info.silences.map((s) => `${bb(s.from)} +${s.dur.toFixed(1)}s`).join('; ')}`);
  if (R.info.black?.length) lines.push(`  black intervals: ${R.info.black.map((s) => `${bb(s.from)} +${s.dur.toFixed(2)}s`).join('; ')}`);
  if (R.info.freeze?.length) lines.push(`  freeze intervals: ${R.info.freeze.map((s) => `${bb(s.from)} +${s.dur.toFixed(2)}s`).join('; ')}`);
  for (const f of R.flags) lines.push(`  FLAG ${f}`);
  if (R.info.contactSheet) lines.push(`  contact sheet: ${R.info.contactSheet}`);
  lines.push(R.ok ? `RESULT: spec checks pass${R.flags.length ? `, ${R.flags.length} flag(s) to look at` : ', no flags'}` : `RESULT: ${hardFail.length} spec check(s) FAILED`);
  R.report = lines.join('\n');
  fs.writeFileSync(jsonFile || file.replace(/\.[^.]+$/, '') + '.qc.json', JSON.stringify(R, null, 1));
  return R;
}

async function main() {
  const A = process.argv.slice(2), file = A.find((a) => !a.startsWith('--') && A[A.indexOf(a) - 1] !== '--cols' && A[A.indexOf(a) - 1] !== '--json');
  const arg = (k, d) => { const i = A.indexOf('--' + k); return i >= 0 && A[i + 1] ? A[i + 1] : d; };
  if (!file) { console.error('usage: node tools/cine/qc-trailer.mjs FILE [--no-sheet] [--cols 4] [--json FILE]'); process.exit(1); }
  const r = await qc(file, { sheet: !A.includes('--no-sheet'), cols: +arg('cols', 4), jsonFile: arg('json') });
  console.log(r.report);
  process.exit(r.ok ? 0 : 1);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(e.message || e); process.exit(1); });
