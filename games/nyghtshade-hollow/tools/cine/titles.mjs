#!/usr/bin/env node
// Typography of the trailer: renders the cue sheet tools/cine/trailer/text.json to transparent 1920x1080 PNGs with a headless Chromium page (no game needed).
//
//   node tools/cine/titles.mjs --check                          validate the cue sheet (timing rules, reading speed, every line against the game's source files); no browser
//   node tools/cine/titles.mjs --out DIR [--only id,id] [--force]   render every visible frame of every cue (identical frames are written once) + DIR/titles.manifest.json
//   node tools/cine/titles.mjs --still ID[@FRAME] --out FILE.png [--bg PICTURE]   one frame of one cue, over a picture if given (legibility proofs)
//   node tools/cine/titles.mjs --sheet --out FILE.jpg [--bg PICTURE]               proof sheet: the hold frame of every cue
//   node tools/cine/titles.mjs --list                           the cues with bar.beat positions
// Options: --text FILE (default tools/cine/trailer/text.json), --fonts DIR (a folder that holds node_modules/@fontsource, or set NH_FONTS; if absent the four packages are
// installed with npm into a temp folder; if that fails the installed Inter / Liberation Serif / Caladea are used and a warning is printed).
// The assembler imports ensureTitles(): it renders (or re-uses, when text.json and this file are unchanged) the PNG runs and returns the manifest.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import cp from 'node:child_process';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, '..', '..');
export const TEXT_JSON = path.join(HERE, 'trailer', 'text.json');
export const FPS = 24, BEAT = 16, BAR = 64, TOTAL = 3328, W = 1920, H = 1080, PIC_Y = 138, PIC_H = 804;
export const HIT_TITLE = 3008, DROP = [1408, 1472], END_CARD = [3200, 3328], FIRST_TEXT = 48;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const sstep = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const eout = (x) => 1 - Math.pow(1 - clamp01(x), 3);
export const barBeat = (f) => `${Math.floor(f / BAR) + 1}.${Math.floor((f % BAR) / BEAT) + 1}`;

// ------------------------------------------------------------------------------------------------------------------------------ cue sheet
export function loadText(file = TEXT_JSON) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const cues = (raw.cues || []).map((c) => ({ fadeIn: 12, fadeOut: 12, ...c }));
  return { ...raw, cues, contact: String(raw.contact || '').trim(), file };
}

