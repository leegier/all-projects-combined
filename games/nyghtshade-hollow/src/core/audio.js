// Fully procedural WebAudio engine: room tone, fluorescent hum, dark-ambient drone, footsteps per surface, doors, gates,
// PA chimes, heartbeat, birds, wind, bell. Every time-dependent call is scheduled against `clock()` so the same code runs live
// (AudioContext) and offline (OfflineAudioContext driven by the simulation clock) for the recorded video soundtrack.
import { mulberry32, clamp, lerp } from '../util.js';

function noiseBuffer(ctx, seconds, kind = 'white', seed = 1) {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  const rnd = mulberry32(seed);
  let b0 = 0, b1 = 0, b2 = 0, last = 0;
  for (let i = 0; i < n; i++) {
    const w = rnd() * 2 - 1;
    if (kind === 'pink') { b0 = 0.99765 * b0 + w * 0.0990460; b1 = 0.96300 * b1 + w * 0.2965164; b2 = 0.57000 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; }
    else if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    else d[i] = w;
  }
  return buf;
}
function impulse(ctx, seconds, decay, seed = 5) {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  const rnd = mulberry32(seed);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      lp += ((rnd() * 2 - 1) - lp) * (0.55 - 0.45 * t);   // darker over time
      d[i] = lp * Math.pow(1 - t, decay) * (i < 400 ? i / 400 : 1);
    }
  }
  return buf;
}

export class AudioEngine {
  constructor(ctx, clock, { seed = 4242 } = {}) {
    this.ctx = ctx; this.clock = clock;
    this.rng = mulberry32(seed);
    this.log = [];                                 // [{t,type,...}] for the capture mixer
    this.master = ctx.createGain(); this.master.gain.value = 0.9;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 32; hp.Q.value = 0.6;      // nothing useful below this, it only eats headroom
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 4; comp.attack.value = 0.01; comp.release.value = 0.25;
    const lim = ctx.createDynamicsCompressor();                                                                  // brick-wall-ish limiter so stacked one-shots never clip
    lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.12;
    this.master.connect(hp); hp.connect(comp); comp.connect(lim); lim.connect(ctx.destination);
    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = 0.9; this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain(); this.musicBus.gain.value = 0.55; this.musicBus.connect(this.master);
    this.ambBus = ctx.createGain(); this.ambBus.gain.value = 0.8; this.ambBus.connect(this.master);
    // reverb
    this.verb = ctx.createConvolver(); this.verb.buffer = impulse(ctx, 3.4, 2.3);
    this.verbGain = ctx.createGain(); this.verbGain.gain.value = 0.35; this.verb.connect(this.verbGain); this.verbGain.connect(this.master);
    this.send = ctx.createGain(); this.send.gain.value = 0.5; this.send.connect(this.verb);
    this.sfxBus.connect(this.send);
    this.ambBus.connect(this.send);
    this.white = noiseBuffer(ctx, 3, 'white', 1); this.pink = noiseBuffer(ctx, 4, 'pink', 2); this.brown = noiseBuffer(ctx, 4, 'brown', 3);
    this.area = 'hall'; this.tag = 'indoor';
    this.nextEvent = 0; this.nextBird = 0; this.nextDrip = 0; this.tension = 0; this.alarmOn = false; this.musicMode = 'none';
    this.voiceCool = 0;
    this._built = false;
  }
  now() { return this.clock(); }

