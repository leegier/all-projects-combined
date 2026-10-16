// Game: owns the renderer, world, systems, player, NPCs, UI and the fixed-step simulation. Everything that affects the
// simulation runs inside step(dt) with a fixed dt so a recorded playtest is bit-for-bit repeatable.
import * as THREE from 'three';
import { loadAllTextures, DECALS } from './proc/textures.js';
import { buildMaterials } from './proc/materials.js';
import { Gfx, LightRig, lightShaft, dustField } from './core/gfx.js';
import { setupStage } from './core/stage.js';
import { Input } from './core/input.js';
import { AudioEngine } from './core/audio.js';
import { World } from './world/world.js';
import { buildHall } from './world/levels/hall.js';
import { buildEast } from './world/levels/east.js';
import { buildWest } from './world/levels/west.js';
import { buildTunnel } from './world/levels/tunnel.js';
import { buildOutside, terrainHeight } from './world/levels/outside.js';
import { defineNav, linkManual } from './world/navdef.js';
import { Nav } from './ai/nav.js';
import { Player } from './systems/player.js';
import { Routine, SLOT } from './systems/routine.js';
import { Economy } from './systems/economy.js';
import { Reputation } from './systems/reputation.js';
import { Survival } from './systems/survival.js';
import { Inventory } from './systems/inventory.js';
import { AlertSystem } from './systems/alert.js';
import { Save } from './systems/save.js';
import { Viewmodel } from './chars/viewmodel.js';
import { UI } from './ui/ui.js';
import { Story } from './story/story.js';
import { characters } from './chars/library.js';
import { Emitter, mulberry32, clamp, damp, lerp, smoothstep, hash01 } from './util.js';

export const STEP = 1 / 60;

const ENV = {
  hall: { fog: 0x0b1118, fd: 0.014, hs: 0x4d6a85, hg: 0x241b14, hi: 0.5, am: 0x1a2230, ai: 0.5, bg: 0x04060a, ex: 1.05, bloom: 0.5 },
  eastCorr: { fog: 0x0a1114, fd: 0.02, hs: 0x3f6a78, hg: 0x1c1a14, hi: 0.4, am: 0x182630, ai: 0.5, bg: 0x040608, ex: 1.05, bloom: 0.5 },
  westCorr: { fog: 0x120d0d, fd: 0.02, hs: 0x6a4a4a, hg: 0x1c1410, hi: 0.4, am: 0x241818, ai: 0.5, bg: 0x040608, ex: 1.05, bloom: 0.5 },
  canteen: { fog: 0x0f1816, fd: 0.011, hs: 0x6a8a82, hg: 0x2a2418, hi: 0.75, am: 0x22302c, ai: 0.6, bg: 0x040608, ex: 1.05, bloom: 0.45 },
  intake: { fog: 0x0e1215, fd: 0.016, hs: 0x587080, hg: 0x241f18, hi: 0.5, am: 0x1a2630, ai: 0.5, bg: 0x040608, ex: 1.05, bloom: 0.5 },
  records: { fog: 0x090c0d, fd: 0.02, hs: 0x3a5a52, hg: 0x16120e, hi: 0.35, am: 0x14201c, ai: 0.45, bg: 0x030405, ex: 1.1, bloom: 0.55 },
  library: { fog: 0x100d0a, fd: 0.016, hs: 0x6a5a48, hg: 0x241a10, hi: 0.5, am: 0x2a1e14, ai: 0.55, bg: 0x040608, ex: 1.05, bloom: 0.55 },
  chapel: { fog: 0x140e0a, fd: 0.012, hs: 0x7a6650, hg: 0x2a1c12, hi: 0.5, am: 0x2a1e18, ai: 0.5, bg: 0x040404, ex: 1.05, bloom: 0.6 },
  tunnel: { fog: 0x070a0a, fd: 0.085, hs: 0x2a3a40, hg: 0x14100a, hi: 0.18, am: 0x10161a, ai: 0.35, bg: 0x020303, ex: 1.2, bloom: 0.6 },
  outsideNight: { fog: 0x070e1c, fd: 0.011, hs: 0x1c2c4c, hg: 0x07080a, hi: 0.36, am: 0x0a1226, ai: 0.35, bg: 0x040810, ex: 1.05, bloom: 0.65 },
  outsideGold: { fog: 0xcfa86e, fd: 0.011, hs: 0xb4c6e0, hg: 0x4a3a22, hi: 1.05, am: 0x6a5a40, ai: 0.45, bg: 0xcfa86e, ex: 0.95, bloom: 0.55 },
};

const AREA_LIGHT = { hall: 0.7, eastCorr: 0.8, westCorr: 0.8, canteen: 1.0, intake: 0.85, records: 0.5, library: 0.6, chapel: 0.45, tunnel: 0.15, outside: 0.8 };