const norm = (s) => String(s).toLowerCase().replace(/\\'/g, "'").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/\s+/g, ' ');
const readSrc = (rel) => { const p = path.resolve(REPO, rel); return fs.existsSync(p) ? norm(fs.readFileSync(p, 'utf8')) : null; };
const speed = (c) => { const chars = (c.text || '').length, secs = (c.to - c.from - (c.fadeIn + c.fadeOut) / 2) / FPS; return chars / Math.max(0.1, secs); };

/** Checks the cue sheet against the rules of the brief. Returns { errors, warnings, info }. */
export function validate(T) {
  const errors = [], warnings = [], info = [], cues = T.cues, E = (m) => errors.push(m), Wn = (m) => warnings.push(m);
  const ids = new Set();
  for (const c of cues) {
    const at = `${c.id} (${c.kind}, ${c.from}-${c.to})`;
    if (!c.id || ids.has(c.id)) E(`duplicate or missing id: ${c.id}`); ids.add(c.id);
    if (!['mono', 'dialogue', 'pa', 'card', 'caught', 'lockup', 'end'].includes(c.kind)) E(`${at}: unknown kind`);
    if (!Number.isInteger(c.from) || !Number.isInteger(c.to) || c.to <= c.from) { E(`${at}: from / to must be integers with to > from`); continue; }
    if (c.from < FIRST_TEXT) E(`${at}: text before frame ${FIRST_TEXT}`);
    if (c.to > TOTAL) E(`${at}: ends after the last frame ${TOTAL}`);
    if (c.fadeIn < 8 || c.fadeOut < 8) E(`${at}: fades must be at least 8 frames (in ${c.fadeIn}, out ${c.fadeOut})`);
    for (const k of ['subDelay', 'taglineDelay', 'statusDelay', 'contactDelay']) if (c[k] !== undefined && (c[k] < 0 || c[k] + 8 > c.to - c.from)) E(`${at}: ${k} out of range`);
    if (c.fadeIn + c.fadeOut + 12 > c.to - c.from) Wn(`${at}: hold shorter than 12 frames`);
    const overlapsDrop = c.from < DROP[1] && c.to > DROP[0];
    if (c.kind === 'caught') { if (c.from < DROP[0] || c.to > DROP[1] - 1) E(`${at}: the CAUGHT card must lie inside bar 23 (frames ${DROP[0]}-${DROP[1] - 1}) and end before the hit of bar 24`); }
    else if (overlapsDrop) E(`${at}: text during the drop (bar 23, frames ${DROP[0]}-${DROP[1] - 1})`);
    if (c.kind === 'lockup' && c.from !== HIT_TITLE) E(`${at}: the title lockup must start on the hit of bar 48 (frame ${HIT_TITLE})`);
    if (c.kind === 'end' && (c.from < END_CARD[0] || c.to > END_CARD[1])) E(`${at}: the end card must lie in bars 51-52 (frames ${END_CARD[0]}-${END_CARD[1] - 1})`);
    if (c.kind === 'dialogue' && !c.speaker) Wn(`${at}: dialogue without a speaker label`);
    if (['mono', 'dialogue', 'pa'].includes(c.kind)) {
      const s = speed(c); if (s > 22) E(`${at}: ${s.toFixed(1)} characters per second is unreadable`); else if (s > 17) Wn(`${at}: ${s.toFixed(1)} characters per second is fast`);
      if (!c.text) E(`${at}: no text`);
    }
    if (c.kind === 'caught' && (!c.text || !c.sub)) E(`${at}: needs text and sub`);
    if (['card'].includes(c.kind) && !c.text) E(`${at}: no text`);
    // source check: the wording must exist in the file named in src
    const s = c.src;
    if (!s || !s.file) { E(`${at}: no src`); continue; }
    const body = readSrc(s.file);
    if (body === null) { E(`${at}: src file ${s.file} not found`); continue; }
    if (['mono', 'dialogue', 'pa', 'caught'].includes(c.kind)) {
      for (const t of [c.text, c.kind === 'caught' ? c.sub : null].filter(Boolean)) if (!body.includes(norm(t))) E(`${at}: "${t}" is not in ${s.file}`);
    } else if (s.facts) {
      for (const f of s.facts) if (!body.includes(norm(f))) E(`${at}: fact "${f}" is not in ${s.file}`);
    } else E(`${at}: src.facts missing`);
    if (c.kind === 'lockup' && s.taglineFile) { const b2 = readSrc(s.taglineFile); for (const f of s.taglineFacts || []) if (b2 === null || !b2.includes(norm(f))) E(`${at}: tagline fact "${f}" is not in ${s.taglineFile}`); }
    if (s.copy) info.push(`${c.id}: trailer copy, not a game line (${s.copy})`);
    if (c.kind === 'card' || c.kind === 'lockup') info.push(`${c.id}: "${c.text || c.title}"${c.tagline ? ' + "' + c.tagline + '"' : ''} restates README facts only (${(s.facts || []).join(', ')}${s.taglineFacts ? ', ' + s.taglineFacts.join(', ') : ''})`);
  }
  // one element at a time
  const sorted = [...cues].sort((a, b) => a.from - b.from);
  for (let i = 1; i < sorted.length; i++) if (sorted[i].from < sorted[i - 1].to) E(`overlap: ${sorted[i - 1].id} (to ${sorted[i - 1].to}) and ${sorted[i].id} (from ${sorted[i].from}): two text elements on screen at once`);
  for (let i = 1; i < sorted.length; i++) { const g = sorted[i].from - sorted[i - 1].to; if (g >= 0 && g < 8) Wn(`${sorted[i - 1].id} -> ${sorted[i].id}: only ${g} frames between them`); }
  if (!cues.some((c) => c.kind === 'lockup')) E('no title lockup');
  if (!cues.some((c) => c.kind === 'end')) E('no end card');
  if (!cues.some((c) => c.kind === 'caught')) E('no CAUGHT card');
  if (typeof T.contact !== 'string') E('contact must be a string (empty = skipped)');
  else if (!T.contact) info.push('contact is empty: the end card is rendered without a contact line (fill "contact" in text.json)');
  return { errors, warnings, info };
}

// ------------------------------------------------------------------------------------------------------------------------------ animation
const DRIFT = { card: 0.035, caught: 0.02, lockup: 0.022, end: 0.012 };
/** Everything that changes from frame to frame of one cue: opacities of its lines (eased), slow scale drift, the lockup's landing (tracking tightens, glow flares). null when the cue is not visible. */
export function animState(cue, T, f) {
  if (f < cue.from || f >= cue.to) return null;
  const t = f - cue.from, dur = cue.to - cue.from, out = sstep((cue.to - f) / cue.fadeOut), ease = cue.kind === 'lockup' ? eout : sstep;
  const line = (delay, len) => Math.min(ease((t - delay + 1) / len), out);
  let o;
  if (cue.kind === 'caught') o = [line(0, cue.fadeIn), line(cue.subDelay ?? 10, cue.fadeIn)];
  else if (cue.kind === 'lockup') o = [line(0, cue.fadeIn), line(cue.subDelay ?? 14, 16), line(cue.taglineDelay ?? 30, 20)];
  else if (cue.kind === 'end') o = [line(0, cue.fadeIn), line(0, cue.fadeIn), line(cue.statusDelay ?? 14, 16), T.contact ? line(cue.contactDelay ?? 30, 18) : 0];
  else o = [line(0, cue.fadeIn)];
  const st = { o: o.map((v) => +v.toFixed(3)), scale: +(1 + (DRIFT[cue.kind] || 0) * (t / dur)).toFixed(4) };
  if (cue.kind === 'lockup') { st.glow = +(1 + 1.7 * Math.exp(-t / 9)).toFixed(3); st.ls = +(0.24 + 0.07 * Math.exp(-t / 16)).toFixed(4); }
  return st;
}
/** Visible frames of a cue grouped in runs of identical pictures: [{ start, count, st }] (a still caption is one run for its whole hold). */
export function cueRuns(cue, T) {
  const runs = [];
  for (let f = cue.from; f < cue.to; f++) {
    const st = animState(cue, T, f), key = JSON.stringify(st), last = runs[runs.length - 1];
    if (last && last.key === key) last.count++; else runs.push({ start: f, count: 1, st, key });
  }
  return runs.map(({ key, ...r }) => r);
}

// ------------------------------------------------------------------------------------------------------------------------------ fonts
const FACES = [  // [family, package, weight, style]
  ['NHCinzel', 'cinzel', 400, 'normal'], ['NHCinzel', 'cinzel', 500, 'normal'], ['NHCinzel', 'cinzel', 600, 'normal'], ['NHCinzel', 'cinzel', 700, 'normal'],
  ['NHCormorant', 'cormorant-garamond', 400, 'normal'], ['NHCormorant', 'cormorant-garamond', 500, 'normal'], ['NHCormorant', 'cormorant-garamond', 400, 'italic'], ['NHCormorant', 'cormorant-garamond', 500, 'italic'], ['NHCormorant', 'cormorant-garamond', 600, 'italic'],
  ['NHOswald', 'oswald', 200, 'normal'], ['NHOswald', 'oswald', 300, 'normal'], ['NHOswald', 'oswald', 400, 'normal'], ['NHOswald', 'oswald', 500, 'normal'], ['NHOswald', 'oswald', 600, 'normal'],
  ['NHBebas', 'bebas-neue', 400, 'normal'],
];
const PKGS = ['@fontsource/cinzel', '@fontsource/cormorant-garamond', '@fontsource/bebas-neue', '@fontsource/oswald'];
function fontRoots(dir) { return [dir && path.join(dir, 'node_modules', '@fontsource'), dir && path.join(dir, '@fontsource')].filter(Boolean); }
function findFont(dir, pkg, w, style) {
  for (const r of fontRoots(dir)) { const p = path.join(r, pkg, 'files', `${pkg}-latin-${w}-${style}.woff2`); if (fs.existsSync(p)) return p; }
  return null;
}
/** Resolves the font folder (arg, NH_FONTS, or a temp cache that is filled with npm) and returns { css, real, missing, dir, signature } with the woff2 files embedded as data: URLs. */
export function loadFonts(dirArg, log = console.log) {
  let dir = dirArg || process.env.NH_FONTS || path.join(os.tmpdir(), 'nh-trailer-fonts');
  if (!findFont(dir, 'cinzel', 500, 'normal')) {
    log(`fonts: not found in ${dir}, trying npm install of ${PKGS.join(' ')} ...`);
    fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(path.join(dir, 'package.json'))) fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"nh-trailer-fonts","private":true}');
    const r = cp.spawnSync('npm', ['install', '--prefix', dir, '--no-audit', '--no-fund', ...PKGS], { encoding: 'utf8', timeout: 240000 });
    if (r.status !== 0) log('fonts: npm install failed (' + String(r.stderr || r.error || '').split('\n')[0] + ')');
  }
  let css = '', real = 0; const missing = [], sig = [];
  for (const [fam, pkg, w, style] of FACES) {
    const p = findFont(dir, pkg, w, style);
    if (!p) { missing.push(`${pkg} ${w} ${style}`); continue; }
    const buf = fs.readFileSync(p); real++; sig.push(`${pkg}-${w}-${style}-${buf.length}`);
    css += `@font-face{font-family:'${fam}';font-weight:${w};font-style:${style};src:url(data:font/woff2;base64,${buf.toString('base64')}) format('woff2')}\n`;
  }
  if (missing.length) log(`fonts: WARNING ${missing.length} of ${FACES.length} faces missing (${missing.slice(0, 3).join(', ')}...): the installed Inter / Liberation Serif / Caladea stand in for them`);
  else log(`fonts: Cinzel, Cormorant Garamond, Oswald, Bebas Neue from ${dir}`);
  return { css, real, missing, dir, signature: sig.join('|') || 'system-fonts' };
}

