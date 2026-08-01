// The Overgrowth (reach 3) is now the ASSASSIN dungeon — gouache-canopy style
// (paint.mjs), matching overgrowth.mjs. Four jungle predators: three stalkers
// and an apex boss. Low, fast, fanged; warm sun, green shadows, sun-flecks.
import { canvas, form, flat, put, smooth, outline, toPixelArt, shade } from './paint.mjs';

const SUN = [-0.5, -0.74, 0.46];
const PANTHER = ['#0d1c13', '#1b3a26', '#356048', '#5f9a68', '#a6d698'];
const VENOM = ['#0e2410', '#255a1e', '#4aa02e', '#8ad84a', '#e6ffb0'];
const SHADE = ['#0b160f', '#16301f', '#2a5238', '#4a8058', '#86c084'];
const BARK = ['#2a1c10', '#493420', '#6e5238', '#9a7a54'];

function dapple(c, amt = 0.24, density = 5) {
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    const h = c[y][x]; if (!h) continue;
    const v = (x * 73 + y * 149 + ((x >> 1) ^ (y >> 1)) * 31) % 47;
    if (v < density) c[y][x] = shade(h, amt); else if (v === 46) c[y][x] = shade(h, -0.14);
  }
}
function sunrim(c, hex) {
  const bg = (x, y) => x < 0 || y < 0 || x >= c.w || y >= c.h || c[y][x] === null;
  const add = [];
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) { if (c[y][x] === null) continue; if (bg(x, y - 1) || bg(x - 1, y - 1)) add.push([x, y]); }
  for (const [x, y] of add) c[y][x] = hex;
}
function leaf(c, x, y, rx, ry, ang, pal) {
  const co = Math.cos(ang), si = Math.sin(ang);
  for (let dy = -ry; dy <= ry; dy++) for (let dx = -rx; dx <= rx; dx++) {
    const u = dx / rx, v = dy / ry, taper = 1 - Math.abs(v) * 0.5;
    if (u * u / (taper * taper) + v * v > 1) continue;
    put(c, x + dx * co - dy * si, y + dx * si + dy * co, pal[Math.abs(dx) < 0.6 ? 1 : 2 + (dy < 0 ? 1 : 0)]);
  }
}
// fierce predator face: narrow glowing eyes, heavy brow, bared fangs
function fierce(c, cx, ey, dx, rx, ry, glow, brow, fangs = true) {
  for (const dir of [-1, 1]) {
    const x = cx + dir * dx;
    flat(c, x, ey, rx, ry * 0.55, '#101410'); flat(c, x, ey, rx * 0.66, ry * 0.36, glow); put(c, x - dir, ey - 1, '#ffffff');
    for (let i = 0; i <= rx * 1.7; i++) put(c, x - dir * i * 0.7, ey - ry - 1 + i * 0.32, brow);
  }
  if (fangs) for (const fx of [cx - 3, cx + 3]) { put(c, fx, ey + ry + 2, '#f0f6e0'); put(c, fx, ey + ry + 3, '#f0f6e0'); }
}
// clever face: half-lidded offset eyes, sly
function clever(c, cx, ey, dx, rx, ry, glow) {
  for (const dir of [-1, 1]) { const x = cx + dir * dx; flat(c, x, ey, rx, ry, '#f2ffe6'); flat(c, x, ey + ry * 0.2, rx * 0.55, ry * 0.6, '#132a1e'); flat(c, x, ey - ry * 0.55, rx * 1.1, ry * 0.7, glow); put(c, x - dir, ey - 1, '#fff'); }
}

