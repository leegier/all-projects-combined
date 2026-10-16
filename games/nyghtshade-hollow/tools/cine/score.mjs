#!/usr/bin/env node
// NYGHTSHADE HOLLOW: trailer score and sound design, synthesised from nothing (no samples, no network, no Math.random: every random choice comes from a seeded PRNG,
// so the same command always gives the same file).  Locked to the beat grid of tools/cine/trailer/timeline.mjs: 90 BPM, 24 fps, 2000 samples per frame at 48 kHz,
// 1 beat = 16 frames, 1 bar = 64 frames, 52 bars = 3328 frames = 138.67 s.
//
//   node tools/cine/score.mjs --out DIR [--stems] [--excerpts] [--cues FILE] [--window F0:F1]
//     DIR/trailer-score.wav   48 kHz stereo 24-bit master (about -14 LUFS integrated, true peak <= -1 dBTP)
//     DIR/cues.json           the cue sheet generated from the arrangement below (frame, bar, name, stem, intent of every event)
//     --stems                 DIR/stem-music.wav, stem-design.wav, stem-diegetic.wav: the same gain and limiter curve as the master, so the three sum to it
//     --excerpts              DIR/excerpt-A3.wav (2 s of the riser + A3 + the drop) and excerpt-A4.wav (the first 20 s of A4), cut from the master
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
  for (let i = 0; i < len; i++) { const a = out[0][i], b = out[1][i]; out[0][i] = a + 0.3 * b; out[1][i] = b + 0.3 * a; }   // partly correlated ears: the tail stays wide but folds to mono without a hole
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

// ============================================================ 2. instruments and sound effects (all return Float32Array mono, or [L, R] where stated; nothing is placed in time here)
/** Band-limited (polyBLEP) sawtooth; f is Hz or a function of the sample index. */
function sawB(n, f, ph = 0) {
  const o = Buf(n), fa = typeof f === 'function'; let p = ph;
  for (let i = 0; i < n; i++) {
    const dt = (fa ? f(i) : f) / SR; let v = 2 * p - 1;
    if (p < dt) { const t = p / dt; v -= t + t - t * t - 1; } else if (p > 1 - dt) { const t = (p - 1) / dt; v -= t * t + t + t + 1; }
    o[i] = v; p += dt; if (p >= 1) p -= 1;
  }
  return o;
}
/** Band-limited pulse of width w (difference of two saws). */
function pulseB(n, f, w = 0.5, ph = 0) {
  const a = sawB(n, f, ph), b = sawB(n, f, (ph + w) % 1);
  for (let i = 0; i < n; i++) a[i] = (a[i] - b[i]) * 0.5;
  return a;
}
function sineF(n, f, ph = 0) {
  const o = Buf(n), fa = typeof f === 'function', k = TAU / SR; let p = ph;
  for (let i = 0; i < n; i++) { o[i] = Math.sin(p); p += k * (fa ? f(i) : f); if (p > TAU) p -= TAU; }
  return o;
}
/** Exponential pitch fall from f0 to f1 (time constant tau seconds). */
const fall = (f0, f1, tau) => (i) => f1 + (f0 - f1) * Math.exp(-i / (tau * SR));
/** Percussive envelope: short linear attack, exponential decay. */
function perc(n, atk, tau) { const e = Buf(n), a = Math.max(1, secs(atk)), k = 1 / (tau * SR); for (let i = 0; i < n; i++) e[i] = (i < a ? i / a : 1) * Math.exp(-(i < a ? 0 : i - a) * k); return e; }
/** Smooth swell: raised-cosine attack, held, raised-cosine release over the last rel seconds. */
function swellEnv(n, atk, rel) {
  const e = Buf(n), a = Math.max(1, secs(atk)), r = Math.max(1, secs(rel));
  for (let i = 0; i < n; i++) { let v = i < a ? Math.sin(Math.PI / 2 * i / a) ** 2 : 1; const j = n - 1 - i; if (j < r) v *= Math.sin(Math.PI / 2 * j / r) ** 2; e[i] = v; }
  return e;
}
const mul = (x, e) => { const n = Math.min(x.length, e.length); for (let i = 0; i < n; i++) x[i] *= e[i]; return x; };
const mix = (...pairs) => { const n = Math.max(...pairs.map((p) => p[0].length)), o = Buf(n); for (const [x, g] of pairs) for (let i = 0; i < x.length; i++) o[i] += x[i] * g; return o; };
const setRms = (x, db) => { const m = rmsOf(x); if (m > 0) scale(x, dB(db) / m); return x; };
/** Bank of exponentially decaying sinusoids by recurrence: list = [[Hz, amp, tau s], ...]. */
function modes(n, list) {
  const o = Buf(n);
  for (const [f, a, tau] of list) {
    if (f >= SR * 0.45 || a === 0) continue;
    const w = TAU * f / SR, r = Math.exp(-1 / (tau * SR)), c = 2 * r * Math.cos(w), r2 = r * r, m = Math.min(n, Math.floor(tau * SR * 11.5));
    let y2 = 0, y1 = a * r * Math.sin(w); if (m > 1) o[1] += y1;
    for (let i = 2; i < m; i++) { const y = c * y1 - r2 * y2; o[i] += y; y2 = y1; y1 = y; }
  }
  return o;
}
/** Slowly wandering random control signal in [-1, 1] (smoothed noise), rate in Hz. */
function wander(n, r, rate) { const x = white(n, r); lp1(x, rate); lp1(x, rate); let m = 0; for (let i = 0; i < n; i += 97) m = Math.max(m, Math.abs(x[i])); const g = m > 0 ? 1 / (m * 1.6) : 1; for (let i = 0; i < n; i++) x[i] = clamp(x[i] * g, -1, 1); return x; }

// ---- melodic voices
/** String ensemble note, stereo: 3 detuned band-limited saws per ear, vibrato after the attack, a lowpass that opens with the swell. o: att rel bright (0..1) vib (0..1) sub (sine an octave down) seed. */
function stringsNote(f, durS, o = {}) {
  const att = o.att ?? 1.2, rel = o.rel ?? 1.5, bright = o.bright ?? 0.5, vib = o.vib ?? 0.6, n = secs(durS + rel), r = RNG(o.seed ?? `str${f}`), out = [];
  const fc0 = 700 + 5200 * bright * bright + f * 1.2;
  for (let ch = 0; ch < 2; ch++) {
    const dets = ch ? [-0.0042, 0.0006, 0.0050] : [-0.0050, -0.0006, 0.0042], vr = 4.9 + r() * 1.2, vp = r() * TAU, mod = Buf(n), va = 0.0042 * vib;
    for (let i = 0; i < n; i++) { const t = i / SR; mod[i] = va * Math.sin(TAU * vr * t + vp) * clamp((t - att * 0.7) / 0.9, 0, 1); }
    const mixd = Buf(n);
    for (const d of dets) { const s = sawB(n, (i) => f * (1 + d + mod[i]), r()); for (let i = 0; i < n; i++) mixd[i] += s[i] * 0.34; }
    svf(mixd, 'lp', (i) => fc0 * (0.35 + 0.65 * Math.min(1, i / (SR * (att + 0.6)))), 0.75);
    if (o.sub) { const s = sineF(n, f * 0.5, r() * TAU); for (let i = 0; i < n; i++) mixd[i] += s[i] * o.sub; }
    mul(mixd, swellEnv(n, att, rel)); out.push(mixd);
  }
  return out;
}
const VOWELS = { ah: [[800, 1, 7], [1150, 0.5, 9], [2900, 0.18, 11]], oo: [[350, 1, 7], [600, 0.42, 9], [2700, 0.08, 11]], oh: [[450, 1, 7], [800, 0.5, 9], [2830, 0.12, 11]] };
/** Choir-like voice, stereo: a glottal-ish saw with vibrato and breath through three formant resonators. */
function choirNote(f, durS, vowel = 'ah', o = {}) {
  const att = o.att ?? 1.8, rel = o.rel ?? 2, n = secs(durS + rel), r = RNG(o.seed ?? `ch${f}${vowel}`), out = [];
  for (let ch = 0; ch < 2; ch++) {
    const vr = 5.1 + r() * 0.8, vp = r() * TAU, d = (ch ? 1 : -1) * 0.0035 * (0.6 + r());
    const src = sawB(n, (i) => f * (1 + d + 0.0045 * Math.sin(TAU * vr * i / SR + vp) * clamp(i / SR / (att + 0.3), 0, 1)), r());
    const br = white(n, r); svf(br, 'bp', 2400, 0.7); for (let i = 0; i < n; i++) src[i] += br[i] * 0.05;
    const acc = Buf(n);
    for (const [fc, g, q] of VOWELS[vowel]) { const b = Float32Array.from(src); svf(b, 'bp', fc, q); for (let i = 0; i < n; i++) acc[i] += b[i] * g; }
    mul(acc, swellEnv(n, att, rel)); out.push(acc);
  }
  return out;
}
/** Felt-piano note (mono): inharmonic partials with a two-stage decay (two strings), a hammer thud, and a velocity-dependent lowpass.  Modelled soft and dark. */
function pianoNote(f, vel = 0.6, len = 5.5, o = {}) {
  const n = secs(len), r = RNG(o.seed ?? `pf${f}${vel}`), nP = Math.min(13, Math.floor(7500 / f)), T0 = clamp(5.8 * Math.pow(110 / f, 0.45), 1.3, 7.5), list = [], B = 0.00009 + f * 0.0000004;
  for (let k = 1; k <= nP; k++) {
    const fk = f * k * Math.sqrt(1 + B * k * k), a = Math.pow(k, -(1.55 - 0.7 * vel)) * (0.55 + 0.45 * Math.abs(Math.sin(Math.PI * k / 8.3))), tau = T0 / (1 + 0.55 * (k - 1));
    list.push([fk * 0.9997, a * 0.7, tau], [fk * 1.0003, a * 0.45, tau * 2.4]);
  }
  const x = modes(n, list), th = white(secs(0.06), r); svf(th, 'lp', 700 + 1500 * vel, 0.7); mul(th, perc(th.length, 0.001, 0.012)); for (let i = 0; i < th.length; i++) x[i] += th[i] * 0.55 * vel;
  svf(x, 'lp', 1500 + 4200 * vel * vel + f * 2.5, 0.6); bq(x, 'hp', 40, 0.7);
  return scale(x, vel * 0.5);
}
/** Detuned brass-like braam (stereo): a stack of saws, a lowpass that opens and closes, saturation, a sine under it. */
function braam(f, durS, o = {}) {
  const n = secs(durS), r = RNG(o.seed ?? `br${f}`), out = [], open = o.open ?? 2600, base = o.base ?? 160, atk = o.atk ?? 0.03;
  for (let ch = 0; ch < 2; ch++) {
    const dets = ch ? [-0.0035, 0.0014, 0.0090, 0.0200] : [-0.0200, -0.0090, -0.0014, 0.0035], acc = Buf(n);
    for (const d of dets) { const s = sawB(n, f * (1 + d), r()); for (let i = 0; i < n; i++) acc[i] += s[i] * 0.2; }
    const lo = sawB(n, f * 0.5 * (1 + (ch ? 0.002 : -0.002)), r()); for (let i = 0; i < n; i++) acc[i] += lo[i] * 0.3;
    svf(acc, 'lp', (i) => base + (open - base) * Math.sin(Math.PI * Math.min(1, Math.pow(i / n, 0.5))) ** 1.3, 1.1);
    bq(acc, 'peak', 520, 0.9, 5); sat(acc, 1.8);
    const sb = sineF(n, f * 0.5, r() * TAU); for (let i = 0; i < n; i++) acc[i] += sb[i] * 0.35;
    mul(acc, swellEnv(n, atk, Math.min(durS * 0.55, o.rel ?? 1.2))); out.push(acc);
  }
  return out;
}

