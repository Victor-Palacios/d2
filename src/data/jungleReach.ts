import { narrate, say } from '../systems/dialogue/script';
import type { TileTheme } from '../engine/TileGrid';
import type { Reach, DungeonFloor } from './dungeon';

/**
 * The Overgrowth — a free-select reach (not on the tutorial path).
 *
 * Warm, humid, alive. Its terrain is the new `jungle` skin — mossy earth under
 * dense foliage walls hung with vines — dressed in ferns, palms, bamboo and
 * carved totems, tinted with green haze under a tall canopy. Leans on Nature +
 * Water element plates and its own roster (Frondle / Thorncat / Boggle /
 * Chitter), warded by Verdanox. Pure data — see `dungeon.ts` for the model and
 * `docs/ROADMAP.md` for how reaches slot in.
 */

const THEME_UPPER: TileTheme = {
  floor: '#2c3a1c',
  floorAlt: '#233016',
  wall: '#33502a',
  wallTop: '#182611',
  accentWall: '#5a7a2f',
  terrain: 'jungle',
  wallHeight: 3.2,
  fogColor: '#16240f',
};

const THEME_DEEP: TileTheme = {
  floor: '#26331a',
  floorAlt: '#1e2914',
  wall: '#2c4522',
  wallTop: '#141f0d',
  accentWall: '#4a6a28',
  terrain: 'jungle',
  wallHeight: 3.4,
  fogColor: '#101c0b',
};

const THEME_BOSS: TileTheme = {
  floor: '#2e3a1e',
  floorAlt: '#243016',
  wall: '#3a5a2a',
  wallTop: '#16240f',
  accentWall: '#7aa83a',
  terrain: 'jungle',
  wallHeight: 3.4,
  fogColor: '#14240e',
};

