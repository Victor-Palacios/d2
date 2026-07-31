// Regenerate the HUMANS block in src/assets/art.ts from tools/sprites/humans.mjs.
// Replaces the whole `export const HUMANS: Record<string, PixelArt> = { ... };`
// object with freshly built static entries (the 16-bit JRPG cast).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { HUMANS } from './humans.mjs';

const ART = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'assets', 'art.ts');

function entry(key, art) {
  // Quote palette keys defensively (a dense sprite can reach non-identifier
  // keys); Biome's asNeeded quote style unquotes the plain ones on format.
  const pal = Object.entries(art.palette).filter(([, v]) => v).map(([k, v]) => `'${k}': '${v}'`).join(', ');
  const rows = art.rows.map((r) => `      '${r}',`).join('\n');
  return `  ${key}: {\n    palette: { ${pal} },\n    rows: [\n${rows}\n    ],\n  },`;
}

let src = readFileSync(ART, 'utf8');
const decl = 'export const HUMANS: Record<string, PixelArt> = {';
const start = src.indexOf(decl);
if (start < 0) throw new Error('HUMANS declaration not found in art.ts');
// find the object's closing brace, then the trailing `;`
let depth = 0, brace = src.indexOf('{', start), end = -1;
for (let j = brace; j < src.length; j++) { if (src[j] === '{') depth++; else if (src[j] === '}') { depth--; if (depth === 0) { end = j; break; } } }
let semi = end + 1; while (src[semi] !== ';') semi++;

const block = decl + '\n' + Object.entries(HUMANS).map(([k, d]) => entry(k, d.build())).join('\n') + '\n};';
src = src.slice(0, start) + block + src.slice(semi + 1);
writeFileSync(ART, src);
console.log('regenerated HUMANS:', Object.keys(HUMANS).join(', '));
