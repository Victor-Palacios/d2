// The Crystal Cavern (reach 2) roster, painted with the volumetric engine
// (paint.mjs) for a richer, more generated-looking style than the flat-band
// Quiet Crossing sprites. Keyed by art key for integrate.mjs.
import { canvas, form, flat, put, spec, eyes, smooth, outline, toPixelArt, shade, ramp } from './paint.mjs';

const GEM = ['#0d2a4a', '#1f5a8a', '#3aa0d0', '#9fe6ff', '#ffffff'];
const PRISM = ['#7a3ad0', '#3a6ad0', '#3ac0d0', '#3ad07a', '#e6d84a', '#ff7ac0'];
const STONE = ['#241d18', '#463a30', '#6b5c4a', '#9a8b72', '#caba98'];
const AMETHYST = ['#241050', '#5a2ec0', '#9a6aff', '#d6c4ff', '#ffffff'];
const ICE = ['#0e2c48', '#1f5a8a', '#4aa8dc', '#a6e6ff', '#ffffff'];
const LIGHT = [-0.52, -0.62, 0.58];

// friendly eyes + blush + smile
function friendly(c, cx, ey, dx, rx, ry) {
  eyes(c, cx, dx, ey, rx, ry, { white: '#f4fbff', pupil: '#0e2038', glint: '#ffffff' });
  flat(c, cx - dx - 2, ey + ry, 2.4, 1.4, '#ff9ab0'); flat(c, cx + dx + 2, ey + ry, 2.4, 1.4, '#ff9ab0');
  for (const [mx, my] of [[-2, 2], [-1, 3], [0, 3], [1, 3], [2, 2]]) put(c, cx + mx, ey + ry + my, '#0e2038');
}
// clever: half-lidded (lid = skin), small pupils, offset smirk
function clever(c, cx, ey, dx, rx, ry, skin) {
  for (const sx of [cx - dx, cx + dx]) {
    flat(c, sx, ey, rx, ry, '#f4fbff'); flat(c, sx, ey + ry * 0.2, rx * 0.55, ry * 0.6, '#0e2038');
    flat(c, sx - rx * 0.35, ey - ry * 0.35, rx * 0.28, ry * 0.28, '#ffffff');
    flat(c, sx, ey - ry * 0.55, rx * 1.1, ry * 0.7, skin); // lid over the top
  }
  for (const [mx, my] of [[-2, 1], [-1, 1], [0, 0], [1, -1]]) put(c, cx + mx, ey + ry + 2 + my, '#0e2038'); // smirk
}
// fierce: narrow glowing eyes + heavy brow, no cute mouth
function fierce(c, cx, ey, dx, rx, ry, glow, brow) {
  for (const dir of [-1, 1]) {
    const x = cx + dir * dx;
    flat(c, x, ey, rx, ry * 0.6, '#101018'); flat(c, x, ey, rx * 0.7, ry * 0.4, glow); put(c, x - dir, ey - 1, '#ffffff');
    for (let i = 0; i <= rx * 1.7; i++) { put(c, x - dir * i * 0.7, ey - ry - 1 + i * 0.34, brow); put(c, x - dir * i * 0.7, ey - ry + i * 0.34, brow); }
  }
}

// --- crystalSlime — Shardling (water / mage, Friendly) ---------------------
export function crystalSlime() {
  const c = canvas(60, 60);
  flat(c, 30, 54, 17, 3, '#0a1420');
  form(c, 30, 32, 17, 16, GEM, { light: LIGHT, steps: 10, ambient: 0.28, rim: 0.55 });
  form(c, 30, 42, 17, 11, GEM, { light: LIGHT, steps: 10, ambient: 0.30, rim: 0.35 });
  form(c, 18, 47, 5.5, 5, GEM, { light: LIGHT, steps: 8, ambient: 0.3 });
  form(c, 42, 46, 4.5, 4.5, GEM, { light: LIGHT, steps: 8, ambient: 0.3 });
  for (let i = 0; i < 8; i++) flat(c, 22 + i * 0.6, 20 + i, 1.1, 1.1, i < 5 ? '#ffffff' : '#cfeeff'); // facet streak
  form(c, 30, 41, 6, 7, ['#3aa0d0', '#9fe6ff', '#ffffff'], { light: [0, 0, 1], steps: 6, ambient: 0.62, only: (x, y) => ((x - 30) / 6) ** 2 + ((y - 41) / 7) ** 2 < 0.6 });
  friendly(c, 30, 33, 8, 4, 4.8);
  smooth(c); outline(c, '#08172c');
  return toPixelArt(c);
}

