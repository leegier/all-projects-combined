// The trailer's skeleton: 24 fps, 90 BPM => 1 beat = 16 frames, 1 bar = 64 frames. Every author, the score and the titles work against these ranges.
export const FPS = 24, BPM = 90, BEAT = 16, BAR = 64;
const R = (id, name, from, to, file, mood) => ({ id, name, bars: [from, to], start: (from - 1) * BAR, frames: (to - from + 1) * BAR, file, mood });
export const RANGES = [
  R('A0', 'cold open', 1, 4, 'act1.mjs', 'dark, quiet, held breath: waking in the cell, a PA crackle, first grey light. The score is room tone, a heartbeat, a low drone. Hit at the first frame of bar 5.'),
  R('A1', 'the block', 5, 10, 'act1.mjs', 'the routine of C-Block: bars, shafts of light crossing an empty hall, doors, the ROUTINE board, the watch booth, tally marks, the mess hall. Cuts of 2-3 beats speeding up to 1 beat. A pulse enters at bar 9.'),
  R('A2', 'the ask', 11, 16, 'act2.mjs', 'Intake and Records: the reader, the keycard / shim, the ceiling camera and its cone, the ledger and the transfer order. Tense, 1-2 beat cuts, first-person hands allowed.'),
  R('A3', 'alarm and chase', 17, 22, 'act2.mjs', 'the alarm: camera snaps, red lamps, lockdown PA, doors, sprint in first person, boots, bars. 8-16 frame cuts, the loudest part of the trailer.'),
  R('A3d', 'the drop', 23, 23, 'act2.mjs', 'one bar: everything stops. A dark single held image (the cell door, the arrest fade); silence in the score. The CAUGHT card is added by the titles.'),
  R('A4', 'chapel and the font', 24, 31, 'act3.mjs', 'calm, 4-8 beat shots: the chapel, stained-glass light pooling on the floor, shafts, candles, the baptismal font lifting. Piano and strings enter.'),
  R('A5a', 'the tunnel', 32, 37, 'act3.mjs', 'down the steps and along the tunnel: lantern light on brick, fog, a light at the far end. Slow forward moves, 4-6 beat shots, rising hope.'),
  R('A5b', 'four hours', 38, 47, 'act4.mjs', 'out into the golden forest: god rays, the path, the clearing, the oak, the crate, a lantern; two figures only as backlit silhouettes from behind and far; the pull-back toward the prison in the haze. The score swells and resolves.'),
  R('AT', 'title plate', 48, 50, 'act4.mjs', 'the plate under the title lockup (slow drift over the clearing or the haze), fading to black at the end of bar 50.'),
];
export const END_CARD = { start: 50 * BAR, frames: 2 * BAR };         // bars 51-52: black end card, no clip (titles only)
export const TOTAL_FRAMES = 52 * BAR;                                 // 3328 frames = 138.67 s
