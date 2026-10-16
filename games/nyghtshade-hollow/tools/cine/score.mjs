#!/usr/bin/env node
// NYGHTSHADE HOLLOW: trailer score and sound design, synthesised from nothing (no samples, no network, no Math.random: every random choice comes from a seeded PRNG,
// so the same command always gives the same file).  Locked to the beat grid of tools/cine/trailer/timeline.mjs: 90 BPM, 24 fps, 2000 samples per frame at 48 kHz,
// 1 beat = 16 frames, 1 bar = 64 frames, 52 bars = 3328 frames = 138.67 s.
//
//   node tools/cine/score.mjs --out DIR [--stems] [--excerpts] [--cues FILE] [--window F0:F1]
//     DIR/trailer-score.wav   48 kHz stereo 24-bit master (about -14 LUFS integrated, true peak <= -1 dBTP)
//     DIR/cues.json           the cue sheet generated from the arrangement below (frame, bar, name, stem, intent of every event)
//     --stems                 DIR/stem-music.wav, stem-design.wav, stem-diegetic.wav: the same gain and limiter curve as the master, so the three sum to it
//     --excerpts              DIR/excerpt-A3.wav and excerpt-A4.wav (20 s cut from the master)
//     --cues FILE             also write the cue sheet there (tools/cine/trailer/cues.json is the checked-in copy)
//     --window F0:F1          development: synthesise only the frames F0..F1 (everything else silent)
//
// Layout of this file: 1 timebase and DSP toolkit (filters, noise, FFT, convolution reverb, loudness meter, limiter), 2 instruments and sound effects,
// 3 the arrangement (every bar of the trailer, one section per range of the timeline), 4 mix, master, WAV writer, cue sheet, CLI.
//
// Stems: music = pads, strings, piano, choir, pulse, percussion, braams.  design = impacts, risers, hits on the cuts, heartbeat, klaxon, drops.
// diegetic = the world: room tone, PA, doors, drips, steps, candles, flame, birds, wind, the car.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FPS, BPM, BEAT, BAR, RANGES, TOTAL_FRAMES, END_CARD } from './trailer/timeline.mjs';

// ============================================================ 1. timebase and toolkit
export const SR = 48000;
const SPF = SR / FPS;                                   // samples per frame: 2000
const NS = TOTAL_FRAMES * SPF;                          // samples in the whole trailer: 6 656 000
if (!Number.isInteger(SPF) || Math.abs(60 / BPM * FPS - BEAT) > 1e-9 || BAR !== 4 * BEAT) throw new Error('timebase mismatch');
const frameOf = (bar, beat = 1) => (bar - 1) * BAR + (beat - 1) * BEAT;     // beat may be fractional: 2.5 = the "and" of 2
const smp = (frame) => Math.round(frame * SPF);
const TAU = Math.PI * 2;
const dB = (x) => Math.pow(10, x / 20);
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const cents = (c) => Math.pow(2, c / 1200);
const Buf = (n) => new Float32Array(Math.max(0, Math.floor(n)));
const secs = (s) => Math.round(s * SR);

