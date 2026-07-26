import type { TileTheme } from '../engine/TileGrid';
import type { DialogueScript } from '../systems/dialogue/script';
import { narrate, say } from '../systems/dialogue/script';

/**
 * The Boot Domain — the tutorial dungeon (plan §5.5).
 *
 * Three small floors: a teaching floor, an element-tile floor, and a boss
 * floor whose accent walls and glowing hallway telegraph what is waiting.
 * See `TileGrid` for the layout legend.
 */

export interface EnemySpec {
  species: string;
  level: number;
}

export type FloorEvent =
  | { kind: 'dialogue'; script: DialogueScript; once?: boolean }
  | { kind: 'battle'; enemies: EnemySpec[]; intro?: DialogueScript; outro?: DialogueScript }
  | { kind: 'boss'; enemies: EnemySpec[]; intro?: DialogueScript; outro?: DialogueScript };

export interface EncounterEntry {
  weight: number;
  enemies: EnemySpec[];
}

export interface DungeonFloor {
  id: string;
  name: string;
  rows: string[];
  theme: TileTheme;
  events: Record<string, FloorEvent>;
  chests: Record<string, { credits?: number; item?: string; note: string }>;
  /** Chance per step of a random encounter (0 disables). */
  encounterRate: number;
  encounters: EncounterEntry[];
  /** Fog density multiplier, so deeper floors feel heavier. */
  fog?: number;
}

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
    name: 'Boot Domain — Surface Cache',
    theme: THEME_UPPER,
    rows: [
      '#################',
      '#......#........#',
      '#..S...#...C....#',
      '#......#........#',
      '#..1...#........#',
      '#......#..#.....#',
      '#...............#',
      '#......#........#',
      '#..2...#...$....#',
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
            'Radio check. You are driving a training beetle through the Boot Domain.',
            'Arrow keys or WASD move you one tile at a time. Every step burns 1 EP — watch the meter.',
            'Run dry and the tow line drags you home with nothing to show for it.',
          ),
          ...say(MENTOR, 'The three creatures I lent you are in the back. They fight; you decide how.'),
        ],
      },
      '2': {
        kind: 'battle',
        enemies: [
          { species: 'mitebug', level: 6 },
          { species: 'mitebug', level: 6 },
        ],
        intro: say(MENTOR, 'Two mitebugs. Perfect. Open with Attack and watch what the numbers do.'),
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
    name: 'Boot Domain — Element Strata',
    theme: THEME_DEEP,
    fog: 1.25,
    rows: [
      '#################',
      '#...............#',
      '#..S...W.......C#',
      '#......F........#',
      '#.WFNMD...1.....#',
      '#......N........#',
      '#......M........#',
      '#...............#',
      '#..###....###...#',
      '#..#$#....#2#...#',
      '#..#.#....#.#...#',
      '#.............>.#',
      '#################',
    ],
    events: {
      '1': {
        kind: 'dialogue',
        once: true,
        script: [
          ...say(
            MENTOR,
            'Those glowing plates are element tiles — Water, Fire, Nature, Machine, Dark.',
            'Fight while your team is standing on its own element and every hit lands harder.',
          ),
          ...say(MENTOR, 'Attribute matters more. Alpha beats Gamma, Gamma beats Beta, Beta beats Alpha.'),
        ],
      },
      '2': {
        kind: 'battle',
        enemies: [
          { species: 'scrapmite', level: 7 },
          { species: 'sprigling', level: 7 },
          { species: 'mitebug', level: 6 },
        ],
        intro: say(MENTOR, 'Three of them. Guard when a creature is about to drop — it soaks the hit and recovers MP.'),
        outro: say(MENTOR, 'Good. The descent portal is south-east. The warden is on the next floor down.'),
      },
    },
    chests: {
      '15,2': { credits: 240, note: 'A cracked cache, still holding credits.' },
    },
    encounterRate: 0.06,
    encounters: [
      { weight: 3, enemies: [{ species: 'mitebug', level: 6 }] },
      { weight: 3, enemies: [{ species: 'scrapmite', level: 7 }] },
      { weight: 2, enemies: [{ species: 'mitebug', level: 6 }, { species: 'scrapmite', level: 6 }] },
      { weight: 1, enemies: [{ species: 'sprigling', level: 8 }] },
    ],
  },

  {
    id: 'boot-3',
    name: 'Boot Domain — Warden Hall',
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
          ...say(MENTOR, 'It is an Alpha. Beta hits it hardest. Fenrix is your opener.'),
        ],
      },
      '1': {
        kind: 'boss',
        enemies: [{ species: 'regalion', level: 13 }],
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
      { weight: 2, enemies: [{ species: 'gloomote', level: 8 }] },
      { weight: 2, enemies: [{ species: 'mitebug', level: 7 }, { species: 'mitebug', level: 7 }] },
      { weight: 1, enemies: [{ species: 'dropletta', level: 9 }] },
    ],
  },
];

export const BOOT_DOMAIN = {
  id: 'boot',
  name: 'Boot Domain',
  blurb: 'Training sector. Low corruption, one registered warden. Every licence starts here.',
  floors: BOOT_DOMAIN_FLOORS,
  /** The trio the mentor lends you for the tutorial crawl (plan §5.5). */
  borrowedParty: [
    { species: 'bulwarq', level: 12 },
    { species: 'fenrix', level: 12 },
    { species: 'gloomote', level: 11 },
  ] as EnemySpec[],
  startingFuel: 120,
};