  // ---- long-running layers -------------------------------------------------------------------
  start() {
    if (this._built) return; this._built = true;
    const c = this.ctx, t = this.now();
    const loop = (buf, dest, { f = 0, q = 1, type = 'lowpass', g = 0.2 } = {}) => {
      const s = c.createBufferSource(); s.buffer = buf; s.loop = true;
      const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const gn = c.createGain(); gn.gain.value = g;
      s.connect(fl); fl.connect(gn); gn.connect(dest); s.start(t);
      return { s, fl, gn };
    };
    this.room = loop(this.pink, this.ambBus, { f: 380, g: 0.22 });
    this.wind = loop(this.pink, this.ambBus, { f: 700, type: 'bandpass', q: 0.5, g: 0.0 });
    this.rumble = loop(this.brown, this.ambBus, { f: 90, g: 0.08 });
    // fluorescent hum
    const hum = c.createGain(); hum.gain.value = 0.028; hum.connect(this.ambBus);
    for (const f of [100, 200, 300]) { const o = c.createOscillator(); o.type = f === 100 ? 'sawtooth' : 'sine'; o.frequency.value = f; const gg = c.createGain(); gg.gain.value = f === 100 ? 0.4 : 0.2; o.connect(gg); gg.connect(hum); o.start(t); }
    this.humGain = hum;
    // drone pad (dark ambient)
    this.droneGain = c.createGain(); this.droneGain.gain.value = 0.0; this.droneGain.connect(this.musicBus);
    const dl = c.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 260; dl.Q.value = 2; dl.connect(this.droneGain); this.droneFilter = dl;
    for (const [f, dt] of [[55, 0], [55.4, 4], [82.4, -3], [110.3, 5], [164.8, -6]]) {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = dt;
      const gg = c.createGain(); gg.gain.value = f > 100 ? 0.12 : 0.3; o.connect(gg); gg.connect(dl); o.start(t);
      const lfo = c.createOscillator(); lfo.frequency.value = 0.05 + this.rng() * 0.08; const lg = c.createGain(); lg.gain.value = 3; lfo.connect(lg); lg.connect(o.detune); lfo.start(t);
    }
    // tension: dissonant minor second + sub pulse
    this.tensionGain = c.createGain(); this.tensionGain.gain.value = 0; this.tensionGain.connect(this.musicBus);
    for (const f of [329.6, 349.2, 233.1]) { const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f; const gg = c.createGain(); gg.gain.value = 0.1; o.connect(gg); gg.connect(this.tensionGain); o.start(t); }
    // warm pad (chapel / finale): D major add9
    this.warmGain = c.createGain(); this.warmGain.gain.value = 0; this.warmGain.connect(this.musicBus);
    const wl = c.createBiquadFilter(); wl.type = 'lowpass'; wl.frequency.value = 1400; wl.connect(this.warmGain);
    for (const [f, dt] of [[146.8, 0], [220, 3], [293.7, -3], [370, 5], [440, -4], [554.4, 2]]) { const o = c.createOscillator(); o.type = f < 300 ? 'triangle' : 'sine'; o.frequency.value = f; o.detune.value = dt; const gg = c.createGain(); gg.gain.value = 0.16; o.connect(gg); gg.connect(wl); o.start(t); }
    // alarm siren
    this.alarmGain = c.createGain(); this.alarmGain.gain.value = 0; this.alarmGain.connect(this.sfxBus);
    this.alarmOsc = c.createOscillator(); this.alarmOsc.type = 'square'; this.alarmOsc.frequency.value = 620; const af = c.createBiquadFilter(); af.type = 'lowpass'; af.frequency.value = 1400; this.alarmOsc.connect(af); af.connect(this.alarmGain); this.alarmOsc.start(t);
    this.alarmLfo = c.createOscillator(); this.alarmLfo.frequency.value = 1.1; const alg = c.createGain(); alg.gain.value = 230; this.alarmLfo.connect(alg); alg.connect(this.alarmOsc.frequency); this.alarmLfo.start(t);
    this.setArea('hall', 'indoor', 0.7);
    this.musicTo('calm');
  }

