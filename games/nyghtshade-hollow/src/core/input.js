// Input: keyboard + mouse (pointer lock) with a virtual override layer used by the playtest bot.
// `snapshot()` is called once per simulation step and returns edge-detected actions.
const MAP = {
  forward: ['KeyW', 'ArrowUp'], back: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'], crouch: ['KeyC', 'ControlLeft'], interact: ['KeyE'], advance: ['Space', 'Enter'],
  journal: ['Tab', 'KeyJ'], map: ['KeyM'], pause: ['Escape', 'KeyP'], wait: ['KeyT'], c1: ['Digit1'], c2: ['Digit2'], c3: ['Digit3'], c4: ['Digit4'],
  inventory: ['KeyI'], skip: ['Backspace'],
};

export class Input {
  constructor(el) {
    this.el = el;
    this.keys = new Set();
    this.mouseBtn = false;
    this.dx = 0; this.dy = 0;
    this.virtual = null; // { move:[x,y], sprint, crouch, interact, ... } set by the bot
    this.prev = {};
    this.locked = false;
    this.listeners = [];
    this.onPointerLockChange = () => {};
    this.enabled = true;
    this._edge = new Set();
    window.addEventListener('keydown', (e) => {
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this._edge.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    el.addEventListener('mousedown', () => { this.mouseBtn = true; this._edge.add('Mouse0'); });
    window.addEventListener('mouseup', () => { this.mouseBtn = false; });
    document.addEventListener('mousemove', (e) => { if (this.locked) { this.dx += e.movementX; this.dy += e.movementY; } });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === el; this.onPointerLockChange(this.locked); });
  }
  lock() { try { const p = this.el.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* headless */ } }
  unlock() { try { document.exitPointerLock(); } catch (e) { /* ignore */ } }
  _down(action) { return MAP[action].some((c) => this.keys.has(c)); }
  _pressedEdge(action) { return MAP[action].some((c) => this._edge.has(c)); }

  /** Consume accumulated mouse look. */
  takeLook() { const r = [this.dx, this.dy]; this.dx = 0; this.dy = 0; return r; }

  snapshot() {
    const v = this.virtual;
    const s = {};
    if (v) {
      s.mx = v.move ? v.move[0] : 0; s.my = v.move ? v.move[1] : 0;
      for (const k of ['sprint', 'crouch', 'interact', 'advance', 'journal', 'map', 'pause', 'wait', 'c1', 'c2', 'c3', 'c4', 'inventory', 'skip']) s[k] = !!v[k];
    } else {
      s.mx = (this._down('right') ? 1 : 0) - (this._down('left') ? 1 : 0);
      s.my = (this._down('forward') ? 1 : 0) - (this._down('back') ? 1 : 0);
      for (const k of Object.keys(MAP)) if (!['forward', 'back', 'left', 'right'].includes(k)) s[k] = this._down(k);
      s.advance = s.advance || this._edge.has('Mouse0');
    }
    const out = { mx: s.mx, my: s.my, held: {}, pressed: {} };
    for (const k of Object.keys(s)) {
      if (k === 'mx' || k === 'my') continue;
      out.held[k] = !!s[k];
      out.pressed[k] = !!s[k] && !this.prev[k];
      this.prev[k] = !!s[k];
    }
    if (!v) { for (const k of Object.keys(MAP)) if (this._pressedEdge(k) && k !== 'forward') out.pressed[k] = out.pressed[k] || (!!s[k]); }
    this._edge.clear();
    return out;
  }
}
