/* Arcane Hand — creatures v2. Detailed multi-part models (3–7k tris near, ~0.4k far), limb-tagged and animated in the
   vertex shader (gait, arms, wings, crawl, tail, breathing, hit flinch, death). Per-part roughness/metalness, rim light.
   One InstancedMesh per type per LOD: ~18 draw calls for any crowd size. */
(function () {
'use strict';
const R = globalThis.AHR, T = R.T, PI = Math.PI;
let DET = 1; // 1 = near detail, 0 = far / crowd
// shared unit spheres per detail class (R.merge copies geometry, never mutates it)
const SPH = {}; const sph = (sz) => { const k = DET + (sz > 0.09 ? 'b' : sz > 0.035 ? 'm' : 's');
  return SPH[k] || (SPH[k] = DET ? (sz > 0.09 ? new THREE.SphereGeometry(1, 15, 11) : sz > 0.035 ? new THREE.SphereGeometry(1, 10, 7) : new THREE.SphereGeometry(1, 6, 4))
    : (sz > 0.09 ? new THREE.SphereGeometry(1, 8, 6) : new THREE.SphereGeometry(1, 5, 3))); };
const X = (...o) => Object.assign({}, ...o);
const E = (x, y, z, sx, sy, sz, c, ex = {}) => X({ g: sph(Math.max(sx, sy, sz)), m: T(x, y, z, ex.rx || 0, ex.ry || 0, ex.rz || 0, sx, sy, sz), c }, ex);
const CONE = (x, y, z, r, h, c, rx = 0, ry = 0, rz = 0, ex = {}) => X({ g: new THREE.ConeGeometry(r, h, DET ? 9 : 4), m: T(x, y, z, rx, ry, rz), c }, ex);
const BOX = (x, y, z, sx, sy, sz, c, ex = {}) => X({ g: new THREE.BoxGeometry(sx, sy, sz), m: T(x, y, z, ex.rx || 0, ex.ry || 0, ex.rz || 0), c }, ex);
const TOR = (x, y, z, r, t, c, ex = {}) => X({ g: new THREE.TorusGeometry(r, t, DET ? 6 : 4, DET ? 18 : 9), m: T(x, y, z, ex.rx || 0, ex.ry || 0, ex.rz || 0, ex.sx || 1, ex.sy || 1, ex.sz || 1), c }, ex);
const OCT = (x, y, z, r, c, ex = {}) => X({ g: new THREE.OctahedronGeometry(r, 0), m: T(x, y, z, ex.rx || 0, ex.ry || 0, ex.rz || 0, 1, ex.sy || 1, 1), c }, ex);
const LATHE = (prof, x, y, z, c, ex = {}) => X({ g: R.lathe(prof, DET ? (ex.seg || 20) : 8), m: T(x, y, z, ex.rx || 0, ex.ry || 0, ex.rz || 0, ex.sx || 1, ex.sy || 1, ex.sz || 1), c }, ex);
const tube = (pts, r0, r1, c, ex = {}) => X({ g: R.ttube(pts, r0, r1, DET ? 8 : 4, DET ? 5 : 2), m: new THREE.Matrix4(), c }, ex);
function seg(a, b, r0, r1, c, ex = {}) { // limb segment between two points; pivot = start
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), L = d.length();
  const g = new THREE.CylinderGeometry(r1, r0, L, DET ? 11 : 5); g.translate(0, L / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return X({ g, m: new THREE.Matrix4().compose(A, q, new THREE.Vector3(1, 1, 1)), c, pivot: a }, ex);
}
// any geometry whose local +y runs from a to b (blades, spikes along a direction)
function along(g, a, b, c, ex = {}) { const A = new THREE.Vector3(...a), d = new THREE.Vector3(...b).sub(A), L = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); g.translate(0, 0.5, 0);
  return X({ g, m: new THREE.Matrix4().compose(A, q, new THREE.Vector3(1, L, 1)), c }, ex); }
const spike = (pos, dir, r, h, c, ex = {}) => along(new THREE.ConeGeometry(r, 1, DET ? 7 : 4), pos, pos.map((v, i) => v + dir[i] * h), c, ex);
// ring (torus) around an axis direction
function ringAt(pos, dir, r, t, c, ex = {}) { const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...dir).normalize());
  return X({ g: new THREE.TorusGeometry(r, t, DET ? 6 : 4, DET ? 18 : 8), m: new THREE.Matrix4().compose(new THREE.Vector3(...pos), q, new THREE.Vector3(1, 1, 1)), c }, ex); }
// a point in the local frame of a rotated part (decals sitting on a tilted wing, shield or plate)
const onPart = (c, rx, ry, rz, l) => { const v = new THREE.Vector3(...l).applyEuler(new THREE.Euler(rx, ry, rz)); return [c[0] + v.x, c[1] + v.y, c[2] + v.z]; };
const L = (limb, pivot, ex = {}) => X({ limb, pivot }, ex);
const P = (type, scale, k, c2) => ({ pat: [type, scale, k], c2 });
const F = { fine: 1 };                                  // dropped from the far / crowd LOD
const CHITIN = { r: 0.3, mt: 0.12 }, GLOSS = { r: 0.14, mt: 0.2 }, METAL = { r: 0.26, mt: 0.92 }, GOLD = { r: 0.28, mt: 1 }, SKIN = { r: 0.72 }, FUR = { r: 0.92 }, BONE = { r: 0.5 }, CLOTH = { r: 0.95 }, STONE = { r: 0.88 };
const glow = (g) => ({ glow: g });