// ---- deterministic randomness
const hashStr = (s) => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
const RNG = (seed) => { let a = typeof seed === 'string' ? hashStr(seed) : seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const gauss = (r) => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(TAU * r());
const rr = (r, a, b) => a + (b - a) * r();

// ---- filters
function bqCoef(type, f, q = 0.7071, g = 0) {
  const w0 = TAU * Math.min(f, SR * 0.49) / SR, c = Math.cos(w0), s = Math.sin(w0), A = Math.pow(10, g / 40), al = s / (2 * q);
  let b0, b1, b2, a0, a1, a2;
  switch (type) {
    case 'lp': b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; break;
    case 'hp': b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; break;
    case 'bp': b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; break;
    case 'notch': b0 = 1; b1 = -2 * c; b2 = 1; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; break;
    case 'peak': b0 = 1 + al * A; b1 = -2 * c; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * c; a2 = 1 - al / A; break;
    case 'ls': { const sq = 2 * Math.sqrt(A) * al; b0 = A * ((A + 1) - (A - 1) * c + sq); b1 = 2 * A * ((A - 1) - (A + 1) * c); b2 = A * ((A + 1) - (A - 1) * c - sq); a0 = (A + 1) + (A - 1) * c + sq; a1 = -2 * ((A - 1) + (A + 1) * c); a2 = (A + 1) + (A - 1) * c - sq; break; }
    case 'hs': { const sq = 2 * Math.sqrt(A) * al; b0 = A * ((A + 1) + (A - 1) * c + sq); b1 = -2 * A * ((A - 1) + (A + 1) * c); b2 = A * ((A + 1) + (A - 1) * c - sq); a0 = (A + 1) - (A - 1) * c + sq; a1 = 2 * ((A - 1) - (A + 1) * c); a2 = (A + 1) - (A - 1) * c - sq; break; }
    default: throw new Error('bq ' + type);
  }
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}
/** In-place biquad (RBJ). type: lp hp bp notch peak ls hs. */
function bq(x, type, f, q = 0.7071, g = 0) {
  const [b0, b1, b2, a1, a2] = bqCoef(type, f, q, g); let z1 = 0, z2 = 0;
  for (let i = 0; i < x.length; i++) { const v = x[i], y = b0 * v + z1; z1 = b1 * v - a1 * y + z2; z2 = b2 * v - a2 * y; x[i] = y; }
  return x;
}
const chain = (x, ...stages) => { for (const s of stages) bq(x, ...s); return x; };
/** State variable filter with a control-rate sweep. mode lp | bp (0 dB peak) | hp | notch.  fcAt(i) gives Hz at sample i. */
function svf(x, mode, fcAt, q = 0.8, step = 16) {
  let ic1 = 0, ic2 = 0, g = 0, k = 1, a1 = 0, a2 = 0, a3 = 0;
  const qf = typeof q === 'function', fc0 = typeof fcAt === 'number';
  for (let i = 0; i < x.length; i++) {
    if (i % step === 0) { const fc = clamp(fc0 ? fcAt : fcAt(i), 15, SR * 0.45); g = Math.tan(Math.PI * fc / SR); k = 1 / (qf ? q(i) : q); a1 = 1 / (1 + g * (g + k)); a2 = g * a1; a3 = g * a2; }
    const v0 = x[i], v3 = v0 - ic2, v1 = a1 * ic1 + a2 * v3, v2 = ic2 + a2 * ic1 + a3 * v3;
    ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2;
    x[i] = mode === 'lp' ? v2 : mode === 'bp' ? k * v1 : mode === 'hp' ? v0 - k * v1 - v2 : v0 - k * v1;
  }
  return x;
}
const lp1 = (x, fc) => { const a = 1 - Math.exp(-TAU * fc / SR); let y = 0; for (let i = 0; i < x.length; i++) { y += a * (x[i] - y); x[i] = y; } return x; };
const dcBlock = (x) => { let px = 0, py = 0; for (let i = 0; i < x.length; i++) { const v = x[i]; py = v - px + 0.9995 * py; px = v; x[i] = py; } return x; };

// ---- noise
const white = (n, r) => { const b = Buf(n); for (let i = 0; i < b.length; i++) b[i] = r() * 2 - 1; return b; };
const pink = (n, r) => { const b = Buf(n); let b0 = 0, b1 = 0, b2 = 0; for (let i = 0; i < b.length; i++) { const w = r() * 2 - 1; b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; b[i] = (b0 + b1 + b2 + w * 0.1848) * 0.25; } return b; };
const brown = (n, r) => { const b = Buf(n); let y = 0; for (let i = 0; i < b.length; i++) { y = 0.997 * y + (r() * 2 - 1) * 0.045; b[i] = y; } return b; };
const peakOf = (x) => { let m = 0; for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > m) m = a; } return m; };
const rmsOf = (x, a = 0, b = x.length) => { let s = 0; for (let i = a; i < b; i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, b - a)); };
const normalize = (x, peak = 1) => { const m = peakOf(x); if (m > 0) { const g = peak / m; for (let i = 0; i < x.length; i++) x[i] *= g; } return x; };
const scale = (x, g) => { for (let i = 0; i < x.length; i++) x[i] *= g; return x; };
const reversed = (x) => { const y = Buf(x.length); for (let i = 0; i < x.length; i++) y[i] = x[x.length - 1 - i]; return y; };
const addInto = (dst, src, at = 0, g = 1) => { const s0 = Math.max(0, -at), e = Math.min(src.length, dst.length - at); for (let i = s0; i < e; i++) dst[at + i] += src[i] * g; return dst; };
const fadeEnds = (x, inN = 48, outN = 96) => { const n = x.length; for (let i = 0; i < Math.min(inN, n); i++) x[i] *= i / inN; for (let i = 0; i < Math.min(outN, n); i++) x[n - 1 - i] *= i / outN; return x; };
/** Soft saturation: tanh with a drive, normalised so small signals keep their gain. */
const sat = (x, drive = 2) => { const k = 1 / Math.tanh(drive); for (let i = 0; i < x.length; i++) x[i] = Math.tanh(x[i] * drive) * k; return x; };
const clip = (x, drive = 2) => { for (let i = 0; i < x.length; i++) x[i] = Math.tanh(x[i] * drive); return x; };

