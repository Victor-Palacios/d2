// CI smoke runner — runs the subset of smoke scripts proven reliable on a
// GPU-less runner (SwiftShader), serially, and exits non-zero if any fails.
//
// These either never render a crawl scene (headless-API / audio) or seed state
// directly and strip the FX stack, so they don't hit the ~1fps opening-nav
// timeouts that make the full suite flaky in CI. Grow this list as more scripts
// are migrated to the `_harness.mjs` `startInHub` entry point and made
// frame-rate-independent (see tools/smoke/README.md).
import { spawnSync } from 'node:child_process';

const SUITE = ['transcend', 'transcend-fx', 'terrain', 'cries', 'equip'];

const results = [];
for (const name of SUITE) {
  process.stdout.write(`\n=== smoke: ${name} ===\n`);
  const r = spawnSync('node', [`tools/smoke/${name}.mjs`], { stdio: 'inherit', env: process.env });
  results.push({ name, code: r.status ?? 1 });
}

const failed = results.filter((r) => r.code !== 0);
process.stdout.write('\n=== CI smoke summary ===\n');
for (const r of results) process.stdout.write(`  ${r.code === 0 ? 'PASS' : 'FAIL'}  ${r.name}\n`);
if (failed.length) {
  process.stderr.write(`\n${failed.length} smoke script(s) failed: ${failed.map((f) => f.name).join(', ')}\n`);
  process.exit(1);
}
process.stdout.write(`\nAll ${SUITE.length} CI smoke scripts passed.\n`);
