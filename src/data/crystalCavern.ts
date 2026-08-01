import { narrate, say } from '../systems/dialogue/script';
import type { TileTheme } from '../engine/TileGrid';
import type { Reach, DungeonFloor } from './dungeon';

/**
 * The Reliquary — a free-select reach (not on the tutorial path).
 *
 * Cold, bright, refractive. Its terrain is faceted crystal with a tall,
 * symmetric geometry (a machine vault at its heart), tinted with icy fog and
 * dressed in crystal columns and ice shards — a deliberate contrast with the
 * broken, organic Unremembered. Leans on Water + Machine element plates and its
 * hero roster (Geodon / Shieldshard / Geomote / Prismguard), warded by Vaultwarden. Pure data —
 * see `dungeon.ts` for the model and `docs/ROADMAP.md` for how reaches slot in.
 */

const THEME_UPPER: TileTheme = {
  floor: '#26424f',
  floorAlt: '#1e3540',
  wall: '#2f5566',
  wallTop: '#16323d',
  accentWall: '#3f7f96',
  terrain: 'crystal',
  wallHeight: 3.0,
  fogColor: '#0c2530',
};

const THEME_DEEP: TileTheme = {
  floor: '#2a3340',
  floorAlt: '#1f2731',
  wall: '#3a4656',
  wallTop: '#151c25',
  accentWall: '#5a86a8',
  terrain: 'metal',
  wallHeight: 2.9,
  fogColor: '#0a1a22',
};

const THEME_BOSS: TileTheme = {
  floor: '#2b3a4a',
  floorAlt: '#20303f',
  wall: '#35526b',
  wallTop: '#182530',
  accentWall: '#5fb0d0',
  terrain: 'crystal',
  wallHeight: 3.3,
  fogColor: '#0e2a38',
};