/** Envelope from keyframes [[frame, dB], ...] (linear in dB between keys, -Infinity allowed) over the samples from frame0 for n samples. */
function envKeys(keys, frame0, n) {
  const e = Buf(n); let j = 0;
  for (let i = 0; i < n; i++) {
    const f = frame0 + i / SPF;
    while (j < keys.length - 2 && f > keys[j + 1][0]) j++;
    const a = keys[j], b = keys[Math.min(j + 1, keys.length - 1)], u = b[0] === a[0] ? 1 : clamp((f - a[0]) / (b[0] - a[0]), 0, 1), v = a[1] + (b[1] - a[1]) * u;
    e[i] = v <= -100 ? 0 : Math.pow(10, v / 20);
  }
  return e;
}

// ---- FFT and the convolution (reverb) engine
const plans = new Map();
function plan(n) {
  let p = plans.get(n); if (p) return p;
  const rev = new Uint32Array(n), bits = Math.log2(n); for (let i = 0; i < n; i++) { let x = i, y = 0; for (let b = 0; b < bits; b++) { y = (y << 1) | (x & 1); x >>= 1; } rev[i] = y; }
  const cs = new Float64Array(n / 2), sn = new Float64Array(n / 2); for (let i = 0; i < n / 2; i++) { cs[i] = Math.cos(TAU * i / n); sn[i] = Math.sin(TAU * i / n); }
  p = { rev, cs, sn }; plans.set(n, p); return p;
}
function fft(re, im, inverse = false) {
  const n = re.length, { rev, cs, sn } = plan(n), sg = inverse ? 1 : -1;
  for (let i = 0; i < n; i++) { const j = rev[i]; if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1, step = n / size;
    for (let i = 0; i < n; i += size) {
      for (let j = 0, k = 0; j < half; j++, k += step) {
        const wr = cs[k], wi = sg * sn[k], a = i + j, b = a + half;
        const xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
      }
    }
  }
  if (inverse) { const s = 1 / n; for (let i = 0; i < n; i++) { re[i] *= s; im[i] *= s; } }
}
/** Uniform partitioned convolution of a mono signal with a stereo impulse response (the two IR channels are packed as real + imaginary, so one inverse FFT serves both ears).
 *  Blocks of silence cost nothing.  Returns [L, R] of the same length as x. */
