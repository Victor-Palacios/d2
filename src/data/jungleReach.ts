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
 * Chitter), warded by Thornreaper. Pure data — see `dungeon.ts` for the model and
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
      { x: 10, z: 7, kind: 'vineHang', height: 1.7 },
      { x: 13, z: 9, kind: 'fern', height: 0.8 },
    ],
    rows: [
      '#################',
      '#...............#',
      '#..S....#....C..#',
      '#..4..#.....#...#',
      '#..1......N....2#',
      '#NNNN..#....#...#',
      '#N3NN.....#....W#',
      '#NNNN#.....#....#',
      '#NNNN....>.....##',
      '#.$.............#',
      '#################',
    ],
    events: {
      '1': {
        kind: 'battle',
        enemies: [
          { species: 'bloomstalker', level: 5 },
          { species: 'vineraptor', level: 5 },
        ],
        intro: narrate(
          'The green closes over the path behind you. Something shifts in the leaves — and turns to face you.',
        ),
      },
      '2': {
        kind: 'battle',
        enemies: [
          { species: 'thorncat', level: 5 },
          { species: 'chitter', level: 5 },
        ],
      },
      // The Unyielding — an Anchored knotted into a mass of grasping green. Far
      // above the Overgrowth's level; come back matched to nature. Re-fightable.
      '3': { kind: 'anchored', id: 'jungleAnchored' },
      // Arrival beat. The Overgrowth requires the Reliquary cleared, so Wren and
      // Sena are both aboard — Sena names the danger of a place this gentle.
      '4': {
        kind: 'dialogue',
        once: true,
        script: [
          ...narrate(
            'The green closes warm and close behind you. It does not feel like a threat. It feels like an invitation to stop walking.',
          ),
          ...say(
            'Sena Vale',
            'Careful. A place this gentle is the kind that keeps you. I know the feeling — I built a whole room out of it.',
          ),
          ...say('Wren', 'Then we keep moving. Whatever roots the souls in here, it started out being kind to them.'),
        ],
      },
    },
    chests: {
      '13,2': { obols: 260, item: 'mendingBalm', note: "A ranger's pack, half-swallowed by roots." },
    },
    encounterRate: 0.06,
    encounters: [
      { weight: 3, enemies: [{ species: 'chitter', level: 5 }] },
      { weight: 3, enemies: [{ species: 'sporefang', level: 5 }] },
      {
        weight: 2,
        enemies: [
          { species: 'vineraptor', level: 5 },
          { species: 'chitter', level: 5 },
        ],
      },
      { weight: 1, enemies: [{ species: 'thorncat', level: 5 }] },
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
          { species: 'thorncat', level: 5 },
          { species: 'sporefang', level: 5 },
        ],
      },
      '2': {
        kind: 'battle',
        enemies: [
          { species: 'vineraptor', level: 5 },
          { species: 'thorncat', level: 5 },
          { species: 'bloomstalker', level: 5 },
        ],
        intro: narrate('The hollow breathes out a wet green warmth. Whatever keeps this place is close now.'),
      },
    },
    chests: {
      '15,2': { obols: 320, note: 'A strongbox, its lock long since rusted through by the damp.' },
    },
    encounterRate: 0.08,
    encounters: [
      { weight: 3, enemies: [{ species: 'thorncat', level: 5 }] },
      { weight: 3, enemies: [{ species: 'sporefang', level: 5 }] },
      {
        weight: 2,
        enemies: [
          { species: 'vineraptor', level: 5 },
          { species: 'sporefang', level: 5 },
        ],
      },
      {
        weight: 1,
        enemies: [
          { species: 'thorncat', level: 5 },
          { species: 'chitter', level: 5 },
        ],
      },
    ],
  },

  {
    id: 'jungle-3',
    name: 'The Overgrowth — Ferngloom Tier',
    theme: THEME_DEEP,
    fog: 1.4,
    decor: [
      { x: 2, z: 4, kind: 'palmTree', height: 1.8 },
      { x: 14, z: 4, kind: 'bamboo', height: 1.6 },
      { x: 8, z: 4, kind: 'jungleFlower', height: 0.5, emissive: 0.3 },
      { x: 2, z: 9, kind: 'mossLog', height: 0.5 },
    ],
    rows: [
      '#################',
      '#......S........#',
      '#.......1.......#',
      '#..###.....###..#',
      '#..#.........#..#',
      '#..#.W..2..N.#..#',
      '#..#..;;;;;..#..#',
      '#..###.....###..#',
      '#.C.....$.3.....#',
      '#.........>.....#',
      '#################',
    ],
    events: {
      '1': {
        kind: 'battle',
        enemies: [
          { species: 'thorncat', level: 5 },
          { species: 'chitter', level: 5 },
        ],
        intro: narrate('The ferns hang so thick the light goes green. Something keeps pace in the wet dark.'),
      },
      '2': {
        kind: 'battle',
        enemies: [
          { species: 'vineraptor', level: 5 },
          { species: 'bloomstalker', level: 5 },
        ],
      },
      // Mid-descent beat — the green has quietly kept the ones who rested here.
      '3': {
        kind: 'dialogue',
        once: true,
        script: [
          ...narrate(
            'The ferns have grown over old shapes — a pack, a walking-staff, a pair of boots — all still where someone set them down to rest a moment.',
          ),
          ...say('Wren', 'They meant to get up again. Every one of them meant to get up again.'),
          ...say(
            'Sena Vale',
            'That is how it takes you. Not all at once. One more quiet moment, and then another, until moving seems like the cruel thing.',
          ),
        ],
      },
    },
    chests: {
      '2,8': { obols: 240, item: 'mendingBalm', note: 'A ranger’s kit, roots already threading through the strap.' },
    },
    encounterRate: 0.08,
    encounters: [
      { weight: 3, enemies: [{ species: 'bloomstalker', level: 5 }] },
      { weight: 3, enemies: [{ species: 'chitter', level: 5 }] },
      {
        weight: 2,
        enemies: [
          { species: 'thorncat', level: 5 },
          { species: 'vineraptor', level: 5 },
        ],
      },
      { weight: 1, enemies: [{ species: 'thorncat', level: 5 }] },
    ],
  },

  {
    id: 'jungle-4',
    name: 'The Overgrowth — Sunken Boughs',
    theme: THEME_DEEP,
    fog: 1.5,
    decor: [
      { x: 14, z: 1, kind: 'totem', height: 1.6 },
      { x: 14, z: 3, kind: 'fern', height: 0.8 },
      { x: 2, z: 9, kind: 'mossLog', height: 0.5 },
    ],
    rows: [
      '#################',
      '#.S.............#',
      '#....#...#...#..#',
      '#.......2.......#',
      '#..#...#...#..N.#',
      '#....1.....#....#',
      '#.W.#...#...#...#',
      '#.......$._...###',
      '#..#...#...#.%C.#',
      '#.........>...###',
      '#################',
    ],
    events: {
      '1': {
        kind: 'battle',
        enemies: [
          { species: 'vineraptor', level: 6 },
          { species: 'thorncat', level: 5 },
        ],
      },
      '2': {
        kind: 'battle',
        enemies: [
          { species: 'bloomstalker', level: 6 },
          { species: 'chitter', level: 5 },
          { species: 'thorncat', level: 5 },
        ],
        intro: narrate('The boughs sag underfoot — you are walking on a canopy, not a floor. Below, something stirs.'),
      },
    },
    // The corner cache ('C' at 14,8) is sealed behind a barrier ('%' at 13,8)
    // that a pressure plate ('_' at 10,7) only holds open for a few seconds —
    // step it, then dash through before it re-seals. An optional timed detour.
    chests: {
      '14,8': { obols: 300, note: 'Rainwater has pooled in the box; the obols beneath it are still bright.' },
    },
    encounterRate: 0.08,
    encounters: [
      { weight: 3, enemies: [{ species: 'thorncat', level: 5 }] },
      { weight: 2, enemies: [{ species: 'bloomstalker', level: 6 }] },
      {
        weight: 2,
        enemies: [
          { species: 'vineraptor', level: 5 },
          { species: 'chitter', level: 5 },
        ],
      },
      { weight: 1, enemies: [{ species: 'thorncat', level: 6 }] },
    ],
  },

  {
    id: 'jungle-5',
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
        enemies: [{ species: 'thornreaper', level: 5 }],
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
          ...say(
            'Sena Vale',
            'She rooted them so she would not be alone. I froze Lire so I would not be. ...We are not so different, the ones who cannot let go.',
          ),
          ...narrate('The roots loosen and let go, one soul at a time. A way home opens in the parting leaves.'),
        ],
      },
    },
    chests: {},
    encounterRate: 0.04,
    encounters: [
      { weight: 2, enemies: [{ species: 'sporefang', level: 5 }] },
      {
        weight: 1,
        enemies: [
          { species: 'thorncat', level: 5 },
          { species: 'vineraptor', level: 5 },
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
  recommendedLevel: 5,
  floors: FLOORS,
  startingLight: 215,
  music: 'jungle',
  onClear: { flag: 'jungleCleared' },
  requires: 'crystalCleared',
  side: true,
};
