// Pieces shared by scenes and carousels: reading specs and vars from the HTML, scroll progress, drag
// and pointer.

const RESERVED = new Set(['s3d', 's3dRing', 'spec', 'src', 'recipe', 'light', 'floor', 'scroll', 'turns', 'tilt',
  'zoom', 'spin', 'offset', 'follow', 'distance', 'drag', 'float', 'progress', 'layout', 'gap', 'radius', 'start',
  'bg', 'themePage', 'desc', 'scale']);

// every other data-* attribute is a recipe variable: data-brand="…" → {{brand}} / vars.brand
export function varsFrom(el) {
  const v = {};
  // numbers arrive as text from HTML: "1.4" → 1.4, so recipes can do arithmetic with them
  for (const [k, val] of Object.entries(el.dataset)) if (!RESERVED.has(k)) v[k] = /^-?\d+(\.\d+)?$/.test(val.trim()) ? parseFloat(val) : val;
  v.font ||= getComputedStyle(el).getPropertyValue('--s3d-font').trim() || undefined;
  return v;
}

export async function readJSON(ref) {
  if (!ref) return null;
  if (ref.startsWith('#')) {
    const el = document.querySelector(ref);
    if (!el) throw new Error(`no element ${ref} for the scene description`);
    return JSON.parse(el.textContent);
  }
  return (await fetch(ref)).json();
}

export const num2 = (s, fb) => {
  const v = (s || '').split(',').map(parseFloat);
  return v.length === 2 && v.every(Number.isFinite) ? v : fb;
};

// Progress 0–1: the enclosing cinematic-web scene (cine:progress) when there is one, else the host's
// own passage across the viewport. Eased.
export function scrollSource(host, env) {
  const scene = host.closest('[data-cine-scene]');
  let target = 0, value = 0, first = true;
  const on = (e) => { target = e.detail; };
  scene?.addEventListener('cine:progress', on);
  return {
    value(dt) {
      if (!scene) {
        const r = host.getBoundingClientRect(), vh = window.innerHeight;
        target = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
      }
      if (env.reduced || first) { first = false; return (value = target); }
      value += (target - value) * (1 - Math.pow(0.0005, dt));
      return value;
    },
    destroy: () => scene?.removeEventListener('cine:progress', on),
  };
}

// Horizontal drag turns things (vertical drags still scroll the page on touch: touch-action pan-y).
// A press on a control is a click, never a drag; elsewhere the drag starts after a few pixels.
export function dragRotate(host, stage, env, { onTurn, onEnd } = {}) {
  let angle = 0, vel = 0, down = false, lastX = 0, lastT = 0, pending = null;
  host.style.touchAction = 'pan-y';
  const px = () => 5 / Math.max(host.clientWidth, 1);
  const start = (e) => {
    if (e.button > 0 || e.target.closest('button, a, input, select, textarea, label, summary')) return;
    pending = { id: e.pointerId, x: e.clientX };
  };
  const move = (e) => {
    if (pending && !down) {
      if (Math.abs(e.clientX - pending.x) < 6) return;
      down = true; lastX = e.clientX; lastT = performance.now(); vel = 0;
      host.setPointerCapture?.(pending.id);
      host.classList.add('is-dragging');
      pending = null;
      return;
    }
    if (!down) return;
    const now = performance.now();
    const d = (e.clientX - lastX) * px();
    angle += d;
    vel = d / Math.max(now - lastT, 1) * 16;
    lastX = e.clientX; lastT = now;
    onTurn?.(d);
    stage.wake();
  };
  const end = () => {
    pending = null;
    if (!down) return;
    down = false;
    host.classList.remove('is-dragging');
    onEnd?.(vel);
  };
  host.addEventListener('pointerdown', start);
  host.addEventListener('pointermove', move);
  host.addEventListener('pointerup', end);
  host.addEventListener('pointercancel', end);
  stage.updates.add((dt) => {
    if (!down) {
      angle += vel;
      vel *= Math.pow(env.reduced ? 0.001 : 0.04, dt);
    }
  });
  return {
    get angle() { return angle; },
    get dragging() { return down; },
    destroy() {
      host.removeEventListener('pointerdown', start);
      host.removeEventListener('pointermove', move);
      host.removeEventListener('pointerup', end);
      host.removeEventListener('pointercancel', end);
    },
  };
}

// Pointer over the host in 0–1, eased (fine pointers only), for camera parallax.
export function pointerOver(host, env) {
  const value = [0.5, 0.5], target = [0.5, 0.5];
  if (env.coarse || env.reduced) return { value, update() {}, destroy() {} };
  const on = (e) => {
    const r = host.getBoundingClientRect();
    target[0] = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    target[1] = Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height));
  };
  window.addEventListener('pointermove', on, { passive: true });
  return {
    value,
    update(dt) { const k = 1 - Math.pow(0.02, dt); value[0] += (target[0] - value[0]) * k; value[1] += (target[1] - value[1]) * k; },
    destroy: () => window.removeEventListener('pointermove', on),
  };
}