// Models are authored at their final size in tiles (1 tile = 1 unit). +z is forward, y is up, feet at y = 0.
// Limb tags drive the vertex-shader animation: 1-4 legs, 5 head, 6 tail, 7/8 arms, 9/10 wings, 11-14 body waves,
// 15/16 spider legs, 17 antennae, 20 orbit, 21 float, 23 cape.
const MODELS = {
  grub() { // Gloomgrub: armoured larva, plum carapace with gold trim, bioluminescent flanks, bone mandibles
    const p = [], skin = 0x9A5E86, skin2 = 0x6E3F64, belly = 0xE8C8B0, plate = 0x5A2A66, plate2 = 0x1E0C26, gold = 0xE0B050, lum = 0x5FF2D6, bone = 0xF0E4CC;
    const segs = [[0.3, 0.25], [0.08, 0.29], [-0.15, 0.3], [-0.37, 0.27], [-0.56, 0.21], [-0.71, 0.15]];
    segs.forEach(([z, r], k) => { const ex = L(11 + Math.min(3, Math.max(0, k - 1)), [0, 0, z]);
      p.push(E(0, r * 0.98, z, r, r * 0.92, r * 0.76, skin, X(ex, SKIN, P(4, r * 0.7, 1, belly))),
        E(0, r * 1.14, z - 0.01, r * 1.05, r * 0.88, r * 0.7, plate, X(ex, CHITIN, P(3, 11, 0.7, plate2))),
        TOR(0, r * 0.62, z - 0.01, r * 0.98, 0.016, gold, X(ex, GOLD, { rx: PI / 2, sy: 0.7 })),
        CONE(0, r * 1.78, z - 0.05, 0.036, 0.16, bone, -0.55, 0, 0, X(ex, BONE)));
      for (const s of [-1, 1]) { p.push(E(s * r * 1.02, r * 1.05, z, 0.036, 0.036, 0.036, lum, X(ex, glow(2))),
        CONE(s * r * 0.96, r * 0.55, z, 0.028, 0.12, plate, 0, 0, -s * 2.0, X(ex, CHITIN, F)));
        if (k < 5) p.push(seg([s * r * 0.55, r * 0.4, z], [s * r * 0.78, 0.02, z + 0.03], 0.05, 0.034, skin2, X(ex, SKIN)),
          E(s * r * 0.78, 0.024, z + 0.045, 0.045, 0.024, 0.05, plate2, X(ex, CHITIN, F))); } });
    const tl = L(14, [0, 0, -0.71]);
    p.push(E(0, 0.17, -0.86, 0.07, 0.07, 0.1, lum, X(tl, glow(1.4))), CONE(0, 0.18, -0.99, 0.03, 0.15, plate2, -PI / 2, 0, 0, X(tl, CHITIN)));
    const hd = L(5, [0, 0.28, 0.42]);
    p.push(E(0, 0.3, 0.54, 0.19, 0.17, 0.17, skin2, X(hd, SKIN, P(6, 9, 0.6, 0x5A3050))),
      E(0, 0.385, 0.5, 0.205, 0.12, 0.19, plate, X(hd, CHITIN, P(3, 12, 0.7, plate2))),
      TOR(0, 0.37, 0.52, 0.19, 0.012, gold, X(hd, GOLD, { rx: PI / 2 - 0.25, sy: 0.92 }, F)),
      E(0, 0.215, 0.68, 0.085, 0.05, 0.045, 0x2A0A18, X(hd, SKIN)), E(0, 0.215, 0.7, 0.05, 0.028, 0.03, 0xFF5A7A, X(hd, glow(1.4), F)));
    for (const s of [-1, 1]) {
      for (let k = 0; k < 2; k++) p.push(tube([[s * (0.06 + k * 0.07), 0.46, 0.54 - k * 0.07], [s * (0.1 + k * 0.08), 0.58, 0.45 - k * 0.06], [s * (0.12 + k * 0.09), 0.63, 0.3 - k * 0.05]], 0.03, 0, bone, X(hd, BONE)));
      p.push(tube([[s * 0.09, 0.22, 0.64], [s * 0.18, 0.2, 0.77], [s * 0.08, 0.18, 0.91]], 0.036, 0.004, bone, X(hd, BONE)),
        CONE(s * 0.05, 0.19, 0.7, 0.012, 0.05, bone, PI, 0, 0, X(hd, F)),
        tube([[s * 0.06, 0.44, 0.6], [s * 0.16, 0.62, 0.7], [s * 0.28, 0.7, 0.66]], 0.013, 0.005, plate2, X(hd, CHITIN)),
        E(s * 0.28, 0.7, 0.66, 0.032, 0.032, 0.032, 0xC8A0FF, X(hd, glow(1.8))));
      for (let k = 0; k < 3; k++) p.push(E(s * (0.075 + k * 0.045), 0.35 - k * 0.022, 0.665 - k * 0.055, 0.03 - k * 0.004, 0.03 - k * 0.004, 0.024, 0xFFB43A, X(hd, glow(2.2)))); }
    return p; },

  skitter() { // Skitterling: void-mite, glossy shell with a glowing violet vein network, red eye cluster, banded legs
    const p = [], shell = 0x1C1226, shell2 = 0x0A0510, vein = 0xB45CFF, leg = 0x2A1E36, band = 0x9A5AD8, tip = 0xE6D6F4, eye = 0xFF3A2A;
    p.push(E(0, 0.32, -0.24, 0.21, 0.18, 0.27, shell, X(GLOSS, P(5, 5, 1, vein))),
      E(0, 0.49, -0.16, 0.05, 0.014, 0.05, 0xFF3A6A, glow(2)), E(0, 0.485, -0.31, 0.05, 0.014, 0.05, 0xFF3A6A, glow(2)), E(0, 0.495, -0.235, 0.018, 0.012, 0.03, 0xFF3A6A, X(glow(2), F)),
      CONE(0, 0.27, -0.5, 0.035, 0.09, shell2, -PI / 2, 0, 0, X(CHITIN, F)),
      E(0, 0.26, 0.06, 0.14, 0.1, 0.15, 0x2E2238, X(CHITIN, P(3, 14, 0.6, shell2))));
    for (let k = 0; k < 7; k++) { const a = k * 2.4, rr = 0.15; p.push(CONE(Math.cos(a) * rr * 0.8, 0.44 + Math.sin(k) * 0.02, -0.24 + Math.sin(a) * rr, 0.012, 0.07, 0x6A4A8A, (Math.sin(a)) * 0.6, 0, -Math.cos(a) * 0.6, X(CHITIN, F))); }
    const hd = L(5, [0, 0.26, 0.16]);
    p.push(E(0, 0.27, 0.2, 0.1, 0.085, 0.09, 0x3A2A48, X(hd, CHITIN)));
    for (const s of [-1, 1]) p.push(E(s * 0.04, 0.31, 0.27, 0.03, 0.03, 0.026, eye, X(hd, glow(2.4))), E(s * 0.078, 0.3, 0.235, 0.018, 0.018, 0.018, eye, X(hd, glow(2.2))),
      E(s * 0.028, 0.345, 0.245, 0.016, 0.016, 0.016, eye, X(hd, glow(2.2), F)),
      tube([[s * 0.035, 0.22, 0.27], [s * 0.05, 0.15, 0.31], [s * 0.025, 0.09, 0.28]], 0.024, 0.002, 0xE8D8C0, X(hd, BONE)),
      seg([s * 0.06, 0.22, 0.24], [s * 0.1, 0.15, 0.34], 0.015, 0.01, leg, X(hd, CHITIN, F)));
    const ang = [0.95, 0.38, -0.3, -0.9];
    for (let k = 0; k < 4; k++) for (const s of [-1, 1]) { const a = ang[k], dx = s * Math.cos(a), dz = Math.sin(a), limb = ((k + (s > 0 ? 1 : 0)) % 2) ? 15 : 16;
      const b = [s * 0.09, 0.26, 0.1 - k * 0.055], kn = [b[0] + dx * 0.2, 0.46, b[2] + dz * 0.2], an = [b[0] + dx * 0.42, 0.22, b[2] + dz * 0.42], ft = [b[0] + dx * 0.5, 0, b[2] + dz * 0.5], ex = L(limb, b, CHITIN);
      p.push(seg(b, kn, 0.026, 0.022, leg, ex), E(...kn, 0.028, 0.028, 0.028, band, ex), seg(kn, an, 0.022, 0.016, leg, ex), E(...an, 0.02, 0.02, 0.02, band, X(ex, F)), seg(an, ft, 0.016, 0.005, tip, ex)); }
    return p; },

  dasher() { // Cinder Hound: tiger-striped fur, bone mask and ridged horns, ember mane, molten maw, flaming tail
    const p = [], fur = 0xB8492C, stripe = 0x2E0F0A, belly = 0xE6BC8A, dark = 0x3A1810, bone = 0xEADFC8, ember = 0xFF7A2A, ST = P(1, 22, 0.85, stripe);
    p.push(E(0, 0.64, 0.2, 0.21, 0.25, 0.25, fur, X(FUR, ST)), E(0, 0.6, -0.1, 0.17, 0.19, 0.3, fur, X(FUR, ST)), E(0, 0.63, -0.36, 0.2, 0.22, 0.2, fur, X(FUR, ST)),
      E(0, 0.5, -0.02, 0.13, 0.1, 0.34, belly, FUR), seg([0, 0.7, 0.28], [0, 0.8, 0.44], 0.13, 0.1, fur, X(FUR, ST, { pivot: null })));
    for (let k = 0; k < 9; k++) { const a = (k / 8 - 0.5) * 2.9; p.push(CONE(Math.sin(a) * 0.15, 0.78 + Math.cos(a) * 0.1, 0.3, 0.05, 0.26, dark, -1.05, 0, -Math.sin(a) * 0.9, X(FUR, P(11, 0.9 + Math.cos(a) * 0.08, 1, ember)))); }
    for (let k = 0; k < 6; k++) p.push(CONE(0, 0.86 - k * 0.02, 0.12 - k * 0.1, 0.034, 0.17, dark, -0.6, 0, 0, X(CHITIN, P(11, 0.9 - k * 0.02, 1, ember))));
    p.push(ringAt([0, 0.75, 0.37], [0, 0.52, 0.85], 0.14, 0.024, 0x3A2A20, { r: 0.7 }));
    for (let k = 0; k < 7; k++) { const a = k / 7 * PI * 2, d = [Math.cos(a), Math.sin(a) * 0.85, -Math.sin(a) * 0.52]; p.push(spike([d[0] * 0.15, 0.75 + d[1] * 0.15, 0.37 + d[2] * 0.15], d, 0.018, 0.07, 0xB8B8C0, X(METAL, F))); }
    const hd = L(5, [0, 0.74, 0.36]);
    p.push(E(0, 0.84, 0.5, 0.13, 0.12, 0.15, fur, X(hd, FUR, ST)), E(0, 0.78, 0.66, 0.075, 0.07, 0.14, 0xD8A070, X(hd, FUR)), E(0, 0.81, 0.795, 0.036, 0.028, 0.026, 0x151010, X(hd, GLOSS)),
      E(0, 0.72, 0.62, 0.066, 0.036, 0.12, dark, X(hd, FUR)), E(0, 0.745, 0.68, 0.05, 0.02, 0.08, 0xFF6A2A, X(hd, glow(1.6))),
      E(0, 0.9, 0.53, 0.11, 0.05, 0.13, bone, X(hd, BONE, P(6, 14, 0.5, 0xA08A6A))));
    for (const s of [-1, 1]) p.push(tube([[s * 0.07, 0.92, 0.52], [s * 0.14, 1.02, 0.42], [s * 0.18, 1.05, 0.26], [s * 0.16, 1.0, 0.13]], 0.036, 0.004, bone, X(hd, BONE, P(7, 90, 0.55, 0x6A5A40))),
      CONE(s * 0.1, 0.95, 0.43, 0.04, 0.13, fur, -0.3, 0, -s * 0.4, X(hd, FUR)), E(s * 0.068, 0.875, 0.62, 0.03, 0.02, 0.022, 0xFFB03A, X(hd, glow(2.4))),
      CONE(s * 0.035, 0.715, 0.74, 0.013, 0.06, 0xF4ECDC, PI, 0, 0, X(hd, F)));
    [[1, -1, 0.26, 1], [2, 1, 0.26, 1], [3, -1, -0.38, 0], [4, 1, -0.38, 0]].forEach(([limb, s, z, front]) => { const hip = [s * 0.14, 0.62, z], ex = L(limb, hip, FUR);
      if (front) p.push(seg(hip, [s * 0.15, 0.36, z - 0.02], 0.075, 0.05, fur, X(ex, ST)), seg([s * 0.15, 0.36, z - 0.02], [s * 0.15, 0.08, z + 0.04], 0.045, 0.034, dark, ex), E(s * 0.15, 0.04, z + 0.08, 0.05, 0.035, 0.07, dark, ex));
      else p.push(E(s * 0.15, 0.5, z + 0.02, 0.08, 0.15, 0.11, fur, X(ex, ST)), seg([s * 0.15, 0.4, z + 0.04], [s * 0.15, 0.2, z - 0.1], 0.05, 0.035, fur, X(ex, ST)),
        seg([s * 0.15, 0.2, z - 0.1], [s * 0.15, 0.05, z - 0.04], 0.035, 0.03, dark, ex), E(s * 0.15, 0.035, z, 0.05, 0.035, 0.07, dark, ex));
      for (let c = -1; c <= 1; c++) p.push(CONE(s * 0.15 + c * 0.022, 0.02, z + (front ? 0.14 : 0.06), 0.009, 0.045, bone, PI / 2, 0, 0, X(ex, F))); });
    const tl = L(6, [0, 0.64, -0.52]);
    p.push(tube([[0, 0.64, -0.5], [0, 0.74, -0.7], [0, 0.72, -0.9]], 0.05, 0.03, fur, X(tl, FUR, ST)), E(0, 0.73, -0.95, 0.06, 0.06, 0.09, 0xFF9A3A, X(tl, glow(2))),
      CONE(0, 0.8, -1.0, 0.05, 0.18, 0xFFD060, -0.8, 0, 0, X(tl, glow(2.6))));
    return p; },

  bulwark() { // Ironback: bronze scute shell with verdigris and glowing runes, iron rim and spikes, moss and crystals, helmeted head
    const p = [], bronze = 0xA07A44, verd = 0x4FA08A, iron = 0x5A606C, brass = 0xC8904A, skin = 0x7A8660, skin2 = 0x3E4630, rune = 0x6FE8FF, bone = 0xE8DCC0;
    p.push(LATHE([[0, 0.74], [0.2, 0.72], [0.36, 0.63], [0.47, 0.49], [0.52, 0.33], [0.53, 0.22]], 0, 0, 0, 0x6A4A2A, X({ r: 0.4, mt: 0.6, sz: 1.2 }, P(6, 7, 0.8, 0x3A7A68), { r: 0.62, mt: 0.45 })),
      TOR(0, 0.22, 0, 0.53, 0.045, iron, X(METAL, { rx: PI / 2, sy: 1.2 })), E(0, 0.2, 0, 0.47, 0.07, 0.58, 0xD8C08A, X(SKIN, P(3, 7, 0.6, 0x9A8050))));
    for (let k = 0; k < 12; k++) { const a = k / 12 * PI * 2, d = [Math.sin(a), 0.1, Math.cos(a) * 1.2]; if (k % 2) p.push(E(d[0] * 0.55, 0.22, d[2] * 0.55, 0.018, 0.018, 0.018, brass, X(GOLD, F)));
      else p.push(spike([d[0] * 0.54, 0.24, d[2] * 0.54], [Math.sin(a), 0.2, Math.cos(a)], 0.035, 0.15, iron, METAL)); }
    const sc = [[0, 0.74, 0, 0]]; for (let k = 0; k < 6; k++) { const a = k / 6 * PI * 2 + 0.5; sc.push([Math.sin(a) * 0.3, 0.64, Math.cos(a) * 0.3 * 1.2, 1]); }
    sc.forEach(([x, y, z, side]) => { const n = new THREE.Vector3(x, (y - 0.15) * 1.3, z / 1.44).normalize(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
      p.push(X({ g: new THREE.CylinderGeometry(0.12, 0.145, 0.05, 6), m: new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1)), c: bronze }, { r: 0.4, mt: 0.6 }, P(6, 12, 0.85, verd)),
        X({ g: new THREE.TorusGeometry(0.05, 0.01, 4, DET ? 12 : 6), m: new THREE.Matrix4().compose(new THREE.Vector3(x + n.x * 0.03, y + n.y * 0.03, z + n.z * 0.03), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n), new THREE.Vector3(1, 1, 1)), c: rune }, glow(2.2), side ? F : {})); });
    p.push(E(0.22, 0.62, -0.3, 0.15, 0.05, 0.13, 0x5E8A3A, X(FUR, { rz: 0.5, rx: -0.3 }, P(6, 18, 0.7, 0x3A5A24))), E(-0.28, 0.58, 0.18, 0.12, 0.045, 0.1, 0x5E8A3A, X(FUR, { rz: -0.6, rx: 0.3 }, P(6, 18, 0.7, 0x3A5A24))));
    for (let k = 0; k < 3; k++) p.push(OCT(0.2 + k * 0.05, 0.7 + (k % 2) * 0.04, -0.3 + k * 0.03, 0.035, 0xB070FF, X({ sy: 2.2, rz: (k - 1) * 0.4 }, glow(1.6))));
    p.push(seg([-0.14, 0.7, -0.28], [-0.16, 1.3, -0.34], 0.012, 0.01, 0x5A3A22, X({ r: 0.9 }, { pivot: null })), BOX(-0.16, 1.16, -0.43, 0.012, 0.2, 0.18, 0x8A1E2A, X(CLOTH, P(7, 60, 0.4, 0xD8B060))),
      OCT(-0.15, 1.17, -0.43, 0.04, 0xE8C060, X(GOLD, { sy: 1.4 }, F)));
    const hd = L(5, [0, 0.3, 0.55]), SC = P(3, 16, 0.7, skin2);
    p.push(seg([0, 0.26, 0.5], [0, 0.32, 0.7], 0.09, 0.08, skin, X(hd, SKIN, SC)), E(0, 0.35, 0.8, 0.14, 0.12, 0.16, skin, X(hd, SKIN, SC)),
      CONE(0, 0.29, 0.95, 0.06, 0.12, 0xD8C890, PI / 2 + 0.5, 0, 0, X(hd, BONE)), E(0, 0.43, 0.78, 0.15, 0.065, 0.15, 0x9AA2B0, X(hd, METAL)),
      CONE(0, 0.5, 0.87, 0.03, 0.17, brass, 0.65, 0, 0, X(hd, GOLD)), TOR(0, 0.42, 0.78, 0.15, 0.01, brass, X(hd, GOLD, { rx: PI / 2 }, F)));
    for (const s of [-1, 1]) p.push(E(s * 0.1, 0.38, 0.9, 0.026, 0.024, 0.02, 0xFFD86A, X(hd, glow(2.2))));
    [[1, -1, 0.3], [2, 1, 0.3], [3, -1, -0.3], [4, 1, -0.3]].forEach(([limb, s, z]) => { const zz = z * 1.2, hip = [s * 0.38, 0.26, zz], ex = L(limb, hip, SKIN);
      p.push(seg(hip, [s * 0.42, 0.03, zz], 0.1, 0.09, skin, X(ex, SC)), E(s * 0.43, 0.18, zz + 0.05, 0.065, 0.07, 0.06, iron, X(ex, METAL)), E(s * 0.42, 0.035, zz + 0.03, 0.11, 0.045, 0.12, skin, X(ex, SC)));
      for (let c = -1; c <= 1; c++) p.push(CONE(s * 0.42 + c * 0.04, 0.02, zz + 0.14, 0.014, 0.06, bone, PI / 2, 0, 0, X(ex, F))); });
    p.push(CONE(0, 0.18, -0.78, 0.06, 0.18, skin, -PI / 2, 0, 0, L(6, [0, 0.18, -0.68], X(SKIN, SC))));
    return p; },

  troll() { // Moss Troll: lichen-spotted hide, moss mantle with toadstools, tusks, trinket belt, iron-banded spiked club
    const p = [], skin = 0x5E7A72, skin2 = 0x4A6058, skin3 = 0x86A096, lichen = 0x3E5A2E, moss = 0x5E8A3A, moss2 = 0x34521E, wood = 0x6A4A30, iron = 0x46484E, bone = 0xF0E4C8, gold = 0xD8A848;
    const SP = P(2, 6, 0.85, lichen);
    for (const [limb, s] of [[1, -1], [2, 1]]) { const hip = [s * 0.2, 0.64, 0], ex = L(limb, hip, SKIN);
      p.push(seg(hip, [s * 0.22, 0.34, 0.05], 0.14, 0.11, skin, X(ex, SP)), E(s * 0.22, 0.34, 0.07, 0.1, 0.1, 0.1, skin2, ex), seg([s * 0.22, 0.34, 0.05], [s * 0.23, 0.06, 0], 0.1, 0.09, skin, X(ex, SP)),
        E(s * 0.23, 0.05, 0.08, 0.12, 0.06, 0.17, skin2, ex)); for (let c = -1; c <= 1; c++) p.push(E(s * 0.23 + c * 0.055, 0.04, 0.24, 0.03, 0.025, 0.03, bone, X(ex, BONE, F))); }
    p.push(E(0, 0.7, 0, 0.3, 0.2, 0.24, skin, X(SKIN, SP)),
      BOX(0, 0.52, 0.21, 0.34, 0.32, 0.03, 0x5A4030, X(CLOTH, { rx: 0.12 }, P(1, 40, 0.45, 0x2E2014))), BOX(0, 0.52, -0.21, 0.34, 0.3, 0.03, 0x5A4030, X(CLOTH, { rx: -0.12 }, P(1, 40, 0.45, 0x2E2014))),
      TOR(0, 0.75, 0, 0.3, 0.035, 0x4A3222, X({ r: 0.7 }, { rx: PI / 2, sy: 0.82 })), BOX(0, 0.75, 0.25, 0.1, 0.085, 0.03, gold, GOLD));
    for (const s of [-1, 1]) p.push(E(s * 0.22, 0.62, 0.19, 0.05, 0.055, 0.05, bone, BONE), E(s * 0.22 - 0.015, 0.63, 0.235, 0.012, 0.014, 0.01, 0x100808, F), E(s * 0.22 + 0.015, 0.63, 0.235, 0.012, 0.014, 0.01, 0x100808, F));
    p.push(E(0, 1.08, 0.06, 0.42, 0.42, 0.32, skin, X(SKIN, { rx: 0.3 }, SP)), E(0, 1.03, 0.2, 0.3, 0.28, 0.17, skin3, X(SKIN, { rx: 0.2 }, P(6, 10, 0.5, skin))),
      E(0, 0.87, 0.18, 0.28, 0.2, 0.18, skin3, SKIN), E(0, 1.22, -0.17, 0.34, 0.3, 0.24, skin, X(SKIN, SP)));
    for (let k = 0; k < 3; k++) p.push(BOX(-0.1 + k * 0.1, 1.04 - (k % 2) * 0.04, 0.36, 0.022, 0.13, 0.02, 0x7CFF6A, X(glow(2.2), { rz: (k - 1) * 0.5, rx: 0.2 })));
    p.push(E(-0.3, 1.32, -0.02, 0.21, 0.1, 0.23, moss, X(FUR, P(6, 20, 0.8, moss2))), E(0.3, 1.32, -0.02, 0.21, 0.1, 0.23, moss, X(FUR, P(6, 20, 0.8, moss2))), E(0, 1.37, -0.17, 0.3, 0.12, 0.2, moss, X(FUR, P(6, 20, 0.8, moss2))));
    for (let k = 0; k < 6; k++) { const x = -0.3 + k * 0.12; p.push(CONE(x, 1.18, -0.3 - Math.abs(x) * 0.1, 0.03, 0.16, moss2, PI, 0, 0, X(FUR, F))); }
    const shroom = (x, y, z, r, cap, dots, gl) => { p.push(seg([x, y, z], [x, y + r * 1.3, z], r * 0.28, r * 0.22, 0xEDE3D0, { pivot: null }), E(x, y + r * 1.35, z, r, r * 0.55, r, cap, X(GLOSS, dots ? P(2, 34, 1, dots) : {}, gl ? glow(gl) : {}))); };
    shroom(-0.36, 1.38, -0.05, 0.085, 0xC83A2A, 0xF6EEE0); shroom(-0.24, 1.4, -0.14, 0.05, 0xD84A2A, 0xF6EEE0); shroom(0.18, 1.44, -0.24, 0.04, 0x4AB8FF, 0, 1.6); shroom(0.08, 1.46, -0.2, 0.03, 0x4AB8FF, 0, 1.6);
    const hd = L(5, [0, 1.36, 0.2]);
    p.push(E(0, 1.46, 0.3, 0.17, 0.16, 0.17, skin, X(hd, SKIN, SP)), E(0, 1.53, 0.41, 0.16, 0.045, 0.08, skin2, X(hd, SKIN)), E(0, 1.42, 0.49, 0.048, 0.055, 0.1, skin2, X(hd, SKIN, { rx: 0.5 })),
      E(0, 1.34, 0.37, 0.14, 0.07, 0.12, skin2, X(hd, SKIN)), TOR(0, 1.385, 0.535, 0.024, 0.006, gold, X(hd, GOLD, { rx: 0.3 }, F)));
    for (const s of [-1, 1]) p.push(tube([[s * 0.07, 1.33, 0.44], [s * 0.1, 1.41, 0.5], [s * 0.075, 1.48, 0.49]], 0.03, 0.004, bone, X(hd, BONE)),
      E(s * 0.066, 1.49, 0.455, 0.03, 0.02, 0.02, 0xFFC03A, X(hd, glow(2.4))), CONE(s * 0.2, 1.5, 0.26, 0.045, 0.22, skin, 0, 0, -s * 1.3, X(hd, SKIN)),
      TOR(s * 0.24, 1.47, 0.26, 0.03, 0.007, gold, X(hd, GOLD, { ry: PI / 2 }, F)));
    for (let k = 0; k < 5; k++) p.push(CONE((k - 2) * 0.05, 1.6, 0.26 - Math.abs(k - 2) * 0.02, 0.035, 0.14, 0x2E3A22, -0.5 - Math.abs(k - 2) * 0.1, 0, (k - 2) * -0.2, X(hd, FUR)));
    for (const [limb, s] of [[7, -1], [8, 1]]) { const sh = [s * 0.44, 1.26, 0.08], ex = L(limb, sh, SKIN), el = [s * 0.52, 0.9, 0.12], wr = [s * 0.54, 0.56, 0.2];
      p.push(E(s * 0.44, 1.24, 0.06, 0.15, 0.14, 0.15, skin, X(ex, SP)), seg(sh, el, 0.12, 0.1, skin, X(ex, SP)), E(...el, 0.1, 0.1, 0.1, skin2, ex), seg(el, wr, 0.11, 0.1, skin, X(ex, SP)),
        ringAt([s * 0.535, 0.66, 0.18], [0.03 * s, -1, 0.2], 0.105, 0.03, 0x8A7050, X(ex, CLOTH)), ringAt([s * 0.54, 0.6, 0.19], [0.03 * s, -1, 0.2], 0.105, 0.03, 0x8A7050, X(ex, CLOTH, F)),
        E(s * 0.54, 0.5, 0.22, 0.12, 0.12, 0.12, skin2, X(ex, SP)));
      if (s > 0) { const a = [0.54, 0.5, 0.22], b = [0.64, 0.1, 0.84], d = [0.1, -0.4, 0.62];
        p.push(seg(a, b, 0.05, 0.13, wood, X(ex, { r: 0.9 }, P(1, 30, 0.5, 0x3E2A18))));
        for (const f of [0.55, 0.85]) p.push(ringAt(a.map((v, i) => v + d[i] * f), d, 0.06 + 0.08 * f, 0.022, iron, X(ex, METAL)));
        for (let k = 0; k < 7; k++) { const an = k / 7 * PI * 2, o = [Math.cos(an), Math.sin(an) * 0.54, Math.sin(an) * 0.84]; p.push(spike([0.63 + o[0] * 0.11, 0.16 + o[1] * 0.11, 0.76 + o[2] * 0.11], o, 0.022, 0.1, 0x9A9AA0, X(ex, METAL))); } }
      else for (let k = 0; k < 5; k++) { const an = k / 5 * PI * 2; p.push(E(-0.54 + Math.cos(an) * 0.11, 0.62, 0.19 + Math.sin(an) * 0.11, 0.025, 0.03, 0.025, bone, X(ex, BONE, F))); } }
    return p; },

  wisp() { // Moonmoth wisp: luminous-veined wings with eyespots, swallowtails, feathered antennae, lantern heart, orbiting shards
    const p = [], fuzz = 0xEAF2FF;
    p.push(E(0, 0, 0, 0.1, 0.1, 0.12, fuzz, X(FUR, glow(0.08), P(6, 30, 0.4, 0xB8C8F0))), E(0, -0.03, -0.22, 0.08, 0.08, 0.19, 0xD0DCFF, X(FUR, glow(0.05), P(1, 60, 0.8, 0x5A6AC0))),
      E(0, -0.04, -0.42, 0.035, 0.035, 0.035, 0x9FF0FF, glow(2.2)), E(0, 0.03, 0.15, 0.075, 0.07, 0.07, fuzz, X(FUR, glow(0.06))), E(0, -0.13, 0.02, 0.055, 0.055, 0.055, 0xBFF4FF, glow(2.8)));
    for (let k = 0; k < 8; k++) { const a = k / 8 * PI * 2; p.push(CONE(Math.cos(a) * 0.09, 0.02 + Math.sin(a) * 0.08, 0.08, 0.025, 0.08, fuzz, Math.sin(a) * 0.9 + 0.3, 0, -Math.cos(a) * 0.9, X(FUR, glow(0.2), F))); }
    for (const s of [-1, 1]) { p.push(E(s * 0.05, 0.04, 0.19, 0.04, 0.045, 0.04, 0x0C1830, X({ r: 0.05, mt: 0.3 })), E(s * 0.058, 0.062, 0.222, 0.012, 0.012, 0.012, 0xFFFFFF, X(glow(3), F)));
      const an = L(17, [s * 0.03, 0.08, 0.18]); p.push(tube([[s * 0.03, 0.08, 0.18], [s * 0.09, 0.2, 0.26], [s * 0.16, 0.26, 0.24]], 0.009, 0.004, 0xE0E8FF, an), E(s * 0.16, 0.26, 0.24, 0.02, 0.02, 0.02, 0xBFF4FF, X(an, glow(2.4))));
      for (let k = 1; k <= 4; k++) { const f = k / 5; p.push(CONE(s * (0.03 + f * 0.13), 0.08 + f * 0.18, 0.18 + f * 0.07, 0.008, 0.07, 0xE0E8FF, 0, 0, -s * 1.2, X(an, F))); }
      const w = L(s < 0 ? 9 : 10, [s * 0.06, 0.02, 0.03]), fw = [s * 0.36, 0.03, 0.06], fr = [0, -s * 0.35, s * 0.1];
      p.push(E(...fw, 0.37, 0.009, 0.22, 0x5A6CC0, X(w, { rx: fr[0], ry: fr[1], rz: fr[2], r: 0.5 })), E(fw[0], fw[1] + 0.004, fw[2], 0.34, 0.012, 0.2, 0xBFD8FF, X(w, { rx: fr[0], ry: fr[1], rz: fr[2], r: 0.4 }, glow(0.18), P(5, 9, 0.9, 0x9FE8FF))));
      const ep = onPart(fw, ...fr, [s * 0.08, 0.014, -0.03]);
      p.push(E(...ep, 0.085, 0.006, 0.085, 0xFF9A3A, X(w, { rx: fr[0], ry: fr[1], rz: fr[2] }, glow(0.5))), E(ep[0], ep[1] + 0.002, ep[2], 0.055, 0.007, 0.055, 0x1A1030, X(w, { rx: fr[0], ry: fr[1], rz: fr[2] })),
        E(ep[0], ep[1] + 0.004, ep[2], 0.024, 0.008, 0.024, 0xFFFFFF, X(w, { rx: fr[0], ry: fr[1], rz: fr[2] }, glow(2.6))));
      const hw = [s * 0.24, -0.02, -0.16], hr = [0, s * 0.55, -s * 0.05];
      p.push(E(...hw, 0.24, 0.008, 0.17, 0x7A5AC0, X(w, { ry: hr[1], rz: hr[2] })), E(hw[0], hw[1] + 0.004, hw[2], 0.22, 0.01, 0.16, 0xE6CCFF, X(w, { ry: hr[1], rz: hr[2], r: 0.4 }, glow(0.18), P(5, 10, 0.8, 0xFFB0E8))),
        tube([[s * 0.3, -0.03, -0.28], [s * 0.35, -0.05, -0.44], [s * 0.3, -0.06, -0.58]], 0.022, 0.003, 0x9FE8FF, X(w, glow(1.3))), E(s * 0.3, -0.06, -0.58, 0.022, 0.022, 0.022, 0xFFFFFF, X(w, glow(2.4), F))); }
    const rb = L(6, [0, -0.04, -0.4]);
    for (const s of [-1, 1]) p.push(tube([[s * 0.01, -0.04, -0.4], [s * 0.06, -0.1, -0.56], [s * 0.02, -0.16, -0.74]], 0.012, 0.002, 0x9FE8FF, X(rb, glow(1.6))));
    for (let k = 0; k < 3; k++) { const a = k * 2.094; p.push(OCT(Math.cos(a) * 0.42, 0.08 + (k % 2) * 0.06, Math.sin(a) * 0.42, 0.035, 0xE0FFFF, X(L(20, [0, 0, 0]), { sy: 1.8 }, glow(2)))); }
    return p; },

  knight() { // Warded Knight: plate with glowing gold filigree, blue tabard and heraldry, crimson cape, winged great helm, runed sword, tower shield
    const p = [], steel = 0x8C9AB8, steelD = 0x4A5470, gold = 0xE0B458, blue = 0x22306A, red = 0x8A1E2A, cyan = 0x7FE8FF, leather = 0x4A3222;
    for (const [limb, s] of [[1, -1], [2, 1]]) { const hip = [s * 0.1, 0.62, 0], ex = L(limb, hip, METAL);
      p.push(seg(hip, [s * 0.11, 0.34, 0.02], 0.075, 0.065, steel, ex), E(s * 0.11, 0.34, 0.05, 0.062, 0.06, 0.05, steel, ex), TOR(s * 0.11, 0.34, 0.07, 0.04, 0.008, gold, X(ex, GOLD, F)),
        seg([s * 0.11, 0.34, 0.02], [s * 0.12, 0.06, 0.01], 0.066, 0.055, steel, ex), E(s * 0.12, 0.04, 0.07, 0.066, 0.042, 0.12, steelD, ex)); }
    p.push(LATHE([[0.16, 0.5], [0.185, 0.58], [0.175, 0.68]], 0, 0, 0, steel, X(METAL, { seg: 16 })));
    for (const s of [-1, 1]) p.push(BOX(s * 0.12, 0.6, 0.1, 0.12, 0.16, 0.03, steel, X(METAL, { rx: -0.15, rz: s * 0.12 })));
    p.push(E(0, 0.92, 0.04, 0.21, 0.27, 0.15, steel, X(METAL, P(5, 7, 0.55, gold))), E(0, 0.92, -0.03, 0.2, 0.26, 0.13, steel, METAL),
      BOX(0, 0.6, 0.155, 0.2, 0.42, 0.02, blue, X(CLOTH, { rx: 0.06 })), BOX(0, 0.395, 0.17, 0.2, 0.025, 0.022, gold, X(GOLD, { rx: 0.06 }, F)),
      OCT(0, 0.64, 0.175, 0.06, gold, X(GOLD, { sy: 1.4 })), OCT(0, 0.64, 0.19, 0.03, cyan, X({ sy: 1.4 }, glow(2.4))),
      TOR(0, 0.72, 0.02, 0.19, 0.026, leather, X({ r: 0.7 }, { rx: PI / 2, sy: 0.75 })), BOX(0, 0.72, 0.16, 0.06, 0.05, 0.02, gold, GOLD),
      TOR(0, 1.18, 0.01, 0.1, 0.035, steel, X(METAL, { rx: PI / 2 })));
    for (const s of [-1, 1]) { for (let k = 0; k < 3; k++) p.push(E(s * (0.25 + k * 0.01), 1.14 - k * 0.06, 0, 0.13 - k * 0.012, 0.08, 0.13, k ? steel : steelD, X(METAL, { rz: -s * 0.3 })),
        TOR(s * (0.25 + k * 0.01), 1.1 - k * 0.06, 0, 0.12 - k * 0.012, 0.011, gold, X(GOLD, { rx: PI / 2, ry: 0, rz: 0 }, k ? F : {})));
      p.push(CONE(s * 0.29, 1.24, 0, 0.03, 0.12, gold, 0, 0, -s * 0.55, GOLD), E(s * 0.13, 1.14, -0.12, 0.03, 0.03, 0.02, gold, X(GOLD, F))); }
    p.push(E(0, 0.76, -0.2, 0.25, 0.44, 0.035, red, X(L(23, [0, 1.16, -0.12]), CLOTH, { rx: 0.12 }, P(4, 0.5, 0.5, 0x4A0E16))));
    const hd = L(5, [0, 1.2, 0]);
    p.push(LATHE([[0, 1.465], [0.07, 1.455], [0.112, 1.42], [0.126, 1.36], [0.126, 1.25], [0.115, 1.19]], 0, 0, 0, steel, X(hd, METAL, { seg: 18 })),
      E(0, 1.27, 0.08, 0.1, 0.08, 0.06, steel, X(hd, METAL)), BOX(0, 1.325, 0.118, 0.16, 0.02, 0.02, cyan, X(hd, glow(2.6))), BOX(0, 1.275, 0.123, 0.013, 0.08, 0.02, cyan, X(hd, glow(2.2))),
      BOX(0, 1.42, 0, 0.022, 0.1, 0.22, gold, X(hd, GOLD)),
      tube([[0, 1.46, -0.02], [0, 1.6, -0.1], [0, 1.58, -0.28], [0, 1.44, -0.36]], 0.048, 0.01, 0xC0302A, X(hd, FUR, P(7, 90, 0.35, 0x6A1010))));
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) p.push(E(s * (0.14 + k * 0.012), 1.39 + k * 0.03, -0.02 - k * 0.035, 0.014, 0.085 - k * 0.012, 0.035, 0xF0F2F8, X(hd, METAL, { rz: -s * (0.35 + k * 0.25), rx: -0.3 - k * 0.2 })));
    const sl = [-0.26, 1.08, 0], lx = L(7, sl, METAL);
    p.push(seg(sl, [-0.3, 0.84, 0.06], 0.055, 0.05, steel, lx), E(-0.3, 0.84, 0.07, 0.05, 0.05, 0.05, steel, lx), seg([-0.3, 0.84, 0.06], [-0.31, 0.66, 0.16], 0.05, 0.045, steel, lx), E(-0.31, 0.64, 0.18, 0.055, 0.055, 0.055, steelD, lx));
    const shc = [-0.36, 0.72, 0.28], shr = [0, -0.3, 0];
    p.push(E(...shc, 0.25, 0.34, 0.035, blue, X(lx, { ry: shr[1], r: 0.6 }, P(7, 26, 0.25, 0x16204A))), TOR(...shc, 0.25, 0.022, gold, X(lx, GOLD, { ry: shr[1], sy: 1.36 })),
      X(along(new THREE.BoxGeometry(0.03, 1, 0.02), onPart(shc, ...shr, [0, -0.3, 0.035]), onPart(shc, ...shr, [0, 0.3, 0.035]), gold), lx, GOLD),
      X(along(new THREE.BoxGeometry(0.03, 1, 0.02), onPart(shc, ...shr, [-0.21, 0.06, 0.035]), onPart(shc, ...shr, [0.21, 0.06, 0.035]), gold), lx, GOLD),
      E(...onPart(shc, ...shr, [0, 0.06, 0.04]), 0.06, 0.06, 0.035, gold, X(lx, GOLD)), X(ringAt(onPart(shc, ...shr, [0, 0.06, 0.045]), onPart([0, 0, 0], ...shr, [0, 0, 1]), 0.09, 0.012, cyan), lx, glow(2.2)));
    for (const o of [[0, 0.3], [0, -0.26], [-0.2, 0.06], [0.2, 0.06]]) p.push(OCT(...onPart(shc, ...shr, [o[0], o[1], 0.045]), 0.022, cyan, X(lx, glow(2.4), F)));
    const sr = [0.26, 1.08, 0], rx = L(8, sr, METAL), hand = [0.31, 0.66, 0.18], d = [0, 0.55, 0.83], at = (k) => hand.map((v, i) => v + d[i] * k);
    p.push(seg(sr, [0.3, 0.84, 0.06], 0.055, 0.05, steel, rx), E(0.3, 0.84, 0.07, 0.05, 0.05, 0.05, steel, rx), seg([0.3, 0.84, 0.06], hand, 0.05, 0.045, steel, rx), E(...hand, 0.055, 0.055, 0.055, steelD, rx),
      seg(at(-0.08), at(0.07), 0.02, 0.02, leather, X(rx, { r: 0.8 })), E(...at(-0.1), 0.03, 0.03, 0.03, gold, X(rx, GOLD)),
      seg([0.2, ...at(0.08).slice(1)], [0.42, ...at(0.08).slice(1)], 0.022, 0.022, gold, X(rx, GOLD)), OCT(0.31, ...at(0.08).slice(1).map((v, i) => v + [0, 0.025][i]), 0.025, cyan, X(rx, glow(2.4))),
      X(along(new THREE.BoxGeometry(0.065, 1, 0.014), at(0.09), at(0.72), 0xDDE2EA), rx, METAL), X(along(new THREE.ConeGeometry(0.046, 1, 4), at(0.72), at(0.8), 0xDDE2EA), rx, METAL),
      X(along(new THREE.BoxGeometry(0.014, 1, 0.018), at(0.12), at(0.66), cyan), rx, glow(2.6)));
    return p; },

  budling() { // Bloomling: ribbed amber gourd with a glowing jack-o-face, leaf crown and flower, hanging void seed-pods, root legs
    const p = [], amber = 0xC47826, rib = 0x5E8A2A, root = 0x6A4A2A, leaf = 0x5E9A3A, dark = 0x2A1206, lamp = 0xFFD060;
    p.push(LATHE([[0, 0.12], [0.2, 0.14], [0.3, 0.25], [0.33, 0.42], [0.28, 0.58], [0.16, 0.7], [0.06, 0.78], [0, 0.8]], 0, 0, 0, amber, X({ r: 0.5 }, P(9, 8, 0.75, rib))));
    for (const s of [-1, 1]) p.push(E(s * 0.11, 0.5, 0.27, 0.065, 0.075, 0.04, dark, SKIN), E(s * 0.11, 0.5, 0.29, 0.037, 0.047, 0.02, lamp, glow(2.6)));
    p.push(E(0, 0.36, 0.28, 0.14, 0.04, 0.04, dark, SKIN));
    for (let k = 0; k < 6; k++) p.push(CONE(-0.1 + k * 0.04, 0.36 + (k % 2 ? 0.02 : -0.02), 0.305, 0.018, 0.04, 0xFFC040, k % 2 ? PI : 0, 0, 0, X(glow(2.4), F)));
    const hd = L(5, [0, 0.78, 0]);
    for (let k = 0; k < 5; k++) { const a = k / 5 * PI * 2 + 0.3; p.push(E(Math.cos(a) * 0.2, 0.83, Math.sin(a) * 0.2, 0.22, 0.02, 0.08, leaf, X(hd, { ry: -a, rz: 0.45, r: 0.6 }, P(10, 12, 0.6, 0xA8E070)))); }
    p.push(seg([0, 0.78, 0], [0, 0.98, 0.02], 0.025, 0.02, 0x4E8A2E, X(hd, { pivot: [0, 0.78, 0] })));
    for (let k = 0; k < 7; k++) { const a = k / 7 * PI * 2; p.push(E(Math.cos(a) * 0.09, 1.0, 0.02 + Math.sin(a) * 0.09, 0.1, 0.018, 0.048, 0xF07AB8, X(hd, { ry: -a, rz: 0.35, r: 0.55 }, P(12, 0.12, 0.9, 0xFFF0F6)))); }
    p.push(E(0, 1.02, 0.02, 0.05, 0.04, 0.05, 0xFFE070, X(hd, glow(2.2))));
    for (let k = 0; k < 6; k++) { const a = k / 6 * PI * 2; p.push(E(Math.cos(a) * 0.05, 1.08, 0.02 + Math.sin(a) * 0.05, 0.012, 0.012, 0.012, 0xFFF4A0, X(hd, glow(2.6), F))); }
    for (let k = 0; k < 3; k++) { const a = k * 2.094 + 0.9, x = Math.cos(a) * 0.3, z = Math.sin(a) * 0.3;
      p.push(seg([x * 0.9, 0.76, z * 0.9], [x, 0.7, z], 0.008, 0.008, 0x4E8A2E, F), E(x, 0.64, z, 0.05, 0.07, 0.05, 0x3A1E48, X(L(21, [0, 0, 0]), GLOSS, P(5, 14, 1, 0xB45CFF)))); }
    { const pts = []; for (let k = 0; k <= 10; k++) { const a = k / 10 * PI * 2.4 + 1, y = 0.16 + k * 0.05, r = 0.31 - Math.abs(y - 0.42) * 0.25 + 0.02; pts.push([Math.cos(a) * r, y, Math.sin(a) * r]); }
      p.push(tube(pts, 0.018, 0.012, 0x4E8A2E, F)); }
    [[1, -1, 0.12], [2, 1, 0.12], [3, -1, -0.12], [4, 1, -0.12]].forEach(([limb, s, z]) => { const hip = [s * 0.16, 0.2, z], ex = L(limb, hip, { r: 0.9 });
      p.push(tube([hip, [s * 0.3, 0.15, z * 1.6], [s * 0.37, 0.0, z * 1.9]], 0.055, 0.015, root, X(ex, P(1, 40, 0.5, 0x3E2A14)))); });
    return p; },

  boss() { // Vault Breaker: magma-veined stone golem, spiral obsidian horns, crystal-crusted shoulders, chained core, shackled fists
    const stone = 0x3C3644, st2 = 0x4A4454, cr = 0xB06AF0, lava = 0xFF6A1A, iron = 0x3A3C42, H = [0, 1.85, 0.1], VEIN = P(5, 5.5, 0.8, lava);
    const b = (x, y, z, sx, sy, sz, c, ex = {}) => X({ g: R.blob(DET ? 1 : 0, 0.35, ((x * 13 + y * 7 + z * 3) | 0) + 50, true), m: T(x, y, z, ex.rx || 0, ex.ry || 0, 0, sx, sy, sz), c, r: 0.85 }, VEIN, ex);
    const p = [b(0, 0.95, 0, 0.36, 0.25, 0.28, stone), b(0, 1.4, 0.02, 0.62, 0.5, 0.44, st2), b(0, 1.3, 0.3, 0.4, 0.34, 0.2, stone),
      OCT(0, 1.42, 0.5, 0.17, 0xFF7A3A, X({ sy: 1.4, r: 0.2 }, glow(2.8))), ringAt([0, 1.42, 0.47], [0, 0, 1], 0.2, 0.035, iron, METAL),
      b(0, 1.95, 0.16, 0.24, 0.2, 0.22, stone, L(5, H)), b(0, 1.83, 0.3, 0.17, 0.08, 0.11, st2, L(5, H))];
    for (let k = 0; k < 11; k++) { const f = k / 10, pos = [-0.5 + f * 0.9, 1.72 - f * 0.62, 0.36 + Math.sin(f * PI) * 0.14]; p.push(TOR(...pos, 0.045, 0.014, 0x6A6C74, X(METAL, { rx: k % 2 ? PI / 2 : 0, ry: 0.6, rz: -0.9 }))); }
    for (let k = 0; k < 5; k++) p.push(BOX((k - 2) * 0.1, 1.12 + (k % 2) * 0.1, 0.43, 0.022, 0.18, 0.022, 0xFF8A3A, X(glow(2), { rz: (k - 2) * 0.3 })));
    for (const s of [-1, 1]) {
      p.push(E(s * 0.09, 1.97, 0.37, 0.05, 0.032, 0.03, 0xFFB04A, X(L(5, H), glow(2.8))));
      const hp = []; for (let k = 0; k <= 12; k++) { const a = k / 12 * PI * 1.7, r = 0.2 - k * 0.011; hp.push([s * (0.2 + k * 0.028), 2.08 + Math.sin(a) * r, 0.08 - Math.cos(a) * r + 0.2 - k * 0.01]); }
      p.push(tube(hp, 0.085, 0.015, 0x241C2A, X(L(5, H), GLOSS, P(7, 70, 0.6, 0x5A4A6A))));
      for (let k = 0; k < 3; k++) p.push(CONE(s * 0.05 + (k - 1) * 0.04, 1.8, 0.37, 0.02, 0.07, 0xE8DCC8, 0, 0, 0, X(L(5, H), F)));
      p.push(b(s * 0.62, 1.74, 0, 0.3, 0.24, 0.3, st2), E(s * 0.64, 1.94, 0.02, 0.26, 0.08, 0.26, iron, X(METAL, { rz: -s * 0.35 })));
      for (let k = 0; k < 3; k++) p.push(spike([s * (0.52 + k * 0.1), 1.98 + k * 0.02, -0.1 + k * 0.1], [s * 0.4, 1, -0.1], 0.03, 0.16, 0x8A8C94, METAL));
      for (let k = 0; k < 4; k++) p.push(CONE(s * (0.48 + k * 0.1), 2.0 + k * 0.05, -0.18 + k * 0.08, 0.06 - k * 0.006, 0.36 - k * 0.03, cr, -0.3, 0, -s * 0.5, X(glow(1.6), { r: 0.15 })));
    }
    for (let k = 0; k < 5; k++) p.push(CONE((k - 2) * 0.16, 1.82 + (2 - Math.abs(k - 2)) * 0.08, -0.35, 0.07, 0.46 + (2 - Math.abs(k - 2)) * 0.12, cr, -0.6, 0, (k - 2) * 0.12, X(glow(1.6), { r: 0.15 })));
    for (const [limb, s] of [[1, -1], [2, 1]]) { const hip = [s * 0.3, 0.9, 0], ex = L(limb, hip); p.push(X(seg(hip, [s * 0.33, 0.45, 0.05], 0.17, 0.15, stone, ex), VEIN), b(s * 0.33, 0.5, 0.1, 0.16, 0.14, 0.14, st2, ex), b(s * 0.34, 0.2, 0.08, 0.2, 0.2, 0.26, st2, ex),
      E(s * 0.34, 0.52, 0.2, 0.12, 0.1, 0.06, iron, X(ex, METAL))); }
    for (const [limb, s] of [[7, -1], [8, 1]]) { const sh = [s * 0.72, 1.7, 0.02], ex = L(limb, sh);
      p.push(X(seg(sh, [s * 0.82, 1.15, 0.12], 0.18, 0.14, stone, ex), VEIN), b(s * 0.85, 0.82, 0.18, 0.3, 0.3, 0.3, st2, ex), BOX(s * 0.8, 1.35, 0.2, 0.022, 0.26, 0.022, 0xFF8A3A, X(ex, glow(1.8))),
        ringAt([s * 0.83, 1.05, 0.15], [s * 0.15, 1, 0.1], 0.19, 0.05, iron, X(ex, METAL)));
      for (let k = 0; k < 3; k++) p.push(TOR(s * 0.9, 0.98 - k * 0.09, 0.14, 0.04, 0.013, 0x6A6C74, X(ex, METAL, { ry: k % 2 ? PI / 2 : 0 }, F)));
      for (let k = 0; k < 3; k++) p.push(OCT(s * 0.85 + (k - 1) * 0.1, 0.92, 0.46, 0.06, cr, X(ex, glow(2)))); }
    return p; },
};
// per-type presentation: model scale, gait (radians per world unit), hover height, model height (bars, rings, aim point)
const TYPE = { grub: [1, 6, 0, 0.74], skitter: [1, 13, 0, 0.5], dasher: [1, 6.2, 0, 1.05], bulwark: [0.9, 6, 0, 0.72], troll: [0.88, 3.8, 0, 1.54],
  wisp: [1, 5, 1.4, 0.3], knight: [0.9, 4.7, 0, 1.46], budling: [1, 7, 0, 1.1], boss: [1.55, 1.6, 0, 3.4] };

