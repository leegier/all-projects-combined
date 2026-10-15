// HTML/CSS overlay: HUD, prompts, subtitles/choices, toasts, journal, shop, document viewer, title/disclaimer/end screens, minimap.
import { clamp, fmtClock } from '../util.js';
import { SLOT_LABEL, SCHEDULE } from '../systems/routine.js';
import { ITEMS } from '../systems/inventory.js';
import { FACTIONS, FACTION_LABEL } from '../systems/reputation.js';
import { ALERT_LABEL } from '../systems/alert.js';

const CSS = `
:root{--red:#b3202a;--red2:#e0323d;--ink:#d8d2c4;--dim:#8d8678;--bg:rgba(8,8,10,.72)}
#ui *{box-sizing:border-box}
#ui{font-family:"Arial Narrow","Helvetica Neue",Arial,sans-serif;color:var(--ink);text-transform:none}
.caps{text-transform:uppercase;letter-spacing:.14em}
.hud{position:absolute;inset:0;opacity:0;transition:opacity .5s}
.hud.on{opacity:1}
.tl{position:absolute;left:2.2%;top:3.2%;max-width:36%}
.clock{font-size:2.9vmin;font-weight:700;letter-spacing:.06em;text-shadow:0 0 10px rgba(0,0,0,.8)}
.clock small{font-size:1.5vmin;color:var(--dim);letter-spacing:.2em;margin-left:.8vmin}
.slot{font-size:1.5vmin;color:var(--red2);letter-spacing:.24em;text-transform:uppercase;margin-top:.3vmin;text-shadow:0 0 6px #000}
.slotbar{height:2px;background:rgba(255,255,255,.12);margin:.6vmin 0 1.4vmin;width:22vmin}
.slotbar i{display:block;height:100%;background:var(--red);width:0}
.obj{font-size:1.75vmin;line-height:1.35;background:linear-gradient(90deg,rgba(0,0,0,.55),rgba(0,0,0,0));padding:.7vmin 3vmin .7vmin 1vmin;border-left:2px solid var(--red);text-shadow:0 0 6px #000}
.obj b{display:block;font-size:1.15vmin;letter-spacing:.3em;color:var(--dim);font-weight:400;text-transform:uppercase}
.tr{position:absolute;right:2.2%;top:3.2%;text-align:right;text-shadow:0 0 8px #000}
.dc{font-size:2.6vmin;font-weight:700;letter-spacing:.08em}
.dc small{font-size:1.3vmin;color:var(--dim);letter-spacing:.25em;margin-right:.7vmin}
.dc.flash{animation:dcf .9s}
@keyframes dcf{0%{color:#ffe28a;transform:scale(1.15)}100%{color:var(--ink);transform:scale(1)}}
.rep{font-size:1.25vmin;color:var(--dim);letter-spacing:.18em;margin-top:.5vmin;text-transform:uppercase}
.rep b{color:var(--ink);font-weight:400}
.bl{position:absolute;left:2.2%;bottom:3.4%;width:19vmin}
.vit{display:flex;align-items:center;margin-top:.7vmin;font-size:1.1vmin;letter-spacing:.2em;color:var(--dim)}
.vit span{width:5.2vmin}
.vit i{flex:1;height:.55vmin;background:rgba(255,255,255,.1);position:relative;overflow:hidden}
.vit i b{position:absolute;left:0;top:0;bottom:0;background:var(--ink);width:100%}
.vit.hp i b{background:#b84040}.vit.fd i b{background:#c19a52}.vit.wt i b{background:#5e8fb0}.vit.st i b{background:#9ab26a}
.vit.low i b{animation:pulse .8s infinite}
@keyframes pulse{50%{opacity:.35}}
.cross{position:absolute;left:50%;top:50%;width:.55vmin;height:.55vmin;margin:-.275vmin;border-radius:50%;background:rgba(235,225,205,.55);box-shadow:0 0 5px #000;transition:all .15s}
.cross.hot{width:1.5vmin;height:1.5vmin;margin:-.75vmin;background:transparent;border:1.5px solid rgba(235,225,205,.9)}
.prompt{position:absolute;left:50%;top:58%;transform:translateX(-50%);text-align:center;font-size:1.9vmin;text-shadow:0 0 8px #000;opacity:0;transition:opacity .15s}
.prompt.on{opacity:1}
.prompt kbd{display:inline-block;min-width:3vmin;padding:.2vmin .9vmin;margin-right:1vmin;border:1.5px solid var(--ink);border-radius:.4vmin;background:rgba(0,0,0,.55);font:700 1.7vmin/1.4 inherit;text-align:center}
.prompt .why{display:block;font-size:1.3vmin;color:#d9a16a;margin-top:.5vmin;letter-spacing:.1em}
.prompt .hold{width:16vmin;height:.5vmin;background:rgba(255,255,255,.18);margin:.8vmin auto 0;display:none}
.prompt .hold i{display:block;height:100%;width:0;background:var(--red2)}
.sub{position:absolute;left:50%;bottom:9.5%;transform:translateX(-50%);width:62%;text-align:center;font-size:2.35vmin;line-height:1.4;text-shadow:0 0 10px #000,0 2px 3px #000;opacity:0;transition:opacity .2s}
.sub.on{opacity:1}
.sub .who{display:block;font-size:1.3vmin;letter-spacing:.34em;color:var(--red2);text-transform:uppercase;margin-bottom:.5vmin}
.sub .txt{background:linear-gradient(90deg,rgba(0,0,0,0),rgba(0,0,0,.55) 12%,rgba(0,0,0,.55) 88%,rgba(0,0,0,0));padding:.6vmin 5vmin}
.sub.inner .txt{font-style:italic;color:#c9c2b2}
.sub .cont{display:block;font-size:1.1vmin;color:var(--dim);letter-spacing:.3em;margin-top:.6vmin;opacity:.8}
.choices{position:absolute;left:50%;bottom:7%;transform:translateX(-50%);width:56%;display:none;pointer-events:auto}
.choices.on{display:block}
.choices button{display:block;width:100%;text-align:left;margin:.5vmin 0;padding:1vmin 2vmin;font:inherit;font-size:2vmin;color:var(--ink);background:rgba(8,8,10,.8);border:1px solid rgba(255,255,255,.18);border-left:3px solid var(--red);cursor:pointer}
.choices button:hover,.choices button.sel{background:rgba(70,10,14,.85);border-color:var(--red2)}
.choices button em{color:var(--red2);font-style:normal;margin-right:1.2vmin;font-weight:700}
.choices button small{float:right;color:#c9a35a;letter-spacing:.14em}
.choices button.dis{opacity:.4;pointer-events:none}
.toasts{position:absolute;right:2.2%;top:16%;width:30vmin;text-align:right}
.toast{font-size:1.5vmin;margin-top:.7vmin;padding:.6vmin 1.4vmin;background:var(--bg);border-right:2px solid var(--red);animation:toast 3.6s forwards;letter-spacing:.06em}
.toast.good{border-color:#6aa86a}.toast.bad{border-color:#e0323d;color:#f0b8b8}.toast.dc{border-color:#d4b45a}
@keyframes toast{0%{opacity:0;transform:translateX(2vmin)}8%{opacity:1;transform:none}85%{opacity:1}100%{opacity:0}}
.detect{position:absolute;left:50%;top:6.5%;transform:translateX(-50%);width:6vmin;height:6vmin;border-radius:50%;opacity:0;transition:opacity .2s;display:flex;align-items:center;justify-content:center;font-size:2.6vmin;background:conic-gradient(var(--red2) var(--p,0%),rgba(255,255,255,.12) 0);text-shadow:0 0 6px #000}
.detect:before{content:"";position:absolute;inset:.5vmin;border-radius:50%;background:rgba(6,6,8,.82)}
.detect span{position:relative}
.detect.on{opacity:1}
.alertbar{position:absolute;left:50%;top:13.5%;transform:translateX(-50%);padding:.7vmin 3vmin;font-size:1.5vmin;letter-spacing:.4em;background:rgba(120,10,16,.78);border:1px solid var(--red2);opacity:0;transition:opacity .25s;text-transform:uppercase}
.alertbar.on{opacity:1;animation:pulse 1s infinite}
.pa{position:absolute;left:50%;top:21%;transform:translateX(-50%);font-size:1.5vmin;letter-spacing:.3em;color:#e6dcc0;padding:.8vmin 3vmin;background:rgba(0,0,0,.55);border-top:1px solid #6c6657;border-bottom:1px solid #6c6657;opacity:0;transition:opacity .3s;max-width:60%;text-align:center;text-transform:uppercase}
.pa.on{opacity:1}.pa:before{content:"P.A. ▸ ";color:var(--red2)}
.mini{position:absolute;right:2.2%;bottom:3.4%;width:20vmin;height:20vmin;border:1px solid rgba(255,255,255,.15);background:rgba(0,0,0,.4);opacity:.92}
.mini canvas{width:100%;height:100%;display:block}
.mini.off{display:none}
.note{position:absolute;left:50%;top:2.2%;transform:translateX(-50%);font-size:1.45vmin;letter-spacing:.14em;color:#e8dca8;background:rgba(0,0,0,.66);border:1px solid rgba(232,220,168,.35);padding:.7vmin 2vmin;opacity:0;transition:opacity .3s;text-transform:uppercase;max-width:78%;text-align:center}
.note.on{opacity:1}.note b{color:var(--red2);margin-right:.8vmin}
.panel{position:absolute;inset:7% 14%;background:rgba(7,7,9,.94);border:1px solid rgba(255,255,255,.14);display:none;pointer-events:auto;padding:2.4vmin 3vmin;overflow:hidden}
.panel.on{display:block}
.panel h2{margin:0 0 1.6vmin;font-size:1.3vmin;letter-spacing:.5em;color:var(--red2);font-weight:400;text-transform:uppercase}
.tabs{display:flex;gap:2vmin;margin-bottom:2vmin;border-bottom:1px solid rgba(255,255,255,.1)}
.tabs span{font-size:1.45vmin;letter-spacing:.24em;padding:.7vmin 0;color:var(--dim);cursor:pointer;text-transform:uppercase}
.tabs span.on{color:var(--ink);border-bottom:2px solid var(--red)}
.pbody{font-size:1.7vmin;line-height:1.55;height:calc(100% - 9vmin);overflow:auto}
.pbody .row{display:flex;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.07);padding:.5vmin 0}
.pbody .done{color:var(--dim);text-decoration:line-through}
.pbody .h{color:var(--red2);letter-spacing:.3em;font-size:1.2vmin;margin-top:1.6vmin;text-transform:uppercase}
.bar{height:.6vmin;background:rgba(255,255,255,.1);position:relative;width:18vmin;margin-top:.9vmin}
.bar i{position:absolute;top:0;bottom:0;background:var(--ink)}
.bar .mid{position:absolute;left:50%;top:-.3vmin;bottom:-.3vmin;width:1px;background:#666}
.doc{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotate(-1.2deg);width:46vmin;padding:3.4vmin 3.6vmin;background:#d8d0b4 url();color:#161410;font-family:"Courier New",monospace;font-size:1.55vmin;line-height:1.5;box-shadow:0 1.5vmin 5vmin #000;display:none;pointer-events:auto;text-transform:none}
.doc.on{display:block}
.doc h3{margin:0 0 1.2vmin;font-size:1.9vmin;letter-spacing:.12em;border-bottom:2px solid #161410;padding-bottom:.6vmin}
.doc .stamp{position:absolute;right:3vmin;top:7vmin;border:3px solid #9a1b1b;color:#9a1b1b;padding:.2vmin 1.2vmin;transform:rotate(9deg);font-weight:700;letter-spacing:.18em;font-size:2.3vmin;opacity:.82}
.doc .sig{font-family:"Brush Script MT",cursive;font-size:2.4vmin;color:#1c2a5a}
.doc .hint{margin-top:2vmin;font-size:1.1vmin;color:#6a6350;letter-spacing:.2em;text-align:center}
.shop{inset:12% 24%}
.shop .item{display:flex;justify-content:space-between;align-items:center;padding:1vmin 1.4vmin;margin:.6vmin 0;background:rgba(255,255,255,.04);border-left:3px solid var(--red);cursor:pointer;font-size:1.8vmin}
.shop .item:hover{background:rgba(70,10,14,.7)}
.shop .item em{color:var(--red2);font-style:normal;margin-right:1.4vmin}
.shop .item small{color:var(--dim);display:block;font-size:1.25vmin}
.shop .price{color:#d4b45a;letter-spacing:.1em}
.ovl{position:absolute;inset:0;display:none;pointer-events:auto;align-items:center;justify-content:center;flex-direction:column;text-align:center;background:#000}
.ovl.on{display:flex}
.ovl.clear{background:transparent}
.disc{background:#000}
.disc h1{font-size:3.6vmin;letter-spacing:.5em;color:var(--red2);margin:0 0 3vmin;font-weight:400}
.disc p{max-width:64vmin;font-size:1.9vmin;line-height:1.6;color:#bdb6a6;margin:.6vmin 0}
.disc .load{width:38vmin;height:.5vmin;background:rgba(255,255,255,.12);margin:3vmin 0 1.4vmin}
.disc .load i{display:block;height:100%;width:0;background:var(--red)}
.disc .cnt{font-size:1.4vmin;letter-spacing:.35em;color:var(--dim);text-transform:uppercase}
.btn{pointer-events:auto;cursor:pointer;font:inherit;font-size:1.9vmin;letter-spacing:.34em;color:var(--ink);background:transparent;border:1px solid rgba(255,255,255,.28);padding:1.1vmin 4vmin;margin:.7vmin;text-transform:uppercase}
.btn:hover:not(:disabled){background:rgba(179,32,42,.55);border-color:var(--red2)}
.btn:disabled{opacity:.3;cursor:default}
.title{background:linear-gradient(180deg,rgba(0,0,0,.55),rgba(0,0,0,.15) 40%,rgba(0,0,0,.65))}
.title h1{font-size:9vmin;letter-spacing:.32em;margin:0;font-weight:700;color:#e8e0d0;text-shadow:0 0 30px rgba(179,32,42,.55),0 4px 18px #000;padding-left:.32em}
.title h1 span{color:var(--red2)}
.title h2{font-size:1.9vmin;letter-spacing:.9em;color:var(--dim);margin:1.2vmin 0 5vmin;font-weight:400;padding-left:.9em;text-transform:uppercase}
.title .ver{position:absolute;bottom:2.4vmin;left:2.4vmin;font-size:1.2vmin;letter-spacing:.25em;color:#6a6458;text-transform:uppercase}
.end{background:rgba(0,0,0,.88)}
.end h1{font-size:5.4vmin;letter-spacing:.4em;font-weight:400;margin:0;padding-left:.4em}
.end h2{font-size:1.5vmin;letter-spacing:.7em;color:var(--red2);margin:1vmin 0 3.4vmin;font-weight:400;text-transform:uppercase}
.end .stats{display:grid;grid-template-columns:repeat(4,16vmin);gap:1.4vmin;margin-bottom:3vmin}
.end .stats div{border-top:1px solid rgba(255,255,255,.2);padding-top:1vmin;font-size:1.2vmin;letter-spacing:.2em;color:var(--dim);text-transform:uppercase}
.end .stats b{display:block;font-size:2.8vmin;color:var(--ink);letter-spacing:.04em;margin-bottom:.4vmin;font-weight:400}
.end .next{font-size:1.4vmin;letter-spacing:.2em;color:var(--dim);max-width:70vmin;line-height:1.9;text-transform:uppercase}
.pause{background:rgba(0,0,0,.72)}
.pause h1{font-size:3vmin;letter-spacing:.6em;font-weight:400;margin:0 0 3vmin;padding-left:.6em}
.help{font-size:1.45vmin;letter-spacing:.12em;color:var(--dim);margin-top:2.4vmin;line-height:1.9;text-transform:uppercase}
.help b{color:var(--ink);font-weight:400}
.card h1{font-size:8vmin;letter-spacing:.34em;font-weight:700;margin:0;color:#e8e0d0;text-shadow:0 0 40px rgba(179,32,42,.7),0 4px 20px #000;padding-left:.34em;animation:cardin 3s ease-out both}
.card h1 span{color:var(--red2)}
.card h2{font-size:1.9vmin;letter-spacing:.9em;font-weight:400;color:var(--dim);margin:1.4vmin 0 0;padding-left:.9em;text-transform:uppercase;animation:cardin 4s ease-out both}
@keyframes cardin{0%{opacity:0;letter-spacing:.7em}100%{opacity:1}}
.caption{position:absolute;left:2.2%;bottom:20%;max-width:40%;font-size:1.65vmin;line-height:1.45;color:#ffe9a8;background:rgba(0,0,0,.62);border-left:3px solid #ffd66b;padding:.9vmin 1.6vmin;opacity:0;transition:opacity .35s;text-shadow:0 0 6px #000}
.caption.on{opacity:1}.caption b{display:block;font-size:1.1vmin;letter-spacing:.3em;color:#ffd66b;margin-bottom:.3vmin;text-transform:uppercase}
.fps{position:absolute;left:1%;top:1%;font:11px monospace;color:#7f7;display:none;text-transform:none}
`;

