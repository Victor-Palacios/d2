#!/usr/bin/env node
// Naming guard. Two families of banned words, both checked on every push (CI job
// `.github/workflows/naming-guard.yml`). Run: `npm run check:naming`.
//
//  1. Areas are "reaches" and the tutorial area is "The Quiet Crossing". The two
//     words they were renamed out of are banned everywhere. See CLAUDE.md §Naming.
//  2. Retired setting vocabulary. The crawl was reframed from a car-and-fuel
//     premise to a keeper-and-lantern one: EP → LP (Light Power), the fuel
//     canister → the Light Shard, the tow-home penalty → a guttered lantern.
//     Those words were purged on purpose (see git log for the reframe). Guarding
//     them keeps the reframe from silently rotting back in — the exact failure
//     this guard was added to prevent.
//
// Dependency-free (Node stdlib only), matching the repo's .mjs tooling.

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// (1) Reaches. Built from fragments so THIS file contains no literal match.
const BANNED = new RegExp([['b', 'oot'].join(''), ['do', 'main'].join('')].join('|'), 'i');
// Substrings that legitimately contain a banned fragment. Longest-first.
const ALLOW = /bootstrap|reboots?|booth|boots|subdomain/gi;

// (2) Retired setting vocabulary. Word-boundaried so common English is untouched
// ("toward"/"town", "refuel", "cardboard", "AoE" as area-of-effect all pass).
const RETIRED = /\bvehicles?\b|\bfuel\b|\bEP\b|\btowed?\b|\bcar\b|\bcanisters?\b/i;
// Legit words that survive a loosened boundary — scrubbed before testing.
const RETIRED_ALLOW = /refuel(s|led|ling)?/gi;

// Files that may legitimately mention the banned words (and this script itself).
const SKIP = new Set(['CLAUDE.md', 'tools/check-naming.mjs', 'package-lock.json']);

const files = execSync('git ls-files', { encoding: 'utf8' })
  .split('\n')
  .filter((f) => f && !SKIP.has(f));

const reaches = [];
const retired = [];
for (const file of files) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue; // unreadable/binary — skip
  }
  text.split('\n').forEach((line, i) => {
    if (BANNED.test(line.replace(ALLOW, ''))) reaches.push(`${file}:${i + 1}: ${line.trim()}`);
    if (RETIRED.test(line.replace(RETIRED_ALLOW, ''))) retired.push(`${file}:${i + 1}: ${line.trim()}`);
  });
}

if (reaches.length || retired.length) {
  if (reaches.length) {
    console.error(`Naming guard FAILED — ${reaches.length} reach-naming occurrence(s):\n`);
    for (const v of reaches) console.error('  ' + v);
    console.error('\nThe areas are "reaches"; the tutorial area is "The Quiet Crossing".');
    console.error('See CLAUDE.md §Naming. If a match is a legitimate word, add it to ALLOW.\n');
  }
  if (retired.length) {
    console.error(`Naming guard FAILED — ${retired.length} retired-vocabulary occurrence(s):\n`);
    for (const v of retired) console.error('  ' + v);
    console.error('\nThe crawl is a keeper-and-lantern premise: use LP (Light Power), the');
    console.error('Light Shard, and a guttered-lantern return — not EP / fuel / tow / vehicle.');
    console.error('If a match is a legitimate word, add it to RETIRED_ALLOW.\n');
  }
  process.exit(1);
}

console.log(`Naming guard OK — scanned ${files.length} files, no banned words.`);
