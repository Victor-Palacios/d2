// Integrate the type-themed roster expansion: insert the new art keys into
// src/assets/art.ts and generate the new Species into src/data/creatures.ts
// from tools/sprites/new-monsters.mjs. Encounters are wired by hand per reach.
//
//   node tools/sprites/integrate-new.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { NEW_ART, NEW_MONSTERS } from './new-monsters.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ART = join(here, '..', '..', 'src', 'assets', 'art.ts');
const CREATURES = join(here, '..', '..', 'src', 'data', 'creatures.ts');

function objClose(src, decl) {
  const cs = src.indexOf(decl);
  let i = src.indexOf('{', cs), depth = 0;
  for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}') { depth--; if (depth === 0) return i; } }
  throw new Error(`no closing brace for ${decl}`);
}

// --- art.ts: insert new keys (quoted palette keys) -------------------------
function artEntry(key, art) {
  const pal = Object.entries(art.palette).filter(([, v]) => v).map(([k, v]) => `'${k}': '${v}'`).join(', ');
  const rows = art.rows.map((r) => `      '${r}',`).join('\n');
  return `  ${key}: {\n    palette: { ${pal} },\n    rows: [\n${rows}\n    ],\n  },\n`;
}
let art = readFileSync(ART, 'utf8');
let artBlock = '', artAdded = [];
for (const [key, def] of Object.entries(NEW_ART)) {
  if (new RegExp(`\\n  ${key}:\\s*\\{`).test(art)) { console.log(`art present: ${key}`); continue; }
  artBlock += artEntry(key, def.build());
  artAdded.push(key);
}
if (artBlock) { const end = objClose(art, 'export const CREATURES'); art = art.slice(0, end) + artBlock + art.slice(end); }
writeFileSync(ART, art);
console.log(`art.ts: +${artAdded.length} (${artAdded.join(', ') || 'none'})`);

// --- creatures.ts: generate species ----------------------------------------
function speciesBlock(m) {
  const b = m.base;
  const base = `base: { hp: ${b.hp}, mp: ${b.mp}, off: ${b.off}, def: ${b.def}, spd: ${b.spd}, mag: ${b.mag}, res: ${b.res} }`;
  const learn = m.learnset.map(([lvl, t]) => `      { level: ${lvl}, tech: '${t}' },`).join('\n');
  const hover = m.hover != null ? `    hover: ${m.hover},\n` : '';
  return (
    `  ${m.id}: {\n` +
    `    id: '${m.id}',\n    name: '${m.name}',\n    attribute: '${m.attribute}',\n    element: '${m.element}',\n` +
    `    art: '${m.art}',\n    height: ${m.height},\n` + hover +
    `    ${base},\n    growth: ${m.growth},\n` +
    `    learnset: [\n${learn}\n    ],\n    blurb: '${m.blurb}',\n  },\n`
  );
}
let cre = readFileSync(CREATURES, 'utf8');
let creBlock = '', creAdded = [];
for (const m of NEW_MONSTERS) {
  if (new RegExp(`\\n  ${m.id}:\\s*\\{`).test(cre)) { console.log(`species present: ${m.id}`); continue; }
  creBlock += speciesBlock(m);
  creAdded.push(m.id);
}
if (creBlock) {
  const end = objClose(cre, 'export const SPECIES');
  cre = cre.slice(0, end) + '\n  // === Type-themed roster expansion (20 new monsters) ====================\n' + creBlock + cre.slice(end);
}
writeFileSync(CREATURES, cre);
console.log(`creatures.ts: +${creAdded.length} (${creAdded.join(', ') || 'none'})`);
