/**
 * Attributes and elements (plan §5.1). The numbers here are balance values,
 * tuned for feel rather than to match any published table — adjust them by
 * playtest, not by looking one up.
 */

export type AttributeId = 'assassin' | 'mage' | 'hero';

export interface AttributeDef {
  id: AttributeId;
  name: string;
  /** Attribute this one beats. */
  beats: AttributeId;
  color: string;
  blurb: string;
}

/**
 * The class triangle: **Assassin > Mage > Hero > Assassin**.
 *
 * Read it as: an Assassin gets past a Mage before the spell lands, a Mage
 * outranges a Hero's blade, and a Hero's armour shrugs off an Assassin.
 */
export const ATTRIBUTES: Record<AttributeId, AttributeDef> = {
  assassin: {
    id: 'assassin',
    name: 'Assassin',
    beats: 'mage',
    color: '#c77dff',
    blurb: 'Strikes before the spell lands. Strong against Mage.',
  },
  mage: {
    id: 'mage',
    name: 'Mage',
    beats: 'hero',
    color: '#6fb7ff',
    blurb: 'Outranges the blade. Strong against Hero.',
  },
  hero: {
    id: 'hero',
    name: 'Hero',
    beats: 'assassin',
    color: '#ffd166',
    blurb: 'Armour turns the knife. Strong against Assassin.',
  },
};

/** Damage multiplier for an attacker attribute against a defender attribute. */
export const ATTRIBUTE_ADVANTAGE = 1.25;
export const ATTRIBUTE_DISADVANTAGE = 0.8;

export function attributeMultiplier(attacker: AttributeId, defender: AttributeId): number {
  if (attacker === defender) return 1;
  if (ATTRIBUTES[attacker].beats === defender) return ATTRIBUTE_ADVANTAGE;
  if (ATTRIBUTES[defender].beats === attacker) return ATTRIBUTE_DISADVANTAGE;
  return 1;
}

export type ElementId = 'water' | 'fire' | 'nature' | 'machine' | 'dark';

export interface ElementDef {
  id: ElementId;
  name: string;
  /** Emissive colour for floor tiles, FX and UI chips. */
  color: string;
  light: number;
}

export const ELEMENTS: Record<ElementId, ElementDef> = {
  water: { id: 'water', name: 'Water', color: '#4ad6ff', light: 0x4ad6ff },
  fire: { id: 'fire', name: 'Fire', color: '#ff8a3d', light: 0xff8a3d },
  nature: { id: 'nature', name: 'Nature', color: '#7bdc8a', light: 0x7bdc8a },
  machine: { id: 'machine', name: 'Machine', color: '#c9d4e8', light: 0xc9d4e8 },
  dark: { id: 'dark', name: 'Dark', color: '#c77dff', light: 0xc77dff },
};

/** Standing on a matching element tile buffs offence and defence. */
export const ELEMENT_TILE_BONUS = 1.2;
