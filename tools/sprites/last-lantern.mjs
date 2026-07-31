// The Last Lantern (reach 5, the finale) roster — its own style, the fifth and
// warmest-in-the-dark.
//
// Style: "reliquary glass". These are HELD souls — flames a keeper froze and
// never let cross — so they are lit from WITHIN: a hot amber core backlights a
// translucent body (form() with a centre light and a dark→hot ramp, so the
// EDGES go dark and the middle burns). The shell is stained-glass: jewel-toned
// panels (amber, rose, violet, teal) divided by dark **leading** lines, with a
// warm **bloom** halo of light-motes spilling off the core. Nothing dissolves —
// these souls are contained, arrested, still (the exact opposite of the Haunted
// reach's cold external rim that trails off into mist). Warm, luminous, held.
//
// Built on paint.mjs. Each builder is stage-parametric (1→base, 2/3→evolved):
// the soul held longer burns bigger and brighter, gains panels/crown/wings, and
// its personality hardens. Keyed by art key for integrate-lantern.mjs.
import { canvas, form, flat, put, smooth, outline, toPixelArt, shade } from './paint.mjs';

const GLOW = [0, 0, 1]; // centre light → inner glow (bright core, dark rim)

// Jewel ramps: dark warm edge → hot centre. Read backlit under GLOW.
const AMBER = ['#1f0e03', '#6b3410', '#c46a18', '#ffb24a', '#fff2cc'];
const ROSE = ['#220814', '#6b1a3a', '#c43a6a', '#ff86a8', '#ffdbe6'];
const VIOLET = ['#140a24', '#3a1a6a', '#6a3ac0', '#ac82ff', '#ecdfff'];
const TEAL = ['#04201d', '#0e4a44', '#1c8a7a', '#5fd4ba', '#d6fff2'];
const ASHV = ['#120f18', '#2a2432', '#4a4256', '#877e94', '#d0c8dc']; // ashen glass
const LEAD = '#140a04'; // dark warm leading (came) — never pure black

// --- style helpers ---------------------------------------------------------
// A glowing glass panel: an ellipse backlit from its centre.
function panel(c, cx, cy, rx, ry, ramp, ambient = 0.14, only) {
  form(c, cx, cy, rx, ry, ramp, { light: GLOW, steps: 9, ambient, dither: true, only });
}
// A hot core with a white-gold heart, the source of all the light.
function core(c, cx, cy, r, hot = '#fff2cc') {
  flat(c, cx, cy, r, r, shade('#ffb24a', 0.1));
  flat(c, cx, cy, r * 0.55, r * 0.55, hot);
  put(c, cx, cy, '#ffffff');
}
// Dark leading lines across a body, dividing it into stained-glass panels.
// Segments are [x0,y0,x1,y1]; only painted where a body pixel already exists.
function lead(c, segs) {
  const body = (x, y) => x >= 0 && y >= 0 && x < c.w && y < c.h && c[y][x] !== null;
  for (const [x0, y0, x1, y1] of segs) {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n);
      if (body(x, y)) c[y][x] = LEAD;
    }
  }
}
// Warm bloom halo: deterministic light-motes spilling off the core into the
// dark. Radius grows with intensity. Motes are placed OUTSIDE the body.
function bloom(c, cx, cy, r, hex, n = 22) {
  const bg = (x, y) => x < 0 || y < 0 || x >= c.w || y >= c.h || c[y][x] === null;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (i % 3) * 0.5;
    const rr = r * (0.7 + ((i * 7) % 5) / 5 * 0.7);
    const x = Math.round(cx + Math.cos(a) * rr), y = Math.round(cy + Math.sin(a) * rr * 0.9);
    if (bg(x, y)) put(c, x, y, shade(hex, -((i % 4) * 0.14)));
  }
}
// Contained-light eyes: bright slits of held flame (dark socket, hot centre).
function heldEyes(c, cx, dx, y, r, hot = '#fff2cc', iris = '#ffd27a') {
  for (const sx of [cx - dx, cx + dx]) {
    flat(c, sx, y, r + 0.7, r + 0.7, '#0a0602');
    flat(c, sx, y, r, r, iris);
    put(c, sx, y, hot);
  }
}
// Personality mouths (kept minimal — the light carries most of the read).
function nervousMouth(c, cx, y) { for (const [mx, my] of [[-1, 0], [0, 1], [1, 0]]) put(c, cx + mx, y + my, '#0a0602'); }
function fierceMouth(c, cx, y, w) { for (let i = -w; i <= w; i++) put(c, cx + i, y + (Math.abs(i) === w ? -1 : 0), '#0a0602'); for (const i of [-w + 1, 0, w - 1]) put(c, cx + i, y + 1, '#fff2cc'); }
function uncannyMouth(c, cx, y) { for (let i = -2; i <= 2; i++) put(c, cx + i, y, '#0a0602'); put(c, cx, y - 2, '#0a0602'); } // detached mark

