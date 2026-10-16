// A2 the ask (bars 11-16, 384 frames), A3 alarm and chase (bars 17-22, 384 frames), A3d the drop (bar 23, 64 frames).
// Real footage only: staged director cameras (empty rooms, humans hidden) and the game's own first-person view driven by the playtest bot.
// The alarm look is the game's own: g.alert.level = 2 is forced while a frame renders (red lamps, pulsing red edge tint); the sim itself is untouched.
import { look } from './look.mjs';

const WARM = look('warm');
const ALARM = look('alarm', { ev: 0.3 });
const fr = (n) => n / 24;
// forces alert level 2 only while rendering (drives the alarm lamps and the pulsing red edge of the real grade pass); optionally the Records camera cone turns red and bright (its detect colour)
const ALJS = `const r0 = g.render.bind(g); g.render = (a, b) => { const l = g.alert.level; g.alert.level = 2; try { r0(a, b); } finally { g.alert.level = l; } };`;
const CONE = (v, red) => `const c0 = g.render.bind(g); g.render = (a, b) => { const u = g.story.cam.cone.material.uniforms; u.intensity.value = ${v}; ${red ? 'u.color.value.setHex(0xff3a2a);' : ''} c0(a, b); };`;
const dof = (focus, fstop = 2) => ({ dof: { focus, fstop }, mb: 1 });
const LIGHTS_CAM = { lights: [{ type: 'point', p: [50.3, 2.5, 3.5], color: '#ffa070', intensity: 7, distance: 5, decay: 2 }] };   // rim light on the ceiling camera, which is black on dark wall otherwise

/** staged director shot: two camera keys (start, end) */
const st = (id, n, stage, p, l, lens, o = {}) => ({
  id, dur: fr(n), notes: o.notes || '',
  stage: { advance: 60, released: true, humans: 'hide', hour: 8.9, ...stage },
  cam: { ease: o.ease || 'smooth', keys: [{ p, l, lens }, { p: o.p2 || p, l: o.l2 || l, lens: o.lens2 || lens }] },
  fx: { ...(o.alarm ? ALARM : WARM), ...(o.fx || {}) },
});
/** first-person bot shot: the game's own camera (hands, bob) at sim second `at`; speed > 1 plays the route faster (a run) */
const fp = (id, n, at, o = {}) => ({
  id, dur: fr(n), notes: o.notes || '',
  sim: { bot: 'shim', at, ...(o.speed ? { speed: o.speed } : {}) }, cam: 'player',
  stage: { humans: 'hide', ...(o.js ? { js: o.js } : {}) },
  fx: { ...(o.alarm ? ALARM : WARM), ...(o.fx || {}) }, ui: !!o.ui,
});
const E = { area: 'eastCorr', env: 'eastCorr', player: [30, 0, 0, 0] };
const I = { area: 'intake', player: [36, 0, 3, 0] };
const R = { area: 'records', env: 'records', player: [47, 0, 4, 0], hour: 9 };
const H = { area: 'hall', hour: 9, player: [0, 0, 3, 0] };
const RC = { ...R, ...LIGHTS_CAM, js: CONE(0.1) };
const RA = { ...R, ...LIGHTS_CAM, js: CONE(0.3, true) + ALJS };
const EA = { ...E, js: ALJS }, HA = { ...H, js: ALJS };
const RUN = { alarm: true, speed: 2, js: ALJS };

