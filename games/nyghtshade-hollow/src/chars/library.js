// Character library: finds `assets/characters/manifest.json`, loads the glTF characters it lists (MetaHuman exports, optimised with
// tools/metahuman/optimize.mjs) and hands out GltfHuman bodies.  Everything is optional: with no manifest the game keeps its
// procedural humans and this module is inert.
//
//   manifest.json  { "characters": [ { "id": "gavin", "file": "gavin.glb", "crowd": "gavin_crowd.glb", "looks": ["inmateA", "guard"], "height": 1.82 }, … ],
//                    "defaults": { "height": 1.78 } }
//   crowd (optional) = a much lighter export of the same character (e.g. optimize.mjs --tris 8000 --tex 256) used for the baked background crowd.
//   looks = the `look` names the game asks for (see LOOKS in humanoid.js: guard, guardLight, inmateA/B/C, cutter, tuck, harrington, maddox …);
//   several characters may share a look (the crowd picks one per NPC from its seed), "*" matches any look.
//
// Query overrides:  ?chars=off (procedural only) · ?chars=/some/url/ (another folder)
// Build-time embedding (single-file dist): tools/build.mjs --embed-characters puts every file of the folder into window.__NH_CHARS (base64).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { analyzeTemplate, GltfHuman } from './gltf-human.js';
import { LOOKS } from './humanoid.js';
import { hash01 } from '../util.js';

const b64ToBuf = (b64) => { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; };

export class CharacterLibrary {
  constructor() {
    this.status = 'idle';          // idle | loading | ready | none | error
    this.specs = [];               // manifest entries that loaded
    this.failed = [];              // { id, error }
    this.templates = new Map();    // spec.id -> template
    this.progress = 0;
    this.ready = Promise.resolve();
    this.base = '';
    this.listeners = [];
  }
  get enabled() { return this.templates.size > 0; }
  onReady(fn) { this.ready.then(() => fn(this)); }

  /** Begin loading (once).  Never rejects; `ready` resolves when every listed character has loaded or failed. */
  init(base = 'assets/characters/', { search = (typeof location !== 'undefined' ? location.search : ''), timeoutMs = 45000 } = {}) {
    if (this.status !== 'idle') return this.ready;
    const q = new URLSearchParams(search);
    const override = q.get('chars');
    if (override === 'off' || override === '0') { this.status = 'none'; return this.ready; }
    if (override && override !== 'on') base = override;
    this.status = 'loading';
    this.base = base.endsWith('/') ? base : base + '/';
    this.ready = Promise.race([this._load(), new Promise((r) => setTimeout(() => { if (this.status === 'loading') { this.status = this.templates.size ? 'ready' : 'error'; console.warn('[NH] characters: timed out'); } r(); }, timeoutMs))]).then(() => this);
    return this.ready;
  }

  async _fetch(name, asText = false) {
    const emb = typeof window !== 'undefined' && window.__NH_CHARS;
    if (emb && emb[name]) { const buf = b64ToBuf(emb[name]); return asText ? new TextDecoder().decode(buf) : buf; }
    const r = await fetch(new URL(this.base + name, typeof document !== 'undefined' ? document.baseURI : 'http://localhost/').href);
    if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
    return asText ? r.text() : r.arrayBuffer();
  }

  async _load() {
    if (typeof location !== 'undefined' && location.protocol === 'file:' && !(typeof window !== 'undefined' && window.__NH_CHARS)) {      // a file:// page cannot fetch: characters need a web server or --embed-characters
      this.status = 'none'; console.log('[NH] characters: opened from file:// — procedural humans (serve the folder or build with --embed-characters to use character files)'); return;
    }
    let manifest;
    try { manifest = JSON.parse(await this._fetch('manifest.json', true)); }
    catch (e) { this.status = 'none'; console.log('[NH] characters: no manifest — procedural humans'); return; }
    const list = (manifest.characters || []).filter((c) => c && c.file);
    if (!list.length) { this.status = 'none'; return; }
    const defaults = manifest.defaults || {};
    const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
    let done = 0;
    const jobs = list.map((spec, i) => (async () => {
      try {
        const buf = await this._fetch(spec.file);
        const gltf = await loader.parseAsync(buf, '');
        const tpl = analyzeTemplate(gltf.scene, gltf.animations || []);
        const full = { height: defaults.height, ...spec, id: spec.id || spec.file };
        this.specs.push(full); this.templates.set(full.id, tpl);
        if (spec.crowd) {                                                         // lighter variant for the baked crowd; the full one is used if it cannot be read
          try { const cg = await loader.parseAsync(await this._fetch(spec.crowd), ''); const ct = analyzeTemplate(cg.scene, cg.animations || []); this.templates.set(full.id + '#crowd', ct); console.log(`[NH] character ${full.id} (crowd): ${ct.bones} bones, ${ct.tris} tris`); }
          catch (e) { console.warn('[NH] crowd variant failed:', spec.crowd, String(e.message || e).slice(0, 160)); }
        }
        console.log(`[NH] character ${full.id}: ${tpl.rig} rig, ${tpl.bones} bones, ${tpl.tris} tris, ${tpl.height.toFixed(2)} m${tpl.usable ? '' : ' (skeleton not recognised: static pose)'}`);
        for (const w of tpl.warnings || []) console.warn(`[NH] character ${full.id}: ${w}`);
      } catch (e) { this.failed.push({ id: spec.id || spec.file, error: String(e.message || e) }); console.warn('[NH] character failed:', spec.file, String(e.message || e).slice(0, 200)); }
      this.progress = ++done / list.length;
    })());
    await Promise.all(jobs);
    this.specs.sort((a, b) => list.findIndex((c) => (c.id || c.file) === a.id) - list.findIndex((c) => (c.id || c.file) === b.id));
    this.status = this.templates.size ? 'ready' : 'error';
  }

  /** Manifest entry for a look; several candidates are chosen by seed so the same NPC always gets the same character. */
  specFor(look, seed = 1) {
    const c = this.specs.filter((s) => (s.looks || ['*']).includes(look) || (s.looks || ['*']).includes('*'));
    if (!c.length) return null;
    const exact = c.filter((s) => (s.looks || []).includes(look));
    const pool = exact.length ? exact : c;
    return pool[Math.floor(hash01(seed * 12.9898 + 78.233) * pool.length) % pool.length];
  }

  /** A GltfHuman for this look/seed, or null when none is available (caller keeps the procedural Humanoid).  crowd: use the light variant if the manifest has one. */
  create(look, { seed = 1, scale = 1, crowd = false } = {}) {
    const spec = this.specFor(look, seed);
    if (!spec) return null;
    const tpl = (crowd && this.templates.get(spec.id + '#crowd')) || this.templates.get(spec.id);
    if (!tpl) return null;
    const lookScale = (typeof look === 'string' && LOOKS[look] ? LOOKS[look].scale || 1 : 1);
    const jitter = 1 + (hash01(seed * 3.7 + 1.1) - 0.5) * 0.05;                 // ±2.5 % so a repeated character is not a clone
    const height = (spec.height || 1.78 * lookScale) * jitter;                  // an explicit manifest height wins over the look's relative scale
    return new GltfHuman(tpl, look, { seed, scale, height });
  }
}

/** The shared instance (the game, NPCs and tools all use this one). */
export const characters = new CharacterLibrary();
