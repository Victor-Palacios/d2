// The Haunted Dungeon (reach 4) is now the MAGE dungeon — spectral-ink style
// (paint.mjs), matching haunted.mjs. Four dark casters join the existing
// Wispling / Revenance / Lastlight(boss). Monochrome ash, one emissive accent
// each, hollow eyes, dissolving into mist.
import { canvas, form, flat, put, smooth, outline, toPixelArt, shade } from './paint.mjs';

const ASH = ['#0b0a12', '#20202e', '#3a3a4c', '#63637a', '#a6a6be'];
const BONE = ['#161420', '#2e2b3a', '#4f4a5e', '#7d7688', '#cdc6d2'];
const DUSK = [-0.5, -0.62, 0.6];

function mist(c, topY, botY) {
  for (let y = topY; y < c.h; y++) { const t = Math.max(0, Math.min(1, (y - topY) / (botY - topY))), keep = 1 - t;
    for (let x = 0; x < c.w; x++) { if (!c[y][x]) continue; const v = ((x * 37 + y * 91 + ((x ^ y) * 13)) % 16) / 16; if (v > keep) c[y][x] = null; } }
}
function rimGlow(c, accent, thin = 7) {
  const bg = (x, y) => x < 0 || y < 0 || x >= c.w || y >= c.h || c[y][x] === null; const add = [];
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) { if (c[y][x] === null) continue; if (bg(x - 1, y) || bg(x + 1, y) || bg(x, y - 1) || bg(x, y + 1)) { if ((x * 13 + y * 7) % 10 < thin) add.push([x, y]); } }
  for (const [x, y] of add) c[y][x] = accent;
}
function glowEyes(c, cx, dx, y, accent, r = 2.4) {
  for (const sx of [cx - dx, cx + dx]) { flat(c, sx, y, r + 0.8, r + 0.8, '#050510'); flat(c, sx, y, r, r, accent); flat(c, sx, y, r * 0.5, r * 0.5, '#ffffff'); }
}
function halo(c, accent, pts) { for (const [x, y] of pts) put(c, x, y, shade(accent, -0.4)); }
function haunt(c, accent, mt, mb) { smooth(c); rimGlow(c, accent); outline(c, '#050410'); if (mt) mist(c, mt, mb); return toPixelArt(c); }
// a robed caster body (BONE cloth) with fold shadows; returns nothing
function robe(c, cx, cy, rx, ry) {
  form(c, cx, cy, rx, ry, BONE, { light: DUSK, steps: 8, ambient: 0.2 });
  for (const fx of [cx - rx * 0.5, cx, cx + rx * 0.5]) for (let y = cy - ry * 0.4; y < cy + ry; y += 2) put(c, fx + Math.sin(y / 6) * 1.2, y, shade(BONE[1], -0.12));
}

// --- hexshade — Hexshade (dark / mage, Uncanny) ----------------------------
export function hexshade() {
  const c = canvas(56, 74); const cx = 28; const AC = '#c79bff';
  robe(c, cx, 52, 15, 20);
  form(c, cx - 14, 46, 4, 12, BONE, { light: DUSK, steps: 6, ambient: 0.2 }); form(c, cx + 14, 46, 4, 12, BONE, { light: DUSK, steps: 6, ambient: 0.2 }); // sleeves
  for (const [hx] of [[cx - 15], [cx + 15]]) for (const f of [-1.5, 0, 1.5]) put(c, hx + f, 34, BONE[4]); // hands
  // a hovering hex-glyph between the hands
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; put(c, Math.round(cx + Math.cos(a) * 5), Math.round(32 + Math.sin(a) * 5), AC); }
  put(c, cx, 32, '#ffffff');
  // deep empty cowl
  form(c, cx, 22, 11, 12, ASH, { light: DUSK, steps: 7, ambient: 0.16 }); flat(c, cx, 24, 7, 8, '#040309');
  // uncanny: three uneven eyes
  glowEyes(c, cx, 4, 24, AC, 1.8); flat(c, cx, 20, 1.6, 1.9, AC); put(c, cx, 20, '#fff');
  halo(c, AC, [[cx - 13, 16], [cx + 14, 18], [cx - 10, 10]]);
  return haunt(c, AC, 60, 74);
}

