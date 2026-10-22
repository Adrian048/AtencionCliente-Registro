// A carousel of 3D things: [data-s3d-ring]. Anything the scene builder can make — a product, a
// building, a device, a logo, a model — one per item. The chosen one stands in front and turns; the
// others wait on an arc (or in a row) behind it, fading into the background. Choose with the buttons,
// ← →, a horizontal drag or the item list. Each item may carry a colour: on choosing, the stage is lit
// with it and it is announced (event s3d:select, --s3d-color; on <html> too with data-theme-page).
//
//   <section class="s3d-ring" data-s3d-ring data-floor="pedestal" data-theme-page tabindex="0"
//            aria-roledescription="carrusel" aria-label="…">
//     <ul class="s3d-items">
//       <li><button class="s3d-item" data-recipe="tower" data-floors="20" data-color="#a07a4f">Torre Norte</button></li>
//       <li><button class="s3d-item" data-spec="#casa-jardin" data-color="#5f8f4e">Casa jardín</button></li>
//       …
//     </ul>
//     <button data-s3d-prev aria-label="Anterior">←</button> <button data-s3d-next aria-label="Siguiente">→</button>
//     <p data-s3d-live aria-live="polite"></p>
//   </section>
//
// An item is built from data-spec (a JSON node: "#id" or a file) or from data-recipe + its other
// data-* attributes as vars. Options on the ring: data-recipe (default recipe for items), data-layout
// ("arc" | "row"), data-radius, data-gap, data-floor, data-light, data-start, data-bg (fog colour),
// data-distance (camera).

import { Color } from 'three';
import { Stage } from './stage.js';
import { buildNode } from './build.js';
import { readJSON, varsFrom, dragRotate } from './shared.js';
import { toHex } from './label.js';

const wrap = (v, n) => ((v % n) + n) % n;

export async function itemNode(item, ring) {
  if (item.dataset.spec) return readJSON(item.dataset.spec);
  const scale = parseFloat(item.dataset.scale);
  return { recipe: item.dataset.recipe || ring?.dataset.recipe || 'can', vars: varsFrom(item), ...(scale ? { scale } : {}) };
}

export async function mountRing(host, env) {
  const items = [...host.querySelectorAll('.s3d-item')];
  const n = items.length;
  if (!n) return () => {};
  const bg = toHex(host.dataset.bg || getComputedStyle(host).getPropertyValue('--s3d-bg') || getComputedStyle(document.body).backgroundColor, '#08080a');
  const stage = new Stage(host, env, {
    floor: host.dataset.floor || 'pedestal', light: host.dataset.light || 'studio',
    camera: { pos: [0, 0.35, parseFloat(host.dataset.distance) || 9] }, fog: 9, fogColor: bg,
  });
  const ctx = { renderer: stage.renderer, named: new Map(), vars: {} };
  const nodes = await Promise.all(items.map((it) => itemNode(it, host)));
  const objs = await Promise.all(nodes.map((node) => buildNode(node, ctx)));
  const colors = items.map((it) => toHex(it.dataset.color, '#ffffff'));
  objs.forEach((o, i) => { stage.scene.add(o); items[i].style.setProperty('--swatch', colors[i]); });

  const row = host.dataset.layout === 'row';
  const gap = parseFloat(host.dataset.gap) || 1.25;
  const R = parseFloat(host.dataset.radius) || 4.6;
  const step = Math.min(0.55, (Math.PI * 2) / n);
  const spinSpeed = env.reduced ? 0 : 0.45;
  const tilts = objs.map((_, i) => (i % 2 ? 1 : -1) * (0.16 + ((i * 7) % 5) * 0.03) * (host.dataset.tilt === 'false' ? 0 : 1));
  const spins = objs.map(() => 0);
  let cursor = 0, target = 0, active = -1;
  const live = host.querySelector('[data-s3d-live]');

  const choose = (i, { announce = true } = {}) => {
    const idx = wrap(i, n);
    let d = idx - wrap(Math.round(target), n);
    if (d > n / 2) d -= n;
    if (d < -n / 2) d += n;
    target = Math.round(target) + d;
    if (idx === active) return;
    active = idx;
    const it = items[idx], color = colors[idx];
    stage.setTheme(color);
    items.forEach((b, j) => b.setAttribute('aria-pressed', String(j === idx)));
    host.style.setProperty('--s3d-color', color);
    if (host.hasAttribute('data-theme-page')) document.documentElement.style.setProperty('--s3d-color', color);
    if (live && announce) live.textContent = it.textContent.trim();
    host.dispatchEvent(new CustomEvent('s3d:select', { bubbles: true, detail: { index: idx, color, item: it, node: nodes[idx], name: it.textContent.trim() } }));
  };

  const drag = dragRotate(host, stage, env, {
    onTurn: (d) => { target -= d * 0.75; cursor = target; },
    onEnd: (vel) => choose(Math.round(target - vel * 4)),
  });
  const onClick = (e) => {
    const b = e.target.closest('.s3d-item, [data-s3d-prev], [data-s3d-next]');
    if (!b || !host.contains(b)) return;
    if (b.hasAttribute('data-s3d-prev')) choose(active - 1);
    else if (b.hasAttribute('data-s3d-next')) choose(active + 1);
    else choose(items.indexOf(b));
    stage.wake();
  };
  const onKey = (e) => {
    if (e.target.closest('input, textarea, select')) return;
    if (e.key === 'ArrowLeft') { choose(active - 1); e.preventDefault(); }
    if (e.key === 'ArrowRight') { choose(active + 1); e.preventDefault(); }
  };
  host.addEventListener('click', onClick);
  host.addEventListener('keydown', onKey);

  stage.updates.add((dt) => {
    if (!drag.dragging) cursor += (target - cursor) * (1 - Math.pow(env.reduced ? 1e-9 : 0.002, dt));
    objs.forEach((p, i) => {
      let k = i - cursor;
      k -= n * Math.round(k / n);
      const a = row ? k * 0.12 : k * step;
      const near = Math.max(0, 1 - Math.abs(k));
      if (row) p.position.set(k * gap, near * 0.12, -Math.abs(k) * 0.35);
      else p.position.set(Math.sin(a) * R, near * 0.12, Math.cos(a) * R - R);
      if (near > 0.5) spins[i] += spinSpeed * dt * near;
      p.rotation.set(0, -a * 0.8 + spins[i] + drag.angle * near * 0.3, tilts[i] * (1 - near) + -0.08 * near);
      p.scale.copy(p.userData.base.scale).multiplyScalar(0.78 + 0.32 * near);
    });
  });

  choose(parseInt(host.dataset.start, 10) || 0, { announce: false });
  cursor = target;
  host.classList.add('is-3d');
  stage.wake();
  return () => {
    drag.destroy();
    host.removeEventListener('click', onClick);
    host.removeEventListener('keydown', onKey);
    stage.dispose();
    host.classList.remove('is-3d');
  };
}
