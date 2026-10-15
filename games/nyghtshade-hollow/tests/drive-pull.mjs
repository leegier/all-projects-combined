// Tests for tools/metahuman/drive-pull.mjs against a local server that speaks the part of the Drive REST API the tool uses
// (about, files.list, files.get metadata, files.get?alt=media with Range) and can misbehave: 503s, dropped connections, a token that expires mid-download,
// corrupted bytes, a lying md5. The archives are built here (stored + deflated entries, ZIP64 in its three flavours, junk before the archive).
//   node tests/drive-pull.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const tool = path.join(here, '../tools/metahuman/drive-pull.mjs');
let pass = 0, fail = 0; const results = [];
const ok = (name, cond, detail = '') => { cond ? pass++ : fail++; results.push({ name, ok: !!cond, detail }); console.log(cond ? '  ok  ' : '  FAIL', name, cond ? '' : detail); };
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex'), md5 = (b) => crypto.createHash('md5').update(b).digest('hex');

// ---- a zip writer -------------------------------------------------------------------------------------------------------------------------
const u16 = (n) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; }, u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b; }, u64 = (n) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b; };
function makeZip(entries, { zip64 = 'none', junk = 0 } = {}) {
  const chunks = []; let off = 0; const cds = [];
  const push = (b) => { chunks.push(b); off += b.length; };
  const e64 = zip64 === 'entries' || zip64 === 'both', d64 = zip64 === 'eocd' || zip64 === 'both';
  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf8'), raw = e.data, method = e.method ?? 8, packed = method === 8 ? zlib.deflateRawSync(raw) : raw, c = zlib.crc32(raw), lho = off;
    const extra = e64 ? Buffer.concat([u16(1), u16(16), u64(raw.length), u64(packed.length)]) : Buffer.alloc(0);
    push(Buffer.concat([u32(0x04034b50), u16(e64 ? 45 : 20), u16(0x800), u16(method), u16(0), u16(0x21), u32(c), u32(e64 ? 0xffffffff : packed.length), u32(e64 ? 0xffffffff : raw.length), u16(name.length), u16(extra.length), name, extra, packed]));
    cds.push({ name, method, c, csize: packed.length, usize: raw.length, lho });
  }
  const cdStart = off;
  for (const d of cds) {
    const extra = e64 ? Buffer.concat([u16(1), u16(24), u64(d.usize), u64(d.csize), u64(d.lho)]) : Buffer.alloc(0);
    push(Buffer.concat([u32(0x02014b50), u16(45), u16(e64 ? 45 : 20), u16(0x800), u16(d.method), u16(0), u16(0x21), u32(d.c), u32(e64 ? 0xffffffff : d.csize), u32(e64 ? 0xffffffff : d.usize), u16(d.name.length), u16(extra.length), u16(0), u16(0), u16(0), u32(0), u32(e64 ? 0xffffffff : d.lho), d.name, extra]));
  }
  const cdSize = off - cdStart;
  if (d64) { const at = off; push(Buffer.concat([u32(0x06064b50), u64(44), u16(45), u16(45), u32(0), u32(0), u64(cds.length), u64(cds.length), u64(cdSize), u64(cdStart)])); push(Buffer.concat([u32(0x07064b50), u32(0), u64(at), u32(1)])); }
  push(Buffer.concat([u32(0x06054b50), u16(0), u16(0), u16(d64 ? 0xffff : cds.length), u16(d64 ? 0xffff : cds.length), u32(d64 ? 0xffffffff : cdSize), u32(d64 ? 0xffffffff : cdStart), u16(0)]));
  return Buffer.concat([Buffer.alloc(junk, 0x5a), ...chunks]);
}