const VERT_PARS = `attribute float aLimb; attribute vec3 aPivot; attribute float aGlow; attribute vec4 aAnim; attribute vec2 aMat; attribute vec3 aPat; attribute vec3 aCol2;
  varying float vGlow; varying vec3 vBase; varying vec2 vMat; varying float vDie; varying vec3 vObj; varying vec3 vObjN; varying vec3 vPat; varying vec3 vCol2; varying vec3 vTint;
  mat3 rX(float a){ float c=cos(a), s=sin(a); return mat3(1.,0.,0., 0.,c,s, 0.,-s,c); }
  mat3 rY(float a){ float c=cos(a), s=sin(a); return mat3(c,0.,-s, 0.,1.,0., s,0.,c); }
  mat3 rZ(float a){ float c=cos(a), s=sin(a); return mat3(c,s,0., -s,c,0., 0.,0.,1.); }
  float limbW(){ return 1. - fract(aLimb) / 0.998; }  // aLimb = limb id + (1 - skin weight) * 0.998 (WebGL caps attributes at 16)
  mat3 limbRot(){ float t = aAnim.x, mv = aAnim.y, l = floor(aLimb);
    if (l == 1. || l == 4.) return rX(sin(t) * 0.75 * mv);
    if (l == 2. || l == 3.) return rX(-sin(t) * 0.75 * mv);
    if (l == 5.) return rX(sin(t * 2.) * 0.07 * mv + 0.05 * sin(uTime * 1.3 + t)) * rY(sin(uTime * 0.7 + t * 0.3) * 0.12);
    if (l == 6.) return rY(sin(t * 0.9 + uTime) * 0.35);
    if (l == 7.) return rX(-sin(t) * 0.55 * mv);
    if (l == 8.) return rX(sin(t) * 0.55 * mv);
    if (l == 9.) return rZ(-sin(t * 1.4) * 0.75);
    if (l == 10.) return rZ(sin(t * 1.4) * 0.75);
    if (l >= 11. && l <= 14.) return rY(sin(t - (l - 11.) * 1.1) * 0.14 * mv);
    if (l == 15.) return rY(sin(t) * 0.45 * mv);
    if (l == 16.) return rY(-sin(t) * 0.45 * mv);
    if (l == 17.) return rX(sin(uTime * 7. + t) * 0.22) * rZ(sin(uTime * 5.3 + t) * 0.12);   // antennae
    if (l == 20.) return rY(uTime * 1.6 + t * 0.05);                                          // orbiting shards
    if (l == 23.) return rX(-0.08 - 0.28 * mv * (0.6 + 0.4 * abs(sin(t))) + sin(uTime * 2.1 + t) * 0.05); // cape billows back
    return mat3(1.); }
  vec3 limbOff(){ float t = aAnim.x, mv = aAnim.y, l = floor(aLimb); vec3 o = vec3(0., abs(sin(t)) * 0.035 * mv, 0.);
    if (l >= 11. && l <= 14.) o.y += max(0., sin(t - (l - 11.) * 1.1)) * 0.06 * mv;
    if (l == 15.) o.y += max(0., cos(t)) * 0.04 * mv; if (l == 16.) o.y += max(0., -cos(t)) * 0.04 * mv;
    if (l == 21.) o.y += sin(uTime * 2.4 + t) * 0.035;                                         // floating / dangling
    return o; }`;
