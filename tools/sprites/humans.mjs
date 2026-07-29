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

// Directional cel shade: warm light to the left of cx-lpad, cool shadow right of
// cx+rpad, base in the middle (so the centred face keeps room for features).
function cel(g, base, L, D, cx, lpad = 3, rpad = 2) {
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (g[y][x] !== base) continue;
    if (x < cx - lpad) g[y][x] = L; else if (x > cx + rpad) g[y][x] = D;
  }
}

export function human(o) {
  const skin = o.skin ?? '#f0c39a', hair = o.hair ?? '#3a2a1c';
  const coat = o.coat, accent = o.accent ?? coat, pants = o.pants ?? '#2a2f45';
  const P = {
    '.': '', k: '#16101d', w: '#f6f1ea', e: '#241a30',
    s: skin, S: lit(skin), D: dim(skin),
    h: hair, H: lit(hair), G: dim(hair),
    c: coat, C: lit(coat), v: dim(coat),
    a: accent, A: lit(accent), Q: dim(accent),
    p: pants, x: lit(pants), q: dim(pants),
    b: '#1b1d2a',
  };
  const g = grid(30, 48); const cx = 15, style = o.hairStyle || 'short';
  if (style === 'long') { rect(g, cx - 7, 11, cx - 5, 25, 'h'); rect(g, cx + 5, 11, cx + 7, 25, 'h'); } // back hair
  // head + ears
  ellipse(g, cx, 13, 6.5, 7.5, 's');
  ellipse(g, cx - 7, 14, 1.4, 2, 's'); ellipse(g, cx + 7, 14, 1.4, 2, 's');
  // hair / hat
  if (style === 'cap' || style === 'hat') { ellipse(g, cx, 7.5, 7.6, 4.5, 'a'); rect(g, cx - 8, 8, cx + 8, 9, 'a'); }
  else if (style === 'hood') { ellipse(g, cx, 12, 9.5, 10.5, 'a'); ellipse(g, cx, 14, 6.5, 7.6, 's'); }
  else {
    ellipse(g, cx, 8, 7.2, 5.5, 'h');
    ellipse(g, cx, 12, 6.6, 6, 's', { only: (x, y) => y >= 11 });
    if (style === 'spiky') for (const dx of [-6, -3, 0, 3, 6]) { set(g, cx + dx, 3, 'h'); set(g, cx + dx, 4, 'h'); }
    if (style === 'long') { rect(g, cx - 7, 12, cx - 5, 25, 'h'); rect(g, cx + 5, 12, cx + 7, 25, 'h'); }
  }
  // face features
  const ey = 12;
  for (const s of [-1, 1]) {
    const ex = cx + s * 3;
    set(g, ex - 1, ey, 'w'); set(g, ex, ey, 'w'); set(g, ex + 1, ey, 'w');
    set(g, ex, ey, 'e');
    set(g, ex - 1, ey - 2, 'G'); set(g, ex, ey - 2, 'G'); set(g, ex + 1, ey - 2, 'G');
  }
  set(g, cx, ey + 3, 'D');
  const my = ey + 5;
  if (o.expr === 'smile') { set(g, cx - 1, my, 'e'); set(g, cx, my + 1, 'e'); set(g, cx + 1, my, 'e'); }
  else if (o.expr === 'stern') { set(g, cx - 1, my, 'e'); set(g, cx, my, 'e'); set(g, cx + 1, my, 'e'); }
  else { set(g, cx - 1, my, 'e'); set(g, cx + 1, my, 'e'); }
  // neck
  rect(g, cx - 2, 20, cx + 2, 22, 's');
  // coat (trapezoid), arms, hands
  for (let y = 22; y <= 35; y++) { const wdt = Math.round(9 - (y - 22) * 0.16); rect(g, cx - wdt, y, cx + wdt, y, 'c'); }
  for (let y = 23; y <= 33; y++) { const off = Math.round(8 - (y - 23) * 0.1); rect(g, cx - off - 1, y, cx - off, y, 'c'); rect(g, cx + off, y, cx + off + 1, y, 'c'); }
  ellipse(g, cx - 9, 34, 1.8, 1.8, 's'); ellipse(g, cx + 9, 34, 1.8, 1.8, 's');
  // collar + placket accent
  rect(g, cx - 4, 22, cx + 4, 23, 'a'); for (let y = 24; y <= 30; y++) set(g, cx, y, 'a');
  // legs + boots (gap between)
  rect(g, cx - 5, 36, cx - 1, 43, 'p'); rect(g, cx + 1, 36, cx + 5, 43, 'p');
  rect(g, cx - 5, 43, cx - 1, 46, 'b'); rect(g, cx + 1, 43, cx + 5, 46, 'b');
  // cel shading — face gentler (keeps features), rest normal
  cel(g, 's', 'S', 'D', cx, 4, 4); cel(g, 'h', 'H', 'G', cx, 3, 2); cel(g, 'c', 'C', 'v', cx, 3, 2); cel(g, 'a', 'A', 'Q', cx, 3, 2); cel(g, 'p', 'x', 'q', cx, 3, 2);
  outlineSil(g, 'k');
  return toArt(g, P);
}

// The cast — muted wardrobe, one accent each, an individual silhouette/expr.
export const HUMANS = {
  hero: { build: () => human({ skin: '#f0c39a', hair: '#3a2a1c', coat: '#2f4f7a', accent: '#e2b23a', pants: '#26304d', hairStyle: 'short', expr: 'neutral' }) },
  mentor: { build: () => human({ skin: '#e8c39a', hair: '#c9cdd8', coat: '#4a5066', accent: '#9fb0d8', pants: '#2f3448', hairStyle: 'long', expr: 'neutral' }) },
  chief: { build: () => human({ skin: '#d8a878', hair: '#2a2a33', coat: '#2b3346', accent: '#8f9bbd', pants: '#1c2030', hairStyle: 'cap', expr: 'stern' }) },
  rival: { build: () => human({ skin: '#f0c39a', hair: '#d94f3d', coat: '#6a2a2a', accent: '#e2574d', pants: '#2c2432', hairStyle: 'spiky', expr: 'stern' }) },
  vendor: { build: () => human({ skin: '#caa06a', hair: '#6b4a2f', coat: '#3f5a3a', accent: '#d8c48a', pants: '#3a3020', hairStyle: 'cap', expr: 'smile' }) },
  soulkeeper: { build: () => human({ skin: '#e8c8b0', hair: '#c77dff', coat: '#3f2a63', accent: '#c9b0ef', pants: '#241a33', hairStyle: 'hood', expr: 'neutral' }) },
  leaderGold: { build: () => human({ skin: '#e8c39a', hair: '#e2c76a', coat: '#5a4a1f', accent: '#f0cf5a', pants: '#3a2f14', hairStyle: 'long', expr: 'smile' }) },
  leaderBlue: { build: () => human({ skin: '#d8b48a', hair: '#7fa9e8', coat: '#25467f', accent: '#5f9adf', pants: '#1d2740', hairStyle: 'short', expr: 'neutral' }) },
  leaderBlack: { build: () => human({ skin: '#c9a074', hair: '#2b2438', coat: '#2a2334', accent: '#8a6fd0', pants: '#191322', hairStyle: 'spiky', expr: 'stern' }) },
};