// ------------------------------------------------------------------------------------------------------------------------------ the page
const CSS = `
:root{--ink:#ece4d4;--ink2:#cfc7b6;--dim:#a79f8e;--red:#cf3640;--red2:#e0323d;--pa:#e6dcc0}
*{box-sizing:border-box}
html,body{margin:0;width:1920px;height:1080px;overflow:hidden;background:transparent}
body{font-synthesis:none;-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision;font-kerning:normal}
#bg{position:absolute;left:0;top:${PIC_Y}px;width:1920px;height:${PIC_H}px;object-fit:cover;display:none}
#root{position:absolute;inset:0}
.f-cinzel{font-family:'NHCinzel','Trajan Pro','Liberation Serif',serif}
.f-corm{font-family:'NHCormorant','Caladea','Liberation Serif',serif}
.f-osw{font-family:'NHOswald','Inter','Liberation Sans',sans-serif}
.trk{display:inline-block;letter-spacing:var(--ls);margin-right:calc(-1 * var(--ls));white-space:nowrap}
.shadow{text-shadow:0 1px 3px rgba(0,0,0,.9),0 0 18px rgba(0,0,0,.75),0 0 54px rgba(0,0,0,.6)}

/* subtitles: inner monologue (italic) and dialogue (speaker label in the game's red, like the game's own subtitle) in the lower third of the picture */
.sub{position:absolute;left:50%;bottom:${H - (PIC_Y + PIC_H) + 62}px;width:max-content;max-width:1420px;text-align:center;transform-origin:50% 100%}
.sub:before{content:'';position:absolute;left:-210px;right:-210px;top:-70px;bottom:-46px;z-index:-1;background:radial-gradient(closest-side,rgba(0,0,0,.52),rgba(0,0,0,.30) 55%,rgba(0,0,0,0))}
.sub .who{font:500 24px/1 'NHOswald','Inter',sans-serif;letter-spacing:.42em;margin-right:-.42em;color:var(--red2);text-transform:uppercase;margin-bottom:14px;text-shadow:0 0 12px rgba(0,0,0,.95),0 1px 2px #000}
.sub .txt{font:500 58px/1.2 'NHCormorant','Caladea','Liberation Serif',serif;color:var(--ink);letter-spacing:.012em;text-wrap:balance;text-shadow:0 1px 2px rgba(0,0,0,.9),0 0 18px rgba(0,0,0,.75),0 0 50px rgba(0,0,0,.55)}
.sub.mono .txt{font-style:italic;color:#d9d1c0;font-weight:500}

/* the PA: the game's own ticker (P.A. tag in red, spaced capitals between two hairlines), upper third */
.pa{position:absolute;left:50%;top:${PIC_Y + 150}px;width:max-content;max-width:1800px;padding:20px 72px;text-align:center;text-transform:uppercase}
.pa:before,.pa:after{content:'';position:absolute;left:0;right:0;height:1px;background:linear-gradient(90deg,rgba(150,140,118,0),rgba(150,140,118,.9) 20%,rgba(150,140,118,.9) 80%,rgba(150,140,118,0))}
.pa:before{top:0}.pa:after{bottom:0}
.pa .bgd{position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,0),rgba(0,0,0,.62) 16%,rgba(0,0,0,.62) 84%,rgba(0,0,0,0));z-index:-1}
.pa .tag{font:500 27px/1 'NHOswald','Inter',sans-serif;letter-spacing:.3em;color:var(--red2);margin-right:.5em;vertical-align:middle}
.pa .tag i{display:inline-block;width:0;height:0;border-left:15px solid var(--red2);border-top:9px solid transparent;border-bottom:9px solid transparent;margin-left:.45em;vertical-align:middle}
.pa .msg{font:400 36px/1.25 'NHOswald','Inter',sans-serif;letter-spacing:.2em;margin-right:-.2em;white-space:nowrap;color:var(--pa);vertical-align:middle;text-shadow:0 0 14px rgba(0,0,0,.9),0 1px 2px #000}

/* cards: a single spaced line of capitals in the centre of the picture */
.card{position:absolute;left:50%;top:${PIC_Y + PIC_H / 2}px;width:max-content;text-align:center;color:var(--ink)}
.card:before{content:'';position:absolute;left:-240px;right:-240px;top:-150px;bottom:-150px;z-index:-1;background:radial-gradient(closest-side,rgba(0,0,0,.55),rgba(0,0,0,.3) 58%,rgba(0,0,0,0))}
.card .ct{font:500 var(--fs,92px)/1 'NHCinzel','Liberation Serif',serif;text-transform:uppercase}
.card .rule{width:96px;height:1px;margin:0 auto;background:linear-gradient(90deg,rgba(236,228,212,0),rgba(236,228,212,.85),rgba(236,228,212,0))}
.card .rule.a{margin-bottom:34px}.card .rule.b{margin-top:34px}

/* CAUGHT: the game's arrest card (red glow, one hour in the cell) */
.caught{position:absolute;left:50%;top:${PIC_Y + PIC_H / 2}px;width:max-content;text-align:center}
.caught .h1{font:700 176px/1 'NHCinzel','Liberation Serif',serif;color:#ece4d4;letter-spacing:.3em;margin-right:-.3em}
.caught .h2{margin-top:30px;font:400 31px/1 'NHOswald','Inter',sans-serif;letter-spacing:.72em;margin-right:-.72em;color:#cfc7b6;text-transform:uppercase}

/* title lockup */
.lock{position:absolute;left:50%;top:${PIC_Y + PIC_H / 2}px;width:max-content;text-align:center;transform-origin:50% 50%}
.lock:before{content:'';position:absolute;left:-200px;right:-200px;top:-150px;bottom:-130px;z-index:-1;background:radial-gradient(closest-side,rgba(0,0,0,.5),rgba(0,0,0,.28) 60%,rgba(0,0,0,0))}
.lock .t{font:500 var(--fs,100px)/1 'NHCinzel','Liberation Serif',serif;color:var(--ink);white-space:nowrap}
.lock .t b{font-weight:inherit;color:var(--red)}
.lock .s{margin-top:34px;font:300 34px/1 'NHOswald','Inter',sans-serif;letter-spacing:1em;margin-right:-1em;color:#d6cdbb;text-transform:uppercase}
.lock .r{width:120px;height:1px;margin:38px auto 32px;background:linear-gradient(90deg,rgba(236,228,212,0),rgba(236,228,212,.7),rgba(236,228,212,0))}
.lock .q{font:italic 500 36px/1 'NHCormorant','Caladea','Liberation Serif',serif;letter-spacing:.06em;color:#d6cdbb}
.lock .st{margin-top:44px;font:300 28px/1 'NHOswald','Inter',sans-serif;letter-spacing:.6em;margin-right:-.6em;color:#d6cdbb;text-transform:uppercase}
.lock .ct{margin-top:34px;font:500 36px/1.2 'NHCormorant','Caladea','Liberation Serif',serif;letter-spacing:.06em;color:#d8d0bf}
`;

