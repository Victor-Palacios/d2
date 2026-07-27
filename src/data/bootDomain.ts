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

const MENTOR = 'Dr. Halden';

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
            'Radio check. You are driving a training beetle through the Quiet Crossing.',
            'Arrow keys or WASD move you one tile at a time. Every step burns 1 EP — watch the meter.',
            'Run dry and the tow line drags you home with nothing to show for it.',
          ),
          ...say(MENTOR, 'Your partner rides in the back. It fights; you decide how.'),
          ...say(MENTOR, 'Syphon anything you meet — hit a wild soul and it logs to your Soularium.'),
        ],
      },
      '2': {
        kind: 'battle',
        enemies: [{ species: 'mitebug', level: 1 }],
        intro: say(MENTOR, 'One mitebug. Open with Attack and watch what the numbers do.'),
        outro: say(MENTOR, 'Clean. Attack costs nothing; Techniques cost MP but hit far harder.'),
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
        outro: say(MENTOR, 'Good. The plates and the descent portal are just ahead. The warden is on the next floor down.'),
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
          ...say(MENTOR, 'Stop. Those walls are warden-marked, and the hall ahead is lit for a reason.'),
          ...narrate('Something heavy shifts at the far end of the hallway.'),
          ...say(MENTOR, 'It is a Hero — armoured, and it knows it. A Mage cuts straight through that; lead with one if your team has it.'),
        ],
      },
      '1': {
        kind: 'boss',
        enemies: [{ species: 'regalion', level: 2 }],
        intro: [
          ...narrate('The warden rises out of the dark and fills the hallway.'),
          ...say('Regalion', 'A training beetle. In MY domain.'),
        ],
        outro: [
          ...say('Regalion', 'Licensed, then. Go on. The deeper domains will not be this polite.'),
          ...say(MENTOR, 'Warden down. Take the portal it left behind — you have earned your license.'),
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
  blurb: 'Training sector. Low corruption, one registered warden. Every licence starts here.',
  color: '#ffa64d',
  recommendedLevel: 1,
  floors: BOOT_DOMAIN_FLOORS,
  startingFuel: 120,
  music: 'dungeon',
  onClear: { flag: 'bootDomainCleared', licenseCeremony: true },
};