// ---- impacts, metal, percussion
/** Struck steel (door, bar, rail): inharmonic free-bar modes with a noise transient. */
function clangHit(f0, decay = 1.6, bright = 0.6, seed = 'clang') {
  const r = RNG(seed), n = secs(decay * 2.2 + 0.2), ratios = [1, 2.76, 5.40, 8.93, 13.34, 18.64, 24.8, 31.8], list = [];
  ratios.forEach((q, k) => { const j = 1 + (r() - 0.5) * 0.03; list.push([f0 * q * j, Math.pow(0.62, k) * (k ? 0.5 + 0.5 * bright : 1) * (0.7 + 0.6 * r()), decay / (1 + 0.55 * k)]); });
  list.push([f0 * 0.5, 0.35, decay * 0.8]);
  const x = modes(n, list), t = white(secs(0.03), r); bq(t, 'hp', 1500, 0.7); mul(t, perc(t.length, 0.0005, 0.005)); for (let i = 0; i < t.length; i++) x[i] += t[i] * 0.55 * bright;
  return x;
}
/** Sub-bass impact (stereo): pitch-dropping sine, brown-noise body, saturated harmonics so it carries on small speakers, optional metallic clang. */
function impact(o = {}) {
  const size = o.size ?? 1, dur = o.dur ?? 3.2, p = o.pitch ?? 34, n = secs(dur), r = RNG(o.seed ?? 'imp'), L = Buf(n), R = Buf(n);
  const sub = sineF(n, fall(p * 2.7, p, 0.11)); mul(sub, perc(n, 0.002, 1.1 * size ** 0.5 * (o.tail ?? 1)));
  const harm = Float32Array.from(sub); sat(harm, 3); bq(harm, 'lp', 220, 0.7);
  const body = brown(n, r); normalize(body); svf(body, 'lp', fall(900, 55, 0.28), 0.8); mul(body, perc(n, 0.002, 0.45));
  const crack = white(secs(0.08), r); bq(crack, 'hp', 900, 0.7); mul(crack, perc(crack.length, 0.0005, 0.016));
  const m = Buf(n);
  for (let i = 0; i < n; i++) m[i] = sub[i] * 0.95 + harm[i] * 0.35 + body[i] * 0.7 * (o.body ?? 1) + (i < crack.length ? crack[i] * 0.3 * (o.crack ?? 1) : 0);
  for (let i = 0; i < n; i++) { L[i] = m[i]; R[i] = m[i]; }
  if (o.clang) { const c = clangHit(o.clangF ?? 170, o.clangDecay ?? 2.2, 0.7, (o.seed ?? 'imp') + 'c'), g = o.clang; for (let i = 0; i < c.length && i < n; i++) { L[i] += c[i] * g * 0.9; R[i] += c[i] * g * 1.1; } }
  const sc = Math.min(1, 1.0) * (o.gain ?? 1); scale(L, sc); scale(R, sc); return [L, R];
}
function kick(vel = 1, seed = 'k') { const n = secs(0.7), r = RNG(seed), s = sineF(n, fall(170, 44, 0.035)); mul(s, perc(n, 0.001, 0.2)); const h = Float32Array.from(s); sat(h, 2.5); bq(h, 'lp', 300, 0.7); const c = white(secs(0.02), r); bq(c, 'bp', 2500, 0.8); mul(c, perc(c.length, 0.0003, 0.004)); for (let i = 0; i < c.length; i++) s[i] += c[i] * 0.3; for (let i = 0; i < n; i++) s[i] = s[i] * 0.9 + h[i] * 0.3; return scale(s, vel); }
function taiko(f, vel = 1, seed = 'tk') { const n = secs(1.8), r = RNG(seed), s = sineF(n, fall(f * 1.9, f, 0.05)); mul(s, perc(n, 0.002, 0.42)); const s2 = sineF(n, fall(f * 2.9, f * 1.5, 0.04)); mul(s2, perc(n, 0.002, 0.2)); const t = white(secs(0.12), r); svf(t, 'bp', 1800, 0.9); mul(t, perc(t.length, 0.001, 0.02)); const o = Buf(n); for (let i = 0; i < n; i++) o[i] = s[i] + s2[i] * 0.35 + (i < t.length ? t[i] * 0.45 : 0); sat(o, 1.5); return scale(o, vel * 0.8); }
function hat(open = false, seed = 'h', f = 8200) { const r = RNG(seed), n = secs(open ? 0.28 : 0.07), x = white(n, r); bq(x, 'hp', f * 0.8, 0.8); bq(x, 'peak', f * 1.3, 1.2, 4); mul(x, perc(n, 0.0004, open ? 0.08 : 0.014)); return x; }
function metalTick(seed = 'tick', f = 3100) { const r = RNG(seed), n = secs(0.12), ff = f * (0.9 + 0.2 * r()), x = modes(n, [[ff, 1, 0.035], [ff * 1.83, 0.6, 0.025], [ff * 2.9, 0.35, 0.018]]), c = white(secs(0.006), r); bq(c, 'hp', 2000, 0.7); mul(c, perc(c.length, 0.0002, 0.0015)); for (let i = 0; i < c.length; i++) x[i] += c[i] * 0.7; return x; }
/** Boot on concrete or stone: heel thud and a scuff.  weight 0..1. */
function bootStep(weight = 0.7, seed = 'boot', stone = false) {
  const r = RNG(seed), n = secs(0.3), th = sineF(n, fall(120 * (0.9 + 0.2 * r()), 58, 0.03)); mul(th, perc(n, 0.001, 0.045));
  const b = white(n, r); svf(b, 'lp', stone ? 1100 : 600, 0.7); mul(b, perc(n, 0.001, 0.03));
  const c = white(secs(0.05), r); bq(c, 'bp', stone ? 2800 : 1900, 1.1); mul(c, perc(c.length, 0.0005, 0.008));
  const x = Buf(n); for (let i = 0; i < n; i++) x[i] = th[i] * 0.8 + b[i] * 0.8 + (i < c.length ? c[i] * 0.5 : 0);
  return scale(x, weight);
}
/** Steel door slam: noise crash, sub thump, modal clang, rattle. */
function doorSlam(weight = 1, seed = 'slam') {
  const r = RNG(seed), n = secs(2.6), c = clangHit(135 + r() * 25, 1.5, 0.8, seed + 'm'), th = sineF(n, fall(120, 46, 0.05)); mul(th, perc(n, 0.001, 0.34));
  const b = white(n, r); svf(b, 'lp', fall(5000, 400, 0.12), 0.8); mul(b, perc(n, 0.0007, 0.09));
  const rat = Buf(n); for (let k = 0; k < 6; k++) { const at = secs(0.05 + k * 0.045 * (1 + k * 0.3)), tk = metalTick(seed + 'r' + k, 1500 + 700 * r()); for (let i = 0; i < tk.length && at + i < n; i++) rat[at + i] += tk[i] * (0.5 - k * 0.07); }
  const x = Buf(n); for (let i = 0; i < n; i++) x[i] = th[i] * 0.9 + b[i] * 0.8 + rat[i] * 0.4 + (i < c.length ? c[i] * 0.55 : 0);
  return scale(x, weight);
}
/** Whoosh: filtered noise swell, up (rise to the cut) or down. */
function whoosh(durS, f0, f1, seed = 'wh') { const r = RNG(seed), n = secs(durS), x = white(n, r); svf(x, 'bp', (i) => f0 * Math.pow(f1 / f0, i / n), 1.4); mul(x, swellEnv(n, durS * 0.8, durS * 0.2)); return x; }
/** Riser: noise through a rising resonant band-pass plus a gliding saw pair; stereo.  Ends loud and is meant to be stopped by a gap before the hit. */
function riser(durS, o = {}) {
  const n = secs(durS), r = RNG(o.seed ?? 'ris'), out = [], f0 = o.f0 ?? 250, f1 = o.f1 ?? 9000, p0 = o.p0 ?? 146.8, p1 = o.p1 ?? 587.3, curve = o.curve ?? 2.2;
  for (let ch = 0; ch < 2; ch++) {
    const nz = white(n, r); svf(nz, 'bp', (i) => f0 * Math.pow(f1 / f0, Math.pow(i / n, 1.4)), 2.5);
    const sw = Buf(n); for (const d of [0.994, 1.006]) { const s = sawB(n, (i) => p0 * Math.pow(p1 / p0, Math.pow(i / n, 1.3)) * d * (ch ? 1.002 : 0.998), r()); for (let i = 0; i < n; i++) sw[i] += s[i] * 0.5; }
    svf(sw, 'lp', (i) => 400 + 4000 * Math.pow(i / n, 1.5), 0.9);
    const e = Buf(n); for (let i = 0; i < n; i++) e[i] = Math.pow(i / n, curve);
    const x = Buf(n); for (let i = 0; i < n; i++) x[i] = (nz[i] * (o.noise ?? 1) + sw[i] * (o.tone ?? 0.6)) * e[i];
    out.push(x);
  }
  return out;
}
/** Reverse swell of a decaying noise/tone burst: the "inhale" before a hit. */
function suckIn(durS, f = 800, seed = 'suck') { const r = RNG(seed), n = secs(durS), x = white(n, r); svf(x, 'bp', f, 1.2); mul(x, perc(n, 0.0005, durS * 0.3)); return reversed(x); }
function heartBeat(strength = 1, seed = 'hb') {
  const n = secs(0.6), lub = sineF(n, fall(86, 46, 0.03)); mul(lub, perc(n, 0.004, 0.065)); const dub = sineF(n, fall(96, 52, 0.025)); mul(dub, perc(n, 0.004, 0.05));
  const r = RNG(seed), th = white(n, r); svf(th, 'lp', 220, 0.7); const t1 = Float32Array.from(th); mul(t1, perc(n, 0.003, 0.035)); const x = Buf(n), d0 = secs(0.19);
  for (let i = 0; i < n; i++) { x[i] = lub[i] + t1[i] * 0.9; if (i + d0 < n) x[i + d0] += (dub[i] + t1[i] * 0.7) * 0.62; }
  const h = Float32Array.from(x); sat(h, 2); bq(h, 'bp', 140, 0.8); for (let i = 0; i < n; i++) x[i] = x[i] * 0.8 + h[i] * 0.25;
  return scale(x, strength);
}

