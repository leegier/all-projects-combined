// Reputation — port of CLAWED ReputationSystem. StreetCred (yard standing), Fear, and per-faction standing.
import { Emitter, clamp } from '../util.js';

export const FACTIONS = ['Guards', 'InmatesGeneral', 'YardCrew', 'Cartel', 'GangBloods', 'GangCrips', 'Aryan', 'SicilianOutfit', 'Independent'];
export const FACTION_LABEL = { Guards: 'Guards', InmatesGeneral: 'General Pop', YardCrew: 'Yard Crew', Cartel: 'Cartel', GangBloods: 'Bloods', GangCrips: 'Crips', Aryan: 'Aryan Bro.', SicilianOutfit: 'Sicilian Outfit', Independent: 'Independents' };

export class Reputation extends Emitter {
  constructor() {
    super();
    this.streetCred = 12; this.fear = 20;
    this.standing = {}; for (const f of FACTIONS) this.standing[f] = 0;
    this.standing.InmatesGeneral = 8; this.standing.YardCrew = 4;
    this.ally = 60; this.enemy = -40;
  }
  addCred(n, why = '') { const v = clamp(this.streetCred + n, -1000, 1000); if (v === this.streetCred) return; this.streetCred = v; this.emit('cred', v, n, why); }
  addFear(n, why = '') { const v = clamp(this.fear + n, 0, 100); if (v === this.fear) return; this.fear = v; this.emit('fear', v, n, why); }
  addStanding(f, n, why = '') { const v = clamp((this.standing[f] || 0) + n, -100, 100); this.standing[f] = v; this.emit('standing', f, v, n, why); }
  isAlly(f) { return this.standing[f] >= this.ally; }
  isEnemy(f) { return this.standing[f] <= this.enemy; }
  /** Tier label for UI. */
  get tier() { const c = this.streetCred; return c >= 200 ? 'Shot-caller' : c >= 80 ? 'Respected' : c >= 25 ? 'Known' : c >= 0 ? 'Fresh' : 'Nobody'; }
  serialize() { return { streetCred: this.streetCred, fear: this.fear, standing: this.standing }; }
  load(d) { this.streetCred = d.streetCred; this.fear = d.fear; Object.assign(this.standing, d.standing); }
}
