/* Arcane Hand — effects. Two instanced billboard systems (additive glow, alpha dust): one draw call each.
   Colours are linear HDR so bloom picks up magic. Every emitter here is cosmetic and is cut first under load. */
(function () {
'use strict';
const R = globalThis.AHR, lin = R.lin;
class Particles {
  constructor(world, tex, cap, additive) {
    this.cap = cap; this.n = 0; this.p = [];
    const g = new THREE.InstancedBufferGeometry(); const q = new THREE.PlaneGeometry(1, 1);
    g.index = q.index; g.setAttribute('position', q.attributes.position); g.setAttribute('uv', q.attributes.uv);
    this.pos = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); this.col = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    this.sz = new THREE.InstancedBufferAttribute(new Float32Array(cap * 2), 2);
    for (const a of [this.pos, this.col, this.sz]) a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iPos', this.pos); g.setAttribute('iCol', this.col); g.setAttribute('iSz', this.sz); g.instanceCount = 0;
    this.mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { map: { value: tex } },
      vertexShader: `attribute vec3 iPos; attribute vec4 iCol; attribute vec2 iSz; varying vec4 vC; varying vec2 vUv;
        void main(){ vC = iCol; vUv = uv; vec4 mv = modelViewMatrix * vec4(iPos, 1.); float c = cos(iSz.y), s = sin(iSz.y);
          vec2 p = vec2(position.x * c - position.y * s, position.x * s + position.y * c) * iSz.x; mv.xy += p; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D map; varying vec4 vC; varying vec2 vUv; void main(){ float a = texture2D(map, vUv).a * vC.a; if (a < 0.003) discard;
        gl_FragColor = vec4(vC.rgb * ${additive ? 'a' : '1.'}, ${additive ? '1.' : 'a'});\n#include <tonemapping_fragment>\n#include <encodings_fragment>\n}` });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = additive ? 6 : 5; world.add(this.mesh); this.g = g;
  }
  // x,y,z, vx,vy,vz, life, size0, size1, color(THREE.Color, HDR), a0, a1, grav, drag
  add(x, y, z, vx, vy, vz, life, s0, s1, c, a0 = 1, a1 = 0, grav = 0, drag = 0) {
    if (this.p.length >= this.cap) return; this.p.push({ x, y, z, vx, vy, vz, t: 0, life, s0, s1, r: c.r, g: c.g, b: c.b, a0, a1, grav, drag, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 3 });
  }
  update(dt) {
    const P = this.p, pos = this.pos.array, col = this.col.array, sz = this.sz.array; let n = 0;
    for (let k = 0; k < P.length; k++) { const p = P[k]; p.t += dt; if (p.t >= p.life) { P[k] = P[P.length - 1]; P.pop(); k--; continue; }
      const f = p.t / p.life; p.vy -= p.grav * dt; const d = 1 - p.drag * dt; p.vx *= d; p.vy *= d; p.vz *= d; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.rot += p.vr * dt;
      pos[n * 3] = p.x; pos[n * 3 + 1] = p.y; pos[n * 3 + 2] = p.z; const a = p.a0 + (p.a1 - p.a0) * f;
      col[n * 4] = p.r; col[n * 4 + 1] = p.g; col[n * 4 + 2] = p.b; col[n * 4 + 3] = a; sz[n * 2] = p.s0 + (p.s1 - p.s0) * f; sz[n * 2 + 1] = p.rot; n++; }
    this.g.instanceCount = n; this.pos.needsUpdate = this.col.needsUpdate = this.sz.needsUpdate = true; this.n = n;
  }
  clear() { this.p.length = 0; }
}