// shared finisher: bloom, hot core, warm outline. No mist — these are HELD.
function finish(c, cx, cy, haloR, halo = '#ffcf7a') {
  smooth(c);
  bloom(c, cx, cy, haloR, halo, Math.round(haloR * 1.4));
  outline(c, '#160b03');
  return toPixelArt(c);
}

// === Line 1 — Held Flame (mage / fire): Emberkeep → Lanternwake → Everember =
// A trembling flame sealed in glass, burning brighter the longer it is kept.
export function emberkeep(stage = 1) {
  const s = stage; const c = canvas(52 + s * 8, 58 + s * 10);
  const cx = (c.w / 2) | 0, by = c.h - 8;
  const R = 12 + s * 3;
  flat(c, cx, by, R * 0.9, 3, '#0c0a10');
  // teardrop glass body (rounded bell tapering up), backlit amber
  panel(c, cx, by - R, R, R * 1.2, AMBER);
  panel(c, cx, by - R * 1.7, R * 0.7, R * 0.9, AMBER); // the flame's shoulder
  // a rose + violet panel to either side (stained glass), more at higher stage
  panel(c, cx - R * 0.6, by - R * 0.8, R * 0.4, R * 0.6, ROSE, 0.18);
  panel(c, cx + R * 0.6, by - R * 0.8, R * 0.4, R * 0.6, VIOLET, 0.18);
  // the flame tongue rising from the core (brightest)
  for (let i = 0; i < R * 1.4; i++) put(c, cx + Math.sin(i / 4) * (1 + s), by - R * 1.3 - i, shade('#ffd27a', -i / (R * 3)));
  // leading: a vertical came + two radials
  lead(c, [[cx, by - R * 2.4, cx, by], [cx, by - R, cx - R, by - R * 0.4], [cx, by - R, cx + R, by - R * 0.4]]);
  if (s >= 2) lead(c, [[cx - R, by - R * 1.3, cx + R, by - R * 1.3]]); // a horizontal band
  core(c, cx, by - R * 0.9, 3 + s);
  // a faint glass-bell arc over the base form; a crown of light on evolved forms
  if (s === 1) for (let a = -1.1; a <= 1.1; a += 0.12) put(c, cx + Math.sin(a) * (R + 2), by - R - Math.cos(a) * (R + 2) + 4, '#3a2a4a');
  if (s >= 2) for (const dx of [-6, -2, 2, 6]) for (let i = 0; i < 4 + s; i++) put(c, cx + dx * (s - 1), by - R * 2.3 - i, shade('#ffd27a', -i * 0.1));
  heldEyes(c, cx, 4 + s, by - R * 1.1, 1.4 + s * 0.3);
  if (s === 1) nervousMouth(c, cx, by - R * 0.7); else uncannyMouth(c, cx, by - R * 0.6);
  return finish(c, cx, by - R, R + 4 + s * 3);
}

