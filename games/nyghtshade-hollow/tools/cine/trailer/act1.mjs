// A0 cold open + A1 the block. Authored by a picture agent: see BRIEF.md. Every shot is staged (no bot), humans hidden, so a MetaHuman re-render is just a re-render.
import { look } from './look.mjs';

const stageHall = (o = {}) => ({ area: 'hall', hour: 7.3, humans: 'hide', released: true, player: [0, 0, 8.5, 0], advance: 60, ...o });
const stageCan = (o = {}) => ({ area: 'canteen', hour: 7.3, humans: 'hide', released: true, player: [27, 0, -4, 0], advance: 60, ...o });

/**
 * Visual-only repair of the ROUTINE board texture for software-GL renders: the game draws its three schedule lines at a size that overflows the
 * 512 px canvas where "Arial Narrow" is missing (the first words are cut: "NT 0600"). The same text is redrawn smaller so COUNT 0600 reads.
 * (Engine request filed in the report: fit the text to the canvas in signTexture.)
 */
const BOARD_FIX = `
let m = null; g.scene.traverse((o) => { const p = o.isMesh && o.geometry && o.geometry.parameters; if (p && p.width === 1.4 && p.height === 0.9 && Math.abs(o.position.x - 17.98) < 0.1 && o.material && o.material.map) m = o; });
if (m) {
  const t = m.material.map, c = t.image, x = c.getContext('2d'), w = c.width, h = c.height;
  x.fillStyle = '#d9d4bd'; x.fillRect(0, 0, w, h);
  const lw = Math.round(h * 0.035); x.strokeStyle = '#7a0f0f'; x.lineWidth = lw; x.strokeRect(lw, lw, w - 2 * lw, h - 2 * lw);
  const L = [['ROUTINE', 0.3, '#7a0f0f'], ['COUNT 0600 \\u00b7 CHOW 0700 \\u00b7 WORK 0800', 0.066, '#111'], ['YARD 1000 \\u00b7 CHOW 1200 \\u00b7 CHAPEL 1300', 0.066, '#111'], ['GYM 1500 \\u00b7 VISIT 1600 \\u00b7 LIGHTS OUT 2200', 0.066, '#111']];
  const total = L.reduce((a, l) => a + l[1] * h * 1.15, 0); let y = (h - total) / 2;
  for (const [txt, sz, col] of L) { x.font = 'bold ' + Math.round(sz * h) + 'px "Arial Narrow", "Helvetica Neue", Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'top'; x.fillStyle = col; x.fillText(txt, w / 2, y); y += sz * h * 1.15; }
  let s = 7; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 40; i++) { const px = r() * w, py = r() * h, rad = 6 + r() * 30, gr = x.createRadialGradient(px, py, 0, px, py, rad); gr.addColorStop(0, 'rgba(60,55,40,' + (0.05 + r() * 0.08) + ')'); gr.addColorStop(1, 'rgba(60,55,40,0)'); x.fillStyle = gr; x.fillRect(px - rad, py - rad, rad * 2, rad * 2); }
  t.needsUpdate = true;
}`;

const cam = (keys, ease = 'smooth', extra = {}) => ({ ease, keys, ...extra });