function animate(mat, isDepth) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = R.clock;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;\n' + VERT_PARS);
    if (!isDepth) sh.vertexShader = sh.vertexShader.replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvObjN = objectNormal; objectNormal = mix(objectNormal, limbRot() * objectNormal, limbW());');
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      transformed = mix(transformed, aPivot + limbRot() * (transformed - aPivot), limbW()) + limbOff();
      float breathe = 1. + sin(uTime * 2.3 + aAnim.x * 0.21) * 0.018;                   // idle breathing
      transformed.y *= breathe; transformed.xz *= 2. - breathe;
      float hit = aAnim.w; transformed.y *= 1. - hit * 0.16; transformed.xz *= 1. + hit * 0.1; // flinch on hit
      float dieT = aAnim.z; transformed.y -= dieT * dieT * 0.12; vDie = dieT; vObj = position;
      vGlow = aGlow * (1. - dieT); vMat = aMat; vPat = aPat; vCol2 = aCol2;
      #ifdef USE_INSTANCING_COLOR
      vTint = instanceColor;
      #else
      vTint = vec3(1.);
      #endif
      #ifdef USE_COLOR
      vBase = color.rgb;
      #else
      vBase = vec3(1.);
      #endif`);
    if (!isDepth) sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vGlow; varying vec3 vBase; varying vec2 vMat; varying float vDie; varying vec3 vObj; varying vec3 vObjN; varying vec3 vPat; varying vec3 vCol2; varying vec3 vTint;\nfloat dHash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }\nfloat dNoise(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(mix(dHash(i), dHash(i + vec3(1,0,0)), f.x), mix(dHash(i + vec3(0,1,0)), dHash(i + vec3(1,1,0)), f.x), f.y), mix(mix(dHash(i + vec3(0,0,1)), dHash(i + vec3(1,0,1)), f.x), mix(dHash(i + vec3(0,1,1)), dHash(i + vec3(1,1,1)), f.x), f.y), f.z); }\n' + R.PATTERN_GLSL)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nfloat dn = dNoise(vObj * 9.) * 0.7 + dNoise(vObj * 23.) * 0.3; if (vDie > 0.001 && dn < vDie * 1.1) discard;')
      .replace('#include <color_fragment>', `vec2 pm = surfPattern(vObj, normalize(vObjN), vPat);
        diffuseColor.rgb *= mix(vBase, vCol2, pm.x) * vTint * (0.86 + 0.28 * dNoise(vObj * 17.));     // two-tone pattern + fine surface grain`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vMat.x;')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vMat.y;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        diffuseColor.rgb *= mix(0.5, 1.0, smoothstep(-0.02, 0.5, vObj.y)) * (1.0 + 0.12 * smoothstep(0.25, 0.9, vObj.y)); // grounded: darker feet, lit back
        vec3 glowCol = vBase;
        #ifdef USE_MAP
        glowCol *= texelColor.rgb * 1.6;                                                      // textured models glow in their own colour
        #endif
        totalEmissiveRadiance += vGlow * glowCol * 2.8 + pm.y * vCol2 * 2.6 * (1. - vDie);   // glow ignores hit-flash / status tint
        if (vDie > 0.001) totalEmissiveRadiance += vec3(3.2, 1.2, 4.0) * (1. - smoothstep(0.0, 0.09, dn - vDie * 1.1)); // dissolving edge
        float rimF = pow(1. - clamp(dot(normal, normalize(vViewPosition)), 0., 1.), 3.);
        totalEmissiveRadiance += (diffuseColor.rgb * 0.8 + 0.1) * rimF * 0.55;                // stylised rim light`);
  };
  mat.customProgramCacheKey = () => 'creature4' + (isDepth ? 'D' : 'C');
  return mat;
}

