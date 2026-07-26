#!/usr/bin/env node
// Generate one or more monster sprites from the registry via the PixelLab
// pixflux API. STAGING ONLY — writes to ./out, never touches src/ and commits
// nothing (the repo stays asset-free). Full workflow: docs/adding-monsters.md
//
//   PIXEL_LAB_API_KEY=... MONSTER=lastlight-candle node tools/pixellab/generate.mjs
//   MONSTER="lastlight-candle,lastlight-lantern,lastlight-wisp" node ... generate.mjs

import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { MONSTERS } from "./monsters.mjs";

const KEY = process.env.PIXEL_LAB_API_KEY;
if (!KEY) { console.error("✗ PIXEL_LAB_API_KEY is not set."); process.exit(1); }
const IDS = (process.env.MONSTER || "lastlight-candle").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const FORCE_PALETTE = process.env.FORCE_PALETTE !== "0";

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

function post(spec, swatchB64, withPalette) {
  const body = {
    description: spec.prompt,
    image_size: { width: spec.size, height: spec.size },
    no_background: true,
    outline: "single color black outline",
    shading: "flat shading",
    detail: "low detail",
    direction: "south",
  };
  if (withPalette) body.color_image = { type: "base64", base64: swatchB64, format: "png" };
  return fetch("https://api.pixellab.ai/v2/create-image-pixflux", {
    method: "POST", headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}

async function genOne(id) {
  const spec = MONSTERS[id];
  if (!spec) { console.error(`✗ Unknown MONSTER "${id}". Known: ${Object.keys(MONSTERS).join(", ")}`); return false; }
  const swatch = pngFromColors(spec.palette).toString("base64");
  console.log(`→ ${id} (${spec.size}x${spec.size}, palette: ${FORCE_PALETTE ? "on" : "off"})`);
  console.log(`  prompt: ${spec.prompt}`);

  let res = await post(spec, swatch, FORCE_PALETTE);
  if (!res.ok && FORCE_PALETTE) {
    const first = await res.text().catch(() => "");
    console.warn(`⚠ forced-palette attempt failed (HTTP ${res.status}: ${first.slice(0, 120)}); retrying without color_image`);
    res = await post(spec, swatch, false);
  }
  if (!res.ok) { const t = await res.text().catch(() => ""); console.error(`✗ ${id}: HTTP ${res.status} ${res.statusText}\n${t}`); return false; }

  const json = await res.json();
  const dataUrl = json?.image?.base64;
  if (!dataUrl) { console.error(`✗ ${id}: no image in response`); return false; }

  mkdirSync("out", { recursive: true });
  writeFileSync(`out/${id}.png`, Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ""), "base64"));
  console.log(`✓ Saved out/${id}.png${json.usage?.usd != null ? `  ($${json.usage.usd})` : ""}`);
  return true;
}

let ok = true;
for (const id of IDS) { ok = (await genOne(id)) && ok; }
if (!ok) process.exit(1);