export class UI {
  constructor(root, game) {
    this.root = root; this.game = game;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    root.innerHTML = `
      <div class="hud" id="hud">
        <div class="tl"><div class="clock" id="u-clock">06:00<small>DAY 1</small></div><div class="slot" id="u-slot">COUNT</div><div class="slotbar"><i id="u-slotbar"></i></div>
          <div class="obj" id="u-obj"><b>Objective</b><span id="u-objtext"></span></div></div>
        <div class="tr"><div class="dc" id="u-dc"><small>DC</small><span id="u-dcv">50</span></div><div class="rep" id="u-rep"></div></div>
        <div class="bl">
          <div class="vit hp"><span>HP</span><i><b id="u-hp"></b></i></div><div class="vit fd"><span>FOOD</span><i><b id="u-fd"></b></i></div>
          <div class="vit wt"><span>WATER</span><i><b id="u-wt"></b></i></div><div class="vit st"><span>STAM</span><i><b id="u-st"></b></i></div></div>
        <div class="cross" id="u-cross"></div>
        <div class="prompt" id="u-prompt"><div><kbd id="u-key">E</kbd><span id="u-ptext"></span></div><span class="why" id="u-why"></span><div class="hold"><i id="u-hold"></i></div></div>
        <div class="detect" id="u-detect"><span>◉</span></div>
        <div class="alertbar" id="u-alert"></div>
        <div class="pa" id="u-pa"></div>
        <div class="toasts" id="u-toasts"></div>
        <div class="mini" id="u-mini"><canvas id="u-minic" width="320" height="320"></canvas></div>
      </div>
      <div class="note" id="u-note"></div>
      <div class="sub" id="u-sub"><span class="who" id="u-who"></span><div class="txt" id="u-txt"></div><span class="cont" id="u-cont">SPACE ▸</span></div>
      <div class="choices" id="u-choices"></div>
      <div class="panel" id="u-panel"><h2>Case file — Inmate 1106553</h2><div class="tabs" id="u-tabs"></div><div class="pbody" id="u-pbody"></div></div>
      <div class="panel shop" id="u-shop"><h2>Commissary</h2><div class="pbody" id="u-shopbody"></div></div>
      <div class="doc" id="u-doc"></div>
      <div class="caption" id="u-caption"><b></b><span></span></div>
      <div class="ovl disc" id="u-disc"><h1>NYGHTSHADE HOLLOW</h1>
        <p class="caps" style="color:#d9a16a;letter-spacing:.3em;font-size:1.5vmin">Content advisory</p>
        <p>This game contains extreme language, offensive AI-driven characters, violence, and adult themes set inside a maximum-security prison.</p>
        <p>It is a work of fiction. Choices you make affect reputation, fear, and who survives. Player discretion is advised.</p>
        <div class="load"><i id="u-load"></i></div><div class="cnt" id="u-cnt">Preparing prison systems…</div>
        <button class="btn" id="u-accept" disabled style="margin-top:2.4vmin">I understand</button></div>
      <div class="ovl title" id="u-title"><h1>NYGHT<span>SHADE</span> HOLLOW</h1><h2>The Intake</h2>
        <button class="btn" id="u-new">New Game</button><button class="btn" id="u-cont2">Continue</button><button class="btn" id="u-ctrl">Controls</button>
        <div class="help" id="u-helptitle" style="display:none"></div><div class="ver">Vertical slice · v0.2 · WebGL</div></div>
      <div class="ovl pause" id="u-pause"><h1>Paused</h1><button class="btn" id="u-resume">Resume</button><button class="btn" id="u-save">Save</button><button class="btn" id="u-qual">Quality: High</button><button class="btn" id="u-quit">Quit to title</button>
        <div class="help" id="u-helppause"></div></div>
      <div class="ovl end" id="u-end"></div>
      <div class="ovl clear card" id="u-card" style="pointer-events:none"></div>
      <div class="fps" id="u-fps"></div>`;
    this.el = (id) => root.querySelector('#' + id);
    this.help = `<b>W A S D</b> move · <b>Shift</b> run · <b>C</b> crouch · <b>E</b> interact (hold for long actions) · <b>Space</b> advance dialogue · <b>1-4</b> choose<br><b>Tab</b> journal · <b>M</b> minimap · <b>T</b> hold to wait (fast-forward) · <b>Esc</b> pause`;
    this.el('u-helppause').innerHTML = this.help;
    this.el('u-helptitle').innerHTML = this.help;
    this.tabIdx = 0; this.panelOpen = false; this.shopOpen = false; this.docOpen = false;
    this._sub = null; this._typing = null;
    this.miniCtx = this.el('u-minic').getContext('2d');
    this.toasts = this.el('u-toasts');
  }