// ---------- creatures modelled in Blender (assets/blender): quantised mesh + rig weights + one baked texture each.
const b64 = (s, T) => { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new T(u.buffer); };
function loadModel(d) {
  const im = new Image(), tex = new THREE.Texture(im); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4; tex.flipY = false;
  im.onload = () => { tex.needsUpdate = true; }; im.src = d.tex;
  const out = {};
  for (const key of ['near', 'far']) { const L = d[key], n = L.n, q = b64(L.pos, Uint16Array), lo = L.lo, hi = L.hi;
    const pos = new Float32Array(n * 3); for (let i = 0; i < n * 3; i++) { const a = i % 3; pos[i] = lo[a] + (hi[a] - lo[a]) * q[i] / 65535; }
    const nr = b64(L.nor, Int8Array), nor = new Float32Array(n * 3); for (let i = 0; i < n * 3; i++) nor[i] = nr[i] / 127;
    const uq = b64(L.uv, Uint16Array), uv = new Float32Array(n * 2); for (let i = 0; i < n; i++) { uv[i * 2] = uq[i * 2] / 65535; uv[i * 2 + 1] = 1 - uq[i * 2 + 1] / 65535; }
    const lb = b64(L.limb, Uint8Array), wq = b64(L.w, Uint8Array), gq = b64(L.glow, Uint8Array), rm = b64(L.rm, Uint8Array);
    const limb = new Float32Array(n), glow = new Float32Array(n), piv = new Float32Array(n * 3), mt = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { limb[i] = lb[i] + (1 - (lb[i] ? wq[i] / 255 : 0)) * 0.998; glow[i] = gq[i] / 255 * 4; mt[i * 2] = rm[i * 2] / 255; mt[i * 2 + 1] = rm[i * 2 + 1] / 255;
      const p = d.pivots[lb[i]]; if (p) piv.set(p, i * 3); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3)); g.setAttribute('aLimb', new THREE.BufferAttribute(limb, 1));
    g.setAttribute('aPivot', new THREE.BufferAttribute(piv, 3)); g.setAttribute('aGlow', new THREE.BufferAttribute(glow, 1)); g.setAttribute('aMat', new THREE.BufferAttribute(mt, 2));
    g.setAttribute('aPat', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('aCol2', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setIndex(new THREE.BufferAttribute(b64(L.idx, n < 65536 ? Uint16Array : Uint32Array), 1)); g.computeBoundingSphere(); out[key] = g; }
  out.height = d.near.hi[1]; out.tex = tex; return out;
}
const BLENDER = {}; for (const [k, d] of Object.entries(R.MODELS3D || {})) { BLENDER[k] = loadModel(d); TYPE[k][0] = 1; TYPE[k][3] = BLENDER[k].height; }

R.buildCreatures = function (world, sim, Q, CAP, MT_KEYS) {
  const lin = R.lin, meshes = {}, animAttr = {}, lod = {}, lodAttr = {};
  const mat = animate(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 })), matOf = {};
  for (const k in BLENDER) matOf[k] = animate(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, map: BLENDER[k].tex }));
  const depthMat = animate(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), true);
  let shadowsOn = Q !== 'low';
  const mk = (k, detail, cap) => { let geo;
    if (BLENDER[k]) geo = BLENDER[k][detail ? 'near' : 'far'];
    else { DET = detail; geo = R.merge(MODELS[k]().filter(p => detail || !p.fine), { extra: true }); DET = 1; }
    const aa = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4); aa.setUsage(THREE.DynamicDrawUsage); geo.setAttribute('aAnim', aa);
    const im = new THREE.InstancedMesh(geo, matOf[k] || mat, cap); im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.count = 0; im.frustumCulled = false; im.castShadow = shadowsOn && detail === 1; im.customDepthMaterial = depthMat;
    world.add(im); return [im, aa]; };
  for (const k of MT_KEYS) { const cap = k === 'boss' ? 4 : Math.min(CAP, 3000) + 400;
    [meshes[k], animAttr[k]] = mk(k, 1, k === 'boss' ? 4 : 260); [lod[k], lodAttr[k]] = mk(k, 0, cap); }
  const inst = (geo, material, cap, color = true) => { const im = new THREE.InstancedMesh(geo, material, cap);
    if (color) im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.count = 0; im.frustumCulled = false; world.add(im); return im; };
  const blob = inst(new THREE.CircleGeometry(0.5, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }), CAP, false);
  const shield = inst(new THREE.SphereGeometry(1, 28, 18), new THREE.MeshStandardMaterial({ color: lin(0x9FD8FF), emissive: lin(0x3A7AB0), emissiveIntensity: 0.22, transparent: true, opacity: 0.12, depthWrite: false, roughness: 0.1 }), 1024, false);
  R.rim(shield.material, 0.9);
  const elite = inst(new THREE.TorusGeometry(0.5, 0.045, 6, 36), new THREE.MeshBasicMaterial({ color: 0xffffff }), 256);
  const barBg = inst(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: lin(0x1a1210), depthTest: false, transparent: true, opacity: 0.85 }), CAP, false);
  const barFg = inst(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false }), CAP);
  barBg.renderOrder = 10; barFg.renderOrder = 11;

  const yaw = new Float32Array(CAP), gen = new Uint32Array(CAP), phase = new Float32Array(CAP);
  const fr = new THREE.Frustum(), pm = new THREE.Matrix4(), bs = new THREE.Sphere(); const stats = { culled: 0, hi: 0 };
  const dying = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(), c = new THREE.Color(), tv = new THREE.Vector3();
  const C = { hp1: lin(0x8BD65A), hp2: lin(0xF2C94C), hp3: lin(0xE0604A), sh: lin(0x9FD8FF) };
  const EL = ['ember', 'tide', 'grove', 'void', 'storm', 'iron'], ELC = {}; for (const [k, h] of Object.entries({ ember: 0xEE6A34, tide: 0x3FA0E8, grove: 0x7CC24A, void: 0xA56BF0, storm: 0xF4DA4A, iron: 0xA9ADB3 })) ELC[k] = lin(h).multiplyScalar(1.6);
  const ringC = { boss: lin(0xFF5A3C).multiplyScalar(2), frenzy: lin(0xFFB347).multiplyScalar(1.5) };
  function onDeath(ev, idx) { dying.push({ type: ev.type, x: ev.x, z: ev.z, yaw: idx >= 0 ? yaw[idx] : 0, s: ev.elite ? 1.3 : 1, t: 0 }); if (dying.length > 400) dying.shift(); }

  function draw(alpha, time, dt, camera, lowDetail) {
    const m = sim.m, counts = {}, lcounts = {}; for (const k of MT_KEYS) counts[k] = lcounts[k] = 0;
    const fx = camera.userData.focusX || 11, fz = camera.userData.focusZ || 7, cd = camera.userData.dist || 25, near2 = cd < 20 ? Math.pow(cd * 1.25, 2) : 0; let hiN = 0;
    let nb = 0, ns = 0, ne = 0, nbar = 0; const camQ = camera.quaternion, MT = AH.MT;
    camera.updateMatrixWorld(); fr.setFromProjectionMatrix(pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)); let culled = 0;
    for (let i = 0; i < CAP; i++) {
      if (!m.alive[i]) continue;
      const key = MT_KEYS[m.type[i]], [ms, gait, hover, ht] = TYPE[key], d = MT[key];
      const x = m.px[i] + (m.x[i] - m.px[i]) * alpha, z = m.pz[i] + (m.z[i] - m.pz[i]) * alpha;
      const fly = m.flags[i] & AH.F_FLY, boss = m.flags[i] & AH.F_BOSS, el = m.flags[i] & AH.F_ELITE;
      if (gen[i] !== m.gen[i]) { gen[i] = m.gen[i]; yaw[i] = Math.atan2(m.dirx[i], m.dirz[i]); phase[i] = (i * 2.399) % 6.283; }
      const ty = Math.atan2(m.dirx[i], m.dirz[i]); let dy = ty - yaw[i]; dy = ((dy + Math.PI * 3) % (Math.PI * 2)) - Math.PI; yaw[i] += dy * Math.min(1, dt * 10);
      const s = ms * (el ? 1.3 : 1);
      const spd = m.speed[i] * m.enrage[i] * (m.slowT[i] > 0 ? 0.55 : 1) * (m.frenzyBoost[i] ? 1.25 : 1);
      phase[i] += dt * spd * gait;
      const gy = fly ? 0 : R.groundY(x, z), y = gy + (fly ? hover + Math.sin(time * 2 + i) * 0.06 : 0);
      bs.center.set(x, y + 0.5 * ht * (el ? 1.3 : 1), z); bs.radius = ht * (el ? 1.3 : 1) + 0.6; if (!fr.intersectsSphere(bs)) { culled++; continue; } // off-screen: not drawn at all
      e.set(0, yaw[i], 0); q.setFromEuler(e); m4.compose(v.set(x, y, z), q, sc.set(s, s, s));
      const d2 = (x - fx) * (x - fx) + (z - fz) * (z - fz);
      const hi = boss || (hiN < (lowDetail ? 80 : 180) && d2 < near2 && counts[key] < meshes[key].instanceMatrix.count); if (hi) hiN++;
      const tim = hi ? meshes[key] : lod[key], tat = hi ? animAttr[key] : lodAttr[key];
      const n = hi ? counts[key]++ : lcounts[key]++; tim.setMatrixAt(n, m4);
      tat.setXYZW(n, phase[i], lowDetail && !boss ? 0 : 1, 0, m.hitT[i] > 0 ? m.hitT[i] / 0.12 : 0);
      c.setRGB(1, 1, 1);
      // status tints stay in range: pale creatures must not bloom out to white
      if (m.slowT[i] > 0) c.setRGB(0.55, 0.78, 1.2);
      if (m.burnT[i] > 0) { const f = 0.85 + 0.15 * Math.sin(time * 20 + i); c.setRGB(1.25 * f, 0.72, 0.45); }
      if (m.hitT[i] > 0) c.multiplyScalar(1.18);
      tim.setColorAt(n, c);
      const H = ht * (el ? 1.3 : 1), r = d.size * (el ? 1.3 : 1) * 3.4;
      if (!shadowsOn || fly || !hi) { m4.makeRotationX(-Math.PI / 2).scale(sc.set(r * (fly ? 0.7 : 1), r * (fly ? 0.7 : 1), 1)).setPosition(x, (fly ? R.groundY(x, z) : gy) + 0.02, z); blob.setMatrixAt(nb++, m4); }
      const top = y + H;
      if (m.shield[i] > 0 && ns < 1024) { const rr = Math.max(H * 0.62, r * 0.55); m4.makeScale(rr * 0.85, rr, rr * 0.85).setPosition(x, y + (fly ? 0 : H * 0.48), z); shield.setMatrixAt(ns++, m4); }
      if ((el || boss) && ne < 256) { e.set(Math.PI / 2, 0, time * 1.5); q.setFromEuler(e); m4.compose(v.set(x, top + 0.12, z), q, sc.set(r * 0.5, r * 0.5, r * 0.5)); elite.setMatrixAt(ne, m4);
        elite.setColorAt(ne, m.immune[i] >= 0 ? ELC[EL[m.immune[i]]] : boss ? ringC.boss : ringC.frenzy); ne++; }
      const hpF = m.hp[i] / m.maxHp[i];
      if (hpF < 0.999 || boss || el || m.shield[i] > 0) {
        const bw = boss ? 2.8 : Math.max(0.62, r * 0.62), by = top + (boss ? 0.45 : 0.28);
        m4.compose(v.set(x, by, z), camQ, sc.set(bw + 0.06, boss ? 0.24 : 0.13, 1)); barBg.setMatrixAt(nbar, m4);
        v.set(-bw / 2 + bw * hpF / 2, 0, 0.001).applyQuaternion(camQ);
        m4.compose(v.add(tv.set(x, by, z)), camQ, sc.set(Math.max(0.001, bw * hpF), boss ? 0.17 : 0.085, 1)); barFg.setMatrixAt(nbar, m4);
        barFg.setColorAt(nbar, m.shield[i] > 0 ? C.sh : hpF > 0.5 ? C.hp1 : hpF > 0.25 ? C.hp2 : C.hp3); nbar++;
      }
    }
    for (let k = 0; k < dying.length; k++) { const D = dying[k]; D.t += dt; const f = D.t / 0.7; if (f >= 1) { dying.splice(k--, 1); continue; }
      const im = lod[D.type]; if (!im) continue; const n = lcounts[D.type]; if (n >= im.instanceMatrix.count) continue; lcounts[D.type]++;
      const [ms, , hover] = TYPE[D.type], s = ms * D.s; const y = (hover ? hover * (1 - f) : 0) + R.groundY(D.x, D.z);
      e.set(0, D.yaw, 0); q.setFromEuler(e); m4.compose(v.set(D.x, y, D.z), q, sc.set(s, s, s)); im.setMatrixAt(n, m4); lodAttr[D.type].setXYZW(n, 0, 0, f, 0);
      im.setColorAt(n, c.setRGB(0.7, 0.62, 0.66)); }
    for (const k of MT_KEYS) for (const [im, aa, cnt] of [[meshes[k], animAttr[k], counts[k]], [lod[k], lodAttr[k], lcounts[k]]]) { im.count = cnt; im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; aa.needsUpdate = true; }
    stats.culled = culled; stats.hi = hiN;
    blob.count = nb; blob.instanceMatrix.needsUpdate = true; shield.count = ns; shield.instanceMatrix.needsUpdate = true;
    elite.count = ne; elite.instanceMatrix.needsUpdate = true; elite.instanceColor.needsUpdate = true;
    barBg.count = barFg.count = nbar; barBg.instanceMatrix.needsUpdate = barFg.instanceMatrix.needsUpdate = true; barFg.instanceColor.needsUpdate = true;
  }
  function reset() { dying.length = 0; gen.fill(0); }
  function age(dt) { for (let k = 0; k < dying.length; k++) { dying[k].t += dt; if (dying[k].t >= 0.7) dying.splice(k--, 1); } } // advance corpses without drawing (harness bulk steps)
  const triN = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3; const tris = {}; for (const k of MT_KEYS) tris[k] = [triN(meshes[k].geometry), triN(lod[k].geometry)];
  function setShadows(on) { shadowsOn = on; for (const k of MT_KEYS) meshes[k].castShadow = on; }
  return { draw, onDeath, reset, age, setShadows, meshes, tris, TYPE, stats };
};
})();
