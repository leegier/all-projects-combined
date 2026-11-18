// All trailer shots in order, plus the timeline. Used by tools/cine/render.mjs (as the shots file), by the score and by the assembler.
import { RANGES } from './timeline.mjs';
import * as a1 from './act1.mjs'; import * as a2 from './act2.mjs'; import * as a3 from './act3.mjs'; import * as a4 from './act4.mjs';
export const defaults = { fps: 24, w: 1920, h: 804 };
const byFile = { 'act1.mjs': a1.shots, 'act2.mjs': a2.shots, 'act3.mjs': a3.shots, 'act4.mjs': a4.shots };
const pref = (id) => id.split('-')[0];
export const shots = RANGES.flatMap((r) => (byFile[r.file] || []).filter((s) => pref(s.id) === r.id));
export { RANGES };