// --- prismMoth — Prismoth (water / assassin, Clever) -----------------------
export function prismMoth() {
  const c = canvas(64, 58); const cx = 32;
  // four iridescent wings (radial prism bands), asymmetric tilt
  const PR = ramp(PRISM, 12); // discrete iridescent band ramp (bounded colours)
  const wing = (wx, wy, rx, ry, root) => {
    for (let y = Math.floor(wy - ry); y <= Math.ceil(wy + ry); y++) for (let x = Math.floor(wx - rx); x <= Math.ceil(wx + rx); x++) {
      const nx = (x - wx) / rx, ny = (y - wy) / ry; if (nx * nx + ny * ny > 1) continue;
      const d = Math.min(1, Math.hypot(x - root[0], y - root[1]) / (rx * 1.7));
      let idx = Math.round(d * (PR.length - 1));
      const lit = -nx * 0.6 - ny * 0.6; idx += lit > 0.3 ? -1 : lit < -0.3 ? 1 : 0; // shade by shifting the band
      put(c, x, y, PR[Math.max(0, Math.min(PR.length - 1, idx))]);
    }
  };
  wing(15, 20, 13, 9, [cx, 26]); wing(50, 22, 12, 8, [cx, 26]);   // upper (left larger)
  wing(18, 34, 9, 7, [cx, 28]); wing(47, 35, 8, 6, [cx, 28]);     // lower
  // vein hints
  for (const [sx, sy, ex, ey] of [[27, 24, 8, 16], [27, 30, 12, 38], [37, 25, 56, 18], [37, 31, 52, 38]]) { const n = 8; for (let i = 0; i <= n; i++) put(c, sx + (ex - sx) * i / n, sy + (ey - sy) * i / n, '#2a1a4a'); }
  // fuzzy body
  form(c, cx, 30, 6, 12, ['#1a1030', '#3a2a5a', '#6a5a8a'], { light: LIGHT, steps: 7, ambient: 0.4 });
  for (let y = 22; y < 40; y += 3) flat(c, cx, y, 6, 0.6, '#120a24'); // segments
  // antennae (2px) + eyes
  const blk = (x, y, h) => { put(c, x, y, h); put(c, x + 1, y, h); put(c, x, y + 1, h); put(c, x + 1, y + 1, h); };
  for (let i = 0; i < 6; i++) { blk(cx - 3 - i * 0.7, 20 - i, '#2a1a4a'); blk(cx + 2 + i * 0.7, 20 - i, '#2a1a4a'); }
  flat(c, cx - 5, 13, 1.6, 1.6, '#ff7ac0'); flat(c, cx + 6, 13, 1.6, 1.6, '#ff7ac0');
  // clever face, high on the head so it reads as eyes (not a grin)
  for (const dir of [-1, 1]) {
    const x = cx + dir * 4;
    flat(c, x, 23, 3, 3.4, '#e8ecff'); flat(c, x, 24, 1.9, 2.1, '#12203a');
    put(c, x - 1, 22, '#ffffff'); flat(c, x, 21.4, 3.2, 1.3, '#2a1a4a'); // half-lid
  }
  put(c, cx - 1, 28, '#c9b0e8'); put(c, cx, 28, '#c9b0e8'); put(c, cx + 1, 27, '#c9b0e8'); // subtle smirk
  smooth(c); outline(c, '#0e0820');
  return toPixelArt(c);
}