export class Game {
  constructor({ canvas, uiRoot, quality = 'high', capture = false, seed = 1337, width = 1280, height = 720, crowd = true, cine = false }) {
    this.crowdOn = crowd; this.crowd = null;
    this.cineOn = cine; this.directorCam = null; this.cineGrade = null; this.cineEv = 0; this.cineBloom = 1; this.cineEnv = null;      // cinematic render mode (?cine): director camera + post passes, visual only
    this.canvas = canvas; this.uiRoot = uiRoot; this.quality = quality; this.capture = capture; this.seed = seed;
    this.width = width; this.height = height;
    this.events = new Emitter();
    this.mode = 'boot'; this.time = 0; this.simTime = 0; this.rng = mulberry32(seed);
    this.npcs = []; this.guards = [];
    this.playerIgnoreTags = null; this.npcIgnoreTags = new Set(['celldoor']);
    this.fade = 1; this.letter = 0; this.fadeTarget = 1; this.fadeSpeed = 1.2;
    this.maxDetect = 0; this.cine = null; this.camOverride = null;
    this.env = {}; this.envKey = 'hall'; this.outsideMode = 'night';
    this.acc = 0; this.last = 0; this.running = false; this.frame = 0;
    this.debug = false; this.carOK = true;
    this.stats = { arrests: 0, dcEarned: 0, startTime: 0 };
    this.route = 'none';
    this.ui = new UI(uiRoot, this);
  }

  // =============================================================================================
  async init(onProgress = () => {}) {
    const t0 = performance.now();
    await loadAllTextures((p, n) => onProgress(p * 0.9, n));
    buildMaterials();
    const gfx = this.gfx = new Gfx(this.canvas, { quality: this.quality, width: this.width, height: this.height, cine: this.cineOn });
    this.scene = gfx.scene;
    this.stage = setupStage(gfx);
    const world = this.world = new World(gfx.scene);
    this.ctx = {
      marks: {},
      windowMat: new THREE.MeshBasicMaterial({ color: 0x0e1a30, fog: false }),
      glassMat: new THREE.MeshBasicMaterial({ map: DECALS.glass, color: 0x202030, fog: false, toneMapped: true }),
    };
    buildHall(world, this.ctx); buildEast(world, this.ctx); buildWest(world, this.ctx); buildTunnel(world, this.ctx);
    const out = buildOutside(world, this.ctx);
    this.sky = out.sky; this.sun = out.sun;
    this.marks = this.ctx.marks;
    onProgress(0.93, 'navigation');
    defineNav(world); this.nav = new Nav(world); this.nav.autoLink(9); linkManual(world);
    this.rig = new LightRig(gfx.scene, gfx.q.pool, 1, gfx.q.shadowMap);
    this.buildHallAtmosphere();
    // systems
    this.routine = new Routine({ secondsPerHour: 45, startHour: 5.9 });
    this.economy = new Economy(50); this.reputation = new Reputation(); this.survival = new Survival();
    this.inventory = new Inventory(8); this.alert = new AlertSystem();
    this.player = new Player(this);
    this.viewmodel = new Viewmodel(gfx.vmCamera);
    this.input = new Input(this.canvas);
    this.story = new Story(this);
    this.story.setup();
    await characters.ready;                                   // glTF characters (MetaHuman exports), if there are any, are loaded before bodies are chosen
    if (characters.enabled) for (const n of this.npcs) n.refreshBody();
    if (this.crowd) { onProgress(0.97, 'crowd'); this.crowd.bake(); }
    this.wire();
    this.applyEnv('hall', true);
    world.setActiveArea('hall');
    this.player.teleport(0.55, 0, -8.6, 0);
    onProgress(1, 'ready');
    this.initMs = performance.now() - t0;
    this.mode = 'ready';
  }

