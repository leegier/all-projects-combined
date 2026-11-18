// Input test: real keyboard on a desktop page, and touch (thumb stick, drag-to-look, buttons) on an emulated phone.
// The simulation is stepped by hand (NH.advance) while the key / finger is down, so the result does not depend on how fast the machine renders.
// Usage: node tests/input.mjs   (NH_CHROME=/path/to/chrome, NH_GL=llvmpipe under xvfb-run when there is no GPU)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '../tools/serve.mjs';
import { CHROME, ARGS, LLVMPIPE } from '../tools/lib.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? '  (' + detail + ')' : ''}`); };

const srv = await serve(8661);
const browser = await chromium.launch({ executablePath: CHROME, args: ARGS, headless: !LLVMPIPE });

async function boot(ctx, query) {
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:8661/?${query}`);
  await page.waitForFunction(() => window.NH && document.getElementById('u-accept') && !document.getElementById('u-accept').disabled, null, { timeout: 600000 });
  await page.evaluate(() => document.getElementById('u-accept').click());
  await page.waitForTimeout(500);
  await page.evaluate(() => { const g = window.NH; g.newGame(); });
  await page.waitForTimeout(500);
  // hand control to the player in the open hall (skips the 34 s intro cinematic)
  await page.evaluate(() => { const g = window.NH; g.cine = null; g.camOverride = null; g.mode = 'play'; g.player.frozen = false; g.ui.hud(true); g.fadeTarget = 0; g.fade = 0; g.letter = 0; g.eyelid = 0; g.blur = 0; g.player.teleport(0, 0, 3, 0); g.player.pitch = 0; g.advance(30); });
  return { page, errors };
}
const pos = (page) => page.evaluate(() => ({ x: NH.player.pos.x, z: NH.player.pos.z, yaw: NH.player.yaw }));
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// ---- desktop: keyboard ----
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const { page, errors } = await boot(ctx, 'fast&q=low');
  check('desktop: no touch overlay, input.touch is false', await page.evaluate(() => !document.getElementById('touch') && NH.input.touch === false));
  let a = await pos(page);
  await page.keyboard.down('KeyW'); await page.evaluate(() => NH.advance(120)); await page.keyboard.up('KeyW');
  let b = await pos(page);
  check('desktop: W moves the player forward', dist(a, b) > 1.0, `moved ${dist(a, b).toFixed(2)} m in 2 s`);
  await page.evaluate(() => NH.advance(30));
  a = await pos(page);
  await page.evaluate(() => NH.advance(120));
  b = await pos(page);
  check('desktop: with no key down the player stands still', dist(a, b) < 0.05, `drift ${dist(a, b).toFixed(3)} m`);
  await page.keyboard.down('KeyD'); await page.evaluate(() => NH.advance(60)); await page.keyboard.up('KeyD');
  const c = await pos(page);
  check('desktop: D strafes', dist(b, c) > 0.4, `moved ${dist(b, c).toFixed(2)} m`);
  const burst = async (keys) => { await page.evaluate(() => { NH.player.teleport(-10, 0, 0, -Math.PI / 2); NH.advance(20); }); for (const k of keys) await page.keyboard.down(k); await page.evaluate(() => NH.advance(25)); const v = await page.evaluate(() => NH.player.speed); for (const k of keys.slice().reverse()) await page.keyboard.up(k); return v; };
  const walk = await burst(['KeyW']), run = await burst(['ShiftLeft', 'KeyW']);
  check('desktop: Shift runs (faster than walking)', run > walk * 1.3, `walk ${walk.toFixed(2)} m/s, run ${run.toFixed(2)} m/s`);
  await page.keyboard.down('Escape'); await page.evaluate(() => NH.advance(2)); await page.keyboard.up('Escape'); await page.evaluate(() => NH.advance(2));
  check('desktop: Escape pauses', await page.evaluate(() => NH.mode) === 'paused');
  check('desktop: no page errors', errors.length === 0, errors.join(' | ').slice(0, 200));
  await ctx.close();
}

// ---- phone: touch ----
{
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  const { page, errors } = await boot(ctx, 'fast');
  check('phone: touch overlay present, input.touch is true', await page.evaluate(() => !!document.getElementById('touch') && NH.input.touch === true));
  check('phone: defaults to low quality', await page.evaluate(() => document.getElementById('u-qual').textContent.includes('low')));
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, id, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id }] });
  const box = await page.evaluate(() => { const r = document.getElementById('wrap').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  const lx = box.x + box.w * 0.2, ly = box.y + box.h * 0.8, rx = box.x + box.w * 0.7, ry = box.y + box.h * 0.5;
  let a = await pos(page);
  await touch('touchStart', 1, lx, ly); await touch('touchMove', 1, lx, ly - 60);
  await page.evaluate(() => NH.advance(120));
  const stick = await page.evaluate(() => NH.input.stick.map((v) => +v.toFixed(2)));
  await touch('touchEnd', 1);
  let b = await pos(page);
  check('phone: stick up reads forward', stick[1] > 0.9 && Math.abs(stick[0]) < 0.1, `stick ${stick}`);
  check('phone: stick up moves the player forward', dist(a, b) > 1.0, `moved ${dist(a, b).toFixed(2)} m in 2 s`);
  await page.evaluate(() => NH.advance(30));
  a = await pos(page); await page.evaluate(() => NH.advance(90)); b = await pos(page);
  check('phone: releasing the stick stops the player', dist(a, b) < 0.05 && (await page.evaluate(() => NH.input.stick.every((v) => v === 0))), `drift ${dist(a, b).toFixed(3)} m`);
  const yaw0 = (await pos(page)).yaw;
  await touch('touchStart', 2, rx, ry); for (let i = 1; i <= 8; i++) await touch('touchMove', 2, rx + i * 15, ry); await page.evaluate(() => NH.advance(5)); await touch('touchEnd', 2);
  const yaw1 = (await pos(page)).yaw;
  check('phone: dragging right turns the camera', Math.abs(yaw1 - yaw0) > 0.2, `yaw ${yaw0.toFixed(2)} -> ${yaw1.toFixed(2)}`);
  const btn = async (label) => { const el = page.locator('#touch .tb', { hasText: label }).first(); const r = await el.boundingBox(); await touch('touchStart', 5, r.x + r.width / 2, r.y + r.height / 2); await touch('touchEnd', 5); };
  const burst = async (runOn) => { await page.evaluate(() => { NH.player.teleport(-10, 0, 0, -Math.PI / 2); NH.advance(20); }); if (runOn) await btn('Run'); await touch('touchStart', 1, lx, ly); await touch('touchMove', 1, lx, ly - 60); await page.evaluate(() => NH.advance(25)); const v = await page.evaluate(() => NH.player.speed); await touch('touchEnd', 1); return v; };
  const walk = await burst(false), run = await burst(true);
  check('phone: Run button makes the player faster', run > walk * 1.3, `walk ${walk.toFixed(2)} m/s, run ${run.toFixed(2)} m/s`);
  await btn('Run'); await page.evaluate(() => NH.advance(2));
  check('phone: a short tap on a button is seen even when no frame renders during the tap (Log opens the journal)', await (async () => { await btn('Log'); await page.evaluate(() => NH.advance(3)); return page.evaluate(() => NH.ui.panelOpen); })());
  await btn('II'); await page.evaluate(() => NH.advance(3));
  check('phone: pause button closes the journal', await page.evaluate(() => !NH.ui.panelOpen));
  await btn('II'); await page.evaluate(() => NH.advance(3));
  check('phone: pause button pauses', await page.evaluate(() => NH.mode) === 'paused');
  check('phone: no page errors', errors.length === 0, errors.join(' | ').slice(0, 200));
  await ctx.close();
}

await browser.close(); srv.close && srv.close();
const bad = results.filter((r) => !r.ok);
console.log(`\ninput: ${results.length - bad.length}/${results.length} checks passed`);
fs.writeFileSync(path.join(here, '..', 'docs', 'input-report.json'), JSON.stringify({ when: new Date().toISOString(), results }, null, 1));
process.exit(bad.length ? 1 : 0);