// ---- ambiences and designed foley
/** Cell-block room tone (stereo): air handling rumble, 50 Hz mains hum with harmonics, a breath of hiss; every random source is decorrelated per ear. */
function roomTone(n, seed = 'room') {
  const r = RNG(seed), out = [];
  for (let ch = 0; ch < 2; ch++) {
    const p = pink(n, r), b = brown(n, r), h = white(n, r); svf(p, 'lp', 380, 0.7); normalize(b); svf(b, 'lp', 120, 0.7); svf(h, 'bp', 3200, 0.6);
    const am = wander(n, r, 0.12), hum = Buf(n);
    for (let k = 1; k <= 4; k++) { const s = sineF(n, 50.02 * k, r() * TAU); for (let i = 0; i < n; i++) hum[i] += s[i] * (0.5 / k); }
    const x = Buf(n); for (let i = 0; i < n; i++) x[i] = p[i] * (0.9 + 0.15 * am[i]) + b[i] * 1.6 + h[i] * 0.025 + hum[i] * 0.05;
    out.push(setRms(x, 0));
  }
  return out;
}
/** Distant PA crackle (mono): a mic-open thump, hiss and crackle bursts through a small-speaker band-pass. */
function paCrackle(durS, seed = 'pa') {
  const r = RNG(seed), n = secs(durS), x = Buf(n), hiss = white(n, r); svf(hiss, 'bp', 2200, 0.5);
  const gate = Buf(n); let state = 0.2, nxt = 0; for (let i = 0; i < n; i++) { if (i >= nxt) { state = r() < 0.55 ? 0.15 + r() * 0.5 : 0.9 + r() * 0.3; nxt = i + secs(0.004 + r() * 0.05); } gate[i] = state; }
  lp1(gate, 400);
  const env = swellEnv(n, 0.02, Math.min(0.15, durS * 0.4));
  for (let i = 0; i < n; i++) x[i] = hiss[i] * gate[i] * env[i];
  const cr = Buf(n); for (let k = 0; k < durS * 70; k++) cr[Math.floor(r() * (n - 40))] = (r() * 2 - 1) * (0.4 + r()); bq(cr, 'bp', 3000, 0.6); for (let i = 0; i < n; i++) x[i] += cr[i] * 0.9 * env[i];
  const hm = sineF(n, 100.04); for (let i = 0; i < n; i++) x[i] += hm[i] * 0.05 * env[i];
  const th = white(secs(0.05), r); svf(th, 'lp', 300, 0.7); mul(th, perc(th.length, 0.001, 0.015)); for (let i = 0; i < th.length; i++) x[i] += th[i] * 1.5;
  bq(x, 'hp', 280, 0.7); bq(x, 'lp', 3600, 0.7); bq(x, 'peak', 1500, 1, 4);
  return normalize(x, 1);
}
/** Two-tone PA chime (mono). */
function paChime(seed = 'chime') { const n = secs(1.6), x = modes(n, [[880, 1, 0.5], [1760, 0.3, 0.3], [660, 0.9, 0.7], [1320, 0.2, 0.3], [2640, 0.06, 0.1]]); const y = Buf(n), d = secs(0.42); for (let i = 0; i < n; i++) { y[i] = x[i] * (i < d ? 1 : 0); } const z = modes(n, [[660, 1, 0.7], [1320, 0.25, 0.35], [880 * 2 / 3 * 2, 0.0, 0.1]]); for (let i = 0; i + d < n; i++) y[i + d] += z[i] * 0.9; for (let i = 0; i < d; i++) y[i] *= Math.min(1, (d - i) / 2000 + 0.3); svf(y, 'lp', 4200, 0.7); return y; }
function dripSound(seed = 'drip', f = 1500) { const r = RNG(seed), n = secs(0.45), x = sineF(n, (i) => f * (1 + 0.55 * (1 - Math.exp(-i / (0.02 * SR))))); mul(x, perc(n, 0.001, 0.045)); const x2 = sineF(n, (i) => f * 1.5 * (1 + 0.4 * (1 - Math.exp(-i / (0.018 * SR))))); mul(x2, perc(n, 0.001, 0.025)); const c = white(secs(0.01), r); bq(c, 'bp', 4000, 1); mul(c, perc(c.length, 0.0002, 0.002)); for (let i = 0; i < n; i++) x[i] = x[i] + x2[i] * 0.3 + (i < c.length ? c[i] * 0.5 : 0); return x; }
/** Candle crackle (mono): sparse irregular pops in clusters over a faint hiss. */
function candleCrackle(n, density = 5, seed = 'candle') {
  const r = RNG(seed), x = Buf(n), cl = wander(n, r, 0.6);
  for (let i = 0; i < n; i += 24) { const d = density * Math.max(0.1, 0.6 + 0.7 * cl[i]) * 24 / SR; if (r() < d) { const a = Math.pow(r(), 2.2); x[i] += (r() < 0.5 ? -1 : 1) * a; if (r() < 0.2) x[i + 3] -= a * 0.6; } }
  const k = Buf(n); for (let i = 0; i < n; i++) k[i] = x[i]; bq(x, 'bp', 3800, 0.8); bq(k, 'lp', 1400, 0.7);
  const hs = white(n, r); svf(hs, 'bp', 5200, 0.6); for (let i = 0; i < n; i++) x[i] = x[i] * 3 + k[i] * 1.4 + hs[i] * 0.004 * (1 + cl[i]);
  return x;
}
/** Lantern flame (stereo): soft flutter and breathing, a pop now and then. */
function flameSound(n, seed = 'flame') { const r = RNG(seed), out = []; for (let ch = 0; ch < 2; ch++) { const x = pink(n, r), fl = wander(n, r, 5), br = wander(n, r, 0.4); svf(x, 'bp', (i) => 520 + 380 * fl[i], 0.8); for (let i = 0; i < n; i++) x[i] *= 0.55 + 0.35 * fl[i] + 0.3 * br[i]; out.push(setRms(x, 0)); } return out; }
/** Stone block grinding on stone (stereo). */
function stoneGrind(durS, seed = 'grind') {
  const r = RNG(seed), n = secs(durS), out = [], env = swellEnv(n, durS * 0.3, durS * 0.35);
  for (let ch = 0; ch < 2; ch++) {
    const b = brown(n, r), p = pink(n, r), am = wander(n, r, 9), slow = wander(n, r, 0.8); normalize(b);
    const x = Buf(n); for (let i = 0; i < n; i++) x[i] = b[i] * 1.3 + p[i] * 0.7;
    svf(x, 'bp', (i) => 150 + 380 * (0.5 + 0.5 * slow[i]) + 250 * Math.sin(Math.PI * i / n), 0.9);
    for (let i = 0; i < n; i++) x[i] *= (0.55 + 0.45 * am[i]) * env[i]; out.push(setRms(x, -3));
  }
  for (let ch = 0; ch < 2; ch++) for (let i = 0; i < n; i++) out[ch][i] *= env[i];
  return out;
}
/** A bird (mono) of one of several species, tuned loosely to D major. kind: tweet | trill | whistle | chirp. */
function birdCall(kind, f, seed = 'bird') {
  const r = RNG(seed);
  const chirp = (f0, f1, dur, vibHz = 0, vibD = 0) => { const n = secs(dur), x = sineF(n, (i) => { const u = i / n; return (f0 + (f1 - f0) * u) * (1 + vibD * Math.sin(TAU * vibHz * i / SR)); }); const h = sineF(n, (i) => 2 * (f0 + (f1 - f0) * i / n)); for (let i = 0; i < n; i++) { const w = Math.sin(Math.PI * i / n) ** 1.5; x[i] = (x[i] + h[i] * 0.18) * w; } return x; };
  let parts = [];
  if (kind === 'tweet') { const k = 2 + Math.floor(r() * 3); for (let i = 0; i < k; i++) parts.push([i * 0.11, chirp(f * (1 + 0.06 * i), f * (1.25 + 0.05 * i), 0.07 + r() * 0.03)]); }
  else if (kind === 'trill') { const k = 9 + Math.floor(r() * 6); for (let i = 0; i < k; i++) parts.push([i * 0.045, chirp(f * (i % 2 ? 1.12 : 1), f * (i % 2 ? 1.0 : 1.12), 0.035)]); }
  else if (kind === 'whistle') { const sc = [1, 1.122, 1.26, 1.498, 1.682], k = 3 + Math.floor(r() * 3); let t = 0; for (let i = 0; i < k; i++) { const fr = f * sc[Math.floor(r() * sc.length)], d = 0.14 + r() * 0.2; parts.push([t, chirp(fr * 1.04, fr * 0.97, d, 22, 0.012)]); t += d + 0.07 + r() * 0.1; } }
  else { parts.push([0, chirp(f, f * 1.4, 0.05)], [0.09, chirp(f * 1.4, f * 0.9, 0.06)]); }
  const total = Math.max(...parts.map(([t, x]) => t + x.length / SR)), out = Buf(secs(total + 0.05)); for (const [t, x] of parts) addInto(out, x, secs(t)); return out;
}
/** Wind through leaves (stereo): gusting band-pass noise and a faint high rustle. */
function windLeaves(n, seed = 'wind') {
  const r = RNG(seed), out = [];
  for (let ch = 0; ch < 2; ch++) {
    const x = pink(n, r), g = wander(n, r, 0.25), g2 = wander(n, r, 0.9), ru = white(n, r), ru2 = wander(n, r, 6);
    svf(x, 'bp', (i) => 650 + 600 * g[i] + 200 * g2[i], 0.7); svf(ru, 'hp', 3400, 0.7);
    const y = Buf(n); for (let i = 0; i < n; i++) y[i] = x[i] * (0.45 + 0.55 * (0.5 + 0.5 * g[i])) + ru[i] * 0.5 * Math.max(0, 0.3 + 0.7 * g[i]) * (0.5 + 0.5 * ru2[i]);
    out.push(setRms(y, 0));
  }
  return out;
}
/** A distant car going by (stereo): engine harmonics and road noise with Doppler, level and pan following a straight pass.  Peak (closest) at the middle sample. */
function carPass(durS, seed = 'car') {
  const r = RNG(seed), n = secs(durS), d0 = 16, v = 13, c = 343, half = durS / 2, L = Buf(n), R = Buf(n);
  const pos = (i) => v * (i / SR - half), dist = (i) => Math.sqrt(d0 * d0 + pos(i) ** 2), dop = (i) => c / (c - v * pos(i) / dist(i));
  const eng = sawB(n, (i) => 52 * dop(i), 0), eng2 = sawB(n, (i) => 104.5 * dop(i), 0.3); svf(eng, 'lp', 520, 0.9); svf(eng2, 'lp', 900, 0.9);
  const rd = pink(n, r); svf(rd, 'bp', (i) => 900 * dop(i), 0.5); const rd2 = white(n, r); svf(rd2, 'bp', (i) => 2400 * dop(i), 0.6);
  for (let i = 0; i < n; i++) {
    const di = dist(i), a = d0 / di, a2 = a * a, x = (eng[i] * 0.9 + eng2[i] * 0.35) * a2 + rd[i] * 0.9 * a2 + rd2[i] * 0.08 * a2, p = clamp(pos(i) / di, -1, 1), th = (p + 1) * Math.PI / 4;
    L[i] = x * Math.cos(th); R[i] = x * Math.sin(th);
  }
  const f = swellEnv(n, durS * 0.2, durS * 0.2); mul(L, f); mul(R, f); return [L, R];
}
/** Klaxon blast (mono): rising swept saw + square pair, lowpassed, with a hard gate shape. */
function klaxonBlast(f, durS, sweep = 1.45, seed = 'klx') {
  const r = RNG(seed), n = secs(durS), fa = (i) => f * (1 + (sweep - 1) * Math.pow(Math.min(1, i / (n * 0.8)), 1.4)), a = sawB(n, fa, r()), b = pulseB(n, (i) => fa(i) * 1.005, 0.38, r()), x = Buf(n);
  for (let i = 0; i < n; i++) x[i] = a[i] * 0.6 + b[i] * 0.5; svf(x, 'lp', 2600, 1.4); sat(x, 2.2); bq(x, 'peak', 1100, 1, 4); mul(x, swellEnv(n, 0.012, 0.03)); return x;
}
/** Door latch / bolt: click, slide rasp, clunk (mono). kind: latch | bolt | buzz */
function doorMech(kind, seed = 'door') {
  const r = RNG(seed);
  if (kind === 'buzz') { const n = secs(0.9), x = pulseB(n, 118, 0.3); svf(x, 'bp', 1100, 1.2); const y = pulseB(n, 236.3, 0.2); for (let i = 0; i < n; i++) x[i] = (x[i] + y[i] * 0.3) * (i > secs(0.62) ? 0 : 1); mul(x, swellEnv(n, 0.01, 0.04)); const k = metalTick(seed + 'k', 1800), cl = clangHit(310, 0.4, 0.5, seed + 'c'); const o = Buf(secs(1.4)); addInto(o, x, 0, 0.7); addInto(o, k, secs(0.62), 0.9); addInto(o, cl, secs(0.64), 0.35); return o; }
  if (kind === 'bolt') { const n = secs(0.7), g = white(n, r); svf(g, 'bp', (i) => 1500 + 1800 * (i / n), 1.6); const am = wander(n, r, 40); mul(g, swellEnv(n, 0.2, 0.15)); for (let i = 0; i < n; i++) g[i] *= 0.5 + 0.5 * Math.abs(am[i]); const cl = clangHit(240, 0.6, 0.6, seed + 'c'), o = Buf(secs(1.5)); addInto(o, g, 0, 0.5); addInto(o, cl, n, 0.7); addInto(o, doorSlam(0.3, seed + 's'), n, 0.4); return o; }
  const t = metalTick(seed + 't', 2600), cl = clangHit(330, 0.5, 0.6, seed + 'c'), th = sineF(secs(0.12), fall(160, 70, 0.02)); mul(th, perc(th.length, 0.001, 0.03)); const o = Buf(secs(0.9)); addInto(o, t, 0, 0.8); addInto(o, cl, secs(0.04), 0.4); addInto(o, th, secs(0.03), 0.6); return o;
}
/** Warm sub tone (mono) for the end card and the drop. */
function subTone(f, durS, atk, rel) { const n = secs(durS), x = sineF(n, f), h = sineF(n, f * 2); const y = Buf(n); for (let i = 0; i < n; i++) y[i] = x[i] + h[i] * 0.12; return mul(y, swellEnv(n, atk, rel)); }

// ============================================================ 3. the arrangement
const F = frameOf;
let WIN = null;                                                  // development window [f0, f1] in frames (null = everything)
const go = (f0, f1) => !WIN || (f1 > WIN[0] && f0 < WIN[1]);
const cues = [];
const rangeOf = (f) => (f >= END_CARD.start ? 'END' : (RANGES.find((r) => f >= r.start && f < r.start + r.frames) || {}).id || '');
/** Log an event for the cue sheet.  dur = length in frames of the audible event (tail excluded); kind = hit | note | layer | stream | gap. */
function cue(f, name, stem, intent, extra = {}) { cues.push({ frame: Math.round(f), range: rangeOf(Math.round(f)), name, stem, intent, ...extra }); }
const CUT = smp(F(23));                                          // the end of bar 22: everything that began earlier is cut here, tails and reverb included
class Bus {
  constructor() { this.l = null; this.r = null; this.sends = new Map(); }
  get L() { return this.l || (this.l = Buf(NS)); }
  get R() { return this.r || (this.r = Buf(NS)); }
  send(name, part) { const k = `${name}|${part}`; let b = this.sends.get(k); if (!b) { b = Buf(NS); this.sends.set(k, b); } return b; }
}
let BUS = null;
const newBuses = () => { BUS = { music: new Bus(), design: new Bus(), dia: new Bus(), post: { music: new Bus(), design: new Bus(), dia: new Bus() } }; };
function cutShort(arrs, at) {                                    // truncate events that straddle the cut, with a 2 ms fade
  if (at >= CUT || at + arrs[0].length <= CUT) return arrs;
  const len = CUT - at; return arrs.map((x) => { const y = x.slice(0, len); const fd = Math.min(96, len); for (let k = 0; k < fd; k++) y[len - 1 - k] *= k / fd; return y; });
}
/** Place a stereo event.  o: g (linear), pan (mono events), send {irName: amount}, post (after the cut, not subject to it). */
function putS(stem, xl, xr, f, o = {}) {
  const bus = o.post ? BUS.post[stem] : BUS[stem], at = Math.round(f * SPF), part = at < CUT || o.post ? (o.post ? 1 : 0) : 1;
  if (at < 0 || at >= NS) return;
  [xl, xr] = o.post ? [xl, xr] : cutShort([xl, xr], at);
  const g = o.g ?? 1, e = Math.min(xl.length, NS - at), L = bus.L, R = bus.R;
  if (o.dry !== false) for (let i = 0; i < e; i++) { L[at + i] += xl[i] * g; R[at + i] += xr[i] * g; }
  if (o.send) for (const k in o.send) { const sb = bus.send(k, part), sg = o.send[k] * g * 0.5; for (let i = 0; i < e; i++) sb[at + i] += (xl[i] + xr[i]) * sg; }
}
function put(stem, x, f, o = {}) {
  const th = ((o.pan ?? 0) + 1) * Math.PI / 4, a = Math.cos(th), b = Math.sin(th), at = Math.round(f * SPF);
  if (at < 0 || at >= NS) return;
  const [y] = o.post ? [x] : cutShort([x], at), g = o.g ?? 1, bus = o.post ? BUS.post[stem] : BUS[stem], part = o.post || at >= CUT ? 1 : 0, e = Math.min(y.length, NS - at), L = bus.L, R = bus.R;
  if (o.dry !== false) for (let i = 0; i < e; i++) { L[at + i] += y[i] * g * a; R[at + i] += y[i] * g * b; }
  if (o.send) for (const k in o.send) { const sb = bus.send(k, part), sg = o.send[k] * g; for (let i = 0; i < e; i++) sb[at + i] += y[i] * sg; }
}
/** A big impact: the dry hit keeps its sub; only the part above 140 Hz feeds the long dark reverb, so the tail is dark but not boomy. */
function bigHit(f, o, dryDb, wetDb, send) {
  const [l, r] = impact(o); putS('design', l, r, f, { g: dB(dryDb) });
  const wl = Float32Array.from(l), wr = Float32Array.from(r); bq(wl, 'hp', 140, 0.7); bq(wr, 'hp', 140, 0.7);
  putS('design', wl, wr, f, { g: dB(wetDb), dry: false, send: { hall: send } });
}
const DIPS = [];                                                 // air gaps just before the hits: [frame, length in frames]
/** A bed (long stereo layer) with a dB envelope given as absolute-frame keys, placed from frame f0. */
function bed(stem, lr, f0, keys, o = {}) { const e = envKeys(keys, f0, lr[0].length); mul(lr[0], e); mul(lr[1], e); putS(stem, lr[0], lr[1], f0, o); }
const MID = { D1: 26, A1: 33, D2: 38, A2: 45, D3: 50, F3: 53, A3: 57, D4: 62 };
/** String-ensemble chord from frame f0 to f1 (the tail overlaps the next chord).  midis: note numbers; o: db, att, rel, bright, vib, send, sub (on the lowest note), name, intent. */
function padChord(stem, midis, f0, f1, o = {}) {
  cue(f0, o.name ?? 'strings', stem, o.intent ?? 'string pad', { dur: f1 - f0, notes: midis.join(' '), kind: 'layer' });
  if (!go(f0 - 160, f1 + 160)) return;
  const durS = (f1 - f0) / FPS;
  midis.forEach((m, i) => {
    const [l, r] = stringsNote(mtof(m), durS, { att: o.att ?? 1.2, rel: o.rel ?? 1.5, bright: o.bright ?? 0.5, vib: o.vib ?? 0.6, sub: i === 0 ? o.sub : 0, seed: `pad${m}-${f0}-${o.name ?? ''}` });
    putS(stem, l, r, f0, { g: dB((o.db ?? -24) + (o.gains ? o.gains[i] ?? 0 : 0)), send: o.send ?? { hall: 0.45 } });
  });
}
/** Piano phrase: freqs in Hz, first note at frame f0, spacing in frames, velocity v (a number, or a function of the note index). */
function pianoPhrase(freqs, f0, spacing, v, o = {}) {
  freqs.forEach((fr, i) => {
    const fa = f0 + (Array.isArray(spacing) ? spacing[i] : i * spacing), vel = typeof v === 'function' ? v(i) : v;
    cue(fa, o.name ?? `piano ${Math.round(fr * 10) / 10} Hz`, 'music', o.intent ?? 'piano', { kind: 'note', hz: Math.round(fr * 10) / 10 });
    if (!go(fa, fa + 200)) return;
    put('music', pianoNote(fr, vel, o.len ?? 5.5, { seed: `pn${fr}-${fa}` }), fa, { g: dB(o.db ?? -14), pan: (o.pan ?? 0) + (i % 2 ? 0.08 : -0.08), send: o.send ?? { chapel: 0.9, hall: 0.25 } });
  });
}
/** A low synth ostinato note for the pulse: band-limited pulse + saw, lowpass plucked, gated. */
function pulseNote(midi, lenFrames, fc, seed) {
  const f = mtof(midi), lenS = lenFrames / FPS, n = secs(lenS + 0.12), p = pulseB(n, f, 0.42), s = sawB(n, f * 1.003), sb = sineF(n, f), x = Buf(n);
  for (let i = 0; i < n; i++) x[i] = p[i] * 0.45 + s[i] * 0.35 + sb[i] * 0.5;
  svf(x, 'lp', (i) => fc * (0.3 + 0.7 * Math.exp(-i / (0.085 * SR))), 1.15);
  for (let i = 0; i < n; i++) { const t = i / SR; x[i] *= Math.min(1, t / 0.004) * Math.exp(-t / 0.2) * (t > lenS ? Math.exp(-(t - lenS) / 0.025) : 1); }
  return x;
}
const crashSound = (durS, seed) => { const r = RNG(seed), n = secs(durS), out = []; for (let ch = 0; ch < 2; ch++) { const x = white(n, r); bq(x, 'hp', 2600, 0.7); bq(x, 'peak', 7000, 0.8, 4); mul(x, perc(n, 0.002, durS * 0.3)); out.push(x); } return out; };
const stoneThud = (seed) => { const r = RNG(seed), n = secs(1.4), s = sineF(n, fall(90, 48, 0.05)); mul(s, perc(n, 0.002, 0.28)); const b = brown(n, r); normalize(b); svf(b, 'lp', 260, 0.8); mul(b, perc(n, 0.002, 0.12)); for (let i = 0; i < n; i++) s[i] = s[i] * 0.9 + b[i] * 0.6; return s; };
/** The drone (stereo): D1 + fifth + a thin minor second above the octave that never resolves. */
function droneBuf(n, root = 36.71, seed = 'drone') {
  const r = RNG(seed), out = [];
  for (let ch = 0; ch < 2; ch++) {
    const det = ch ? 1.0016 : 0.9984, a = sineF(n, root * det, r() * TAU), h = Float32Array.from(a), b = sawB(n, root * det * 1.002, r()), c = sineF(n, root * 1.5 * det, r() * TAU), d = sineF(n, root * 2.119 * det, r() * TAU), am = wander(n, r, 0.1);
    sat(h, 3); bq(h, 'lp', 260, 0.7); svf(b, 'lp', 140, 0.8);
    const x = Buf(n); for (let i = 0; i < n; i++) x[i] = a[i] * 0.9 + h[i] * 0.3 + b[i] * 0.25 + c[i] * 0.22 + d[i] * 0.07 * (0.5 + 0.5 * am[i]);
    out.push(setRms(x, 0));
  }
  return out;
}

