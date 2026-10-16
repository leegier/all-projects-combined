#!/usr/bin/env node
// Pulls files out of Google Drive through the Drive REST API with HTTP Range requests, no dependencies (Node 18+):
// list a folder, read a zip's table of contents (only the central directory travels — a few KB), extract single entries of a remote zip
// without downloading the rest of it, download a whole file in resumable parallel chunks, split / join big files for piecewise transfer.
// It exists because the Drive connector of the cloud session cannot move files above ~5 MB, while a read-only access token can.
//
//   export GDRIVE_TOKEN=ya29....       an OAuth access token with the drive.readonly scope (or GDRIVE_TOKEN_FILE=path). It is sent only in the
//                                      Authorization header and is never printed or written anywhere; it expires after about an hour.
//   node drive-pull.mjs whoami
//   node drive-pull.mjs list <folderId> [--recursive]
//   node drive-pull.mjs info <fileId>
//   node drive-pull.mjs toc <fileId> [--json]                                 table of contents of a zip / .mhpkg (reads the end of the file only)
//   node drive-pull.mjs extract <fileId> <outDir> (--match REGEX | --names a,b | --all) [--max-mb N] [--dry]
//   node drive-pull.mjs get <fileId> <outFile> [--range A-B] [--chunk-mb 16] [--jobs 4]      resumable: run it again after an interruption
//   node drive-pull.mjs split <file> <outDir> [--mb 45]                       NAME.part001 … + NAME.parts.json (sha256 of every part)
//   node drive-pull.mjs join <outDir/NAME.parts.json> <outFile>               verifies every part, then the whole
// Exit codes: 0 ok · 1 error · 2 the token was rejected (expired / revoked / wrong scope: make a new one and run the same command again).
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import tls from 'node:tls';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';
import { pathToFileURL } from 'node:url';

const MiB = 1048576;
const API = (process.env.GDRIVE_API || 'https://www.googleapis.com').replace(/\/$/, '');
const FOLDER = 'application/vnd.google-apps.folder';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let TOKEN = '';

class TokenError extends Error {}
const redact = (s) => (TOKEN ? String(s).split(TOKEN).join('<token>') : String(s));
const fail = (msg, code = 1) => { console.error('error: ' + redact(msg)); process.exit(code); };

// ---- HTTP (node:https, honours HTTPS_PROXY by tunnelling with CONNECT; no_proxy for local test servers) ------------------------------------
const agents = new Map();
function bypassProxy(host) {
  const np = (process.env.NO_PROXY || process.env.no_proxy || '').split(',').map((s) => s.trim()).filter(Boolean);
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || np.some((p) => p === '*' || host === p.replace(/^\./, '') || host.endsWith(p.startsWith('.') ? p : '.' + p));
}
function agentFor(u) {
  const proxy = u.protocol === 'https:' ? process.env.HTTPS_PROXY || process.env.https_proxy : '';
  const key = u.protocol + (proxy && !bypassProxy(u.hostname) ? proxy : '');
  if (agents.has(key)) return agents.get(key);
  let agent;
  if (u.protocol === 'http:') agent = new http.Agent({ keepAlive: true, maxSockets: 16 });
  else if (!proxy || bypassProxy(u.hostname)) agent = new https.Agent({ keepAlive: true, maxSockets: 16 });
  else {
    const p = new URL(proxy);
    const auth = p.username ? 'Basic ' + Buffer.from(`${decodeURIComponent(p.username)}:${decodeURIComponent(p.password)}`).toString('base64') : '';
    agent = new https.Agent({ keepAlive: true, maxSockets: 16 });
    agent.createConnection = (opts, cb) => {
      const target = `${opts.host}:${opts.port || 443}`;
      const req = http.request({ host: p.hostname, port: p.port || 80, method: 'CONNECT', path: target, headers: { Host: target, ...(auth ? { 'Proxy-Authorization': auth } : {}) } });
      req.once('connect', (res, socket) => {
        if (res.statusCode !== 200) { socket.destroy(); return cb(new Error(`proxy refused CONNECT ${opts.host} (${res.statusCode})`)); }
        const s = tls.connect({ socket, servername: opts.servername || opts.host, ALPNProtocols: ['http/1.1'] });
        s.once('secureConnect', () => cb(null, s)); s.once('error', cb);
      });
      req.once('error', cb); req.end();
    };
  }
  agents.set(key, agent);
  return agent;
}
function request(url, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = (u.protocol === 'https:' ? https : http).request(u, { method: 'GET', headers, agent: agentFor(u), timeout: 90000 }, resolve);
    req.on('timeout', () => req.destroy(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })));
    req.on('error', reject); req.end();
  });
}
const readAll = (res) => new Promise((resolve, reject) => {
  const c = [];
  res.on('data', (d) => c.push(d));
  res.on('end', () => resolve(Buffer.concat(c)));
  res.on('error', reject);
  res.on('aborted', () => reject(Object.assign(new Error('aborted'), { code: 'ECONNRESET' })));
  res.on('close', () => { if (!res.complete) reject(Object.assign(new Error('connection closed early'), { code: 'ECONNRESET' })); });
});

