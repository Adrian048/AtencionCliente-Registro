// Effects under the hand. Fine pointers with hover only; on touch and under reduced motion they stay still.
//
//   [data-cine-tilt]         the card leans towards the pointer (--rx, --ry; data-cine-tilt="8" = max
//                            degrees) and a glare follows it (--gx, --gy, --go)
//   [data-cine-magnetic]     the element is pulled towards the pointer (--mx, --my through `translate`;
//                            data-cine-magnetic="0.35" = strength)
//   [data-cine-spotlight]    on a group: every .cine-spot inside gets --sx/--sy (pointer position in its
//                            own box, px) and --so (0/1), for a light that follows the pointer across
//                            borders and surfaces (Linear-style cards)

import { damp, lerp } from './util.js';

const UNITS = { '--rx': 'deg', '--ry': 'deg', '--gx': '%', '--gy': '%', '--go': '', '--mx': 'px', '--my': 'px' };

function animator() {
  const items = new Set();
  let raf = 0, last = 0;
  const tick = (now) => {
    const dt = last ? Math.min(now - last, 100) : 16.7;
    last = now;
    let moving = false;
    for (const it of items) if (it.step(dt)) moving = true;
    raf = moving ? requestAnimationFrame(tick) : 0;
    if (!moving) last = 0;
  };
  return {
    add: (it) => items.add(it),
    wake: () => { if (!raf) raf = requestAnimationFrame(tick); },
    stop: () => cancelAnimationFrame(raf),
  };
}

function eased(el, names, k) {
  const cur = Object.fromEntries(names.map((n) => [n, 0]));
  const target = { ...cur };
  return {
    target,
    step(dt) {
      const a = damp(k, dt);
      let moving = false;
      for (const n of names) {
        const v = lerp(cur[n], target[n], a);
        cur[n] = Math.abs(target[n] - v) < 0.001 ? target[n] : v;
        if (cur[n] !== target[n]) moving = true;
        el.style.setProperty(n, cur[n].toFixed(3) + UNITS[n]);
      }
      return moving;
    },
  };
}

export function initPointer(root, env) {
  const offs = [];
  if (!env.finePointer || env.reduced) return () => {};
  const anim = animator();
  const on = (el, type, fn) => { el.addEventListener(type, fn, { passive: true }); offs.push(() => el.removeEventListener(type, fn)); };

  for (const el of root.querySelectorAll('[data-cine-tilt]')) {
    const max = parseFloat(el.dataset.cineTilt) || 7;
    const e = eased(el, ['--rx', '--ry', '--gx', '--gy', '--go'], 0.14);
    anim.add(e);
    on(el, 'pointermove', (ev) => {
      const r = el.getBoundingClientRect();
      const x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
      Object.assign(e.target, { '--ry': (x - 0.5) * 2 * max, '--rx': -(y - 0.5) * 2 * max, '--gx': x * 100, '--gy': y * 100, '--go': 1 });
      anim.wake();
    });
    on(el, 'pointerleave', () => { Object.assign(e.target, { '--rx': 0, '--ry': 0, '--go': 0 }); anim.wake(); });
  }

  for (const el of root.querySelectorAll('[data-cine-magnetic]')) {
    const strength = parseFloat(el.dataset.cineMagnetic) || 0.3;
    const e = eased(el, ['--mx', '--my'], 0.16);
    anim.add(e);
    on(el, 'pointermove', (ev) => {
      const r = el.getBoundingClientRect();
      e.target['--mx'] = (ev.clientX - (r.left + r.width / 2)) * strength;
      e.target['--my'] = (ev.clientY - (r.top + r.height / 2)) * strength;
      anim.wake();
    });
    on(el, 'pointerleave', () => { e.target['--mx'] = 0; e.target['--my'] = 0; anim.wake(); });
  }

  for (const group of root.querySelectorAll('[data-cine-spotlight]')) {
    const spots = [...group.querySelectorAll('.cine-spot')];
    on(group, 'pointermove', (ev) => {
      for (const s of spots) {
        const r = s.getBoundingClientRect();
        s.style.setProperty('--sx', `${(ev.clientX - r.left).toFixed(1)}px`);
        s.style.setProperty('--sy', `${(ev.clientY - r.top).toFixed(1)}px`);
      }
      group.classList.add('is-lit');
    });
    on(group, 'pointerleave', () => group.classList.remove('is-lit'));
  }

  return () => { anim.stop(); offs.forEach((f) => f()); };
}