// --- geodeGolem — Geodon (machine / hero, Fierce) --------------------------
export function geodeGolem() {
  const c = canvas(62, 66); const cx = 31;
  flat(c, cx, 62, 18, 3, '#0a0f14');
  // crystal clusters on the back/shoulders (drawn first)
  for (const [gx, gy, s] of [[12, 26, 5], [50, 24, 6], [14, 40, 4], [49, 42, 4]]) {
    form(c, gx, gy, s, s * 1.5, AMETHYST, { light: LIGHT, steps: 6, ambient: 0.3, rim: 0.5 });
  }
  // stony body + head (solid, low dither → rock)
  form(c, cx, 44, 16, 15, STONE, { light: LIGHT, steps: 6, ambient: 0.34, dither: false });
  form(c, cx, 24, 13, 12, STONE, { light: LIGHT, steps: 6, ambient: 0.34, dither: false });
  form(c, cx - 17, 42, 4, 6, STONE, { light: LIGHT, steps: 5, ambient: 0.3, dither: false });
  form(c, cx + 17, 42, 4, 6, STONE, { light: LIGHT, steps: 5, ambient: 0.3, dither: false });
  form(c, cx - 8, 60, 5, 4, STONE, { light: LIGHT, steps: 5, ambient: 0.3, dither: false });
  form(c, cx + 8, 60, 5, 4, STONE, { light: LIGHT, steps: 5, ambient: 0.3, dither: false });
  // rock cracks + speckle
  for (const [a, b] of [[24, 40], [26, 46], [38, 42], [22, 30], [40, 30]]) put(c, a, b, shade(STONE[1], -0.2));
  // glowing geode core in the chest
  flat(c, cx, 45, 7, 8, '#1a0e40');
  form(c, cx, 45, 5.5, 6.5, AMETHYST, { light: [0, 0, 1], steps: 6, ambient: 0.55, rim: 0.4 });
  put(c, cx - 1, 43, '#ffffff'); put(c, cx, 42, '#ffffff');
  fierce(c, cx, 24, 6, 3.2, 3.6, '#c0a0ff', shade(STONE[0], -0.1));
  smooth(c); outline(c, '#14100c');
  return toPixelArt(c);
}

// --- crystalWarden — Glaciark (water / hero, Fierce BOSS) ------------------
export function crystalWarden() {
  const c = canvas(76, 80); const cx = 38;
  flat(c, cx, 75, 24, 4, '#08131f');
  // shoulder crystal spikes (sharp, angular) — asymmetric heights
  const spike = (bx, by, w, h, dir) => { for (let i = 0; i < h; i++) { const ww = w * (1 - i / h); for (let dx = -ww; dx <= ww; dx++) put(c, bx + dx + dir * i * 0.25, by - i, ICE[Math.min(4, 1 + Math.floor((i / h) * 3 + (dx + ww) / (2 * ww + 0.01)))]); } };
  spike(16, 50, 6, 22, -1); spike(60, 50, 7, 26, 1); spike(22, 46, 4, 14, -1); spike(54, 46, 4, 16, 1);
  // broad crystalline torso + head (faceted ice, translucent)
  form(c, cx, 58, 22, 18, ICE, { light: LIGHT, steps: 10, ambient: 0.26, rim: 0.6 });
  form(c, cx, 34, 16, 15, ICE, { light: LIGHT, steps: 10, ambient: 0.26, rim: 0.6 });
  // facet planes on the torso (flat brighter chips)
  for (const [fx, fy, s] of [[30, 52, 5], [46, 56, 5], [38, 64, 6]]) flat(c, fx, fy, s, s * 0.7, shade(ICE[3], 0.05));
  // arms (crystal)
  form(c, cx - 22, 56, 5, 12, ICE, { light: LIGHT, steps: 8, ambient: 0.28, rim: 0.4 });
  form(c, cx + 22, 56, 5, 12, ICE, { light: LIGHT, steps: 8, ambient: 0.28, rim: 0.4 });
  // ice crown shards
  for (const [dx, h] of [[-9, 8], [-3, 12], [3, 11], [9, 7]]) { for (let i = 0; i < h; i++) put(c, cx + dx, 22 - i, ICE[Math.min(4, 2 + Math.floor(i / h * 2))]); put(c, cx + dx + 1, 22 - Math.floor(h / 2), '#ffffff'); }
  // fierce, cold glowing eyes
  fierce(c, cx, 34, 7, 3.6, 3.4, '#a6f0ff', '#0e2c48');
  // frost breath specks
  for (const [a, b] of [[cx - 12, 44], [cx + 13, 46], [cx, 47]]) put(c, a, b, '#dff6ff');
  smooth(c); outline(c, '#08202f');
  return toPixelArt(c);
}

export const CAVERN = {
  crystalSlime: { species: 'Shardling', element: 'water', personality: 'friendly', build: crystalSlime },
  prismMoth: { species: 'Prismoth', element: 'water', personality: 'clever', build: prismMoth },
  geodeGolem: { species: 'Geodon', element: 'machine', personality: 'fierce', build: geodeGolem },
  crystalWarden: { species: 'Glaciark', element: 'water', personality: 'fierce', build: crystalWarden },
};
