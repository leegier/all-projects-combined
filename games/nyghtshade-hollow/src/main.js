// Entry point: content advisory (25 s, pre-loads textures/systems) → title → game.
import { Game } from './game.js';
import { installCapture } from './capture.js';
import { Bot } from './bot/bot.js';
import { characters } from './chars/library.js';
import { installDirector } from './director.js';
import { installTouch, wantsTouch } from './core/touch.js';

const q = new URLSearchParams(location.search);
window.NH_CHARS_LIB = characters;
characters.init();      // glTF characters (MetaHuman exports) load alongside the rest of the boot; inert when assets/characters has no manifest
const canvas = document.getElementById('c');
const root = document.getElementById('ui');
const W = +q.get('w') || 1280, H = +q.get('h') || 720;
canvas.width = W; canvas.height = H;
{ const wrap = document.getElementById('wrap'); wrap.style.aspectRatio = `${W} / ${H}`; wrap.style.width = `min(100vw, calc(100vh * ${W} / ${H}))`; }     // the frame follows ?w=&h= (2.39:1 scope for trailers)
const game = new Game({ canvas, uiRoot: root, quality: q.get('q') || (wantsTouch(q) ? 'low' : 'high'), capture: q.has('capture'), width: W, height: H, seed: +q.get('seed') || 1337, crowd: q.get('crowd') !== 'off', cine: q.has('cine') });
window.NH = game;
const ui = game.ui;
const DISC = q.has('fast') || q.has('auto') || q.has('bot') || q.has('capture') ? 0.4 : 25;
let loaded = false, counted = false;

function refreshAccept() {
  const btn = ui.el('u-accept');
  btn.disabled = !(loaded && counted);
  ui.el('u-cnt').textContent = loaded ? (counted ? 'Ready' : 'Content advisory') : 'Preparing prison systems…';
}
ui.show('u-disc', true);
const t0 = performance.now();
const tick = setInterval(() => {
  const el = (performance.now() - t0) / 1000;
  if (el >= DISC) { counted = true; clearInterval(tick); }
  ui.el('u-cnt').textContent = (loaded ? '' : 'Preparing prison systems… ') + (counted ? '' : Math.max(0, Math.ceil(DISC - el)) + 's');
  refreshAccept();
}, 200);

function startAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC || game.audio) return;
  const ctx = new AC();
  game.initAudio(ctx, () => ctx.currentTime, true);
  if (ctx.state === 'suspended') ctx.resume();
}

game.init((p, name) => { ui.el('u-load').style.width = (p * 100).toFixed(0) + '%'; }).then(() => {
  if (characters.enabled) console.log(`[NH] characters: ${game.npcs.filter((n) => n.body.isGltf).length}/${game.npcs.length} NPCs use glTF bodies (${characters.specs.length} character files)`);
  if (game.crowd) console.log(`[NH] crowd: ${game.crowd.stats.residents} residents + ${game.crowd.stats.staff} staff, ${game.crowd.stats.bakes} baked poses (${(game.crowd.stats.tris / 1000).toFixed(0)}k tris), ${game.crowd.stats.materials} materials, ${game.crowd.stats.bakeMs.toFixed(0)} ms`);
  if (wantsTouch(q)) installTouch(game, document.getElementById('wrap'));
  loaded = true; ui.el('u-load').style.width = '100%'; refreshAccept();
  game.input.onPointerLockChange = (locked) => { if (!locked && game.mode === 'play' && !game.input.virtual && !ui.panelOpen && !ui.shopOpen && !ui.docOpen) game.pause(true); };
  game.debug = q.has('debug');
  if (q.has('manual')) game.manual = true;
  game.start();
  if (q.has('bot')) { window.NH_BOT = game.bot = new Bot(game, { route: q.get('bot') || 'shim', annotate: q.has('annotate'), hurry: q.has('hurry') }); }
  if (q.has('capture')) installCapture(game, ui);
  if (q.has('cine')) installDirector(game);
  if (q.has('bot') && !q.has('nostart') && !q.has('capture')) { clearInterval(tick); ui.show('u-disc', false); game.toTitle(); game.newGame(); }
  if (q.has('auto') || q.has('bot') || q.has('capture')) { window.NH_READY = true; }
}).catch((e) => { console.error(e); ui.el('u-cnt').textContent = 'Error: ' + e.message; window.NH_ERROR = e.stack || String(e); });

ui.el('u-accept').onclick = () => {
  startAudio();
  ui.show('u-disc', false);
  game.toTitle();
};
ui.el('u-new').onclick = () => { startAudio(); game.newGame(); game.input.lock(); };
ui.el('u-cont2').onclick = () => { startAudio(); game.continueGame(); };
ui.el('u-ctrl').onclick = () => { const h = ui.el('u-helptitle'); h.style.display = h.style.display === 'none' ? 'block' : 'none'; };
ui.el('u-resume').onclick = () => game.pause(false);
ui.el('u-save').onclick = () => game.save();
ui.el('u-quit').onclick = () => { game.pause(false); game.toTitle(); };
const defQ = wantsTouch(q) ? 'low' : 'high';
ui.el('u-qual').textContent = 'Quality: ' + (q.get('q') || defQ);
ui.el('u-qual').onclick = () => { const order = ['low', 'medium', 'high']; const cur = q.get('q') || defQ; const n = order[(order.indexOf(cur) + 1) % 3]; q.set('q', n); location.search = q.toString(); };
canvas.addEventListener('click', () => { if (game.input && game.mode === 'play' && !game.input.locked && !game.input.touch && !game.input.virtual && !ui.panelOpen && !ui.shopOpen) game.input.lock(); });
document.addEventListener('keydown', (e) => { if (e.code === 'F3') { game.debug = !game.debug; ui.fps(game.debug ? '…' : ''); } });
