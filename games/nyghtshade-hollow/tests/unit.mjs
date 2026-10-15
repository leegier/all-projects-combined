// Pure-logic unit tests (no browser): routine clock, economy, reputation, survival, alert, inventory, dialogue-script integrity.
//   node tests/unit.mjs          (exit code 1 on any failure)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Routine, SLOT, SCHEDULE } from '../src/systems/routine.js';
import { Economy } from '../src/systems/economy.js';
import { Reputation, FACTIONS } from '../src/systems/reputation.js';
import { Survival } from '../src/systems/survival.js';
import { AlertSystem } from '../src/systems/alert.js';
import { Inventory, ITEMS } from '../src/systems/inventory.js';
import { DIALOGUE } from '../src/story/dialogue.js';

const here = path.dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const results = [];
function test(name, fn) {
  try { fn(); pass++; results.push({ name, ok: true }); console.log('  ok  ', name); }
  catch (e) { fail++; results.push({ name, ok: false, error: String(e.message).split('\n')[0] }); console.log('  FAIL', name, '\n      ', String(e.message).split('\n').slice(0, 3).join('\n       ')); }
}

console.log('routine clock');
test('every hour of the day maps to a schedule entry', () => {
  const r = new Routine();
  for (let h = 0; h < 24; h += 0.25) assert.ok(r._entryFor(h), `no entry at ${h}`);
});
test('slots at canonical hours (06 Count, 07 Chow, 13 Chapel, 22 LightsOut)', () => {
  const r = new Routine();
  for (const [h, slot] of [[6, SLOT.Count], [7.2, SLOT.Chow], [8.5, SLOT.WorkDetail], [10.5, SLOT.Yard], [13.4, SLOT.Chapel], [15.5, SLOT.Gym], [16.5, SLOT.Visitation], [21.5, SLOT.Count], [23, SLOT.LightsOut], [3, SLOT.LightsOut]]) {
    r.hour = h; r._evaluate(true); assert.equal(r.slot, slot, `hour ${h}`);
  }
});
test('door/area policy follows the slot', () => {
  const r = new Routine();
  r.hour = 6.2; r._evaluate(true); assert.ok(r.cellsLocked()); assert.ok(!r.canteenOpen()); assert.ok(!r.mealTime());
  r.hour = 7.2; r._evaluate(true); assert.ok(!r.cellsLocked()); assert.ok(r.canteenOpen()); assert.ok(r.mealTime());
  r.hour = 13.5; r._evaluate(true); assert.ok(r.chapelOpen());
  r.hour = 12.5; r._evaluate(true); assert.ok(!r.chapelOpen());
  r.hour = 9; r._evaluate(true); r.startLockdown(1); assert.ok(r.cellsLocked() && !r.canteenOpen() && !r.corridorsOpen() && !r.chapelOpen());
});
test('slot changes emit slot + pa events (and count at COUNT)', () => {
  const r = new Routine({ secondsPerHour: 10, startHour: 6.9 });
  const ev = []; r.on('slot', (s) => ev.push('slot:' + s)); r.on('pa', (t) => ev.push('pa:' + t.split('.')[0]));
  for (let i = 0; i < 40; i++) r.update(0.1);
  assert.deepEqual(ev, ['slot:Chow', 'pa:CHOW']);
  const r2 = new Routine({ secondsPerHour: 10, startHour: 5.9 }); const c = []; r2.on('count', () => c.push(1));
  for (let i = 0; i < 40; i++) r2.update(0.1); assert.equal(c.length, 1);
});
test('clock advances at secondsPerHour and rolls the day over', () => {
  const r = new Routine({ secondsPerHour: 45, startHour: 23.5 }); const days = []; r.on('newDay', (d) => days.push(d));
  for (let i = 0; i < 45 * 60; i++) r.update(1 / 60);        // 45 simulated seconds = 1 game hour
  assert.ok(Math.abs(r.hour - 0.5) < 0.02, `hour ${r.hour}`); assert.deepEqual(days, [2]);
});
test('time scale (hold T) accelerates the clock', () => {
  const a = new Routine({ secondsPerHour: 45, startHour: 8 }), b = new Routine({ secondsPerHour: 45, startHour: 8 }); b.timeScale = 6;
  for (let i = 0; i < 600; i++) { a.update(1 / 60); b.update(1 / 60); }
  assert.ok(Math.abs((b.hour - 8) / (a.hour - 8) - 6) < 0.01);
});
test('lockdown lifts after its duration', () => {
  const r = new Routine({ secondsPerHour: 10, startHour: 9 }); r.startLockdown(0.5); assert.ok(r.lockdown);
  for (let i = 0; i < 80; i++) r.update(0.1); assert.ok(!r.lockdown);
});
test('serialize/load round trip keeps hour/day and re-evaluates the slot', () => {
  const r = new Routine(); r.hour = 13.3; r.day = 3; r._evaluate(true); const d = r.serialize();
  const r2 = new Routine(); r2.load(d); assert.equal(r2.day, 3); assert.equal(r2.slot, SLOT.Chapel);
});
test('schedule entries do not overlap', () => {
  const sorted = [...SCHEDULE].sort((a, b) => a.start - b.start);
  for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i - 1].start + sorted[i - 1].dur <= sorted[i].start, `${sorted[i - 1].slot} overlaps ${sorted[i].slot}`);
});

