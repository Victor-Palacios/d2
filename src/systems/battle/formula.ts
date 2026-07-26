import type { CreatureInstance } from '../party/creature';
import type { Technique } from '../../data/techniques';
import type { ElementId } from '../../data/elements';
import { ELEMENT_TILE_BONUS, attributeMultiplier } from '../../data/elements';

/**
 * Damage / healing maths (plan §5.2).
 *
 * Deterministic base (Offense vs Defense), then class and element-tile
 * multipliers, then a small variance so repeated fights are not identical.
 * All constants are tunable and intentionally readable.
 */

export const GUARD_REDUCTION = 0.5;
/** Fraction of max MP a Guard restores. */
export const GUARD_MP_RESTORE = 0.12;
export const VARIANCE = 0.06;

export interface DamageBreakdown {
  amount: number;
  attributeMult: number;
  attackerTileBonus: boolean;
  defenderTileBonus: boolean;
  guarded: boolean;
  /** 'super' | 'weak' | 'normal' — drives the battle log wording. */
  effectiveness: 'super' | 'weak' | 'normal';
}

export interface DamageInput {
  attacker: CreatureInstance;
  defender: CreatureInstance;
  technique: Technique;
  /** Element of the floor tile the attacker is standing on, if any. */
  attackerTile?: ElementId;
  defenderTile?: ElementId;
  /** Deterministic roll injection for tests; defaults to Math.random. */
  rng?: () => number;
}

export function computeDamage(input: DamageInput): DamageBreakdown {
  const { attacker, defender, technique, rng = Math.random } = input;

  const base = (technique.power * attacker.off) / (defender.def + 40);

  const attributeMult = attributeMultiplier(attacker.attribute, defender.attribute);

  const attackerTileBonus = !!input.attackerTile && input.attackerTile === attacker.element;
  const defenderTileBonus = !!input.defenderTile && input.defenderTile === defender.element;

  let amount = base * attributeMult;
  if (attackerTileBonus) amount *= ELEMENT_TILE_BONUS;
  if (defenderTileBonus) amount /= ELEMENT_TILE_BONUS;
  if (defender.guarding) amount *= GUARD_REDUCTION;

  amount *= 1 + (rng() * 2 - 1) * VARIANCE;

  return {
    amount: Math.max(1, Math.round(amount)),
    attributeMult,
    attackerTileBonus,
    defenderTileBonus,
    guarded: defender.guarding,
    effectiveness: attributeMult > 1 ? 'super' : attributeMult < 1 ? 'weak' : 'normal',
  };
}

export function computeHeal(healer: CreatureInstance, technique: Technique): number {
  return Math.round(technique.power + healer.off * 0.4);
}