// ---- fake Drive ---------------------------------------------------------------------------------------------------------------------------
const TOKEN = 'ya29.TEST-TOKEN-' + crypto.randomBytes(12).toString('hex'), files = new Map();
const st = { served: 0, requests: 0, ranges: [], fail503: 0, dropNext: 0, expireAfter: Infinity, corrupt: null, lieMd5: false, token: TOKEN };
const add = (id, name, data, parent = null, mimeType = 'application/octet-stream') => files.set(id, { id, name, data, parent, mimeType });
const json = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  st.requests++;
  if (req.headers.authorization !== 'Bearer ' + st.token || st.requests > st.expireAfter) return json(res, 401, { error: { code: 401, message: 'Invalid Credentials', errors: [{ reason: 'authError' }] } });
  if (u.pathname === '/drive/v3/about') return json(res, 200, { user: { displayName: 'Test Owner' } });
  if (u.pathname === '/drive/v3/files') {
    const parent = /'([^']+)' in parents/.exec(u.searchParams.get('q') || '');
    return json(res, 200, { files: [...files.values()].filter((f) => f.parent === (parent && parent[1])).map((f) => ({ id: f.id, name: f.name, mimeType: f.mimeType, ...(f.data ? { size: String(f.data.length), md5Checksum: md5(f.data) } : {}) })) });
  }
  const m = /^\/drive\/v3\/files\/([^/]+)$/.exec(u.pathname), f = m && files.get(decodeURIComponent(m[1]));
  if (!f) return json(res, 404, { error: { code: 404, message: 'File not found' } });
  if (u.searchParams.get('alt') !== 'media') return json(res, 200, { id: f.id, name: f.name, mimeType: f.mimeType, size: String(f.data.length), md5Checksum: st.lieMd5 ? '0'.repeat(32) : md5(f.data) });
  if (st.fail503 > 0) { st.fail503--; return json(res, 503, { error: { code: 503, message: 'Backend Error' } }); }
  const r = /^bytes=(\d+)-(\d+)$/.exec(req.headers.range || '');
  if (!r) return json(res, 400, { error: { message: 'this test server only answers ranged reads' } });
  const a = +r[1], b = Math.min(+r[2], f.data.length - 1);
  if (a >= f.data.length) return json(res, 416, { error: { code: 416, message: 'Requested range not satisfiable' } });
  let body = f.data.subarray(a, b + 1);
  if (st.corrupt && st.corrupt.id === f.id && a <= st.corrupt.at && st.corrupt.at <= b) { body = Buffer.from(body); body[st.corrupt.at - a] ^= 0xff; }
  st.ranges.push([f.id, a, b]);
  res.writeHead(206, { 'content-range': `bytes ${a}-${b}/${f.data.length}`, 'content-length': body.length, 'content-type': 'application/octet-stream' });
  if (st.dropNext > 0) { st.dropNext--; res.write(body.subarray(0, Math.min(1000, body.length))); setTimeout(() => res.destroy(), 20); return; }
  st.served += body.length; res.end(body);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const reset = (o = {}) => { Object.assign(st, { served: 0, requests: 0, ranges: [], fail503: 0, dropNext: 0, expireAfter: Infinity, corrupt: null, lieMd5: false, token: TOKEN }, o); };

const run = (args, { token = TOKEN, env = {} } = {}) => new Promise((resolve) => {
  const e = { ...process.env, GDRIVE_API: base, GDRIVE_TOKEN_FILE: '', HTTPS_PROXY: '', https_proxy: '', NO_PROXY: '127.0.0.1,localhost', ...env };
  if (token === null) delete e.GDRIVE_TOKEN; else e.GDRIVE_TOKEN = token;
  const p = spawn(process.execPath, [tool, ...args], { env: e });
  let out = '', err = ''; p.stdout.on('data', (d) => { out += d; }); p.stderr.on('data', (d) => { err += d; });
  p.on('close', (code) => resolve({ code, out, err, all: out + err }));
});
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'drive-pull-test-'));
const dir = (n) => path.join(tmp, n);

