// Story: NPC cast, interactions, quests (The Ledger → The Font → The Four Hours), dialogue runner, count sequence, mop job,
// Records access (keycard / shim / bribe), arrest & alarm consequences, save/load.
import * as THREE from 'three';
import { NPC } from '../ai/npc.js';
import { Guard, SecurityCam } from '../ai/guard.js';
import { DIALOGUE, VOICE, BARKS } from './dialogue.js';
import { makeIntro, makeFontCine, makeEnding, makeArrestCine } from './cinematics.js';
import { MAT } from '../proc/materials.js';
import { ITEMS } from '../systems/inventory.js';
import { SLOT } from '../systems/routine.js';
import { clamp, fmtClock, angleDiff } from '../util.js';
import { terrainHeight, OAK } from '../world/levels/outside.js';

const MARKER = new THREE.Vector3(1.5, 0, -6.45);   // count marker inside the player's cell
const CELL_BOX = { x0: 0.05, x1: 2.95, z0: -9.95, z1: -5.6 };

export class Story {
  constructor(game) {
    this.g = game; this.f = {}; this.timers = []; this.focus = null; this.holdT = 0; this.dialogue = null; this.dialogueCam = null;
    this.npcMap = {}; this.pickups = []; this.stainList = []; this.cleaned = 0; this.hasMop = false;
    this.recordsUntil = -1; this.cellsReleased = false; this.countHold = 0; this.countPhase = 'idle';
    this.leading = null; this.stats = {};
  }
  flag(k) { return !!this.f[k]; }
  setFlag(k, v = true) { this.f[k] = v; }
  later(sec, fn) { this.timers.push({ t: this.g.time + sec, fn }); }