  buildHallAtmosphere() {
    const { world, gfx } = this;
    const hall = world.areas.get('hall');
    // window light with a barred-window cookie (disabled when it's dark)
    const sp = new THREE.SpotLight(0xbcd0ff, 0, 40, 0.5, 0.45, 1.2);
    sp.position.set(-6, 8.4, -9.6); sp.target.position.set(-6, 0, -2.5);
    sp.map = DECALS.window; sp.castShadow = true; sp.shadow.mapSize.set(gfx.q.shadowMap, gfx.q.shadowMap); sp.shadow.bias = -0.0005; sp.shadow.camera.near = 1; sp.shadow.camera.far = 30;
    sp.layers.enable(1);
    hall.group.add(sp); hall.group.add(sp.target);
    this.windowSpot = sp;
    // light shafts through the clerestory windows
    this.shafts = [];
    for (const [x, side] of [[-15, -1], [-9, -1], [-3, -1], [3, 1], [9, 1], [15, 1]]) {
      const a = new THREE.Vector3(x, 8.4, side < 0 ? -9.8 : 9.8), b = new THREE.Vector3(x + 1.5, 0.1, side < 0 ? -3.6 : 3.6);
      const s = lightShaft(a, b, 0.7, 2.1, 0xbdd6ff, 0.0);
      hall.group.add(s); this.shafts.push(s);
    }
    this.dust = dustField([-17, 0.4, -9, 17, 8.5, 9], 420, 0xcfe0ff, 0.045, 0.5);
    hall.group.add(this.dust);
    const cdust = dustField([24, 0.2, -2, 50, 3.4, 2], 120, 0xdff4ec, 0.035, 0.35); world.areas.get('eastCorr').group.add(cdust);
    const cdust2 = dustField([-50, 0.2, -2, -24, 3.4, 2], 120, 0xffe0d0, 0.035, 0.35); world.areas.get('westCorr').group.add(cdust2);
    const chd = dustField([-72, 0.5, -10, -50, 8, 10], 300, 0xffd9a0, 0.05, 0.55); world.areas.get('chapel').group.add(chd);
    this.dusts = [this.dust, cdust, cdust2, chd];
    // chapel stained-glass spot (coloured light pooling on the pews)
    const cs = new THREE.SpotLight(0xffffff, 0, 36, 0.55, 0.5, 1.0);
    cs.position.set(-64, 7.4, -9.6); cs.target.position.set(-62, 0, 2.5);
    cs.map = DECALS.glass; cs.castShadow = true; cs.shadow.mapSize.set(gfx.q.shadowMap, gfx.q.shadowMap); cs.shadow.bias = -0.0006; cs.shadow.camera.near = 1; cs.shadow.camera.far = 28;
    cs.layers.enable(1);
    world.areas.get('chapel').group.add(cs); world.areas.get('chapel').group.add(cs.target);
    this.chapelSpot = cs;
    this.chapelShafts = [];
    for (const x of [-67, -61.7]) { const s = lightShaft(new THREE.Vector3(x, 6.8, -9.7), new THREE.Vector3(x + 2.2, 0.1, -3.5), 0.5, 1.7, 0xffd9b0, 0.0); world.areas.get('chapel').group.add(s); this.chapelShafts.push(s); }
  }

  wire() {
    const { events, routine, economy, reputation, alert, world, ui, audio } = this;
    routine.on('pa', (t) => { ui.pa(t); this.audio && this.audio.pa(t); });
    routine.on('slot', (slot, entry) => { this.events.emit('slot', slot, entry); this.story.onSlot(slot, entry); });
    economy.on('change', (v, d, why) => { ui.setDC(v, d !== 0); if (d !== 0 && this.mode !== 'boot') { ui.toast((d > 0 ? '+' : '') + d + ' DC — ' + why, 'dc'); if (d > 0) this.stats.dcEarned += d; this.audio && this.audio.sfx('coin'); } });
    reputation.on('cred', (v, d, why) => { ui.setRep(reputation); if (why) ui.toast(`Street Cred ${d > 0 ? '+' : ''}${d}${why ? ' — ' + why : ''}`, d > 0 ? 'good' : 'bad'); });
    reputation.on('fear', (v, d, why) => { ui.setRep(reputation); if (why) ui.toast(`Fear ${d > 0 ? '+' : ''}${d}`, ''); });
    reputation.on('standing', (f, v, d, why) => { if (why) ui.toast(`${f}: ${d > 0 ? '+' : ''}${d}${why ? ' — ' + why : ''}`, d > 0 ? 'good' : 'bad'); });
    alert.on('level', (l, p) => { ui.setAlert(l); this.events.emit('alertLevel', l, p); if (l >= 3 && !routine.lockdown) routine.startLockdown(0.4); });
    world.on('door', (d, t) => {
      const dist = d.pos.distanceTo(this.player.eyePos);
      if (dist < 35) {
        const v = clamp(1 - dist / 35, 0.15, 1), name = t ? (d.sound === 'door' ? 'door' : d.sound) : (d.sound === 'door' ? 'doorClose' : d.sound);
        // a whole tier of cell doors releases at once: spread them out and thin each one so the sum stays a rumble, not a wall
        if (this.audio) this.audio.sfx(name, d.sound === 'celldoor' ? { vol: v * 0.35, t: this.audio.now() + (this._cellDoorN = ((this._cellDoorN || 0) + 1) % 12) * 0.11 } : { vol: v });
      }
    });
    this.events.on('step', (e) => { if (this.audio) this.audio.step(e.surface, e.loud, e.who === 'player' ? 1 : 0.4); });
    routine.on('lockdown', (on) => { ui.toast(on ? 'LOCKDOWN' : 'Lockdown lifted', on ? 'bad' : 'good'); });
  }

  /** Create live/offline audio. */
  initAudio(ctx, clock, live = true) {
    this.audio = new AudioEngine(ctx, clock, { seed: this.seed + 17 });
    this.audio.live = live;
    this.audio.start();
    this.audio.setArea(this.envKey === 'hall' ? 'hall' : this.envKey, 'indoor', 0.7);
  }