function arrange() {
  const M = 'music', D = 'design', W = 'dia';
  // ------------------------------------------------------------ A0  cold open, bars 1-4
  cue(0, 'room tone', W, 'cell-block air handling, mains hum, a breath of hiss: the held breath of the waking cell', { dur: F(9), kind: 'layer', note: 'fades out under the hit by bar 8' });
  if (go(0, F(9))) bed(W, roomTone(smp(F(9)), 'room-a0'), 0, [[0, -90], [30, -50], [F(5) - 12, -49], [F(5) - 5, -90], [F(5), -62], [F(5) + 40, -53], [F(7), -57], [F(9), -90]], { send: { block: 0.25 } });
  cue(0, 'drone D1', M, 'low unresolved drone: D1 + fifth + a thin minor second that never resolves; swells to the hit', { dur: F(11), kind: 'layer' });
  if (go(0, F(11))) bed(M, droneBuf(smp(F(11)), 36.71), 0, [[0, -90], [20, -62], [F(3), -50], [F(5) - 12, -42], [F(5) - 5, -90], [F(5), -52], [F(5) + 60, -46], [F(9), -46], [F(11) - 6, -44], [F(11), -80]], { send: { hall: 0.5 } });
  for (let k = 0; k < 7; k++) {
    const f = 28 + k * 32, st = 0.3 + 0.1 * k;
    cue(f, 'heartbeat', D, k === 0 ? 'slow heartbeat (45 bpm), one lub-dub every two beats; grows slightly and stops before the hit' : 'heartbeat', { kind: 'note', strength: +st.toFixed(2) });
    if (go(f, f + 30)) put(D, heartBeat(st, `hb0-${k}`), f, { g: dB(-27), send: { hall: 0.35, block: 0.15 } });
  }
  cue(F(1, 3), 'PA crackle (distant)', W, 'the PA comes alive somewhere down the block: mic thump, hiss, crackle', { dur: 30, kind: 'note' });
  if (go(F(1, 3), F(1, 3) + 60)) put(W, paCrackle(1.15, 'pa1'), F(1, 3), { g: dB(-39), pan: -0.55, send: { block: 0.9, hall: 0.2 } });
  cue(F(3, 2), 'PA crackle (distant 2)', W, 'second PA crackle, further away and shorter', { dur: 20, kind: 'note' });
  if (go(F(3, 2), F(3, 2) + 40)) put(W, paCrackle(0.7, 'pa2'), F(3, 2), { g: dB(-42), pan: 0.5, send: { block: 1.0, hall: 0.25 } });
  cue(F(4, 3), 'inhale (reverse swell)', D, 'a held breath before the hit: reversed low noise swell', { dur: 24, kind: 'note' });
  if (go(F(4, 3), F(5))) put(D, suckIn(0.9, 260, 'suck5'), F(4, 3) + 0, { g: dB(-33), send: { hall: 0.3 } });
  DIPS.push([F(5) - 6, 6]);
  // ---- the hit, bar 5
  cue(F(5), 'HIT sub impact + cell-door clang', D, 'deep sub impact with a metallic cell-door clang and a long dark reverb tail (6 s hall)', { kind: 'hit', dur: 24 });
  if (go(F(5), F(5) + 400)) {
    bigHit(F(5), { size: 1.3, dur: 4.2, pitch: 32, clang: 0.7, clangF: 150, clangDecay: 3.0, tail: 0.7, seed: 'hit5' }, -9.5, -6, 1.0);
    put(D, doorSlam(1, 'cell5'), F(5), { g: dB(-13), pan: -0.15, send: { hall: 0.8, block: 0.4 } });
    put(M, taiko(73.4, 1, 'tk5'), F(5), { g: dB(-14), send: { hall: 0.6 } });
  }
  // ------------------------------------------------------------ A1  the block, bars 5-10
  padChord(M, [50, 57, 65, 69], F(5), F(7), { name: 'cold strings Dm', db: -29, bright: 0.72, vib: 0.15, att: 2.4, send: { hall: 0.7 }, intent: 'cold string-like pad, thin and glassy: D minor' });
  padChord(M, [46, 53, 62, 65], F(7), F(9), { name: 'cold strings Bb', db: -29, bright: 0.72, vib: 0.15, att: 2.0, send: { hall: 0.7 }, intent: 'cold pad moves to B-flat' });
  padChord(M, [43, 50, 58, 62], F(9), F(10), { name: 'cold strings Gm', db: -28, bright: 0.72, vib: 0.2, att: 1.4, send: { hall: 0.6 }, intent: 'cold pad, G minor: the pulse has entered' });
  padChord(M, [45, 52, 57, 61, 64], F(10), F(11), { name: 'cold strings A', db: -28, bright: 0.75, vib: 0.25, att: 1.0, send: { hall: 0.6 }, intent: 'dominant A major: leans into bar 11', rel: 0.6 });
  cue(F(5), 'D1 pedal sub', M, 'low D under the block', { kind: 'layer', dur: F(11) - F(5) });
  const ticks = [[5, 36], [5, 52], [6, 8], [6, 40], [6, 56], [7, 24], [7, 48], [8, 0], [8, 20], [8, 36], [8, 52], [8, 60]];
  ticks.forEach(([b, o], i) => { const f = F(b) + o; cue(f, 'metal tick', W, 'pipe or key ticking in the block: a sparse cold detail', { kind: 'note' }); if (go(f, f + 10)) put(W, metalTick(`t${i}`, 2600 + 900 * ((i * 37) % 5) / 5), f, { g: dB(-33 + (i % 3) * 2), pan: ((i * 53) % 100) / 50 - 1, send: { block: 0.6 } }); });
  const doors = [['bolt', 6, 3, 'bolt slides across: a cell door secured'], ['buzz', 7, 2, 'door buzzer, then the lock thunks'], ['latch', 8, 3, 'latch click and a steel knock'], ['bolt', 9, 3, 'second bolt, closer'], ['buzz', 10, 2, 'buzzer and clunk, the door releases']];
  doors.forEach(([k, b, bt, intent], i) => { const f = F(b, bt); cue(f, `door ${k}`, W, intent, { kind: 'note' }); if (go(f, f + 60)) put(W, doorMech(k, `door${i}`), f, { g: dB(-22 + i * 0.7), pan: i % 2 ? 0.4 : -0.4, send: { block: 0.55, hall: 0.2 } }); });
  // pulse enters at bar 9
  const A1pat = [38, 38, 38, 38, 38, 38, 33, 38];
  cue(F(9), 'pulse ostinato (8ths on D/A)', M, 'restrained dark pulse enters: low synth ostinato in 8th notes on D2 / A1; filter opens through bar 10', { kind: 'stream', dur: F(11) - F(9), pattern: 'D D D D D D A D', rate: '8ths' });
  for (let b = 9; b <= 10; b++) A1pat.forEach((m, i) => { const f = F(b) + i * 8; if (go(f, f + 14)) put(M, pulseNote(m, 6, 520 + (b - 9) * 280 + i * 22, `pa1${b}${i}`), f, { g: dB(-21 + (i % 4 === 0 ? 1.5 : 0)), send: { block: 0.2, hall: 0.18 } }); });
  cue(F(10), 'hat ticks begin (8ths)', M, 'metal tick on the off-8ths: the pulse gets its first rhythm', { kind: 'stream', dur: 64 });
  for (let i = 0; i < 8; i++) { const f = F(10) + i * 8 + 4; if (go(f, f + 8)) put(M, hat(false, `h10${i}`), f, { g: dB(-31 + (i % 2) * 2), pan: i % 2 ? 0.3 : -0.3, send: { block: 0.15 } }); }
  cue(F(10), 'riser into bar 11', D, 'rising noise and pitch riser, 2.5 s, stops 4 frames before the hit', { kind: 'layer', dur: 60 });
  if (go(F(10), F(11))) { const [l, r] = riser(60 / FPS, { f0: 300, f1: 9500, p0: 146.8, p1: 440, noise: 0.9, tone: 0.5, seed: 'ris10' }); putS(D, l, r, F(10), { g: dB(-27), send: { hall: 0.35 } }); }
  DIPS.push([F(11) - 3, 3]);
  // ------------------------------------------------------------ A2  the ask, bars 11-16
  cue(F(11), 'HIT bar 11: impact + D braam', D, 'the ask: sub impact, short clang and a detuned brass braam on D', { kind: 'hit', dur: 24 });
  if (go(F(11), F(11) + 300)) {
    bigHit(F(11), { size: 1.0, dur: 3.0, pitch: 36, clang: 0.35, clangF: 190, clangDecay: 1.2, tail: 0.7, seed: 'hit11' }, -9, -8, 0.8);
    const [bl, br] = braam(73.42, 3.0, { seed: 'br11', open: 2800 }); putS(M, bl, br, F(11), { g: dB(-17), send: { hall: 0.5 } });
  }
  [[11, 'strings Dm', [50, 57, 65, 69], F(13)], [13, 'strings Dm (tense)', [50, 57, 65, 62], F(15)]].forEach(([b, n, ch, end]) => padChord(M, ch, F(b), end, { name: n, db: -27, bright: 0.65, vib: 0.2, att: 0.5, send: { hall: 0.5 }, intent: 'cold sustained strings under the pulse' }));
  padChord(M, [46, 53, 58, 62], F(15), F(16), { name: 'strings Bb', db: -26, bright: 0.7, vib: 0.3, att: 0.4, send: { hall: 0.5 }, intent: 'B-flat, pulling downwards', rel: 0.5 });
  padChord(M, [45, 52, 57, 61], F(16), F(17), { name: 'strings A (dominant)', db: -25, bright: 0.75, vib: 0.4, att: 0.4, send: { hall: 0.5 }, intent: 'dominant A: everything points at bar 17', rel: 0.3 });
  const A2pat = [38, 38, 50, 38, 33, 38, 50, 33];
  cue(F(11), 'pulse ostinato tightens', M, 'the 8th-note ostinato returns brighter with octave jumps', { kind: 'stream', dur: F(17) - F(11), pattern: 'D D D\' D A D D\' A', rate: '8ths' });
  for (let b = 11; b <= 16; b++) A2pat.forEach((m, i) => { const f = F(b) + i * 8; if (go(f, f + 14)) put(M, pulseNote(m, 6, 900 + (b - 11) * 260 + (i % 2) * 150, `pa2${b}${i}`), f, { g: dB(-18.5 + (i % 4 === 0 ? 1.5 : 0)), send: { block: 0.2, hall: 0.2 } }); });
  cue(F(11), '16th hi-hat ticks', M, 'the pulse tightens: closed hi-hat-like ticks on every 16th, accents on the off-beats; open tick on the and of 4', { kind: 'stream', dur: F(17) - F(11), rate: '16ths' });
  for (let b = 11; b <= 16; b++) for (let i = 0; i < 16; i++) { const f = F(b) + i * 4; if (!go(f, f + 8)) continue; const acc = i % 4 === 2 ? 1 : i % 2 ? 0.7 : 0.45, open = i === 14; put(M, hat(open, `h2${b}${i}`, 8500), f, { g: dB(-28 + (b - 11) * 0.8) * acc, pan: ((i % 4) - 1.5) * 0.25, send: { block: 0.12 } }); }
  cue(F(11), 'filtered noise sweep', M, 'band-passed noise climbing through the whole range, tension without pitch', { kind: 'layer', dur: F(17) - F(11) });
  if (go(F(11), F(17))) {
    const r = RNG('sweep2'), n = smp(F(17) - F(11)), L = white(n, r), R = white(n, r);
    for (const x of [L, R]) svf(x, 'bp', (i) => 500 * Math.pow(7000 / 500, Math.pow(i / n, 1.2)), 1.6);
    bed(M, [L, R], F(11), [[F(11), -60], [F(12), -49], [F(14), -43], [F(16), -36], [F(17) - 4, -33]], { send: { hall: 0.25 } });
  }
  for (let k = 0; k < 3; k++) {
    const fr = F(11) + 36 + k * 32;
    cue(fr, 'heartbeat returns', D, k === 0 ? 'the heartbeat returns, every two beats, then every beat from bar 14' : 'heartbeat', { kind: 'note' });
    if (go(fr, fr + 30)) put(D, heartBeat(0.55 + 0.08 * k, `hb2-${k}`), fr, { g: dB(-24), send: { hall: 0.3, block: 0.1 } });
  }
  for (let b = 14; b <= 16; b++) for (let i = 0; i < 4; i++) { const fr = F(b) + i * 16 + 4; cue(fr, 'heartbeat', D, 'heartbeat on every beat: the pulse rate climbs', { kind: 'note' }); if (go(fr, fr + 30)) put(D, heartBeat(0.6 + 0.07 * (b - 14), `hb2b${b}${i}`), fr, { g: dB(-24), send: { hall: 0.25 } }); }
  cue(F(12), 'clock tick-tock', W, 'a clock tick on every beat from bar 12: time is running (alternating pitch)', { kind: 'stream', dur: F(17) - F(12) - 8, rate: 'beats' });
  for (let b = 12; b <= 16; b++) for (let i = 0; i < 4; i++) { const f = F(b) + i * 16; if (!go(f, f + 10)) continue; put(W, metalTick(`clk${b}${i}`, i % 2 ? 1850 : 2300), f, { g: dB(-27 + (b - 12) * 0.6), pan: 0.1, send: { block: 0.35 } }); }
  const brs = [[12, 'D', 73.42, 1.2, 0.55, -20, 2200], [13, 'Bb', 58.27, 2.4, 0.8, -18, 2600], [14, 'Bb', 58.27, 1.3, 0.6, -20, 2400], [15, 'A', 55, 2.5, 0.9, -17, 3000]];
  brs.forEach(([b, nm, fr, du, , db, op]) => { cue(F(b), `braam ${nm}`, M, 'detuned brass-like braam on the bar start' , { kind: 'note', dur: Math.round(du * FPS) }); if (go(F(b), F(b) + 160)) { const [l, r] = braam(fr, du, { seed: `br${b}`, open: op, atk: 0.04 }); putS(M, l, r, F(b), { g: dB(db), send: { hall: 0.45 } }); } });
  cue(F(13), 'trem strings (high)', M, 'tremolo strings above: unease', { kind: 'layer', dur: F(17) - F(13) });
  [[13, 15, [62, 65, 69]], [15, 16, [58, 62, 65]], [16, 17, [57, 61, 64, 69]]].forEach(([a, bb, ch]) => { if (!go(F(a), F(bb) + 100)) return; ch.forEach((m, i) => { const [l, r] = stringsNote(mtof(m + 12), (F(bb) - F(a)) / FPS, { att: 0.6, rel: 0.5, bright: 0.8, vib: 0.2, seed: `trm${a}${m}` }); const am = Buf(l.length); for (let k = 0; k < am.length; k++) am[k] = 0.55 + 0.45 * Math.sin(TAU * 11 * k / SR); mul(l, am); mul(r, am); putS(M, l, r, F(a), { g: dB(-36 + (a - 13) * 1.5), send: { hall: 0.4 } }); }); });
  cue(F(16), 'riser into bar 17', D, 'big riser over the whole of bar 16: noise and a gliding saw pair, accelerating metal ticks in beat 4; stops 3 frames before the hit', { kind: 'layer', dur: 61 });
  if (go(F(16), F(17))) { const [l, r] = riser(61 / FPS, { f0: 400, f1: 11000, p0: 196, p1: 784, noise: 1, tone: 0.8, seed: 'ris16', curve: 1.8 }); putS(D, l, r, F(16), { g: dB(-24), send: { hall: 0.4 } }); }
  [0, 4, 8, 11, 14, 17, 20, 22, 24, 26, 27, 28].forEach((o, i) => { const f = F(16, 4) + o * 1; const ff = f; cue(ff, 'accelerating tick', D, 'metal ticks accelerate into the alarm', { kind: 'note' }); if (go(ff, ff + 8)) put(D, metalTick(`acc${i}`, 3400 + i * 80), ff, { g: dB(-27 + i * 0.5), pan: (i % 2) * 0.6 - 0.3, send: { block: 0.3 } }); });
  DIPS.push([F(17) - 3, 3]);
  // ------------------------------------------------------------ A3  alarm and chase, bars 17-22
  const SEMI = { 17: 0, 18: 0, 19: 1, 20: 2, 21: 3, 22: 5 };                       // the root climbs: rising pitch tension
  const rootF = (b, base) => base * Math.pow(2, SEMI[b] / 12);
  cue(F(17), 'HIT bar 17: the alarm', D, 'the peak: sub impact, steel clang, taiko, crash and a door slam together', { kind: 'hit', dur: 30 });
  if (go(F(17), F(17) + 400)) {
    bigHit(F(17), { size: 1.5, dur: 3.6, pitch: 34, clang: 0.9, clangF: 200, clangDecay: 1.8, crack: 1.4, tail: 0.6, seed: 'hit17' }, -8, -8, 0.8);
    put(D, doorSlam(1, 'slam17'), F(17), { g: dB(-11), pan: 0.2, send: { block: 0.5, hall: 0.4 } });
    const [cl, cr] = crashSound(3.0, 'crash17'); putS(D, cl, cr, F(17), { g: dB(-27), send: { hall: 0.5 } });
    [73.4, 110, 55].forEach((f, i) => put(M, taiko(f, 1, `tk17${i}`), F(17) + i * 0.5, { g: dB(-10), pan: (i - 1) * 0.3, send: { hall: 0.5, block: 0.2 } }));
  }
  const A3pat = [38, 50, 38, 50, 33, 45, 38, 50];
  cue(F(17), 'pulse ostinato (full)', M, 'the ostinato at full weight, octave-doubled, climbing a semitone per bar from bar 19 (D, D, E-flat, E, F, F-sharp)', { kind: 'stream', dur: F(23) - F(17), rate: '8ths' });
  for (let b = 17; b <= 22; b++) A3pat.forEach((m, i) => { const f = F(b) + i * 8; if (go(f, f + 14)) put(M, pulseNote(m + SEMI[b], 7, 1500 + (b - 17) * 300, `pa3${b}${i}`), f, { g: dB(-12.5 + (i % 2 === 0 ? 1.5 : 0)), send: { block: 0.2, hall: 0.2 } }); });
  const kickBars = (b) => (b <= 18 ? [0, 32] : [0, 16, 32, 48]);
  cue(F(17), 'kicks with sub', D, 'kick drum with a sub tail: beats 1 and 3 in bars 17-18, every beat from bar 19', { kind: 'stream', dur: F(23) - F(17), rate: 'beats' });
  for (let b = 17; b <= 22; b++) kickBars(b).forEach((o, i) => { const f = F(b) + o; if (go(f, f + 30)) put(D, kick(1, `k${b}${i}`), f, { g: dB(o === 0 ? -11 : -13), send: { block: 0.12 } }); });
  const tomPat = { 17: [0, 40, 56], 18: [0, 24, 40, 56], 19: [0, 24, 32, 48, 56], 20: [0, 24, 32, 48, 56], 21: [0, 16, 24, 32, 40, 48, 56], 22: [0, 24, 32, 36, 40, 44, 48, 50, 52, 54, 56, 58, 60, 62] };
  cue(F(17), 'taiko-like toms', M, 'taiko toms: the big phrase, denser each bar; bar 22 ends in a rising roll that is cut off at the bar line', { kind: 'stream', dur: F(23) - F(17) });
  for (let b = 17; b <= 22; b++) tomPat[b].forEach((o, i) => { const f = F(b) + o; if (!go(f, f + 30)) return; const pitchs = [73.4, 98, 130.8, 98], fr = pitchs[(i + b) % 4] * Math.pow(2, SEMI[b] / 12), v = b === 22 && o >= 36 ? 0.45 + (o - 36) / 40 : o % 16 === 0 ? 0.85 : 0.65; put(M, taiko(fr, v, `tom${b}${i}`), f, { g: dB(-13.5), pan: ((i % 3) - 1) * 0.35, send: { hall: 0.45, block: 0.2 } }); });
  cue(F(17), 'steel backbeat', M, 'metallic hits (rail / cell bar) on beats 2 and 4', { kind: 'stream', dur: F(23) - F(17) });
  for (let b = 17; b <= 22; b++) [16, 48].forEach((o, i) => { const f = F(b) + o; if (go(f, f + 40)) put(M, clangHit(520 + 60 * (i + b % 3), 0.45, 0.8, `bb${b}${i}`), f, { g: dB(-26), pan: i ? 0.25 : -0.25, send: { block: 0.4 } }); });
  cue(F(17), '16th hats (alarm)', M, 'hi-hat ticks on every 16th, open on the off-beats', { kind: 'stream', dur: F(23) - F(17), rate: '16ths' });
  for (let b = 17; b <= 22; b++) for (let i = 0; i < 16; i++) { const f = F(b) + i * 4; if (!go(f, f + 8)) continue; put(M, hat(i % 4 === 2, `h3${b}${i}`, 8800), f, { g: dB(-24) * (i % 4 === 2 ? 1 : i % 2 ? 0.7 : 0.5), pan: ((i % 4) - 1.5) * 0.25, send: { block: 0.1 } }); }
  cue(F(17), 'braam stabs', M, 'detuned brass stabs on the bar starts, following the climbing root', { kind: 'stream', dur: F(23) - F(17) });
  for (let b = 17; b <= 22; b++) { const f = F(b); if (go(f, f + 120)) { const [l, r] = braam(rootF(b, 73.42), b === 22 ? 1.4 : 1.1, { seed: `brs${b}`, open: 3200 + 300 * (b - 17), atk: 0.02, rel: 0.6 }); putS(M, l, r, f, { g: dB(-15), send: { hall: 0.3 } }); } }
  cue(F(17), 'rising pitch tension', M, 'a saw pair glides upward for the whole of A3 (D3 to D6) under everything: the pitch never rests', { kind: 'layer', dur: F(23) - F(17) });
  if (go(F(17), F(23))) { const [l, r] = riser((F(23) - F(17)) / FPS, { f0: 3000, f1: 3000, p0: 146.8, p1: 1174.7, noise: 0, tone: 1, curve: 1.2, seed: 'a3rise' }); putS(M, l, r, F(17), { g: dB(-29), send: { hall: 0.3 } }); }
  cue(F(17), 'alarm klaxon figure', D, 'synth klaxon: four rising whoops per bar, ducked by the kick; the root climbs with the bars', { kind: 'stream', dur: F(23) - F(17), rate: 'beats' });
  for (let b = 17; b <= 22; b++) for (let i = 0; i < 4; i++) {
    const f = F(b) + i * 16; if (!go(f, f + 16)) continue;
    const x = klaxonBlast(466.2 * Math.pow(2, SEMI[b] / 12), 11 / FPS, 1.45, `klx${b}${i}`); const nn = x.length; for (let k = 0; k < nn; k++) x[k] *= 1 - 0.55 * Math.exp(-k / (0.09 * SR));
    put(D, x, f, { g: dB(-24 + (b - 17) * 0.5), pan: i % 2 ? 0.2 : -0.2, send: { block: 0.4, hall: 0.2 } });
  }
  cue(F(18, 3), 'lockdown PA chime', W, 'two-tone PA chime from the speakers: the lockdown announcement is about to start (no voice in the score)', { kind: 'note' });
  if (go(F(18, 3), F(18, 3) + 80)) put(W, paChime('chime18'), F(18, 3), { g: dB(-25), pan: -0.3, send: { block: 0.7, hall: 0.2 } });
  cue(F(20, 3), 'PA crackle burst', W, 'PA speaker crackle during the lockdown call', { kind: 'note', dur: 20 });
  if (go(F(20, 3), F(20, 3) + 40)) put(W, paCrackle(0.8, 'pa20'), F(20, 3), { g: dB(-27), pan: 0.4, send: { block: 0.6 } });
  // designed hits on the cuts: every slot is a multiple of 8 frames, so any cut on the half-beat grid lands on a sound
  const rc = RNG('a3cuts'), dens = { 17: 0.45, 18: 0.55, 19: 0.65, 20: 0.75, 21: 0.85, 22: 0.95 };
  cue(F(17), 'cut hits (boots, slams, steel)', D, 'designed hits on the 8-frame grid for the editor to cut on: boots, door slams, steel clangs, whips. See the individual entries', { kind: 'stream', dur: F(23) - F(17), rate: '8 frames' });
  let stepSide = 1;
  for (let b = 17; b <= 22; b++) for (let s = 0; s < 8; s++) {
    const o = s * 8, f = F(b) + o, roll = rc(), downbeat = o === 0;
    if (b === 17 && s === 0) continue;                            // the bar-17 hit is its own entry
    if (!downbeat && roll > dens[b]) continue;
    const pick = rc(); let type;
    if (downbeat) type = 'slam'; else if (o % 16 === 0) type = pick < 0.45 ? 'slam' : pick < 0.8 ? 'clang' : 'boot'; else type = pick < 0.6 ? 'boot' : pick < 0.8 ? 'whip' : 'clang';
    stepSide = -stepSide; const pan = stepSide * (0.25 + 0.4 * rc()), nm = { slam: 'door slam', boot: 'boots', clang: 'steel clang', whip: 'whip / swish' }[type];
    cue(f, nm, D, { slam: 'steel door slam on the cut', boot: 'boots hitting concrete in the sprint', clang: 'steel bar / cell door clang', whip: 'air whip on the cut' }[type], { kind: 'hit' });
    if (!go(f, f + 90)) continue;
    if (type === 'slam') put(D, doorSlam(downbeat ? 0.9 : 0.7, `cs${b}${s}`), f, { g: dB(-16.5), pan, send: { block: 0.5, hall: 0.2 } });
    else if (type === 'boot') { put(D, bootStep(0.9, `bt${b}${s}`), f, { g: dB(-13.5), pan, send: { block: 0.35 } }); put(D, bootStep(0.7, `bu${b}${s}`), f + 4.5, { g: dB(-16), pan: -pan, send: { block: 0.35 } }); }
    else if (type === 'clang') put(D, clangHit(240 + 90 * rc(), 0.9, 0.8, `cc${b}${s}`), f, { g: dB(-20), pan, send: { block: 0.5, hall: 0.25 } });
    else put(D, whoosh(0.22, 700, 7000, `wh${b}${s}`), f - 3, { g: dB(-24), pan, send: { block: 0.2 } });
  }
  // ------------------------------------------------------------ A3d  the drop, bar 23 (everything above is cut at the bar line)
  cue(F(23), 'CUT: everything stops', D, 'the end of bar 22: every sound, tail and reverb is cut dead (2 ms fade) at the first frame of bar 23', { kind: 'hit', dur: 0 });
  cue(F(23), 'very low swell', D, 'the only thing in bar 23: a very low D1 swell, breathing in; it continues into the soft hit at bar 24 (no pulse)', { kind: 'layer', dur: 64 });
  if (go(F(23), F(24) + 60)) put(D, subTone(36.71, 4.0, 2.6, 1.2), F(23), { g: dB(-50), post: true, send: { hall: 0.5 } });
  cue(F(23, 3), 'one distant sound', W, 'a single far-off cell-door clang, very quiet, drowned in a dark reverb: the only event in the silence', { kind: 'note' });
  if (go(F(23, 3), F(23, 3) + 160)) { const c = clangHit(118, 2.4, 0.3, 'far23'); bq(c, 'lp', 1800, 0.7); put(W, c, F(23, 3), { g: dB(-48), pan: -0.55, post: true, send: { hall: 1.2 } }); }
  // ------------------------------------------------------------ A4  chapel and the font, bars 24-31
  cue(F(24), 'SOFT HIT bar 24', M, 'the calm: a soft low D (felt piano D2 + D3, a sine bloom), the choir-like pad and the strings breathe in; no punch', { kind: 'hit', dur: 24 });
  if (go(F(24), F(24) + 300)) {
    put(M, pianoNote(73.42, 0.55, 7, { seed: 'pn24a' }), F(24), { g: dB(-9), pan: -0.05, send: { chapel: 1.0, hall: 0.4 } });
    put(M, pianoNote(146.8, 0.45, 6, { seed: 'pn24b' }), F(24) + 0.5, { g: dB(-14), pan: 0.05, send: { chapel: 1.0 } });
    put(M, subTone(36.71, 4.0, 0.03, 3.4), F(24), { g: dB(-27), post: false, send: { hall: 0.6 } });
    put(M, subTone(73.42, 4.0, 0.03, 3.4), F(24), { g: dB(-33), send: { chapel: 0.8 } });
  }
  const A4ch = [
    [24, 26, [50, 57, 64, 65], 'Dm(add9)', 'warm strings in D minor, wide and soft'],
    [26, 28, [43, 50, 57, 59, 62], 'G(add9)', 'the IV chord (G): the sacred lift'],
    [28, 30, [38, 45, 50, 54, 64], 'D major (6/9)', 'D major: the brighter answer, with the F-sharp of the second motif'],
    [30, 31, [43, 50, 59, 66], 'Gmaj7', 'G major 7th: floating'],
    [31, 32, [45, 52, 62, 64, 69], 'Asus4', 'suspended A: leaves the harmony open for the tunnel'],
  ];
  A4ch.forEach(([a, bb, ch, nm, intent], i) => padChord(M, ch, F(a), F(bb), { name: `strings ${nm}`, db: -30.5 + (i === 4 ? 0 : 0), bright: 0.28, vib: 0.55, att: 2.4, rel: 2.4, send: { chapel: 0.8, hall: 0.3 }, sub: 0.18, intent }));
  cue(F(26), 'hushed choir pad', M, 'choir-like pad, "oo" then "ah", sitting on the chord tones', { kind: 'layer', dur: F(32) - F(26) });
  [[26, 28, [59, 62, 67], 'oo'], [28, 30, [69, 74, 78], 'ah'], [30, 32, [74, 71, 69], 'oo']].forEach(([a, bb, ch, v]) => { if (!go(F(a), F(bb) + 200)) return; ch.forEach((m, i) => { const [l, r] = choirNote(mtof(m), (F(bb) - F(a)) / FPS, v, { att: 2.6, rel: 2.6, seed: `chA4${a}${m}` }); putS(M, l, r, F(a), { g: dB(-33), send: { chapel: 1.0, hall: 0.3 } }); }); });
  pianoPhrase([392, 493.9, 587.3], F(26), 24, (i) => 0.5 - i * 0.03, { name: 'piano motif 1 (G B D)', intent: "the game's own motif, first phrase (src/story/cinematics.js makeEnding): G4 B4 D5, over the G chord", db: -12 });
  pianoPhrase([587.3, 740, 880, 659.3], F(28), 24, (i) => 0.48 - i * 0.02, { name: 'piano motif 2 (D F# A E)', intent: "the game's own motif, second phrase: D5 F#5 A5 E5, over the D chord", db: -12 });
  pianoPhrase([196, 246.9, 293.7, 370], F(30), 16, 0.35, { name: 'piano arpeggio G', intent: 'soft Gmaj7 arpeggio, floating', db: -17 });
  pianoPhrase([440, 659.3], F(31), 32, 0.36, { name: 'piano A-E', intent: 'A and E: the open fifth that carries into the tunnel', db: -16 });
  cue(F(24), 'candle crackle', W, 'candles in the chapel: sparse pops and a faint hiss', { kind: 'layer', dur: F(32) - F(24) });
  if (go(F(24), F(32))) { const n = smp(F(32) - F(24)), cl = [0, 1].map((ch) => setRms(candleCrackle(n, 4.5, `candle${ch}`), 0)); bed(W, cl, F(24), [[F(24), -90], [F(24) + 20, -58], [F(32) - 30, -58], [F(32), -90]], { send: { chapel: 0.6 } }); }
  cue(F(24), 'chapel air', W, 'the hush of the nave: a very low-level air', { kind: 'layer', dur: F(32) - F(24) });
  if (go(F(24), F(32))) { const rt = roomTone(smp(F(32) - F(24)), 'room-a4'); rt.forEach((x) => bq(x, 'lp', 600, 0.7)); bed(W, rt, F(24), [[F(24), -90], [F(24) + 30, -58], [F(32) - 20, -58], [F(32), -90]], { send: { chapel: 0.3 } }); }
  cue(F(28, 2), 'stone slide (the font)', W, 'heavy stone grinding as the baptismal font lifts: 6 s; the editor can slide it to the lift, the thud closes it', { kind: 'note', dur: 144 });
  if (go(F(28, 2), F(30, 4))) { const [l, r] = stoneGrind(6, 'font'); putS(W, l, r, F(28, 2), { g: dB(-27), send: { chapel: 0.6, stone: 0.3 } }); }
  cue(F(28, 2) + 144, 'font settles (stone thud)', W, 'the stone settles with a soft low thud', { kind: 'note' });
  if (go(F(28, 2) + 144, F(31))) put(W, stoneThud('thud'), F(28, 2) + 144, { g: dB(-20), send: { chapel: 0.7, hall: 0.3 } });
  // ------------------------------------------------------------ A5a  the tunnel, bars 32-37
  cue(F(32), 'tunnel drone', M, 'low D drone returns: the weight of the earth, steady, warming toward the end', { kind: 'layer', dur: F(38) - F(32) });
  if (go(F(32), F(39))) bed(M, droneBuf(smp(F(39) - F(32)), 36.71, 'drone-a5a'), F(32), [[F(32) - 1, -90], [F(32), -52], [F(34), -46], [F(37), -41], [F(38), -36], [F(38) + 60, -50], [F(39), -90]], { send: { hall: 0.4 } });
  cue(F(32), 'dripping water', W, 'drips in the tunnel, irregular, on the 8-frame grid, with long stone reverb', { kind: 'stream', dur: F(38) - F(32) });
  const rd = RNG('drips'); let df = F(32) + 8;
  while (df < F(38)) { const fr = [1175, 1568, 880, 1319, 1760][Math.floor(rd() * 5)], gain = -34 + rd() * 5; if (go(df, df + 40)) put(W, dripSound(`drip${df}`, fr), df, { g: dB(gain), pan: rd() * 1.6 - 0.8, send: { stone: 1.0, hall: 0.2 } }); df += 8 * (2 + Math.floor(rd() * 7)); }
  cue(F(32), 'echoing footsteps', W, 'slow footsteps down the stone steps, one per beat, long flutter echoes; the last step is at bar 37 beat 3', { kind: 'stream', dur: F(37, 3) - F(32), rate: 'beats' });
  for (let f = F(32) + 8, k = 0; f <= F(37, 3); f += 16, k++) if (go(f, f + 90)) put(W, bootStep(0.55 + 0.1 * Math.sin(k), `step${k}`, true), f, { g: dB(-26 + Math.min(4, k * 0.12)), pan: k % 2 ? 0.2 : -0.2, send: { stone: 1.0, hall: 0.12 } });
  cue(F(32), 'lantern flame', W, 'soft flutter of the lantern flame', { kind: 'layer', dur: F(38) - F(32) });
  if (go(F(32), F(38))) bed(W, flameSound(smp(F(38) - F(32)), 'flame-a5a'), F(32), [[F(32), -90], [F(32) + 24, -53], [F(37), -49], [F(38), -90]], { send: { stone: 0.3 } });
  const A5a = [[32, 34, [38, 45, 50, 53, 57], 'Dm', -29], [34, 35, [46, 53, 58, 62, 65], 'Bb', -29], [35, 36, [41, 48, 57, 60, 65], 'F', -28.5], [36, 37, [43, 50, 58, 62, 67], 'Gm', -28], [37, 38, [45, 52, 57, 61, 64, 69], 'A', -26.5]];
  A5a.forEach(([a, bb, ch, nm, db]) => padChord(M, ch, F(a), F(bb), { name: `warm strings ${nm}`, db, bright: 0.3 + (a - 32) * 0.04, vib: 0.65, att: 1.8, rel: 1.8, send: { hall: 0.6, stone: 0.15 }, sub: 0.15, intent: 'warm rising strings: hope building toward the light' }));
  cue(F(32), 'rising violin line', M, 'a single high string line climbs D4 F4 A4 B-flat4 C-sharp5 D5: the light at the far end', { kind: 'layer', dur: F(38) - F(32) });
  [[34, 62, 35], [35, 65, 36], [36, 69, 37], [37, 73, 38]].forEach(([a, m, bb]) => { if (!go(F(a), F(bb) + 100)) return; const [l, r] = stringsNote(mtof(m), (F(bb) - F(a)) / FPS, { att: 1.0, rel: 1.4, bright: 0.45, vib: 0.9, seed: `vl${a}` }); putS(M, l, r, F(a), { g: dB(-33 + (a - 34) * 1.2), send: { hall: 0.7 } }); });
  for (let b = 32; b <= 37; b++) for (let i = 0; i < (b < 36 ? 2 : 4); i++) {
    const f = F(b) + i * (b < 36 ? 32 : 16) + 20; if (b === 32 && i === 0) cue(f, 'heartbeat (warm)', D, 'a pulse of heartbeat, every two beats; every beat from bar 36', { kind: 'stream', dur: F(38) - F(32) });
    if (go(f, f + 30)) put(D, heartBeat(0.4 + 0.05 * (b - 32), `hb5-${b}${i}`), f, { g: dB(-27 + (b - 32) * 0.5), send: { hall: 0.4, stone: 0.15 } });
  }
  pianoPhrase([293.7, 349.2, 440], F(36), 24, 0.4, { name: 'piano rising D-F-A', intent: 'a hopeful rising figure, D4 F4 A4, just before the light', db: -15 });
  cue(F(37), 'warm swell into bar 38', D, 'soft rising noise bloom and a gliding string pair: opens into the light, no punch', { kind: 'layer', dur: 64 });
  if (go(F(37), F(38))) { const [l, r] = riser(64 / FPS, { f0: 600, f1: 7000, p0: 293.7, p1: 587.3, noise: 0.35, tone: 0.8, seed: 'ris37', curve: 1.6 }); putS(D, l, r, F(37), { g: dB(-31), send: { hall: 0.6 } }); }
  cue(F(37, 3), 'first distant bird', W, 'the first bird, far away: the outside is near', { kind: 'note' });
  if (go(F(37, 3), F(38) + 30)) put(W, birdCall('whistle', 2350, 'bird37'), F(37, 3), { g: dB(-36), pan: 0.5, send: { open: 0.8, stone: 0.3 } });
  // ------------------------------------------------------------ A5b  four hours, bars 38-47
  cue(F(38), 'OPEN SWELL bar 38', M, 'the light: not a punch but a warm open swell. Full D major strings bloom in 0.35 s, choir, a soft sub bloom, a rising air of shimmer; birds and wind arrive with it', { kind: 'hit', dur: 48 });
  if (go(F(38), F(38) + 320)) {
    put(M, subTone(36.71, 4.5, 0.05, 3.0), F(38), { g: dB(-25), send: { hall: 0.6 } });
    put(M, subTone(73.42, 4.5, 0.06, 3.0), F(38), { g: dB(-27), send: { hall: 0.6 } });
    const [cl, cr] = crashSound(3.4, 'shimmer38'); for (const x of [cl, cr]) { bq(x, 'lp', 6500, 0.7); bq(x, 'hp', 1800, 0.7); } mul(cl, swellEnv(cl.length, 0.6, 2.4)); mul(cr, swellEnv(cr.length, 0.6, 2.4)); putS(D, cl, cr, F(38), { g: dB(-33), send: { hall: 0.7 } });
    [62, 69, 74, 78].forEach((m, i) => { const [l, r] = choirNote(mtof(m), 4.5, 'ah', { att: 0.8, rel: 2.4, seed: `ch38${m}` }); putS(M, l, r, F(38), { g: dB(-32), send: { chapel: 0.9, hall: 0.4 } }); });
    pianoPhrase([293.7, 440, 587.3], F(38), 20, 0.5, { name: 'piano D-A-D (open)', intent: 'D major open fifths, welcoming the light', db: -13 });
  }
  const A5b = [
    [38, 39, [38, 50, 57, 66, 69], 'D', -26, 0.5], [39, 40, [37, 52, 57, 64, 69], 'A/C#', -26, 0.5], [40, 41, [35, 47, 54, 59, 62, 66], 'Bm', -25.5, 0.55], [41, 42, [43, 50, 59, 62, 67], 'G', -25, 0.55],
    [42, 43, [42, 50, 57, 62, 66], 'D/F#', -24, 0.6], [43, 44, [45, 52, 57, 61, 64, 69], 'A', -22.5, 0.65], [44, 45, [38, 45, 50, 57, 62, 66, 69, 74], 'D (peak)', -19.5, 0.8],
    [45, 46, [43, 50, 59, 62, 67], 'G', -25, 0.55], [46, 47, [42, 50, 57, 62, 66], 'D/F#', -28, 0.45], [47, 48, [38, 45, 50, 57, 64, 66, 69], 'D(add9)', -31, 0.4],
  ];
  A5b.forEach(([a, bb, ch, nm, db, br]) => padChord(M, ch, F(a), F(bb), { name: `strings ${nm}`, db, bright: br, vib: 0.7, att: a === 38 ? 0.35 : 0.9, rel: a === 47 ? 3.0 : 1.4, send: { hall: 0.5, chapel: 0.4 }, sub: 0.2, intent: a === 44 ? 'the emotional peak: full strings in octaves' : 'strings carry the harmony of the theme' }));
  cue(F(38), 'cello line', M, 'low cello-like line: root notes on the downbeats under the strings', { kind: 'layer', dur: F(48) - F(38) });
  [[38, 50, 4], [40, 47, 4], [42, 54, 4], [44, 50, 4], [45, 43, 3], [47, 50, 3]].forEach(([a, m, d]) => { const f = F(a); if (!go(f, f + 300)) return; const [l, r] = stringsNote(mtof(m - 12), d * 64 / FPS, { att: 0.5, rel: 1.4, bright: 0.2, vib: 0.5, seed: `cello${a}` }); putS(M, l, r, f, { g: dB(-27 + (a === 44 ? 3 : 0)), send: { hall: 0.4 } }); });
  [38, 39, 40].forEach((b) => [0, 16, 32, 48].forEach((o, i) => { const f = F(b) + o + 8, notes = b === 38 ? [293.7, 369.99, 440, 369.99] : b === 39 ? [277.2, 329.6, 440, 329.6] : [246.9, 293.7, 369.99, 293.7]; cue(f, 'piano arpeggio', M, 'light arpeggio under the opening', { kind: 'note' }); if (go(f, f + 120)) put(M, pianoNote(notes[i], 0.34, 4, { seed: `arp${b}${i}` }), f, { g: dB(-17), pan: 0.15 - i * 0.1, send: { chapel: 0.8, hall: 0.2 } }); }));
  pianoPhrase([392, 493.9, 587.3], F(41), 24, (i) => 0.52 + i * 0.02, { name: 'piano motif 1 (G B D)', intent: "the game's motif, phrase 1, over the G chord: stated gently", db: -12 });
  pianoPhrase([587.3, 740, 880, 659.3], F(42), 20, (i) => 0.55 + i * 0.03, { name: 'piano motif 2 (D F# A E)', intent: "the game's motif, phrase 2, rising and open over D/F#", db: -11.5 });
  pianoPhrase([440, 554.4, 659.3, 880, 740], F(43), 12, (i) => 0.6 + i * 0.04, { name: 'piano motif 3 (A C# E A F#)', intent: "the game's motif, third phrase (A C# E A F#), a quick climb to the peak", db: -11 });
  cue(F(44), 'THEME at the peak', M, 'the full emotional peak: strings, piano and choir carry the theme D5 F#5 A5 D6, sustained, then step down through C#6 and A5 to F#5 and D5', { kind: 'hit', dur: 192 });
  const THEME = [[44, 0, 587.3, 16], [44, 16, 740, 16], [44, 32, 880, 16], [44, 48, 1174.7, 56], [45, 40, 1108.7, 24], [46, 0, 880, 40], [46, 40, 740, 24], [47, 0, 587.3, 120]];
  THEME.forEach(([b, o, fr, dur], i) => {
    const f = F(b) + o; if (!go(f, f + dur + 120)) return;
    const [l, r] = stringsNote(fr, dur / FPS + 0.25, { att: 0.14, rel: 1.3, bright: 0.55, vib: 0.95, seed: `th${i}` }); putS(M, l, r, f, { g: dB(-24 + (b === 44 ? 2 : b === 47 ? -3 : 0)), send: { hall: 0.6, chapel: 0.4 } });
    put(M, pianoNote(fr, 0.62, 6, { seed: `thp${i}` }), f, { g: dB(-14), pan: 0.1, send: { chapel: 0.9, hall: 0.3 } });
    put(M, pianoNote(fr / 2, 0.5, 6, { seed: `thq${i}` }), f + 0.2, { g: dB(-20), pan: -0.1, send: { chapel: 0.9 } });
    cue(f, `theme note ${Math.round(fr)} Hz`, M, 'theme (strings + piano)', { kind: 'note', hz: fr });
  });
  [[44, [62, 69, 74, 78]], [45, [59, 67, 71]], [47, [62, 69, 73]]].forEach(([b, ch]) => { if (!go(F(b), F(b) + 300)) return; ch.forEach((m, i) => { const [l, r] = choirNote(mtof(m), b === 47 ? 2.5 : 2.6, b === 44 ? 'ah' : 'oh', { att: 0.5, rel: 2.2, seed: `chp${b}${m}` }); putS(M, l, r, F(b), { g: dB(b === 44 ? -30 : -34), send: { chapel: 1.0, hall: 0.5 } }); }); });
  cue(F(43, 3), 'timpani roll into the peak', M, 'a soft timpani roll (16ths, crescendo) from bar 43 beat 3 to the peak', { kind: 'stream', dur: 32 });
  for (let k = 0; k < 8; k++) { const f = F(43, 3) + k * 4; if (go(f, f + 30)) put(M, taiko(73.4 * (k > 5 ? 1.335 : 1), 0.18 + k * 0.07, `tr${k}`), f, { g: dB(-18), pan: (k % 2) * 0.4 - 0.2, send: { hall: 0.7 } }); }
  cue(F(43, 3), 'reverse shimmer into the peak', D, 'reversed cymbal-like shimmer rising into bar 44', { kind: 'layer', dur: 32 });
  if (go(F(43, 3), F(44))) { const [cl, cr] = crashSound(1.4, 'rev44'); const a = reversed(cl), b = reversed(cr); for (const x of [a, b]) bq(x, 'lp', 7000, 0.7); putS(D, a, b, F(44) - 1.4 * FPS, { g: dB(-29), send: { hall: 0.5 } }); }
  cue(F(44), 'peak downbeat boom', D, 'soft low boom (felt taiko + sub) and a warm cymbal bloom under the peak, the warmest and widest moment', { kind: 'hit', dur: 32 });
  if (go(F(44), F(44) + 250)) { put(D, taiko(55, 0.9, 'boom44'), F(44), { g: dB(-14), send: { hall: 0.9 } }); put(D, subTone(36.71, 3.5, 0.03, 2.5), F(44), { g: dB(-25), send: { hall: 0.5 } }); const [cl, cr] = crashSound(3.2, 'cym44'); for (const x of [cl, cr]) bq(x, 'lp', 8000, 0.7); putS(D, cl, cr, F(44), { g: dB(-31), send: { hall: 0.7 } }); }
  cue(F(38), 'birdsong', W, 'forest birds: tweets, trills and whistles in D major, dense at the start and thinning toward the end', { kind: 'stream', dur: F(48) - F(38) });
  { const rb = RNG('birds'); const kinds = ['tweet', 'whistle', 'trill', 'chirp', 'tweet']; let bf = F(38) + 10; let k = 0;
    while (bf < F(47, 3)) { const prog = (bf - F(38)) / (F(48) - F(38)), kind = kinds[Math.floor(rb() * kinds.length)], fr = 2100 + rb() * 1900, gain = -34 - prog * 5 - (bf > F(43) && bf < F(45, 2) ? 3 : 0); cue(bf, `bird ${kind}`, W, 'bird', { kind: 'note' }); if (go(bf, bf + 60)) put(W, birdCall(kind, fr, `bird${k}`), bf, { g: dB(gain), pan: rb() * 1.8 - 0.9, send: { open: 0.8, hall: 0.1 } }); k++; bf += 8 * (2 + Math.floor(rb() * (4 + prog * 12))); } }
  cue(F(37, 3), 'wind in the leaves', W, 'wind moving through leaves, gusting; rises with the light at 38 and is gone by the title', { kind: 'layer', dur: F(48) - F(37, 3) });
  if (go(F(37, 3), F(48))) bed(W, windLeaves(smp(F(48) - F(37, 3)), 'wind-a5b'), F(37, 3), [[F(37, 3), -90], [F(38), -47], [F(40), -45], [F(44), -50], [F(47), -54], [F(48) - 2, -90]], { send: { open: 0.4 } });
  cue(F(46, 2), 'distant car passes', W, "a distant car goes by from left to right, closest at bar 46 beat 2 (the game's own car cue, here synthesised); 7 s", { kind: 'note', dur: 168 });
  if (go(F(45) + 4, F(47) + 50)) { const [l, r] = carPass(7, 'car46'); putS(W, l, r, F(46, 2) - 84, { g: dB(-33), send: { open: 0.5 } }); }
  // ------------------------------------------------------------ AT  title, bars 48-50, and the end card
  DIPS.push([F(48) - 4, 4]);
  cue(F(48), 'HIT bar 48: the title', D, 'one deep final hit: sub impact, the longest tail of the trailer, a low taiko and a gong', { kind: 'hit', dur: 40 });
  if (go(F(48), F(48) + 400)) {
    bigHit(F(48), { size: 1.7, dur: 6.5, pitch: 31, clang: 0.45, clangF: 128, clangDecay: 4.2, tail: 0.9, seed: 'hit48' }, -9, -6.5, 1.3);
    put(M, taiko(55, 1, 'tk48'), F(48), { g: dB(-9), send: { hall: 1.0 } });
    put(M, taiko(36.7, 1, 'tk48b'), F(48), { g: dB(-12), send: { hall: 1.0 } });
  }
  padChord(M, [38, 45, 50, 57, 64, 66, 69], F(48), F(50, 3) + 0, { name: 'title chord D(add9)', db: -23, bright: 0.45, vib: 0.5, att: 0.12, rel: 2.0, send: { hall: 1.0, chapel: 0.5 }, sub: 0.25, intent: 'sustained open D major chord, long reverb; fades out by the end of bar 50', gains: [0, 0, 0, 0, -2, -1, -2] });
  [[62, 69, 74, 78]].forEach(([a, b, c, d]) => { if (!go(F(48), F(51))) return; [a, b, c, d].forEach((m, i) => { const [l, r] = choirNote(mtof(m), 4.4, 'ah', { att: 0.4, rel: 2.4, seed: `cht${m}` }); putS(M, l, r, F(48), { g: dB(-33), send: { chapel: 1.0, hall: 0.8 } }); }); });
  pianoPhrase([293.7, 440, 587.3], F(48, 3), 16, 0.38, { name: 'piano D-A-D (title)', intent: 'three soft piano notes in the title chord, fading', db: -17, send: { chapel: 1.0, hall: 0.6 } });
  cue(F(50, 3), 'fade to black', M, 'all music, design and ambience fade out together to silence by the last frame of bar 50', { kind: 'gap', dur: 32 });
  cue(F(51), 'END CARD sub tone', D, 'one last quiet sub tone (D1), swelling and fading; then bar 52 is silence', { kind: 'note', dur: 100 });
  if (go(F(51), F(52))) put(D, subTone(36.71, 3.8, 1.3, 2.0), F(51), { g: dB(-27), post: true });
  cue(F(51, 3) + 8, 'silence', D, 'real silence to the end of the file', { kind: 'gap', dur: F(53) - F(51, 3) - 8 });
}

