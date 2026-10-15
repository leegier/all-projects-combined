// Bundles src/ into dist/game.js and a single self-contained dist/index.html (works from file://).
//   node tools/build.mjs                       minified build
//   node tools/build.mjs --no-min | --dev      readable build / dev entry
//   node tools/build.mjs --out=DIR              write to DIR instead of dist/ (tests use this)
//   node tools/build.mjs --embed-characters[=DIR]   also inline every file of DIR (default assets/characters: manifest.json + *.glb) into the page
//                                              as window.__NH_CHARS (base64), so the one HTML file carries its MetaHuman characters.
//                                              Without it the game fetches assets/characters/ next to index.html (served by tools/serve.mjs).
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entry = process.argv.includes('--dev') ? 'src/dev.js' : 'src/main.js';
const minify = !process.argv.includes('--no-min');
const outArg = process.argv.find((a) => a.startsWith('--out=')), outDir = path.resolve(root, outArg ? outArg.slice(6) : 'dist');
fs.mkdirSync(outDir, { recursive: true });
await esbuild.build({ entryPoints: [path.join(root, entry)], bundle: true, format: 'iife', outfile: path.join(outDir, 'game.js'), minify, sourcemap: false, target: 'es2022', logLevel: 'warning', legalComments: 'none' });
const js = fs.readFileSync(path.join(outDir, 'game.js'), 'utf8').replace(/<\/script/g, '<\\/script');
let tpl = fs.readFileSync(path.join(root, 'src/index.template.html'), 'utf8');

let chars = '', embedded = '';
const emb = process.argv.find((a) => a === '--embed-characters' || a.startsWith('--embed-characters='));
if (emb) {
  const dir = path.resolve(root, emb.includes('=') ? emb.split('=')[1] : 'assets/characters');
  const manifestPath = path.join(dir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) { console.error(`--embed-characters: ${manifestPath} not found`); process.exit(1); }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const files = { 'manifest.json': fs.readFileSync(manifestPath) };
  for (const c of manifest.characters || []) for (const name of [c.file, c.crowd].filter(Boolean)) {
    const f = path.join(dir, name);
    if (!fs.existsSync(f)) { console.error(`--embed-characters: ${name} listed in the manifest but missing in ${dir}`); process.exit(1); }
    files[name] = fs.readFileSync(f);
  }
  const obj = {}; let bytes = 0;
  for (const [k, v] of Object.entries(files)) { obj[k] = v.toString('base64'); bytes += v.length; }
  if (bytes > 100 * 1048576) console.warn(`warning: ${(bytes / 1048576).toFixed(0)} MB of characters in one HTML file — consider serving assets/characters/ instead (npm run serve)`);
  chars = 'window.__NH_CHARS=' + JSON.stringify(obj) + ';';
  embedded = `, ${Object.keys(files).length - 1} character file(s) embedded (${(bytes / 1048576).toFixed(1)} MB)`;
}
tpl = tpl.replace('/*__CHARS__*/', () => chars);
fs.writeFileSync(path.join(outDir, 'index.html'), tpl.replace('/*__GAME__*/', () => js));
console.log('built', entry, (js.length / 1024).toFixed(0) + ' KB' + embedded);
