// Tiny static server for dist/ (npm run serve -> http://localhost:8080)
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const port = +process.env.PORT || 8080;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.mp4': 'video/mp4' };
export function serve(p = port) {
  return new Promise((res) => {
    const s = http.createServer((q, r) => {
      let f = path.join(root, decodeURIComponent(q.url.split('?')[0]));
      if (f.endsWith(path.sep)) f += 'index.html';
      if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(root, 'index.html');
      r.setHeader('content-type', types[path.extname(f)] || 'application/octet-stream');
      fs.createReadStream(f).pipe(r);
    }).listen(p, () => res(s));
  });
}
if (import.meta.url === `file://${process.argv[1]}`) { await serve(); console.log('Nyghtshade Hollow: http://localhost:' + port); }