// ---------- 3D projectile models (one InstancedMesh per kind, oriented along flight, multi-colour + glow via the kit material)
const T = (...a) => R.T(...a), PI = Math.PI;
const pE = (x, y, z, sx, sy, sz, c, ex = {}) => Object.assign({ g: new THREE.SphereGeometry(1, 12, 9), m: T(x, y, z, ex.rx || 0, ex.ry || 0, ex.rz || 0, sx, sy, sz), c }, ex);
const pCone = (r, h, x, y, z, c, rx, ex = {}) => Object.assign({ g: new THREE.ConeGeometry(r, h, ex.seg || 8), m: T(x, y, z, rx, ex.ry || 0, ex.rz || 0), c }, ex);
const pCyl = (r0, r1, h, x, y, z, c, ex = {}) => Object.assign({ g: new THREE.CylinderGeometry(r1, r0, h, ex.seg || 8), m: T(x, y, z, PI / 2, 0, 0), c }, ex); // along +z
const pO = (r, x, y, z, c, ex = {}) => Object.assign({ g: new THREE.OctahedronGeometry(r, 0), m: T(x, y, z, ex.rx || 0, ex.ry || 0, ex.rz || 0, ex.sx || 1, ex.sy || 1, ex.sz || 1), c }, ex);
const G = (g) => ({ glow: g, r: 0.4 });
const PMODELS = {   // +z = direction of flight
  fireball: () => [pE(0, 0, 0, 0.11, 0.11, 0.11, 0xFFE8A0, G(3)), pE(0, 0, -0.03, 0.15, 0.15, 0.19, 0xFF8A2A, G(1.6)), pCone(0.13, 0.42, 0, 0, -0.26, 0xFF5A1A, -PI / 2, G(1.8)),
    ...[0, 1, 2, 3].map(k => pCone(0.05, 0.22, Math.cos(k * 1.57) * 0.1, Math.sin(k * 1.57) * 0.1, -0.16, 0xFFB040, -PI / 2, G(2)))],
  magma: () => [pE(0, 0, 0, 0.19, 0.17, 0.18, 0x2A1E1C, { r: 0.9 }), ...[0, 1, 2, 3, 4, 5].map(k => pE(Math.cos(k * 1.05) * 0.15, Math.sin(k * 2.1) * 0.08, Math.sin(k * 1.05) * 0.15, 0.06, 0.03, 0.06, 0xFF6A1A, Object.assign(G(3), { ry: k }))),
    pE(0, 0, 0, 0.14, 0.14, 0.14, 0xFF9A3A, G(1.2))],
  icelance: () => [pO(0.07, 0, 0, 0.05, 0xE8FCFF, Object.assign(G(2.2), { rx: PI / 2, sy: 4.2 })), pO(0.05, 0, 0, -0.14, 0x7FE0FF, Object.assign(G(1.6), { rx: PI / 2, sy: 3 })),
    ...[0, 1, 2].map(k => pO(0.04, Math.cos(k * 2.09) * 0.06, Math.sin(k * 2.09) * 0.06, -0.2, 0xA8F0FF, Object.assign(G(1.4), { rx: PI / 2, sy: 2.5 })))],
  droplet: () => [pE(0, 0, 0, 0.08, 0.08, 0.13, 0xBFF4FF, G(2)), pCone(0.06, 0.16, 0, 0, -0.12, 0x5FC8F0, -PI / 2, G(1.4))],
  waterorb: () => [pE(0, 0, 0, 0.17, 0.17, 0.17, 0x6FD0F4, G(1.3)), pE(0, 0, 0, 0.09, 0.09, 0.09, 0xE8FCFF, G(3)), Object.assign({ g: new THREE.TorusGeometry(0.22, 0.02, 6, 24), m: T(0, 0, 0, 0.4, 0, 0), c: 0xBFF4FF }, G(2.4))],
  thorn: () => [pCone(0.05, 0.42, 0, 0, 0.06, 0x6A9A2A, PI / 2, { r: 0.6 }), pCyl(0.02, 0.02, 0.22, 0, 0, -0.2, 0x4A3A1A, { r: 0.8 }), pE(0, 0, 0.02, 0.05, 0.05, 0.06, 0xC8F060, G(2)),
    ...[0, 1].map(k => pE((k ? 1 : -1) * 0.06, 0, -0.26, 0.07, 0.01, 0.04, 0x8CD04A, Object.assign(G(0.6), { ry: (k ? 1 : -1) * 0.4 })))],
  seedpod: () => [pE(0, 0, 0, 0.16, 0.16, 0.18, 0x5A7A2A, { r: 0.7 }), pE(0, 0, 0, 0.1, 0.1, 0.1, 0xC8F060, G(1.4)), ...[0, 1, 2, 3, 4, 5, 6, 7].map(k => { const a = k * 0.785;
    return pCone(0.03, 0.14, Math.cos(a) * 0.16, Math.sin(a) * 0.16, (k % 2) * 0.06 - 0.03, 0xE8E0B0, 0, { rz: a - PI / 2, r: 0.5 }); })],
  shard: () => [pO(0.08, 0, 0, 0, 0xC890FF, Object.assign(G(2.2), { rx: PI / 2, sy: 2.6 })), pO(0.05, 0.07, 0, -0.06, 0x7A3AD0, Object.assign(G(1.6), { rx: PI / 2, sy: 2 })), pO(0.05, -0.07, 0, -0.06, 0x7A3AD0, Object.assign(G(1.6), { rx: PI / 2, sy: 2 }))],
  voidorb: () => [pE(0, 0, 0, 0.16, 0.16, 0.16, 0x120A1C, { r: 0.1, mt: 0.3 }), Object.assign({ g: new THREE.TorusGeometry(0.22, 0.025, 6, 28), m: T(0, 0, 0, PI / 2, 0, 0), c: 0xB070FF }, G(2.6)),
    Object.assign({ g: new THREE.TorusGeometry(0.19, 0.015, 6, 28), m: T(0, 0, 0, 0.3, 0.8, 0), c: 0xE0B8FF }, G(2.2))],
  arrow: () => [pCyl(0.012, 0.012, 0.42, 0, 0, -0.04, 0xC8A878, { r: 0.8 }), pCone(0.03, 0.09, 0, 0, 0.21, 0xB8C0CC, PI / 2, { r: 0.3, mt: 0.9, seg: 4 }),
    ...[0, 1, 2].map(k => pE(Math.cos(k * 2.09) * 0.025, Math.sin(k * 2.09) * 0.025, -0.22, 0.012, 0.03, 0.05, 0xC03A2A, { rz: k * 2.09, r: 0.9 }))],
  cannonball: () => [pE(0, 0, 0, 0.14, 0.14, 0.14, 0x2A2C30, { r: 0.35, mt: 0.9 }), pE(0, 0, -0.1, 0.1, 0.1, 0.12, 0xFFB060, G(1.4))],
};
function projKind(el, arch) {
  if (el === 'ember') return arch === 'heavy' ? 'magma' : 'fireball';
  if (el === 'tide') return arch === 'heavy' ? 'waterorb' : arch === 'rapid' ? 'droplet' : 'icelance';
  if (el === 'grove') return arch === 'heavy' ? 'seedpod' : 'thorn';
  if (el === 'void') return arch === 'heavy' ? 'voidorb' : 'shard';
  if (el === 'iron') return arch === 'heavy' ? 'cannonball' : 'arrow';
  return null; // storm fires lightning
}
R.buildFX = function (world, tex) {
  const glow = new Particles(world, tex.soft, 7000, true), dust = new Particles(world, tex.soft, 3000, false);
  const pmat = R.kitMaterial(), PM = {};
  for (const k of Object.keys(PMODELS)) { const im = new THREE.InstancedMesh(R.merge(PMODELS[k]()), pmat, 256); im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.count = 0; im.frustumCulled = false; im.castShadow = false; world.add(im); PM[k] = { im, n: 0 }; }
  const pm4 = new THREE.Matrix4(), pq = new THREE.Quaternion(), pq2 = new THREE.Quaternion(), pv = new THREE.Vector3(), pdir = new THREE.Vector3(), psc = new THREE.Vector3(), ZF = new THREE.Vector3(0, 0, 1);
  const E = { ember: [lin(0xFF7A2A), lin(0xFFD060)], tide: [lin(0x4FB8F0), lin(0xC8F4FF)], grove: [lin(0x8CD04A), lin(0xE8FF9A)], void: [lin(0x9A4AF0), lin(0xE0B8FF)], storm: [lin(0xFFE070), lin(0xFFFFFF)], iron: [lin(0xFFB060), lin(0xFFF0D0)] };
  const hdr = (c, k) => c.clone().multiplyScalar(k);
  const rnd = Math.random, proj = [];
  let cut = 0;
  const fx = {
    glow, dust,
    setCut(c) { cut = c; },
    shot(e, top, toY) { // visual projectile; damage already resolved in the simulation
      const [c1, c2] = E[e.el], d = Math.hypot(e.tx - e.x, e.tz - e.z);
      if (e.el === 'storm') { const w = (e.crit ? 2.4 : 1.6) * (e.arch === 'heavy' ? 1.4 : e.arch === 'rapid' ? 0.75 : 1); bolt(e.x, top, e.z, e.tx, toY, e.tz, c1, w);
        if (cut < 2) bolt(e.x, top, e.z, e.tx + (rnd() - 0.5) * 0.3, toY + 0.1, e.tz + (rnd() - 0.5) * 0.3, lin(0xB8D8FF), w * 0.45); flash(e.tx, toY, e.tz, c2, 0.8 * w); flash(e.x, top, e.z, c2, 0.6); impact(e.tx, toY, e.tz, 'storm', w * 0.6, e.crit, e.arch); return; }
      const sp = e.arch === 'sniper' ? 15 : e.arch === 'heavy' ? 6.5 : 10;
      proj.push({ x0: e.x, y0: top, z0: e.z, x1: e.tx, y1: toY, z1: e.tz, t: 0, dur: Math.max(0.07, d / sp), el: e.el, arch: e.arch, crit: e.crit, lob: e.arch === 'heavy', px: e.x, py: top, pz: e.z,
        kind: projKind(e.el, e.arch), roll: rnd() * 6.28, tier: e.tier || 0 });
    },
    muzzle(x, y, z, el) { const [c1, c2] = E[el]; flash(x, y, z, c2, 0.5); if (cut >= 2) return;
      for (let k = 0; k < 7; k++) { const a = rnd() * 6.28; glow.add(x, y, z, Math.cos(a) * 1.1, 0.6 + rnd(), Math.sin(a) * 1.1, 0.3, 0.1, 0.01, hdr(c1, 2.5), 1, 0, 2, 2); }
      if (el === 'iron') for (let k = 0; k < 3; k++) dust.add(x, y, z, (rnd() - 0.5) * 0.6, 0.3 + rnd() * 0.4, (rnd() - 0.5) * 0.6, 0.8, 0.12, 0.4, lin(0x8A8680), 0.4, 0, -0.2, 1.5); },
    splash(x, z, el) { const [c1, c2] = E[el]; for (let k = 0; k < (cut ? 8 : 18); k++) { const a = rnd() * 6.28, s = 1.5 + rnd() * 2; glow.add(x, 0.3, z, Math.cos(a) * s, 0.5 + rnd(), Math.sin(a) * s, 0.35, 0.22, 0.05, hdr(c1, 2.5), 1, 0, 3, 3); }
      flash(x, 0.3, z, c2, 0.9); },
    chain(pts, el) { const [c1] = E[el]; for (let k = 0; k < pts.length - 1; k++) bolt(pts[k][0], 0.55, pts[k][1], pts[k + 1][0], 0.55, pts[k + 1][1], c1, 1.3); },
    pierce(x, z, ex, ez, el) { const [c1, c2] = E[el]; const n = 14; for (let k = 0; k <= n; k++) { const f = k / n; glow.add(x + (ex - x) * f, 0.55, z + (ez - z) * f, 0, 0, 0, 0.22, 0.3, 0.05, hdr(c2, 2), 1, 0); } },
    death(x, y, z, big, col) { const n = big ? 26 : cut >= 2 ? 3 : 7;
      for (let k = 0; k < n; k++) { const a = rnd() * 6.28, s = (0.4 + rnd() * 0.8) * (big ? 2 : 1); dust.add(x + Math.cos(a) * 0.1, y + 0.15, z + Math.sin(a) * 0.1, Math.cos(a) * s, 0.4 + rnd() * 0.6, Math.sin(a) * s, 0.6 + rnd() * 0.4, 0.22 * (big ? 2 : 1), 0.6 * (big ? 2.2 : 1), col, 0.55, 0, -0.2, 2.5); }
      if (cut < 2) for (let k = 0; k < (big ? 20 : 3); k++) glow.add(x, y + 0.3, z, (rnd() - 0.5) * 0.6, 1 + rnd() * 1.2, (rnd() - 0.5) * 0.6, 0.8, 0.09, 0.02, hdr(lin(0xB88AF0), 2.2), 1, 0, -0.5, 1); },
    merge(x, z, col, big) { for (let k = 0; k < (big ? 80 : 40); k++) { const a = k / 40 * 6.28 * 3, r = 0.5 + rnd() * 0.2; glow.add(x + Math.cos(a) * r, 0.1 + k * 0.03, z + Math.sin(a) * r, -Math.sin(a) * 1.5, 1.8 + rnd(), Math.cos(a) * 1.5, 0.9, 0.14, 0.03, hdr(col, 3), 1, 0, 0, 1.5); } },
    sacrifice(x0, z0, x1, z1) { const n = 24; for (let k = 0; k <= n; k++) { const f = k / n; glow.add(x0 + (x1 - x0) * f, 0.4 + Math.sin(f * Math.PI) * 1.2, z0 + (z1 - z0) * f, 0, 0.2, 0, 0.35 + f * 0.3, 0.16, 0.04, hdr(lin(0xF2C46A), 2.5), 1, 0); }
      for (let k = 0; k < 12; k++) dust.add(x0, 0.4, z0, (rnd() - 0.5) * 1.5, rnd() * 1.5, (rnd() - 0.5) * 1.5, 0.7, 0.2, 0.5, lin(0xC8C0B0), 0.6, 0, 2, 2); },
    sparkle(x, y, z, col, n = 14) { for (let k = 0; k < n; k++) { const a = rnd() * 6.28; glow.add(x + Math.cos(a) * 0.3, y + rnd() * 0.6, z + Math.sin(a) * 0.3, 0, 0.6 + rnd(), 0, 0.8, 0.1, 0.02, hdr(col, 3), 1, 0); } },
    ring(x, z, col) { for (let k = 0; k < 32; k++) { const a = k / 32 * 6.28; glow.add(x, 0.15, z, Math.cos(a) * 3, 0.2, Math.sin(a) * 3, 0.5, 0.18, 0.06, hdr(col, 2.5), 1, 0, 0, 2); } },
    // ambient: tower idle, portal, vault
    ambient(dt, towers, time) { if (cut >= 1) return;
      for (const [t, g] of towers) { const top = g.userData.top || 1;
        if (t.el === 'ember' && rnd() < dt * 14) glow.add(t.x + (rnd() - 0.5) * 0.15, top + 0.35, t.z + (rnd() - 0.5) * 0.15, (rnd() - 0.5) * 0.2, 0.9 + rnd() * 0.5, (rnd() - 0.5) * 0.2, 0.6, 0.16, 0.02, hdr(E.ember[0], 2.2), 1, 0, 0, 0.5);
        if (t.el === 'storm' && rnd() < dt * 1.5) { const a = rnd() * 6.28; bolt(t.x, top + 0.3, t.z, t.x + Math.cos(a) * 0.35, top + 0.1 + rnd() * 0.3, t.z + Math.sin(a) * 0.35, E.storm[0], 0.5); }
        if (t.el === 'void' && rnd() < dt * 4) glow.add(t.x + (rnd() - 0.5) * 0.6, top + rnd() * 0.5, t.z + (rnd() - 0.5) * 0.6, 0, 0.3, 0, 1, 0.08, 0.01, hdr(E.void[0], 2), 1, 0);
        if (t.el === 'grove' && rnd() < dt * 2) dust.add(t.x + (rnd() - 0.5) * 0.5, top + 0.2, t.z + (rnd() - 0.5) * 0.5, (rnd() - 0.5) * 0.3, -0.3, (rnd() - 0.5) * 0.3, 2, 0.06, 0.05, lin(0x9CC85A), 0.9, 0);
        if (t.tier === 4 && rnd() < dt * 8) glow.add(t.x + (rnd() - 0.5) * 0.8, top + rnd() * 0.8, t.z + (rnd() - 0.5) * 0.8, 0, 0.4, 0, 1, 0.07, 0.01, hdr(lin(0xF2C94C), 3), 1, 0);
      }
      if (rnd() < dt * 7) { const x = rnd() * 22, z = rnd() * 14; glow.add(x, 0.3 + rnd() * 1.2, z, (rnd() - 0.5) * 0.2, 0.05, (rnd() - 0.5) * 0.2, 4.5, 0.05, 0.03, hdr(lin(0xF8E8A0), 2.2), 0.9, 0); }
      if (rnd() < dt * 3) { const side = rnd() < 0.5, x = side ? rnd() * 22 : (rnd() < 0.5 ? -1.5 : 23.5), z = side ? (rnd() < 0.5 ? -1.6 : 15.6) : rnd() * 14;
        dust.add(x, 2.6, z, (rnd() - 0.5) * 0.4, -0.35, (rnd() - 0.5) * 0.4, 6, 0.07, 0.07, lin([0x8AA848, 0xC89A3A, 0xB86A2E][(rnd() * 3) | 0]), 1, 0.6); }
      const P = R.portal; if (P && rnd() < dt * 20) { const a = rnd() * 6.28; glow.add(P.position.x + Math.cos(a) * 0.05, 1.0 + Math.sin(a) * 1.0, P.position.z + Math.cos(a) * 0.9, 0.6, 0.1, 0, 0.9, 0.1, 0.01, hdr(lin(0xA060FF), 2.5), 1, 0); }
      const V = R.vault; if (V && rnd() < dt * 10) glow.add(V.position.x + (rnd() - 0.5) * 1.4, 0.4, V.position.z + (rnd() - 0.5) * 1.4, 0, 0.9, 0, 1.6, 0.08, 0.02, hdr(lin(0x7FE8DC), 2.2), 1, 0);
    },
    update(dt) {
      for (const k in PM) PM[k].n = 0;
      for (let k = 0; k < proj.length; k++) { const p = proj[k]; p.t += dt; const f = Math.min(1, p.t / p.dur); const [c1, c2] = E[p.el];
        const x = p.x0 + (p.x1 - p.x0) * f, z = p.z0 + (p.z1 - p.z0) * f, y = p.y0 + (p.y1 - p.y0) * f + (p.lob ? Math.sin(f * Math.PI) * 1.8 : 0);
        const big = (p.arch === 'heavy' ? 1.6 : p.arch === 'rapid' ? 0.65 : p.arch === 'sniper' ? 1.2 : 1) * (1 + p.tier * 0.08);
        // the projectile itself: a real model, flying nose-first (void shards spin, cannonballs and pods tumble)
        const P = p.kind && PM[p.kind]; if (P && P.n < 256) { pdir.set(x - p.px, y - p.py, z - p.pz); if (pdir.lengthSq() < 1e-8) pdir.set(p.x1 - p.x0, 0, p.z1 - p.z0); pdir.normalize();
          p.roll += dt * (p.kind === 'shard' ? 14 : p.kind === 'seedpod' || p.kind === 'magma' || p.kind === 'cannonball' ? 7 : p.kind === 'arrow' ? 0 : 5);
          pq.setFromUnitVectors(ZF, pdir); pq2.setFromAxisAngle(ZF, p.roll); pq.multiply(pq2); const sc = big * (p.crit ? 1.35 : 1) * (p.arch === 'sniper' && p.kind !== 'magma' ? 1.25 : 1);
          pm4.compose(pv.set(x, y, z), pq, psc.set(sc, sc, sc * (p.arch === 'sniper' ? 1.35 : 1))); P.im.setMatrixAt(P.n++, pm4); }
        glow.add(x, y, z, 0, 0, 0, 0.03, 0.5 * big * (p.crit ? 1.5 : 1), 0.42 * big, hdr(c2, 1.6), 0.9, 0.6);         // hot halo
        const steps = cut >= 2 ? 1 : 4;
        for (let s = 0; s < steps; s++) { const g = s / steps, tx = p.px + (x - p.px) * g, ty = p.py + (y - p.py) * g, tz = p.pz + (z - p.pz) * g, jr = (Math.random() - 0.5), jz = (Math.random() - 0.5);
          if (p.el === 'iron') { dust.add(tx, ty, tz, jr * 0.1, 0.15, jz * 0.1, p.arch === 'heavy' ? 0.7 : 0.35, 0.08 * big, 0.3 * big, lin(p.arch === 'heavy' ? 0x5A5654 : 0x9A948C), p.arch === 'heavy' ? 0.5 : 0.3, 0); continue; }
          glow.add(tx, ty, tz, jr * 0.3, (p.el === 'ember' ? 0.6 : 0), jz * 0.3, p.el === 'tide' ? 0.3 : 0.42, 0.3 * big, 0.03, hdr(c1, 1.9), 0.9, 0);
          if (p.el === 'ember' && cut < 2 && s === 0) dust.add(tx, ty, tz, jr * 0.2, 0.5, jz * 0.2, 0.8, 0.1 * big, 0.36 * big, lin(0x3A3230), 0.35, 0, -0.3, 1);          // smoke
          if ((p.el === 'tide' || p.el === 'void') && cut < 2 && s === 0) glow.add(tx + jr * 0.2, ty + jz * 0.2, tz, jr, jz, jr, 0.5, 0.07, 0.01, hdr(c2, 3), 1, 0);  // sparkles
          if (p.el === 'grove' && cut < 2 && s === 0 && Math.random() < 0.4) dust.add(tx, ty, tz, jr, 0.3, jz, 0.9, 0.06, 0.05, lin(0x7CB84A), 1, 0, 2, 1); }            // leaves
        p.px = x; p.py = y; p.pz = z;
        if (f >= 1) { impact(p.x1, p.y1, p.z1, p.el, big, p.crit, p.arch); proj[k] = proj[proj.length - 1]; proj.pop(); k--; } }
      for (const k in PM) { const P = PM[k]; P.im.count = P.n; P.im.instanceMatrix.needsUpdate = true; }
      glow.update(dt); dust.update(dt);
    },
    clear() { proj.length = 0; glow.clear(); dust.clear(); for (const k in PM) PM[k].im.count = 0; },
    count() { return proj.length + glow.n + dust.n; },
  };
  function flash(x, y, z, c, s) { glow.add(x, y, z, 0, 0, 0, 0.14, s, s * 1.6, hdr(c, 2.5), 1, 0); }
  function impact(x, y, z, el, big, crit, arch) { const [c1, c2] = E[el]; flash(x, y, z, c2, 0.7 * big * (crit ? 1.8 : 1)); flash(x, y, z, c1, 1.1 * big);
    if (cut >= 2) return; const n = (crit ? 14 : 7) + (arch === 'heavy' ? 10 : 0);
    for (let k = 0; k < n; k++) { const a = rnd() * 6.28, s = (1.2 + rnd() * 1.8) * (arch === 'heavy' ? 1.4 : 1); glow.add(x, y, z, Math.cos(a) * s, 0.4 + rnd() * 1.8, Math.sin(a) * s, 0.32, 0.14 * big, 0.02, hdr(c1, 2.5), 1, 0, 4, 2); }
    if (arch === 'heavy') { const gy = R.groundY ? R.groundY(x, z) + 0.08 : 0.08; for (let k = 0; k < 20; k++) { const a = k / 20 * 6.28; glow.add(x, gy, z, Math.cos(a) * 3.2, 0.1, Math.sin(a) * 3.2, 0.35, 0.16, 0.05, hdr(c1, 2.2), 1, 0, 0, 3); }
      for (let k = 0; k < 8; k++) dust.add(x, gy + 0.1, z, (rnd() - 0.5) * 2.4, 0.6 + rnd(), (rnd() - 0.5) * 2.4, 0.9, 0.2, 0.7, lin(el === 'iron' ? 0x6A625A : 0x9A8A7A), 0.45, 0, 1.5, 2); }
    if (el === 'grove') for (let k = 0; k < 5; k++) dust.add(x, y, z, (rnd() - 0.5) * 2, rnd() * 1.5, (rnd() - 0.5) * 2, 0.6, 0.08, 0.06, lin(0x6A9A3A), 1, 0, 5, 1);
    if (el === 'tide') for (let k = 0; k < 6; k++) glow.add(x, y, z, (rnd() - 0.5) * 2.4, 1 + rnd() * 1.5, (rnd() - 0.5) * 2.4, 0.5, 0.07, 0.02, hdr(lin(0xE8FCFF), 2.4), 1, 0, 6, 1); }
  function bolt(x0, y0, z0, x1, y1, z1, c, w) { // jagged lightning built from glow particles
    const L = Math.hypot(x1 - x0, y1 - y0, z1 - z0), n = Math.max(3, Math.floor(L / 0.25)); let px = x0, py = y0, pz = z0;
    for (let k = 1; k <= n; k++) { const f = k / n, j = k < n ? 0.2 : 0; const nx = x0 + (x1 - x0) * f + (rnd() - 0.5) * j * 2, ny = y0 + (y1 - y0) * f + (rnd() - 0.5) * j * 2, nz = z0 + (z1 - z0) * f + (rnd() - 0.5) * j * 2;
      for (let s = 0; s < 3; s++) { const g = s / 3; glow.add(px + (nx - px) * g, py + (ny - py) * g, pz + (nz - pz) * g, 0, 0, 0, 0.16, 0.13 * w, 0.06 * w, hdr(c, 3.5), 1, 0); }
      if (w > 1 && cut < 2 && rnd() < 0.25) { const bx = nx + (rnd() - 0.5) * 0.5, by = ny + (rnd() - 0.5) * 0.4, bz = nz + (rnd() - 0.5) * 0.5; for (let s = 1; s <= 3; s++) glow.add(nx + (bx - nx) * s / 3, ny + (by - ny) * s / 3, nz + (bz - nz) * s / 3, 0, 0, 0, 0.12, 0.07 * w, 0.03, hdr(c, 3), 1, 0); }
      px = nx; py = ny; pz = nz; } }
  return fx;
};
})();
