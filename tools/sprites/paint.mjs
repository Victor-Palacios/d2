// Painterly hex-canvas renderer — a richer alternative to the flat-band
// compose.mjs, for creatures that should read closer to hand-drawn / generated
// pixel art (volumetric shading, dithered gradients, colored outlines).
//
// Unlike compose.mjs (single-char palette keys), paint.mjs works in raw hex so a
// form can carry a smooth many-step ramp. toPixelArt() assigns palette keys at
// the end (a sprite can hold dozens of colours, well under the ~90 key ceiling).
//
// The core idea: shade each body part as an implied SPHERE. For a pixel inside
// an ellipse we recover a fake surface normal (z = sqrt(1 - r²)), light it with
// a Lambert term, and pick a colour from a dark→light ramp — with ordered
// dithering between steps so the gradient reads smooth at low resolution.

// --- colour maths ----------------------------------------------------------
function toRGB(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function toHex([r, g, b]) { const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'); return '#' + c(r) + c(g) + c(b); }
function mix(a, b, t) { const A = toRGB(a), B = toRGB(b); return toHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]); }
export function shade(h, amt) { const [r, g, b] = toRGB(h); const f = amt < 0 ? 1 + amt : 1; const t = amt > 0 ? amt : 0; return toHex([r * f + 255 * t, g * f + 255 * t, b * f + 255 * t]); }

// Interpolate anchor colours (dark→light) into `steps` evenly-spaced colours.
export function ramp(anchors, steps) {
  const out = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1) * (anchors.length - 1);
    const lo = Math.floor(t), hi = Math.min(anchors.length - 1, lo + 1);
    out.push(mix(anchors[lo], anchors[hi], t - lo));
  }
  return out;
}

const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const norm = (v) => { const m = Math.hypot(...v) || 1; return [v[0] / m, v[1] / m, v[2] / m]; };

// --- canvas ----------------------------------------------------------------
export function canvas(w, h) { const c = Array.from({ length: h }, () => Array(w).fill(null)); c.w = w; c.h = h; return c; }
const inb = (c, x, y) => x >= 0 && y >= 0 && x < c.w && y < c.h;
export function put(c, x, y, hex) { x = Math.round(x); y = Math.round(y); if (inb(c, x, y) && hex) c[y][x] = hex; }
export function flat(c, cx, cy, rx, ry, hex) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const dx = (x - cx) / rx, dy = (y - cy) / ry; if (dx * dx + dy * dy <= 1) put(c, x, y, hex);
  }
}

// Sphere-shade an ellipse into the canvas. anchors: dark→light hex ramp.
// opts: { light, steps, ambient, dither, rim, squash, only } — see defaults.
export function form(c, cx, cy, rx, ry, anchors, opts = {}) {
  const { light = [-0.55, -0.6, 0.58], steps = 8, ambient = 0.32, dither = true, rim = 0, only } = opts;
  const R = ramp(anchors, steps), L = norm(light);
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x - cx) / rx, ny = (y - cy) / ry, r2 = nx * nx + ny * ny;
      if (r2 > 1 || !inb(c, x, y)) continue;
      if (only && !only(x, y)) continue;
      const nz = Math.sqrt(Math.max(0, 1 - r2));
      let lit = ambient + (1 - ambient) * Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
      if (rim > 0) { // back-rim: brighten the thin edge away from the light
        const edge = r2; const facing = -(nx * L[0] + ny * L[1]);
        if (edge > 0.72 && facing > 0.1) lit = Math.min(1, lit + rim * (edge - 0.72) / 0.28);
      }
      let idx = lit * (steps - 1);
      const i0 = Math.floor(idx), frac = idx - i0;
      const i = (dither && frac > BAYER[y & 3][x & 3] / 16) ? Math.min(steps - 1, i0 + 1) : i0;
      c[y][x] = R[Math.max(0, i)];
    }
  }
}