const MAX_TRIES = 7;
const backoff = (n) => Math.min(30000, 600 * 2 ** (n - 1)) * (0.75 + Math.random() * 0.5);
function apiError(body) { try { const e = JSON.parse(body.toString()).error || {}; return { message: e.message || body.toString().slice(0, 200), reason: (e.errors && e.errors[0] && e.errors[0].reason) || e.status || '' }; } catch (e) { return { message: body.toString().slice(0, 200), reason: '' }; } }

// One Drive request with retries: network errors, 429, 5xx and rate-limit 403s are retried with exponential backoff; 401 is fatal (TokenError).
async function drive(urlPath, { range = null, label = urlPath.split('?')[0] } = {}) {
  for (let attempt = 1; ; attempt++) {
    let res, body;
    try {
      res = await request(API + urlPath, { Authorization: 'Bearer ' + TOKEN, 'Accept-Encoding': 'identity', ...(range ? { Range: `bytes=${range[0]}-${range[1]}` } : {}) });
      if (range && res.statusCode === 200 && +res.headers['content-length'] > range[1] - range[0] + 1) { res.destroy(); throw new Error('the server ignored the Range header (would download the whole file for every chunk)'); }
      body = await readAll(res);
    } catch (e) {
      if (/ignored the Range/.test(e.message) || attempt >= MAX_TRIES) throw new Error(`${label}: ${e.code || e.message}`);
      await sleep(backoff(attempt)); continue;
    }
    const st = res.statusCode;
    if (st === 200 || st === 206) return { status: st, headers: res.headers, body };
    const err = apiError(body);
    if (st === 401) throw new TokenError('the access token was rejected (expired after ~1 h, revoked, or missing the drive.readonly scope) — create a new one and run the same command again; downloads resume where they stopped');
    const limited = st === 429 || st >= 500 || (st === 403 && /rate|limit|quota exceeded/i.test(err.reason + ' ' + err.message) && !/download/i.test(err.reason));
    if (limited && attempt < MAX_TRIES) { await sleep(backoff(attempt)); continue; }
    if (st === 403 && /abus|malware/i.test(err.message)) throw new Error(`${label}: Drive flags this file (${err.message}); re-run with --acknowledge-abuse if you trust it`);
    if (st === 404) throw new Error(`${label}: not found, or this account has no access to it`);
    if (st === 416) throw new Error(`${label}: range ${range && range.join('-')} is outside the file`);
    throw new Error(`${label}: HTTP ${st} ${err.reason ? '(' + err.reason + ') ' : ''}${err.message}`);
  }
}
const enc = encodeURIComponent;
const mediaPath = (id) => `/drive/v3/files/${enc(id)}?alt=media&supportsAllDrives=true${OPT['acknowledge-abuse'] ? '&acknowledgeAbuse=true' : ''}`;
async function meta(id) { return JSON.parse((await drive(`/drive/v3/files/${enc(id)}?fields=${enc('id,name,size,mimeType,md5Checksum,modifiedTime,trashed')}&supportsAllDrives=true`, { label: 'metadata ' + id })).body.toString()); }
const rangeRead = async (id, a, b) => (await drive(mediaPath(id), { range: [a, b], label: `bytes ${a}-${b} of ${id}` })).body;
async function* rangeStream(id, a, b, chunk) { for (let p = a; p <= b; p += chunk) yield await rangeRead(id, p, Math.min(b, p + chunk - 1)); }

