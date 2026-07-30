/**
 * Shared helpers for the battle unit tests: a seeded PRNG and a minimal
 * `CreatureInstance` factory.
 *
 * The battle model already accepts an injected `rng` everywhere (see
 * `Battle` and `computeDamage`), so feeding it a seeded generator makes every
 * fight fully reproducible — the property the tests below rely on. The factory
 * builds a bare creature directly instead of going through `makeCreature`, so
 * these tests stay hermetic and do not depend on the balance data in
 * `src/data/creatures.ts`.
 */
import type { CreatureInstance } from '../party/creature';
import type { AttributeId, ElementId } from '../../data/elements';

/**
 * mulberry32 — a tiny, fast, well-distributed 32-bit PRNG. Same seed always
 * yields the same stream, which is exactly what deterministic tests need.
 */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let uid = 0;

/** A minimal, fully-specified creature with sensible defaults for any field. */
export function mkCreature(over: Partial<CreatureInstance> = {}): CreatureInstance {
  const attribute: AttributeId = over.attribute ?? 'hero';
  const element: ElementId = over.element ?? 'fire';
  const maxHp = over.maxHp ?? 100;
  const maxMp = over.maxMp ?? 20;
  return {
    uid: over.uid ?? `t${++uid}`,
    speciesId: over.speciesId ?? 'test',
    name: over.name ?? 'Test',
    level: over.level ?? 1,
    attribute,
    element,
    maxHp,
    hp: over.hp ?? maxHp,
    maxMp,
    mp: over.mp ?? maxMp,
    off: over.off ?? 40,
    def: over.def ?? 30,
    spd: over.spd ?? 10,
    mag: over.mag ?? 40,
    res: over.res ?? 30,
    xp: over.xp ?? 0,
    techniques: over.techniques ?? ['strike'],
    loadout: over.loadout ?? (over.techniques ?? ['strike']).slice(0, 5),
    equip: over.equip ?? {},
    guarding: over.guarding ?? false,
    communable: over.communable,
  };
}
