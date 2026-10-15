// Cinematic definitions: intro (exterior → hall → waking in the cell), the baptismal-font reveal, the arrest, the ending.
import * as THREE from 'three';
import { clamp, lerp, smoothstep } from '../util.js';
import { OAK, terrainHeight } from '../world/levels/outside.js';

export function makeIntro(g) {
  const T = (t0, t1, from, to, extra = {}) => ({ t0, t1, from, to, ...extra });
  const cardHtml = '<h1>NYGHT<span>SHADE</span> HOLLOW</h1><h2>The Intake</h2>';
  return {
    dur: 34, letter: true, skippable: true, showArms: false,
    shots: [
      T(0, 8.5, { p: [-126, 25, -66], l: [-70, 7, -12], fov: 50 }, { p: [-103, 17.5, -46], l: [-70, 8.5, -13], fov: 42 }, { area: 'outside', outside: true, env: 'outsideNight' }),
      T(8.5, 17.5, { p: [-15.5, 1.72, 0.6], l: [-1, 2.0, -3.5], fov: 68 }, { p: [-5.5, 1.66, -1.4], l: [3.0, 1.7, -5.8], fov: 60 }, { area: 'hall', outside: false, env: 'hall' }),
      T(17.5, 24.2, { p: [0.52, 0.93, -9.42], l: [0.62, 1.7, -7.2], fov: 72 }, { p: [0.55, 0.96, -9.36], l: [0.9, 1.2, -6.2], fov: 68 }),
      T(24.2, 34, { p: [0.55, 0.96, -9.36], l: [0.9, 1.2, -6.2], fov: 68 }, { p: [0.95, 1.84, -8.0], l: [1.5, 1.7, -4.0], fov: 72 }),
    ],
    onStart(g) {
      g.eyelid = 1; g.blur = 1; g.camInOutside = true;
      g.outsideMode = 'night'; g.player.lying = 0;
      g.audio && g.audio.musicTo('calm');
      g.fadeSpeed = 0.9; g.fadeTarget = 0;
      g.ui.hud(false); g.ui.setPrompt(null);
      g.world.areas.get('hall').group.visible = true;
    },
    events: [
      { at: 0.6, fn: (g) => g.ui.card(cardHtml, true) },
      { at: 7.4, fn: (g) => { g.ui.card(null, false); g.fadeSpeed = 0.5; g.fadeTarget = 1; } },
      { at: 8.5, fn: (g) => { g.fadeSpeed = 0.9; g.fadeTarget = 0; g.audio && g.audio.musicTo('calm'); } },
      { at: 12.0, fn: (g) => g.ui.note('C-BLOCK', 'Nyghtshade Hollow Correctional · 04:58', 4200) },
      { at: 17.4, fn: (g) => { g.fadeSpeed = 0.4; g.fadeTarget = 0; } },
      { at: 19.3, fn: (g) => g.ui.say('Maddox', BARK1, { inner: true, cont: false, cps: 34 }) },
      { at: 23.4, fn: (g) => g.ui.clearSay() },
      { at: 22.0, fn: (g) => { g.ui.pa('COUNT TIME. ALL INMATES TO YOUR CELLS. STAND FOR COUNT.'); g.audio && g.audio.pa('COUNT TIME. ALL INMATES TO YOUR CELLS. STAND FOR COUNT.'); } },
      { at: 25.0, fn: (g) => g.ui.say('Maddox', BARK2, { inner: true, cont: false, cps: 34 }) },
      { at: 29.6, fn: (g) => g.ui.clearSay() },
    ],
    tick(g, t) {
      // eyelids: closed → slow blink → open; blur clears as they focus
      if (t < 17.5) { g.eyelid = 0; g.blur = 0; return; }
      const k = t - 17.5;
      let e = 1;
      if (k < 1.2) e = 1; else if (k < 2.4) e = 1 - smoothstep(1.2, 2.4, k) * 0.7; else if (k < 3.0) e = 0.3 + smoothstep(2.4, 3.0, k) * 0.7; else if (k < 4.4) e = 1 - smoothstep(3.0, 4.4, k); else e = 0;
      g.eyelid = e; g.blur = 1.3 * (1 - smoothstep(1.5, 6.5, k));
    },
    onEnd(g) {
      g.eyelid = 0; g.blur = 0; g.camInOutside = false;
      g.player.teleport(0.95, 0, -8.0, Math.PI); g.player.pitch = -0.05;
      g.mode = 'play'; g.ui.hud(true); g.ui.clearSay(); g.player.frozen = false; g.letter = 0;
      g.routine.hour = 5.972; g.routine._evaluate(true);
      g.story.setFlag('woke');
      g.input.lock();
      g.ui.note('CONTROLS', 'WASD move · Shift run · C crouch · E interact · Tab journal · T hold to wait', 9000);
      g.ui.toast('Objective: stand at your cell door for COUNT');
    },
  };
}
const BARK1 = 'Same ceiling. Same crack in it. Four thousand and some mornings.';
const BARK2 = 'Nine years. They count us twice a day, like we might have gone somewhere.';