// --- sporefang — Sporefang (nature / assassin, Fierce) ---------------------
export function sporefang() {
  const c = canvas(64, 54); const cx = 32;
  flat(c, cx, 50, 18, 3, '#08160e');
  form(c, cx, 36, 20, 10, VENOM, { light: SUN, steps: 9, ambient: 0.38 });        // low body
  form(c, cx + 13, 33, 8, 8, VENOM, { light: SUN, steps: 9, ambient: 0.38 });      // haunch
  for (const lx of [cx - 13, cx - 5, cx + 7, cx + 15]) form(c, lx, 46, 3.2, 6, VENOM, { light: SUN, steps: 6, ambient: 0.34 });
  // spore puffs along the spine
  for (const dx of [-8, -2, 4, 10]) { form(c, cx + dx, 26, 3, 3, ['#3a6a2a', '#8ad84a', '#e6ffb0'], { light: [0, 0, 1], steps: 4, ambient: 0.5 }); }
  // head low + forward, tufted ears
  form(c, cx - 18, 31, 8, 7, VENOM, { light: SUN, steps: 9, ambient: 0.38 });
  leaf(c, cx - 23, 24, 3.5, 5, -0.4, VENOM); leaf(c, cx - 13, 24, 3.5, 5, 0.3, VENOM);
  // tail
  for (let i = 0; i < 12; i++) put(c, cx + 18 + i * 0.6, 34 - Math.sin(i / 3) * 4, VENOM[2]);
  dapple(c, 0.22); sunrim(c, '#e6ffb0');
  fierce(c, cx - 18, 30, 3.6, 2.4, 2.4, '#c0ff5a', '#0c1c12');
  smooth(c); outline(c, '#081a10');
  return toPixelArt(c);
}

// --- vineraptor — Vineraptor (nature / assassin, Fierce) --------------------
export function vineraptor() {
  const c = canvas(56, 66); const cx = 28;
  flat(c, cx, 62, 13, 3, '#08160e');
  // upright raptor body + long neck
  form(c, cx, 42, 11, 15, SHADE, { light: SUN, steps: 9, ambient: 0.36 });
  form(c, cx + 2, 26, 6, 8, SHADE, { light: SUN, steps: 8, ambient: 0.36 });   // neck/head
  // strong legs + clawed feet
  form(c, cx - 5, 56, 3.4, 7, SHADE, { light: SUN, steps: 6, ambient: 0.32 });
  form(c, cx + 5, 56, 3.4, 7, SHADE, { light: SUN, steps: 6, ambient: 0.32 });
  for (const fx of [cx - 7, cx - 5, cx + 5, cx + 7]) put(c, fx, 62, '#c8d8a0');
  // little grasping arms with vine-claws
  form(c, cx - 10, 40, 2.6, 5, SHADE, { light: SUN, steps: 5, ambient: 0.34 });
  for (const f of [-1, 0, 1]) put(c, cx - 12 + f, 45, '#c8d8a0');
  // sickle claw raised
  for (let i = 0; i < 6; i++) put(c, cx + 8 + i * 0.4, 50 - i, '#c8d8a0');
  // a whip-tail of thorny vine
  for (let i = 0; i < 16; i++) { put(c, cx - 8 - i * 0.7, 48 + Math.sin(i / 2.5) * 4, SHADE[2]); if (i % 3 === 0) put(c, cx - 8 - i * 0.7, 47 + Math.sin(i / 2.5) * 4, '#8ad84a'); }
  // leaf crest
  leaf(c, cx + 2, 18, 3, 6, 0, ['#16301f', '#2a5238', '#4a8058', '#86c084']);
  dapple(c, 0.22); sunrim(c, '#86c084');
  fierce(c, cx + 2, 25, 3, 2.2, 2.2, '#ffcf5a', '#0c1c12');
  smooth(c); outline(c, '#081a10');
  return toPixelArt(c);
}

