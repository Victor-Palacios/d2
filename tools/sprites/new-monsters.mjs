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

export const NEW_ART = {
  ...CROSSING_MAGES,
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
];
