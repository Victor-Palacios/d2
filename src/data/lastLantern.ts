import { narrate, say } from '../systems/dialogue/script';
import type { TileTheme } from '../engine/TileGrid';
import type { Reach, DungeonFloor } from './dungeon';

/**
 * The Last Lantern — the finale reach (Act III). Opens only after the midpoint
 * (`requires: 'actTwo'`), the deepest dark past every other reach. It is where
 * the souls keepers refused to release are still held — and where the one you
 * have searched for since the prologue waits.
 *
 * Floors 1–2 are the descent, carrying the companions' Act-III beats (each
 * borrows from the opponent they used to be). Floor 3 is not a fight but the
 * finale **choice** — keep the soul, or let it cross — handled by
 * `DungeonScene.runFinale`. See docs/NARRATIVE.md §11c.
 */

const THEME_UPPER: TileTheme = {
  floor: '#15141d',
  floorAlt: '#100f17',
  wall: '#232030',
  wallTop: '#0b0a12',
  accentWall: '#4a3a6a',
  terrain: 'cave',
  wallHeight: 3.4,
  fogColor: '#070610',
};

const THEME_DEEP: TileTheme = {
  floor: '#100f16',
  floorAlt: '#0b0a10',
  wall: '#1c1a26',
  wallTop: '#08070d',
  accentWall: '#5a4630',
  terrain: 'crypt',
  wallHeight: 3.6,
  fogColor: '#050409',
};

const THEME_FINALE: TileTheme = {
  floor: '#1a1622',
  floorAlt: '#131019',
  wall: '#2a2233',
  wallTop: '#0d0a12',
  accentWall: '#ffcf7a',
  terrain: 'cave',
  wallHeight: 3.6,
  fogColor: '#0a0712',
};

const FLOORS: DungeonFloor[] = [
  {
    id: 'lantern-1',
    name: 'The Last Lantern — Ashfall',
    theme: THEME_UPPER,
    fog: 1.5,
    decor: [
      { x: 3, z: 3, kind: 'gravestone', height: 0.9 },
      { x: 13, z: 3, kind: 'gravestone', height: 0.9 },
      { x: 7, z: 6, kind: 'mushroomGlow', height: 0.5, emissive: 0.5 },
      { x: 9, z: 8, kind: 'mushroomGlow', height: 0.5, emissive: 0.5 },
    ],
    rows: [
      '#################',
      '#...............#',
      '#..S.......C....#',
      '#......###......#',
      '#..1...........2#',
      '#......###......#',
      '#...............#',
      '#.........>.....#',
      '#...............#',
      '#################',
    ],
    events: {
      '1': {
        kind: 'dialogue',
        once: true,
        script: [
          ...narrate('The ash never settles here. Every step you have not taken is under your feet.'),
          ...say('Wren', 'I have carried this Book down every reach. I never once tore a page out.'),
          ...say(
            'Wren',
            'Here, at the end, I finally understand Halden. A name kept forever is not remembered — it is imprisoned. Tonight I will learn to close a page on purpose.',
          ),
        ],
      },
      '2': {
        kind: 'battle',
        enemies: [
          { species: 'emberkeep', level: 9 },
          { species: 'ashmoth', level: 9 },
        ],
        intro: narrate('Held souls drift out of the dark — kept so long they have forgotten they were ever let go of.'),
      },
    },
    chests: {
      '11,2': {
        obols: 500,
        item: 'mendingBalm',
        note: "A keeper's pack, left at the top of the last descent. They did not come back up.",
      },
    },
    encounterRate: 0.05,
    encounters: [
      { weight: 3, enemies: [{ species: 'ashmoth', level: 9 }] },
      {
        weight: 2,
        enemies: [
          { species: 'emberkeep', level: 9 },
          { species: 'grievewisp', level: 9 },
        ],
      },
      { weight: 1, enemies: [{ species: 'everember', level: 9 }] },
    ],
  },

  {
    id: 'lantern-2',
    name: 'The Last Lantern — The Held',
    theme: THEME_DEEP,
    fog: 1.7,
    decor: [
      { x: 4, z: 4, kind: 'mushroomGlow', height: 0.5, emissive: 0.6 },
      { x: 12, z: 4, kind: 'mushroomGlow', height: 0.5, emissive: 0.6 },
      { x: 8, z: 7, kind: 'gravestone', height: 1.0 },
    ],
    rows: [
      '#################',
      '#...............#',
      '#..S....1.......#',
      '#.....#####.....#',
      '#..2............#',
      '#.....#####.....#',
      '#............3..#',
      '#....>..........#',
      '#.C.............#',
      '#################',
    ],
    events: {
      '1': {
        kind: 'dialogue',
        once: true,
        script: [
          ...narrate(
            'The walls are lined with lanterns, each holding a small, still flame. None of them move. None of them go out.',
          ),
          ...say(
            'Sena Vale',
            'This is what I was. A whole hall of it. Someone stood here and froze every one of these, the way I froze Lire.',
          ),
          ...say('Sena Vale', 'Watch.'),
          ...narrate(
            'She cups her hands around the nearest flame — and, for the first time, warms it instead of freezing it. It flares, sighs, and goes gently out. Crossed.',
          ),
          ...say('Sena Vale', 'There. The other kind of love. It is so much harder than the cold.'),
        ],
      },
      '2': {
        kind: 'battle',
        enemies: [
          { species: 'keptsoul', level: 9 },
          { species: 'grievewisp', level: 9 },
        ],
      },
      '3': {
        kind: 'dialogue',
        once: true,
        script: [
          ...say(
            'Kade',
            'This is as far as I ever got. Every time. I would reach this dark and turn and run the next reach instead.',
          ),
          ...narrate('Kade stops. Plants his feet. Does not run.'),
          ...say('Kade', 'Not tonight. Tonight I stand still. Whatever is down there, we walk into it at your pace.'),
        ],
      },
    },
    chests: {
      '2,8': { obols: 640, note: 'A cache no one lived to spend.' },
    },
    encounterRate: 0.06,
    encounters: [
      { weight: 3, enemies: [{ species: 'keptsoul', level: 9 }] },
      {
        weight: 2,
        enemies: [
          { species: 'wardling', level: 9 },
          { species: 'emberkeep', level: 9 },
        ],
      },
      { weight: 1, enemies: [{ species: 'lanternlord', level: 9 }] },
    ],
  },

  {
    id: 'lantern-3',
    name: 'The Last Lantern — The Flame',
    theme: THEME_FINALE,
    fog: 1.8,
    decor: [
      { x: 4, z: 3, kind: 'mushroomGlow', height: 0.6, emissive: 0.7 },
      { x: 12, z: 3, kind: 'mushroomGlow', height: 0.6, emissive: 0.7 },
      { x: 6, z: 5, kind: 'mushroomGlow', height: 0.6, emissive: 0.7 },
      { x: 10, z: 5, kind: 'mushroomGlow', height: 0.6, emissive: 0.7 },
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
      '1': { kind: 'finale' },
    },
    chests: {},
    encounterRate: 0,
    encounters: [],
  },
];

export const LAST_LANTERN: Reach = {
  id: 'lantern',
  name: 'The Last Lantern',
  blurb:
    'The deepest dark, past every reach — where the souls no keeper could release are still held, and where the one you have looked for is waiting. It opens only once you understand what it costs.',
  color: '#ffd27a',
  recommendedLevel: 9,
  floors: FLOORS,
  startingLight: 200,
  music: 'haunted',
  onClear: { flag: 'lastLanternCleared' },
  requires: 'actTwo',
};
