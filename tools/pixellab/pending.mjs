#!/usr/bin/env node
// Decide which monsters the daily action generates, within a credit budget.
// Priority: (1) the REGEN queue (tools/pixellab/regen.txt) — ids whose prompt
// changed and must be redone even though they already have art; then (2) new
// registry monsters that don't yet have a CREATURES entry in art.ts. Stage
// variants (ids containing "-") are left to the manual workflow.
//
// Emits GitHub-Actions env lines:
//   MONSTER=id1,id2,...
//   PENDING_COUNT=N
//
//   node tools/pixellab/pending.mjs [max]   # default max 5 (credits/day)

import { readFileSync, existsSync } from "node:fs";
import { MONSTERS } from "./monsters.mjs";

const MAX = Number(process.argv[2]) || 5;
const art = readFileSync("src/assets/art.ts", "utf8");
const hasArt = (id) => art.includes(`\n  ${id}: {`);

const regen = existsSync("tools/pixellab/regen.txt")
  ? readFileSync("tools/pixellab/regen.txt", "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && MONSTERS[l])
  : [];

const fresh = Object.keys(MONSTERS).filter((id) => !id.includes("-") && !hasArt(id) && !regen.includes(id));

const list = [...regen, ...fresh].slice(0, MAX);
process.stdout.write(`MONSTER=${list.join(",")}\nPENDING_COUNT=${list.length}\n`);
