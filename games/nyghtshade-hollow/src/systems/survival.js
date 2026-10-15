// Survival vitals — port of CLAWED PlayerSurvival. Health / hunger / thirst; stamina lives on the player.
import { Emitter, clamp } from '../util.js';

export class Survival extends Emitter {
  constructor() { super(); this.health = 100; this.hunger = 78; this.thirst = 82; this.alive = true; this.starving = false; }
  /** dtGameHours = elapsed in-game hours. */
  update(dt, routine, player) {
    const gh = (dt / routine.secondsPerHour) * routine.timeScale;
    const exertion = player && player.sprinting ? 2.2 : 1;
    this.hunger = clamp(this.hunger - 3.2 * gh * exertion, 0, 100);
    this.thirst = clamp(this.thirst - 4.2 * gh * exertion, 0, 100);
    const starving = this.hunger <= 0 || this.thirst <= 0;
    if (starving) this.health = clamp(this.health - 2.2 * gh, 0, 100);
    else if (this.hunger > 40 && this.thirst > 40) this.health = clamp(this.health + 1.2 * gh, 0, 100);
    if (starving !== this.starving) { this.starving = starving; this.emit('starving', starving); }
    if (this.health <= 0 && this.alive) { this.alive = false; this.emit('dead'); }
  }
  eat(n) { this.hunger = clamp(this.hunger + n, 0, 100); this.emit('eat', n); }
  drink(n) { this.thirst = clamp(this.thirst + n, 0, 100); this.emit('drink', n); }
  hurt(n) { this.health = clamp(this.health - n, 0, 100); this.emit('hurt', n); }
  serialize() { return { health: this.health, hunger: this.hunger, thirst: this.thirst }; }
  load(d) { Object.assign(this, d); }
}
