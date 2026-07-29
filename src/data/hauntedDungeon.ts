import { narrate, say } from '../systems/dialogue/script';
import type { TileTheme } from '../engine/TileGrid';
import type { Reach, DungeonFloor } from './dungeon';

/**
 * The Unremembered — a free-select reach (not on the tutorial path).
 *
 * Dim, foggy, oppressive. Its terrain is cracked crypt masonry opening into a
 * rotting, organic cave, strewn with gravestones, dead trees and roots — the
 * broken, asymmetric opposite of the Reliquary's clean crystal geometry. Leans
 * on Dark + Nature element plates and its own roster (Wispling / Gravemaw /
 * Cryptguard), warded by Revenance. Pure data — see `dungeon.ts` for the model
 * and `docs/ROADMAP.md`.
 */

const THEME_UPPER: TileTheme = {
  floor: '#2a2536',
  floorAlt: '#211d2c',
  wall: '#3a3350',
  wallTop: '#181322',
  accentWall: '#5a3f6e',
  terrain: 'crypt',
  wallHeight: 2.8,
  fogColor: '#140f1e',
};

const THEME_DEEP: TileTheme = {
  floor: '#231d1a',
  floorAlt: '#1a1512',
  wall: '#332a22',
  wallTop: '#120d0a',
  accentWall: '#4a3a28',
  terrain: 'cave',
  wallHeight: 3.1,
  fogColor: '#0e0a10',
};

const THEME_BOSS: TileTheme = {
  floor: '#2c2438',
  floorAlt: '#201a2c',
  wall: '#3d3152',
  wallTop: '#150f1f',
  accentWall: '#7a4a8c',
  terrain: 'crypt',
  wallHeight: 3.0,
  fogColor: '#100a1a',
};