console.log('economy');
test('spend rejects overdrafts and zero, earn tracks totals', () => {
  const e = new Economy(50); assert.equal(e.spend(60, 'x'), false); assert.equal(e.balance, 50); assert.equal(e.spend(0, 'x'), false);
  assert.equal(e.spend(20, 'shim'), true); e.earn(30, 'mop'); assert.equal(e.balance, 60); assert.equal(e.earned, 30); assert.equal(e.spent, 20);
});
test('change events carry balance, delta and reason; log is capped', () => {
  const e = new Economy(10); const ev = []; e.on('change', (v, d, why) => ev.push([v, d, why]));
  e.earn(5, 'a'); e.spend(3, 'b'); assert.deepEqual(ev, [[15, 5, 'a'], [12, -3, 'b']]);
  for (let i = 0; i < 60; i++) e.earn(1, 'spam'); assert.ok(e.log.length <= 40);
});
test('serialize/load round trip', () => {
  const e = new Economy(50); e.earn(25, 'a'); e.spend(10, 'b'); const e2 = new Economy(0); e2.load(e.serialize());
  assert.deepEqual([e2.balance, e2.earned, e2.spent], [65, 25, 10]);
});

console.log('reputation');
test('tiers follow street cred thresholds', () => {
  const r = new Reputation();
  for (const [c, t] of [[-5, 'Nobody'], [0, 'Fresh'], [24, 'Fresh'], [25, 'Known'], [80, 'Respected'], [200, 'Shot-caller']]) { r.streetCred = c; assert.equal(r.tier, t, `cred ${c}`); }
});
test('values clamp: fear 0..100, standing -100..100', () => {
  const r = new Reputation(); r.addFear(500); assert.equal(r.fear, 100); r.addFear(-500); assert.equal(r.fear, 0);
  r.addStanding('Guards', 500); assert.equal(r.standing.Guards, 100); r.addStanding('Guards', -500); assert.equal(r.standing.Guards, -100);
});
test('ally / enemy thresholds and events', () => {
  const r = new Reputation(); const ev = []; r.on('standing', (f, v, n) => ev.push([f, v, n]));
  r.addStanding('Cartel', 60); assert.ok(r.isAlly('Cartel')); r.addStanding('Aryan', -40); assert.ok(r.isEnemy('Aryan')); assert.equal(ev.length, 2);
});
test('every faction has a standing entry; serialize/load round trip', () => {
  const r = new Reputation(); for (const f of FACTIONS) assert.equal(typeof r.standing[f], 'number');
  r.addCred(30); r.addFear(10); r.addStanding('Guards', 7); const r2 = new Reputation(); r2.load(r.serialize());
  assert.deepEqual([r2.streetCred, r2.fear, r2.standing.Guards], [42, 30, 7]);
});

console.log('survival');
test('hunger and thirst decay with game time; sprinting costs more', () => {
  const s = new Survival(), s2 = new Survival(), r = new Routine({ secondsPerHour: 45 });
  for (let i = 0; i < 45 * 60; i++) { s.update(1 / 60, r, { sprinting: false }); s2.update(1 / 60, r, { sprinting: true }); }
  assert.ok(Math.abs(78 - s.hunger - 3.2) < 0.05, `hunger ${s.hunger}`); assert.ok(s2.hunger < s.hunger); assert.ok(s.thirst < 82);
});
test('eat/drink clamp at 100; starving drains health and can kill', () => {
  const s = new Survival(); s.eat(500); s.drink(500); assert.deepEqual([s.hunger, s.thirst], [100, 100]);
  const r = new Routine({ secondsPerHour: 1 }), d = []; s.on('dead', () => d.push(1)); s.hunger = 0; s.health = 5;
  for (let i = 0; i < 300; i++) s.update(0.1, r, null); assert.equal(s.alive, false); assert.equal(d.length, 1);
});
test('health regenerates when fed and watered', () => {
  const s = new Survival(), r = new Routine({ secondsPerHour: 10 }); s.health = 50;
  for (let i = 0; i < 100; i++) s.update(0.1, r, null); assert.ok(s.health > 50);
});

