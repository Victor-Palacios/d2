// Data for the type-themed roster expansion (20 new monsters). Each dungeon is
// now a single class, with a progressively larger roster and a unique boss:
//   D1 Quiet Crossing (flat)      — Mage     — 3
//   D2 Crystal Cavern (painterly) — Hero     — 5
//   D3 Overgrowth (gouache)       — Assassin — 6
//   D4 Haunted (spectral)         — Mage     — 7
//   D5 Last Lantern (reliquary)   — Hero     — 8
//
// This module holds the *species data* + a map of new art keys → builders.
// integrate-new.mjs inserts the art into art.ts and generates the species into
// creatures.ts; encounters are wired by hand in each reach file. Every line is
// standalone (no evolutions), so all are trivially class-pure.
import { CROSSING_MAGES } from './crossing-mages.mjs';
import { CRYSTAL_HEROES } from './crystal-heroes.mjs';
import { OVERGROWTH_ASSASSINS } from './overgrowth-assassins.mjs';

export const NEW_ART = {
  ...CROSSING_MAGES,
  ...CRYSTAL_HEROES,
  ...OVERGROWTH_ASSASSINS,
};

export const NEW_MONSTERS = [
  // === D1 · The Quiet Crossing — Mage (flat) ==============================
  {
    id: 'mistling', name: 'Mistling', art: 'qcMistling', attribute: 'mage', element: 'water', growth: 'MAGE_GROWTH',
    height: 1.2, hover: 0.16, base: { hp: 42, mp: 24, off: 10, def: 11, spd: 14, mag: 19, res: 13 },
    learnset: [[1, 'tidalSlap'], [4, 'mistVeil'], [8, 'frostLance'], [12, 'prismStorm'], [16, 'glacierSpire'], [20, 'renewingTide']],
    blurb: 'A soul that dissolved into fog on the crossing. It drifts, gentle and unsure which way is home.',
  },
  {
    id: 'cindermage', name: 'Cindermage', art: 'qcCindermage', attribute: 'mage', element: 'fire', growth: 'MAGE_GROWTH',
    height: 1.25, hover: 0.12, base: { hp: 40, mp: 26, off: 11, def: 10, spd: 13, mag: 21, res: 12 },
    learnset: [[1, 'cinderBurst'], [4, 'emberWave'], [8, 'hexBolt'], [12, 'pyreLance'], [16, 'abyssalBolt'], [20, 'infernoCore']],
    blurb: 'A hooded echo cupping the last warm coal of a life. It hoards the heat, and studies you from the dark.',
  },
  {
    id: 'sigilwarden', name: 'Sigilwarden', art: 'qcSigilwarden', attribute: 'mage', element: 'dark', growth: 'MAGE_GROWTH',
    height: 2.2, hover: 0.3, boss: true, base: { hp: 72, mp: 34, off: 14, def: 15, spd: 12, mag: 24, res: 18 },
    learnset: [[1, 'gloomLance'], [4, 'hexBolt'], [8, 'nightSpiral'], [12, 'dirge'], [16, 'abyssalBolt'], [20, 'voidNova']],
    blurb: 'The Vigil of the Warden Hall — a great eye of wards that keeps the crossing. Nothing passes it unread.',
  },

  // === D2 · The Crystal Cavern — Hero (painterly) =========================
  {
    id: 'shieldshard', name: 'Shieldshard', art: 'ccShieldshard', attribute: 'hero', element: 'machine', growth: 'HERO_GROWTH',
    height: 1.6, base: { hp: 58, mp: 18, off: 17, def: 20, spd: 11, mag: 11, res: 17 },
    learnset: [[1, 'quakeCore'], [4, 'ironHowl'], [8, 'rendingStrike'], [12, 'boltPierce'], [16, 'overload'], [20, 'railvolt']],
    blurb: 'A guard hewn from cavern-stone, a slab of gemglass bound to its arm. It plants itself and does not yield.',
  },
  {
    id: 'geomote', name: 'Geomote', art: 'ccGeomote', attribute: 'hero', element: 'nature', growth: 'HERO_GROWTH',
    height: 1.4, base: { hp: 60, mp: 18, off: 15, def: 21, spd: 10, mag: 12, res: 18 },
    learnset: [[1, 'seedVolley'], [4, 'bloomPulse'], [8, 'savageBite'], [12, 'wildgrowth'], [16, 'thornspell'], [20, 'lifebloom']],
    blurb: 'A boulder the moss claimed and a soul moved into. Slow, patient, and impossibly hard to knock over.',
  },
  {
    id: 'prismguard', name: 'Prismguard', art: 'ccPrismguard', attribute: 'hero', element: 'water', growth: 'HERO_GROWTH',
    height: 1.7, base: { hp: 56, mp: 20, off: 16, def: 19, spd: 12, mag: 14, res: 19 },
    learnset: [[1, 'frostLance'], [4, 'tidalCrash'], [8, 'glacierSpire'], [12, 'quakeCore'], [16, 'prismStorm'], [20, 'renewingTide']],
    blurb: 'An ice-crystal sentinel with a spear of frozen light. It guards the deep vaults where the cold never breaks.',
  },
  {
    id: 'vaultwarden', name: 'Vaultwarden', art: 'ccVaultwarden', attribute: 'hero', element: 'water', growth: 'HERO_GROWTH',
    height: 2.4, boss: true, base: { hp: 86, mp: 24, off: 18, def: 24, spd: 11, mag: 14, res: 22 },
    learnset: [[1, 'frostLance'], [4, 'rendingStrike'], [8, 'glacierSpire'], [12, 'quakeCore'], [16, 'overload'], [20, 'maelstrom']],
    blurb: 'The keeper of the Warden Vault — a mountain of stone around a burning amethyst heart. It has turned back every thief but grief.',
  },

  // === D3 · The Overgrowth — Assassin (gouache) ===========================
  {
    id: 'sporefang', name: 'Sporefang', art: 'ogSporefang', attribute: 'assassin', element: 'nature', growth: 'ASSASSIN_GROWTH',
    height: 1.35, base: { hp: 48, mp: 18, off: 20, def: 13, spd: 20, mag: 12, res: 11 },
    learnset: [[1, 'seedVolley'], [4, 'graveRot'], [8, 'savageBite'], [12, 'thornspell'], [16, 'gustWing'], [20, 'wildgrowth']],
    blurb: 'A low, fanged hunter that seeds the air with spores and waits in the murk for something to breathe them.',
  },
  {
    id: 'vineraptor', name: 'Vineraptor', art: 'ogVineraptor', attribute: 'assassin', element: 'nature', growth: 'ASSASSIN_GROWTH',
    height: 1.5, base: { hp: 46, mp: 16, off: 22, def: 12, spd: 21, mag: 10, res: 10 },
    learnset: [[1, 'savageBite'], [4, 'gustWing'], [8, 'graveRot'], [12, 'thornspell'], [16, 'seedVolley'], [20, 'wildgrowth']],
    blurb: 'A raptor grown of grasping vine, one sickle claw raised. It runs down anything the canopy lets flee.',
  },
  {
    id: 'bloomstalker', name: 'Bloomstalker', art: 'ogBloomstalker', attribute: 'assassin', element: 'nature', growth: 'ASSASSIN_GROWTH',
    height: 1.4, base: { hp: 48, mp: 18, off: 19, def: 14, spd: 19, mag: 13, res: 12 },
    learnset: [[1, 'seedVolley'], [4, 'gustWing'], [8, 'savageBite'], [12, 'graveRot'], [16, 'thornspell'], [20, 'wildgrowth']],
    blurb: 'A patient cat that grows a false flower on its tail — the last pretty thing many a smaller soul ever chases.',
  },
  {
    id: 'thornreaper', name: 'Thornreaper', art: 'ogThornreaper', attribute: 'assassin', element: 'nature', growth: 'ASSASSIN_GROWTH',
    height: 2.3, boss: true, base: { hp: 76, mp: 22, off: 24, def: 16, spd: 18, mag: 12, res: 14 },
    learnset: [[1, 'savageBite'], [4, 'graveRot'], [8, 'thornspell'], [12, 'gustWing'], [16, 'wildgrowth'], [20, 'lifebloom']],
    blurb: 'The apex of the Overgrowth — a thorn-maned reaper that hunts the hunters. Nothing that walks the Heartwood is above it on the list.',
  },
];
