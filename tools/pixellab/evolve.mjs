#!/usr/bin/env node
// Generate an evolution-stage sprite for a creature via the PixelLab API
// (pixflux text-to-image). STAGING ONLY — writes to ./out, never touches
// src/ and commits nothing (the repo stays asset-free; see CLAUDE.md).
//
//   PIXEL_LAB_API_KEY=... CREATURE=nightnip STAGE=wisp node tools/pixellab/evolve.mjs
//   open out/nightnip-wisp.html
//
// The prompt for every sprite is composed the same way, so a whole line stays
// visually consistent and any creature can reuse the ladder:
//
//     <STAGE vibe> , <CREATURE theme> , <shared STYLE> , <STAGE tone>
//
// STAGES describe silhouette / size / attitude and are creature-agnostic.
// CREATURES supply the recurring motif + palette. Swap CREATURE to reskin the
// whole ladder; swap STAGE to move up the evolution line.

import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";

// ---------------------------------------------------------------------------
// Standardized evolution ladder.  Wisp → Shade → Revenant → Beyond.
// ---------------------------------------------------------------------------
const STAGES = {
  wisp: {
    label: "Wisp",
    // Lowest / rookie form: small, round, endearing — cute but still on-theme.
    vibe: "a small round chibi creature, oversized head, tiny stubby body, short limbs, big cute glowing eyes, harmless endearing and a little mischievous",
    tone: "cute charming dark-fantasy RPG creature sprite",
    detail: "low detail",
    size: 48,
  },
  shade: {
    label: "Shade",
    // Middle form: grown up, upright, starting to look dangerous.
    vibe: "a lean upright adolescent creature, slender body, small budding horns and claws, sly toothy grin, mildly menacing and agile",
    tone: "spooky dark-fantasy RPG monster sprite",
    detail: "low detail",
    size: 56,
  },
  revenant: {
    label: "Revenant",
    // Advanced form: the gaunt demon (matches the saved nightnip-revenant.png).
    vibe: "a gaunt towering demon, tall imposing silhouette, long ragged tattered wings, curved horns, long clawed fingers, fanged snarl, menacing sinister pose",
    tone: "evil dark-fantasy RPG boss monster sprite",
    detail: "low detail",
    size: 64,
  },
  beyond: {
    label: "Beyond",
    // Ultimate form: colossal, ornate, godlike final evolution.
    vibe: "a colossal godlike demon overlord, ornate terrifying final form, massive spread wings, crown of horns, glowing runes, radiating dark energy, awe-inspiring and regal",
    tone: "epic dark-fantasy RPG final-boss monster sprite",
    detail: "medium detail",
    size: 64,
  },
};

// ---------------------------------------------------------------------------
// Creature lines.  `theme` is the recurring motif; `palette` keeps every stage
// on the same colours (Nightnip's canonical 5 from art.ts).
// ---------------------------------------------------------------------------
const CREATURES = {
  nightnip: {
    theme: "a dark violet-black bat-demon, leathery membrane bat wings, big amber eyes, impish devil motif",
    palette: ["#1a1024", "#6b4d9e", "#f2e8ff", "#ffd166", "#3c2b5c"],
  },
};

// Shared style — the constant that makes everything read as one roster.
const STYLE = "clean single-color black outline, flat shading, front view, symmetrical";

// ---------------------------------------------------------------------------
const KEY = process.env.PIXEL_LAB_API_KEY;
if (!KEY) {
  console.error("✗ PIXEL_LAB_API_KEY is not set. Export it (or configure it as an Actions secret) and re-run.");
  process.exit(1);
}
const CREATURE = (process.env.CREATURE || "nightnip").toLowerCase();
const STAGE = (process.env.STAGE || "wisp").toLowerCase();
const FORCE_PALETTE = process.env.FORCE_PALETTE !== "0";

