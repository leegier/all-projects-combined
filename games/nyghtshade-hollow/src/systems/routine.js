// Prison routine clock — port of CLAWED PrisonRoutineManager / UE5 PrisonRoutineSubsystem.
// 11 routine slots drive door schedules, PA announcements and guard behaviour.
import { Emitter, fmtClock } from '../util.js';

export const SLOT = { Count: 'Count', Chow: 'Chow', Yard: 'Yard', WorkDetail: 'WorkDetail', Chapel: 'Chapel', Library: 'Library', Gym: 'Gym', Visitation: 'Visitation', Lockdown: 'Lockdown', LightsOut: 'LightsOut', FreeTime: 'FreeTime' };
export const SLOT_LABEL = { Count: 'COUNT', Chow: 'CHOW', Yard: 'YARD TIME', WorkDetail: 'WORK DETAIL', Chapel: 'CHAPEL / LIBRARY', Library: 'LIBRARY', Gym: 'GYM', Visitation: 'VISITATION', Lockdown: 'LOCKDOWN', LightsOut: 'LIGHTS OUT', FreeTime: 'FREE TIME' };

export const SCHEDULE = [
  { start: 6, dur: 1, slot: SLOT.Count, pa: 'COUNT TIME. ALL INMATES TO YOUR CELLS. STAND FOR COUNT.', mandatory: true },
  { start: 7, dur: 1, slot: SLOT.Chow, pa: 'CHOW. ALL INMATES REPORT TO THE MESS HALL.', mandatory: true },
  { start: 8, dur: 2, slot: SLOT.WorkDetail, pa: 'WORK DETAIL. REPORT TO YOUR ASSIGNMENTS.' },
  { start: 10, dur: 1, slot: SLOT.Yard, pa: 'YARD TIME. EXERCISE PERIOD.' },
  { start: 11, dur: 1, slot: SLOT.FreeTime, pa: 'FREE TIME.' },
  { start: 12, dur: 1, slot: SLOT.Chow, pa: 'CHOW. MIDDAY MEAL.', mandatory: true },
  { start: 13, dur: 2, slot: SLOT.Chapel, pa: 'CHAPEL AND LIBRARY ARE NOW OPEN.' },
  { start: 15, dur: 1, slot: SLOT.Gym, pa: 'GYM. RECREATION PERIOD.' },
  { start: 16, dur: 1, slot: SLOT.Visitation, pa: 'VISITATION. REPORT TO THE VISITING ROOM.' },
  { start: 17, dur: 1, slot: SLOT.Chow, pa: 'CHOW. EVENING MEAL.', mandatory: true },
  { start: 18, dur: 3, slot: SLOT.FreeTime, pa: 'FREE TIME. EVENING RECREATION.' },
  { start: 21, dur: 1, slot: SLOT.Count, pa: 'FINAL COUNT. ALL INMATES TO YOUR CELLS.', mandatory: true },
  { start: 22, dur: 8, slot: SLOT.LightsOut, pa: 'LIGHTS OUT. ALL INMATES IN YOUR CELLS.', mandatory: true },
];

export class Routine extends Emitter {
  constructor({ secondsPerHour = 24, startHour = 5.92 } = {}) {
    super();
    this.secondsPerHour = secondsPerHour;
    this.hour = startHour;
    this.day = 1;
    this.slot = SLOT.LightsOut;
    this.entry = null;
    this.timeScale = 1;
    this.lockdown = false;
    this.lockdownEnds = -1;
    this.paused = false;
    this.totalGameHours = 0;
    this._evaluate(true);
  }
  get clock() { return fmtClock(this.hour); }
  get label() { return this.lockdown ? SLOT_LABEL.Lockdown : SLOT_LABEL[this.slot]; }
  _entryFor(h) {
    let best = null, bestStart = -1;
    const hh = Math.floor(h);
    for (const e of SCHEDULE) {
      const end = e.start + e.dur;
      const covers = end > 24 ? (hh >= e.start || hh < end - 24) : (hh >= e.start && hh < end);
      if (covers && e.start >= bestStart) { best = e; bestStart = e.start; }
    }
    return best;
  }
  _evaluate(silent = false) {
    const e = this._entryFor(this.hour);
    if (!e) return;
    const changed = e !== this.entry;
    this.entry = e;
    if (changed || silent) {
      const prev = this.slot;
      this.slot = e.slot;
      if (!silent) { this.emit('slot', e.slot, e, prev); this.emit('pa', e.pa); if (e.slot === SLOT.Count) this.emit('count', e); }
    }
  }
  startLockdown(hours = 1) { this.lockdown = true; this.lockdownEnds = this.hour + hours; this.emit('lockdown', true); this.emit('pa', 'EMERGENCY LOCKDOWN. ALL INMATES TO YOUR CELLS IMMEDIATELY.'); }
  update(dt) {
    if (this.paused) return;
    const adv = (dt / this.secondsPerHour) * this.timeScale;
    const before = Math.floor(this.hour);
    this.hour += adv; this.totalGameHours += adv;
    if (this.hour >= 24) { this.hour -= 24; this.day++; this.emit('newDay', this.day); }
    if (this.lockdown && this.hour >= this.lockdownEnds && this.lockdownEnds >= 0) { this.lockdown = false; this.emit('lockdown', false); }
    if (Math.floor(this.hour) !== before) this.emit('hour', Math.floor(this.hour));
    this._evaluate();
  }
  /** Jump to an hour (used by "rest on your bunk"). Fires slot events for the destination only. */
  skipTo(hour) {
    if (hour <= this.hour) { this.day++; this.emit('newDay', this.day); }
    this.hour = hour;
    this._evaluate();
    this.emit('hour', Math.floor(hour));
  }
  /** Door policy helpers. */
  cellsLocked() { return this.lockdown || this.slot === SLOT.Count || this.slot === SLOT.LightsOut; }
  canteenOpen() { return !this.lockdown && this.slot !== SLOT.Count && this.slot !== SLOT.LightsOut; }
  mealTime() { return !this.lockdown && this.slot === SLOT.Chow; }
  chapelOpen() { return !this.lockdown && (this.slot === SLOT.Chapel || this.slot === SLOT.Library); }
  corridorsOpen() { return !this.lockdown && this.slot !== SLOT.Count && this.slot !== SLOT.LightsOut; }
  serialize() { return { hour: this.hour, day: this.day }; }
  load(d) { this.hour = d.hour; this.day = d.day; this._evaluate(true); }
}