// --- bloomstalker — Bloomstalker (nature / assassin, Clever) ----------------
export function bloomstalker() {
  const c = canvas(66, 54); const cx = 33;
  flat(c, cx, 50, 19, 3, '#08160e');
  form(c, cx, 37, 21, 9, PANTHER, { light: SUN, steps: 9, ambient: 0.38 });      // sleek body
  form(c, cx + 14, 34, 8, 8, PANTHER, { light: SUN, steps: 9, ambient: 0.38 });
  for (const lx of [cx - 14, cx - 6, cx + 8, cx + 16]) form(c, lx, 46, 3, 6, PANTHER, { light: SUN, steps: 6, ambient: 0.34 });
  // head + big leaf ears
  form(c, cx - 19, 32, 8, 7, PANTHER, { light: SUN, steps: 9, ambient: 0.38 });
  leaf(c, cx - 24, 24, 4, 6, -0.4, PANTHER); leaf(c, cx - 14, 24, 4, 6, 0.3, PANTHER);
  // a lure-bloom on the tail tip (the clever trap)
  for (let i = 0; i < 14; i++) put(c, cx + 20 + i * 0.5, 33 - Math.sin(i / 3) * 5, PANTHER[2]);
  const bx = cx + 27, by = 26;
  for (const [px, py] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, 1], [-1, 1], [1, -1]]) put(c, bx + px, by + py, '#ff8fb0');
  put(c, bx, by, '#fff0a0');
  dapple(c, 0.22); sunrim(c, '#a6d698');
  clever(c, cx - 19, 31, 3.4, 2.4, 2.6, PANTHER[1]);
  smooth(c); outline(c, '#081a10');
  return toPixelArt(c);
}

// --- thornreaper — Thornreaper (nature / assassin BOSS) --------------------
// The apex of the Overgrowth: a great thorn-maned predator that hunts the
// hunters. Replaces Verdanox as the reach's boss.
export function thornreaper() {
  const c = canvas(84, 74); const cx = 42;
  flat(c, cx, 69, 26, 4, '#06180c');
  // long powerful body + haunches
  form(c, cx, 48, 27, 13, SHADE, { light: SUN, steps: 10, ambient: 0.36 });
  form(c, cx + 19, 44, 11, 11, SHADE, { light: SUN, steps: 10, ambient: 0.36 });
  for (const lx of [cx - 18, cx - 7, cx + 10, cx + 20]) form(c, lx, 60, 4.5, 8, SHADE, { light: SUN, steps: 7, ambient: 0.32 });
  for (const fx of [cx - 20, cx - 16, cx + 22, cx + 18]) for (const d of [0, 1]) put(c, fx, 67 + d, '#c8d8a0'); // claws
  // a mane of thorns along neck + spine
  for (const dx of [-10, -4, 2, 8, 14]) for (let i = 0; i < 7; i++) put(c, cx - 18 + (dx + 18) * 0.5, 36 - i + (dx * 0.1), i > 3 ? '#c8d8a0' : SHADE[3]);
  // head, low and forward, jaws wide
  form(c, cx - 24, 42, 11, 9, SHADE, { light: SUN, steps: 10, ambient: 0.36 });
  leaf(c, cx - 30, 31, 5, 8, -0.4, SHADE); leaf(c, cx - 18, 31, 5, 8, 0.3, SHADE);
  // thorn-tuft tail
  for (let i = 0; i < 16; i++) put(c, cx + 26 + i * 0.5, 42 - Math.sin(i / 3) * 6, SHADE[2]);
  for (const [tx, ty] of [[cx + 34, 34], [cx + 35, 32], [cx + 33, 30]]) put(c, tx, ty, '#c8d8a0');
  dapple(c, 0.2); sunrim(c, '#86c084');
  fierce(c, cx - 24, 40, 4.5, 3, 3, '#ff6a4a', '#0c1c12');
  for (const fx of [cx - 28, cx - 20]) { put(c, fx, 47, '#f0f6e0'); put(c, fx, 48, '#f0f6e0'); }
  smooth(c); outline(c, '#081a10');
  return toPixelArt(c);
}

export const OVERGROWTH_ASSASSINS = {
  ogSporefang: { species: 'Sporefang', element: 'nature', personality: 'fierce', build: sporefang },
  ogVineraptor: { species: 'Vineraptor', element: 'nature', personality: 'fierce', build: vineraptor },
  ogBloomstalker: { species: 'Bloomstalker', element: 'nature', personality: 'clever', build: bloomstalker },
  ogThornreaper: { species: 'Thornreaper', element: 'nature', personality: 'fierce', build: thornreaper },
};
