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
  /** Magick bonus. */
  mag?: number;
  /** Resolve (magical defence) bonus. */
  res?: number;
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
    desc: "A blade that kept a little of its owner's warmth. +6 OFF.",
  },
  focusReliquary: {
    id: 'focusReliquary',
    name: 'Focus Reliquary',
    slot: 'arms',
    mag: 6,
    desc: 'A relic that still hums with the thoughts poured into it. +6 MAG.',
  },
  // --- Shrouds ------------------------------------------------------------
  paleShroud: {
    id: 'paleShroud',
    name: 'Pale Shroud',
    slot: 'shroud',
    def: 6,
    desc: 'Linen that outlasted the one it covered. +6 DEF.',
  },
  wardingVeil: {
    id: 'wardingVeil',
    name: 'Warding Veil',
    slot: 'shroud',
    res: 6,
    desc: 'A veil stitched with quieting sigils. +6 RES.',
  },
  // --- Mementos -----------------------------------------------------------
  quickLocket: {
    id: 'quickLocket',
    name: 'Quick Locket',
    slot: 'memento',
    spd: 4,
    desc: 'A locket whose small heart still ticks. +4 SPD.',
  },
  lioraStep: {
    id: 'lioraStep',
    name: "Liora's Step",
    slot: 'memento',
    spd: 5,
    desc: 'A worn charm from a woman who forgot how to walk away. Carried so its bearer never does. +5 SPD.',
  },
  immortalityMemento: {
    id: 'immortalityMemento',
    name: 'Immortality',
    slot: 'memento',
    effect: 'crit',
    desc: "A whole life, remembered. The wearer lands only criticals for a battle's first three rounds.",
  },
  haldensSerial: {
    id: 'haldensSerial',
    name: "Halden's Serial",
    slot: 'memento',
    def: 5,
    desc: 'A dog-eared detective pulp, its last chapter unread. The comfort of an unfinished story. +5 DEF.',
  },
  // --- Anchored rewards ---------------------------------------------------
  // One Memento per Anchored, kept from the feeling it finally let go of. Each
  // is stronger than the ordinary mementos — the Anchored are optional, tough,
  // and meant to be worth the return trip (see src/data/anchored.ts).
  emberVigil: {
    id: 'emberVigil',
    name: 'Ember Vigil',
    slot: 'memento',
    off: 8,
    spd: 3,
    desc: "A coal from the Unquenched that will not cool. Its bearer strikes with the last of another soul's anger. +8 OFF, +3 SPD.",
  },
  stillTears: {
    id: 'stillTears',
    name: 'Still Tears',
    slot: 'memento',
    res: 8,
    mag: 4,
    desc: "A bead of the Unweeping's ice, thawed at last into a single drop. The grief it held now shields whoever carries it. +8 RES, +4 MAG.",
  },
  longRoot: {
    id: 'longRoot',
    name: 'Long Root',
    slot: 'memento',
    def: 8,
    off: 3,
    desc: 'A tendril of the Unyielding, still trying to hold on. Turned outward, its refusal to let go becomes a refusal to fall. +8 DEF, +3 OFF.',
  },
  seenAtLast: {
    id: 'seenAtLast',
    name: 'Seen At Last',
    slot: 'memento',
    mag: 8,
    spd: 3,
    desc: 'A sliver of the Unwitnessed, quieted by being looked at. It lends its bearer the certainty of not being alone. +8 MAG, +3 SPD.',
  },
};

export function equipment(id: string): Equipment {
  const e = EQUIPMENT[id];
  if (!e) throw new Error(`Unknown equipment: ${id}`);
  return e;
}

export const isEquipment = (id: string): boolean => id in EQUIPMENT;
