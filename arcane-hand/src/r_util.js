/* Arcane Hand — rendering utilities (procedural art kit). No simulation access. */
(function () {
'use strict';
const R = (globalThis.AHR = globalThis.AHR || {});

// ---------- colour: authored as sRGB hex, rendered in linear space
R.lin = (hex) => new THREE.Color(hex).convertSRGBToLinear();

// ---------- deterministic cosmetic random + tileable value noise
R.rand = (seed) => { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
R.noise2 = function (seed, period) {
  const r = R.rand(seed), P = period, g = new Float32Array(P * P); for (let i = 0; i < g.length; i++) g[i] = r();
  const sm = (t) => t * t * (3 - 2 * t);
  return (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi);
    const a = ((xi % P) + P) % P, b = ((yi % P) + P) % P, a1 = (a + 1) % P, b1 = (b + 1) % P;
    const v00 = g[b * P + a], v10 = g[b * P + a1], v01 = g[b1 * P + a], v11 = g[b1 * P + a1];
    return (v00 + (v10 - v00) * xf) + ((v01 + (v11 - v01) * xf) - (v00 + (v10 - v00) * xf)) * yf; };
};
R.fbm = (n, x, y, oct = 4) => { let a = 0, amp = 0.5, f = 1, t = 0; for (let o = 0; o < oct; o++) { a += amp * n(x * f, y * f); t += amp; amp *= 0.5; f *= 2; } return a / t; };
// smooth, non-periodic noise for world-space use
const WN = R.noise2(777, 256);
R.wnoise = (x, z, oct = 3) => R.fbm(WN, x, z, oct);

// ---------- procedural textures (hand-painted feel: layered noise + strokes). Returns THREE.Texture (sRGB).
function texFrom(canvas, repeat = 1, srgb = true) {
  const t = new THREE.CanvasTexture(canvas); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat);
  t.anisotropy = 4; if (srgb) t.encoding = THREE.sRGBEncoding; return t;
}
function normalFromHeight(h, S, strength = 2.0) {
  const c = document.createElement('canvas'); c.width = c.height = S; const ctx = c.getContext('2d'), img = ctx.createImageData(S, S), d = img.data;
  const H = (x, y) => h[((y + S) % S) * S + ((x + S) % S)];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength, l = Math.hypot(dx, dy, 1), i = (y * S + x) * 4;
    d[i] = (-dx / l * 0.5 + 0.5) * 255; d[i + 1] = (dy / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0); return texFrom(c, 1, false);
}
function painter(S, fn) { // fn(x,y) -> [r,g,b,height]
  const c = document.createElement('canvas'); c.width = c.height = S; const ctx = c.getContext('2d'), img = ctx.createImageData(S, S), d = img.data, h = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const [r, g, b, hh] = fn(x, y), i = (y * S + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; h[y * S + x] = hh || 0; }
  ctx.putImageData(img, 0, 0); return { canvas: c, ctx, h };
}
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = (v) => v < 0 ? 0 : v > 1 ? 1 : v;

R.textures = function (quality) {
  const S = quality === 'low' ? 256 : 512, k = S / 512;
  const out = {};
  // grass: layered greens, painted blade strokes, a few flowers
  { const n1 = R.noise2(11, 8), n2 = R.noise2(12, 32), n3 = R.noise2(13, 128);
    const p = painter(S, (x, y) => { const u = x / S, v = y / S;
      const a = R.fbm(n1, u * 8, v * 8, 2), b = n2(u * 32, v * 32), c = n3(u * 128, v * 128);
      let col = mixc([30, 48, 30], [58, 84, 44], clamp01(a * 1.3 - 0.15)); col = mixc(col, [58, 74, 38], clamp01((b - 0.6) * 2) * 0.5);
      const s = 0.85 + c * 0.3; return [col[0] * s, col[1] * s, col[2] * s, a * 0.5 + c * 0.5]; });
    const r = R.rand(5), ctx = p.ctx; ctx.lineCap = 'round';
    for (let i = 0; i < 2600 * k * k * 4; i++) { const x = r() * S, y = r() * S, l = (3 + r() * 6) * k, a = -Math.PI / 2 + (r() - 0.5) * 0.9, g = 90 + r() * 90;
      ctx.strokeStyle = `rgba(${g * 0.3 | 0},${g * 0.52 | 0},${g * 0.24 | 0},${0.12 + r() * 0.22})`; ctx.lineWidth = (0.8 + r()) * k;
      for (const ox of [0, S, -S]) for (const oy of [0, S, -S]) { ctx.beginPath(); ctx.moveTo(x + ox, y + oy); ctx.lineTo(x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l); ctx.stroke(); } }
    for (let i = 0; i < 40; i++) { const x = r() * S, y = r() * S; ctx.fillStyle = ['#F4E7A0', '#E8B8D8', '#FFFFFF', '#B8D8F4'][i % 4]; ctx.beginPath(); ctx.arc(x, y, 1.3 * k, 0, 7); ctx.fill(); }
    out.grass = texFrom(p.canvas); }
  // dirt path: warm earth, pebbles, cart ruts
  { const n1 = R.noise2(21, 8), n2 = R.noise2(22, 64);
    const p = painter(S, (x, y) => { const u = x / S, v = y / S, a = R.fbm(n1, u * 8, v * 8, 3), b = n2(u * 64, v * 64);
      const col = mixc([40, 36, 34], [82, 72, 64], clamp01(a * 1.4 - 0.2)); const s = 0.88 + b * 0.24; return [col[0] * s, col[1] * s, col[2] * s, a]; });
    const r = R.rand(7), ctx = p.ctx;
    for (let i = 0; i < 700 * k * k * 4; i++) { const x = r() * S, y = r() * S, rr = (1 + r() * 3.2) * k, g = 62 + r() * 45;
      ctx.fillStyle = `rgba(40,30,20,0.35)`; ctx.beginPath(); ctx.ellipse(x + 0.8 * k, y + 0.8 * k, rr, rr * 0.75, 0, 0, 7); ctx.fill();
      ctx.fillStyle = `rgb(${g | 0},${g * 0.92 | 0},${g * 0.8 | 0})`; ctx.beginPath(); ctx.ellipse(x, y, rr, rr * 0.75, r() * 3, 0, 7); ctx.fill(); }
    out.dirt = texFrom(p.canvas); }
  // riverbed sand
  { const n1 = R.noise2(31, 16);
    const p = painter(S, (x, y) => { const a = R.fbm(n1, x / S * 16, y / S * 16, 3); const col = mixc([62, 58, 50], [104, 96, 80], a); return [...col, a]; });
    out.sand = texFrom(p.canvas); }
  // rock / cliff
  { const n1 = R.noise2(41, 8), n2 = R.noise2(42, 32);
    const p = painter(S, (x, y) => { const u = x / S, v = y / S, a = R.fbm(n1, u * 8, v * 8, 4), b = n2(u * 32, v * 32);
      const col = mixc([46, 48, 54], [98, 98, 104], clamp01(a * 1.5 - 0.25)); const s = 0.8 + b * 0.4; return [col[0] * s, col[1] * s, col[2] * s, a]; });
    out.rock = texFrom(p.canvas); }
  // dressed stone bricks (towers, walls) + normal map
  { const Sb = S, rows = 8, cols = 4, r = R.rand(9), n1 = R.noise2(51, 64);
    const brick = new Float32Array(rows * cols * 2).map(() => r());
    const p = painter(Sb, (x, y) => { const v = y / Sb * rows, row = Math.floor(v), off = (row % 2) * 0.5, u = x / Sb * cols + off, col = Math.floor(u) % cols;
      const fu = u - Math.floor(u), fv = v - row, edge = Math.min(fu, 1 - fu, (fv) * 2, (1 - fv) * 2) * 8;
      const mortar = clamp01(edge * 3.2 - 0.15); const t = brick[row * cols + col], nz = n1(x / Sb * 64, y / Sb * 64);
      const base = mixc([112, 110, 108], [158, 154, 148], t); const shade = 0.82 + nz * 0.3 - (1 - clamp01(edge)) * 0.25;
      const c = mixc([72, 66, 60], [base[0] * shade, base[1] * shade, base[2] * shade], mortar); return [c[0], c[1], c[2], mortar * (0.8 + nz * 0.2)]; });
    out.brick = texFrom(p.canvas); out.brickN = normalFromHeight(p.h, Sb, 3.0); }
  // roof shingles
  { const rows = 12, n1 = R.noise2(61, 32), r = R.rand(3); const sh = new Float32Array(rows * 16).map(() => r());
    const p = painter(S, (x, y) => { const v = y / S * rows, row = Math.floor(v), off = (row % 2) * 0.5, u = x / S * 8 + off, cc = Math.floor(u), fu = u - cc, fv = v - row;
      const curve = Math.sqrt(clamp01(1 - Math.pow((fu - 0.5) * 2, 2))) * 0.35; const edge = clamp01((1 - fv - curve) * 6);
      const t = sh[(row * 16 + ((cc % 16) + 16) % 16)], nz = n1(x / S * 32, y / S * 32); const g = (0.6 + t * 0.3 + nz * 0.15) * (0.55 + 0.45 * edge);
      return [230 * g, 230 * g, 230 * g, edge]; });
    out.shingle = texFrom(p.canvas); out.shingleN = normalFromHeight(p.h, S, 2.0); }
  // wood planks
  { const n1 = R.noise2(71, 64), n2 = R.noise2(72, 8);
    const p = painter(S, (x, y) => { const u = x / S * 5, pl = Math.floor(u), fu = u - pl, grain = n1(x / S * 6, y / S * 64 + pl * 13), knot = n2(x / S * 8, y / S * 8);
      const edge = clamp01(Math.min(fu, 1 - fu) * 20); const t = 0.6 + grain * 0.35 + (pl % 2) * 0.06 - knot * 0.1; return [150 * t * (0.5 + 0.5 * edge), 104 * t * (0.5 + 0.5 * edge), 66 * t * (0.5 + 0.5 * edge), edge]; });
    out.wood = texFrom(p.canvas); }
  // bark
  { const n1 = R.noise2(81, 16);
    const p = painter(S, (x, y) => { const g = R.fbm(n1, x / S * 16, y / S * 4, 3); const t = 0.45 + g * 0.6; return [112 * t, 82 * t, 58 * t, g]; });
    out.bark = texFrom(p.canvas); out.barkN = normalFromHeight(p.h, S, 3.0); }
  // soft particle sprite + grass blade card
  { const c = document.createElement('canvas'); c.width = c.height = 64; const ctx = c.getContext('2d'); const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    out.soft = new THREE.CanvasTexture(c); }
  { const c = document.createElement('canvas'); c.width = 64; c.height = 64; const ctx = c.getContext('2d'); const r = R.rand(4);
    for (let i = 0; i < 14; i++) { const x = 6 + r() * 52, h = 30 + r() * 32, lean = (r() - 0.5) * 16, gg = 120 + r() * 100;
      ctx.fillStyle = `rgb(${gg * 0.55 | 0},${gg | 0},${gg * 0.35 | 0})`; ctx.beginPath(); ctx.moveTo(x - 2.5, 64); ctx.quadraticCurveTo(x + lean * 0.3, 64 - h * 0.6, x + lean, 64 - h); ctx.quadraticCurveTo(x + lean * 0.3 + 1, 64 - h * 0.6, x + 2.5, 64); ctx.fill(); }
    out.blades = new THREE.CanvasTexture(c); out.blades.encoding = THREE.sRGBEncoding; }
  // soft rounded tile mask (placement highlight)
  { const c = document.createElement('canvas'); c.width = c.height = 64; const ctx = c.getContext('2d');
    ctx.strokeStyle = 'rgba(255,255,255,1)'; ctx.lineWidth = 5; ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(5, 5, 54, 54, 10) : ctx.rect(5, 5, 54, 54); ctx.fill(); ctx.stroke(); out.tile = new THREE.CanvasTexture(c); }
  // lava cracks (emissive map for Ember basalt): dark with branching glowing fissures
  { const c = document.createElement('canvas'); c.width = c.height = 256; const ctx = c.getContext('2d'); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 256, 256);
    const r = R.rand(33); ctx.lineCap = 'round';
    for (let k = 0; k < 16; k++) { let x = r() * 256, y = r() * 256, a = r() * 6.28; ctx.strokeStyle = `rgba(255,${120 + r() * 80 | 0},40,1)`;
      for (let s = 0; s < 14; s++) { const nx = x + Math.cos(a) * 14, ny = y + Math.sin(a) * 14; ctx.lineWidth = 3 - s * 0.18;
        for (const ox of [0, 256, -256]) for (const oy of [0, 256, -256]) { ctx.beginPath(); ctx.moveTo(x + ox, y + oy); ctx.lineTo(nx + ox, ny + oy); ctx.stroke(); }
        x = nx; y = ny; a += (r() - 0.5) * 1.3; } }
    out.cracks = texFrom(c); }
  // rune circle (ground decal under every tower, tinted by element)
  { const c = document.createElement('canvas'); c.width = c.height = 256; const ctx = c.getContext('2d'); ctx.translate(128, 128); ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff';
    ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, 118, 0, 7); ctx.stroke(); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 100, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 70, 0, 7); ctx.stroke();
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 70, Math.sin(a) * 70); ctx.lineTo(Math.cos(a + 2.094) * 70, Math.sin(a + 2.094) * 70); ctx.stroke(); }
    const r = R.rand(8); ctx.font = 'bold 16px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let k = 0; k < 18; k++) { const a = k / 18 * Math.PI * 2; ctx.save(); ctx.rotate(a); ctx.translate(0, -109); ctx.fillText('ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒ'[k], 0, 0); ctx.restore(); }
    out.rune = new THREE.CanvasTexture(c); }
  // rune strip (emissive band around tower bodies)
  { const c = document.createElement('canvas'); c.width = 512; c.height = 64; const ctx = c.getContext('2d'); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 512, 64);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 6, 512, 3); ctx.fillRect(0, 55, 512, 3); ctx.font = 'bold 34px serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    const g = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ'; for (let k = 0; k < 16; k++) ctx.fillText(g[(k * 7) % g.length], 16 + k * 32, 33);
    out.runeStrip = texFrom(c); out.runeStrip.repeat.set(2, 1); }
  return out;
};

