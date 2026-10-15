// Playtest bot: plays the whole slice through the real input layer (virtual keys + smooth look), in fixed simulation steps.
// Used (1) as the automated end-to-end test, and (2) to drive the recorded playtest video.
import * as THREE from 'three';
import { STEP } from '../game.js';
import { angleDiff, dampAngle, damp, clamp } from '../util.js';
import { SLOT } from '../systems/routine.js';

const KEYS = ['sprint', 'crouch', 'interact', 'advance', 'journal', 'map', 'pause', 'wait', 'c1', 'c2', 'c3', 'c4', 'inventory', 'skip'];

export class Bot {
  constructor(game, { route = 'shim', annotate = false, hurry = false, seed = 1 } = {}) {
    this.g = game; this.route = route; this.annotate = annotate; this.hurry = hurry;
    this.results = []; this.log = []; this.v = { move: [0, 0] };
    for (const k of KEYS) this.v[k] = false;
    game.input.virtual = this.v;
    this.pulses = new Set();
    this.gen = this.script();
    this.finished = false; this.steps = 0; this.stuckCount = 0;
    this.targetYaw = null; this.targetPitch = 0; this.lookRate = 5;
    this.speedLog = [{ step: 0, speed: 1 }];      // capture time-map: playback speed of the recorded video from this sim step on
  }

  // ------------------------------------------------------------------ stepping
  tick() {
    const g = this.g;
    for (const k of this.pulses) this.v[k] = false;
    this.pulses.clear();
    // smooth camera control (applies while the player has control or during dialogue framing)
    if (g.mode === 'play' && this.targetYaw !== null) {
      const pl = g.player;
      pl.yaw = dampAngle(pl.yaw, this.targetYaw, this.lookRate, STEP);
      pl.pitch = damp(pl.pitch, this.targetPitch, this.lookRate, STEP);
    }
    if (!this.finished) { const r = this.gen.next(); if (r.done) this.finished = true; }
    this.steps++;
  }
  advance(n = 1) { for (let i = 0; i < n && !this.finished; i++) { this.tick(); this.g.step(STEP); } }
  pulse(k) { this.v[k] = true; this.pulses.add(k); }

  // ------------------------------------------------------------------ reporting
  check(name, ok, detail = '') {
    this.results.push({ name, ok: !!ok, detail, t: +this.g.simTime.toFixed(1), hour: this.g.routine.clock });
    this.log.push({ t: this.g.simTime, msg: (ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : '') });
    if (this.annotate) this.g.ui.feed(name + (detail ? ' — ' + detail : ''), !!ok);
    if (typeof console !== 'undefined') console.log('[NH]', ok ? 'PASS' : 'FAIL', name, detail, '@', this.g.simTime.toFixed(1) + 's');
    return ok;
  }
  say(msg) { this.log.push({ t: this.g.simTime, msg }); }
  note(title, text) { if (this.annotate) this.g.ui.caption(title, text); this.log.push({ t: this.g.simTime, msg: `${title}: ${text}`, caption: true }); }
  noteOff() { if (this.annotate) this.g.ui.caption(null); }
  /** Playback speed of the recorded video from now on (time-lapse for walking/waiting). No effect on the simulation. */
  speed(v) { const last = this.speedLog[this.speedLog.length - 1]; if (last.speed === v) return; if (last.step === this.steps) last.speed = v; else this.speedLog.push({ step: this.steps, speed: v }); }