console.log('alert');
test('heat maps to levels 0..3 at 25 / 55 / 90 and decays after the hold', () => {
  const a = new AlertSystem(), lv = []; a.on('level', (l) => lv.push(l));
  a.raise(30); assert.equal(a.level, 1); a.raise(30); assert.equal(a.level, 2); a.raise(40); assert.equal(a.level, 3);
  for (let i = 0; i < 100; i++) a.update(0.1);                  // hold (6 s)
  for (let i = 0; i < 400; i++) a.update(0.1);                  // decay 3.5 heat / s
  assert.equal(a.level, 0); assert.deepEqual(lv.slice(0, 3), [1, 2, 3]);
});
test('clear() resets immediately', () => { const a = new AlertSystem(); a.set(2); assert.equal(a.level, 2); a.clear(); assert.equal(a.level, 0); });

console.log('inventory');
test('stacking, slot cap and removal', () => {
  const inv = new Inventory(3); assert.ok(inv.add('cigs', 3)); assert.ok(inv.add('cigs', 2)); assert.equal(inv.count('cigs'), 5);
  assert.ok(inv.add('shim')); assert.ok(inv.add('keycard')); assert.equal(inv.add('note'), false);       // full
  assert.ok(inv.remove('cigs', 5)); assert.ok(!inv.has('cigs')); assert.equal(inv.remove('cigs'), false); assert.ok(inv.add('note'));
});
test('stack limit and unique items', () => {
  const inv = new Inventory(); inv.add('cigs', 100); assert.equal(inv.count('cigs'), ITEMS.cigs.stack); inv.add('ledger'); inv.add('ledger'); assert.equal(inv.count('ledger'), 1);
});
test('serialize/load round trip is a deep copy', () => {
  const inv = new Inventory(); inv.add('cigs', 4); inv.add('shim'); const d = inv.serialize(); inv.remove('cigs', 4); const i2 = new Inventory(); i2.load(d);
  assert.equal(i2.count('cigs'), 4); assert.ok(i2.has('shim'));
});

console.log('dialogue scripts');
const storySrc = fs.readFileSync(path.join(here, '../src/story/story.js'), 'utf8');
const knownStr = new Set([...storySrc.matchAll(/case '([^']+)'/g)].map((m) => m[1]));
test('every script has a start node and every next/choice target exists', () => {
  let nodes = 0, edges = 0;
  for (const [id, sc] of Object.entries(DIALOGUE)) {
    assert.ok(sc.nodes[sc.start], `${id}: missing start ${sc.start}`);
    for (const [nid, n] of Object.entries(sc.nodes)) {
      nodes++; assert.ok(n.text, `${id}.${nid} has no text`);
      if (n.next) { edges++; assert.ok(sc.nodes[n.next], `${id}.${nid} -> ${n.next} does not exist`); }
      for (const c of n.choices || []) { edges++; assert.ok(c.text, `${id}.${nid} choice without text`); if (c.next) assert.ok(sc.nodes[c.next], `${id}.${nid} choice -> ${c.next} does not exist`); }
    }
  }
  assert.ok(nodes >= 40 && edges >= 30, `only ${nodes} nodes / ${edges} edges`);
});
test('every script node is reachable from its start', () => {
  for (const [id, sc] of Object.entries(DIALOGUE)) {
    const seen = new Set(), q = [sc.start];
    while (q.length) { const k = q.pop(); if (seen.has(k)) continue; seen.add(k); const n = sc.nodes[k]; if (n.next) q.push(n.next); for (const c of n.choices || []) if (c.next) q.push(c.next); }
    const orphans = Object.keys(sc.nodes).filter((k) => !seen.has(k)); assert.deepEqual(orphans, [], `${id}: unreachable ${orphans}`);
  }
});
test('fx / cond strings used by scripts are handled by Story', () => {
  const used = new Set();
  const grab = (s) => { if (typeof s === 'string') for (const p of s.split(';')) { const k = p.trim().replace(/[-+]?\d+$/, '').replace(/[:=].*$/, ''); if (k) used.add(k); } };
  for (const sc of Object.values(DIALOGUE)) for (const n of Object.values(sc.nodes)) { grab(n.fx); for (const c of n.choices || []) { grab(c.fx); grab(c.cond); } }
  const missing = [...used].filter((k) => !storySrc.includes(k));
  assert.deepEqual(missing, [], `unhandled: ${missing}`);
});

console.log(`\n${pass} passed, ${fail} failed`);
fs.mkdirSync(path.join(here, '../docs'), { recursive: true });
fs.writeFileSync(path.join(here, '../docs/unit-report.json'), JSON.stringify({ generated: new Date().toISOString(), pass, fail, results }, null, 1));
process.exit(fail ? 1 : 0);