// ============================================================ 4. mix, master, WAV writer, cue sheet, CLI
const STEMS = ['music', 'design', 'dia'];
/** Per-bar level ride in dB, applied to all three stems (smooth between bar centres, a step at the hit bars): the final balance between the acts. */
const RIDE = [
  5.03, 10.05, 7.75, 10.13, -2.72, -7.24, 4.76, 2.48,
  3.41, 3.67, 6.89, 6.19, 3.74, 7.84, 4.08, 7.81,
  3.23, 7.74, 5.27, 8, 7.14, 4.66, 0, -8.68,
  -0.76, -2.64, -1.52, -1.61, -2.88, -0.34, -0.07, -4.24,
  -0.42, -0.85, 0.94, -3.23, 0.7, -1.45, 0.51, 0.87,
  0.6, 0.52, -3.82, -0.76, -0.34, -0.26, -2.04, -5.79,
  -6.97, -8.25, 0.09, 0,
];   // fitted by measuring the per-bar loudness of the master against the intended loudness profile (A0 -37..-32 LUFS, A1 -12/-18/-20, A2 -15..-13, A3 -10, drop -45, A4 -20, A5a -25..-19, A5b -14..-11, AT -11/-14/-20)
const HIT_BARS = new Set([5, 11, 17, 23, 24, 38, 48, 51]);
const ALL_RANGES = [...RANGES.map((r) => ({ id: r.id, start: r.start, frames: r.frames })), { id: 'END', start: END_CARD.start, frames: END_CARD.frames }];

