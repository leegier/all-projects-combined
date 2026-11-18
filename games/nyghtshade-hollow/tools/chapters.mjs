// Writes an FFMETADATA chapter file for the final video from the bot's caption log.
//   node tools/chapters.mjs SHIM_DIR ALARM_DIR OUT.ffmeta
// Layout of the final file: A (title card + golden path) · B (interlude card + failure-path clip) · C (report card).
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
const [shimDir, alarmDir, out] = process.argv.slice(2);
const FPS = 30, TITLE_S = 4.5;
const dur = (f) => +cp.execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).trim();
const plan = JSON.parse(fs.readFileSync(path.join(shimDir, 'plan.json'), 'utf8'));
const sched = JSON.parse(fs.readFileSync(path.join(shimDir, 'schedule.json'), 'utf8'));
const aDur = dur(path.join(shimDir, 'A.mp4')), bDur = dur(path.join(alarmDir, 'B.mp4')), cDur = dur(path.join(shimDir, 'C.mp4'));
// sim step -> output time inside A
const outTime = (step) => { let k = sched.findIndex((f) => f.step >= step); if (k < 0) k = sched.length - 1; return TITLE_S + k / FPS; };
const chapters = [{ t: 0, name: 'Title' }, { t: TITLE_S, name: 'Intro cinematic — compound, C-Block, waking in C-107' }];
const seen = new Set();
for (const l of plan.log) {
  if (!l.caption) continue;
  const [title, ...rest] = l.msg.split(': ');
  if (title === 'PLAYTEST' || seen.has(title + ':' + Math.floor(l.t / 20))) continue;   // collapse repeats within 20 s
  seen.add(title + ':' + Math.floor(l.t / 20));
  const label = title.charAt(0) + title.slice(1).toLowerCase();
  chapters.push({ t: outTime(Math.round(l.t * 60)), name: label.replace(/\bai\b/i, 'AI') });
}
chapters.push({ t: aDur, name: 'Failure path — camera alarm, chase, arrest' }, { t: aDur + bDur, name: 'Playtest report' });
// keep strictly increasing, drop chapters closer than 3 s
const clean = []; for (const c of chapters) if (!clean.length || c.t - clean[clean.length - 1].t >= 3) clean.push(c);
const total = aDur + bDur + cDur;
let meta = ';FFMETADATA1\ntitle=Nyghtshade Hollow — The Intake — automated playtest\n';
clean.forEach((c, i) => { const end = i + 1 < clean.length ? clean[i + 1].t : total; meta += `[CHAPTER]\nTIMEBASE=1/1000\nSTART=${Math.round(c.t * 1000)}\nEND=${Math.round(end * 1000)}\ntitle=${c.name}\n`; });
fs.writeFileSync(out, meta);
console.log(clean.map((c) => `${c.t.toFixed(1).padStart(6)} s  ${c.name}`).join('\n'));
