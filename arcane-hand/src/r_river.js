/* Arcane Hand — river + bridges.
   Water shading adapted from Clearwater by Aurélien / Lumaris (MIT): Fresnel at IOR 1.3335, refraction of the view ray onto
   a pebble/sand bed, Beer–Lambert absorption + in-scatter, Beckmann sun glints, suspended specks at three depths.
   Clearwater's FFT ocean is replaced by a flowing river surface; foam rings, pier wakes, bank foam, shadow receiving and
   the shared dusk sky are ours. Pebble texture from Clearwater (MIT), downsampled to 512 px. */
(function () {
'use strict';
const R = globalThis.AHR;
R.RIVER = { surfaceY: -0.26, halfW: 0.8, span: 1.15, deckLo: -0.06, deckRise: 0.32, archHalf: 0.62, spring: -0.4, crown: 0.07 };
R.deckY = (u) => R.RIVER.deckLo + R.RIVER.deckRise * Math.cos(Math.PI * u / (R.RIVER.span * 2));

const WATER_VS = `
  #include <common>
  #include <fog_pars_vertex>
  #include <shadowmap_pars_vertex>
  uniform float uTime; varying vec3 vW;
  void main(){ vec4 wp = modelMatrix * vec4(position, 1.);
    wp.y += sin(wp.z * 3.1 - uTime * 2.2 + wp.x * 4.) * 0.006 + sin(wp.z * 7.3 - uTime * 3.4) * 0.003;
    vW = wp.xyz; vec4 worldPosition = wp;
    #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
      #pragma unroll_loop_start
      for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) { vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * worldPosition; }
      #pragma unroll_loop_end
    #endif
    vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
function waterFS(RX, rows) {
  const piers = rows.map(z => `pierFoam(p, ${(z + 0.5).toFixed(2)})`).join(' + ');
  return `
  #include <common>
  #include <packing>
  #include <fog_pars_fragment>
  #include <bsdfs>
  #include <lights_pars_begin>
  #include <shadowmap_pars_fragment>
  uniform float uTime; uniform sampler2D uPeb; uniform vec3 uSunCol, uAmb; varying vec3 vW;
  ${R.SKY_GLSL}
  const float IOR = 1.3335;
  const vec3 SIG_A = vec3(0.40, 0.074, 0.088) * 3.2, SIG_S = vec3(0.028, 0.052, 0.068) * 3.2;
  const vec3 SIG_T = SIG_A + SIG_S;
  const float CX = ${(RX + 0.5).toFixed(2)};
  float hsh(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
    return mix(mix(hsh(i), hsh(i + vec2(1, 0)), u.x), mix(hsh(i + vec2(0, 1)), hsh(i + vec2(1, 1)), u.x), u.y); }
  float surfH(vec2 p, float t){ // river surface: flow along +z, faster mid-channel
    float edge = 1. - smoothstep(0.1, 0.8, abs(p.x - CX)); vec2 q = p + vec2(0., -t * (0.5 + 0.9 * edge));
    return vn(q * vec2(5., 2.6)) * 0.5 + vn(q * vec2(11., 5.) + 3.) * 0.3 + vn((p + vec2(0.3 * sin(t * 0.3), -t * 1.6)) * vec2(19., 9.)) * 0.2; }
  float floorY(float x){ float rd = abs(x - CX); return -0.09 - 0.85 * (1. - smoothstep(0.3, 0.78, rd)); }
  float fresnel(float ci, float n){ ci = clamp(ci, 0., 1.); float st2 = (1. - ci * ci) / (n * n); if (st2 >= 1.) return 1.;
    float ct = sqrt(1. - st2); float rs = (ci - n * ct) / (ci + n * ct), rp = (n * ci - ct) / (n * ci + ct); return 0.5 * (rs * rs + rp * rp); }
  float pierFoam(vec2 p, float zc){ // piers at |x-CX| in [0.62, 0.85], bridge depth z in [zc-0.55, zc+0.55]
    float dx = abs(abs(p.x - CX) - 0.62), dz = p.y - zc;
    float along = smoothstep(0.6, 0.5, abs(dz));
    float face = (1. - smoothstep(0.0, 0.07, dx)) * along;                                  // churn against the pier faces
    float head = (1. - smoothstep(0.0, 0.16, length(vec2(dx, dz + 0.55)))) * 1.2;           // upstream pier heads
    float wakeL = dz - 0.55; float wake = step(0., wakeL) * exp(-wakeL * 1.6) * (1. - smoothstep(0.0, 0.05 + wakeL * 0.18, dx)); // trailing wakes
    return face + head + wake; }
  void main(){
    vec3 V = normalize(cameraPosition - vW); vec2 p = vW.xz; float t = uTime;
    float e = 0.02; float h0 = surfH(p, t);
    vec2 g = vec2(surfH(p + vec2(e, 0.), t) - h0, surfH(p + vec2(0., e), t) - h0) / e;
    vec3 n = normalize(vec3(-g.x * 0.05, 1., -g.y * 0.05));
    float fy = floorY(vW.x); float depth = max(vW.y - fy, 0.);
    float nv = max(dot(n, V), 0.02); float F = fresnel(nv, IOR);
    float shadow = 1.;
    #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
      DirectionalLightShadow ds = directionalLightShadows[ 0 ];
      shadow = getShadow( directionalShadowMap[ 0 ], ds.shadowMapSize, ds.shadowBias, ds.shadowRadius, vDirectionalShadowCoord[ 0 ] );
    #endif
    // reflection: the shared dusk sky
    vec3 rr = reflect(-V, n); rr.y = abs(rr.y); vec3 refl = skyCol(rr, t, 0.) * 1.1;
    // sun glints (Beckmann, crisp)
    vec3 Hh = normalize(V + SUN_D); float nh = max(dot(n, Hh), 0.), nl = max(dot(n, SUN_D), 0.);
    float a2 = 0.004; float c2 = max(nh * nh, 1e-4); float D = exp(-((1. - c2) / c2) / a2) / (3.14159 * a2 * c2 * c2);
    vec3 spec = uSunCol * min(D * 0.25 * fresnel(max(dot(Hh, V), 0.), IOR) * nl, 60.) * shadow;
    // refraction onto the bed: pebbles + sand, caustics, absorption along the path
    vec3 tr = refract(-V, n, 1. / IOR); float s = depth / max(-tr.y, 0.15); vec2 FP = p + tr.xz * s;
    vec3 peb = pow(texture2D(uPeb, FP * 0.9).rgb, vec3(2.2)); vec3 peb2 = pow(texture2D(uPeb, FP.yx * 0.47 + 0.31).rgb, vec3(2.2));
    vec3 bed = mix(peb, peb2, smoothstep(0.4, 0.7, vn(FP * 1.3))) * 0.55;
    bed = mix(bed, vec3(0.2, 0.18, 0.14), smoothstep(0.55, 0.8, vn(FP * 0.7 + 5.)) * 0.6);
    float cz = sin(FP.x * 13. + t * 1.4) + sin(FP.y * 9. - t * 1.9) + sin((FP.x + FP.y) * 7. + t * 1.7) + sin((FP.x - FP.y) * 11. - t);
    float caus = 0.35 + pow(max(cz, 0.) * 0.3, 2.2) * 2.4;
    vec3 Esun = uSunCol * caus * exp(-SIG_T * depth * 1.6) * shadow * max(SUN_D.y, 0.2);
    vec3 bedLit = bed * (Esun + uAmb * exp(-SIG_A * depth));
    vec3 Tv = exp(-SIG_T * s);
    vec3 inscat = (SIG_S / SIG_T) * (uAmb * 0.9 + uSunCol * 0.12 * shadow) * (1. - Tv) * 1.6;
    vec3 under = bedLit * Tv + inscat;
    // suspended specks at three depths (volume cue)
    for (int k = 0; k < 3; k++) { float dz = 0.08 + 0.12 * float(k); float tt = dz / max(-tr.y, 0.1);
      vec2 q = (p + tr.xz * tt) * 60. + vec2(0., -t * (1.2 + 0.4 * float(k))) + float(k) * 17.; vec2 id = floor(q), f = fract(q) - 0.5;
      float r = hsh(id + float(k) * 13.1); float dt = smoothstep(0.12, 0., length(f)) * step(0.985, r) * step(tt, s);
      under += dt * uSunCol * 0.06 * exp(-SIG_T.g * tt * 3.) * shadow; }
    vec3 col = F * refl + (1. - F) * under + spec;
    // foam: banks, piers, wakes — advected noise breaks it into streaks
    float fn = vn(vec2(p.x * 18., p.y * 7. - t * 2.2)) * 0.6 + vn(vec2(p.x * 40., p.y * 16. - t * 3.1)) * 0.4;
    float bank = smoothstep(0.7, 0.8, abs(p.x - CX));
    float foamAmt = clamp(bank * 0.9 + (${piers || '0.'}), 0., 1.6);
    float foam = smoothstep(0.35, 0.75, fn * foamAmt + foamAmt * 0.25);
    col = mix(col, (uAmb * 1.4 + uSunCol * 0.55 * shadow) * 0.8, foam * 0.85);
    float alpha = smoothstep(0.0, 0.06, depth);
    gl_FragColor = vec4(col, alpha);
    #include <tonemapping_fragment>
    #include <encodings_fragment>
    #include <fog_fragment>
  }`;
}

R.buildRiver = function (world, map, tex, Q, pebblesB64) {
  const { W, H, kind } = map, RX = map.riverX, CX = RX + 0.5, RV = R.RIVER, lin = R.lin;
  const rows = []; for (let z = 0; z < H; z++) if (kind[z * W + RX] === 1) rows.push(z);
  // ---- water
  const peb = new THREE.TextureLoader().load('data:image/jpeg;base64,' + pebblesB64); peb.wrapS = peb.wrapT = THREE.RepeatWrapping;
  const wmat = new THREE.ShaderMaterial({ lights: true, fog: true, transparent: true, vertexShader: WATER_VS, fragmentShader: waterFS(RX, rows),
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.lights, THREE.UniformsLib.fog, { uTime: { value: 0 }, uPeb: { value: null },
      uSunCol: { value: lin(0xFFB27A).multiplyScalar(2.6) }, uAmb: { value: new THREE.Color(0.10, 0.12, 0.2) } }]) });
  wmat.uniforms.uPeb.value = peb; wmat.uniforms.uTime = R.clock;
  const wg = new THREE.PlaneGeometry(RV.halfW * 2, H + 24, 8, (H + 24) * 3); wg.rotateX(-Math.PI / 2); wg.translate(CX, RV.surfaceY, H / 2);
  const water = new THREE.Mesh(wg, wmat); water.receiveShadow = true; water.renderOrder = 1; world.add(water);
  // ---- bridges
  const stone = new THREE.MeshStandardMaterial({ map: tex.brick.clone(), normalMap: tex.brickN.clone(), color: lin(0xB0AAA4), roughness: 0.82 });
  stone.map.repeat.set(1.8, 1.8); stone.normalMap.repeat.set(1.8, 1.8); stone.map.needsUpdate = stone.normalMap.needsUpdate = true;
  const capM = new THREE.MeshStandardMaterial({ map: tex.brick, color: lin(0x8A8680), roughness: 0.75 });
  const metal = new THREE.MeshStandardMaterial({ color: lin(0x2A2C32), roughness: 0.35, metalness: 0.85 });
  const crystal = new THREE.MeshStandardMaterial({ color: lin(0x7FF6E6), emissive: lin(0x3FE8D0), emissiveIntensity: 2.4, roughness: 0.15, flatShading: true });
  const pool = new THREE.MeshBasicMaterial({ map: tex.soft, color: lin(0x3FE8D0).multiplyScalar(0.16), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  if (R.rim) { R.rim(stone, 0.18); }
  const S = RV.span, A = RV.archHalf, D = 1.08;
  const topAt = (u) => R.deckY(u);
  const lanterns = [], root = new THREE.Group();
  for (const z of rows) {
    const g = new THREE.Group(); g.position.set(CX, 0, z + 0.5 - D / 2); root.add(g);
    // body: deck + spandrels + two piers, with the arch cut through (water flows under)
    const sh = new THREE.Shape(); const N = 24;
    sh.moveTo(-S, -0.95); sh.lineTo(-S, topAt(-S));
    for (let k = 1; k <= N; k++) { const u = -S + 2 * S * k / N; sh.lineTo(u, topAt(u)); }
    sh.lineTo(S, -0.95); sh.lineTo(A + 0.03, -0.95); sh.lineTo(A, RV.spring);
    for (let k = 1; k < N; k++) { const a = k / N * Math.PI; sh.lineTo(Math.cos(a) * A, RV.spring + Math.sin(a) * (RV.crown - RV.spring)); }
    sh.lineTo(-A, RV.spring); sh.lineTo(-A - 0.03, -0.95); sh.closePath();
    const body = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: D, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 2, curveSegments: 8 }), stone);
    body.castShadow = body.receiveShadow = true; g.add(body);
    // voussoirs: projecting arch stones on both faces
    const vg = new THREE.BoxGeometry(0.1, 0.13, 0.05);
    for (const fz of [-0.03, D + 0.03]) for (let k = 0; k <= 12; k++) { const a = k / 12 * Math.PI, rx = Math.cos(a) * (A + 0.05), ry = RV.spring + Math.sin(a) * (RV.crown - RV.spring + 0.05);
      const vb = new THREE.Mesh(vg, capM); vb.position.set(rx, ry, fz); vb.rotation.z = a - Math.PI / 2; vb.castShadow = true; g.add(vb); }
    // parapets following the deck curve, with capstones
    for (const pz of [0.02, D - 0.1]) { const ps = new THREE.Shape(); ps.moveTo(-S, topAt(-S));
      for (let k = 1; k <= N; k++) { const u = -S + 2 * S * k / N; ps.lineTo(u, topAt(u)); }
      for (let k = N; k >= 0; k--) { const u = -S + 2 * S * k / N; ps.lineTo(u, topAt(u) + 0.15); } ps.closePath();
      const par = new THREE.Mesh(new THREE.ExtrudeGeometry(ps, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 1 }), capM);
      par.position.z = pz; par.castShadow = par.receiveShadow = true; g.add(par); }
    // crystal lanterns at the four corners (sci-fi arcana: floating shard over an iron post)
    for (const ux of [-S + 0.08, S - 0.08]) for (const lz of [0.06, D - 0.06]) {
      const y0 = topAt(ux) + 0.15; const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.34, 8), metal); post.position.set(ux, y0 + 0.17, lz); post.castShadow = true; g.add(post);
      const cage = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.008, 6, 16), metal); cage.position.set(ux, y0 + 0.42, lz); cage.rotation.x = Math.PI / 2; g.add(cage);
      lanterns.push(new THREE.Vector3(CX + ux, y0 + 0.44, z + 0.5 - D / 2 + lz));
      const lp = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), pool); lp.rotation.x = -Math.PI / 2; lp.position.set(ux * 0.92, topAt(ux * 0.92) + 0.02, lz < 0.5 ? 0.18 : D - 0.18); lp.renderOrder = 3; g.add(lp);
    }
  }
  // all bridges -> one mesh per material; lantern crystals -> one instanced draw
  R.mergeByMaterial(root, world);
  const crystals = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.045, 0), crystal, lanterns.length); crystals.frustumCulled = false; world.add(crystals);
  const cm = new THREE.Matrix4(), cq = new THREE.Quaternion(), ce = new THREE.Euler(), cs = new THREE.Vector3(1, 1.6, 1), cv = new THREE.Vector3();
  function update(t) { lanterns.forEach((p, k) => { ce.set(0, t * 0.8 + k, 0); cq.setFromEuler(ce); cm.compose(cv.set(p.x, p.y + Math.sin(t * 2 + k) * 0.02, p.z), cq, cs); crystals.setMatrixAt(k, cm); }); crystals.instanceMatrix.needsUpdate = true; }
  return { water, rows, update };
};
})();