const FLOORS: DungeonFloor[] = [
  {
    id: 'crystal-1',
    name: 'The Reliquary — Glimmer Shelf',
    theme: THEME_UPPER,
    decor: [
      { x: 8, z: 3, kind: 'crystalPillar', height: 1.6, emissive: 0.5 },
      { x: 8, z: 5, kind: 'crystalPillar', height: 1.6, emissive: 0.5 },
      { x: 14, z: 6, kind: 'crystalCluster', emissive: 0.6 },
      { x: 13, z: 7, kind: 'iceShard', height: 0.8, emissive: 0.4 },
    ],
    rows: [
      '#################',
      '#...............#',
      '#..S........2..C#',
      '#.....##.##.....#',
      '#....1..........#',
      '#.....##.##.....#',
      '#WWWW...........#',
      '#W3WW..$........#',
      '#WWWW....>......#',
      '#WWWW...........#',
      '#################',
    ],
    events: {
      '1': {
        kind: 'battle',
        enemies: [
          { species: 'shieldshard', level: 3 },
          { species: 'prismguard', level: 3 },
        ],
        intro: narrate('Light scatters off a shelf of living crystal — and it turns toward you.'),
      },
      '2': {
        kind: 'battle',
        enemies: [
          { species: 'shieldshard', level: 3 },
          { species: 'geodon', level: 3 },
        ],
      },
      // The Unweeping — an Anchored on a mass of black ice. Well above the
      // Reliquary's level; come back matched to water. Not consumed on loss.
      '3': { kind: 'anchored', id: 'crystalAnchored' },
    },
    chests: {
      '15,2': { obols: 220, item: 'mendingBalm', note: 'A prospector left a crate wedged in the ice.' },
    },
    encounterRate: 0.06,
    encounters: [
      { weight: 3, enemies: [{ species: 'geomote', level: 3 }] },
      { weight: 2, enemies: [{ species: 'prismguard', level: 3 }] },
      {
        weight: 2,
        enemies: [
          { species: 'shieldshard', level: 3 },
          { species: 'prismguard', level: 3 },
        ],
      },
      { weight: 1, enemies: [{ species: 'geodon', level: 3 }] },
    ],
  },

  {
    id: 'crystal-2',
    name: 'The Reliquary — Frozen Vault',
    theme: THEME_DEEP,
    fog: 1.2,
    decor: [
      { x: 5, z: 4, kind: 'machinePylon', height: 1.4, emissive: 0.4 },
      { x: 8, z: 4, kind: 'conduit', height: 1.0, emissive: 0.5 },
      { x: 14, z: 5, kind: 'conduit', height: 1.0, emissive: 0.5 },
      { x: 12, z: 8, kind: 'machinePylon', height: 1.4, emissive: 0.4 },
      { x: 2, z: 8, kind: 'iceShard', height: 0.8, emissive: 0.4 },
    ],
    rows: [
      '#################',
      '#...............#',
      '#..S...W.M.....C#',
      '#......###.###..#',
      '#..1...#.....#..#',
      '#......#.....#..#',
      '#..W...#..2..#..#',
      '#..M...#######..#',
      '#..........>....#',
      '#...............#',
      '#################',
    ],
    events: {
      '1': {
        kind: 'battle',
        enemies: [
          { species: 'geodon', level: 3 },
          { species: 'geomote', level: 3 },
        ],
      },
      '2': {
        kind: 'battle',
        enemies: [
          { species: 'prismguard', level: 3 },
          { species: 'geodon', level: 3 },
        ],
        intro: narrate('The vault hums. Something big is keeping the cold in here.'),
      },
    },
    chests: {
      '15,2': { obols: 300, note: 'A frozen cache, obols still legible under the frost.' },
    },
    encounterRate: 0.07,
    encounters: [
      { weight: 3, enemies: [{ species: 'geomote', level: 3 }] },
      { weight: 3, enemies: [{ species: 'geodon', level: 3 }] },
      {
        weight: 2,
        enemies: [
          { species: 'prismguard', level: 3 },
          { species: 'shieldshard', level: 3 },
        ],
      },
      {
        weight: 1,
        enemies: [
          { species: 'geodon', level: 3 },
          { species: 'prismguard', level: 3 },
        ],
      },
    ],
  },

  {
    id: 'crystal-3',
    name: 'The Reliquary — Warden Vault',
    theme: THEME_BOSS,
    fog: 1.4,
    decor: [
      { x: 6, z: 3, kind: 'crystalPillar', height: 1.8, emissive: 0.6 },
      { x: 10, z: 3, kind: 'crystalPillar', height: 1.8, emissive: 0.6 },
      { x: 6, z: 5, kind: 'crystalCluster', emissive: 0.6 },
      { x: 10, z: 5, kind: 'crystalCluster', emissive: 0.6 },
      { x: 2, z: 2, kind: 'iceShard', height: 0.9, emissive: 0.4 },
      { x: 14, z: 2, kind: 'iceShard', height: 0.9, emissive: 0.4 },
    ],
    rows: [
      '=================',
      '=...............=',
      '=....=======....=',
      '=....=.....=....=',
      '=....=.1...=....=',
      '=....=.....=....=',
      '=....=.....=....=',
      '=......S........=',
      '=...............=',
      '=================',
    ],
    events: {
      '1': {
        kind: 'boss',
        enemies: [{ species: 'vaultwarden', level: 3 }],
        intro: [
          ...narrate(
            "At the vault's heart, a woman kneels over a pane of ice. Inside it, a girl is laughing — frozen mid-laugh, forever.",
          ),
          ...say(
            'Sena Vale',
            "Don't. If you bring warmth in here, she fades. I froze her so she would never have to end. I will not let you thaw my sister.",
          ),
        ],
        outro: [
          ...say('Sena Vale', "She was already gone, wasn't she. I only kept the shape."),
          ...narrate(
            'The ice loosens its grip. Somewhere, at last, a soul is allowed to move on — and a portal home glimmers open behind you.',
          ),
        ],
      },
    },
    chests: {},
    encounterRate: 0.03,
    encounters: [
      { weight: 2, enemies: [{ species: 'geomote', level: 3 }] },
      {
        weight: 1,
        enemies: [
          { species: 'prismguard', level: 3 },
          { species: 'geodon', level: 3 },
        ],
      },
    ],
  },
];

export const CRYSTAL_CAVERN: Reach = {
  id: 'crystal',
  name: 'The Reliquary',
  blurb:
    'A hall of kept light, where souls are frozen in glass so they can never fade — and never rest. Someone here refuses to let go.',
  color: '#6fe0ff',
  recommendedLevel: 3,
  floors: FLOORS,
  startingLight: 130,
  music: 'crystal',
  onClear: { flag: 'crystalCleared' },
  requires: 'crossingCleared',
};
