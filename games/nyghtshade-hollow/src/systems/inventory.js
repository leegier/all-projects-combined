// Inventory — port of CLAWED InventorySystem (stackable items, fixed slot cap).
import { Emitter } from '../util.js';

export const ITEMS = {
  keycard: { name: 'Records Keycard', desc: 'Magnetic strip, scratched. Opens the Records Room reader.', icon: '▤' },
  ledger: { name: 'Transfer Ledger — Page 14', desc: 'Torn from the Intake ledger. Harrington Marlowe\'s transfer order.', icon: '▥', doc: true },
  cigs: { name: 'Pack of Cigarettes', desc: 'Hard currency inside. ~8 DC a pack.', icon: '▮', stack: 20 },
  tray: { name: 'Chow Tray', desc: 'Gray eggs, toast, coffee. Eat it before it gets worse.', icon: '▭' },
  shim: { name: 'Reader Shim', desc: 'Filed-down spoon handle. Hold it in the Records reader and pray nobody turns around.', icon: '▸' },
  note: { name: 'Folded Note', desc: 'Cutter\'s handwriting: "Chapel at 1. Bring the page."', icon: '▯' },
};

export class Inventory extends Emitter {
  constructor(max = 8) { super(); this.max = max; this.slots = []; }
  count(id) { const s = this.slots.find((x) => x.id === id); return s ? s.n : 0; }
  has(id) { return this.count(id) > 0; }
  add(id, n = 1) {
    const def = ITEMS[id]; const s = this.slots.find((x) => x.id === id);
    if (s) { s.n = Math.min(def.stack || 1, s.n + n); }
    else { if (this.slots.length >= this.max) return false; this.slots.push({ id, n }); }
    this.emit('change', id, n); return true;
  }
  remove(id, n = 1) {
    const s = this.slots.find((x) => x.id === id); if (!s || s.n < n) return false;
    s.n -= n; if (s.n <= 0) this.slots.splice(this.slots.indexOf(s), 1);
    this.emit('change', id, -n); return true;
  }
  serialize() { return this.slots.map((s) => ({ ...s })); }
  load(d) { this.slots = d.map((s) => ({ ...s })); this.emit('change', null, 0); }
}