function convolveStereo(x, irL, irR, B = 32768) {
  const n = x.length, nfft = 2 * B, P = Math.ceil(Math.max(irL.length, irR.length) / B);
  const Hre = [], Him = [];
  for (let p = 0; p < P; p++) {
    const re = new Float64Array(nfft), im = new Float64Array(nfft);
    for (let i = 0; i < B; i++) { const k = p * B + i; if (k < irL.length) re[i] = irL[k]; if (k < irR.length) im[i] = irR[k]; }
    fft(re, im); Hre.push(re); Him.push(im);
  }
  const outL = Buf(n), outR = Buf(n), fdlRe = new Array(P).fill(null), fdlIm = new Array(P).fill(null);
  let carryRe = new Float64Array(B), carryIm = new Float64Array(B), carryLive = false;
  const nBlocks = Math.ceil(n / B);
  for (let b = 0; b < nBlocks; b++) {
    const s0 = b * B, blkEnd = Math.min(n, s0 + B); let live = false;
    for (let i = s0; i < blkEnd; i++) if (x[i] > 1e-9 || x[i] < -1e-9) { live = true; break; }
    const slot = b % P;
    if (live) {
      const re = new Float64Array(nfft), im = new Float64Array(nfft);
      for (let i = s0; i < blkEnd; i++) re[i - s0] = x[i];
      fft(re, im); fdlRe[slot] = re; fdlIm[slot] = im;
    } else { fdlRe[slot] = null; fdlIm[slot] = null; }
    let any = false; for (let p = 0; p < P; p++) if (fdlRe[(b - p + P * 64) % P] && b - p >= 0) { any = true; break; }
    const w = Math.min(B, n - s0);
    if (!any) {
      if (carryLive) { for (let i = 0; i < w; i++) { outL[s0 + i] = carryRe[i]; outR[s0 + i] = carryIm[i]; } carryRe = new Float64Array(B); carryIm = new Float64Array(B); carryLive = false; }
      continue;
    }
    const aRe = new Float64Array(nfft), aIm = new Float64Array(nfft);
    for (let p = 0; p < P; p++) {
      const bb = b - p; if (bb < 0) break;
      const xr = fdlRe[bb % P], xi = fdlIm[bb % P]; if (!xr) continue;
      const hr = Hre[p], hi = Him[p];
      for (let k = 0; k < nfft; k++) { aRe[k] += xr[k] * hr[k] - xi[k] * hi[k]; aIm[k] += xr[k] * hi[k] + xi[k] * hr[k]; }
    }
    fft(aRe, aIm, true);
    for (let i = 0; i < w; i++) { outL[s0 + i] = aRe[i] + carryRe[i]; outR[s0 + i] = aIm[i] + carryIm[i]; }
    for (let i = 0; i < B; i++) { carryRe[i] = aRe[B + i]; carryIm[i] = aIm[B + i]; }
    carryLive = true;
  }
  return [outL, outR];
}

// ---- generated impulse responses: pre-delay, early reflections, a late tail whose brightness falls with time (dark halls), unit energy
const IRS = {
  // name: rt = seconds to -60 dB, pre = pre-delay s, hi / lo = the tail's low-pass at its start / at t = rt, er = early reflections [ms, gain, pan]
  hall: { rt: 6.2, pre: 0.028, hi: 6500, lo: 380, build: 0.05, er: [[19, 0.5, -0.6], [31, 0.42, 0.7], [47, 0.38, -0.2], [66, 0.3, 0.5], [90, 0.26, -0.8]], erGain: 0.55, hp: 55 },       // dark cinematic hall for impacts, drones, pads
  chapel: { rt: 4.6, pre: 0.022, hi: 9500, lo: 1400, build: 0.035, er: [[14, 0.5, -0.5], [27, 0.44, 0.6], [41, 0.36, -0.7], [58, 0.32, 0.3], [83, 0.26, -0.3], [112, 0.2, 0.8]], erGain: 0.5, hp: 90 },   // stone nave, warm and a little bright: piano, strings, choir, candles
  block: { rt: 2.5, pre: 0.012, hi: 9000, lo: 900, build: 0.012, er: [[7, 0.6, -0.7], [13, 0.5, 0.6], [22, 0.4, -0.3], [34, 0.34, 0.8], [51, 0.28, -0.5]], erGain: 0.6, hp: 80 },             // the tall concrete and steel block
  stone: { rt: 3.4, pre: 0.01, hi: 5200, lo: 700, build: 0.02, er: Array.from({ length: 16 }, (_, k) => [38 + k * 38, 0.62 * Math.pow(0.8, k), k % 2 ? 0.55 : -0.55]), erGain: 0.75, erAmp: 0.62, hp: 90 },  // brick tunnel with flutter echoes
  open: { rt: 1.5, pre: 0.015, hi: 8000, lo: 1800, build: 0.03, er: [[74, 0.34, -0.7], [131, 0.26, 0.6], [212, 0.18, -0.3], [340, 0.1, 0.5]], erGain: 0.5, hp: 140 },                           // forest: slap from the tree line, short airy tail
};
const irCache = new Map();
function getIR(name) {
  if (irCache.has(name)) return irCache.get(name);
  const s = IRS[name], len = secs(s.rt * 1.05 + s.pre), out = [Buf(len), Buf(len)];
  for (let ch = 0; ch < 2; ch++) {
    const r = RNG(`ir-${name}-${ch}`), o = out[ch]; let y1 = 0, y2 = 0, hpz = 0, hpy = 0;
    for (let i = 0; i < len; i++) {
      const t = i / SR - s.pre; if (t < 0) continue;
      const x = gauss(r), fc = s.hi * Math.pow(s.lo / s.hi, Math.min(1, t / s.rt)), a = 1 - Math.exp(-TAU * fc / SR);
      y1 += a * (x - y1); y2 += a * (y1 - y2);
      const e = Math.exp(-6.9078 * t / s.rt) * Math.min(1, t / s.build), v = y2 * e;
      hpy = v - hpz + (1 - TAU * s.hp / SR) * hpy; hpz = v; o[i] = hpy;
    }
    const fade = secs(0.25); for (let i = 0; i < fade && i < len; i++) o[len - 1 - i] *= i / fade;
  }
  let e = 0; for (let ch = 0; ch < 2; ch++) for (let i = 0; i < out[ch].length; i++) e += out[ch][i] * out[ch][i];
  const g = 1 / Math.sqrt(e / 2);
  for (const o of out) for (let i = 0; i < o.length; i++) o[i] *= g;
  const ERK = [0.2, 0.7, 1, 0.55, 0.2];                                  // each reflection is a few samples wide, not a click
  for (const [ms, gn, pan] of s.er) {
    const i = secs(s.pre + ms / 1000); if (i + ERK.length >= len) continue;
    const a = Math.sqrt((1 - pan) / 2), b = Math.sqrt((1 + pan) / 2), amp = gn * s.erGain * (s.erAmp ?? 0.3);
    for (let k = 0; k < ERK.length; k++) { out[0][i + k] += amp * a * 1.4 * ERK[k]; out[1][i + k] += amp * b * 1.4 * ERK[k]; }
  }
  irCache.set(name, out); return out;
}

