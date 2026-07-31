#!/usr/bin/env node
// Naming guard: the game's areas are "reaches" and the tutorial area is "The
// Quiet Crossing". The two words they were renamed out of are banned everywhere
// (code, comments, docs, dialogue). This fails if either reappears. See
// CLAUDE.md §Naming. Run: `npm run check:naming`.
//
// Dependency-free (Node stdlib only), matching the repo's .mjs tooling.

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Build the banned pattern from fragments so THIS file contains no literal match.
const BANNED = new RegExp([['b', 'oot'].join(''), ['do', 'main'].join('')].join('|'), 'i');

// Substrings that legitimately contain a banned fragment and are allowed. Scrub
// them from each line before testing. Longest-first so whole words match.
const ALLOW = /bootstrap|reboots?|booth|boots|subdomain/gi;

// Files that may legitimately mention the banned words (and this script itself).
const SKIP = new Set(['CLAUDE.md', 'tools/check-naming.mjs', 'package-lock.json']);

const files = execSync('git ls-files', { encoding: 'utf8' })
  .split('\n')
  .filter((f) => f && !SKIP.has(f));

const violations = [];
for (const file of files) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue; // unreadable/binary — skip
  }
  text.split('\n').forEach((line, i) => {
    const scrubbed = line.replace(ALLOW, '');
    if (BANNED.test(scrubbed)) violations.push(`${file}:${i + 1}: ${line.trim()}`);
  });
}

if (violations.length) {
  console.error(`Naming guard FAILED — ${violations.length} banned-word occurrence(s):\n`);
  for (const v of violations) console.error('  ' + v);
  console.error('\nThe areas are "reaches"; the tutorial area is "The Quiet Crossing".');
  console.error('See CLAUDE.md §Naming. If a match is a legitimate word, add it to ALLOW.');
  process.exit(1);
}

console.log(`Naming guard OK — scanned ${files.length} files, no banned words.`);