// --- palefire — Palefire (fire / mage, Nervous) ----------------------------
export function palefire() {
  const c = canvas(50, 66); const cx = 25; const AC = '#ffd27a';
  // a small cold-flame ghost, teardrop body
  form(c, cx, 26, 12, 12, ASH, { light: DUSK, steps: 8, ambient: 0.22 });
  form(c, cx, 40, 7, 12, ASH, { light: DUSK, steps: 7, ambient: 0.2 });
  form(c, cx - 10, 30, 3, 5, ASH, { light: DUSK, steps: 5, ambient: 0.2 }); form(c, cx + 10, 30, 3, 5, ASH, { light: DUSK, steps: 5, ambient: 0.2 });
  // a pale flame it carries at the chest
  flat(c, cx, 34, 3, 4, '#2a1e08'); form(c, cx, 34, 2.2, 3, ['#6b4e10', AC, '#fff6d0'], { light: [0, 0, 1], steps: 5, ambient: 0.5 }); put(c, cx, 31, '#fff');
  // cold flame crown
  for (let i = 0; i < 6; i++) put(c, cx + (i % 2 ? 1 : -1), 13 - i, shade(AC, -i * 0.08));
  // nervous eyes (uneven)
  glowEyes(c, cx, 5, 25, AC, 2.4); flat(c, cx + 5, 24.5, 1.1, 1.1, '#050510');
  for (const [mx, my] of [[-1, 31], [0, 32], [1, 31]]) put(c, cx + mx, my, shade(AC, -0.2));
  return haunt(c, AC, 44, 66);
}

// --- direwisp — Direwisp (water / mage, Nervous) ---------------------------
export function direwisp() {
  const c = canvas(52, 68); const cx = 26; const AC = '#a6f4ff';
  // a drowned caster, weed-draped, dripping into mist
  form(c, cx, 44, 13, 18, ASH, { light: DUSK, steps: 8, ambient: 0.2 });
  form(c, cx, 24, 10, 11, ASH, { light: DUSK, steps: 8, ambient: 0.18 });
  form(c, cx - 12, 42, 3.4, 10, ASH, { light: DUSK, steps: 6, ambient: 0.2 }); form(c, cx + 12, 42, 3.4, 10, ASH, { light: DUSK, steps: 6, ambient: 0.2 });
  // drips of cold water-light
  for (const [dx, dy] of [[cx - 6, 60], [cx + 5, 62], [cx, 64], [cx + 8, 58]]) { put(c, dx, dy, AC); put(c, dx, dy + 1, shade(AC, -0.3)); }
  // trailing weed strands
  for (const dir of [-1, 1]) for (let i = 0; i < 10; i++) put(c, cx + dir * (10 + i * 0.3), 30 + i, shade(AC, -0.5));
  glowEyes(c, cx, 4, 24, AC, 2.2); flat(c, cx - 4, 23.5, 1, 1, '#050510');
  for (const [mx, my] of [[-1, 30], [0, 31], [1, 30]]) put(c, cx + mx, my, shade(AC, -0.2));
  return haunt(c, AC, 50, 68);
}

// --- nullmancer — Nullmancer (dark / mage, Uncanny) ------------------------
export function nullmancer() {
  const c = canvas(58, 76); const cx = 29; const AC = '#ff6ad0';
  robe(c, cx, 54, 16, 21);
  form(c, cx - 15, 48, 4, 13, BONE, { light: DUSK, steps: 6, ambient: 0.2 }); form(c, cx + 15, 48, 4, 13, BONE, { light: DUSK, steps: 6, ambient: 0.2 });
  // a void orb it opens between raised hands
  flat(c, cx, 30, 5, 5, '#04040a'); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; put(c, Math.round(cx + Math.cos(a) * 6), Math.round(30 + Math.sin(a) * 6), AC); }
  for (const [hx] of [[cx - 12], [cx + 12]]) for (const f of [-1, 0, 1]) put(c, hx + f, 34, BONE[4]);
  // tall cowl
  form(c, cx, 22, 12, 13, ASH, { light: DUSK, steps: 7, ambient: 0.15 }); flat(c, cx, 24, 8, 9, '#040309');
  // uncanny: a single central eye + two small high ones
  flat(c, cx, 25, 2.6, 2.8, AC); put(c, cx, 25, '#fff');
  flat(c, cx - 6, 20, 1.2, 1.3, AC); flat(c, cx + 6, 21, 1.1, 1.2, AC);
  // a broken halo of shards
  for (const [dx, h] of [[-9, 6], [-3, 9], [4, 8], [9, 5]]) for (let i = 0; i < h; i++) put(c, cx + dx, 14 - i, shade(AC, -i * 0.1));
  return haunt(c, AC, 62, 76);
}

export const HAUNTED_MAGES = {
  hdHexshade: { species: 'Hexshade', element: 'dark', personality: 'uncanny', build: hexshade },
  hdPalefire: { species: 'Palefire', element: 'fire', personality: 'nervous', build: palefire },
  hdDirewisp: { species: 'Direwisp', element: 'water', personality: 'nervous', build: direwisp },
  hdNullmancer: { species: 'Nullmancer', element: 'dark', personality: 'uncanny', build: nullmancer },
};
