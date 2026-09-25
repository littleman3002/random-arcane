/* Arcane Hand — presentation layer. Reads simulation state; writes only through sim.apply(). */
(function () {
'use strict';
const { Sim, DT, W, H, ELEMENTS, ARCHES, TIERS, ABILITIES, ABILITY_INFO, MT, MT_KEYS, COST, F_FLY, F_BOSS, F_ELITE, CAP } = AH;
const Q = new URLSearchParams(location.search);
const TEST = Q.has('test');
const $ = (s) => document.querySelector(s);

// ------------------------------------------------------------------ settings (persisted)
const SETTINGS_KEY = 'ah.settings.v1';
const settings = Object.assign({ quality: 'medium', showPerf: Q.has('debug'), reducedMotion: false, glyphs: true, bestScore: 0 },
  (() => { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch (e) { return {}; } })());
function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* storage unavailable */ } }
if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches && settings.reducedMotion === false && !localStorage.getItem?.(SETTINGS_KEY)) settings.reducedMotion = true;

// ------------------------------------------------------------------ palette
const EL_COL = { ember: 0xEE6A34, tide: 0x3FA0E8, grove: 0x7CC24A, void: 0xA56BF0, storm: 0xF4DA4A, iron: 0xA9ADB3 };
const EL_CSS = { ember: '#EE6A34', tide: '#3FA0E8', grove: '#7CC24A', void: '#A56BF0', storm: '#F4DA4A', iron: '#A9ADB3' };
const TIER_CSS = ['#BDB6A4', '#7FB7D9', '#5CC9A7', '#E89A4A', '#F2C94C'];
const TIER_COL = [0xBDB6A4, 0x7FB7D9, 0x5CC9A7, 0xE89A4A, 0xF2C94C];
const MON_COL = { grub: 0x5A3E33, skitter: 0x2E2A35, dasher: 0x9C3F2C, bulwark: 0x6A4B32, troll: 0x6E7A3A, wisp: 0xD8E6F0,
  knight: 0x34466E, budling: 0x9A7430, boss: 0x3A2C45 };

// ------------------------------------------------------------------ SVG icons (shape carries meaning, not just color)
const SVG = (p, extra = '') => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${p}</svg>`;
const EL_ICON = {
  ember: SVG('<path d="M12 3 20 20H4Z" fill="currentColor" fill-opacity=".25"/>'),
  tide: SVG('<path d="M3 9c3-3 6 3 9 0s6 3 9 0M3 15c3-3 6 3 9 0s6 3 9 0"/>'),
  grove: SVG('<path d="M12 21v-7"/><circle cx="12" cy="8" r="5" fill="currentColor" fill-opacity=".25"/><circle cx="7" cy="12" r="3"/><circle cx="17" cy="12" r="3"/>'),
  void: SVG('<path d="M12 3a9 9 0 1 1-8.5 6"/><circle cx="12" cy="12" r="3"/>'),
  storm: SVG('<path d="M13 2 5 14h6l-1 8 8-12h-6z" fill="currentColor" fill-opacity=".25"/>'),
  iron: SVG('<rect x="4" y="4" width="16" height="16" rx="1" fill="currentColor" fill-opacity=".25"/><path d="M4 12h16M12 4v16"/>'),
};
const AB_ICON = {
  slow: SVG('<path d="M12 2v20M4 7l16 10M4 17 20 7"/>'), burn: SVG('<path d="M12 22c4 0 7-3 7-7 0-5-5-7-5-12-3 2-4 5-4 7-1-1-2-2-2-4-2 2-3 5-3 9 0 4 3 7 7 7z"/>'),
  splash: SVG('<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3"/>'),
  chain: SVG('<path d="M3 17 8 7l4 10 4-10 5 10"/>'), pierce: SVG('<path d="M3 12h16M14 7l5 5-5 5"/>'),
  aura: SVG('<circle cx="12" cy="12" r="8" stroke-dasharray="3 3"/><circle cx="12" cy="12" r="2"/>'),
  skyward: SVG('<path d="M6 14l6-6 6 6M6 20l6-6 6 6"/>'), shred: SVG('<path d="M12 3l2 4 4-1-1 4 4 2-4 2 1 4-4-1-2 4-2-4-4 1 1-4-4-2 4-2-1-4 4 1z"/>'),
};
const I = {
  gold: SVG('<circle cx="12" cy="12" r="8" fill="currentColor" fill-opacity=".3"/><path d="M9 12h6"/>'),
  vault: SVG('<path d="M12 2 20 8v8l-8 6-8-6V8z" fill="currentColor" fill-opacity=".25"/>'),
  wave: SVG('<path d="M4 18c2-6 6-10 16-12M4 12c3-3 6-4 10-4"/>'),
  lock: SVG('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  merge: SVG('<path d="M6 3v6a6 6 0 0 0 6 6h0a6 6 0 0 0 6-6V3M12 15v6"/>'),
  spark: SVG('<path d="M12 3v6M12 15v6M3 12h6M15 12h6"/>'), sell: SVG('<path d="M4 7h16l-2 13H6zM9 7V4h6v3"/>'),
  home: SVG('<path d="M3 11 12 4l9 7M5 10v10h14V10"/>'), dice: SVG('<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="15" r="1" fill="currentColor"/><circle cx="15" cy="9" r="1" fill="currentColor"/><circle cx="9" cy="15" r="1" fill="currentColor"/>'),
  drop: SVG('<path d="M5 12h14"/>'),
};

// ------------------------------------------------------------------ DOM scaffold
const app = $('#app');
app.insertAdjacentHTML('beforeend', `
<canvas id="view" aria-label="Battlefield"></canvas>
<div id="hud-top">
  <div class="chip lives" id="lives-chip" title="Vault strength — lose it all and the run ends">${I.vault}<span class="label">Vault</span><span id="lives">20</span></div>
  <div class="chip gold" title="Gold">${I.gold}<span id="gold">0</span></div>
  <div class="chip" id="wave-chip">${I.wave}<span id="wave-txt">Wave 1 of 10</span><span class="wname" id="wave-name"></span><button id="next-btn">Start</button></div>
</div>
<button class="btn" id="pausebtn" title="Pause (P)">Pause</button>
<button class="btn" id="setbtn" title="Settings: graphics quality and more (G)">Settings</button>
<div id="board"><div class="title"><span class="long">The Verdant Vault</span><span class="short">Scores</span><button id="board-toggle" aria-expanded="true">Hide</button></div>
  <table><thead><tr><th>Player</th><th>Vault</th><th>Wave</th><th title="Bosses defeated">Boss</th><th>Gold</th><th>Score</th><th title="Monsters that reached the vault">Leak</th></tr></thead><tbody id="board-rows"></tbody></table></div>
<div id="cam">
  <canvas id="minimap" aria-label="Minimap: click to move the camera"></canvas>
  <div class="row"><button id="home-btn" title="Return to my plot (H)">${I.home}<span> My plot</span></button><button id="ov-btn" title="See the whole plot (O)"><span class="long">Overview</span><span class="short">All</span></button></div>
  <select id="plot-select" aria-label="View plot"><option value="0">Plot 1 — you</option>${[2,3,4,5,6,7,8].map(n=>`<option disabled>Plot ${n} — open</option>`).join('')}</select>
  <div class="row"><button id="zin" aria-label="Zoom in">+</button><button id="zout" aria-label="Zoom out">−</button><button id="act-btn" title="Action Cam: follows the fiercest fight (C)">Action</button><button id="speed" title="Game speed">1×</button></div>
</div>
<div id="camrot" role="group" aria-label="Rotate and tilt the camera">
  <button id="rot-l" title="Rotate left (Q). Tap to turn 45°, hold to keep turning" aria-label="Rotate left"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.5-5.8"/><path d="M4 3v5h5"/></svg></button>
  <button id="tilt-u" title="Tilt toward the horizon (Z). Hold to keep tilting" aria-label="Tilt toward the horizon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg></button>
  <button id="tilt-d" title="Tilt to look straight down (X). Hold to keep tilting" aria-label="Tilt to look down"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>
  <button id="rot-r" title="Rotate right (E). Tap to turn 45°, hold to keep turning" aria-label="Rotate right"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.5-5.8"/><path d="M20 3v5h-5"/></svg></button>
</div>
<div id="dock">
  <div class="panel" id="roll-panel">
    <button class="big" id="roll-btn">${I.dice} Roll<small id="roll-cost">50 gold</small></button>
  </div>
  <div class="panel hidden" id="offer-panel"></div>
  <div class="panel hidden" id="sel-panel"></div>
