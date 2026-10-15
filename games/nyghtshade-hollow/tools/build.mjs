// Bundles src/ into dist/game.js and a single self-contained dist/index.html (works from file://).
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entry = process.argv.includes('--dev') ? 'src/dev.js' : 'src/main.js';
const minify = !process.argv.includes('--no-min');
await esbuild.build({ entryPoints: [path.join(root, entry)], bundle: true, format: 'iife', outfile: path.join(root, 'dist/game.js'), minify, sourcemap: false, target: 'es2022', logLevel: 'warning', legalComments: 'none' });
const js = fs.readFileSync(path.join(root, 'dist/game.js'), 'utf8').replace(/<\/script/g, '<\\/script');
const tpl = fs.readFileSync(path.join(root, 'src/index.template.html'), 'utf8');
fs.writeFileSync(path.join(root, 'dist/index.html'), tpl.replace('/*__GAME__*/', () => js));
console.log('built', entry, (js.length / 1024).toFixed(0) + ' KB');