  // ------------------------------------------------------------------ primitives (generators)
  *wait(sec) { const n = Math.round(sec / STEP); for (let i = 0; i < n; i++) yield; }
  *until(cond, timeout = 60, label = '') {
    const n = Math.round(timeout / STEP);
    for (let i = 0; i < n; i++) { if (cond()) return true; yield; }
    this.check('timeout: ' + label, false, `after ${timeout}s`);
    return false;
  }
  *control() { while (this.g.mode !== 'play') { this.v.move = [0, 0]; yield; } }
  lookAtPoint(x, y, z, rate = 5) {
    const pl = this.g.player, e = pl.eyePos;
    this.targetYaw = Math.atan2(-(x - e.x), -(z - e.z));
    this.targetPitch = clamp(Math.atan2(y - e.y, Math.hypot(x - e.x, z - e.z)), -1.2, 1.2);
    this.lookRate = rate;
  }
  *face(x, y, z, { time = 1.0, tol = 0.07 } = {}) {
    this.lookAtPoint(x, y, z, 6);
    const n = Math.round(time / STEP);
    for (let i = 0; i < n; i++) { yield; if (Math.abs(angleDiff(this.g.player.yaw, this.targetYaw)) < tol && i > 10) break; }
  }
  *walk(goal, { radius = 0.55, run = false, crouch = false, timeout = 90, label = '', look = null, quiet = false } = {}) {
    const g = this.g, pl = g.player;
    const n = Math.round(timeout / STEP);
    let path = null, idx = 0, lastCheck = { x: pl.pos.x, z: pl.pos.z, i: 0 }, repath = 0;
    const dest = () => (typeof goal === 'function' ? goal() : goal);
    const dpos = (d) => { const r = typeof d === 'string' ? g.world.waypoints.get(d) : d; if (!r) throw new Error('bot.walk: unknown goal ' + JSON.stringify(d) + ' label=' + label); return r; };
    for (let i = 0; i < n; i++) {
      if (g.mode !== 'play') { this.v.move = [0, 0]; this.v.sprint = false; yield; continue; }
      const d = dest(), dp = dpos(d);
      const dist = Math.hypot(dp.x - pl.pos.x, dp.z - pl.pos.z);
      if (dist < radius && Math.abs((dp.y ?? pl.pos.y) - pl.pos.y) < 2.5) { this.v.move = [0, 0]; this.v.sprint = false; this.v.crouch = crouch; return true; }
      repath--;
      if (!path || !path.length || repath <= 0) { path = g.nav.path(pl.pos.x, pl.pos.z, pl.pos.y, d); idx = 0; repath = typeof goal === 'function' ? 20 : 240; if (!path.length) { this.v.move = [0, 0]; repath = 20; yield; continue; } }
      let tgt = path[Math.min(idx, path.length - 1)];
      while (idx < path.length - 1 && Math.hypot(tgt.x - pl.pos.x, tgt.z - pl.pos.z) < 0.5) tgt = path[++idx];
      this.targetYaw = Math.atan2(-(tgt.x - pl.pos.x), -(tgt.z - pl.pos.z)); this.lookRate = 7;
      this.targetPitch = look !== null ? look : 0.02;
      const align = Math.abs(angleDiff(pl.yaw, this.targetYaw));
      this.v.move = [0, align < 0.5 ? 1 : 0];
      this.v.sprint = run && align < 0.3 && pl.stamina > 8; this.v.crouch = crouch;
      // stuck detection (ignore waits for locked doors)
      if (i % 90 === 89) {
        const moved = Math.hypot(pl.pos.x - lastCheck.x, pl.pos.z - lastCheck.z);
        if (moved < 0.15 && align < 0.5) {
          let lockedNear = false;
          for (const dr of g.world.doors.values()) if (dr.locked && dr.pos.distanceTo(pl.eyePos) < 4.5) lockedNear = true;
          if (!lockedNear && g.mode === 'play') { this.stuckCount++; this.say('stuck near ' + pl.pos.x.toFixed(1) + ',' + pl.pos.z.toFixed(1)); repath = 0; if (this.stuckCount % 3 === 0 && idx < path.length - 1) idx++; }
        }
        lastCheck = { x: pl.pos.x, z: pl.pos.z, i };
      }
      yield;
    }
    this.v.move = [0, 0]; this.v.sprint = false;
    if (!quiet) this.check('walk timeout ' + label, false, JSON.stringify(typeof goal === 'string' ? goal : goal));
    return false;
  }
  stand() { this.v.move = [0, 0]; this.v.sprint = false; this.v.crouch = false; }

