// "Four Hours" dialogue movie picture: staged in-engine shots (no people on screen; the voices carry the scenes).
// Shot lengths per scene add up exactly to the scene's span in story/dialogue-movie/drama.timeline.json (see SCENES).
import { look } from '../trailer/look.mjs';
export const defaults = { fps: 24, w: 1920, h: 804 };
const LANTERN = (p, i = 2.2) => ({ type: 'point', p, color: '#ffb35c', intensity: i, distance: 9 });
const H = (stage) => ({ humans: 'hide', advance: 90, released: true, player: [-30, 0, -8, 0], ...stage });
const S = (id, dur, stage, p, l, lens, end = {}, fx = {}) => ({ id, dur, stage: H(stage),
  cam: { ease: 'smooth', keys: [{ p, l, lens }, { p: end.p || p, l: end.l || l, lens: end.lens || lens }] }, fx });
const chapelNight = { area: 'chapel', hour: 21.6 }, chapelDay = { area: 'chapel', hour: 13.4 };
const tunnel = (lp) => ({ area: 'tunnel1', env: 'tunnel', hour: 13.5, lights: [LANTERN(lp)] });
const tunnel2 = (lp) => ({ area: 'tunnel2', env: 'tunnel', hour: 13.5, lights: [LANTERN(lp)] });
const gold = { area: 'outside', outside: 'gold', env: 'outsideGold', hour: 14.5 };
const cell = { area: 'hall', hour: 22.6 };
const canteen = { area: 'canteen', hour: 19.2, lights: [{ type: 'point', p: [33, 1.6, -6.8], color: '#ffc27a', intensity: 3, distance: 7 }] };

