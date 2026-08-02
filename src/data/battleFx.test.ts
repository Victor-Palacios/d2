import { describe, it, expect } from 'vitest';
import { SPECIES } from './creatures';
import { battleAura, ELEMENT_AURAS } from './battleFx';
import { ELEMENTS } from './elements';

describe('battle auras — full roster coverage', () => {
  it('every species gets a usable aura (no monster fights bare)', () => {
    const bad: string[] = [];
    for (const s of Object.values(SPECIES)) {
      const aura = battleAura(s.id, s.element, s.attribute);
      if (!aura) {
        bad.push(`${s.id}: no aura`);
        continue;
      }
      if (typeof aura.color !== 'number') bad.push(`${s.id}: non-numeric color`);
      if (!(aura.rate > 0)) bad.push(`${s.id}: rate must be > 0`);
      if (!(aura.originY >= 0 && aura.originY <= 1)) bad.push(`${s.id}: originY out of [0,1]`);
    }
    expect(bad).toEqual([]);
  });

  it('has a default for every element, seeded from the element palette', () => {
    for (const id of Object.keys(ELEMENTS)) {
      const def = ELEMENT_AURAS[id as keyof typeof ELEMENT_AURAS];
      expect(def, `missing default for element ${id}`).toBeDefined();
      // The default colour is the element's emissive light hex.
      expect(def.color).toBe(ELEMENTS[id as keyof typeof ELEMENTS].light);
    }
  });

  it('class overlay is pure — it never mutates the shared element default', () => {
    const before = { ...ELEMENT_AURAS.fire };
    battleAura('___not_a_real_species___', 'fire', 'assassin');
    battleAura('___not_a_real_species___', 'fire', 'hero');
    battleAura('___not_a_real_species___', 'fire', 'mage');
    expect(ELEMENT_AURAS.fire).toEqual(before);
  });
});
