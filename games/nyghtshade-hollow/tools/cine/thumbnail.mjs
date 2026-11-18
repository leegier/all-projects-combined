#!/usr/bin/env node
// YouTube thumbnail generator (first draft): a still from the trailer + the title treatment of titles.mjs, 1280x720 JPEG, always under 2 MB.
//
//   node tools/cine/thumbnail.mjs --still FRAME.png|jpg --out thumb.jpg [--focus 0.5] [--zoom 1.0] [--side left|right|center] [--no-sub] [--text FILE] [--fonts DIR]
//
//   --still   a frame of the finished trailer (grab one with: ffmpeg -ss 135 -i trailer.mp4 -frames:v 1 frame.png) or of a clip; 16:9 is cropped from it around --focus
//   --focus   horizontal centre of the crop as a fraction of the still's width (default 0.5), --zoom enlarges the crop (default 1)
//   --side    where the title sits (left | right | center, default left); the picture is darkened on that side for legibility
// The wording is the title treatment of the trailer: title and subtitle from the lockup cue of tools/cine/trailer/text.json (NYGHTSHADE HOLLOW, THE INTAKE), nothing else is invented.
// Quality: JPEG q92, lowered until the file is below 1.9 MB. A subtle grade and grain are applied so the thumbnail matches the trailer.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadFonts, launchBrowser, loadText, TEXT_JSON } from './titles.mjs';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

export function thumbHtml({ fontCss, still, focus = 0.5, zoom = 1, side = 'left', title, titleRed, subtitle, showSub = true }) {
  const words = String(title).split(' ');
  const first = words[0], second = words.slice(1).join(' ');
  const mark = (s) => { const i = titleRed ? s.indexOf(titleRed) : -1; return i < 0 ? esc(s) : `${esc(s.slice(0, i))}<b>${esc(titleRed)}</b>${esc(s.slice(i + titleRed.length))}`; };
  const align = side === 'right' ? 'right' : side === 'center' ? 'center' : 'left';
  const grad = side === 'right' ? 'to left' : side === 'center' ? 'to top' : 'to right';
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fontCss}
html,body{margin:0;width:1280px;height:720px;overflow:hidden;background:#000}
#pic{position:absolute;inset:0;width:1280px;height:720px;object-fit:cover;object-position:${(focus * 100).toFixed(1)}% 50%;transform:scale(${zoom});transform-origin:${(focus * 100).toFixed(1)}% 50%}
.sh{position:absolute;inset:0;background:
  linear-gradient(${grad},rgba(0,0,0,.84) 0%,rgba(0,0,0,.62) 34%,rgba(0,0,0,0) 72%),
  linear-gradient(to top,rgba(0,0,0,.72) 0%,rgba(0,0,0,0) 40%),
  radial-gradient(ellipse at 50% 50%,rgba(0,0,0,0) 55%,rgba(0,0,0,.5) 100%)}
.blk{position:absolute;${side === 'right' ? 'right:70px' : side === 'center' ? 'left:0;right:0' : 'left:70px'};bottom:96px;text-align:${align};color:#ece4d4}
.t{font:600 150px/0.94 'NHCinzel','Liberation Serif',serif;letter-spacing:.07em;text-shadow:0 4px 30px rgba(0,0,0,.8),0 0 4px rgba(0,0,0,.6);white-space:nowrap}
.t.b{font-size:174px;letter-spacing:.1em}
.t b{font-weight:inherit;color:#d93a45;text-shadow:0 0 36px rgba(207,54,64,.65),0 4px 22px rgba(0,0,0,.8)}
.s{margin-top:32px;font:400 34px/1 'NHOswald','Inter',sans-serif;letter-spacing:.9em;color:#cfc7b6;text-transform:uppercase;text-shadow:0 0 14px #000;${align === 'left' ? '' : 'margin-right:-.9em;'}}
.rule{width:150px;height:3px;background:#cf3640;margin:${align === 'center' ? '26px auto 0' : align === 'right' ? '26px 0 0 auto' : '26px 0 0'}}
</style></head><body><img id="pic" src="${pathToFileURL(path.resolve(still)).href}"><div class="sh"></div>
<div class="blk"><div class="t">${mark(first)}</div><div class="t b">${mark(second)}</div>${showSub ? `<div class="rule"></div><div class="s">${esc(subtitle)}</div>` : ''}</div>
<script>document.fonts.ready.then(()=>{const t=[...document.querySelectorAll('.t')],max=${side === 'center' ? 1140 : 1130},w=Math.max(...t.map((e)=>e.getBoundingClientRect().width));if(w>max){t.forEach((e)=>{e.style.fontSize=parseFloat(getComputedStyle(e).fontSize)*max/w+'px';});}window.READY=true;});</script></body></html>`;
}

export async function makeThumbnail({ still, out, focus, zoom, side, showSub = true, textFile = TEXT_JSON, fontsDir, log = console.log }) {
  if (!fs.existsSync(still)) throw new Error('still not found: ' + still);
  const T = loadText(textFile), lock = T.cues.find((c) => c.kind === 'lockup');
  if (!lock) throw new Error('text.json has no lockup cue');
  const fonts = loadFonts(fontsDir, log);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nh-thumb-')), html = path.join(tmp, 'thumb.html');
  fs.writeFileSync(html, thumbHtml({ fontCss: fonts.css, still, focus, zoom, side, title: lock.title, titleRed: lock.titleRed, subtitle: lock.subtitle, showSub }));
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(html).href);
    await page.waitForFunction('window.READY === true', null, { timeout: 30000 });
    await page.evaluate(() => new Promise((r) => { const i = document.getElementById('pic'); i.complete ? r() : (i.onload = i.onerror = r); }));
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    let q = 92, buf;
    for (; q >= 60; q -= 4) { buf = await page.screenshot({ type: 'jpeg', quality: q }); if (buf.length < 1.9 * 1024 * 1024) break; }
    fs.writeFileSync(out, buf);
    log(`thumbnail ${out}: 1280x720 JPEG q${q}, ${(buf.length / 1024).toFixed(0)} KB`);
    return { out, bytes: buf.length, quality: q };
  } finally { await browser.close(); fs.rmSync(tmp, { recursive: true, force: true }); }
}

async function main() {
  const A = process.argv.slice(2), has = (k) => A.includes('--' + k);
  const arg = (k, d) => { const i = A.indexOf('--' + k); return i >= 0 && A[i + 1] !== undefined && !A[i + 1].startsWith('--') ? A[i + 1] : d; };
  if (!arg('still') || !arg('out')) { console.error('usage: node tools/cine/thumbnail.mjs --still FRAME.png --out thumb.jpg [--focus 0.5] [--zoom 1] [--side left|right|center] [--no-sub] [--text FILE] [--fonts DIR]'); process.exit(1); }
  await makeThumbnail({ still: arg('still'), out: arg('out'), focus: arg('focus') === undefined ? 0.5 : +arg('focus'), zoom: arg('zoom') === undefined ? 1 : +arg('zoom'), side: arg('side', 'left'), showSub: !has('no-sub'), textFile: arg('text', TEXT_JSON), fontsDir: arg('fonts') });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(e.message || e); process.exit(1); });
