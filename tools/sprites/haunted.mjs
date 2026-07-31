// The Haunted Dungeon (reach 4) roster — its own style, the coldest of the four.
//
// Style: "spectral ink". Bodies are near-monochrome ash (a cold violet-grey
// ramp, very low ambient) so nothing is truly lit — these are dead things. The
// only colour is ONE emissive accent per creature: it rims the silhouette
// (`rimGlow`), burns in the hollow eyes (`glowEyes`), and marks whatever the
// creature carries of the light it lost. The lower body doesn't end so much as
// dissolve — `mist` dithers it away into the dark, so revenants and wisps trail
// off into nothing. High-contrast, floating, translucent — the opposite of the
// warm Overgrowth.
//
// Built on paint.mjs; keyed by art key for integrate-reaches.mjs. These keys are
// unique to the haunted roster (or shared only with a species' own evolution),
// so they're replaced in place — no repointing needed.
import { canvas, form, flat, put, smooth, outline, toPixelArt, shade } from './paint.mjs';

const ASH = ['#0b0a12', '#20202e', '#3a3a4c', '#63637a', '#a6a6be']; // cold grey body
const BONE = ['#161420', '#2e2b3a', '#4f4a5e', '#7d7688', '#cdc6d2']; // paler ash (bone/cloth)
const DUSK = [-0.5, -0.62, 0.6];

// --- style helpers ---------------------------------------------------------
// Dissolve the body into mist below `topY`, fully gone by `botY`. Deterministic
// dither so a rebuild is identical.
function mist(c, topY, botY) {
  for (let y = topY; y < c.h; y++) {
    const t = Math.max(0, Math.min(1, (y - topY) / (botY - topY)));
    const keep = 1 - t;
    for (let x = 0; x < c.w; x++) {
      if (!c[y][x]) continue;
      const v = ((x * 37 + y * 91 + ((x ^ y) * 13)) % 16) / 16;
      if (v > keep) c[y][x] = null;
    }
  }
}
// Emissive accent rim: paint most exterior-facing body pixels the accent so the
// silhouette glows. Run after smooth(), before outline().
function rimGlow(c, accent, thin = 7) {
  const bg = (x, y) => x < 0 || y < 0 || x >= c.w || y >= c.h || c[y][x] === null;
  const add = [];
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    if (c[y][x] === null) continue;
    if (bg(x - 1, y) || bg(x + 1, y) || bg(x, y - 1) || bg(x, y + 1)) {
      if ((x * 13 + y * 7) % 10 < thin) add.push([x, y]);
    }
  }
  for (const [x, y] of add) c[y][x] = accent;
}
// A soft outer halo — a few dim accent specks floating just off the silhouette.
function halo(c, accent, pts) {
  for (const [x, y] of pts) put(c, x, y, shade(accent, -0.4));
}
// Hollow glowing eyes: dark socket, accent iris, white-hot core.
function glowEyes(c, cx, dx, y, accent, r = 2.4) {
  for (const sx of [cx - dx, cx + dx]) {
    flat(c, sx, y, r + 0.8, r + 0.8, '#050510');
    flat(c, sx, y, r, r, accent);
    flat(c, sx, y, r * 0.5, r * 0.5, '#ffffff');
  }
}
// finisher shared by every haunted sprite.
function haunt(c, accent, mistTop, mistBot, outlineHex = '#050410') {
  smooth(c);
  rimGlow(c, accent);
  outline(c, outlineHex);
  if (mistTop) mist(c, mistTop, mistBot);
  return toPixelArt(c);
}

// --- cursedArmor — Cryptguard (dark / hero, Fierce) ------------------------
// A hollow suit of grave-plate; nothing inside but two cold lights.
export function cursedArmor() {
  const c = canvas(60, 74); const cx = 30; const AC = '#7fd4ff';
  flat(c, cx, 70, 16, 3, '#05070c');
  // broad pauldrons + torso plate + tasset skirt
  form(c, cx - 16, 34, 7, 7, ASH, { light: DUSK, steps: 7, ambient: 0.2 });
  form(c, cx + 16, 34, 7, 7, ASH, { light: DUSK, steps: 7, ambient: 0.2 });
  form(c, cx, 44, 15, 17, ASH, { light: DUSK, steps: 8, ambient: 0.18 });
  form(c, cx, 62, 12, 8, ASH, { light: DUSK, steps: 7, ambient: 0.18 });
  // arms + heavy gauntlets
  form(c, cx - 17, 46, 4.5, 10, ASH, { light: DUSK, steps: 6, ambient: 0.18 });
  form(c, cx + 17, 46, 4.5, 10, ASH, { light: DUSK, steps: 6, ambient: 0.18 });
  // a chink of accent light leaking between the breastplate seams
  for (const [sx, sy] of [[cx, 40], [cx, 44], [cx - 1, 48], [cx + 1, 52]]) put(c, sx, sy, AC);
  flat(c, cx, 46, 2.4, 4, shade(AC, -0.35)); // core glow behind the seam
  // horned helm
  form(c, cx, 22, 11, 11, ASH, { light: DUSK, steps: 7, ambient: 0.2 });
  for (const dir of [-1, 1]) for (let i = 0; i < 8; i++) put(c, cx + dir * (8 + i * 0.5), 16 - i, ASH[1 + (i > 4 ? 1 : 0)]); // horns
  // visor slit with the two cold lights
  flat(c, cx, 24, 8, 1.6, '#04060a');
  glowEyes(c, cx, 4, 24, AC, 1.9);
  return haunt(c, AC, 0, 0); // armour is solid — no mist
}

