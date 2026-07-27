import type { TileTheme } from '../engine/TileGrid';
import { narrate, say } from '../systems/dialogue/script';
import type { Domain, DungeonFloor } from './dungeon';

/**
 * The Boot Domain — the tutorial dungeon (plan §5.5).
 *
 * Three small floors: a teaching floor, an element-tile floor, and a boss
 * floor whose accent walls and glowing hallway telegraph what is waiting.
 * See `TileGrid` for the layout legend. The reusable data model lives in
 * `dungeon.ts`; this is just one `Domain`.
 */

// Re-exported for the many modules that still import these from here.
export type { EnemySpec, FloorEvent, EncounterEntry, DungeonFloor } from './dungeon';

const MENTOR = 'Halden';

const THEME_UPPER: TileTheme = {
  floor: '#3a3f57',
  floorAlt: '#2f3449',
  wall: '#4a4560',
  wallTop: '#2b2840',
  accentWall: '#5c3b6e',
};

const THEME_DEEP: TileTheme = {
  floor: '#33405a',
  floorAlt: '#28324a',
  wall: '#3d4a68',
  wallTop: '#232c42',
  accentWall: '#6b3f57',
};

const THEME_BOSS: TileTheme = {
  floor: '#4a3a4e',
  floorAlt: '#3a2d40',
  wall: '#5a3a52',
  wallTop: '#2e2030',
  accentWall: '#8a4a3c',
};

