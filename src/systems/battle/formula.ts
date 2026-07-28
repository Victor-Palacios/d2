import type { CreatureInstance } from '../party/creature';
import { effOff, effDef, effMag, effRes } from '../party/creature';
import type { Technique } from '../../data/techniques';
import { techCategory } from '../../data/techniques';
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

/**
 * Heal scaling. A heal blends the caster's **Resolve** and **Magick** — mending
 * is mostly a protective act (Res) with a magical component (Mag). Weights sum to
 * 1; the blended stat is then scaled by `HEAL_STAT_SCALE` and added to the
 * technique's flat power. Tunable — raise the Mag weight to make casters the best
 * healers, or the Res weight to reward durable supports.
 */
export const HEAL_RES_WEIGHT = 0.7;
export const HEAL_MAG_WEIGHT = 0.3;
export const HEAL_STAT_SCALE = 0.4;

/**
 * Formation row modifiers (grid battle, Phase A).
 *
 * Melee from the Vanguard hits harder; melee from the Rear pulls its punches.
 * Anyone standing in the Vanguard takes more from every hit — the price of the
 * front line. Ranged/Ether is unaffected by the attacker's row, which is the
 * incentive to keep casters in the back.
 */
export const VANGUARD_MELEE_DEALT = 1.15;
export const REAR_MELEE_DEALT = 0.8;
export const VANGUARD_DAMAGE_TAKEN = 1.15;

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
  /** Melee (basic Attack) vs ranged/Ether — only melee gets the row modifiers. */
  melee?: boolean;
  /** Formation rows (0 = Vanguard, 1 = Rear) for the front/back modifiers. */
  attackerRow?: number;
  defenderRow?: number;
  /** Deterministic roll injection for tests; defaults to Math.random. */
  rng?: () => number;
}

export function computeDamage(input: DamageInput): DamageBreakdown {
  const { attacker, defender, technique, rng = Math.random } = input;

  // Pick the stat pair by channel: physical rides Offense vs Defense, magical
  // rides Magick vs Resolve. Effective stats fold in equipped Arms / Shrouds /
  // Mementos.
  const magical = techCategory(technique) === 'magical';
  const atkStat = magical ? effMag(attacker) : effOff(attacker);
  const defStat = magical ? effRes(defender) : effDef(defender);
  const base = (technique.power * atkStat) / (defStat + 40);

  const attributeMult = attributeMultiplier(attacker.attribute, defender.attribute);

  const attackerTileBonus = !!input.attackerTile && input.attackerTile === attacker.element;
  const defenderTileBonus = !!input.defenderTile && input.defenderTile === defender.element;

  let amount = base * attributeMult;
  if (attackerTileBonus) amount *= ELEMENT_TILE_BONUS;
  if (defenderTileBonus) amount /= ELEMENT_TILE_BONUS;

  // Formation rows: melee is stronger from the front, weaker from the back;
  // the Vanguard takes more from everything.
  if (input.melee) {
    if (input.attackerRow === 0) amount *= VANGUARD_MELEE_DEALT;
    else if (input.attackerRow === 1) amount *= REAR_MELEE_DEALT;
  }
  if (input.defenderRow === 0) amount *= VANGUARD_DAMAGE_TAKEN;

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
  // Blend of Resolve (mostly) and Magick, then scaled onto the flat heal power.
  const stat = effRes(healer) * HEAL_RES_WEIGHT + effMag(healer) * HEAL_MAG_WEIGHT;
  return Math.round(technique.power + stat * HEAL_STAT_SCALE);
}