function collapse(bus) {                                          // convolve every send, add the wet signal to the stem's L / R
  for (const [key, buf] of bus.sends) {
    const [name, part] = key.split('|'), [wl, wr] = convolveStereo(buf, ...getIR(name));
    if (part === '0') { for (let i = CUT; i < NS; i++) { wl[i] = 0; wr[i] = 0; } for (let k = 0; k < 96; k++) { const g = k / 96; wl[CUT - 1 - k] *= g; wr[CUT - 1 - k] *= g; } }
    const L = bus.L, R = bus.R; for (let i = 0; i < NS; i++) { L[i] += wl[i]; R[i] += wr[i]; }
    bus.sends.delete(key);
  }
}
function gainEnv(keys) { return envKeys(keys, 0, NS); }
function applyMix(ride, L, R) {                                   // level ride, air gaps and the fade at the end of bar 50, on the main stems only
  const keys = [[0, ride[0]]];
  for (let b = 1; b <= 52; b++) { const st = (b - 1) * BAR, v = ride[b - 1]; if (HIT_BARS.has(b)) keys.push([st - 3, ride[b - 2] ?? v], [st, v]); keys.push([st + 32, v]); }
  keys.push([TOTAL_FRAMES, ride[51]]);
  const e = gainEnv(keys);
  const fadeA = F(50, 3), fadeB = F(51) - 0.5;
  for (let i = smp(fadeA); i < NS; i++) { const f = i / SPF, u = clamp((f - fadeA) / (fadeB - fadeA), 0, 1); e[i] *= i >= smp(F(51)) ? 0 : Math.pow(10, -75 * u * u / 20) * (1 - u); }
  for (const [f, n] of DIPS) { const a = smp(f), b = smp(f + n); for (let i = Math.max(0, a - 24); i < a; i++) e[i] *= 1 - (i - a + 24) / 24 * 0.97; for (let i = a; i < b && i < NS; i++) e[i] *= 0.03; for (let i = b; i < Math.min(NS, b + 12); i++) e[i] *= 0.03 + 0.97 * (i - b) / 12; }
  for (let i = 0; i < NS; i++) { L[i] *= e[i]; R[i] *= e[i]; }
}

