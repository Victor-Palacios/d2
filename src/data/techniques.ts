import type { ElementId } from './elements';

/**
 * Techniques (plan §5.2). Every creature starts with one signature technique;
 * `power` feeds the damage formula in `systems/battle/formula.ts`.
 */

export type TechniqueKind = 'damage' | 'heal';

export interface Technique {
  id: string;
  name: string;
  kind: TechniqueKind;
  mpCost: number;
  power: number;
  element: ElementId;
  /** Hits every living target on the opposing side. */
  aoe?: boolean;
  desc: string;
}

export const TECHNIQUES: Record<string, Technique> = {
  // Basic action every creature has for free.
  strike: {
    id: 'strike',
    name: 'Strike',
    kind: 'damage',
    mpCost: 0,
    power: 30,
    element: 'machine',
    desc: 'A plain physical hit. Costs no MP.',
  },

  emberFang: {
    id: 'emberFang',
    name: 'Ember Fang',
    kind: 'damage',
    mpCost: 6,
    power: 46,
    element: 'fire',
    desc: 'Bites with superheated jaws.',
  },
  cinderBurst: {
    id: 'cinderBurst',
    name: 'Cinder Burst',
    kind: 'damage',
    mpCost: 14,
    power: 34,
    element: 'fire',
    aoe: true,
    desc: 'Scatters embers across every foe.',
  },
  tidalSlap: {
    id: 'tidalSlap',
    name: 'Tidal Slap',
    kind: 'damage',
    mpCost: 6,
    power: 44,
    element: 'water',
    desc: 'A heavy slap of pressurised data-water.',
  },
  mistVeil: {
    id: 'mistVeil',
    name: 'Mist Veil',
    kind: 'heal',
    mpCost: 10,
    power: 42,
    element: 'water',
    desc: 'Condensing mist repairs an ally.',
  },
  seedVolley: {
    id: 'seedVolley',
    name: 'Seed Volley',
    kind: 'damage',
    mpCost: 7,
    power: 45,
    element: 'nature',
    desc: 'Fires a burst of hardened seeds.',
  },
  bloomPulse: {
    id: 'bloomPulse',
    name: 'Bloom Pulse',
    kind: 'heal',
    mpCost: 12,
    power: 50,
    element: 'nature',
    desc: 'Restores an ally with growth code.',
  },
  boltDrive: {
    id: 'boltDrive',
    name: 'Bolt Drive',
    kind: 'damage',
    mpCost: 8,
    power: 48,
    element: 'machine',
    desc: 'Overclocks its frame into a charge.',
  },
  scrapShot: {
    id: 'scrapShot',
    name: 'Scrap Shot',
    kind: 'damage',
    mpCost: 5,
    power: 38,
    element: 'machine',
    desc: 'Spits a slug of scrap metal.',
  },
  gloomLance: {
    id: 'gloomLance',
    name: 'Gloom Lance',
    kind: 'damage',
    mpCost: 8,
    power: 50,
    element: 'dark',
    desc: 'Impales with a spike of corrupt code.',
  },
  nightSpiral: {
    id: 'nightSpiral',
    name: 'Night Spiral',
    kind: 'damage',
    mpCost: 16,
    power: 36,
    element: 'dark',
    aoe: true,
    desc: 'A widening spiral of darkness.',
  },
  gustWing: {
    id: 'gustWing',
    name: 'Gust Wing',
    kind: 'damage',
    mpCost: 6,
    power: 43,
    element: 'nature',
    desc: 'A downbeat that shreds the air.',
  },
  ironHowl: {
    id: 'ironHowl',
    name: 'Iron Howl',
    kind: 'damage',
    mpCost: 9,
    power: 52,
    element: 'machine',
    desc: 'A howl that rattles armour plating.',
  },
  // Boss
  regalRoar: {
    id: 'regalRoar',
    name: 'Regal Roar',
    kind: 'damage',
    mpCost: 18,
    power: 40,
    element: 'fire',
    aoe: true,
    desc: 'A roar that scorches the whole arena.',
  },
  sunClaw: {
    id: 'sunClaw',
    name: 'Sun Claw',
    kind: 'damage',
    mpCost: 10,
    power: 62,
    element: 'fire',
    desc: 'A blazing single-target rake.',
  },
};

export function technique(id: string): Technique {
  const t = TECHNIQUES[id];
  if (!t) throw new Error(`Unknown technique: ${id}`);
  return t;
}
