// Final assembly of the playtest video from the encoded pieces, with chapter markers.
//   node tools/assemble.mjs OUTDIR            (expects OUTDIR/shim/A.mp4 + C.mp4; optional keycard/K.mp4, bribe/R.mp4, alarm/B.mp4)
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
const out = path.resolve(process.argv[2]);
const FPS = 30, TITLE_S = 4.5;
const dur = (f) => +cp.execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).trim();
const plan = JSON.parse(fs.readFileSync(path.join(out, 'shim/plan.json'), 'utf8'));
const sched = JSON.parse(fs.readFileSync(path.join(out, 'shim/schedule.json'), 'utf8'));
const pieces = [['shim/A.mp4', null], ['keycard/K.mp4', 'Alternate route — keycard'], ['bribe/R.mp4', 'Alternate route — bribe'], ['alarm/B.mp4', 'Failure path — camera alarm, chase, arrest'], ['shim/C.mp4', 'Playtest report']]
  .map(([f, name]) => ({ file: path.join(out, f), name })).filter((p) => fs.existsSync(p.file));
let t = 0; const chapters = [];
for (const p of pieces) {
  p.dur = dur(p.file);
  if (!p.name) {
    // golden path: one chapter per system caption the bot raised
    const outTime = (step) => { let k = sched.findIndex((f) => f.step >= step); if (k < 0) k = sched.length - 1; return TITLE_S + k / FPS; };
    chapters.push({ t: 0, name: 'Title' }, { t: TITLE_S, name: 'Intro cinematic — compound, C-Block, waking in C-107' });
    const seen = new Set();
    for (const l of plan.log) {
      if (!l.caption) continue;
      const [title] = l.msg.split(': ');
      const key = title + ':' + Math.floor(l.t / 20);
      if (title === 'PLAYTEST' || seen.has(key)) continue;
      seen.add(key);
      chapters.push({ t: outTime(Math.round(l.t * 60)), name: (title.charAt(0) + title.slice(1).toLowerCase()).replace(/\bai\b/i, 'AI') });
    }
  } else chapters.push({ t, name: p.name });
  t += p.dur;
}
const clean = []; for (const c of chapters) if (!clean.length || c.t - clean[clean.length - 1].t >= 3) clean.push(c);
let meta = ';FFMETADATA1\ntitle=Nyghtshade Hollow — The Intake — automated playtest\n';
clean.forEach((c, i) => { const end = i + 1 < clean.length ? clean[i + 1].t : t; meta += `[CHAPTER]\nTIMEBASE=1/1000\nSTART=${Math.round(c.t * 1000)}\nEND=${Math.round(end * 1000)}\ntitle=${c.name}\n`; });
fs.writeFileSync(path.join(out, 'chapters.ffmeta'), meta);
fs.writeFileSync(path.join(out, 'concat.txt'), pieces.map((p) => `file '${p.file}'`).join('\n') + '\n');
const final = path.join(out, 'nyghtshade-hollow-playtest.mp4');
cp.execFileSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', path.join(out, 'concat.txt'), '-i', path.join(out, 'chapters.ffmeta'), '-map', '0', '-map_metadata', '1', '-map_chapters', '1', '-c', 'copy', '-movflags', '+faststart', final], { stdio: 'ignore' });
console.log(pieces.map((p) => `${p.dur.toFixed(1).padStart(7)} s  ${path.basename(p.file)}`).join('\n'));
console.log(clean.map((c) => `${c.t.toFixed(1).padStart(7)} s  ${c.name}`).join('\n'));
console.log(`total ${t.toFixed(1)} s -> ${final} (${(fs.statSync(final).size / 1e6).toFixed(1)} MB)`);
