/* Arcane Hand — towers. Element = architecture + material language; rarity = plinth, trim, banners, floating ornaments,
   height; archetype = weapon head; ability = one physical prop. Towers are few (< 50), so each is a small group. */
(function () {
'use strict';
const R = globalThis.AHR, T = R.T, lin = R.lin;
let M = null;
function mats(tex) {
  if (M) return M;
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const glow = (c, i = 2) => std({ color: lin(c), emissive: lin(c), emissiveIntensity: i, roughness: 0.4 });
  M = {
    wood: R.M.wood, brick: R.M.brick,
    stoneLight: std({ map: tex.brick, normalMap: tex.brickN, color: lin(0xF2F0EA), roughness: 0.8 }),
    stoneMid: std({ map: tex.brick, normalMap: tex.brickN, color: lin(0xC8C0B4), roughness: 0.85 }),
    basalt: std({ map: tex.brick, normalMap: tex.brickN, color: lin(0x5A4A44), roughness: 0.7, emissive: lin(0xFF6A1A), emissiveMap: tex.cracks, emissiveIntensity: 1.6 }),
    obsidian: std({ color: lin(0x1C1626), roughness: 0.18, metalness: 0.35 }),
    iron: std({ color: lin(0x3A3C40), roughness: 0.45, metalness: 0.8 }),
    brass: std({ color: lin(0xC8904A), roughness: 0.32, metalness: 1 }),
    copper: std({ color: lin(0xB8683A), roughness: 0.35, metalness: 1 }),
    silver: std({ color: lin(0xB8C0CC), roughness: 0.42, metalness: 0.85 }),
    gold: R.M.gold, bark: R.M.bark, vc: R.M.vc, leaf: R.M.leaf,
    roofBlue: std({ map: tex.shingle, normalMap: tex.shingleN, color: lin(0x5A8AC8), roughness: 0.6 }),
    roofRed: std({ map: tex.shingle, normalMap: tex.shingleN, color: lin(0xB85A3A), roughness: 0.6 }),
    water: std({ color: lin(0x6FD0F4), emissive: lin(0x2A8AC8), emissiveIntensity: 0.9, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.88 }),
    lava: glow(0xFF6A1A, 2.6), flameA: glow(0xFF7A2A, 3.2), flameB: glow(0xFFD060, 3.6),
    voidG: glow(0xB070FF, 2.8), stormG: glow(0xFFF2A0, 3.2), groveG: glow(0xC8F060, 2.4), tideG: glow(0x7FE0FF, 2.2),
    rune: [glow(0xBDB6A4, 0.4), glow(0x7FB7D9, 1.1), glow(0x5CC9A7, 1.3), glow(0xE89A4A, 1.7), glow(0xF2C94C, 2.2)],
    cloth: [0, 0x3F6FA8, 0x2E9A7A, 0xC0662A, 0xD8A838].map(c => std({ color: lin(c || 0x888888), roughness: 0.9, side: THREE.DoubleSide })),
    trim: [null, null, null, null, null],
  };
  M.window = glow(0xFFC870, 2.2);
  M.kit = R.kitMaterial();
  M.fall = std({ color: lin(0x8FDCF4), emissive: lin(0x2A7AA8), emissiveIntensity: 0.35, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.55 });
  // finer masonry on towers (smaller bricks read as real stonework up close)
  for (const k of ['stoneLight', 'stoneMid', 'basalt']) { const m = M[k]; m.map = m.map.clone(); m.map.repeat.set(3, 2.4); m.map.needsUpdate = true;
    m.normalMap = m.normalMap.clone(); m.normalMap.repeat.set(3, 2.4); m.normalMap.needsUpdate = true; m.normalScale = new THREE.Vector2(1.6, 1.6); }
  if (M.basalt.emissiveMap) { M.basalt.emissiveMap = M.basalt.emissiveMap.clone(); M.basalt.emissiveMap.repeat.set(2, 1.6); M.basalt.emissiveMap.needsUpdate = true; }
  M.band = {}; for (const [el, c] of Object.entries({ ember: 0xFF6A1A, tide: 0x4FC8F0, iron: 0xE8B050, grove: 0x9CE05A, void: 0xB070FF, storm: 0xFFE070 }))
    M.band[el] = std({ color: lin(0x1A1A20), metalness: 0.8, roughness: 0.35, emissive: lin(c), emissiveMap: tex.runeStrip, emissiveIntensity: 2.2 }); R.M.basaltRef = M.basalt;
  M.trim = [M.iron, std({ color: lin(0x7F9AB8), roughness: 0.6, metalness: 0.3 }), std({ color: lin(0x3F9A7E), roughness: 0.6, metalness: 0.3 }), std({ color: lin(0xB86A2E), roughness: 0.55, metalness: 0.4 }), std({ color: lin(0xC89A3A), roughness: 0.5, metalness: 0.6 })];
  // grounding: stone darkens toward the ground (contact AO), then rim light
  for (const k of ['stoneLight', 'stoneMid', 'basalt', 'obsidian', 'brick', 'wood']) { const m = M[k]; if (m.userData.ao) continue; m.userData.ao = 1;
    R.patch(m, { vars: 'varying float vWY;', begin: 'vWY = (modelMatrix * vec4(transformed, 1.)).y;', fragVars: 'varying float vWY;', fragColor: 'diffuseColor.rgb *= mix(0.42, 1.0, smoothstep(0.0, 0.75, vWY));' }); }
  for (const k of ['stoneLight', 'stoneMid', 'basalt', 'obsidian', 'iron', 'brass', 'copper', 'silver', 'roofBlue', 'roofRed', 'water']) R.rim(M[k], 0.28);
  for (const cm of M.cloth) R.patch(cm, { begin: 'transformed.z += sin(uTime * 3.2 + position.y * 9. + position.x * 20.) * 0.035 * (position.x + 0.08) * 6.;' });
  M.runeDecal = {};
  for (const [el, c] of Object.entries({ ember: 0xFF7A2A, tide: 0x4FB8F0, grove: 0x8CD04A, void: 0xA060FF, storm: 0xFFE070, iron: 0xE0C090 }))
    M.runeDecal[el] = new THREE.MeshBasicMaterial({ map: tex.rune, color: lin(c).multiplyScalar(1.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 });
  return M;
}
const mesh = (g, m, parent, mat4) => { const o = new THREE.Mesh(g, m); if (mat4) o.applyMatrix4(mat4); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o; };
const cyl = (rt, rb, h, s = 12, open = false) => new THREE.CylinderGeometry(rt, rb, h, s, 1, open);
const box = (x, y, z) => new THREE.BoxGeometry(x, y, z);
const PI = Math.PI, cos = Math.cos, sin = Math.sin;

// ---------------- kit parts: many small multi-colour pieces merged into ONE mesh per parent (R.kitMaterial)
const kp = (g, m, c, ex = {}) => Object.assign({ g, m, c }, ex);
const kE = (x, y, z, sx, sy, sz, c, ex = {}) => kp(new THREE.SphereGeometry(1, Math.max(sx, sy, sz) > 0.06 ? 16 : 9, Math.max(sx, sy, sz) > 0.06 ? 12 : 7), T(x, y, z, ex.rx || 0, ex.ry || 0, ex.rz || 0, sx, sy, sz), c, ex);
const kB = (x, y, z, sx, sy, sz, c, ex = {}) => kp(box(sx, sy, sz), T(x, y, z, ex.rx || 0, ex.ry || 0, ex.rz || 0), c, ex);
const kC = (rt, rb, h, x, y, z, c, ex = {}) => kp(cyl(rt, rb, h, ex.seg || 12, ex.open), T(x, y, z, ex.rx || 0, ex.ry || 0, ex.rz || 0), c, ex);
const kCone = (r, h, x, y, z, c, ex = {}) => kp(new THREE.ConeGeometry(r, h, ex.seg || 8), T(x, y, z, ex.rx || 0, ex.ry || 0, ex.rz || 0), c, ex);
const kT = (r, t, x, y, z, c, ex = {}) => kp(new THREE.TorusGeometry(r, t, ex.ts || 6, ex.rs || 28), T(x, y, z, ex.rx || 0, ex.ry || 0, ex.rz || 0, ex.sx || 1, ex.sy || 1, 1), c, ex);
const kO = (r, x, y, z, c, ex = {}) => kp(new THREE.OctahedronGeometry(r, 0), T(x, y, z, ex.rx || 0, ex.ry || 0, ex.rz || 0, 1, ex.sy || 1, 1), c, ex);
const kTube = (pts, r0, r1, c, ex = {}) => kp(R.ttube(pts, r0, r1, ex.rad || 8, 5), new THREE.Matrix4(), c, ex);
const kL = (prof, x, y, z, c, ex = {}) => kp(R.lathe(prof, ex.seg || 18), T(x, y, z, ex.rx || 0, ex.ry || 0, ex.rz || 0), c, ex);
function kAlong(g, a, b, c, ex = {}) { const A = new THREE.Vector3(...a), d = new THREE.Vector3(...b).sub(A), L = d.length(); g.translate(0, 0.5, 0);
  return kp(g, new THREE.Matrix4().compose(A, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()), new THREE.Vector3(1, L, 1)), c, ex); }
// material presets for kit parts (roughness r, metalness mt, glow)
const IRONK = { r: 0.42, mt: 0.85 }, GOLDK = { r: 0.28, mt: 1 }, WOODK = { r: 0.85 }, STONEK = { r: 0.85 }, GLOSSK = { r: 0.15, mt: 0.25 }, CERAMIC = { r: 0.2, mt: 0.05 };
const G = (g, ex = {}) => Object.assign({ glow: g, r: 0.4 }, ex);
const TRIMC = [0x4A4C52, 0x7F9AB8, 0x3F9A7E, 0xB86A2E, 0xD8A848], GEMC = [0xBDB6A4, 0x7FB7D9, 0x5CC9A7, 0xE89A4A, 0xF2C94C];
const ELC = { ember: 0xFF7A2A, tide: 0x5FD8FF, grove: 0xB8F060, void: 0xB070FF, storm: 0xFFF0A0, iron: 0xFFC060 };

R.buildTower = function (t, tex) {
  const M = mats(tex), g = new THREE.Group(), tier = t.tier, KP = new Map();
  const K = (par, ...parts) => { if (!KP.has(par)) KP.set(par, []); KP.get(par).push(...parts); };
  g.position.set(t.x, R.groundY ? R.groundY(t.x, t.z) : 0, t.z);
  const archH = { bolt: 1, sniper: 1.22, rapid: 0.94, heavy: 0.9 }[t.arch], aw = t.arch === 'heavy' ? 1.14 : t.arch === 'sniper' ? 0.9 : 1;
  const U = g.userData = { spin: [], bob: [], flame: null, kick: 0 };
  const trim = TRIMC[tier], trimX = tier >= 4 ? GOLDK : { r: 0.45, mt: 0.6 }, ec = ELC[t.el];
  // ---------------- plinth by rarity (footprint radius <= 0.43, so neighbours keep a visible gap)
  let yb;
  if (tier === 0) { mesh(cyl(0.38, 0.42, 0.14, 10), M.stoneMid, g, T(0, 0.07, 0)); mesh(cyl(0.36, 0.37, 0.05, 10), M.wood, g, T(0, 0.165, 0)); yb = 0.19;
    for (let k = 0; k < 4; k++) { const a = k / 4 * PI * 2 + PI / 4; K(g, kC(0.024, 0.03, 0.36, cos(a) * 0.37, 0.18, sin(a) * 0.37, 0x6A4A30, WOODK), kCone(0.03, 0.07, cos(a) * 0.37, 0.39, sin(a) * 0.37, 0x6A4A30, WOODK)); }
    K(g, kT(0.37, 0.008, 0, 0.3, 0, 0xB8A070, { rx: PI / 2, r: 0.9, rs: 32 })); }
  else { mesh(cyl(0.4, 0.43, 0.2, 8), M.stoneMid, g, T(0, 0.1, 0, 0, PI / 8)); yb = 0.2;
    if (tier >= 2) { mesh(cyl(0.34, 0.37, 0.14, 8), M.stoneMid, g, T(0, 0.27, 0, 0, PI / 8)); yb = 0.34; }
    if (tier >= 3) { mesh(cyl(0.29, 0.31, 0.1, 8), tier >= 4 ? M.stoneLight : M.stoneMid, g, T(0, 0.39, 0, 0, PI / 8)); yb = 0.44; }
    K(g, kT(0.415, 0.016, 0, 0.2, 0, trim, Object.assign({ rx: PI / 2, rs: 40 }, trimX)));
    if (tier >= 2) K(g, kT(0.355, 0.013, 0, 0.34, 0, trim, Object.assign({ rx: PI / 2, rs: 36 }, trimX)));
    if (tier >= 3) K(g, kT(0.3, 0.012, 0, 0.44, 0, trim, Object.assign({ rx: PI / 2, rs: 32 }, trimX))); }
  // rarity gems: count = tier + 1, on the front face
  for (let k = 0; k <= tier; k++) { const a = PI / 2 + (k - tier / 2) * 0.3; K(g, kO(0.045, cos(a) * 0.43, 0.1, sin(a) * 0.43, GEMC[tier], G(1.8, { sy: 1.5 }))); }
  // corner pillars from Superior: crystal lanterns (Superior), braziers (Special), gilded obelisks with floating gems (Legendary)
  if (tier >= 2) for (let k = 0; k < 4; k++) { const a = k / 4 * PI * 2 + PI / 4, x = cos(a) * 0.38, z = sin(a) * 0.38, h = 0.26 + tier * 0.08;
    K(g, kC(0.024, 0.032, h, x, 0.2 + h / 2, z, tier >= 4 ? 0xC8B890 : 0x6A665E, Object.assign({ seg: 6 }, STONEK)), kC(0.04, 0.036, 0.035, x, 0.2 + h, z, trim, trimX));
    const ty = 0.2 + h + 0.02;
    if (tier === 2) K(g, kO(0.035, x, ty + 0.06, z, ec, G(2.2, { sy: 1.8 })), kT(0.04, 0.006, x, ty + 0.06, z, trim, Object.assign({ rx: PI / 2, rs: 12 }, trimX)));
    if (tier === 3) K(g, kL([[0.02, 0], [0.06, 0.03], [0.065, 0.07]], x, ty, z, 0x2E2A2A, Object.assign({ seg: 10 }, IRONK)), kCone(0.045, 0.14, x, ty + 0.1, z, 0xFF9A3A, G(2.6)), kCone(0.025, 0.1, x, ty + 0.12, z, 0xFFE070, G(3)));
    if (tier === 4) { K(g, kCone(0.04, 0.12, x, ty + 0.05, z, 0xD8A848, Object.assign({ seg: 4 }, GOLDK)));
      const gm = new THREE.Group(); gm.position.set(x, ty + 0.2, z); g.add(gm); K(gm, kO(0.04, 0, 0, 0, 0xFFE89A, G(2.6, { sy: 1.6 }))); U.bob.push({ o: gm, a: 0.03, f: 2 + k * 0.4, ax: 'py', base: ty + 0.2 }); } }
  // banners (Superior+) at the back corners so they never hide the tower's face
  if (tier >= 2) for (const s of [-1, 1]) { const ph = 1.25 + tier * 0.15, px = s * 0.3, pz = -0.3;
    K(g, kC(0.013, 0.016, ph, px, ph / 2, pz, 0x5A3A22, WOODK), kO(0.026, px, ph + 0.02, pz, trim, Object.assign({ sy: 1.6 }, trimX)));
    const bn = mesh(new THREE.PlaneGeometry(0.17, 0.4, 1, 5), M.cloth[tier], g, T(px + 0.095, ph - 0.24, pz)); U.bob.push({ o: bn, a: 0.12, f: 2.2, ax: 'y' });
    K(g, kB(px + 0.095, ph - 0.03, pz, 0.19, 0.02, 0.02, trim, trimX)); }

  // ---------------- body by element
  const hb = 1.5 * archH * (1 + 0.1 * tier), top = yb + hb, body = new THREE.Group(); g.add(body);
  const head = new THREE.Group(); head.position.y = top; g.add(head); U.head = head;
  const rAt = (r0, r1, y) => r0 + (r1 - r0) * Math.min(1, Math.max(0, (y - yb) / hb)); // radius of a tapered body at height y
  switch (t.el) {
    case 'ember': { const rb = 0.32 * aw, rt = 0.22 * aw;
      mesh(cyl(rt, rb, hb, 6), M.basalt, body, T(0, yb + hb / 2, 0));
      for (let k = 0; k < 3; k++) { const a = k / 3 * PI * 2 + PI / 6; mesh(box(0.24, hb * 0.46, 0.08), M.basalt, body, T(cos(a) * (rb + 0.02), yb + hb * 0.21, sin(a) * (rb + 0.02), 0, -a, 0.32)); }
      for (let k = 0; k < 3; k++) { const a = k / 3 * PI * 2 + PI / 6 + PI / 3, r = rAt(rb, rt, yb + hb * 0.45) * 0.87; mesh(box(0.05, hb * 0.78, 0.02), M.lava, body, T(cos(a) * (r + 0.01), yb + hb * 0.45, sin(a) * (r + 0.01), 0, -a + PI / 2, 0)); }
      for (const f of [0.3, 0.62, 0.9]) { const y = yb + hb * f, r = rAt(rb, rt, y); K(body, kC(r + 0.022, r + 0.028, 0.05, 0, y, 0, 0x2E2A2C, Object.assign({ seg: 6 }, IRONK)));
        for (let k = 0; k < 6; k++) { const a = k / 6 * PI * 2; K(body, kE(cos(a) * (r + 0.03), y, sin(a) * (r + 0.03), 0.014, 0.014, 0.014, 0xB8904A, GOLDK)); } }
      for (let k = 0; k < 3; k++) { const a = k / 3 * PI * 2 + PI / 2, r = rt + 0.02, x = cos(a), z = sin(a);
        K(body, kTube([[x * r, top - 0.12, z * r], [x * (r + 0.12), top + 0.02, z * (r + 0.12)], [x * (r + 0.14), top + 0.2, z * (r + 0.14)], [x * (r + 0.08), top + 0.3, z * (r + 0.08)]], 0.045, 0.003, 0x1C1418, GLOSSK)); }
      mesh(cyl(0.3, 0.17, 0.2, 10, true), M.iron, head, T(0, 0.08, 0));
      for (let k = 0; k < 6; k++) { const a = k / 6 * PI * 2, x = cos(a), z = sin(a); K(head, kTube([[x * 0.26, 0.12, z * 0.26], [x * 0.36, 0.3, z * 0.36], [x * 0.33, 0.46, z * 0.33]], 0.022, 0.008, 0x2E2A2C, IRONK), kE(x * 0.33, 0.47, z * 0.33, 0.022, 0.022, 0.022, 0xFF9A3A, G(2.4))); }
      const fl = new THREE.Group(); fl.position.y = 0.14; head.add(fl); U.flame = fl;
      mesh(new THREE.ConeGeometry(0.2, 0.56, 8), M.flameA, fl, T(0, 0.24, 0)); mesh(new THREE.ConeGeometry(0.12, 0.46, 7), M.flameB, fl, T(0.04, 0.24, 0.03));
      for (let k = 0; k < 4; k++) { const a = k / 4 * PI * 2 + 0.4; mesh(new THREE.ConeGeometry(0.075, 0.3, 6), M.flameA, fl, T(cos(a) * 0.12, 0.13, sin(a) * 0.12, sin(a) * 0.35, 0, -cos(a) * 0.35)); }
      break; }
    case 'tide': { const rb = 0.31 * aw, rt = 0.24 * aw;
      mesh(cyl(rt, rb, hb, 20), M.stoneLight, body, T(0, yb + hb / 2, 0));
      mesh(cyl(rb, 0.4, 0.22, 20), M.roofBlue, body, T(0, yb + 0.11, 0));
      for (const f of [0.34, 0.6]) { const y = yb + hb * f, r = rAt(rb, rt, y); mesh(cyl(r + 0.018, r + 0.02, 0.07, 20, true), M.roofBlue, body, T(0, y, 0)); }
      for (let k = 0; k < 4; k++) { const a = PI / 2 + (k - 1.5) * 1.1 + k * 0.4, y = yb + hb * (0.2 + k * 0.16), r = rAt(rb, rt, y) + 0.004, x = cos(a), z = sin(a), ry = -a + PI / 2;
        K(body, kB(x * r, y, z * r, 0.1, 0.16, 0.03, 0xE8E2D4, Object.assign({ ry }, STONEK)), kB(x * (r + 0.008), y - 0.01, z * (r + 0.008), 0.065, 0.11, 0.02, 0x7FE8FF, G(1.8, { ry })),
          kE(x * (r + 0.008), y + 0.045, z * (r + 0.008), 0.033, 0.033, 0.01, 0x7FE8FF, G(1.8, { ry }))); }
      const yy = yb + hb * 0.86, rr = rAt(rb, rt, yy) + 0.1; mesh(cyl(rr, rr - 0.04, 0.05, 20), M.stoneMid, body, T(0, yy, 0));
      for (let k = 0; k < 14; k++) { const a = k / 14 * PI * 2; K(body, kC(0.011, 0.011, 0.1, cos(a) * (rr - 0.015), yy + 0.07, sin(a) * (rr - 0.015), 0xE8E2D4, STONEK)); }
      K(body, kT(rr - 0.015, 0.012, 0, yy + 0.12, 0, 0x3A6AA8, { rx: PI / 2, r: 0.5, mt: 0.4, rs: 40 }));
      for (let k = 0; k < 3; k++) { const a = PI / 2 + (k - 1) * 1.3, y0 = yy - 0.04, L = hb * 0.5, r = rAt(rb, rt, y0 - L / 2) + 0.03;
        mesh(box(0.07, L, 0.025), M.fall, body, T(cos(a) * r, y0 - L / 2, sin(a) * r, 0, -a + PI / 2, 0));
        K(body, kE(cos(a) * (r + 0.02), y0 - L - 0.01, sin(a) * (r + 0.02), 0.06, 0.03, 0.05, 0xE8FAFF, G(1.2))); }
      mesh(cyl(0.1, 0.38 * aw, 0.24, 20, true), M.roofBlue, body, T(0, top - 0.02, 0));
      const coral = [0xFF7A8A, 0xFF9A4A, 0xFF6AB0, 0xFFB050, 0xE870C0];
      for (let k = 0; k < 5; k++) { const a = k / 5 * PI * 2 + 0.3, x = cos(a), z = sin(a);
        K(head, kTube([[x * 0.1, 0.06, z * 0.1], [x * 0.2, 0.2, z * 0.2], [x * 0.17, 0.36, z * 0.17], [x * 0.21, 0.46, z * 0.21]], 0.03, 0.006, coral[k], G(0.35, { r: 0.6 })),
          kE(x * 0.21, 0.46, z * 0.21, 0.02, 0.02, 0.02, 0xFFE0F0, G(2))); }
      K(head, kO(0.05, 0.26, 0.08, 0.14, 0xFF9A4A, { rx: PI / 2, sy: 0.3, r: 0.6 }), kO(0.04, -0.22, 0.1, 0.18, 0xFFC060, { rx: PI / 2 + 0.3, sy: 0.3, r: 0.6 }));
      const orb = mesh(new THREE.SphereGeometry(0.17, 24, 16), M.water, head, T(0, 0.34, 0)); U.bob.push({ o: orb, a: 0.04, f: 1.6, ax: 'py', base: 0.34 });
      const ring = new THREE.Group(); ring.position.y = 0.34; head.add(ring); U.spin.push({ o: ring, s: 1.4 });
      for (let k = 0; k < 4; k++) { const a = k / 4 * PI * 2; mesh(new THREE.SphereGeometry(0.035, 10, 8), M.tideG, ring, T(cos(a) * 0.3, sin(a * 2) * 0.04, sin(a) * 0.3)); }
      break; }
    case 'grove': { const rb = 0.26 * aw, rt = 0.15 * aw;
      const tr = R.ttube([[0, yb - 0.02, 0], [0.04, yb + hb * 0.35, -0.03], [-0.04, yb + hb * 0.7, 0.03], [0, top + 0.05, 0]], rb, rt, 14, 6); const uv = tr.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * hb * 2.2);
      mesh(tr, M.bark, body);
      for (let k = 0; k < 5; k++) { const a = k / 5 * PI * 2 + 0.3, x = cos(a), z = sin(a); mesh(R.ttube([[x * 0.1, yb + 0.4, z * 0.1], [x * 0.26, yb + 0.16, z * 0.26], [x * 0.4, yb + 0.02, z * 0.4]], 0.08, 0.02, 8, 4), M.bark, body); }
      const py = yb + hb * 0.48; mesh(cyl(0.4, 0.37, 0.05, 14), M.wood, body, T(0, py, 0));
      for (let k = 0; k < 12; k++) { const a = k / 12 * PI * 2; K(body, kC(0.012, 0.014, 0.12, cos(a) * 0.37, py + 0.08, sin(a) * 0.37, 0x6A4A30, WOODK)); }
      K(body, kT(0.37, 0.01, 0, py + 0.14, 0, 0x7A5A38, { rx: PI / 2, r: 0.85, rs: 40 }), kE(0.3, py - 0.14, 0.2, 0.045, 0.06, 0.045, 0xFFD070, G(2.4)), kC(0.004, 0.004, 0.1, 0.3, py - 0.06, 0.2, 0x3A2A1A));
      { const pts = []; for (let k = 0; k <= 16; k++) { const a = k / 16 * PI * 5, y = yb + 0.1 + k / 16 * (hb * 0.95), r = rAt(rb, rt, y) + 0.015; pts.push([cos(a) * r, y, sin(a) * r]); }
        K(body, kTube(pts, 0.02, 0.014, 0x4E8A2E, { r: 0.7 }));
        for (let k = 1; k < 16; k += 2) { const [x, y, z] = pts[k]; K(body, kE(x * 1.08, y, z * 1.08, 0.022, 0.022, 0.022, k % 4 === 1 ? 0xFF8AD8 : 0xFFF4FF, G(0.9))); } }
      for (let k = 0; k < 3; k++) { const a = PI / 2 + (k - 1) * 0.7, x = cos(a) * 0.32, z = sin(a) * 0.32, h = 0.08 + k * 0.03;
        K(g, kC(0.016, 0.02, h, x, yb + h / 2, z, 0xEDE3D0), kE(x, yb + h, z, 0.05 - k * 0.006, 0.028, 0.05 - k * 0.006, [0xC83A2A, 0xE0602A, 0x4AB8FF][k], k === 2 ? G(1.6) : GLOSSK)); }
      const can = R.merge([0, 1, 2, 3, 4, 5].map(k => ({ g: R.blob(1, 0.4, 300 + k + tier * 7), m: T(k ? cos(k * 1.26) * 0.24 : 0, k ? 0.12 + (k % 2) * 0.08 : 0.22, k ? sin(k * 1.26) * 0.24 : 0, 0, 0, 0, k ? 0.24 : 0.32), c: [0x5E9A3A, 0x6EAA42, 0x4E8A34, 0x7CB84A, 0x5A9038, 0x88C050][k], ao: [-0.2, 0.5] })));
      mesh(can, M.leaf, head, T(0, 0.02, 0));
      for (let k = 0; k < 9; k++) { const a = k * 2.4, r = 0.3 + (k % 3) * 0.04; K(head, kE(cos(a) * r, 0.12 + (k % 3) * 0.1, sin(a) * r, 0.04, 0.04, 0.04, [0xFFB0E0, 0xFFF0F8, 0xFF8AC8][k % 3], G(0.6))); }
      for (let k = 0; k < 3 + tier; k++) { const a = k * 2.1 + 0.5; K(head, kC(0.004, 0.004, 0.12, cos(a) * 0.3, -0.08, sin(a) * 0.3, 0x3A5A24), kE(cos(a) * 0.3, -0.16, sin(a) * 0.3, 0.04, 0.05, 0.04, 0xC8F060, G(2.2))); }
      break; }
    case 'void': { mesh(new THREE.CylinderGeometry(0.2 * aw, 0.3 * aw, 0.2, 4), M.obsidian, body, T(0, yb + 0.1, 0, 0, PI / 4));
      const segs = [[0.36, 0.26, 0.22], [0.3, 0.2, 0.165], [0.2, 0.15, 0.11]]; let y = yb + 0.24;
      segs.forEach(([f, rbot, rtop], k) => { const h = hb * f * 0.95, sg = new THREE.Group(); sg.position.y = y + h / 2; body.add(sg);
        mesh(new THREE.CylinderGeometry(rtop * aw, rbot * aw, h, 4), M.obsidian, sg, T(0, 0, 0, 0, PI / 4));
        for (let e = 0; e < 4; e++) { const a = e / 4 * PI * 2, rm = (rtop + rbot) / 2 * aw; K(sg, kB(cos(a) * rm * 1.0, 0, sin(a) * rm * 1.0, 0.014, h * 0.9, 0.014, 0xB070FF, G(1.6, { ry: -a, rz: (rbot - rtop) * aw / h * (1) }))); }
        K(sg, kB(0, 0, rbot * aw * 0.72, 0.05, 0.05, 0.01, 0xE0B8FF, G(2.6, { rz: PI / 4 })));
        U.bob.push({ o: sg, a: 0.025, f: 1.1 + k * 0.35, ax: 'py', base: sg.position.y });
        K(body, kE(0, y - 0.03, 0, rbot * aw * 0.9, 0.018, rbot * aw * 0.9, 0xC890FF, G(2.2)));
        y += h + 0.07; });
      for (const [f, r, tilt, sp] of [[0.42, 0.4, 0.28, 0.8], [0.74, 0.32, -0.34, -1.1]]) { const rg = new THREE.Group(); rg.position.y = yb + hb * f; rg.rotation.x = tilt; body.add(rg); U.spin.push({ o: rg, s: sp });
        K(rg, kT(r, 0.007, 0, 0, 0, 0xB070FF, G(1.4, { rx: PI / 2, rs: 48 })));
        for (let k = 0; k < 8; k++) { const a = k / 8 * PI * 2; K(rg, kB(cos(a) * r, 0, sin(a) * r, 0.03, 0.04, 0.01, 0xE0B8FF, G(1.6, { ry: -a + PI / 2 }))); } }
      const core = mesh(new THREE.OctahedronGeometry(0.12, 0), M.voidG, head, T(0, 0.12, 0, 0, 0, 0, 1, 1.4, 1)); U.bob.push({ o: core, a: 0.04, f: 1.2, ax: 'py', base: 0.12 });
      const orb = new THREE.Group(); orb.position.y = 0.2; head.add(orb); U.spin.push({ o: orb, s: 0.9 });
      for (let k = 0; k < 5; k++) { const a = k / 5 * PI * 2; mesh(new THREE.TetrahedronGeometry(0.07, 0), M.obsidian, orb, T(cos(a) * 0.34, (k % 2) * 0.1 - 0.05, sin(a) * 0.34, k, k, 0)); }
      break; }
    case 'storm': { const n = 3;
      for (let k = 0; k < n; k++) mesh(cyl((0.25 - k * 0.04) * aw, (0.29 - k * 0.04) * aw, hb / n, 14), M.brass, body, T(0, yb + hb * (k + 0.5) / n, 0));
      for (let k = 0; k < 8; k++) { const y = yb + hb * (0.4 + k * 0.035), r = (0.25 - 0.04) * aw + 0.03; mesh(new THREE.TorusGeometry(r, 0.02, 6, 24), M.copper, body, T(0, y, 0, PI / 2)); }
      for (let k = 0; k < 4; k++) { const y = top - 0.26 + k * 0.07, r = 0.2 - k * 0.022; K(body, kC(r, r + 0.01, 0.035, 0, y, 0, 0xEDE8DC, Object.assign({ seg: 20 }, CERAMIC)), kC(r - 0.05, r - 0.05, 0.035, 0, y + 0.035, 0, 0x8A5A2A, Object.assign({ seg: 14 }, IRONK))); }
      for (const s of [-1, 1]) { const x = s * 0.27 * aw; K(body, kTube([[x, yb + 0.02, 0.12], [x * 0.98, yb + hb * 0.4, 0.13], [x * 0.84, yb + hb * 0.78, 0.1]], 0.022, 0.018, 0xB8683A, { r: 0.35, mt: 1 }));
        K(body, kC(0.045, 0.045, 0.02, x * 1.02, yb + hb * 0.3, 0.14, 0x5A3A22, Object.assign({ rx: PI / 2, seg: 14 }, IRONK)), kC(0.036, 0.036, 0.022, x * 1.02, yb + hb * 0.3, 0.146, 0xFFF0A0, G(1.6, { rx: PI / 2, seg: 14 }))); }
      { const gr = new THREE.Group(); gr.position.set(0, yb + hb * 0.24, 0.28 * aw); body.add(gr); U.spin.push({ o: gr, s: 1.2, ax: 'z' });
        K(gr, kT(0.09, 0.02, 0, 0, 0, 0xC8904A, Object.assign({ rs: 20 }, GOLDK)), kC(0.03, 0.03, 0.03, 0, 0, 0, 0x8A5A2A, Object.assign({ rx: PI / 2 }, GOLDK)));
        for (let k = 0; k < 10; k++) { const a = k / 10 * PI * 2; K(gr, kB(cos(a) * 0.11, sin(a) * 0.11, 0, 0.03, 0.03, 0.03, 0xC8904A, Object.assign({ rz: a }, GOLDK))); } }
      for (let k = 0; k < 4; k++) { const a = k / 4 * PI * 2 + PI / 4, x = cos(a), z = sin(a); K(head, kTube([[x * 0.12, 0.04, z * 0.12], [x * 0.2, 0.25, z * 0.2], [x * 0.14, 0.52, z * 0.14]], 0.02, 0.012, 0xB8683A, { r: 0.35, mt: 1 }), kCone(0.02, 0.14, x * 0.14, 0.58, z * 0.14, 0xE0A060, GOLDK)); }
      const ball = mesh(new THREE.SphereGeometry(0.14, 20, 14), M.stormG, head, T(0, 0.34, 0)); U.bob.push({ o: ball, a: 0.12, f: 9, ax: 's' });
      K(head, kT(0.19, 0.01, 0, 0.34, 0, 0xFFF4C0, G(2.4, { rx: PI / 2 })), kT(0.19, 0.01, 0, 0.34, 0, 0xFFF4C0, G(2.4, { rx: 0.6 })));
      break; }
    case 'iron': { const w = 0.56 * aw;
      mesh(box(w, hb, w), M.stoneMid, body, T(0, yb + hb / 2, 0));
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mesh(box(0.13, hb * 0.5, 0.13), M.stoneMid, body, T(sx * w / 2, yb + hb * 0.25, sz * w / 2, 0, PI / 4, 0));
      const hy = yb + hb * 0.66; mesh(box(w + 0.12, 0.14, w + 0.12), M.wood, body, T(0, hy, 0)); mesh(new THREE.CylinderGeometry((w + 0.02) * 0.72, (w + 0.24) * 0.72, 0.12, 4, 1), M.roofRed, body, T(0, hy + 0.13, 0, 0, PI / 4));
      for (let k = 0; k < 8; k++) { const a = k / 8 * PI * 2, x = Math.max(-1, Math.min(1, cos(a) * 1.42)) * (w / 2 - 0.04), z = Math.max(-1, Math.min(1, sin(a) * 1.42)) * (w / 2 - 0.04); mesh(box(0.11, 0.12, 0.11), M.stoneMid, body, T(x, top + 0.06, z)); }
      mesh(box(w + 0.04, 0.05, w + 0.04), M.stoneMid, body, T(0, top - 0.02, 0));
      for (const [nx, nz, ry] of [[0, 1, 0], [1, 0, PI / 2], [-1, 0, -PI / 2], [0, -1, PI]]) {
        K(body, kB(nx * (w / 2 + 0.005), yb + hb * 0.45, nz * (w / 2 + 0.005), 0.035, 0.13, 0.02, 0x14100E, { ry, r: 0.9 }), kB(nx * (w / 2 + 0.005), hy + 0.32, nz * (w / 2 + 0.005), 0.07, 0.09, 0.02, 0xFFC870, G(2, { ry })));
        if (nz === 1 || nx === 1) { const y = yb + hb * 0.26, c = [nx * (w / 2 + 0.015), y, nz * (w / 2 + 0.015)];
          K(body, kE(c[0], y, c[2], 0.1, 0.1, 0.014, tier >= 3 ? 0x22306A : 0x9A2A26, { ry, r: 0.6 }), kT(0.1, 0.012, c[0] + nx * 0.006, y, c[2] + nz * 0.006, trim, Object.assign({ ry }, trimX)),
            kE(c[0] + nx * 0.015, y, c[2] + nz * 0.015, 0.03, 0.03, 0.03, trim, trimX), kB(c[0] + nx * 0.012, y, c[2] + nz * 0.012, 0.014, 0.16, 0.012, trim, Object.assign({ ry }, trimX))); } }
      K(body, kB(0, yb + 0.14, w / 2 + 0.006, 0.17, 0.26, 0.02, 0x5A3A22, WOODK), kC(0.085, 0.085, 0.021, 0, yb + 0.27, w / 2 + 0.006, 0x5A3A22, Object.assign({ rx: PI / 2, seg: 14, thetaLength: PI }, WOODK)));
      for (const y of [0.07, 0.19]) K(body, kB(0, yb + y, w / 2 + 0.018, 0.18, 0.02, 0.01, 0x2A2A2E, IRONK));
      K(body, kC(0.012, 0.012, 0.6, -w / 2 + 0.05, top + 0.3, -w / 2 + 0.05, 0x5A3A22, WOODK));
      const fl = mesh(new THREE.PlaneGeometry(0.2, 0.13, 4, 1), M.cloth[Math.max(1, tier)], body, T(-w / 2 + 0.15, top + 0.52, -w / 2 + 0.05)); U.bob.push({ o: fl, a: 0.18, f: 2.6, ax: 'y' });
      break; }
  }
  // ---------------- glowing rune band (Rare and up)
  if (tier >= 1 && t.el !== 'grove' && t.el !== 'void') { const y = yb + hb * 0.52, br = t.el === 'iron' ? 0.3 * aw : t.el === 'storm' ? (0.25 - 0.04) * aw + 0.005 : t.el === 'tide' ? rAt(0.31 * aw, 0.24 * aw, y) + 0.006 : rAt(0.32 * aw, 0.22 * aw, y) * 0.96;
    mesh(new THREE.CylinderGeometry(br, br, 0.075, t.el === 'iron' ? 4 : t.el === 'ember' ? 6 : 28, 1, true), M.band[t.el], body, T(0, t.el === 'storm' ? yb + hb * 0.25 : y, 0, 0, PI / 4)); }
  // Special: floating rune ring around the body; Legendary: crown of shards and a halo
  if (tier >= 3) { const rg = new THREE.Group(); rg.position.y = yb + hb * 0.55; g.add(rg); U.spin.push({ o: rg, s: 0.6 });
    K(rg, kT(0.44, 0.009, 0, 0, 0, GEMC[tier], G(1.6, { rx: PI / 2, rs: 56 })));
    for (let k = 0; k < 10; k++) { const a = k / 10 * PI * 2; K(rg, kO(0.03, cos(a) * 0.44, 0, sin(a) * 0.44, GEMC[tier], G(2.4, { sy: 1.6 }))); } }
  if (tier === 4) { const crown = new THREE.Group(); crown.position.y = top + 0.78; g.add(crown); U.spin.push({ o: crown, s: 0.9 });
    for (let k = 0; k < 8; k++) { const a = k / 8 * PI * 2; K(crown, kO(0.06, cos(a) * 0.3, (k % 2) * 0.06, sin(a) * 0.3, 0xE8B850, Object.assign({ rz: 0.3, sy: 2.2 }, GOLDK))); }
    K(crown, kT(0.22, 0.014, 0, 0.02, 0, 0xFFE070, G(2.6, { rx: PI / 2, rs: 48 })), kT(0.3, 0.008, 0, 0.02, 0, 0xFFE070, G(2.2, { rx: PI / 2, rs: 48 })));
  }
  // ---------------- ground rune circle, tinted by element (kept inside the tile)
  { const dec = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 0.98), M.runeDecal[t.el]); dec.rotation.x = -PI / 2; dec.position.y = 0.03; dec.renderOrder = 2; g.add(dec); U.spin.push({ o: dec, s: 0.25, ax: 'z' }); }
  // ---------------- archetype weapon (the head aims at targets)
  const weap = new THREE.Group(); head.add(weap); U.weapon = weap;
  const accent = { ember: M.lava, tide: M.tideG, grove: M.groveG, void: M.voidG, storm: M.stormG, iron: M.brass }[t.el];
  const wy = t.el === 'grove' ? 0.42 : t.el === 'ember' ? 0.62 : t.el === 'tide' ? 0.58 : t.el === 'storm' ? 0.6 : t.el === 'void' ? 0.36 : 0.12;
  if (t.el === 'iron') {
    const wood = 0x6A4A30, steel = 0x7A808C;
    if (t.arch === 'bolt') { K(weap, kB(0, wy + 0.08, 0.02, 0.1, 0.08, 0.44, wood, WOODK), kB(0, wy, -0.02, 0.18, 0.08, 0.18, 0x4A3222, WOODK));
      for (const s of [-1, 1]) K(weap, kTube([[0, wy + 0.1, 0.2], [s * 0.16, wy + 0.1, 0.16], [s * 0.26, wy + 0.1, 0.06]], 0.018, 0.012, steel, IRONK), kC(0.003, 0.003, 0.27, s * 0.13, wy + 0.1, 0.13, 0xE8E0D0, { rz: PI / 2, ry: s * 0.4 }));
      K(weap, kC(0.012, 0.012, 0.4, 0, wy + 0.13, 0.1, 0xC8B090, { rx: PI / 2 }), kCone(0.025, 0.07, 0, wy + 0.13, 0.33, 0xC8C8D0, Object.assign({ rx: PI / 2 }, IRONK))); }
    if (t.arch === 'sniper') { K(weap, kB(0, wy + 0.1, 0.04, 0.12, 0.1, 0.66, wood, WOODK), kB(0, wy, -0.05, 0.22, 0.1, 0.22, 0x4A3222, WOODK));
      for (const s of [-1, 1]) K(weap, kTube([[0, wy + 0.13, 0.3], [s * 0.2, wy + 0.13, 0.26], [s * 0.36, wy + 0.13, 0.12]], 0.024, 0.014, wood, WOODK), kC(0.003, 0.003, 0.38, s * 0.18, wy + 0.13, 0.2, 0xE8E0D0, { rz: PI / 2, ry: s * 0.37 }),
        kT(0.06, 0.014, s * 0.09, wy + 0.06, -0.12, 0x3A3C42, Object.assign({ ry: PI / 2 }, IRONK)));
      K(weap, kC(0.016, 0.016, 0.62, 0, wy + 0.16, 0.12, 0xB8C0CC, Object.assign({ rx: PI / 2 }, IRONK)), kCone(0.035, 0.12, 0, wy + 0.16, 0.48, 0xDDE2EA, Object.assign({ rx: PI / 2 }, IRONK)));
      for (const s of [-1, 1]) K(weap, kB(s * 0.03, wy + 0.16, -0.14, 0.05, 0.004, 0.08, 0xC03A2A, { r: 0.9 })); }
    if (t.arch === 'rapid') { K(weap, kC(0.1, 0.1, 0.16, 0, wy + 0.12, -0.06, 0xC8904A, Object.assign({ rz: PI / 2, seg: 16 }, GOLDK)), kB(0, wy + 0.2, 0.08, 0.3, 0.2, 0.03, 0x4A4C52, IRONK), kB(0, wy + 0.02, 0, 0.16, 0.08, 0.24, 0x4A3222, WOODK));
      const bar = new THREE.Group(); bar.position.set(0, wy + 0.12, 0.2); weap.add(bar); U.spin.push({ o: bar, s: 0, ax: 'z', fire: 18 });
      for (let k = 0; k < 6; k++) { const a = k / 6 * PI * 2; K(bar, kC(0.018, 0.018, 0.34, cos(a) * 0.05, sin(a) * 0.05, 0.02, 0x3A3C42, Object.assign({ rx: PI / 2, seg: 8 }, IRONK))); }
      K(bar, kT(0.07, 0.014, 0, 0, 0.16, 0xC8904A, GOLDK), kT(0.07, 0.014, 0, 0, -0.08, 0xC8904A, GOLDK)); }
    if (t.arch === 'heavy') { const pitch = -0.35;
      K(weap, kB(-0.12, wy + 0.08, 0, 0.04, 0.16, 0.3, 0x5A3A22, WOODK), kB(0.12, wy + 0.08, 0, 0.04, 0.16, 0.3, 0x5A3A22, WOODK));
      for (const s of [-1, 1]) for (const z of [-0.1, 0.1]) K(weap, kT(0.055, 0.016, s * 0.15, wy + 0.04, z, 0x3A3C42, Object.assign({ ry: PI / 2, rs: 16 }, IRONK)));
      const bp = (d) => [0, wy + 0.18 + sin(-pitch) * d, cos(pitch) * d];
      K(weap, kAlong(cyl(0.1, 0.14, 1, 16), bp(-0.22), bp(0.34), 0x2E3036, IRONK), kE(...bp(-0.24), 0.1, 0.1, 0.1, 0x2E3036, IRONK));
      for (const d of [-0.1, 0.12, 0.3]) K(weap, kp(new THREE.TorusGeometry(0.13 - d * 0.08, 0.018, 6, 22), new THREE.Matrix4().compose(new THREE.Vector3(...bp(d)), new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, 0, 0)), new THREE.Vector3(1, 1, 1)), 0xC8904A, GOLDK)); }
  } else {
    const tc = TRIMC[Math.max(1, tier)], tX = tier >= 4 ? GOLDK : { r: 0.35, mt: 0.8 };
    if (t.el === 'void') K(weap, kE(0, wy + 0.3, 0, 0.13, 0.13, 0.13, 0x16101E, GLOSSK), kT(0.075, 0.018, 0, wy + 0.3, 0.115, 0xB070FF, G(2.4, { rs: 20 })), kE(0, wy + 0.3, 0.12, 0.05, 0.05, 0.02, 0x050208, GLOSSK), kE(0, wy + 0.3, 0.135, 0.018, 0.018, 0.01, 0xFFFFFF, G(3)));
    if (t.arch === 'bolt') { for (let k = 0; k < 3; k++) { const a = k / 3 * PI * 2 + PI / 2; K(weap, kTube([[cos(a) * 0.08, wy - 0.02, sin(a) * 0.08 * 0.5], [cos(a) * 0.14, wy + 0.1, 0.12], [cos(a) * 0.07, wy + 0.16, 0.26]], 0.018, 0.006, tc, tX)); }
      mesh(new THREE.OctahedronGeometry(0.07, 0), accent, weap, T(0, wy + 0.12, 0.2, PI / 2, 0, 0, 0.8, 1.9, 0.8)); }
    if (t.arch === 'sniper') { for (let k = 0; k < 3; k++) K(weap, kT(0.1 - k * 0.018, 0.013, 0, wy + 0.16, 0.08 + k * 0.13, tc, Object.assign({ rs: 24 }, tX)));
      K(weap, kB(0, wy + 0.16, 0.2, 0.022, 0.022, 0.34, tc, tX)); mesh(new THREE.ConeGeometry(0.04, 0.34, 6), accent, weap, T(0, wy + 0.16, 0.4, PI / 2)); mesh(new THREE.SphereGeometry(0.05, 12, 8), accent, weap, T(0, wy + 0.16, 0.02)); }
    if (t.arch === 'rapid') { const tri = new THREE.Group(); tri.position.set(0, wy + 0.14, 0.12); weap.add(tri); U.spin.push({ o: tri, s: 1.5, ax: 'z', fire: 14 });
      for (let k = 0; k < 3; k++) { const a = k / 3 * PI * 2; K(tri, kB(cos(a) * 0.06, sin(a) * 0.06, 0, 0.03, 0.03, 0.12, tc, Object.assign({ rz: a }, tX))); mesh(new THREE.SphereGeometry(0.045, 10, 8), accent, tri, T(cos(a) * 0.12, sin(a) * 0.12, 0.05)); }
      K(tri, kT(0.12, 0.01, 0, 0, 0.05, tc, tX)); }
    if (t.arch === 'heavy') { K(weap, kL([[0.08, 0], [0.2, 0.06], [0.24, 0.16], [0.22, 0.2]], 0, wy, 0.02, tc, Object.assign({ seg: 20, rx: 0.3 }, tX)), kT(0.23, 0.02, 0, wy + 0.18 * cos(0.3), 0.02 + 0.18 * sin(0.3), tc, Object.assign({ rx: PI / 2 + 0.3, rs: 28 }, tX)));
      mesh(new THREE.SphereGeometry(0.12, 16, 12), accent, weap, T(0, wy + 0.14, 0.06)); }
  }
  // ---------------- the one ability: a distinct prop on a post at the front-right corner
  if (t.ability) addAbility(g, t.ability, K, M, U);
  for (const [par, parts] of KP) { const km = new THREE.Mesh(R.merge(parts), M.kit); km.castShadow = km.receiveShadow = true; km.userData.kit = true; par.add(km); }
  U.top = top; U.muzzle = top + wy + 0.16;
  bakeStatic(g);
  return g;
};
// merge meshes that share a parent and a material into one mesh, in the parent's own space.
// Moving parts (spinning rings, bobbing orbs, the aiming weapon) stay movable: their children merge with them. Kit meshes are already merged.
function bakeStatic(g) {
  const U = g.userData, keep = new Set();
  for (const s of U.spin) keep.add(s.o); for (const b of U.bob) keep.add(b.o);
  const parents = []; g.traverse(o => { if (o.children && o.children.length) parents.push(o); });
  for (const P of parents) {
    const groups = new Map();
    for (const o of P.children) { if (!o.isMesh || keep.has(o) || o.material.transparent || o.userData.kit) continue; const k = o.material.uuid; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(o); }
    for (const [, list] of groups) { if (list.length < 2) continue;
      let n = 0; const gs = list.map(o => { o.updateMatrix(); const q = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); q.applyMatrix4(o.matrix); n += q.attributes.position.count; return q; });
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2); let o3 = 0, o2 = 0;
      for (const q of gs) { pos.set(q.attributes.position.array, o3); nor.set(q.attributes.normal.array, o3);
        if (q.attributes.uv) uv.set(q.attributes.uv.array, o2); o3 += q.attributes.position.count * 3; o2 += q.attributes.position.count * 2; q.dispose(); }
      const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); mg.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); mg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      const mm = new THREE.Mesh(mg, list[0].material); mm.castShadow = mm.receiveShadow = true; P.add(mm);
      for (const o of list) { P.remove(o); o.geometry.dispose(); } }
  }
}
function addAbility(g, ab, K, M, U) {
  const a = new THREE.Group(); a.position.set(0.3, 0, 0.3); g.add(a);
  K(a, kC(0.035, 0.05, 0.62, 0, 0.31, 0, 0x8A847A, Object.assign({ seg: 6 }, STONEK)), kC(0.06, 0.05, 0.04, 0, 0.63, 0, 0x5A5650, Object.assign({ seg: 6 }, STONEK)));
  const y = 0.66;
  switch (ab) {
    case 'slow': for (let k = 0; k < 5; k++) { const an = k / 5 * PI * 2; K(a, kO(0.04 + (k % 2) * 0.015, cos(an) * 0.035, y + 0.06 + (k % 2) * 0.04, sin(an) * 0.035, 0xA8F0FF, G(1.6, { sy: 2.4, rz: cos(an) * 0.4, rx: sin(an) * 0.4 }))); }
      K(a, kO(0.05, 0, y + 0.12, 0, 0xE8FCFF, G(2.2, { sy: 2.6 }))); break;
    case 'burn': K(a, kL([[0.02, 0], [0.07, 0.03], [0.085, 0.08]], 0, y, 0, 0x2E2A2A, Object.assign({ seg: 12 }, IRONK)), kCone(0.06, 0.2, 0, y + 0.15, 0, 0xFF7A2A, G(2.8)), kCone(0.035, 0.14, 0.01, y + 0.15, 0.01, 0xFFE070, G(3.2))); break;
    case 'splash': K(a, kL([[0.03, 0], [0.08, 0.02], [0.095, 0.08], [0.085, 0.11]], 0, y, 0, 0x2E3036, Object.assign({ seg: 14 }, IRONK)), kC(0.08, 0.08, 0.01, 0, y + 0.1, 0, 0x7CFF6A, G(2.2, { seg: 16 })));
      for (let k = 0; k < 3; k++) K(a, kE((k - 1) * 0.03, y + 0.13 + k * 0.03, (k % 2) * 0.02, 0.018, 0.018, 0.018, 0xB8FF9A, G(2.4))); break;
    case 'chain': K(a, kCone(0.03, 0.26, 0, y + 0.13, 0, 0xB8683A, { r: 0.35, mt: 1 })); for (let k = 0; k < 3; k++) K(a, kT(0.05 - k * 0.012, 0.007, 0, y + 0.06 + k * 0.06, 0, 0xFFF0A0, G(2.6, { rx: PI / 2, rs: 16 }))); break;
    case 'pierce': for (const s of [-1, 1]) K(a, kC(0.008, 0.008, 0.5, 0, y + 0.12, 0, 0x7A5A3A, Object.assign({ rz: s * 0.5 }, WOODK)), kCone(0.022, 0.1, s * -0.12, y + 0.34, 0, 0xDDE2EA, Object.assign({ rz: s * 0.5 }, IRONK))); break;
    case 'aura': { const r = new THREE.Group(); r.position.set(-0.3, 0.06, -0.3); a.add(r); U.spin.push({ o: r, s: 0.5 });
      K(r, kT(0.48, 0.012, 0, 0, 0, 0x5CC9A7, G(2.2, { rx: PI / 2, rs: 64 }))); for (let k = 0; k < 12; k++) { const an = k / 12 * PI * 2; K(r, kO(0.02, cos(an) * 0.48, 0.02, sin(an) * 0.48, 0x9CF0D8, G(2.4, { sy: 1.8 }))); }
      K(a, kO(0.05, 0, y + 0.08, 0, 0x5CC9A7, G(2.4, { sy: 1.6 }))); break; }
    case 'skyward': K(a, kO(0.045, 0, y + 0.08, 0, 0xE8F4FF, G(2.2, { sy: 1.8 }))); for (const s of [-1, 1]) for (let k = 0; k < 3; k++) K(a, kE(s * (0.06 + k * 0.02), y + 0.08 + k * 0.035, -k * 0.01, 0.06 - k * 0.012, 0.012, 0.03, 0xE8ECF4, Object.assign({ rz: s * (0.5 + k * 0.3) }, IRONK))); break;
    case 'shred': { const o = new THREE.Group(); o.position.set(0, y + 0.1, 0); o.rotation.z = PI / 2; a.add(o); const d = new THREE.Group(); o.add(d); U.spin.push({ o: d, s: 10 });
      K(d, kC(0.1, 0.1, 0.014, 0, 0, 0, 0xB8C0CC, Object.assign({ seg: 16 }, IRONK)), kC(0.03, 0.03, 0.03, 0, 0, 0, 0x3A3C42, IRONK));
      for (let k = 0; k < 10; k++) { const an = k / 10 * PI * 2; K(d, kAlong(new THREE.ConeGeometry(0.022, 1, 5), [cos(an) * 0.095, 0, sin(an) * 0.095], [cos(an + 0.3) * 0.15, 0, sin(an + 0.3) * 0.15], 0xDDE2EA, IRONK)); } break; }
  }
}
R.animateTower = function (g, dt, time, reduced) {
  const U = g.userData; if (reduced) return; const kick = U.kick || 0;
  if (U.weapon) { const yw = U.weapon.rotation.y; U.weapon.position.set(-Math.sin(yw) * kick * 0.07, 0, -Math.cos(yw) * kick * 0.07); }
  for (const s of U.spin) { if (s.ax === 'z') s.o.rotation.z += dt * s.s; else s.o.rotation.y += dt * s.s; }
  for (const b of U.bob) { if (b.ax === 'py') b.o.position.y = b.base + Math.sin(time * b.f) * b.a; else if (b.ax === 's') b.o.scale.setScalar(1 + Math.sin(time * b.f) * b.a * Math.random()); else b.o.rotation.y = Math.sin(time * b.f) * b.a; }
  if (U.flame) { const f = 1 + Math.sin(time * 13) * 0.08 + Math.sin(time * 7.3) * 0.06 + kick * 0.45; U.flame.scale.set(1 / f + kick * 0.2, f, 1 / f + kick * 0.2); }
  for (const b of U.bob) if (b.ax === 'py') b.o.scale.setScalar(1 + kick * 0.35);
  for (const s of U.spin) { if (!s.ax) s.o.rotation.y += dt * s.s * kick * 4; if (s.fire) s.o.rotation.z += dt * s.fire * kick; }
};
})();