  show(id, on = true) { this.el(id).classList.toggle('on', on); }
  hud(on) { this.show('hud', on); }

  setClock(clock, day, slotLabel, slotProg) {
    this.el('u-clock').innerHTML = `${clock}<small>DAY ${day}</small>`;
    this.el('u-slot').textContent = slotLabel;
    this.el('u-slotbar').style.width = (slotProg * 100).toFixed(0) + '%';
  }
  setObjective(text) { this.el('u-objtext').textContent = text || ''; this.el('u-obj').style.display = text ? '' : 'none'; }
  setDC(v, flash = false) {
    this.el('u-dcv').textContent = v;
    if (flash) { const e = this.el('u-dc'); e.classList.remove('flash'); void e.offsetWidth; e.classList.add('flash'); }
  }
  setRep(rep) { this.el('u-rep').innerHTML = `CRED <b>${rep.streetCred}</b> · FEAR <b>${Math.round(rep.fear)}</b> · <b>${rep.tier}</b>`; }
  setVitals(hp, fd, wt, st) {
    const set = (id, v, low) => { const e = this.el(id); e.style.width = clamp(v, 0, 100) + '%'; e.parentElement.parentElement.classList.toggle('low', v < low); };
    set('u-hp', hp, 30); set('u-fd', fd, 20); set('u-wt', wt, 20); set('u-st', st, 20);
  }
  setPrompt(text, { key = 'E', why = '', hold = -1 } = {}) {
    const p = this.el('u-prompt');
    if (!text) { if (p.classList.contains('on')) p.classList.remove('on'); this.el('u-cross').classList.remove('hot'); return; }
    p.classList.add('on'); this.el('u-cross').classList.add('hot');
    if (this._pt !== text) { this.el('u-ptext').textContent = text; this._pt = text; }
    if (this._pk !== key) { this.el('u-key').textContent = key; this._pk = key; }
    if (this._pw !== why) { this.el('u-why').textContent = why; this._pw = why; }
    const h = p.querySelector('.hold'); h.style.display = hold >= 0 ? 'block' : 'none'; if (hold >= 0) this.el('u-hold').style.width = (hold * 100).toFixed(0) + '%';
  }
  toast(text, kind = '') { const d = document.createElement('div'); d.className = 'toast ' + kind; d.textContent = text; this.toasts.appendChild(d); setTimeout(() => d.remove(), 3700); while (this.toasts.children.length > 5) this.toasts.firstChild.remove(); }
  setDetect(v) { const d = this.el('u-detect'); d.classList.toggle('on', v > 0.04); d.style.setProperty('--p', (v * 100).toFixed(0) + '%'); }
  setAlert(level) { const a = this.el('u-alert'); a.classList.toggle('on', level >= 1); a.textContent = level >= 1 ? ALERT_LABEL[level] + (level >= 2 ? ' — GUARDS SEARCHING' : '') : ''; a.style.background = level >= 3 ? 'rgba(160,0,0,.85)' : level === 2 ? 'rgba(120,10,16,.78)' : 'rgba(90,70,10,.7)'; a.style.borderColor = level === 1 ? '#c9a23a' : ''; }
  pa(text) { const e = this.el('u-pa'); e.textContent = text; e.classList.add('on'); clearTimeout(this._paT); this._paT = setTimeout(() => e.classList.remove('on'), 6500); }
  note(label, text, ms = 6000) { const e = this.el('u-note'); e.innerHTML = `<b>${label}</b>${text}`; e.classList.add('on'); clearTimeout(this._nT); this._nT = setTimeout(() => e.classList.remove('on'), ms); }
  caption(title, text) { const e = this.el('u-caption'); if (!title) { e.classList.remove('on'); return; } e.querySelector('b').textContent = title; e.querySelector('span').textContent = text; e.classList.add('on'); }
  fps(txt) { const e = this.el('u-fps'); e.style.display = txt ? 'block' : 'none'; e.textContent = txt || ''; }

