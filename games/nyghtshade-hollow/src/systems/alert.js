// Prison-wide alert level — port of CLAWED AlertSystem. Decays on its own; guards raise it.
import { Emitter, clamp } from '../util.js';

export const ALERT = { Calm: 0, Suspicious: 1, Alerted: 2, Lockdown: 3 };
export const ALERT_LABEL = ['CALM', 'SUSPICIOUS', 'ALERT', 'LOCKDOWN'];

export class AlertSystem extends Emitter {
  constructor() { super(); this.level = 0; this.heat = 0; this.decay = 3.5; this.hold = 0; }
  /** heat 0..100 — thresholds 25 / 55 / 90. */
  raise(amount, why = '') { this.heat = clamp(this.heat + amount, 0, 100); this.hold = 6; this._recalc(why); }
  set(level, why = '') { this.heat = [0, 30, 65, 100][level]; this.hold = 8; this._recalc(why); }
  update(dt) {
    if (this.hold > 0) { this.hold -= dt; return; }
    if (this.heat > 0) { this.heat = Math.max(0, this.heat - this.decay * dt); this._recalc(); }
  }
  _recalc(why) {
    const l = this.heat >= 90 ? 3 : this.heat >= 55 ? 2 : this.heat >= 25 ? 1 : 0;
    if (l !== this.level) { const p = this.level; this.level = l; this.emit('level', l, p, why); }
  }
  clear() { this.heat = 0; this.hold = 0; this._recalc('clear'); }
  serialize() { return { heat: this.heat }; }
  load(d) { this.heat = d.heat || 0; this._recalc(); }
}
