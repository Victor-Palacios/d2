import type { AttributeId, ElementId } from './elements';
import { CREATURES as CREATURE_ART } from '../assets/art';
import type { PixelArt } from '../engine/pixel';

/**
 * Placeholder creature roster (plan §0.2, §5).
 *
 * Names and designs are original programmer-art stand-ins. Anything the game
 * needs to know about a creature lives here, so swapping in a different
 * (licensed) roster is a data edit rather than a code change.
 */

export interface Stats {
  hp: number;
  mp: number;
  off: number;
  def: number;
  spd: number;
}

export interface Species {
  id: string;
  name: string;
  attribute: AttributeId;
  element: ElementId;
  /** Key into `assets/art.ts` CREATURES. */
  art: string;
  /** Billboard height in world units. */
  height: number;
  /** Floats above the ground (dark wisps and the like). */
  hover?: number;
  base: Stats;
  growth: Stats;
  techniques: string[];
  /**
   * Merge/evolution stub (plan §5.6) — the data model carries it so the feature
   * can be built later; no UI reads it yet.
   */
  canDigivolveTo?: string[];
  blurb: string;
}

const ROOKIE_GROWTH: Stats = { hp: 6, mp: 2, off: 2.2, def: 1.9, spd: 1.6 };

export const SPECIES: Record<string, Species> = {
  emberling: {
    id: 'emberling',
    name: 'Emberling',
    attribute: 'hero',
    element: 'fire',
    art: 'lizard',
    height: 1.35,
    base: { hp: 44, mp: 18, off: 15, def: 12, spd: 13 },
    growth: ROOKIE_GROWTH,
    techniques: ['emberFang', 'cinderBurst', 'emberWave'],
    canDigivolveTo: ['regalion'],
    blurb: 'A hot-tempered lizard rookie. Runs its core far too warm.',
  },
  glidefang: {
    id: 'glidefang',
    name: 'Glidefang',
    attribute: 'mage',
    element: 'water',
    art: 'wing',
    height: 1.3,
    hover: 0.18,
    base: { hp: 42, mp: 22, off: 14, def: 11, spd: 16 },
    growth: { ...ROOKIE_GROWTH, spd: 2 },
    techniques: ['gustWing', 'mistVeil'],
    blurb: 'A winged rookie that rides thermals in the data streams.',
  },
  nightnip: {
    id: 'nightnip',
    name: 'Nightnip',
    attribute: 'assassin',
    element: 'dark',
    art: 'bat',
    height: 1.3,
    hover: 0.22,
    base: { hp: 40, mp: 24, off: 17, def: 10, spd: 15 },
    growth: { ...ROOKIE_GROWTH, off: 2.5 },
    techniques: ['gloomLance', 'nightSpiral'],
    blurb: 'An impish rookie. Bites first, parses the packet later.',
  },
  sprigling: {
    id: 'sprigling',
    name: 'Sprigling',
    attribute: 'hero',
    element: 'nature',
    art: 'plant',
    height: 1.25,
    base: { hp: 48, mp: 20, off: 13, def: 15, spd: 9 },
    growth: { ...ROOKIE_GROWTH, def: 2.2 },
    techniques: ['seedVolley', 'bloomPulse'],
    blurb: 'Roots itself into any surface it can find.',
  },
  cogling: {
    id: 'cogling',
    name: 'Cogling',
    attribute: 'hero',
    element: 'machine',
    art: 'bot',
    height: 1.3,
    base: { hp: 46, mp: 16, off: 15, def: 16, spd: 10 },
    growth: { ...ROOKIE_GROWTH, def: 2.2 },
    techniques: ['boltDrive', 'boltPierce'],
    blurb: 'Maintenance unit. Technically still under warranty.',
  },
  dropletta: {
    id: 'dropletta',
    name: 'Dropletta',
    attribute: 'mage',
    element: 'water',
    art: 'slime',
    height: 1.15,
    base: { hp: 50, mp: 24, off: 12, def: 14, spd: 11 },
    growth: ROOKIE_GROWTH,
    techniques: ['tidalSlap', 'mistVeil'],
    blurb: 'Mostly buffer. Surprisingly hard to delete.',
  },
  gloomote: {
    id: 'gloomote',
    name: 'Gloomote',
    attribute: 'mage',
    element: 'dark',
    art: 'wisp',
    height: 1.25,
    hover: 0.35,
    base: { hp: 41, mp: 26, off: 16, def: 11, spd: 14 },
    growth: { ...ROOKIE_GROWTH, mp: 2.6 },
    techniques: ['gloomLance', 'nightSpiral'],
    blurb: 'A drifting fragment of unrecovered memory.',
  },
  bulwarq: {
    id: 'bulwarq',
    name: 'Bulwarq',
    attribute: 'hero',
    element: 'machine',
    art: 'knight',
    height: 1.5,
    base: { hp: 54, mp: 16, off: 16, def: 18, spd: 9 },
    growth: { ...ROOKIE_GROWTH, hp: 7, def: 2.3 },
    techniques: ['ironHowl', 'boltDrive'],
    blurb: 'Firewall unit. Built to stand in the doorway.',
  },
  fenrix: {
    id: 'fenrix',
    name: 'Fenrix',
    attribute: 'assassin',
    element: 'nature',
    art: 'wolf',
    height: 1.4,
    base: { hp: 48, mp: 18, off: 18, def: 13, spd: 17 },
    growth: { ...ROOKIE_GROWTH, off: 2.5, spd: 2 },
    techniques: ['seedVolley', 'ironHowl'],
    blurb: 'A pack-hunter routine that never got shut down.',
  },
  mitebug: {
    id: 'mitebug',
    name: 'Mitebug',
    attribute: 'assassin',
    element: 'nature',
    art: 'bug',
    height: 1.0,
    base: { hp: 34, mp: 10, off: 12, def: 9, spd: 12 },
    growth: { ...ROOKIE_GROWTH, hp: 5, off: 1.8 },
    techniques: ['seedVolley'],
    blurb: 'Chews through unattended memory blocks.',
  },
  scrapmite: {
    id: 'scrapmite',
    name: 'Scrapmite',
    attribute: 'hero',
    element: 'machine',
    art: 'scrap',
    height: 1.05,
    base: { hp: 38, mp: 12, off: 11, def: 12, spd: 10 },
    growth: { ...ROOKIE_GROWTH, hp: 5, off: 1.8 },
    techniques: ['scrapShot'],
    blurb: 'A salvage drone that forgot what it was salvaging.',
  },

  // --- Crystal Cavern -----------------------------------------------------
  shardling: {
    id: 'shardling',
    name: 'Shardling',
    attribute: 'mage',
    element: 'water',
    art: 'crystalSlime',
    height: 1.2,
    base: { hp: 46, mp: 22, off: 14, def: 13, spd: 12 },
    growth: ROOKIE_GROWTH,
    techniques: ['frostLance', 'mistVeil'],
    blurb: 'A gem-slime that refracts every packet that hits it.',
  },
  prismoth: {
    id: 'prismoth',
    name: 'Prismoth',
    attribute: 'assassin',
    element: 'water',
    art: 'prismMoth',
    height: 1.3,
    hover: 0.3,
    base: { hp: 42, mp: 20, off: 17, def: 11, spd: 18 },
    growth: { ...ROOKIE_GROWTH, spd: 2.2 },
    techniques: ['frostLance', 'prismStorm'],
    blurb: 'Wings split the light into blades before it strikes.',
  },
  geodon: {
    id: 'geodon',
    name: 'Geodon',
    attribute: 'hero',
    element: 'machine',
    art: 'geodeGolem',
    height: 1.45,
    base: { hp: 58, mp: 16, off: 16, def: 20, spd: 8 },
    growth: { ...ROOKIE_GROWTH, hp: 7, def: 2.3 },
    techniques: ['quakeCore', 'ironHowl'],
    blurb: 'A geode that grew a temper around its glowing core.',
  },

  // --- Haunted Dungeon ----------------------------------------------------
  wispling: {
    id: 'wispling',
    name: 'Wispling',
    attribute: 'mage',
    element: 'dark',
    art: 'wraithWisp',
    height: 1.25,
    hover: 0.35,
    base: { hp: 44, mp: 28, off: 17, def: 11, spd: 15 },
    growth: { ...ROOKIE_GROWTH, mp: 2.6 },
    techniques: ['hexBolt', 'nightSpiral'],
    blurb: 'A frightened process that never finished terminating.',
  },
  gravemaw: {
    id: 'gravemaw',
    name: 'Gravemaw',
    attribute: 'assassin',
    element: 'nature',
    art: 'graveCrawler',
    height: 1.1,
    base: { hp: 50, mp: 16, off: 18, def: 14, spd: 14 },
    growth: { ...ROOKIE_GROWTH, off: 2.4 },
    techniques: ['graveRot', 'gustWing'],
    blurb: 'Eats whatever the domain leaves rotting in the dark.',
  },
  cryptguard: {
    id: 'cryptguard',
    name: 'Cryptguard',
    attribute: 'hero',
    element: 'dark',
    art: 'cursedArmor',
    height: 1.5,
    base: { hp: 60, mp: 18, off: 17, def: 22, spd: 9 },
    growth: { ...ROOKIE_GROWTH, hp: 7, def: 2.4 },
    techniques: ['hexBolt', 'ironHowl'],
    blurb: 'An empty suit still running its last standing order.',
  },

  // --- bosses -------------------------------------------------------------
  glaciark: {
    id: 'glaciark',
    name: 'Glaciark',
    attribute: 'hero',
    element: 'water',
    art: 'crystalWarden',
    height: 2.3,
    base: { hp: 90, mp: 44, off: 18, def: 24, spd: 13 },
    growth: { hp: 10, mp: 3, off: 2.3, def: 2.1, spd: 1.4 },
    techniques: ['prismStorm', 'frostLance'],
    blurb: 'Warden of the Crystal Cavern. It has never felt warmth.',
  },
  revenance: {
    id: 'revenance',
    name: 'Revenance',
    attribute: 'mage',
    element: 'dark',
    art: 'revenant',
    height: 2.4,
    hover: 0.2,
    base: { hp: 100, mp: 50, off: 20, def: 22, spd: 16 },
    growth: { hp: 11, mp: 3.4, off: 2.4, def: 2, spd: 1.6 },
    techniques: ['dirge', 'hexBolt'],
    blurb: 'Warden of the Haunted Dungeon. It remembers being deleted.',
  },

  // --- boss ---------------------------------------------------------------
  regalion: {
    id: 'regalion',
    name: 'Regalion',
    attribute: 'hero',
    element: 'fire',
    art: 'lion',
    height: 2.2,
    base: { hp: 78, mp: 40, off: 16, def: 22, spd: 14 },
    growth: { hp: 9, mp: 3, off: 2.2, def: 2, spd: 1.4 },
    techniques: ['sunClaw', 'regalRoar'],
    blurb: 'Warden of the Quiet Crossing. It does not consider you a threat.',
  },
};

export function species(id: string): Species {
  const s = SPECIES[id];
  if (!s) throw new Error(`Unknown species: ${id}`);
  return s;
}

export function speciesArt(id: string): PixelArt {
  const s = species(id);
  const art = CREATURE_ART[s.art];
  if (!art) throw new Error(`Missing art for species ${id} (art key: ${s.art})`);
  return art;
}