  // =============================================================================================
  // Environment
  // =============================================================================================
  envFor(area) {
    if (!area) return 'hall';
    switch (area.name) {
      case 'outside': return this.outsideMode === 'gold' ? 'outsideGold' : 'outsideNight';
      case 'tunnel1': case 'tunnel2': return 'tunnel';
      default: return ENV[area.name] ? area.name : 'hall';
    }
  }
  applyEnv(key, snap = false) {
    this.envKey = key;
    this.envTarget = key;
    if (snap) { this._envCur = null; this.stepEnv(0, true); }
  }
  stepEnv(dt, snap = false) {
    const T = ENV[this.envTarget] || ENV.hall;
    const c = this._envCur || (this._envCur = { fd: T.fd, hi: T.hi, ai: T.ai, ex: T.ex, bloom: T.bloom, fog: new THREE.Color(T.fog), hs: new THREE.Color(T.hs), hg: new THREE.Color(T.hg), am: new THREE.Color(T.am), bg: new THREE.Color(T.bg) });
    const k = snap ? 1 : 1 - Math.exp(-3.2 * dt);
    c.fd = lerp(c.fd, T.fd, k); c.hi = lerp(c.hi, T.hi, k); c.ai = lerp(c.ai, T.ai, k); c.ex = lerp(c.ex, T.ex, k); c.bloom = lerp(c.bloom, T.bloom, k);
    const tc = new THREE.Color();
    c.fog.lerp(tc.set(T.fog), k); c.hs.lerp(tc.set(T.hs), k); c.hg.lerp(tc.set(T.hg), k); c.am.lerp(tc.set(T.am), k); c.bg.lerp(tc.set(T.bg), k);
    const { scene, renderer } = this.gfx;
    scene.fog.color.copy(c.fog); scene.fog.density = c.fd;
    scene.background = scene.background || new THREE.Color();
    const out = this.player && this.player.area && this.player.area.name === 'outside';
    scene.background = out ? null : c.bg;
    const cm = this.cineEnv;                                          // director's fill / haze multipliers (cine shots only)
    this.stage.hemi.color.copy(c.hs); this.stage.hemi.groundColor.copy(c.hg); this.stage.hemi.intensity = c.hi * (cm ? cm.hi : 1);
    this.stage.ambient.color.copy(c.am); this.stage.ambient.intensity = c.ai * (cm ? cm.ai : 1);
    if (cm) scene.fog.density = c.fd * cm.fog;
    renderer.toneMappingExposure = c.ex;
    this.gfx.bloom.strength = c.bloom;
  }

  /** 0..1 daylight by clock (windows, shafts, sun). */
  get daylight() {
    const h = this.routine.hour;
    if (h < 5) return 0; if (h < 8) return smoothstep(5, 8.5, h) * 0.9; if (h < 17) return 1; if (h < 20) return 1 - smoothstep(17, 20, h); return 0;
  }
  updateDaylight() {
    const dl = this.daylight, h = this.routine.hour;
    const night = new THREE.Color(0x0b1830), dawn = new THREE.Color(0x4a6aa0), day = new THREE.Color(0xbcd4f4);
    const c = new THREE.Color().copy(night).lerp(dawn, smoothstep(0, 0.45, dl)).lerp(day, smoothstep(0.45, 1, dl));
    this.ctx.windowMat.color.copy(c).multiplyScalar(0.35 + dl * 1.4);
    this.windowSpot.intensity = dl > 0.12 ? dl * 260 : 0;
    this.windowSpot.color.set(h < 8 ? 0x8fb0ff : h > 16.5 ? 0xffb070 : 0xdfe8ff);
    const k = this.player && this.player.area && this.player.area.name === 'hall' ? 1 : 0;
    for (const s of this.shafts) s.material.uniforms.intensity.value = dl * 0.22 * k;
    this.windowSpot.visible = k > 0;
    // chapel glass
    const cd = dl * (this.routine.hour > 12 ? 1 : 0.7);
    this.ctx.glassMat.color.setRGB(0.12 + cd * 0.85, 0.12 + cd * 0.8, 0.16 + cd * 0.75);
    const inChapel = this.player && this.player.area && this.player.area.name === 'chapel';
    this.chapelSpot.intensity = inChapel && dl > 0.1 ? dl * 330 : 0;
    this.chapelSpot.visible = inChapel;
    for (const s of this.chapelShafts) s.material.uniforms.intensity.value = dl * 0.3 * (inChapel ? 1 : 0);
  }
  /** Outside / sky / sun state. */
  updateOutside() {
    const out = this.player.area && this.player.area.name === 'outside' || this.camInOutside;
    const mat = this.sky.material.uniforms;
    if (this.outsideMode === 'gold') {
      mat.zenith.value.set(0x4d78b8); mat.horizon.value.set(0xf0c68c); mat.sunColor.value.set(0xffc27a); mat.sunSize.value = 1; mat.stars.value = 0;
      this.sun.color.set(0xffc990); this.sun.intensity = out ? 4.4 : 0;
      this.sun.position.set(-102 + 40, 22, -32 + 52);
    } else {
      mat.zenith.value.set(0x050a1a); mat.horizon.value.set(0x1a2a46); mat.sunColor.value.set(0x9fb8ff); mat.sunSize.value = 0.0; mat.stars.value = 1;
      this.sun.color.set(0x7f9fe4); this.sun.intensity = out ? 0.75 : 0;
      this.sun.position.set(-102 - 30, 40, -32 + 20);
    }
    mat.sunDir.value.copy(this.sun.position).sub(this.sun.target.position).normalize();
    mat.time.value = this.time;
    this.sun.visible = !!out;
    this.sky.parent.visible = this.world.areas.get('outside').visible;
    this.sky.position.copy(this.gfx.camera.position);
    const night = this.outsideMode === 'night';
    for (const t of this.ctx.towerLights) { t.beam.material.uniforms.k.value = night ? 1 : 0; t.beam.rotation.z = Math.sin(this.time * 0.5 + t.tx) * 0.35; t.beam.rotation.x = Math.cos(this.time * 0.37 + t.tx) * 0.25 + 0.15; }
    for (const f of this.ctx.floods) { f.sp.material.opacity = night ? 0.7 : 0.12; }
    if (this.ctx.beacon) this.ctx.beacon.material.emissiveIntensity = Math.sin(this.time * 3.1) > 0.55 ? 3.2 : 0.15;
    for (const sh of this.ctx.sunShafts || []) { sh.material.uniforms.intensity.value = out && !night ? 0.22 : 0; sh.material.uniforms.time.value = this.time; }
  }
  lightLevelAt(pos) {
    const a = this.world.areaAt(pos.x, pos.z, pos.y + 1);
    let base = a ? (AREA_LIGHT[a.name] ?? 0.6) : 0.5;
    if (a && a.name === 'outside') base = 0.25 + this.daylight * 0.6;
    if (a && a.name === 'hall') base = 0.55 + this.daylight * 0.3;
    return base;
  }

