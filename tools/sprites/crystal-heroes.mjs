// The Crystal Cavern (reach 2) is now the HERO dungeon — painterly volumetric
// style (paint.mjs), matching crystal-cavern.mjs. Four crystal wardens: three
// guards and a vault-warden boss. Sturdy, faceted, stone-and-gem heroes.
import { canvas, form, flat, put, spec, smooth, outline, toPixelArt, shade } from './paint.mjs';

const STONE = ['#241d18', '#463a30', '#6b5c4a', '#9a8b72', '#caba98'];
const GEM = ['#0d2a4a', '#1f5a8a', '#3aa0d0', '#9fe6ff', '#ffffff'];
const ICE = ['#0e2c48', '#1f5a8a', '#4aa8dc', '#a6e6ff', '#ffffff'];
const MOSS = ['#12240f', '#274a1c', '#4a8a34', '#8ac85a', '#dcffb0'];
const AMETHYST = ['#241050', '#5a2ec0', '#9a6aff', '#d6c4ff', '#ffffff'];
const LIGHT = [-0.52, -0.62, 0.58];

// fierce: narrow glowing eyes + heavy brow
function fierce(c, cx, ey, dx, rx, ry, glow, brow) {
  for (const dir of [-1, 1]) {
    const x = cx + dir * dx;
    flat(c, x, ey, rx, ry * 0.6, '#101018'); flat(c, x, ey, rx * 0.7, ry * 0.4, glow); put(c, x - dir, ey - 1, '#ffffff');
    for (let i = 0; i <= rx * 1.7; i++) put(c, x - dir * i * 0.7, ey - ry - 1 + i * 0.34, brow);
  }
}
// friendly: round eyes + soft mouth
function friendly(c, cx, ey, dx, rx, ry, mouth = '#0e2038') {
  for (const sx of [cx - dx, cx + dx]) { flat(c, sx, ey, rx, ry, '#f4fbff'); flat(c, sx, ey + ry * 0.12, rx * 0.66, ry * 0.74, mouth); put(c, sx - rx * 0.35, ey - ry * 0.38, '#ffffff'); }
  for (const [mx, my] of [[-2, 2], [-1, 3], [0, 3], [1, 3], [2, 2]]) put(c, cx + mx, ey + ry + my, mouth);
}

// --- shieldshard — Shieldshard (machine / hero, Fierce) --------------------
export function shieldshard() {
  const c = canvas(62, 66); const cx = 31;
  flat(c, cx, 62, 18, 3, '#0a0f14');
  // stony body + head (low dither = rock)
  form(c, cx, 44, 16, 15, STONE, { light: LIGHT, steps: 6, ambient: 0.34, dither: false });
  form(c, cx, 24, 12, 11, STONE, { light: LIGHT, steps: 6, ambient: 0.34, dither: false });
  form(c, cx - 16, 44, 4, 7, STONE, { light: LIGHT, steps: 5, ambient: 0.3, dither: false });
  form(c, cx + 16, 44, 4, 7, STONE, { light: LIGHT, steps: 5, ambient: 0.3, dither: false });
  form(c, cx - 8, 60, 5, 4, STONE, { light: LIGHT, steps: 5, ambient: 0.3, dither: false });
  form(c, cx + 8, 60, 5, 4, STONE, { light: LIGHT, steps: 5, ambient: 0.3, dither: false });
  // a great crystal SHIELD across the chest (gem)
  flat(c, cx, 44, 10, 12, '#0a1a2c');
  form(c, cx, 44, 8, 10, GEM, { light: LIGHT, steps: 8, ambient: 0.3, rim: 0.5 });
  for (let i = 0; i < 8; i++) put(c, cx - 4 + i * 0.5, 36 + i, i < 4 ? '#ffffff' : '#cfeeff'); // facet streak
  // shoulder shards
  for (const [gx, gy, s] of [[13, 26, 5], [49, 24, 6]]) form(c, gx, gy, s, s * 1.4, GEM, { light: LIGHT, steps: 6, ambient: 0.3, rim: 0.5 });
  fierce(c, cx, 24, 6, 3.2, 3.4, '#9fe6ff', shade(STONE[0], -0.1));
  smooth(c); outline(c, '#14100c');
  return toPixelArt(c);
}

// --- geomote — Geomote (nature / hero, Friendly) ---------------------------
export function geomote() {
  const c = canvas(56, 60); const cx = 28;
  flat(c, cx, 55, 15, 3, '#0a1408');
  // round mossy boulder body
  form(c, cx, 36, 17, 16, STONE, { light: LIGHT, steps: 6, ambient: 0.36, dither: false });
  // a cap of moss over the top
  form(c, cx, 24, 15, 10, MOSS, { light: LIGHT, steps: 6, ambient: 0.4, only: (x, y) => y < 28 });
  // crystal sprouts on the shoulders
  for (const [gx, gy, h] of [[14, 24, 8], [42, 22, 9]]) { for (let i = 0; i < h; i++) put(c, gx, gy - i, MOSS[Math.min(4, 2 + Math.floor(i / h * 3))]); put(c, gx + 1, gy - Math.floor(h / 2), '#dcffb0'); }
  // stubby feet
  form(c, cx - 8, 52, 5, 4, STONE, { light: LIGHT, steps: 5, ambient: 0.32, dither: false });
  form(c, cx + 8, 52, 5, 4, STONE, { light: LIGHT, steps: 5, ambient: 0.32, dither: false });
  // pebble freckles
  for (const [a, b] of [[20, 40], [36, 42], [24, 46]]) put(c, a, b, shade(STONE[1], -0.15));
  friendly(c, cx, 36, 7, 3.6, 4.2, '#1a2e10');
  smooth(c); outline(c, '#0e1608');
  return toPixelArt(c);
}