  setArea(name, tag, reverb = 0.4) {
    if (!this._built) return;
    const t = this.now(), tc = 0.35;
    this.area = name; this.tag = tag;
    const outdoor = tag === 'outdoor', tunnel = tag === 'tunnel';
    this.send.gain.setTargetAtTime(outdoor ? 0.08 : 0.2 + reverb * 0.7, t, tc);
    this.room.gn.gain.setTargetAtTime(outdoor ? 0.03 : tunnel ? 0.28 : 0.2, t, tc);
    this.room.fl.frequency.setTargetAtTime(tunnel ? 160 : name === 'hall' ? 420 : 320, t, tc);
    this.wind.gn.gain.setTargetAtTime(outdoor ? 0.22 : 0.0, t, 1.0);
    this.humGain.gain.setTargetAtTime(outdoor || tunnel || name === 'chapel' ? 0 : name === 'hall' ? 0.03 : 0.022, t, tc);
    this.rumble.gn.gain.setTargetAtTime(outdoor ? 0.015 : tunnel ? 0.12 : 0.07, t, tc);
    this.verbGain.gain.setTargetAtTime(outdoor ? 0.15 : 0.35 + reverb * 0.5, t, tc);
    this.log.push({ t, type: 'area', name });
  }
  /** Music state: calm | tension | chapel | finale | tunnel | none */
  musicTo(mode) {
    if (!this._built) return; this.musicMode = mode;
    const t = this.now();
    const m = { calm: [0.07, 0, 0], tension: [0.08, 0.1, 0], chapel: [0.025, 0, 0.1], tunnel: [0.1, 0.0, 0.04], finale: [0.0, 0, 0.2], none: [0, 0, 0] }[mode] || [0, 0, 0];
    this.droneGain.gain.setTargetAtTime(m[0], t, mode === 'finale' ? 2.5 : 1.2);
    this.tensionGain.gain.setTargetAtTime(m[1], t, 0.6);
    this.warmGain.gain.setTargetAtTime(m[2], t, mode === 'finale' ? 3.5 : 1.8);
    this.droneFilter.frequency.setTargetAtTime(mode === 'tunnel' ? 150 : 260, t, 1.5);
    this.log.push({ t, type: 'music', mode });
  }
  setAlarm(on) {
    if (!this._built || on === this.alarmOn) return; this.alarmOn = on;
    this.alarmGain.gain.setTargetAtTime(on ? 0.05 : 0, this.now(), 0.15);
    this.log.push({ t: this.now(), type: 'alarm', on });
  }

