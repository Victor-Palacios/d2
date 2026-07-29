// Replace the whole legacy human generator (HUMAN_ROWS/HAIR_*/HumanColors/
// human()/HUMANS) in src/assets/art.ts with static, generated HUMANS entries.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { HUMANS } from './humans.mjs';

const ART = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'assets', 'art.ts');

function entry(key, art) {
  const pal = Object.entries(art.palette).filter(([, v]) => v).map(([k, v]) => `${k}: '${v}'`).join(', ');
  const rows = art.rows.map((r) => `      '${r}',`).join('\n');
  return `  ${key}: {\n    palette: { ${pal} },\n    rows: [\n${rows}\n    ],\n  },`;
}

let src = readFileSync(ART, 'utf8');
const start = src.indexOf('const HUMAN_ROWS = [');
if (start < 0) throw new Error('HUMAN_ROWS not found (already migrated?)');
// find the end of the old `export const HUMANS = { ... };`
const hs = src.indexOf('export const HUMANS', start);
let depth = 0, brace = src.indexOf('{', hs), end = -1;
for (let j = brace; j < src.length; j++) { if (src[j] === '{') depth++; else if (src[j] === '}') { depth--; if (depth === 0) { end = j; break; } } }
while (src[end] !== ';') end++;

const block = 'export const HUMANS: Record<string, PixelArt> = {\n' +
  Object.entries(HUMANS).map(([k, d]) => entry(k, d.build())).join('\n') + '\n};';

src = src.slice(0, start) + block + src.slice(end + 1);
writeFileSync(ART, src);
console.log('integrated HUMANS:', Object.keys(HUMANS).join(', '));
