// Footage that plays with the scroll ("Apple" pages, fly-throughs): a sequence of frames drawn on a
// canvas, or a video whose time follows the scroll.
//
//   <div class="cine-sequence" data-cine-sequence data-frames="vuelo/####.webp" data-count="120">
//     <img src="vuelo/0120.webp" alt="…">          ← poster: shown without script and until frames load
//   </div>
//   <div class="cine-sequence" data-cine-sequence data-video="vuelo.mp4"><img src="vuelo.webp" alt="…"></div>
//
// Inside a scene it follows --p; elsewhere, its passage across the screen. #### is the frame number,
// zero-padded, from 1. Frames load coarse first (every 8th, then every 4th…), so a fast scroll always
// has a near frame to show. Make frames with scripts/frames.mjs from any clip. Video needs a server
// that answers Range requests (nginx, Vite) and, for smooth scrubbing, frequent keyframes.
// Options: data-fit ("cover" | "contain"), data-rest ("last" | "first": the frame shown under reduced
// motion and before loading).

import { clamp, damp, viewProgress } from './util.js';

const frameUrl = (pattern, i) => pattern.replace(/#+/, (m) => String(i + 1).padStart(m.length, '0'));

function frameSequence(host, env, draw) {
  const pattern = host.dataset.frames;
  const count = parseInt(host.dataset.count, 10) || 1;
  const frames = new Array(count);
  let alive = true;
  // coarse to fine: 0, 8, 16… then 4, 12… then 2, 6… then the rest
  const order = [];
  for (const stepSize of [8, 4, 2, 1]) for (let i = 0; i < count; i += stepSize) if (!order.includes(i)) order.push(i);
  if (env.reduced) order.splice(0, order.length, host.dataset.rest === 'first' ? 0 : count - 1);
  let next = 0;
  const pump = () => {
    if (!alive || next >= order.length) return;
    const i = order[next++];
    const img = new Image();
    img.decoding = 'async';
    img.src = frameUrl(pattern, i);
    img.decode().then(() => { frames[i] = img; draw(); }).catch(() => {}).finally(pump);
  };
  for (let k = 0; k < 4; k++) pump();
  return {
    count,
    // the loaded frame nearest to i
    at(i) {
      for (let d = 0; d < count; d++) {
        if (frames[i - d]) return frames[i - d];
        if (frames[i + d]) return frames[i + d];
      }
      return null;
    },
    destroy() { alive = false; },
  };
}

export function initSequences(root, env) {
  const undo = [];
  for (const host of root.querySelectorAll('[data-cine-sequence]')) {
    const scene = host.closest('[data-cine-scene]');
    let target = env.reduced ? (host.dataset.rest === 'first' ? 0 : 1) : 0, value = target;

    if (host.dataset.video) {
      const v = document.createElement('video');
      Object.assign(v, { muted: true, playsInline: true, preload: 'auto', src: host.dataset.video });
      v.className = 'cine-sequence__media';
      v.setAttribute('aria-hidden', 'true');
      host.prepend(v);
      let seeking = false, raf = 0, last = 0;
      const seek = () => {
        if (!v.duration || seeking) return;
        const t = clamp(value) * (v.duration - 0.05);
        if (Math.abs(v.currentTime - t) < 1 / 60) return;
        seeking = true;
        v.currentTime = t;
      };
      v.addEventListener('seeked', () => { seeking = false; });
      v.addEventListener('loadedmetadata', seek);
      const tick = (now) => {
        const dt = last ? Math.min(now - last, 100) : 16.7;
        last = now;
        if (!scene) target = viewProgress(host.getBoundingClientRect());
        value += (target - value) * damp(0.2, dt);
        seek();
        raf = Math.abs(target - value) > 0.0005 ? requestAnimationFrame(tick) : ((last = 0), 0);
      };
      const wake = () => { if (!raf && !env.reduced) raf = requestAnimationFrame(tick); };
      const onP = (e) => { target = e.detail; wake(); };
      scene?.addEventListener('cine:progress', onP);
      if (!scene) window.addEventListener('scroll', wake, { passive: true });
      host.classList.add('is-ready');
      undo.push(() => { cancelAnimationFrame(raf); scene?.removeEventListener('cine:progress', onP); window.removeEventListener('scroll', wake); v.remove(); });
      continue;
    }

    const canvas = document.createElement('canvas');
    canvas.className = 'cine-sequence__media';
    canvas.setAttribute('aria-hidden', 'true');
    host.prepend(canvas);
    const ctx = canvas.getContext('2d');
    const fit = host.dataset.fit || 'cover';
    let shown = null;
    const draw = () => {
      const i = Math.round(clamp(value) * (seq.count - 1));
      const img = seq.at(i);
      if (!img) return;
      const w = canvas.width, h = canvas.height;
      const s = (fit === 'contain' ? Math.min : Math.max)(w / img.naturalWidth, h / img.naturalHeight);
      const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
      if (!shown) host.classList.add('is-ready');
      shown = img;
    };
    const seq = frameSequence(host, env, () => draw());
    const resize = () => {
      const r = host.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      draw();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    let raf = 0, last = 0;
    const tick = (now) => {
      const dt = last ? Math.min(now - last, 100) : 16.7;
      last = now;
      if (!scene) target = viewProgress(host.getBoundingClientRect());
      value += (target - value) * damp(0.25, dt);
      draw();
      raf = Math.abs(target - value) > 0.0005 ? requestAnimationFrame(tick) : ((last = 0), 0);
    };
    const wake = () => { if (!raf && !env.reduced) raf = requestAnimationFrame(tick); };
    const onP = (e) => { target = e.detail; wake(); };
    scene?.addEventListener('cine:progress', onP);
    if (!scene) window.addEventListener('scroll', wake, { passive: true });
    undo.push(() => { seq.destroy(); ro.disconnect(); cancelAnimationFrame(raf); scene?.removeEventListener('cine:progress', onP); window.removeEventListener('scroll', wake); canvas.remove(); });
  }
  return () => undo.forEach((f) => f());
}
