import type { PixelArt } from '../engine/pixel';

/**
 * ALL placeholder / original programmer-art (plan §0.2).
 *
 * Sprites are hand-authored pixel maps: one character per pixel, '.' is
 * transparent, every other character indexes the sprite's palette. Rows are
 * padded to a uniform width at build time, so a row that is a character short
 * degrades into a transparent pixel rather than breaking.
 *
 * Nothing here references any real-world game's characters, names or art. To
 * drop in licensed art later, swap these maps (or replace `spriteTexture` with
 * an image loader) — no game code needs to change.
 */

// ---------------------------------------------------------------------------
// Humans: one shared silhouette, re-palettes into every NPC in the slice.
// ---------------------------------------------------------------------------

const HUMAN_ROWS = [
  '..............',
  '.....kkkk.....',
  '....khhhhk....',
  '...khhhhhhk...',
  '...khsssshk...',
  '...khsesesk...',
  '....ksssk.....',
  '....kkkkk.....',
  '..kkcccccckk..',
  '.ksccCCCCccsk.',
  '.ksccCCCCccsk.',
  '.kkccCCCCcckk.',
  '...kcccccck...',
  '...kppppppk...',
  '...kppkkppk...',
  '...kppkkppk...',
  '...kppkkppk...',
  '...kbbkkbbk...',
];

/** Alternate top rows: spiked hair (rival) and a peaked cap (chief/vendor). */
const HAIR_SPIKY = ['..k.k..k.k....', '...khkhkhk....', '..khhhhhhhk...'];
const HAIR_CAP = ['....kkkkkk....', '...kaaaaaak...', '...khhhhhhk...'];

type HumanColors = {
  hair: string;
  skin?: string;
  coat: string;
  coatHi: string;
  pants: string;
  boots?: string;
  hat?: string;
};

function human(c: HumanColors, hairStyle: 'default' | 'spiky' | 'cap' = 'default'): PixelArt {
  let rows = HUMAN_ROWS.slice();
  if (hairStyle === 'spiky') rows = [rows[0], ...HAIR_SPIKY, ...rows.slice(4)];
  if (hairStyle === 'cap') rows = [rows[0], ...HAIR_CAP, ...rows.slice(4)];
  return {
    palette: {
      k: '#15101f',
      h: c.hair,
      s: c.skin ?? '#f0c39a',
      e: '#1b1430',
      c: c.coat,
      C: c.coatHi,
      p: c.pants,
      b: c.boots ?? '#171a26',
      a: c.hat ?? c.coatHi,
    },
    rows,
  };
}

export const HUMANS: Record<string, PixelArt> = {
  hero: human({ hair: '#3a2a1c', coat: '#2f5fb8', coatHi: '#5b93f0', pants: '#26304d' }),
  mentor: human({ hair: '#c9cdd8', coat: '#c8ccd8', coatHi: '#eef1f8', pants: '#3b4257' }),
  chief: human({ hair: '#2a2a33', coat: '#2b3346', coatHi: '#49577a', pants: '#1c2030', hat: '#8f9bbd' }, 'cap'),
  rival: human({ hair: '#d94f3d', coat: '#8a2b28', coatHi: '#d8503f', pants: '#2c2432' }, 'spiky'),
  vendor: human({ hair: '#6b4a2f', coat: '#4f7a4a', coatHi: '#79b06a', pants: '#3a3020', hat: '#d8c48a' }, 'cap'),
  leaderGold: human({ hair: '#e2c76a', coat: '#8a6f1f', coatHi: '#e6c65a', pants: '#3a2f14' }),
  leaderBlue: human({ hair: '#7fa9e8', coat: '#25467f', coatHi: '#5f9adf', pants: '#1d2740' }),
  leaderBlack: human({ hair: '#2b2438', coat: '#2a2334', coatHi: '#57446e', pants: '#191322' }, 'spiky'),
};

// ---------------------------------------------------------------------------
// The dig-vehicle ("beetle"). Three facings; left is mirrored from the side art.
// ---------------------------------------------------------------------------

const VEHICLE_PALETTE = {
  k: '#12141f',
  b: '#3f6ecb',
  B: '#6fa2ff',
  g: '#9fe8ff',
  r: '#e2574d',
  y: '#ffe9a8',
  t: '#23262f',
  h: '#3a2a1c',
  p: '#f0c39a',
  e: '#15101f',
};