const creature = CREATURES[CREATURE];
const stage = STAGES[STAGE];
if (!creature) { console.error(`✗ Unknown CREATURE "${CREATURE}". Known: ${Object.keys(CREATURES).join(", ")}`); process.exit(1); }
if (!stage) { console.error(`✗ Unknown STAGE "${STAGE}". Known: ${Object.keys(STAGES).join(", ")}`); process.exit(1); }

// Compose the standardized prompt.
const DESCRIPTION = `${stage.vibe}, ${creature.theme}, ${STYLE}, ${stage.tone}`;

// --- Minimal dependency-free truecolor PNG encoder (for the palette swatch) ---
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) { c ^= buf[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); }
  return (~c) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function pngFromColors(hexes, w = 64, h = 64) {
  const rgb = hexes.map((x) => [parseInt(x.slice(1, 3), 16), parseInt(x.slice(3, 5), 16), parseInt(x.slice(5, 7), 16)]);
  const stripe = Math.ceil(w / hexes.length);
  const raw = Buffer.alloc((w * 3 + 1) * h);
  let o = 0;
  for (let y = 0; y < h; y++) {
    raw[o++] = 0;
    for (let x = 0; x < w; x++) { const [r, g, b] = rgb[Math.min(hexes.length - 1, Math.floor(x / stripe))]; raw[o++] = r; raw[o++] = g; raw[o++] = b; }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const SWATCH_B64 = pngFromColors(creature.palette).toString("base64");

const BASE = {
  description: DESCRIPTION,
  image_size: { width: stage.size, height: stage.size },
  no_background: true,
  outline: "single color black outline",
  shading: "flat shading",
  detail: stage.detail,
  direction: "south",
};
function post(withPalette) {
  const body = { ...BASE };
  if (withPalette) body.color_image = { type: "base64", base64: SWATCH_B64, format: "png" };
  return fetch("https://api.pixellab.ai/v2/create-image-pixflux", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

console.log(`→ ${CREATURE} · ${stage.label} (${stage.size}x${stage.size}, palette: ${FORCE_PALETTE ? "on" : "off"})`);
console.log(`  prompt: ${DESCRIPTION}`);

let usedPalette = FORCE_PALETTE;
let res = await post(FORCE_PALETTE);
if (!res.ok && FORCE_PALETTE) {
  const first = await res.text().catch(() => "");
  console.warn(`⚠ forced-palette attempt failed (HTTP ${res.status}: ${first.slice(0, 120)}); retrying without color_image`);
  usedPalette = false;
  res = await post(false);
}
if (!res.ok) { const t = await res.text().catch(() => ""); console.error(`✗ HTTP ${res.status} ${res.statusText}\n${t}`); process.exit(1); }

const json = await res.json();
const dataUrl = json?.image?.base64;
if (!dataUrl) { console.error("✗ No image in response:", JSON.stringify(json).slice(0, 400)); process.exit(1); }

mkdirSync("out", { recursive: true });
const stem = `out/${CREATURE}-${STAGE}`;
const b64 = dataUrl.replace(/^data:image\/png;base64,/, "");
writeFileSync(`${stem}.png`, Buffer.from(b64, "base64"));
writeFileSync(`${stem}.html`, `<!doctype html><meta charset="utf8"><title>${CREATURE} — ${stage.label}</title>
<body style="margin:0;font-family:system-ui;background:#131120;color:#ece8f6;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px">
<h2 style="margin:0">${CREATURE} — ${stage.label} stage</h2>
<div style="background:#0f0d1a;padding:20px;border-radius:12px"><img src="${CREATURE}-${STAGE}.png" width="256" height="256" style="image-rendering:pixelated" alt="${CREATURE} ${stage.label}"></div>
<p style="color:#6c6482;font-size:13px;max-width:60ch;text-align:center">${DESCRIPTION}</p></body>`);

console.log(`✓ Saved ${stem}.png  (forced palette: ${usedPalette ? "yes" : "no"})`);
if (json.usage?.usd != null) console.log(`  cost: $${json.usage.usd}`);
