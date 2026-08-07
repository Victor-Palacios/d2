import { describe, expect, it } from 'vitest';
import { REACHES } from './reaches';
import { analyzeReaches, balanceReport } from './balance';

// The balance harness reads each reach's light/obols economy off the ASCII grids
// (see balance.ts). This test prints the report — run `npm test` and read it to
// tune floors — and guards the invariants that make a reach *completable*.

describe('reach balance', () => {
  it('prints a balance report for every reach', () => {
    // Visible in the test output; not an assertion, just the tuning surface.
    console.log(`\nBalance report (shortest-path model):\n${balanceReport(REACHES)}\n`);
    expect(analyzeReaches(REACHES).length).toBe(Object.keys(REACHES).length);
  });

  it('every reach is completable on its light budget (shortest path + shards)', () => {
    // The shortest path is a lower bound, so a non-positive margin here means the
    // reach cannot be lit even by a perfect run — a real, must-fix imbalance.
    for (const r of analyzeReaches(REACHES)) {
      expect(r.totalSteps, `${r.id} has a reachable descent`).toBeGreaterThan(0);
      expect(
        r.lightMargin,
        `${r.id} light margin (start ${r.startingLight} + shards vs ${r.totalSteps} steps)`,
      ).toBeGreaterThan(0);
    }
  });

  it('reports finite, sane economy numbers for every reach', () => {
    for (const r of analyzeReaches(REACHES)) {
      expect(Number.isFinite(r.totalObols)).toBe(true);
      expect(Number.isFinite(r.expectedEncounters)).toBe(true);
      expect(r.recommendedLevel).toBeGreaterThan(0);
    }
  });
});