// ---- zip: central directory of a remote archive ------------------------------------------------------------------------------------------
/** Parses the end of a zip (EOCD, ZIP64 locator + record) and its central directory. `read(a, b)` returns bytes a..b inclusive. */
export async function readZipToc(size, read) {
  const tailLen = Math.min(size, 65557 + 20 + 56 + 4096), tailStart = size - tailLen;
  const tail = await read(tailStart, size - 1);
  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i--) if (tail.readUInt32LE(i) === 0x06054b50 && i + 22 + tail.readUInt16LE(i + 20) === tail.length) { eocd = i; break; }
  if (eocd < 0) throw new Error('not a zip file (no end-of-central-directory record in the last 64 KB)');
  let entries = tail.readUInt16LE(eocd + 10), cdSize = tail.readUInt32LE(eocd + 12), cdOff = tail.readUInt32LE(eocd + 16), cdEnd = tailStart + eocd, zip64 = false;
  if (entries === 0xffff || cdSize === 0xffffffff || cdOff === 0xffffffff) {
    const loc = eocd - 20;
    if (loc < 0 || tail.readUInt32LE(loc) !== 0x07064b50) throw new Error('zip64 archive without a zip64 locator');
    const near = loc - 56;                                                                 // the record normally sits right before its locator (the stored offset is wrong in prefixed archives)
    let rec, at;
    if (near >= 0 && tail.readUInt32LE(near) === 0x06064b50) { rec = tail.subarray(near, near + 56); at = tailStart + near; }
    else { at = Number(tail.readBigUInt64LE(loc + 8)); rec = at >= tailStart ? tail.subarray(at - tailStart, at - tailStart + 56) : await read(at, at + 55); }
    if (rec.length < 56 || rec.readUInt32LE(0) !== 0x06064b50) throw new Error('bad zip64 end-of-central-directory record');
    entries = Number(rec.readBigUInt64LE(32)); cdSize = Number(rec.readBigUInt64LE(40)); cdOff = Number(rec.readBigUInt64LE(48)); cdEnd = at; zip64 = true;
  }
  const prefix = Math.max(0, cdEnd - (cdOff + cdSize));                                    // bytes before the archive (self-extractors); offsets are relative to its start
  const cdA = cdOff + prefix, cdB = cdA + cdSize - 1, parts = [];
  for (let p = cdA; p <= cdB; p += 16 * MiB) parts.push(await read(p, Math.min(cdB, p + 16 * MiB - 1)));
  const cd = Buffer.concat(parts), list = [];
  for (let p = 0; p + 46 <= cd.length && cd.readUInt32LE(p) === 0x02014b50;) {
    const flags = cd.readUInt16LE(p + 8), method = cd.readUInt16LE(p + 10), crc = cd.readUInt32LE(p + 16);
    let csize = cd.readUInt32LE(p + 20), usize = cd.readUInt32LE(p + 24), lho = cd.readUInt32LE(p + 42);
    const n = cd.readUInt16LE(p + 28), m = cd.readUInt16LE(p + 30), k = cd.readUInt16LE(p + 32);
    const name = cd.toString(flags & 0x800 ? 'utf8' : 'latin1', p + 46, p + 46 + n);
    for (let q = p + 46 + n, e = q + m; q + 4 <= e; q += 4 + cd.readUInt16LE(q + 2)) {
      if (cd.readUInt16LE(q) !== 1) continue;                                              // zip64 extended information: only the fields that overflowed, in this order
      let r = q + 4;
      if (usize === 0xffffffff) { usize = Number(cd.readBigUInt64LE(r)); r += 8; }
      if (csize === 0xffffffff) { csize = Number(cd.readBigUInt64LE(r)); r += 8; }
      if (lho === 0xffffffff) { lho = Number(cd.readBigUInt64LE(r)); r += 8; }
    }
    list.push({ name, flags, method, crc, csize, usize, offset: lho + prefix, dir: name.endsWith('/') });
    p += 46 + n + m + k;
  }
  if (list.length !== entries) throw new Error(`the central directory lists ${list.length} entries but the archive says ${entries}`);
  return { entries: list, zip64, cdSize, cdOffset: cdOff + prefix };
}

