// Render every procedural creature to a preview PNG + emit its { palette, rows }
// so it can be pasted into src/assets/art.ts. Nothing here is committed — out/
// is git-ignored (previews) and the .art.txt is a copy-paste aid.
//
//   node tools/sprites/build.mjs            # all creatures
//   node tools/sprites/build.mjs tideling   # just one
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { save } from './render.mjs';
import { CREATURES } from './creatures.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, 'out');
mkdirSync(OUT, { recursive: true });

const want = process.argv.slice(2);
const ids = want.length ? want : Object.keys(CREATURES);

// Serialise a { palette, rows } as pasteable source for src/assets/art.ts.
function artSource(id, art) {
  const pal = Object.entries(art.palette)
    .filter(([, v]) => v).map(([k, v]) => `'${k}': '${v}'`).join(', ');
  const rows = art.rows.map((r) => `    '${r}',`).join('\n');
  return `  ${id}: {\n    palette: { ${pal} },\n    rows: [\n${rows}\n    ],\n  },\n`;
}

for (const id of ids) {
  const def = CREATURES[id];
  if (!def) { console.error(`unknown creature: ${id}`); continue; }
  const art = def.build();
  save(join(OUT, `${id}.png`), art, { scale: 8 });
  writeFileSync(join(OUT, `${id}.art.txt`), artSource(id, art));
  console.log(`${id.padEnd(12)} ${art.rows[0].length}x${art.rows.length}  ${Object.keys(art.palette).filter((k) => k !== '.').length} colors  (${def.element})`);
}
console.log(`\npreviews + .art.txt in ${OUT}`);
