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
  /** Physical attack. Powers `physical` techniques. */
  off: number;
  /** Physical defence. Mitigates `physical` techniques. */
  def: number;
  spd: number;
  /** Magick — magical attack. Powers `magical` techniques and heals. */
  mag: number;
  /** Resolve — magical defence. Mitigates `magical` techniques. */
  res: number;
}

/** One entry in a species' level-up learnset (plan §5.2, moveset pass). */
export interface LearnEntry {
  /** Level at which the move becomes known. */
  level: number;
  /** Technique id (see `data/techniques.ts`). */
  tech: string;
}

/**
 * One branch of an evolution (transcendence) tree (plan §5.6).
 *
 * The system is a Pokémon × Digimon hybrid:
 * - **Level-triggered** like Pokémon — simple and predictable (`level`, usually 10).
 * - **Branching** like Digimon — a species may offer more than one form. Branches
 *   stay thematically bound to their base so identity is preserved (the main
 *   Digimon criticism is that any starter can reach any top form; here it can't).
 * - **Reversible** — every evolution can be undone (see `systems/party/evolve.ts`),
 *   the "always able to return to their cute selves" that Digimon is praised for.
 */
export interface EvolutionOption {
  /** Target species id. */
  to: string;
  /** Minimum level required to take this branch. */
  level: number;
  /** Short label shown when a species offers more than one branch. */
  branch?: string;
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
  /**
   * Level-gated moveset (levels 1–20). A creature knows every entry whose
   * `level` is ≤ its own; new entries are learned on level-up. Authored in learn
   * order so the first-known move reads as the signature.
   */
  learnset: LearnEntry[];
  /**
   * Evolution branches (plan §5.6). Empty/absent means a terminal form. A
   * creature may take any branch whose `level` it has reached.
   */
  evolutions?: EvolutionOption[];
  /**
   * A gentle, half-here soul that can be reached with words instead of blows:
   * the **Commune** battle action can pacify it (see `systems/battle/engine.ts`).
   * Copied onto the `CreatureInstance` at creation so the headless engine never
   * has to import this table.
   */
  communable?: boolean;
  blurb: string;
}

/** Techniques a species knows at a given level, in learn order, de-duplicated. */
export function movesKnownAt(s: Species, level: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of s.learnset) {
    if (e.level <= level && !seen.has(e.tech)) {
      seen.add(e.tech);
      out.push(e.tech);
    }
  }
  return out;
}

/** Entries learned by advancing from `from` up to and including `to`. */
export function movesLearnedBetween(s: Species, from: number, to: number): string[] {
  const known = new Set(movesKnownAt(s, from));
  const out: string[] = [];
  for (const e of s.learnset) {
    if (e.level > from && e.level <= to && !known.has(e.tech)) {
      known.add(e.tech);
      out.push(e.tech);
    }
  }
  return out;
}

// Per-role growth curves. Every creature builds on one of these, then may bump a
// stat or two. Heroes harden (def/res), assassins sharpen (off/spd), mages
// deepen (mp/mag) — so the class you invest levels in pays off on its own axis.
const HERO_GROWTH: Stats = { hp: 7, mp: 2, off: 2.1, def: 2.2, spd: 1.4, mag: 1.3, res: 2.1 };
const MAGE_GROWTH: Stats = { hp: 6, mp: 2.8, off: 1.6, def: 1.7, spd: 1.7, mag: 2.6, res: 1.9 };
const ASSASSIN_GROWTH: Stats = { hp: 6, mp: 2, off: 2.5, def: 1.7, spd: 2.1, mag: 1.4, res: 1.5 };

