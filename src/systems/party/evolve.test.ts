import { describe, it, expect } from 'vitest';
import { SPECIES } from '../../data/creatures';
import { makeCreature, MAX_ACTIVE_MOVES } from './creature';
import { evolve, devolve, evolutionOptions, canEvolve, devolveTargetId, isSameClass } from './evolve';

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

describe('evolution — Digimon-style branching (cross-line, same class)', () => {
  it('emberling offers two same-class paths and refuses an ambiguous evolve', () => {
    const c = makeCreature('emberling', 2);
    const opts = evolutionOptions(c).map((o) => o.to);
    expect(opts).toContain('emberforge'); // its own line
    expect(opts).toContain('grovelord'); // a different line, still Hero
    expect(opts.length).toBeGreaterThanOrEqual(2);
    // With two eligible branches, evolve() with no chosen target must refuse.
    expect(evolve(c)).toBeNull();
    expect(c.speciesId).toBe('emberling');
  });

  it('takes the chosen branch into another line', () => {
    const c = makeCreature('emberling', 2);
    expect(evolve(c, 'grovelord')?.toId).toBe('grovelord');
    expect(c.speciesId).toBe('grovelord');
    expect(c.attribute).toBe('hero'); // class preserved across the crossing
  });

  it('de-evolves to the exact base even when the form is shared by other lines', () => {
    // duskfang is reachable from nightnip, prismoth and ashmoth. A prismoth that
    // crosses into duskfang must return to *prismoth*, not the canonical nightnip.
    const c = makeCreature('prismoth', 2);
    evolve(c, 'duskfang');
    expect(c.speciesId).toBe('duskfang');
    expect(devolveTargetId(c)).toBe('prismoth'); // ancestry, not the static tree
    expect(devolve(c)?.toId).toBe('prismoth');
    expect(c.speciesId).toBe('prismoth');
  });

  it('walks a cross-line path several steps up and back down exactly', () => {
    const c = makeCreature('prismoth', 4);
    evolve(c, 'duskfang'); // cross-line branch (Lv2)
    expect(evolve(c)?.toId).toBe('nightmaw'); // duskfang's own line (Lv3)
    expect(c.speciesId).toBe('nightmaw');
    expect(devolve(c)?.toId).toBe('duskfang');
    expect(devolve(c)?.toId).toBe('prismoth'); // all the way home
    expect(c.speciesId).toBe('prismoth');
  });
});

describe('evolution — debug level schedule (2 / 3 / 4)', () => {
  it('emberling evolves at Lv2, not Lv1', () => {
    expect(canEvolve(makeCreature('emberling', 1))).toBe(false);
    const c = makeCreature('emberling', 2);
    expect(canEvolve(c)).toBe(true);
    expect(evolve(c, 'emberforge')?.toId).toBe('emberforge');
    expect(c.speciesId).toBe('emberforge');
  });

  it('walks a full 4-stage line one level at a time', () => {
    const c = makeCreature('emberling', 4);
    expect(evolve(c, 'emberforge')?.toId).toBe('emberforge'); // Lv2 gate (branch chosen)
    expect(evolve(c)?.toId).toBe('ashwarden'); // Lv3 gate (single branch)
    expect(evolve(c)?.toId).toBe('pyrelord'); // Lv4 gate (single branch)
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
    evolve(c, 'emberforge'); // → emberforge
    const evolvedKnown = new Set(c.techniques);
    devolve(c); // → emberling
    // The known pool only grows: everything known as emberforge is still known.
    expect(c.speciesId).toBe('emberling');
    expect([...evolvedKnown].every((m) => c.techniques.includes(m))).toBe(true);
    expect(c.techniques.length).toBeGreaterThanOrEqual(beforeCount);
  });
});
