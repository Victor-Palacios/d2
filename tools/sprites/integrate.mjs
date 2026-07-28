// Replace CREATURES[<artKey>] blocks in src/assets/art.ts with freshly built
// procedural sprites. Leading comments above each entry are preserved.
//
//   node tools/sprites/integrate.mjs           # integrate the whole CROSSING set
//   node tools/sprites/integrate.mjs lion bat   # just these keys
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CROSSING } from './quiet-crossing.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ART = join(here, '..', '..', 'src', 'assets', 'art.ts');

function entrySource(key, art) {
  const pal = Object.entries(art.palette).filter(([, v]) => v).map(([k, v]) => `${k}: '${v}'`).join(', ');
  const rows = art.rows.map((r) => `      '${r}',`).join('\n');
  return `  ${key}: {\n    palette: { ${pal} },\n    rows: [\n${rows}\n    ],\n  },`;
}

function replaceEntry(src, key, block) {
  const marker = `\n  ${key}: {`;
  const i = src.indexOf(marker);
  if (i < 0) throw new Error(`entry not found in art.ts: ${key}`);
  let depth = 0, end = -1;
  for (let j = i + marker.length - 1; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (depth === 0) { end = j; break; } }
  }
  if (end < 0) throw new Error(`unterminated entry: ${key}`);
  let k = end + 1; if (src[k] === ',') k++;
  return src.slice(0, i) + '\n' + block + src.slice(k);
}

const want = process.argv.slice(2);
const keys = want.length ? want : Object.keys(CROSSING);
let src = readFileSync(ART, 'utf8');
for (const key of keys) {
  const def = CROSSING[key];
  if (!def) { console.error(`not in CROSSING: ${key}`); continue; }
  src = replaceEntry(src, key, entrySource(key, def.build()));
  console.log(`integrated ${key} (${def.species})`);
}
writeFileSync(ART, src);
console.log(`wrote ${ART}`);
