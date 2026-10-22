// WebGL backgrounds drawn by our own fragment shaders, on one fullscreen triangle. No library.
//
//   <section class="cine-shader" data-cine-shader="ribbons"
//            data-colors="#4d8dff,#9fd0ff,#2a3d8f" data-bg="#07080b"
//            data-speed="1" data-intensity="1">…content…</section>
//
// Presets
//   ribbons  a bundle of light streaks, pinched on one side and fanned out on the other, with light
//            running along the lines (the "flowing handoff" look of AI/SaaS heroes)
//   aurora   curtains of light with vertical rays over a dark sky
//   mesh     slow fields of colour that drift into each other (soft gradient mesh, with grain)
//   grid     a perspective floor grid running to a glowing horizon, pulses travelling along it
//            (infrastructure / network look)
//   clouds   a dive through layers of cloud: the scroll flies the camera through them and, at the end,
//            they clear onto whatever is below in the host (a photograph, a city, the hero). Drawn OVER
//            the host's content (transparent canvas); put it in a scene to drive it with --p.
//            Colours: sky top, horizon, cloud (light themes: "#9ec5ea,#f4e9dc,#ffffff").
//
// Options (data attributes): colors (3 CSS colours; else --cine-c1…3), bg (else --cine-bg),
// speed (1), intensity (1), flip ("x" mirrors the composition), pointer ("off" stops the pointer
// bending the light). The canvas sits behind the host's content; without WebGL the host keeps its CSS
// fallback background (.cine-shader:not(.is-gl) in cine.css).

import { glLayer, compile, uniforms, readColors, readBg, pointerTracker, viewProgress } from './util.js';

