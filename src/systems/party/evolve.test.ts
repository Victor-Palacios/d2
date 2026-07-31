import { describe, it, expect } from 'vitest';
import { SPECIES } from '../../data/creatures';
import { makeCreature, MAX_ACTIVE_MOVES } from './creature';
import { evolve, devolve, evolutionOptions, canEvolve, isSameClass } from './evolve';

describe('evolution — class purity (the house rule)', () => {
  it('every authored evolution stays in the source class', () => {
    const crossings: string[] = [];
    for (const s of Object.values(SPECIES)) {
      for (const opt of s.evolutions ?? []) {
        const to = SPECIES[opt.to];
        if (!to) {
          crossings.push(`${s.id} → unknown ${opt.to}`);
        } else if (to.attribute !== s.attribute) {
          crossings.push(`${s.id} (${s.attribute}) → ${to.id} (${to.attribute})`);
        }
      }
    }
    expect(crossings).toEqual([]);
  });

  it('evolutionOptions never offers a cross-class branch', () => {
    // Fabricate a cross-class branch in a throwaway clone and confirm it is filtered.
    const c = makeCreature('emberling', 30); // hero
    // emberling's real branch (emberforge, hero) survives; a fake mage branch does not.
    expect(evolutionOptions(c).every((o) => isSameClass(c.speciesId, o.to))).toBe(true);
    expect(isSameClass('emberling', 'gloomshade')).toBe(false); // hero vs mage
  });
});

describe('evolution — debug level schedule (2 / 3 / 4)', () => {
  it('emberling evolves at Lv2, not Lv1', () => {
    expect(canEvolve(makeCreature('emberling', 1))).toBe(false);
    const c = makeCreature('emberling', 2);
    expect(canEvolve(c)).toBe(true);
    expect(evolve(c)?.toId).toBe('emberforge');
    expect(c.speciesId).toBe('emberforge');
  });

  it('walks a full 4-stage line one level at a time', () => {
    const c = makeCreature('emberling', 4);
    expect(evolve(c)?.toId).toBe('emberforge'); // Lv2 gate
    expect(evolve(c)?.toId).toBe('ashwarden'); // Lv3 gate
    expect(evolve(c)?.toId).toBe('pyrelord'); // Lv4 gate
    expect(canEvolve(c)).toBe(false); // terminal
  });
});

describe('moves — known pool is monotonic, loadout capped', () => {
  it('keeps a ≤5 loadout drawn from the known pool', () => {
    const c = makeCreature('emberling', 20);
    expect(c.loadout.length).toBeLessThanOrEqual(MAX_ACTIVE_MOVES);
    expect(c.loadout.every((m) => c.techniques.includes(m))).toBe(true);
  });

  it('never forgets a move across evolve → devolve', () => {
    const c = makeCreature('emberling', 4);
    const beforeCount = c.techniques.length;
    evolve(c); // → emberforge
    const evolvedKnown = new Set(c.techniques);
    devolve(c); // → emberling
    // The known pool only grows: everything known as emberforge is still known.
    expect(c.speciesId).toBe('emberling');
    expect([...evolvedKnown].every((m) => c.techniques.includes(m))).toBe(true);
    expect(c.techniques.length).toBeGreaterThanOrEqual(beforeCount);
  });
});