  // ---- subtitles / dialogue ----------------------------------------------------------------
  /** Typewriter subtitle. Returns a handle {done:boolean, finish()}. */
  say(who, text, { inner = false, cps = 38, cont = true, onChar = null } = {}) {
    const s = this.el('u-sub'); s.classList.toggle('inner', inner);
    this.el('u-who').textContent = who || ''; this.el('u-who').style.display = who ? 'block' : 'none';
    this.el('u-cont').style.display = cont ? 'block' : 'none';
    s.classList.add('on');
    const t = this.el('u-txt'); t.textContent = '';
    const h = { text, i: 0, acc: 0, done: false, cps, onChar, finish: () => { h.i = text.length; t.textContent = text; h.done = true; } };
    this._typing = h; return h;
  }
  tick(dt) {
    const h = this._typing; if (!h || h.done) return;
    h.acc += dt * h.cps;
    const n = Math.floor(h.acc);
    if (n > 0) {
      h.acc -= n;
      for (let k = 0; k < n && h.i < h.text.length; k++) { h.i++; if (h.onChar && (h.i % 3 === 0) && h.text[h.i - 1] !== ' ') h.onChar(h.text[h.i - 1]); }
      this.el('u-txt').textContent = h.text.slice(0, h.i);
      if (h.i >= h.text.length) h.done = true;
    }
  }
  clearSay() { this.el('u-sub').classList.remove('on'); this._typing = null; }
  setChoices(list, onPick) {
    const c = this.el('u-choices'); c.innerHTML = '';
    list.forEach((ch, i) => {
      const b = document.createElement('button');
      b.innerHTML = `<em>${i + 1}</em>${ch.text}${ch.cost ? `<small>${ch.cost} DC</small>` : ''}`;
      if (ch.disabled) b.classList.add('dis');
      b.onclick = () => onPick(i);
      c.appendChild(b);
    });
    c.classList.toggle('on', list.length > 0);
    this.el('u-cont').style.display = list.length ? 'none' : 'block';
  }