// --- prismguard — Prismguard (water / hero, Fierce) ------------------------
export function prismguard() {
  const c = canvas(60, 70); const cx = 30;
  flat(c, cx, 66, 16, 3, '#08131f');
  // icy crystalline torso + head
  form(c, cx, 48, 15, 16, ICE, { light: LIGHT, steps: 10, ambient: 0.26, rim: 0.6 });
  form(c, cx, 26, 12, 12, ICE, { light: LIGHT, steps: 10, ambient: 0.26, rim: 0.6 });
  // facet chips
  for (const [fx, fy, s] of [[24, 44, 4], [38, 50, 4], [30, 56, 5]]) flat(c, fx, fy, s, s * 0.7, shade(ICE[3], 0.05));
  // arms + a crystal spear
  form(c, cx - 17, 46, 4, 11, ICE, { light: LIGHT, steps: 8, ambient: 0.28, rim: 0.4 });
  form(c, cx + 17, 46, 4, 11, ICE, { light: LIGHT, steps: 8, ambient: 0.28, rim: 0.4 });
  for (let i = 0; i < 20; i++) put(c, cx + 19, 60 - i, ICE[Math.min(4, 2 + Math.floor(i / 20 * 3))]); // spear shaft
  for (const [dx, dy] of [[0, -21], [-1, -18], [1, -18]]) put(c, cx + 19 + dx, 60 + dy, '#ffffff'); // spearhead
  // ice crown
  for (const [dx, h] of [[-7, 7], [-2, 10], [3, 9], [8, 6]]) { for (let i = 0; i < h; i++) put(c, cx + dx, 16 - i, ICE[Math.min(4, 2 + Math.floor(i / h * 2))]); }
  fierce(c, cx, 26, 6, 3.4, 3.2, '#a6f0ff', '#0e2c48');
  smooth(c); outline(c, '#08202f');
  return toPixelArt(c);
}

// --- vaultwarden — Vaultwarden (water / hero BOSS) -------------------------
// The Warden Vault's keeper: a colossal amethyst-cored guardian.
export function vaultwarden() {
  const c = canvas(82, 86); const cx = 41;
  flat(c, cx, 81, 26, 4, '#08131f');
  // shoulder crystal spires (asymmetric)
  const spire = (bx, by, w, h, dir) => { for (let i = 0; i < h; i++) { const ww = w * (1 - i / h); for (let dx = -ww; dx <= ww; dx++) put(c, bx + dx + dir * i * 0.25, by - i, AMETHYST[Math.min(4, 1 + Math.floor((i / h) * 3 + (dx + ww) / (2 * ww + 0.01)))]); } };
  spire(16, 54, 6, 24, -1); spire(66, 54, 7, 28, 1); spire(24, 50, 4, 15, -1); spire(58, 50, 4, 17, 1);
  // massive stone torso + head
  form(c, cx, 60, 23, 20, STONE, { light: LIGHT, steps: 7, ambient: 0.32, dither: false });
  form(c, cx, 34, 16, 15, STONE, { light: LIGHT, steps: 7, ambient: 0.32, dither: false });
  // arms + gauntlets
  form(c, cx - 24, 58, 5, 13, STONE, { light: LIGHT, steps: 6, ambient: 0.3, dither: false });
  form(c, cx + 24, 58, 5, 13, STONE, { light: LIGHT, steps: 6, ambient: 0.3, dither: false });
  form(c, cx - 25, 70, 5, 5, STONE, { light: LIGHT, steps: 5, ambient: 0.3, dither: false });
  form(c, cx + 25, 70, 5, 5, STONE, { light: LIGHT, steps: 5, ambient: 0.3, dither: false });
  // huge glowing amethyst core in the chest
  flat(c, cx, 60, 9, 11, '#1a0e40');
  form(c, cx, 60, 7, 9, AMETHYST, { light: [0, 0, 1], steps: 6, ambient: 0.5, rim: 0.5 });
  put(c, cx - 1, 56, '#ffffff'); put(c, cx, 55, '#ffffff');
  // crown of amethyst shards
  for (const [dx, h] of [[-9, 9], [-3, 13], [3, 12], [9, 8]]) { for (let i = 0; i < h; i++) put(c, cx + dx, 22 - i, AMETHYST[Math.min(4, 2 + Math.floor(i / h * 2))]); }
  fierce(c, cx, 34, 7, 3.8, 3.6, '#c0a0ff', shade(STONE[0], -0.1));
  smooth(c); outline(c, '#14100c');
  return toPixelArt(c);
}

export const CRYSTAL_HEROES = {
  ccShieldshard: { species: 'Shieldshard', element: 'machine', personality: 'fierce', build: shieldshard },
  ccGeomote: { species: 'Geomote', element: 'nature', personality: 'friendly', build: geomote },
  ccPrismguard: { species: 'Prismguard', element: 'water', personality: 'fierce', build: prismguard },
  ccVaultwarden: { species: 'Vaultwarden', element: 'water', personality: 'fierce', build: vaultwarden },
};
