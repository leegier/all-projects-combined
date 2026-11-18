// Look-dev screenshotter: node tools/shot.mjs '[[x,y,z,tx,ty,tz,fov],...]' outPrefix [quality]
import { chromium } from 'playwright-core';
import { serve } from './serve.mjs';
import fs from 'node:fs';
const shots = JSON.parse(process.argv[2]);
const prefix = process.argv[3] || '/tmp/shot';
const q = process.argv[4] || 'high';
const srv = await serve(8099);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
pg.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text().slice(0, 300)); });
pg.on('pageerror', (e) => console.log('[pageerror]', e.message));
await pg.goto('http://localhost:8099/?q=' + q);
await pg.waitForFunction('window.DEV && (window.DEV.ready || window.DEV.error)', null, { timeout: 120000 });
const err = await pg.evaluate('window.DEV.error'); if (err) { console.log(err); process.exit(1); }
console.log('texture gen ms', await pg.evaluate('DEV.texMs'));
let i = 0;
for (const s of shots) {
  const t = Date.now();
  await pg.evaluate((a) => DEV.shot(...a), s);
  const buf = await pg.screenshot();
  fs.writeFileSync(`${prefix}_${i}.png`, buf);
  console.log(`shot ${i} ${Date.now() - t}ms`, JSON.stringify(await pg.evaluate('DEV.info()')));
  i++;
}
await b.close(); srv.close();
