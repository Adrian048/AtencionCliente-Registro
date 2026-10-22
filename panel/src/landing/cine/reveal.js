// Entrances, counters and marquees.
//
//   [data-cine-reveal]           enters once when it reaches the screen: "up" (default), "mask"
//                                (opens from the bottom edge), "scale", "blur", "clip" (a picture
//                                opening from a framed window). The look lives in cine.css.
//   [data-cine-stagger="up"]     its children enter one after another in that manner (--i set here).
//   [data-cine-count]            the number in the element counts up from 0 once on screen. The final
//                                number is written in the HTML, so without the script it is right.
//                                data-decimals, data-prefix and data-suffix keep the format.
//   [data-cine-marquee]          its .cine-track is duplicated (aria-hidden) and runs in a loop;
//                                it pauses on hover and stands still under reduced motion.

import { clamp } from './util.js';

const fmt = new Map();
function format(n, decimals) {
  if (!fmt.has(decimals)) fmt.set(decimals, new Intl.NumberFormat(document.documentElement.lang || 'es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }));
  return fmt.get(decimals).format(n);
}

function countUp(el) {
  const decimals = parseInt(el.dataset.decimals, 10) || 0;
  const end = parseFloat(el.dataset.cineCount);
  const pre = el.dataset.prefix || '', post = el.dataset.suffix || '';
  const dur = 1400, t0 = performance.now();
  const step = (now) => {
    const t = clamp((now - t0) / dur);
    const e = 1 - Math.pow(1 - t, 4);
    el.textContent = pre + format(end * e, decimals) + post;
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function initReveal(root, env) {
  for (const group of root.querySelectorAll('[data-cine-stagger]')) {
    const manner = group.dataset.cineStagger || 'up';
    [...group.children].forEach((el, i) => {
      if (!el.hasAttribute('data-cine-reveal')) el.setAttribute('data-cine-reveal', manner);
      el.style.setProperty('--i', i);
    });
  }

  for (const m of root.querySelectorAll('[data-cine-marquee]')) {
    const track = m.querySelector('.cine-track');
    if (!track || m.querySelector('.cine-track[aria-hidden]')) continue;
    const copy = track.cloneNode(true);
    copy.setAttribute('aria-hidden', 'true');
    copy.querySelectorAll('a, button').forEach((a) => a.setAttribute('tabindex', '-1'));
    track.after(copy);
    if (!env.reduced) m.classList.add('is-running');
  }

  const reveals = [...root.querySelectorAll('[data-cine-reveal]')];
  const counts = [...root.querySelectorAll('[data-cine-count]')];
  if (env.reduced) {
    reveals.forEach((el) => el.classList.add('is-in'));
    return () => {};
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const el = e.target;
      io.unobserve(el);
      if (el.hasAttribute('data-cine-count')) countUp(el);
      else el.classList.add('is-in');
    }
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.01 });
  reveals.forEach((el) => io.observe(el));
  counts.forEach((el) => io.observe(el));
  return () => io.disconnect();
}