  // ---- one-shots -----------------------------------------------------------------------------
  _src(buf, t, dur, { f = 800, q = 1, type = 'bandpass', g = 0.3, attack = 0.002, dest = null, rate = 1, pan = 0, toF = null } = {}) {
    const c = this.ctx;
    const s = c.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); if (toF) fl.frequency.exponentialRampToValueAtTime(toF, t + dur); fl.Q.value = q;
    const gn = c.createGain(); gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(Math.max(0.0002, g), t + attack); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(gn);
    let out = gn;
    if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; gn.connect(p); out = p; }
    out.connect(dest || this.sfxBus);
    s.start(t, this.rng() * 2); s.stop(t + dur + 0.05);
    return s;
  }
  _tone(t, f0, dur, { type = 'sine', f1 = null, g = 0.2, attack = 0.004, dest = null, vib = 0 } = {}) {
    const c = this.ctx, o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const gn = c.createGain(); gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(Math.max(0.0002, g), t + attack); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn); gn.connect(dest || this.sfxBus);
    if (vib) { const l = c.createOscillator(); l.frequency.value = 7; const lg = c.createGain(); lg.gain.value = vib; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur); }
    o.start(t); o.stop(t + dur + 0.05);
  }
  _metal(t, base, g = 0.2, dur = 1.2, dest = null) {
    for (const [m, gg, d] of [[1, 1, 1], [2.76, 0.6, 0.7], [5.4, 0.4, 0.5], [8.93, 0.25, 0.35]]) this._tone(t, base * m, dur * d, { g: g * gg, dest });
  }
  gainAt(vol, pos) { return vol; }

  sfx(name, opt = {}) {
    if (!this._built) return;
    const t = (opt.t !== undefined ? opt.t : this.now()), v = opt.vol === undefined ? 1 : opt.vol;
    this.log.push({ t, type: 'sfx', name });
    switch (name) {
      case 'door': this._src(this.brown, t, 0.35, { f: 260, g: 0.5 * v }); this._tone(t, 160, 0.18, { f1: 60, g: 0.4 * v }); this._tone(t + 0.04, 920, 0.5, { f1: 700, g: 0.04 * v, vib: 12 }); break;
      case 'doorClose': this._src(this.brown, t, 0.3, { f: 220, g: 0.55 * v }); this._tone(t, 130, 0.22, { f1: 45, g: 0.5 * v }); this._metal(t + 0.01, 360, 0.08 * v, 0.5); break;
      case 'celldoor': this._src(this.brown, t, 1.5, { f: 340, type: 'lowpass', g: 0.3 * v, attack: 0.08 }); this._src(this.pink, t, 1.4, { f: 1200, q: 3, g: 0.06 * v }); this._metal(t + 1.4, 520, 0.18 * v, 1.6); this._tone(t + 1.38, 70, 0.3, { f1: 38, g: 0.28 * v }); break;
      case 'gate': this._tone(t, 118, 0.7, { type: 'square', g: 0.07 * v }); this._src(this.brown, t + 0.6, 2.0, { f: 300, type: 'lowpass', g: 0.5 * v, attack: 0.1 }); this._src(this.pink, t + 0.7, 1.8, { f: 2200, q: 4, g: 0.05 * v }); this._metal(t + 2.5, 420, 0.3 * v, 1.8); break;
      case 'buzzer': this._tone(t, 120, 0.9, { type: 'square', g: 0.09 * v }); this._tone(t, 240, 0.9, { type: 'square', g: 0.04 * v }); break;
      case 'keycard': this._tone(t, 1760, 0.1, { g: 0.12 * v }); this._tone(t + 0.14, 2349, 0.12, { g: 0.12 * v }); this._src(this.white, t + 0.32, 0.06, { f: 1800, g: 0.2 * v }); break;
      case 'denied': this._tone(t, 220, 0.14, { type: 'square', g: 0.09 * v }); this._tone(t + 0.18, 165, 0.22, { type: 'square', g: 0.09 * v }); break;
      case 'coin': for (let i = 0; i < 3; i++) this._metal(t + i * 0.07, 2100 + i * 220, 0.05 * v, 0.28); break;
      case 'eat': for (let i = 0; i < 4; i++) this._src(this.white, t + i * 0.22, 0.11, { f: 2500, q: 0.8, g: 0.18 * v }); break;
      case 'drink': for (let i = 0; i < 3; i++) this._tone(t + i * 0.28, 260, 0.22, { f1: 150, g: 0.12 * v }); this._src(this.pink, t, 0.9, { f: 900, g: 0.04 * v }); break;
      case 'mop': this._src(this.pink, t, 0.7, { f: 500, toF: 1600, q: 0.7, g: 0.14 * v, attack: 0.1 }); this._src(this.pink, t + 0.6, 0.7, { f: 1600, toF: 500, q: 0.7, g: 0.14 * v, attack: 0.1 }); break;
      case 'lift': this._src(this.brown, t, 3.2, { f: 150, type: 'lowpass', g: 0.7 * v, attack: 0.4 }); this._src(this.pink, t + 0.2, 3.0, { f: 420, toF: 220, q: 2, g: 0.1 * v, attack: 0.5 }); break;
      case 'thud': this._tone(t, 90, 0.3, { f1: 35, g: 0.7 * v }); this._src(this.brown, t, 0.25, { f: 200, type: 'lowpass', g: 0.5 * v }); break;
      case 'paper': this._src(this.white, t, 0.22, { f: 5200, type: 'highpass', g: 0.1 * v, attack: 0.03 }); this._src(this.white, t + 0.16, 0.16, { f: 4800, type: 'highpass', g: 0.08 * v }); break;
      case 'ui': this._tone(t, 1250, 0.05, { g: 0.07 * v }); break;
      case 'uiOk': this._tone(t, 880, 0.08, { g: 0.08 * v }); this._tone(t + 0.07, 1320, 0.12, { g: 0.08 * v }); break;
      case 'chime': this._tone(t, 659.3, 0.9, { g: 0.12 * v }); this._tone(t + 0.45, 523.3, 1.3, { g: 0.12 * v }); this._tone(t, 1318, 0.5, { g: 0.03 * v }); break;
      case 'heartbeat': this._tone(t, 62, 0.16, { f1: 38, g: 0.5 * v }); this._tone(t + 0.22, 58, 0.14, { f1: 36, g: 0.35 * v }); break;
      case 'bell': this._metal(t, 196, 0.2 * v, 6.0); this._metal(t + 0.02, 98, 0.16 * v, 7.0); break;
      case 'clang': this._metal(t, 300 + this.rng() * 260, 0.16 * v, 2.2, this.send); this._src(this.white, t, 0.04, { f: 3000, g: 0.1 * v }); break;
      case 'keys': for (let i = 0; i < 6; i++) this._metal(t + i * 0.06 + this.rng() * 0.03, 2400 + this.rng() * 1500, 0.025 * v, 0.2); break;
      case 'splash': this._src(this.white, t, 0.18, { f: 1400, q: 0.7, g: 0.12 * v }); this._tone(t, 900, 0.08, { f1: 400, g: 0.05 * v }); break;
      case 'drip': this._tone(t, 1500, 0.09, { f1: 700, g: 0.05 * v }); break;
      case 'shout': { const dur = 0.5 + this.rng() * 0.5, f = 100 + this.rng() * 60; const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * (0.7 + this.rng() * 0.6), t + dur); const b1 = this.ctx.createBiquadFilter(); b1.type = 'bandpass'; b1.frequency.value = 650; b1.Q.value = 5; const b2 = this.ctx.createBiquadFilter(); b2.type = 'bandpass'; b2.frequency.value = 1150; b2.Q.value = 5; const gn = this.ctx.createGain(); gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(0.1 * v, t + 0.08); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(b1); o.connect(b2); b1.connect(gn); b2.connect(gn); gn.connect(this.send); gn.connect(this.sfxBus); o.start(t); o.stop(t + dur + 0.1); break; }
      case 'car': this._src(this.pink, t, 6, { f: 200, toF: 900, q: 0.6, g: 0.18 * v, attack: 2.4, dest: this.ambBus }); this._src(this.pink, t + 2.6, 4, { f: 900, toF: 180, q: 0.6, g: 0.12 * v, attack: 0.4, dest: this.ambBus }); break;
      default: break;
    }
  }
  step(surface = 'concrete', loud = 0.6, vol = 1) {
    if (!this._built) return;
    const t = this.now(), v = loud * vol, r = this.rng();
    this.log.push({ t, type: 'step', s: surface, l: loud });
    switch (surface) {
      case 'metal': this._src(this.white, t, 0.12, { f: 1700 + r * 400, q: 1.5, g: 0.22 * v }); this._tone(t, 520 + r * 80, 0.18, { g: 0.04 * v }); this._tone(t, 85, 0.1, { f1: 50, g: 0.3 * v }); break;
      case 'stone': this._src(this.white, t, 0.1, { f: 1100 + r * 300, q: 1, g: 0.2 * v }); this._tone(t, 80, 0.12, { f1: 45, g: 0.32 * v }); break;
      case 'dirt': this._src(this.pink, t, 0.14, { f: 700 + r * 200, type: 'lowpass', q: 0.5, g: 0.25 * v }); this._tone(t, 70, 0.1, { f1: 45, g: 0.15 * v }); break;
      case 'wet': this._src(this.white, t, 0.16, { f: 1300, q: 0.7, g: 0.16 * v }); this._tone(t, 90, 0.1, { f1: 50, g: 0.2 * v }); break;
      default: this._src(this.white, t, 0.1, { f: 900 + r * 200, q: 1.1, g: 0.2 * v }); this._tone(t, 90 + r * 10, 0.1, { f1: 50, g: 0.3 * v });
    }
  }
  /** Quiet talk blip per syllable. */
  voice(pitch = 110, vol = 1) {
    if (!this._built) return;
    const t = this.now(); if (t < this.voiceCool) return; this.voiceCool = t + 0.055;
    const c = this.ctx, o = c.createOscillator(); o.type = 'sawtooth';
    const f = pitch * (0.9 + this.rng() * 0.3); o.frequency.setValueAtTime(f, t);
    const b = c.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = 500 + this.rng() * 700; b.Q.value = 3;
    const gn = c.createGain(); gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(0.045 * vol, t + 0.012); gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.075);
    o.connect(b); b.connect(gn); gn.connect(this.sfxBus); o.start(t); o.stop(t + 0.1);
  }
  pa(text) {
    this.sfx('chime');
    this.log.push({ t: this.now() + 1.0, type: 'pa', text });
    if (this.live && typeof speechSynthesis !== 'undefined') {
      try { const u = new SpeechSynthesisUtterance(text.toLowerCase()); u.rate = 0.9; u.pitch = 0.55; u.volume = 0.5; setTimeout(() => speechSynthesis.speak(u), 900); } catch (e) { /* ignore */ }
    }
  }
  piano(t, freq, vol = 0.1) { this._tone(t, freq, 2.8, { type: 'triangle', g: vol, attack: 0.006, dest: this.musicBus }); this._tone(t, freq * 2, 1.4, { g: vol * 0.25, dest: this.musicBus }); }

  /** Called every simulation step. game provides the context for ambience events. */
  update(dt, game) {
    if (!this._built) return;
    const t = this.now();
    const tag = this.tag;
    // tension follows the alert level
    const lvl = game.alert ? game.alert.level : 0;
    if (this.musicMode === 'calm' && lvl >= 2) this.musicTo('tension');
    else if (this.musicMode === 'tension' && lvl < 1) this.musicTo(this.resumeMusic || 'calm');
    this.setAlarm(lvl >= 2 && tag === 'indoor');
    // heartbeat when a guard is close to detecting
    const det = game.maxDetect || 0;
    if (det > 0.55) { this.hb = (this.hb || 0) - dt; if (this.hb <= 0) { this.sfx('heartbeat', { vol: 0.4 + det * 0.8 }); this.hb = 0.95 - det * 0.35; } }
    // distant prison life
    if (tag === 'indoor' && t > this.nextEvent) {
      const r = this.rng();
      this.nextEvent = t + 3 + this.rng() * 7;
      if (r < 0.35) this.sfx('clang', { vol: 0.9 });
      else if (r < 0.65) this.sfx('shout', { vol: 0.9 });
      else if (r < 0.8) this.sfx('keys', { vol: 0.9 });
      else this.sfx('buzzer', { vol: 0.25 });
    }
    if (tag === 'tunnel' && t > this.nextDrip) { this.nextDrip = t + 0.8 + this.rng() * 3.2; this.sfx('drip', { vol: 1 }); }
    if (tag === 'outdoor') {
      if (t > this.nextBird) {
        this.nextBird = t + 0.25 + this.rng() * 1.8;
        const f = 2100 + this.rng() * 1800, n = 2 + Math.floor(this.rng() * 4);
        for (let i = 0; i < n; i++) this._tone(t + i * 0.09, f * (1 + i * 0.05), 0.07, { f1: f * (1.25 - i * 0.05), g: 0.025 + this.rng() * 0.015, dest: this.ambBus });
      }
      if (t > (this.nextCar || 0)) { this.nextCar = t + 14 + this.rng() * 10; if (game.carOK) this.sfx('car'); }
    }
  }
}
