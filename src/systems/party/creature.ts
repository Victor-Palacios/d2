import { species, movesKnownAt } from '../../data/creatures';
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
  /** Magick — magical attack. */
  mag: number;
  /** Resolve — magical defence. */
  res: number;
  /** EXP banked toward the next level (see `xpToNext`). */
  xp: number;
  /**
   * Every move the creature has ever learned — the *known pool*. It only ever
   * grows: level-ups add learnset moves, and evolving folds in the new form's
   * moves (see `systems/party/evolve.ts`). A soul never forgets, so a move is
   * togglable "permanently" once learned.
   */
  techniques: string[];
  /**
   * The battle loadout: the (≤ `MAX_ACTIVE_MOVES`) known moves that appear in
   * the Technique menu, in display order. A subset of `techniques`; the player
   * toggles membership on the Moves screen (`ui/MovesScreen.ts`). Basic Attack
   * is always available and lives outside this list.
   */
  loadout: string[];
  /** Equipped item ids, one per slot (Arms / Shrouds / Mementos). */
  equip: { arms?: string; shroud?: string; memento?: string };
  /** Set while the creature is guarding this round. */
  guarding: boolean;
  /** Gentle soul: the battle's Commune action can pacify it (from `Species.communable`). */
  communable?: boolean;
  /**
   * A named story companion (Wren / Sena / Kade), not a bonded soul. Permanent
   * party member: cannot be released or benched to the Sanctuary. Set by
   * `game.joinCompanion`.
   */
  companion?: boolean;
  /**
   * The evolution ancestry stack — the forms this soul has climbed *up from*,
   * oldest first, current form excluded. Each evolve pushes the form left
   * behind; each de-evolve pops one. Empty/undefined for a base form or one
   * caught already-evolved. This makes de-evolution exact for any branch — even
   * a form reachable from several bases (cross-lines) returns to the one this
   * soul actually came from, not a guess from the static tree. See
   * `systems/party/evolve.ts`.
   */
  evolvedFrom?: string[];
}

let uidCounter = 0;

/** How many moves a creature may field in battle at once. */
export const MAX_ACTIVE_MOVES = 5;

/**
 * The moves a creature actually brings into battle — its loadout, falling back
 * to the full known pool for creatures built before loadouts existed (or enemy
 * stubs). Battle UI and the enemy AI both read moves through here so the ≤5 cap
 * is honoured everywhere.
 */
export function activeMoves(c: CreatureInstance): string[] {
  const pool = new Set(c.techniques);
  const load = (c.loadout ?? []).filter((t) => pool.has(t));
  return load.length ? load.slice(0, MAX_ACTIVE_MOVES) : c.techniques.slice(0, MAX_ACTIVE_MOVES);
}

/**
 * Folds the creature's current form/level learnset into its known pool without
 * ever removing a move (monotonic), then tidies the loadout: drops anything no
 * longer known, dedupes, clamps to `MAX_ACTIVE_MOVES`, and — only for the moves
 * *newly learned this call* — auto-fills any free slots so a fresh move is
 * battle-ready by default. Moves the player has deliberately left off are never
 * re-added. Returns the moves newly added to the known pool.
 */
export function syncMoves(c: CreatureInstance): string[] {
  const s = species(c.speciesId);
  if (!c.techniques) c.techniques = [];
  const before = new Set(c.techniques);
  const gained: string[] = [];
  for (const t of movesKnownAt(s, c.level)) {
    if (!before.has(t)) {
      c.techniques.push(t);
      before.add(t);
      gained.push(t);
    }
  }
  // Keep the current loadout (known, deduped), then fill free slots with the
  // freshly-learned moves in learn order — but nothing else.
  const known = new Set(c.techniques);
  const seen = new Set<string>();
  const load = (c.loadout ?? []).filter((t) => known.has(t) && !seen.has(t) && seen.add(t));
  for (const t of gained) {
    if (load.length >= MAX_ACTIVE_MOVES) break;
    if (!seen.has(t)) {
      load.push(t);
      seen.add(t);
    }
  }
  c.loadout = load.slice(0, MAX_ACTIVE_MOVES);
  return gained;
}

export function statsAt(s: Species, level: number): Stats {
  const n = Math.max(0, level - 1);
  return {
    hp: Math.round(s.base.hp + s.growth.hp * n),
    mp: Math.round(s.base.mp + s.growth.mp * n),
    off: Math.round(s.base.off + s.growth.off * n),
    def: Math.round(s.base.def + s.growth.def * n),
    spd: Math.round(s.base.spd + s.growth.spd * n),
    mag: Math.round(s.base.mag + s.growth.mag * n),
    res: Math.round(s.base.res + s.growth.res * n),
  };
}

export function makeCreature(speciesId: string, level: number, nickname?: string): CreatureInstance {
  const s = species(speciesId);
  const st = statsAt(s, level);
  const known = movesKnownAt(s, level);
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
    mag: st.mag,
    res: st.res,
    xp: 0,
    techniques: known.slice(),
    loadout: known.slice(0, MAX_ACTIVE_MOVES),
    equip: {},
    guarding: false,
    communable: s.communable ?? false,
  };
}

export const isDown = (c: CreatureInstance): boolean => c.hp <= 0;
export const isUp = (c: CreatureInstance): boolean => c.hp > 0;

/** Sum of a stat's bonuses from the creature's three equipment slots. */
export function equipBonus(c: CreatureInstance, key: 'off' | 'def' | 'spd' | 'mag' | 'res'): number {
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
export const effMag = (c: CreatureInstance): number => c.mag + equipBonus(c, 'mag');
export const effRes = (c: CreatureInstance): number => c.res + equipBonus(c, 'res');

/** True if any equipped item carries the given battle-special effect. */
export function hasEquipEffect(c: CreatureInstance, effect: string): boolean {
  const e = c.equip;
  if (!e) return false;
  return [e.arms, e.shroud, e.memento].some((id) => id && equipment(id).effect === effect);
}

/** EXP needed to advance from `level` to the next. A gentle super-linear curve. */
export function xpToNext(level: number): number {
  return Math.round(12 * level ** 1.5);
}

/**
 * EXP a single defeated enemy yields to one party monster, scaled by the level
 * gap: a lower-level monster earns more, a higher-level one earns less. Each
 * monster is scored independently against the enemy it helped defeat.
 */
export function xpFromEnemy(monsterLevel: number, enemyLevel: number): number {
  const base = enemyLevel * 8;
  const scale = Math.min(4, Math.max(0.25, 2 ** ((enemyLevel - monsterLevel) / 3)));
  return Math.max(1, Math.round(base * scale));
}

/**
 * Grants EXP to one creature, applying any level-ups. Stats are recomputed from
 * the species growth curve; every level gained **fully restores HP and MP** —
 * topping off a hurt soul and reviving a fainted one. Level-ups happen
 * post-battle (see `BattleScene`), so this reads as the reward it is.
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
    c.maxHp = st.hp;
    c.maxMp = st.mp;
    c.hp = c.maxHp; // a level-up fully restores the soul…
    c.mp = c.maxMp; // …HP and MP both topped off (a fainted one revives)
    c.off = st.off;
    c.def = st.def;
    c.spd = st.spd;
    c.mag = st.mag;
    c.res = st.res;
    leveled = true;
  }
  // Teach any moves whose learn level the creature crossed this grant. syncMoves
  // folds them into the known pool and auto-fills free loadout slots, so a new
  // move is battle-ready unless the 5-slot loadout is already full.
  if (leveled) syncMoves(c);
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
