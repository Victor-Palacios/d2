// Insert the evolved-form sprites (EVO registry) into CREATURES in art.ts.
// These are NEW art keys, so we insert before the object's closing brace
// (integrate.mjs only replaces existing keys).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { EVO } from './evolutions.mjs';

const ART = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'assets', 'art.ts');
let src = readFileSync(ART, 'utf8');

function entry(key, art) {
  const pal = Object.entries(art.palette).filter(([, v]) => v).map(([k, v]) => `${k}: '${v}'`).join(', ');
  const rows = art.rows.map((r) => `      '${r}',`).join('\n');
  return `  ${key}: {\n    palette: { ${pal} },\n    rows: [\n${rows}\n    ],\n  },\n`;
}

// locate CREATURES closing brace
const cs = src.indexOf('export const CREATURES');
let i = src.indexOf('{', cs), depth = 0, end = -1;
for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}') { depth--; if (depth === 0) { end = i; break; } } }

let added = [], skipped = [];
let block = '';
for (const [key, build] of Object.entries(EVO)) {
  if (new RegExp(`\\n  ${key}:\\s*\\{`).test(src)) { skipped.push(key); continue; }
  block += entry(key, build());
  added.push(key);
}
src = src.slice(0, end) + block + src.slice(end);
writeFileSync(ART, src);
console.log('inserted:', added.join(', ') || '(none)');
if (skipped.length) console.log('already present (skipped):', skipped.join(', '));
