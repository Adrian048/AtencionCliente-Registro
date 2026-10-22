// A WebGL point cloud that turns from one shape into the next as the visitor scrolls.
//
//   <section class="cine-scene" data-cine-scene="3">          ← optional: inside a scene it follows --p
//     <div class="cine-stage">
//       <div class="cine-points" data-cine-points="sphere>wave>galaxy"
//            data-colors="#4d8dff,#bfe0ff" data-offset="0.3"></div>
//       …statements…
//
// Shapes: sphere, wave, galaxy, helix, ring (up to four, joined with ">"). Outside a scene the morph
// follows the host's own progress across the viewport. Options: colors (2 CSS colours; else
// --cine-c1/--cine-c2), count (points; 9000 desktop / 4000 phone), offset (moves the cloud sideways,
// -1…1 of the half width, for split layouts; ignored on portrait screens, where the cloud is centred
// and raised), size (point size, 1).
// Under reduced motion it draws the first shape once, still.

import { glLayer, compile, uniforms, readColors, pointerTracker, viewProgress, clamp, damp, lerp } from './util.js';

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SHAPES = {
  sphere(n, r) {
    const out = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const y = 1 - (2 * (i + 0.5)) / n;
      const rad = Math.sqrt(1 - y * y);
      const th = i * 2.399963;
      const j = 1 + (r() - 0.5) * 0.03;
      out.set([Math.cos(th) * rad * j, y * j, Math.sin(th) * rad * j], i * 3);
    }
    return out;
  },
  wave(n) {
    const out = new Float32Array(n * 3);
    const side = Math.ceil(Math.sqrt(n));
    for (let i = 0; i < n; i++) {
      const x = ((i % side) / (side - 1)) * 3.4 - 1.7;
      const z = (Math.floor(i / side) / (side - 1)) * 3.4 - 1.7;
      const y = 0.2 * Math.sin(x * 2.1) * Math.cos(z * 1.7) - 0.3;
      out.set([x, y, z], i * 3);
    }
    return out;
  },
  galaxy(n, r) {
    const out = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const rad = Math.pow(r(), 0.7) * 1.7;
      const arm = (i % 3) * ((Math.PI * 2) / 3);
      const a = arm + rad * 2.4 + ((r() - 0.5) * 0.6) / (rad + 0.25);
      out.set([Math.cos(a) * rad, (r() - 0.5) * 0.12 * (1.8 - rad), Math.sin(a) * rad], i * 3);
    }
    return out;
  },
  helix(n, r) {
    const out = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const a = t * Math.PI * 9 + (i % 2) * Math.PI;
      let x = Math.cos(a) * 0.6, z = Math.sin(a) * 0.6;
      if (i % 9 === 0) { const k = r() * 2 - 1; x *= k; z *= k; }
      out.set([x + (r() - 0.5) * 0.03, (t - 0.5) * 2.3, z + (r() - 0.5) * 0.03], i * 3);
    }
    return out;
  },
  ring(n, r) {
    const out = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      const rad = 1.25 + (r() - 0.5) * 0.28 * (r() + 0.2);
      out.set([Math.cos(a) * rad, (r() - 0.5) * 0.06, Math.sin(a) * rad], i * 3);
    }
    return out;
  },
};

const VS = `
attribute vec3 aA;
attribute vec3 aB;
attribute vec3 aC;
attribute vec3 aD;
attribute float aR;
uniform float uFrom;
uniform float uTo;
uniform float uT;
uniform float uTime;
uniform vec2 uRot;
uniform float uCam;
uniform float uAspect;
uniform float uSize;
uniform vec2 uOffset;
uniform float uScale;
varying float vFade;
varying float vK;

vec3 pick(float k) { return k < 0.5 ? aA : (k < 1.5 ? aB : (k < 2.5 ? aC : aD)); }
vec3 rotY(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z); }
vec3 rotX(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z); }

void main() {
  float tt = clamp(uT * 1.5 - aR * 0.5, 0.0, 1.0);
  tt = tt * tt * (3.0 - 2.0 * tt);
  vec3 p = mix(pick(uFrom), pick(uTo), tt);
  p = rotY(p, sin(tt * 3.1416) * (aR - 0.5) * 1.2);
  p += normalize(p + 1e-4) * sin(uTime * 1.3 + aR * 6.2831) * 0.012;
  p = rotX(rotY(p, uRot.y), uRot.x);
  p.z -= uCam;
  float w = max(-p.z, 0.05);
  gl_Position = vec4(p.x * uScale / uAspect + uOffset.x * w, p.y * uScale + uOffset.y * w, 0.0, w);
  gl_PointSize = uSize * (0.55 + aR * 0.9) / w;
  vFade = clamp(2.6 - w * 0.5, 0.15, 1.0);
  vK = aR;
}`;

