// The Overgrowth (reach 3) roster — its own style, distinct from the flat Quiet
// Crossing and the glassy Crystal Cavern.
//
// Style: "gouache canopy". Warm sun keys the sprite from high top-left (light
// falling through leaves); shadows go GREEN, never black (a green-tinted
// ambient baked into every ramp). After shading, a deterministic scatter of
// brighter sun-flecks (`dapple`) dances over the body like dappled light, a
// top-left rim catches the sun, and the silhouette is wrapped in a soft mossy
// outline (not black). Organic, leafy, asymmetric — reads lush and hand-painted.
//
// Built on the paint.mjs volumetric primitives; keyed by art key for
// integrate-reaches.mjs. Species point their `art` field at these NEW keys so
// the jungle stops borrowing the Crossing's slime/bug/plant/lion sprites.
import { canvas, form, flat, put, smooth, outline, toPixelArt, shade } from './paint.mjs';

// Sun falls from high and to the left, through the canopy.
const SUN = [-0.5, -0.74, 0.46];

// Green-shadowed ramps (dark end is desaturated green, not black).
const BOG = ['#0b2b2a', '#12594a', '#2a9a6e', '#79d69a', '#dcf7df']; // boggle — bog water/frog
const LEAFBUG = ['#16380f', '#2e6a1c', '#57a02b', '#9dd847', '#eaffb2']; // chitter — leaf beetle
const FROND = ['#123016', '#245a2a', '#3f8a3c', '#7fc656', '#d6f09c']; // frondle — fern guardian
const PANTHER = ['#0d1c13', '#1b3a26', '#356048', '#5f9a68', '#a6d698']; // thorncat — jungle cat
const MANE = ['#3a2a0c', '#6b4e1c', '#a17f2c', '#d7c048', '#f7efa0']; // verdanox — golden mane
const HIDE = ['#132b16', '#255228', '#3d8038', '#6aad54', '#bfe28c']; // verdanox — green hide
const BARK = ['#2a1c10', '#493420', '#6e5238', '#9a7a54']; // frondle limbs / bark

// --- style helpers ---------------------------------------------------------
// Scatter brighter sun-flecks over the already-shaded body — deterministic
// (hash of x,y) so a rebuild is byte-identical. Only lands on mid/upper tones.
function dapple(c, amt = 0.26, density = 5) {
  for (let y = 0; y < c.h; y++) {
    for (let x = 0; x < c.w; x++) {
      const h = c[y][x];
      if (!h) continue;
      // A cheap spatial hash — clumps flecks into leafy dabs, not white noise.
      const v = (x * 73 + y * 149 + ((x >> 1) ^ (y >> 1)) * 31) % 47;
      if (v < density) c[y][x] = shade(h, amt);
      else if (v === 46) c[y][x] = shade(h, -0.14); // the odd deeper leaf-shadow
    }
  }
}
// Catch the sun on the upper-left silhouette: brighten body pixels whose
// up / up-left neighbour is empty. Run before outline().
function sunrim(c, hex) {
  const bg = (x, y) => x < 0 || y < 0 || x >= c.w || y >= c.h || c[y][x] === null;
  const add = [];
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    if (c[y][x] === null) continue;
    if (bg(x, y - 1) || bg(x - 1, y - 1)) add.push([x, y]);
  }
  for (const [x, y] of add) c[y][x] = hex;
}
// A leaf: a pointed ellipse with a centre vein.
function leaf(c, x, y, rx, ry, ang, pal) {
  const co = Math.cos(ang), si = Math.sin(ang);
  for (let dy = -ry; dy <= ry; dy++) for (let dx = -rx; dx <= rx; dx++) {
    const u = dx / rx, v = dy / ry;
    const taper = 1 - Math.abs(v) * 0.5;
    if (u * u / (taper * taper) + v * v > 1) continue;
    const px = x + dx * co - dy * si, py = y + dx * si + dy * co;
    put(c, px, py, pal[Math.abs(dx) < 0.6 ? 1 : 2 + (dy < 0 ? 1 : 0)]);
  }
}
// Friendly face: big round eyes, soft blush, small upturned mouth.
function friendly(c, cx, ey, dx, rx, ry, blush = '#ff9ab0') {
  for (const sx of [cx - dx, cx + dx]) {
    flat(c, sx, ey, rx, ry, '#f4fff0');
    flat(c, sx, ey + ry * 0.12, rx * 0.66, ry * 0.74, '#132a1e');
    put(c, sx - rx * 0.4, ey - ry * 0.4, '#ffffff');
  }
  flat(c, cx - dx - 1, ey + ry + 1, 2, 1.2, blush); flat(c, cx + dx + 1, ey + ry + 1, 2, 1.2, blush);
  for (const [mx, my] of [[-2, 2], [-1, 3], [0, 3], [1, 3], [2, 2]]) put(c, cx + mx, ey + ry + my, '#132a1e');
}
// Nervous face: uneven pupils, high small eyes, a small wavering mouth.
function nervous(c, cx, ey, dx, rx, ry) {
  const off = [[0, 0], [0.6, -0.4]];
  let k = 0;
  for (const sx of [cx - dx, cx + dx]) {
    flat(c, sx, ey, rx, ry, '#f2ffe6');
    flat(c, sx + off[k][0], ey + off[k][1], rx * 0.5, ry * 0.5, '#132a1e');
    put(c, sx - 1, ey - 1, '#ffffff'); k++;
  }
  for (const [mx, my] of [[-1, 2], [0, 3], [1, 2]]) put(c, cx + mx, ey + ry + my, '#132a1e');
}
// Fierce face: narrow glowing eyes, heavy brow, bared fangs.
function fierce(c, cx, ey, dx, rx, ry, glow, brow) {
  for (const dir of [-1, 1]) {
    const x = cx + dir * dx;
    flat(c, x, ey, rx, ry * 0.58, '#101410'); flat(c, x, ey, rx * 0.68, ry * 0.38, glow);
    put(c, x - dir, ey - 1, '#ffffff');
    for (let i = 0; i <= rx * 1.7; i++) put(c, x - dir * i * 0.7, ey - ry - 1 + i * 0.32, brow);
  }
}

