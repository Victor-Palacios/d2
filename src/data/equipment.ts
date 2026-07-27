/**
 * Equipment (grid battle / death theme). Three slots per soul, framed as
 * intimacy rather than loot (see docs/NARRATIVE.md §7):
 * - **Arms** — what a soul carried in life.
 * - **Shrouds** — what covered them after.
 * - **Mementos** — what the living kept of them.
 *
 * A creature has at most one of each. Bonuses are flat stat adds; a `effect`
 * marks a battle-special (resolved in the battle model, e.g. the Immortality
 * Memento's guaranteed criticals).
 */
export type EquipSlot = 'arms' | 'shroud' | 'memento';

export interface Equipment {
  id: string;
  name: string;
  slot: EquipSlot;
  off?: number;
  def?: number;
  spd?: number;
  /** Battle-special hook id, resolved by the battle model. */
  effect?: string;
  desc: string;
}

export const EQUIPMENT: Record<string, Equipment> = {
  // --- Arms ---------------------------------------------------------------
  cinderEdge: {
    id: 'cinderEdge',
    name: 'Cinder Edge',
    slot: 'arms',
    off: 6,
    desc: 'A blade that kept a little of its owner\'s warmth. +6 OFF.',
  },
  // --- Shrouds ------------------------------------------------------------
  paleShroud: {
    id: 'paleShroud',
    name: 'Pale Shroud',
    slot: 'shroud',
    def: 6,
    desc: 'Linen that outlasted the one it covered. +6 DEF.',
  },
  // --- Mementos -----------------------------------------------------------
  quickLocket: {
    id: 'quickLocket',
    name: 'Quick Locket',
    slot: 'memento',
    spd: 4,
    desc: 'A locket whose small heart still ticks. +4 SPD.',
  },
  immortalityMemento: {
    id: 'immortalityMemento',
    name: 'Immortality',
    slot: 'memento',
    effect: 'crit',
    desc: 'A whole life, remembered. The wearer lands only criticals for a battle\'s first three rounds.',
  },
  haldensSerial: {
    id: 'haldensSerial',
    name: "Halden's Serial",
    slot: 'memento',
    def: 5,
    desc: 'A dog-eared detective pulp, its last chapter unread. The comfort of an unfinished story. +5 DEF.',
  },
};

export function equipment(id: string): Equipment {
  const e = EQUIPMENT[id];
  if (!e) throw new Error(`Unknown equipment: ${id}`);
  return e;
}

export const isEquipment = (id: string): boolean => id in EQUIPMENT;
