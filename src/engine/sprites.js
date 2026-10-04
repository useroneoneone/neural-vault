// Pre-rendered radial glow sprites. drawImage() of a cached sprite with
// 'lighter' compositing is ~10x cheaper than ctx.shadowBlur.

const rgbCache = new Map();
export function hexToRgb(hex) {
  let v = rgbCache.get(hex);
  if (v) return v;
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  rgbCache.set(hex, v);
  return v;
}

export function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

const spriteCache = new Map();
export function glow(hex, core = 1) {
  const key = hex + core;
  let c = spriteCache.get(key);
  if (c) return c;
  const S = 64;
  c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const [r, gg, b] = hexToRgb(hex);
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, `rgba(255,255,255,${core})`);
  grd.addColorStop(0.1, `rgba(${r},${gg},${b},0.95)`);
  grd.addColorStop(0.32, `rgba(${r},${gg},${b},0.32)`);
  grd.addColorStop(0.65, `rgba(${r},${gg},${b},0.06)`);
  grd.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  spriteCache.set(key, c);
  return c;
}

export function sprite(ctx, img, x, y, size, alpha) {
  if (alpha <= 0.003) return;
  ctx.globalAlpha = alpha > 1 ? 1 : alpha;
  ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
}