export const VEHICLE: Record<'down' | 'up' | 'side', PixelArt> = {
  down: {
    palette: VEHICLE_PALETTE,
    rows: [
      '................',
      '......kkkk......',
      '.....khhhhk.....',
      '.....khpphk.....',
      '.....kpekep.....',
      '......kkkk......',
      '..kkkkkkkkkkkk..',
      '.kggggggggggggk.',
      '.kbbbbbbbbbbbbk.',
      '.kbrrrrrrrrrrbk.',
      '.kbbbbbbbbbbbbk.',
      '.kbyybbbbbbyybk.',
      '.kkkkkkkkkkkkkk.',
      'kttkkkkkkkkkkttk',
      'kttk........kttk',
      'kkkk........kkkk',
    ],
  },
  up: {
    palette: VEHICLE_PALETTE,
    rows: [
      '................',
      '......kkkk......',
      '.....khhhhk.....',
      '.....khhhhk.....',
      '.....khhhhk.....',
      '......kkkk......',
      '..kkkkkkkkkkkk..',
      '.kbbbbbbbbbbbbk.',
      '.kbBBBBBBBBBBbk.',
      '.kbrrrrrrrrrrbk.',
      '.kbBBBBBBBBBBbk.',
      '.kbbtbbbbbbtbbk.',
      '.kkkkkkkkkkkkkk.',
      'kttkkkkkkkkkkttk',
      'kttk........kttk',
      'kkkk........kkkk',
    ],
  },
  side: {
    palette: VEHICLE_PALETTE,
    rows: [
      '................',
      '.......kkkk.....',
      '......khhhhk....',
      '......khppk.....',
      '......kpekp.....',
      '.......kkkk.....',
      '...kkkkkkkkkkk..',
      '..kggggggkbbbbk.',
      '.kbbbbbbbbbbbbk.',
      '.kbrrrrrrrrrrbk.',
      '.kbbbbbbbbbbbbk.',
      'kyybbbbbbbbbbbbk',
      '.kkkkkkkkkkkkkk.',
      '.kttkkkkkkkkttk.',
      '.kttk......kttk.',
      '.kkkk......kkkk.',
    ],
  },
};

// ---------------------------------------------------------------------------
// Creatures. Placeholder species (see src/data/creatures.ts for the stat blocks).
// ---------------------------------------------------------------------------

