// Particles that take the shape of anything in the scene (sampled from its surfaces) or of a built-in
// shape, and pass from one shape to the next as p grows:
//   { "type": "particles", "name": "dust", "targets": ["shield", "globe", "tower"], "at": [0.1, 0.5, 0.9],
//     "count": 9000, "colors": ["#4d8dff", "#bfe0ff"], "size": 1, "hide": true }
// targets: names of nodes in the scene, or "sphere" | "galaxy" | "helix" | "wave" | "ring" | "cube".
// hide: true hides the target meshes (the particles stand in for them).

import { BufferGeometry, BufferAttribute, Points, ShaderMaterial, AdditiveBlending, Color, Vector3, Matrix4, Quaternion } from 'three';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';
import { toHex } from './label.js';

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SHAPES = {
  sphere(n, r, s = 1.2) { const o = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const y = 1 - (2 * (i + 0.5)) / n, rad = Math.sqrt(1 - y * y), th = i * 2.399963; o.set([Math.cos(th) * rad * s, y * s, Math.sin(th) * rad * s], i * 3); } return o; },
  galaxy(n, r) { const o = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const rad = Math.pow(r(), 0.7) * 1.8, a = (i % 3) * 2.094 + rad * 2.4 + (r() - 0.5) * 0.6 / (rad + 0.25); o.set([Math.cos(a) * rad, (r() - 0.5) * 0.12 * (1.8 - rad), Math.sin(a) * rad], i * 3); } return o; },
  helix(n, r) { const o = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const t = i / n, a = t * Math.PI * 9 + (i % 2) * Math.PI; let x = Math.cos(a) * 0.6, z = Math.sin(a) * 0.6; if (i % 9 === 0) { const k = r() * 2 - 1; x *= k; z *= k; } o.set([x, (t - 0.5) * 2.4, z], i * 3); } return o; },
  wave(n) { const o = new Float32Array(n * 3), side = Math.ceil(Math.sqrt(n)); for (let i = 0; i < n; i++) { const x = (i % side) / (side - 1) * 3.6 - 1.8, z = Math.floor(i / side) / (side - 1) * 3.6 - 1.8; o.set([x, 0.2 * Math.sin(x * 2.1) * Math.cos(z * 1.7) - 0.6, z], i * 3); } return o; },
  ring(n, r) { const o = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = r() * Math.PI * 2, rad = 1.3 + (r() - 0.5) * 0.3; o.set([Math.cos(a) * rad, (r() - 0.5) * 0.06, Math.sin(a) * rad], i * 3); } return o; },
  cube(n, r) { const o = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const f = Math.floor(r() * 6), a = r() * 2 - 1, b = r() * 2 - 1, s = f % 2 ? 1 : -1; const p = f < 2 ? [s, a, b] : f < 4 ? [a, s, b] : [a, b, s]; o.set(p.map((v) => v * 0.9), i * 3); } return o; },
};

// sample n points over every mesh under obj, in root space, in proportion to surface area
function sampleObject(obj, n, rootInv) {
  const meshes = [];
  obj.updateWorldMatrix(true, true);
  obj.traverse((o) => { if (o.isMesh && o.geometry?.attributes.position) meshes.push(o); });
  if (!meshes.length) return SHAPES.sphere(n);
  const samplers = meshes.map((m) => {
    const geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry;
    const tmp = m.clone(); tmp.geometry = geo;
    const s = new MeshSurfaceSampler(tmp).build();
    const area = s.distribution ? s.distribution[s.distribution.length - 1] : 1;
    const scale = new Vector3();
    m.matrixWorld.decompose(new Vector3(), new Quaternion(), scale);
    return { s, m, area: area * Math.abs(scale.x * scale.y + scale.y * scale.z + scale.x * scale.z) / 3 };
  });
  const total = samplers.reduce((a, b) => a + b.area, 0) || 1;
  const out = new Float32Array(n * 3), p = new Vector3(), mat = new Matrix4();
  let k = 0;
  samplers.forEach((sm, idx) => {
    const count = idx === samplers.length - 1 ? n - k : Math.round(n * sm.area / total);
    mat.multiplyMatrices(rootInv, sm.m.matrixWorld);
    for (let i = 0; i < count && k < n; i++, k++) {
      sm.s.sample(p);
      p.applyMatrix4(mat);
      out.set([p.x, p.y, p.z], k * 3);
    }
  });
  return out;
}

