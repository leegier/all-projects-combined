// Touch controls for phones / tablets (landscape): left thumb stick, drag-to-look on the right, action buttons.
// Visual / input only: it feeds the same Input object the keyboard does (stick axes, synthetic key presses, look deltas) and is never created
// unless the device has a coarse pointer or the page is opened with ?touch, so the simulation, the bot and the capture pipeline are untouched.
const STICK_R = 56, LOOK_K = 1.5;

export function wantsTouch(q) {
  if (q.get('touch') === 'off') return false;
  if (q.has('bot') || q.has('capture') || q.has('cine')) return false;
  return q.has('touch') || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
}

export function installTouch(game, host) {
  const input = game.input, ui = game.ui;
  input.touch = true;
  const css = document.createElement('style');
  css.textContent = `
#touch{position:absolute;inset:0;z-index:30;pointer-events:none;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
#touch .zone{position:absolute;top:12%;bottom:0;pointer-events:auto;touch-action:none}
#touch .zl{left:0;width:42%}#touch .zr{right:0;width:58%}
#touch .stick{position:absolute;width:${STICK_R * 2}px;height:${STICK_R * 2}px;margin:-${STICK_R}px 0 0 -${STICK_R}px;border-radius:50%;border:2px solid rgba(255,255,255,.3);background:rgba(255,255,255,.06);display:none}
#touch .knob{position:absolute;left:50%;top:50%;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:rgba(255,255,255,.35)}
#touch .tb{position:absolute;pointer-events:auto;touch-action:none;display:flex;align-items:center;justify-content:center;border-radius:50%;border:2px solid rgba(255,255,255,.38);background:rgba(10,10,12,.5);color:#e8e2d2;font:600 15px/1 "Arial Narrow",Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase}
#touch .tb.on{background:rgba(190,40,40,.65)}
#touch .tb:active{background:rgba(255,255,255,.28)}
#touch .big{width:78px;height:78px;font-size:20px}#touch .mid{width:62px;height:62px}#touch .sm{width:46px;height:46px;font-size:12px}
#touch.off .zone,#touch.off .tb.play{display:none}
#touch.menu .zone{display:none}
`;
  document.head.appendChild(css);
  const root = document.createElement('div'); root.id = 'touch';
  root.innerHTML = `<div class="zone zl"></div><div class="zone zr"></div><div class="stick"><div class="knob"></div></div>`;
  host.appendChild(root);
  const zl = root.querySelector('.zl'), zr = root.querySelector('.zr'), stickEl = root.querySelector('.stick'), knob = root.querySelector('.knob');

  const btn = (label, cls, pos, handlers, extra = '') => {
    const b = document.createElement('div'); b.className = 'tb ' + cls + ' ' + extra; b.textContent = label;
    Object.assign(b.style, pos); root.appendChild(b);
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); handlers.down && handlers.down(b); });
    const up = (e) => { e.preventDefault(); handlers.up && handlers.up(b); };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
    return b;
  };
  const hold = (code) => ({ down: () => input.holdKey(code, true), up: () => input.holdKey(code, false) });
  const tap = (code) => ({ down: () => { input.holdKey(code, true); setTimeout(() => input.holdKey(code, false), 90); } });
  const toggle = (code) => { let on = false; return { down: (b) => { on = !on; b.classList.toggle('on', on); input.holdKey(code, on); } }; };

  // right-hand cluster
  btn('E', 'big play', { right: '22px', bottom: '70px' }, hold('KeyE'));
  btn('▶', 'mid', { right: '118px', bottom: '40px' }, tap('Space'));
  btn('Run', 'mid play', { right: '22px', bottom: '160px' }, toggle('ShiftLeft'));
  btn('Duck', 'mid play', { right: '98px', bottom: '124px' }, toggle('KeyC'));
  btn('Wait', 'sm play', { left: '14px', top: '84px' }, hold('KeyT'));
  // top row
  btn('Log', 'sm', { right: '14px', top: '14px' }, tap('KeyJ'));
  btn('Map', 'sm play', { right: '68px', top: '14px' }, tap('KeyM'));
  btn('II', 'sm', { right: '122px', top: '14px' }, tap('Escape'));
  btn('Skip', 'sm', { right: '176px', top: '14px' }, tap('Backspace'));

  // thumb stick
  let sId = null, sx = 0, sy = 0;
  const setStick = (dx, dy) => {
    const l = Math.hypot(dx, dy) || 1, k = Math.min(1, l / STICK_R);
    input.stick[0] = (dx / l) * k; input.stick[1] = -(dy / l) * k;                  // up = forward
    knob.style.transform = `translate(${(dx / l) * Math.min(l, STICK_R)}px,${(dy / l) * Math.min(l, STICK_R)}px)`;
  };
  zl.addEventListener('pointerdown', (e) => {
    if (sId !== null) return; e.preventDefault(); zl.setPointerCapture(e.pointerId); sId = e.pointerId;
    const r = root.getBoundingClientRect(); sx = e.clientX; sy = e.clientY;
    stickEl.style.display = 'block'; stickEl.style.left = (sx - r.left) + 'px'; stickEl.style.top = (sy - r.top) + 'px'; setStick(0, 0);
  });
  zl.addEventListener('pointermove', (e) => { if (e.pointerId === sId) { e.preventDefault(); setStick(e.clientX - sx, e.clientY - sy); } });
  const stickEnd = (e) => { if (e.pointerId !== sId) return; sId = null; stickEl.style.display = 'none'; input.stick[0] = 0; input.stick[1] = 0; };
  zl.addEventListener('pointerup', stickEnd); zl.addEventListener('pointercancel', stickEnd);

  // look
  let lId = null, lx = 0, ly = 0;
  zr.addEventListener('pointerdown', (e) => { if (lId !== null) return; e.preventDefault(); zr.setPointerCapture(e.pointerId); lId = e.pointerId; lx = e.clientX; ly = e.clientY; });
  zr.addEventListener('pointermove', (e) => { if (e.pointerId !== lId) return; e.preventDefault(); input.dx += (e.clientX - lx) * LOOK_K; input.dy += (e.clientY - ly) * LOOK_K; lx = e.clientX; ly = e.clientY; });
  const lookEnd = (e) => { if (e.pointerId === lId) lId = null; };
  zr.addEventListener('pointerup', lookEnd); zr.addEventListener('pointercancel', lookEnd);

  // fullscreen + landscape on the first touch (where the browser allows it)
  const goFull = () => {
    try { const el = document.documentElement; (el.requestFullscreen || el.webkitRequestFullscreen || (() => {})).call(el); } catch (e) { /* ignore */ }
    try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* ignore */ }
  };
  window.addEventListener('pointerdown', () => { goFull(); }, { once: true, capture: true });

  // show the controls only while they make sense
  setInterval(() => {
    const m = game.mode, playing = m === 'play', talk = m === 'dialogue';
    const menus = ui.panelOpen || ui.shopOpen || ui.docOpen;
    root.style.display = (playing || talk || m === 'cine' || m === 'paused') ? 'block' : 'none';
    root.classList.toggle('off', !playing || menus);
    root.classList.toggle('menu', talk || m === 'paused' || m === 'cine');
    if (!playing && sId !== null) { sId = null; stickEl.style.display = 'none'; input.stick[0] = 0; input.stick[1] = 0; }
  }, 120);
}