  // ---- panels --------------------------------------------------------------------------------
  openPanel(on) { this.panelOpen = on; this.show('u-panel', on); if (on) this.renderPanel(); }
  renderPanel() {
    const g = this.game;
    const tabs = ['Objectives', 'Inventory', 'Reputation', 'Schedule', 'Controls'];
    this.el('u-tabs').innerHTML = tabs.map((t, i) => `<span class="${i === this.tabIdx ? 'on' : ''}" data-i="${i}">${t}</span>`).join('');
    this.el('u-tabs').querySelectorAll('span').forEach((s) => { s.onclick = () => { this.tabIdx = +s.dataset.i; this.renderPanel(); }; });
    const b = this.el('u-pbody');
    let h = '';
    if (this.tabIdx === 0) {
      h += `<div class="h">The Intake</div>`;
      for (const q of g.story.journal()) h += `<div class="row ${q.done ? 'done' : ''}"><span>${q.text}</span><span>${q.done ? '✓' : q.current ? '▸' : ''}</span></div>`;
    } else if (this.tabIdx === 1) {
      h += `<div class="h">Carrying (${g.inventory.slots.length}/${g.inventory.max})</div>`;
      if (!g.inventory.slots.length) h += '<div class="row"><span>Nothing but what the state gave you.</span></div>';
      for (const s of g.inventory.slots) { const d = ITEMS[s.id]; h += `<div class="row"><span>${d.icon} ${d.name}${s.n > 1 ? ' ×' + s.n : ''}<br><small style="color:var(--dim)">${d.desc}</small></span><span>${d.doc ? '<u data-doc="' + s.id + '" style="cursor:pointer;color:#d4b45a">READ</u>' : ''}</span></div>`; }
      h += `<div class="h">Ledger of DC</div>`;
      for (const l of g.economy.log.slice(0, 8)) h += `<div class="row"><span>${l}</span></div>`;
    } else if (this.tabIdx === 2) {
      const r = g.reputation;
      h += `<div class="h">Standing</div><div class="row"><span>Street Cred</span><span>${r.streetCred} — ${r.tier}</span></div><div class="row"><span>Fear</span><span>${Math.round(r.fear)} / 100</span></div>`;
      h += `<div class="h">Factions</div>`;
      for (const f of FACTIONS) { const v = r.standing[f]; h += `<div class="row"><span>${FACTION_LABEL[f]}${v >= r.ally ? ' — ALLY' : v <= r.enemy ? ' — ENEMY' : ''}<div class="bar"><div class="mid"></div><i style="${v >= 0 ? `left:50%;width:${v / 2}%` : `right:50%;width:${-v / 2}%`};background:${v >= 0 ? '#9ab26a' : '#b84040'}"></i></div></span><span>${v > 0 ? '+' : ''}${v}</span></div>`; }
    } else if (this.tabIdx === 3) {
      h += `<div class="h">Daily routine</div>`;
      for (const e of SCHEDULE) { const cur = g.routine.entry === e; h += `<div class="row" style="${cur ? 'color:#e0323d' : ''}"><span>${fmtClock(e.start)} – ${fmtClock((e.start + e.dur) % 24)}</span><span>${SLOT_LABEL[e.slot]}${e.mandatory ? ' *' : ''}</span></div>`; }
      h += `<div class="help" style="margin-top:1.4vmin">* mandatory — be where you're supposed to be.</div>`;
    } else h += `<div class="help" style="font-size:1.7vmin">${this.help}</div>`;
    b.innerHTML = h;
    b.querySelectorAll('[data-doc]').forEach((e) => { e.onclick = () => g.story.readDoc(e.dataset.doc); });
  }
  cycleTab(d = 1) { this.tabIdx = (this.tabIdx + d + 5) % 5; this.renderPanel(); }