const FLOORS: DungeonFloor[] = [
  {
    id: 'haunted-1',
    name: 'The Unremembered — Cold Foyer',
    theme: THEME_UPPER,
    fog: 1.4,
    decor: [
      { x: 2, z: 1, kind: 'gravestone' },
      { x: 13, z: 2, kind: 'gravestone' },
      { x: 3, z: 5, kind: 'boneheap', height: 0.7 },
      { x: 12, z: 6, kind: 'deadTree', height: 1.7 },
      { x: 9, z: 9, kind: 'gravestone' },
      { x: 5, z: 7, kind: 'boneheap', height: 0.7 },
    ],
    rows: [
      '#################',
      '#..........#....#',
      '#..S......C#....#',
      '#..........#....#',
      '#....1.........2#',
      '#...............#',
      '#.$....###......#',
      '#......#.#......#',
      '#......#>#......#',
      '#...............#',
      '#################',
    ],
    events: {
      '1': {
        kind: 'battle',
        enemies: [
          { species: 'wispling', level: 10 },
          { species: 'gravemaw', level: 10 },
        ],
        intro: narrate('Something cold passes through you. It leaves a shape behind.'),
      },
      '2': {
        kind: 'battle',
        enemies: [
          { species: 'gravemaw', level: 11 },
          { species: 'wispling', level: 10 },
          { species: 'cryptguard', level: 10 },
        ],
      },
    },
    chests: {
      '10,2': { credits: 260, item: 'repairChip', note: 'A traveller who did not leave. Their pack remains.' },
    },
    encounterRate: 0.07,
    encounters: [
      { weight: 1, enemies: [{ species: 'lastlight', level: 11 }] }, // rare: a soul about to move on
      { weight: 3, enemies: [{ species: 'wispling', level: 10 }] },
      { weight: 2, enemies: [{ species: 'gravemaw', level: 11 }] },
      {
        weight: 2,
        enemies: [
          { species: 'wispling', level: 10 },
          { species: 'gravemaw', level: 10 },
        ],
      },
      { weight: 1, enemies: [{ species: 'cryptguard', level: 11 }] },
    ],
  },

  {
    id: 'haunted-2',
    name: 'The Unremembered — Rotting Nave',
    theme: THEME_DEEP,
    fog: 1.7,
    decor: [
      { x: 2, z: 3, kind: 'rockPile', height: 0.9 },
      { x: 13, z: 4, kind: 'roots', height: 0.8 },
      { x: 13, z: 6, kind: 'roots', height: 0.8 },
      { x: 3, z: 8, kind: 'mushroomCluster', height: 0.7, emissive: 0.3 },
      { x: 8, z: 9, kind: 'mushroomGlow', height: 0.6, emissive: 0.7 },
    ],
    rows: [
      '#################',
      '#...............#',
      '#..S..D.N......C#',
      '#..............##',
      '#....1....###...#',
      '#.........#.#...#',
      '#..N...D..#.#...#',
      '#.........#2#...#',
      '#....>.........##',
      '#...............#',
      '#################',
    ],
    events: {
      '1': {
        kind: 'battle',
        enemies: [
          { species: 'cryptguard', level: 12 },
          { species: 'wispling', level: 11 },
        ],
      },
      '2': {
        kind: 'battle',
        enemies: [
          { species: 'gravemaw', level: 12 },
          { species: 'cryptguard', level: 12 },
          { species: 'wispling', level: 11 },
        ],
        intro: narrate('The nave breathes out. The dark at the far end is thicker than dark should be.'),
      },
    },
    chests: {
      '15,2': { credits: 340, note: 'A reliquary, long since looted of everything but credits.' },
    },
    encounterRate: 0.08,
    encounters: [
      { weight: 1, enemies: [{ species: 'lastlight', level: 11 }] }, // rare: a soul about to move on
      { weight: 3, enemies: [{ species: 'gravemaw', level: 12 }] },
      { weight: 3, enemies: [{ species: 'wispling', level: 11 }] },
      {
        weight: 2,
        enemies: [
          { species: 'cryptguard', level: 12 },
          { species: 'wispling', level: 11 },
        ],
      },
      {
        weight: 1,
        enemies: [
          { species: 'cryptguard', level: 13 },
          { species: 'gravemaw', level: 12 },
        ],
      },
    ],
  },

  {
    id: 'haunted-3',
    name: 'The Unremembered — The Deletion',
    theme: THEME_BOSS,
    fog: 1.9,
    decor: [
      { x: 4, z: 3, kind: 'gravestone' },
      { x: 12, z: 3, kind: 'gravestone' },
      { x: 4, z: 5, kind: 'deadTree', height: 1.7 },
      { x: 12, z: 5, kind: 'deadTree', height: 1.7 },
      { x: 8, z: 8, kind: 'boneheap', height: 0.7 },
    ],
    rows: [
      '=================',
      '=...............=',
      '=..===.....===..=',
      '=..=.........=..=',
      '=......1........=',
      '=..=.........=..=',
      '=..===.....===..=',
      '=.......S.......=',
      '=...............=',
      '=================',
    ],
    events: {
      '1': {
        kind: 'boss',
        enemies: [{ species: 'revenance', level: 14 }],
        intro: [
          ...narrate(
            'The fog gathers into a shape that used to be a person. It has forgotten which one — no one has said its name in so long that even it cannot remember.',
          ),
          ...say(
            'the Unnamed',
            'I had a name. Say it. Give me back one word and I will let you pass. Stay. Keep me company. Do not let me finish forgetting.',
          ),
        ],
        outro: [
          ...narrate(
            'You cannot give back what the world let go. But you can give it something: a name of your own choosing, or the mercy of none.',
          ),
          ...say('the Unnamed', 'Oh. That will do. That will do.'),
          ...narrate('The last of it unravels, quiet now. A way home opens in the settling dark.'),
        ],
      },
    },
    chests: {},
    encounterRate: 0.04,
    encounters: [
      { weight: 2, enemies: [{ species: 'wispling', level: 12 }] },
      {
        weight: 1,
        enemies: [
          { species: 'cryptguard', level: 13 },
          { species: 'gravemaw', level: 12 },
        ],
      },
    ],
  },
];

export const HAUNTED_DUNGEON: Reach = {
  id: 'haunted',
  name: 'The Unremembered',
  blurb:
    "A dimming reach where the nearly-forgotten run their last errands, thinner each time. Say a soul's name and you save it from the second, final death.",
  color: '#b48cff',
  recommendedLevel: 10,
  floors: FLOORS,
  startingLight: 150,
  music: 'haunted',
  onClear: { flag: 'hauntedCleared' },
  requires: 'crystalCleared',
};
