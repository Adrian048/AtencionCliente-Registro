// scene-3d: entry. Built into kit/scene3d.js (three.js included, one ES module, no CDN):
//
//   <link rel="stylesheet" href="kit/scene3d.css">
//   <script type="module" src="kit/scene3d.js"></script>
//
// Starts every [data-s3d] (a scene) and [data-s3d-ring] (a carousel). In a framework, put
// data-s3d-manual on <html> and call init(container); it returns a function that undoes it all.
// The building blocks are exported too (buildNode, RECIPES, Stage…) for scenes written in code.

import { mountScene } from './scene.js';
import { mountRing } from './ring.js';

const mq = (q) => window.matchMedia(q).matches;

function webgl() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

export async function init(root = document) {
  if (!webgl()) return () => {};
  const env = { reduced: mq('(prefers-reduced-motion: reduce)'), coarse: mq('(pointer: coarse)') };
  // carousels first, so scenes that follow one (data-follow) find it ready
  const rings = await Promise.allSettled([...root.querySelectorAll('[data-s3d-ring]')].map((el) => mountRing(el, env)));
  const scenes = await Promise.allSettled([...root.querySelectorAll('[data-s3d]')].map((el) => mountScene(el, env)));
  const undo = [...rings, ...scenes].map((r) => {
    if (r.status === 'rejected') console.error('[s3d]', r.reason);
    return r.value;
  });
  document.documentElement.classList.add('s3d-ready');
  return () => undo.forEach((fn) => fn && fn());
}

export { mountScene, mountRing };
export { buildNode } from './build.js';
export { RECIPES } from './recipes.js';
export { Stage } from './stage.js';
export { MATERIAL_NAMES } from './materials.js';

if (!document.documentElement.hasAttribute('data-s3d-manual')) init();
