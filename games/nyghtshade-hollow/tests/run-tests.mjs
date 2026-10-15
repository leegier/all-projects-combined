// End-to-end test: boots the real game in headless Chromium and lets the playtest bot play the whole slice.
// Usage: node tests/run-tests.mjs [route=shim|keycard|bribe|alarm|all] [--render]
import { open } from '../tools/lib.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const arg = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'all';
const routes = arg === 'all' ? ['shim', 'keycard', 'bribe', 'alarm'] : [arg];
const report = [];
let failed = 0;
for (const route of routes) {
  console.log(`\n=== route: ${route} ===`);
  const t = await open({ query: `bot=${route}&manual&q=low&hurry`, log: true });
  const { page } = t;
  const t0 = Date.now();
  let steps = 0;
  const MAX = 60 * 60 * 25; // 25 sim-minutes
  while (steps < MAX) {
    let fin;
    try { fin = await page.evaluate(() => { NH_BOT.advance(600); return NH_BOT.finished; }); } catch (e) { console.log('EXCEPTION:', e.message.split('\n').slice(0, 6).join(' | ')); console.log((await page.evaluate(() => NH_BOT.log.slice(-8).map((l) => l.t.toFixed(1) + ' ' + l.msg))).join('\n')); break; }
    steps += 600;
    if (fin) break;
  }
  const res = await page.evaluate(() => ({ results: NH_BOT.results, log: NH_BOT.log.map((l) => `${l.t.toFixed(1)}s ${l.msg}`), stuck: NH_BOT.stuckCount, finished: NH_BOT.finished, simTime: NH.simTime, mode: NH.mode, dc: NH.economy.balance, cred: NH.reputation.streetCred, hour: NH.routine.clock, route: NH.route, arrests: NH.stats.arrests, alert: NH.alert.level }));
  const bad = res.results.filter((r) => !r.ok);
  console.log(`route ${route}: ${res.results.length - bad.length}/${res.results.length} checks, finished=${res.finished}, mode=${res.mode}, sim ${res.simTime.toFixed(0)}s, stuck ${res.stuck}, wall ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  for (const b of bad) console.log('  FAIL', b.name, b.detail, '@', b.t + 's', b.hour);
  failed += bad.length + (res.finished ? 0 : 1);
  report.push({ route, ...res });
  await t.close();
}
fs.mkdirSync(path.join(here, '../docs'), { recursive: true });
fs.writeFileSync(path.join(here, '../docs/test-report.json'), JSON.stringify({ generated: new Date().toISOString(), routes: report }, null, 1));
console.log(failed ? `\n${failed} FAILURES` : '\nALL ROUTES PASSED');
process.exit(failed ? 1 : 0);