// === Line 2 — Ash (assassin / dark): Ashmoth → Cindershroud ================
// Ash given wings; a soul that came apart and was pinned back together.
export function ashmoth(stage = 1) {
  const s = stage; const c = canvas(60 + s * 10, 56 + s * 8);
  const cx = (c.w / 2) | 0, cy = (c.h / 2) | 0;
  // four ashen-glass wings (upper pair larger), backlit dim with an ember vein
  const wing = (wx, wy, rx, ry, tone) => {
    panel(c, wx, wy, rx, ry, tone, 0.2);
    for (let i = 0; i < rx; i++) put(c, wx + (wx < cx ? -i : i) * 0.7, wy + Math.sin(i / 3) * 1.5, shade('#ff7a3a', -i / (rx * 2))); // ember vein
  };
  const W = 10 + s * 3;
  wing(cx - W, cy - 6, W, W * 0.8, ASHV); wing(cx + W, cy - 6, W, W * 0.8, ASHV);
  wing(cx - W * 0.8, cy + 6, W * 0.7, W * 0.6, ROSE); wing(cx + W * 0.8, cy + 6, W * 0.7, W * 0.6, ROSE);
  lead(c, [[cx - W, cy - 6, cx - W * 1.7, cy - 12], [cx + W, cy - 6, cx + W * 1.7, cy - 12]]); // wing ribs
  // slender ashen body
  panel(c, cx, cy, 5 + s, 12 + s * 2, AMBER, 0.16);
  for (let y = cy - 10; y < cy + 12; y += 3) put(c, cx, y, LEAD); // segmented body
  core(c, cx, cy - 2, 2 + s);
  // antennae/ash-plumes
  for (let i = 0; i < 6 + s * 2; i++) { put(c, cx - 3 - i * 0.5, cy - 12 - i, shade('#c8bfd0', -i * 0.08)); put(c, cx + 3 + i * 0.5, cy - 12 - i, shade('#c8bfd0', -i * 0.08)); }
  // clever (s1) → fierce (s2) face
  heldEyes(c, cx, 3 + s, cy - 6, 1.3 + s * 0.2, '#fff2cc', s >= 2 ? '#ff6a3a' : '#ffd27a');
  if (s >= 2) fierceMouth(c, cx, cy - 1, 2); else put(c, cx, cy - 2, '#0a0602');
  return finish(c, cx, cy - 2, W + 6 + s * 2, '#ffb27a');
}

// === Line 3 — Reliquary Guardian (hero / fire): Wardling → Reliquary → Lanternlord
// A body of leaded-glass plates around a blazing core; the keeper's last guard.
export function wardling(stage = 1) {
  const s = stage; const c = canvas(58 + s * 10, 70 + s * 12);
  const cx = (c.w / 2) | 0, by = c.h - 8;
  const R = 13 + s * 3;
  flat(c, cx, by, R, 3.5, '#0b0a0e');
  // stout torso (amber) + shoulder plates (violet/teal) + short legs
  panel(c, cx, by - R, R, R * 1.15, AMBER, 0.13);
  panel(c, cx - R * 0.9, by - R * 1.4, R * 0.42, R * 0.5, VIOLET, 0.18);
  panel(c, cx + R * 0.9, by - R * 1.4, R * 0.42, R * 0.5, TEAL, 0.18);
  panel(c, cx - R * 0.5, by - 2, R * 0.3, R * 0.35, AMBER, 0.16);
  panel(c, cx + R * 0.5, by - 2, R * 0.3, R * 0.35, AMBER, 0.16);
  // helm/head panel
  panel(c, cx, by - R * 2, R * 0.7, R * 0.75, AMBER, 0.13);
  // leaded plate seams (a grid of cames over the torso)
  const seams = [];
  for (const yy of [by - R * 1.5, by - R, by - R * 0.5]) seams.push([cx - R, yy, cx + R, yy]);
  for (const xx of [cx - R * 0.5, cx, cx + R * 0.5]) seams.push([xx, by - R * 1.7, xx, by]);
  lead(c, seams);
  // the blazing heart-core in the chest (the reliquary's held soul)
  flat(c, cx, by - R, 4 + s, 5 + s, '#2a1405');
  panel(c, cx, by - R, 3 + s, 4 + s, ['#6b3410', '#ffb24a', '#fff2cc'], 0.4);
  core(c, cx, by - R, 2 + s);
  // crown of flame-spikes, taller each stage (boss silhouette at s3)
  for (const dx of [-8, -4, 0, 4, 8]) for (let i = 0; i < 4 + s * 2 + (dx === 0 ? 2 : 0); i++) put(c, cx + dx * (0.6 + s * 0.2), by - R * 2.6 - i, shade('#ffd27a', -i * 0.08));
  heldEyes(c, cx, 4, by - R * 2, 1.6 + s * 0.2, '#fff2cc', '#ffcf5a');
  fierceMouth(c, cx, by - R * 1.7, 2 + s);
  return finish(c, cx, by - R, R + 6 + s * 4);
}