// ---- fixtures -------------------------------------------------------------------------------------------------------------------------------
const rnd = (n) => crypto.randomBytes(n), text = (n) => Buffer.from('MetaHuman skeletal mesh data / '.repeat(Math.ceil(n / 31)).slice(0, n));
const content = [
  { name: 'Content/Characters/Maria/SK_Maria_Body.uasset', data: rnd(2 * 1048576 + 321), method: 0 },
  { name: 'Content/Characters/Maria/Textures/T_Maria_Skin_BC.png', data: rnd(1500000), method: 0 },
  { name: 'Content/Characters/Maria/Maria.json', data: text(90000), method: 8 },
  { name: 'Content/Characters/Maria/Face/Maria_face.dna', data: Buffer.concat([text(600000), rnd(300000)]), method: 8 },
  { name: 'Content/Ünïcode/héllo wörld.txt', data: text(2000), method: 8 },
  { name: 'Content/empty.bin', data: Buffer.alloc(0), method: 0 },
];
const plain = makeZip(content), z64e = makeZip(content, { zip64: 'entries' }), z64d = makeZip(content, { zip64: 'eocd' }), z64b = makeZip(content, { zip64: 'both', junk: 777 }), junked = makeZip(content, { junk: 1234 });
add('root', 'MetaHuman', null, null, 'application/vnd.google-apps.folder');
add('sub', 'extras', null, 'root', 'application/vnd.google-apps.folder');
add('maria', 'mhc_maria.mhpkg', plain, 'root'); add('z64e', 'z64e.mhpkg', z64e, 'root'); add('z64d', 'z64d.mhpkg', z64d, 'root'); add('z64b', 'z64b.mhpkg', z64b, 'root'); add('junk', 'junk.mhpkg', junked, 'root');
add('note', 'notes.txt', text(5000), 'sub');
const wanted = (n) => content.find((c) => c.name === n).data;

// ---- 1 token handling ------------------------------------------------------------------------------------------------------------------
reset();
let r = await run(['whoami']);
ok('whoami: the token is accepted and the account name is shown', r.code === 0 && /Test Owner/.test(r.out), r.all);
reset(); r = await run(['whoami'], { token: null });
ok('no token: exit 1 with instructions, no network call', r.code === 1 && /GDRIVE_TOKEN/.test(r.err) && st.requests === 0, r.all + ' requests=' + st.requests);
reset(); r = await run(['whoami'], { token: 'ya29.WRONG-TOKEN-xyz' });
ok('wrong / expired token: exit 2 with a clear message, and the token is not echoed', r.code === 2 && /token was rejected/.test(r.err) && !r.all.includes('WRONG-TOKEN'), r.all);
reset(); r = await run(['list', 'root']);
ok('list: folder contents with sizes; the token never appears in any output', r.code === 0 && /mhc_maria\.mhpkg/.test(r.out) && /extras/.test(r.out) && !r.all.includes(TOKEN), r.all);
r = await run(['list', 'root', '--recursive']);
ok('list --recursive descends into sub-folders', /extras\/notes\.txt/.test(r.out), r.out);

// ---- 2 toc reads only the end of the file ----------------------------------------------------------------------------------------------
reset(); r = await run(['toc', 'maria', '--json']);
let toc = null; try { toc = JSON.parse(r.out); } catch (e) { /* reported below */ }
ok('toc: every entry, with its real size, from a few KB of the archive', r.code === 0 && toc && toc.entries.length === content.length && content.every((c) => toc.entries.some((e) => e.name === c.name && e.usize === c.data.length)), r.all.slice(0, 600));
ok(`toc: only the end of a ${(plain.length / 1048576).toFixed(1)} MB archive was transferred (${st.served} bytes served)`, st.served < 100000 && st.served < plain.length * 0.03, `served ${st.served}`);
for (const [id, label, bytes] of [['z64e', 'zip64 entries (64-bit sizes and offsets in the extra field)', z64e], ['z64d', 'zip64 end-of-central-directory record', z64d], ['z64b', 'both zip64 forms and 777 junk bytes before the archive', z64b], ['junk', '1234 junk bytes before a plain archive (self-extractor style)', junked]]) {
  reset(); r = await run(['toc', id, '--json']); let t = null; try { t = JSON.parse(r.out); } catch (e) { /* below */ }
  ok(`toc: ${label}`, r.code === 0 && t && t.entries.length === content.length && content.every((c) => t.entries.some((e) => e.name === c.name && e.usize === c.data.length)) && (id === 'junk' || id === 'z64e' || t.zip64), r.all.slice(0, 500));
  reset(); const o = dir('x-' + id); r = await run(['extract', id, o, '--match', 'Maria\\.json$|Ünïcode']);
  ok(`extract: ${id} — selected entries are byte-identical (crc checked)`, r.code === 0 && fs.readFileSync(path.join(o, 'Content/Characters/Maria/Maria.json')).equals(wanted('Content/Characters/Maria/Maria.json')) && fs.readFileSync(path.join(o, 'Content/Ünïcode/héllo wörld.txt')).equals(wanted('Content/Ünïcode/héllo wörld.txt')), r.all);
}

