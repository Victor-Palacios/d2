import type { ElementId } from './elements';

/**
 * Techniques (plan §5.2). Every creature starts with one signature technique;
 * `power` feeds the damage formula in `systems/battle/formula.ts`.
 */

export type TechniqueKind = 'damage' | 'heal';

/**
 * Area shape on the 2×3 formation grid (grid battle, Phase B):
 * - `single` (default): one target.
 * - `row`: the target plus every foe sharing its row (a rank sweep).
 * - `column`: the target plus every foe sharing its column (a file pierce).
 * - `all`: the whole opposing side.
 */
export type TechniqueShape = 'single' | 'row' | 'column' | 'all';

export interface Technique {
  id: string;
  name: string;
  kind: TechniqueKind;
  mpCost: number;
  power: number;
  element: ElementId;
  /** Legacy flag, equivalent to `shape: 'all'`. */
  aoe?: boolean;
  /** Area shape; defaults to `single` (or `all` when `aoe` is set). */
  shape?: TechniqueShape;
  /**
   * Melee (a close-in physical blow) vs ranged/Ether (the default). Melee gets
   * the Vanguard/Rear row damage modifiers and, crucially, is stopped by cover:
   * it cannot reach a Rear foe shielded by a living Vanguard ally. Ranged/Ether
   * ignores both. This is the front/back trade-off's teeth — see
   * `isMeleeTechnique` in `systems/battle/engine.ts`.
   */
  melee?: boolean;
  desc: string;
}

/** Resolves a technique's effective shape, honouring the legacy `aoe` flag. */
export function techShape(t: Technique): TechniqueShape {
  return t.shape ?? (t.aoe ? 'all' : 'single');
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
    melee: true,
    desc: 'A plain physical hit. Costs no MP. Melee — reaches only the front line.',
  },

  emberFang: {
    id: 'emberFang',
    name: 'Ember Fang',
    kind: 'damage',
    mpCost: 6,
    power: 46,
    element: 'fire',
    melee: true,
    desc: 'Bites with superheated jaws. Melee — reaches only the front line.',
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
  emberWave: {
    id: 'emberWave',
    name: 'Ember Wave',
    kind: 'damage',
    mpCost: 10,
    power: 40,
    element: 'fire',
    shape: 'row',
    desc: 'A sheet of flame that sweeps a whole rank.',
  },
  boltPierce: {
    id: 'boltPierce',
    name: 'Bolt Pierce',
    kind: 'damage',
    mpCost: 10,
    power: 40,
    element: 'machine',
    shape: 'column',
    desc: 'A lance of current that punches down a file.',
  },
  tidalSlap: {
    id: 'tidalSlap',
    name: 'Tidal Slap',
    kind: 'damage',
    mpCost: 6,
    power: 44,
    element: 'water',
    melee: true,
    desc: 'A heavy slap of pressurised data-water. Melee — reaches only the front line.',
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
    melee: true,
    desc: 'Overclocks its frame into a charge. Melee — reaches only the front line.',
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
  // --- Crystal Cavern -----------------------------------------------------
  frostLance: {
    id: 'frostLance',
    name: 'Frost Lance',
    kind: 'damage',
    mpCost: 7,
    power: 47,
    element: 'water',
    desc: 'A spear of supercooled data-ice.',
  },
  prismStorm: {
    id: 'prismStorm',
    name: 'Prism Storm',
    kind: 'damage',
    mpCost: 16,
    power: 37,
    element: 'water',
    aoe: true,
    desc: 'Refracted light shreds the whole formation.',
  },
  quakeCore: {
    id: 'quakeCore',
    name: 'Quake Core',
    kind: 'damage',
    mpCost: 9,
    power: 53,
    element: 'machine',
    melee: true,
    desc: 'Overloads its core into a grinding slam. Melee — reaches only the front line.',
  },

  // --- Haunted Dungeon ----------------------------------------------------
  hexBolt: {
    id: 'hexBolt',
    name: 'Hex Bolt',
    kind: 'damage',
    mpCost: 7,
    power: 48,
    element: 'dark',
    desc: 'A bolt of corrupted, whispering code.',
  },
  graveRot: {
    id: 'graveRot',
    name: 'Grave Rot',
    kind: 'damage',
    mpCost: 8,
    power: 46,
    element: 'nature',
    desc: 'Creeping decay that eats through armour.',
  },
  dirge: {
    id: 'dirge',
    name: 'Dirge',
    kind: 'damage',
    mpCost: 17,
    power: 38,
    element: 'dark',
    aoe: true,
    desc: 'A mourning wail that rolls over every foe.',
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
    melee: true,
    desc: 'A blazing single-target rake. Melee — reaches only the front line.',
  },
};

export function technique(id: string): Technique {
  const t = TECHNIQUES[id];
  if (!t) throw new Error(`Unknown technique: ${id}`);
  return t;
}