export const CREATURES: Record<string, PixelArt> = {
  // Fire lizard rookie
  lizard: {
    palette: { k: '#2a1408', o: '#f07f2a', y: '#ffe08a', e: '#1a1a2e', f: '#ff5a2a', F: '#ffd23f' },
    rows: [
      '................',
      '.........fF.....',
      '........fFF.....',
      '....kkkkkk......',
      '...kooooook.....',
      '...koeooeok.....',
      '...kooyyook.....',
      '...kkkkkkkk.....',
      '..kooooooook....',
      '..koyyyyyyok....',
      '..koyyyyyyok.fF.',
      '..kooooooook..fF',
      '...kkkkkkkk.....',
      '...koo..ook.....',
      '...koo..ook.....',
      '...kkk..kkk.....',
    ],
  },
  // Impish bat rookie
  bat: {
    palette: { k: '#1a1024', d: '#6b4d9e', w: '#f2e8ff', e: '#ffd166', W: '#3c2b5c' },
    rows: [
      '................',
      '..k..........k..',
      '..kk........kk..',
      '..kwk......kwk..',
      '...kkkkkkkkkk...',
      '..kddddddddddk..',
      '..kdeeddddeedk..',
      '..kddddddddddk..',
      '..kddwwddwwddk..',
      '...kkkkkkkkkk...',
      '.kWWkddddddkWWk.',
      'kWWWkddddddkWWWk',
      'kWWWkddddddkWWWk',
      '.kkkkddddddkkkk.',
      '....kdd..ddk....',
      '....kkk..kkk....',
    ],
  },
  // Winged-mammal rookie
  wing: {
    palette: { k: '#141a28', b: '#79c8e8', y: '#e8f6ff', w: '#ffffff', e: '#132033', W: '#3f7fa8' },
    rows: [
      '................',
      '...kk......kk...',
      '..kbbk....kbbk..',
      '..kbbkkkkkkbbk..',
      '...kbbbbbbbbk...',
      '..kbbbbbbbbbbk..',
      '..kbeebbbbeebk..',
      '..kbbbbwwbbbbk..',
      '...kbbbbbbbbk...',
      '..kkkbbbbbbkkk..',
      '.kWWkbbbbbbkWWk.',
      'kWWWkbyyyybkWWWk',
      'kWWWkbyyyybkWWWk',
      '.kkkkbbbbbbkkkk.',
      '....kbb..bbk....',
      '....kkk..kkk....',
    ],
  },
  // Nature bulb rookie
  plant: {
    palette: { k: '#12240f', p: '#7ec850', y: '#f2f7a0', g: '#3f8f3a', w: '#ffffff', e: '#12240f' },
    rows: [
      '......kk........',
      '.....kggk...kk..',
      '..kkkgggkkkggk..',
      '.kggggkgkkgggk..',
      '..kkkkkgkkkkk...',
      '....kkkkkkkk....',
      '...kppppppppk...',
      '...kpeppppepk...',
      '...kppppppppk...',
      '...kppwwwwppk...',
      '...kppppppppk...',
      '...kkkkkkkkk....',
      '....kpp..ppk....',
      '....kpp..ppk....',
      '....kkk..kkk....',
      '................',
    ],
  },
  // Machine rookie
  bot: {
    palette: { k: '#101319', m: '#9aa7bd', y: '#ffd166', w: '#dff3ff', e: '#39e0ff' },
    rows: [
      '................',
      '.......kk.......',
      '.......ky.......',
      '...kkkkkkkkkk...',
      '...kmmmmmmmmk...',
      '...kmeemmeemk...',
      '...kmmmmmmmmk...',
      '...kmmwwwwmmk...',
      '...kkkkkkkkkk...',
      '..kmkmmmmmmkmk..',
      '.kmmkmmyymmkmmk.',
      '.kmmkmmmmmmkmmk.',
      '..kkkmmmmmmkkk..',
      '....kkkkkkkk....',
      '....kmm..mmk....',
      '....kkk..kkk....',
    ],
  },
  // Water blob rookie
  slime: {
    palette: { k: '#0d2436', a: '#3fb6e8', w: '#cdf3ff', e: '#0d2436' },
    rows: [
      '................',
      '................',
      '......kkkk......',
      '....kkwwwwkk....',
      '...kwwaaaawwk...',
      '..kwaaaaaaaawk..',
      '..kaaeaaaaeaak..',
      '.kaaaaaaaaaaaak.',
      '.kaaaaawwaaaaak.',
      '.kaaaaaaaaaaaak.',
      '.kaaaaaaaaaaaak.',
      '..kaaaaaaaaaak..',
      '..kkaaaaaaaakk..',
      '...kkkaaaakkk...',
      '.....kkkkkk.....',
      '................',
    ],
  },
  // Dark wisp
  wisp: {
    palette: { k: '#100a1c', d: '#4a3670', v: '#c77dff' },
    rows: [
      '................',
      '......kkkk......',
      '....kkddddkk....',
      '...kdddddddk....',
      '..kddvvddvvddk..',
      '..kddddddddddk..',
      '..kddddddddddk..',
      '...kddddddddk...',
      '....kddddddk....',
      '.....kddddk.....',
      '......kddk......',
      '.....kddddk.....',
      '....kdd..ddk....',
      '...kdd....ddk...',
      '...kk......kk...',
      '................',
    ],
  },
  // Armoured "borrowed" creature (Alpha)
  knight: {
    palette: { k: '#111420', a: '#b9c3d6', v: '#6fd3ff', c: '#3a5fa8', y: '#ffd166' },
    rows: [
      '................',
      '......kkkk......',
      '.....kaaaak.....',
      '....kaaaaaak....',
      '....kavvvvak....',
      '....kaaaaaak....',
      '.....kaaaak.....',
      '...kkkkkkkkkk...',
      '..kaakcccccckaak',
      '.kaaakcccccckaak',
      '.kaaakcyyyycka.k',
      '..kkkcccccccck..',
      '....kcccccck....',
      '....kaaaaaak....',
      '....kaa..aak....',
      '....kkk..kkk....',
    ],
  },
  // Beast (wolf-like)
  wolf: {
    palette: { k: '#18140f', g: '#8d8f9c', y: '#e8e4d8', w: '#ffffff', e: '#ffd166' },
    rows: [
      '................',
      '..kk........kk..',
      '..kgk......kgk..',
      '..kgkkkkkkkkgk..',
      '...kgggggggggk..',
      '..kggeggggeggk..',
      '..kgggggggggggk.',
      '..kggwwwwwwwggk.',
      '...kgggggggggk..',
      '..kkgggggggggkk.',
      '.kggggggggggggk.',
      '.kggyyyyyyyyggk.',
      '.kggggggggggggk.',
      '..kkgggggggggk..',
      '...kgg...ggk....',
      '...kkk...kkk....',
    ],
  },
  // Weak crawler (tutorial trash mob)
  bug: {
    palette: { k: '#1b1608', b: '#a8892f', y: '#ffe08a', e: '#2b1a05' },
    rows: [
      '................',
      '...k........k...',
      '....k......k....',
      '.....kkkkkk.....',
      '...kkbbbbbbkk...',
      '..kbbeebbeebbk..',
      '..kbbbbbbbbbbk..',
      '.kbbbyybbyybbbk.',
      '.kbbbbbbbbbbbbk.',
      '..kkbbbbbbbbkk..',
      '...kk.kkkk.kk...',
      '................',
    ],
  },
  // Weak scrap-bot (tutorial trash mob)
  scrap: {
    palette: { k: '#141821', m: '#7d8798', y: '#ffd166', e: '#ff6b6b' },
    rows: [
      '................',
      '......kkkk......',
      '.....kmyymk.....',
      '....kmmmmmmk....',
      '....kmeemmek....',
      '....kmmmmmmk....',
      '...kkmmmmmmkk...',
      '..kmmkmmmmkmmk..',
      '..kmmkmmmmkmmk..',
      '...kkkmmmmkkk...',
      '....kmm..mmk....',
      '....kkk..kkk....',
    ],
  },
  // Boss: maned "lion-type" placeholder. Deliberately larger than the rookies.
  lion: {
    palette: { k: '#241304', M: '#e8a33c', o: '#d8c49a', y: '#fff0cf', e: '#2b1a05', w: '#ffffff' },
    rows: [
      '....................',
      '.....kkkkkkkkkk.....',
      '...kkMMMMMMMMMMkk...',
      '..kMMMMMMMMMMMMMMk..',
      '.kMMMkkkkkkkkkkMMMk.',
      '.kMMkooooooooookMMk.',
      '.kMMkoeeoooooeokMMk.',
      '.kMMkooooooooookMMk.',
      '.kMMkoowwwwwwookMMk.',
      '.kMMkooooooooookMMk.',
      '..kMMkkkkkkkkkkMMk..',
      '...kkMMMMMMMMMMkk...',
      '.....koooooooook....',
      '....kooyyyyyyook....',
      '....kooyyyyyyook....',
      '....kooooooooook....',
      '....kkoo....ookk....',
      '.....koo....ook.....',
      '.....kkk....kkk.....',
    ],
  },
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export const PROPS: Record<string, PixelArt> = {
  chestClosed: {
    palette: { k: '#1a1108', w: '#7a4f24', W: '#a86c31', y: '#ffd166' },
    rows: [
      '................',
      '................',
      '...kkkkkkkkkk...',
      '..kwwwwwwwwwwk..',
      '.kwWWWWWWWWWWwk.',
      '.kwWWWyyWWWWWwk.',
      '.kkkkkkkkkkkkkk.',
      '.kwWWWWyyWWWWwk.',
      '.kwWWWWyyWWWWwk.',
      '.kwWWWWWWWWWWwk.',
      '.kwWWWWWWWWWWwk.',
      '.kwwwwwwwwwwwwk.',
      '.kkkkkkkkkkkkk..',
      '................',
    ],
  },
  chestOpen: {
    palette: { k: '#1a1108', w: '#7a4f24', W: '#a86c31', y: '#ffd166', g: '#ffe9a8', G: '#fff8e0' },
    rows: [
      '..kkkkkkkkkkkk..',
      '.kwwwwwwwwwwwwk.',
      '.kkkkkkkkkkkkkk.',
      '..kggggggggggk..',
      '..kgGGGGGGGGgk..',
      '.kwwwwwwwwwwwwk.',
      '.kwWWWWWWWWWWwk.',
      '.kwWWWWyyWWWWwk.',
      '.kwWWWWyyWWWWwk.',
      '.kwWWWWWWWWWWwk.',
      '.kwwwwwwwwwwwwk.',
      '.kkkkkkkkkkkkk..',
      '................',
      '................',
    ],
  },
  fuelCan: {
    palette: { k: '#101319', c: '#c8442f', C: '#f0705a', y: '#ffe9a8' },
    rows: [
      '............',
      '....kkkk....',
      '....kyyk....',
      '..kkkkkkkk..',
      '.kcccccccck.',
      '.kcCCCCCCck.',
      '.kcCkkkkCck.',
      '.kcCkyykCck.',
      '.kcCkkkkCck.',
      '.kcCCCCCCck.',
      '.kcccccccck.',
      '.kkkkkkkkkk.',
      '............',
      '............',
    ],
  },
  torch: {
    palette: { k: '#140f0a', w: '#6b4a2f', f: '#ff8a2a', F: '#ffe08a' },
    rows: [
      '......FF......',
      '.....FFFF.....',
      '....fFFFFf....',
      '....ffFFff....',
      '.....ffff.....',
      '......ff......',
      '.....kwwk.....',
      '.....kwwk.....',
      '.....kwwk.....',
      '.....kwwk.....',
      '.....kwwk.....',
      '.....kkkk.....',
    ],
  },
};
