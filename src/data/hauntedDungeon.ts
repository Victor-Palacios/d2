import { narrate, say } from '../systems/dialogue/script';
import type { Domain, DungeonFloor } from './dungeon';

/**
 * Haunted Dungeon — a free-select domain (not on the tutorial path).
 *
 * Dim, foggy, oppressive. Leans on Dark + Nature element plates and its own
 * roster (Wispling / Gravemaw / Cryptguard), warded by Revenance. Pure data —
 * see `dungeon.ts` for the model and `docs/ROADMAP.md`.
 */

const THEME_UPPER = {
  floor: '#2a2536',
  floorAlt: '#211d2c',
  wall: '#3a3350',
  wallTop: '#181322',
  accentWall: '#5a3f6e',
};

const THEME_DEEP = {
  floor: '#241f30',
  floorAlt: '#1b1725',
  wall: '#332c48',
  wallTop: '#140f1e',
  accentWall: '#4a3358',
};

const THEME_BOSS = {
  floor: '#2c2438',
  floorAlt: '#201a2c',
  wall: '#3d3152',
  wallTop: '#150f1f',
  accentWall: '#7a4a8c',
};

const FLOORS: DungeonFloor[] = [
  {
    id: 'haunted-1',
    name: 'Haunted Dungeon — Cold Foyer',
    theme: THEME_UPPER,
    fog: 1.4,
    rows: [
      '#################',
      '#...............#',
      '#..S.......C....#',
      '#...............#',
      '#....1.....2....#',
      '#...............#',
      '#......$........#',
      '#...............#',
      '#........>......#',
      '#...............#',
      '#################',
    ],
    events: {
      '1': {
        kind: 'battle',
        enemies: [
          { species: 'wispling', level: 13 },
          { species: 'gravemaw', level: 13 },
        ],
        intro: narrate('Something cold passes through you. It leaves a shape behind.'),
      },
      '2': {
        kind: 'battle',
        enemies: [
          { species: 'gravemaw', level: 14 },
          { species: 'wispling', level: 13 },
          { species: 'cryptguard', level: 13 },
        ],
      },
    },
    chests: {
      '10,2': { credits: 260, item: 'repairChip', note: 'A traveller who did not leave. Their pack remains.' },
    },
    encounterRate: 0.07,
    encounters: [
      { weight: 3, enemies: [{ species: 'wispling', level: 13 }] },
      { weight: 2, enemies: [{ species: 'gravemaw', level: 14 }] },
      { weight: 2, enemies: [{ species: 'wispling', level: 13 }, { species: 'gravemaw', level: 13 }] },
      { weight: 1, enemies: [{ species: 'cryptguard', level: 14 }] },
    ],
  },

  {
    id: 'haunted-2',
    name: 'Haunted Dungeon — Rotting Nave',
    theme: THEME_DEEP,
    fog: 1.7,
    rows: [
      '#################',
      '#...............#',
      '#..S..D.N......C#',
      '#.....D.N.......#',
      '#....1..........#',
      '#...............#',
      '#....N...D......#',
      '#.......2.......#',
      '#.........>.....#',
      '#...............#',
      '#################',
    ],
    events: {
      '1': {
        kind: 'battle',
        enemies: [
          { species: 'cryptguard', level: 15 },
          { species: 'wispling', level: 14 },
        ],
      },
      '2': {
        kind: 'battle',
        enemies: [
          { species: 'gravemaw', level: 15 },
          { species: 'cryptguard', level: 15 },
          { species: 'wispling', level: 14 },
        ],
        intro: narrate('The nave breathes out. The dark at the far end is thicker than dark should be.'),
      },
    },
    chests: {
      '15,2': { credits: 340, note: 'A reliquary, long since looted of everything but credits.' },
    },
    encounterRate: 0.08,
    encounters: [
      { weight: 3, enemies: [{ species: 'gravemaw', level: 15 }] },
      { weight: 3, enemies: [{ species: 'wispling', level: 14 }] },
      { weight: 2, enemies: [{ species: 'cryptguard', level: 15 }, { species: 'wispling', level: 14 }] },
      { weight: 1, enemies: [{ species: 'cryptguard', level: 16 }, { species: 'gravemaw', level: 15 }] },
    ],
  },

  {
    id: 'haunted-3',
    name: 'Haunted Dungeon — The Deletion',
    theme: THEME_BOSS,
    fog: 1.9,
    rows: [
      '=================',
      '=...............=',
      '=...............=',
      '=...............=',
      '=......1........=',
      '=...............=',
      '=...............=',
      '=......S........=',
      '=...............=',
      '=================',
    ],
    events: {
      '1': {
        kind: 'boss',
        enemies: [{ species: 'revenance', level: 18 }],
        intro: [
          ...narrate('The fog gathers into a shape that remembers being someone.'),
          ...say('Revenance', 'They deleted me. Stay. Keep me company.'),
        ],
        outro: [
          ...say('Revenance', 'At last... quiet.'),
          ...narrate('The haunting lifts. A way home opens in the settling dark.'),
        ],
      },
    },
    chests: {},
    encounterRate: 0.04,
    encounters: [
      { weight: 2, enemies: [{ species: 'wispling', level: 15 }] },
      { weight: 1, enemies: [{ species: 'cryptguard', level: 16 }, { species: 'gravemaw', level: 15 }] },
    ],
  },
];

export const HAUNTED_DUNGEON: Domain = {
  id: 'haunted',
  name: 'Haunted Dungeon',
  blurb: 'A corrupted sector nobody logs out of. The lost still run their last routines here.',
  color: '#b48cff',
  floors: FLOORS,
  startingFuel: 150,
  music: 'haunted',
  onClear: { flag: 'hauntedCleared' },
};