const PAGE_JS = `
const esc=(s)=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const typo=(s)=>esc(s).replace(/'/g,'\\u2019');
const root=document.getElementById('root');
const trk=(s,ls,extra='')=>'<span class="trk" style="--ls:'+ls+'em'+extra+'">'+s+'</span>';
window.build=function(cue,st,T){
  const o=st.o,sc=st.scale;
  if(cue.kind==='mono'||cue.kind==='dialogue'){
    const who=cue.kind==='dialogue'&&cue.speaker?'<div class="who">'+esc(cue.speaker)+'</div>':'';
    return '<div class="sub '+cue.kind+'" style="opacity:'+o[0]+';transform:translateX(-50%) scale('+sc+')">'+who+'<div class="txt">'+typo(cue.text)+'</div></div>';
  }
  if(cue.kind==='pa'){
    return '<div class="pa" style="opacity:'+o[0]+';transform:translateX(-50%) scale('+sc+')"><div class="bgd"></div><span class="tag">P.A.<i></i></span><span class="msg">'+esc(cue.text)+'</span></div>';
  }
  if(cue.kind==='card'){
    const fs=Math.round(92*(cue.size||1));
    return '<div class="card" style="opacity:'+o[0]+';transform:translate(-50%,-50%) scale('+sc+');--fs:'+fs+'px"><div class="rule a"></div><div class="ct">'+trk(typo(cue.text),0.36)+'</div><div class="rule b"></div></div>'.replace(/<div class="ct">/,'<div class="ct shadow">');
  }
  if(cue.kind==='caught'){
    return '<div class="caught" style="transform:translate(-50%,-50%) scale('+sc+')"><div class="h1" style="opacity:'+o[0]+';text-shadow:0 0 70px rgba(179,32,42,.75),0 0 22px rgba(179,32,42,.45),0 5px 24px #000">'+esc(cue.text)+'</div><div class="h2" style="opacity:'+o[1]+';text-shadow:0 0 14px #000">'+esc(cue.sub)+'</div></div>';
  }
  const title=(cue,ls,fs,glow)=>{
    let t=esc(cue.title); if(cue.titleRed) t=t.replace(esc(cue.titleRed),'<b style="text-shadow:0 0 '+Math.round(34*glow)+'px rgba(207,54,64,'+Math.min(.9,.5*glow).toFixed(2)+')">'+esc(cue.titleRed)+'</b>');
    return '<div class="t" style="--fs:'+fs+'px;text-shadow:0 2px 30px rgba(0,0,0,.65)">'+trk(t,ls)+'</div>';
  };
  if(cue.kind==='lockup'){
    const glow=st.glow||1,ls=st.ls||.24;
    return '<div class="lock" style="transform:translate(-50%,-50%) scale('+sc+')"><div style="opacity:'+o[0]+'">'+title(cue,ls,96,glow)+'</div><div class="s" style="opacity:'+o[1]+';text-shadow:0 0 14px rgba(0,0,0,.8)">'+esc(cue.subtitle)+'</div><div style="opacity:'+o[2]+'"><div class="r"></div><div class="q" style="text-shadow:0 0 12px rgba(0,0,0,.8)">'+typo(cue.tagline)+'</div></div></div>';
  }
  if(cue.kind==='end'){
    const contact=T.contact?'<div class="ct" style="opacity:'+o[3]+'">'+typo(T.contact)+'</div>':'';
    return '<div class="lock" style="transform:translate(-50%,-50%) scale('+sc+')"><div style="opacity:'+o[0]+'">'+title(cue,.24,64,1)+'</div><div class="s" style="opacity:'+o[1]+';font-size:24px;margin-top:26px">'+esc(cue.subtitle)+'</div><div class="st" style="opacity:'+o[2]+'">'+esc(cue.status)+'</div>'+contact+'</div>';
  }
  return '';
};
window.draw=async function(cue,st,T,bg){
  const img=document.getElementById('bg');
  document.body.style.background=bg?'#000':'transparent';
  if(bg){ if(img.dataset.src!==bg){img.dataset.src=bg;await new Promise((r)=>{img.onload=img.onerror=r;img.src=bg;});} img.style.display='block'; } else img.style.display='none';
  root.innerHTML=cue?window.build(cue,st,T):'';
  await document.fonts.ready;
};
window.preload=async function(){
  const specs=["400 40px NHCinzel","500 40px NHCinzel","600 40px NHCinzel","700 40px NHCinzel","500 40px NHCormorant","400 40px NHCormorant","italic 500 40px NHCormorant","italic 400 40px NHCormorant","300 40px NHOswald","400 40px NHOswald","500 40px NHOswald","200 40px NHOswald","600 40px NHOswald","400 40px NHBebas"];
  await Promise.all(specs.map((s)=>document.fonts.load(s,'AaBb')));
  await document.fonts.ready;
};
`;

