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
// palette so the reimagining stays consistent with the rest of the roster.

import { writeFileSync, mkdirSync } from "node:fs";

const KEY = process.env.PIXEL_LAB_API_KEY;
if (!KEY) {
  console.error("✗ PIXEL_LAB_API_KEY is not set. Export it (or configure it as an Actions secret) and re-run.");
  process.exit(1);
}

// --- Tunables --------------------------------------------------------------
const SIZE = Number(process.env.SIZE) || 64; // px, square. Try SIZE=32 for a closer 16x16 drop-in.
const DESCRIPTION =
  "a small impish bat creature, front view, dark violet fur, wide spread " +
  "membrane wings, big glowing amber eyes, tiny fangs, mischievous pose, " +
  "clean 1px dark outline, flat shading, retro RPG monster sprite";

// Nightnip's canonical palette (from art.ts): outline, body, highlight, eyes, wing-shade.
const PALETTE = ["#1a1024", "#6b4d9e", "#f2e8ff", "#ffd166", "#3c2b5c"];
// ---------------------------------------------------------------------------

const body = {
  description: DESCRIPTION,
  image_size: { width: SIZE, height: SIZE },
  no_background: true,
  palette: PALETTE,
};

console.log(`→ POST /create-image-pixflux  (${SIZE}x${SIZE}, ${PALETTE.length}-color forced palette)`);

const res = await fetch("https://api.pixellab.ai/v2/create-image-pixflux", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

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
  [...row].map((ch, x) => {
    const c = ORIGINAL.pal[ch];
    return c ? `<rect x="${x}" y="${y}" width="1" height="1" fill="${c}"/>` : "";
  }).join("")
).join("");
const origSvg = `<svg viewBox="0 0 16 16" width="256" height="256" style="image-rendering:pixelated">${cells}</svg>`;

writeFileSync("out/preview.html", `<!doctype html><meta charset="utf8">
<title>Nightnip — original vs PixelLab</title>
<body style="font-family:system-ui;background:#131120;color:#ece8f6;display:flex;gap:40px;justify-content:center;align-items:center;min-height:100vh;flex-wrap:wrap">
<figure style="text-align:center"><figcaption>Original (art.ts, 16×16)</figcaption>${origSvg}</figure>
<figure style="text-align:center"><figcaption>PixelLab (${SIZE}×${SIZE})</figcaption>
<img src="nightnip-pixellab.png" width="256" height="256" style="image-rendering:pixelated" alt="PixelLab Nightnip"></figure>
</body>`);

console.log(`✓ Saved out/nightnip-pixellab.png`);
console.log(`✓ Saved out/preview.html  (open to compare)`);
if (json.usage?.usd != null) console.log(`  cost: $${json.usage.usd}`);