// ---------- geometry kit: build models from primitives, bake colour / AO / animation tags, merge to one draw
// part: { g, m (Matrix4), c (hex or THREE.Color), limb, pivot [x,y,z], glow, ao: [ymin,ymax] }
// extra: also bake a two-tone surface pattern per part — pat: [type, scale, strength], c2: secondary colour
//   (1 stripes, 2 spots, 3 scales, 4 belly/back gradient, 5 glowing veins, 6 mottle, 7 rings) — see R.PATTERN_GLSL
R.merge = function (parts, { flat = false, extra = false } = {}) {
  let n = 0; const gs = parts.map(p => { let g = p.g.index ? p.g.toNonIndexed() : p.g.clone(); if (flat) g.computeVertexNormals(); n += g.attributes.position.count; return g; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), uv = new Float32Array(n * 2), limb = new Float32Array(n), piv = new Float32Array(n * 3), glow = new Float32Array(n), matA = new Float32Array(n * 2);
  const pat = extra ? new Float32Array(n * 3) : null, col2 = extra ? new Float32Array(n * 3) : null;
  const v = new THREE.Vector3(), nm = new THREE.Matrix3(); let o = 0;
  parts.forEach((p, k) => { const g = gs[k], P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, m = p.m || new THREE.Matrix4();
    nm.getNormalMatrix(m); const c = p.c instanceof THREE.Color ? p.c : R.lin(p.c == null ? 0xffffff : p.c);
    const c2 = extra && p.pat ? (p.c2 instanceof THREE.Color ? p.c2 : R.lin(p.c2 == null ? 0x000000 : p.c2)) : null;
    for (let i = 0; i < P.count; i++, o++) {
      v.fromBufferAttribute(P, i).applyMatrix4(m); pos.set([v.x, v.y, v.z], o * 3);
      const ao = p.ao ? 0.55 + 0.45 * Math.min(1, Math.max(0, (v.y - p.ao[0]) / (p.ao[1] - p.ao[0]))) : 1;
      col.set([c.r * ao, c.g * ao, c.b * ao], o * 3);
      v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nor.set([v.x, v.y, v.z], o * 3);
      if (U) uv.set([U.getX(i) * (p.uvs || 1), U.getY(i) * (p.uvt || p.uvs || 1)], o * 2);
      limb[o] = p.limb || 0; if (p.pivot) piv.set(p.pivot, o * 3); glow[o] = p.glow || 0; matA[o * 2] = p.r != null ? p.r : 0.72; matA[o * 2 + 1] = p.mt || 0;
      if (c2) { pat.set(p.pat, o * 3); col2.set([c2.r * ao, c2.g * ao, c2.b * ao], o * 3); }
    } });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setAttribute('aLimb', new THREE.BufferAttribute(limb, 1)); out.setAttribute('aPivot', new THREE.BufferAttribute(piv, 3)); out.setAttribute('aGlow', new THREE.BufferAttribute(glow, 1)); out.setAttribute('aMat', new THREE.BufferAttribute(matA, 2));
  if (extra) { out.setAttribute('aPat', new THREE.BufferAttribute(pat, 3)); out.setAttribute('aCol2', new THREE.BufferAttribute(col2, 3)); }
  out.computeBoundingSphere(); return out;
};
// procedural two-tone surface patterns, evaluated in model space so they stick to animated parts.
// needs dNoise(vec3) in scope; returns x = secondary-colour mix, y = emissive mask
R.PATTERN_GLSL = `vec2 surfPattern(vec3 p, vec3 n, vec3 pat){ float t = floor(pat.x + 0.5), s = pat.y, k = pat.z, m = 0., e = 0.;
    if (t == 1.) m = smoothstep(0.35, 0.6, sin(p.z * s + dNoise(p * 6.) * 2.2) * 0.5 + 0.5);                               // stripes (across the body)
    else if (t == 2.) m = smoothstep(0.6, 0.68, dNoise(p * s));                                                             // spots
    else if (t == 3.) { vec2 q = vec2(p.x * 1.15 + p.y * 0.4, p.z + p.y * 0.6) * s; q.x += mod(floor(q.y), 2.) * 0.5; vec2 f = fract(q) - 0.5;
      m = smoothstep(0.28, 0.46, length(f * vec2(1., 1.4))); }                                                              // scales / cells: dark rims
    else if (t == 4.) m = smoothstep(0.35, -0.35, n.y + (p.y - s) * 1.5);                                                   // belly (underside) tone
    else if (t == 5.) { float v = abs(dNoise(p * s) - 0.5); m = 1. - smoothstep(0.02, 0.06, v); e = m; }                    // glowing veins / cracks
    else if (t == 6.) m = smoothstep(0.3, 0.75, dNoise(p * s) * 0.7 + dNoise(p * s * 2.7) * 0.3);                          // mottle
    else if (t == 7.) m = smoothstep(0.55, 0.7, sin(p.y * s) * 0.5 + 0.5);                                                  // horizontal rings / bands
    else if (t == 8.) { m = smoothstep(0.55, 0.75, dNoise(p * s)); e = m; }                                                 // glowing freckles
    else if (t == 9.) m = smoothstep(0.35, 0.65, sin(atan(p.x, p.z) * s) * 0.5 + 0.5);                                      // ribs around the model's vertical axis
    else if (t == 10.) { float v = abs(dNoise(p * s) - 0.5); m = 1. - smoothstep(0.02, 0.07, v); }                         // veins (not glowing)
    else if (t == 11.) { m = smoothstep(s, s + 0.07, p.y); e = m; }                                                         // hot / glowing tips above height s
    else if (t == 12.) m = 1. - smoothstep(s * 0.25, s, length(p.xz - vec2(0., 0.02)));                                     // radial: c2 toward the centre (petals)
    return vec2(m * k, e * k); }`;
// tapered tube through points (horns, tails, tentacles, vines); r(t) = r0 -> r1, closed tip when r1 = 0
R.ttube = function (pts, r0, r1, radial = 8, perSeg = 4) {
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), N = Math.max(2, (pts.length - 1) * perSeg);
  const frames = curve.computeFrenetFrames(N, false), P = [], NN = [], UV = [], idx = [], v = new THREE.Vector3(), nrm = new THREE.Vector3();
  for (let i = 0; i <= N; i++) { const t = i / N, c = curve.getPointAt(t), r = r0 + (r1 - r0) * t;
    for (let j = 0; j <= radial; j++) { const a = j / radial * Math.PI * 2, sn = Math.sin(a), cs = -Math.cos(a);
      nrm.set(0, 0, 0).addScaledVector(frames.normals[i], cs).addScaledVector(frames.binormals[i], sn).normalize();
      v.copy(c).addScaledVector(nrm, Math.max(r, 0.0005)); P.push(v.x, v.y, v.z); NN.push(nrm.x, nrm.y, nrm.z); UV.push(j / radial, t); } }
  for (let i = 0; i < N; i++) for (let j = 0; j < radial; j++) { const a = i * (radial + 1) + j, b = a + radial + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(NN, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setIndex(idx); return g;
};
// lathe from [radius, y] pairs (vases, domes, bulbs, helmets, tower drums)
R.lathe = (prof, seg = 16, phi0 = 0, phiL = Math.PI * 2) => { if (prof[0][1] > prof[prof.length - 1][1]) prof = prof.slice().reverse(); // bottom-up keeps faces outward
  const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r), y)), seg, phi0, phiL); g.computeVertexNormals(); return g; };
