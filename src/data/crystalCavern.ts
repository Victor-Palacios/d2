import { narrate, say } from '../systems/dialogue/script';
import type { Domain, DungeonFloor } from './dungeon';

/**
 * Crystal Cavern — a free-select domain (not on the tutorial path).
 *
 * Cold, bright, refractive. Leans on Water + Machine element plates and its own
 * roster (Shardling / Prismoth / Geodon), warded by Glaciark. Pure data — see
 * `dungeon.ts` for the model and `docs/ROADMAP.md` for how domains slot in.
 */

const THEME_UPPER = {
  floor: '#26424f',
  floorAlt: '#1e3540',
  wall: '#2f5566',
  wallTop: '#16323d',
  accentWall: '#3f7f96',
};

const THEME_DEEP = {
  floor: '#22323f',
  floorAlt: '#1a2833',
  wall: '#2a4a5a',
  wallTop: '#132631',
  accentWall: '#3a6f88',
};

const THEME_BOSS = {
  floor: '#2b3a4a',
  floorAlt: '#20303f',
  wall: '#35526b',
  wallTop: '#182530',
  accentWall: '#5fb0d0',
};

const FLOORS: DungeonFloor[] = [
  {
    id: 'crystal-1',
    name: 'Crystal Cavern — Glimmer Shelf',
    theme: THEME_UPPER,
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
          { species: 'shardling', level: 5 },
          { species: 'prismoth', level: 5 },
        ],
        intro: narrate('Light scatters off a shelf of living crystal — and it turns toward you.'),
      },
      '2': {
        kind: 'battle',
        enemies: [
          { species: 'shardling', level: 6 },
          { species: 'geodon', level: 6 },
          { species: 'prismoth', level: 5 },
        ],
      },
    },
    chests: {
      '10,2': { credits: 220, item: 'repairChip', note: 'A prospector left a crate wedged in the ice.' },
    },
    encounterRate: 0.06,
    encounters: [
      { weight: 3, enemies: [{ species: 'shardling', level: 5 }] },
      { weight: 2, enemies: [{ species: 'prismoth', level: 6 }] },
      { weight: 2, enemies: [{ species: 'shardling', level: 5 }, { species: 'prismoth', level: 5 }] },
      { weight: 1, enemies: [{ species: 'geodon', level: 7 }] },
    ],
  },

  {
    id: 'crystal-2',
    name: 'Crystal Cavern — Frozen Vault',
    theme: THEME_DEEP,
    fog: 1.2,
    rows: [
      '#################',
      '#...............#',
      '#..S..W.M......C#',
      '#.....W.M.......#',
      '#....1..........#',
      '#...............#',
      '#....M...W......#',
      '#.......2.......#',
      '#.........>.....#',
      '#...............#',
      '#################',
    ],
    events: {
      '1': {
        kind: 'battle',
        enemies: [
          { species: 'geodon', level: 7 },
          { species: 'shardling', level: 7 },
        ],
      },
      '2': {
        kind: 'battle',
        enemies: [
          { species: 'prismoth', level: 8 },
          { species: 'prismoth', level: 7 },
          { species: 'geodon', level: 7 },
        ],
        intro: narrate('The vault hums. Something big is keeping the cold in here.'),
      },
    },
    chests: {
      '15,2': { credits: 300, note: 'A frozen cache, credits still legible under the frost.' },
    },
    encounterRate: 0.07,
    encounters: [
      { weight: 3, enemies: [{ species: 'shardling', level: 7 }] },
      { weight: 3, enemies: [{ species: 'geodon', level: 7 }] },
      { weight: 2, enemies: [{ species: 'prismoth', level: 8 }, { species: 'shardling', level: 7 }] },
      { weight: 1, enemies: [{ species: 'geodon', level: 8 }, { species: 'prismoth', level: 8 }] },
    ],
  },

  {
    id: 'crystal-3',
    name: 'Crystal Cavern — Warden Vault',
    theme: THEME_BOSS,
    fog: 1.4,
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
        enemies: [{ species: 'glaciark', level: 9 }],
        intro: [
          ...narrate('The far wall unfolds. It was never a wall.'),
          ...say('Glaciark', 'You brought warmth into my vault. I will fix that.'),
        ],
        outro: [
          ...say('Glaciark', 'Melting... how novel.'),
          ...narrate('The cavern quiets. A portal home glimmers open behind you.'),
        ],
      },
    },
    chests: {},
    encounterRate: 0.03,
    encounters: [
      { weight: 2, enemies: [{ species: 'shardling', level: 8 }] },
      { weight: 1, enemies: [{ species: 'prismoth', level: 8 }, { species: 'geodon', level: 8 }] },
    ],
  },
];

export const CRYSTAL_CAVERN: Domain = {
  id: 'crystal',
  name: 'Crystal Cavern',
  blurb: 'A supercooled data-vault, bright and sharp. Its warden has never felt warmth.',
  color: '#6fe0ff',
  recommendedLevel: 5,
  floors: FLOORS,
  startingFuel: 130,
  music: 'crystal',
  onClear: { flag: 'crystalCleared' },
};