  /** Stand at `at`, look at the interactable, then press/hold E until `done()` or the object stops being usable. */
  *use(it, { at, done = null, radiusOK = 0.6, look = null, timeout = 25, holdPad = 0.3 } = {}) {
    const g = this.g, st = g.story;
    if (at) yield* this.walk(at, { radius: radiusOK });
    this.v.move = [0, 0]; this.v.sprint = false;
    yield* this.control();
    const target = () => (it.npc ? new THREE.Vector3(it.npc.pos.x, it.npc.pos.y + 1.4, it.npc.pos.z) : (look || it.pos));
    for (let i = 0; i < Math.round(timeout / STEP); i++) {
      yield* this.control();
      const tp = target();
      this.lookAtPoint(tp.x, tp.y, tp.z, 6);
      if (st.focus === it) break;
      yield;
    }
    if (st.focus !== it) { this.check('could not focus ' + (it.label ? it.label() : '?'), false); return false; }
    yield* this.wait(0.25);
    if (it.hold > 0) {
      this.v.interact = true;
      const n = Math.round((it.hold + holdPad + 1.2) / STEP);
      for (let i = 0; i < n; i++) { const tp = target(); this.lookAtPoint(tp.x, tp.y, tp.z, 6); if (g.mode !== 'play' || (done ? done() : st.focus !== it)) break; yield; }
      this.v.interact = false;
      yield;
    } else { this.pulse('interact'); yield; }
    return true;
  }

  *dialogue(choices = []) {
    const g = this.g, st = g.story;
    let ci = 0, guard = 0;
    while (g.mode === 'dialogue' && guard++ < 200000) {
      const d = st.dialogue; if (!d) { yield; continue; }
      if (d.h && !d.h.done) { yield; continue; }
      if (d.choices) {
        const want = choices[ci];
        let idx = d.choices.findIndex((c) => !c.disabled && want && c.text.toLowerCase().includes(String(want).toLowerCase()));
        if (idx < 0) idx = d.choices.findIndex((c) => !c.disabled);
        yield* this.wait(0.9);
        if (idx >= 0) { this.pulse('c' + (idx + 1)); ci++; this.say(`chose: ${d.choices[idx].text}`); }
        yield; continue;
      }
      yield* this.wait(this.hurry ? 0.25 : 0.55 + (d.node.text.length * 0.011));
      if (g.mode === 'dialogue' && st.dialogue === d) this.pulse('advance');
      yield; yield;
    }
  }
  *talk(npcId, choices = [], { at = null } = {}) {
    const g = this.g, n = g.story.npcMap[npcId];
    yield* this.use(n.interactable, { at });
    yield* this.wait(0.2);
    if (g.mode === 'dialogue') yield* this.dialogue(choices);
    else this.say('dialogue did not start with ' + npcId);
  }
  /** Hold the wait key (time acceleration) until cond. */
  *fastForward(cond, timeout = 400, label = '') {
    this.stand();
    const n = Math.round(timeout / STEP);
    for (let i = 0; i < n; i++) { if (cond()) { this.v.wait = false; return true; } this.v.wait = this.g.story.canWait() && !this.g.ui.shopOpen; yield; }
    this.v.wait = false; this.check('fast-forward timeout ' + label, false); return false;
  }