const FLOORS: DungeonFloor[] = [
  {
    id: 'jungle-1',
    name: 'The Overgrowth — Canopy Approach',
    theme: THEME_UPPER,
    fog: 1.15,
    decor: [
      { x: 7, z: 2, kind: 'palmTree', height: 2.2 },
      { x: 5, z: 3, kind: 'fern', height: 0.8 },
      { x: 11, z: 3, kind: 'fern', height: 0.8 },
      { x: 6, z: 5, kind: 'jungleFlower', height: 0.7, emissive: 0.3 },
      { x: 9, z: 6, kind: 'bamboo', height: 1.8 },
      { x: 4, z: 7, kind: 'mossLog', height: 0.6 },
      { x: 10, z: 7, kind: 'vineHang', height: 1.7 },
      { x: 13, z: 9, kind: 'fern', height: 0.8 },
    ],
    rows: [
      '#################',
      '#...............#',
      '#..S....#....C..#',
      '#.....#.....#...#',
      '#..1......N....2#',
      '#......#....#...#',
      '#.W.......#....W#',
      '#....#.....#....#',
      '#..$.....>.....##',
      '#...............#',
      '#################',
    ],
    events: {
      '1': {
        kind: 'battle',
        enemies: [
          { species: 'frondle', level: 6 },
          { species: 'boggle', level: 6 },
        ],
        intro: narrate(
          'The green closes over the path behind you. Something shifts in the leaves — and turns to face you.',
        ),
      },
      '2': {
        kind: 'battle',
        enemies: [
          { species: 'thorncat', level: 7 },
          { species: 'chitter', level: 6 },
        ],
      },
    },
    chests: {
      '13,2': { obols: 260, item: 'repairChip', note: "A ranger's pack, half-swallowed by roots." },
    },
    encounterRate: 0.06,
    encounters: [
      { weight: 3, enemies: [{ species: 'chitter', level: 6 }] },
      { weight: 3, enemies: [{ species: 'frondle', level: 6 }] },
      {
        weight: 2,
        enemies: [
          { species: 'boggle', level: 6 },
          { species: 'chitter', level: 6 },
        ],
      },
      { weight: 1, enemies: [{ species: 'thorncat', level: 7 }] },
    ],
  },

  {
    id: 'jungle-2',
    name: 'The Overgrowth — Tangle Hollow',
    theme: THEME_DEEP,
    fog: 1.4,
    decor: [
      { x: 5, z: 4, kind: 'bamboo', height: 1.9 },
      { x: 13, z: 4, kind: 'vineHang', height: 1.8 },
      { x: 3, z: 8, kind: 'fern', height: 0.8 },
      { x: 12, z: 8, kind: 'palmTree', height: 2.3 },
      { x: 8, z: 9, kind: 'jungleFlower', height: 0.7, emissive: 0.3 },
      { x: 2, z: 6, kind: 'mossLog', height: 0.6 },
    ],
    rows: [
      '#################',
      '#...............#',
      '#..S..W...N....C#',
      '#....#...#...#..#',
      '#..1............#',
      '#...#..N.W..#...#',
      '#......###......#',
      '#..W...#.#..2..##',
      '#......#.#......#',
      '#....>.........##',
      '#################',
    ],
    events: {
      '1': {
        kind: 'battle',
        enemies: [
          { species: 'thorncat', level: 8 },
          { species: 'frondle', level: 7 },
        ],
      },
      '2': {
        kind: 'battle',
        enemies: [
          { species: 'boggle', level: 8 },
          { species: 'thorncat', level: 8 },
          { species: 'frondle', level: 7 },
        ],
        intro: narrate('The hollow breathes out a wet green warmth. Whatever keeps this place is close now.'),
      },
    },
    chests: {
      '15,2': { obols: 320, note: 'A strongbox, its lock long since rusted through by the damp.' },
    },
    encounterRate: 0.08,
    encounters: [
      { weight: 3, enemies: [{ species: 'thorncat', level: 8 }] },
      { weight: 3, enemies: [{ species: 'frondle', level: 7 }] },
      {
        weight: 2,
        enemies: [
          { species: 'boggle', level: 8 },
          { species: 'frondle', level: 7 },
        ],
      },
      {
        weight: 1,
        enemies: [
          { species: 'thorncat', level: 8 },
          { species: 'chitter', level: 8 },
        ],
      },
    ],
  },

  {
    id: 'jungle-3',
    name: 'The Overgrowth — Heartwood',
    theme: THEME_BOSS,
    fog: 1.5,
    decor: [
      { x: 4, z: 3, kind: 'palmTree', height: 2.4 },
      { x: 12, z: 3, kind: 'palmTree', height: 2.4 },
      { x: 4, z: 5, kind: 'fern', height: 0.9 },
      { x: 12, z: 5, kind: 'fern', height: 0.9 },
      { x: 8, z: 8, kind: 'totem', height: 2.0, emissive: 0.35 },
      { x: 2, z: 2, kind: 'vineHang', height: 1.8 },
      { x: 14, z: 2, kind: 'vineHang', height: 1.8 },
    ],
    rows: [
      '=================',
      '=...............=',
      '=......=.=......=',
      '=....=.....=....=',
      '=.......1.......=',
      '=....=.....=....=',
      '=......=.=......=',
      '=.......S.......=',
      '=...............=',
      '=================',
    ],
    events: {
      '1': {
        kind: 'boss',
        enemies: [{ species: 'verdanox', level: 9 }],
        intro: [
          ...narrate(
            'At the heart of the wood, a woman sits half-grown into a great mossed trunk, roots where her legs were. She is smiling, and she has been for a very long time.',
          ),
          ...say(
            'Liora Fen',
            'I stopped walking here. It was so quiet, and the green was so patient. I let it hold me — and then I let it hold everyone who came after, so I would never sit alone.',
          ),
        ],
        outro: [
          ...say(
            'Liora Fen',
            'Oh. They were never keeping me company. I was keeping them. Go on — undo my knots. Let them all go, me last.',
          ),
          ...narrate('The roots loosen and let go, one soul at a time. A way home opens in the parting leaves.'),
        ],
      },
    },
    chests: {},
    encounterRate: 0.04,
    encounters: [
      { weight: 2, enemies: [{ species: 'frondle', level: 8 }] },
      {
        weight: 1,
        enemies: [
          { species: 'thorncat', level: 9 },
          { species: 'boggle', level: 8 },
        ],
      },
    ],
  },
];

export const JUNGLE_REACH: Reach = {
  id: 'jungle',
  name: 'The Overgrowth',
  blurb:
    'A green reach that never gives anything back — souls who stopped to rest, and were quietly rooted where they sat. Something at its heart keeps them company.',
  color: '#5fd66a',
  recommendedLevel: 7,
  floors: FLOORS,
  startingLight: 135,
  music: 'jungle',
  onClear: { flag: 'jungleCleared' },
  requires: 'crystalCleared',
  side: true,
};