  // =============================================================================================
  // Permissions / consequences
  // =============================================================================================
  isRestricted(pl) {
    const a = pl.area; if (!a) return false;
    const r = this.routine;
    switch (a.name) {
      case 'records': return true;
      case 'hall': return ((r.slot === SLOT.LightsOut || r.slot === SLOT.Count) && !this.story.cellsReleased || r.lockdown) && !this.story.inOwnCell(pl);
      case 'eastCorr': case 'westCorr': return !r.corridorsOpen();
      case 'canteen': return !r.canteenOpen();
      case 'library': case 'chapel': return !r.chapelOpen() && !this.story.flag('chapelGranted');
      case 'intake': return r.slot === SLOT.LightsOut || r.slot === SLOT.Count || (this.player.tampering && this.player.tampering > 0);
      default: return false;
    }
  }
  arrest(guard) {
    if (this.mode !== 'play') return;
    this.stats.arrests++;
    this.story.onArrest(guard);
  }
  cameraAlarm() {
    this.alert.raise(65, 'security camera');
    this.ui.note('SECURITY', 'Camera spotted you — guards are on their way.', 5000);
    this.story.onCameraAlarm();
  }

  // =============================================================================================
  // Modes
  // =============================================================================================
  toTitle() {
    this.mode = 'title';
    this.ui.hud(false); this.ui.hideEnd(); this.ui.show('u-title', true); this.ui.show('u-pause', false); this.ui.clearSay(); this.ui.setChoices([]);
    this.ui.openPanel(false); this.ui.closeDoc(); this.ui.closeShop();
    this.fadeTarget = 0; this.letter = 0;
    this.story.reset(true);
    this.titleT = 0;
    this.audio && this.audio.musicTo('calm');
  }
  newGame() {
    Save.clear();
    this.ui.show('u-title', false); this.ui.hideEnd();
    this.story.reset(false);
    this.story.beginIntro();
  }
  continueGame() {
    const d = Save.read();
    if (!d) return this.newGame();
    this.ui.show('u-title', false); this.story.reset(false); this.loadState(d);
  }
  saveState() {
    const s = { v: 2, routine: this.routine.serialize(), economy: this.economy.serialize(), rep: this.reputation.serialize(), surv: this.survival.serialize(), inv: this.inventory.serialize(), alert: this.alert.serialize(), story: this.story.serialize(), pos: [this.player.pos.x, this.player.pos.y, this.player.pos.z, this.player.yaw] };
    return s;
  }
  loadState(d) {
    this.routine.load(d.routine); this.economy.load(d.economy); this.reputation.load(d.rep); this.survival.load(d.surv); this.inventory.load(d.inv); this.alert.load(d.alert);
    this.story.load(d.story); this.player.teleport(d.pos[0], d.pos[1], d.pos[2], d.pos[3]);
    this.ui.setRep(this.reputation); this.ui.setDC(this.economy.balance);
    this.mode = 'play'; this.ui.hud(true); this.fadeTarget = 0; this.letter = 0;
    this.input.lock();
  }
  save() { if (Save.write(this.saveState())) this.ui.toast('Game saved', 'good'); }
  pause(on) {
    if (on && this.mode === 'play') { this.prevMode = 'play'; this.mode = 'paused'; this.ui.show('u-pause', true); this.input.unlock(); }
    else if (!on && this.mode === 'paused') { this.mode = 'play'; this.ui.show('u-pause', false); this.input.lock(); }
  }