function writeWav(file, L, R, gain, bits = 24) {                  // gain: Float32Array curve or number, applied while writing
  const n = L.length, bps = bits / 8, dataBytes = n * 2 * bps, fd = fs.openSync(file, 'w'), head = Buffer.alloc(44);
  head.write('RIFF', 0); head.writeUInt32LE(36 + dataBytes, 4); head.write('WAVEfmt ', 8); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(2, 22); head.writeUInt32LE(SR, 24); head.writeUInt32LE(SR * 2 * bps, 28); head.writeUInt16LE(2 * bps, 32); head.writeUInt16LE(bits, 34); head.write('data', 36); head.writeUInt32LE(dataBytes, 40);
  fs.writeSync(fd, head);
  const CH = 1 << 16, buf = Buffer.alloc(CH * 2 * bps), mx = bits === 24 ? 8388607 : 32767;
  for (let s = 0; s < n; s += CH) {
    const m = Math.min(CH, n - s);
    for (let i = 0; i < m; i++) {
      const g = typeof gain === 'number' ? gain : gain[s + i];
      for (let c = 0; c < 2; c++) {
        const v = Math.max(-1, Math.min(1, (c ? R : L)[s + i] * g)), q = Math.round(v * mx), o = (i * 2 + c) * bps;
        if (bits === 24) { buf[o] = q & 255; buf[o + 1] = (q >> 8) & 255; buf[o + 2] = (q >> 16) & 255; } else buf.writeInt16LE(q, o);
      }
    }
    fs.writeSync(fd, buf, 0, m * 2 * bps);
  }
  fs.closeSync(fd);
}
const f32 = (file) => { const b = fs.readFileSync(file); return new Float32Array(b.buffer, b.byteOffset, b.length / 4).slice(); };
const saveF32 = (file, a) => fs.writeFileSync(file, Buffer.from(a.buffer, a.byteOffset, a.byteLength));

