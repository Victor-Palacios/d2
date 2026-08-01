// Recolor a monster's art.ts palette toward an element's hue — used when a
// species is re-elemented for balance, so the sprite matches its new element.
// Hue-shifts every saturated palette colour to the target hue while preserving
// lightness (the shading) and leaving near-white / near-black / grey pixels
// (outlines, glints, steel) alone. Machine also desaturates toward steel.
//
//   node tools/sprites/recolor.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ART = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'assets', 'art.ts');

// artKey → target element.
const RECOLOR = {
  ccGeomote: 'machine', ccPrismguard: 'machine', ccVaultwarden: 'machine',
  qcSigilwarden: 'machine', hdNullmancer: 'machine', hdHexshade: 'machine',
  ogSporefang: 'fire', ogVineraptor: 'fire', hdGravecant: 'fire', llVowkeeper: 'fire',
  ogBloomstalker: 'water',
};
const EL = { fire: { h: 22 }, water: { h: 202 }, nature: { h: 116 }, machine: { h: 208, sat: 0.34 }, dark: { h: 272 } };

function rgb2hsl(r, g, b) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0, l = (mx + mn) / 2; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; } return [h * 360, s, l]; }
function hsl2rgb(h, s, l) { h /= 360; const f = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; }; let r, g, b; if (s === 0) { r = g = b = l; } else { const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; r = f(p, q, h + 1 / 3); g = f(p, q, h); b = f(p, q, h - 1 / 3); } return [r, g, b].map((v) => Math.round(v * 255)); }
function recolorHex(hex, el) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const n = parseInt(hex.slice(1), 16);
  let [h, s, l] = rgb2hsl((n >> 16) & 255, (n >> 8) & 255, n & 255);
  if (s < 0.1 || l < 0.06 || l > 0.95) return hex; // keep outlines / glints / greys
  const t = EL[el];
  h = t.h;
  s = t.sat !== undefined ? Math.min(s, t.sat) : Math.max(s, 0.42);
  const [r, g, b] = hsl2rgb(h, s, l);
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

let src = readFileSync(ART, 'utf8');
for (const [key, el] of Object.entries(RECOLOR)) {
  const i = src.indexOf(`\n  ${key}: {`);
  if (i < 0) { console.error(`not found: ${key}`); continue; }
  const pStart = src.indexOf('palette: {', i);
  const pEnd = src.indexOf('}', pStart);
  const before = src.slice(pStart, pEnd);
  const after = before.replace(/'#[0-9a-fA-F]{6}'/g, (m) => `'${recolorHex(m.slice(1, -1), el)}'`);
  src = src.slice(0, pStart) + after + src.slice(pEnd);
  console.log(`recolored ${key} → ${el}`);
}
writeFileSync(ART, src);
console.log('wrote art.ts');