  // ------------------------------------------------------------------ the script
  *script() {
    const g = this.g, st = g.story, R = g.routine, inv = g.inventory, eco = g.economy, M = g.marks, W = g.world;
    const route = this.route;
    this.note('PLAYTEST', 'Automated playtest bot — real input layer, fixed 60 Hz simulation');

    // ===== 0. wake + count ========================================================================
    yield* this.until(() => g.mode === 'play', 120, 'intro cinematic');
    this.check('intro cinematic hands over control', g.mode === 'play' && st.flag('woke'));
    this.check('player starts in cell C-107', st.inOwnCell(g.player));
    this.note('ROUTINE SYSTEM', '11-slot prison clock drives PA, doors and guards. 06:00 — COUNT.');
    yield* this.wait(1.2);
    yield* this.walk({ x: 1.5, z: -6.55 }, { radius: 0.25, label: 'count marker' });
    this.stand(); this.targetYaw = 0; this.targetPitch = 0; this.lookRate = 5;
    yield* this.until(() => st.flag('countDone'), 50, 'count completes');
    this.check('count passed (stood at the bars)', st.flag('countDone') && !st.flag('countFailed'));
    this.noteOff();
    yield* this.until(() => st.cellsReleased, 15, 'cells released');
    yield* this.wait(0.3);
    this.check('cell doors released after count', st.cellsReleased && !g.world.doors.get('cell-N0-7').locked);
    this.check('inmates visible in the hall after count', g.npcs.some((n) => n.loop && !n.hiddenFromWorld));

    // ===== 1. tidy up: pick up smokes, drink, look around ============================================
    this.note('SURVIVAL + PICKUPS', 'Health · hunger · thirst · stamina. Cigarettes double as currency.');
    yield* this.use(st.pickups[0].it, { at: { x: 2.2, z: -7.0 }, radiusOK: 0.5 });
    yield* this.until(() => st.pickups[0].taken, 3, 'pickup');
    this.check('picked up cigarettes (inventory)', inv.has('cigs'));
    yield* this.walk('N7', { radius: 0.5 });
    // walk the length of the hall west→east past the day-room (shows inmates, light, stairs, catwalks)
    this.noteOff();
    this.speed(2); yield* this.walk('H.w2', { radius: 0.8 }); this.speed(1);
    // talk to a day-room inmate (flavour)
    const sit = g.npcs.find((n) => n.id === 'sit0');
    this.note('DIALOGUE', 'Branching dialogue with voice blips; choices cost DC or shift reputation.');
    yield* this.talk('sit0', [], { at: { x: -9.0, z: 0.7 } });
    this.noteOff();
    // drink at the east fountain on the way to the gate
    this.speed(2); yield* this.walk('H.e1', { radius: 1 }); this.speed(1);
    const thirstBefore = g.survival.thirst;
    yield* this.use(W.interactables.find((i) => i.label && i.label() === 'Drink water' && i.pos.distanceTo(g.ctx.fountainPos) < 0.1), { at: { x: 17.0, z: 3.5 }, radiusOK: 0.5 });
    yield* this.wait(0.3);
    yield* this.until(() => g.survival.thirst > thirstBefore + 20, 4, 'drink');
    this.check('drinking restores thirst', g.survival.thirst > thirstBefore + 20);
    // wait for CHOW with the time-skip key
    this.note('TIME FLOW', 'Hold T to fast-forward the routine clock while it is safe.');
    yield* this.walk({ x: 17.0, z: 0.0 }, { radius: 0.7 });
    this.check('sally gate is locked during count/lights-out period', W.doors.get('gate-sally-1').locked || R.slot !== SLOT.Count);
    yield* this.fastForward(() => R.slot !== SLOT.Count, 200, 'chow');
    this.check('PA/slot change to CHOW at 07:00', R.slot === SLOT.Chow);
    this.noteOff();

    // ===== 2. to the mess hall =====================================================================
    this.speed(2);
    yield* this.walk('E.g1', { radius: 0.8, label: 'sally gate 1' });
    yield* this.until(() => !W.doors.get('gate-sally-1').locked, 6, 'gate unlock');
    this.check('sally gates open during CHOW', !W.doors.get('gate-sally-1').locked);
    yield* this.walk('E.c1', { radius: 0.9, label: 'corridor' });
    this.note('GUARD AI', 'Guards patrol with vision cones. They only react to what you are not allowed to be doing.');
    yield* this.walk('E.cd', { radius: 0.9, label: 'canteen door' });
    yield* this.walk('C.in', { radius: 0.8, label: 'canteen' });
    this.speed(1);
    this.check('arrived in the mess hall', g.player.area && g.player.area.name === 'canteen');
    this.noteOff();
    this.note('CHOW + COMMISSARY', 'Free tray, hunger restores. The commissary sells with DC.');
    // tray
    yield* this.walk('C.s', { radius: 0.9 });
    yield* this.use(st.its.tray, { radiusOK: 1, done: () => g.mode === 'dialogue' || inv.has('tray') });
    if (g.mode === 'dialogue') yield* this.dialogue();
    this.check('got a chow tray from Tuck', inv.has('tray'));
    // eat at the table next to Cutter's
    const tbl = g.world.interactables.filter((i) => i.label && i.label() === 'Eat your chow').sort((a, b) => a.pos.distanceTo(new THREE.Vector3(33, 0.85, -6.7)) - b.pos.distanceTo(new THREE.Vector3(33, 0.85, -6.7)))[0];
    const hungerBefore = g.survival.hunger;
    yield* this.walk({ x: 33.0, z: -5.3 }, { radius: 0.5 });
    yield* this.use(tbl, { done: () => !inv.has('tray'), holdPad: 0.8 });
    yield* this.until(() => st.flag('ate'), 5, 'ate');
    this.check('ate chow — hunger restored', st.flag('ate') && g.survival.hunger > hungerBefore + 25);
    this.noteOff();
    // shop demo
    this.note('ECONOMY', 'DC scrip: earn from work, spend at the commissary, trade, bribe.');
    yield* this.walk('C.com', { radius: 0.8 });
    yield* this.use(st.its.commissary, { radiusOK: 1.0 });
    yield* this.wait(1.5);
    this.check('commissary UI opens', g.ui.shopOpen);
    yield* this.wait(1.0);
    this.pulse('interact'); yield; yield;
    this.noteOff();

    // ===== 3. Cutter =============================================================================
    this.note('REPUTATION + DIALOGUE', 'Choices change Street Cred, Fear and faction standing.');
    const cutter = st.npcMap.cutter;
    yield* this.walk('C.cut', { radius: 0.8 });
    const fearBefore = g.reputation.fear;
    const cutterChoices = route === 'keycard' ? ['Skip the small talk', 'kitchen job', 'I\'ll talk to Pruitt'] : route === 'shim' ? ['Skip the small talk', 'kitchen job', 'Buy a shim'] : ['Skip the small talk', 'kitchen job', 'I\'ll talk to Pruitt'];
    yield* this.talk('cutter', cutterChoices);
    this.check('Cutter explained the ledger lead', st.flag('metCutter') || route !== 'none');
    this.check('reputation changed by dialogue choice (fear +2)', g.reputation.fear >= fearBefore + 2 - 0.01);
    this.noteOff();
    if (route === 'shim') this.check('bought the shim (−25 DC)', inv.has('shim') && eco.balance === 25, `balance ${eco.balance}`);

    // ===== 4. mop job ============================================================================
    this.note('WORK DETAIL', 'Kitchen mop job: four spills, 30 DC and Guard standing.');
    yield* this.until(() => st.flag('jobOffered'), 2, 'job offered');
    this.check('mop job offered', st.flag('jobOffered'));
    const dcBeforeJob = eco.balance;
    yield* this.walk('C.mop', { radius: 0.6 });
    yield* this.use(st.its.bucket, { radiusOK: 1.0, done: () => st.hasMop });
    this.check('took the mop', st.hasMop);
    this.speed(2);
    const stainIts = () => W.interactables.filter((i) => i.label && i.label() === 'Mop the spill');
    for (let k = 0; k < 4; k++) {
      const s = st.stainMeshes.filter((x) => !x.clean).sort((a, b) => a.pos.distanceTo(g.player.pos) - b.pos.distanceTo(g.player.pos))[0];
      if (!s) break;
      const it = stainIts().find((i) => Math.hypot(i.pos.x - s.pos.x, i.pos.z - s.pos.z) < 0.05);
      yield* this.walk({ x: s.pos.x, z: s.pos.z + 1.2 }, { radius: 0.4, label: 'stain ' + k });
      yield* this.use(it, { done: () => s.clean, holdPad: 0.8, look: new THREE.Vector3(s.pos.x, 0.25, s.pos.z) });
      yield* this.until(() => s.clean, 3, 'stain ' + k);
    }
    this.speed(1);
    yield* this.wait(0.5);
    this.check('mop job complete (+30 DC)', st.flag('jobDone') && eco.balance >= dcBeforeJob + 30, `balance ${eco.balance}`);
    this.noteOff();

    // ===== 5. Records access =====================================================================
    if (route === 'keycard') {
      yield* this.walk('C.cut', { radius: 0.8 });
      yield* this.talk('cutter', ['keycard']);
      this.check('bought the keycard (−60 DC)', inv.has('keycard'));
    }
    this.note('STEALTH', 'Three ways into Records — keycard, shim, or a bribe. Cameras and guards watch.');
    this.speed(2);
    yield* this.walk('E.cd', { radius: 0.9 });
    yield* this.walk('E.id', { radius: 0.9, label: 'intake arch' });
    yield* this.walk('I.a', { radius: 0.8, label: 'intake desk' });
    this.speed(1);
    this.check('walked into Intake lobby unchallenged (not restricted)', g.alert.level === 0 && g.player.area.name === 'intake');
    const pr = st.npcMap.pruitt;
    if (route === 'bribe') {
      const dcB = eco.balance; const gs = g.reputation.standing.Guards;
      yield* this.talk('pruitt', ['Records keeps good books', 'Pay Pruitt'], { at: null });
      this.check('bribed Pruitt (−40 DC, Guards standing up)', eco.balance === dcB - 40 && g.reputation.standing.Guards > gs && st.recordsUnlocked(), `balance ${eco.balance}`);
      this.check('Pruitt looks away (distracted)', pr.mode === 'distracted');
    }
    yield* this.walk('I.r', { radius: 0.7 });
    if (route === 'keycard') {
      yield* this.use(st.its.reader, { radiusOK: 1 });
      yield* this.until(() => st.recordsUnlocked(), 3, 'reader');
      this.check('keycard opened the Records door', st.recordsUnlocked());
    } else if (route === 'shim') {
      // wait until Pruitt is facing away from the reader for the next ~6 s, then work the lock
      yield* this.walk({ x: 43.2, z: 4.9 }, { radius: 0.3 });
      yield* this.face(g.ctx.recordsDoor.readerPos.x, 1.3, g.ctx.recordsDoor.readerPos.z, { time: 1.2 });
      const awayFor = (s) => { for (let t = 0; t <= s; t += 0.25) { const y = Math.sin((g.time + t) * 0.42) * 0.95; if (y < -0.28) return false; } return true; };
      this.note('STEALTH', 'Pruitt sweeps his gaze. Wait for him to look away, then work the reader.');
      yield* this.until(() => awayFor(6.6) && pr.detect < 0.05, 40, 'pruitt looks away');
      yield* this.use(st.its.shim, { radiusOK: 2, done: () => st.recordsUnlocked(), holdPad: 1.2 });
      yield* this.until(() => st.recordsUnlocked(), 3, 'shim');
      this.check('shim defeated the reader without raising the alert', st.recordsUnlocked() && g.alert.level === 0);
    }
    this.noteOff();
    // into Records, timed against the sweeping camera
    const cam = st.cam;
    const exposure = (pts, speed, hold = 0) => {
      let t = 0, exp = 0;
      for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; const L = Math.hypot(b.x - a.x, b.z - a.z); for (let s = 0; s < L; s += 0.3) { const u = s / L; if (cam.covers(a.x + (b.x - a.x) * u, a.z + (b.z - a.z) * u, t + s / speed + 0.1)) exp += 0.3 / speed; } t += L / speed; }
      const last = pts[pts.length - 1];
      for (let h = 0; h < hold; h += 0.25) if (cam.covers(last.x, last.z, t + h + 0.1)) exp += 0.25;
      return exp;
    };
    this.note('SECURITY CAMERA', 'The ceiling camera sweeps Records. Crouch, time the sweep, copy the page.');
    const P = (n) => g.world.waypoints.get(n);
    const inPath = [{ x: 44.7, z: 6.0 }, P('R.in'), P('R.a'), P('R.l')];
    yield* this.walk('I.r2', { radius: 0.4 });
    yield* this.until(() => !W.doors.get('door-records').locked, 3, 'door unlock');
    this.v.crouch = true;
    yield* this.until(() => exposure(inPath, 1.3, 3.1) < 1.0 && pr.detect < 0.1, 60, 'camera window to enter');
    yield* this.walk('R.in', { radius: 0.4, crouch: true });
    yield* this.walk('R.a', { radius: 0.4, crouch: true });
    yield* this.walk('R.l', { radius: 0.35, crouch: true });
    this.check('inside Records (restricted area) without tripping the alarm', g.player.area.name === 'records' && g.alert.level === 0, `alert ${g.alert.level}`);
    yield* this.until(() => cam.detect < 0.15 && exposure([{ x: g.player.pos.x, z: g.player.pos.z }, { x: g.player.pos.x, z: g.player.pos.z }], 1, 3.2) < 0.6, 60, 'camera away');
    yield* this.use(st.its.ledger, { radiusOK: 1, done: () => inv.has('ledger'), holdPad: 1.0, look: M.ledger });
    yield* this.until(() => inv.has('ledger'), 3, 'ledger');
    this.check('copied the ledger page (item in inventory)', inv.has('ledger'));
    this.noteOff();
    const outPath = [P('R.l'), P('R.a'), P('R.in'), { x: 44.6, z: 6.0 }];
    yield* this.until(() => exposure(outPath, 1.3) < 1.0 && cam.detect < 0.3, 60, 'camera window to leave');
    yield* this.walk('R.a', { radius: 0.4, crouch: true });
    yield* this.walk('R.in', { radius: 0.4, crouch: true });
    yield* this.walk('I.r2', { radius: 0.5, crouch: true });
    this.v.crouch = false;
    yield* this.walk('I.r', { radius: 0.8 });
    this.check('left Records with no alarm raised', g.alert.level === 0 && g.player.area.name !== 'records' && g.stats.arrests === 0);
    yield* this.until(() => g.ui.docOpen, 6, 'ledger document');
    this.check('document popup shown after leaving Records', g.ui.docOpen);
    yield* this.wait(3.4);
    this.pulse('advance'); yield; yield;

