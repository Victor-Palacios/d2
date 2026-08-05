import { narrate, say } from '../systems/dialogue/script';
import type { TileTheme } from '../engine/TileGrid';
import type { Reach, DungeonFloor } from './dungeon';

/**
 * The Last Lantern — the finale reach (Act III). Opens only after the midpoint
 * (`requires: 'actTwo'`), the deepest dark past every other reach. It is where
 * the souls keepers refused to release are still held — and where the one you
 * have searched for since the prologue waits.
 *
 * Floors 1–2 carry the companions' Act-III beats (each borrows from the opponent
 * they used to be); floors 3–6 are the long descent, voiced by short companion
 * beats as the dark deepens. Floor 7 is not a fight but the finale **choice** —
 * keep the soul, or let it cross — handled by `DungeonScene.runFinale`. See
 * docs/NARRATIVE.md §11c.
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
  terrain: 'cave',
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
          { species: 'emberward', level: 9 },
          { species: 'vowkeeper', level: 9 },
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
      { weight: 3, enemies: [{ species: 'vowkeeper', level: 9 }] },
      {
        weight: 2,
        enemies: [
          { species: 'emberward', level: 9 },
          { species: 'stillguard', level: 9 },
        ],
      },
      { weight: 1, enemies: [{ species: 'ashkeeper', level: 9 }] },
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
        kind: 'boss',
        enemies: [{ species: 'lanternlord', level: 10 }],
        intro: [
          ...narrate(
            'The hall opens, and the greatest of the keepers is waiting — a lord of leaded glass crowned in a flame that never falls. Every soul in these walls, it kept.',
          ),
          ...say(
            'the Lanternlord',
            'You carry a lantern too. Then you know. It is unbearable to let a light go out. Turn back — help me hold them, and never lose one again.',
          ),
        ],
        outro: [
          ...say(
            'the Lanternlord',
            'You would open your hands. After everything. ...Perhaps that is the braver keeping.',
          ),
          ...narrate('The great keeper dims, and lets you by. Only the last flame waits beyond, now.'),
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
      { weight: 3, enemies: [{ species: 'heldshade', level: 9 }] },
      {
        weight: 2,
        enemies: [
          { species: 'wardling', level: 9 },
          { species: 'keptsoul', level: 9 },
        ],
      },
      { weight: 1, enemies: [{ species: 'reliquary', level: 9 }] },
    ],
  },

  {
    id: 'lantern-3',
    name: 'The Last Lantern — The Long Dark',
    theme: THEME_DEEP,
    fog: 1.7,
    decor: [
      { x: 2, z: 4, kind: 'gravestone' },
      { x: 14, z: 4, kind: 'boneheap', height: 0.7 },
      { x: 2, z: 9, kind: 'mushroomGlow', height: 0.5, emissive: 0.6 },
    ],
    rows: [
      '#################',
      '#......S........#',
      '#.......1.......#',
      '#..###.....###..#',
      '#..#.........#..#',
      '#..#....2....#..#',
      '#..#.........#..#',
      '#..###.....###..#',
      '#.C.....$.3.....#',
      '#.........>.....#',
      '#################',
    ],
    events: {
      '1': {
        kind: 'battle',
        enemies: [
          { species: 'emberward', level: 9 },
          { species: 'wardling', level: 9 },
        ],
        intro: narrate(
          'The last of the lantern-glow falls away behind you. Ahead there is only the dark, and the things that kept it.',
        ),
      },
      '2': {
        kind: 'battle',
        enemies: [
          { species: 'keptsoul', level: 9 },
          { species: 'emberward', level: 9 },
        ],
      },
      // Descent beat. Act III — all three companions are aboard by now.
      '3': {
        kind: 'dialogue',
        once: true,
        script: [
          ...narrate(
            'The lantern-glow is gone. There is only the small light you carry, and the sound of four sets of footsteps keeping time.',
          ),
          ...say(
            'Wren',
            'I could read a name aloud. For the warmth of it. To have a voice down here that is not the dark.',
          ),
          ...say(
            'Kade',
            'Leave it. Let the dark be dark. We did not come this far to fill it with noise — we came to walk through it.',
          ),
        ],
      },
    },
    chests: {
      '2,8': {
        obols: 400,
        item: 'lightShard',
        note: 'A keeper who came this far, and no further, left their reserve.',
      },
    },
    encounterRate: 0.08,
    encounters: [
      { weight: 3, enemies: [{ species: 'emberward', level: 9 }] },
      { weight: 2, enemies: [{ species: 'wardling', level: 9 }] },
      {
        weight: 2,
        enemies: [
          { species: 'keptsoul', level: 9 },
          { species: 'emberward', level: 9 },
        ],
      },
      { weight: 1, enemies: [{ species: 'vowkeeper', level: 9 }] },
    ],
  },

  {
    id: 'lantern-4',
    name: 'The Last Lantern — The Unlit Stair',
    theme: THEME_DEEP,
    fog: 1.7,
    decor: [
      { x: 14, z: 1, kind: 'gravestone' },
      { x: 14, z: 3, kind: 'mushroomGlow', height: 0.5, emissive: 0.6 },
      { x: 2, z: 9, kind: 'boneheap', height: 0.7 },
    ],
    rows: [
      '#################',
      '#.S.............#',
      '#....#...#...#..#',
      '#.......2.......#',
      '#..#...#...#....#',
      '#....1.....#....#',
      '#...#...#...#...#',
      '#.......$.......#',
      '#..#...#..3#..C.#',
      '#.........>.....#',
      '#################',
    ],
    events: {
      '1': {
        kind: 'battle',
        enemies: [
          { species: 'wardling', level: 9 },
          { species: 'vowkeeper', level: 9 },
        ],
      },
      '2': {
        kind: 'battle',
        enemies: [
          { species: 'stillguard', level: 9 },
          { species: 'keptsoul', level: 9 },
        ],
        intro: narrate(
          'The stair goes down and down, every lamp along it long since drowned. You count the steps to keep from counting the quiet.',
        ),
      },
      // Descent beat — Kade, who always turned back at this dark, keeps walking.
      '3': {
        kind: 'dialogue',
        once: true,
        script: [
          ...narrate('Kade counts the steps under his breath, and does not stop counting, and does not stop walking.'),
          ...say(
            'Kade',
            'This is the part I always ran from. Where it stops feeling like a rescue and starts feeling like a grave.',
          ),
          ...say(
            'Sena Vale',
            'Then it is good you are not walking it alone this time. None of us is. Keep counting. We are right behind you.',
          ),
        ],
      },
    },
    chests: {
      '14,8': { obols: 440, note: 'A satchel abandoned on the stair, its owner nowhere.' },
    },
    encounterRate: 0.09,
    encounters: [
      { weight: 3, enemies: [{ species: 'vowkeeper', level: 9 }] },
      { weight: 2, enemies: [{ species: 'wardling', level: 9 }] },
      {
        weight: 2,
        enemies: [
          { species: 'stillguard', level: 9 },
          { species: 'vowkeeper', level: 9 },
        ],
      },
      { weight: 1, enemies: [{ species: 'reliquary', level: 9 }] },
    ],
  },

  {
    id: 'lantern-5',
    name: 'The Last Lantern — The Drowned Vestibule',
    theme: THEME_DEEP,
    fog: 1.8,
    decor: [
      { x: 2, z: 2, kind: 'deadTree', height: 1.6 },
      { x: 14, z: 3, kind: 'gravestone' },
      { x: 2, z: 8, kind: 'mushroomGlow', height: 0.5, emissive: 0.6 },
    ],
    rows: [
      '#################',
      '#.S.....#......$#',
      '#.......#.......#',
      '#...1...#...2...#',
      '#.......#.......#',
      '#####.###.#####.#',
      '#...............#',
      '#.......#.......#',
      '#.......#.....C.#',
      '#...>...#.......#',
      '#################',
    ],
    events: {
      '1': {
        kind: 'battle',
        enemies: [
          { species: 'keptsoul', level: 9 },
          { species: 'stillguard', level: 9 },
        ],
        intro: narrate(
          'A flooded antechamber, black water to the ankle. Faces turn just under the surface, and do not rise.',
        ),
      },
      '2': {
        kind: 'battle',
        enemies: [
          { species: 'reliquary', level: 9 },
          { species: 'emberward', level: 9 },
        ],
      },
    },
    chests: {
      '14,8': { obols: 480, item: 'focusDraught', note: 'A reliquary sealed against the damp, and still dry inside.' },
    },
    encounterRate: 0.09,
    encounters: [
      { weight: 3, enemies: [{ species: 'keptsoul', level: 9 }] },
      { weight: 2, enemies: [{ species: 'reliquary', level: 9 }] },
      {
        weight: 2,
        enemies: [
          { species: 'stillguard', level: 9 },
          { species: 'keptsoul', level: 9 },
        ],
      },
      { weight: 1, enemies: [{ species: 'lanternlord', level: 9 }] },
    ],
  },

  {
    id: 'lantern-6',
    name: 'The Last Lantern — The Threshold',
    theme: THEME_DEEP,
    fog: 1.8,
    decor: [
      { x: 1, z: 1, kind: 'gravestone' },
      { x: 15, z: 1, kind: 'gravestone' },
      { x: 1, z: 9, kind: 'boneheap', height: 0.7 },
    ],
    rows: [
      '#################',
      '#......S........#',
      '#.....#...#.....#',
      '#....#.....#....#',
      '#...#..1.2..#...#',
      '#..#.........#..#',
      '#...#.......#...#',
      '#....#.....#....#',
      '#.....#3$.#....C#',
      '#......>........#',
      '#################',
    ],
    events: {
      '1': {
        kind: 'battle',
        enemies: [
          { species: 'lanternlord', level: 9 },
          { species: 'wardling', level: 9 },
        ],
        intro: narrate(
          'One door left. Beyond it, a light — not held, not frozen, just burning, the way you had almost forgotten light could.',
        ),
      },
      '2': {
        kind: 'battle',
        enemies: [
          { species: 'reliquary', level: 9 },
          { species: 'stillguard', level: 9 },
        ],
      },
      // Threshold beat — the last words before the finale choice on the floor below.
      '3': {
        kind: 'dialogue',
        once: true,
        script: [
          ...narrate(
            'One door left, and a light beneath it — steady, unhidden, burning the way a light burns when no one is holding it too tightly.',
          ),
          ...say('Wren', 'Whoever you have looked for since the beginning — they are just beyond that door.'),
          ...say(
            'Sena Vale',
            'Halden taught you both endings. Keep them, or open your hands. Whichever you choose in there, choose it — do not let the reach choose for you.',
          ),
          ...say('Kade', 'We will be right here when you come back out. However you come back out.'),
        ],
      },
    },
    chests: {
      '15,8': {
        obols: 520,
        item: 'lightShard',
        note: 'The last cache before the flame. Whoever left it did not come back for it.',
      },
    },
    encounterRate: 0.08,
    encounters: [
      { weight: 2, enemies: [{ species: 'lanternlord', level: 9 }] },
      { weight: 2, enemies: [{ species: 'reliquary', level: 9 }] },
      {
        weight: 1,
        enemies: [
          { species: 'stillguard', level: 9 },
          { species: 'wardling', level: 9 },
        ],
      },
    ],
  },

  {
    id: 'lantern-7',
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
  startingLight: 300,
  music: 'haunted',
  onClear: { flag: 'lastLanternCleared' },
  requires: 'actTwo',
};
