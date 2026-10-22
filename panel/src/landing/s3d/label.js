// Product labels painted on a canvas, so a product needs no image files: a background colour, the brand
// set big and vertical (as on drink cans), the flavour, thin bands and small print. A real label
// (data-label="img/label.webp", 2:1, wraps once around) can replace it.

export async function paintLabel({
  brand = 'BRAND', flavor = '', color = '#e11d48', ink = '#ffffff', accent = null,
  font = 'system-ui, sans-serif', serif = false, width = 2048, height = 1024,
} = {}) {
  const fam = font.split(',')[0].replace(/["']/g, '').trim();
  try { await document.fonts.load(`900 200px "${fam}"`); } catch {}
  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  const g = c.getContext('2d');

  // ground with a soft vertical sheen, so the print does not look flat under reflections
  const grad = g.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, shade(color, -0.18));
  grad.addColorStop(0.5, color);
  grad.addColorStop(1, shade(color, -0.28));
  g.fillStyle = grad;
  g.fillRect(0, 0, width, height);

  // the front of the can is the middle of the texture (u = 0.5 faces the camera)
  const cx = width * 0.5;
  g.save();
  g.translate(cx, height / 2);
  g.rotate(-Math.PI / 2);
  g.fillStyle = ink;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let size = height * 0.36;
  g.font = `${serif ? 400 : 900} ${size}px ${font}`;
  while (g.measureText(brand).width > height * 0.86 && size > 40) { size -= 6; g.font = `${serif ? 400 : 900} ${size}px ${font}`; }
  g.fillText(brand, 0, 0);
  g.restore();

  // flavour, set across, next to the brand
  if (flavor) {
    g.fillStyle = ink;
    g.globalAlpha = 0.92;
    g.font = `700 ${height * 0.045}px ${font}`;
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    const lines = flavor.toUpperCase().split(/\s+/);
    lines.forEach((w, i) => g.fillText(w, cx + size * 0.62, height * 0.58 + i * height * 0.055));
    g.globalAlpha = 1;
  }

  // thin bands top and bottom, and an accent stripe running around
  g.fillStyle = accent || shade(color, 0.35);
  g.fillRect(0, height * 0.06, width, height * 0.012);
  g.fillRect(0, height * 0.928, width, height * 0.012);
  g.globalAlpha = 0.35;
  g.fillRect(cx + size * 0.62, height * 0.42, width * 0.12, height * 0.008);
  g.globalAlpha = 1;

  // small print on the back
  g.fillStyle = ink;
  g.globalAlpha = 0.55;
  g.font = `500 ${height * 0.022}px ${font}`;
  const back = width * 0.02;
  ['330 ml', 'Sin azúcares añadidos', 'Producto de ejemplo', 'Marca ficticia'].forEach((t, i) =>
    g.fillText(t, back + width * 0.05, height * 0.35 + i * height * 0.04));
  g.globalAlpha = 1;
  return c;
}

// Any CSS colour (hex, rgb(), oklch(), color-mix()…) → "#rrggbb", resolved by the browser.
let probe, ctx;
export function toHex(css, fallback = '#888888') {
  const s = (css || '').trim();
  if (!s) return fallback;
  if (/^#[0-9a-f]{6}$/i.test(s)) return s.toLowerCase();
  probe ??= document.createElement('i');
  ctx ??= Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true });
  probe.style.color = '';
  probe.style.color = s;
  if (!probe.style.color) return fallback;
  document.documentElement.append(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = resolved;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

// lighten (amt > 0) or darken (amt < 0) a hex colour
export function shade(hex, amt) {
  const n = hex.replace('#', '');
  const full = n.length === 3 ? [...n].map((h) => h + h).join('') : n.slice(0, 6);
  const rgb = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  const out = rgb.map((v) => Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt)));
  return '#' + out.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}