export function makeFontCine(g) {
  const font = g.marks.font;
  return {
    dur: 8.5, letter: true, showArms: true,
    shots: [
      { t0: 0, t1: 4.2, from: (g) => ({ p: [g.player.eyePos.x, g.player.eyePos.y, g.player.eyePos.z], l: [font.x, 0.8, font.z - 0.2], fov: 62 }), to: (g) => ({ p: [font.x + 1.0, 1.1, font.z + 3.4], l: [font.x, 0.5, font.z - 1.0], fov: 52 }), area: 'chapel' },
      { t0: 4.2, t1: 8.5, from: (g) => ({ p: [font.x + 1.0, 1.1, font.z + 3.4], l: [font.x, 0.5, font.z - 1.0], fov: 52 }), to: { p: [font.x + 0.2, 1.6, font.z + 1.8], l: [font.x, -1.6, font.z - 0.6], fov: 58 } },
    ],
    onStart(g) { g.audio && g.audio.sfx('lift'); this._p0 = g.ctx.fontGroup.position.x; g.ui.setPrompt(null); },
    events: [
      { at: 0.5, fn: (g) => g.ui.say('Harrington', 'Easy. Slow — stone remembers being hurried.', { cont: false, cps: 40, onChar: () => g.audio && g.audio.voice(118, 0.8) }) },
      { at: 3.6, fn: (g) => { g.ui.clearSay(); g.audio && g.audio.sfx('thud', { vol: 1.2 }); g.camShake = 0.6; } },
      { at: 4.6, fn: (g) => g.ui.say('Harrington', 'Thirty-one years since a man went down those steps. Mind your head, son.', { cont: false, cps: 40, onChar: () => g.audio && g.audio.voice(118, 0.8) }) },
      { at: 7.8, fn: (g) => g.ui.clearSay() },
    ],
    tick(g, t) {
      const e = smoothstep(0, 3.6, t);
      g.ctx.fontGroup.position.x = 2.6 * e;
      g.ctx.fontCollider.enabled = e < 0.55;
    },
    onEnd(g) {
      g.mode = 'play'; g.player.frozen = false; g.letter = 0; g.ui.clearSay();
      g.ctx.fontGroup.position.x = 2.6; g.ctx.fontCollider.enabled = false;
      g.story.startLead();
      g.ui.toast('The tunnel is open — follow Harrington', 'good');
      g.input.lock();
    },
  };
}

export function makeArrestCine(g, guard, fainted) {
  const here = () => ({ p: [g.player.eyePos.x, g.player.eyePos.y, g.player.eyePos.z], l: [g.player.eyePos.x - Math.sin(g.player.yaw) * 3, g.player.eyePos.y - 0.2, g.player.eyePos.z - Math.cos(g.player.yaw) * 3], fov: 70 });
  return {
    dur: 6.4, letter: false, showArms: false,
    shots: [{ t0: 0, t1: 6.4, from: here, to: here, ease: false }],
    onStart(g) { g.fadeSpeed = 0.35; g.fadeTarget = 1; g.audio && g.audio.sfx('thud', { vol: 1.0 }); g.audio && g.audio.sfx('keys', { vol: 1.0 }); g.ui.setPrompt(null); g.ui.clearSay(); g.ui.setChoices([]); },
    events: [
      { at: 0.7, fn: (g) => g.ui.card(`<h1 style="font-size:6.4vmin">${fainted ? 'BLACKED OUT' : 'CAUGHT'}</h1><h2>${fainted ? 'Medical fee' : 'One hour in the cell · fine'}</h2>`, true) },
      { at: 1.4, fn: (g) => { g.story.applyArrest(fainted); } },
      { at: 3.4, fn: (g) => { g.ui.card(null, false); g.fadeSpeed = 0.7; g.fadeTarget = 0; } },
    ],
    onEnd(g) { g.mode = 'play'; g.player.frozen = false; g.letter = 0; g.input.lock(); g.ui.toast(fainted ? 'You come to in the infirmary — then your cell.' : 'Back in the cell. The clock kept moving.', 'bad'); },
  };
}