  // =============================================================================================
  // Main loop
  // =============================================================================================
  start() {
    this.running = true; this.last = performance.now() / 1000;
    const loop = (ts) => {
      if (!this.running) return;
      requestAnimationFrame(loop);
      const now = ts / 1000;
      let dt = Math.min(0.1, now - this.last); this.last = now;
      if (this.manual) return;
      this.acc += dt;
      let n = 0;
      while (this.acc >= STEP && n < 6) { if (this.bot) this.bot.tick(); this.step(STEP); this.acc -= STEP; n++; }
      if (n === 6) this.acc = 0;
      // live mouse-look is applied per rendered frame for responsiveness
      this.render(this.acc / STEP, dt);
      if (this.debug) { this._fa = (this._fa || 0) * 0.9 + dt * 0.1; this.ui.fps((1 / this._fa).toFixed(0) + ' fps · ' + this.gfx.renderer.info.render.calls + ' calls · area ' + (this.player.area ? this.player.area.name : '?')); }
    };
    requestAnimationFrame(loop);
  }

  /** Advance the simulation by `n` fixed steps (used by the playtest bot and the capture tool). */
  advance(n = 1) { for (let i = 0; i < n; i++) this.step(STEP); }

  step(dt) {
    this.time += dt; this.simTime += dt;
    const inp = this.input.snapshot();
    if (!this.input.virtual && this.mode === 'play' && this.input.locked) { const [dx, dy] = this.input.takeLook(); this.player.addLook(dx, dy); }
    const mode = this.mode;
    this.updateFade(dt);
    if (mode === 'boot' || mode === 'ready') return;
    this.ui.tick(dt);
    this.story.input(inp, dt);
    const running = mode === 'play' || mode === 'dialogue' || mode === 'cine' || mode === 'title' || mode === 'end';
    if (mode === 'paused') return;
    // world clock halts during conversation / cinematic / reading
    const clockRuns = mode === 'play' && !this.ui.shopOpen && !this.ui.docOpen && !this.ui.panelOpen;
    const waiting = clockRuns && inp.held.wait && this.story.canWait();
    this.routine.timeScale = waiting ? 14 : 1; this.routine.paused = !clockRuns && mode !== 'title';
    if (mode === 'title') this.routine.paused = true;
    this.routine.update(dt);
    this.world.update(dt);
    this.updateDoors(dt);
    this.player.update(dt, inp, this.world);
    // area transitions
    const area = this.player.area;
    if (area !== this._area && area) { this._area = area; this.onArea(area); }
    for (const n of this.npcs) { n.area = this.world.areaAt(n.pos.x, n.pos.z, n.pos.y + 1); n.update(dt); }
    if (this.crowd) this.crowd.update(dt);
    for (const c of this.cams || []) c.update(dt);
    this.maxDetect = 0; for (const g of this.guards) this.maxDetect = Math.max(this.maxDetect, g.detect || 0);
    for (const c of this.cams || []) this.maxDetect = Math.max(this.maxDetect, c.detect || 0);
    if (mode === 'play') {
      this.survival.update(dt, this.routine, this.player);
      this.alert.update(dt);
      this.viewmodel.update(dt, this);
    } else this.viewmodel.update(dt, this);
    this.story.update(dt, inp);
    this.updateCine(dt);
    this.stepEnv(dt);
    this.updateDaylight(); this.updateOutside();
    this.updateHud(dt);
    if (this.audio) this.audio.update(dt, this);
    this.frame++;
  }

  onArea(area) {
    this.world.setActiveArea(area.name);
    this.applyEnv(this.envFor(area));
    if (this.audio) this.audio.setArea(area.name, area.tag, area.reverb);
    this.story.onArea(area);
    this.events.emit('area', area);
  }

  updateFade(dt) {
    this.fade = damp(this.fade, this.fadeTarget, 1 / Math.max(0.05, this.fadeSpeed) * 3, dt);
    if (Math.abs(this.fade - this.fadeTarget) < 0.004) this.fade = this.fadeTarget;
    const u = this.gfx ? this.gfx.u : null;
    if (u) { u.fade.value = this.fade; u.letter.value = damp(u.letter.value, this.letter, 5, dt); }
  }

  // ---- doors ---------------------------------------------------------------------------------
  entitiesNear(p, r) {
    const pl = this.player;
    if (Math.abs(pl.pos.y - p.y) < 3 && Math.hypot(pl.pos.x - p.x, pl.pos.z - p.z) < r) return true;
    for (const n of this.npcs) if (n.alive && !n.hiddenFromWorld && Math.abs(n.pos.y - p.y) < 3 && Math.hypot(n.pos.x - p.x, n.pos.z - p.z) < r) return true;
    return false;
  }
  updateDoors(dt) {
    const r = this.routine, st = this.story;
    for (const d of this.world.doors.values()) {
      const id = d.id;
      let allowed = true, auto = true, rad = 2.3;
      if (id.startsWith('cell-')) { allowed = !r.cellsLocked() || st.cellsReleased; auto = false; d.locked = !allowed; if (allowed) d.setOpen(true); else d.setOpen(false); continue; }
      if (id.startsWith('gate-sally')) { allowed = r.corridorsOpen(); rad = 3.8; d.locked = !allowed; }
      else if (id === 'door-canteen') { allowed = r.canteenOpen(); d.locked = !allowed; }
      else if (id === 'door-library') { allowed = r.chapelOpen() || r.slot === SLOT.FreeTime; d.locked = !allowed; }
      else if (id === 'door-chapel') { allowed = r.chapelOpen() || st.flag('chapelGranted'); d.locked = !allowed; rad = 2.6; }
      else if (id === 'door-records') { allowed = st.recordsUnlocked(); d.locked = !allowed; }
      else if (id === 'door-visit') { allowed = false; d.locked = true; }
      if (!allowed) { d.setOpen(false); continue; }
      if (this.entitiesNear(d.pos, rad)) d.setOpen(true);
      else if (!this.entitiesNear(d.pos, rad + 1.2)) { if (d.target) { d.closeT = (d.closeT || 0) + dt; if (d.closeT > 1.2) { d.setOpen(false); d.closeT = 0; } } }
      if (this.entitiesNear(d.pos, rad + 1.2)) d.closeT = 0;
    }
  }