// --- bogfrog — Boggle (water / mage, Friendly) -----------------------------
export function bogfrog() {
  const c = canvas(58, 56); const cx = 29;
  flat(c, cx, 51, 16, 3, '#08221c');
  // splayed webbed feet
  form(c, 15, 47, 6, 3.5, BOG, { light: SUN, steps: 7, ambient: 0.42 });
  form(c, 43, 47, 6, 3.5, BOG, { light: SUN, steps: 7, ambient: 0.42 });
  // low round bog body + domed head as one blobby mass
  form(c, cx, 36, 17, 13, BOG, { light: SUN, steps: 9, ambient: 0.4 });
  form(c, cx, 24, 14, 12, BOG, { light: SUN, steps: 9, ambient: 0.4 });
  // pale belly + a couple of lily-pad spots
  form(c, cx, 40, 9, 6, ['#1a6a52', '#3fb07e', '#bff0cf'], { light: [0, 0, 1], steps: 5, ambient: 0.6, only: (x, y) => ((x - cx) / 9) ** 2 + ((y - 40) / 6) ** 2 < 0.7 });
  for (const [sx, sy] of [[20, 30], [39, 33], [34, 26]]) { flat(c, sx, sy, 2.2, 1.8, shade(BOG[1], -0.15)); }
  // eye bumps riding high on the head (frog silhouette)
  form(c, cx - 7, 15, 5, 5, BOG, { light: SUN, steps: 7, ambient: 0.4 });
  form(c, cx + 7, 15, 5, 5, BOG, { light: SUN, steps: 7, ambient: 0.4 });
  dapple(c); sunrim(c, '#cdf3d6');
  // eyes on the bumps + wide friendly mouth
  for (const sx of [cx - 7, cx + 7]) { flat(c, sx, 14, 3, 3, '#fdffe8'); flat(c, sx, 14.5, 1.7, 1.8, '#0e2a18'); put(c, sx - 1, 13, '#ffffff'); }
  for (let i = -6; i <= 6; i++) put(c, cx + i, 27 + (Math.abs(i) > 4 ? -1 : 0), '#0e2a18'); // long smile
  flat(c, cx - 9, 24, 2, 1.3, '#ff9ab0'); flat(c, cx + 9, 24, 2, 1.3, '#ff9ab0');
  smooth(c); outline(c, '#07231a');
  return toPixelArt(c);
}

