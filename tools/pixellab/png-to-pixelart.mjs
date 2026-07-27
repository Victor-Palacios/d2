#!/usr/bin/env node
// Convert generated PNG(s) into the repo's { palette, rows } PixelArt form.
// Decodes, downscales to TARGET, then derives an ADAPTIVE palette via
// median-cut: up to COLORS (default 48) colours, but fewer when the image has
// few real hues. Keys stay within the 62 clean alphanumeric characters, so the
// result is always a valid, on-roster, asset-free sprite. Full workflow:
// docs/adding-monsters.md
//
//   MONSTER=lastlight node tools/pixellab/png-to-pixelart.mjs [targetSize]
//   MONSTER="a,b,c" COLORS=48 node png-to-pixelart.mjs        # loops over each id
//   # reads out/<id>.png -> out/<id>.art.txt + out/<id>-pixelart.png

import { readFileSync, writeFileSync } from "node:fs";
import { inflateSync, deflateSync } from "node:zlib";
import { MONSTERS } from "./monsters.mjs";

const IDS = (process.env.MONSTER || "lastlight").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const TARGET = Number(process.argv[2]) || 64;          // 64px standard (monsters.mjs SIZE)
const COLORS = Math.min(Number(process.env.COLORS) || 48, 62); // cap; 62 clean keys available
const RANGE_MIN = Number(process.env.RANGE_MIN) || 8;   // stop splitting tight colour boxes (adaptivity)
const ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"; // '.' reserved = transparent

// --- minimal PNG decoder (8-bit, colour type 2/6, non-interlaced, all filters) ---
function decodePNG(buf) {
  let p = 8, w, h, ct, idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString("ascii", p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9]; }
    else if (type === "IDAT") idat.push(data); else if (type === "IEND") break;
    p += 12 + len;
  }
  const bpp = ct === 6 ? 4 : 3, raw = inflateSync(Buffer.concat(idat)), stride = w * bpp, out = Buffer.alloc(h * stride);
  const pa = (a, b, c) => { const q = a + b - c, da = Math.abs(q - a), db = Math.abs(q - b), dc = Math.abs(q - c); return da <= db && da <= dc ? a : db <= dc ? b : c; };
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)], row = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) {
      const rv = raw[row + x], A = x >= bpp ? out[y * stride + x - bpp] : 0, B = y > 0 ? out[(y - 1) * stride + x] : 0, C = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp] : 0;
      out[y * stride + x] = (ft === 0 ? rv : ft === 1 ? rv + A : ft === 2 ? rv + B : ft === 3 ? rv + ((A + B) >> 1) : rv + pa(A, B, C)) & 255;
    }
  }
  return { w, h, bpp, data: out };
}

// Adaptive median-cut: split the widest colour box until we hit `cap` boxes or
// every box is tighter than RANGE_MIN (so simple images use fewer colours).
function medianCut(px, cap) {
  let boxes = [px];
  while (boxes.length < cap) {
    let bi = -1, br = -1, ax = 0;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i]; if (b.length < 2) continue;
      const mn = [255, 255, 255], mx = [0, 0, 0];
      for (const p of b) for (let c = 0; c < 3; c++) { if (p[c] < mn[c]) mn[c] = p[c]; if (p[c] > mx[c]) mx[c] = p[c]; }
      const rg = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]];
      const a = rg[0] >= rg[1] && rg[0] >= rg[2] ? 0 : rg[1] >= rg[2] ? 1 : 2;
      if (rg[a] > br) { br = rg[a]; bi = i; ax = a; }
    }
    if (bi < 0 || br < RANGE_MIN) break; // adaptive stop
    const b = boxes[bi]; b.sort((p, q) => p[ax] - q[ax]);
    const m = b.length >> 1;
    boxes.splice(bi, 1, b.slice(0, m), b.slice(m));
  }
  return boxes.filter((b) => b.length).map((b) => { const s = [0, 0, 0]; for (const p of b) for (let c = 0; c < 3; c++) s[c] += p[c]; return [Math.round(s[0] / b.length), Math.round(s[1] / b.length), Math.round(s[2] / b.length)]; });
}
const hex = ([r, g, b]) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
const nearest = (pal, r, g, b) => { let bi = 0, bd = Infinity; for (let i = 0; i < pal.length; i++) { const d = (r - pal[i][0]) ** 2 + (g - pal[i][1]) ** 2 + (b - pal[i][2]) ** 2; if (d < bd) { bd = d; bi = i; } } return bi; };