/** Spectral centroid (Hz) of a mono signal region: mean over 4096-sample Hann frames, magnitude-weighted. */
function centroidOf(x, a, b) {
  const N = 4096, w = new Float64Array(N); for (let i = 0; i < N; i++) w[i] = 0.5 - 0.5 * Math.cos(TAU * i / N);
  let num = 0, den = 0, cnt = 0;
  for (let s = a; s + N <= b; s += 8192) {
    const re = new Float64Array(N), im = new Float64Array(N); let e = 0; for (let i = 0; i < N; i++) { re[i] = x[s + i] * w[i]; e += re[i] * re[i]; } if (e < 1e-9) continue;
    fft(re, im); let sn = 0, sd = 0; for (let k = 1; k < N / 2; k++) { const m = Math.hypot(re[k], im[k]); sn += m * k * SR / N; sd += m; }
    num += sn / sd * Math.sqrt(e); den += Math.sqrt(e); cnt++;
  }
  return den ? num / den : 0;
}
function measure(L, R) {
  const out = { ranges: {}, notes: [] }, lm = loudness(L, R), mono = Buf(NS); for (let i = 0; i < NS; i++) mono[i] = 0.5 * (L[i] + R[i]);
  const lmono = loudness(mono, mono);
  out.integratedLUFS = +lm.integrated.toFixed(2); out.monoIntegratedLUFS = +lmono.integrated.toFixed(2);
  let pk = 0, tp = 0, over = 0, sLL = 0, sRR = 0, sLR = 0, sMM = 0, sSS = 0;
  for (let i = 0; i < NS; i++) { const a = Math.max(Math.abs(L[i]), Math.abs(R[i])); if (a > pk) pk = a; if (a >= 0.9999) over++; sLL += L[i] * L[i]; sRR += R[i] * R[i]; sLR += L[i] * R[i]; const m = 0.5 * (L[i] + R[i]), s = 0.5 * (L[i] - R[i]); sMM += m * m; sSS += s * s; if (a > 0.7) tp = Math.max(tp, truePeakAt(L, i), truePeakAt(R, i)); }
  out.samplePeakDBFS = +(20 * Math.log10(pk + 1e-12)).toFixed(2); out.truePeakDBTP = +(20 * Math.log10(tp + 1e-12)).toFixed(2); out.clippedSamples = over;
  out.correlation = +(sLR / Math.sqrt(sLL * sRR + 1e-20)).toFixed(3); out.sideToMidDB = +(10 * Math.log10((sSS + 1e-20) / (sMM + 1e-20))).toFixed(1);
  let stMax = -Infinity, stMaxAt = 0; for (let h = 29; h < lm.nh; h++) { const v = lm.shortTerm(h); if (v > stMax) { stMax = v; stMaxAt = h; } } out.maxShortTermLUFS = +stMax.toFixed(2); out.maxShortTermAtSec = +(stMaxAt / 10).toFixed(1);
  for (const r of ALL_RANGES) {
    const a = smp(r.start), b = smp(r.start + r.frames), rl = loudness(L, R, a, b), h0 = Math.round(r.start / FPS * 10), h1 = Math.round((r.start + r.frames) / FPS * 10);
    let mom = -Infinity, st = -Infinity; for (let h = h0 + 3; h < Math.min(lm.nh, h1); h++) mom = Math.max(mom, lm.momentary(h)); for (let h = h0; h < Math.min(lm.nh, h1); h++) st = Math.max(st, lm.shortTerm(h));
    let rmsDb = -Infinity; { let s = 0; for (let i = a; i < b; i++) s += 0.5 * (L[i] * L[i] + R[i] * R[i]); rmsDb = 10 * Math.log10(s / (b - a) + 1e-20); }
    out.ranges[r.id] = { integratedLUFS: +rl.integrated.toFixed(1), maxMomentaryLUFS: +mom.toFixed(1), maxShortTermLUFS: +st.toFixed(1), rmsDBFS: +rmsDb.toFixed(1), centroidHz: Math.round(centroidOf(mono, a, b)) };
  }
  return out;
}

async function main() {
  const args = process.argv.slice(2), opt = (k) => { const i = args.indexOf(k); return i < 0 ? null : args[i + 1] ?? true; };
  const outDir = opt('--out'), stems = args.includes('--stems'), excerpts = args.includes('--excerpts'), cuesFile = opt('--cues'), win = opt('--window'), report = args.includes('--report'), saveRaw = opt('--save-raw'), loadRaw = opt('--load-raw'), rideArg = opt('--ride'), noMaster = args.includes('--no-master');
  if (!outDir && !cuesFile) { console.error('usage: node tools/cine/score.mjs --out DIR [--stems] [--excerpts] [--report] [--cues FILE] [--window F0:F1] [--save-raw DIR | --load-raw DIR] [--ride FILE]'); process.exit(2); }
  if (win) { const [a, b] = win.split(':').map(Number); WIN = [a, b]; }
  const ride = rideArg ? JSON.parse(fs.readFileSync(rideArg, 'utf8')) : RIDE;
  const t0 = Date.now(), lap = (m) => console.error(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`);
  if (loadRaw) WIN = [Infinity, Infinity];
  newBuses(); arrange(); lap(`arranged: ${cues.length} cue entries`);
  if (cuesFile) writeCues(cuesFile);
  if (!outDir) return;
  fs.mkdirSync(outDir, { recursive: true });
  writeCues(path.join(outDir, 'cues.json'));
  const fin = {};
  for (const [si, st] of STEMS.entries()) {
    if (loadRaw) continue;
    collapse(BUS[st]); collapse(BUS.post[st]); lap(`reverb done: ${st}`);
    const m = BUS[st], p = BUS.post[st], L = m.L, R = m.R;
    for (const [nm, a] of [['main', [L, R]], ['post', [p.L, p.R]]]) for (const x of a) bq(x, 'hp', 24, 0.7);
    if (saveRaw) { fs.mkdirSync(saveRaw, { recursive: true }); saveF32(path.join(saveRaw, `${st}-main-L.f32`), L); saveF32(path.join(saveRaw, `${st}-main-R.f32`), R); saveF32(path.join(saveRaw, `${st}-post-L.f32`), p.L); saveF32(path.join(saveRaw, `${st}-post-R.f32`), p.R); }
    fin[st] = [L, R, p.L, p.R];
  }
  if (loadRaw) { for (const st of STEMS) { const L = f32(path.join(loadRaw, `${st}-main-L.f32`)), R = f32(path.join(loadRaw, `${st}-main-R.f32`)); fin[st] = [L, R, f32(path.join(loadRaw, `${st}-post-L.f32`)), f32(path.join(loadRaw, `${st}-post-R.f32`))]; } }
  const S = {};
  for (const [si, st] of STEMS.entries()) { const [L, R, pL, pR] = fin[st]; applyMix(ride, L, R); for (let i = 0; i < NS; i++) { L[i] += pL[i]; R[i] += pR[i]; } S[st] = [L, R]; }
  lap('mixed');
  const sumL = Buf(NS), sumR = Buf(NS); for (const st of STEMS) for (let i = 0; i < NS; i++) { sumL[i] += S[st][0][i]; sumR[i] += S[st][1][i]; }
  // master: gentle glue compressor, gain to -14 LUFS integrated, true-peak limiter at -1.6 dBFS
  const TARGET = -14, CEIL = dB(-1.6), CP = { thresh: -16, ratio: 1.8, atk: 0.04, rel: 0.4, knee: 8 };
  let g = dB(TARGET - loudness(sumL, sumR).integrated), curve = null;
  for (let it = 0; it < 8; it++) {
    const cl = Buf(NS), cr = Buf(NS); for (let i = 0; i < NS; i++) { cl[i] = sumL[i] * g; cr[i] = sumR[i] * g; }
    const cg = compressorGain(cl, cr, CP); for (let i = 0; i < NS; i++) { cl[i] *= cg[i]; cr[i] *= cg[i]; }
    const lg = limiterGain(cl, cr, CEIL); curve = new Float32Array(NS); for (let i = 0; i < NS; i++) { curve[i] = g * cg[i] * lg[i]; cl[i] *= lg[i]; cr[i] *= lg[i]; }
    const I = loudness(cl, cr).integrated, err = TARGET - I; lap(`master pass ${it}: integrated ${I.toFixed(2)} LUFS, gain ${(20 * Math.log10(g)).toFixed(2)} dB`);
    if (Math.abs(err) < 0.05) break; g *= dB(err);
  }
  const mL = Buf(NS), mR = Buf(NS); for (let i = 0; i < NS; i++) { mL[i] = sumL[i] * curve[i]; mR[i] = sumR[i] * curve[i]; }
  if (!noMaster) { writeWav(path.join(outDir, 'trailer-score.wav'), mL, mR, 1); lap('wrote trailer-score.wav'); }
  if (stems) for (const st of STEMS) { writeWav(path.join(outDir, `stem-${st === 'dia' ? 'diegetic' : st}.wav`), S[st][0], S[st][1], curve); lap(`wrote stem ${st}`); }
  if (excerpts) {
    const ex = (name, f0) => { const a = smp(f0), b = a + SR * 20; writeWav(path.join(outDir, `excerpt-${name}.wav`), mL.subarray(a, b), mR.subarray(a, b), 1); };
    ex('A3', F(17) - 48); ex('A4', F(24));
  }
  if (report) { const m = measure(mL, mR); m.gainDB = +(20 * Math.log10(g)).toFixed(2); fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(m, null, 1)); console.log(JSON.stringify(m, null, 1)); }
}
function writeCues(file) {
  const sorted = cues.map((c, i) => ({ ...c, _i: i })).sort((a, b) => a.frame - b.frame || a._i - b._i).map(({ _i, ...c }) => ({ frame: c.frame, bar: Math.floor(c.frame / BAR) + 1, beat: +(((c.frame % BAR) / BEAT) + 1).toFixed(3), time: +(c.frame / FPS).toFixed(3), ...c }));
  const sheet = {
    title: 'NYGHTSHADE HOLLOW trailer: score and sound design cue sheet',
    generatedBy: 'node tools/cine/score.mjs (synthesised from nothing, seeded PRNG, deterministic)',
    timebase: { fps: FPS, bpm: BPM, beatFrames: BEAT, barFrames: BAR, sampleRate: SR, samplesPerFrame: SPF, totalFrames: TOTAL_FRAMES, seconds: +(TOTAL_FRAMES / FPS).toFixed(3) },
    hits: { 5: 'sub impact + cell-door clang', 11: 'impact + braam', 17: 'the alarm: the biggest hit', 23: 'the cut: everything stops at the first frame of bar 23', 24: 'soft hit (calm)', 38: 'warm open swell (not a punch)', 48: 'title: final deep hit', 51: 'end-card sub tone' },
    stems: { music: 'pads, strings, piano, choir, pulse, percussion, braams', design: 'impacts, risers, hits on the cuts, heartbeat, klaxon, drop', diegetic: 'the world: room tone, PA, doors, drips, steps, candles, flame, birds, wind, car' },
    legend: 'kind: hit = a marked moment; note = a single sound; layer = a sustained bed; stream = a repeating pattern (one entry for the pattern, individual entries for the hits where the editor needs them); gap = silence. dur is in frames.',
    ranges: ALL_RANGES.map((r) => { const rg = RANGES.find((x) => x.id === r.id); return { id: r.id, bars: rg ? rg.bars : [51, 52], startFrame: r.start, frames: r.frames, mood: rg ? rg.mood : 'end card: black, titles only' }; }),
    cues: sorted.map((c) => { const o = { ...c }; return o; }),
  };
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(sheet, null, 1));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
