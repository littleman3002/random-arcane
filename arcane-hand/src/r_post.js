/* Arcane Hand — post pipeline (medium/high quality): HDR scene -> bloom (2 levels) -> ACES -> grade -> vignette -> sRGB.
   Low quality skips this entirely and lets three.js tone-map directly (cheapest path for integrated graphics). */
(function () {
'use strict';
const R = globalThis.AHR;
const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';
class Post {
  constructor(renderer, samples) {
    this.r = renderer; this.samples = samples;
    const hdr = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false, stencilBuffer: false };
    this.bloomLevels = 2; this.dof = true; this.W = 4; this.H = 4; this.makeScene(samples);
    this.a = new THREE.WebGLRenderTarget(4, 4, hdr); this.b = new THREE.WebGLRenderTarget(4, 4, hdr);
    this.c = new THREE.WebGLRenderTarget(4, 4, hdr); this.d = new THREE.WebGLRenderTarget(4, 4, hdr);
    this.e = new THREE.WebGLRenderTarget(4, 4, hdr); this.f = new THREE.WebGLRenderTarget(4, 4, hdr); this.tilt = 0.85;
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); this.qs = new THREE.Scene(); this.qs.add(this.quad);
    this.bright = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, thr: { value: 1.1 } }, vertexShader: VS, depthTest: false,
      fragmentShader: 'uniform sampler2D t; uniform float thr; varying vec2 vUv; void main(){ vec3 c = texture2D(t, vUv).rgb; float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * smoothstep(thr, thr + 0.6, l), 1.); }' });
    this.blur = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, dir: { value: new THREE.Vector2() } }, vertexShader: VS, depthTest: false,
      fragmentShader: `uniform sampler2D t; uniform vec2 dir; varying vec2 vUv;
        void main(){ vec3 c = texture2D(t, vUv).rgb * 0.2270270270;
          c += (texture2D(t, vUv + dir * 1.3846153846).rgb + texture2D(t, vUv - dir * 1.3846153846).rgb) * 0.3162162162;
          c += (texture2D(t, vUv + dir * 3.2307692308).rgb + texture2D(t, vUv - dir * 3.2307692308).rgb) * 0.0702702703; gl_FragColor = vec4(c, 1.); }` });
    this.comp = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, b1: { value: null }, b2: { value: null }, tb: { value: null }, tilt: { value: 0.85 }, fxaa: { value: 0 }, px: { value: new THREE.Vector2(1, 1) }, bloom: { value: 0.72 }, expo: { value: 1.3 }, vig: { value: 0.28 } },
      vertexShader: VS, depthTest: false,
      fragmentShader: `uniform sampler2D t, b1, b2, tb; uniform float bloom, expo, vig, tilt, fxaa; uniform vec2 px; varying vec2 vUv;
        float lum(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
        vec3 fxaaS(vec2 uv){ // FXAA-lite for the no-MSAA tiers: blend along detected edges
          vec3 cM = texture2D(t, uv).rgb; float lM = lum(cM), lN = lum(texture2D(t, uv + vec2(0., px.y)).rgb), lS = lum(texture2D(t, uv - vec2(0., px.y)).rgb), lE = lum(texture2D(t, uv + vec2(px.x, 0.)).rgb), lW = lum(texture2D(t, uv - vec2(px.x, 0.)).rgb);
          float mn = min(lM, min(min(lN, lS), min(lE, lW))), mx = max(lM, max(max(lN, lS), max(lE, lW))); if (mx - mn < max(0.04, mx * 0.12)) return cM;
          vec2 dir = normalize(vec2(-(lN - lS), lE - lW) + 1e-5) * px;
          return (texture2D(t, uv + dir * 0.5).rgb + texture2D(t, uv - dir * 0.5).rgb + cM * 2.) * 0.25; }
        vec3 aces(vec3 x){ x *= 0.6; return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0., 1.); }
        vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1./2.4)) - 0.055, step(0.0031308, c)); }
        void main(){ vec3 c = fxaa > 0.5 ? fxaaS(vUv) : texture2D(t, vUv).rgb; c = mix(c, texture2D(tb, vUv).rgb, smoothstep(0.34, 0.52, abs(vUv.y - 0.5)) * tilt); vec3 bl = texture2D(b1, vUv).rgb * 0.6 + texture2D(b2, vUv).rgb * 0.8;
          c = (c + bl * bloom) * expo;
          c = aces(c);
          float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); c = mix(vec3(l), c, 1.1);            // gentle saturation
          c *= mix(vec3(0.94, 0.98, 1.06), vec3(1.05, 1.0, 0.93), smoothstep(0.05, 0.7, l)); // cool shadows, warm highlights
          vec2 q = vUv - 0.5; c *= 1. - vig * smoothstep(0.25, 0.85, dot(q, q) * 2.2);
          gl_FragColor = vec4(toSRGB(clamp(c, 0., 1.)), 1.); }` });
  }
  makeScene(samples) {
    if (this.scene) this.scene.dispose(); this.samples = samples;
    this.scene = samples > 0 && THREE.WebGLMultisampleRenderTarget
      ? new THREE.WebGLMultisampleRenderTarget(this.W, this.H, { type: THREE.HalfFloatType, format: THREE.RGBAFormat })
      : new THREE.WebGLRenderTarget(this.W, this.H, { type: THREE.HalfFloatType, format: THREE.RGBAFormat });
    if (samples > 0 && this.scene.samples != null) this.scene.samples = samples;
  }
  configure({ samples, bloom, dof }) { if (samples !== this.samples) this.makeScene(samples); this.bloomLevels = bloom; this.dof = dof;
    this.comp.uniforms.fxaa.value = samples > 0 ? 0 : 1; }
  setSize(w, h, dpr) {
    const W = Math.max(1, Math.floor(w * dpr)), H = Math.max(1, Math.floor(h * dpr));
    this.scene.setSize(W, H); this.a.setSize(W >> 1, H >> 1); this.b.setSize(W >> 1, H >> 1); this.c.setSize(W >> 2, H >> 2); this.d.setSize(W >> 2, H >> 2); this.e.setSize(W >> 1, H >> 1); this.f.setSize(W >> 1, H >> 1);
    this.W = W; this.H = H;
  }
  pass(mat, target) { this.quad.material = mat; this.r.setRenderTarget(target); this.r.render(this.qs, this.cam); }
  render(scene, camera) {
    const r = this.r;
    r.setRenderTarget(this.scene); r.render(scene, camera);
    this.bright.uniforms.t.value = this.scene.texture; this.pass(this.bright, this.a);
    const bl = this.blur.uniforms;
    bl.t.value = this.a.texture; bl.dir.value.set(2 / this.W, 0); this.pass(this.blur, this.b);
    bl.t.value = this.b.texture; bl.dir.value.set(0, 2 / this.H); this.pass(this.blur, this.a);
    if (this.bloomLevels > 1) {
    bl.t.value = this.a.texture; bl.dir.value.set(4 / this.W, 0); this.pass(this.blur, this.c);
    bl.t.value = this.c.texture; bl.dir.value.set(0, 4 / this.H); this.pass(this.blur, this.d);
    bl.t.value = this.d.texture; bl.dir.value.set(8 / this.W, 0); this.pass(this.blur, this.c);
    bl.t.value = this.c.texture; bl.dir.value.set(0, 8 / this.H); this.pass(this.blur, this.d); }
    if (this.dof) { this.bright.uniforms.thr.value = -10; this.bright.uniforms.t.value = this.scene.texture; this.pass(this.bright, this.e); this.bright.uniforms.thr.value = 1.1; // scene copy (half res)
    bl.t.value = this.e.texture; bl.dir.value.set(3 / this.W, 0); this.pass(this.blur, this.f);
    bl.t.value = this.f.texture; bl.dir.value.set(0, 3 / this.H); this.pass(this.blur, this.e); }
    const u = this.comp.uniforms; u.tb.value = this.e.texture; u.tilt.value = this.dof ? this.tilt : 0; u.px.value.set(1 / this.W, 1 / this.H); u.b2.value = this.bloomLevels > 1 ? this.d.texture : this.a.texture; u.t.value = this.scene.texture; u.b1.value = this.a.texture;
    this.pass(this.comp, null);
  }
}
R.Post = Post;
})();
