/* Arcane Hand — atmosphere: dusk sky (gradient, sun, twin moons, stars, aurora, cloud banks), distant mountain rings,
   outer terrain + forest so low camera angles see a world, not an edge. One sky function (GLSL) is shared by the dome,
   the image-based-light environment, the mountains' aerial perspective and the water's reflections. */
(function () {
'use strict';
const R = globalThis.AHR;
R.SUN_DIR = new THREE.Vector3(-0.72, 0.40, 0.56).normalize();   // low warm sun from the back-left: long shadows, rim light
R.FOG_LIN = new THREE.Color(0.20, 0.16, 0.24);                   // linear dusk haze (fog colour)

R.SKY_GLSL = `
  const vec3 SUN_D = vec3(${R.SUN_DIR.x.toFixed(4)}, ${R.SUN_DIR.y.toFixed(4)}, ${R.SUN_DIR.z.toFixed(4)});
  float skH(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  float skN(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
    return mix(mix(skH(i), skH(i + vec2(1, 0)), u.x), mix(skH(i + vec2(0, 1)), skH(i + vec2(1, 1)), u.x), u.y); }
  float skF(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 4; i++) { v += a * skN(p); p = p * 2.03 + 17.1; a *= .5; } return v; }
  vec3 skyCol(vec3 d, float t, float detail){
    float e = d.y, mu = dot(d, SUN_D);
    float az = dot(normalize(d.xz + 1e-4), normalize(SUN_D.xz));
    float h = pow(clamp(e, 0., 1.), 0.5);
    vec3 zen = vec3(0.018, 0.022, 0.07), mid = vec3(0.11, 0.07, 0.22), hor = vec3(0.95, 0.40, 0.22);
    vec3 c = mix(hor, mid, smoothstep(0.0, 0.35, h)); c = mix(c, zen, smoothstep(0.3, 0.95, h));
    c = mix(c, c * vec3(0.35, 0.45, 0.95), smoothstep(0.3, -0.9, az) * (1. - h));        // cool twilight away from the sun
    c += vec3(1.0, 0.45, 0.18) * pow(max(mu, 0.), 5.) * 0.9 + vec3(1.4, 0.75, 0.35) * pow(max(mu, 0.), 180.) * 2.5;
    c += vec3(9., 5.2, 2.4) * smoothstep(0.99935, 0.9997, mu);                               // sun disk
    if (detail > 0.5) {
      // stars: only where the sky is dark
      vec2 sp = vec2(atan(d.z, d.x) * 90., asin(clamp(e, -1., 1.)) * 90.); vec2 id = floor(sp);
      float sr = skH(id); float star = step(0.9965, sr) * smoothstep(0.06, 0.35, e) * (0.55 + 0.45 * sin(t * (1.5 + sr * 3.) + sr * 40.));
      star *= smoothstep(0.35, 0.0, length(fract(sp) - 0.5));
      c += vec3(0.8, 0.86, 1.0) * star * 2.2 * (1. - smoothstep(-0.2, 0.6, mu));
      // aurora: slow curtains, teal to magenta, high in the cool half of the sky
      float au = 0.;
      for (int k = 0; k < 3; k++) { float fk = float(k);
        float band = sin(atan(d.z, d.x) * (3. + fk) + t * (0.05 + 0.02 * fk) + skF(vec2(atan(d.z, d.x) * 2. + fk, t * 0.03)) * 3.);
        au += smoothstep(0.75, 1.0, band) * smoothstep(0.12, 0.35, e) * smoothstep(0.85, 0.4, e) * (0.5 + 0.5 * skF(vec2(d.x * 6. + t * 0.05, d.z * 6. + fk))); }
      c += mix(vec3(0.05, 0.9, 0.6), vec3(0.8, 0.2, 0.9), smoothstep(0.2, 0.6, e)) * au * 0.22 * smoothstep(0.2, -0.6, az);
      // twin moons: a large pale one and a small teal one, opposite the sun
      vec3 m1 = normalize(vec3(0.62, 0.52, -0.58)), m2 = normalize(vec3(0.30, 0.66, -0.69));
      float d1 = dot(d, m1), d2 = dot(d, m2);
      float moon1 = smoothstep(0.99905, 0.99925, d1); float crater = skF(vec2(d.x, d.y) * 260.) * 0.35 + 0.65;
      c = mix(c, vec3(0.95, 0.9, 1.0) * 1.6 * crater, moon1); c += vec3(0.5, 0.55, 0.8) * pow(max(d1, 0.), 400.) * 0.6;
      float moon2 = smoothstep(0.99975, 0.9998, d2); c = mix(c, vec3(0.45, 1.2, 1.1), moon2); c += vec3(0.1, 0.5, 0.5) * pow(max(d2, 0.), 900.) * 0.6;
      // cloud banks near the horizon: dark bodies, sun-lit edges
      float cl = skF(vec2(atan(d.z, d.x) * 5. + t * 0.004, e * 14.)) ;
      float cm = smoothstep(0.52, 0.72, cl) * smoothstep(0.34, 0.06, e) * smoothstep(-0.01, 0.04, e);
      vec3 cloudC = mix(vec3(0.05, 0.04, 0.08), vec3(1.1, 0.5, 0.25), pow(max(mu, 0.), 3.) * smoothstep(0.55, 0.75, cl));
      c = mix(c, cloudC, cm * 0.85);
    }
    if (e < 0.) c = mix(hor * 0.25 + vec3(0.02, 0.02, 0.05), vec3(0.012, 0.014, 0.02), smoothstep(0., -0.25, e));
    return c;
  }`;

R.buildSky = function (scene, world, Q, heightFn, W, H, tex) {
  // ---- dome
  const dome = new THREE.Mesh(new THREE.SphereGeometry(300, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { uTime: R.clock },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w * 0.99999; }',
    fragmentShader: `uniform float uTime; varying vec3 vD;\n${R.SKY_GLSL}\nvoid main(){ gl_FragColor = vec4(skyCol(normalize(vD), uTime, 1.), 1.);\n#include <tonemapping_fragment>\n#include <encodings_fragment>\n}` }));
  dome.renderOrder = -10; dome.frustumCulled = false; if (scene) scene.add(dome);
  // follow the camera so the sky is always at infinity
  dome.onBeforeRender = (r, s, cam) => dome.position.copy(cam.position);

  // ---- distant mountain rings with aerial perspective toward the same sky
  const mtnMat = new THREE.ShaderMaterial({ fog: false, uniforms: { uTime: R.clock, uFar: { value: 0 } },
    vertexShader: 'attribute float aH; varying vec3 vW; varying float vH; void main(){ vH = aH; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float uTime; uniform float uFar; varying vec3 vW; varying float vH;\n${R.SKY_GLSL}
      void main(){ vec3 d = normalize(vW - cameraPosition); vec3 sky = skyCol(d, uTime, 0.);
        float lit = pow(max(dot(normalize(vec3(d.x, 0., d.z)), normalize(vec3(SUN_D.x, 0., SUN_D.z))), 0.), 3.);
        vec3 rock = mix(vec3(0.02, 0.018, 0.03), vec3(0.09, 0.05, 0.05), vH) + vec3(0.5, 0.2, 0.08) * lit * vH * vH * 0.35;
        float haze = mix(0.45, 0.8, uFar) - vH * 0.25;
        gl_FragColor = vec4(mix(rock, sky, clamp(haze, 0., 1.)), 1.);\n#include <tonemapping_fragment>\n#include <encodings_fragment>\n}` });
  const ring = (radius, base, amp, seed, far) => {
    const N = 180, pos = [], hs = [], idx = []; const r = R.rand(seed), ph = r() * 10;
    for (let i = 0; i <= N; i++) { const a = i / N * Math.PI * 2;
      const n = R.fbm(R.noise2(seed, 64), a * 4 + ph, 0.5, 5); const peak = Math.pow(n, 1.6) * amp + base;
      const cx = W / 2 + Math.cos(a) * radius, cz = H / 2 + Math.sin(a) * radius;
      pos.push(cx, -4, cz, cx, peak, cz); hs.push(0, 1); }
    for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aH', new THREE.Float32BufferAttribute(hs, 1)); g.setIndex(idx);
    const m = new THREE.Mesh(g, mtnMat.clone()); m.material.uniforms.uFar.value = far; m.material.uniforms.uTime = R.clock; m.frustumCulled = false; world.add(m); return m; };
  ring(118, 10, 40, 7, 1); ring(84, 4, 22, 11, 0.5);
  // ---- outer terrain ring: hills continue to the mountains (the inner detailed terrain hides the middle)
  const OS = Q === 'low' ? 40 : 64, SIZE = 200;
  const og = new THREE.PlaneGeometry(SIZE, SIZE, OS, OS); og.rotateX(-Math.PI / 2); og.translate(W / 2, 0, H / 2);
  const P = og.attributes.position, n = P.count, splat = new Float32Array(n * 4), col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const x = P.getX(i), z = P.getZ(i); const inner = Math.abs(x - W / 2) < W / 2 + 9 && Math.abs(z - H / 2) < H / 2 + 9;
    const far = Math.hypot(x - W / 2, z - H / 2);
    const y = inner ? -3 : heightFn(x, z) + Math.max(0, far - 20) * 0.06 + R.wnoise(x * 0.05, z * 0.05) * 3;
    P.setY(i, y); const rock = R.wnoise(x * 0.08 + 9, z * 0.08) > 0.6 ? 0.7 : 0.1;
    splat.set([1 - rock, 0, rock, 0], i * 4); const t = 0.55 + 0.2 * R.wnoise(x * 0.1, z * 0.1); col.set([t, t, t], i * 3); }
  og.setAttribute('aSplat', new THREE.BufferAttribute(splat, 4)); og.setAttribute('color', new THREE.BufferAttribute(col, 3)); og.computeVertexNormals();
  return { dome, outerGeo: og };
};
})();