// ---- 3 selective extraction ------------------------------------------------------------------------------------------------------------
reset(); let out = dir('sel'); r = await run(['extract', 'maria', out, '--match', '\\.dna$|Maria\\.json$']);
const gotDna = fs.existsSync(path.join(out, 'Content/Characters/Maria/Face/Maria_face.dna')) && fs.readFileSync(path.join(out, 'Content/Characters/Maria/Face/Maria_face.dna')).equals(wanted('Content/Characters/Maria/Face/Maria_face.dna'));
ok('extract --match: the DNA and the json come out intact, the 2 MB body and the 1.5 MB texture are not touched', r.code === 0 && gotDna && !fs.existsSync(path.join(out, 'Content/Characters/Maria/SK_Maria_Body.uasset')) && /crc ok/.test(r.out), r.all);
ok(`extract --match: only the selected entries' bytes crossed the wire (${st.served} of ${plain.length})`, st.served < plain.length * 0.5, `served ${st.served}`);
reset(); out = dir('dry'); r = await run(['extract', 'maria', out, '--all', '--dry']);
ok('extract --dry: lists what it would extract and writes nothing', r.code === 0 && !fs.existsSync(out) && /SK_Maria_Body\.uasset/.test(r.out), r.all);
reset(); out = dir('max'); r = await run(['extract', 'maria', out, '--all', '--max-mb', '1']);
ok('extract --max-mb: bigger entries are skipped and named', r.code === 0 && /skipped for size: .*SK_Maria_Body\.uasset/.test(r.out) && fs.existsSync(path.join(out, 'Content/Characters/Maria/Maria.json')) && !fs.existsSync(path.join(out, 'Content/Characters/Maria/SK_Maria_Body.uasset')), r.all);
reset(); out = dir('none'); r = await run(['extract', 'maria', out]);
ok('extract without a selector refuses (no accidental 1 GB download)', r.code === 1 && /--match|--all/.test(r.err) && !fs.existsSync(out), r.all);
reset(); out = dir('all'); r = await run(['extract', 'maria', out, '--all', '--chunk-mb', '1']);
ok('extract --all with 1 MB chunks: every entry byte-identical, including the empty one', r.code === 0 && content.every((c) => fs.readFileSync(path.join(out, c.name)).equals(c.data)), r.all);

// ---- 4 integrity and safety ------------------------------------------------------------------------------------------------------------
reset(); const tocMaria = JSON.parse((await run(['toc', 'maria', '--json'])).out), dnaE = tocMaria.entries.find((e) => /\.dna$/.test(e.name));
const dnaStart = plain.indexOf(Buffer.from(dnaE.name)) + dnaE.name.length + 4;                       // somewhere inside its local header / data
reset({ corrupt: { id: 'maria', at: dnaStart + 40000 } }); out = dir('bad');
r = await run(['extract', 'maria', out, '--match', '\\.dna$']);
ok('extract: a corrupted transfer is detected (crc / inflate), exits 1 and leaves no half-written file', r.code === 1 && /integrity|inflate|invalid|incorrect|crc/i.test(r.err) && !fs.existsSync(path.join(out, dnaE.name)) && !fs.existsSync(path.join(out, dnaE.name + '.part')), r.all);
add('slip', 'slip.zip', makeZip([{ name: '../evil.txt', data: text(100) }, { name: 'ok.txt', data: text(100) }]), 'root');
reset(); out = dir('slip'); r = await run(['extract', 'slip', out, '--all']);
ok('extract: an entry that tries to leave the output folder (zip-slip) is refused', r.code === 1 && /unsafe path/.test(r.err) && !fs.existsSync(path.join(tmp, 'evil.txt')) && !fs.existsSync(path.join(out, '..', 'evil.txt')), r.all);