// ---- crc32 ---------------------------------------------------------------------------------------------------------------------------
const crcTable = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = zlib.crc32 || ((buf, prev = 0) => { let c = ~prev >>> 0; for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 255] ^ (c >>> 8); return ~c >>> 0; });

function safeJoin(dir, name) {
  const clean = name.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!clean || clean.split('/').some((s) => s === '..')) throw new Error(`unsafe path in archive: ${name}`);
  const full = path.resolve(dir, clean);
  if (!full.startsWith(path.resolve(dir) + path.sep)) throw new Error(`unsafe path in archive: ${name}`);
  return full;
}
async function extractEntry(id, e, outPath, chunk) {
  if (e.flags & 1) throw new Error(`${e.name}: encrypted entries are not supported`);
  await fsp.mkdir(path.dirname(outPath), { recursive: true });
  const tmp = outPath + '.part';
  let crc = 0, written = 0;
  if (e.csize > 0) {
    const lh = await rangeRead(id, e.offset, e.offset + 29);
    if (lh.length < 30 || lh.readUInt32LE(0) !== 0x04034b50) throw new Error(`${e.name}: bad local header at ${e.offset}`);
    const start = e.offset + 30 + lh.readUInt16LE(26) + lh.readUInt16LE(28);
    const stages = [Readable.from(rangeStream(id, start, start + e.csize - 1, chunk))];
    if (e.method === 8) stages.push(zlib.createInflateRaw());
    else if (e.method === 93 && zlib.createZstdDecompress) stages.push(zlib.createZstdDecompress());
    else if (e.method !== 0) throw new Error(`${e.name}: compression method ${e.method} is not supported here — use "get" and a full unzip tool`);
    stages.push(new Transform({ transform(buf, _, cb) { crc = crc32(buf, crc); written += buf.length; cb(null, buf); } }), fs.createWriteStream(tmp));
    try { await pipeline(...stages); } catch (err) { await fsp.rm(tmp, { force: true }); throw err; }
  } else await fsp.writeFile(tmp, '');
  if (written !== e.usize || crc !== e.crc) { await fsp.rm(tmp, { force: true }); throw new Error(`${e.name}: integrity check failed (size ${written}/${e.usize}, crc ${crc.toString(16)}/${e.crc.toString(16)})`); }
  await fsp.rename(tmp, outPath);
}

