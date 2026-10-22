// Shared helpers for the kit: maths, colours and the WebGL layer (canvas, loop, pauses, quality).

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
// Frame-rate independent smoothing: `k` is the share of the gap closed per 60 Hz frame.
export const damp = (k, dt) => 1 - Math.pow(1 - k, dt / 16.667);
export const mq = (q) => window.matchMedia(q).matches;

// Any CSS colour the browser understands (hex, rgb(), oklch(), color-mix()…) → sRGB [r, g, b] in 0–1.
// The value is resolved by the style engine on a probe element, then painted into one canvas pixel.
let probeEl, probeCtx;
export function toRGB(value, fallback = [1, 1, 1]) {
  const s = (value || '').trim();
  if (!s) return fallback;
  if (!probeEl) {
    probeEl = document.createElement('i');
    probeEl.hidden = true;
    probeCtx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    probeCtx.canvas.width = probeCtx.canvas.height = 1;
  }
  probeEl.style.color = '';
  probeEl.style.color = s;
  if (!probeEl.style.color) return fallback;
  document.documentElement.append(probeEl);
  const resolved = getComputedStyle(probeEl).color;
  probeEl.remove();
  probeCtx.clearRect(0, 0, 1, 1);
  probeCtx.fillStyle = '#000';
  probeCtx.fillStyle = resolved;
  probeCtx.fillRect(0, 0, 1, 1);
  const [r, g, b] = probeCtx.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255];
}

// Colours for an effect: data-colors="a,b,c" first, then the CSS custom properties --cine-c1…3.
export function readColors(el, count = 3) {
  const list = (el.dataset.colors || '').split(',').map((s) => s.trim()).filter(Boolean);
  const css = getComputedStyle(el);
  return Array.from({ length: count }, (_, i) =>
    toRGB(list[i] || css.getPropertyValue(`--cine-c${i + 1}`), [0.3, 0.55, 1]));
}

export function readBg(el) {
  return toRGB(el.dataset.bg || getComputedStyle(el).getPropertyValue('--cine-bg'), [0.03, 0.03, 0.04]);
}

export function compile(gl, vsSource, fsSource) {
  const shader = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader compile failed');
    return s;
  };
  const p = gl.createProgram();
  gl.attachShader(p, shader(gl.VERTEX_SHADER, vsSource));
  gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fsSource));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'program link failed');
  return p;
}

export function uniforms(gl, program, names) {
  return Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(program, n)]));
}

// A canvas behind `host` that draws with WebGL. `setup(gl)` returns state; `frame(gl, state, info)` draws.
// Runs only while the host is on screen and the tab is visible; draws one still frame under reduced motion;
// lowers its resolution by itself when frames keep running long. Returns null when WebGL is unavailable,
// so the host keeps its CSS fallback.
export function glLayer(host, { env, alpha = false, dprCap = 1.5, setup, frame }) {
  const canvas = document.createElement('canvas');
  canvas.className = 'cine-gl';
  canvas.setAttribute('aria-hidden', 'true');
  const opts = { alpha, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' };
  const gl = canvas.getContext('webgl2', opts) || canvas.getContext('webgl', opts);
  if (!gl) return null;

  let state;
  try {
    state = setup(gl);
  } catch (e) {
    console.warn('[cine] WebGL setup failed, keeping the CSS fallback:', e.message);
    return null;
  }
  host.prepend(canvas);

  const cap = env.coarse ? Math.min(dprCap, 1.25) : dprCap;
  let scale = 1, w = 1, h = 1, raf = 0, running = false, visible = false;
  let last = 0, slow = 0, frames = 0;
  const t0 = performance.now();

  const draw = (now, dt = 16.7) => {
    const time = env.reduced ? 6 : (now - t0) / 1000;
    frame(gl, state, { time, dt, w, h, rect: host.getBoundingClientRect() });
  };
  const resize = () => {
    const r = host.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, cap) * scale;
    w = Math.max(1, Math.round(r.width * dpr));
    h = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h);
    if (!running) draw(performance.now());
  };
  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(now - last, 100);
    last = now;
    draw(now, dt);
    frames++;
    if (dt > 26) slow++;
    if (frames === 90) {
      if (slow > 40 && scale > 0.5) { scale *= 0.75; resize(); }
      frames = slow = 0;
    }
  };
  const start = () => {
    if (running || env.reduced) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(loop);
  };
  const stop = () => { running = false; cancelAnimationFrame(raf); };

  const ro = new ResizeObserver(resize);
  ro.observe(host);
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !document.hidden) start(); else stop();
  }, { rootMargin: '120px 0px' });
  io.observe(host);
  const onVisibility = () => (document.hidden ? stop() : visible && start());
  document.addEventListener('visibilitychange', onVisibility);
  const onLost = (e) => { e.preventDefault(); stop(); host.classList.remove('is-gl'); };
  canvas.addEventListener('webglcontextlost', onLost);

  resize();
  requestAnimationFrame(() => host.classList.add('is-gl'));

  return {
    redraw: () => { if (!running) draw(performance.now()); },
    destroy() {
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onLost);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      canvas.remove();
      host.classList.remove('is-gl');
    },
  };
}

// Pointer position over `host` in 0–1 (y up, like gl_FragCoord), eased. Fine pointers only.
export function pointerTracker(host, env) {
  const target = [0.5, 0.5], value = [0.5, 0.5];
  if (env.coarse || env.reduced) return { value, update() {}, destroy() {} };
  const onMove = (e) => {
    const r = host.getBoundingClientRect();
    target[0] = clamp((e.clientX - r.left) / r.width);
    target[1] = clamp(1 - (e.clientY - r.top) / r.height);
  };
  window.addEventListener('pointermove', onMove, { passive: true });
  return {
    value,
    update(dt) {
      const k = damp(0.06, dt);
      value[0] = lerp(value[0], target[0], k);
      value[1] = lerp(value[1], target[1], k);
    },
    destroy: () => window.removeEventListener('pointermove', onMove),
  };
}

// Progress (0–1) of an element crossing the viewport: 0 when its top meets the bottom edge, 1 when its
// bottom leaves the top edge.
export function viewProgress(rect) {
  const vh = window.innerHeight;
  return clamp((vh - rect.top) / (vh + rect.height));
}
