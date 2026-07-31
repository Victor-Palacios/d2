// Human characters — a THIRD sprite style, distinct from the two creature ones.
//
// Style: taller, properly-proportioned "storybook" people (~30x48 vs the old
// 14x18 blobs), clean lineart, and warm-cool CEL shading — a warm key light
// from screen-left (the lantern motif), cool shadow to the right, flat bands
// (no dithering). Each character reads as an individual via one saturated
// accent colour over a muted wardrobe. See docs/procedural-sprites.md.
import { grid, ellipse, rect, set, outlineSil, toArt } from './compose.mjs';
import { shade } from './paint.mjs';

function toRGB(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function toHex([r, g, b]) { const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'); return '#' + c(r) + c(g) + c(b); }
function mix(a, b, t) { const A = toRGB(a), B = toRGB(b); return toHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]); }
const WARM = '#ffd9a0', COOL = '#2b2f4c';
const lit = (h) => mix(shade(h, 0.24), WARM, 0.16);   // warm light
const dim = (h) => mix(shade(h, -0.3), COOL, 0.16);   // cool shadow

// A 16-bit JRPG protagonist — full colour, clean near-black outline, three-band
// cel shading (warm key from screen-left), heroic proportions (~46x66). Fully
// parametric: each character sets skin/hair/coat/accent/pants, a hairstyle
// (short/long/spiky/cap/hood) and an expression; the hero also raises a lantern.
export function human(o) {
  const skin = o.skin ?? '#f0c39a', hair = o.hair ?? '#3a2a1c';
  const coat = o.coat ?? '#2f4f7a', accent = o.accent ?? coat, pants = o.pants ?? '#232838';
  const P = {
    '.': '', k: '#1c1622',
    s: skin, i: lit(skin), d: dim(skin), // i = lit skin, d = shadow skin
    h: hair, H: lit(hair), G: dim(hair),
    c: coat, C: lit(coat), v: dim(coat),
    a: accent, A: lit(accent),
    p: pants, x: dim(pants), b: '#141019',
    o: '#8a6d3a', f: '#ff8a2e', F: '#fff2c4', // lantern: frame gold, flame, core
  };
  const g = grid(46, 66); const cx = 22, style = o.hairStyle || 'short';

  // --- head: base, a shadow side (right) and a lit cheek (left) ---
  ellipse(g, cx, 14, 7.5, 8, 's');
  ellipse(g, cx + 3, 14, 6, 7, 'd');
  ellipse(g, cx - 2, 12, 5, 5, 'i', { only: (x, y) => y < 15 });
  set(g, cx - 8, 15, 's'); set(g, cx + 8, 15, 's'); // ears

  // --- hair / hat / hood ---
  if (style === 'cap' || style === 'hat') {
    ellipse(g, cx, 8, 8.5, 5, 'a'); rect(g, cx - 9, 10, cx + 9, 11, 'a'); // dome + brim
    ellipse(g, cx - 2, 7, 5, 3, 'A', { only: (x, y) => y < 9 });
    rect(g, cx - 8, 12, cx - 6, 16, 'h'); rect(g, cx + 6, 12, cx + 8, 16, 'h'); // sideburns
  } else if (style === 'hood') {
    ellipse(g, cx, 12, 10.5, 11.5, 'c'); ellipse(g, cx - 2, 9, 6, 5, 'C', { only: (x, y) => y < 12 });
    ellipse(g, cx, 15, 7, 7.5, 's', { only: (x, y) => y >= 12 }); // face opening
    ellipse(g, cx + 3, 16, 5.5, 6, 'd', { only: (x, y) => y >= 13 });
  } else {
    if (style === 'long') { rect(g, cx - 10, 12, cx - 7, 36, 'h'); rect(g, cx + 7, 12, cx + 10, 36, 'h'); rect(g, cx - 9, 12, cx - 8, 34, 'G'); }
    ellipse(g, cx, 8, 8, 5.5, 'h'); ellipse(g, cx - 2, 7, 5, 3, 'H', { only: (x, y) => y < 9 });
    for (const dx of [-6, -3, 1, 4]) set(g, cx + dx, 6, 'H'); // fringe strands
    if (style === 'spiky') for (const dx of [-6, -3, 0, 3, 6]) { set(g, cx + dx, 2, 'h'); set(g, cx + dx, 3, 'h'); set(g, cx + dx, 4, 'H'); }
  }

  // --- eyes, brows, nose, mouth (by expression) ---
  set(g, cx - 3, 14, 'k'); set(g, cx - 3, 15, 'k'); set(g, cx + 4, 14, 'k'); set(g, cx + 4, 15, 'k');
  set(g, cx - 4, 14, 'F'); set(g, cx + 3, 14, 'F'); // catch-lights
  set(g, cx - 3, 13, 'G'); set(g, cx + 4, 13, 'G'); // brows
  set(g, cx, 17, 'd'); // nose
  const my = 19;
  if (o.expr === 'smile') { set(g, cx - 1, my, 'k'); set(g, cx, my + 1, 'k'); set(g, cx + 1, my, 'k'); }
  else if (o.expr === 'stern') { rect(g, cx - 1, my, cx + 2, my, 'k'); }
  else { set(g, cx - 1, my, 'd'); set(g, cx + 1, my, 'd'); }

  // --- neck + coat torso (tapered), lit left / shadow right ---
  rect(g, cx - 2, 21, cx + 2, 23, 'd');
  for (let y = 23; y <= 46; y++) { const w = Math.round(10 - (y - 23) * 0.12); rect(g, cx - w, y, cx + w, y, 'c'); }
  for (let y = 24; y <= 44; y++) set(g, cx + Math.round(9 - (y - 24) * 0.1), y, 'v');
  for (let y = 24; y <= 44; y++) { const e = Math.round(9 - (y - 24) * 0.1); set(g, cx - e, y, 'C'); set(g, cx - e + 1, y, 'C'); }
  // gold scarf + placket
  rect(g, cx - 6, 23, cx + 6, 25, 'a'); rect(g, cx - 6, 23, cx - 1, 24, 'A');
  for (let y = 26; y <= 40; y++) set(g, cx, y, 'a');

  // --- arms + hands; the hero raises a lantern ---
  rect(g, cx - 12, 26, cx - 9, 40, 'c'); ellipse(g, cx - 11, 41, 2, 2, 's'); // left arm down
  if (o.lantern) {
    rect(g, cx + 9, 22, cx + 12, 33, 'c'); ellipse(g, cx + 11, 21, 2.2, 2.2, 's'); // right raised
    rect(g, cx + 8, 10, cx + 15, 20, 'o'); rect(g, cx + 9, 11, cx + 14, 19, 'k'); // lantern frame
    ellipse(g, cx + 11.5, 16, 2.2, 3, 'f'); ellipse(g, cx + 11.5, 17, 1.2, 1.8, 'F'); // flame + core
    rect(g, cx + 10, 8, cx + 13, 9, 'o'); set(g, cx + 11, 20, 'a'); // cap + wire
  } else {
    rect(g, cx + 9, 26, cx + 12, 40, 'c'); ellipse(g, cx + 11, 41, 2, 2, 's'); // right arm down
  }

  // --- legs + boots ---
  rect(g, cx - 6, 46, cx - 1, 57, 'p'); rect(g, cx + 1, 46, cx + 6, 57, 'p');
  set(g, cx - 2, 47, 'x'); for (let y = 47; y <= 56; y++) set(g, cx + 5, y, 'x'); // leg shade
  rect(g, cx - 6, 57, cx - 1, 61, 'b'); rect(g, cx + 1, 57, cx + 6, 61, 'b');

  outlineSil(g, 'k', new Set(['.'])); // only transparent is background
  return toArt(g, P);
}