// ---- BS.1770 / EBU R128 loudness (K-weighting, 400 ms blocks with 75 % overlap, -70 LUFS absolute gate, -10 LU relative gate)
function kWeigh(x) {
  const y = new Float64Array(x.length), c1 = [1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585], c2 = [1, -2, 1, -1.99004745483398, 0.99007225036621];
  let z1 = 0, z2 = 0, w1 = 0, w2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i], a = c1[0] * v + z1; z1 = c1[1] * v - c1[3] * a + z2; z2 = c1[2] * v - c1[4] * a;
    const b = c2[0] * a + w1; w1 = c2[1] * a - c2[3] * b + w2; w2 = c2[2] * a - c2[4] * b; y[i] = b;
  }
  return y;
}
/** Returns { hop: per-100 ms mean-square sums, momentary(i), shortTerm(i), integrated } in LUFS.  Works on the sample range [a, b). */
function loudness(L, R, a = 0, b = L.length) {
  const zl = kWeigh(L.subarray(a, b)), zr = kWeigh(R.subarray(a, b)), H = SR / 10, nh = Math.floor((b - a) / H), e = new Float64Array(nh);
  for (let h = 0; h < nh; h++) { let s = 0; for (let i = h * H; i < (h + 1) * H; i++) s += zl[i] * zl[i] + zr[i] * zr[i]; e[h] = s / H; }   // sum over channels of the mean square
  const lufs = (ms) => (ms > 0 ? -0.691 + 10 * Math.log10(ms) : -Infinity);
  const win = (h0, k) => { let s = 0, c = 0; for (let h = Math.max(0, h0); h < Math.min(nh, h0 + k); h++) { s += e[h]; c++; } return c ? s / k : 0; };
  const momentary = (h) => lufs(win(h - 3, 4)), shortTerm = (h) => lufs(win(h - 29, 30));
  const blocks = []; for (let h = 3; h < nh; h++) blocks.push(win(h - 3, 4));
  const above = blocks.filter((v) => lufs(v) > -70); let integrated = -Infinity;
  if (above.length) { const rel = lufs(above.reduce((s, v) => s + v, 0) / above.length) - 10, kept = above.filter((v) => lufs(v) > rel); if (kept.length) integrated = lufs(kept.reduce((s, v) => s + v, 0) / kept.length); }
  return { nh, e, momentary, shortTerm, integrated, lufs };
}