    // ===== 6. the long wait to 13:00 ================================================================
    this.note('JOURNAL', 'Objective tracking, inventory, reputation tiers and the daily schedule.');
    this.pulse('journal'); yield; yield; yield* this.wait(1.2);
    this.check('journal opens', g.ui.panelOpen);
    g.ui.tabIdx = 2; g.ui.renderPanel(); yield* this.wait(1.4);
    this.pulse('journal'); yield; yield* this.wait(0.3); this.pulse('pause'); yield; yield; yield* this.wait(0.4);
    this.check('journal closes', !g.ui.panelOpen);
    this.noteOff();
    this.speed(3);
    yield* this.walk('E.cd', { radius: 1 });
    yield* this.walk('E.g2', { radius: 1 });
    yield* this.walk('H.e1', { radius: 1.2, run: true });
    this.check('can sprint (stamina drains)', g.player.stamina < 100);
    yield* this.walk('H.w1', { radius: 1.2 });
    yield* this.walk('W.g1', { radius: 1 });
    yield* this.walk('W.c4', { radius: 1, label: 'west corridor' });
    this.speed(1);
    this.note('TIME FLOW', 'The chapel only opens at 13:00 — fast-forward the clock.');
    yield* this.fastForward(() => R.chapelOpen(), 500, 'chapel open');
    this.check('chapel unlocks at 13:00 (routine policy)', R.chapelOpen() && !g.world.doors.get('door-chapel').locked);
    this.noteOff();