// scene spans (s) from the audio mix: lead 1.5 s + lines + tail 2.0 s
export const SCENES = { S1: 60.52, S2: 24.80, S3: 30.83, S4: 31.19, S5: 27.08, S6: 61.88, S7: 13.56 };
const raw = {
  S1: [ // under the baptismal: darkness, the stair, lantern, then the clearing he describes
    S('S1-01-stair-dark', 9, tunnel([-55, -2.0, -12], 1.0), [-55, -1.7, -21], [-55, -2.0, -8], 28, { p: [-55, -1.7, -19.5] }, look('tunnel', { ev: 0.3 })),
    S('S1-02-font-above', 8, chapelNight, [-52.4, 1.2, -3.0], [-55, 0.8, -5.75], 35, { p: [-52.9, 1.1, -3.6] }, look('warm', { ev: 0.2, dof: { focus: 3.2, fstop: 2 } })),
    S('S1-03-tunnel-lantern', 10, tunnel([-55, -2.0, -14]), [-55, -1.7, -10.5], [-55, -2.2, -24], 32, { p: [-55, -1.7, -13.5] }, look('tunnel', { dof: { focus: 3.5, fstop: 2.4 } })),
    S('S1-04-oak-gold', 12, gold, [-96, 1.6, -27], [-105.5, 2.2, -35], 35, { p: [-99, 1.5, -29.5] }, look('gold', { dof: { focus: 9, fstop: 4 } })),
    S('S1-05-crate-blanket', 10, gold, [-101.6, 0.9, -31.4], [-104, 0.5, -33.4], 50, { p: [-102.2, 0.8, -31.9] }, look('gold', { dof: { focus: 2.6, fstop: 2 } })),
    S('S1-06-back-to-dark', 11, tunnel([-55, -2.0, -9.5]), [-55, -1.7, -23], [-55, -2, -8], 28, { p: [-55, -1.7, -22] }, look('tunnel', { ev: 0.4 })),
  ],
  S2: [ // rules: the chapel by day, stained glass
    S('S2-01-aisle', 9, chapelDay, [-52.5, 1.2, 4.5], [-66, 2.2, 0.5], 28, { p: [-59, 1.2, 4.5] }, look('warm')),
    S('S2-02-glass', 8, chapelDay, [-60, 1.4, 6], [-62, 4, -10.4], 35, { l: [-66, 4, -10.4] }, look('warm', { bloom: 1.4 })),
    S('S2-03-font-close', 8, chapelDay, [-53.2, 1.4, -3.6], [-55, 0.8, -5.75], 50, { p: [-53.6, 1.25, -4.1] }, look('warm', { dof: { focus: 2.2, fstop: 1.8 } })),
  ],
  S3: [ // the call: C-Block after lights out
    S('S3-01-block-night', 10, cell, [0, 6.5, 9.5], [0, 1.5, -6], 24, { p: [3, 6.3, 9.5] }, look('dawn', { ev: 0.3 })),
    S('S3-02-bars', 11, cell, [0, 6.5, 9.5], [0, 1.5, -6], 35, { p: [0, 5.2, 5.5] }, look('dawn', { ev: 0.2, dof: { focus: 1.2, fstop: 1.8 } })),
    S('S3-03-tier', 10, cell, [-3, 6.3, 9.5], [0, 1.5, -6], 35, { p: [3, 6.3, 9.5] }, look('dawn', { ev: 0.3 })),
  ],
  S4: [ // one last ride: tunnel mouth into the light, then fast through the trees
    S('S4-01-mouth', 9, tunnel2([-70, -2.0, -24]), [-62, -1.7, -24], [-76, -1.5, -24], 28, { p: [-68, -1.7, -24] }, look('tunnel')),
    S('S4-02-gully', 8, gold, [-80, -1.6, -24.3], [-92, 0.5, -28], 24, { p: [-86, -0.6, -26] }, look('gold', { mb: 1 })),
    S('S4-03-ride', 8, gold, [-84, 1.2, -22], [-110, 1, -40], 24, { p: [-104, 1.2, -36] }, look('gold', { mb: 1, streak: { amount: 0.8, threshold: 2, len: 1.4 } })),
    S('S4-04-sky', 7, gold, [-98, 1.0, -30], [-110, 9, -44], 18, { l: [-104, 11, -46] }, look('gold')),
  ],
  S5: [ // the chamber: the tunnel junction, empty, then lit
    S('S5-01-junction-dark', 9, tunnel2([-64, -2.0, -24], 0.8), [-56, -1.7, -24], [-70, -2, -24], 24, { p: [-57, -1.7, -24] }, look('tunnel', { ev: 0.3 })),
    S('S5-02-junction-lit', 9, { ...tunnel2([-60, -1.4, -24], 4), lights: [LANTERN([-60, -1.4, -24], 4), LANTERN([-66, -1.4, -24], 3)] }, [-56, -1.6, -24], [-70, -2, -24], 28, { p: [-58, -1.6, -24] }, look('tunnel', { ev: 1.1, dof: { focus: 6, fstop: 2.8 } })),
    S('S5-03-home', 9, tunnel2([-62, -1.4, -24], 3), [-64, -1.9, -23.4], [-57, -2.1, -24.4], 35, { p: [-63, -1.9, -23.6] }, look('tunnel', { ev: 1.0 })),
  ],
  S6: [ // Mama's dinner: a warm table, candles, the quiet after
    S('S6-01-table', 12, canteen, [30.5, 1.5, -4.2], [33, 0.9, -6.8], 35, { p: [31.5, 1.4, -4.6] }, look('warm', { ev: 0.0, dof: { focus: 3, fstop: 2 } })),
    S('S6-02-candles', 10, chapelNight, [-68.5, 1.4, 1.6], [-70.9, 1.3, 0], 50, { p: [-68.9, 1.35, 1.2] }, look('warm', { dof: { focus: 2.5, fstop: 1.6 } })),
    S('S6-03-table-close', 13, canteen, [32, 1.2, -5.6], [33.3, 0.85, -6.8], 50, { p: [32.4, 1.15, -6.0] }, look('warm', { ev: 0.0, dof: { focus: 1.5, fstop: 1.6 } })),
    S('S6-04-toast-glow', 12, chapelNight, [-62, 1.6, 3], [-70.9, 1.5, 0], 35, { p: [-64, 1.5, 2.2] }, look('warm', { bloom: 1.5 })),
    S('S6-05-good-man', 15, tunnel([-55, -2.0, -15]), [-55, -1.7, -18.5], [-55, -2.0, -9], 35, { p: [-55, -1.7, -17.2] }, look('tunnel', { dof: { focus: 4, fstop: 2.2 } })),
  ],
  S7: [ // Sunday: up the stair toward morning
    S('S7-01-stair-up', 14, tunnel([-55, -1.4, -8]), [-55, -1.7, -22], [-55, -1.2, -8], 24, { p: [-55, -1.7, -20.8] }, look('tunnel', { ev: 0.6 })),
  ],
};
// stretch the last shot of each scene so every scene is exactly its audio span (frame-accurate at 24 fps)
export const shots = Object.entries(raw).flatMap(([sc, list]) => {
  const want = Math.round(SCENES[sc] * 24), have = list.reduce((a, s) => a + Math.round(s.dur * 24), 0);
  const last = list[list.length - 1]; last.dur = (Math.round(last.dur * 24) + want - have) / 24;
  return list;
});