export const SPECIES: Record<string, Species> = {
  // === The Quiet Crossing rookies =========================================
  emberling: {
    id: 'emberling',
    name: 'Emberling',
    attribute: 'hero',
    element: 'fire',
    art: 'lizard',
    height: 1.35,
    base: { hp: 44, mp: 18, off: 15, def: 12, spd: 13, mag: 9, res: 9 },
    growth: HERO_GROWTH,
    learnset: [
      { level: 1, tech: 'emberFang' },
      { level: 3, tech: 'emberWave' },
      { level: 7, tech: 'cinderBurst' },
      { level: 11, tech: 'emberRend' },
      { level: 15, tech: 'pyreLance' },
      { level: 19, tech: 'infernoCore' },
    ],
    // Branches: the steady warden-form, or a faster feral form (Digimon-style
    // fork). Both stay Fire, so Emberling's identity carries into either.
    evolutions: [{ to: 'emberforge', level: 2 }],
    blurb: 'A soul that burned bright and went out angry. It lingers on all the heat it never got to spend.',
  },
  glidefang: {
    id: 'glidefang',
    name: 'Glidefang',
    attribute: 'mage',
    element: 'water',
    art: 'wing',
    height: 1.3,
    hover: 0.18,
    base: { hp: 42, mp: 22, off: 12, def: 11, spd: 16, mag: 18, res: 12 },
    growth: { ...MAGE_GROWTH, spd: 2 },
    learnset: [
      { level: 1, tech: 'frostLance' },
      { level: 3, tech: 'mistVeil' },
      { level: 7, tech: 'tidalSlap' },
      { level: 11, tech: 'prismStorm' },
      { level: 15, tech: 'glacierSpire' },
      { level: 19, tech: 'maelstrom' },
    ],
    evolutions: [{ to: 'gustwing', level: 2 }],
    blurb: 'A soul at peace, riding the last warm drafts. It waits to cross without any fear at all.',
  },
  nightnip: {
    id: 'nightnip',
    name: 'Nightnip',
    attribute: 'assassin',
    element: 'dark',
    art: 'bat',
    height: 1.3,
    hover: 0.22,
    base: { hp: 40, mp: 24, off: 17, def: 10, spd: 15, mag: 8, res: 7 },
    growth: { ...ASSASSIN_GROWTH, off: 2.5 },
    learnset: [
      { level: 1, tech: 'gloomLance' },
      { level: 4, tech: 'nightSpiral' },
      { level: 8, tech: 'hexBolt' },
      { level: 12, tech: 'shadowRend' },
      { level: 16, tech: 'abyssalBolt' },
      { level: 20, tech: 'voidNova' },
    ],
    evolutions: [{ to: 'duskfang', level: 2 }],
    blurb: 'A soul that hid from its own ending — quick, funny, and gone before the dark could say its name.',
  },
  sprigling: {
    id: 'sprigling',
    name: 'Sprigling',
    attribute: 'hero',
    element: 'nature',
    art: 'plant',
    height: 1.25,
    base: { hp: 48, mp: 20, off: 13, def: 15, spd: 9, mag: 9, res: 13 },
    growth: { ...HERO_GROWTH, def: 2.4 },
    learnset: [
      { level: 1, tech: 'seedVolley' },
      { level: 4, tech: 'bloomPulse' },
      { level: 8, tech: 'graveRot' },
      { level: 12, tech: 'savageBite' },
      { level: 16, tech: 'wildgrowth' },
      { level: 20, tech: 'lifebloom' },
    ],
    evolutions: [{ to: 'bloomkin', level: 2 }],
    blurb: 'Roots itself into any surface it can find.',
  },
  cogling: {
    id: 'cogling',
    name: 'Cogling',
    attribute: 'hero',
    element: 'machine',
    art: 'bot',
    height: 1.3,
    base: { hp: 46, mp: 16, off: 15, def: 16, spd: 10, mag: 8, res: 13 },
    growth: { ...HERO_GROWTH, def: 2.2 },
    learnset: [
      { level: 1, tech: 'boltDrive' },
      { level: 4, tech: 'boltPierce' },
      { level: 8, tech: 'ironHowl' },
      { level: 12, tech: 'quakeCore' },
      { level: 16, tech: 'rendingStrike' },
      { level: 20, tech: 'railvolt' },
    ],
    evolutions: [{ to: 'cogknight', level: 2 }],
    blurb: 'Maintenance unit. Technically still under warranty.',
  },
  dropletta: {
    id: 'dropletta',
    name: 'Dropletta',
    attribute: 'mage',
    element: 'water',
    art: 'slime',
    height: 1.15,
    base: { hp: 50, mp: 24, off: 12, def: 14, spd: 11, mag: 18, res: 13 },
    growth: MAGE_GROWTH,
    learnset: [
      { level: 1, tech: 'tidalSlap' },
      { level: 3, tech: 'mistVeil' },
      { level: 7, tech: 'frostLance' },
      { level: 11, tech: 'prismStorm' },
      { level: 15, tech: 'glacierSpire' },
      { level: 19, tech: 'renewingTide' },
    ],
    evolutions: [{ to: 'wellspring', level: 2 }],
    blurb: 'Mostly padding. Surprisingly hard to put down.',
  },
  gloomote: {
    id: 'gloomote',
    name: 'Gloomote',
    attribute: 'mage',
    element: 'dark',
    art: 'wisp',
    height: 1.25,
    hover: 0.35,
    base: { hp: 41, mp: 26, off: 13, def: 11, spd: 14, mag: 21, res: 11 },
    growth: { ...MAGE_GROWTH, mp: 3 },
    learnset: [
      { level: 1, tech: 'gloomLance' },
      { level: 4, tech: 'hexBolt' },
      { level: 8, tech: 'nightSpiral' },
      { level: 12, tech: 'dirge' },
      { level: 16, tech: 'abyssalBolt' },
      { level: 20, tech: 'voidNova' },
    ],
    // Evolves later than most, and straight into the Haunted warden line.
    evolutions: [{ to: 'gloomshade', level: 2 }],
    blurb: 'A drifting fragment of unrecovered memory.',
  },
  bulwarq: {
    id: 'bulwarq',
    name: 'Bulwarq',
    attribute: 'hero',
    element: 'machine',
    art: 'knight',
    height: 1.5,
    base: { hp: 54, mp: 16, off: 16, def: 18, spd: 9, mag: 9, res: 15 },
    growth: { ...HERO_GROWTH, hp: 8, def: 2.3, res: 2.2 },
    learnset: [
      { level: 1, tech: 'ironHowl' },
      { level: 4, tech: 'boltDrive' },
      { level: 8, tech: 'quakeCore' },
      { level: 12, tech: 'rendingStrike' },
      { level: 16, tech: 'overload' },
      { level: 20, tech: 'railvolt' },
    ],
    evolutions: [{ to: 'aegisaur', level: 2 }],
    blurb: 'Built to stand in the doorway. It still does.',
  },
  fenrix: {
    id: 'fenrix',
    name: 'Fenrix',
    attribute: 'assassin',
    element: 'nature',
    art: 'wolf',
    height: 1.4,
    base: { hp: 48, mp: 18, off: 18, def: 13, spd: 17, mag: 9, res: 9 },
    growth: { ...ASSASSIN_GROWTH, off: 2.5, spd: 2 },
    learnset: [
      { level: 1, tech: 'gustWing' },
      { level: 4, tech: 'seedVolley' },
      { level: 8, tech: 'graveRot' },
      { level: 12, tech: 'savageBite' },
      { level: 16, tech: 'thornspell' },
      { level: 20, tech: 'wildgrowth' },
    ],
    evolutions: [{ to: 'direfang', level: 2 }],
    blurb: 'A pack-hunter routine that never got shut down.',
  },
  mitebug: {
    id: 'mitebug',
    name: 'Mitebug',
    attribute: 'assassin',
    element: 'nature',
    art: 'bug',
    height: 1.0,
    base: { hp: 34, mp: 10, off: 12, def: 9, spd: 12, mag: 6, res: 6 },
    growth: { ...ASSASSIN_GROWTH, hp: 5, off: 1.8 },
    learnset: [
      { level: 1, tech: 'seedVolley' },
      { level: 5, tech: 'gustWing' },
      { level: 9, tech: 'graveRot' },
      { level: 13, tech: 'savageBite' },
      { level: 17, tech: 'thornspell' },
    ],
    // Fodder that graduates — a little later than the L10 default.
    evolutions: [{ to: 'chitterling', level: 2 }],
    blurb: 'Chews through unattended memory blocks.',
  },
  scrapmite: {
    id: 'scrapmite',
    name: 'Scrapmite',
    attribute: 'hero',
    element: 'machine',
    art: 'scrap',
    height: 1.05,
    base: { hp: 38, mp: 12, off: 11, def: 12, spd: 10, mag: 6, res: 9 },
    growth: { ...HERO_GROWTH, hp: 5, off: 1.8 },
    learnset: [
      { level: 1, tech: 'scrapShot' },
      { level: 5, tech: 'boltDrive' },
      { level: 9, tech: 'ironHowl' },
      { level: 13, tech: 'quakeCore' },
      { level: 17, tech: 'rendingStrike' },
    ],
    // Early bloomer: the first stage of the three-stage Scrapmite → Boltframe →
    // Dynamo line, so it evolves well before the L10 norm.
    evolutions: [{ to: 'boltframe', level: 2 }],
    blurb: 'It went out to salvage something, and forgot what.',
  },

  // --- Crystal Cavern -----------------------------------------------------
  shardling: {
    id: 'shardling',
    name: 'Shardling',
    attribute: 'mage',
    element: 'water',
    art: 'crystalSlime',
    height: 1.2,
    base: { hp: 46, mp: 22, off: 12, def: 13, spd: 12, mag: 18, res: 13 },
    growth: MAGE_GROWTH,
    learnset: [
      { level: 1, tech: 'frostLance' },
      { level: 4, tech: 'mistVeil' },
      { level: 8, tech: 'prismStorm' },
      { level: 12, tech: 'glacierSpire' },
      { level: 16, tech: 'maelstrom' },
      { level: 20, tech: 'renewingTide' },
    ],
    evolutions: [{ to: 'glaciark', level: 2 }],
    blurb: 'A gem-slime that refracts every blow that hits it.',
  },
  prismoth: {
    id: 'prismoth',
    name: 'Prismoth',
    attribute: 'assassin',
    element: 'water',
    art: 'prismMoth',
    height: 1.3,
    hover: 0.3,
    base: { hp: 42, mp: 20, off: 17, def: 11, spd: 18, mag: 10, res: 8 },
    growth: { ...ASSASSIN_GROWTH, spd: 2.2 },
    learnset: [
      { level: 1, tech: 'tidalSlap' },
      { level: 4, tech: 'frostLance' },
      { level: 8, tech: 'prismStorm' },
      { level: 12, tech: 'tidalCrash' },
      { level: 16, tech: 'glacierSpire' },
      { level: 20, tech: 'maelstrom' },
    ],
    evolutions: [{ to: 'prismatide', level: 2 }],
    blurb: 'Wings split the light into blades before it strikes.',
  },
  geodon: {
    id: 'geodon',
    name: 'Geodon',
    attribute: 'hero',
    element: 'machine',
    art: 'geodeGolem',
    height: 1.45,
    base: { hp: 58, mp: 16, off: 16, def: 20, spd: 8, mag: 9, res: 17 },
    growth: { ...HERO_GROWTH, hp: 8, def: 2.3, res: 2.3 },
    learnset: [
      { level: 1, tech: 'quakeCore' },
      { level: 4, tech: 'ironHowl' },
      { level: 8, tech: 'boltPierce' },
      { level: 12, tech: 'rendingStrike' },
      { level: 16, tech: 'overload' },
      { level: 20, tech: 'railvolt' },
    ],
    // Terminal — already a heavy, later-game bruiser.
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
    base: { hp: 44, mp: 28, off: 13, def: 11, spd: 15, mag: 22, res: 11 },
    growth: { ...MAGE_GROWTH, mp: 3 },
    learnset: [
      { level: 1, tech: 'hexBolt' },
      { level: 4, tech: 'gloomLance' },
      { level: 8, tech: 'nightSpiral' },
      { level: 12, tech: 'dirge' },
      { level: 16, tech: 'abyssalBolt' },
      { level: 20, tech: 'voidNova' },
    ],
    evolutions: [{ to: 'banshade', level: 2 }],
    communable: true,
    blurb:
      'A frightened thing that never finished dying. It is not angry — only lost, and would rather be spoken to than struck.',
  },
  gravemaw: {
    id: 'gravemaw',
    name: 'Gravemaw',
    attribute: 'assassin',
    element: 'nature',
    art: 'graveCrawler',
    height: 1.1,
    base: { hp: 50, mp: 16, off: 18, def: 14, spd: 14, mag: 9, res: 10 },
    growth: { ...ASSASSIN_GROWTH, off: 2.4 },
    learnset: [
      { level: 1, tech: 'graveRot' },
      { level: 4, tech: 'gustWing' },
      { level: 8, tech: 'seedVolley' },
      { level: 12, tech: 'savageBite' },
      { level: 16, tech: 'thornspell' },
      { level: 20, tech: 'wildgrowth' },
    ],
    evolutions: [{ to: 'gravestalker', level: 2 }],
    blurb: 'Eats whatever the reach leaves rotting in the dark.',
  },
  cryptguard: {
    id: 'cryptguard',
    name: 'Cryptguard',
    attribute: 'hero',
    element: 'dark',
    art: 'cursedArmor',
    height: 1.5,
    base: { hp: 60, mp: 18, off: 17, def: 22, spd: 9, mag: 10, res: 18 },
    growth: { ...HERO_GROWTH, hp: 8, def: 2.4, res: 2.3 },
    learnset: [
      { level: 1, tech: 'hexBolt' },
      { level: 4, tech: 'ironHowl' },
      { level: 8, tech: 'gloomLance' },
      { level: 12, tech: 'shadowRend' },
      { level: 16, tech: 'dirge' },
      { level: 20, tech: 'abyssalBolt' },
    ],
    // Terminal — a standing sentinel form.
    blurb: 'An empty suit still running its last standing order.',
  },

  // --- The Overgrowth -----------------------------------------------------
  // A jungle roster. Art is reused from fitting existing sprites (the reach's
  // identity rides on its bespoke terrain + decor); stats/element/attribute are
  // its own. Swap `art` for dedicated sprites later — nothing else changes.
  frondle: {
    id: 'frondle',
    name: 'Frondle',
    attribute: 'hero',
    element: 'nature',
    art: 'ogFernguard',
    height: 1.3,
    base: { hp: 52, mp: 20, off: 15, def: 17, spd: 10, mag: 9, res: 14 },
    growth: { ...HERO_GROWTH, def: 2.3 },
    learnset: [
      { level: 1, tech: 'seedVolley' },
      { level: 4, tech: 'bloomPulse' },
      { level: 8, tech: 'gustWing' },
      { level: 12, tech: 'savageBite' },
      { level: 16, tech: 'wildgrowth' },
      { level: 20, tech: 'lifebloom' },
    ],
    // Terminal — a settled jungle variant of the Sprigling line.
    blurb: 'A soul that put down roots where it fell, and let the green take the rest.',
  },
  thorncat: {
    id: 'thorncat',
    name: 'Thorncat',
    attribute: 'assassin',
    element: 'nature',
    art: 'ogJunglecat',
    height: 1.4,
    base: { hp: 47, mp: 18, off: 19, def: 12, spd: 18, mag: 8, res: 8 },
    growth: { ...ASSASSIN_GROWTH, off: 2.5, spd: 2 },
    learnset: [
      { level: 1, tech: 'seedVolley' },
      { level: 4, tech: 'gustWing' },
      { level: 8, tech: 'graveRot' },
      { level: 12, tech: 'savageBite' },
      { level: 16, tech: 'thornspell' },
      { level: 20, tech: 'wildgrowth' },
    ],
    evolutions: [{ to: 'thornpanther', level: 2 }],
    blurb: 'It stalked these paths in life and never learned that they end.',
  },
  boggle: {
    id: 'boggle',
    name: 'Boggle',
    attribute: 'mage',
    element: 'water',
    art: 'ogBogfrog',
    height: 1.15,
    base: { hp: 54, mp: 24, off: 12, def: 15, spd: 11, mag: 18, res: 14 },
    growth: { ...MAGE_GROWTH, mp: 2.6 },
    learnset: [
      { level: 1, tech: 'tidalSlap' },
      { level: 4, tech: 'mistVeil' },
      { level: 8, tech: 'frostLance' },
      { level: 12, tech: 'prismStorm' },
      { level: 16, tech: 'glacierSpire' },
      { level: 20, tech: 'renewingTide' },
    ],
    evolutions: [{ to: 'boggart', level: 2 }],
    blurb: 'A soul that sank into the warm dark and decided the sinking was rest.',
  },
  chitter: {
    id: 'chitter',
    name: 'Chitter',
    attribute: 'assassin',
    element: 'nature',
    art: 'ogLeafbeetle',
    height: 1.05,
    base: { hp: 42, mp: 12, off: 15, def: 11, spd: 16, mag: 7, res: 7 },
    growth: { ...ASSASSIN_GROWTH, off: 2, spd: 1.9 },
    learnset: [
      { level: 1, tech: 'seedVolley' },
      { level: 5, tech: 'gustWing' },
      { level: 9, tech: 'graveRot' },
      { level: 13, tech: 'savageBite' },
      { level: 17, tech: 'thornspell' },
    ],
    // Terminal — small, quick, and content to stay that way.
    blurb: 'The small remainder of something that only ever wanted to keep moving.',
  },

  // === Evolved forms ======================================================
  // Advanced ("Revenant"-tier) forms grown from the rookies above. Art is reused
  // from the roster's bigger/cooler sprites (see docs/adding-monsters.md — the
  // reach's identity rides on terrain; dedicated sprites are a follow-up).

  // Emberling → (Cinder branch). A feral re-class: the hero's heat turned into
  // an assassin's speed.
  cinderfang: {
    id: 'cinderfang',
    name: 'Cinderfang',
    attribute: 'assassin',
    element: 'fire',
    art: 'wolf',
    height: 1.6,
    base: { hp: 56, mp: 24, off: 24, def: 14, spd: 22, mag: 12, res: 10 },
    growth: { ...ASSASSIN_GROWTH, hp: 7, off: 2.7, spd: 2.2 },
    learnset: [
      { level: 1, tech: 'emberFang' },
      { level: 1, tech: 'emberRend' },
      { level: 6, tech: 'cinderBurst' },
      { level: 11, tech: 'pyreLance' },
      { level: 15, tech: 'sunClaw' },
      { level: 19, tech: 'infernoCore' },
    ],
    blurb: 'What was left when Emberling stopped guarding the fire and became it.',
  },
  // Glidefang → the storm it used to ride.
  stratoth: {
    id: 'stratoth',
    name: 'Stratoth',
    attribute: 'mage',
    element: 'water',
    art: 'prismMoth',
    height: 1.7,
    hover: 0.32,
    base: { hp: 56, mp: 34, off: 14, def: 14, spd: 18, mag: 26, res: 16 },
    growth: { ...MAGE_GROWTH, mp: 3.2, mag: 2.9 },
    learnset: [
      { level: 1, tech: 'frostLance' },
      { level: 1, tech: 'prismStorm' },
      { level: 6, tech: 'glacierSpire' },
      { level: 12, tech: 'maelstrom' },
      { level: 18, tech: 'renewingTide' },
    ],
    blurb: 'The draft it drifted on, grown wide enough to carry the whole sky.',
  },
  // Nightnip → a shadow that no longer flinches.
  nocturne: {
    id: 'nocturne',
    name: 'Nocturne',
    attribute: 'assassin',
    element: 'dark',
    art: 'wraithWisp',
    height: 1.7,
    hover: 0.28,
    base: { hp: 54, mp: 28, off: 26, def: 13, spd: 21, mag: 14, res: 10 },
    growth: { ...ASSASSIN_GROWTH, hp: 7, off: 2.7, spd: 2.2 },
    learnset: [
      { level: 1, tech: 'gloomLance' },
      { level: 1, tech: 'shadowRend' },
      { level: 6, tech: 'nightSpiral' },
      { level: 12, tech: 'abyssalBolt' },
      { level: 18, tech: 'voidNova' },
    ],
    blurb: 'It stopped hiding from the dark and learned to move inside it.',
  },
  // Sprigling → a whole grove given one will.
  grovelord: {
    id: 'grovelord',
    name: 'Grovelord',
    attribute: 'hero',
    element: 'nature',
    art: 'lion',
    height: 2.0,
    base: { hp: 74, mp: 26, off: 20, def: 24, spd: 11, mag: 14, res: 21 },
    growth: { ...HERO_GROWTH, hp: 9, def: 2.4, res: 2.3 },
    learnset: [
      { level: 1, tech: 'seedVolley' },
      { level: 1, tech: 'savageBite' },
      { level: 6, tech: 'wildgrowth' },
      { level: 12, tech: 'thornspell' },
      { level: 18, tech: 'lifebloom' },
    ],
    blurb: 'The roots went deep enough to hold a forest, then stood up wearing it.',
  },
  // Cogling → its finished, plated form.
  cogknight: {
    id: 'cogknight',
    name: 'Cogknight',
    attribute: 'hero',
    element: 'machine',
    art: 'knight',
    height: 1.9,
    base: { hp: 70, mp: 22, off: 22, def: 26, spd: 11, mag: 12, res: 21 },
    growth: { ...HERO_GROWTH, hp: 9, def: 2.4, res: 2.2 },
    learnset: [
      { level: 1, tech: 'quakeCore' },
      { level: 1, tech: 'rendingStrike' },
      { level: 6, tech: 'overload' },
      { level: 12, tech: 'railvolt' },
      { level: 18, tech: 'ironHowl' },
    ],
    blurb: 'Warranty long expired. It stopped waiting for a work order and picked up a blade.',
  },
  // Dropletta → a tide that answers back.
  tidecaller: {
    id: 'tidecaller',
    name: 'Tidecaller',
    attribute: 'mage',
    element: 'water',
    art: 'crystalWarden',
    height: 2.0,
    base: { hp: 62, mp: 36, off: 14, def: 18, spd: 13, mag: 26, res: 19 },
    growth: { ...MAGE_GROWTH, hp: 7, mp: 3.2, mag: 2.9 },
    learnset: [
      { level: 1, tech: 'frostLance' },
      { level: 1, tech: 'glacierSpire' },
      { level: 6, tech: 'prismStorm' },
      { level: 12, tech: 'maelstrom' },
      { level: 18, tech: 'renewingTide' },
    ],
    blurb: 'The one that would not go quiet, grown until the sea itself answers to it.',
  },
  // Bulwarq → the whole wall.
  aegisaur: {
    id: 'aegisaur',
    name: 'Aegisaur',
    attribute: 'hero',
    element: 'machine',
    art: 'geodeGolem',
    height: 2.1,
    base: { hp: 82, mp: 24, off: 22, def: 28, spd: 9, mag: 12, res: 23 },
    growth: { ...HERO_GROWTH, hp: 10, def: 2.5, res: 2.4 },
    learnset: [
      { level: 1, tech: 'ironHowl' },
      { level: 1, tech: 'rendingStrike' },
      { level: 6, tech: 'quakeCore' },
      { level: 12, tech: 'overload' },
      { level: 18, tech: 'railvolt' },
    ],
    blurb: 'It was built to stand in one doorway. Now it is the doorway.',
  },
  // Fenrix → the pack made one.
  direfang: {
    id: 'direfang',
    name: 'Direfang',
    attribute: 'assassin',
    element: 'nature',
    art: 'lion',
    height: 1.9,
    base: { hp: 64, mp: 26, off: 27, def: 16, spd: 22, mag: 12, res: 12 },
    growth: { ...ASSASSIN_GROWTH, hp: 8, off: 2.8, spd: 2.2 },
    learnset: [
      { level: 1, tech: 'savageBite' },
      { level: 1, tech: 'gustWing' },
      { level: 6, tech: 'graveRot' },
      { level: 12, tech: 'thornspell' },
      { level: 18, tech: 'wildgrowth' },
    ],
    blurb: 'The routine that never shut down finally ran every wolf it remembered at once.',
  },
  // Mitebug → the thing it was chewing toward.
  mantiscar: {
    id: 'mantiscar',
    name: 'Mantiscar',
    attribute: 'assassin',
    element: 'nature',
    art: 'graveCrawler',
    height: 1.6,
    base: { hp: 60, mp: 22, off: 26, def: 16, spd: 20, mag: 11, res: 12 },
    growth: { ...ASSASSIN_GROWTH, hp: 7, off: 2.7, spd: 2.1 },
    learnset: [
      { level: 1, tech: 'savageBite' },
      { level: 1, tech: 'seedVolley' },
      { level: 6, tech: 'graveRot' },
      { level: 12, tech: 'thornspell' },
      { level: 18, tech: 'wildgrowth' },
    ],
    blurb: 'It ate through enough unattended memory to remember how to be dangerous.',
  },
  // Prismoth → light with an edge.
  prismatide: {
    id: 'prismatide',
    name: 'Prismatide',
    attribute: 'assassin',
    element: 'water',
    art: 'crystalWarden',
    height: 1.9,
    hover: 0.2,
    base: { hp: 58, mp: 28, off: 25, def: 15, spd: 24, mag: 14, res: 12 },
    growth: { ...ASSASSIN_GROWTH, hp: 7, off: 2.7, spd: 2.3 },
    learnset: [
      { level: 1, tech: 'tidalCrash' },
      { level: 1, tech: 'frostLance' },
      { level: 6, tech: 'prismStorm' },
      { level: 12, tech: 'glacierSpire' },
      { level: 18, tech: 'maelstrom' },
    ],
    blurb: 'Its wings stopped splitting the light and started cutting with it.',
  },
  // Wispling → the wail it was too afraid to make.
  banshade: {
    id: 'banshade',
    name: 'Banshade',
    attribute: 'mage',
    element: 'dark',
    art: 'revenant',
    height: 2.0,
    hover: 0.22,
    base: { hp: 58, mp: 36, off: 14, def: 14, spd: 19, mag: 28, res: 15 },
    growth: { ...MAGE_GROWTH, hp: 7, mp: 3.2, mag: 3 },
    learnset: [
      { level: 1, tech: 'abyssalBolt' },
      { level: 1, tech: 'hexBolt' },
      { level: 6, tech: 'nightSpiral' },
      { level: 12, tech: 'dirge' },
      { level: 18, tech: 'voidNova' },
    ],
    blurb: 'It finished dying at last, and found it had a voice after all.',
  },
  // Gravemaw → the hunger given legs.
  gravestalker: {
    id: 'gravestalker',
    name: 'Gravestalker',
    attribute: 'assassin',
    element: 'nature',
    art: 'wolf',
    height: 1.7,
    base: { hp: 62, mp: 24, off: 26, def: 17, spd: 20, mag: 12, res: 13 },
    growth: { ...ASSASSIN_GROWTH, hp: 8, off: 2.7, spd: 2.1 },
    learnset: [
      { level: 1, tech: 'savageBite' },
      { level: 1, tech: 'graveRot' },
      { level: 6, tech: 'gustWing' },
      { level: 12, tech: 'thornspell' },
      { level: 18, tech: 'wildgrowth' },
    ],
    blurb: 'It stopped waiting for the reach to leave something rotting and went looking.',
  },
  // Thorncat → the path that walks itself.
  thornpanther: {
    id: 'thornpanther',
    name: 'Thornpanther',
    attribute: 'assassin',
    element: 'nature',
    art: 'lion',
    height: 1.9,
    base: { hp: 64, mp: 24, off: 28, def: 16, spd: 23, mag: 11, res: 12 },
    growth: { ...ASSASSIN_GROWTH, hp: 8, off: 2.8, spd: 2.3 },
    learnset: [
      { level: 1, tech: 'savageBite' },
      { level: 1, tech: 'gustWing' },
      { level: 6, tech: 'graveRot' },
      { level: 12, tech: 'thornspell' },
      { level: 18, tech: 'wildgrowth' },
    ],
    blurb: 'It never learned the paths end. Now the paths end where it decides.',
  },
  // Boggle → the deep that decided to rise.
  boggart: {
    id: 'boggart',
    name: 'Boggart',
    attribute: 'mage',
    element: 'water',
    art: 'crystalSlime',
    height: 1.6,
    base: { hp: 66, mp: 34, off: 13, def: 18, spd: 12, mag: 25, res: 18 },
    growth: { ...MAGE_GROWTH, hp: 8, mp: 3, mag: 2.8 },
    learnset: [
      { level: 1, tech: 'frostLance' },
      { level: 1, tech: 'prismStorm' },
      { level: 6, tech: 'glacierSpire' },
      { level: 12, tech: 'maelstrom' },
      { level: 18, tech: 'renewingTide' },
    ],
    blurb: 'The sinking it called rest turned out to have a floor, and a will, and a temper.',
  },

  // --- bosses -------------------------------------------------------------
  glaciark: {
    id: 'glaciark',
    name: 'Glaciark',
    // Evolves from shardling (a mage), so it stays a mage — evolution lines are
    // class-pure (see systems/party/evolve.ts). Its tanky stats/growth are its
    // own; the attribute is only the class tag the purity rule keys on.
    attribute: 'mage',
    element: 'water',
    art: 'crystalWarden',
    height: 2.3,
    base: { hp: 90, mp: 44, off: 18, def: 24, spd: 13, mag: 20, res: 22 },
    growth: { hp: 10, mp: 3, off: 2.3, def: 2.1, spd: 1.4, mag: 2.2, res: 2.1 },
    learnset: [
      { level: 1, tech: 'frostLance' },
      { level: 1, tech: 'prismStorm' },
      { level: 6, tech: 'tidalCrash' },
      { level: 10, tech: 'glacierSpire' },
      { level: 14, tech: 'maelstrom' },
      { level: 18, tech: 'renewingTide' },
    ],
    blurb: 'Warden of the Reliquary. It has never felt warmth.',
  },
  revenance: {
    id: 'revenance',
    name: 'Revenance',
    attribute: 'mage',
    element: 'dark',
    art: 'revenant',
    height: 2.4,
    hover: 0.2,
    base: { hp: 100, mp: 50, off: 18, def: 22, spd: 16, mag: 26, res: 20 },
    growth: { hp: 11, mp: 3.4, off: 2.1, def: 2, spd: 1.6, mag: 2.6, res: 2 },
    learnset: [
      { level: 1, tech: 'dirge' },
      { level: 1, tech: 'hexBolt' },
      { level: 6, tech: 'nightSpiral' },
      { level: 10, tech: 'abyssalBolt' },
      { level: 14, tech: 'voidNova' },
    ],
    blurb: 'Warden of the Unremembered. It remembers being unmade.',
  },
  verdanox: {
    id: 'verdanox',
    name: 'Verdanox',
    attribute: 'hero',
    element: 'nature',
    art: 'ogVerdanox',
    height: 2.3,
    base: { hp: 96, mp: 44, off: 18, def: 24, spd: 12, mag: 18, res: 22 },
    growth: { hp: 10, mp: 3, off: 2.3, def: 2.2, spd: 1.4, mag: 2, res: 2.1 },
    learnset: [
      { level: 1, tech: 'savageBite' },
      { level: 1, tech: 'wildgrowth' },
      { level: 6, tech: 'graveRot' },
      { level: 10, tech: 'thornspell' },
      { level: 14, tech: 'lifebloom' },
    ],
    blurb: 'Warden of the Overgrowth. It lets nothing leave that the jungle has taken back.',
  },

  // --- boss ---------------------------------------------------------------
  regalion: {
    id: 'regalion',
    name: 'Regalion',
    attribute: 'hero',
    element: 'fire',
    art: 'lion',
    height: 2.2,
    base: { hp: 78, mp: 40, off: 16, def: 22, spd: 14, mag: 16, res: 20 },
    growth: { hp: 9, mp: 3, off: 2.2, def: 2, spd: 1.4, mag: 2, res: 2 },
    learnset: [
      { level: 1, tech: 'sunClaw' },
      { level: 1, tech: 'regalRoar' },
      { level: 6, tech: 'emberRend' },
      { level: 10, tech: 'pyreLance' },
      { level: 14, tech: 'infernoCore' },
    ],
    blurb: 'Warden of the Quiet Crossing. It does not consider you a threat.',
  },

  // --- rare spirit --------------------------------------------------------
  lastlight: {
    id: 'lastlight',
    name: 'The Last Light',
    attribute: 'mage',
    element: 'dark',
    art: 'lastlight',
    height: 0.95,
    hover: 0.12,
    base: { hp: 24, mp: 30, off: 8, def: 9, spd: 22, mag: 26, res: 10 },
    growth: { hp: 4, mp: 3, off: 1.2, def: 1.2, spd: 2.2, mag: 2.6, res: 1.4 },
    learnset: [
      { level: 1, tech: 'gloomLance' },
      { level: 1, tech: 'dirge' },
    ],
    // Terminal by nature — it is a soul on the edge of moving on, not a fighter
    // with a future form.
    blurb:
      'A soul almost ready to move on — a trembling flame in a cracked lantern. It would sooner drift away than fight.',
  },
  emberforge: {
    id: 'emberforge',
    name: 'Emberforge',
    attribute: 'hero',
    element: 'fire',
    art: 'emberforge',
    height: 1.51,
    base: { hp: 56, mp: 23, off: 19, def: 15, spd: 17, mag: 12, res: 12 },
    growth: HERO_GROWTH,
    learnset: [
      { level: 1, tech: 'emberFang' },
      { level: 3, tech: 'emberWave' },
      { level: 7, tech: 'cinderBurst' },
      { level: 11, tech: 'emberRend' },
      { level: 15, tech: 'pyreLance' },
      { level: 19, tech: 'infernoCore' },
    ],
    evolutions: [{ to: 'ashwarden', level: 3 }],
    blurb: 'An evolved Emberling — larger, brighter-burning, and surer of the light it carries.',
  },
  ashwarden: {
    id: 'ashwarden',
    name: 'Ashwarden',
    attribute: 'hero',
    element: 'fire',
    art: 'ashwarden',
    height: 1.67,
    base: { hp: 70, mp: 29, off: 24, def: 19, spd: 21, mag: 14, res: 14 },
    growth: HERO_GROWTH,
    learnset: [
      { level: 1, tech: 'emberFang' },
      { level: 3, tech: 'emberWave' },
      { level: 7, tech: 'cinderBurst' },
      { level: 11, tech: 'emberRend' },
      { level: 15, tech: 'pyreLance' },
      { level: 19, tech: 'infernoCore' },
    ],
    evolutions: [{ to: 'pyrelord', level: 4 }],
    blurb: 'An evolved Emberling — larger, brighter-burning, and surer of the light it carries.',
  },
  pyrelord: {
    id: 'pyrelord',
    name: 'Pyrelord',
    attribute: 'hero',
    element: 'fire',
    art: 'pyrelord',
    height: 1.84,
    base: { hp: 86, mp: 35, off: 29, def: 23, spd: 25, mag: 18, res: 18 },
    growth: HERO_GROWTH,
    learnset: [
      { level: 1, tech: 'emberFang' },
      { level: 3, tech: 'emberWave' },
      { level: 7, tech: 'cinderBurst' },
      { level: 11, tech: 'emberRend' },
      { level: 15, tech: 'pyreLance' },
      { level: 19, tech: 'infernoCore' },
    ],
    blurb: 'The fullest form of Emberling. What began as a flicker now holds a steady, unafraid light.',
  },
  gustwing: {
    id: 'gustwing',
    name: 'Gustwing',
    attribute: 'mage',
    element: 'water',
    art: 'gustwing',
    height: 1.46,
    hover: 0.18,
    base: { hp: 54, mp: 28, off: 15, def: 14, spd: 20, mag: 23, res: 15 },
    growth: MAGE_GROWTH,
    learnset: [
      { level: 1, tech: 'frostLance' },
      { level: 3, tech: 'mistVeil' },
      { level: 7, tech: 'tidalSlap' },
      { level: 11, tech: 'prismStorm' },
      { level: 15, tech: 'glacierSpire' },
      { level: 19, tech: 'maelstrom' },
    ],
    evolutions: [{ to: 'tempestrix', level: 3 }],
    blurb: 'An evolved Glidefang — larger, brighter-burning, and surer of the light it carries.',
  },
  tempestrix: {
    id: 'tempestrix',
    name: 'Tempestrix',
    attribute: 'mage',
    element: 'water',
    art: 'tempestrix',
    height: 1.61,
    hover: 0.18,
    base: { hp: 67, mp: 35, off: 19, def: 18, spd: 26, mag: 29, res: 19 },
    growth: MAGE_GROWTH,
    learnset: [
      { level: 1, tech: 'frostLance' },
      { level: 3, tech: 'mistVeil' },
      { level: 7, tech: 'tidalSlap' },
      { level: 11, tech: 'prismStorm' },
      { level: 15, tech: 'glacierSpire' },
      { level: 19, tech: 'maelstrom' },
    ],
    blurb: 'The fullest form of Glidefang. What began as a flicker now holds a steady, unafraid light.',
  },
  duskfang: {
    id: 'duskfang',
    name: 'Duskfang',
    attribute: 'assassin',
    element: 'dark',
    art: 'duskfang',
    height: 1.46,
    hover: 0.22,
    base: { hp: 51, mp: 31, off: 22, def: 13, spd: 19, mag: 10, res: 9 },
    growth: ASSASSIN_GROWTH,
    learnset: [
      { level: 1, tech: 'gloomLance' },
      { level: 4, tech: 'nightSpiral' },
      { level: 8, tech: 'hexBolt' },
      { level: 12, tech: 'shadowRend' },
      { level: 16, tech: 'abyssalBolt' },
      { level: 20, tech: 'voidNova' },
    ],
    evolutions: [{ to: 'nightmaw', level: 3 }],
    blurb: 'An evolved Nightnip — larger, brighter-burning, and surer of the light it carries.',
  },
  nightmaw: {
    id: 'nightmaw',
    name: 'Nightmaw',
    attribute: 'assassin',
    element: 'dark',
    art: 'nightmaw',
    height: 1.61,
    hover: 0.22,
    base: { hp: 64, mp: 38, off: 27, def: 16, spd: 24, mag: 13, res: 11 },
    growth: ASSASSIN_GROWTH,
    learnset: [
      { level: 1, tech: 'gloomLance' },
      { level: 4, tech: 'nightSpiral' },
      { level: 8, tech: 'hexBolt' },
      { level: 12, tech: 'shadowRend' },
      { level: 16, tech: 'abyssalBolt' },
      { level: 20, tech: 'voidNova' },
    ],
    evolutions: [{ to: 'umbranox', level: 4 }],
    blurb: 'An evolved Nightnip — larger, brighter-burning, and surer of the light it carries.',
  },
  umbranox: {
    id: 'umbranox',
    name: 'Umbranox',
    attribute: 'assassin',
    element: 'dark',
    art: 'umbranox',
    height: 1.77,
    hover: 0.22,
    base: { hp: 78, mp: 47, off: 33, def: 20, spd: 29, mag: 16, res: 14 },
    growth: ASSASSIN_GROWTH,
    learnset: [
      { level: 1, tech: 'gloomLance' },
      { level: 4, tech: 'nightSpiral' },
      { level: 8, tech: 'hexBolt' },
      { level: 12, tech: 'shadowRend' },
      { level: 16, tech: 'abyssalBolt' },
      { level: 20, tech: 'voidNova' },
    ],
    blurb: 'The fullest form of Nightnip. What began as a flicker now holds a steady, unafraid light.',
  },
  chitterling: {
    id: 'chitterling',
    name: 'Chitterling',
    attribute: 'assassin',
    element: 'nature',
    art: 'chitterling',
    height: 1.12,
    base: { hp: 44, mp: 13, off: 15, def: 12, spd: 15, mag: 8, res: 8 },
    growth: ASSASSIN_GROWTH,
    learnset: [
      { level: 1, tech: 'seedVolley' },
      { level: 5, tech: 'gustWing' },
      { level: 9, tech: 'graveRot' },
      { level: 13, tech: 'savageBite' },
      { level: 17, tech: 'thornspell' },
    ],
    evolutions: [{ to: 'carapex', level: 3 }],
    blurb: 'An evolved Mitebug — larger, brighter-burning, and surer of the light it carries.',
  },
  carapex: {
    id: 'carapex',
    name: 'Carapex',
    attribute: 'assassin',
    element: 'nature',
    art: 'carapex',
    height: 1.24,
    base: { hp: 54, mp: 16, off: 19, def: 14, spd: 19, mag: 10, res: 10 },
    growth: ASSASSIN_GROWTH,
    learnset: [
      { level: 1, tech: 'seedVolley' },
      { level: 5, tech: 'gustWing' },
      { level: 9, tech: 'graveRot' },
      { level: 13, tech: 'savageBite' },
      { level: 17, tech: 'thornspell' },
    ],
    blurb: 'The fullest form of Mitebug. What began as a flicker now holds a steady, unafraid light.',
  },
  bloomkin: {
    id: 'bloomkin',
    name: 'Bloomkin',
    attribute: 'hero',
    element: 'nature',
    art: 'bloomkin',
    height: 1.4,
    base: { hp: 61, mp: 26, off: 17, def: 19, spd: 12, mag: 12, res: 17 },
    growth: HERO_GROWTH,
    learnset: [
      { level: 1, tech: 'seedVolley' },
      { level: 4, tech: 'bloomPulse' },
      { level: 8, tech: 'graveRot' },
      { level: 12, tech: 'savageBite' },
      { level: 16, tech: 'wildgrowth' },
      { level: 20, tech: 'lifebloom' },
    ],
    evolutions: [{ to: 'thornward', level: 3 }],
    blurb: 'An evolved Sprigling — larger, brighter-burning, and surer of the light it carries.',
  },
  thornward: {
    id: 'thornward',
    name: 'Thornward',
    attribute: 'hero',
    element: 'nature',
    art: 'thornward',
    height: 1.55,
    base: { hp: 77, mp: 32, off: 21, def: 24, spd: 14, mag: 14, res: 21 },
    growth: HERO_GROWTH,
    learnset: [
      { level: 1, tech: 'seedVolley' },
      { level: 4, tech: 'bloomPulse' },
      { level: 8, tech: 'graveRot' },
      { level: 12, tech: 'savageBite' },
      { level: 16, tech: 'wildgrowth' },
      { level: 20, tech: 'lifebloom' },
    ],
    evolutions: [{ to: 'verdammon', level: 4 }],
    blurb: 'An evolved Sprigling — larger, brighter-burning, and surer of the light it carries.',
  },
  verdammon: {
    id: 'verdammon',
    name: 'Verdammon',
    attribute: 'hero',
    element: 'nature',
    art: 'verdammon',
    height: 1.7,
    base: { hp: 94, mp: 39, off: 25, def: 29, spd: 18, mag: 18, res: 25 },
    growth: HERO_GROWTH,
    learnset: [
      { level: 1, tech: 'seedVolley' },
      { level: 4, tech: 'bloomPulse' },
      { level: 8, tech: 'graveRot' },
      { level: 12, tech: 'savageBite' },
      { level: 16, tech: 'wildgrowth' },
      { level: 20, tech: 'lifebloom' },
    ],
    blurb: 'The fullest form of Sprigling. What began as a flicker now holds a steady, unafraid light.',
  },
  boltframe: {
    id: 'boltframe',
    name: 'Boltframe',
    attribute: 'hero',
    element: 'machine',
    art: 'boltframe',
    height: 1.18,
    base: { hp: 49, mp: 15, off: 14, def: 15, spd: 13, mag: 8, res: 12 },
    growth: HERO_GROWTH,
    learnset: [
      { level: 1, tech: 'scrapShot' },
      { level: 5, tech: 'boltDrive' },
      { level: 9, tech: 'ironHowl' },
      { level: 13, tech: 'quakeCore' },
      { level: 17, tech: 'rendingStrike' },
    ],
    evolutions: [{ to: 'dynamo', level: 3 }],
    blurb: 'An evolved Scrapmite — larger, brighter-burning, and surer of the light it carries.',
  },
  dynamo: {
    id: 'dynamo',
    name: 'Dynamo',
    attribute: 'hero',
    element: 'machine',
    art: 'dynamo',
    height: 1.3,
    base: { hp: 61, mp: 19, off: 18, def: 19, spd: 16, mag: 10, res: 14 },
    growth: HERO_GROWTH,
    learnset: [
      { level: 1, tech: 'scrapShot' },
      { level: 5, tech: 'boltDrive' },
      { level: 9, tech: 'ironHowl' },
      { level: 13, tech: 'quakeCore' },
      { level: 17, tech: 'rendingStrike' },
    ],
    blurb: 'The fullest form of Scrapmite. What began as a flicker now holds a steady, unafraid light.',
  },
  gloomshade: {
    id: 'gloomshade',
    name: 'Gloomshade',
    attribute: 'mage',
    element: 'dark',
    art: 'gloomshade',
    height: 1.4,
    hover: 0.35,
    base: { hp: 52, mp: 33, off: 17, def: 14, spd: 18, mag: 27, res: 14 },
    growth: MAGE_GROWTH,
    learnset: [
      { level: 1, tech: 'gloomLance' },
      { level: 4, tech: 'hexBolt' },
      { level: 8, tech: 'nightSpiral' },
      { level: 12, tech: 'dirge' },
      { level: 16, tech: 'abyssalBolt' },
      { level: 20, tech: 'voidNova' },
    ],
    evolutions: [{ to: 'oblivion', level: 3 }],
    blurb: 'An evolved Gloomote — larger, brighter-burning, and surer of the light it carries.',
  },
  oblivion: {
    id: 'oblivion',
    name: 'Oblivion',
    attribute: 'mage',
    element: 'dark',
    art: 'oblivion',
    height: 1.55,
    hover: 0.35,
    base: { hp: 66, mp: 42, off: 21, def: 18, spd: 22, mag: 34, res: 18 },
    growth: MAGE_GROWTH,
    learnset: [
      { level: 1, tech: 'gloomLance' },
      { level: 4, tech: 'hexBolt' },
      { level: 8, tech: 'nightSpiral' },
      { level: 12, tech: 'dirge' },
      { level: 16, tech: 'abyssalBolt' },
      { level: 20, tech: 'voidNova' },
    ],
    blurb: 'The fullest form of Gloomote. What began as a flicker now holds a steady, unafraid light.',
  },
  wellspring: {
    id: 'wellspring',
    name: 'Wellspring',
    attribute: 'mage',
    element: 'water',
    art: 'wellspring',
    height: 1.29,
    base: { hp: 64, mp: 31, off: 15, def: 18, spd: 14, mag: 23, res: 17 },
    growth: MAGE_GROWTH,
    learnset: [
      { level: 1, tech: 'tidalSlap' },
      { level: 3, tech: 'mistVeil' },
      { level: 7, tech: 'frostLance' },
      { level: 11, tech: 'prismStorm' },
      { level: 15, tech: 'glacierSpire' },
      { level: 19, tech: 'renewingTide' },
    ],
    evolutions: [{ to: 'tidalby', level: 3 }],
    blurb: 'An evolved Dropletta — larger, brighter-burning, and surer of the light it carries.',
  },
  tidalby: {
    id: 'tidalby',
    name: 'Tidalby',
    attribute: 'mage',
    element: 'water',
    art: 'tidalby',
    height: 1.43,
    base: { hp: 80, mp: 38, off: 19, def: 22, spd: 18, mag: 29, res: 21 },
    growth: MAGE_GROWTH,
    learnset: [
      { level: 1, tech: 'tidalSlap' },
      { level: 3, tech: 'mistVeil' },
      { level: 7, tech: 'frostLance' },
      { level: 11, tech: 'prismStorm' },
      { level: 15, tech: 'glacierSpire' },
      { level: 19, tech: 'renewingTide' },
    ],
    evolutions: [{ to: 'maelstrom', level: 4 }],
    blurb: 'An evolved Dropletta — larger, brighter-burning, and surer of the light it carries.',
  },
  maelstrom: {
    id: 'maelstrom',
    name: 'Maelstrom',
    attribute: 'mage',
    element: 'water',
    art: 'maelstrom',
    height: 1.56,
    base: { hp: 98, mp: 47, off: 23, def: 27, spd: 21, mag: 35, res: 25 },
    growth: MAGE_GROWTH,
    learnset: [
      { level: 1, tech: 'tidalSlap' },
      { level: 3, tech: 'mistVeil' },
      { level: 7, tech: 'frostLance' },
      { level: 11, tech: 'prismStorm' },
      { level: 15, tech: 'glacierSpire' },
      { level: 19, tech: 'renewingTide' },
    ],
    blurb: 'The fullest form of Dropletta. What began as a flicker now holds a steady, unafraid light.',
  },

  // === Companions ==========================================================
  // The three keepers who walk with the Unfinished (see docs/NARRATIVE.md §4).
  // Not wild, not capturable, not summonable — only added by `game.joinCompanion`
  // at story beats. They reuse human sprites and carry no evolutions.
  wren: {
    id: 'wren',
    name: 'Wren',
    attribute: 'mage',
    element: 'dark',
    art: 'wrenSprite',
    height: 1.6,
    base: { hp: 46, mp: 26, off: 12, def: 13, spd: 14, mag: 17, res: 15 },
    growth: { ...MAGE_GROWTH, mag: 2.4, res: 2.1 },
    learnset: [
      { level: 1, tech: 'gloomLance' },
      { level: 1, tech: 'mistVeil' },
      { level: 5, tech: 'hexBolt' },
      { level: 10, tech: 'nightSpiral' },
      { level: 15, tech: 'shadowRend' },
    ],
    blurb: 'Keeper of the Book of Names. Says every name aloud so the second death cannot have it.',
  },
  senaVale: {
    id: 'senaVale',
    name: 'Sena Vale',
    attribute: 'hero',
    element: 'water',
    art: 'senaSprite',
    height: 1.62,
    base: { hp: 58, mp: 20, off: 16, def: 20, spd: 12, mag: 14, res: 18 },
    growth: { ...HERO_GROWTH, def: 2.5, res: 2.3 },
    learnset: [
      { level: 1, tech: 'frostLance' },
      { level: 1, tech: 'mistVeil' },
      { level: 8, tech: 'glacierSpire' },
      { level: 14, tech: 'prismStorm' },
    ],
    blurb: 'She froze her sister to spare her the ending, and learned too late what it cost. Guards what still lives.',
  },
  kade: {
    id: 'kade',
    name: 'Kade',
    attribute: 'assassin',
    element: 'fire',
    art: 'kadeSprite',
    height: 1.6,
    base: { hp: 50, mp: 18, off: 20, def: 13, spd: 21, mag: 10, res: 10 },
    growth: { ...ASSASSIN_GROWTH, off: 2.6, spd: 2.4 },
    learnset: [
      { level: 1, tech: 'emberFang' },
      { level: 1, tech: 'emberWave' },
      { level: 12, tech: 'cinderBurst' },
      { level: 16, tech: 'emberRend' },
    ],
    blurb: 'The keeper who is always one reach ahead — outrunning, it turns out, a death of his own.',
  },
};

export const COMPANION_IDS = ['wren', 'senaVale', 'kade'] as const;

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