export const shots = [
  // ================================ A2 the ask: 384 frames ================================
  st('A2-01-east-corridor', 32, E, [22.5, 0.6, 0.9], [38, 1.7, 0], 24, { p2: [29.5, 0.62, 0.5], fx: { mb: 1 }, notes: 'Opening of the ask: a low dolly down the long east corridor toward Intake. No text in this shot; room for a small lower-third line.' }),
  st('A2-02-intake-door', 32, I, [31.0, 1.5, 3.5], [44, 1.7, 6.0], 24, { p2: [33.2, 1.5, 3.7], fx: { ev: 0.3, mb: 1 }, notes: 'The Intake lobby, glass counter on the right, the RECORDS door at the far end; slow push. Lower third is free for the first dialogue line.' }),
  st('A2-03-glass-lamp', 24, I, [34.0, 1.15, 4.6], [37.5, 1.4, 8.0], 50, { p2: [34.6, 1.15, 4.6], fx: { ev: 0.1, light: { hi: 1.5, ai: 1.4, fog: 0.8 }, dof: { focus: 5.0, fstop: 1.8 }, mb: 1 }, notes: 'Through the Intake glass: the staff desk lamp and the green terminal, chair empty (humans hidden). Upper third free.' }),
  fp('A2-04-lobby-fpv', 16, 200.6, { notes: 'First-person in the lobby: bars, the INTAKE sign, the desk lamp. Real bot footage, hands visible. Upper third free.' }),
  fp('A2-05-reader-fpv', 32, 196.5, { fx: { ev: 0.9, light: { hi: 2.4, ai: 2.2, fog: 1.3 } }, notes: 'First-person: the shim arm working the card reader (real bot footage). Reader and its red light at centre; text can sit lower third.' }),
  fp('A2-06-doorway-fpv', 24, 202.2, { fx: { ev: 0.6 }, notes: 'First-person through the Records doorway, the ledger lamp glowing ahead. Lower third free.' }),
  st('A2-07-records-wide', 32, R, [46.0, 1.5, 2.9], [50.5, 1.3, 7.2], 24, { p2: [47.2, 1.45, 3.3], fx: { mb: 1 }, notes: 'Records room wide: the lamp on the ledger table, the green terminal, the TRANSFER ORDERS sign, the RECORDS sign; slow track. Lower third free.' }),
  st('A2-08-ledger-rack', 32, R, [47.1, 1.15, 5.3], [48.3, 1.0, 5.9], 50, { fx: { ev: -0.9, dof: { focus: { keys: [{ u: 0, v: 1.4 }, { u: 0.45, v: 1.4 }, { u: 1, v: 5.5 }] }, fstop: 1.8 }, mb: 1 }, notes: 'The ledger under the lamp, rack focus from the ledger to the transfer sign behind it. Upper third free.' }),
  fp('A2-09-copy-hud', 48, 211.2, { ui: true, notes: 'HUD on: first-person copying page 14 of the ledger; objective, minimap, stat bars and detection ring are the game\'s own. Keep text off the middle; dialogue can sit at the very bottom.' }),
  st('A2-10-camera-cone', 32, RC, [44.6, 1.6, 4.0], [51.3, 2.8, 2.6], 35, { p2: [45.2, 1.6, 4.2], fx: dof(9.0, 2.8), notes: 'The ceiling security camera in the far corner, its vision cone sweeping the ceiling. Lower third free for the dialogue.' }),
  st('A2-11-camera-wall', 32, RC, [50.8, 1.8, 9.0], [51.4, 3.0, 2.6], 35, { fx: dof(6.5, 2.8), notes: 'Along the east wall: the transfer sign foreground right, the camera and its cone in the distance. Lower third free.' }),
  st('A2-12-cone-low', 24, RC, [47.0, 0.9, 7.0], [51.0, 2.6, 2.8], 28, { p2: [47.6, 0.95, 6.8], fx: dof(6.5, 2.4), notes: 'Low angle across the table toward the camera in the corner. Text: none, the calm before the alarm.' }),
  fp('A2-13-detect-hud', 24, 213.2, { ui: true, notes: 'HUD on: the detection ring in the top centre. Real bot footage. No text on this one.' }),

  // ================================ A3 alarm and chase: 384 frames ================================
  st('A3-01-records-red', 16, RA, [46.0, 1.5, 2.9], [50.5, 1.3, 7.2], 24, { p2: [46.6, 1.5, 3.1], alarm: true, fx: { mb: 1 }, notes: 'The hit of bar 17: Records washed red, the camera cone red, the room pulsing. PA line sits in the upper third.' }),
  st('A3-02-camera-pov', 8, RA, [51.0, 2.85, 3.0], [47.8, 0.9, 6.2], 20, { alarm: true, notes: 'What the camera sees: the ledger table from the NE ceiling corner, red pulse.' }),
  fp('A3-03-intake-fpv', 16, 200.6, { alarm: true, speed: 1.6, js: ALJS, notes: 'First-person in the Intake lobby with the alarm tint. PA line upper third.' }),
  st('A3-04-records-reverse', 8, RA, [51.0, 1.5, 9.2], [45.0, 1.2, 4.0], 24, { alarm: true, notes: 'Records from the terminal corner toward the door, red.' }),
  st('A3-05-intake-red', 8, { ...I, js: ALJS }, [31.0, 1.5, 3.5], [44, 1.7, 6.0], 24, { p2: [32.0, 1.5, 3.7], alarm: true, notes: 'Intake lobby under the alarm.' }),
  fp('A3-06-corridor-run-1', 16, 238.4, { ...RUN, notes: 'First-person run in the east corridor, red edge pulse, the sally gate ahead. PA line upper third.' }),
  st('A3-07-gate-bars', 8, EA, [27, 1.3, 0.4], [24.15, 1.5, 0], 28, { p2: [26.4, 1.3, 0.4], alarm: true, notes: 'The checkpoint gate bars filling the frame, red.' }),
  st('A3-08-corridor-low', 16, EA, [22, 0.35, 0.8], [40, 1.2, 0], 24, { p2: [28, 0.35, 0.8], alarm: true, fx: { mb: 1 }, notes: 'Floor-level dolly down the corridor, bars of the gate in the foreground.' }),
  fp('A3-09-corridor-run-2', 16, 240.6, { ...RUN, notes: 'First-person run, the corridor gate ahead.' }),
  st('A3-10-corridor-back', 8, EA, [46, 1.0, 0.7], [24, 1.6, 0], 28, { p2: [40, 1.0, 0.7], alarm: true, fx: { mb: 1 }, notes: 'Looking back west along the corridor, receding lights, red pulses.' }),
  fp('A3-11-hall-run-1', 16, 245.4, { ...RUN, notes: 'First-person run into the hall, the stairs on the left.' }),
  st('A3-12-hall-low', 8, HA, [14, 0.4, 3], [0, 1.2, -3], 24, { p2: [8, 0.4, 3], alarm: true, fx: { mb: 1 }, notes: 'Floor-level in the empty hall, the watch booth glowing.' }),
  fp('A3-13-hall-run-2', 16, 249, { ...RUN, notes: 'First-person run across the hall toward the booth.' }),
  st('A3-14-cell-bars', 8, HA, [-5, 1.4, -3.0], [-5, 1.5, -9], 28, { p2: [-5, 1.4, -3.8], alarm: true, notes: 'The cell doors of the north row, red.' }),
  st('A3-15-booth', 16, HA, [-5, 1.0, 8.5], [0, 1.6, 0], 28, { alarm: true, fx: dof(10, 2.5), notes: 'The glass watch booth across the hall, tables silhouetted, red.' }),
  st('A3-16-west-gate', 8, { area: 'westCorr', env: 'westCorr', player: [-30, 0, 0, 0], js: ALJS }, [-20.5, 0.6, 0.5], [-35, 2.0, 1.5], 24, { alarm: true, notes: 'The west corridor gate and its lamps.' }),
  fp('A3-17-west-run-1', 16, 263.5, { ...RUN, notes: 'First-person run through the west corridor, bars ahead.' }),
  st('A3-18-hall-high', 8, HA, [16, 6.0, 9.0], [-2, 1.0, -3], 24, { p2: [14, 6.0, 8.5], alarm: true, notes: 'High angle over the empty hall, both tiers, red.' }),
  fp('A3-19-west-run-2', 16, 268, { ...RUN, notes: 'First-person run in the west corridor.' }),
  fp('A3-20-corridor-run-3', 8, 242.4, { ...RUN, notes: 'Flash of the east corridor.' }),
  fp('A3-21-hall-run-3', 16, 251.5, { ...RUN, notes: 'First-person run in the hall.' }),
  fp('A3-22-west-run-3', 16, 270.5, { ...RUN, notes: 'First-person run in the west corridor.' }),
  st('A3-23-sally-gate', 8, EA, [21, 1.3, 0.5], [18.3, 1.5, 0], 28, { alarm: true, notes: 'The sally gate bars.' }),
  fp('A3-24-hall-run-4', 8, 253, { ...RUN, notes: 'First-person run past the booth.' }),
  st('A3-25-camera-red', 8, RA, [47.5, 1.0, 7.8], [51.3, 2.9, 2.7], 50, { alarm: true, fx: dof(7.5, 2.8), notes: 'The camera head, cone red.' }),
  fp('A3-26-west-run-4', 16, 273, { ...RUN, notes: 'First-person run, west corridor.' }),
  fp('A3-27-hall-run-5', 16, 246.5, { ...RUN, notes: 'First-person run, hall.' }),
  st('A3-28-hall-low-2', 8, HA, [-12, 0.4, -2.6], [4, 1.3, 2], 24, { p2: [-8, 0.4, -2.6], alarm: true, fx: { mb: 1 }, notes: 'Floor-level in the hall.' }),
  fp('A3-29-hall-run-6', 16, 255, { ...RUN, notes: 'First-person run, hall.' }),
  fp('A3-30-run-to-black', 32, 257, { ...RUN, fx: { eyelid: [{ u: 0.35, v: 0 }, { u: 1, v: 1 }] }, notes: 'The last run: the first-person view closes to black (the arrest fade). Hands the picture to the drop.' }),

  // ================================ A3d the drop: 64 frames ================================
  st('A3d-01-cell-dark', 64, { area: 'hall', hour: 23, released: false, advance: 240, player: [0, 0, 3, 0], lights: [{ type: 'spot', p: [0.55, 3.2, -3.0], target: [0.55, 0.4, -9.4], color: '#9fb4d0', intensity: 140, distance: 14, angle: 0.5, penumbra: 0.9, decay: 1.2, shadow: true }] }, [0.55, 1.35, -5.9], [0.55, 1.2, -9.4], 35, { p2: [0.55, 1.35, -6.4], fx: { ev: -0.6 }, notes: 'One held dark image: the cell, bars throwing shadow stripes on the wall. No text of its own; the CAUGHT card is added by the titles.' }),
];
