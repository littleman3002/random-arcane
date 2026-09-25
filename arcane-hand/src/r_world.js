/* Arcane Hand — world: terrain (splat-textured heightfield), river, vegetation, props, plot wall, bridges, portal, vault. */
(function () {
'use strict';
const R = globalThis.AHR;
const lin = R.lin;

// shared animation clock for every custom shader
R.clock = { value: 0 };
// helper to inject into built-in materials while keeping three's lighting, shadows and fog
R.patch = function (mat, { vars = '', begin = '', frag = '', fragVars = '', fragColor = '', uniforms = {} }) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms, { uTime: R.clock });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\nuniform float uTime;\n${vars}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${begin}`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nuniform float uTime;\n${fragVars}`);
    if (frag) sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', frag);
    if (fragColor) sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${fragColor}`);
  };
  mat.customProgramCacheKey = () => 'ah' + (vars + begin + frag + fragColor).length + mat.type;
  return mat;
};

R.buildWorld = function (world, map, tex, Q) {
  const { W, H, kind } = map, RX = map.riverX;
  const isPath = (x, z) => x >= 0 && z >= 0 && x < W && z < H && (kind[z * W + x] === 1 || kind[z * W + x] === 3);
  // ---------- masks (signed distance to path / river tiles)
  function pathMask(x, z) { let md = 9; const tx = Math.floor(x), tz = Math.floor(z);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const a = tx + dx, b = tz + dz; if (!isPath(a, b) || a === RX) continue;
      const ex = Math.max(a - x, 0, x - (a + 1)), ez = Math.max(b - z, 0, z - (b + 1)); md = Math.min(md, Math.hypot(ex, ez)); }
    // the spawn lane continues off the plot to the portal
    if (z > 1 && z < 2 && x < 0 && x > -2.2) md = 0;
    return 1 - smooth(0.0, 0.2, md); }
  function riverDist(x) { return Math.abs(x - (RX + 0.5)); }
  function smooth(a, b, v) { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); }
  function outside(x, z) { return Math.max(-x - 0.6, x - W - 0.6, -z - 0.6, z - H - 0.6, 0); }
  function height(x, z) {
    let h = 0; const o = outside(x, z);
    h -= 0.09 * pathMask(x, z);
    const rd = riverDist(x); if (rd < 0.8) h -= 0.85 * (1 - smooth(0.3, 0.78, rd));
    if (o > 0) h += smooth(0.8, 9, o) * (0.8 + R.wnoise(x * 0.12, z * 0.12) * 2.2) + (R.wnoise(x * 0.5, z * 0.5) - 0.5) * 0.25 * smooth(0, 2, o);
    return h;
  }
  R.groundY = (x, z) => { const u = x - (RX + 0.5); if (Math.abs(u) < R.RIVER.span && isPath(RX, Math.floor(z))) return R.deckY(u); return height(x, z); }; // walkers follow the bridge arch

  // ---------- terrain mesh
  const PAD = 10, SEG = Q === 'low' ? 2 : 4, GW = W + PAD * 2, GH = H + PAD * 2;
  const g = new THREE.PlaneGeometry(GW, GH, GW * SEG, GH * SEG); g.rotateX(-Math.PI / 2); g.translate(W / 2, 0, H / 2);
  const P = g.attributes.position, n = P.count, splat = new Float32Array(n * 4), col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const x = P.getX(i), z = P.getZ(i), h = height(x, z); P.setY(i, h);
    const pm = pathMask(x, z), rd = riverDist(x), o = outside(x, z);
    let dirt = pm, sand = rd < 0.85 ? 1 - smooth(0.45, 0.85, rd) : 0, rock = o > 0 ? smooth(1.0, 2.5, o) * smooth(0.55, 0.8, R.wnoise(x * 0.3, z * 0.3)) * 0.8 : 0;
    const wn = R.wnoise(x * 0.8 + 3, z * 0.8);
    dirt = Math.min(1, dirt * (0.85 + wn * 0.3)); sand = Math.min(1, sand);
    let grass = Math.max(0, 1 - dirt - sand - rock);
    const s = grass + dirt + sand + rock; splat.set([grass / s, dirt / s, rock / s, sand / s], i * 4);
    // tint: forest floor darker, plot slightly lighter, AO near path edges and water
    let t = o > 0 ? 0.62 + 0.25 * R.wnoise(x * 0.2, z * 0.2) : 0.95 + 0.1 * wn;
    t *= 1 - 0.18 * pm * (1 - pm) * 4 * 0.5; t *= rd < 1 ? 0.8 + 0.2 * smooth(0.4, 1.0, rd) : 1;
    col.set([t, t, t], i * 3);
  }
  g.setAttribute('aSplat', new THREE.BufferAttribute(splat, 4)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const tm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, bumpMap: tex.dirt, bumpScale: Q === 'low' ? 0.0 : 0.035 });
  R.patch(tm, {
    vars: 'attribute vec4 aSplat; varying vec4 vSplat; varying vec2 vW;',
    begin: 'vSplat = aSplat; vW = position.xz;',
    fragVars: 'varying vec4 vSplat; varying vec2 vW; uniform sampler2D tG, tD, tR, tS; uniform float uGrid; vec3 dec(vec3 c){ return pow(c, vec3(2.2)); }',
    frag: `vec2 uvw = vW * 0.3;
      vec3 cg = dec(texture2D(tG, uvw).rgb), cd = dec(texture2D(tD, uvw * 1.3).rgb), cr = dec(texture2D(tR, uvw * 0.8).rgb), cs = dec(texture2D(tS, uvw * 1.5).rgb);
      vec3 cg2 = dec(texture2D(tG, uvw * 0.23 + 0.37).rgb); cg = mix(cg, cg2, 0.35);       // break tiling
      vec4 w = vSplat; float hd = texture2D(tD, uvw * 1.3).g;                               // height-aware blend edge
      w.y = clamp(w.y + (hd - 0.45) * 0.6 * w.y * (1. - w.y) * 4., 0., 1.);
      vec3 alb = cg * w.x + cd * w.y + cr * w.z + cs * w.w; alb /= max(0.001, w.x + w.y + w.z + w.w);
      diffuseColor.rgb *= alb;
      float puddle = smoothstep(0.6, 0.68, texture2D(tS, vW * 0.07 + 0.3).g * 0.6 + texture2D(tS, vW * 0.19).r * 0.4) * smoothstep(0.55, 0.9, w.y);
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.32, 0.34, 0.4), puddle);
      float wetness = w.y * 0.45 + w.w * 0.3;
      { float rd = abs(vW.x - ${RX + 0.5}); float under = 1. - smoothstep(0.3, 0.62, rd);            // caustics on the riverbed
        float cz = sin(vW.x * 11. + uTime * 1.4) + sin(vW.y * 8. - uTime * 1.1) + sin((vW.x + vW.y) * 6. + uTime * 1.7) + sin((vW.x - vW.y) * 9. - uTime);
        diffuseColor.rgb += vec3(0.5, 0.75, 0.8) * pow(max(0., cz) * 0.25, 2.) * under * 0.9; }
      if (uGrid > 0.001 && vW.x > 0. && vW.y > 0. && vW.x < ${W}. && vW.y < ${H}.) { vec2 f = abs(fract(vW) - 0.5); float e = smoothstep(0.455, 0.49, max(f.x, f.y));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.95, 0.7), e * uGrid * 0.5 * (1. - w.y)); }`,
    uniforms: { tG: { value: tex.grass }, tD: { value: tex.dirt }, tR: { value: tex.rock }, tS: { value: tex.sand }, uGrid: R.gridU = { value: 0 } },
  });
  { const prev0 = tm.onBeforeCompile; tm.onBeforeCompile = (sh, r) => { prev0(sh, r);
      sh.fragmentShader = sh.fragmentShader.replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(mix(roughness, 0.55, wetness), 0.05, puddle);'); }; }
  // relief: replace three's bump sampler with one that reads the same blended height the albedo uses
  { const prev = tm.onBeforeCompile; tm.onBeforeCompile = (sh, r) => { prev(sh, r);
      const bump = THREE.ShaderChunk.bumpmap_pars_fragment.replace(/vec2 dHdxy_fwd\(\) \{[\s\S]*?return vec2\( dBx, dBy \);\s*\}/,
        `float hT(vec2 w){ vec4 s = vSplat; return texture2D(tG, w * 0.3).g * s.x * 0.5 + texture2D(tD, w * 0.39).r * s.y * 1.2 + texture2D(tR, w * 0.24).r * s.z * 1.6 + texture2D(tS, w * 0.45).r * s.w * 0.6; }
        vec2 dHdxy_fwd() { vec2 dx = dFdx(vW), dy = dFdy(vW); float h0 = bumpScale * hT(vW); return vec2(bumpScale * hT(vW + dx) - h0, bumpScale * hT(vW + dy) - h0); }`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <bumpmap_pars_fragment>', bump); };
    const pk = tm.customProgramCacheKey; tm.customProgramCacheKey = () => pk() + 'bump'; }
  const terrain = new THREE.Mesh(g, tm); terrain.receiveShadow = true; world.add(terrain);

  const water = null; // river + bridges live in r_river.js

  // ---------- materials shared by props
  const M = R.M = {
    brick: new THREE.MeshStandardMaterial({ map: tex.brick, normalMap: tex.brickN, roughness: 0.88, color: lin(0xE8E0D0) }),
    brickDark: new THREE.MeshStandardMaterial({ map: tex.brick, normalMap: tex.brickN, roughness: 0.8, color: lin(0x5A4E48) }),
    wood: new THREE.MeshStandardMaterial({ map: tex.wood, roughness: 0.85, color: lin(0xD8C8B0) }),
    bark: new THREE.MeshStandardMaterial({ map: tex.bark, normalMap: tex.barkN, roughness: 0.95 }),
    vc: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }),
    leaf: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }),
    rock: new THREE.MeshStandardMaterial({ map: tex.rock, vertexColors: true, roughness: 0.92 }),
  };
  // gentle wind on foliage
  R.patch(M.leaf, { begin: 'vec4 wp = modelMatrix * vec4(0.,0.,0.,1.); \n #ifdef USE_INSTANCING\n wp = modelMatrix * instanceMatrix * vec4(0.,0.,0.,1.);\n #endif\n transformed.x += sin(uTime * 1.3 + wp.x * 0.7 + wp.z * 0.5) * 0.035 * max(0., position.y);' });

  const cast = (m) => { m.castShadow = Q !== 'low'; m.receiveShadow = Q !== 'low'; return m; };
  const instOf = (geo, mat, list, shadow = true) => { const im = new THREE.InstancedMesh(geo, mat, list.length); list.forEach((m, i) => im.setMatrixAt(i, m)); if (shadow) cast(im); world.add(im); return im; };

  // ---------- trees: three species, two variants each, instanced
  const rnd = R.rand(4242);
  const mkPine = (seed) => { const parts = [{ g: new THREE.CylinderGeometry(0.06, 0.11, 0.8, 7), m: R.T(0, 0.4, 0), c: 0x5A3E2A, ao: [0, 0.8] }];
    for (let k = 0; k < 4; k++) { const y = 0.55 + k * 0.42, r = 0.62 - k * 0.13;
      const cone = new THREE.ConeGeometry(r, 0.72, 9, 1); const pp = cone.attributes.position; const nn = R.noise2(seed + k, 16);
      for (let i = 0; i < pp.count; i++) { const x = pp.getX(i), yy = pp.getY(i), z = pp.getZ(i); const s = 1 + (nn(x * 3 + 5, z * 3 + 5) - 0.5) * 0.35; pp.setXYZ(i, x * s, yy - (yy < -0.3 ? (nn(x * 4, z * 4)) * 0.12 : 0), z * s); }
      cone.computeVertexNormals(); parts.push({ g: cone, m: R.T(0, y, 0, 0, k * 0.7), c: k % 2 ? 0x2F5A34 : 0x3A6A3C, ao: [0.3, 2.2] }); }
    return R.merge(parts); };
  const mkOak = (seed) => { const parts = [{ g: new THREE.CylinderGeometry(0.1, 0.16, 0.9, 7), m: R.T(0, 0.45, 0), c: 0x6B4A30, ao: [0, 0.9] },
      { g: new THREE.CylinderGeometry(0.04, 0.07, 0.5, 5), m: R.T(0.18, 0.85, 0, 0, 0, -0.7), c: 0x6B4A30 }];
    const r = R.rand(seed); for (let k = 0; k < 5; k++) { const a = k * 1.3, rr = k === 0 ? 0 : 0.32;
      parts.push({ g: R.blob(1, 0.45, seed + k), m: R.T(Math.cos(a) * rr, 1.15 + r() * 0.3 + (k === 0 ? 0.25 : 0), Math.sin(a) * rr, 0, 0, 0, 0.42 + r() * 0.12), c: [0x4E7A34, 0x5E8A3A, 0x46703A][k % 3], ao: [0.7, 1.8] }); }
    return R.merge(parts); };
  const mkBirch = (seed) => { const parts = [{ g: new THREE.CylinderGeometry(0.05, 0.08, 1.4, 6), m: R.T(0, 0.7, 0), c: 0xE6E0D2, ao: [0, 1.4] }];
    for (let k = 0; k < 3; k++) parts.push({ g: R.blob(1, 0.5, seed + k), m: R.T((k - 1) * 0.12, 1.35 + k * 0.22, (k % 2) * 0.1, 0, 0, 0, 0.3, 0.42, 0.3), c: [0x8AA848, 0x9CB85A, 0x7A9A40][k], ao: [1.0, 2.0] });
    return R.merge(parts); };
  const species = [mkPine(1), mkPine(2), mkOak(3), mkOak(4), mkBirch(5), mkPine(6)];
  const lists = species.map(() => []), farLists = species.map(() => []);
  const occupied = (x, z) => x > -1.3 && z > -1.3 && x < W + 1.3 && z < H + 1.3;
  const count = Q === 'low' ? 160 : 300;
  // far forest toward the mountains (seen at low camera angles)
  const farN = Q === 'low' ? 260 : Q === 'high' ? 1100 : 700;
  for (let k = 0; k < farN; k++) { const a = rnd() * Math.PI * 2, rr = 16 + Math.pow(rnd(), 0.7) * 34; const x = W / 2 + Math.cos(a) * rr, z = H / 2 + Math.sin(a) * rr * 0.9;
    if (Math.abs(x - (RX + 0.5)) < 2 && rnd() < 0.8) continue; const far = Math.hypot(x - W / 2, z - H / 2);
    farLists[rnd() < 0.7 ? (rnd() < 0.5 ? 0 : 1) : 5].push(R.T(x, height(x, z) + Math.max(0, far - 20) * 0.06 - 0.05, z, 0, rnd() * 6.28, 0, 1.1 + rnd() * 1.1)); }
  for (let k = 0; k < count; k++) {
    const x = -PAD + 1 + rnd() * (W + PAD * 2 - 2), z = -PAD + 1 + rnd() * (H + PAD * 2 - 2);
    if (occupied(x, z) || Math.abs(x - (RX + 0.5)) < 1.3 || (x < 0 && z > 0 && z < 3)) continue;
    if (x > W && z > H - 3 && z < H + 1.5) continue; // keep the vault approach open
    const o = outside(x, z); if (o < 0.9 && rnd() < 0.5) continue;
    const s = 0.9 + rnd() * 0.8 + Math.min(0.6, o * 0.08), sp = rnd() < 0.5 ? (rnd() < 0.5 ? 0 : 1) : rnd() < 0.6 ? 2 + (rnd() < 0.5 ? 0 : 1) : (rnd() < 0.5 ? 4 : 5);
    lists[sp].push(R.T(x, height(x, z) - 0.02, z, 0, rnd() * 6.28, 0, s));
  }
  species.forEach((geo, i) => { if (lists[i].length) instOf(geo, M.leaf, lists[i]); if (farLists[i].length) instOf(geo, M.leaf, farLists[i], false); }); // horizon trees: no shadow casting

  // ---------- rocks, stumps, mushrooms, flowers
  const rockG = [R.blob(1, 0.6, 91, true), R.blob(1, 0.7, 92, true)].map(gg => R.merge([{ g: gg, c: 0xB8B2A6, ao: [-0.6, 0.8] }], { flat: true }));
  const rockL = [[], []];
  for (let k = 0; k < (Q === 'low' ? 60 : 130); k++) { const x = -PAD + rnd() * (W + PAD * 2), z = -PAD + rnd() * (H + PAD * 2);
    if (occupied(x, z) && !(outside(x, z) > 0)) { if (rnd() < 0.9) continue; }
    if (x >= -0.2 && z >= -0.2 && x <= W + 0.2 && z <= H + 0.2) continue;
    const s = 0.15 + rnd() * 0.45; rockL[k % 2].push(R.T(x, height(x, z) + s * 0.15, z, rnd(), rnd() * 6, rnd(), s * 1.2, s * 0.8, s)); }
  rockL.forEach((l, i) => instOf(rockG[i], M.rock, l));
  const shroomG = R.merge([{ g: new THREE.CylinderGeometry(0.03, 0.04, 0.12, 6), m: R.T(0, 0.06, 0), c: 0xEDE4D0 },
    { g: new THREE.SphereGeometry(0.08, 8, 5, 0, 6.29, 0, 1.6), m: R.T(0, 0.11, 0, 0, 0, 0, 1, 0.7, 1), c: 0xC4452E }]);
  const flowerG = R.merge([{ g: new THREE.CylinderGeometry(0.008, 0.008, 0.16, 3), m: R.T(0, 0.08, 0), c: 0x4E7A34 }, { g: new THREE.IcosahedronGeometry(0.035, 0), m: R.T(0, 0.17, 0), c: 0xF2E27A, glow: 0 }]);
  const sl = [], fl = [];
  for (let k = 0; k < 220; k++) { const x = -3 + rnd() * (W + 6), z = -3 + rnd() * (H + 6); const o = outside(x, z);
    if (o <= 0.15) continue; (k % 3 ? fl : sl).push(R.T(x, height(x, z), z, 0, rnd() * 6, 0, 0.8 + rnd() * 0.7)); }
  instOf(shroomG, M.vc, sl, false); instOf(flowerG, M.vc, fl, false);

  // ---------- pebbles along the path edges (close-camera detail)
  { const pl = []; for (let k = 0; k < (Q === 'low' ? 250 : 900); k++) { const x = rnd() * W, z = rnd() * H, pm = pathMask(x, z);
      if (pm < 0.15 || pm > 0.8 || riverDist(x) < 0.9) continue; const s = 0.03 + rnd() * 0.06; pl.push(R.T(x, height(x, z) + s * 0.2, z, rnd(), rnd() * 6, rnd(), s * 1.3, s * 0.7, s)); }
    const peb = new THREE.InstancedMesh(rockG[0], M.rock, pl.length); pl.forEach((m, i) => peb.setMatrixAt(i, m)); peb.receiveShadow = true; world.add(peb); }
  // grass: instanced blade field lives in r_grass.js (built after the world)

  // ---------- plot wall: low dressed-stone wall with posts and caps (the co-op plot boundary)
  const wallParts = []; const wh = 0.32;
  const seg = (x0, z0, x1, z1) => { const L = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(z1 - z0, x1 - x0);
    wallParts.push({ g: new THREE.BoxGeometry(L, wh, 0.26), m: R.T((x0 + x1) / 2, wh / 2 - 0.02, (z0 + z1) / 2, 0, -a, 0), uvs: L * 0.9, uvt: 0.35 });
    const posts = Math.max(1, Math.round(L / 3)); for (let k = 0; k <= posts; k++) { const t = k / posts;
      wallParts.push({ g: new THREE.BoxGeometry(0.4, wh + 0.2, 0.4), m: R.T(x0 + (x1 - x0) * t, (wh + 0.2) / 2 - 0.02, z0 + (z1 - z0) * t), uvs: 0.3, uvt: 0.3 });
      wallParts.push({ g: new THREE.BoxGeometry(0.48, 0.07, 0.48), m: R.T(x0 + (x1 - x0) * t, wh + 0.2, z0 + (z1 - z0) * t), uvs: 0.3, uvt: 0.1 }); } };
  const E = 0.45;
  seg(-E, -E, RX - 0.45, -E); seg(RX + 1.45, -E, W + E, -E); seg(-E, H + E, RX - 0.45, H + E); seg(RX + 1.45, H + E, W + E, H + E);
  seg(-E, 2.3, -E, H + E); seg(-E, -E, -E, 0.7); seg(W + E, -E, W + E, H - 1.7);
  const wallG = R.merge(wallParts.map(p => Object.assign(p, { c: 0xffffff })));
  const wallMesh = cast(new THREE.Mesh(wallG, M.brick)); world.add(wallMesh);

  // ---------- spawn portal: ruined stone arch around a swirling void
  const sx = map.spawn % W, sz = (map.spawn / W) | 0; const portal = new THREE.Group(); portal.position.set(sx - 1.35, 0, sz + 0.5); portal.rotation.y = Math.PI / 2; world.add(portal);
  const arch = []; for (let k = 0; k <= 10; k++) { const a = Math.PI * k / 10, r = 1.05; arch.push({ g: new THREE.BoxGeometry(0.34, 0.34, 0.4), m: R.T(Math.cos(a) * r, 0.2 + Math.sin(a) * r * 1.25 + 0.35, 0, 0, 0, a + Math.PI / 2), uvs: 0.3 }); }
  for (const s of [-1, 1]) arch.push({ g: new THREE.BoxGeometry(0.42, 0.62, 0.48), m: R.T(s * 1.05, 0.28, 0), uvs: 0.4 });
  portal.add(cast(new THREE.Mesh(R.merge(arch.map(p => Object.assign(p, { c: 0xB0A898 }))), M.brick)));
  const vortex = new THREE.Mesh(new THREE.CircleGeometry(0.92, 48), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uTime: R.clock },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `uniform float uTime; varying vec2 vUv; void main(){ vec2 p = vUv - 0.5; float r = length(p) * 2., a = atan(p.y, p.x);
      float sw = sin(a * 3. + r * 9. - uTime * 3.) * 0.5 + 0.5; vec3 c = mix(vec3(0.04, 0.0, 0.08), vec3(0.55, 0.2, 1.1), sw * (1. - r) + pow(r, 6.) * 1.5);
      gl_FragColor = vec4(c * 1.4, smoothstep(1., 0.9, r));\n#include <tonemapping_fragment>\n#include <encodings_fragment>\n}` }));
  vortex.scale.set(1, 1.25, 1); vortex.position.y = 1.0; portal.add(vortex); R.portal = portal;

  // ---------- the vault: stepped plinth, pillars with gold caps, floating crystal (the thing you defend)
  const vx = map.vault % W, vz = (map.vault / W) | 0; const vault = new THREE.Group(); vault.position.set(vx + 1.1, 0, vz + 0.5); world.add(vault);
  const vp = [{ g: new THREE.CylinderGeometry(1.25, 1.4, 0.3, 10), m: R.T(0, 0.15, 0), uvs: 3, uvt: 0.3 }, { g: new THREE.CylinderGeometry(0.95, 1.1, 0.3, 10), m: R.T(0, 0.45, 0), uvs: 3, uvt: 0.3 }];
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; vp.push({ g: new THREE.CylinderGeometry(0.1, 0.12, 1.5, 8), m: R.T(Math.cos(a) * 0.82, 1.25, Math.sin(a) * 0.82), uvs: 0.5, uvt: 1.2 }); }
  vault.add(cast(new THREE.Mesh(R.merge(vp.map(p => Object.assign(p, { c: 0xE8E2D4 }))), M.brick)));
  const gold = R.M.gold = new THREE.MeshStandardMaterial({ color: lin(0xD8A848), metalness: 0.9, roughness: 0.38 });
  const caps = []; for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; caps.push({ g: new THREE.CylinderGeometry(0.16, 0.14, 0.1, 8), m: R.T(Math.cos(a) * 0.82, 2.03, Math.sin(a) * 0.82) }); }
  caps.push({ g: new THREE.TorusGeometry(0.82, 0.05, 6, 36), m: R.T(0, 2.1, 0, Math.PI / 2) });
  vault.add(cast(new THREE.Mesh(R.merge(caps), gold)));
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), new THREE.MeshStandardMaterial({ color: lin(0x7FE8DC), emissive: lin(0x3FC8B8), emissiveIntensity: 1.6, roughness: 0.15, metalness: 0.1, flatShading: true }));
  crystal.scale.set(0.7, 1.35, 0.7); crystal.position.y = 1.55; vault.add(crystal); vault.userData.crystal = crystal; R.vault = vault;
  { // Aether Core: counter-rotating hex rings, hex-patterned energy shield, sky beam, glow pool
    const tech = new THREE.MeshStandardMaterial({ color: lin(0x2A2E38), metalness: 0.9, roughness: 0.3 });
    const glowT = new THREE.MeshStandardMaterial({ color: lin(0x7FF0E0), emissive: lin(0x3FE8D0), emissiveIntensity: 2.2, roughness: 0.2 });
    const rings = [];
    for (let r = 0; r < 2; r++) { const ring = new THREE.Group(); ring.position.y = 1.55; ring.rotation.x = r ? 0.5 : -0.35; vault.add(ring); rings.push(ring);
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; const seg = new THREE.Mesh(new THREE.TorusGeometry(0.82 - r * 0.16, 0.035, 6, 10, Math.PI / 4), k % 2 ? glowT : tech);
        seg.rotation.z = a; ring.add(seg); } }
    vault.userData.rings = rings;
    const shield = new THREE.Mesh(new THREE.IcosahedronGeometry(1.35, 2), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: R.clock, uHurt: { value: 0 } },
      vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vP = position; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }',
      fragmentShader: `uniform float uTime, uHurt; varying vec3 vN; varying vec3 vV; varying vec3 vP;
        float hex(vec2 p){ p.x *= 1.1547; p.y += mod(floor(p.x), 2.) * 0.5; p = abs(fract(p) - 0.5); return abs(max(p.x * 1.5 + p.y, p.y * 2.) - 1.); }
        void main(){ float fr = pow(1. - abs(dot(normalize(vN), normalize(vV))), 2.5);
          vec2 uv = vec2(atan(vP.z, vP.x) * 3., vP.y * 3.); float h = smoothstep(0.08, 0.0, hex(uv));
          float scan = smoothstep(0.02, 0., abs(fract(vP.y * 0.5 - uTime * 0.25) - 0.5) - 0.46);
          vec3 c = mix(vec3(0.15, 0.9, 0.8), vec3(1.2, 0.25, 0.15), uHurt) * (fr * 0.9 + h * 0.35 * (0.4 + fr) + scan * 0.5);
          gl_FragColor = vec4(c * 0.55, 1.);
#include <tonemapping_fragment>
#include <encodings_fragment>
}` }));
    shield.position.y = 1.1; shield.scale.set(1, 0.85, 1); vault.add(shield); vault.userData.shield = shield;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.16, 14, 12, 1, true), new THREE.MeshBasicMaterial({ color: lin(0x3FE8D0).multiplyScalar(1.4), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    beam.position.y = 8.5; vault.add(beam);
    const vpool = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 4.5), new THREE.MeshBasicMaterial({ map: tex.soft, color: lin(0x3FE8D0).multiplyScalar(0.35), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    vpool.rotation.x = -Math.PI / 2; vpool.position.y = 0.05; vault.add(vpool);
    // runestones orbiting the spawn portal
    const stones = new THREE.Group(); stones.position.y = 1.0; portal.add(stones); R.portalStones = stones;
    const rs = new THREE.MeshStandardMaterial({ color: lin(0x3A3444), roughness: 0.8 }), rg = new THREE.MeshStandardMaterial({ color: lin(0xB070FF), emissive: lin(0x9A4AF0), emissiveIntensity: 2.4 });
    for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; const st = new THREE.Mesh(R.blob(0, 0.4, 700 + k, true), rs); st.scale.set(0.12, 0.2, 0.1); st.position.set(0, Math.sin(a) * 1.45, Math.cos(a) * 1.45); st.castShadow = true; stones.add(st);
      const gl = new THREE.Mesh(new THREE.OctahedronGeometry(0.03, 0), rg); gl.position.copy(st.position).multiplyScalar(1.08); stones.add(gl); }
  }

  // ---------- sky dome, mountain rings, outer terrain continuing to the horizon
  const SKY = R.buildSky(null, world, Q, height, W, H, tex); R.skyDome = SKY.dome; world.add(SKY.dome);
  const outer = new THREE.Mesh(SKY.outerGeo, tm); outer.receiveShadow = false; world.add(outer);
  // ---------- ambient life: butterflies over the plot, birds circling high (CPU-animated, ~40 instances total)
  const wing = new THREE.PlaneGeometry(0.08, 0.06); wing.translate(0.04, 0, 0);
  const bfly = new THREE.InstancedMesh(wing, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }), 40); bfly.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(120).fill(1), 3);
  const birdW = new THREE.PlaneGeometry(0.35, 0.1); birdW.translate(0.175, 0, 0);
  const birds = new THREE.InstancedMesh(birdW, new THREE.MeshBasicMaterial({ color: lin(0x2A2A30), side: THREE.DoubleSide }), 14);
  bfly.frustumCulled = birds.frustumCulled = false; world.add(bfly, birds);
  const BF = [...Array(10)].map((_, k) => ({ cx: 1 + rnd() * (W - 2), cz: 1 + rnd() * (H - 2), r: 0.6 + rnd() * 1.4, sp: 0.3 + rnd() * 0.4, ph: rnd() * 6, col: lin([0xF29A2A, 0x3F8AE8, 0xE8C83A, 0xD8508A][k % 4]) }));
  BF.forEach((b, k) => { bfly.setColorAt(k * 2, b.col); bfly.setColorAt(k * 2 + 1, b.col); });
  const BR = [...Array(7)].map((_, k) => ({ r: 6 + rnd() * 8, sp: 0.12 + rnd() * 0.1, ph: rnd() * 6, y: 5 + rnd() * 3 }));
  const lm = new THREE.Matrix4(), lq = new THREE.Quaternion(), le = new THREE.Euler(), lv = new THREE.Vector3(), ls = new THREE.Vector3(1, 1, 1), lv0 = new THREE.Vector3(0.0001, 0.0001, 0.0001);
  function life(t, camPos) { const hideNear = (x, y, z) => camPos && (camPos.y < 15 || ((x - camPos.x) ** 2 + (y - camPos.y) ** 2 + (z - camPos.z) ** 2) < 49); // birds only read from the high overview
    BF.forEach((b, k) => { const a = t * b.sp + b.ph, x = b.cx + Math.cos(a) * b.r + Math.sin(a * 2.3) * 0.3, z = b.cz + Math.sin(a * 1.3) * b.r, y = 0.5 + Math.sin(a * 3.1) * 0.25 + 0.3;
      const yaw = Math.atan2(-Math.sin(a) * b.r, Math.cos(a * 1.3) * b.r * 1.3), fl = Math.sin(t * 18 + k) * 1.1;
      for (const s of [0, 1]) { le.set(0, yaw + (s ? Math.PI : 0), s ? -fl : fl); lq.setFromEuler(le); lm.compose(lv.set(x, y, z), lq, ls); bfly.setMatrixAt(k * 2 + s, lm); } });
    BR.forEach((b, k) => { const a = t * b.sp + b.ph, x = W / 2 + Math.cos(a) * b.r, z = H / 2 + Math.sin(a) * b.r * 0.7, yaw = -a, fl = Math.sin(t * 5 + k) * 0.5;
      const hid = hideNear(x, b.y, z); for (const s of [0, 1]) { le.set(0, yaw + (s ? Math.PI : 0), s ? -fl : fl); lq.setFromEuler(le); lm.compose(lv.set(x, b.y, z), lq, hid ? lv0 : ls); birds.setMatrixAt(k * 2 + s, lm); } });
    bfly.instanceMatrix.needsUpdate = birds.instanceMatrix.needsUpdate = true; }
  return { terrain, water, vortex, crystal, height, pathMask, riverDist, outside, life };
};
})();