export const BOOT_DOMAIN_FLOORS: DungeonFloor[] = [
  {
    id: 'boot-1',
    name: 'The Quiet Crossing — Surface Cache',
    theme: THEME_UPPER,
    decor: [
      { x: 2, z: 4, kind: 'crate' },
      { x: 13, z: 3, kind: 'rubble', height: 0.6 },
      { x: 14, z: 8, kind: 'crate' },
    ],
    rows: [
      '#################',
      '#......#........#',
      '#..S...#...C....#',
      '#......#........#',
      '#......#........#',
      '#......#..#.....#',
      '#......12.......#',
      '#......#........#',
      '#......#...$....#',
      '#......#....#...#',
      '#......#.....>..#',
      '#......#........#',
      '#################',
    ],
    events: {
      '1': {
        kind: 'dialogue',
        once: true,
        script: [
          ...say(
            MENTOR,
            'Radio check. You are carrying a keeper\'s lantern across the Quiet Crossing — the threshold every soul passes on its way to rest.',
            'Arrow keys or WASD move you one tile at a time. Every step spends a little of your light — watch the meter.',
            'Let it gutter out and the tow line brings you home with the dark unattended.',
          ),
          ...say(MENTOR, 'The soul you bonded with rides in your lantern. It answers for you; you decide how.'),
          ...say(MENTOR, 'What you meet here are echoes — souls still running their last errand. Meet one, and it logs to your Soularium: your book of names, so it is not forgotten twice.'),
        ],
      },
      '2': {
        kind: 'battle',
        enemies: [{ species: 'mitebug', level: 1 }],
        intro: say(MENTOR, 'An echo, and a small one. Open with Attack. You are not hurting it — you are getting its attention.'),
        outro: say(MENTOR, 'Quieted, not slain. Attack costs nothing; Techniques cost MP but reach far deeper.'),
      },
    },
    chests: {
      '11,2': { credits: 180, item: 'repairChip', note: 'Someone abandoned a supply crate up here.' },
    },
    encounterRate: 0,
    encounters: [],
  },

  {
    id: 'boot-2',
    name: 'The Quiet Crossing — Element Strata',
    theme: THEME_DEEP,
    fog: 1.25,
    decor: [
      { x: 2, z: 4, kind: 'rubble', height: 0.6 },
      { x: 13, z: 1, kind: 'crate' },
    ],
    rows: [
      '#################',
      '#...............#',
      '#..S........C...#',
      '#...............#',
      '#...............#',
      '#...............#',
      '########1########',
      '#.......2.......#',
      '#..W.F.N.M.D....#',
      '#...............#',
      '#......>.....$..#',
      '#...............#',
      '#################',
    ],
    events: {
      '1': {
        kind: 'dialogue',
        once: true,
        script: [
          ...say(
            MENTOR,
            'Radio again. The chamber ahead is laid with element tiles — Water, Fire, Nature, Machine, Dark.',
            'Fight while a creature stands on its own element and every hit lands harder.',
          ),
          ...say(MENTOR, 'Class matters more. Assassin beats Mage, Mage beats Hero, Hero beats Assassin.'),
        ],
      },
      '2': {
        kind: 'battle',
        enemies: [{ species: 'sprigling', level: 1 }],
        intro: say(MENTOR, 'Company at the gate. Guard when a creature is about to drop — it soaks the hit and recovers MP.'),
        outro: say(MENTOR, 'Good. The plates and the descent portal are just ahead. The Vigil keeps the floor below — the boundary you will have to satisfy.'),
      },
    },
    chests: {
      '12,2': { credits: 240, note: 'A cracked cache, still holding credits.' },
    },
    encounterRate: 0.06,
    encounters: [
      { weight: 3, enemies: [{ species: 'mitebug', level: 1 }] },
      { weight: 3, enemies: [{ species: 'scrapmite', level: 1 }] },
      { weight: 1, enemies: [{ species: 'sprigling', level: 1 }] },
    ],
  },

  {
    id: 'boot-3',
    name: 'The Quiet Crossing — Warden Hall',
    theme: THEME_BOSS,
    fog: 1.5,
    decor: [
      { x: 2, z: 2, kind: 'rubble', height: 0.6 },
      { x: 14, z: 2, kind: 'rubble', height: 0.6 },
    ],
    rows: [
      '=================',
      '=...............=',
      '=...............=',
      '=...=========...=',
      '=...=F.....F=...=',
      '=...=.......=...=',
      '=...=..D.D..=...=',
      '=...=.......=...=',
      '=...=...1...=...=',
      '=...=...2...=...=',
      '=...====.====...=',
      '=......S........=',
      '=================',
    ],
    events: {
      '2': {
        kind: 'dialogue',
        once: true,
        script: [
          ...say(MENTOR, 'Stop. The Vigil stands the far end of this hall. It keeps the boundary — it decides who is fit to carry a light past the Crossing.'),
          ...narrate('Something heavy shifts at the far end of the hallway.'),
          ...say(MENTOR, 'It stands like a Hero — armoured, certain. A Mage reaches past armour; lead with one if you have bonded one.'),
        ],
      },
      '1': {
        kind: 'boss',
        enemies: [{ species: 'regalion', level: 2 }],
        intro: [
          ...narrate('The Vigil rises out of the dark and fills the hallway — a keeper older than the Crossing itself.'),
          ...say('the Vigil', 'A new lantern, still warm. Show me you can hold it steady before I let you carry it where the dark is deeper.'),
        ],
        outro: [
          ...say('the Vigil', 'Steady enough. Go on, keeper. What waits past me will not ask so gently.'),
          ...say(MENTOR, 'The Vigil stands aside. Take the way it opened — you have your keeper\'s leave now.'),
        ],
      },
    },
    chests: {},
    encounterRate: 0.04,
    encounters: [
      { weight: 2, enemies: [{ species: 'gloomote', level: 1 }] },
      { weight: 2, enemies: [{ species: 'mitebug', level: 1 }] },
      { weight: 1, enemies: [{ species: 'dropletta', level: 1 }] },
    ],
  },
];

export const BOOT_DOMAIN: Domain = {
  id: 'boot',
  name: 'The Quiet Crossing',
  blurb: 'The threshold every soul passes on its way to rest. Quiet, mostly — which is why new keepers learn to carry a lantern here.',
  color: '#ffa64d',
  recommendedLevel: 1,
  floors: BOOT_DOMAIN_FLOORS,
  startingFuel: 120,
  music: 'dungeon',
  onClear: { flag: 'bootDomainCleared', licenseCeremony: true },
};