</div>
<div id="banner"><div class="b1"></div><div class="b2"></div></div>
<div id="camchip" class="hidden"></div>
<div id="toasts" aria-live="polite"></div>
<div id="perf" class="hidden"></div>
`);

// ------------------------------------------------------------------ simulation instance
let seed = Q.get('seed') ? (+Q.get('seed') >>> 0) : ((Date.now() ^ (Math.random() * 1e9)) >>> 0);
let sim = new Sim({ seed, stress: +Q.get('stress') || 0 });

// ------------------------------------------------------------------ three.js: quality tiers
//   low    : direct render, ACES in-material, no shadows, no post, fewer props  (integrated-GPU floor)
//   medium : HDR target (2x MSAA) + bloom + grade, 2048 shadow map, grass
//   high   : 4x MSAA, 4096 shadow map, creatures cast real shadows, denser grass
const R = AHR, lin = R.lin;
const canvas = $('#view');
// Quality tiers: switchable live, mid-game, from Settings. The world is built once; tiers change rendering only.
const QUALITY = {
  low:    { label: 'Low',    hint: 'fastest; no shadows or glow effects', post: false, msaa: 0, bloom: 1, dof: false, shadow: 0,    grass: 0.12, dpr: 1,   creShadow: false },
  medium: { label: 'Medium', hint: 'glow, soft shadows, dense grass',     post: true,  msaa: 0, bloom: 1, dof: false, shadow: 1024, grass: 0.28,  dpr: 1,   creShadow: false },
  high:   { label: 'High',   hint: 'sharper shadows, depth of field',     post: true,  msaa: 2, bloom: 2, dof: true,  shadow: 2048, grass: 0.6,  dpr: 1.5, creShadow: true },
  ultra:  { label: 'Ultra',  hint: 'everything at full',                  post: true,  msaa: 4, bloom: 2, dof: true,  shadow: 4096, grass: 1.0,  dpr: 2,   creShadow: true },
};
let QL = QUALITY[settings.quality] ? settings.quality : 'medium', postOn = false;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: TEST });
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.info.autoReset = false; /* count the whole frame, not just the last pass */
const scene = new THREE.Scene();
const FOGC = R.FOG_LIN.clone(); scene.background = FOGC; scene.fog = new THREE.Fog(FOGC, 30, 90);
scene.environment = R.envMap(renderer);
const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 800);
const hemi = new THREE.HemisphereLight(lin(0x7080C0), lin(0x2A2E22), 1.0); scene.add(hemi);
const sun = new THREE.DirectionalLight(lin(0xFFB27A), 2.9); sun.position.copy(R.SUN_DIR).multiplyScalar(30).add(new THREE.Vector3(W / 2, 0, H / 2)); sun.target.position.set(W / 2, 0, H / 2); scene.add(sun, sun.target);
{ const s = sun.shadow; Object.assign(s.camera, { left: -17, right: 17, top: 15, bottom: -15, near: 1, far: 70 }); s.camera.updateProjectionMatrix(); s.bias = -0.0005; s.normalBias = 0.025; }

const GEO = { ring: new THREE.RingGeometry(0.92, 1, 48), disc: new THREE.CircleGeometry(0.5, 24), cone4: new THREE.ConeGeometry(0.5, 1, 4) };
const tex = R.textures('high');
const world = new THREE.Group(); scene.add(world);
const map = sim.map;
const WORLD = R.buildWorld(world, map, tex, 'medium');
const CRE = R.buildCreatures(world, sim, 'high', CAP, MT_KEYS);
const FXS = R.buildFX(world, tex);
const GRASS = R.buildGrass(world, 'ultra', W, H, WORLD, sun);
const RIVER = R.buildRiver(world, map, tex, 'medium', AHR.PEBBLES || '');
const post = new R.Post(renderer, 0);
function applyQuality(q) {
  const T = QUALITY[q] || QUALITY.medium; QL = q; let recompile = false;
  if (T.post !== postOn || !renderer.userData) { postOn = T.post; recompile = true;
    renderer.toneMapping = postOn ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.48; /* three's ACES divides by 0.6; the post path multiplies by 0.6 */
    renderer.outputEncoding = postOn ? THREE.LinearEncoding : THREE.sRGBEncoding; renderer.userData = { ok: 1 }; }
  post.configure({ samples: T.msaa, bloom: T.bloom, dof: T.dof });
  const sh = T.shadow > 0; if (sh !== renderer.shadowMap.enabled) { renderer.shadowMap.enabled = sh; recompile = true; }
  sun.castShadow = sh; if (sh && sun.shadow.mapSize.x !== T.shadow) { sun.shadow.mapSize.set(T.shadow, T.shadow); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  if (recompile) scene.traverse(o => { const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach(x => { x.needsUpdate = true; }); });
  GRASS.setDensity(T.grass); CRE.setShadows(T.creShadow);
  if (typeof resize === 'function' && camera.aspect) resize();
}

// ------------------------------------------------------------------ towers (few; each a small group from the tower kit)
const towerViews = new Map();
function towerSig(t) { return `${t.el}|${t.arch}|${t.tier}|${t.ability}`; }
function syncTowers() {
  const seen = new Set();
  for (const t of sim.towers) {
    seen.add(t.id); let v = towerViews.get(t.id);
    if (!v || v.sig !== towerSig(t)) { if (v) disposeTower(v.g); const g = R.buildTower(t, tex); world.add(g); v = { g, sig: towerSig(t), born: now, t }; towerViews.set(t.id, v); }
    v.t = t;
  }
  let changed = false; for (const [id, v] of towerViews) if (!seen.has(id)) { disposeTower(v.g); towerViews.delete(id); changed = true; }
  if (changed || seen.size !== grassSeen) { grassSeen = seen.size; GRASS.setOccupied(sim.towers); }
}
let grassSeen = -1;
function disposeTower(g) { world.remove(g); g.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); } // materials are shared; geometry is per tower

function inst(geo, material, cap, color = true) {
  const im = new THREE.InstancedMesh(geo, material, cap);
  if (color) im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3); // full capacity (r128 sizes it from .count otherwise)
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.count = 0; im.frustumCulled = false; return im;
}
// ------------------------------------------------------------------ overlays in the world (rings, telegraphs, placement, selection)
const FX = { rings: [] };
const ringMesh = inst(GEO.ring, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }), 256); world.add(ringMesh);
const teleMesh = new THREE.Mesh(new THREE.RingGeometry(0.72, 1, 64), new THREE.MeshBasicMaterial({ color: lin(0xFF5A3C).multiplyScalar(2.2), transparent: true, opacity: 0.85, depthTest: false, side: THREE.DoubleSide }));
teleMesh.rotation.x = -Math.PI / 2; teleMesh.renderOrder = 20; teleMesh.visible = false; world.add(teleMesh);
const teleFill = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshBasicMaterial({ color: lin(0xFF5A3C), transparent: true, opacity: 0.22, depthTest: false }));
teleFill.rotation.x = -Math.PI / 2; teleFill.renderOrder = 19; teleFill.visible = false; world.add(teleFill);
const rangeRing = new THREE.Mesh(new THREE.RingGeometry(0.965, 1, 96), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false }));
rangeRing.rotation.x = -Math.PI / 2; rangeRing.renderOrder = 12; rangeRing.visible = false; world.add(rangeRing);
const rangeFill = new THREE.Mesh(new THREE.CircleGeometry(1, 96), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthTest: false }));
rangeFill.rotation.x = -Math.PI / 2; rangeFill.renderOrder = 11; rangeFill.visible = false; world.add(rangeFill);
const hoverTile = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.96), new THREE.MeshBasicMaterial({ map: tex.tile, color: 0xffffff, transparent: true, opacity: 0.95, depthTest: false }));
hoverTile.rotation.x = -Math.PI / 2; hoverTile.renderOrder = 12; hoverTile.visible = false; world.add(hoverTile);
const buildDots = inst(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: tex.tile, color: lin(0xFFF6CF), transparent: true, opacity: 0.35, depthTest: false }), W * H, false); buildDots.renderOrder = 11; world.add(buildDots);
const partnerMarks = inst(GEO.cone4, new THREE.MeshBasicMaterial({ color: lin(0xF2C46A).multiplyScalar(2), depthTest: false }), 64, false); partnerMarks.renderOrder = 13; world.add(partnerMarks);
let ghost = null, ghostSig = '';
const pillars = [];
for (let k = 0; k < 4; k++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 1, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  m.visible = false; m.renderOrder = 14; world.add(m); pillars.push({ m, t: 1, dur: 1 }); }
function pillar(x, z, col, big) { const p = pillars.find(q => q.t >= q.dur) || pillars[0]; p.t = 0; p.dur = big ? 1.3 : 0.9; p.big = big; p.m.position.set(x, 0, z); p.m.material.color.copy(lin(col)).multiplyScalar(1.6); p.m.visible = true; }
function drawPillars(dt) { for (const p of pillars) { if (p.t >= p.dur) { p.m.visible = false; continue; } p.t += dt; const f = Math.min(1, p.t / p.dur);
  const h = (p.big ? 7 : 4.5) * (f < 0.2 ? f / 0.2 : 1); const w = (1 - f * 0.6) * (p.big ? 1.3 : 1);
  p.m.scale.set(w, h, w); p.m.position.y = h / 2; p.m.material.opacity = (f < 0.2 ? 0.6 : 0.6 * (1 - (f - 0.2) / 0.8)); } }
// ------------------------------------------------------------------ camera
// Built on Warcraft III's camera model (distance, angle of attack, rotation, z-offset, FOV) and pushed further:
// free orbit/tilt down to near eye level, focus rising to creature height, FOV widening as you tilt down,
// collision with ground and towers, follow-cam, an automatic Action Cam, trauma shake, alert jump.
const cam = { tx: W / 2, tz: H / 2, ty: 0, dist: 14, yaw: 0, pitch: 0.9, minD: 2.4, maxD: 36, fov: 36 };
const goal = { tx: W / 2, tz: H / 2, dist: 14, yaw: 0, pitch: 0.9 };
const home = { tx: W / 2, tz: H / 2, dist: 14 }, overview = { tx: W / 2, tz: H / 2, dist: 25 };
const camX = { auto: true, baseYaw: 0, follow: null, action: false, actionT: 0, trauma: 0, alert: null, shakeSeed: 0 };
const smooth01 = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
function pitchFor(d) { return 0.5 + (1.0 - 0.5) * smooth01(4, overview.dist, d); }            // auto: tilts toward the horizon as you zoom in
function minPitch(d) { return 0.07 + 0.43 * smooth01(4, 20, d); }                              // near eye level only when close
function camHome() { Object.assign(goal, home); goal.yaw = camX.baseYaw; goal.pitch = pitchFor(home.dist); camX.auto = true; ui.overview = false; stopFollow(); }
function camOverview() { Object.assign(goal, overview); goal.yaw = camX.baseYaw; goal.pitch = pitchFor(overview.dist); camX.auto = true; ui.overview = true; stopFollow(); }
function snapCam() { cam.tx = goal.tx; cam.tz = goal.tz; cam.dist = goal.dist; cam.yaw = goal.yaw; cam.pitch = goal.pitch; }
function stopFollow() { camX.follow = null; camX.action = false; updateCamChip(); }
function safeRect() {
  const narrow = innerWidth <= 640, hud = $('#hud-top').getBoundingClientRect(), board = $('#board').getBoundingClientRect();
  let t = hud.bottom + 8; if (!narrow) t = Math.max(t, board.bottom + 6);
  return { l: 8, r: innerWidth - 8, t: narrow ? t + 44 : t, b: innerHeight - (narrow ? 196 : 200) };
}
function fitCamera() {
  const corners = [[-1.2, -0.6], [W + 2.0, -0.6], [-1.2, H + 0.6], [W + 2.0, H + 0.6]].map(([x, z]) => new THREE.Vector3(x, 0, z));
  const sr = safeRect(), cx = (sr.l + sr.r) / 2, cy = (sr.t + sr.b) / 2, p = new THREE.Vector3();
  const bbox = () => { let a = 1e9, b = -1e9, c = 1e9, d = -1e9; for (const v of corners) { p.copy(v).project(camera); const x = (p.x + 1) / 2 * innerWidth, y = (1 - p.y) / 2 * innerHeight; a = Math.min(a, x); b = Math.max(b, x); c = Math.min(c, y); d = Math.max(d, y); } return [a, b, c, d]; };
  camX.baseYaw = cam.yaw = innerWidth / innerHeight < 0.85 ? Math.PI / 2 : 0;
  let found = false;
  for (let d = 10; d <= 70 && !found; d += 0.5) {
    cam.dist = d; overview.dist = d; cam.pitch = 1.0; cam.tx = W / 2 + 0.4; cam.tz = H / 2;
    for (let it = 0; it < 6; it++) { updateCamera(true); camera.updateMatrixWorld(); const [a, b, c, e] = bbox(); const k = d / innerHeight * 1.1;
      panBy(-((a + b) / 2 - cx), -((c + e) / 2 - cy), k, cam); }
    updateCamera(true); camera.updateMatrixWorld(); const [a, b, c, e] = bbox();
    if (a >= sr.l && b <= sr.r && c >= sr.t && e <= sr.b) { found = true; overview.tx = cam.tx; overview.tz = cam.tz; overview.dist = d; }
  }
  if (!found) { overview.tx = W / 2; overview.tz = H / 2 + 2; overview.dist = 60; }
  cam.maxD = overview.dist + 4;
  // gameplay zoom: about 6-7 tiles across on a phone, 13 on a desktop; drag to see the rest, Overview (O) for all of it
  home.dist = innerWidth <= 640 ? Math.max(7, overview.dist * 0.22) : Math.min(10.5, Math.max(8, overview.dist * 0.33)); home.tx = W / 2; home.tz = H / 2 + (cam.yaw ? 0 : 0.6);
}
const camTmp = new THREE.Vector3();
function updateCamera(free) {
  if (!free) { goal.tx = Math.max(-4, Math.min(W + 4, goal.tx)); goal.tz = Math.max(-3, Math.min(H + 4, goal.tz)); goal.dist = Math.max(cam.minD, Math.min(cam.maxD, goal.dist));
    goal.pitch = Math.max(minPitch(goal.dist), Math.min(1.45, goal.pitch)); }
  const low = 1 - smooth01(0.3, 0.95, cam.pitch);
  cam.ty = (R.groundY ? Math.max(0, R.groundY(cam.tx, cam.tz)) : 0) + 0.55 * low;
  if (cam.tyFix != null) cam.ty = cam.tyFix;                                                   // harness portraits only              // focus rises to creature height when low
  const y = Math.sin(cam.pitch) * cam.dist, h = Math.cos(cam.pitch) * cam.dist;
  let px = cam.tx + Math.sin(cam.yaw) * h, pz = cam.tz + Math.cos(cam.yaw) * h, py = cam.ty + y;
  // collision: never inside terrain, water or a tower
  let floor = (R.groundY ? R.groundY(px, pz) : 0) + 0.28; if (R.RIVER && Math.abs(px - (map.riverX + 0.5)) < 0.8) floor = Math.max(floor, R.RIVER.surfaceY + 0.25);
  const tx = Math.floor(px), tz = Math.floor(pz); if (!free && tx >= 0 && tz >= 0 && tx < W && tz < H && sim.towerAt[tz * W + tx] > 0) { const v = towerViews.get(sim.towerAt[tz * W + tx]); floor = Math.max(floor, ((v && v.g.userData.top) || 1.2) + 0.45); }
  if (py < floor) py = floor;
  // trauma shake (squared falloff), scaled with distance so it reads the same near and far
  let sx = 0, sy = 0, sz = 0; if (camX.trauma > 0 && !settings.reducedMotion) { const k = camX.trauma * camX.trauma * 0.05 * (2 + cam.dist * 0.4), t = now * 0.001 * 28;
    sx = (Math.sin(t * 1.3) + Math.sin(t * 2.7 + 1)) * k; sy = (Math.sin(t * 1.7 + 2) + Math.sin(t * 3.1)) * k * 0.7; sz = (Math.sin(t * 1.1 + 4) + Math.sin(t * 2.3 + 3)) * k; }
  camera.position.set(px + sx, py + sy, pz + sz);
  camera.lookAt(cam.tx + sx * 0.5, cam.ty + sy * 0.5, cam.tz + sz * 0.5);
  const fov = 34 + 20 * low; if (Math.abs(fov - camera.fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }
  camera.userData.focusX = cam.tx; camera.userData.focusZ = cam.tz; camera.userData.dist = cam.dist;
  scene.fog.near = 10 + cam.dist * 0.9 + low * 12; scene.fog.far = 55 + cam.dist * 2.2 + low * 45;
}
function angDiff(a, b) { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }
function stepCamera(dt) {
  // follow / action targets steer the goal
  if (camX.follow) { const f = camX.follow;
    if (f.type === 'mon') { const m = sim.m; if (!m.alive[f.i] || m.gen[f.i] !== f.gen) { toast(camX.action ? 'Next target' : 'Target fell', ''); camX.follow = null; if (camX.action) camX.actionT = 99; updateCamChip(); }
      else { goal.tx = m.x[f.i]; goal.tz = m.z[f.i]; } }
    else { const t = sim.towers.find(t => t.id === f.id); if (!t) { camX.follow = null; updateCamChip(); } else { goal.tx = t.x; goal.tz = t.z; } } }
  if (camX.action) { camX.actionT += dt; goal.yaw += dt * 0.14;
    if (!camX.follow || camX.actionT > 7) { const i = hottestMonster(); if (i >= 0) { camX.follow = { type: 'mon', i, gen: sim.m.gen[i], name: MT[MT_KEYS[sim.m.type[i]]].name }; camX.actionT = 0; updateCamChip(); } }
    goal.dist += (5.2 - goal.dist) * Math.min(1, dt * 2); goal.pitch += (0.26 - goal.pitch) * Math.min(1, dt * 2); }
  const k = 1 - Math.exp(-dt * 8);
  cam.tx += (goal.tx - cam.tx) * k; cam.tz += (goal.tz - cam.tz) * k; cam.dist += (goal.dist - cam.dist) * k;
  cam.yaw += angDiff(goal.yaw, cam.yaw) * k; cam.pitch += (goal.pitch - cam.pitch) * k;
  camX.trauma = Math.max(0, camX.trauma - dt * 1.1);
}
function hottestMonster() { // boss first; otherwise the enemy under the most tower fire
  const m = sim.m; let best = -1, bs = -1;
  for (let i = 0; i < CAP; i++) { if (!m.alive[i]) continue; if (m.flags[i] & F_BOSS) return i;
    let s = 0; for (const t of sim.towers) { const dx = t.x - m.x[i], dz = t.z - m.z[i]; if (dx * dx + dz * dz < t.range * t.range) s++; }
    s += (m.flags[i] & F_ELITE) ? 2 : 0; if (s > bs) { bs = s; best = i; } }
  return best; }
function shake(amount) { camX.trauma = Math.min(1, camX.trauma + amount); }
function updateCamChip() { const c = $('#camchip'); if (!c) return;
  if (camX.action) c.textContent = `Action Cam${camX.follow && camX.follow.name ? ' · ' + camX.follow.name : ''} — Esc to exit`;
  else if (camX.follow) c.textContent = `Following ${camX.follow.name || 'target'} — Esc to release`;
  c.classList.toggle('hidden', !camX.action && !camX.follow); $('#act-btn')?.classList.toggle('on', camX.action); }
// shadows follow the camera focus: a tight frustum keeps near-view shadows crisp
function fitShadow() { if (!sun.castShadow) return; const half = Math.min(17, Math.max(6, cam.dist * 0.85));
  sun.target.position.set(cam.tx, 0, cam.tz); sun.position.copy(R.SUN_DIR).multiplyScalar(30).add(sun.target.position);
  const sc = sun.shadow.camera; if (Math.abs(sc.right - half) > 0.3) { sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.updateProjectionMatrix(); } }
// screen-space pan that respects camera yaw
function panBy(dx, dy, k, o = goal) { const c = Math.cos(cam.yaw), s = Math.sin(cam.yaw), kz = k / Math.max(0.35, Math.sin(cam.pitch));
  o.tx -= dx * k * c + dy * kz * s; o.tz -= -dx * k * s + dy * kz * c; }
function orbitBy(dx, dy) { goal.yaw -= dx * 0.006; goal.pitch += dy * 0.005; camX.auto = false; ui.overview = false; if (camX.action) { camX.action = false; updateCamChip(); } }
function resize() {
  const dpr = Math.min(devicePixelRatio || 1, (QUALITY[QL] || QUALITY.medium).dpr) * dynScale;
  renderer.setPixelRatio(dpr); renderer.setSize(innerWidth, innerHeight, false);
  post.setSize(innerWidth, innerHeight, dpr);
  camera.aspect = innerWidth / innerHeight;
  const sr = safeRect(), off = Math.round(((innerHeight - sr.b) - sr.t) / 2);
  camera.setViewOffset(innerWidth, innerHeight, 0, off, innerWidth, innerHeight); camera.updateProjectionMatrix();
}
let dynScale = 1;
addEventListener('resize', () => { resize(); const ov = ui.overview; fitCamera(); if (ov) camOverview(); else camHome(); snapCam(); });

// ------------------------------------------------------------------ minimap (click or drag to move the camera)
const mm = { cv: null, bg: null, s: 8, pad: 2 };
function buildMinimap() {
  const cv = $('#minimap'); if (!cv) return; mm.cv = cv; const S = mm.s, P = mm.pad;
  cv.width = (W + P * 2) * S; cv.height = (H + P * 2) * S;
  const bg = document.createElement('canvas'); bg.width = cv.width; bg.height = cv.height; const c = bg.getContext('2d');
  c.fillStyle = '#23331F'; c.fillRect(0, 0, bg.width, bg.height);
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) { const k = map.kind[z * W + x];
    c.fillStyle = k === 0 ? ((x + z) % 2 ? '#4E7A36' : '#4A7433') : k === 2 ? '#2F6F8A' : '#A8845A'; c.fillRect((x + P) * S, (z + P) * S, S, S); }
  c.fillStyle = '#2F6F8A'; c.fillRect((map.riverX + P) * S, 0, S, P * S); c.fillRect((map.riverX + P) * S, (H + P) * S, S, P * S);
  for (let z = 0; z < H; z++) if (map.kind[z * W + map.riverX] === 1) { c.fillStyle = '#7A5A3A'; c.fillRect((map.riverX + P) * S, (z + P) * S, S, S); }
  c.strokeStyle = '#B0A898'; c.lineWidth = 2; c.strokeRect(P * S - 3, P * S - 3, W * S + 6, H * S + 6);
  c.fillStyle = '#A060FF'; c.beginPath(); c.arc((P - 1) * S, (P + 1.5) * S, S * 0.8, 0, 7); c.fill();
  c.fillStyle = '#7FE8DC'; c.beginPath(); c.arc((W + P + 0.9) * S, (H + P - 1.5) * S, S * 0.9, 0, 7); c.fill();
  mm.bg = bg;
  const toWorld = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * (W + P * 2) - P, (e.clientY - r.top) / r.height * (H + P * 2) - P]; };
  let down = false;
  const go = (e) => { const [x, z] = toWorld(e); goal.tx = x; goal.tz = z + (cam.yaw ? 0 : 0.3); if (ui.overview) { goal.dist = home.dist; ui.overview = false; } };
  cv.addEventListener('pointerdown', (e) => { down = true; cv.setPointerCapture(e.pointerId); go(e); e.stopPropagation(); });
  cv.addEventListener('pointermove', (e) => { if (down) go(e); });
  cv.addEventListener('pointerup', () => { down = false; });
}
const mmRay = new THREE.Raycaster(), mmV = new THREE.Vector2(), mmP = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), mmHit = new THREE.Vector3();
function drawMinimap() {
  if (!mm.cv || !mm.bg || mm.cv.offsetParent === null) return; const c = mm.cv.getContext('2d'), S = mm.s, P = mm.pad;
  c.drawImage(mm.bg, 0, 0);
  for (const t of sim.towers) { c.fillStyle = EL_CSS[t.el]; c.fillRect((t.tx + P) * S + 1, (t.tz + P) * S + 1, S - 2, S - 2); }
  const m = sim.m;
  for (let i = 0; i < CAP; i++) { if (!m.alive[i]) continue; const boss = m.flags[i] & F_BOSS, fly = m.flags[i] & F_FLY;
    c.fillStyle = boss ? '#FF5A3C' : fly ? '#CFEFFF' : (m.flags[i] & F_ELITE) ? '#FFB347' : '#E8423A';
    const r = boss ? 5 : 2; c.fillRect((m.x[i] + P) * S - r / 2, (m.z[i] + P) * S - r / 2, r, r); }
  // camera footprint: screen corners projected onto the ground
  const pts = [];
  for (const [sx, sy] of [[-1, 1], [1, 1], [1, -0.72], [-1, -0.72]]) { mmV.set(sx, sy); mmRay.setFromCamera(mmV, camera);
    if (!mmRay.ray.intersectPlane(mmP, mmHit) || mmHit.distanceTo(camera.position) > 40) mmRay.ray.at(40, mmHit); pts.push([(mmHit.x + P) * S, (mmHit.z + P) * S]); }
  if (pts.length === 4) { c.strokeStyle = 'rgba(255,246,207,0.95)'; c.lineWidth = 1.5; c.beginPath(); pts.forEach(([x, y], k) => k ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.stroke(); }
}

// ------------------------------------------------------------------ UI state
const ui = { overview: false, guardUntil: 0, confirm: null, confirmUntil: 0, selected: null, gamble: false, speed: 1, paused: false, started: TEST || Q.has('autostart') || Q.has('stress'), hover: null, lastUi: 0, ended: false };
// `after` runs BEFORE the UI refresh, so a merge selects its result before the panel redraws (no hidden-panel gap)
function act(a, after) { a.owner = 0; const r = sim.apply(a); if (!r.ok) toast(r.reason, 'bad'); if (after) after(r); ui.guardUntil = Math.max(ui.guardUntil, performance.now() + 250); updateUI(true); return r; }
function offerLower() { const order = ['low', 'medium', 'high', 'ultra'], nx = order[Math.max(0, order.indexOf(QL) - 1)];
  const el = document.createElement('div'); el.className = 'toast offer'; el.innerHTML = `The game is running slowly. <button class="btn gold">Switch to ${QUALITY[nx].label}</button>`;
  el.querySelector('button').onclick = () => { settings.quality = nx; saveSettings(); applyQuality(nx); el.remove(); toast(`Graphics: ${QUALITY[nx].label}`, 'good'); };
  $('#toasts').appendChild(el); setTimeout(() => el.remove(), 12000); }
function toast(msg, cls = '') {
  const el = document.createElement('div'); el.className = 'toast ' + cls; el.textContent = msg; $('#toasts').appendChild(el);
  while ($('#toasts').children.length > 3) $('#toasts').firstChild.remove();
  setTimeout(() => el.remove(), 2600);
}
let bannerT = 0;
function banner(a, b, cls = '') { const el = $('#banner'); el.className = 'show ' + cls; el.querySelector('.b1').textContent = a; el.querySelector('.b2').textContent = b || ''; bannerT = 2.6; }
function pips(tier) { return `<span class="pips" style="color:${TIER_CSS[tier]}" aria-label="${TIERS[tier]}">${[0, 1, 2, 3, 4].map(k => `<i class="${k <= tier ? 'on' : ''}"></i>`).join('')}</span>`; }
function glyph(el) { return `<div class="glyph" style="color:${EL_CSS[el]};border-color:${EL_CSS[el]};background:${EL_CSS[el]}22">${EL_ICON[el].replace('class="icon"', '')}</div>`; }
function abilityLine(ab) { return ab ? `<div class="ability">${AB_ICON[ab]}<span>${ABILITY_INFO[ab]}</span></div>` : `<div class="ability none">No ability</div>`; }
const cap = (s) => s[0].toUpperCase() + s.slice(1);

function setText(el, v) { if (el && el.textContent !== String(v)) el.textContent = v; }
function updateUI(force) {
  const p = sim.player;
  $('#gold').textContent = p.gold; $('#lives').textContent = p.lives;
  const total = sim.waveTotal();
  if (sim.phase === 'build') {
    const nxt = sim.waveIdx + 1;
    $('#wave-txt').textContent = sim.endless ? `Endless wave ${nxt}` : `Wave ${nxt} of ${total}`;
    $('#wave-name').textContent = `in ${Math.ceil(sim.countdown)}s`;
    $('#next-btn').classList.remove('hidden'); $('#next-btn').textContent = 'Start now';
  } else {
    $('#wave-txt').textContent = sim.endless ? `Endless wave ${sim.waveIdx}` : `Wave ${sim.waveIdx} of ${total}`;
    $('#wave-name').textContent = sim.waveName(sim.waveIdx - 1); $('#next-btn').classList.add('hidden');
  }
  // scoreboard: solo shows one row; seven reserved seats for co-op
  const rows = [`<tr class="me"><td>You</td><td>${p.lives}</td><td>${sim.waveIdx}</td><td>${p.bossKills}</td><td>${p.gold}</td><td>${p.score}</td><td>${p.leaked}</td></tr>`];
  rows.push(`<tr class="open"><td colspan="7">7 more seats open for co-op</td></tr>`);
  $('#board-rows').innerHTML = rows.join('');
  // roll / offer / selection: built ONCE per state change, then updated in place.
  // (Rebuilding innerHTML every tick swapped buttons out from under the cursor: clicks were lost and
  //  a spam-clicked Merge could land on a freshly-placed Drop button.)
  const rc = sim.rollCost();
  const rb = $('#roll-btn');
  if (!rb.dataset.built) { rb.innerHTML = `${I.dice} <span class="rl"></span><small id="roll-cost"></small>`; rb.dataset.built = '1'; }
  setText(rb.querySelector('.rl'), sim.offer ? 'Reroll' : 'Roll'); setText($('#roll-cost'), `${rc} gold`);
  rb.disabled = p.gold < rc || sim.phase === 'victory' || sim.phase === 'defeat';
  const op = $('#offer-panel');
  if (sim.offer) {
    const o = sim.offer, sig = `${o.el}|${o.arch}|${o.tier}|${o.ability}|${o.paid}`;
    op.classList.remove('hidden');
    if (op.dataset.sig !== sig) { op.dataset.sig = sig;
      op.innerHTML = `<div class="card">${glyph(o.el)}<div class="name">${o.name}</div>
        <div class="meta">${pips(o.tier)}<span style="color:${TIER_CSS[o.tier]}">${TIERS[o.tier]}</span><span>${cap(o.el)} · ${cap(o.arch)}</span></div>${abilityLine(o.ability)}</div>
        <div class="hint">Click a glowing tile to place it.</div>
        <div class="actions"><button class="btn" id="sell-offer">${I.sell} Sell for <span class="cost">${Math.floor(o.paid * COST.sellFraction)}</span></button></div>`;
      $('#sell-offer').onclick = () => act({ type: 'sellOffer' }); }
  } else { op.classList.add('hidden'); op.dataset.sig = ''; }
  const sp = $('#sel-panel'); const t = ui.selected != null ? sim.towers.find(x => x.id === ui.selected) : null;
  if (!t) { ui.selected = null; sp.classList.add('hidden'); sp.dataset.sig = ''; }
  else {
    sp.classList.remove('hidden');
    const canG = t.tier + 2 <= 4, partners = sim.mergePartners(t).length;
    const sig = `${t.id}|${t.tier}|${t.ability}|${t.locked}|${canG}`;
    if (sp.dataset.sig !== sig) { sp.dataset.sig = sig; ui.confirm = null;
      ui.guardUntil = performance.now() + 450;   // the panel just changed under the cursor: ignore destructive clicks briefly
      sp.innerHTML = `<div class="card">${glyph(t.el)}<div class="name">${t.name}${t.locked ? ' ' + I.lock : ''}</div>
        <div class="meta">${pips(t.tier)}<span style="color:${TIER_CSS[t.tier]}">${TIERS[t.tier]}</span><span>${cap(t.el)} · ${cap(t.arch)}</span></div>
        <div class="abil-row">${abilityLine(t.ability)}${t.ability ? `<button class="linkbtn danger" id="b-drop" title="Remove this ability so you can enchant again">Drop</button>` : ''}</div></div>
        <div class="stats" id="b-stats"></div>
        <div class="actions slots">
          <button class="btn gold" id="b-merge" ${t.tier >= 4 ? 'disabled' : ''}>${I.merge} Merge <span class="cost" id="c-merge"></span></button>
          <label class="gamble ${canG ? '' : 'off'}" title="Pay ${COST.gamble} more for a 10% chance to jump two tiers. A miss still gives +1."><input type="checkbox" id="b-gamble" ${ui.gamble && canG ? 'checked' : ''} ${canG ? '' : 'disabled'}> Push luck +${COST.gamble}</label>
          <button class="btn gold" id="b-enchant-t" ${t.ability ? 'disabled title="This tower already has its one ability"' : 'title="Adds a random ability to this tower"'}>${I.spark} Enchant this <span class="cost" id="c-ench-t"></span></button>
          <button class="btn" id="b-enchant-r" title="Adds a random ability to a random tower without one">${I.spark} Enchant random <span class="cost" id="c-ench-r"></span></button>
          <button class="btn" id="b-lock" aria-pressed="${t.locked}">${I.lock} ${t.locked ? 'Unlock' : 'Lock'}</button>
          <button class="btn danger" id="b-sell" ${t.locked ? 'disabled' : ''}>${I.sell} <span id="l-sell">Sell</span> <span class="cost" id="c-sell"></span></button>
        </div>`;
      const on = (id, f) => { const el = $(id); if (el) el.onclick = f; };
      on('#b-merge', () => { const tt = sim.towers.find(x => x.id === ui.selected); if (!tt) return; const cg = tt.tier + 2 <= 4;
        const r = act({ type: 'merge', id: tt.id, gamble: ui.gamble && cg }, (res) => { if (res.ok) ui.selected = res.id; }); if (r.ok) { const nt = sim.towers.find(x => x.id === r.id);
          toast(r.jump === 2 ? `Lucky! Jumped two tiers: ${TIERS[nt.tier]} ${nt.name}` : `Merged into ${TIERS[nt.tier]} ${nt.name}${nt.ability ? ' with ' + nt.ability : ''}`, 'good'); } });
      const g = $('#b-gamble'); if (g) g.onchange = () => { ui.gamble = g.checked; updateUI(true); };
      // destructive actions: guarded right after the panel changes, and need a second click to confirm
      const confirmable = (id, key, label, run) => on(id, () => { if (performance.now() < ui.guardUntil) return;
        if (ui.confirm === key) { ui.confirm = null; run(); return; }
        ui.confirm = key; ui.confirmUntil = performance.now() + 2500; updateUI(true); });
      confirmable('#b-drop', 'drop', 'Drop', () => act({ type: 'dropAbility', id: ui.selected }));
      confirmable('#b-sell', 'sell', 'Sell', () => act({ type: 'sellTower', id: ui.selected }, (res) => { if (res.ok) ui.selected = null; }));
      on('#b-enchant-t', () => { const r = act({ type: 'addAbilityTarget', id: ui.selected }); if (r.ok) { const tt = sim.towers.find(x => x.id === ui.selected); toast(`${cap(r.ability)} bound to ${tt ? tt.name : 'tower'}`, 'good'); } });
      on('#b-enchant-r', () => { const r = act({ type: 'addAbilityRandom' }); if (r.ok) { const nt = sim.towers.find(x => x.id === r.id); toast(`${cap(r.ability)} landed on ${nt.name}`, 'good'); } });
      on('#b-lock', () => act({ type: 'lock', id: ui.selected }));
    }
    // in-place updates only: numbers, affordability, confirm labels (never replaces a button)
    if (ui.confirm && performance.now() > ui.confirmUntil) ui.confirm = null;
    const mc = t.tier < 4 ? sim.mergeCost(t, ui.gamble && canG) : 0, rCost = COST.addRandom(p.addRandomUses), tCost = COST.addTarget(p.addTargetUses), sellV = Math.floor(t.invested * COST.sellFraction);
    setText($('#b-stats'), `${t.dmg.toFixed(0)} damage · ${(t.rate * t.auraBoost).toFixed(2)}/s · range ${t.range.toFixed(1)} · ${(t.dmg * t.rate * t.auraBoost).toFixed(0)} dps · ${t.kills} kills`);
    setText($('#c-merge'), t.tier < 4 ? mc : ''); setText($('#c-ench-t'), t.ability ? '' : tCost); setText($('#c-ench-r'), rCost); setText($('#c-sell'), sellV);
    const bm = $('#b-merge'); if (bm) { const why = t.tier >= 4 ? 'Legendary towers cannot merge further' : !partners ? `Needs another unlocked ${TIERS[t.tier]} tower` : p.gold < mc ? `Need ${mc} gold` : `Consumes one of your ${partners} other unlocked ${TIERS[t.tier]} towers at random`;
      bm.classList.toggle('short', t.tier < 4 && (!partners || p.gold < mc)); bm.title = why; }
    $('#b-enchant-t')?.classList.toggle('short', !t.ability && p.gold < tCost); $('#b-enchant-r')?.classList.toggle('short', p.gold < rCost);
    const ls = $('#l-sell'); setText(ls, ui.confirm === 'sell' ? 'Confirm sell' : 'Sell'); $('#b-sell')?.classList.toggle('confirm', ui.confirm === 'sell');
    const bd = $('#b-drop'); if (bd) { setText(bd, ui.confirm === 'drop' ? 'Confirm drop?' : 'Drop'); bd.classList.toggle('confirm', ui.confirm === 'drop'); }
  }
  $('#speed').textContent = ui.speed + '×';
}

// ------------------------------------------------------------------ input
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
function pickTile(cx, cy) {
  ndc.set(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  if (!ray.ray.intersectPlane(groundPlane, hit)) return null;
  return { tx: Math.floor(hit.x), tz: Math.floor(hit.z), x: hit.x, z: hit.z };
}
// towers are tall: a tap on a tower's body lands on a tile BEHIND it. Test the ray against each tower's column instead.
function pickTower(cx, cy) {
  ndc.set(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const o = ray.ray.origin, d = ray.ray.direction; let best = null, bt = 1e9;
  for (const [id, v] of towerViews) { const t = v.t, g = v.g, Rr = 0.44, y0 = g.position.y, y1 = y0 + (g.userData.top || 1.5) + 0.45;
    const ox = o.x - t.x, oz = o.z - t.z, a = d.x * d.x + d.z * d.z, b = 2 * (ox * d.x + oz * d.z), c = ox * ox + oz * oz - Rr * Rr;
    let hitT = -1;
    if (a > 1e-8) { const disc = b * b - 4 * a * c; if (disc >= 0) { const t0 = (-b - Math.sqrt(disc)) / (2 * a), y = o.y + d.y * t0; if (t0 > 0 && y >= y0 && y <= y1) hitT = t0; } }
    if (hitT < 0 && Math.abs(d.y) > 1e-6) { const tc = (y1 - o.y) / d.y, x = ox + d.x * tc, z = oz + d.z * tc; if (tc > 0 && x * x + z * z <= Rr * Rr) hitT = tc; }  // through the top
    if (hitT > 0 && hitT < bt) { bt = hitT; best = id; } }
  return best;
}
let drag = null; const pointers = new Map();
canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const orbit = e.button === 2 || e.button === 1 || (e.button === 0 && (e.ctrlKey || e.altKey || e.shiftKey));
  drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false, orbit, button: e.button, pinch: pointers.size === 2 ? pinchDist() : 0, ang: pointers.size === 2 ? pinchAng() : 0, cy: pointers.size === 2 ? pinchCY() : 0, cx: pointers.size === 2 ? pinchCX() : 0, d0: goal.dist }; });
function pinchCX() { const [a, b] = [...pointers.values()]; return (a.x + b.x) / 2; }
function pinchDist() { const [a, b] = [...pointers.values()]; return Math.hypot(a.x - b.x, a.y - b.y); }
function pinchAng() { const [a, b] = [...pointers.values()]; return Math.atan2(b.y - a.y, b.x - a.x); }
function pinchCY() { const [a, b] = [...pointers.values()]; return (a.y + b.y) / 2; }
canvas.addEventListener('pointermove', (e) => {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  ui.hover = pickTile(e.clientX, e.clientY);
  if (!drag) return;
  if (pointers.size === 2 && drag.pinch) {                       // touch: pinch zoom, twist OR two-finger sideways swipe rotates, two-finger up/down tilts
    goal.dist = Math.max(cam.minD, Math.min(cam.maxD, drag.d0 * drag.pinch / pinchDist()));
    const a = pinchAng(); goal.yaw -= angDiff(a, drag.ang); drag.ang = a; const cy = pinchCY(), cx = pinchCX();
    goal.pitch += (cy - drag.cy) * 0.006; drag.cy = cy; goal.yaw -= (cx - drag.cx) * 0.009; drag.cx = cx;
    camX.auto = false; ui.overview = false; drag.moved = true; return; }
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) drag.moved = true;
  if (drag.moved) { if (drag.orbit) orbitBy(dx, dy);
    else { panBy(dx, dy, cam.dist / innerHeight * 1.25); panBy(dx, dy, cam.dist / innerHeight * 1.25, cam); ui.overview = false; if (camX.follow || camX.action) stopFollow(); } }
  drag.x = e.clientX; drag.y = e.clientY;
});
canvas.addEventListener('pointerup', (e) => {
  pointers.delete(e.pointerId);
  if (drag && !drag.moved && e.button === 0 && !drag.orbit) clickAt(e.clientX, e.clientY);
  if (drag && !drag.moved && e.button === 2) { ui.selected = null; updateUI(true); }
  if (!pointers.size) drag = null;
});
canvas.addEventListener('dblclick', (e) => { // follow whatever is under the cursor: an enemy first, else a tower
  const i = pickMonster(e.clientX, e.clientY);
  if (i >= 0) { camX.action = false; camX.follow = { type: 'mon', i, gen: sim.m.gen[i], name: MT[MT_KEYS[sim.m.type[i]]].name }; goal.dist = Math.min(goal.dist, 6); goal.pitch = Math.min(goal.pitch, 0.42); camX.auto = false; updateCamChip(); return; }
  const p = pickTile(e.clientX, e.clientY); const id = pickTower(e.clientX, e.clientY) || (p && p.tx >= 0 && p.tz >= 0 && p.tx < W && p.tz < H ? sim.towerAt[p.tz * W + p.tx] : -1);
  if (id > 0) { const t = sim.towers.find(t => t.id === id); camX.action = false; camX.follow = { type: 'tower', id, name: t.name }; goal.dist = Math.min(goal.dist, 5.5); goal.pitch = Math.min(goal.pitch, 0.4); camX.auto = false; updateCamChip(); }
});
const pmV = new THREE.Vector3();
function pickMonster(cx, cy) { let best = -1, bd = 34 * 34; const m = sim.m;
  for (let i = 0; i < CAP; i++) { if (!m.alive[i]) continue; { const ty = CRE.TYPE[MT_KEYS[m.type[i]]]; pmV.set(m.x[i], ((m.flags[i] & F_FLY) ? ty[2] : R.groundY(m.x[i], m.z[i])) + ty[3] * 0.5, m.z[i]).project(camera); }
    const sx = (pmV.x + 1) / 2 * innerWidth, sy = (1 - pmV.y) / 2 * innerHeight, d = (sx - cx) ** 2 + (sy - cy) ** 2; if (d < bd) { bd = d; best = i; } }
  return best; }
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('wheel', (e) => { e.preventDefault();
  if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.2) { goal.yaw += (e.shiftKey ? e.deltaY || e.deltaX : e.deltaX) * 0.004; camX.auto = false; ui.overview = false; return; } // sideways scroll / Shift+wheel rotates
  goal.dist = Math.max(cam.minD, Math.min(cam.maxD, goal.dist * (e.deltaY > 0 ? 1.12 : 0.89)));
  if (camX.auto) goal.pitch = pitchFor(goal.dist); ui.overview = false; }, { passive: false });
function clickAt(cx, cy) {
  if (performance.now() < ui.guardUntil && !sim.offer) return;
  const p = pickTile(cx, cy); if (!p) return;
  if (sim.offer && sim.canBuild(p.tx, p.tz)) { const r = act({ type: 'place', tx: p.tx, tz: p.tz }); if (r.ok) { ui.selected = null; } return; }
  const id = pickTower(cx, cy) || ((p.tx >= 0 && p.tz >= 0 && p.tx < W && p.tz < H) ? sim.towerAt[p.tz * W + p.tx] : -1);
  ui.selected = id > 0 ? id : null;
  if (sim.offer && id < 0 && !(p.tx >= 0 && p.tz >= 0 && p.tx < W && p.tz < H && sim.canBuild(p.tx, p.tz))) toast('Place it on a grass tile beside the path.', 'bad');
  updateUI(true);
}
const keys = new Set();
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  keys.add(e.key.toLowerCase());
  const k = e.key.toLowerCase();
  if (k === 'r') { if (!ui.started) return; act({ type: sim.offer ? 'reroll' : 'roll' }); }
  else if (k === 'escape') { if (camX.follow || camX.action) stopFollow(); else if (ui.selected != null || sim.offer) { ui.selected = null; updateUI(true); } else togglePause(); }
  else if (k === 'p') togglePause();
  else if (k === 'g') openSettingsInGame();
  else if (k === 'h') camHome();
  else if (k === 'o') { ui.overview ? camHome() : camOverview(); }
  else if (k === ' ') { e.preventDefault(); if (camX.alert) { stopFollow(); goal.tx = camX.alert.x; goal.tz = camX.alert.z; goal.dist = Math.min(goal.dist, 8); } else if (sim.phase === 'build') act({ type: 'startWave' }); }
  else if (k === 'enter') { if (sim.phase === 'build') act({ type: 'startWave' }); }
  else if (k === 'c') { camX.action = !camX.action; if (!camX.action) camX.follow = null; camX.actionT = 99; updateCamChip(); }
  else if (k === 'f' && ui.selected) { const t = sim.towers.find(t => t.id === ui.selected); if (t) { camX.follow = { type: 'tower', id: t.id, name: t.name }; goal.dist = Math.min(goal.dist, 5.5); goal.pitch = Math.min(goal.pitch, 0.4); camX.auto = false; updateCamChip(); } }
  else if (k === 'm' && ui.selected) $('#b-merge')?.click();
  else if (k === 'f3') { e.preventDefault(); settings.showPerf = !settings.showPerf; saveSettings(); }
  else if (k === 'delete' && ui.selected) $('#b-sell')?.click();
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
$('#roll-btn').onclick = () => act({ type: sim.offer ? 'reroll' : 'roll' });
$('#next-btn').onclick = () => act({ type: 'startWave' });
$('#home-btn').onclick = () => camHome();
$('#plot-select').onchange = () => camHome();
$('#zin').onclick = () => { goal.dist = Math.max(cam.minD, goal.dist * 0.85); ui.overview = false; };
$('#zout').onclick = () => { goal.dist = Math.min(cam.maxD, goal.dist * 1.15); };
$('#ov-btn').onclick = () => ui.overview ? camHome() : camOverview();
// rotate / tilt pad: a tap turns 45° (or tilts a notch); holding keeps turning smoothly
const camHold = { yaw: 0, pitch: 0, t: 0 };
for (const [id, dy, dp] of [['#rot-l', 1, 0], ['#rot-r', -1, 0], ['#tilt-u', 0, -1], ['#tilt-d', 0, 1]]) { const b = $(id);
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); camHold.yaw = dy; camHold.pitch = dp; camHold.t = performance.now(); camX.auto = false; ui.overview = false; if (camX.action) { camX.action = false; updateCamChip(); } });
  const up = () => { if (!camHold.yaw && !camHold.pitch) return; if (performance.now() - camHold.t < 260) { goal.yaw += camHold.yaw * Math.PI / 4; goal.pitch += camHold.pitch * 0.2; } camHold.yaw = camHold.pitch = 0; };
  b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('contextmenu', (e) => e.preventDefault()); }
$('#act-btn').onclick = () => { camX.action = !camX.action; if (!camX.action) camX.follow = null; camX.actionT = 99; updateCamChip(); };
$('#speed').onclick = () => { ui.speed = ui.speed === 1 ? 2 : ui.speed === 2 ? 3 : 1; updateUI(true); };
$('#pausebtn').onclick = () => togglePause();
$('#setbtn').onclick = () => openSettingsInGame();
function openSettingsInGame() { const wasPaused = ui.paused; if (ui.started && !ui.ended && !wasPaused) ui.paused = true; settingsScreen(() => { if (!wasPaused && !$('#pause')) ui.paused = false; }); }
$('#board-toggle').onclick = () => { const b = $('#board'); b.classList.toggle('collapsed'); $('#board-toggle').textContent = b.classList.contains('collapsed') ? 'Show' : 'Hide'; $('#board-toggle').setAttribute('aria-expanded', !b.classList.contains('collapsed')); };

// ------------------------------------------------------------------ overlays (title, pause, settings, help, end)
function overlay(id, html) { closeOverlay(id); app.insertAdjacentHTML('beforeend', `<div class="overlay" id="${id}">${html}</div>`); return $('#' + id); }
function closeOverlay(id) { const o = $('#' + id); if (o) o.remove(); }
function titleScreen() {
  const o = overlay('title', `<div><div class="wordmark">Arcane Hand</div><div class="sub">Horde Defense</div>
    <p class="tag">Roll for towers, merge them into something stranger, and hold the Verdant Vault through ten waves.</p>
    <div class="row"><button class="big" id="t-play">Start the run</button><button class="btn" id="t-help">How it works</button><button class="btn" id="t-set">Settings</button></div>
    ${settings.bestScore ? `<p class="tag" style="margin-top:14px">Best score ${settings.bestScore}</p>` : ''}</div>`);
  o.querySelector('#t-play').onclick = () => { closeOverlay('title'); ui.started = true; banner('The Verdant Vault', 'Roll your first tower, then place it beside the path.'); updateUI(true); };
  o.querySelector('#t-help').onclick = helpScreen; o.querySelector('#t-set').onclick = settingsScreen;
}
function helpScreen() {
  const o = overlay('help', `<div class="modal"><h2>How it works</h2><ul>
    <li><b>Roll</b> spends gold on a random tower. Keep it by placing it on grass beside the path, or sell it back for half.</li>
    <li><b>Merge</b> a tower with another of the same rarity. One of your matching towers is used up at random, and you get a tower one rarity higher. You won't know which one until it appears.</li>
    <li><b>Push luck</b> costs ${COST.gamble} more for a 10% chance to jump two rarities. A miss still gives you the normal merge.</li>
    <li>Each tower holds <b>one ability</b>. Enchant a random tower cheaply, or pick the tower for more. Drop an ability to try for another.</li>
    <li>Only merging two towers that <b>both</b> have abilities keeps an ability, and it's rolled fresh.</li>
    <li><b>Lock</b> a tower to protect it from being sold or used up in a merge.</li>
    <li>Flyers take less damage from most towers. Storm towers and Skyward ability hit them fully.</li></ul>
    <p><b>Camera:</b> drag to pan · wheel or pinch to zoom (it tilts toward eye level as you zoom in) · the round arrows (bottom right) turn the view: tap for 45°, hold to keep turning · on a phone, swipe sideways with two fingers to rotate and up/down to tilt · right-drag, Shift+drag or a sideways trackpad scroll also rotate · Q/E rotate · Z/X tilt · double-click an enemy or tower to follow it · C Action Cam · Space jump to the latest alert · H my plot · O overview.</p>
    <p>Keys: R roll, Enter start wave, M merge, P pause, F follow the selected tower, F3 performance.</p><div class="row"><button class="btn" id="h-close">Close</button></div></div>`);
  o.querySelector('#h-close').onclick = () => closeOverlay('help');
}
function settingsScreen(onClose) {
  const o = overlay('settings', `<div class="modal"><h2>Settings</h2>
    <label class="set">Graphics quality <select id="s-q">${Object.entries(QUALITY).map(([k, v]) => `<option value="${k}">${v.label}: ${v.hint}</option>`).join('')}</select></label>
    <p class="setnote">Changes apply instantly. If the game slows down in a big wave, drop a level here.</p>
    <label class="set">Reduce motion <input type="checkbox" id="s-rm" ${settings.reducedMotion ? 'checked' : ''}></label>
    <label class="set">Show performance overlay <input type="checkbox" id="s-perf" ${settings.showPerf ? 'checked' : ''}></label>
    <div class="row"><button class="btn" id="s-close">Done</button></div></div>`);
  o.querySelector('#s-q').value = settings.quality;
  o.querySelector('#s-q').onchange = (e) => { settings.quality = e.target.value; saveSettings(); applyQuality(settings.quality); toast(`Graphics: ${QUALITY[settings.quality].label}`, 'good'); };
  o.querySelector('#s-rm').onchange = (e) => { settings.reducedMotion = e.target.checked; saveSettings(); };
  o.querySelector('#s-perf').onchange = (e) => { settings.showPerf = e.target.checked; saveSettings(); };
  o.querySelector('#s-close').onclick = () => { closeOverlay('settings'); if (typeof onClose === 'function') onClose(); };
}
function togglePause(force) {
  if (!ui.started || ui.ended) return;
  ui.paused = force != null ? force : !ui.paused;
  if (!ui.paused) { closeOverlay('pause'); return; }
  const o = overlay('pause', `<div class="modal"><h2>Paused</h2><p>Seed ${seed}. The simulation is frozen; nothing moves until you resume.</p>
    <div class="row"><button class="big" id="p-res">Resume</button><button class="btn" id="p-help">How it works</button><button class="btn" id="p-set">Settings</button><button class="btn danger" id="p-restart">Restart run</button></div></div>`);
  o.querySelector('#p-res').onclick = () => togglePause(false);
  o.querySelector('#p-help').onclick = helpScreen; o.querySelector('#p-set').onclick = settingsScreen;
  o.querySelector('#p-restart').onclick = () => restart(false);
}
function restart(sameSeed) {
  if (!sameSeed) seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
  sim.seed = seed; sim.reset(); for (const [, v] of towerViews) disposeTower(v.g); towerViews.clear();
  FX.rings.length = 0; FXS.clear(); CRE.reset();
  ui.selected = null; ui.paused = false; ui.ended = false; ui.started = true; for (const id of ['pause', 'end', 'settings', 'help']) closeOverlay(id);
  camHome(); banner('The Verdant Vault', 'A fresh run. Roll your first tower.'); updateUI(true);
}
function endScreen(won) {
  ui.ended = true; const p = sim.player;
  if (p.score > (settings.bestScore || 0)) { settings.bestScore = p.score; saveSettings(); }
  const o = overlay('end', `<div class="modal"><h2>${won ? 'The vault holds' : 'The vault has fallen'}</h2>
    <p>${won ? 'The Vault Breaker is dust. The glade is quiet again.' : `You reached wave ${sim.waveIdx}. Merge earlier and enchant for the enemies you face.`}</p>
    <dl><dt>Score</dt><dd>${p.score}</dd><dt>Best score</dt><dd>${settings.bestScore}</dd><dt>Waves reached</dt><dd>${sim.waveIdx}</dd><dt>Monsters defeated</dt><dd>${p.kills}</dd>
    <dt>Merges</dt><dd>${p.merges}</dd><dt>Lucky jumps</dt><dd>${p.gambleHits} of ${p.gambles}</dd><dt>Leaked</dt><dd>${p.leaked}</dd></dl>
    <div class="row"><button class="big" id="e-again">Play again</button>${won ? '<button class="btn gold" id="e-endless">Keep going — endless</button>' : ''}</div></div>`);
  o.querySelector('#e-again').onclick = () => restart(false);
  const en = o.querySelector('#e-endless'); if (en) en.onclick = () => { act({ type: 'continueEndless' }); ui.ended = false; closeOverlay('end'); };
}

// ------------------------------------------------------------------ sim events -> presentation
const TOPY = (id) => { const v = towerViews.get(id); return v ? (v.g.userData.muzzle || (v.g.userData.top || 1) + 0.25) : 1; };
// aim point: the target's chest height (models are authored at world size; CRE.TYPE holds [scale, gait, hover, height])
function aimY(e) { const i = e.i, m = sim.m; if (i == null || !m.alive[i]) return e.fly ? 1.5 : 0.4; const ty = CRE.TYPE[MT_KEYS[m.type[i]]], el = (m.flags[i] & F_ELITE) ? 1.3 : 1;
  return (e.fly ? ty[2] : R.groundY(e.tx, e.tz)) + ty[3] * el * (e.fly ? 0.1 : 0.5); }
function onEvents(evts) {
  const cut = cosmeticCut(); FXS.setCut(cut);
  for (const e of evts) switch (e.t) {
    case 'shot': {
      const toY = aimY(e);
      if (!(cut >= 2 && e.arch === 'rapid' && Math.random() < 0.5)) { FXS.shot(e, TOPY(e.id), toY); if (cut < 2 && e.arch !== 'rapid') FXS.muzzle(e.x, TOPY(e.id), e.z, e.el); }
      const v = towerViews.get(e.id); if (v) { v.g.userData.kick = 1; v.g.userData.aim = Math.atan2(e.tx - e.x, e.tz - e.z); }
      break; }
    case 'splash': FX.rings.push({ x: e.x, z: e.z, t: 0, dur: 0.35, r0: 0.2, r1: 1.05, col: EL_COL[e.el], y: 0.08 }); FXS.splash(e.x, e.z, e.el); break;
    case 'chain': FXS.chain(e.pts, e.el); break;
    case 'pierce': FXS.pierce(e.x, e.z, e.ex, e.ez, e.el); break;
    case 'death': CRE.onDeath(e, e.i != null ? e.i : -1); FXS.death(e.x, R.groundY(e.x, e.z), e.z, e.boss || e.elite, lin(e.type === 'wisp' ? 0xD8E8F0 : 0xB8A890));
      if (e.boss) { shake(1); FX.rings.push({ x: e.x, z: e.z, t: 0, dur: 0.9, r0: 0.3, r1: 4, col: 0xF2C94C, y: 0.1 }); FXS.ring(e.x, e.z, lin(0xF2C94C)); banner('The Vault Breaker falls', ''); } break;
    case 'leak': { shake(e.boss ? 0.9 : 0.3); camX.alert = { x: map.vault % W + 0.5, z: ((map.vault / W) | 0) + 0.5 }; const c = $('#lives-chip'); c.classList.remove('hurt'); void c.offsetWidth; c.classList.add('hurt'); vaultHurt = 1; if (e.boss) banner('The Vault Breaker got through', '', 'boss'); break; }
    case 'waveStart': if (e.boss) camX.alert = { x: map.spawn % W, z: ((map.spawn / W) | 0) + 0.5 }; banner(e.boss ? 'The Vault Breaker' : `Wave ${e.wave}`, e.boss ? 'Its armor shrugs off small hits. Watch for the red rings.' : e.name, e.boss ? 'boss' : ''); break;
    case 'waveClear': toast(`Wave ${e.wave} cleared +${40 + 10 * e.wave} gold`, 'good'); break;
    case 'telegraph': shake(0.35); camX.alert = { x: e.x, z: e.z }; tele = { x: e.x, z: e.z, t: 0, dur: e.dur, kind: e.kind, tick: sim.tick }; banner(e.kind === 'summon' ? 'It calls the swarm' : 'It is enraged', e.kind === 'summon' ? 'A shield rises and skitterlings pour out.' : 'Faster and harder to hurt — finish it.', 'boss'); break;
    case 'bossPhase': shake(0.6); FX.rings.push({ x: e.x, z: e.z, t: 0, dur: 0.6, r0: 0.5, r1: 2.6, col: 0xFF5A3C, y: 0.08 }); FXS.ring(e.x, e.z, lin(0xFF5A3C)); break;
    case 'merge': { const t = sim.towers.find(x => x.id === e.id); if (t) { FXS.sacrifice(e.px, e.pz, t.x, t.z); FXS.merge(t.x, t.z, lin(TIER_COL[e.tier]), e.jump === 2); pillar(t.x, t.z, TIER_COL[e.tier], e.jump === 2);
        FX.rings.push({ x: t.x, z: t.z, t: 0, dur: 0.7, r0: 0.2, r1: e.jump === 2 ? 2.6 : 1.5, col: TIER_COL[e.tier], y: 0.1 }); } break; }
    case 'roll': if (e.tier >= 3) banner(e.tier === 4 ? 'Legendary!' : 'Special roll', `${cap(e.el)} tower`, ''); break;
    case 'place': { const t = sim.towers.find(x => x.id === e.id); if (t) { FXS.death(t.x, 0, t.z, false, lin(0xA89878)); FX.rings.push({ x: t.x, z: t.z, t: 0, dur: 0.4, r0: 0.3, r1: 0.9, col: 0xEFE3C2, y: 0.05 }); } break; }
    case 'enchant': { const t = sim.towers.find(x => x.id === e.id); if (t) FXS.sparkle(t.x, 0.5, t.z, lin(0xBFF2FF), 30); break; }
    case 'shieldBreak': if (cut < 2) FXS.sparkle(e.x, 0.3, e.z, lin(0x9FD8FF), 8); break;
    case 'sell': FXS.death(e.x, 0, e.z, false, lin(0xB8A890)); break;
    case 'victory': setTimeout(() => endScreen(true), 1200); break;
    case 'defeat': setTimeout(() => endScreen(false), 900); break;
  }
}
let tele = null, vaultHurt = 0;

// ------------------------------------------------------------------ dynamic quality (cosmetic cuts only, in the documented order)
const frameTimes = []; let cutLevel = 0, cutCooldown = 0;
function cosmeticCut() { return QL === 'low' ? Math.max(1, cutLevel) : cutLevel; }
function adaptQuality(ms) {
  frameTimes.push(ms); if (frameTimes.length > 90) frameTimes.shift();
  if ((cutCooldown -= ms) > 0 || frameTimes.length < 60) return;
  const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
  if (avg > 38 && QL !== 'low' && !ui.lowOffered) { ui.lowOffered = true; offerLower(); }
  if (avg > 19 && cutLevel < 3) { cutLevel++; cutCooldown = 2500; if (cutLevel === 3 && dynScale > 0.7) { dynScale = 0.75; resize(); } }
  else if (avg < 11 && cutLevel > 0) { cutLevel--; cutCooldown = 4000; if (cutLevel < 3 && dynScale < 1) { dynScale = 1; resize(); } }
}

// ------------------------------------------------------------------ per-frame presentation
const m4 = new THREE.Matrix4(), qd = new THREE.Quaternion(), v3 = new THREE.Vector3(), sc = new THREE.Vector3(), eul = new THREE.Euler(), tmpC = new THREE.Color();
let now = 0;
function drawRings(dt) {
  let n = 0;
  for (let k = 0; k < FX.rings.length; k++) { const r = FX.rings[k]; r.t += dt; if (r.t >= r.dur) { FX.rings.splice(k--, 1); continue; } const f = r.t / r.dur, rad = r.r0 + (r.r1 - r.r0) * f;
    m4.makeRotationX(-Math.PI / 2).scale(sc.set(rad, rad, 1)).setPosition(r.x, r.y, r.z); ringMesh.setMatrixAt(n, m4); ringMesh.setColorAt(n, tmpC.copy(lin(r.col)).multiplyScalar(2.2 * (1 - f))); n++; }
  ringMesh.count = n; ringMesh.instanceMatrix.needsUpdate = true; ringMesh.instanceColor.needsUpdate = true;
}
function drawTowers(dt, time) {
  for (const [id, v] of towerViews) { const g = v.g, u = g.userData;
    const born = Math.min(1, (now - v.born) / 300); const kick = u.kick; u.kick = Math.max(0, u.kick - dt * 6);
    const pop = settings.reducedMotion ? 1 : (born < 1 ? 0.55 + 0.45 * (1 - Math.pow(1 - born, 3)) : 1);
    const bs = pop; g.scale.set(bs, bs, bs);
    if (u.weapon && u.aim != null) { let d = u.aim - u.weapon.rotation.y; d = ((d + Math.PI * 3) % (Math.PI * 2)) - Math.PI; u.weapon.rotation.y += d * Math.min(1, dt * 12); }
    if (u.head) u.head.scale.setScalar(1 + kick * 0.08);
    R.animateTower(g, dt, time, settings.reducedMotion);
  }
}
let lastFrame = performance.now(), acc = 0, fpsAcc = 0, fpsN = 0, fpsShow = 0, simMs = 0, worst = [];
function frame(t) {
  requestAnimationFrame(frame);
  if (TEST) return; // harness renders explicitly via __ah.render for reproducible frames
  const rawDt = Math.min(0.25, (t - lastFrame) / 1000); lastFrame = t; now = t;
  if (!TEST && ui.started && !ui.paused && !(ui.ended && sim.phase !== 'build')) {
    acc += rawDt * ui.speed; let steps = 0; const s0 = performance.now();
    while (acc >= DT && steps < 8) { if (botAct) botAct(sim.tick); sim.step(); steps++; acc -= DT; }
    if (steps === 8 && acc >= DT) { acc = 0; sim.stats.overruns++; } // bounded catch-up: never spiral, record the overrun
    if (steps) simMs = (performance.now() - s0) / steps;
  }
  present(ui.started && !ui.paused && !TEST ? rawDt : (TEST ? 0 : rawDt * 0), TEST ? 1 : acc / DT);
  fpsAcc += rawDt; fpsN++; worst.push(rawDt * 1000); if (worst.length > 300) worst.shift();
  if (fpsAcc > 0.5) { fpsShow = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
  if (!TEST) adaptQuality(rawDt * 1000);
}
function present(dt, alpha) {
  const time = now / 1000; renderer.info.reset();
  R.clock.value = settings.reducedMotion ? 0 : time;
  if (R.waterMat) R.waterMat.uniforms.uTime.value = R.clock.value;
  onEvents(sim.drainEvents());
  if (dt > 0) { // keyboard pan
    const k = cam.dist * 0.9 * dt, px = innerHeight / cam.dist / 1.25; let dx = 0, dy = 0;
    if (keys.has('arrowleft') || keys.has('a')) dx += k * px; if (keys.has('arrowright') || keys.has('d')) dx -= k * px;
    if (keys.has('arrowup') || keys.has('w')) dy += k * px; if (keys.has('arrowdown') || keys.has('s')) dy -= k * px;
    if (dx || dy) { panBy(dx, dy, cam.dist / innerHeight * 1.25); if (camX.follow || camX.action) stopFollow(); }
    if (keys.has('q')) { goal.yaw += dt * 1.6; camX.auto = false; } if (keys.has('e')) { goal.yaw -= dt * 1.6; camX.auto = false; }
    if ((camHold.yaw || camHold.pitch) && performance.now() - camHold.t > 260) { goal.yaw += camHold.yaw * dt * 1.5; goal.pitch += camHold.pitch * dt * 0.8; }
    if (keys.has('z') || keys.has('pagedown')) { goal.pitch -= dt * 0.9; camX.auto = false; } if (keys.has('x') || keys.has('pageup')) { goal.pitch += dt * 0.9; camX.auto = false; } }
  if (dt > 0) stepCamera(dt); updateCamera(); fitShadow();
  syncTowers(); drawTowers(dt, time);
  CRE.draw(alpha, time, dt || 0, camera, cosmeticCut() >= 3);
  FXS.ambient(dt || 0, [...towerViews.values()].map(v => [v.t, v.g]), time); FXS.update(dt || 0);
  drawRings(dt || 0); drawPillars(dt || 0); WORLD.life(time, camera.position); RIVER.update(time);
  post.tilt = 0.6 * smooth01(overview.dist * 0.9, home.dist * 0.8, cam.dist); // depth of field only at gameplay zoom
  if (R.M.basaltRef) R.M.basaltRef.emissiveIntensity = 1.3 + Math.sin(time * 2.2) * 0.5;
  { const V = R.vault.userData; if (V.rings) { V.rings[0].rotation.y = time * 0.5; V.rings[1].rotation.y = -time * 0.8; V.shield.material.uniforms.uHurt.value = vaultHurt; } if (R.portalStones) R.portalStones.rotation.x = time * 0.25; }
  const cr = WORLD.crystal; cr.rotation.y = time * 0.6; cr.position.y = 1.55 + Math.sin(time * 1.5) * 0.07;
  vaultHurt = Math.max(0, vaultHurt - dt * 2); cr.material.emissive.copy(lin(0x3FC8B8)).lerp(lin(0xFF3A1A), vaultHurt);
  if (tele) { tele.t += dt || 1 / 60; const f = Math.min(1, tele.t / tele.dur), Rr = 2.6; teleMesh.visible = teleFill.visible = true;
    teleMesh.position.set(tele.x, 0.08, tele.z); teleMesh.scale.set(Rr, Rr, 1); teleFill.position.set(tele.x, 0.07, tele.z); teleFill.scale.set(Rr * f, Rr * f, 1);
    teleMesh.material.opacity = 0.6 + 0.4 * Math.abs(Math.sin(tele.t * 8)); if (tele.t > tele.dur + 0.2) { tele = null; teleMesh.visible = teleFill.visible = false; } }
  // placement preview: grid lines appear on the terrain, free build pads glow
  const h = ui.hover, showPlace = !!sim.offer;
  R.gridU.value += ((showPlace ? 1 : 0) - R.gridU.value) * Math.min(1, (dt || 1 / 60) * 8);
  hoverTile.visible = false; rangeRing.visible = rangeFill.visible = false;
  if (showPlace) {
    let n = 0; for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) if (sim.canBuild(x, z)) { m4.makeRotationX(-Math.PI / 2).setPosition(x + 0.5, 0.03, z + 0.5); buildDots.setMatrixAt(n++, m4); }
    buildDots.count = n; buildDots.instanceMatrix.needsUpdate = true; buildDots.material.opacity = settings.reducedMotion ? 0.35 : 0.28 + 0.1 * Math.sin(time * 3);
    if (h && h.tx >= 0 && h.tz >= 0 && h.tx < W && h.tz < H) { const ok = sim.canBuild(h.tx, h.tz); hoverTile.visible = true; hoverTile.position.set(h.tx + 0.5, 0.05, h.tz + 0.5);
      hoverTile.material.color.copy(lin(ok ? 0x9CE06A : 0xE0604A)).multiplyScalar(1.5);
      if (ok) { const r = AH.ARCH[sim.offer.arch].range + 0.25 * sim.offer.tier; showRange(h.tx + 0.5, h.tz + 0.5, r, 0x9CE06A);
        const sig = sim.offer.el + sim.offer.arch + sim.offer.tier + sim.offer.ability; if (!ghost || ghostSig !== sig) { if (ghost) disposeTower(ghost); ghost = R.buildTower({ ...sim.offer, x: 0, z: 0 }, tex); world.add(ghost); ghostSig = sig;
          ghost.traverse(o => { if (o.isMesh) { const src = o.material; o.material = src.clone(); o.material.onBeforeCompile = src.onBeforeCompile; o.material.customProgramCacheKey = src.customProgramCacheKey; o.material.transparent = true; o.material.opacity = 0.55; o.castShadow = false; } }); }
        ghost.visible = true; ghost.position.set(h.tx + 0.5, 0, h.tz + 0.5); R.animateTower(ghost, dt || 0, time); } else if (ghost) ghost.visible = false; }
    else if (ghost) ghost.visible = false;
  } else { buildDots.count = 0; if (ghost) ghost.visible = false; }
  const sel = ui.selected != null ? sim.towers.find(t => t.id === ui.selected) : null;
  partnerMarks.count = 0;
  if (sel) { showRange(sel.x, sel.z, sel.range, 0x58C4B8);
    let n = 0; for (const o of sim.mergePartners(sel)) { const tp = (towerViews.get(o.id)?.g.userData.top || 1.2); eul.set(Math.PI, 0, 0); qd.setFromEuler(eul); m4.compose(v3.set(o.x, tp + 0.9 + Math.sin(time * 4) * 0.08, o.z), qd, sc.set(0.2, 0.28, 0.2)); partnerMarks.setMatrixAt(n++, m4); }
    partnerMarks.count = n; partnerMarks.instanceMatrix.needsUpdate = true; }
  if (bannerT > 0) { bannerT -= (dt || 1 / 60); if (bannerT <= 0) $('#banner').classList.remove('show'); }
  if (postOn) post.render(scene, camera); else renderer.render(scene, camera);
  if (now - ui.lastUi > 100) { ui.lastUi = now; updateUI(); drawMinimap(); } // non-critical UI at 10 Hz
  const perf = $('#perf'); perf.classList.toggle('hidden', !settings.showPerf);
  if (settings.showPerf) { const ri = renderer.info.render; const ws = worst.slice().sort((a, b) => b - a); const w1 = ws[Math.floor(ws.length * 0.01)] || 0;
    perf.textContent = `fps ${fpsShow.toFixed(0)}  worst1% ${w1.toFixed(1)}ms\nsim ${simMs.toFixed(2)}ms/tick  overruns ${sim.stats.overruns}\nunits ${sim.alive} (drawn ${sim.alive - CRE.stats.culled}, full-detail ${CRE.stats.hi})  towers ${sim.towers.length}\ndraws ${ri.calls}  tris ${(ri.triangles / 1000).toFixed(0)}k\nquality ${QL}  cut ${cosmeticCut()}  res ${(renderer.getPixelRatio()).toFixed(2)}\nfx ${FXS.count()}  seed ${seed}`; }
}
function showRange(x, z, r, col) { rangeRing.visible = rangeFill.visible = true; rangeRing.position.set(x, 0.06, z); rangeRing.scale.set(r, r, 1); rangeFill.position.set(x, 0.055, z); rangeFill.scale.set(r, r, 1);
  rangeRing.material.color.copy(lin(col)).multiplyScalar(1.6); rangeFill.material.color.copy(lin(col)); }

// ------------------------------------------------------------------ in-page bot (for ?auto demo and the visual harness)
let botAct = null;
if (Q.has('auto') && AH.BasicBot) { const b = new AH.BasicBot(sim, seed); botAct = (t) => b.act(t); }

// ------------------------------------------------------------------ boot
if (innerWidth <= 640) { $('#board').classList.add('collapsed'); $('#board-toggle').textContent = 'Show'; $('#board-toggle').setAttribute('aria-expanded', 'false'); }
applyQuality(QL); resize(); buildMinimap(); updateUI(true); fitCamera(); camHome(); snapCam();
if (!ui.started) titleScreen(); else if (sim.stressN) banner('Benchmark', `${sim.stressN} units on the field`); else if (!TEST) banner('The Verdant Vault', 'Roll your first tower, then place it beside the path.');
requestAnimationFrame(frame);

// test / harness hooks (deterministic stepping for reproducible checkpoint frames)
window.__ah = {
  get sim() { return sim; }, ui, settings, cam, act, updateUI, camHome, toast,
  step(n) { for (let k = 0; k < n; k++) { if (botAct) botAct(sim.tick); sim.step(); if (n - k > 30) { onEvents(sim.drainEvents()); FXS.update(1 / 30); CRE.age(1 / 30); drawRings(1 / 30); drawPillars(1 / 30); if (bannerT > 0 && (bannerT -= 1 / 30) <= 0) $('#banner').classList.remove('show'); } }
    if (n > 90) { [...$('#toasts').children].slice(0, -1).forEach(t => t.remove()); if (tele && sim.tick - tele.tick > (tele.dur + 0.2) * 30) tele = null; else if (tele) tele.t = (sim.tick - tele.tick) / 30; } },
  render(dtSec = 1 / 60) { now += dtSec * 1000; present(dtSec, 1); updateUI(true); drawMinimap(); },
  select(id) { ui.selected = id; updateUI(true); }, hover(tx, tz) { ui.hover = { tx, tz }; },
  project(x, y, z) { const v = new THREE.Vector3(x, y, z).project(camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; },
  towerTop(id) { const v = towerViews.get(id); return v ? v.g.userData.top : 0; }, pick(x, y) { return pickTower(x, y); }, pickOld(x, y) { const p = pickTile(x, y); return p && p.tx >= 0 && p.tz >= 0 && p.tx < W && p.tz < H ? sim.towerAt[p.tz * W + p.tx] || null : null; },
  setBot(on) { if (on && AH.BasicBot) { const b = new AH.BasicBot(sim, seed); botAct = (t) => b.act(t); } else botAct = null; },
  closeTitle() { closeOverlay('title'); ui.started = true; },
  camTo(x, z, d, pitch, yaw) { goal.tx = cam.tx = x; goal.tz = cam.tz = z; goal.dist = cam.dist = d; goal.pitch = cam.pitch = pitch != null ? pitch : pitchFor(d); if (yaw != null) goal.yaw = cam.yaw = yaw; },
  follow(i) { camX.follow = { type: 'mon', i, gen: sim.m.gen[i], name: 'x' }; }, action(on) { camX.action = on; camX.actionT = 99; },
  camHome() { camHome(); snapCam(); }, camOverview() { camOverview(); snapCam(); },
  debug: { get renderer() { return renderer; }, CRE, FXS, scene, sun, hemi, post },
  info() { return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, alive: sim.alive, towers: sim.towers.length, quality: QL }; },
};
})();