// --- leafbeetle — Chitter (nature / assassin, Nervous) ---------------------
export function leafbeetle() {
  const c = canvas(60, 56); const cx = 30;
  flat(c, cx, 51, 15, 2.5, '#0c2408');
  // six skittery legs poking out from under the shell (bent, jointed)
  for (const [lx, ly, dir] of [[17, 42, -1], [19, 47, -1], [43, 42, 1], [41, 47, 1], [18, 37, -1], [42, 37, 1]]) {
    for (let i = 0; i < 7; i++) put(c, lx + dir * (i < 4 ? i : 4) , ly + (i < 4 ? -i * 0.3 : (i - 4) * 1.4), '#0e2606');
  }
  // domed round beetle shell (single mass reads clearly), lit as a sphere
  form(c, cx, 36, 16, 13, LEAFBUG, { light: SUN, steps: 9, ambient: 0.42 });
  // bright central seam splitting the two elytra + a couple of leaf-veins each
  for (let y = 26; y < 48; y++) put(c, cx, y, shade(LEAFBUG[3], 0.1));
  for (const dir of [-1, 1]) for (const vy of [30, 37, 43]) for (let i = 2; i <= 8; i++) put(c, cx + dir * i, vy + i * 0.55, shade(LEAFBUG[1], -0.16));
  // little wing-case spots
  for (const [sx, sy] of [[cx - 8, 33], [cx + 8, 33], [cx - 6, 42], [cx + 6, 42]]) flat(c, sx, sy, 1.6, 1.4, shade(LEAFBUG[0], 0.15));
  // round head bump on top with big nervous eyes + two curling antennae
  form(c, cx, 21, 8, 6.5, LEAFBUG, { light: SUN, steps: 8, ambient: 0.44 });
  for (let i = 0; i < 8; i++) { const t = i / 7; put(c, cx - 5 - i * 0.8, 15 - i + t * t * 5, '#0e2606'); put(c, cx + 5 + i * 0.8, 15 - i + t * t * 5, '#0e2606'); }
  put(c, cx - 11, 17, '#eaffb2'); put(c, cx + 11, 17, '#eaffb2'); // antenna tips
  dapple(c, 0.24); sunrim(c, '#e6ffb0');
  nervous(c, cx, 20, 3.6, 2.7, 3);
  smooth(c); outline(c, '#0a2606');
  return toPixelArt(c);
}

// --- fernguard — Frondle (nature / hero, Friendly-sturdy) -------------------
export function fernguard() {
  const c = canvas(58, 64); const cx = 29;
  flat(c, cx, 60, 15, 3, '#0a2410');
  // a crown of fern fronds fanning up and out (asymmetric)
  for (const [ang, len, sx] of [[-0.9, 15, cx - 3], [-0.5, 18, cx - 1], [-0.15, 20, cx], [0.25, 18, cx + 2], [0.7, 14, cx + 4]]) {
    for (let i = 0; i < len; i++) {
      const x = sx + Math.sin(ang) * i, y = 26 - Math.cos(ang) * i;
      put(c, x, y, FROND[2 + (i % 2)]);
      if (i % 2 === 0 && i > 2) { put(c, x - 1.4, y + 0.4, FROND[3]); put(c, x + 1.4, y + 0.4, FROND[3]); } // leaflets
    }
  }
  // stout bulb body + short bark legs
  form(c, cx, 46, 16, 15, FROND, { light: SUN, steps: 9, ambient: 0.42 });
  form(c, cx - 8, 58, 4.5, 5, BARK, { light: SUN, steps: 5, ambient: 0.36 });
  form(c, cx + 8, 58, 4.5, 5, BARK, { light: SUN, steps: 5, ambient: 0.36 });
  // little leaf arms
  leaf(c, cx - 17, 46, 6, 4, -0.5, FROND); leaf(c, cx + 17, 46, 6, 4, 0.5, FROND);
  // a bloom on the chest
  flat(c, cx, 45, 3.5, 3.5, '#ffd166');
  for (const [px, py] of [[-3, 0], [3, 0], [0, -3], [0, 3], [-2, -2], [2, 2], [-2, 2], [2, -2]]) flat(c, cx + px, cx * 0 + 45 + py, 1.6, 1.6, '#ff8fb0');
  flat(c, cx, 45, 1.6, 1.6, '#fff0a0');
  dapple(c); sunrim(c, '#d6f0a0');
  friendly(c, cx, 42, 7, 3.6, 4);
  smooth(c); outline(c, '#0b2410');
  return toPixelArt(c);
}

