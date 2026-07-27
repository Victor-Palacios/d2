#!/usr/bin/env node
// Print the registry monsters that still need art — i.e. ids that don't yet
// have a CREATURES entry in src/assets/art.ts. Skips stage-variant ids
// (containing "-", e.g. nightnip-shade) which are explored via the manual
// workflow, not the daily batch. Emits GitHub-Actions env lines:
//
//   MONSTER=id1,id2,...
//   PENDING_COUNT=N
//
//   node tools/pixellab/pending.mjs [max]   # default max 8

import { readFileSync } from "node:fs";
import { MONSTERS } from "./monsters.mjs";

const MAX = Number(process.argv[2]) || 8;
const art = readFileSync("src/assets/art.ts", "utf8");
const hasArt = (id) => art.includes(`\n  ${id}: {`);

const pending = Object.keys(MONSTERS)
  .filter((id) => !id.includes("-") && !hasArt(id))
  .slice(0, MAX);

process.stdout.write(`MONSTER=${pending.join(",")}\nPENDING_COUNT=${pending.length}\n`);