// ---- true-peak lookahead limiter and bus compressor: both return a gain curve (so the stems can get exactly the master's gain)
const SINC4 = (() => { const taps = 16, ph = [0.25, 0.5, 0.75], out = []; for (const f of ph) { const h = new Float64Array(taps); let s = 0; for (let k = 0; k < taps; k++) { const x = k - (taps / 2 - 1) - f, w = 0.5 + 0.5 * Math.cos(Math.PI * x / (taps / 2 + 0.5)); h[k] = (Math.abs(x) < 1e-9 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x)) * w; s += h[k]; } for (let k = 0; k < taps; k++) h[k] /= s; out.push(h); } return out; })();
function truePeakAt(x, i) {            // largest interpolated magnitude between samples i and i+1 (4x oversampling, 16-tap windowed sinc)
  let m = Math.max(Math.abs(x[i]), Math.abs(x[i + 1] || 0));
  for (const h of SINC4) { let s = 0; for (let k = 0; k < 16; k++) { const j = i - 7 + k; if (j >= 0 && j < x.length) s += h[k] * x[j]; } if (Math.abs(s) > m) m = Math.abs(s); }
  return m;
}
function limiterGain(L, R, ceiling, look = secs(0.004), rel = 0.14) {
  const n = L.length, r = new Float32Array(n).fill(1), thr = ceiling * 0.4;
  for (let i = 0; i < n; i++) {                                         // gain each sample needs so that its (inter-sample) peak stays under the ceiling
    const a = Math.max(Math.abs(L[i]), Math.abs(R[i]), Math.abs(L[i + 1] || 0), Math.abs(R[i + 1] || 0));
    if (a < thr) continue;
    const p = Math.max(truePeakAt(L, i), truePeakAt(R, i));
    if (p > ceiling) r[i] = ceiling / p;
  }
  const e = new Float32Array(n), kr = Math.exp(-1 / (rel * SR)); let g = 1;                // instant attack, exponential release
  for (let i = 0; i < n; i++) { g = r[i] < g ? r[i] : 1 - (1 - g) * kr; e[i] = g; }
  // m[j] = min of e over [j, j+W-1]; the boxcar mean of m over [i-W+1, i] is <= e[i] (every window in it contains i) and moves no faster than the window: a lookahead ramp
  const W = look, m = new Float32Array(n), dq = new Int32Array(n); let h = 0, t = 0;
  for (let i = 0; i < n; i++) {
    while (t > h && e[dq[t - 1]] >= e[i]) t--;
    dq[t++] = i;
    const j = i - W + 1; if (j >= 0) { while (dq[h] < j) h++; m[j] = e[dq[h]]; }
  }
  for (let j = Math.max(0, n - W + 1); j < n; j++) { while (dq[h] < j) h++; m[j] = e[dq[h]]; }
  const out = new Float32Array(n); let acc = 0;
  for (let i = 0; i < n; i++) { acc += m[i]; if (i >= W) acc -= m[i - W]; out[i] = acc / Math.min(W, i + 1); }
  return out;
}
function compressorGain(L, R, { thresh = -20, ratio = 2, atk = 0.03, rel = 0.25, knee = 6, rmsMs = 12 } = {}) {
  const n = L.length, g = new Float32Array(n), ka = Math.exp(-1 / (atk * SR)), kr = Math.exp(-1 / (rel * SR)), kd = Math.exp(-1 / (rmsMs / 1000 * SR));
  let ms = 0, cur = 0;
  for (let i = 0; i < n; i++) {
    const v = 0.5 * (L[i] * L[i] + R[i] * R[i]); ms = kd * ms + (1 - kd) * v;
    const lvl = 10 * Math.log10(ms + 1e-14), over = lvl - thresh;
    let red = 0; if (over > knee / 2) red = over * (1 - 1 / ratio); else if (over > -knee / 2) { const u = over + knee / 2; red = (1 - 1 / ratio) * u * u / (2 * knee); }
    cur = red > cur ? ka * cur + (1 - ka) * red : kr * cur + (1 - kr) * red; g[i] = Math.pow(10, -cur / 20);
  }
  return g;
}
