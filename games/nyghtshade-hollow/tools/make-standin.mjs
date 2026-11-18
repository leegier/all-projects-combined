// Generates the stand-in test characters (tests/fixtures/characters/*.glb + manifest.json).  They are NOT MetaHumans: rigid-skinned mannequins on
// MetaHuman-/Mixamo-style skeletons (see tools/standin/gen.js) used to test the glTF character pipeline without licensed assets.
//   node tools/make-standin.mjs
import * as esbuild from 'esbuild';
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHROME, ARGS } from './lib.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'tests/fixtures/characters');
fs.mkdirSync(out, { recursive: true });
const bundle = await esbuild.build({ entryPoints: [path.join(root, 'tools/standin/gen.js')], bundle: true, format: 'iife', write: false, target: 'es2022', logLevel: 'warning' });
const browser = await chromium.launch({ executablePath: CHROME, args: ARGS, headless: true });
const page = await browser.newPage();
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text().slice(0, 300)); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.setContent('<!doctype html><html><body></body></html>');
await page.addScriptTag({ content: bundle.outputFiles[0].text });
const files = await page.evaluate(() => window.makeStandIns('game'));
const raw = await page.evaluate(() => window.makeStandIns('raw'));
const specs = await page.evaluate(() => window.STAND_INS);
await browser.close();
const manifest = { note: 'STAND-IN test characters (mannequins). Not MetaHumans.', defaults: { height: 1.78 }, characters: [] };
for (const s of specs) {
  const file = `standin-${s.id}.glb`;
  fs.writeFileSync(path.join(out, file), Buffer.from(files[s.id], 'base64'));
  manifest.characters.push({ id: 'standin-' + s.id, file, looks: s.looks, height: s.height });
  console.log(file, (Buffer.from(files[s.id], 'base64').length / 1024).toFixed(0) + ' KB');
}
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
// raw exports (not in any manifest): inputs for the optimizer tests
const rawDir = path.join(root, 'tests/fixtures/raw'); fs.mkdirSync(rawDir, { recursive: true });
for (const [id, b64] of Object.entries(raw)) { fs.writeFileSync(path.join(rawDir, `standin-${id}.glb`), Buffer.from(b64, 'base64')); console.log(`raw/standin-${id}.glb`, (Buffer.from(b64, 'base64').length / 1024).toFixed(0) + ' KB'); }
console.log('wrote', path.relative(root, out));
