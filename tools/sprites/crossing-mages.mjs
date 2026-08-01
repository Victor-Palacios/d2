// The Quiet Crossing (reach 1) is now the MAGE dungeon — flat house style
// (compose.mjs), keyed by art key for integrate-new.mjs. Three arcane echoes:
// two casters and a warden boss. Same recipe as quiet-crossing.mjs.
import { grid, ellipse, rect, set, smooth, outlineSil, toArt } from './compose.mjs';
import { glossyEyes, shadeInto, contactShadow } from './creatures.mjs';
import { applyFace } from './personality.mjs';

function faced(g, P, personality, cfg) {
  smooth(g);
  applyFace(personality, g, cfg);
  outlineSil(g, 'k');
  return toArt(g, P);
}
const blk = (g, x, y, k) => { set(g, x, y, k); set(g, x + 1, y, k); set(g, x, y + 1, k); set(g, x + 1, y + 1, k); };

// --- mistling — Mistling (water / mage, Friendly) --------------------------
// A gentle mist-spirit; a soft blue orb trailing curls of fog.
export function mistling() {
  const P = { '.': '', S: '#0a1420', k: '#12263a', u: '#2f5f8a', v: '#5aa0d0', V: '#9fd6f0', g: '#dcf4ff', w: '#ffffff', p: '#12263a', s: '#ffffff', c: '#ff9ab0' };
  const g = grid(52, 58); const cx = 26;
  contactShadow(g, cx, 53, 12);
  ellipse(g, cx, 26, 15, 14, 'v'); // soft orb head
  for (let y = 34; y <= 45; y++) { const w = Math.max(2, 12 - (y - 34) * 0.85); ellipse(g, cx, y, w, 1.7, 'v', { mirror: false }); } // wispy tail
  blk(g, cx - 14, 20, 'v'); blk(g, cx + 13, 18, 'v'); blk(g, cx - 16, 28, 'v'); blk(g, cx + 15, 30, 'v'); // fog curls
  shadeInto(g, cx - 4, 20, 11, 10, 'V', ['v']); shadeInto(g, cx - 5, 16, 6, 5, 'g', ['v', 'V']);
  shadeInto(g, cx, 35, 12, 8, 'u', ['v']);
  ellipse(g, cx, 27, 3, 3.5, 'g'); // glow core
  ellipse(g, cx - 14, 30, 2.4, 3, 'v'); ellipse(g, cx + 14, 32, 2.4, 3, 'v'); // arm nubs
  return faced(g, P, 'friendly', { cx, eyeY: 25, dx: 6, rx: 4, ry: 4.6, mouthY: 32, pal: { white: 'w', mouth: 'u' } });
}

// --- cindermage — Cindermage (fire / mage, Clever) -------------------------
// A small hooded caster cupping a flame; half-lidded, sly.
export function cindermage() {
  const P = { '.': '', S: '#160a06', k: '#241226', u: '#4a2450', v: '#8a3a16', o: '#e86a24', y: '#ffb24a', f: '#ffe08a', H: '#5a2f74', G: '#3a1e50', w: '#fff2e0', p: '#20101a', s: '#ffffff', c: '#ff9ab0' };
  const g = grid(50, 60); const cx = 25;
  contactShadow(g, cx, 55, 12);
  // robe body (violet), floating with a pointed hem
  ellipse(g, cx, 42, 13, 15, 'H'); shadeInto(g, cx, 48, 13, 9, 'G', ['H']);
  for (const hx of [cx - 8, cx, cx + 8]) for (let i = 0; i < 4; i++) set(g, hx, 54 + i, i < 2 ? 'H' : 'G');
  // sleeves
  ellipse(g, cx - 13, 40, 3, 6, 'H'); ellipse(g, cx + 13, 40, 3, 6, 'H');
  // hood
  ellipse(g, cx, 24, 12, 12, 'H'); shadeInto(g, cx - 4, 20, 8, 7, 'u', ['H']);
  ellipse(g, cx, 26, 7.5, 8, 'k'); // hood shadow (the face lives here)
  // a small flame cupped at the chest
  ellipse(g, cx, 42, 4, 5, 'o'); ellipse(g, cx, 43, 2.4, 3, 'y'); set(g, cx, 39, 'f');
  // ember crown flickers on the hood crest
  for (let i = 0; i < 5; i++) set(g, cx - 4 + i * 2, 12 - Math.abs(i - 2), i % 2 ? 'o' : 'y');
  return faced(g, P, 'clever', { cx, eyeY: 25, dx: 4, rx: 2.6, ry: 2.8, mouthY: null, pal: { white: 'y', mouth: 'o' } });
}

// --- sigilwarden — Sigilwarden (dark / mage BOSS, Uncanny) -----------------
// The Vigil of the Warden Hall: a floating arcane sentinel, one great sigil-eye
// ringed by broken runes.
export function sigilwarden() {
  const P = { '.': '', S: '#080614', k: '#160f2a', u: '#2a1c54', v: '#4a2e8a', V: '#7a52c8', g: '#b89aff', m: '#e6d6ff', y: '#ffd24a', w: '#ffffff', p: '#120a24', s: '#ffffff', r: '#ff5a8a' };
  const g = grid(78, 84); const cx = 39;
  contactShadow(g, cx, 79, 22);
  // outer ring of rune-shards (a broken halo)
  for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; blk(g, Math.round(cx + Math.cos(a) * 31), Math.round(42 + Math.sin(a) * 31), i % 3 ? 'V' : 'u'); }
  // central floating body
  ellipse(g, cx, 44, 20, 23, 'v'); shadeInto(g, cx - 6, 34, 15, 15, 'V', ['v']); shadeInto(g, cx, 54, 20, 13, 'u', ['v']);
  // shard arms
  ellipse(g, cx - 24, 46, 4.5, 9, 'v'); ellipse(g, cx + 24, 46, 4.5, 9, 'v');
  ellipse(g, cx - 26, 54, 2.6, 3.4, 'V'); ellipse(g, cx + 26, 54, 2.6, 3.4, 'V');
  // crown of shards
  for (const dx of [-11, -5, 1, 7, 12]) for (let i = 0; i < 8; i++) set(g, cx + dx, 20 - i, i > 4 ? 'V' : 'v');
  // the great SIGIL eye
  ellipse(g, cx, 42, 9, 10, 'k'); ellipse(g, cx, 42, 6.5, 7.5, 'g'); ellipse(g, cx, 43, 2.6, 5, 'p'); // vertical slit
  set(g, cx - 1, 39, 'w'); set(g, cx - 2, 40, 'w');
  // a ring of glyph-marks around the eye
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; set(g, Math.round(cx + Math.cos(a) * 12), Math.round(42 + Math.sin(a) * 13), 'm'); }
  // two lesser eyes (uncanny) low and uneven
  ellipse(g, cx - 13, 58, 2.4, 2.6, 'g'); set(g, cx - 13, 58, 'p');
  ellipse(g, cx + 14, 60, 2, 2.2, 'g'); set(g, cx + 14, 60, 'p');
  smooth(g); outlineSil(g, 'k');
  return toArt(g, P);
}

export const CROSSING_MAGES = {
  qcMistling: { species: 'Mistling', element: 'water', personality: 'friendly', build: mistling },
  qcCindermage: { species: 'Cindermage', element: 'fire', personality: 'clever', build: cindermage },
  qcSigilwarden: { species: 'Sigilwarden', element: 'dark', personality: 'uncanny', build: sigilwarden },
};