const VS = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const HEAD = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uPointer;
uniform float uScroll;
uniform float uIntensity;
uniform float uFlip;
uniform vec3 uC1;
uniform vec3 uC2;
uniform vec3 uC3;
uniform vec3 uBg;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy) * 2.0 - 1.0;
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(dot(hash22(i), f), dot(hash22(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
             mix(dot(hash22(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)), dot(hash22(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
  return v;
}
`;

const PRESETS = {
  ribbons: `
vec3 preset(vec2 p, float t, vec2 m) {
  float pull = exp(-dot(p - m, p - m) * 2.2) * 0.22;
  float spread = mix(0.03, 1.3, smoothstep(-1.5, 1.7, p.x));
  float bend = 0.28 * sin(p.x * 0.8 + t * 0.19) + 0.45 * fbm(vec2(p.x * 0.45 - t * 0.04, 1.7)) - 0.2 * p.x - 0.12;
  vec3 col = vec3(0.0);
  for (int i = 0; i < 28; i++) {
    float k = float(i) / 27.0;
    float s = k - 0.5;
    float wob = (0.12 + 0.14 * fract(k * 7.31)) * sin(p.x * (1.1 + fract(k * 3.7) * 1.6) - t * (0.3 + k * 0.25) + k * 17.0);
    float y = bend + s * spread + wob * spread + pull * (1.0 - abs(s) * 1.4);
    float d = abs(p.y - y);
    float core = 0.0026 / (d + 0.0026);
    float halo = 0.05 / (d * 6.0 + 0.05);
    vec3 c = mix(uC1, uC2, k);
    c = mix(c, uC3, 0.5 + 0.5 * sin(p.x * 1.2 + k * 9.0 + t * 0.35));
    float run = 0.22 + 0.78 * pow(0.5 + 0.5 * sin(p.x * 2.2 + k * 17.0 - t * (0.9 + k * 0.4)), 4.0);
    float ends = smoothstep(-2.7, -1.2, p.x);
    col += c * (core * 1.5 + halo * 0.2) * run * ends;
  }
  float haze = exp(-pow((p.y - bend) * 1.6, 2.0)) * smoothstep(-1.6, 0.6, p.x);
  return col * 0.55 + mix(uC1, uC3, 0.5) * haze * 0.14;
}`,

  aurora: `
vec3 preset(vec2 p, float t, vec2 m) {
  p.x += m.x * 0.08;
  vec3 col = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float h = 0.25 - fi * 0.28 + 0.55 * fbm(vec2(p.x * (0.7 + fi * 0.25) + t * 0.03 + fi * 3.1, t * 0.04 + fi)) + 0.12 * sin(p.x * 1.3 + fi * 2.0 + t * 0.07);
    float dy = p.y - h;
    float body = smoothstep(-0.16, 0.06, dy) * exp(-max(dy, 0.0) * (2.6 + fi * 0.9));
    body *= 0.55 + 0.45 * smoothstep(-0.6, 0.6, fbm(vec2(p.x * 1.7 - t * 0.05, fi * 7.0)));
    float rays = fbm(vec2(p.x * 8.0 + fi * 5.0 + 0.7 * sin(p.y * 2.0 + t * 0.2), t * 0.08 + fi));
    rays = 0.35 + 1.1 * smoothstep(-0.35, 0.45, rays);
    vec3 c = mix(uC1, uC2, smoothstep(0.0, 0.7, dy));
    c = mix(c, uC3, fi * 0.45);
    float edge = exp(-pow(dy * 10.0, 2.0)) * smoothstep(0.2, 0.7, rays * 0.6);
    col += c * (body * rays + edge * 0.6) * (1.0 - fi * 0.25);
  }
  col += mix(uC1, uC3, 0.5) * exp(-pow((p.y + 0.9) * 1.2, 2.0)) * 0.1;
  float stars = step(0.998, hash12(floor(p * 240.0))) * smoothstep(0.2, 0.9, p.y) * 0.7;
  return col * 0.9 + vec3(stars);
}`,

  mesh: `
vec3 preset(vec2 p, float t, vec2 m) {
  vec2 q = p + 0.35 * vec2(fbm(p * 0.7 + t * 0.03), fbm(p * 0.7 - t * 0.025 + 4.0));
  vec2 a = vec2(-0.9 + 0.35 * sin(t * 0.13), 0.35 * cos(t * 0.11));
  vec2 b = vec2(0.85 + 0.3 * cos(t * 0.09), -0.25 + 0.35 * sin(t * 0.12));
  vec2 c = mix(vec2(0.1 * sin(t * 0.07), 0.7), m, 0.35);
  float wa = exp(-dot(q - a, q - a) * 1.4);
  float wb = exp(-dot(q - b, q - b) * 1.5);
  float wc = exp(-dot(q - c, q - c) * 2.0);
  vec3 col = uC1 * wa + uC2 * wb + uC3 * wc;
  float grain = (hash12(gl_FragCoord.xy + floor(t * 24.0)) - 0.5) * 0.05;
  return col * 0.85 + grain;
}`,

  grid: `
vec3 preset(vec2 p, float t, vec2 m) {
  float horizon = 0.06 + m.y * 0.04;
  vec3 col = vec3(0.0);
  float px = 2.0 / uRes.y;
  if (p.y < horizon) {
    float dy = horizon - p.y;
    float z = 0.42 / dy;
    vec2 g = vec2((p.x - m.x * 0.15) * z * 2.6, z * 1.6 + t * 0.8 + uScroll * 8.0);
    vec2 dist = 0.5 - abs(fract(g) - 0.5);
    vec2 aa = vec2(z * px * 2.6, z * z / 0.42 * px * 1.6) * 1.6;
    float lx = (1.0 - smoothstep(0.0, aa.x, dist.x)) * (1.0 - smoothstep(0.02, 0.12, aa.x));
    float lz = (1.0 - smoothstep(0.0, aa.y, dist.y)) * (1.0 - smoothstep(0.02, 0.12, aa.y));
    float lines = max(lx, lz) * exp(-z * 0.05);
    float pulse = pow(0.5 + 0.5 * sin(g.y * 0.25 - t * 1.6), 6.0);
    col += mix(uC1, uC2, pulse) * lines * (1.4 + pulse * 1.6);
    col += mix(uC1, uC3, 0.5) * exp(-dy * 10.0) * 0.6;
  } else {
    float up = p.y - horizon;
    col += mix(uC1, uC3, smoothstep(0.0, 0.8, up)) * exp(-up * 4.0) * 0.6;
    float beam = exp(-abs(p.x - m.x * 0.2) * 2.2) * exp(-up * 1.6);
    col += mix(uC2, uC3, 0.4) * beam * 0.35;
  }
  return col;
}`,
};

// Presets that return colour and alpha (vec4), drawn on a transparent canvas over the host's content
// below them (for example a photograph that the clouds open onto).
const ALPHA_PRESETS = {
  clouds: `
vec4 preset4(vec2 p, float t, vec2 m) {
  float s = uScroll;
  vec3 sky = mix(uC2, uC1, smoothstep(-0.9, 1.0, p.y));
  float thin = smoothstep(0.35, 0.95, s);
  vec3 acc = vec3(0.0);
  float a = 0.0;
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    float z = fract(fi / 7.0 + 0.08 - s * 1.35 - t * 0.006);
    float scale = mix(0.45, 3.0, z);
    vec2 q = p * scale + vec2(fi * 7.3, fi * 3.1) + m * 0.12 * (1.0 - z);
    float d = fbm(q * 0.8 + vec2(t * 0.012, 0.0)) + 0.16 - thin * 0.3;
    float dens = smoothstep(0.12, 0.5, d);
    float fade = smoothstep(0.0, 0.3, z) * smoothstep(1.0, 0.72, z);
    float la = dens * fade;
    float lit = smoothstep(-0.35, 0.35, fbm(q * 1.6 + vec2(3.0, 1.0)) + (q.y - fi * 3.1) * 0.02);
    vec3 col = uC3 * mix(0.74, 1.04, lit);
    col = mix(col, sky, 0.18 * z);
    acc += col * la * (1.0 - a);
    a += la * (1.0 - a);
  }
  // the sky goes first; the last clouds fly past over what is below, then thin out to nothing
  float skyA = 1.0 - smoothstep(0.22, 0.55, s);
  float keep = 1.0 - smoothstep(0.8, 0.99, s);
  vec3 rgb = acc + sky * skyA * (1.0 - a);
  float alpha = a + skyA * (1.0 - a);
  return vec4(rgb / max(alpha, 1e-3), alpha * keep);
}`,
};

const MAIN_ALPHA = `
void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y * 2.0;
  p.x *= uFlip;
  vec2 m = (uPointer - 0.5) * vec2(uRes.x / uRes.y, 1.0) * 2.0;
  vec4 c = preset4(p, uTime, m);
  c.rgb += (hash12(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) / 255.0;
  gl_FragColor = vec4(c.rgb * c.a, c.a);
}`;

const MAIN = `
void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y * 2.0;
  p.x *= uFlip;
  vec2 m = (uPointer - 0.5) * vec2(uRes.x / uRes.y, 1.0) * 2.0;
  m.x *= uFlip;
  vec3 col = preset(p, uTime, m);
  col = 1.0 - exp(-max(col, 0.0) * uIntensity);
  vec3 outc = uBg + col * (1.0 - uBg);
  outc += (hash12(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) / 255.0;
  gl_FragColor = vec4(outc, 1.0);
}`;

export function initShaders(root, env) {
  const layers = [];
  for (const host of root.querySelectorAll('[data-cine-shader]')) {
    const name = host.dataset.cineShader in PRESETS || host.dataset.cineShader in ALPHA_PRESETS ? host.dataset.cineShader : 'ribbons';
    const alpha = name in ALPHA_PRESETS;
    const source = alpha ? HEAD + ALPHA_PRESETS[name] + MAIN_ALPHA : HEAD + PRESETS[name] + MAIN;
    // inside a scene, uScroll is the scene's progress; elsewhere, the host's passage across the screen
    const scene = host.closest('[data-cine-scene]');
    let sceneP = env.reduced ? 1 : 0;
    let layer = null;
    const onProgress = (e) => { sceneP = e.detail; layer?.redraw(); };
    scene?.addEventListener('cine:progress', onProgress);
    const speed = parseFloat(host.dataset.speed) || 1;
    const intensity = parseFloat(host.dataset.intensity) || 1;
    const flip = host.dataset.flip === 'x' ? -1 : 1;
    const pointer = host.dataset.pointer === 'off' ? pointerTracker(host, { ...env, coarse: true }) : pointerTracker(host, env);
    const [c1, c2, c3] = readColors(host);
    const bg = readBg(host);

    layer = glLayer(host, {
      env,
      alpha,
      setup(gl) {
        const program = compile(gl, VS, source);
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(program, 'aPos');
        const u = uniforms(gl, program, ['uRes', 'uTime', 'uPointer', 'uScroll', 'uIntensity', 'uFlip', 'uC1', 'uC2', 'uC3', 'uBg']);
        return { program, buf, loc, u };
      },
      frame(gl, s, { time, dt, w, h, rect }) {
        pointer.update(dt);
        gl.useProgram(s.program);
        gl.bindBuffer(gl.ARRAY_BUFFER, s.buf);
        gl.enableVertexAttribArray(s.loc);
        gl.vertexAttribPointer(s.loc, 2, gl.FLOAT, false, 0, 0);
        gl.uniform2f(s.u.uRes, w, h);
        gl.uniform1f(s.u.uTime, time * speed);
        gl.uniform2f(s.u.uPointer, pointer.value[0], pointer.value[1]);
        gl.uniform1f(s.u.uScroll, scene ? sceneP : viewProgress(rect));
        gl.uniform1f(s.u.uIntensity, intensity);
        gl.uniform1f(s.u.uFlip, flip);
        gl.uniform3fv(s.u.uC1, c1);
        gl.uniform3fv(s.u.uC2, c2);
        gl.uniform3fv(s.u.uC3, c3);
        gl.uniform3fv(s.u.uBg, bg);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
    });
    if (layer && alpha) host.querySelector(':scope > .cine-gl')?.classList.add('cine-gl--over');
    if (layer) layers.push(layer, pointer);
    else pointer.destroy();
    layers.push({ destroy: () => scene?.removeEventListener('cine:progress', onProgress) });
  }
  return () => layers.forEach((l) => l.destroy());
}