const FS = `
precision mediump float;
uniform vec3 uC1;
uniform vec3 uC2;
varying float vFade;
varying float vK;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = dot(d, d) * 4.0;
  if (r > 1.0) discard;
  float a = (1.0 - r);
  a *= a * vFade;
  gl_FragColor = vec4(mix(uC1, uC2, vK) * a * 1.5, a);
}`;

export function initPoints(root, env) {
  const layers = [];
  for (const host of root.querySelectorAll('[data-cine-points]')) {
    const names = host.dataset.cinePoints.split('>').map((s) => s.trim()).filter((s) => s in SHAPES).slice(0, 4);
    if (!names.length) names.push('sphere');
    const n = parseInt(host.dataset.count, 10) || (env.coarse ? 4000 : 9000);
    const offset = parseFloat(host.dataset.offset) || 0;
    const size = parseFloat(host.dataset.size) || 1;
    const [c1, c2] = readColors(host, 2);
    const pointer = pointerTracker(host, env);
    const scene = host.closest('[data-cine-scene]');
    let target = 0, progress = 0;
    const onProgress = (e) => { target = e.detail; };
    scene?.addEventListener('cine:progress', onProgress);

    const layer = glLayer(host, {
      env,
      alpha: true,
      dprCap: 2,
      setup(gl) {
        const program = compile(gl, VS, FS);
        const r = rng(7);
        const attrs = ['aA', 'aB', 'aC', 'aD'].map((name, i) => {
          const data = SHAPES[names[Math.min(i, names.length - 1)]](n, r);
          const buf = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, buf);
          gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
          return { buf, loc: gl.getAttribLocation(program, name), size: 3 };
        });
        const rand = new Float32Array(n).map(() => r());
        const rbuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, rbuf);
        gl.bufferData(gl.ARRAY_BUFFER, rand, gl.STATIC_DRAW);
        attrs.push({ buf: rbuf, loc: gl.getAttribLocation(program, 'aR'), size: 1 });
        const u = uniforms(gl, program, ['uFrom', 'uTo', 'uT', 'uTime', 'uRot', 'uCam', 'uAspect', 'uSize', 'uOffset', 'uScale', 'uC1', 'uC2']);
        return { program, attrs, u };
      },
      frame(gl, s, { time, dt, w, h, rect }) {
        pointer.update(dt);
        if (!scene) target = viewProgress(rect);
        progress = env.reduced ? 0 : lerp(progress, target, damp(0.12, dt));
        const segs = names.length - 1;
        const x = clamp((progress - 0.06) / 0.88) * segs;
        const from = Math.min(Math.floor(x), Math.max(segs - 1, 0));
        const dpr = w / Math.max(rect.width, 1);

        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.useProgram(s.program);
        for (const a of s.attrs) {
          gl.bindBuffer(gl.ARRAY_BUFFER, a.buf);
          gl.enableVertexAttribArray(a.loc);
          gl.vertexAttribPointer(a.loc, a.size, gl.FLOAT, false, 0, 0);
        }
        gl.uniform1f(s.u.uFrom, from);
        gl.uniform1f(s.u.uTo, segs ? from + 1 : 0);
        gl.uniform1f(s.u.uT, segs ? x - from : 0);
        gl.uniform1f(s.u.uTime, time);
        gl.uniform2f(s.u.uRot,
          0.32 + (pointer.value[1] - 0.5) * 0.35,
          time * 0.12 + progress * 2.4 + (pointer.value[0] - 0.5) * 0.6);
        gl.uniform1f(s.u.uCam, 3.6 - Math.sin(progress * Math.PI) * 0.5);
        gl.uniform1f(s.u.uSize, 12 * size * dpr);
        // portrait screens: the layout is stacked, so the cloud is centred, raised and fitted to the width
        const aspect = w / h, portrait = aspect < 0.9;
        gl.uniform2f(s.u.uOffset, portrait ? 0 : offset, portrait ? 0.32 : 0);
        gl.uniform1f(s.u.uScale, portrait ? 2.3 * aspect * 1.15 : 2.3);
        gl.uniform1f(s.u.uAspect, aspect);
        gl.uniform3fv(s.u.uC1, c1);
        gl.uniform3fv(s.u.uC2, c2);
        gl.drawArrays(gl.POINTS, 0, n);
      },
    });
    if (layer) layers.push(layer);
    layers.push(pointer, { destroy: () => scene?.removeEventListener('cine:progress', onProgress) });
  }
  return () => layers.forEach((l) => l.destroy());
}