// === Line 4 — Grief-light (mage / dark): Grievewisp → Mournlight ===========
// A weeping mote of held light; violet grief around a small gold heart.
export function grievewisp(stage = 1) {
  const s = stage; const c = canvas(46 + s * 10, 58 + s * 10);
  const cx = (c.w / 2) | 0, cy = 22 + s * 3;
  const R = 11 + s * 3;
  // a round violet grief-halo backlit around a warm core
  panel(c, cx, cy, R, R, VIOLET, 0.16);
  panel(c, cx, cy, R * 0.5, R * 0.5, AMBER, 0.35); // the gold heart glows through
  // leaded radial spokes (a rose window)
  const spokes = [];
  for (let a = 0; a < 6 + s; a++) { const t = a / (6 + s) * Math.PI * 2; spokes.push([cx, cy, cx + Math.cos(t) * R, cy + Math.sin(t) * R]); }
  lead(c, spokes);
  core(c, cx, cy, 2 + s);
  // falling tear-motes of light (held, drifting down but never landing)
  for (const [tx, ty] of [[cx - 3, cy + R + 2], [cx + 4, cy + R + 6], [cx - 1, cy + R + 11], [cx + 2, cy + R + 15 + s * 2]]) { flat(c, tx, ty, 1.3, 1.8, '#a882ff'); put(c, tx, ty, '#ecdfff'); }
  // little trailing wisps for arms
  if (s >= 2) { for (const dir of [-1, 1]) for (let i = 0; i < 8; i++) put(c, cx + dir * (R + i * 0.4), cy + i, shade('#ac82ff', -i * 0.08)); }
  // nervous face
  heldEyes(c, cx, 3 + s, cy - 1, 1.5 + s * 0.3, '#fff2cc', '#ffd27a');
  nervousMouth(c, cx, cy + 4);
  return finish(c, cx, cy, R + 5 + s * 3, '#b98cff');
}

// === Line 5 — The Kept (hero / dark): Keptsoul → Heldshade =================
// A soul frozen mid-cross — one arm still reaching for the door it never took.
export function keptsoul(stage = 1) {
  const s = stage; const c = canvas(52 + s * 10, 70 + s * 12);
  const cx = (c.w / 2) | 0, cy = 26 + s * 4;
  const R = 11 + s * 3;
  // a shrouded ashen figure, cowl + robe, backlit faint with a caged core
  panel(c, cx, cy + R * 1.6, R * 1.2, R * 1.7, ASHV, 0.16); // robe
  panel(c, cx, cy, R * 0.85, R * 0.9, ASHV, 0.14); // cowl
  flat(c, cx, cy + 1, R * 0.55, R * 0.6, '#08060c'); // hood dark
  // a reaching arm (asymmetric — the held gesture), frozen
  for (let i = 0; i < R + s * 3; i++) put(c, cx + R * 0.7 + i * 0.7, cy + R * 0.9 - i * 0.5, ASHV[2]);
  for (const f of [-1, 0, 1]) put(c, cx + R * 0.7 + (R + s * 3) * 0.7 + f, cy + R * 0.9 - (R + s * 3) * 0.5, '#c8bfd0'); // pale grasping hand
  // the caged soul-core low in the chest, barred by leading
  flat(c, cx, cy + R * 1.4, 3 + s, 4 + s, '#1a0e04');
  panel(c, cx, cy + R * 1.4, 2.4 + s, 3 + s, ['#6b3410', '#ffb24a', '#fff2cc'], 0.4);
  lead(c, [[cx - 4, cy + R * 1.1, cx - 4, cy + R * 1.8], [cx, cy + R * 1.05, cx, cy + R * 1.85], [cx + 4, cy + R * 1.1, cx + 4, cy + R * 1.8]]); // bars
  core(c, cx, cy + R * 1.4, 1.6 + s * 0.5);
  // robe folds
  for (const fx of [cx - 6, cx, cx + 6]) for (let y = cy + R; y < cy + R * 2.6; y += 2) put(c, fx + Math.sin(y / 5) * 1.2, y, shade(ASHV[1], -0.1));
  // UNCANNY: hollow eyes set too far apart + a third mark, detached mouth
  heldEyes(c, cx, 4 + s, cy, 1.5 + s * 0.2, '#fff2cc', s >= 2 ? '#ff9a4a' : '#ffd27a');
  if (s >= 2) put(c, cx, cy - 4, '#ffd27a'); // a third light on the brow
  uncannyMouth(c, cx, cy + 5);
  return finish(c, cx, cy + R, R + 5 + s * 3, '#caa0d0');
}