// The cast — muted wardrobe, one accent each, an individual silhouette/expr.
export const HUMANS = {
  hero: { build: () => human({ skin: '#f0c39a', hair: '#4a3220', coat: '#2f4f7a', accent: '#e6b53c', pants: '#232838', hairStyle: 'short', expr: 'neutral', lantern: true }) },
  mentor: { build: () => human({ skin: '#e8c39a', hair: '#c9cdd8', coat: '#4a5066', accent: '#9fb0d8', pants: '#2f3448', hairStyle: 'long', expr: 'neutral' }) },
  chief: { build: () => human({ skin: '#d8a878', hair: '#2a2a33', coat: '#2b3346', accent: '#8f9bbd', pants: '#1c2030', hairStyle: 'cap', expr: 'stern' }) },
  rival: { build: () => human({ skin: '#f0c39a', hair: '#d94f3d', coat: '#6a2a2a', accent: '#e2574d', pants: '#2c2432', hairStyle: 'spiky', expr: 'stern' }) },
  vendor: { build: () => human({ skin: '#caa06a', hair: '#6b4a2f', coat: '#3f5a3a', accent: '#d8c48a', pants: '#3a3020', hairStyle: 'cap', expr: 'smile' }) },
  soulkeeper: { build: () => human({ skin: '#e8c8b0', hair: '#c77dff', coat: '#3f2a63', accent: '#c9b0ef', pants: '#241a33', hairStyle: 'hood', expr: 'neutral' }) },
  leaderGold: { build: () => human({ skin: '#e8c39a', hair: '#e2c76a', coat: '#5a4a1f', accent: '#f0cf5a', pants: '#3a2f14', hairStyle: 'long', expr: 'smile' }) },
  leaderBlue: { build: () => human({ skin: '#d8b48a', hair: '#7fa9e8', coat: '#25467f', accent: '#5f9adf', pants: '#1d2740', hairStyle: 'short', expr: 'neutral' }) },
  leaderBlack: { build: () => human({ skin: '#c9a074', hair: '#2b2438', coat: '#2a2334', accent: '#8a6fd0', pants: '#191322', hairStyle: 'spiky', expr: 'stern' }) },
};
