// DC (prison scrip) economy — port of CLAWED DCEconomy. Cigarettes act as hard currency (1 pack ≈ 8 DC).
import { Emitter } from '../util.js';

export class Economy extends Emitter {
  constructor(start = 50) { super(); this.balance = start; this.log = []; this.earned = 0; this.spent = 0; }
  can(amount) { return this.balance >= amount; }
  spend(amount, reason) {
    if (amount <= 0 || !this.can(amount)) return false;
    this.balance -= amount; this.spent += amount; this._log(`- ${amount} DC  ${reason}`);
    this.emit('change', this.balance, -amount, reason); return true;
  }
  earn(amount, reason) {
    if (amount <= 0) return; this.balance += amount; this.earned += amount; this._log(`+ ${amount} DC  ${reason}`);
    this.emit('change', this.balance, amount, reason);
  }
  _log(s) { this.log.unshift(s); if (this.log.length > 40) this.log.pop(); }
  serialize() { return { balance: this.balance, log: this.log, earned: this.earned, spent: this.spent }; }
  load(d) { Object.assign(this, { balance: d.balance, log: d.log || [], earned: d.earned || 0, spent: d.spent || 0 }); this.emit('change', this.balance, 0, 'load'); }
}