    // ===== 7. Harrington ===========================================================================
    yield* this.walk('P.in', { radius: 0.9, label: 'chapel door' });
    this.check('entered the chapel', g.player.area.name === 'chapel');
    this.note('THE CHAPEL', 'Stained glass, candles, pews. Harrington Marlowe — the keeper of the tunnel.');
    yield* this.walk('P.b', { radius: 0.9 });
    const hr = st.npcMap.harrington;
    yield* this.walk('P.pew', { radius: 0.8 });
    yield* this.talk('harrington', ['Page fourteen']);
    this.check('Harrington accepted the ledger page', st.flag('ledgerGiven') && !inv.has('ledger'));
    this.check('Street Cred / General Pop standing rose', g.reputation.standing.InmatesGeneral >= 14);
    this.noteOff();

    // ===== 8. font + tunnel ========================================================================
    yield* this.until(() => hr.pos.distanceTo(new THREE.Vector3(g.marks.font.x, 0, g.marks.font.z)) < 4.5 && !hr.moving, 40, 'Harrington at font');
    yield* this.walk('P.f', { radius: 0.5, label: 'font front' });
    this.note('THE BAPTISMAL', 'Hold E to lift the stone font and reveal the hidden stair.');
    yield* this.use(st.its.font, { radiusOK: 1, done: () => st.flag('fontLifted'), holdPad: 1.5, look: new THREE.Vector3(g.marks.font.x, 0.9, g.marks.font.z) });
    yield* this.until(() => st.flag('fontLifted'), 6, 'font');
    this.check('baptismal font lifted — tunnel revealed', st.flag('fontLifted'));
    yield* this.until(() => g.mode === 'play', 30, 'font cinematic');
    this.noteOff();
    this.note('THE TUNNEL', 'Follow Harrington and his lantern under the wire.');
    // follow the lantern
    const follow = function* (self, until, timeout = 240) {
      const n = Math.round(timeout / STEP);
      for (let i = 0; i < n; i++) {
        if (until()) return true;
        if (g.mode !== 'play') { self.v.move = [0, 0]; yield; continue; }
        const h = hr, pl = g.player;
        const dist = Math.hypot(h.pos.x - pl.pos.x, h.pos.z - pl.pos.z);
        if (dist > 2.6 || Math.abs(h.pos.y - pl.pos.y) > 1.8) { yield* self.walk(() => ({ x: h.pos.x, z: h.pos.z, y: h.pos.y }), { radius: 2.0, timeout: 4, crouch: false, quiet: true }); }
        else { self.v.move = [0, 0]; self.lookAtPoint(h.pos.x, h.pos.y + 1.3, h.pos.z, 3); yield; }
      }
      return false;
    };
    yield* follow(this, () => g.player.pos.y < -2.5, 120);
    this.check('descended into the tunnel', g.player.pos.y < -2.5 && g.player.area.tag === 'tunnel');
    yield* follow(this, () => g.mode === 'dialogue', 200);
    this.check('tunnel conversation triggered', g.mode === 'dialogue');
    yield* this.dialogue();
    this.check('tunnel rules scene complete', st.flag('tunnelRulesDone'));
    this.noteOff();
    this.speed(2);
    yield* follow(this, () => g.mode === 'dialogue' || (g.player.area && g.player.area.name === 'outside' && st.flag('endStarted')), 300);
    this.speed(1);
    this.check('emerged into the forest', true);
    this.note('THE CLEARING', 'Old oak, a crate, a blanket — four hours of being unowned.');
    yield* this.dialogue();
    yield* this.until(() => g.mode === 'end', 120, 'ending');
    this.check('ending cinematic and end screen reached', g.mode === 'end');
    this.noteOff();
    const failed = this.results.filter((r) => !r.ok);
    this.say(`DONE — ${this.results.length - failed.length}/${this.results.length} checks passed, ${this.stuckCount} stuck events`);
  }
}
