// node tools/cine/trailer/check.mjs  -> per range: frames used vs the budget, shot lengths in frames, ids; exits 1 on any mismatch.
import { RANGES, FPS, TOTAL_FRAMES } from './timeline.mjs';
import { shots } from './index.mjs';
let bad = 0, start = 0;
for (const r of RANGES) {
  const list = shots.filter((s) => s.id.split('-')[0] === r.id), fr = list.map((s) => Math.round(s.dur * FPS)), sum = fr.reduce((a, b) => a + b, 0);
  const ok = sum === r.frames && fr.every((f) => f % 8 === 0) && start === r.start;
  if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${r.id.padEnd(4)} bars ${String(r.bars[0]).padStart(2)}-${String(r.bars[1]).padEnd(2)} ${String(sum).padStart(4)}/${r.frames} frames  [${fr.join(' ')}]${fr.some((f) => f % 8) ? '  (lengths must be multiples of 8 frames)' : ''}`);
  start += r.frames;
}
console.log(`${shots.length} shots; picture covers ${start} of ${TOTAL_FRAMES} frames (the last 128 are the black end card)`);
process.exit(bad ? 1 : 0);
