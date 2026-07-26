/**
 * Attributes and elements (plan §5.1). All values are starting placeholders —
 * they are meant to be tuned for feel, not to match any published table.
 */

export type AttributeId = 'alpha' | 'beta' | 'gamma';

export interface AttributeDef {
  id: AttributeId;
  name: string;
  /** Attribute this one beats. */
  beats: AttributeId;
  color: string;
  blurb: string;
}

/** Alpha > Gamma > Beta > Alpha. */
export const ATTRIBUTES: Record<AttributeId, AttributeDef> = {
  alpha: { id: 'alpha', name: 'Alpha', beats: 'gamma', color: '#ffd166', blurb: 'Ordered code. Strong against Gamma.' },
  beta: { id: 'beta', name: 'Beta', beats: 'alpha', color: '#6fb7ff', blurb: 'Adaptive code. Strong against Alpha.' },
  gamma: { id: 'gamma', name: 'Gamma', beats: 'beta', color: '#c77dff', blurb: 'Corrupt code. Strong against Beta.' },
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
