// Builds docs/TESTING.md from the machine-readable reports written by the test suites.
//   node tools/report.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const docs = path.join(here, '../docs');
const read = (f) => { try { return JSON.parse(fs.readFileSync(path.join(docs, f), 'utf8')); } catch (e) { return null; } };
const unit = read('unit-report.json'), bot = read('test-report.json'), integ = read('integration-report.json');
const tick = (ok) => (ok ? '✔' : '✖');
let md = `# Test report\n\nGenerated ${new Date().toISOString().slice(0, 10)} by \`node tools/report.mjs\` from \`docs/*-report.json\`.\nRun everything with \`npm test\` (unit → bot routes → integration).\n\n`;
const row = (a, b, c) => `| ${a} | ${b} | ${c} |\n`;
md += '| Suite | Result | Notes |\n|---|---|---|\n';
if (unit) md += row('Unit (Node)', `${tick(!unit.fail)} ${unit.pass}/${unit.pass + unit.fail}`, 'routine, economy, reputation, survival, alert, inventory, dialogue graph');
if (bot) for (const r of bot.routes) { const n = r.results.length, p = r.results.filter((x) => x.ok).length; md += row(`Bot route \`${r.route}\``, `${tick(p === n && r.finished)} ${p}/${n}`, `sim ${r.simTime.toFixed(0)} s · stuck ${r.stuck} · end mode \`${r.mode}\``); }
if (integ) md += row('Integration (Chromium)', `${tick(!integ.fail)} ${integ.pass}/${integ.pass + integ.fail}`, 'save/load, nav graph, door policy, restricted areas, determinism');
md += '\n';
if (unit) { md += '## Unit tests\n\n'; for (const r of unit.results) md += `- ${tick(r.ok)} ${r.name}${r.ok ? '' : ' — ' + r.error}\n`; md += '\n'; }
if (integ) { md += '## Integration tests\n\n'; for (const r of integ.results) md += `- ${tick(r.ok)} ${r.name}\n`; md += '\n'; }
if (bot) {
  md += '## Bot routes — assertions\n\nThe bot plays through the real input layer at a fixed 60 Hz; each line is an assertion evaluated live (time = simulated seconds).\n\n';
  for (const r of bot.routes) {
    md += `### \`${r.route}\`\n\n| t (s) | clock | assertion |\n|---|---|---|\n`;
    for (const c of r.results) md += `| ${c.t} | ${c.hour} | ${tick(c.ok)} ${c.name}${c.detail ? ' — ' + String(c.detail).replace(/\|/g, '/') : ''} |\n`;
    md += '\n';
  }
}
fs.writeFileSync(path.join(docs, 'TESTING.md'), md);
console.log('docs/TESTING.md written');