export const pageHtml = (fontCss) => `<!doctype html><html><head><meta charset="utf-8"><style>${fontCss}${CSS}</style></head><body><img id="bg" alt=""><div id="root"></div><script>${PAGE_JS}</script></body></html>`;

let _chromium = null;
export async function launchBrowser() {
  _chromium ||= (await import('playwright-core')).chromium;
  const { CHROME } = await import('../lib.mjs');
  return _chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu', '--font-render-hinting=none', '--force-color-profile=srgb', '--hide-scrollbars', '--disable-lcd-text'] });
}
/** Opens the typography page: { draw(cue, st, T, bgPath), png(opaque), close() }. */
export async function openTitlePage({ fontsDir, log = console.log, fonts } = {}) {
  fonts ||= loadFonts(fontsDir, log);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nh-titles-')), file = path.join(tmp, 'page.html');
  fs.writeFileSync(file, pageHtml(fonts.css));
  const browser = await launchBrowser(), page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('[page error]', e.message));
  await page.goto(pathToFileURL(file).href);
  await page.evaluate('preload()');
  return {
    fonts, page,
    draw: (cue, st, T, bg) => page.evaluate(([c, s, t, b]) => window.draw(c, s, t, b), [cue, st, T, bg ? pathToFileURL(path.resolve(bg)).href : null]),
    png: async (opaque = false) => page.screenshot({ type: 'png', omitBackground: !opaque, timeout: 120000 }),
    close: async () => { await browser.close(); fs.rmSync(tmp, { recursive: true, force: true }); },
  };
}

