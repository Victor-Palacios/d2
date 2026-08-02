// The Last Lantern (reach 5) is now the HERO dungeon — reliquary-glass style
// (paint.mjs), matching last-lantern.mjs. Three new lantern-keeper guardians
// join the existing Wardling / Reliquary / Keptsoul / Heldshade / Lanternlord.
// Held souls lit from within: stained-glass leaded panels, warm bloom, contained.
import { canvas, form, flat, put, smooth, outline, toPixelArt, shade } from './paint.mjs';

const GLOW = [0, 0, 1];
const AMBER = ['#1f0e03', '#6b3410', '#c46a18', '#ffb24a', '#fff2cc'];
const ROSE = ['#220814', '#6b1a3a', '#c43a6a', '#ff86a8', '#ffdbe6'];
const VIOLET = ['#140a24', '#3a1a6a', '#6a3ac0', '#ac82ff', '#ecdfff'];
const TEAL = ['#04201d', '#0e4a44', '#1c8a7a', '#5fd4ba', '#d6fff2'];
const ASHV = ['#120f18', '#2a2432', '#4a4256', '#877e94', '#d0c8dc'];
const LEAD = '#140a04';

function panel(c, cx, cy, rx, ry, ramp, ambient = 0.14) { form(c, cx, cy, rx, ry, ramp, { light: GLOW, steps: 9, ambient, dither: true }); }
function core(c, cx, cy, r, hot = '#fff2cc') { flat(c, cx, cy, r, r, shade('#ffb24a', 0.1)); flat(c, cx, cy, r * 0.55, r * 0.55, hot); put(c, cx, cy, '#ffffff'); }
function lead(c, segs) {
  const body = (x, y) => x >= 0 && y >= 0 && x < c.w && y < c.h && c[y][x] !== null;
  for (const [x0, y0, x1, y1] of segs) { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0)); for (let i = 0; i <= n; i++) { const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n); if (body(x, y)) c[y][x] = LEAD; } }
}
function bloom(c, cx, cy, r, hex, n = 22) {
  const bg = (x, y) => x < 0 || y < 0 || x >= c.w || y >= c.h || c[y][x] === null;
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + (i % 3) * 0.5, rr = r * (0.7 + ((i * 7) % 5) / 5 * 0.7); const x = Math.round(cx + Math.cos(a) * rr), y = Math.round(cy + Math.sin(a) * rr * 0.9); if (bg(x, y)) put(c, x, y, shade(hex, -((i % 4) * 0.14))); }
}
function heldEyes(c, cx, dx, y, r, iris = '#ffd27a') { for (const sx of [cx - dx, cx + dx]) { flat(c, sx, y, r + 0.7, r + 0.7, '#0a0602'); flat(c, sx, y, r, r, iris); put(c, sx, y, '#fff2cc'); } }
function fierceMouth(c, cx, y, w) { for (let i = -w; i <= w; i++) put(c, cx + i, y + (Math.abs(i) === w ? -1 : 0), '#0a0602'); for (const i of [-w + 1, 0, w - 1]) put(c, cx + i, y + 1, '#fff2cc'); }
function finish(c, cx, cy, haloR, halo = '#ffcf7a') { smooth(c); bloom(c, cx, cy, haloR, halo, Math.round(haloR * 1.4)); outline(c, '#160b03'); return toPixelArt(c); }

// A reliquary guardian: leaded-glass plates around a held core, with a crown.
// Parametric by shoulder-panel colour, core ramp, crown accent, personality.
function keeper(c, { plateL, plateR, coreRamp, coreHot, crown, eyeIris, big = 0 }) {
  const cx = (c.w / 2) | 0, by = c.h - 8; const R = 13 + big * 3;
  flat(c, cx, by, R, 3.5, '#0b0a0e');
  panel(c, cx, by - R, R, R * 1.15, AMBER, 0.13);                       // torso
  panel(c, cx - R * 0.9, by - R * 1.4, R * 0.42, R * 0.5, plateL, 0.18); // shoulder plates
  panel(c, cx + R * 0.9, by - R * 1.4, R * 0.42, R * 0.5, plateR, 0.18);
  panel(c, cx - R * 0.5, by - 2, R * 0.3, R * 0.35, AMBER, 0.16);        // feet
  panel(c, cx + R * 0.5, by - 2, R * 0.3, R * 0.35, AMBER, 0.16);
  panel(c, cx, by - R * 2, R * 0.7, R * 0.75, AMBER, 0.13);             // head
  const seams = [];
  for (const yy of [by - R * 1.5, by - R, by - R * 0.5]) seams.push([cx - R, yy, cx + R, yy]);
  for (const xx of [cx - R * 0.5, cx, cx + R * 0.5]) seams.push([xx, by - R * 1.7, xx, by]);
  lead(c, seams);
  flat(c, cx, by - R, 4 + big, 5 + big, '#2a1405');                    // held core
  panel(c, cx, by - R, 3 + big, 4 + big, coreRamp, 0.4);
  core(c, cx, by - R, 2 + big, coreHot);
  for (const dx of [-8, -4, 0, 4, 8]) for (let i = 0; i < 4 + big * 2 + (dx === 0 ? 2 : 0); i++) put(c, cx + dx * (0.6 + big * 0.2), by - R * 2.6 - i, shade(crown, -i * 0.08));
  heldEyes(c, cx, 4, by - R * 2, 1.6 + big * 0.2, eyeIris);
  fierceMouth(c, cx, by - R * 1.7, 2 + big);
  return finish(c, cx, by - R, R + 6 + big * 4);
}

// --- emberward — Emberward (fire / hero) -----------------------------------
export function emberward() { return keeper(canvas(58, 70), { plateL: ROSE, plateR: AMBER, coreRamp: ['#6b3410', '#ffb24a', '#fff2cc'], coreHot: '#fff2cc', crown: '#ffd27a', eyeIris: '#ffcf5a' }); }
// --- vowkeeper — Vowkeeper (dark / hero) -----------------------------------
export function vowkeeper() { return keeper(canvas(58, 70), { plateL: VIOLET, plateR: ASHV, coreRamp: ['#3a1a6a', '#ac82ff', '#ecdfff'], coreHot: '#ecdfff', crown: '#ac82ff', eyeIris: '#c8a0ff' }); }
// --- stillguard — Stillguard (water / hero) --------------------------------
export function stillguard() { return keeper(canvas(58, 70), { plateL: TEAL, plateR: TEAL, coreRamp: ['#0e4a44', '#5fd4ba', '#d6fff2'], coreHot: '#d6fff2', crown: '#5fd4ba', eyeIris: '#8fe6d0' }); }
// --- ashkeeper — Ashkeeper (nature / hero) — a somber grey-glass warden -----
export function ashkeeper() { return keeper(canvas(60, 72), { plateL: ASHV, plateR: ROSE, coreRamp: ['#2a2432', '#877e94', '#e6ffe6'], coreHot: '#e6ffe6', crown: '#a6d6a0', eyeIris: '#c8e6c0', big: 1 }); }

export const LANTERN_HEROES = {
  llEmberward: { species: 'Emberward', element: 'fire', personality: 'fierce', build: emberward },
  llVowkeeper: { species: 'Vowkeeper', element: 'dark', personality: 'fierce', build: vowkeeper },
  llStillguard: { species: 'Stillguard', element: 'water', personality: 'fierce', build: stillguard },
  llAshkeeper: { species: 'Ashkeeper', element: 'nature', personality: 'fierce', build: ashkeeper },
};