// multi-colour kit material: per-vertex colour, roughness/metalness (aMat) and glow (aGlow). One draw for many small parts.
R.kitMaterial = function () {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 1 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aMat; attribute float aGlow; varying vec2 vMat; varying float vGlw; varying vec3 vKc;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMat = aMat; vGlw = aGlow; vKc = color.rgb;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vMat; varying float vGlw; varying vec3 vKc;')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vMat.x;').replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vMat.y;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vKc * vGlw * 1.3;
        { float rimF = pow(1. - clamp(dot(normal, normalize(vViewPosition)), 0., 1.), 3.); totalEmissiveRadiance += (diffuseColor.rgb * 0.7 + 0.1) * rimF * 0.3; }`);
  };
  m.customProgramCacheKey = () => 'kit1'; return m;
};
// transform helper: T(x,y,z, rx,ry,rz, sx,sy,sz)
const _e = new THREE.Euler(), _q = new THREE.Quaternion();
R.T = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
// noise-displaced blob (organic foliage / rocks)
R.blob = (detail, amp, seed, flatShade) => { const g = new THREE.IcosahedronGeometry(1, detail); const P = g.attributes.position, v = new THREE.Vector3(); const n = R.noise2(seed, 64);
  const done = new Map();
  for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i); const key = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
    let s = done.get(key); if (s == null) { s = 1 + (R.fbm(n, v.x * 2 + 10, v.y * 2 + v.z * 1.7 + 10, 3) - 0.5) * amp; done.set(key, s); }
    P.setXYZ(i, v.x * s, v.y * s, v.z * s); }
  g.computeVertexNormals(); return flatShade ? g.toNonIndexed() : g; };

// ---------- merge a static hierarchy into one mesh per material (world space); returns the new meshes
R.mergeByMaterial = function (root, parent) {
  root.updateMatrixWorld(true); const groups = new Map();
  root.traverse(o => { if (!o.isMesh) return; const k = o.material.uuid; if (!groups.has(k)) groups.set(k, { mat: o.material, list: [], cast: false }); const gr = groups.get(k); gr.list.push(o); gr.cast = gr.cast || o.castShadow; });
  const out = [];
  for (const [, gr] of groups) { let n = 0; const gs = gr.list.map(o => { const q = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); q.applyMatrix4(o.matrixWorld); n += q.attributes.position.count; return q; });
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2); let o3 = 0, o2 = 0;
    for (const q of gs) { pos.set(q.attributes.position.array, o3); nor.set(q.attributes.normal.array, o3); if (q.attributes.uv) uv.set(q.attributes.uv.array, o2);
      o3 += q.attributes.position.count * 3; o2 += q.attributes.position.count * 2; q.dispose(); }
    const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); mg.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); mg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const m = new THREE.Mesh(mg, gr.mat); m.castShadow = gr.cast; m.receiveShadow = true; if (gr.mat.transparent) m.renderOrder = 3; parent.add(m); out.push(m); }
  // rune strip (emissive band around tower bodies)
  { const c = document.createElement('canvas'); c.width = 512; c.height = 64; const ctx = c.getContext('2d'); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 512, 64);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 6, 512, 3); ctx.fillRect(0, 55, 512, 3); ctx.font = 'bold 34px serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    const g = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ'; for (let k = 0; k < 16; k++) ctx.fillText(g[(k * 7) % g.length], 16 + k * 32, 33);
    out.runeStrip = texFrom(c); out.runeStrip.repeat.set(2, 1); }
  return out;
};
// ---------- stylized rim light (keeps silhouettes crisp against the ground); composes with any prior patch
R.rim = function (mat, k = 0.35) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => { if (prev) prev(sh, r);
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      { float rimF = pow(1. - clamp(dot(normal, normalize(vViewPosition)), 0., 1.), 3.); totalEmissiveRadiance += (diffuseColor.rgb * 0.7 + 0.12) * rimF * ${k.toFixed(2)}; }`); };
  const pk = mat.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : () => '';
  mat.customProgramCacheKey = () => pk() + 'rim' + k; return mat;
};
// ---------- environment map for image-based light (sky gradient + sun), generated once
R.envMap = function (renderer) {
  const s = new THREE.Scene();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, uniforms: {},
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `varying vec3 vP;
${R.SKY_GLSL}
void main(){ vec3 c = skyCol(normalize(vP), 0., 0.) * 1.6 + vec3(0.02, 0.025, 0.04);
      gl_FragColor = vec4(c, 1.);
      #include <encodings_fragment>
    }` }));
  s.add(sky); const pm = new THREE.PMREMGenerator(renderer); const rt = pm.fromScene(s, 0.02); pm.dispose(); return rt.texture;
};
})();