  // ===========================================================================================
  // Setup
  // ===========================================================================================
  setup() {
    const g = this.g, w = g.world, m = g.marks;
    this.spawnNPCs();
    // security camera in Records
    const cam = new SecurityCam(g, { head: g.ctx.recCamHead, pos: m.camPos, baseYaw: 2.356, sweep: 0.95, range: 10.5, fov: 0.8 });
    g.cams = [cam]; this.cam = cam;
    // player's cell dressing: tally marks, shelf items
    const hall = w.areas.get('hall');
    const tally = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.95), MAT.dTally);
    tally.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(tally.geometry.attributes.position.count * 3).fill(1), 3));
    tally.position.set(0.125, 1.55, -8.6); tally.rotation.y = Math.PI / 2; hall.group.add(tally);
    // stain decals for the mop job
    this.stainMeshes = [];
    for (const p of m.stains) {
      const geo = new THREE.PlaneGeometry(1.5, 1.5); geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(4 * 3).fill(1), 3));
      const mesh = new THREE.Mesh(geo, MAT.dStain2.clone()); mesh.material.opacity = 0.95;
      mesh.rotation.x = -Math.PI / 2; mesh.position.copy(p); mesh.position.y = 0.025; mesh.visible = false; mesh.renderOrder = 3;
      w.areas.get('canteen').group.add(mesh); this.stainMeshes.push({ mesh, pos: p.clone(), clean: false });
    }
    this.makeInteractables();
  }

  spawnNPCs() {
    const g = this.g, m = g.marks;
    const add = (n) => { g.npcs.push(n); this.npcMap[n.id] = n; return n; };
    const nn = (name) => g.world.waypoints.get(name);
    const reyesRoute = [{ node: 'H.w2', wait: 3, look: 0 }, { node: 'H.bn', wait: 2.5, look: null }, { node: 'H.e2', wait: 3.5 }, { node: 'H.bs', wait: 2.5 }];
    const reyes = add(new Guard(g, { id: 'reyes', name: 'CO Reyes', look: 'guard', x: -16.5, z: -4.85, yaw: Math.PI / 2 * -1, route: reyesRoute, range: 15 }));
    reyes.frozenAI = true;    // scripted count run until released
    const dalton = add(new Guard(g, { id: 'dalton', name: 'CO Dalton', look: 'guardLight', x: 32, z: 0.4, yaw: -Math.PI / 2, route: [{ node: 'E.c1', wait: 2 }, { node: 'E.c2', wait: 1.5 }, { node: 'E.c3', wait: 2.5 }, { node: 'E.c4', wait: 3 }, { node: 'E.c3', wait: 1 }, { node: 'E.cd', wait: 2.5 }], range: 14, walkSpeed: 1.2 }));
    const pruitt = add(new Guard(g, { id: 'pruitt', name: 'CO Pruitt', look: 'guard', x: 36, z: 7.0, yaw: 0, station: { yaw: 0, node: 'I.p' }, range: 13, sweep: 1 }));
    pruitt.catchDist = 1.3;
    g.guards.push(reyes, dalton, pruitt);
    this.reyes = reyes; this.dalton = dalton; this.pruitt = pruitt;
    // stationed guards sweep their gaze
    const baseUpdate = pruitt.update.bind(pruitt);
    pruitt.update = (dt) => { if (pruitt.mode === 'station') pruitt.targetYaw = Math.sin(g.time * 0.42) * 0.95; baseUpdate(dt); };
    // inmates
    const tuck = add(new NPC(g, { id: 'tuck', name: 'Tuck', look: 'tuck', x: 29.8, z: -14.9, yaw: Math.PI, dialogue: 'tuck', pose: 'type' }));
    tuck.setPose('idle');
    const cutter = add(new NPC(g, { id: 'cutter', name: 'Cutter', look: 'cutter', x: 37.0, z: -6.06, yaw: Math.PI * 0.0, dialogue: 'cutter' }));
    cutter.setPose('sit', -0.0); cutter.facePoint(37.6, -6.8); cutter.faction = 'Independent';
    const harr = add(new NPC(g, { id: 'harrington', name: 'Harrington', look: 'harrington', x: -58.75, z: 4.2, yaw: Math.PI, dialogue: 'harrington', walkSpeed: 1.05 }));
    harr.setPose('sit'); harr.seatOffsetY = 0.0; harr.facePoint(-72, 4.2); harr.hiddenFromWorld = false;
    harr.root.position.y = 0;
    // praying inmates in chapel
    const p1 = add(new NPC(g, { id: 'pray1', name: 'Inmate', look: 'inmateB', x: -64.4, z: -4.2, yaw: Math.PI / 2, dialogue: 'inmate4' })); p1.setPose('pray'); p1.facePoint(-72, -4.2);
    const p2 = add(new NPC(g, { id: 'pray2', name: 'Inmate', look: 'inmateC', x: -60.4, z: 6.0, yaw: Math.PI / 2 })); p2.setPose('pray'); p2.facePoint(-72, 6.0);
    // librarian
    const lib = add(new NPC(g, { id: 'librarian', name: 'Inmate', look: 'inmateC', x: -36.2, z: -5.0, yaw: Math.PI })); lib.setPose('read');
    // cell sleepers (ground north row)
    const sleepers = [[2, 'inmateA'], [4, 'inmateB'], [9, 'inmateC'], [11, 'inmateA']];
    for (const [i, look] of sleepers) {
      const cx = -16.5 + (i - 1) * 3;
      const n = add(new NPC(g, { id: 'sleep' + i, name: 'Inmate', look, x: cx - 0.95, z: -7.95, yaw: Math.PI, seed: i * 11, dialogue: null }));
      n.setPose('lie'); n.seatOffsetY = 0.44; n.sleeper = true; n.cellIndex = i;
    }
    const mad = add(new NPC(g, { id: 'maddox', name: 'Maddox', look: 'maddox', x: 0, z: 0 })); mad.hiddenFromWorld = true;
    // hall table sitters (they exist all day; at count they stand by their cells)
    const hallSit = [[-9.6, 2.64, -9, 1.9, 'inmateB', 'inmate1'], [-8.4, 1.16, -9, 1.9, 'inmateA', null], [9.6, -2.64, 9, -1.9, 'inmateC', 'inmate2']];
    hallSit.forEach(([x, z, tx, tz, look, dlg], i) => { const n = add(new NPC(g, { id: 'sit' + i, name: 'Inmate', look, x, z, seed: 40 + i * 9, dialogue: dlg })); n.setPose('sit'); n.facePoint(tx, tz); n.hallSitter = true; });
    // canteen diners
    const diners = [[28.4 - 0.6, -6.06, 28.4, -6.8, 'inmateA'], [33.6, -7.54, 33, -6.8, 'inmateB'], [33.6, -9.86, 33, -10.6, 'inmateC'], [28.4 + 0.6, -11.34, 28.4, -10.6, 'inmateB'], [37.6 + 0.6, -9.86, 37.6, -10.6, 'inmateA']];
    diners.forEach(([x, z, tx, tz, look], i) => { const n = add(new NPC(g, { id: 'dine' + i, name: 'Inmate', look, x, z, seed: 70 + i * 5, dialogue: i === 1 ? 'inmate3' : null })); n.setPose('sit'); n.facePoint(tx, tz); n.dinerFor = true; n.hiddenFromWorld = true; });
    // hall walkers (appear after count)
    const walkers = [['wk1', 'inmateB', 'H.w1', ['H.e1', 'H.w1', 'H.bs', 'H.nw']], ['wk2', 'inmateC', 'H.e1', ['H.w2', 'H.se', 'H.e1']]];
    walkers.forEach(([id, look, start, loop], i) => { const nd = g.world.waypoints.get(start); const n = add(new NPC(g, { id, name: 'Inmate', look, x: nd.x, z: nd.z, seed: 90 + i * 13, walkSpeed: 1.0 + i * 0.2 })); n.loop = loop; n.loopI = 0; n.hiddenFromWorld = true; n.waitT = 0; });
    this.updateNpcPresence();
  }

  /** Who is visible/where depends on the routine slot. */
  updateNpcPresence() {
    const g = this.g, r = g.routine;
    const count = (r.slot === SLOT.Count || r.slot === SLOT.LightsOut) && !this.cellsReleased;
    const chow = r.slot === SLOT.Chow;
    for (const n of g.npcs) {
      if (n.dinerFor) n.hiddenFromWorld = !(chow || r.slot === SLOT.FreeTime);
      if (n.loop) n.hiddenFromWorld = count;
      if (n.hallSitter) n.hiddenFromWorld = count;
    }
  }
  onSlot(slot, entry) {
    const g = this.g;
    this.updateNpcPresence();
    if (slot === SLOT.LightsOut) this.cellsReleased = false;
    if (slot === SLOT.Count) { this.cellsReleased = false; if (this.f.woke) this.startCountRun(); }
    if (slot === SLOT.Chow) { this.setFlag('chowTime'); }
    if (slot === SLOT.Chapel) g.ui.note('CHAPEL', 'The chapel doors are open until 15:00.', 5000);
  }

  // ===========================================================================================
  // Interactables
  // ===========================================================================================
  makeInteractables() {
    const g = this.g, w = g.world, m = g.marks, V = (x, y, z) => new THREE.Vector3(x, y, z);
    const it = (def) => w.addInteractable(def);
    this.its = {};
    // --- own cell: bunk (rest) + pickup cigarettes
    this.its.bunk = it({ pos: V(0.6, 0.8, -8.4), radius: 2.4, label: () => 'Rest on your bunk', hold: 1.2, act: 'hold', canUse: () => this.canWait() ? { ok: true } : { ok: false, why: 'Not now.' }, onUse: () => this.rest() , area: 'hall' });
    this.addPickup('cigs1', V(2.75, 0.95, -7.6), 'cigs', 'a pack of cigarettes');
    this.addPickup('cigs2', V(-8.4, 0.85, 1.9), 'cigs', 'a pack of cigarettes (left on the table)');
    this.addPickup('cigs3', V(30.0, 0.85, -6.6), 'cigs', 'a half-full pack of cigarettes');
    // --- water
    for (const [id, p] of [['fn1', g.ctx.fountainPos], ['fn2', m.fountain2]]) it({ pos: p, radius: 2.0, label: () => 'Drink water', hold: 1.5, act: 'hold', canUse: () => g.survival.thirst < 96 ? { ok: true } : { ok: false, why: 'Not thirsty.' }, onUse: () => { g.survival.drink(42); g.audio && g.audio.sfx('drink'); } });
    // --- chow
    this.its.tray = it({ pos: m.tray, radius: 2.8, label: () => 'Take a chow tray', canUse: () => {
      if (this.g.inventory.has('tray')) return { ok: false, why: 'You already have a tray.' };
      if (!g.routine.mealTime()) return { ok: false, why: 'Chow is over — next meal at 12:00. The commissary is open.' };
      return { ok: true };
    }, onUse: () => this.startDialogue(g.routine.mealTime() ? 'tuck' : 'tuckNo', this.npcMap.tuck) });
    for (const [tx, tz] of m.tables) it({ pos: V(tx, 0.85, tz + 0.1), radius: 2.0, label: () => 'Eat your chow', hold: 2.6, act: 'eat', priority: 4, canUse: () => g.inventory.has('tray') ? { ok: true } : { ok: false, hide: true }, onUse: () => this.eatTray() });
    this.its.commissary = it({ pos: m.commissary, radius: 2.6, label: () => 'Commissary window', canUse: () => ({ ok: true }), onUse: () => this.openShop() });
    // --- mop job
    this.its.bucket = it({ pos: m.mop, radius: 2.4, label: () => 'Take the mop', canUse: () => {
      if (!this.f.jobOffered || this.f.jobDone) return { ok: false, hide: true };
      if (this.hasMop) return { ok: false, hide: true };
      if (!g.routine.canteenOpen()) return { ok: false, why: 'Work detail has ended.' };
      return { ok: true };
    }, onUse: () => { this.hasMop = true; g.viewmodel.act = 'mop'; g.ui.toast('Mop in hand — four spills in the mess hall', ''); g.audio && g.audio.sfx('thud', { vol: 0.5 }); this.stainMeshes.forEach((s) => { s.mesh.visible = !s.clean; }); } });
    this.stainMeshes.forEach((s, i) => it({ pos: V(s.pos.x, 0.4, s.pos.z), radius: 2.1, label: () => 'Mop the spill', hold: 2.2, act: 'mop', canUse: () => (this.hasMop && !s.clean ? { ok: true } : { ok: false, hide: true }), onUse: () => this.cleanStain(s) }));
    // --- NPC talk
    for (const n of g.npcs) {
      if (n.id === 'harrington') continue;
      if (!n.dialogue && !(n.role === 'guard')) continue;
      n.interactable = it({ pos: V(n.pos.x, 1.4, n.pos.z), radius: 3.1, priority: 2, label: () => 'Talk to ' + n.name, canUse: () => (n.hiddenFromWorld ? { ok: false, hide: true } : { ok: true }), onUse: () => this.talkTo(n), npc: n });
    }
    const h = this.npcMap.harrington;
    h.interactable = it({ pos: V(h.pos.x, 1.3, h.pos.z), radius: 2.7, priority: 3, label: () => 'Talk to Harrington', canUse: () => (this.f.ledgerGiven ? { ok: false, hide: true } : { ok: true }), onUse: () => this.talkTo(h), npc: h });
    // --- Records door reader
    const door = g.ctx.recordsDoor;
    this.its.reader = it({ pos: door.readerPos.clone(), radius: 2.2, priority: 1, label: () => (g.inventory.has('keycard') ? 'Swipe the keycard' : g.inventory.has('shim') ? 'Work the reader with the shim' : 'Records Room — locked'), hold: 0, canUse: () => {
      if (this.recordsUnlocked()) return { ok: false, hide: true };
      if (g.inventory.has('keycard') || g.inventory.has('shim')) return { ok: true };
      return { ok: false, why: 'Needs a keycard. Cutter sells one — or Pruitt can be paid.' };
    }, onUse: () => this.useReader() });
    // the shim needs holding — use a second interactable that takes precedence when the shim is the only tool
    this.its.shim = it({ pos: door.readerPos.clone(), radius: 2.2, priority: 2, label: () => 'Work the reader with the shim', hold: 5, act: 'shim', canUse: () => (!this.recordsUnlocked() && g.inventory.has('shim') && !g.inventory.has('keycard') ? { ok: true } : { ok: false, hide: true }), onUse: () => this.shimDone(), onHold: (on) => { g.player.tampering = on ? 1 : 0; } });
    this.its.ledger = it({ pos: m.ledger, radius: 2.0, label: () => 'Copy page 14 of the transfer ledger', hold: 3.0, act: 'paper', canUse: () => (g.inventory.has('ledger') || this.f.ledgerGiven ? { ok: false, hide: true } : { ok: true }), onUse: () => this.takeLedger() });
    // --- chapel door (locked reasons)
    const cd = g.ctx.chapelDoor;
    it({ pos: V(-49.6, 1.3, 0), radius: 2.4, label: () => 'Chapel doors — locked', canUse: () => (g.routine.chapelOpen() || this.f.chapelGranted ? { ok: false, hide: true } : { ok: false, why: 'Chapel opens at 13:00. Hold T to wait.' }), onUse: () => {} });
    it({ pos: V(-33, 1.3, -2.4), radius: 2.0, label: () => 'Library — closed', canUse: () => (g.routine.chapelOpen() || g.routine.slot === SLOT.FreeTime ? { ok: false, hide: true } : { ok: false, why: 'Library opens at 13:00.' }), onUse: () => {} });
    it({ pos: V(29.05, 1.3, -2.4), radius: 2.0, label: () => 'Mess hall — closed', canUse: () => (g.routine.canteenOpen() ? { ok: false, hide: true } : { ok: false, why: 'Chow is over.' }), onUse: () => {} });
    it({ pos: V(49.2, 1.3, 0), radius: 2.0, label: () => 'Visitation', canUse: () => ({ ok: false, why: 'Not in this demo — Visitation arrives in the next slice.' }), onUse: () => {} });
    // --- baptismal font
    this.its.font = it({ pos: V(m.font.x, 0.9, m.font.z), radius: 2.6, priority: 3, label: () => 'Lift the baptismal font', hold: 4, act: 'lift', canUse: () => {
      if (!this.f.ledgerGiven) return { ok: false, hide: true };
      if (this.f.fontLifted) return { ok: false, hide: true };
      const h = this.npcMap.harrington;
      if (Math.hypot(h.pos.x - m.font.x, h.pos.z - m.font.z) > 6.5) return { ok: false, why: 'Wait for Harrington.' };
      return { ok: true };
    }, onUse: () => this.liftFont() });
  }
  addPickup(id, pos, item, desc) {
    const g = this.g;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 0.06), new THREE.MeshStandardMaterial({ color: 0xe8e4d8, roughness: 0.6, emissive: 0x332200, emissiveIntensity: 0.8 }));
    mesh.position.copy(pos); mesh.position.y -= 0.02; g.world.root.add(mesh);
    const p = { id, taken: false, mesh };
    p.it = g.world.addInteractable({ pos: pos.clone(), radius: 1.8, label: () => 'Take ' + desc, canUse: () => (p.taken ? { ok: false, hide: true } : { ok: true }), onUse: () => { p.taken = true; mesh.visible = false; g.inventory.add(item, 1); g.ui.toast('Picked up: ' + ITEMS[item].name); g.audio && g.audio.sfx('paper'); } });
    this.pickups.push(p);
  }

  // ===========================================================================================
  // Interaction focus + input
  // ===========================================================================================
  updateFocus(inp, dt) {
    const g = this.g, pl = g.player;
    const f = new THREE.Vector3(-Math.sin(pl.yaw) * Math.cos(pl.pitch), Math.sin(pl.pitch), -Math.cos(pl.yaw) * Math.cos(pl.pitch));
    let best = null, bs = -1e9, res = null;
    for (const it of g.world.interactables) {
      if (!it.enabled) continue;
      if (it.npc) { it.pos.set(it.npc.pos.x, it.npc.pos.y + 1.3, it.npc.pos.z); }
      if (it.npc && it.npc.hiddenFromWorld) continue;
      const dx = it.pos.x - pl.eyePos.x, dy = it.pos.y - pl.eyePos.y, dz = it.pos.z - pl.eyePos.z, d = Math.hypot(dx, dy, dz);
      if (d > it.radius || Math.abs(it.pos.y - pl.pos.y) > 3.2) continue;
      const dot = (dx * f.x + dy * f.y + dz * f.z) / (d || 1);
      if (dot < 0.62 && d > 0.9) continue;
      if (g.world.blocked(pl.eyePos.x, pl.eyePos.y, pl.eyePos.z, it.pos.x, it.pos.y, it.pos.z) && !it.npc && d > 0.8) continue;
      const r = it.canUse ? it.canUse() : { ok: true };
      if (r.hide) continue;
      const s = dot * 3 - d * 0.5 + (it.priority || 0) * 0.6 + (r.ok ? 0.4 : 0);
      if (s > bs) { bs = s; best = it; res = r; }
    }
    if (best !== this.focus) { if (this.focus && this.focus.onHold && this.holdT > 0) this.focus.onHold(false); this.focus = best; this.holdT = 0; }
    this.focusRes = res;
    return best;
  }

  input(inp, dt) {
    const g = this.g, ui = g.ui;
    if (g.mode === 'paused') { if (inp.pressed.pause) g.pause(false); return; }
    if (g.mode === 'play') {
      if (inp.pressed.pause) { if (ui.panelOpen) { ui.openPanel(false); } else if (ui.shopOpen) ui.closeShop(); else if (ui.docOpen) ui.closeDoc(); else g.pause(true); return; }
      if (inp.pressed.journal) { if (ui.panelOpen) ui.cycleTab(1); else { ui.openPanel(true); g.input.unlock(); } }
      if (inp.pressed.inventory) { ui.tabIdx = 1; ui.openPanel(!ui.panelOpen); }
      if (inp.pressed.map) ui.el('u-mini').classList.toggle('off');
      if (ui.docOpen && (inp.pressed.advance || inp.pressed.interact)) { ui.closeDoc(); inp.pressed.interact = false; inp.pressed.advance = false; }
      if (ui.shopOpen) {
        for (let i = 0; i < 4; i++) if (inp.pressed['c' + (i + 1)]) this.buy(i);
        if (inp.pressed.interact) { ui.closeShop(); inp.pressed.interact = false; }
      }
      if (ui.panelOpen && inp.pressed.skip) ui.openPanel(false);
    } else if (g.mode === 'dialogue') { this.dialogueInput(inp); inp.pressed.interact = false; inp.pressed.advance = false; }
  }

  update(dt, inp) {
    const g = this.g, ui = g.ui;
    // timers
    for (let i = this.timers.length - 1; i >= 0; i--) if (g.time >= this.timers[i].t) { const t = this.timers.splice(i, 1)[0]; t.fn(); }
    if (g.mode === 'title') { this.titleCam(dt); return; }
    this.updateNpcLogic(dt);
    this.updateQuest(dt);
    if (g.mode !== 'play') { ui.setPrompt(null); g.viewmodel.act = this.baseAct(); this.holdT = 0; return; }
    if (ui.panelOpen || ui.shopOpen || ui.docOpen) { ui.setPrompt(null); return; }
    const it = this.updateFocus(inp, dt), r = this.focusRes;
    g.viewmodel.act = this.baseAct();
    if (!it) { ui.setPrompt(null); this.holdT = 0; g.player.tampering = 0; return; }
    if (!r.ok) { ui.setPrompt(it.label(), { key: '·', why: r.why || '' }); this.holdT = 0; return; }
    if (it.hold > 0) {
      const holding = inp.held.interact;
      if (holding) { if (this.holdT === 0 && it.onHold) it.onHold(true); this.holdT += dt; g.viewmodel.act = it.act || 'hold'; if (it.act === 'lift') g.viewmodel.act = 'lift'; if (it.onHold && this.holdT > 0) g.player.tampering = it.id === undefined && it === this.its.shim ? 1 : 0; }
      else { if (this.holdT > 0 && it.onHold) it.onHold(false); this.holdT = Math.max(0, this.holdT - dt * 2); g.player.tampering = 0; }
      ui.setPrompt(it.label(), { key: 'E', why: r.why || '', hold: this.holdT / it.hold });
      if (this.holdT >= it.hold) { this.holdT = 0; g.player.tampering = 0; if (it.onHold) it.onHold(false); it.onUse(); g.audio && g.audio.sfx('uiOk', { vol: 0.5 }); }
      else if (holding) this.holdSfx(it, dt);
    } else {
      ui.setPrompt(it.label(), { key: 'E', why: r.why || '' });
      if (inp.pressed.interact) { g.audio && g.audio.sfx('ui', { vol: 0.6 }); it.onUse(); }
      else g.viewmodel.act = g.viewmodel.act === 'none' && g.player.speed < 0.4 ? 'reach' : g.viewmodel.act;
    }
  }
  holdSfx(it, dt) {
    const g = this.g;
    this._hs = (this._hs || 0) - dt;
    if (this._hs > 0) return;
    if (it.act === 'mop') { g.audio && g.audio.sfx('mop'); this._hs = 1.3; }
    else if (it.act === 'eat') { g.audio && g.audio.sfx('eat'); this._hs = 0.9; }
    else if (it.act === 'lift') { g.audio && g.audio.sfx('lift'); this._hs = 3.4; }
    else if (it.act === 'paper') { g.audio && g.audio.sfx('paper'); this._hs = 0.8; }
    else if (it.act === 'shim') { g.audio && g.audio.sfx('keys', { vol: 1.4 }); this._hs = 0.7; }
  }
  baseAct() {
    const g = this.g;
    if (this.hasMop && !this.f.jobDone) return 'mop';
    if (g.inventory.has('tray')) return 'tray';
    return 'none';
  }

  // ===========================================================================================
  // NPC behaviour / count sequence
  // ===========================================================================================
  updateNpcLogic(dt) {
    const g = this.g;
    // walkers roam the hall once cells are open
    for (const n of g.npcs) {
      if (n.loop && !n.hiddenFromWorld && !n.moving) {
        n.waitT -= dt;
        if (n.waitT <= 0) { n.loopI = (n.loopI + 1) % n.loop.length; n.goTo(n.loop[n.loopI]); n.waitT = 2 + (n.loopI % 3); }
      }
    }
    // count run
    if (this.countPhase === 'run') {
      const r = this.reyes;
      if (this.countHoldActive) {
        const pl = g.player;
        const inZone = Math.hypot(pl.pos.x - MARKER.x, pl.pos.z - MARKER.z) < 1.2 && pl.lying < 0.2 && pl.crouch < 0.6;
        if (inZone) this.countHold += dt; else this.countHold = Math.max(0, this.countHold - dt * 0.5);
        this.countDwell -= dt;
        if (this.countHold >= 2.2) this.countSuccess();
        else if (this.countDwell <= 0) this.countFail();
      }
    }
    // Harrington leading
    if (this.leading) this.updateLead(dt);
    // lantern
    if (this.lantern) {
      // carried at his left hip, held a little out from the body so the near field never blows out his coat
      const h = this.npcMap.harrington, fx = -Math.sin(h.yaw), fz = -Math.cos(h.yaw), rx = -fz, rz = fx;   // forward / right
      this.lantern.fx.pos.set(h.pos.x + fx * 0.28 - rx * 0.46, h.pos.y + 0.82, h.pos.z + fz * 0.28 - rz * 0.46);
      this.lantern.mesh.position.copy(this.lantern.fx.pos); this.lantern.sp.position.copy(this.lantern.fx.pos);
    }
  }
  startCountRun() {
    const g = this.g, r = this.reyes;
    this.countPhase = 'run'; this.countHold = 0; this.countHoldActive = false;
    r.frozenAI = true; r.mode = 'escort'; r.stop();
    const seq = ['N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7'];
    let i = 0;
    const next = () => {
      if (i >= seq.length) return;
      const node = seq[i++];
      r.goTo(node, { speed: 2.0, onArrive: () => {
        r.targetYaw = 0;
        if (node === 'N7') { this.reyesAtCell(); return; }
        r.talkTimer = 0.6; g.audio && g.audio.sfx('keys', { vol: 0.5 });
        this.later(0.55, next);
      } });
    };
    next();
  }
  reyesAtCell() {
    const g = this.g;
    this.countHoldActive = true; this.countDwell = 6.5; this.countHold = Math.max(this.countHold, 0);
    this.reyes.talkTimer = 2;
    this.bark('CO Reyes', BARKS.countTap + ' Face the bars.', 3.2);
    g.audio && g.audio.sfx('keys', { vol: 0.8 });
    this.setFlag('countCalled');
  }
  countSuccess() {
    const g = this.g; if (!this.countHoldActive) return;
    this.countHoldActive = false; this.countPhase = 'done'; this.setFlag('countDone');
    this.bark('CO Reyes', BARKS.countOk, 3.5);
    g.reputation.addStanding('Guards', 1, '');
    this.later(3.0, () => this.releaseReyes());
    this.later(4.2, () => { this.cellsReleased = true; g.ui.pa('COUNT CLEAR. CELL DOORS RELEASING.'); g.audio && g.audio.pa('COUNT CLEAR. CELL DOORS RELEASING.'); this.updateNpcPresence(); g.ui.toast('Count cleared — doors open', 'good'); g.events.emit('countDone'); });
  }
  countFail() {
    const g = this.g; if (!this.countHoldActive) return;
    this.countHoldActive = false; this.countPhase = 'done'; this.setFlag('countDone'); this.setFlag('countFailed');
    this.bark('CO Reyes', BARKS.countFail, 3.5);
    g.reputation.addStanding('Guards', -3, 'missed count'); g.reputation.addCred(-2, 'write-up'); g.economy.spend(Math.min(5, g.economy.balance), 'count write-up');
    this.later(3.0, () => this.releaseReyes());
    this.later(4.2, () => { this.cellsReleased = true; g.ui.pa('COUNT CLEAR. CELL DOORS RELEASING.'); g.audio && g.audio.pa('COUNT CLEAR. CELL DOORS RELEASING.'); this.updateNpcPresence(); });
  }
  releaseReyes() { const r = this.reyes; r.frozenAI = false; r.mode = 'patrol'; r.nextPatrol(); }
  bark(who, text, secs = 3) {
    const g = this.g;
    if (g.mode === 'dialogue') return;
    const h = g.ui.say(who, text, { cont: false, cps: 55, onChar: () => g.audio && g.audio.voice(VOICE[who] || 100, 0.8) });
    this.barkId = (this.barkId || 0) + 1; const id = this.barkId;
    this.later(secs + text.length / 55, () => { if (this.barkId === id && g.mode !== 'dialogue') g.ui.clearSay(); });
  }
  inOwnCell(pl) { return pl.pos.x > CELL_BOX.x0 && pl.pos.x < CELL_BOX.x1 && pl.pos.z > CELL_BOX.z0 && pl.pos.z < CELL_BOX.z1; }
  recordsUnlocked() { const g = this.g; return g.time < this.recordsUntil || (g.player.area && g.player.area.name === 'records'); }
  canWait() {
    const g = this.g;
    if (g.mode !== 'play' || g.alert.level > 0 || g.maxDetect > 0.15) return false;
    if (this.countPhase === 'run' && !this.f.countDone) return false;
    if (g.routine.slot === SLOT.Count && !this.f.countDone) return false;
    return !this.leading;
  }
  rest() {
    const g = this.g, r = g.routine;
    // sleep through to the next hour boundary of interest
    const targets = [7, 8, 10, 12, 13, 15];
    const next = targets.find((t) => t > r.hour + 0.02) ?? 7;
    this.advanceHours(next > r.hour ? next - r.hour : 24 - r.hour + next, next);
  }
  advanceHours(dh, toHour) {
    const g = this.g;
    g.fadeTarget = 1; g.fadeSpeed = 0.3;
    this.later(0.6, () => {
      g.survival.hunger = clamp(g.survival.hunger - 3.2 * dh, 0, 100); g.survival.thirst = clamp(g.survival.thirst - 4.2 * dh, 0, 100);
      g.routine.skipTo(toHour);
      g.ui.toast('Time passes… ' + g.routine.clock);
      g.fadeTarget = 0; g.fadeSpeed = 0.6;
    });
  }

  // ===========================================================================================
  // Quest logic
  // ===========================================================================================
  updateQuest(dt) {
    const g = this.g;
    // reveal mop stains when the job is offered
    if (this.f.jobOffered && !this.f.jobDone && this.hasMop) this.stainMeshes.forEach((s) => (s.mesh.visible = !s.clean));
    // tunnel: dialogue trigger
    if (this.f.leadStarted && !this.f.tunnelRulesDone && !this.f.tunnelRulesStarted) {
      const h = this.npcMap.harrington, pl = g.player;
      if (this.f.atT1 && !h.moving && pl.pos.y < -2.5 && Math.hypot(pl.pos.x - h.pos.x, pl.pos.z - h.pos.z) < 5.5) { this.setFlag('tunnelRulesStarted'); this.startDialogue('tunnelRules', h, { cam: 'tunnel' }); }
    }
    // clearing trigger
    if (this.f.leadDone && !this.f.endStarted) {
      const pl = g.player;
      if (Math.hypot(pl.pos.x - OAK.x, pl.pos.z - OAK.z) < 7.5) { this.setFlag('endStarted'); g.player.frozen = true; this.startDialogue('clearing', this.npcMap.harrington, { cam: 'oak' }); }
    }
    // lose-state
    if (!g.survival.alive && !this.f.dead) { this.setFlag('dead'); this.onArrest(null, true); g.survival.alive = true; g.survival.health = 40; }
  }

  objectiveText() {
    const t = this.objective();
    if (!t) return '';
    const p = this.objectivePos(); let d = '';
    if (p) { const dd = Math.hypot(p.x - this.g.player.pos.x, p.z - this.g.player.pos.z); d = `   ·   ${dd.toFixed(0)} m`; }
    return t + d;
  }
  objective() {
    const g = this.g, f = this.f, inv = g.inventory;
    if (!f.woke) return 'Get up.';
    if (!f.countDone) return 'Stand at your cell door for COUNT.';
    if (g.mode === 'end') return '';
    if (f.endStarted) return 'Sit under the oak.';
    if (f.leadStarted) return f.tunnelRulesDone ? 'Follow Harrington to the clearing.' : 'Follow Harrington through the tunnel.';
    if (f.fontLifted) return 'Follow Harrington.';
    if (f.ledgerGiven) return 'Lift the baptismal font with Harrington.';
    if (inv.has('ledger')) return g.routine.chapelOpen() ? 'Bring page 14 to Harrington in the chapel.' : 'Chapel opens at 13:00 — hold T to wait, then bring page 14 to Harrington.';
    if (this.recordsUnlocked() || f.recordsEntered) return 'Copy page 14 of the transfer ledger.';
    if (f.metCutter) {
      if (inv.has('keycard') || inv.has('shim')) return 'Get into the Records Room at Intake.';
      return 'Get into Records: keycard (60 DC), shim (25 DC), or bribe Pruitt (40 DC).';
    }
    if (!f.ate) return g.routine.mealTime() ? 'Report to the mess hall for CHOW.' : (g.routine.canteenOpen() ? 'Chow is over — the commissary is open. Find Cutter in the mess hall.' : 'Chow at 07:00 — explore, or hold T to wait.');
    return 'Find Cutter in the mess hall.';
  }
  objectivePos() {
    const g = this.g, f = this.f, m = g.marks, inv = g.inventory;
    if (!f.woke) return { x: 0.55, z: -8.6 };
    if (!f.countDone) return { x: MARKER.x, z: MARKER.z };
    if (f.endStarted) return { x: OAK.x, z: OAK.z };
    if (f.leadStarted || f.fontLifted) { const h = this.npcMap.harrington; return { x: h.pos.x, z: h.pos.z }; }
    if (f.ledgerGiven) return { x: m.font.x, z: m.font.z };
    if (inv.has('ledger')) { const h = this.npcMap.harrington; return { x: h.pos.x, z: h.pos.z }; }
    if (this.recordsUnlocked() || f.recordsEntered) return { x: m.ledger.x, z: m.ledger.z };
    if (f.metCutter) return { x: 43.9, z: 6.0 };
    if (!f.ate) return { x: m.tray.x, z: m.tray.z };
    return { x: this.npcMap.cutter.pos.x, z: this.npcMap.cutter.pos.z };
  }
  journal() {
    const f = this.f, inv = this.g.inventory;
    const J = [];
    J.push({ text: 'Stand for the morning count', done: !!f.countDone, current: !f.countDone });
    J.push({ text: 'Take chow in the mess hall', done: !!f.ate, current: f.countDone && !f.ate });
    J.push({ text: 'Hear Cutter out about the transfer ledger', done: !!f.metCutter, current: f.ate && !f.metCutter });
    J.push({ text: 'Get into the Records Room (keycard · shim · bribe)', done: !!(f.recordsEntered || inv.has('ledger') || f.ledgerGiven), current: !!f.metCutter && !f.recordsEntered && !inv.has('ledger') });
    J.push({ text: 'Copy page 14 of the ledger', done: !!(inv.has('ledger') || f.ledgerGiven), current: !!f.recordsEntered && !inv.has('ledger') && !f.ledgerGiven });
    J.push({ text: 'Bring it to Harrington in the chapel (13:00)', done: !!f.ledgerGiven, current: inv.has('ledger') });
    J.push({ text: 'Lift the baptismal font', done: !!f.fontLifted, current: !!f.ledgerGiven && !f.fontLifted });
    J.push({ text: 'Follow Harrington through the tunnel', done: !!f.endStarted, current: !!f.fontLifted && !f.endStarted });
    J.push({ text: 'Optional — kitchen work detail for 30 DC', done: !!f.jobDone, current: !!f.jobOffered && !f.jobDone });
    return J;
  }

  // ===========================================================================================
  // Actions
  // ===========================================================================================
  eatTray() {
    const g = this.g;
    g.inventory.remove('tray'); g.survival.eat(46); g.survival.drink(8);
    this.setFlag('ate'); g.ui.toast('Ate chow — hunger restored', 'good');
    this.later(0.2, () => { g.viewmodel.act = 'none'; });
  }
  openShop() {
    const g = this.g;
    this.shopItems = [
      { id: 'water', name: 'Bottled water', desc: 'Thirst +40', price: 3 },
      { id: 'soup', name: 'Ramen soup', desc: 'Hunger +28', price: 6 },
      { id: 'cigs', name: 'Pack of cigarettes', desc: 'Currency · sell to Cutter for 8 DC', price: 10 },
      { id: 'bun', name: 'Honey bun', desc: 'Hunger +12 · Stamina refill', price: 4 },
    ];
    g.input.unlock();
    g.ui.openShop(this.shopItems, (i) => this.buy(i));
  }
  buy(i) {
    const g = this.g, it = this.shopItems && this.shopItems[i];
    if (!it || !g.ui.shopOpen) return;
    if (!g.economy.can(it.price)) { g.ui.toast('Not enough DC', 'bad'); g.audio && g.audio.sfx('denied'); return; }
    if (it.id === 'cigs' && g.inventory.count('cigs') >= 20) return;
    g.economy.spend(it.price, it.name);
    if (it.id === 'water') g.survival.drink(40); else if (it.id === 'soup') g.survival.eat(28); else if (it.id === 'bun') { g.survival.eat(12); g.player.stamina = 100; } else g.inventory.add('cigs', 1);
    g.ui.openShop(this.shopItems, (k) => this.buy(k));
  }
  cleanStain(s) {
    const g = this.g;
    s.clean = true; s.mesh.visible = false; this.cleaned++;
    g.ui.toast(`Spill mopped (${this.cleaned}/4)`, 'good');
    if (this.cleaned >= this.stainMeshes.length) {
      this.setFlag('jobDone'); this.hasMop = false; g.viewmodel.act = 'none';
      g.economy.earn(30, 'Kitchen work detail');
      g.reputation.addStanding('Guards', 2, 'reliable worker'); g.reputation.addCred(1, '');
      this.bark('Tuck', 'Floor\'s clean. First honest day\'s work you\'ve done.', 3);
    }
  }
  useReader() {
    const g = this.g;
    if (g.inventory.has('keycard')) {
      g.audio && g.audio.sfx('keycard'); g.ctx.recordsDoor.setOpen(false, true);
      this.recordsUntil = g.time + 25; this.route = 'keycard'; g.route = 'keycard'; this.setFlag('route', 'keycard');
      g.ui.toast('Reader accepts the keycard', 'good');
      g.reputation.addStanding('Independent', 3, 'Cutter\'s keycard');
    }
  }
  shimDone() {
    const g = this.g;
    g.audio && g.audio.sfx('keycard'); this.recordsUntil = g.time + 25; g.route = 'shim';
    g.ui.toast('The reader gives up — green light', 'good'); g.reputation.addCred(2, 'slick work');
    g.player.tampering = 0;
  }
  takeLedger() {
    const g = this.g;
    g.inventory.add('ledger'); g.ui.toast('Copied: Transfer Ledger — page 14', 'good'); g.reputation.addCred(2, '');
    this.setFlag('recordsEntered'); this.setFlag('ledgerUnread');
  }
  readDoc(id) {
    const g = this.g;
    if (id !== 'ledger') return;
    g.ui.openDoc(`<h3>STATE CORRECTIONS · TRANSFER ORDER 26-1106</h3>
      <div>INMATE: <b>MARLOWE, HARRINGTON</b> &nbsp; DOC # 0042-1971</div><div>FROM: C-BLOCK / CHAPEL DETAIL</div><div>TO: MERCY RIDGE INFIRMARY, UNIT 4</div><div>EFFECTIVE: 15 OCT — 15:00 &nbsp; (ESCORTED)</div>
      <div style="margin-top:1vmin">NOTE: <i>Chapel sub-floor / baptismal maintenance HOLD — facilities to confirm crawlspace sealed prior to transfer. Inmate has had unsupervised chapel access 31 yrs. Do not permit access to sub-chapel.</i></div>
      <div style="margin-top:1.4vmin">AUTHORIZED: <span class="sig">A. Thorne</span><br>DEPUTY WARDEN, OPERATIONS</div>
      <div class="stamp">PENDING</div><div class="hint">SPACE / E — CLOSE</div>`);
    g.input.unlock();
  }
  bribe() {
    const g = this.g;
    g.economy.spend(40, 'Bribe — CO Pruitt');
    g.reputation.addStanding('Guards', 3, 'greased a palm'); g.reputation.addCred(-1, ''); g.reputation.addFear(-2, '');
    this.recordsUntil = g.time + 40; this.pruitt.distract(32); g.route = 'bribe'; this.setFlag('bribed');
    g.audio && g.audio.sfx('keycard'); g.ctx.recordsDoor.locked = false;
  }
  onCameraAlarm() {
    const g = this.g;
    // Pruitt breaks his post to check Records
    if (this.pruitt.mode !== 'distracted') { this.pruitt.mode = 'chase'; this.pruitt.chaseRepath = 0; this.pruitt.lostT = 0; this.pruitt.lastSeen.copy(g.player.pos); this.pruitt.detect = 1; g.events.emit('chaseStart', this.pruitt); }
    this.pruitt.canChase = true;
  }
  onArrest(guard, fainted = false) {
    const g = this.g;
    if (g.mode === 'cine') return;
    g.player.frozen = true;
    g.alert.clear();
    const cine = makeArrestCine(g, guard, fainted);
    g.playCine(cine);
  }
  /** Applied when the arrest cinematic hits black. */
  applyArrest(fainted) {
    const g = this.g;
    const fine = Math.min(15, g.economy.balance);
    if (fine > 0) g.economy.spend(fine, fainted ? 'Medical fee' : 'Fine — caught out of bounds');
    if (!fainted) { g.reputation.addStanding('Guards', -3, 'caught'); g.reputation.addCred(-2, ''); g.reputation.addFear(-3, ''); }
    // guards stand down
    for (const gd of g.guards) {
      gd.detect = 0; gd.catchCooldown = 4; gd.stop(); gd.mode = gd.station ? 'station' : 'patrol';
      if (gd === this.reyes && gd.frozenAI) continue;
      if (gd.station) gd.goTo(gd.station.node, { onArrive: () => { gd.targetYaw = gd.station.yaw; } }); else gd.nextPatrol();
    }
    // lose the ledger if you had it
    if (g.inventory.has('ledger')) { g.inventory.remove('ledger'); g.ui.toast('Guards confiscated page 14', 'bad'); }
    this.recordsUntil = -1;
    // back to the cell, an hour later
    g.player.teleport(0.9, 0, -7.4, 0);
    g.player.pitch = 0;
    g.routine.skipTo((g.routine.hour + 1) % 24);
    if (g.survival.hunger < 20) g.survival.eat(25);
    if (g.survival.thirst < 20) g.survival.drink(25);
    g.survival.health = Math.max(g.survival.health, 50);
    this.cellsReleased = !(g.routine.slot === SLOT.Count || g.routine.slot === SLOT.LightsOut);
  }

  // ===========================================================================================
  // Dialogue
  // ===========================================================================================
  talkTo(npc) {
    const g = this.g, f = this.f;
    let id = npc.dialogue;
    switch (npc.id) {
      case 'cutter': id = f.metCutter ? 'cutterAgain' : 'cutter'; break;
      case 'pruitt': id = this.recordsUnlocked() || f.recordsEntered ? 'pruittDone' : 'pruitt'; break;
      case 'harrington': id = g.inventory.has('ledger') ? 'harrington' : f.ledgerGiven ? 'harringtonWait' : 'harringtonIdle'; break;
      case 'reyes': id = 'reyesLine'; break;
      case 'dalton': id = 'daltonLine'; break;
      case 'tuck': id = g.inventory.has('tray') ? 'tuckHave' : (g.routine.mealTime() ? 'tuck' : 'tuckNo'); break;
      default: break;
    }
    if (!id) return;
    this.startDialogue(id, npc);
  }
  startDialogue(id, npc, { cam = 'face' } = {}) {
    const g = this.g, script = DIALOGUE[id];
    if (!script) return;
    this.dialogue = { id, script, node: null, npc, cam, h: null, wait: 0 };
    if (npc && npc.role !== 'nobody') { npc.restYaw = npc.targetYaw; npc.restLook = npc.lookTarget; npc.stopForTalk = true; if (!npc.moving) npc.facePoint(g.player.pos.x, g.player.pos.z); npc.lookTarget = g.player.eyePos; }
    g.mode = 'dialogue'; g.player.frozen = true; g.letter = 1;
    g.ui.setPrompt(null); g.ui.show('u-pause', false);
    this.goNode(script.start);
  }
  dialogueFrame() {
    const g = this.g, d = this.dialogue; if (!d) return;
    const pl = g.player; const n = d.npc;
    const hy = n.pose === 'sit' ? 1.12 : n.pose === 'ground' ? 0.95 : n.pose === 'pray' ? 1.05 : 1.55;
    const head = new THREE.Vector3(n.pos.x, n.pos.y + hy, n.pos.z);
    const dir = new THREE.Vector3(head.x - pl.eyePos.x, 0, head.z - pl.eyePos.z);
    const dist = dir.length() || 1; dir.divideScalar(dist);
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    // portrait framing: low, close, slightly over the shoulder, NPC off-centre
    const pos = pl.eyePos.clone().addScaledVector(dir, Math.min(dist * 0.3, 0.9)).addScaledVector(side, 0.34);
    pos.y = THREE.MathUtils.lerp(pl.eyePos.y, head.y + 0.1, 0.7);
    const look = head.clone().addScaledVector(side, -0.1); look.y -= 0.02;
    this.dialogueCam = { pos, look, fov: d.cam === 'oak' || d.cam === 'tunnel' ? 44 : 42 };
    // keep the player's own facing aligned so control resumes naturally
    pl.yaw = Math.atan2(-(head.x - pl.eyePos.x), -(head.z - pl.eyePos.z)); pl.pitch = 0;
  }
  goNode(key) {
    const g = this.g, d = this.dialogue;
    const node = d.script.nodes[key]; if (!node) return this.endDialogue();
    d.node = node; d.key = key;
    if (node.fx) this.runFx(node.fx);
    if (!this.dialogue) return;
    const voice = VOICE[node.who] || 100;
    d.h = g.ui.say(node.who === 'Maddox' ? 'Maddox' : node.who, node.text, { inner: !!node.inner, onChar: () => g.audio && g.audio.voice(voice, 0.9) });
    d.choices = null; d.chosen = false;
    if (node.who !== 'Maddox' && d.npc) d.npc.talkTimer = Math.max(1.2, node.text.length / 28);
    g.ui.setChoices([]);
    d.shown = false;
  }
  dialogueInput(inp) {
    const g = this.g, d = this.dialogue; if (!d) return;
    this.dialogueFrame();
    const node = d.node;
    if (d.h && !d.h.done) { if (inp.pressed.advance || inp.pressed.interact) d.h.finish(); return; }
    // typed out
    if (node.choices && !d.choices) {
      d.choices = node.choices.map((c) => ({ ...c, disabled: c.cond ? !this.cond(c.cond) : false }));
      g.ui.setChoices(d.choices, (i) => this.pick(i));
      g.input.unlock();
    }
    if (d.choices) {
      for (let i = 0; i < 4; i++) if (inp.pressed['c' + (i + 1)]) this.pick(i);
      return;
    }
    if (inp.pressed.advance || inp.pressed.interact) {
      if (node.next) this.goNode(node.next);
      else this.endDialogue();
    }
  }
  pick(i) {
    const g = this.g, d = this.dialogue; if (!d || !d.choices) return;
    const c = d.choices[i]; if (!c || c.disabled) { if (c) { g.ui.toast('Not available', 'bad'); g.audio && g.audio.sfx('denied'); } return; }
    g.ui.setChoices([]); d.choices = null;
    g.audio && g.audio.sfx('ui');
    if (c.fx) this.runFx(c.fx);
    if (!this.dialogue) return;
    if (c.end || !c.next) { this.endDialogue(); return; }
    this.goNode(c.next);
  }
  endDialogue() {
    const g = this.g, d = this.dialogue; if (!d) return;
    this.dialogue = null; this.dialogueCam = null;
    g.ui.clearSay(); g.ui.setChoices([]);
    if (g.mode === 'dialogue') {
      g.mode = 'play'; g.letter = 0;
      if (!(this.f.endStarted && !this.f.ended)) g.player.frozen = false;
    }
    const npc = d.npc; if (npc) { npc.talkTimer = 0; npc.lookTarget = npc.restLook || null; if (npc.restYaw !== undefined && !npc.moving) npc.targetYaw = npc.restYaw; npc.stopForTalk = false; }
    this.after && this.after(d.id);
  }
  cond(c) {
    const g = this.g, f = this.f, inv = g.inventory;
    switch (c) {
      case 'canKeycard': return g.economy.can(60) && !inv.has('keycard');
      case 'canShim': return g.economy.can(25) && !inv.has('shim');
      case 'hasCigs': return inv.has('cigs');
      case 'knowsLedger': return !!f.metCutter;
      case 'canBribe': return g.economy.can(40) && !f.bribed;
      case 'hasLedger': return inv.has('ledger');
      default: return true;
    }
  }
  runFx(fx) {
    const g = this.g, f = this.f;
    const [cmd, a, b] = fx.split(':');
    if (cmd === 'fear+2') g.reputation.addFear(2, '');
    else if (cmd === 'buy') { if (g.economy.spend(+b, a === 'keycard' ? 'Keycard — Cutter' : 'Reader shim — Cutter')) { g.inventory.add(a, 1); g.reputation.addStanding('Independent', 2, ''); g.ui.toast(`Got: ${ITEMS[a].name}`, 'good'); } }
    else if (cmd === 'jobOffer') { this.setFlag('jobOffered'); g.ui.toast('Job offered: mop the mess hall (30 DC)', ''); }
    else if (cmd === 'cutterDone') { this.setFlag('metCutter'); g.reputation.addCred(1, ''); }
    else if (cmd === 'bribe') this.bribe();
    else if (cmd === 'giveTray') { g.inventory.add('tray'); g.audio && g.audio.sfx('thud', { vol: 0.35 }); g.ui.toast('Got: Chow tray'); }
    else if (cmd === 'sellCig') { g.inventory.remove('cigs'); g.economy.earn(8, 'Sold cigarettes to Cutter'); }
    else if (cmd === 'giveLedger') { g.inventory.remove('ledger'); this.setFlag('ledgerGiven'); g.reputation.addStanding('InmatesGeneral', 6, 'helped Harrington'); g.reputation.addCred(6, 'respect'); g.audio && g.audio.sfx('paper'); }
    else if (cmd === 'harringtonLeadsFont') { this.later(0.1, () => this.harringtonToFont()); }
    else if (cmd === 'tunnelRulesDone') { this.setFlag('tunnelRulesDone'); this.after = (id) => { if (id === 'tunnelRules') this.resumeLead(); }; }
    else if (cmd === 'endDemo') { this.after = (id) => { if (id === 'clearing') this.endDemo(); }; }
  }
  // ===========================================================================================
  // Chapel / tunnel / ending
  // ===========================================================================================
  harringtonToFont() {
    const h = this.npcMap.harrington, g = this.g;
    h.setPose('idle');
    h.goTo('P.fh', { speed: 1.1, onArrive: () => { h.facePoint(g.marks.font.x, g.marks.font.z); } });
  }
  liftFont() {
    const g = this.g;
    this.setFlag('fontLifted');
    g.fadeTarget = 0;
    g.playCine(makeFontCine(g));
  }
  startLead() {
    const g = this.g, h = this.npcMap.harrington;
    this.setFlag('leadStarted');
    this.leadPath = ['P.fs', 'T.top', 'T.foot', 'T.1', 'T.2', 'T.c', 'T.3', 'T.4', 'T.m', 'O.g', 'O.a', 'O.b', 'O.c', 'O.oak'];
    this.leadIdx = 0; this.leadWait = 0; this.leading = { speed: 1.25 };
    g.outsideMode = 'gold';
    // lantern
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), MAT.bulb); g.world.areas.get('tunnel1').group.add(mesh);
    const fx = g.world.addFixture({ pos: new THREE.Vector3(), color: 0xffb35a, intensity: 5, range: 9, flicker: 0.2, area: null, priority: 3 });
    fx.area = null;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: g.ctx.candles[0].sp.material.map, color: 0xffb866, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
    sp.scale.set(0.5, 0.5, 1); g.world.root.add(sp);
    this.lantern = { fx, mesh, sp };
  }
  resumeLead() { this.leadWait = 0; }
  updateLead(dt) {
    const g = this.g, h = this.npcMap.harrington, pl = g.player;
    if (g.mode === 'dialogue' || g.mode === 'cine') return;
    if (this.leadIdx >= this.leadPath.length) { if (!h.moving && !this.f.leadDone) { this.setFlag('leadDone'); h.facePoint(-92, -20); } return; }
    // the tunnel-rules conversation gates progress past T.2
    if (!this.f.tunnelRulesDone && this.f.atT1) { h.stop(); h.facePoint(pl.pos.x, pl.pos.z); return; }
    if (h.moving) return;
    const near = Math.hypot(pl.pos.x - h.pos.x, pl.pos.z - h.pos.z) < 6.0 || (pl.pos.y < -2 && h.pos.y > -1 && pl.pos.z < h.pos.z);
    if (!near) { h.facePoint(pl.pos.x, pl.pos.z); return; }
    const node = this.leadPath[this.leadIdx++];
    h.goTo(node, { speed: this.leading.speed, onArrive: node === 'T.1' ? () => this.setFlag('atT1') : null });
    if (node === 'O.oak') h.goTo('O.sit', { speed: 1.0 });
  }
  endDemo() {
    const g = this.g;
    this.setFlag('ended');
    g.playCine(makeEnding(g));
  }
  finishDemo() {
    const g = this.g;
    g.mode = 'end'; g.ui.hud(false);
    const secs = Math.round(g.simTime);
    g.ui.showEnd({ time: `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`, dc: g.stats.dcEarned, cred: g.reputation.streetCred, route: ({ keycard: 'Keycard', shim: 'Shim', bribe: 'Bribe' })[g.route] || '—' });
    g.events.emit('demoEnd');
  }

  // ===========================================================================================
  // Intro / title / reset
  // ===========================================================================================
  titleCam(dt) {
    const g = this.g; const t = g.time * 0.18;
    const x = Math.sin(t) * 9, z = 2.0 + Math.cos(t * 0.8) * 0.8;
    g.camOverride = { pos: new THREE.Vector3(-14 + (Math.sin(t) * 0.5 + 0.5) * 18, 1.9 + Math.sin(t * 1.3) * 0.3, z - 0.0), look: new THREE.Vector3(8 + Math.sin(t * 0.7) * 5, 2.4, -3 + Math.cos(t) * 2.5), fov: 62, roll: 0 };
    g.world.setActiveArea('hall'); g.applyEnv('hall');
  }
  beginIntro() {
    const g = this.g;
    g.mode = 'cine'; g.ui.hud(false);
    g.playCine(makeIntro(g));
  }
  reset(toTitle) {
    const g = this.g;
    this.f = {}; this.timers = []; this.dialogue = null; this.dialogueCam = null; this.cleaned = 0; this.hasMop = false; this.recordsUntil = -1; this.cellsReleased = false;
    this.countPhase = 'idle'; this.countHold = 0; this.countHoldActive = false; this.leading = null; this.leadPath = null;
    g.economy.load({ balance: 50, log: [], earned: 0, spent: 0 }); g.inventory.load([]); g.reputation.load({ streetCred: 12, fear: 20, standing: { Guards: 0, InmatesGeneral: 8, YardCrew: 4 } });
    g.survival.load({ health: 100, hunger: 78, thirst: 82 }); g.alert.clear();
    g.routine.hour = 5.9; g.routine.day = 1; g.routine._evaluate(true); g.routine.entry = null; g.routine._evaluate(true);
    g.stats = { arrests: 0, dcEarned: 0 }; g.simTime = 0; g.route = 'none'; g.outsideMode = 'night';
    for (const s of this.stainMeshes) { s.clean = false; s.mesh.visible = false; }
    for (const p of this.pickups) { p.taken = false; p.mesh.visible = true; }
    g.ctx.recordsDoor.locked = true;
    this.reyes.frozenAI = true; this.reyes.mode = 'escort'; this.reyes.teleport(-16.5, -4.85); this.reyes.stop();
    this.pruitt.mode = 'station'; this.pruitt.teleport(36, 7.0);
    const h = this.npcMap.harrington; h.teleport(-58.75, 4.2, 0); h.setPose('sit'); h.stop(); h.facePoint(-72, 4.2);
    if (g.ctx.fontGroup) { g.ctx.fontGroup.position.x = 0; g.ctx.fontCollider.enabled = true; }
    g.ui.setObjective(''); g.ui.setChoices([]); g.ui.clearSay();
    g.player.frozen = false; g.player.lying = 0; g.player.teleport(0.55, 0, -8.6, 0);
    if (!toTitle) { g.fade = 1; g.fadeTarget = 1; }
    this.updateNpcPresence();
  }
  onArea(area) {
    const g = this.g;
    if (area.name !== 'records' && this.f.ledgerUnread && g.inventory.has('ledger')) { this.f.ledgerUnread = false; this.later(0.9, () => { if (g.mode === 'play') this.readDoc('ledger'); }); }
    if (area.name === 'records' && !this.f.recordsEntered) { this.setFlag('enteredRecordsRoom'); }
    if (area.name === 'chapel' && !this.f.chapelVisited) { this.setFlag('chapelVisited'); g.audio && g.audio.sfx('bell', { vol: 0.5 }); g.audio && g.audio.musicTo('chapel'); g.audio && (g.audio.resumeMusic = 'chapel'); }
    if (area.name !== 'chapel' && g.audio && g.audio.musicMode === 'chapel' && !this.f.fontLifted) { g.audio.musicTo('calm'); g.audio.resumeMusic = 'calm'; }
    if (area.tag === 'tunnel' && g.audio && g.audio.musicMode !== 'tunnel' && g.audio.musicMode !== 'finale') { g.audio.musicTo('tunnel'); g.audio.resumeMusic = 'tunnel'; }
    if (area.name === 'outside' && g.audio && g.audio.musicMode !== 'finale') { g.audio.musicTo('chapel'); g.audio.resumeMusic = 'chapel'; }
  }
  serialize() { return { f: this.f, cleaned: this.cleaned, hasMop: this.hasMop, route: this.g.route, cellsReleased: this.cellsReleased, jobDone: this.f.jobDone, taken: this.pickups.map((p) => p.taken), stains: this.stainMeshes.map((s) => s.clean), countPhase: this.countPhase }; }
  load(d) {
    this.f = d.f || {}; this.cleaned = d.cleaned || 0; this.hasMop = !!d.hasMop; this.g.route = d.route || 'none'; this.cellsReleased = !!d.cellsReleased; this.countPhase = d.countPhase || 'done';
    this.pickups.forEach((p, i) => { p.taken = !!d.taken[i]; p.mesh.visible = !p.taken; });
    this.stainMeshes.forEach((s, i) => { s.clean = !!d.stains[i]; s.mesh.visible = this.hasMop && !s.clean; });
    this.reyes.frozenAI = false; this.reyes.mode = 'patrol'; this.reyes.nextPatrol();
    if (this.f.fontLifted) { this.g.ctx.fontGroup.position.x = 2.6; this.g.ctx.fontCollider.enabled = false; }
    this.updateNpcPresence();
  }
}
