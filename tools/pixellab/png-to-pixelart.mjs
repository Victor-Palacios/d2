#!/usr/bin/env node
// Convert a generated PNG into the repo's { palette, rows } PixelArt form.
// Decodes the PNG, downscales, and snaps every pixel to the monster's registry
// palette so the result is a clean, on-roster sprite ready to paste into
// src/assets/art.ts. Writes an art literal + a scaled preview. Full workflow:
// docs/adding-monsters.md
//
//   MONSTER=lastlight node tools/pixellab/png-to-pixelart.mjs [targetSize]
//   # reads out/<id>.png -> out/<id>.art.txt + out/<id>-pixelart.png

import { readFileSync, writeFileSync } from "node:fs";
import { inflateSync, deflateSync } from "node:zlib";
import { MONSTERS } from "./monsters.mjs";

const ID = (process.env.MONSTER || "lastlight").toLowerCase();
const TARGET = Number(process.argv[2]) || 24;
const spec = MONSTERS[ID];
if (!spec) { console.error(`✗ Unknown MONSTER "${ID}".`); process.exit(1); }
const SRC = process.env.SRC || `out/${ID}.png`;

// char -> hex, using stable letters. Order defines nearest-colour tie-breaks.
const LETTERS = ["k", "m", "a", "f", "y", "g", "d", "w", "e", "W"];
const PAL = Object.fromEntries(spec.palette.map((hex, i) => [LETTERS[i], hex]));
const PALRGB = Object.entries(PAL).map(([ch, hex]) => [ch, [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]]);

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
      const rv = raw[row + x], a = x >= bpp ? out[y * stride + x - bpp] : 0, b = y > 0 ? out[(y - 1) * stride + x] : 0, c = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp] : 0;
      out[y * stride + x] = (ft === 0 ? rv : ft === 1 ? rv + a : ft === 2 ? rv + b : ft === 3 ? rv + ((a + b) >> 1) : rv + pa(a, b, c)) & 255;
    }
  }
  return { w, h, bpp, data: out };
}

const { w, h, bpp, data } = decodePNG(readFileSync(SRC));
const bx = w / TARGET, by = h / TARGET;
const nearest = (r, g, b) => { let best = LETTERS[0], bd = Infinity; for (const [ch, [pr, pg, pb]] of PALRGB) { const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2; if (d < bd) { bd = d; best = ch; } } return best; };

const rows = [];
for (let ty = 0; ty < TARGET; ty++) {
  let row = "";
  for (let tx = 0; tx < TARGET; tx++) {
    let r = 0, g = 0, bb = 0, a = 0, n = 0;
    for (let sy = Math.floor(ty * by); sy < Math.ceil((ty + 1) * by); sy++)
      for (let sx = Math.floor(tx * bx); sx < Math.ceil((tx + 1) * bx); sx++) {
        const i = sy * w * bpp + sx * bpp, al = bpp === 4 ? data[i + 3] : 255;
        a += al; if (al > 40) { r += data[i]; g += data[i + 1]; bb += data[i + 2]; n++; }
      }
    const cells = (Math.ceil((ty + 1) * by) - Math.floor(ty * by)) * (Math.ceil((tx + 1) * bx) - Math.floor(tx * bx));
    row += (a / cells < 110 || n === 0) ? "." : nearest(r / n, g / n, bb / n);
  }
  rows.push(row);
}

const used = {}; for (const r of rows) for (const ch of r) if (ch !== ".") used[ch] = PAL[ch];
writeFileSync(`out/${ID}.art.txt`,
  `  ${ID}: {\n    palette: { ` + Object.entries(used).map(([c, hex]) => `${c}: '${hex}'`).join(", ") +
  " },\n    rows: [\n" + rows.map((r) => `      '${r}',`).join("\n") + "\n    ],\n  },\n");

// scaled preview on the game's dark background
function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return (~c) >>> 0; }
function ch2(t, d) { const l = Buffer.alloc(4); l.writeUInt32BE(d.length, 0); const tb = Buffer.from(t); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(Buffer.concat([tb, d])), 0); return Buffer.concat([l, tb, d, cr]); }
const S = 12, PW = TARGET * S, bg = [19, 17, 32], praw = Buffer.alloc((PW * 3 + 1) * PW); let o = 0;
for (let y = 0; y < PW; y++) { praw[o++] = 0; for (let x = 0; x < PW; x++) { const c = rows[Math.floor(y / S)][Math.floor(x / S)]; let col = bg; if (c !== ".") { const hx = PAL[c]; col = [parseInt(hx.slice(1, 3), 16), parseInt(hx.slice(3, 5), 16), parseInt(hx.slice(5, 7), 16)]; } praw[o++] = col[0]; praw[o++] = col[1]; praw[o++] = col[2]; } }
const ih = Buffer.alloc(13); ih.writeUInt32BE(PW, 0); ih.writeUInt32BE(PW, 4); ih[8] = 8; ih[9] = 2;
writeFileSync(`out/${ID}-pixelart.png`, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), ch2("IHDR", ih), ch2("IDAT", deflateSync(praw)), ch2("IEND", Buffer.alloc(0))]));

console.log(`✓ ${ID}: ${w}x${h} -> ${TARGET}x${TARGET}, colours: ${Object.keys(used).join("")}`);
console.log(`  wrote out/${ID}.art.txt and out/${ID}-pixelart.png`);
