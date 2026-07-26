#!/usr/bin/env node
// Reimagine Nightnip via the PixelLab API (pixflux text-to-image).
//
// STAGING ONLY. This writes generated art to ./out for review — it does NOT
// modify src/assets/art.ts or src/data/creatures.ts, and nothing it produces
// is committed (the repo stays asset-free; see CLAUDE.md). Run it in CI (the
// pixellab-nightnip workflow) or locally:
//
//   PIXEL_LAB_API_KEY=... node tools/pixellab/reimagine-nightnip.mjs
//   open out/preview.html      # original 16x16  vs.  the PixelLab render
//
// Nightnip = impish bat rookie, assassin / dark. We force the sprite's real
// palette (via a synthesized swatch image — pixflux's `color_image` input) and
// pick style options that match the roster's flat, black-outlined look.

import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";

const KEY = process.env.PIXEL_LAB_API_KEY;
if (!KEY) {
  console.error("✗ PIXEL_LAB_API_KEY is not set. Export it (or configure it as an Actions secret) and re-run.");
  process.exit(1);
}

// --- Tunables --------------------------------------------------------------
const SIZE = Number(process.env.SIZE) || 64; // px, square. Try SIZE=32 for a closer 16x16 drop-in.
const FORCE_PALETTE = process.env.FORCE_PALETTE !== "0"; // set FORCE_PALETTE=0 to let PixelLab pick colors.
const DESCRIPTION =
  "a small impish bat creature, dark violet fur, wide spread membrane wings, " +
  "big glowing amber eyes, tiny fangs, mischievous pose, retro RPG monster sprite";

// Nightnip's canonical palette (from art.ts): outline, body, highlight, eyes, wing-shade.
const PALETTE = ["#1a1024", "#6b4d9e", "#f2e8ff", "#ffd166", "#3c2b5c"];
// ---------------------------------------------------------------------------

// --- Minimal dependency-free truecolor PNG encoder (for the palette swatch) ---
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function pngFromColors(hexes, w = 64, h = 64) {
  // A normal square image split into vertical stripes of each palette colour.
  const rgb = hexes.map((x) => [parseInt(x.slice(1, 3), 16), parseInt(x.slice(3, 5), 16), parseInt(x.slice(5, 7), 16)]);
  const stripe = Math.ceil(w / hexes.length);
  const raw = Buffer.alloc((w * 3 + 1) * h);
  let o = 0;
  for (let y = 0; y < h; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < w; x++) { const [r, g, b] = rgb[Math.min(hexes.length - 1, Math.floor(x / stripe))]; raw[o++] = r; raw[o++] = g; raw[o++] = b; }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit, truecolor RGB
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

const BASE = {
  description: DESCRIPTION,
  image_size: { width: SIZE, height: SIZE },
  no_background: true,
  outline: "single color black outline",
  shading: "flat shading",
  detail: "low detail",
  direction: "south",
};

const SWATCH_B64 = pngFromColors(PALETTE).toString("base64"); // raw base64, no data-URL prefix

function post(withPalette) {
  const body = { ...BASE };
  if (withPalette) body.color_image = { type: "base64", base64: SWATCH_B64, format: "png" };
  return fetch("https://api.pixellab.ai/v2/create-image-pixflux", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Try with the forced palette; if the server errors on it, fall back to a
// plain generation so we still get a sprite to review.
let usedPalette = FORCE_PALETTE;
console.log(`→ POST /create-image-pixflux  (${SIZE}x${SIZE}, forced palette: ${FORCE_PALETTE ? PALETTE.length + " colors" : "off"})`);
let res = await post(FORCE_PALETTE);
if (!res.ok && FORCE_PALETTE) {
  const first = await res.text().catch(() => "");
  console.warn(`⚠ forced-palette attempt failed (HTTP ${res.status}: ${first.slice(0, 120)}); retrying without color_image`);
  usedPalette = false;
  res = await post(false);
}

if (!res.ok) {
  const text = await res.text().catch(() => "");
  console.error(`✗ HTTP ${res.status} ${res.statusText}\n${text}`);
  process.exit(1);
}

const json = await res.json();
const dataUrl = json?.image?.base64;
if (!dataUrl) {
  console.error("✗ No image in response:", JSON.stringify(json).slice(0, 400));
  process.exit(1);
}

mkdirSync("out", { recursive: true });
const b64 = dataUrl.replace(/^data:image\/png;base64,/, "");
writeFileSync("out/nightnip-pixellab.png", Buffer.from(b64, "base64"));

// A tiny preview page: original repo sprite vs. the new PixelLab render.
const ORIGINAL = {
  pal: { k: "#1a1024", d: "#6b4d9e", w: "#f2e8ff", e: "#ffd166", W: "#3c2b5c" },
  rows: ["................","..k..........k..","..kk........kk..","..kwk......kwk..","...kkkkkkkkkk...","..kddddddddddk..","..kdeeddddeedk..","..kddddddddddk..","..kddwwddwwddk..","...kkkkkkkkkk...",".kWWkddddddkWWk.","kWWWkddddddkWWWk","kWWWkddddddkWWWk",".kkkkddddddkkkk.","....kdd..ddk....","....kkk..kkk...."],
};
const cells = ORIGINAL.rows.map((row, y) =>
  [...row].map((ch, x) => { const c = ORIGINAL.pal[ch]; return c ? `<rect x="${x}" y="${y}" width="1" height="1" fill="${c}"/>` : ""; }).join("")
).join("");
const origSvg = `<svg viewBox="0 0 16 16" width="256" height="256" style="image-rendering:pixelated">${cells}</svg>`;

writeFileSync("out/preview.html", `<!doctype html><meta charset="utf8">
<title>Nightnip — original vs PixelLab</title>
<body style="font-family:system-ui;background:#131120;color:#ece8f6;display:flex;gap:40px;justify-content:center;align-items:center;min-height:100vh;flex-wrap:wrap">
<figure style="text-align:center"><figcaption>Original (art.ts, 16×16)</figcaption>${origSvg}</figure>
<figure style="text-align:center"><figcaption>PixelLab (${SIZE}×${SIZE})</figcaption>
<img src="nightnip-pixellab.png" width="256" height="256" style="image-rendering:pixelated" alt="PixelLab Nightnip"></figure>
</body>`);

console.log(`✓ Saved out/nightnip-pixellab.png  (forced palette: ${usedPalette ? "yes" : "no"})`);
console.log(`✓ Saved out/preview.html  (open to compare)`);
if (json.usage?.usd != null) console.log(`  cost: $${json.usage.usd}`);