  // ---- cinematics ------------------------------------------------------------------------------
  playCine(def) { this._cineArea = null; for (const ev of def.events || []) delete ev.done; this.cine = { def, t: 0, i: 0, showArms: !!def.showArms }; this.prevMode2 = this.mode; this.mode = 'cine'; this.letter = def.letter === false ? 0 : 1; this.player.frozen = true; if (def.onStart) def.onStart(this); }
  updateCine(dt) {
    const c = this.cine; if (!c) return;
    c.t += dt;
    const d = c.def;
    if (d.tick) d.tick(this, c.t);
    for (const ev of d.events || []) { if (!ev.done && c.t >= ev.at) { ev.done = true; ev.fn(this); } }
    if (c.t >= d.dur) { this.camInOutside = false; const cb = d.onEnd; this.cine = null; this.camOverride = null; this.letter = 0; this.player.frozen = false; if (this.mode === 'cine') this.mode = 'play'; for (const ev of d.events || []) delete ev.done; if (cb) cb(this); return; }
    // find shot
    const sh = d.shots.find((s) => c.t >= s.t0 && c.t < s.t1) || d.shots[d.shots.length - 1];
    const k = clamp((c.t - sh.t0) / (sh.t1 - sh.t0), 0, 1), e = sh.ease === false ? k : k * k * (3 - 2 * k);
    const f = typeof sh.from === 'function' ? sh.from(this) : sh.from, to = typeof sh.to === 'function' ? sh.to(this) : sh.to;
    const pos = new THREE.Vector3().fromArray(f.p).lerp(new THREE.Vector3().fromArray(to.p), e);
    const look = new THREE.Vector3().fromArray(f.l).lerp(new THREE.Vector3().fromArray(to.l), e);
    this.camOverride = { pos, look, fov: lerp(f.fov || 60, to.fov || f.fov || 60, e), roll: lerp(f.roll || 0, to.roll || 0, e), area: sh.area || null, outside: !!sh.outside };
    if (sh.outside !== undefined) this.camInOutside = !!sh.outside;
    if (sh.area && sh.area !== this._cineArea) {
      this._cineArea = sh.area;
      this.world.setActiveArea(sh.area);
      const a = this.world.areas.get(sh.area);
      this.applyEnv(sh.env || this.envFor(a));
      if (this.audio && a) this.audio.setArea(a.name, a.tag, a.reverb);
    }
  }

  // ---- HUD -------------------------------------------------------------------------------------
  updateHud(dt) {
    const ui = this.ui, r = this.routine, p = this.player;
    if (this.mode === 'title' || this.mode === 'boot') return;
    ui.el('hud').classList.toggle('dlg', this.mode === 'dialogue');
    const e = r.entry; const prog = e ? clamp(((r.hour - e.start + 24) % 24) / e.dur, 0, 1) : 0;
    ui.setClock(r.clock, r.day, r.label, prog);
    ui.setVitals(this.survival.health, this.survival.hunger, this.survival.thirst, p.stamina);
    ui.setObjective(this.story.objectiveText());
    ui.setDetect(this.maxDetect);
    const o = this.story.objectivePos();
    this._miniT = (this._miniT || 0) + dt;
    if (this._miniT > 0.1 && !ui.el('u-mini').classList.contains('off')) { this._miniT = 0; ui.drawMinimap(this); }
  }