// ------------------------------------------------------------------------------------------------------------------------------ rendering
const sha = (...p) => crypto.createHash('sha1').update(p.join('\u0001')).digest('hex').slice(0, 16);
const pageSig = (fonts) => sha(CSS, PAGE_JS, animState.toString(), cueRuns.toString(), JSON.stringify(DRIFT), fonts.signature);

/** Renders every visible frame of the cues to DIR/<cue id>/<frame>.png (identical frames once) and writes DIR/titles.manifest.json: { fps, frames, hash, runs: [{ cue, start, count, file }] }.
 *  Cached per cue (DIR/<cue id>/.hash holds a hash of the cue, the page code and the fonts): only cues that changed are rendered again. */
export async function renderTitles({ T = loadText(), outDir, fontsDir, only, force = false, log = console.log } = {}) {
  fs.mkdirSync(outDir, { recursive: true });
  const fonts = loadFonts(fontsDir, log), sig = pageSig(fonts), mfile = path.join(outDir, 'titles.manifest.json');
  const plan = T.cues.map((cue) => {
    const list = cueRuns(cue, T), cdir = path.join(outDir, cue.id), h = sha(JSON.stringify(cue), cue.kind === 'end' ? T.contact : '', sig);
    const files = list.map((r) => `${cue.id}/${String(r.start).padStart(4, '0')}.png`);
    const fresh = !force && (!only || !only.includes(cue.id)) && fs.existsSync(path.join(cdir, '.hash')) && fs.readFileSync(path.join(cdir, '.hash'), 'utf8') === h && files.every((f) => fs.existsSync(path.join(outDir, f)));
    return { cue, list, cdir, h, files, fresh };
  });
  const todo = plan.filter((p) => !p.fresh && (!only || only.includes(p.cue.id)));
  let n = 0; const t0 = Date.now();
  if (todo.length) {
    const tp = await openTitlePage({ fonts, log });
    try {
      for (const p of todo) {
        fs.rmSync(p.cdir, { recursive: true, force: true }); fs.mkdirSync(p.cdir, { recursive: true });
        for (const [i, r] of p.list.entries()) { await tp.draw(p.cue, r.st, T); fs.writeFileSync(path.join(outDir, p.files[i]), await tp.png()); n++; }
        fs.writeFileSync(path.join(p.cdir, '.hash'), p.h);
        log(`titles: ${p.cue.id.padEnd(24)} ${String(p.list.length).padStart(3)} pictures for frames ${p.cue.from}-${p.cue.to - 1} (bar ${barBeat(p.cue.from)})`);
      }
    } finally { await tp.close(); }
  }
  const runs = plan.flatMap((p) => p.list.map((r, i) => ({ cue: p.cue.id, start: r.start, count: r.count, file: p.files[i] }))).sort((a, b) => a.start - b.start);
  const manifest = { version: 2, fps: FPS, frames: TOTAL, size: [W, H], hash: sha(...plan.map((p) => p.h)), fonts: fonts.real ? 'embedded' : 'system', contact: T.contact || null, runs };
  fs.writeFileSync(mfile, JSON.stringify(manifest, null, 1));
  log(todo.length ? `titles: ${n} PNGs for ${todo.length} cue(s) in ${((Date.now() - t0) / 1000).toFixed(0)} s -> ${mfile}` : `titles: ${runs.length} runs up to date in ${outDir}`);
  return manifest;
}
/** Used by the assembler: validates, then renders or re-uses the PNG runs. */
export async function ensureTitles({ textFile = TEXT_JSON, outDir, fontsDir, force = false, log = console.log } = {}) {
  const T = loadText(textFile), v = validate(T);
  for (const w of v.warnings) log('titles: warning: ' + w);
  if (v.errors.length) throw new Error('text.json breaks the rules:\n  ' + v.errors.join('\n  '));
  return { T, manifest: await renderTitles({ T, outDir, fontsDir, force, log }) };
}

