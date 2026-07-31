import { describe, it, expect } from 'vitest';
import {
  computeDamage,
  computeHeal,
  GUARD_REDUCTION,
  VARIANCE,
  VANGUARD_MELEE_DEALT,
  REAR_MELEE_DEALT,
  VANGUARD_DAMAGE_TAKEN,
  HEAL_RES_WEIGHT,
  HEAL_MAG_WEIGHT,
  HEAL_STAT_SCALE,
} from './formula';
import type { DamageInput } from './formula';
import { attributeMultiplier, ELEMENT_TILE_BONUS } from '../../data/elements';
import type { Technique } from '../../data/techniques';
import { mkCreature } from './testkit';

/** A basic single-target damage technique (power 30, like `strike`). */
const strike: Technique = {
  id: 'strike',
  name: 'Strike',
  kind: 'damage',
  mpCost: 0,
  power: 30,
  element: 'machine',
  desc: '',
};

/** rng fixed at 0.5 zeroes the variance term, so damage is exact and testable. */
const noVariance = () => 0.5;

/** base = power * off / (def + 40); with power 30, off 40, def 30 => 17.14. */
const BASE = (30 * 40) / (30 + 40);

function dmg(over: Partial<DamageInput> = {}) {
  return computeDamage({
    attacker: mkCreature({ attribute: 'hero', element: 'fire', off: 40 }),
    defender: mkCreature({ attribute: 'hero', element: 'fire', def: 30 }),
    technique: strike,
    rng: noVariance,
    ...over,
  });
}

describe('attributeMultiplier — the class triangle', () => {
  it('gives the advantage to the attacker that beats the defender', () => {
    expect(attributeMultiplier('assassin', 'mage')).toBeGreaterThan(1);
    expect(attributeMultiplier('mage', 'hero')).toBeGreaterThan(1);
    expect(attributeMultiplier('hero', 'assassin')).toBeGreaterThan(1);
  });

  it('penalises the disadvantaged attacker', () => {
    expect(attributeMultiplier('mage', 'assassin')).toBeLessThan(1);
    expect(attributeMultiplier('hero', 'mage')).toBeLessThan(1);
    expect(attributeMultiplier('assassin', 'hero')).toBeLessThan(1);
  });

  it('is neutral against the same class', () => {
    expect(attributeMultiplier('hero', 'hero')).toBe(1);
    expect(attributeMultiplier('mage', 'mage')).toBe(1);
  });
});

describe('computeDamage', () => {
  it('computes the deterministic base with variance neutralised', () => {
    expect(dmg().amount).toBe(Math.round(BASE));
  });

  it('applies class advantage and reports super-effective', () => {
    const r = dmg({
      attacker: mkCreature({ attribute: 'assassin', off: 40 }),
      defender: mkCreature({ attribute: 'mage', def: 30 }),
    });
    expect(r.effectiveness).toBe('super');
    expect(r.amount).toBe(Math.round(BASE * 1.25));
  });

  it('applies class disadvantage and reports resisted', () => {
    const r = dmg({
      attacker: mkCreature({ attribute: 'mage', off: 40 }),
      defender: mkCreature({ attribute: 'assassin', def: 30 }),
    });
    expect(r.effectiveness).toBe('weak');
    expect(r.amount).toBe(Math.round(BASE * 0.8));
  });

  it('boosts an attacker standing on its matching element plate', () => {
    const r = dmg({ attackerTile: 'fire' }); // attacker element is fire
    expect(r.attackerTileBonus).toBe(true);
    expect(r.amount).toBe(Math.round(BASE * ELEMENT_TILE_BONUS));
  });

  it('softens damage against a defender on its matching element plate', () => {
    const r = dmg({ defenderTile: 'fire' }); // defender element is fire
    expect(r.defenderTileBonus).toBe(true);
    expect(r.amount).toBe(Math.round(BASE / ELEMENT_TILE_BONUS));
  });

  it('does not grant the plate bonus for a non-matching element', () => {
    const r = dmg({ attackerTile: 'water' });
    expect(r.attackerTileBonus).toBe(false);
    expect(r.amount).toBe(Math.round(BASE));
  });

  it('halves damage against a guarding defender', () => {
    const r = dmg({ defender: mkCreature({ attribute: 'hero', def: 30, guarding: true }) });
    expect(r.guarded).toBe(true);
    expect(r.amount).toBe(Math.round(BASE * GUARD_REDUCTION));
  });

  it('applies formation-row modifiers only to melee for the attacker', () => {
    expect(dmg({ melee: true, attackerRow: 0 }).amount).toBe(Math.round(BASE * VANGUARD_MELEE_DEALT));
    expect(dmg({ melee: true, attackerRow: 1 }).amount).toBe(Math.round(BASE * REAR_MELEE_DEALT));
    // Ranged/Ether (melee: false) ignores the attacker's row entirely.
    expect(dmg({ melee: false, attackerRow: 0 }).amount).toBe(Math.round(BASE));
    expect(dmg({ melee: false, attackerRow: 1 }).amount).toBe(Math.round(BASE));
  });

  it('makes the Vanguard take more, regardless of melee', () => {
    expect(dmg({ defenderRow: 0 }).amount).toBe(Math.round(BASE * VANGUARD_DAMAGE_TAKEN));
    expect(dmg({ defenderRow: 1 }).amount).toBe(Math.round(BASE));
  });

  it('keeps the roll inside the +/- VARIANCE band', () => {
    const low = dmg({ rng: () => 0 }).amount; // factor 1 - VARIANCE
    const high = dmg({ rng: () => 1 }).amount; // factor 1 + VARIANCE
    expect(low).toBe(Math.max(1, Math.round(BASE * (1 - VARIANCE))));
    expect(high).toBe(Math.max(1, Math.round(BASE * (1 + VARIANCE))));
    expect(high).toBeGreaterThan(low);
  });

  it('never deals less than 1 damage', () => {
    const r = dmg({ defender: mkCreature({ def: 100000 }) });
    expect(r.amount).toBe(1);
  });
});

describe('computeDamage — physical/magical channel split', () => {
  it('routes magical techniques through Magick vs Resolve, ignoring Defense', () => {
    const bolt: Technique = { ...strike, category: 'magical', melee: false };
    const r = computeDamage({
      attacker: mkCreature({ attribute: 'hero', mag: 40 }),
      defender: mkCreature({ attribute: 'hero', res: 30, def: 100_000 }),
      technique: bolt,
      rng: noVariance,
    });
    // mag 40 vs res 30 gives the same base as the physical case; the huge
    // Defense is ignored entirely, so it does NOT collapse to the 1-damage floor.
    expect(r.amount).toBe(Math.round(BASE));
  });
});

describe('computeHeal', () => {
  it('blends the healer Resolve and Magick onto the flat heal power', () => {
    const heal: Technique = { ...strike, kind: 'heal', power: 20, element: 'water' };
    const healer = mkCreature({ res: 30, mag: 40 });
    const stat = 30 * HEAL_RES_WEIGHT + 40 * HEAL_MAG_WEIGHT;
    expect(computeHeal(healer, heal)).toBe(Math.round(20 + stat * HEAL_STAT_SCALE));
  });
});
