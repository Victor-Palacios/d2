#!/usr/bin/env node
// Generate a monster sprite from the registry via the PixelLab pixflux API.
// STAGING ONLY — writes to ./out, never touches src/ and commits nothing
// (the repo stays asset-free; see CLAUDE.md). Full workflow: docs/adding-monsters.md
//
//   PIXEL_LAB_API_KEY=... MONSTER=lastlight node tools/pixellab/generate.mjs
//   open out/lastlight.html

import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { MONSTERS } from "./monsters.mjs";

const KEY = process.env.PIXEL_LAB_API_KEY;
if (!KEY) { console.error("✗ PIXEL_LAB_API_KEY is not set."); process.exit(1); }
const ID = (process.env.MONSTER || "lastlight").toLowerCase();
const FORCE_PALETTE = process.env.FORCE_PALETTE !== "0";
const spec = MONSTERS[ID];
if (!spec) { console.error(`✗ Unknown MONSTER "${ID}". Known: ${Object.keys(MONSTERS).join(", ")}`); process.exit(1); }

// --- Minimal dependency-free truecolor PNG encoder (for the palette swatch) ---
function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return (~c) >>> 0; }
function chunk(t, d) { const l = Buffer.alloc(4); l.writeUInt32BE(d.length, 0); const tb = Buffer.from(t); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(Buffer.concat([tb, d])), 0); return Buffer.concat([l, tb, d, cr]); }
function pngFromColors(hexes, w = 64, h = 64) {
  const rgb = hexes.map((x) => [parseInt(x.slice(1, 3), 16), parseInt(x.slice(3, 5), 16), parseInt(x.slice(5, 7), 16)]);
  const stripe = Math.ceil(w / hexes.length);
  const raw = Buffer.alloc((w * 3 + 1) * h); let o = 0;
  for (let y = 0; y < h; y++) { raw[o++] = 0; for (let x = 0; x < w; x++) { const [r, g, b] = rgb[Math.min(hexes.length - 1, Math.floor(x / stripe))]; raw[o++] = r; raw[o++] = g; raw[o++] = b; } }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const SWATCH_B64 = pngFromColors(spec.palette).toString("base64");

const BASE = {
  description: spec.prompt,
  image_size: { width: spec.size, height: spec.size },
  no_background: true,
  outline: "single color black outline",
  shading: "flat shading",
  detail: "low detail",
  direction: "south",
};
function post(withPalette) {
  const body = { ...BASE };
  if (withPalette) body.color_image = { type: "base64", base64: SWATCH_B64, format: "png" };
  return fetch("https://api.pixellab.ai/v2/create-image-pixflux", {
    method: "POST", headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}

console.log(`→ ${ID} (${spec.size}x${spec.size}, palette: ${FORCE_PALETTE ? "on" : "off"})`);
console.log(`  prompt: ${spec.prompt}`);

let usedPalette = FORCE_PALETTE;
let res = await post(FORCE_PALETTE);
if (!res.ok && FORCE_PALETTE) {
  const first = await res.text().catch(() => "");
  console.warn(`⚠ forced-palette attempt failed (HTTP ${res.status}: ${first.slice(0, 120)}); retrying without color_image`);
  usedPalette = false; res = await post(false);
}
if (!res.ok) { const t = await res.text().catch(() => ""); console.error(`✗ HTTP ${res.status} ${res.statusText}\n${t}`); process.exit(1); }

const json = await res.json();
const dataUrl = json?.image?.base64;
if (!dataUrl) { console.error("✗ No image in response:", JSON.stringify(json).slice(0, 400)); process.exit(1); }

mkdirSync("out", { recursive: true });
writeFileSync(`out/${ID}.png`, Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ""), "base64"));
writeFileSync(`out/${ID}.html`, `<!doctype html><meta charset="utf8"><title>${ID}</title>
<body style="margin:0;font-family:system-ui;background:#131120;color:#ece8f6;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px">
<h2 style="margin:0">${ID}</h2>
<div style="background:#0f0d1a;padding:20px;border-radius:12px"><img src="${ID}.png" width="256" height="256" style="image-rendering:pixelated" alt="${ID}"></div>
<p style="color:#6c6482;font-size:13px;max-width:60ch;text-align:center">${spec.prompt}</p></body>`);

console.log(`✓ Saved out/${ID}.png  (forced palette: ${usedPalette ? "yes" : "no"})`);
if (json.usage?.usd != null) console.log(`  cost: $${json.usage.usd}`);