// registry: art key → builder (stage-parametric via closures below)
const S = (fn, stage) => () => fn(stage);
export const LANTERN = {
  llEmberkeep: { species: 'Emberkeep', element: 'fire', personality: 'nervous', build: S(emberkeep, 1) },
  llLanternwake: { species: 'Lanternwake', element: 'fire', personality: 'nervous', build: S(emberkeep, 2) },
  llEverember: { species: 'Everember', element: 'fire', personality: 'uncanny', build: S(emberkeep, 3) },
  llAshmoth: { species: 'Ashmoth', element: 'dark', personality: 'clever', build: S(ashmoth, 1) },
  llCindershroud: { species: 'Cindershroud', element: 'dark', personality: 'fierce', build: S(ashmoth, 2) },
  llWardling: { species: 'Wardling', element: 'fire', personality: 'fierce', build: S(wardling, 1) },
  llReliquary: { species: 'Reliquary', element: 'fire', personality: 'fierce', build: S(wardling, 2) },
  llLanternlord: { species: 'Lanternlord', element: 'fire', personality: 'fierce', build: S(wardling, 3) },
  llGrievewisp: { species: 'Grievewisp', element: 'dark', personality: 'nervous', build: S(grievewisp, 1) },
  llMournlight: { species: 'Mournlight', element: 'dark', personality: 'nervous', build: S(grievewisp, 2) },
  llKeptsoul: { species: 'Keptsoul', element: 'dark', personality: 'uncanny', build: S(keptsoul, 1) },
  llHeldshade: { species: 'Heldshade', element: 'dark', personality: 'uncanny', build: S(keptsoul, 2) },
};

// Evolution lines: base species id → [ [artKey, Name, evolveLevel], ... ] in
// stage order. Levels follow the current debug schedule (2 / 3).
export const LANTERN_LINES = {
  emberkeep: [['llLanternwake', 'Lanternwake', 2], ['llEverember', 'Everember', 3]],
  ashmoth: [['llCindershroud', 'Cindershroud', 2]],
  wardling: [['llReliquary', 'Reliquary', 2], ['llLanternlord', 'Lanternlord', 3]],
  grievewisp: [['llMournlight', 'Mournlight', 2]],
  keptsoul: [['llHeldshade', 'Heldshade', 2]],
};