export function makeEnding(g) {
  const hy = (x, z, dy = 0) => terrainHeight(x, z) + dy;
  const hx = [-103.6, -32.2], mx = [-102.1, -32.6];
  return {
    dur: 40, letter: true, showArms: false, skippable: false,
    shots: [
      // 1: eye level from the path side, slow push-in on the two men under the oak
      { t0: 0, t1: 11, from: { p: [-98.4, hy(-98.4, -28.4, 1.5), -28.4], l: [-103.0, hy(-103, -32.4, 0.95), -32.4], fov: 40 }, to: { p: [-99.7, hy(-99.7, -29.7, 1.3), -29.7], l: [-103.0, hy(-103, -32.4, 0.95), -32.4], fov: 34 } },
      // 2: from the sunlit side, low, drifting left; the glare of the low sun sits behind the oak
      { t0: 11, t1: 24, from: { p: [-97.0, hy(-97, -39, 3.0), -39.0], l: [-103.0, hy(-103, -32.6, 0.9), -32.6], fov: 38 }, to: { p: [-95.4, hy(-95.4, -37.6, 2.3), -37.6], l: [-103.2, hy(-103, -32.6, 1.25), -32.6], fov: 33 } },
      // 3: from behind them, rising and drawing back over the clearing toward the prison in the haze
      { t0: 24, t1: 40, from: { p: [-108.5, hy(-108.5, -30.5, 1.1), -30.5], l: [-102.8, hy(-103, -32.4, 1.05), -32.4], fov: 40 }, to: { p: [-113.5, hy(-113.5, -27.0, 5.2), -27.0], l: [-97.5, hy(-98, -28.5, 2.6), -28.5], fov: 48 } },
    ],
    onStart(g) {
      g.audio && g.audio.musicTo('finale');
      const h = g.story.npcMap.harrington, m = g.story.npcMap.maddox;
      h.stop(); h.teleport(hx[0], hx[1], hy(hx[0], hx[1])); h.setPose('ground'); h.facePoint(-92, -20); h.yaw = h.targetYaw; h.lookTarget = new THREE.Vector3(-92, 2.5, -20);
      m.hiddenFromWorld = false; m.teleport(mx[0], mx[1], hy(mx[0], mx[1])); m.setPose('ground'); m.yaw = h.yaw; m.targetYaw = h.yaw; m.lookTarget = new THREE.Vector3(-92, 2.5, -20);
      g.player.frozen = true; g.player.pos.set(-98, hy(-98, -29), -29);
      g.ui.hud(false); g.ui.clearSay(); g.ui.setPrompt(null); g.ui.setChoices([]);
      g.fadeSpeed = 1.2; g.fadeTarget = 0;
      g.carOK = true;
    },
    events: [
      { at: 2.0, fn: (g) => g.audio && [392, 493.9, 587.3].forEach((f, i) => g.audio.piano(g.audio.now() + i * 0.9, f, 0.07)) },
      { at: 8.5, fn: (g) => g.audio && g.audio.sfx('car') },
      { at: 9.0, fn: (g) => g.audio && [587.3, 740, 880, 659.3].forEach((f, i) => g.audio.piano(g.audio.now() + i * 1.1, f, 0.06)) },
      { at: 12.0, fn: (g) => g.ui.say('Maddox', 'Hear that? Nobody counting.', { inner: true, cont: false, cps: 30 }) },
      { at: 16.0, fn: (g) => g.ui.clearSay() },
      { at: 17.0, fn: (g) => g.audio && [440, 554.4, 659.3, 880, 740].forEach((f, i) => g.audio.piano(g.audio.now() + i * 1.2, f, 0.06)) },
      { at: 24.0, fn: (g) => g.ui.card('<h1>FOUR <span>HOURS</span></h1><h2>Keep your word. Come back. Every time.</h2>', true) },
      { at: 33.5, fn: (g) => { g.ui.card(null, false); g.fadeSpeed = 0.5; g.fadeTarget = 1; } },
    ],
    tick(g, t) { g.camInOutside = true; },
    onEnd(g) { g.story.finishDemo(); },
  };
}
