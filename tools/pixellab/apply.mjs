#!/usr/bin/env node
// Integrate every generated sprite in out/*.art.txt into src/assets/art.ts:
// replace the CREATURES entry if the id already exists, otherwise insert a new
// one before the object's close. Then prune any applied ids from the REGEN
// queue (regen.txt). Run after generate + convert.
//
//   node tools/pixellab/apply.mjs

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";

const ART = "src/assets/art.ts";
const REGEN = "tools/pixellab/regen.txt";
if (!existsSync("out")) { console.log("no out/ — nothing to apply"); process.exit(0); }

const ids = readdirSync("out").filter((f) => f.endsWith(".art.txt")).map((f) => f.slice(0, -".art.txt".length));
if (!ids.length) { console.log("no .art.txt in out/"); process.exit(0); }

let lines = readFileSync(ART, "utf8").split("\n");
const applied = [];
for (const id of ids) {
  const block = readFileSync(`out/${id}.art.txt`, "utf8").replace(/\n+$/, "").split("\n");
  const start = lines.findIndex((l) => l === `  ${id}: {`);
  if (start >= 0) {
    let end = -1;
    for (let i = start + 1; i < lines.length; i++) { if (lines[i] === "  },") { end = i; break; } }
    if (end < 0) { console.error(`✗ ${id}: no close brace`); continue; }
    lines.splice(start, end - start + 1, ...block);
    console.log(`✓ replaced ${id}`);
  } else {
    // insert before the CREATURES object's closing "};" (the one before PROPS)
    const props = lines.findIndex((l) => l.includes("export const PROPS"));
    let ci = props >= 0 ? props : lines.length - 1;
    while (ci > 0 && lines[ci] !== "};") ci--;
    lines.splice(ci, 0, ...block);
    console.log(`+ inserted ${id}`);
  }
  applied.push(id);
}
writeFileSync(ART, lines.join("\n"));

// Prune applied ids from the regen queue.
if (existsSync(REGEN)) {
  const kept = readFileSync(REGEN, "utf8").split("\n").filter((l) => {
    const t = l.trim();
    return !(t && !t.startsWith("#") && applied.includes(t));
  });
  writeFileSync(REGEN, kept.join("\n"));
}
console.log(`Applied ${applied.length}: ${applied.join(", ")}`);
