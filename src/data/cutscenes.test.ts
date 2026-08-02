import { describe, expect, it } from 'vitest';
import { CUTSCENES, cutscene } from './cutscenes';

// The opening plays this cutscene by id the moment the keeper is named:
// `IntroScene` calls `playCutscene(ctx.ui, cutscene('prologueLife'), …)`. If the
// id is renamed or removed, `cutscene()` throws and the whole opening breaks
// right after name entry — a failure the browser-only `cutscene.mjs` smoke test
// cannot catch in CI (no GPU there). This file is that guard, plus a structural
// check that no cutscene can render a blank/flashing beat or an invalid wash.
const OPENING_CUTSCENE = 'prologueLife';

// The tint is dropped straight into a CSS background, and hold into a timer.
const HEX = /^#[0-9a-fA-F]{6}$/;

describe('cutscene data', () => {
  it('resolves the cutscene the opening plays', () => {
    expect(() => cutscene(OPENING_CUTSCENE)).not.toThrow();
    expect(cutscene(OPENING_CUTSCENE).beats.length).toBeGreaterThan(0);
  });

  it('throws on an unknown cutscene id', () => {
    expect(() => cutscene('no-such-cutscene')).toThrow(/Unknown cutscene/);
  });

  it('every cutscene is well-formed (no blank, flashing, or mistinted beat)', () => {
    for (const [key, cs] of Object.entries(CUTSCENES)) {
      expect(cs.id, `${key}: id must match its registry key`).toBe(key);
      expect(cs.beats.length, `${key}: needs at least one beat`).toBeGreaterThan(0);
      cs.beats.forEach((beat, i) => {
        const where = `${key} beat ${i}`;
        expect(beat.lines.length, `${where}: needs at least one line`).toBeGreaterThan(0);
        for (const line of beat.lines) {
          expect(line.trim().length, `${where}: no empty lines`).toBeGreaterThan(0);
        }
        if (beat.hold !== undefined) {
          expect(Number.isFinite(beat.hold) && beat.hold > 0, `${where}: hold must be a positive ms value`).toBe(true);
        }
        if (beat.tint !== undefined) {
          expect(beat.tint, `${where}: tint must be a #rrggbb hex`).toMatch(HEX);
        }
      });
    }
  });
});