// ---- download in resumable chunks --------------------------------------------------------------------------------------------------------
async function download(id, out, { range = null, chunk = 16 * MiB, jobs = 4, md5 = true, quiet = false } = {}) {
  const m = await meta(id), size = +m.size;
  if (!Number.isFinite(size)) throw new Error(`${m.name}: no size (a Google Docs file? only binary files can be downloaded)`);
  const a = range ? range[0] : 0, b = range ? Math.min(range[1], size - 1) : size - 1, total = b - a + 1;
  const stateFile = out + '.dp.json', n = Math.ceil(total / chunk);
  let done = new Set();
  try { const s = JSON.parse(await fsp.readFile(stateFile, 'utf8')); if (s.id === id && s.size === size && s.a === a && s.b === b && s.chunk === chunk && fs.existsSync(out)) done = new Set(s.done); } catch (e) { /* fresh start */ }
  await fsp.mkdir(path.dirname(path.resolve(out)), { recursive: true });
  const fd = await fsp.open(out, done.size ? 'r+' : 'w');
  await fd.truncate(total);
  let bytes = [...done].reduce((s, i) => s + Math.min(chunk, total - i * chunk), 0), next = 0, lastLog = 0;
  const t0 = Date.now(), base = bytes;
  let saving = Promise.resolve();                                                          // state writes are serialised so the file is never torn
  const save = () => (saving = saving.then(() => fsp.writeFile(stateFile, JSON.stringify({ id, size, a, b, chunk, done: [...done] }))));
  const log = (force) => {
    if (quiet || (!force && Date.now() - lastLog < 3000)) return; lastLog = Date.now();
    const rate = (bytes - base) / Math.max(1, (Date.now() - t0) / 1000);
    console.log(`  ${m.name}: ${(bytes / MiB).toFixed(0)} / ${(total / MiB).toFixed(0)} MB  ${(rate / MiB).toFixed(1)} MB/s${rate > 0 && bytes < total ? '  ETA ' + Math.round((total - bytes) / rate) + ' s' : ''}`);
  };
  let failure = null;
  const worker = async () => {
    for (;;) {
      if (failure) return;
      while (next < n && done.has(next)) next++;
      if (next >= n) return;
      const i = next++, from = a + i * chunk, to = Math.min(b, from + chunk - 1);
      try {
        const buf = await rangeRead(id, from, to);
        if (buf.length !== to - from + 1) throw new Error(`short read at ${from} (${buf.length} of ${to - from + 1} bytes)`);
        await fd.write(buf, 0, buf.length, from - a);
        done.add(i); bytes += buf.length; await save(); log(false);
      } catch (e) { failure = failure || e; return; }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(jobs, n)) }, worker));
  await saving; await fd.close();
  if (failure) throw failure;
  log(true);
  if (md5 && !range && m.md5Checksum) {
    const h = crypto.createHash('md5'); await pipeline(fs.createReadStream(out), h);
    if (h.digest('hex') !== m.md5Checksum) throw new Error(`${m.name}: md5 differs from Drive's (${m.md5Checksum}) — delete ${out} and ${stateFile} and run it again`);
  }
  await fsp.rm(stateFile, { force: true });
  return { name: m.name, size: total, md5: m.md5Checksum || null };
}

// ---- split / join (piecewise transfer into a repo) ------------------------------------------------------------------------------------------
async function sha256File(f) { const h = crypto.createHash('sha256'); await pipeline(fs.createReadStream(f), h); return h.digest('hex'); }
async function splitFile(file, dir, mb) {
  const size = fs.statSync(file).size, part = Math.max(1, Math.floor(mb * MiB)), name = path.basename(file), parts = [];
  await fsp.mkdir(dir, { recursive: true });
  const whole = crypto.createHash('sha256');
  const fd = await fsp.open(file, 'r');
  for (let i = 0, off = 0; off < size; i++, off += part) {
    const len = Math.min(part, size - off), buf = Buffer.alloc(len);
    await fd.read(buf, 0, len, off);
    const f = `${name}.part${String(i + 1).padStart(3, '0')}`;
    await fsp.writeFile(path.join(dir, f), buf); whole.update(buf);
    parts.push({ file: f, size: len, sha256: crypto.createHash('sha256').update(buf).digest('hex') });
  }
  await fd.close();
  const manifest = { name, size, sha256: whole.digest('hex'), parts };
  await fsp.writeFile(path.join(dir, `${name}.parts.json`), JSON.stringify(manifest, null, 1));
  return manifest;
}
async function joinFiles(manifestPath, out) {
  const man = JSON.parse(await fsp.readFile(manifestPath, 'utf8')), dir = path.dirname(manifestPath), whole = crypto.createHash('sha256');
  await fsp.mkdir(path.dirname(path.resolve(out)), { recursive: true });
  const ws = fs.createWriteStream(out);
  for (const p of man.parts) {
    const buf = await fsp.readFile(path.join(dir, p.file));
    if (buf.length !== p.size || crypto.createHash('sha256').update(buf).digest('hex') !== p.sha256) { ws.destroy(); throw new Error(`${p.file}: damaged or incomplete (sha256 / size differ from the manifest)`); }
    whole.update(buf); if (!ws.write(buf)) await new Promise((r) => ws.once('drain', r));
  }
  await new Promise((r) => ws.end(r));
  if (whole.digest('hex') !== man.sha256) throw new Error('the joined file does not match the manifest');
  return man;
}

