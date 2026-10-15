// Tiny static server (npm run serve -> http://localhost:8080).  Serves dist/ plus two side folders that are not part of the single-file build:
//   /assets/    -> ../assets/          local character files (assets/characters/manifest.json + *.glb — see assets/characters/README.md)
//   /fixtures/  -> ../tests/fixtures/  stand-in test rigs used by tests/integration.mjs
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../dist');
const side = { '/assets/': path.resolve(here, '../assets'), '/fixtures/': path.resolve(here, '../tests/fixtures') };
const port = +process.env.PORT || 8080;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.mp4': 'video/mp4', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ktx2': 'image/ktx2' };
export function serve(p = port) {
  return new Promise((res) => {
    const s = http.createServer((q, r) => {
      const url = decodeURIComponent(q.url.split('?')[0]);
      r.setHeader('access-control-allow-origin', '*');
      const mount = Object.keys(side).find((m) => url.startsWith(m));
      if (mount) {                                         // side folders answer 404 for anything missing (the game probes assets/characters/manifest.json)
        const dir = side[mount], f = path.join(dir, url.slice(mount.length));
        if (url === '/assets/characters/manifest.json' && !fs.existsSync(f)) { r.setHeader('content-type', 'application/json'); r.end('{"characters":[]}'); return; }     // no local characters: an empty list, not a console 404
        if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.statusCode = 404; r.end('not found'); return; }
        r.setHeader('content-type', types[path.extname(f)] || 'application/octet-stream');
        fs.createReadStream(f).pipe(r); return;
      }
      let f = path.join(root, url);
      if (f.endsWith(path.sep)) f += 'index.html';
      if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(root, 'index.html');
      r.setHeader('content-type', types[path.extname(f)] || 'application/octet-stream');
      fs.createReadStream(f).pipe(r);
    }).listen(p, () => res(s));
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) { await serve(); console.log('Nyghtshade Hollow: http://localhost:' + port); }