// --- graveCrawler — Gravemaw (nature / assassin, Uncanny) ------------------
// A low, many-eyed maw that drags itself up out of the grave-mould.
export function graveCrawler() {
  const c = canvas(66, 52); const cx = 33; const AC = '#9bff72';
  flat(c, cx, 48, 20, 3, '#050905');
  // long low body, humped, dragging a dissolving tail
  form(c, cx + 4, 34, 20, 11, ASH, { light: DUSK, steps: 8, ambient: 0.2 });
  form(c, cx - 14, 36, 10, 8, ASH, { light: DUSK, steps: 7, ambient: 0.2 });
  // clawed forelimbs clawing forward
  for (const [lx, dir] of [[cx - 20, -1], [cx - 12, -1]]) {
    for (let i = 0; i < 7; i++) put(c, lx - i * 0.4, 40 + i * 0.5, ASH[2]);
    for (const cw of [-1, 0, 1]) put(c, lx - 3 + cw, 45, BONE[4]); // pale claws
  }
  // ribbed spine + a couple of bone spurs
  for (let x = cx - 6; x < cx + 22; x += 3) flat(c, x, 27, 1, 2, shade(ASH[1], -0.1));
  for (const [bx, h] of [[cx + 2, 5], [cx + 10, 7], [cx + 18, 4]]) for (let i = 0; i < h; i++) put(c, bx, 28 - i, BONE[3]);
  // gaping maw at the front (dark) ringed with pale teeth
  const mx = cx - 18;
  flat(c, mx, 36, 5, 4, '#040804');
  for (let i = -4; i <= 4; i++) { put(c, mx + i, 33, BONE[4]); put(c, mx + i, 39, BONE[4]); }
  // UNCANNY: a cluster of too-many small eyes over the hump, uneven
  for (const [ex, ey, r] of [[cx - 2, 28, 1.5], [cx + 3, 26, 1.2], [cx + 8, 29, 1.4], [cx + 1, 31, 1], [cx + 13, 27, 1.1]]) {
    flat(c, ex, ey, r + 0.6, r + 0.6, '#04080a'); flat(c, ex, ey, r, r, AC); put(c, ex, ey, '#ffffff');
  }
  return haunt(c, AC, 42, 52); // tail-end dissolves into mould
}

// --- wraithWisp — Wispling (dark / mage, Nervous) --------------------------
// A small trembling flame-ghost, all head and no body — trails off to nothing.
export function wraithWisp() {
  const c = canvas(48, 60); const cx = 24; const AC = '#a6f4ff';
  // a wispy teardrop body: round head tapering to a dissolving tail
  form(c, cx, 22, 13, 13, ASH, { light: DUSK, steps: 8, ambient: 0.22 });
  form(c, cx, 36, 8, 12, ASH, { light: DUSK, steps: 7, ambient: 0.2 });
  form(c, cx, 48, 4, 9, ASH, { light: DUSK, steps: 6, ambient: 0.2 });
  // two little wispy arms held nervously close
  form(c, cx - 11, 30, 3, 5, ASH, { light: DUSK, steps: 5, ambient: 0.2 });
  form(c, cx + 11, 30, 3, 5, ASH, { light: DUSK, steps: 5, ambient: 0.2 });
  // a flicker of cold flame on the crown
  for (let i = 0; i < 6; i++) put(c, cx + (i % 2 ? 1 : -1), 9 - i, shade(AC, -i * 0.08));
  // NERVOUS: big uneven eyes + tiny wavering mouth
  glowEyes(c, cx, 5, 21, AC, 2.6);
  flat(c, cx + 5, 20.5, 1.2, 1.2, '#050510'); // one pupil smaller/higher — uneven
  for (const [mx, my] of [[-1, 28], [0, 29], [1, 28]]) put(c, cx + mx, my, shade(AC, -0.2));
  halo(c, AC, [[cx - 14, 14], [cx + 15, 16], [cx - 12, 8], [cx + 12, 6]]);
  return haunt(c, AC, 40, 60);
}