  openShop(items, onBuy) {
    this.shopOpen = true; this.show('u-shop', true);
    const b = this.el('u-shopbody');
    b.innerHTML = `<div class="row"><span>Balance</span><span class="price">${this.game.economy.balance} DC</span></div>` + items.map((it, i) => `<div class="item" data-i="${i}"><span><em>${i + 1}</em>${it.name}<small>${it.desc}</small></span><span class="price">${it.price} DC</span></div>`).join('') + `<div class="help" style="margin-top:1.4vmin">1-${items.length} buy · E / Esc leave</div>`;
    b.querySelectorAll('.item').forEach((e) => { e.onclick = () => onBuy(+e.dataset.i); });
  }
  closeShop() { this.shopOpen = false; this.show('u-shop', false); }
  openDoc(html) { this.docOpen = true; const d = this.el('u-doc'); d.innerHTML = html; d.classList.add('on'); }
  closeDoc() { this.docOpen = false; this.el('u-doc').classList.remove('on'); }

  // ---- minimap -------------------------------------------------------------------------------
  drawMinimap(game) {
    const c = this.miniCtx, W = 320, H = 320;
    c.clearRect(0, 0, W, H);
    const p = game.player, span = 56, s = W / span;
    const tx = (x) => (x - p.pos.x) * s + W / 2, tz = (z) => (z - p.pos.z) * s + H / 2;
    c.save(); c.beginPath(); c.rect(0, 0, W, H); c.clip();
    for (const a of game.world.areas.values()) {
      if (a.tag === 'outdoor' || a.tag === 'tunnel') { if (!(game.player.area && game.player.area.tag === a.tag)) continue; }
      if (game.player.pos.y > -1 && a.tag === 'tunnel') continue;
      if (game.player.pos.y < -1 && a.tag !== 'tunnel') continue;
      const [x0, z0, x1, z1] = a.bounds;
      c.fillStyle = a.name === game.player.area?.name ? 'rgba(180,170,150,.16)' : 'rgba(180,170,150,.07)';
      c.strokeStyle = 'rgba(210,200,180,.4)'; c.lineWidth = 1;
      c.fillRect(tx(x0), tz(z0), (x1 - x0) * s, (z1 - z0) * s); c.strokeRect(tx(x0), tz(z0), (x1 - x0) * s, (z1 - z0) * s);
    }
    // objective marker
    const o = game.story.objectivePos();
    if (o) { const ox = tx(o.x), oz = tz(o.z); c.fillStyle = '#e0323d'; c.beginPath(); c.arc(clamp(ox, 8, W - 8), clamp(oz, 8, H - 8), 5, 0, 6.28); c.fill(); }
    // guards + cones
    for (const n of game.npcs) {
      if (n.role !== 'guard' || !n.alive || n.hiddenFromWorld) continue;
      const gx = tx(n.pos.x), gz = tz(n.pos.z);
      c.fillStyle = n.mode === 'chase' ? '#ff3030' : n.detect > 0.2 ? '#ffb030' : '#6f8fcf';
      c.beginPath(); c.arc(gx, gz, 4, 0, 6.28); c.fill();
      c.fillStyle = 'rgba(111,143,207,.18)'; c.beginPath(); c.moveTo(gx, gz);
      const a0 = -n.yaw - Math.PI / 2 - n.fov / 2, a1 = a0 + n.fov;
      c.arc(gx, gz, Math.min(n.range, 14) * s, a0 + 0, a1 + 0); c.closePath(); c.fill();
    }
    // player
    c.translate(W / 2, H / 2); c.rotate(-p.yaw);
    c.fillStyle = '#e8e0d0'; c.beginPath(); c.moveTo(0, -8); c.lineTo(5.5, 6); c.lineTo(0, 3); c.lineTo(-5.5, 6); c.closePath(); c.fill();
    c.restore();
  }

  /** Big cinematic title card. */
  card(html, on = true) { const c = this.el('u-card'); if (html !== null && html !== undefined) c.innerHTML = html; c.classList.toggle('on', on); c.style.opacity = on ? '1' : '0'; }

  // ---- full-screen states --------------------------------------------------------------------
  showEnd(stats) {
    const e = this.el('u-end');
    e.innerHTML = `<h1>FOUR HOURS</h1><h2>The Intake — end of vertical slice</h2>
      <div class="stats"><div><b>${stats.time}</b>Play time</div><div><b>${stats.dc}</b>DC earned</div><div><b>${stats.cred}</b>Street cred</div><div><b>${stats.route}</b>Route to Records</div></div>
      <div class="next">Next: Yard &amp; Gym factions · Visitation · Hit Market · Arianna's office · Valley's arrival</div>
      <div style="margin-top:3vmin"><button class="btn" id="u-endtitle">Title</button><button class="btn" id="u-endagain">Play again</button></div>`;
    e.classList.add('on');
    e.querySelector('#u-endtitle').onclick = () => this.game.toTitle();
    e.querySelector('#u-endagain').onclick = () => this.game.newGame();
  }
  hideEnd() { this.el('u-end').classList.remove('on'); }
}
