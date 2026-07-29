import { species } from '../../data/creatures';
import type { Species, Stats } from '../../data/creatures';
import type { AttributeId, ElementId } from '../../data/elements';
import { equipment } from '../../data/equipment';

/** A concrete creature in someone's party (or an enemy formation). */
export interface CreatureInstance {
  uid: string;
  speciesId: string;
  name: string;
  level: number;
  attribute: AttributeId;
  element: ElementId;
  maxHp: number;
  hp: number;
  maxMp: number;
  mp: number;
  off: number;
  def: number;
  spd: number;
  /** EXP banked toward the next level (see `xpToNext`). */
  xp: number;
  techniques: string[];
  /** Equipped item ids, one per slot (Arms / Shrouds / Mementos). */
  equip: { arms?: string; shroud?: string; memento?: string };
  /** Set while the creature is guarding this round. */
  guarding: boolean;
  /** Gentle soul: the battle's Commune action can pacify it (from `Species.communable`). */
  communable?: boolean;
}

let uidCounter = 0;

export function statsAt(s: Species, level: number): Stats {
  const n = Math.max(0, level - 1);
  return {
    hp: Math.round(s.base.hp + s.growth.hp * n),
    mp: Math.round(s.base.mp + s.growth.mp * n),
    off: Math.round(s.base.off + s.growth.off * n),
    def: Math.round(s.base.def + s.growth.def * n),
    spd: Math.round(s.base.spd + s.growth.spd * n),
  };
}

export function makeCreature(speciesId: string, level: number, nickname?: string): CreatureInstance {
  const s = species(speciesId);
  const st = statsAt(s, level);
  return {
    uid: `c${++uidCounter}`,
    speciesId,
    name: nickname ?? s.name,
    level,
    attribute: s.attribute,
    element: s.element,
    maxHp: st.hp,
    hp: st.hp,
    maxMp: st.mp,
    mp: st.mp,
    off: st.off,
    def: st.def,
    spd: st.spd,
    xp: 0,
    techniques: s.techniques.slice(),
    equip: {},
    guarding: false,
    communable: s.communable ?? false,
  };
}

export const isDown = (c: CreatureInstance): boolean => c.hp <= 0;
export const isUp = (c: CreatureInstance): boolean => c.hp > 0;

/** Sum of a stat's bonuses from the creature's three equipment slots. */
export function equipBonus(c: CreatureInstance, key: 'off' | 'def' | 'spd'): number {
  const e = c.equip;
  if (!e) return 0;
  let b = 0;
  for (const id of [e.arms, e.shroud, e.memento]) {
    if (id) b += equipment(id)[key] ?? 0;
  }
  return b;
}

/** Effective stats (base + equipment) — used by the battle model. */
export const effOff = (c: CreatureInstance): number => c.off + equipBonus(c, 'off');
export const effDef = (c: CreatureInstance): number => c.def + equipBonus(c, 'def');
export const effSpd = (c: CreatureInstance): number => c.spd + equipBonus(c, 'spd');

/** True if any equipped item carries the given battle-special effect. */
export function hasEquipEffect(c: CreatureInstance, effect: string): boolean {
  const e = c.equip;
  if (!e) return false;
  return [e.arms, e.shroud, e.memento].some((id) => id && equipment(id).effect === effect);
}

/** EXP needed to advance from `level` to the next. A gentle super-linear curve. */
export function xpToNext(level: number): number {
  return Math.round(12 * Math.pow(level, 1.5));
}

/**
 * EXP a single defeated enemy yields to one party monster, scaled by the level
 * gap: a lower-level monster earns more, a higher-level one earns less. Each
 * monster is scored independently against the enemy it helped defeat.
 */
export function xpFromEnemy(monsterLevel: number, enemyLevel: number): number {
  const base = enemyLevel * 8;
  const scale = Math.min(4, Math.max(0.25, Math.pow(2, (enemyLevel - monsterLevel) / 3)));
  return Math.max(1, Math.round(base * scale));
}

/**
 * Grants EXP to one creature, applying any level-ups. Stats are recomputed from
 * the species growth curve; a level-up raises max HP/MP and heals the gain.
 * Returns the new level if it changed, else null.
 */
export function grantXp(c: CreatureInstance, amount: number): number | null {
  const s = species(c.speciesId);
  c.xp = (c.xp ?? 0) + amount;
  let leveled = false;
  while (c.xp >= xpToNext(c.level)) {
    c.xp -= xpToNext(c.level);
    c.level++;
    const st = statsAt(s, c.level);
    const dHp = Math.max(0, st.hp - c.maxHp);
    const dMp = Math.max(0, st.mp - c.maxMp);
    c.maxHp = st.hp;
    c.maxMp = st.mp;
    if (isUp(c)) c.hp = Math.min(c.maxHp, c.hp + dHp); // level-up heals the delta
    c.mp = Math.min(c.maxMp, c.mp + dMp);
    c.off = st.off;
    c.def = st.def;
    c.spd = st.spd;
    leveled = true;
  }
  return leveled ? c.level : null;
}

export function fullRestore(party: CreatureInstance[]) {
  for (const c of party) {
    c.hp = c.maxHp;
    c.mp = c.maxMp;
    c.guarding = false;
  }
}

/** Small out-of-battle recovery, e.g. after a won fight. */
export function reviveFainted(party: CreatureInstance[], fraction = 0.25) {
  for (const c of party) {
    if (isDown(c)) c.hp = Math.max(1, Math.round(c.maxHp * fraction));
  }
}