// --- revenant — Revenance (dark / mage, Uncanny) ---------------------------
// A tall cloaked caster; the cowl is empty but for a single displaced eye.
export function revenant() {
  const c = canvas(58, 78); const cx = 29; const AC = '#c79bff';
  // trailing robe (BONE cloth), widening then dissolving at the hem
  form(c, cx, 50, 17, 22, BONE, { light: DUSK, steps: 8, ambient: 0.2 });
  form(c, cx, 34, 12, 14, BONE, { light: DUSK, steps: 8, ambient: 0.2 });
  // cloth folds
  for (const fx of [cx - 8, cx - 2, cx + 5, cx + 11]) for (let y = 40; y < 66; y += 2) put(c, fx + Math.sin(y / 6) * 1.2, y, shade(BONE[1], -0.12));
  // long sleeves ending in skeletal hands raised to cast
  form(c, cx - 15, 44, 4, 12, BONE, { light: DUSK, steps: 6, ambient: 0.2 });
  form(c, cx + 15, 44, 4, 12, BONE, { light: DUSK, steps: 6, ambient: 0.2 });
  for (const [hx, dir] of [[cx - 16, -1], [cx + 16, 1]]) for (const f of [-1.5, 0, 1.5]) put(c, hx + f, 32, BONE[4]);
  // a small orb of gathered dark magic between the hands
  flat(c, cx, 30, 3, 3, '#0a0518'); form(c, cx, 30, 2.4, 2.4, ['#3a1a6a', '#7a3ad0', AC], { light: [0, 0, 1], steps: 5, ambient: 0.5 });
  // deep empty cowl
  form(c, cx, 22, 11, 12, ASH, { light: DUSK, steps: 7, ambient: 0.16 });
  flat(c, cx, 24, 7, 8, '#040309'); // the hood's dark
  // UNCANNY: one eye, off-centre and low in the hood
  flat(c, cx + 3, 26, 2.4, 2.4, AC); put(c, cx + 3, 26, '#ffffff');
  put(c, cx - 4, 22, shade(AC, -0.4)); // a distant second glint where an eye should be
  return haunt(c, AC, 60, 78);
}

// --- lastlight — Lastlight (dark / mage, Uncanny BOSS) ---------------------
// The keeper of the final ember; a great cowled shade cupping a dying gold light
// that the whole sprite is lit by, against its own cold accent.
export function lastlight() {
  const c = canvas(80, 92); const cx = 40; const AC = '#ffe6a0'; const GOLD = '#ffd24a';
  // vast robe billowing out and dissolving into the dark below
  form(c, cx, 62, 24, 28, ASH, { light: DUSK, steps: 9, ambient: 0.16 });
  form(c, cx, 40, 16, 18, ASH, { light: DUSK, steps: 9, ambient: 0.16 });
  // fold shadows
  for (const fx of [cx - 12, cx - 4, cx + 6, cx + 14]) for (let y = 54; y < 84; y += 2) put(c, fx + Math.sin(y / 7) * 1.6, y, shade(ASH[0], 0.08));
  // long arms cupping the ember at the chest
  form(c, cx - 20, 56, 5, 16, ASH, { light: DUSK, steps: 6, ambient: 0.18 });
  form(c, cx + 20, 56, 5, 16, ASH, { light: DUSK, steps: 6, ambient: 0.18 });
  for (const [hx, dir] of [[cx - 15, 1], [cx + 15, -1]]) for (let i = 0; i < 6; i++) put(c, hx + dir * i * 0.5, 60 - i * 0.3, BONE[3]); // cupped hands
  // the dying ember — a warm gold light the robe is lit by (the reach's LP motif)
  flat(c, cx, 58, 8, 8, '#3a2a08');
  form(c, cx, 58, 6, 6, ['#6b4e10', GOLD, '#fff6d0'], { light: [0, 0, 1], steps: 6, ambient: 0.5, rim: 0.4 });
  put(c, cx, 55, '#ffffff');
  // warm bounce of that light up onto the underside of the cowl
  for (const [gx, gy] of [[cx - 5, 50], [cx + 5, 50], [cx, 48]]) put(c, gx, gy, shade(GOLD, -0.2));
  // towering cowl + a thin crown of cold accent flames
  form(c, cx, 28, 15, 16, ASH, { light: DUSK, steps: 8, ambient: 0.14 });
  flat(c, cx, 30, 10, 11, '#040309');
  for (const dx of [-9, -4, 0, 4, 9]) for (let i = 0; i < 6 + (dx === 0 ? 3 : 0); i++) put(c, cx + dx + Math.sin(i / 2) * 0.8, 16 - i, shade(AC, -i * 0.06));
  // UNCANNY: two hollow eyes far apart + a third, higher and centred
  glowEyes(c, cx, 7, 30, AC, 2.4);
  flat(c, cx, 24, 1.8, 2.2, AC); put(c, cx, 24, '#ffffff');
  return haunt(c, AC, 74, 92);
}

export const HAUNTED = {
  cursedArmor: { species: 'Cryptguard', element: 'dark', personality: 'fierce', build: cursedArmor },
  graveCrawler: { species: 'Gravemaw', element: 'nature', personality: 'uncanny', build: graveCrawler },
  wraithWisp: { species: 'Wispling', element: 'dark', personality: 'nervous', build: wraithWisp },
  revenant: { species: 'Revenance', element: 'dark', personality: 'uncanny', build: revenant },
  lastlight: { species: 'Lastlight', element: 'dark', personality: 'uncanny', build: lastlight },
};