export const shots = [
  // ---------------------------------------------------------------- A0 cold open (256 frames)
  {
    id: 'A0-01-wake', dur: 80 / 24, stage: stageHall({ hour: 5.95, released: false, lights: [{ type: 'point', p: [1.0, 2.7, -6.4], color: '#9db8cc', intensity: 9, distance: 9, decay: 1.6 }] }),
    cam: cam([{ p: [0.55, 0.96, -9.5], l: [0.75, 1.9, -7.4], lens: 26, roll: 2 }, { p: [0.56, 0.97, -9.4], l: [1.2, 1.35, -6.0], lens: 26, roll: 0 }], 'smooth', { shake: { pos: 0.004, aim: 0.15, freq: 0.5 } }),
    fx: { ...look('dawn', { ev: 1.4 }), eyelid: [{ u: 0, v: 1 }, { u: 0.2, v: 0.75 }, { u: 0.3, v: 0.9 }, { u: 0.6, v: 0.15 }, { u: 0.8, v: 0 }], blur: [{ u: 0, v: 1 }, { u: 0.8, v: 0.1 }], dof: { focus: { keys: [{ u: 0, v: 0.7 }, { u: 1, v: 4.2 }] }, fstop: 1.8 } },
    notes: 'First-person style wake-up in C-107: eyelid opens under the bunk, focus drifts out to the bars. Text: none (first 48 frames are text-free); the PA crackle sits under it.',
  },
  {
    id: 'A0-02-tally', dur: 64 / 24, stage: stageHall({ hour: 5.95, released: false }),
    cam: cam([{ p: [1.35, 1.55, -8.6], l: [0.125, 1.55, -8.6], lens: 50 }, { p: [0.95, 1.55, -8.6], l: [0.125, 1.55, -8.6], lens: 50 }]),
    fx: { ...look('dawn', { ev: 1.0 }), dof: { focus: 1.0, fstop: 2 } },
    notes: 'Macro push on the tally marks on the cell wall. Text can sit lower third.',
  },
  {
    id: 'A0-03-first-light', dur: 64 / 24, stage: stageHall({ hour: 6.4, released: false }), hours: [6.4, 6.9],
    cam: cam([{ p: [-14, 7.6, 7.6], l: [4, 1.0, -3], lens: 24 }, { p: [-12, 3.6, 8.2], l: [4, 1.2, -3], lens: 24 }]),
    fx: { ...look('dawn', { ev: 1.0 }), dof: { focus: 18, fstop: 5 } },
    notes: 'Slow crane down from the upper tier: grey light through the clerestory over the empty hall.',
  },
  {
    id: 'A0-04-to-the-bars', dur: 48 / 24, stage: stageHall({ hour: 6.9, released: false }),
    cam: cam([{ p: [1.5, 1.45, -1.0], l: [1.5, 1.4, -5.5], lens: 28 }, { p: [1.5, 1.45, -3.9], l: [1.5, 1.4, -5.5], lens: 28 }], 'slowin'),
    fx: { ...look('dawn', { ev: 1.0 }), dof: { focus: 4.5, fstop: 2.4 } },
    notes: 'Slow push toward the cell bars; lands on the bars at the hit of bar 5.',
  },
  // ---------------------------------------------------------------- A1 the block (384 frames)
  {
    id: 'A1-01-booth', dur: 48 / 24, stage: stageHall({ hour: 7.3 }), hours: [7.3, 7.6],
    cam: cam([{ p: [7, 1.3, 6.5], l: [0, 1.6, 0], lens: 35 }, { p: [5.4, 1.3, 5.4], l: [0, 1.6, 0], lens: 35 }]),
    fx: { ...look('dawn', { ev: 1.0 }), dof: { focus: 9, fstop: 2.8 } },
    notes: 'The glass watch booth at the heart of the empty hall.',
  },
  {
    id: 'A1-02-routine-board', dur: 48 / 24, stage: stageHall({ hour: 7.5, js: BOARD_FIX }),
    cam: cam([{ p: [13.6, 1.95, -1.6], l: [18, 1.78, -3.6], lens: 50 }, { p: [15.0, 1.85, -2.5], l: [18, 1.62, -3.6], lens: 50 }]),
    fx: { ...look('dawn', { ev: 0.7 }), dof: { focus: { keys: [{ u: 0, v: 1.2 }, { u: 0.25, v: 1.2 }, { u: 0.85, v: 3.8 }] }, fstop: 1.8 } },
    notes: 'ROUTINE board, rack focus from soft to sharp onto COUNT 0600. Text can sit lower left.',
  },
  {
    id: 'A1-03-shafts', dur: 48 / 24, stage: stageHall({ hour: 7.3 }), hours: [7.3, 9.4],
    cam: cam([{ p: [16.5, 1.5, -3.5], l: [-10, 3.2, -1.0], lens: 24 }, { p: [15.5, 1.5, -3.5], l: [-10, 3.2, -1.0], lens: 24 }]),
    fx: { ...look('dawn', { ev: 1.0 }), dof: { focus: 12, fstop: 4 } },
    notes: 'Shafts of window light sweeping across the empty hall as the clock runs.',
  },
  {
    id: 'A1-04-doors', dur: 40 / 24, stage: stageHall({ hour: 7.0, released: false }), hours: [7.0, 7.1], releaseAt: 0.3,
    cam: cam([{ p: [7, 1.2, 1.5], l: [-2, 1.4, -5.5], lens: 28 }, { p: [5.5, 1.2, 0.8], l: [-2, 1.4, -5.5], lens: 28 }]),
    fx: { ...look('dawn', { ev: 1.0 }), dof: { focus: 9, fstop: 3 } },
    notes: 'Cell doors rolling open along the north row.',
  },
  {
    id: 'A1-05-cells-through-bars', dur: 40 / 24, stage: stageHall({ hour: 7.6 }),
    cam: cam([{ p: [-8, 1.4, -4.6], l: [-5.5, 1.3, -9.5], lens: 35 }, { p: [-3, 1.4, -4.6], l: [-0.5, 1.3, -9.5], lens: 35 }], 'linear'),
    fx: { ...look('dawn', { ev: 1.0 }), dof: { focus: 5, fstop: 2.4 }, mb: 1 },
    notes: 'Rows of empty cells seen past the bars.',
  },
  {
    id: 'A1-06-mess-hall', dur: 32 / 24, stage: stageCan({ hour: 7.3 }),
    cam: cam([{ p: [36, 1.5, -4.0], l: [30, 1.3, -13.5], lens: 28 }, { p: [34, 1.5, -4.0], l: [30, 1.3, -13.5], lens: 28 }]),
    fx: { ...look('warm', { ev: 1.0 }), dof: { focus: 11, fstop: 3 } },
    notes: 'The empty mess hall, serving line at the back.',
  },
  {
    id: 'A1-07-commissary-sign', dur: 32 / 24, stage: stageCan({ hour: 7.3 }),
    cam: cam([{ p: [33.0, 1.3, -7.0], l: [40.35, 2.6, -10.3], lens: 50 }, { p: [34.2, 1.3, -7.6], l: [40.35, 2.6, -10.3], lens: 50 }]),
    fx: { ...look('warm', { ev: 0.3 }), dof: { focus: 7, fstop: 2.4 } },
    notes: 'COMMISSARY sign.',
  },
  {
    id: 'A1-08-commissary-shelves', dur: 24 / 24, stage: stageCan({ hour: 7.3 }),
    cam: cam([{ p: [38.4, 1.6, -9.6], l: [41.4, 1.9, -10.6], lens: 50 }, { p: [38.8, 1.6, -9.9], l: [41.4, 1.9, -10.6], lens: 50 }]),
    fx: { ...look('warm', { ev: 1.0 }), dof: { focus: 3.2, fstop: 2 } },
    notes: 'Shelves behind the commissary window.',
  },
  {
    id: 'A1-09-bunk', dur: 24 / 24, stage: stageHall({ hour: 7.6 }),
    cam: cam([{ p: [2.2, 1.2, -6.3], l: [0.9, 0.8, -9.2], lens: 35 }, { p: [1.9, 1.2, -6.8], l: [0.9, 0.8, -9.2], lens: 35 }]),
    fx: { ...look('dawn', { ev: 1.0 }), dof: { focus: 3.4, fstop: 2.4 } },
    notes: 'A bunk in an empty cell.',
  },
  {
    id: 'A1-10-lock-plate', dur: 16 / 24, stage: stageHall({ hour: 7.0, released: false }), releaseAt: 0.15,
    cam: cam([{ p: [0.55, 1.12, -4.75], l: [1.5, 1.02, -5.43], lens: 50 }, { p: [0.75, 1.1, -4.8], l: [1.5, 1.02, -5.43], lens: 50 }]),
    fx: { ...look('dawn', { ev: 0.8 }), dof: { focus: 1.2, fstop: 1.8 } },
    notes: 'Lock plate of a cell door as it slides open (macro).',
  },
  {
    id: 'A1-11-cell-plate', dur: 16 / 24, stage: stageHall({ hour: 7.6 }),
    cam: cam([{ p: [2.2, 2.7, -3.6], l: [1.5, 2.95, -5.5], lens: 50 }, { p: [1.9, 2.7, -4.0], l: [1.5, 2.95, -5.5], lens: 50 }]),
    fx: { ...look('dawn', { ev: 1.0 }), dof: { focus: 2.2, fstop: 2 } },
    notes: 'Cell number plate.',
  },
  {
    id: 'A1-12-east-corridor', dur: 16 / 24, stage: { area: 'eastCorr', hour: 7.6, humans: 'hide', released: true, player: [30, 0, 0, 0], advance: 60 },
    cam: cam([{ p: [19.2, 1.5, 0.0], l: [36, 1.7, 0.0], lens: 28 }, { p: [22.0, 1.5, 0.0], l: [36, 1.7, 0.0], lens: 28 }]),
    fx: { ...look('dawn', { ev: 1.0 }), dof: { focus: 16, fstop: 4 } },
    notes: 'Push into the east corridor toward Intake: leads into A2.',
  },
];