// --- thornpanther — Thorncat (nature / assassin, Fierce-sleek) --------------
export function junglecat() {
  const c = canvas(66, 54); const cx = 33;
  flat(c, cx, 50, 20, 3, '#08160e');
  // low prowling body (long ellipse) + haunches
  form(c, cx, 36, 22, 10, PANTHER, { light: SUN, steps: 9, ambient: 0.38 });
  form(c, cx + 15, 33, 9, 9, PANTHER, { light: SUN, steps: 9, ambient: 0.38 }); // rear haunch
  // four legs
  for (const lx of [cx - 15, cx - 7, cx + 8, cx + 16]) form(c, lx, 46, 3.5, 6, PANTHER, { light: SUN, steps: 6, ambient: 0.34 });
  // curling tail with a thorn tuft
  for (let i = 0; i < 14; i++) put(c, cx - 20 - i * 0.7, 34 - Math.sin(i / 3) * 5, PANTHER[2]);
  for (const [tx, ty] of [[cx - 33, 30], [cx - 34, 28], [cx - 32, 27]]) put(c, tx, ty, '#c8d8a0');
  // head low and forward + leafy ears
  form(c, cx - 20, 30, 9, 8, PANTHER, { light: SUN, steps: 9, ambient: 0.38 });
  leaf(c, cx - 25, 22, 4, 6, -0.4, PANTHER); leaf(c, cx - 15, 22, 4, 6, 0.3, PANTHER);
  // thorn spines along the spine
  for (const dx of [-6, 0, 6, 12]) for (let i = 0; i < 4; i++) put(c, cx + dx, 27 - i, i > 1 ? '#c8d8a0' : PANTHER[3]);
  dapple(c, 0.22); sunrim(c, '#a6d698');
  // fierce eyes on the forward head (amber, slit)
  fierce(c, cx - 20, 29, 4, 2.6, 2.6, '#ffcf5a', '#0c1c12');
  for (const fx of [cx - 23, cx - 17]) { put(c, fx, 34, '#f0f6e0'); put(c, fx, 35, '#f0f6e0'); } // fangs
  smooth(c); outline(c, '#081a10');
  return toPixelArt(c);
}

// --- verdanox — Verdanox (nature / hero, Fierce BOSS) ----------------------
export function verdanox() {
  const c = canvas(80, 82); const cx = 40;
  flat(c, cx, 77, 26, 4, '#06180c');
  // huge leonine mane — a ring of fronds/petals around the head (drawn first)
  for (let a = 0; a < 24; a++) {
    const ang = (a / 24) * Math.PI * 2;
    const r0 = 15, len = 12 + (a % 3) * 3;
    const bx = cx + Math.cos(ang) * r0, by = 30 + Math.sin(ang) * r0;
    for (let i = 0; i < len; i++) {
      const x = bx + Math.cos(ang) * i, y = by + Math.sin(ang) * i;
      put(c, x, y, MANE[Math.min(4, 1 + Math.floor(i / len * 3))]);
    }
  }
  // broad green body + forelimbs
  form(c, cx, 58, 24, 18, HIDE, { light: SUN, steps: 10, ambient: 0.4 });
  form(c, cx - 15, 70, 6, 8, HIDE, { light: SUN, steps: 6, ambient: 0.36 });
  form(c, cx + 15, 70, 6, 8, HIDE, { light: SUN, steps: 6, ambient: 0.36 });
  // golden chest plate / heart-bloom
  form(c, cx, 56, 8, 9, ['#6b4e1c', '#a17f2c', '#f0d860'], { light: [0, 0, 1], steps: 6, ambient: 0.55 });
  // maned head
  form(c, cx, 30, 15, 14, MANE, { light: SUN, steps: 9, ambient: 0.42 });
  form(c, cx, 33, 10, 9, ['#255228', '#3d8038', '#8fc06a'], { light: SUN, steps: 7, ambient: 0.44 }); // muzzle
  dapple(c, 0.24); sunrim(c, '#f7efa0');
  // fierce crowned face
  fierce(c, cx, 30, 6.5, 3.4, 3.4, '#eaff8a', '#2a1c08');
  for (const fx of [cx - 3, cx + 3]) { put(c, fx, 40, '#f6f0d0'); put(c, fx, 41, '#f6f0d0'); } // fangs
  // little crown leaf between the eyes
  leaf(c, cx, 16, 4, 7, 0, ['#255228', '#3d8038', '#8fc06a', '#d6f09c']);
  smooth(c); outline(c, '#0a1e0e');
  return toPixelArt(c);
}

export const OVERGROWTH = {
  ogBogfrog: { species: 'Boggle', art: 'ogBogfrog', element: 'water', personality: 'friendly', build: bogfrog },
  ogLeafbeetle: { species: 'Chitter', art: 'ogLeafbeetle', element: 'nature', personality: 'nervous', build: leafbeetle },
  ogFernguard: { species: 'Frondle', art: 'ogFernguard', element: 'nature', personality: 'friendly', build: fernguard },
  ogJunglecat: { species: 'Thorncat', art: 'ogJunglecat', element: 'nature', personality: 'fierce', build: junglecat },
  ogVerdanox: { species: 'Verdanox', art: 'ogVerdanox', element: 'nature', personality: 'fierce', build: verdanox },
};

// species id → new art key, for repointing creatures.ts.
export const OVERGROWTH_REPOINT = {
  boggle: 'ogBogfrog',
  chitter: 'ogLeafbeetle',
  frondle: 'ogFernguard',
  thorncat: 'ogJunglecat',
  verdanox: 'ogVerdanox',
};
