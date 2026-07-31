// Integrate the reach-3 (Overgrowth) and reach-4 (Haunted) rosters into
// src/assets/art.ts, and repoint the Overgrowth species onto their new art keys
// in src/data/creatures.ts.
//
//   node tools/sprites/integrate-reaches.mjs
//
// - Haunted keys already exist in CREATURES → replaced in place.
// - Overgrowth keys are NEW → inserted before the CREATURES closing brace, and
//   each jungle species' `art:` field is repointed off the shared Crossing key.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { OVERGROWTH, OVERGROWTH_REPOINT } from './overgrowth.mjs';
import { HAUNTED } from './haunted.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ART = join(here, '..', '..', 'src', 'assets', 'art.ts');
const CREATURES = join(here, '..', '..', 'src', 'data', 'creatures.ts');

function entrySource(key, art) {
  // Quote palette keys: toPixelArt may assign non-identifier chars (#, <, %, …)
  // once a sprite passes ~62 colours, and those are invalid as unquoted object
  // keys. Biome's asNeeded quote style unquotes the plain ones again on format.
  const pal = Object.entries(art.palette).filter(([, v]) => v).map(([k, v]) => `'${k}': '${v}'`).join(', ');
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

// locate the CREATURES object's closing brace, for inserting new keys.
function creaturesClose(src) {
  const cs = src.indexOf('export const CREATURES');
  let i = src.indexOf('{', cs), depth = 0;
  for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}') { depth--; if (depth === 0) return i; } }
  throw new Error('could not find CREATURES closing brace');
}

let art = readFileSync(ART, 'utf8');

// 1) Haunted — replace existing keys in place.
for (const [key, def] of Object.entries(HAUNTED)) {
  art = replaceEntry(art, key, entrySource(key, def.build()));
  console.log(`replaced ${key} (${def.species})`);
}

// 2) Overgrowth — insert new keys (skip any already present).
let block = '';
for (const [key, def] of Object.entries(OVERGROWTH)) {
  if (new RegExp(`\\n  ${key}:\\s*\\{`).test(art)) { console.log(`already present: ${key}`); continue; }
  block += entrySource(key, def.build()) + '\n';
  console.log(`inserted ${key} (${def.species})`);
}
if (block) { const end = creaturesClose(art); art = art.slice(0, end) + block + art.slice(end); }
writeFileSync(ART, art);
console.log(`wrote ${ART}`);

// 3) Repoint the Overgrowth species onto their new art keys.
let cre = readFileSync(CREATURES, 'utf8');
for (const [speciesId, artKey] of Object.entries(OVERGROWTH_REPOINT)) {
  const idIdx = cre.indexOf(`id: '${speciesId}'`);
  if (idIdx < 0) { console.error(`species not found: ${speciesId}`); continue; }
  // Repoint the first `art: '...'` after the id (that species' own art field).
  const before = cre.slice(0, idIdx);
  const after = cre.slice(idIdx).replace(/art: '[a-zA-Z]+'/, `art: '${artKey}'`);
  cre = before + after;
  console.log(`repointed ${speciesId} → ${artKey}`);
}
writeFileSync(CREATURES, cre);
console.log(`wrote ${CREATURES}`);