// ---- 5 get: chunked, verified, resumable ----------------------------------------------------------------------------------------------------
reset(); out = dir('whole.bin'); r = await run(['get', 'maria', out, '--chunk-mb', '1', '--jobs', '3']);
ok(`get: ${(plain.length / 1048576).toFixed(1)} MB in 1 MB chunks, 3 parallel, md5 verified, no state file left`, r.code === 0 && sha(fs.readFileSync(out)) === sha(plain) && /md5 verified/.test(r.out) && !fs.existsSync(out + '.dp.json'), r.all);
reset({ lieMd5: true }); out = dir('lie.bin'); r = await run(['get', 'maria', out, '--chunk-mb', '2']);
ok('get: a download whose md5 differs from Drive\'s is reported, not accepted silently', r.code === 1 && /md5 differs/.test(r.err), r.all);
reset(); out = dir('range.bin'); r = await run(['get', 'maria', out, '--range', '1000-4999']);
ok('get --range: exactly those bytes', r.code === 0 && fs.readFileSync(out).equals(plain.subarray(1000, 5000)), r.all);
const chunks = Math.ceil(plain.length / 262144);                                                       // 0.25 MB chunks: ~16 of them
reset({ expireAfter: 6 }); out = dir('resume.bin'); r = await run(['get', 'maria', out, '--chunk-mb', '0.25', '--jobs', '1']);   // metadata + 5 chunks, then the token "expires"
const firstRun = st.ranges.length, partial = fs.existsSync(out + '.dp.json') ? JSON.parse(fs.readFileSync(out + '.dp.json', 'utf8')).done.length : -1;
ok('get: the token expires mid-download → exit 2, progress is kept', r.code === 2 && /token was rejected/.test(r.err) && partial > 0 && partial < chunks && !r.all.includes(TOKEN), r.all + ` partial=${partial}`);
reset(); r = await run(['get', 'maria', out, '--chunk-mb', '0.25', '--jobs', '1']);
ok(`get: run again with a new token → only the missing chunks are fetched (${st.ranges.length} of ${chunks}), file complete and verified`, r.code === 0 && sha(fs.readFileSync(out)) === sha(plain) && st.ranges.length <= chunks - partial + 1 && /md5 verified/.test(r.out), r.all + ` fetched=${st.ranges.length} partial=${partial} first=${firstRun}`);
reset({ fail503: 2, dropNext: 1 }); out = dir('retry.bin'); r = await run(['get', 'maria', out, '--chunk-mb', '2', '--jobs', '2']);
ok('get: two 503 answers and one dropped connection are retried transparently', r.code === 0 && sha(fs.readFileSync(out)) === sha(plain), r.all);
reset(); r = await run(['get', 'nope', dir('nope.bin')]);
ok('get: an unknown file is a clear error', r.code === 1 && /not found/.test(r.err), r.all);

// ---- 6 split / join -------------------------------------------------------------------------------------------------------------------------
const big = dir('big.glb'); fs.writeFileSync(big, rnd(3 * 1048576 + 17));
r = await run(['split', big, dir('parts'), '--mb', '1.5'], { token: null });
const man = JSON.parse(fs.readFileSync(dir('parts/big.glb.parts.json'), 'utf8'));
ok('split: parts ≤ the size limit, listed with sha256, no token needed', r.code === 0 && man.parts.length === 3 && man.parts.every((p) => p.size <= 1.5 * 1048576) && man.size === fs.statSync(big).size, r.all);
r = await run(['join', dir('parts/big.glb.parts.json'), dir('joined.glb')], { token: null });
ok('join: reassembles the identical file', r.code === 0 && fs.readFileSync(dir('joined.glb')).equals(fs.readFileSync(big)), r.all);
const pf = dir('parts/' + man.parts[1].file); const pb = fs.readFileSync(pf); pb[100] ^= 1; fs.writeFileSync(pf, pb);
r = await run(['join', dir('parts/big.glb.parts.json'), dir('joined2.glb')], { token: null });
ok('join: a damaged part is detected by its sha256', r.code === 1 && /damaged/.test(r.err), r.all);
r = await run(['help'], { token: null });
ok('help prints the usage', r.code === 0 && /Pulls files out of Google Drive/.test(r.out) && /extract <fileId>/.test(r.out), r.all.slice(0, 200));

server.close(); fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
fs.mkdirSync(path.join(here, '../docs'), { recursive: true });
fs.writeFileSync(path.join(here, '../docs/drive-pull-report.json'), JSON.stringify({ generated: new Date().toISOString(), pass, fail, results }, null, 1));
process.exit(fail ? 1 : 0);