const VS = `
attribute vec3 aA; attribute vec3 aB; attribute vec3 aC; attribute vec3 aD; attribute float aR;
uniform float uFrom; uniform float uTo; uniform float uT; uniform float uTime; uniform float uSize; uniform float uPR;
varying float vK; varying float vFade;
vec3 pick(float k) { return k < 0.5 ? aA : (k < 1.5 ? aB : (k < 2.5 ? aC : aD)); }
void main() {
  float tt = clamp(uT * 1.5 - aR * 0.5, 0.0, 1.0);
  tt = tt * tt * (3.0 - 2.0 * tt);
  vec3 p = mix(pick(uFrom), pick(uTo), tt);
  float sw = sin(tt * 3.1416) * (aR - 0.5) * 0.9;
  p.xz = mat2(cos(sw), -sin(sw), sin(sw), cos(sw)) * p.xz;
  p += normalize(p + 1e-4) * sin(uTime * 1.3 + aR * 6.2831) * 0.01;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * uPR * (0.55 + aR * 0.9) * 22.0 / max(-mv.z, 0.1);
  vFade = clamp(1.6 - (-mv.z) * 0.08, 0.25, 1.0);
  vK = aR;
}`;
const FS = `
uniform vec3 uC1; uniform vec3 uC2; uniform float uOpacity;
varying float vK; varying float vFade;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = dot(d, d) * 4.0;
  if (r > 1.0) discard;
  float a = (1.0 - r); a *= a * vFade * uOpacity;
  gl_FragColor = vec4(mix(uC1, uC2, vK) * a * 1.4, a);
}`;

export function buildParticles(root, named, renderer, env) {
  const systems = [];
  root.updateWorldMatrix(true, true);
  root.traverse((holder) => {
    const spec = holder.userData.particles;
    if (!spec) return;
    // shapes are taken where they stand, in the particles' own space: put the particles node where the
    // shapes are (same pos) and built-in shapes appear there too
    const rootInv = holder.matrixWorld.clone().invert();
    const n = spec.count ?? (env.coarse ? 4000 : 9000);
    const r = rng(spec.seed ?? 7);
    const targets = (spec.targets || ['sphere']).slice(0, 4);
    const sets = targets.map((t) => {
      if (SHAPES[t]) return SHAPES[t](n, r);
      const o = named.get(t);
      if (!o) { console.warn(`[s3d] particles: no node named "${t}"`); return SHAPES.sphere(n, r); }
      const pts = sampleObject(o, n, rootInv);
      if (spec.hide) o.visible = false;
      return pts;
    });
    // shuffle each set so points do not travel in bands between shapes
    sets.forEach((s) => { for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); for (let c = 0; c < 3; c++) { const t = s[i * 3 + c]; s[i * 3 + c] = s[j * 3 + c]; s[j * 3 + c] = t; } } });
    const geo = new BufferGeometry();
    ['aA', 'aB', 'aC', 'aD'].forEach((name, i) => geo.setAttribute(name, new BufferAttribute(sets[Math.min(i, sets.length - 1)], 3)));
    geo.setAttribute('position', geo.getAttribute('aA'));
    geo.setAttribute('aR', new BufferAttribute(new Float32Array(n).map(() => r()), 1));
    const [c1, c2] = spec.colors || ['#4d8dff', '#cfe3ff'];
    const mat = new ShaderMaterial({
      vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, blending: AdditiveBlending,
      uniforms: {
        uFrom: { value: 0 }, uTo: { value: 0 }, uT: { value: 0 }, uTime: { value: 0 },
        uSize: { value: spec.size ?? 1 }, uPR: { value: renderer.getPixelRatio() },
        uC1: { value: new Color(toHex(c1)) }, uC2: { value: new Color(toHex(c2)) }, uOpacity: { value: 1 },
      },
    });
    const pts = new Points(geo, mat);
    pts.frustumCulled = false;
    holder.add(pts);
    const at = spec.at || targets.map((_, i) => (targets.length > 1 ? 0.1 + 0.8 * i / (targets.length - 1) : 0));
    systems.push({ mat, at, count: targets.length });
  });
  return function update(p, t) {
    for (const s of systems) {
      const u = s.mat.uniforms;
      u.uTime.value = env.reduced ? 0 : t;
      if (s.count < 2) continue;
      let i = 0;
      while (i < s.count - 2 && p >= s.at[i + 1]) i++;
      const local = Math.min(1, Math.max(0, (p - s.at[i]) / Math.max(s.at[i + 1] - s.at[i], 1e-6)));
      u.uFrom.value = i; u.uTo.value = i + 1; u.uT.value = local;
    }
  };
}
