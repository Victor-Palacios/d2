import type { ElementId } from './elements';

/**
 * Techniques (plan §5.2). Every creature starts with one signature technique;
 * `power` feeds the damage formula in `systems/battle/formula.ts`.
 */

export type TechniqueKind = 'damage' | 'heal';

/**
 * Damage/heal channel (plan §5.2, magick pass).
 * - `physical` scales on the attacker's **Offense** vs the defender's **Defense**.
 * - `magical` scales on the attacker's **Magick** vs the defender's **Resolve**.
 *
 * Heals are always `magical` — mending is a spell, so it rides Magick. Keeping
 * the split on the technique (not the creature) lets one creature carry both a
 * physical bite and a magical bolt and have each read the right stat pair.
 */
export type TechniqueCategory = 'physical' | 'magical';

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
  /** Physical (Off/Def) vs magical (Mag/Res). Defaults to physical when unset. */
  category?: TechniqueCategory;
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

/** Resolves a technique's damage channel (heals always ride Magick). */
export function techCategory(t: Technique): TechniqueCategory {
  if (t.kind === 'heal') return 'magical';
  return t.category ?? 'physical';
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
    category: 'magical',
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
    category: 'magical',
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
    category: 'magical',
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
    desc: 'A heavy slap of pressurised black water. Melee — reaches only the front line.',
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
    category: 'magical',
    mpCost: 8,
    power: 50,
    element: 'dark',
    desc: 'Impales with a spike of cold dark.',
  },
  nightSpiral: {
    id: 'nightSpiral',
    name: 'Night Spiral',
    kind: 'damage',
    category: 'magical',
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
    category: 'magical',
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
    category: 'magical',
    mpCost: 7,
    power: 47,
    element: 'water',
    desc: 'A spear of supercooled ice.',
  },
  prismStorm: {
    id: 'prismStorm',
    name: 'Prism Storm',
    kind: 'damage',
    category: 'magical',
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
    category: 'magical',
    mpCost: 7,
    power: 48,
    element: 'dark',
    desc: 'A bolt of whispering dark.',
  },
  graveRot: {
    id: 'graveRot',
    name: 'Grave Rot',
    kind: 'damage',
    category: 'magical',
    mpCost: 8,
    power: 46,
    element: 'nature',
    desc: 'Creeping decay that eats through armour.',
  },
  dirge: {
    id: 'dirge',
    name: 'Dirge',
    kind: 'damage',
    category: 'magical',
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
    category: 'magical',
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

  // --- Advanced / capstone techniques (learnset payoffs) ------------------
  // Single-target finishers: high power, mid MP. Physical ones ride Offense,
  // magical ones ride Magick — one per element/channel so every line has a
  // late-game hit that scales with its role's damage stat.
  emberRend: {
    id: 'emberRend',
    name: 'Ember Rend',
    kind: 'damage',
    mpCost: 12,
    power: 60,
    element: 'fire',
    desc: 'A searing claw that opens a wound the heat keeps burning.',
  },
  pyreLance: {
    id: 'pyreLance',
    name: 'Pyre Lance',
    kind: 'damage',
    category: 'magical',
    mpCost: 13,
    power: 60,
    element: 'fire',
    desc: 'A javelin of white fire loosed from range.',
  },
  tidalCrash: {
    id: 'tidalCrash',
    name: 'Tidal Crash',
    kind: 'damage',
    mpCost: 12,
    power: 60,
    element: 'water',
    desc: 'Brings a wall of water down on a single foe.',
  },
  glacierSpire: {
    id: 'glacierSpire',
    name: 'Glacier Spire',
    kind: 'damage',
    category: 'magical',
    mpCost: 13,
    power: 60,
    element: 'water',
    desc: 'Impales with a spear of grown ice.',
  },
  savageBite: {
    id: 'savageBite',
    name: 'Savage Bite',
    kind: 'damage',
    mpCost: 12,
    power: 60,
    element: 'nature',
    desc: "A predator's jaws close with the whole body behind them.",
  },
  thornspell: {
    id: 'thornspell',
    name: 'Thornspell',
    kind: 'damage',
    category: 'magical',
    mpCost: 13,
    power: 58,
    element: 'nature',
    desc: 'Conjured briars erupt through a single target.',
  },
  rendingStrike: {
    id: 'rendingStrike',
    name: 'Rending Strike',
    kind: 'damage',
    mpCost: 12,
    power: 62,
    element: 'machine',
    desc: 'A servo-driven blow that shears through plating.',
  },
  railvolt: {
    id: 'railvolt',
    name: 'Railvolt',
    kind: 'damage',
    category: 'magical',
    mpCost: 13,
    power: 60,
    element: 'machine',
    desc: 'A rail-accelerated arc of charge.',
  },
  shadowRend: {
    id: 'shadowRend',
    name: 'Shadow Rend',
    kind: 'damage',
    mpCost: 12,
    power: 60,
    element: 'dark',
    desc: 'Claws sheathed in nothing tear a clean line.',
  },
  abyssalBolt: {
    id: 'abyssalBolt',
    name: 'Abyssal Bolt',
    kind: 'damage',
    category: 'magical',
    mpCost: 13,
    power: 62,
    element: 'dark',
    desc: 'A bolt drawn from the space between the living and the dead.',
  },

  // Big-MP area finishers: the payoff for a deep MP pool (so MP is a real
  // resource, not a rounding error). All magical.
  infernoCore: {
    id: 'infernoCore',
    name: 'Inferno Core',
    kind: 'damage',
    category: 'magical',
    mpCost: 22,
    power: 42,
    element: 'fire',
    aoe: true,
    desc: 'Detonates its own heat-core across the whole formation.',
  },
  maelstrom: {
    id: 'maelstrom',
    name: 'Maelstrom',
    kind: 'damage',
    category: 'magical',
    mpCost: 22,
    power: 42,
    element: 'water',
    aoe: true,
    desc: 'A drowning spiral that pulls in every foe.',
  },
  voidNova: {
    id: 'voidNova',
    name: 'Void Nova',
    kind: 'damage',
    category: 'magical',
    mpCost: 22,
    power: 42,
    element: 'dark',
    aoe: true,
    desc: 'A silent expanding null that unwrites everything it touches.',
  },
  wildgrowth: {
    id: 'wildgrowth',
    name: 'Wildgrowth',
    kind: 'damage',
    category: 'magical',
    mpCost: 16,
    power: 46,
    element: 'nature',
    shape: 'row',
    desc: 'A wall of thorned vines rips down a whole rank.',
  },
  overload: {
    id: 'overload',
    name: 'Overload',
    kind: 'damage',
    category: 'magical',
    mpCost: 16,
    power: 46,
    element: 'machine',
    shape: 'column',
    desc: 'Dumps a full charge down a single file.',
  },

  // Tier-2 heals (magical — they ride Magick like every heal).
  renewingTide: {
    id: 'renewingTide',
    name: 'Renewing Tide',
    kind: 'heal',
    mpCost: 18,
    power: 70,
    element: 'water',
    desc: 'A rising tide of clear water mends an ally.',
  },
  lifebloom: {
    id: 'lifebloom',
    name: 'Lifebloom',
    kind: 'heal',
    mpCost: 20,
    power: 74,
    element: 'nature',
    desc: 'Bursts an ally back into flower.',
  },
};

export function technique(id: string): Technique {
  const t = TECHNIQUES[id];
  if (!t) throw new Error(`Unknown technique: ${id}`);
  return t;
}