// ---- CLI -----------------------------------------------------------------------------------------------------------------------------------
const OPT = {}, FLAGS = new Set(['recursive', 'json', 'all', 'dry', 'acknowledge-abuse']);
function parseArgs(argv) {
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) { const k = argv[i].slice(2), next = argv[i + 1]; if (FLAGS.has(k) || next === undefined || next.startsWith('--')) OPT[k] = true; else { OPT[k] = next; i++; } } else pos.push(argv[i]);
  }
  return pos;
}
function loadToken() {
  let t = process.env.GDRIVE_TOKEN;
  if (!t && process.env.GDRIVE_TOKEN_FILE) { try { t = fs.readFileSync(process.env.GDRIVE_TOKEN_FILE, 'utf8'); } catch (e) { fail(`cannot read GDRIVE_TOKEN_FILE (${e.code})`); } }
  t = (t || '').trim().replace(/^Bearer\s+/i, '');
  if (!t) fail('no token: set GDRIVE_TOKEN (an OAuth access token with the drive.readonly scope) or GDRIVE_TOKEN_FILE');
  return t;
}
const fmtMB = (n) => (n / MiB).toFixed(n < 10 * MiB ? 2 : 1).padStart(9);
async function walk(id, prefix, recursive, out) {
  let pageToken = '';
  do {
    const q = `'${id}' in parents and trashed = false`;
    const r = JSON.parse((await drive(`/drive/v3/files?q=${enc(q)}&pageSize=1000&fields=${enc('nextPageToken,files(id,name,mimeType,size,md5Checksum,modifiedTime)')}&supportsAllDrives=true&includeItemsFromAllDrives=true&orderBy=name${pageToken ? '&pageToken=' + enc(pageToken) : ''}`, { label: 'list ' + id })).body.toString());
    for (const f of r.files || []) { out.push({ ...f, path: prefix + f.name }); if (recursive && f.mimeType === FOLDER) await walk(f.id, prefix + f.name + '/', true, out); }
    pageToken = r.nextPageToken || '';
  } while (pageToken);
  return out;
}
async function remoteToc(id) { const m = await meta(id), size = +m.size; return { meta: m, ...(await readZipToc(size, (a, b) => rangeRead(id, a, b))) }; }