// Species data for the 5 lines, consumed by integrate-lantern.mjs. Base stats
// are authored; evolved-stage stats are the base scaled by FAC[stage]. `growth`
// names a role constant already in creatures.ts. Every line is class-pure. Evo
// gate levels follow the current debug schedule (base→2 at Lv2, →3 at Lv3).
export const LANTERN_FAC = [0, 1, 1.35, 1.72]; // indexed by stage (1..3)
export const LANTERN_SPECIES = [
  {
    attribute: 'mage', element: 'fire', growth: 'MAGE_GROWTH',
    base: { hp: 46, mp: 28, off: 11, def: 12, spd: 14, mag: 21, res: 14 },
    learnset: [[1, 'cinderBurst'], [4, 'emberWave'], [8, 'dirge'], [12, 'pyreLance'], [16, 'abyssalBolt'], [20, 'infernoCore']],
    stages: [
      { id: 'emberkeep', name: 'Emberkeep', art: 'llEmberkeep', height: 1.35, hover: 0.15, blurb: 'A small flame a keeper sealed in glass and could not bear to let go out. It has forgotten it was ever meant to.' },
      { id: 'lanternwake', name: 'Lanternwake', art: 'llLanternwake', height: 1.6, hover: 0.15, blurb: 'The held flame, waking. It knows now that it is kept, and burns brighter in protest.' },
      { id: 'everember', name: 'Everember', art: 'llEverember', height: 1.95, hover: 0.25, blurb: 'A flame that will never cross and never die — eternal, and therefore a little wrong.' },
    ],
  },
  {
    attribute: 'assassin', element: 'dark', growth: 'ASSASSIN_GROWTH',
    base: { hp: 44, mp: 22, off: 18, def: 11, spd: 19, mag: 12, res: 10 },
    learnset: [[1, 'nightSpiral'], [4, 'gloomLance'], [8, 'shadowRend'], [12, 'hexBolt'], [16, 'abyssalBolt'], [20, 'voidNova']],
    stages: [
      { id: 'ashmoth', name: 'Ashmoth', art: 'llAshmoth', height: 1.3, hover: 0.25, blurb: 'A soul that came apart into ash, and was pinned back together on glass wings before it could scatter.' },
      { id: 'cindershroud', name: 'Cindershroud', art: 'llCindershroud', height: 1.7, hover: 0.3, blurb: 'The ash gathered into a reaper of cinders. What it sweeps up, it keeps.' },
    ],
  },
  {
    attribute: 'hero', element: 'fire', growth: 'HERO_GROWTH',
    base: { hp: 56, mp: 20, off: 16, def: 19, spd: 10, mag: 12, res: 17 },
    learnset: [[1, 'emberFang'], [4, 'cinderBurst'], [8, 'emberRend'], [12, 'quakeCore'], [16, 'pyreLance'], [20, 'infernoCore']],
    stages: [
      { id: 'wardling', name: 'Wardling', art: 'llWardling', height: 1.5, blurb: 'A small guard of leaded glass built around a single held soul. It will not step aside.' },
      { id: 'reliquary', name: 'Reliquary', art: 'llReliquary', height: 1.95, blurb: 'A walking reliquary — every pane a soul the keepers refused to release, all of them burning at once.' },
      { id: 'lanternlord', name: 'Lanternlord', art: 'llLanternlord', height: 2.4, blurb: 'The last keeper, become the thing it kept: a lord of held light, crowned in flame that never falls.' },
    ],
  },
  {
    attribute: 'mage', element: 'dark', growth: 'MAGE_GROWTH',
    base: { hp: 42, mp: 30, off: 9, def: 11, spd: 15, mag: 22, res: 15 },
    learnset: [[1, 'gloomLance'], [4, 'hexBolt'], [8, 'dirge'], [12, 'nightSpiral'], [16, 'abyssalBolt'], [20, 'voidNova']],
    stages: [
      { id: 'grievewisp', name: 'Grievewisp', art: 'llGrievewisp', height: 1.2, hover: 0.4, blurb: 'A mote of grief-light held around a small gold heart. It weeps motes that fall and never land.' },
      { id: 'mournlight', name: 'Mournlight', art: 'llMournlight', height: 1.55, hover: 0.4, blurb: 'A whole mourning made luminous — a rose window of sorrow that will not let its light go dim.' },
    ],
  },
  {
    attribute: 'hero', element: 'dark', growth: 'HERO_GROWTH',
    base: { hp: 52, mp: 22, off: 15, def: 18, spd: 11, mag: 14, res: 18 },
    learnset: [[1, 'gloomLance'], [4, 'shadowRend'], [8, 'dirge'], [12, 'hexBolt'], [16, 'abyssalBolt'], [20, 'voidNova']],
    stages: [
      { id: 'keptsoul', name: 'Keptsoul', art: 'llKeptsoul', height: 1.6, hover: 0.25, blurb: 'A soul frozen the instant before it crossed, one hand still reaching for a door it never took.' },
      { id: 'heldshade', name: 'Heldshade', art: 'llHeldshade', height: 2.0, hover: 0.25, blurb: 'Kept so long it became its own cage. The reaching never stops; the door never opens.' },
    ],
  },
];