// ------------------------------------------------------------------------------------------------------------------------------ CLI
function holdFrame(c) { return Math.min(c.to - 1, c.from + Math.max(c.fadeIn, c.kind === 'lockup' ? 60 : c.kind === 'end' ? 50 : 0) + 4); }
async function main() {
  const A = process.argv.slice(2), has = (k) => A.includes('--' + k), arg = (k, d) => { const i = A.indexOf('--' + k); return i >= 0 && A[i + 1] && !A[i + 1].startsWith('--') ? A[i + 1] : d; };
  const T = loadText(arg('text', TEXT_JSON));
  if (has('check') || has('list')) {
    if (has('list')) for (const c of [...T.cues].sort((a, b) => a.from - b.from)) console.log(`${String(c.from).padStart(4)}-${String(c.to).padEnd(4)} bar ${barBeat(c.from).padEnd(5)} ${c.kind.padEnd(8)} ${c.id.padEnd(24)} ${(c.text || c.title || '').slice(0, 70)}`);
    const v = validate(T);
    for (const m of v.info) console.log('info   ', m); for (const m of v.warnings) console.log('warning', m); for (const m of v.errors) console.log('ERROR  ', m);
    console.log(`${T.cues.length} cues, ${v.errors.length} errors, ${v.warnings.length} warnings`);
    process.exit(v.errors.length ? 1 : 0);
  }
  const fontsDir = arg('fonts', undefined), out = arg('out', undefined), bg = arg('bg', undefined);
  if (has('still') || has('sheet')) {
    if (!out) { console.error('--out FILE required'); process.exit(1); }
    const tp = await openTitlePage({ fontsDir });
    try {
      const frames = [];
      if (has('still')) { const [id, at] = String(arg('still')).split('@'), c = T.cues.find((x) => x.id === id); if (!c) throw new Error('unknown cue ' + id); frames.push([c, at !== undefined ? +at : holdFrame(c)]); }
      else for (const c of [...T.cues].sort((a, b) => a.from - b.from)) frames.push([c, holdFrame(c)]);
      const files = [];
      for (const [c, f] of frames) {
        const st = animState(c, T, f); if (!st) throw new Error(`${c.id} is not visible at frame ${f}`);
        await tp.draw(c, st, T, bg); const file = frames.length === 1 ? out : path.join(path.dirname(out), `${path.basename(out, path.extname(out))}_${c.id}.png`);
        fs.writeFileSync(file, await tp.png(!!bg)); files.push([file, `${c.id} f${f}`]);
      }
      if (frames.length > 1) {
        const r = cp.spawnSync('montage', ['-background', 'black', '-tile', '3x', '-geometry', '640x360+3+3', '-fill', 'yellow', '-pointsize', '13', ...files.flatMap(([f, l]) => ['-label', l, f]), out], { encoding: 'utf8' });
        if (r.status !== 0) console.error('montage failed: ' + r.stderr); else console.log('sheet ' + out);
        for (const [f] of files) fs.rmSync(f, { force: true });
      } else console.log('still ' + out);
    } finally { await tp.close(); }
    return;
  }
  if (!out) { console.error('usage: titles.mjs --check | --list | --out DIR [--only id,id] [--force] | --still ID[@FRAME] --out FILE [--bg IMG] | --sheet --out FILE [--bg IMG]   (--text FILE, --fonts DIR)'); process.exit(1); }
  const v = validate(T); if (v.errors.length) { for (const m of v.errors) console.error('ERROR', m); process.exit(1); }
  await renderTitles({ T, outDir: path.resolve(out), fontsDir, only: arg('only') ? String(arg('only')).split(',') : undefined, force: has('force') });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(e); process.exit(1); });
