// Choreography driven by one number, the scroll progress p (0–1): keyframes for the camera and for
// any named object, plus behaviours that run on their own (spin, float), explode/assemble for groups
// and billboards. The same code animates a can, a tower, a shield or a city.

import { Vector3, MathUtils } from 'three';

const smooth = (t) => t * t * (3 - 2 * t);
const mix = (a, b, t) => (Array.isArray(a) ? a.map((v, i) => v + ((b[i] ?? v) - v) * t) : a + (b - a) * t);

// keys: [{ at: 0, pos: [...], rot: [...], scale: 1, opacity: 1, ease: "linear" }, …]
export function sample(keys, p, prop) {
  const ks = keys.filter((k) => k[prop] !== undefined);
  if (!ks.length) return undefined;
  if (p <= ks[0].at) return ks[0][prop];
  const last = ks[ks.length - 1];
  if (p >= last.at) return last[prop];
  for (let i = 0; i < ks.length - 1; i++) {
    const a = ks[i], b = ks[i + 1];
    if (p < b.at) {
      let t = (p - a.at) / Math.max(b.at - a.at, 1e-6);
      if (b.ease !== 'linear') t = smooth(t);
      return mix(a[prop], b[prop], t);
    }
  }
  return last[prop];
}

const deg = (a) => a.map((v) => MathUtils.degToRad(v));
const asVec = (s) => (Array.isArray(s) ? s : [s, s, s]);

function setOpacity(obj, op) {
  obj.traverse((o) => {
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      const base = m.userData.baseOpacity ?? 1;
      m.transparent = m.transparent || op < 1;
      m.opacity = base * op;
      m.depthWrite = op > 0.98;
    }
    if (o.material?.uniforms?.uOpacity) o.material.uniforms.uOpacity.value = op;
  });
  obj.visible = op > 0.002;
}

// explode: { distance: 1.5, axis: "radial" | "x" | "y" | "z", from: 0.2, to: 0.7, stagger: 0.5, reverse: false,
//           match: "unit-" (only the children whose name starts so) }
// radial: away from the group's centre; x: alternately left and right; y: up (spread: more for higher
// pieces); z: towards the camera
// reverse: true assembles (pieces start apart and come together as p grows)
function explodeGroup(obj, ex, p) {
  const kids = ex.match ? obj.children.filter((k) => k.name.startsWith(ex.match)) : obj.children;
  const n = kids.length;
  const from = ex.from ?? 0, to = ex.to ?? 1, stagger = ex.stagger ?? 0.4, dist = ex.distance ?? 1.5;
  kids.forEach((k, i) => {
    const base = k.userData.base?.pos;
    if (!base) return;
    k.userData.dir ??= ex.axis && ex.axis !== 'radial'
      ? new Vector3(ex.axis === 'x' ? 1 : 0, ex.axis === 'y' ? 1 : 0, ex.axis === 'z' ? 1 : 0).multiplyScalar(ex.axis === 'x' ? (i % 2 ? 1 : -1) : 1)
      : (base.lengthSq() > 1e-6 ? base.clone().normalize() : new Vector3(0, 1, 0));
    const span = (to - from) * (1 - stagger);
    const start = from + (to - from) * stagger * (n > 1 ? i / (n - 1) : 0);
    let e = smooth(Math.min(1, Math.max(0, (p - start) / Math.max(span, 1e-6))));
    if (ex.reverse) e = 1 - e;
    k.position.copy(base).addScaledVector(k.userData.dir, dist * e * (ex.axis === 'y' ? 1 + i * (ex.spread ?? 0) : 1));
  });
}

export function createChoreography({ root, camera, spec, env, named }) {
  const cam = spec.camera || {};
  const camKeys = (spec.timeline || []).map((k) => ({ at: k.at, ease: k.ease, cpos: k.camera?.pos, clook: k.camera?.look, fov: k.camera?.fov }));
  const look = new Vector3(...(cam.look || [0, 0, 0]));
  const animated = [];
  root.traverse((o) => { if (o.userData.keys || o.userData.spin || o.userData.float || o.userData.explode || o.userData.billboard) animated.push(o); });
  // keys can also be given from the timeline: { at, set: { name: { pos, rot, scale, opacity } } }
  for (const k of spec.timeline || []) {
    for (const [name, props] of Object.entries(k.set || {})) {
      const o = named.get(name);
      if (!o) continue;
      (o.userData.keys ||= []).push({ at: k.at, ease: k.ease, ...props });
      if (!animated.includes(o)) animated.push(o);
    }
  }
  animated.forEach((o) => o.userData.keys?.sort((a, b) => a.at - b.at));
  const spins = new Map();

  return function apply(p, dt, t, pointer) {
    // camera
    if (camKeys.length) {
      const cp = sample(camKeys, p, 'cpos'), cl = sample(camKeys, p, 'clook'), fov = sample(camKeys, p, 'fov');
      if (cp) camera.userData.basePos = new Vector3(...cp);
      if (cl) look.set(...cl);
      if (fov && Math.abs(camera.fov - fov) > 1e-3) { camera.fov = fov; camera.updateProjectionMatrix(); }
    }
    const bp = camera.userData.basePos;
    if (bp) {
      const fit = camera.userData.fit ?? 1;
      camera.position.set(bp.x * fit, bp.y, bp.z * fit);
    }
    if (pointer && spec.parallax !== 0 && !env.reduced) {
      const k = spec.parallax ?? 0.25;
      camera.position.x += (pointer[0] - 0.5) * k;
      camera.position.y += (pointer[1] - 0.5) * k * 0.6;
    }
    camera.lookAt(look);

    // objects
    for (const o of animated) {
      const u = o.userData, keys = u.keys || [], base = u.base;
      const pos = sample(keys, p, 'pos'), rot = sample(keys, p, 'rot'), scale = sample(keys, p, 'scale'), op = sample(keys, p, 'opacity');
      if (pos) o.position.set(...pos); else if (base) o.position.copy(base.pos);
      if (rot) o.rotation.set(...deg(rot)); else if (base) o.rotation.copy(base.rot);
      if (scale !== undefined) o.scale.set(...asVec(scale)); else if (base) o.scale.copy(base.scale);
      if (op !== undefined) setOpacity(o, op);
      if (u.spin && !env.reduced) {
        const a = (spins.get(o) || 0) + u.spin * dt;
        spins.set(o, a);
        o.rotation.y += a;
      }
      if (u.float && !env.reduced) {
        const amp = typeof u.float === 'number' ? u.float : 0.06;
        o.position.y += Math.sin(t * 1.15 + o.id) * amp;
        o.rotation.z += Math.sin(t * 0.8 + o.id) * amp * 0.4;
      }
      if (u.explode) explodeGroup(o, u.explode, p);
      if (u.billboard) o.quaternion.copy(camera.quaternion);
    }
  };
}
