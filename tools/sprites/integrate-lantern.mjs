// Integrate The Last Lantern (reach 5) roster: insert the 12 art keys into
// src/assets/art.ts and generate the 12 Species (5 class-pure lines) into
// src/data/creatures.ts. Encounters in src/data/lastLantern.ts are wired by
// hand (they carry narrative structure).
//
//   node tools/sprites/integrate-lantern.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { LANTERN, LANTERN_SPECIES, LANTERN_LINES, LANTERN_FAC } from './last-lantern.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ART = join(here, '..', '..', 'src', 'assets', 'art.ts');
const CREATURES = join(here, '..', '..', 'src', 'data', 'creatures.ts');

// --- art.ts: insert new keys -----------------------------------------------
function artEntry(key, art) {
  const pal = Object.entries(art.palette).filter(([, v]) => v).map(([k, v]) => `'${k}': '${v}'`).join(', ');
  const rows = art.rows.map((r) => `      '${r}',`).join('\n');
  return `  ${key}: {\n    palette: { ${pal} },\n    rows: [\n${rows}\n    ],\n  },\n`;
}
function objClose(src, decl) {
  const cs = src.indexOf(decl);
  let i = src.indexOf('{', cs), depth = 0;
  for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}') { depth--; if (depth === 0) return i; } }
  throw new Error(`no closing brace for ${decl}`);
}

let art = readFileSync(ART, 'utf8');
let artBlock = '', artAdded = [];
for (const [key, def] of Object.entries(LANTERN)) {
  if (new RegExp(`\\n  ${key}:\\s*\\{`).test(art)) { console.log(`art already present: ${key}`); continue; }
  artBlock += artEntry(key, def.build());
  artAdded.push(key);
}
if (artBlock) { const end = objClose(art, 'export const CREATURES'); art = art.slice(0, end) + artBlock + art.slice(end); }
writeFileSync(ART, art);
console.log(`art.ts: inserted ${artAdded.length} keys (${artAdded.join(', ')})`);

// --- creatures.ts: generate the 12 species ---------------------------------
const rnd = (n) => Math.round(n);
function statsAt(base, stage) {
  const f = LANTERN_FAC[stage];
  const out = {};
  for (const k of ['hp', 'mp', 'off', 'def', 'spd', 'mag', 'res']) out[k] = stage === 1 ? base[k] : rnd(base[k] * f);
  return out;
}
function speciesBlock(line, si) {
  const st = line.stages[si];
  const stage = si + 1;
  const s = statsAt(line.base, stage);
  const base = `base: { hp: ${s.hp}, mp: ${s.mp}, off: ${s.off}, def: ${s.def}, spd: ${s.spd}, mag: ${s.mag}, res: ${s.res} }`;
  const learn = line.learnset.map(([lvl, t]) => `      { level: ${lvl}, tech: '${t}' },`).join('\n');
  // evolution → next stage, at the debug-schedule level from LANTERN_LINES.
  const lineArr = LANTERN_LINES[line.stages[0].id];
  let evo = '';
  if (si < line.stages.length - 1) {
    const [, , lvl] = lineArr[si]; // [artKey, Name, level] of the NEXT stage
    evo = `    evolutions: [{ to: '${line.stages[si + 1].id}', level: ${lvl} }],\n`;
  }
  const hover = st.hover != null ? `    hover: ${st.hover},\n` : '';
  return (
    `  ${st.id}: {\n` +
    `    id: '${st.id}',\n` +
    `    name: '${st.name}',\n` +
    `    attribute: '${line.attribute}',\n` +
    `    element: '${line.element}',\n` +
    `    art: '${st.art}',\n` +
    `    height: ${st.height},\n` +
    hover +
    `    ${base},\n` +
    `    growth: ${line.growth},\n` +
    `    learnset: [\n${learn}\n    ],\n` +
    evo +
    `    blurb: '${st.blurb}',\n` +
    `  },\n`
  );
}

let cre = readFileSync(CREATURES, 'utf8');
let creBlock = '', creAdded = [];
for (const line of LANTERN_SPECIES) {
  for (let si = 0; si < line.stages.length; si++) {
    const id = line.stages[si].id;
    if (new RegExp(`\\n  ${id}:\\s*\\{`).test(cre)) { console.log(`species already present: ${id}`); continue; }
    creBlock += speciesBlock(line, si);
    creAdded.push(id);
  }
}
if (creBlock) {
  // Insert before the SPECIES object's closing brace.
  const end = objClose(cre, 'export const SPECIES');
  // back up over the newline before `}` so the block lands tidily
  cre = cre.slice(0, end) + `\n  // === The Last Lantern — held souls (reach 5) ============================\n` + creBlock + cre.slice(end);
}
writeFileSync(CREATURES, cre);
console.log(`creatures.ts: inserted ${creAdded.length} species (${creAdded.join(', ')})`);
