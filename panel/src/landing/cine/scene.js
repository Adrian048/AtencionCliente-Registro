// Scroll progress, written as plain numbers into CSS so the choreography lives in CSS with calc().
//
//   [data-cine-scene="3"]   a pinned scene: the section is (3 + 1) screens tall, its .cine-stage sticks
//                           for 3 screens and --p runs 0 → 1 across them. The section gets .is-live
//                           while it runs as a scene; without it (no script, reduced motion) it is an
//                           ordinary section showing its finished composition (.is-rest, --p: 1).
//   [data-cine-progress]    any element: --pv runs 0 → 1 while it crosses the viewport (no pinning).
//   [data-cine-index]       numbers its children: --i on each (0, 1, …) and --n (the count) on itself.
//
// Each scene also dispatches `cine:progress` (detail = progress) so scripts can follow it (points.js).
// Native scroll only: nothing captures the wheel. On fine pointers the written value eases towards the
// real one (data-cine-ease, 0.18 of the gap per frame; 1 = no easing), which gives scrubbed motion weight.

import { clamp, damp, viewProgress } from './util.js';

export function initScenes(root, env) {
  for (const list of root.querySelectorAll('[data-cine-index]')) {
    const kids = [...list.children];
    list.style.setProperty('--n', kids.length);
    kids.forEach((el, i) => el.style.setProperty('--i', i));
  }

  const items = [];
  for (const el of root.querySelectorAll('[data-cine-scene]')) {
    el.style.setProperty('--hold', parseFloat(el.dataset.cineScene) || 2);
    if (env.reduced) {
      el.classList.add('is-rest');
      el.style.setProperty('--p', 1);
      el.dispatchEvent(new CustomEvent('cine:progress', { detail: 1 }));
      continue;
    }
    el.classList.add('is-live');
    items.push({ el, scene: true, prop: '--p', value: -1, target: 0, ease: parseFloat(el.dataset.cineEase) || 0.18 });
  }
  for (const el of root.querySelectorAll('[data-cine-progress]')) {
    if (env.reduced) { el.style.setProperty('--pv', 1); continue; }
    items.push({ el, scene: false, prop: '--pv', value: -1, target: 0, ease: parseFloat(el.dataset.cineEase) || 0.18 });
  }
  if (!items.length) return () => {};

  let raf = 0, last = 0;
  const measure = () => {
    const vh = window.innerHeight;
    for (const it of items) {
      const r = it.el.getBoundingClientRect();
      if (it.scene) {
        const total = r.height - vh;
        it.target = total > 0 ? clamp(-r.top / total) : (r.top < 0 ? 1 : 0);
      } else {
        it.target = viewProgress(r);
      }
    }
  };
  const tick = (now) => {
    const dt = last ? Math.min(now - last, 100) : 16.7;
    last = now;
    measure();
    let moving = false;
    for (const it of items) {
      const k = env.coarse || it.value < 0 ? 1 : damp(it.ease, dt);
      const next = it.value < 0 ? it.target : it.value + (it.target - it.value) * k;
      const settled = Math.abs(it.target - next) < 0.0004;
      const v = settled ? it.target : next;
      if (v !== it.value) {
        it.value = v;
        it.el.style.setProperty(it.prop, v.toFixed(4));
        if (it.scene) {
          it.el.classList.toggle('is-active', v > 0 && v < 1);
          it.el.dispatchEvent(new CustomEvent('cine:progress', { detail: v }));
        }
      }
      if (!settled) moving = true;
    }
    raf = moving ? requestAnimationFrame(tick) : 0;
    if (!moving) last = 0;
  };
  const wake = () => { if (!raf) raf = requestAnimationFrame(tick); };

  window.addEventListener('scroll', wake, { passive: true });
  window.addEventListener('resize', wake);
  wake();
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('scroll', wake);
    window.removeEventListener('resize', wake);
  };
}
