/* Arcane Hand — grass field. Technique adapted from three-stylized by Steve245270533 (MIT; itself adapted from
   cortiz2894/stylized-components): instanced tapered blades, coherent world-space wind, root-to-tip gradient,
   up-flattened diffuse (no per-blade shimmer), back-light transmission toward the sun, shadow receiving.
   Our additions: rolling gusts, dry-blade variation, flattening under towers via an occupancy texture, three r128 port. */
(function () {
'use strict';
const R = globalThis.AHR;

// one instance = a tuft of several tapered, curved blades (unit space: radius 0.5, height 1)
function tuftGeometry(blades, segments) {
  const pos = [], uv = [], bl = [], idx = []; const r = R.rand(99);
  for (let b = 0; b < blades; b++) {
    const a = r() * Math.PI * 2, rad = Math.sqrt(r()) * 0.42, ox = Math.cos(a) * rad, oz = Math.sin(a) * rad;
    const yaw = r() * Math.PI * 2, cy = Math.cos(yaw), sy = Math.sin(yaw), hk = 0.6 + r() * 0.4, wk = 0.16 + r() * 0.1, lean = 0.12 + r() * 0.3, br = r();
    const base = pos.length / 3;
    for (let s = 0; s < segments; s++) { const t = s / segments, w = wk * Math.pow(1 - t, 0.7), bend = lean * t * t;
      for (const sx of [-w, w]) { const lx = sx, lz = bend; pos.push(ox + lx * cy - lz * sy, t * hk, oz + lx * sy + lz * cy); uv.push(sx < 0 ? 0 : 1, t); bl.push(br); } }
    pos.push(ox - lean * sy, hk, oz + lean * cy); uv.push(0.5, 1); bl.push(br);
    for (let s = 0; s < segments - 1; s++) { const q = base + s * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
    const fl = base + (segments - 1) * 2; idx.push(fl, fl + 1, base + segments * 2);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aBlade', new THREE.Float32BufferAttribute(bl, 1)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

const VS = `
  #include <common>
  #include <fog_pars_vertex>
  #include <shadowmap_pars_vertex>
  uniform float uTime; uniform sampler2D uOcc; uniform vec4 uOccRect;
  attribute float aTint; attribute float aBlade;
  varying float vH; varying float vTint; varying vec3 vWP;
  void main(){
    vH = uv.y; vTint = fract(aTint + aBlade * 0.618);
    mat4 iw = modelMatrix * instanceMatrix;
    vec3 base = (iw * vec4(0., 0., 0., 1.)).xyz;
    vec2 ouv = (base.xz - uOccRect.xy) / uOccRect.zw;
    float occ = (ouv.x > 0. && ouv.y > 0. && ouv.x < 1. && ouv.y < 1.) ? texture2D(uOcc, ouv).r : 0.;
    vec3 p = position; p.y *= 1. - occ * 0.9;
    vec2 wd = normalize(vec2(0.8, 0.45));
    float w1 = sin(dot(base.xz, wd) * 0.9 + uTime * 1.6);
    float w2 = sin(dot(base.xz, vec2(-wd.y, wd.x)) * 1.7 + uTime * 1.13) * 0.35;
    float gust = smoothstep(0.35, 1., sin(dot(base.xz, wd) * 0.17 - uTime * 0.65)) * 0.9;
    float bend = (w1 * 0.5 + 0.5) * 0.35 + w2 * 0.2 + gust * 0.7 + 0.12 + sin(uTime * 2.3 + aBlade * 20.) * 0.06;
    vec4 wp = iw * vec4(p, 1.);
    float tip = uv.y * uv.y; float hgt = length(vec3(iw[1]));
    wp.xz += wd * bend * tip * hgt * 0.55 * (0.6 + 0.4 * aTint);
    wp.y -= bend * bend * tip * hgt * 0.12;
    vWP = wp.xyz;
    vec4 worldPosition = wp;
    #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
      #pragma unroll_loop_start
      for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) { vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * worldPosition; }
      #pragma unroll_loop_end
    #endif
    vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
const FS = `
  #include <common>
  #include <packing>
  #include <fog_pars_fragment>
  #include <bsdfs>
  #include <lights_pars_begin>
  #include <shadowmap_pars_fragment>
  uniform vec3 uBot, uTop, uDry, uBack, uSunCol, uAmb, uSunDir;
  varying float vH; varying float vTint; varying vec3 vWP;
  void main(){
    vec3 col = mix(uBot, uTop, smoothstep(0.0, 1.0, vH)) * (0.75 + 0.5 * vTint);
    col = mix(col, uDry * (0.6 + 0.6 * vH), step(0.9, vTint) * 0.8);                 // a few dry, straw-coloured blades
    float shadow = 1.;
    #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
      DirectionalLightShadow ds = directionalLightShadows[ 0 ];
      shadow = getShadow( directionalShadowMap[ 0 ], ds.shadowMapSize, ds.shadowBias, ds.shadowRadius, vDirectionalShadowCoord[ 0 ] );
    #endif
    float diff = 0.35 + 0.65 * max(uSunDir.y, 0.);                                       // up-flattened: no shimmer
    vec3 V = normalize(cameraPosition - vWP);
    float back = pow(max(dot(V, -uSunDir), 0.), 3.) * (0.25 + 0.75 * vH);               // light through thin blades
    vec3 lit = col * (uAmb + uSunCol * diff * mix(0.3, 1., shadow)) + uBack * uSunCol * back * shadow * 0.9;
    lit *= mix(0.35, 1.0, vH);                                                            // root occlusion
    gl_FragColor = vec4(lit, 1.);
    #include <tonemapping_fragment>
    #include <encodings_fragment>
    #include <fog_fragment>
  }`;

R.buildGrass = function (world, Q, W, H, WF, sunLight) {
  const lin = R.lin;
  const N = 72000; // tufts at full density (x6 blades); the live quality setting shows a prefix of them
  const occ = new THREE.DataTexture(new Uint8Array(W * H * 4), W, H, THREE.RGBAFormat); occ.magFilter = occ.minFilter = THREE.NearestFilter; occ.needsUpdate = true;
  const mat = new THREE.ShaderMaterial({ lights: true, fog: true, vertexShader: VS, fragmentShader: FS, side: THREE.DoubleSide,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.lights, THREE.UniformsLib.fog, {
      uTime: { value: 0 }, uOcc: { value: null }, uOccRect: { value: new THREE.Vector4(0, 0, W, H) },
      uBot: { value: lin(0x16281A) }, uTop: { value: lin(0x5C9A3E) }, uDry: { value: lin(0x8A7A44) }, uBack: { value: lin(0xB8D860) },
      uSunCol: { value: lin(0xFFB27A).multiplyScalar(1.15) }, uAmb: { value: new THREE.Color(0.16, 0.19, 0.3) }, uSunDir: { value: R.SUN_DIR.clone() } }]) });
  mat.uniforms.uOcc.value = occ; mat.uniforms.uTime = R.clock;
  const geo = tuftGeometry(6, 3);
  const tint = new Float32Array(N); geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(tint, 1));
  const im = new THREE.InstancedMesh(geo, mat, N); im.receiveShadow = true; im.castShadow = false; im.frustumCulled = false;
  const r = R.rand(2024), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
  let n = 0, tries = 0;
  while (n < N && tries++ < N * 6) {
    const inside = r() < 0.6;                                             // most tufts go where the camera plays
    const x = inside ? r() * W : -9 + r() * (W + 18), z = inside ? r() * H : -8 + r() * (H + 16), o = WF.outside(x, z);
    const pm = WF.pathMask(x, z); if (pm > 0.45 || WF.riverDist(x) < 0.82) continue; const edge = 1 - Math.min(1, pm * 2.2); // feather into the path edges
    if (o > 0 && o < 0.35) continue;                                      // keep the wall line readable
    const inPlot = o <= 0, h = (inPlot ? 0.11 + r() * 0.13 : 0.24 + r() * 0.32) * (0.35 + 0.65 * edge), w = inPlot ? 0.2 + r() * 0.1 : 0.26 + r() * 0.14;
    e.set((r() - 0.5) * 0.25, r() * Math.PI * 2, (r() - 0.5) * 0.25); q.setFromEuler(e);
    m4.compose(v.set(x, WF.height(x, z) - 0.01, z), q, s.set(w, h, w)); im.setMatrixAt(n, m4); tint[n] = r(); n++;
  }
  im.count = n; world.add(im);
  function setDensity(f) { im.count = Math.max(1, Math.floor(n * f)); }
  function setOccupied(towers) { const d = occ.image.data; d.fill(0); for (const t of towers) d[(t.tz * W + t.tx) * 4] = 255; occ.needsUpdate = true; }
  return { mesh: im, setOccupied, setDensity, count: n };
};
})();