  // =============================================================================================
  // Rendering
  // =============================================================================================
  render(alpha = 1, dt = 1 / 60) {
    const gfx = this.gfx; if (!gfx) return;
    const cam = gfx.camera;
    if (this.directorCam) {
      const c = this.directorCam;
      cam.position.copy(c.pos); cam.lookAt(c.look); if (c.roll) cam.rotateZ(c.roll); cam.fov = c.fov; cam.updateProjectionMatrix();
    } else if (this.camOverride && (this.mode === 'cine' || this.mode === 'title')) {
      const c = this.camOverride;
      cam.position.copy(c.pos); cam.lookAt(c.look); cam.rotateZ(c.roll || 0); cam.fov = c.fov; cam.updateProjectionMatrix();
    } else if (this.mode === 'dialogue' && this.story.dialogueCam) {
      const dc = this.story.dialogueCam;
      cam.position.copy(dc.pos); cam.lookAt(dc.look); cam.fov = dc.fov; cam.updateProjectionMatrix();
    } else this.player.applyCamera(cam, alpha);
    cam.updateMatrixWorld(true);
    // audio listener follows camera (no-op for Web Audio mono mix)
    this.rig.update(dt, this.time, this.world.fixtures, cam.position, this.world.activeAreas);
    this.animateFixtures();
    // bring the sprite glow near tubes in sync with flicker
    gfx.u.grain.value = 0.03 * gfx.q.grain;
    this.applyGradeState();
    if (this.directorCam && this._envCur) {
      const c = this._envCur, m = this.cineEnv;
      gfx.renderer.toneMappingExposure = c.ex * Math.pow(2, this.cineEv); gfx.bloom.strength = c.bloom * this.cineBloom;
      this.stage.hemi.intensity = c.hi * (m ? m.hi : 1); this.stage.ambient.intensity = c.ai * (m ? m.ai : 1); if (m) this.scene.fog.density = c.fd * m.fog;
    }
    gfx.render(this.time);
  }
  /** Fixture mesh emissive flicker + candle flames + alarm lamps (pure functions of time → deterministic). */
  animateFixtures() {
    const t = this.time;
    for (const f of this.world.fixtures) {
      if (!f.mesh) continue;
      let k = 1;
      if (f.flicker > 0) k = 1 - f.flicker * (0.5 + 0.5 * Math.sin(t * 37 + f.pos.x * 3.1)) * (hash01(Math.floor(t * 12) + f.pos.x * 17) > 0.6 ? 1 : 0.15);
      f.mesh.material.emissiveIntensity = (f.baseEI || 2) * k * f.on;
      if (f.sprite) f.sprite.material.opacity = (f.sprite.userData.baseOpacity || 0.5) * k * f.on;
    }
    if (this.ctx.candles) for (const c of this.ctx.candles) {
      const k = 0.85 + 0.15 * Math.sin(t * 13 + c.flame.position.x * 5) + 0.08 * Math.sin(t * 31 + c.flame.position.z);
      c.flame.scale.set(0.8, 1.6 * k, 0.8); c.sp.material.opacity = 0.55 + 0.25 * k;
    }
    const al = this.alert.level >= 2;
    if (this.ctx.alarmLamps) for (const l of this.ctx.alarmLamps) l.material.emissiveIntensity = al ? 2.5 + 2.2 * Math.sin(t * 8 + l.position.x) : 0;
    for (const d of this.dusts) d.material.uniforms.time.value = t;
    for (const s of this.shafts) s.material.uniforms.time.value = t;
    for (const s of this.chapelShafts) s.material.uniforms.time.value = t;
  }
  applyGradeState() {
    const u = this.gfx.u, p = this.player;
    const lvl = this.alert.level;
    u.alarm.value = lvl >= 2 ? 0.5 + 0.5 * Math.sin(this.time * 6) : 0;
    u.suspicion.value = this.maxDetect;
    u.damage.value = clamp((35 - this.survival.health) / 35, 0, 1) * 0.6;
    const out = this.player.area && this.player.area.name === 'outside' && this.outsideMode === 'gold';
    const tun = this.player.area && this.player.area.tag === 'tunnel';
    u.sat.value = damp(u.sat.value, out ? 1.12 : tun ? 0.78 : 0.88, 3, 1 / 60);
    u.gain.value.set(out ? 1.08 : 1.03, out ? 1.0 : 1.0, out ? 0.9 : 0.98);
    u.lift.value.set(out ? 0.012 : 0.0, out ? 0.006 : 0.004, out ? 0.0 : 0.014);
    u.vignette.value = out ? 0.42 : 0.6;
    u.blur.value = this.blur || 0;
    u.eyelid.value = this.eyelid || 0;
    u.flash.value = this.flash || 0;
    if (this.cineOn) {                                              // per-shot grade from the director (cine mode only); the cine-only uniforms fall back to neutral
      const cg = this.cineGrade || {};
      if (cg.sat !== undefined) u.sat.value = cg.sat;
      if (cg.contrast !== undefined) u.contrast.value = cg.contrast; else u.contrast.value = 1.08;
      if (cg.vignette !== undefined) u.vignette.value = cg.vignette;
      if (cg.ca !== undefined) u.ca.value = cg.ca; else u.ca.value = 0.0007;
      if (cg.gain) u.gain.value.set(cg.gain[0], cg.gain[1], cg.gain[2]);
      if (cg.lift) u.lift.value.set(cg.lift[0], cg.lift[1], cg.lift[2]);
      if (cg.grain !== undefined) u.grain.value = cg.grain;
      u.shadowTint.value.set(...(cg.shadowTint || [0, 0, 0])); u.highlightTint.value.set(...(cg.highlightTint || [0, 0, 0])); u.blackLift.value = cg.blackLift || 0; u.dither.value = 1;
    }
  }
}
