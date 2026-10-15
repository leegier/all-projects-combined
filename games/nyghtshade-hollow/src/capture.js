// Deterministic capture API (window.NH_CAP, only with ?capture). Used by tools/capture.mjs to record the playtest video:
//  - drives the bot + simulation in fixed steps and renders single frames on demand (no wall-clock anywhere),
//  - runs UI timers (setTimeout) and CSS animations/transitions on simulation time so a screenshot is a pure function of the step,
//  - renders the soundtrack offline (OfflineAudioContext scheduled against the simulation clock) and hands it out in chunks.
import { STEP } from './game.js';

export function installCapture(game, ui) {
  // ---- virtual timers ---------------------------------------------------------------------------------------------
  const timers = new Map(); let tid = 1, vnow = 0;
  window.setTimeout = (fn, ms = 0, ...a) => { const id = tid++; timers.set(id, { at: vnow + ms / 1000, fn: () => fn(...a) }); return id; };
  window.clearTimeout = (id) => { timers.delete(id); };
  const pump = () => { for (const [id, t] of [...timers]) if (t.at <= vnow + 1e-9) { timers.delete(id); try { t.fn(); } catch (e) { console.error(e); } } };
  // ---- CSS animations / transitions on virtual time ----------------------------------------------------------------
  const born = new WeakMap();
  const syncAnim = () => {
    for (const a of document.getAnimations()) {
      let t0 = born.get(a); if (t0 === undefined) { t0 = vnow; born.set(a, t0); }
      a.pause(); a.currentTime = Math.max(0, (vnow - t0) * 1000);
    }
  };
  let actx = null, abuf = null;
  const cap = {
    ready: true, recOn: true, speed: 1,
    steps: () => (game.bot ? game.bot.steps : 0),
    /** Start the game (optionally with the offline soundtrack attached from t=0). */
    begin({ audioSeconds = 0 } = {}) {
      if (audioSeconds > 0) {
        actx = new OfflineAudioContext(2, Math.ceil(audioSeconds * 44100), 44100);
        game.initAudio(actx, () => game.simTime, false);
      }
      ui.show('u-disc', false); game.toTitle(); game.newGame();
    },
    /** Advance bot + simulation by n fixed steps. */
    adv(n) {
      const b = game.bot;
      for (let i = 0; i < n; i++) {
        if (b && !b.finished) b.tick();
        game.step(STEP); vnow = game.simTime;
        if (timers.size) pump();
      }
    },
    /** Render the current state to the canvas and bring the DOM overlays to the matching animation time. */
    frame(dt = 1 / 30) {
      ui.setRec(cap.recOn && game.mode !== 'cine' && game.mode !== 'end' && !game.letter, game.simTime, cap.speed);
      game.render(1, dt);
      syncAnim();
    },
    /** advance + frame in one round trip */
    run(n, dt) { cap.adv(n); cap.frame(dt); },
    state() {
      const g = game, p = g.player;
      return { step: cap.steps(), t: +g.simTime.toFixed(3), x: +p.pos.x.toFixed(3), z: +p.pos.z.toFixed(3), yaw: +p.yaw.toFixed(3), clock: g.routine.clock, dc: g.economy.balance, mode: g.mode, finished: g.bot ? g.bot.finished : false, alert: g.alert.level };
    },
    plan() {
      const b = game.bot;
      return { speedLog: b.speedLog, results: b.results, log: b.log.map((l) => ({ t: l.t, msg: l.msg, caption: !!l.caption })), steps: b.steps, stuck: b.stuckCount, finished: b.finished, simTime: game.simTime, route: b.route };
    },
    // ---- cards (title / outro), animated on virtual time ------------------------------------------------------
    showCard(html) {
      const c = ui.el('u-card'); c.style.background = '#000'; ui.card(html, true); ui.hud(false); ui.setRec(false);
      ui.el('u-feed').innerHTML = ''; ui.caption(null); game.mode = 'title';
      cap._cardT0 = null;
    },
    cardFrame(t) { vnow = t; if (timers.size) pump(); syncAnim(); },
    hideCard() { const c = ui.el('u-card'); c.style.background = ''; ui.card('', false); },
    // ---- offline soundtrack -----------------------------------------------------------------------------------------
    async renderAudio() { abuf = await actx.startRendering(); return { length: abuf.length, sampleRate: abuf.sampleRate, channels: abuf.numberOfChannels }; },
    audioChunk(i0, n) {
      const len = Math.min(n, abuf.length - i0), L = abuf.getChannelData(0), R = abuf.numberOfChannels > 1 ? abuf.getChannelData(1) : L;
      const out = new Int16Array(len * 2), cl = (v) => (v > 1 ? 32767 : v < -1 ? -32768 : Math.round(v * 32767));
      for (let i = 0; i < len; i++) { out[2 * i] = cl(L[i0 + i]); out[2 * i + 1] = cl(R[i0 + i]); }
      const u8 = new Uint8Array(out.buffer); let bin = ''; const CH = 0x8000;
      for (let i = 0; i < u8.length; i += CH) bin += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
      return btoa(bin);
    },
  };
  window.NH_CAP = cap;
  return cap;
}