function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return (~c) >>> 0; }
function ch2(t, d) { const l = Buffer.alloc(4); l.writeUInt32BE(d.length, 0); const tb = Buffer.from(t); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(Buffer.concat([tb, d])), 0); return Buffer.concat([l, tb, d, cr]); }

function convert(id) {
  if (!MONSTERS[id]) { console.error(`✗ Unknown MONSTER "${id}".`); return false; }
  const SRC = (IDS.length === 1 && process.env.SRC) ? process.env.SRC : `out/${id}.png`;
  const { w, h, bpp, data } = decodePNG(readFileSync(SRC));
  const bx = w / TARGET, by = h / TARGET;

  // 1. Downscale to a TARGET grid of {r,g,b,a} cells.
  const cells = [];
  for (let ty = 0; ty < TARGET; ty++) for (let tx = 0; tx < TARGET; tx++) {
    let r = 0, g = 0, bb = 0, a = 0, n = 0;
    for (let sy = Math.floor(ty * by); sy < Math.ceil((ty + 1) * by); sy++)
      for (let sx = Math.floor(tx * bx); sx < Math.ceil((tx + 1) * bx); sx++) {
        const i = sy * w * bpp + sx * bpp, al = bpp === 4 ? data[i + 3] : 255;
        a += al; if (al > 40) { r += data[i]; g += data[i + 1]; bb += data[i + 2]; n++; }
      }
    const covered = (Math.ceil((ty + 1) * by) - Math.floor(ty * by)) * (Math.ceil((tx + 1) * bx) - Math.floor(tx * bx));
    cells.push((a / covered < 110 || n === 0) ? null : [r / n, g / n, bb / n]);
  }

  // 2. Derive adaptive palette from the opaque cells.
  const pal = medianCut(cells.filter(Boolean).map((c) => c.map(Math.round)), COLORS);

  // 3. Map cells to palette chars; keep only used colours.
  const usedIdx = new Set();
  const idxGrid = cells.map((c) => { if (!c) return -1; const i = nearest(pal, c[0], c[1], c[2]); usedIdx.add(i); return i; });
  const order = [...usedIdx];
  const key = new Map(order.map((i, n) => [i, ALPHABET[n]]));
  const palette = order.map((i) => [key.get(i), hex(pal[i])]);

  const rows = [];
  for (let ty = 0; ty < TARGET; ty++) { let row = ""; for (let tx = 0; tx < TARGET; tx++) { const i = idxGrid[ty * TARGET + tx]; row += i < 0 ? "." : key.get(i); } rows.push(row); }

  writeFileSync(`out/${id}.art.txt`,
    `  ${id}: {\n    palette: { ` + palette.map(([c, hx]) => `${c}: '${hx}'`).join(", ") +
    " },\n    rows: [\n" + rows.map((r) => `      '${r}',`).join("\n") + "\n    ],\n  },\n");

  // preview upscaled on the game's dark background
  const colFor = new Map(palette.map(([c, hx]) => [c, [parseInt(hx.slice(1, 3), 16), parseInt(hx.slice(3, 5), 16), parseInt(hx.slice(5, 7), 16)]]));
  const S = 8, PW = TARGET * S, bg = [19, 17, 32], praw = Buffer.alloc((PW * 3 + 1) * PW); let o = 0;
  for (let y = 0; y < PW; y++) { praw[o++] = 0; for (let x = 0; x < PW; x++) { const c = rows[Math.floor(y / S)][Math.floor(x / S)]; const col = c === "." ? bg : colFor.get(c); praw[o++] = col[0]; praw[o++] = col[1]; praw[o++] = col[2]; } }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(PW, 0); ih.writeUInt32BE(PW, 4); ih[8] = 8; ih[9] = 2;
  writeFileSync(`out/${id}-pixelart.png`, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), ch2("IHDR", ih), ch2("IDAT", deflateSync(praw)), ch2("IEND", Buffer.alloc(0))]));

  console.log(`✓ ${id}: ${w}x${h} -> ${TARGET}x${TARGET}, ${palette.length} colours (cap ${COLORS})`);
  return true;
}

let ok = true;
for (const id of IDS) ok = convert(id) && ok;
if (!ok) process.exit(1);