async function main(argv) {
  const [cmd, ...rest] = argv, pos = parseArgs(rest);
  if (!cmd || cmd === 'help' || cmd === '--help') {
    const head = []; for (const l of fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n')) { if (l.startsWith('#!')) continue; if (!l.startsWith('//')) break; head.push(l.slice(3)); }
    console.log(head.join('\n')); return;
  }
  if (cmd === 'split') { const [f, d] = pos; if (!f || !d) fail('usage: split <file> <outDir> [--mb 45]'); const m = await splitFile(f, d, +OPT.mb || 45); console.log(`${m.parts.length} part(s) of ≤ ${+OPT.mb || 45} MB in ${d}  (${m.name}.parts.json lists their sha256)`); return; }
  if (cmd === 'join') { const [mf, o] = pos; if (!mf || !o) fail('usage: join <NAME.parts.json> <outFile>'); const m = await joinFiles(mf, o); console.log(`${m.name}: ${m.parts.length} part(s) verified and joined → ${o}`); return; }
  TOKEN = loadToken();
  if (cmd === 'whoami') {
    const r = JSON.parse((await drive('/drive/v3/about?fields=user(displayName)', { label: 'about' })).body.toString());
    console.log(`token accepted for ${r.user && r.user.displayName ? r.user.displayName : 'the Drive account'}`); return;
  }
  if (cmd === 'info') { if (!pos[0]) fail('usage: info <fileId>'); const m = await meta(pos[0]); console.log(JSON.stringify(m, null, 1)); return; }
  if (cmd === 'list') {
    if (!pos[0]) fail('usage: list <folderId> [--recursive]');
    const files = await walk(pos[0], '', !!OPT.recursive, []);
    if (OPT.json) { console.log(JSON.stringify(files, null, 1)); return; }
    for (const f of files) console.log(`${f.id}  ${f.size ? fmtMB(+f.size) + ' MB' : '        —   '}  ${f.mimeType === FOLDER ? 'DIR ' : '    '}${f.path}`);
    console.log(`${files.length} item(s)`); return;
  }
  if (cmd === 'toc') {
    if (!pos[0]) fail('usage: toc <fileId> [--json]');
    const t = await remoteToc(pos[0]);
    if (OPT.json) { console.log(JSON.stringify({ file: t.meta.name, size: +t.meta.size, zip64: t.zip64, entries: t.entries.map(({ name, method, csize, usize, crc }) => ({ name, method, csize, usize, crc })) }, null, 1)); return; }
    console.log(`# ${t.meta.name}  ${(t.meta.size / MiB).toFixed(1)} MB  ${t.entries.length} entries${t.zip64 ? '  (zip64)' : ''}  central directory ${(t.cdSize / 1024).toFixed(0)} KB`);
    console.log('#   size MB   packed MB  method  name');
    for (const e of t.entries) console.log(`${fmtMB(e.usize)} ${fmtMB(e.csize)}  ${String(e.method).padStart(6)}  ${e.name}`);
    console.log(`# total ${(t.entries.reduce((s, e) => s + e.usize, 0) / MiB).toFixed(1)} MB unpacked`); return;
  }
  if (cmd === 'extract') {
    const [id, dir] = pos; if (!id || !dir) fail('usage: extract <fileId> <outDir> (--match REGEX | --names a,b | --all) [--max-mb N] [--dry]');
    if (!OPT.match && !OPT.names && !OPT.all) fail('say what to extract: --match REGEX, --names a,b or --all (use "toc" first)');
    const t = await remoteToc(id), re = OPT.match && OPT.match !== true ? new RegExp(OPT.match, 'i') : null, names = OPT.names && OPT.names !== true ? new Set(String(OPT.names).split(',')) : null;
    const max = OPT['max-mb'] ? +OPT['max-mb'] * MiB : Infinity;
    const pick = t.entries.filter((e) => !e.dir && (OPT.all || (re && re.test(e.name)) || (names && names.has(e.name))));
    const skipped = pick.filter((e) => e.usize > max), todo = pick.filter((e) => e.usize <= max);
    console.log(`${t.meta.name}: ${todo.length} of ${t.entries.length} entries selected (${(todo.reduce((s, e) => s + e.usize, 0) / MiB).toFixed(1)} MB unpacked, ${(todo.reduce((s, e) => s + e.csize, 0) / MiB).toFixed(1)} MB to download)${skipped.length ? `, ${skipped.length} skipped for size: ${skipped.map((e) => e.name).join(', ')}` : ''}`);
    if (OPT.dry) { for (const e of todo) console.log('  ' + e.name); return; }
    const chunk = (+OPT['chunk-mb'] || 16) * MiB; let n = 0;
    for (const e of todo) { await extractEntry(id, e, safeJoin(dir, e.name), chunk); console.log(`  ${++n}/${todo.length}  ${e.name}  ${(e.usize / MiB).toFixed(2)} MB  crc ok`); }
    return;
  }
  if (cmd === 'get') {
    const [id, out] = pos; if (!id || !out) fail('usage: get <fileId> <outFile> [--range A-B] [--chunk-mb 16] [--jobs 4]');
    let range = null; if (OPT.range) { const mm = /^(\d+)-(\d+)$/.exec(OPT.range); if (!mm) fail('--range A-B (byte offsets, inclusive)'); range = [+mm[1], +mm[2]]; }
    const r = await download(id, out, { range, chunk: (+OPT['chunk-mb'] || 16) * MiB, jobs: +OPT.jobs || 4 });
    console.log(`${r.name}: ${(r.size / MiB).toFixed(1)} MB → ${out}${r.md5 && !range ? '  (md5 verified)' : ''}`); return;
  }
  fail(`unknown command "${cmd}" — run with "help"`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((e) => { console.error('error: ' + redact(e.message || e)); process.exit(e instanceof TokenError ? 2 : 1); });
}
export { extractEntry, download, splitFile, joinFiles, crc32 };
