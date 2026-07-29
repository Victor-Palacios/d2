// Rasterize a { palette, rows } PixelArt to an upscaled PNG on a dark bg, and
// compose side-by-side comparison strips. Uses only Node built-ins (zlib) — no
// deps, matches the repo's asset-free rule. Previews are written to out/ (which
// is git-ignored); they are for eyeballing only and never committed.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePNG(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit, RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // no filter
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
function hexToRGB(s) {
  s = s.trim();
  if (s.startsWith('#')) {
    if (s.length === 4) s = '#' + [...s.slice(1)].map((c) => c + c).join('');
    const n = parseInt(s.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (m) { const p = m[1].split(',').map((x) => parseFloat(x)); return [p[0], p[1], p[2]]; }
  return [255, 0, 255];
}

export function renderArt(art, { scale = 12, bg = '#141622', pad = 3 } = {}) {
  const w = art.rows.reduce((m, r) => Math.max(m, r.length), 0);
  const h = art.rows.length;
  const rows = art.rows.map((r) => r.padEnd(w, '.'));
  const W = (w + pad * 2) * scale, H = (h + pad * 2) * scale;
  const [br, bgv, bb] = hexToRGB(bg);
  const out = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) {
    const t = y / H;
    const r = Math.round(br * (1 - t * 0.35)), g = Math.round(bgv * (1 - t * 0.35)), b = Math.round(bb * (1 - t * 0.25));
    for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = 255; }
  }
  const put = (px, py, r, g, b) => {
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const X = (px + pad) * scale + dx, Y = (py + pad) * scale + dy;
      const i = (Y * W + X) * 4; out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = 255;
    }
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const key = rows[y][x];
    if (key === '.' || key === ' ') continue;
    const col = art.palette[key]; if (!col) continue;
    const [r, g, b] = hexToRGB(col); put(x, y, r, g, b);
  }
  return encodePNG(W, H, out);
}

export function save(path, art, opts) { writeFileSync(path, renderArt(art, opts)); }

// Rasterize an art to a flat RGBA buffer at an integer scale, on a solid bg.
export function rasterize(art, { scale = 12, bg = [20, 22, 34], pad = 2 } = {}) {
  const w = art.rows.reduce((m, r) => Math.max(m, r.length), 0);
  const h = art.rows.length;
  const rows = art.rows.map((r) => r.padEnd(w, '.'));
  const W = (w + pad * 2) * scale, H = (h + pad * 2) * scale;
  const buf = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) { buf[i * 4] = bg[0]; buf[i * 4 + 1] = bg[1]; buf[i * 4 + 2] = bg[2]; buf[i * 4 + 3] = 255; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const key = rows[y][x]; if (key === '.' || key === ' ') continue;
    const col = art.palette[key]; if (!col) continue;
    const [r, g, b] = hexToRGB(col);
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const X = (x + pad) * scale + dx, Y = (y + pad) * scale + dy, i = (Y * W + X) * 4;
      buf[i] = r; buf[i + 1] = g; buf[i + 2] = b;
    }
  }
  return { W, H, buf };
}

function paste(dst, dstW, tile, ox, oy) {
  for (let y = 0; y < tile.H; y++) for (let x = 0; x < tile.W; x++) {
    const s = (y * tile.W + x) * 4, d = ((oy + y) * dstW + (ox + x)) * 4;
    dst[d] = tile.buf[s]; dst[d + 1] = tile.buf[s + 1]; dst[d + 2] = tile.buf[s + 2]; dst[d + 3] = 255;
  }
}

// Lay {W,H,buf} tiles left-to-right, vertically centred, with gaps + dividers.
export function row(path, tiles, { gap = 24, bg = [12, 13, 22] } = {}) {
  const H = Math.max(...tiles.map((t) => t.H));
  const W = tiles.reduce((s, t) => s + t.W, 0) + gap * (tiles.length + 1);
  const out = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) { out[i * 4] = bg[0]; out[i * 4 + 1] = bg[1]; out[i * 4 + 2] = bg[2]; out[i * 4 + 3] = 255; }
  let x = gap;
  for (let k = 0; k < tiles.length; k++) {
    const t = tiles[k];
    paste(out, W, t, x, Math.floor((H - t.H) / 2));
    x += t.W;
    if (k < tiles.length - 1) {
      const dx = x + Math.floor(gap / 2);
      for (let y = 0; y < H; y++) { const i = (y * W + dx) * 4; out[i] = 60; out[i + 1] = 62; out[i + 2] = 80; }
    }
    x += gap;
  }
  writeFileSync(path, encodePNG(W, H, out));
  return { W, H };
}