// A crisp specular dot near the light-facing pole.
export function spec(c, cx, cy, rx, ry, hex, opts = {}) {
  const L = norm(opts.light || [-0.55, -0.6, 0.58]);
  put(c, cx + L[0] * rx * 0.55, cy + L[1] * ry * 0.55, hex);
  put(c, cx + L[0] * rx * 0.55 - 1, cy + L[1] * ry * 0.55, hex);
}

// Glossy eyes in hex (white, pupil, two glints). Personality can come later;
// this is the friendly default painted directly onto the canvas.
export function eyes(c, cx, dx, y, rx, ry, { white = '#f4f8ff', pupil = '#16203a', glint = '#ffffff' } = {}) {
  for (const sx of [cx - dx, cx + dx]) {
    flat(c, sx, y, rx, ry, white);
    flat(c, sx, y + ry * 0.12, rx * 0.68, ry * 0.72, pupil);
    flat(c, sx - rx * 0.34, y - ry * 0.38, rx * 0.3, ry * 0.3, glint);
    put(c, sx + rx * 0.4, y + ry * 0.36, glint);
  }
}

// --- silhouette cleanup + colored outline ----------------------------------
function exterior(c) {
  const seen = new Set(), st = [];
  const bg = (x, y) => inb(c, x, y) && c[y][x] === null;
  for (let x = 0; x < c.w; x++) { st.push([x, 0], [x, c.h - 1]); }
  for (let y = 0; y < c.h; y++) { st.push([0, y], [c.w - 1, y]); }
  while (st.length) { const [x, y] = st.pop(), k = x + ',' + y; if (seen.has(k) || !bg(x, y)) continue; seen.add(k); st.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); }
  return seen;
}
export function smooth(c) {
  const body = (x, y) => inb(c, x, y) && c[y][x] !== null;
  const ext = exterior(c), fills = [];
  for (const k of ext) { const [x, y] = k.split(',').map(Number); const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => body(x + dx, y + dy)); if (n.length >= 3) fills.push([x, y, c[y + n[0][1]][x + n[0][0]]]); }
  for (const [x, y, h] of fills) c[y][x] = h;
  const drops = [];
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) { if (c[y][x] === null) continue; const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => body(x + dx, y + dy)).length; if (n <= 1) drops.push([x, y]); }
  for (const [x, y] of drops) c[y][x] = null;
  return c;
}
// Outline the exterior silhouette in a colour (default: a dark tint, not black).
export function outline(c, hex) {
  const body = (x, y) => inb(c, x, y) && c[y][x] !== null;
  const add = [];
  for (const k of exterior(c)) { const [x, y] = k.split(',').map(Number); if (body(x + 1, y) || body(x - 1, y) || body(x, y + 1) || body(x, y - 1)) add.push([x, y]); }
  for (const [x, y] of add) c[y][x] = hex;
  return c;
}

// --- emit { palette, rows } ------------------------------------------------
const KEYS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#@%&*+=<>?!~^';
// Snap each channel to a coarser grid — used to auto-reduce colour count.
function snap(h, step) { if (step <= 1) return h; const [r, g, b] = toRGB(h); const q = (v) => Math.round(v / step) * step; return toHex([q(r), q(g), q(b)]); }
export function toPixelArt(c) {
  // Auto-quantize if a sprite carries more unique colours than we have keys.
  let step = 1;
  for (; step <= 48; step += 3) {
    const u = new Set();
    for (const row of c) for (const h of row) if (h !== null) u.add(snap(h, step));
    if (u.size <= KEYS.length) break;
  }
  const map = new Map(); let n = 0;
  const rows = c.map((row) => row.map((h) => {
    if (h === null) return '.';
    const hs = snap(h, step);
    if (!map.has(hs)) { if (n >= KEYS.length) return '.'; map.set(hs, KEYS[n++]); }
    return map.get(hs);
  }).join(''));
  // trim empty top/bottom
  let out = rows.slice();
  while (out.length && /^\.*$/.test(out[0])) out.shift();
  while (out.length && /^\.*$/.test(out[out.length - 1])) out.pop();
  const palette = { '.': '' };
  for (const [hex, key] of map) palette[key] = hex;
  return { palette, rows: out };
}
