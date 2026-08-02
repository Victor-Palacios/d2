/**
 * Audio, synthesised with the Web Audio API — no samples, no binary assets
 * (plan §0.2). Two layers live here:
 *
 *  1. **SFX + monster cries** — short oscillator stacks (`tone()` / `voiceLayer()`).
 *  2. **Music** — a small *baked sampler*: instrument timbres are precomputed in
 *     code (harmonic wavetables + a Karplus-Strong harp), and tracks are step
 *     sequences of "voices" (pads, plucks, bells, strings, flute, cello, harp,
 *     percussion) played through a reverb + compressor bus. See docs/audio.md.
 *
 * Every music track is a `RichTrack`. `encounterSting()` / `victoryFanfare()`
 * bridge field ↔ battle music the way a Pokémon battle opens and resolves.
 */

type SfxName =
  | 'blip'
  | 'confirm'
  | 'cancel'
  | 'step'
  | 'bump'
  | 'chest'
  | 'pickup'
  | 'portal'
  | 'hit'
  | 'crit'
  | 'guard'
  | 'heal'
  | 'ko'
  | 'encounter'
  | 'victory'
  | 'defeat';

interface Note {
  freq: number;
  time: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  /** Optional target frequency — the tone glides freq → f1 over `dur`. */
  f1?: number;
  /** Glide shape when `f1` is set (default exponential). */
  glide?: 'lin' | 'exp';
}

const SFX: Record<SfxName, Note[]> = {
  blip: [{ freq: 660, time: 0, dur: 0.05, type: 'square', gain: 0.12 }],
  confirm: [
    { freq: 620, time: 0, dur: 0.06, type: 'square', gain: 0.14 },
    { freq: 930, time: 0.05, dur: 0.09, type: 'square', gain: 0.14 },
  ],
  cancel: [
    { freq: 400, time: 0, dur: 0.06, type: 'square', gain: 0.12 },
    { freq: 260, time: 0.05, dur: 0.09, type: 'square', gain: 0.12 },
  ],
  step: [{ freq: 150, time: 0, dur: 0.05, type: 'triangle', gain: 0.09 }],
  // A dull wall-thump, not a buzz: a low sine body that drops in pitch as it
  // hits (energy dumping into the wall), a triangle sub for weight, and a very
  // short soft transient for the surface knock. Sine/triangle only — a sawtooth
  // here reads as electric.
  bump: [
    { freq: 200, f1: 58, time: 0, dur: 0.12, type: 'sine', gain: 0.26, glide: 'exp' },
    { freq: 120, f1: 46, time: 0, dur: 0.15, type: 'triangle', gain: 0.14, glide: 'exp' },
    { freq: 330, f1: 150, time: 0, dur: 0.035, type: 'triangle', gain: 0.08, glide: 'exp' },
  ],
  chest: [
    { freq: 700, time: 0, dur: 0.07, type: 'square', gain: 0.12 },
    { freq: 880, time: 0.07, dur: 0.07, type: 'square', gain: 0.12 },
    { freq: 1170, time: 0.14, dur: 0.16, type: 'square', gain: 0.12 },
  ],
  pickup: [
    { freq: 520, time: 0, dur: 0.05, type: 'square', gain: 0.11 },
    { freq: 780, time: 0.05, dur: 0.1, type: 'square', gain: 0.11 },
  ],
  portal: [
    { freq: 220, time: 0, dur: 0.5, type: 'sine', gain: 0.16 },
    { freq: 330, time: 0.12, dur: 0.45, type: 'sine', gain: 0.12 },
    { freq: 440, time: 0.24, dur: 0.4, type: 'sine', gain: 0.1 },
  ],
  hit: [{ freq: 180, time: 0, dur: 0.12, type: 'sawtooth', gain: 0.16 }],
  crit: [
    { freq: 240, time: 0, dur: 0.14, type: 'sawtooth', gain: 0.2 },
    { freq: 120, time: 0.06, dur: 0.2, type: 'square', gain: 0.16 },
  ],
  guard: [{ freq: 300, time: 0, dur: 0.14, type: 'triangle', gain: 0.13 }],
  heal: [
    { freq: 780, time: 0, dur: 0.09, type: 'sine', gain: 0.14 },
    { freq: 1040, time: 0.08, dur: 0.16, type: 'sine', gain: 0.12 },
  ],
  ko: [
    { freq: 320, time: 0, dur: 0.12, type: 'sawtooth', gain: 0.16 },
    { freq: 160, time: 0.1, dur: 0.26, type: 'sawtooth', gain: 0.14 },
  ],
  encounter: [
    { freq: 200, time: 0, dur: 0.1, type: 'square', gain: 0.16 },
    { freq: 300, time: 0.1, dur: 0.1, type: 'square', gain: 0.16 },
    { freq: 200, time: 0.2, dur: 0.1, type: 'square', gain: 0.16 },
    { freq: 420, time: 0.3, dur: 0.3, type: 'square', gain: 0.16 },
  ],
  victory: [
    { freq: 523, time: 0, dur: 0.11, type: 'square', gain: 0.14 },
    { freq: 659, time: 0.11, dur: 0.11, type: 'square', gain: 0.14 },
    { freq: 784, time: 0.22, dur: 0.11, type: 'square', gain: 0.14 },
    { freq: 1046, time: 0.33, dur: 0.34, type: 'square', gain: 0.15 },
  ],
  defeat: [
    { freq: 392, time: 0, dur: 0.18, type: 'triangle', gain: 0.14 },
    { freq: 330, time: 0.18, dur: 0.18, type: 'triangle', gain: 0.14 },
    { freq: 262, time: 0.36, dur: 0.5, type: 'triangle', gain: 0.14 },
  ],
};

/**
 * Monster "cries" — each creature's own voice, like a Pokémon/Digimon call.
 *
 * A cry is a short stack of oscillator layers. Unlike a flat `Note`, a layer can
 * *glide* its pitch (`f0`→`f1`) and carry `vibrato` (an LFO on frequency), which
 * is what lets a handful of oscillators read as a growl, a coo or a screech
 * instead of a beep. Keyed by species id; a species with no entry stays silent.
 */
interface CryLayer {
  /** Start frequency. */
  f0: number;
  /** Glide-to frequency by the end of the layer (defaults to `f0`, i.e. steady). */
  f1?: number;
  time: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  /** `[rate Hz, depth Hz]` — a frequency wobble that gives the voice character. */
  vibrato?: [rate: number, depth: number];
  /** Pitch-ramp shape. `exp` (default) sounds natural; `lin` is more mechanical. */
  glide?: 'lin' | 'exp';
}

const CRIES: Record<string, CryLayer[]> = {
  // Emberling (fire lizard): a low, rough rising snarl that spits upward at the
  // end — fast wide vibrato on a sawtooth reads as a guttural growl.
  emberling: [
    { f0: 240, f1: 380, time: 0, dur: 0.16, type: 'sawtooth', gain: 0.17, vibrato: [34, 22] },
    { f0: 180, f1: 300, time: 0.02, dur: 0.14, type: 'square', gain: 0.06, vibrato: [55, 18] },
    { f0: 520, f1: 760, time: 0.15, dur: 0.1, type: 'sawtooth', gain: 0.13 },
  ],
  // Glidefang (water/wind flier): an airy coo that lifts, then rides a long
  // descending glide — soft triangle/sine with a slow vibrato.
  glidefang: [
    { f0: 720, f1: 1020, time: 0, dur: 0.12, type: 'triangle', gain: 0.14, vibrato: [12, 14] },
    { f0: 1020, f1: 640, time: 0.11, dur: 0.22, type: 'sine', gain: 0.13, vibrato: [16, 20] },
    { f0: 1400, f1: 1180, time: 0.12, dur: 0.16, type: 'sine', gain: 0.05 },
  ],
  // Nightnip (dark bat): a quick, high, chittery screech — two fluttering chirps
  // and a sharp rising tail, rapid vibrato throughout.
  nightnip: [
    { f0: 900, f1: 1180, time: 0, dur: 0.06, type: 'square', gain: 0.12, vibrato: [70, 40] },
    { f0: 1180, f1: 820, time: 0.06, dur: 0.06, type: 'square', gain: 0.12, vibrato: [70, 40] },
    { f0: 1000, f1: 1500, time: 0.12, dur: 0.11, type: 'sawtooth', gain: 0.1, vibrato: [90, 30] },
  ],

  // --- The Quiet Crossing (first dungeon) roster --------------------------

  // Mitebug (tiny nature insect): a fast, high, clicky buzz — barely there, all
  // rapid vibrato, three quick ticks.
  mitebug: [
    { f0: 1300, f1: 1500, time: 0, dur: 0.04, type: 'square', gain: 0.09, vibrato: [120, 60] },
    { f0: 1500, f1: 1200, time: 0.045, dur: 0.04, type: 'square', gain: 0.09, vibrato: [120, 60] },
    { f0: 1400, f1: 1680, time: 0.09, dur: 0.05, type: 'square', gain: 0.08, vibrato: [140, 50] },
  ],
  // Sprigling (nature plant): a soft, organic warble — a rustly "buh-woo" that
  // rises then eases back down, gentle slow vibrato.
  sprigling: [
    { f0: 300, f1: 440, time: 0, dur: 0.14, type: 'triangle', gain: 0.14, vibrato: [22, 30] },
    { f0: 440, f1: 360, time: 0.13, dur: 0.16, type: 'triangle', gain: 0.12, vibrato: [18, 26] },
    { f0: 600, f1: 660, time: 0.05, dur: 0.1, type: 'sine', gain: 0.05 },
  ],
  // Scrapmite (machine salvage drone): two stepped, metallic beeps then a rising
  // whir — the linear glide reads as mechanical rather than organic.
  scrapmite: [
    { f0: 420, time: 0, dur: 0.05, type: 'square', gain: 0.12 },
    { f0: 630, time: 0.05, dur: 0.05, type: 'square', gain: 0.12 },
    { f0: 500, f1: 900, time: 0.1, dur: 0.12, type: 'sawtooth', gain: 0.1, glide: 'lin', vibrato: [80, 20] },
  ],
  // Gloomote (dark drifting wisp): a hollow, wavering moan that sinks — a low
  // sine with a slow, ghostly vibrato.
  gloomote: [
    { f0: 420, f1: 260, time: 0, dur: 0.3, type: 'sine', gain: 0.14, vibrato: [7, 24] },
    { f0: 560, f1: 360, time: 0.04, dur: 0.28, type: 'sine', gain: 0.06, vibrato: [9, 18] },
  ],
  // Dropletta (water slime): a wet, rising run of bubbly bloops — pure sines.
  dropletta: [
    { f0: 300, f1: 700, time: 0, dur: 0.08, type: 'sine', gain: 0.14 },
    { f0: 380, f1: 820, time: 0.09, dur: 0.09, type: 'sine', gain: 0.13 },
    { f0: 900, f1: 1150, time: 0.17, dur: 0.06, type: 'sine', gain: 0.08 },
  ],
  // Regalion (fire-lion warden boss): a deep, commanding roar that swells and
  // then settles — a low sawtooth over a sub-square, longer and lower than any
  // rookie so it reads as something much bigger.
  regalion: [
    { f0: 150, f1: 220, time: 0, dur: 0.34, type: 'sawtooth', gain: 0.18, vibrato: [24, 26] },
    { f0: 90, f1: 130, time: 0.02, dur: 0.34, type: 'square', gain: 0.09, vibrato: [20, 14] },
    { f0: 220, f1: 180, time: 0.3, dur: 0.22, type: 'sawtooth', gain: 0.15, vibrato: [18, 30] },
  ],

  // ================= Full roster voices =====================================
  // Every remaining species gets a voice so nothing is silent. Cries are themed
  // by element — fire: rough sawtooth growls; water: sine bloops & airy coos;
  // nature: organic warbles + dry insect clicks; machine: stepped metallic beeps
  // & motor whirs; dark: hollow moans & rising screeches — and pitched by size,
  // so a 2.4-tall boss reads far lower and longer than a 1.0 rookie.

  // --- Machine line (bots, knights, golems): stepped beeps + motor whir -----
  // Cogling: two chirpy beeps then a rising servo whir.
  cogling: [
    { f0: 520, time: 0, dur: 0.06, type: 'square', gain: 0.12 },
    { f0: 400, time: 0.07, dur: 0.06, type: 'square', gain: 0.12 },
    { f0: 460, f1: 720, time: 0.14, dur: 0.12, type: 'sawtooth', gain: 0.1, glide: 'lin', vibrato: [60, 14] },
  ],
  // Bulwarq: a heavy clank over a low idling motor hum.
  bulwarq: [
    { f0: 180, time: 0, dur: 0.1, type: 'square', gain: 0.13 },
    { f0: 120, f1: 150, time: 0.02, dur: 0.28, type: 'sawtooth', gain: 0.09, glide: 'lin', vibrato: [30, 8] },
    { f0: 300, time: 0.12, dur: 0.06, type: 'square', gain: 0.08 },
  ],
  // Geodon: a deep grinding rumble with a rock crack.
  geodon: [
    { f0: 110, f1: 90, time: 0, dur: 0.3, type: 'sawtooth', gain: 0.14, glide: 'lin', vibrato: [22, 6] },
    { f0: 220, time: 0.14, dur: 0.05, type: 'square', gain: 0.08 },
    { f0: 70, time: 0.02, dur: 0.28, type: 'square', gain: 0.06 },
  ],
  // Cogknight: a big servo roar with a metal clank on top.
  cogknight: [
    { f0: 140, f1: 170, time: 0, dur: 0.3, type: 'sawtooth', gain: 0.14, glide: 'lin', vibrato: [26, 10] },
    { f0: 280, time: 0, dur: 0.08, type: 'square', gain: 0.1 },
    { f0: 90, time: 0.14, dur: 0.16, type: 'square', gain: 0.07 },
  ],
  // Aegisaur: a massive grinding groan, lower and slower than Geodon.
  aegisaur: [
    { f0: 90, f1: 74, time: 0, dur: 0.34, type: 'sawtooth', gain: 0.15, glide: 'lin', vibrato: [18, 6] },
    { f0: 180, time: 0.14, dur: 0.06, type: 'square', gain: 0.08 },
    { f0: 60, time: 0.02, dur: 0.3, type: 'square', gain: 0.06 },
  ],
  // Boltframe: a crackling electric zap between two beeps.
  boltframe: [
    { f0: 700, time: 0, dur: 0.05, type: 'square', gain: 0.11 },
    { f0: 1050, f1: 700, time: 0.05, dur: 0.08, type: 'sawtooth', gain: 0.09, glide: 'lin', vibrato: [120, 30] },
    { f0: 520, time: 0.14, dur: 0.05, type: 'square', gain: 0.08 },
  ],
  // Dynamo: a motor spinning up — a fast linear rise in pitch.
  dynamo: [
    { f0: 300, f1: 720, time: 0, dur: 0.2, type: 'sawtooth', gain: 0.12, glide: 'lin', vibrato: [40, 12] },
    { f0: 600, f1: 1440, time: 0.04, dur: 0.18, type: 'square', gain: 0.05, glide: 'lin' },
  ],

  // --- Fire line (lizards, wolves, forge-beasts): rough rising snarls -------
  // Cinderfang: a searing snarl-howl, bigger and lower than a rookie.
  cinderfang: [
    { f0: 260, f1: 420, time: 0, dur: 0.14, type: 'sawtooth', gain: 0.16, vibrato: [30, 26] },
    { f0: 420, f1: 340, time: 0.14, dur: 0.2, type: 'sawtooth', gain: 0.13, vibrato: [18, 44] },
    { f0: 620, f1: 820, time: 0.16, dur: 0.1, type: 'sawtooth', gain: 0.08 },
  ],
  // Emberforge: a molten forge-snarl with a metallic edge.
  emberforge: [
    { f0: 200, f1: 320, time: 0, dur: 0.16, type: 'sawtooth', gain: 0.16, vibrato: [30, 24] },
    { f0: 160, f1: 240, time: 0.02, dur: 0.14, type: 'square', gain: 0.07, vibrato: [40, 16] },
    { f0: 480, f1: 700, time: 0.15, dur: 0.1, type: 'sawtooth', gain: 0.11 },
  ],
  // Ashwarden: a deeper smoldering roar.
  ashwarden: [
    { f0: 170, f1: 250, time: 0, dur: 0.2, type: 'sawtooth', gain: 0.16, vibrato: [26, 26] },
    { f0: 110, f1: 150, time: 0.02, dur: 0.28, type: 'square', gain: 0.08, vibrato: [22, 14] },
    { f0: 320, f1: 420, time: 0.2, dur: 0.14, type: 'sawtooth', gain: 0.09 },
  ],
  // Pyrelord: a towering inferno roar.
  pyrelord: [
    { f0: 140, f1: 210, time: 0, dur: 0.32, type: 'sawtooth', gain: 0.17, vibrato: [22, 28] },
    { f0: 90, f1: 130, time: 0.02, dur: 0.32, type: 'square', gain: 0.09, vibrato: [18, 16] },
    { f0: 260, f1: 360, time: 0.28, dur: 0.18, type: 'sawtooth', gain: 0.12, vibrato: [16, 34] },
  ],

  // --- Water line (slimes, fliers, wardens): bloops, coos & swells ----------
  // Shardling: glassy bloops with a crystalline ring.
  shardling: [
    { f0: 660, f1: 900, time: 0, dur: 0.08, type: 'sine', gain: 0.12 },
    { f0: 1320, time: 0.02, dur: 0.14, type: 'sine', gain: 0.05, vibrato: [10, 8] },
    { f0: 900, f1: 1200, time: 0.1, dur: 0.08, type: 'triangle', gain: 0.08 },
  ],
  // Prismoth: a fluttery shimmering trill.
  prismoth: [
    { f0: 780, f1: 960, time: 0, dur: 0.18, type: 'triangle', gain: 0.12, vibrato: [40, 44] },
    { f0: 1560, time: 0.04, dur: 0.14, type: 'sine', gain: 0.04, vibrato: [40, 30] },
  ],
  // Boggle: a low wet double croak.
  boggle: [
    { f0: 200, f1: 260, time: 0, dur: 0.1, type: 'sawtooth', gain: 0.13, vibrato: [40, 30] },
    { f0: 200, f1: 260, time: 0.14, dur: 0.12, type: 'sawtooth', gain: 0.12, vibrato: [40, 34] },
  ],
  // Stratoth: a deeper shimmering hum than Prismoth.
  stratoth: [
    { f0: 420, f1: 560, time: 0, dur: 0.24, type: 'triangle', gain: 0.13, vibrato: [24, 40] },
    { f0: 840, time: 0.04, dur: 0.2, type: 'sine', gain: 0.05, vibrato: [20, 24] },
  ],
  // Tidecaller: a resonant deep bell-toll over a water swell.
  tidecaller: [
    { f0: 196, f1: 262, time: 0, dur: 0.3, type: 'sine', gain: 0.14, vibrato: [10, 20] },
    { f0: 392, time: 0.02, dur: 0.26, type: 'sine', gain: 0.06, vibrato: [8, 12] },
    { f0: 588, time: 0.04, dur: 0.18, type: 'triangle', gain: 0.04 },
  ],
  // Prismatide: a slicing crystalline chime-run.
  prismatide: [
    { f0: 520, f1: 780, time: 0, dur: 0.1, type: 'triangle', gain: 0.13, vibrato: [20, 20] },
    { f0: 1040, time: 0.06, dur: 0.16, type: 'sine', gain: 0.06, vibrato: [16, 16] },
    { f0: 780, f1: 1170, time: 0.12, dur: 0.1, type: 'sine', gain: 0.06 },
  ],
  // Boggart: a big gloopy gulp, lower than Shardling.
  boggart: [
    { f0: 220, f1: 460, time: 0, dur: 0.1, type: 'sine', gain: 0.14 },
    { f0: 300, f1: 620, time: 0.11, dur: 0.1, type: 'sine', gain: 0.11 },
    { f0: 700, time: 0.02, dur: 0.16, type: 'triangle', gain: 0.04 },
  ],
  // Glaciark: a deep glacial groan with an ice crack.
  glaciark: [
    { f0: 150, f1: 120, time: 0, dur: 0.34, type: 'sine', gain: 0.14, vibrato: [6, 18] },
    { f0: 300, time: 0.12, dur: 0.06, type: 'square', gain: 0.06 },
    { f0: 450, f1: 380, time: 0.04, dur: 0.24, type: 'triangle', gain: 0.05, vibrato: [8, 12] },
  ],
  // Gustwing: a rushing airy cry that lifts then falls away.
  gustwing: [
    { f0: 620, f1: 900, time: 0, dur: 0.14, type: 'sine', gain: 0.13, vibrato: [14, 20] },
    { f0: 900, f1: 560, time: 0.13, dur: 0.24, type: 'triangle', gain: 0.11, vibrato: [12, 30] },
    { f0: 1240, time: 0.04, dur: 0.14, type: 'sine', gain: 0.03 },
  ],
  // Tempestrix: a keening storm-shriek.
  tempestrix: [
    { f0: 520, f1: 820, time: 0, dur: 0.2, type: 'sawtooth', gain: 0.12, vibrato: [18, 34] },
    { f0: 820, f1: 640, time: 0.18, dur: 0.18, type: 'triangle', gain: 0.09, vibrato: [16, 26] },
  ],
  // Wellspring: a clear rising bubble-chime.
  wellspring: [
    { f0: 440, f1: 660, time: 0, dur: 0.1, type: 'sine', gain: 0.13 },
    { f0: 660, f1: 880, time: 0.1, dur: 0.12, type: 'sine', gain: 0.11 },
    { f0: 1100, time: 0.04, dur: 0.14, type: 'triangle', gain: 0.04, vibrato: [8, 8] },
  ],
  // Tidalby: a rolling watery warble.
  tidalby: [
    { f0: 340, f1: 520, time: 0, dur: 0.14, type: 'sine', gain: 0.13, vibrato: [12, 22] },
    { f0: 520, f1: 400, time: 0.13, dur: 0.16, type: 'triangle', gain: 0.1, vibrato: [14, 26] },
  ],
  // Maelstrom: a churning roar-swell.
  maelstrom: [
    { f0: 220, f1: 340, time: 0, dur: 0.2, type: 'sawtooth', gain: 0.13, vibrato: [16, 30] },
    { f0: 340, f1: 260, time: 0.18, dur: 0.18, type: 'triangle', gain: 0.09, vibrato: [12, 24] },
    { f0: 500, time: 0.04, dur: 0.16, type: 'sine', gain: 0.04 },
  ],

  // --- Nature line (beasts, insects, plants): warbles, roars & clicks -------
  // Fenrix: a sharp yipping howl that rises then holds.
  fenrix: [
    { f0: 420, f1: 620, time: 0, dur: 0.1, type: 'sawtooth', gain: 0.14, vibrato: [30, 20] },
    { f0: 620, f1: 560, time: 0.1, dur: 0.22, type: 'sawtooth', gain: 0.12, vibrato: [16, 40] },
    { f0: 300, time: 0.02, dur: 0.2, type: 'triangle', gain: 0.06 },
  ],
  // Gravemaw: a gnashing chitter-hiss.
  gravemaw: [
    { f0: 240, f1: 200, time: 0, dur: 0.16, type: 'sawtooth', gain: 0.13, vibrato: [50, 30] },
    { f0: 700, f1: 500, time: 0.08, dur: 0.1, type: 'square', gain: 0.06, vibrato: [80, 40] },
  ],
  // Frondle: a leafy rustling warble.
  frondle: [
    { f0: 320, f1: 480, time: 0, dur: 0.14, type: 'triangle', gain: 0.13, vibrato: [26, 34] },
    { f0: 480, f1: 400, time: 0.13, dur: 0.14, type: 'triangle', gain: 0.1, vibrato: [20, 24] },
  ],
  // Thorncat: a snarling yowl.
  thorncat: [
    { f0: 460, f1: 600, time: 0, dur: 0.12, type: 'sawtooth', gain: 0.14, vibrato: [28, 30] },
    { f0: 600, f1: 380, time: 0.12, dur: 0.18, type: 'sawtooth', gain: 0.11, vibrato: [22, 40] },
  ],
  // Chitter: rapid dry clicks.
  chitter: [
    { f0: 1100, time: 0, dur: 0.04, type: 'square', gain: 0.1, vibrato: [110, 50] },
    { f0: 1300, time: 0.05, dur: 0.04, type: 'square', gain: 0.1, vibrato: [110, 50] },
    { f0: 1000, f1: 1250, time: 0.1, dur: 0.06, type: 'square', gain: 0.08, vibrato: [130, 40] },
  ],
  // Grovelord: a booming beastly roar.
  grovelord: [
    { f0: 130, f1: 190, time: 0, dur: 0.32, type: 'sawtooth', gain: 0.17, vibrato: [20, 24] },
    { f0: 84, f1: 120, time: 0.02, dur: 0.32, type: 'square', gain: 0.08, vibrato: [16, 12] },
    { f0: 200, f1: 160, time: 0.28, dur: 0.2, type: 'sawtooth', gain: 0.12, vibrato: [16, 30] },
  ],
  // Direfang: a vicious lower roar-snarl.
  direfang: [
    { f0: 150, f1: 220, time: 0, dur: 0.16, type: 'sawtooth', gain: 0.16, vibrato: [26, 30] },
    { f0: 220, f1: 160, time: 0.16, dur: 0.22, type: 'sawtooth', gain: 0.13, vibrato: [18, 44] },
    { f0: 96, time: 0.02, dur: 0.3, type: 'square', gain: 0.07 },
  ],
  // Mantiscar: a bigger gnashing hiss-click.
  mantiscar: [
    { f0: 200, f1: 170, time: 0, dur: 0.16, type: 'sawtooth', gain: 0.13, vibrato: [46, 28] },
    { f0: 560, f1: 760, time: 0.06, dur: 0.12, type: 'square', gain: 0.07, vibrato: [90, 44] },
  ],
  // Gravestalker: a low predatory growl-howl.
  gravestalker: [
    { f0: 200, f1: 300, time: 0, dur: 0.12, type: 'sawtooth', gain: 0.15, vibrato: [24, 22] },
    { f0: 300, f1: 240, time: 0.12, dur: 0.22, type: 'sawtooth', gain: 0.12, vibrato: [16, 40] },
  ],
  // Thornpanther: a coiled snarl breaking into a scream.
  thornpanther: [
    { f0: 220, f1: 300, time: 0, dur: 0.1, type: 'sawtooth', gain: 0.14, vibrato: [30, 24] },
    { f0: 300, f1: 520, time: 0.1, dur: 0.2, type: 'sawtooth', gain: 0.12, vibrato: [22, 40] },
  ],
  // Verdanox: a towering wooden groan-roar.
  verdanox: [
    { f0: 120, f1: 170, time: 0, dur: 0.32, type: 'sawtooth', gain: 0.15, vibrato: [18, 22] },
    { f0: 78, time: 0.02, dur: 0.3, type: 'square', gain: 0.08 },
    { f0: 300, f1: 240, time: 0.24, dur: 0.16, type: 'triangle', gain: 0.06, vibrato: [16, 30] },
  ],
  // Chitterling: a fast insect trill.
  chitterling: [
    { f0: 1000, f1: 1200, time: 0, dur: 0.05, type: 'square', gain: 0.1, vibrato: [100, 50] },
    { f0: 1200, f1: 900, time: 0.06, dur: 0.05, type: 'square', gain: 0.1, vibrato: [100, 50] },
    { f0: 1100, f1: 1400, time: 0.12, dur: 0.07, type: 'square', gain: 0.08, vibrato: [120, 40] },
  ],
  // Carapex: a heavier chitinous rattle.
  carapex: [
    { f0: 300, f1: 260, time: 0, dur: 0.1, type: 'sawtooth', gain: 0.12, vibrato: [70, 30] },
    { f0: 820, time: 0.06, dur: 0.06, type: 'square', gain: 0.07, vibrato: [110, 50] },
    { f0: 700, f1: 900, time: 0.12, dur: 0.06, type: 'square', gain: 0.06 },
  ],
  // Bloomkin: a bright blooming warble.
  bloomkin: [
    { f0: 360, f1: 540, time: 0, dur: 0.14, type: 'triangle', gain: 0.14, vibrato: [24, 34] },
    { f0: 540, f1: 480, time: 0.13, dur: 0.16, type: 'sine', gain: 0.1, vibrato: [18, 22] },
    { f0: 720, time: 0.05, dur: 0.1, type: 'sine', gain: 0.04 },
  ],
  // Thornward: a woody bark-warble, lower.
  thornward: [
    { f0: 260, f1: 400, time: 0, dur: 0.14, type: 'triangle', gain: 0.14, vibrato: [22, 30] },
    { f0: 400, f1: 320, time: 0.13, dur: 0.16, type: 'sawtooth', gain: 0.08, vibrato: [18, 24] },
  ],
  // Verdammon: a resonant grove-groan.
  verdammon: [
    { f0: 170, f1: 240, time: 0, dur: 0.26, type: 'sawtooth', gain: 0.14, vibrato: [18, 24] },
    { f0: 110, time: 0.02, dur: 0.24, type: 'square', gain: 0.07 },
    { f0: 360, f1: 300, time: 0.2, dur: 0.14, type: 'triangle', gain: 0.06, vibrato: [16, 26] },
  ],

  // --- Dark line (wisps, wraiths, shades): hollow moans & rising screeches --
  // Wispling: a thin ghostly whine that sinks.
  wispling: [
    { f0: 620, f1: 440, time: 0, dur: 0.26, type: 'sine', gain: 0.13, vibrato: [8, 26] },
    { f0: 820, f1: 560, time: 0.05, dur: 0.22, type: 'triangle', gain: 0.05, vibrato: [11, 20] },
  ],
  // Cryptguard: a hollow armored groan with a metallic ring.
  cryptguard: [
    { f0: 160, f1: 130, time: 0, dur: 0.3, type: 'sawtooth', gain: 0.13, vibrato: [14, 18] },
    { f0: 320, time: 0.12, dur: 0.08, type: 'square', gain: 0.06 },
    { f0: 240, f1: 180, time: 0.2, dur: 0.16, type: 'sine', gain: 0.07, vibrato: [9, 24] },
  ],
  // Nocturne: a low sweeping wail.
  nocturne: [
    { f0: 340, f1: 240, time: 0, dur: 0.3, type: 'sine', gain: 0.14, vibrato: [7, 34] },
    { f0: 520, f1: 300, time: 0.06, dur: 0.24, type: 'sawtooth', gain: 0.05, vibrato: [10, 26] },
  ],
  // Banshade: a wailing shriek that rises.
  banshade: [
    { f0: 360, f1: 640, time: 0, dur: 0.26, type: 'sawtooth', gain: 0.13, vibrato: [12, 40] },
    { f0: 540, f1: 900, time: 0.06, dur: 0.24, type: 'sine', gain: 0.06, vibrato: [14, 30] },
  ],
  // Duskfang: a sinister low screech.
  duskfang: [
    { f0: 300, f1: 520, time: 0, dur: 0.12, type: 'sawtooth', gain: 0.14, vibrato: [40, 30] },
    { f0: 520, f1: 380, time: 0.12, dur: 0.16, type: 'square', gain: 0.08, vibrato: [30, 40] },
  ],
  // Nightmaw: a guttural devouring growl.
  nightmaw: [
    { f0: 180, f1: 260, time: 0, dur: 0.16, type: 'sawtooth', gain: 0.15, vibrato: [34, 26] },
    { f0: 120, f1: 90, time: 0.14, dur: 0.18, type: 'square', gain: 0.08, vibrato: [20, 14] },
  ],
  // Umbranox: a deep hollow void-moan with a bite.
  umbranox: [
    { f0: 160, f1: 110, time: 0, dur: 0.3, type: 'sine', gain: 0.14, vibrato: [7, 30] },
    { f0: 320, f1: 220, time: 0.04, dur: 0.16, type: 'sawtooth', gain: 0.07, vibrato: [24, 30] },
  ],
  // Gloomshade: a creeping shadowy moan.
  gloomshade: [
    { f0: 380, f1: 260, time: 0, dur: 0.28, type: 'sine', gain: 0.13, vibrato: [8, 26] },
    { f0: 300, f1: 200, time: 0.06, dur: 0.24, type: 'triangle', gain: 0.06, vibrato: [11, 18] },
  ],
  // Oblivion: a swallowing void-drone.
  oblivion: [
    { f0: 200, f1: 130, time: 0, dur: 0.32, type: 'sine', gain: 0.14, vibrato: [6, 28] },
    { f0: 400, f1: 260, time: 0.04, dur: 0.2, type: 'sawtooth', gain: 0.05, vibrato: [9, 22] },
  ],
  // Revenance (the Unnamed — final boss): a vast forgotten wail, lower and
  // longer than anything else so it reads as dread itself.
  revenance: [
    { f0: 120, f1: 90, time: 0, dur: 0.4, type: 'sawtooth', gain: 0.16, vibrato: [6, 30] },
    { f0: 240, f1: 150, time: 0.04, dur: 0.36, type: 'sine', gain: 0.08, vibrato: [8, 24] },
    { f0: 360, f1: 200, time: 0.1, dur: 0.28, type: 'sawtooth', gain: 0.05, vibrato: [10, 34] },
  ],

  // --- The Last Light & story souls: gentle, fading voices ------------------
  // The Last Light (a soul about to cross): a fragile, fading chime-sigh.
  lastlight: [
    { f0: 880, f1: 660, time: 0, dur: 0.3, type: 'sine', gain: 0.1, vibrato: [5, 10] },
    { f0: 1320, f1: 990, time: 0.06, dur: 0.28, type: 'sine', gain: 0.04, vibrato: [4, 8] },
  ],
  // Grievewisp: a small sorrowful whimper-moan.
  grievewisp: [
    { f0: 520, f1: 380, time: 0, dur: 0.24, type: 'sine', gain: 0.12, vibrato: [7, 22] },
    { f0: 700, f1: 500, time: 0.05, dur: 0.2, type: 'triangle', gain: 0.05, vibrato: [9, 16] },
  ],
  // Mournlight: a grieving low wail.
  mournlight: [
    { f0: 340, f1: 240, time: 0, dur: 0.3, type: 'sine', gain: 0.13, vibrato: [6, 28] },
    { f0: 460, f1: 320, time: 0.06, dur: 0.24, type: 'triangle', gain: 0.06, vibrato: [8, 20] },
  ],
  // Keptsoul: a held, aching hum that steadies.
  keptsoul: [
    { f0: 240, f1: 300, time: 0, dur: 0.28, type: 'triangle', gain: 0.13, vibrato: [8, 18] },
    { f0: 180, time: 0.02, dur: 0.26, type: 'sine', gain: 0.07, vibrato: [6, 12] },
  ],
  // Heldshade: a deep clung-to sorrow-drone.
  heldshade: [
    { f0: 150, f1: 110, time: 0, dur: 0.34, type: 'sine', gain: 0.14, vibrato: [6, 24] },
    { f0: 300, f1: 220, time: 0.04, dur: 0.24, type: 'sawtooth', gain: 0.05, vibrato: [9, 20] },
    { f0: 90, time: 0.02, dur: 0.3, type: 'square', gain: 0.06 },
  ],

  // --- The Last Lantern (fire-flame beings): warm, flickering voices --------
  // Emberkeep: a soft flickering flame-flutter.
  emberkeep: [
    { f0: 340, f1: 460, time: 0, dur: 0.16, type: 'triangle', gain: 0.13, vibrato: [26, 30] },
    { f0: 680, time: 0.04, dur: 0.12, type: 'sine', gain: 0.05, vibrato: [30, 20] },
  ],
  // Lanternwake: a warm rising flame-hum.
  lanternwake: [
    { f0: 280, f1: 420, time: 0, dur: 0.18, type: 'triangle', gain: 0.14, vibrato: [22, 28] },
    { f0: 420, f1: 360, time: 0.16, dur: 0.16, type: 'sine', gain: 0.08, vibrato: [18, 20] },
  ],
  // Everember: a deep resonant furnace-glow tone.
  everember: [
    { f0: 160, f1: 220, time: 0, dur: 0.3, type: 'sawtooth', gain: 0.14, vibrato: [18, 22] },
    { f0: 320, f1: 400, time: 0.04, dur: 0.24, type: 'triangle', gain: 0.07, vibrato: [16, 26] },
    { f0: 100, time: 0.02, dur: 0.26, type: 'square', gain: 0.06 },
  ],
  // Ashmoth: a smoky fluttering hiss.
  ashmoth: [
    { f0: 520, f1: 700, time: 0, dur: 0.14, type: 'triangle', gain: 0.12, vibrato: [44, 40] },
    { f0: 900, f1: 620, time: 0.06, dur: 0.12, type: 'square', gain: 0.05, vibrato: [60, 34] },
  ],
  // Cindershroud: a low shrouded rasp.
  cindershroud: [
    { f0: 220, f1: 300, time: 0, dur: 0.16, type: 'sawtooth', gain: 0.14, vibrato: [30, 26] },
    { f0: 160, f1: 120, time: 0.14, dur: 0.18, type: 'sine', gain: 0.07, vibrato: [10, 20] },
  ],
  // Wardling: a bright dutiful flame-call.
  wardling: [
    { f0: 320, f1: 480, time: 0, dur: 0.14, type: 'triangle', gain: 0.14, vibrato: [24, 26] },
    { f0: 480, f1: 420, time: 0.13, dur: 0.16, type: 'sine', gain: 0.09, vibrato: [18, 18] },
  ],
  // Reliquary: a solemn deep bell-toll of flame.
  reliquary: [
    { f0: 174, f1: 232, time: 0, dur: 0.3, type: 'sine', gain: 0.14, vibrato: [10, 18] },
    { f0: 348, time: 0.02, dur: 0.24, type: 'triangle', gain: 0.06, vibrato: [12, 16] },
    { f0: 130, time: 0.04, dur: 0.24, type: 'sawtooth', gain: 0.05 },
  ],
  // Lanternlord: a vast roaring beacon-flame.
  lanternlord: [
    { f0: 130, f1: 190, time: 0, dur: 0.34, type: 'sawtooth', gain: 0.16, vibrato: [18, 26] },
    { f0: 84, f1: 120, time: 0.02, dur: 0.32, type: 'square', gain: 0.09, vibrato: [16, 14] },
    { f0: 260, f1: 340, time: 0.28, dur: 0.18, type: 'triangle', gain: 0.09, vibrato: [16, 30] },
  ],

  // --- Named companions: brief, more "voiced" hums --------------------------
  // Wren: a wary, quiet two-note hum.
  wren: [
    { f0: 300, f1: 340, time: 0, dur: 0.12, type: 'triangle', gain: 0.11, vibrato: [10, 12] },
    { f0: 260, f1: 300, time: 0.13, dur: 0.16, type: 'sine', gain: 0.09, vibrato: [8, 10] },
  ],
  // Sena Vale: a warm, bright hum-lilt.
  senaVale: [
    { f0: 420, f1: 520, time: 0, dur: 0.12, type: 'triangle', gain: 0.11, vibrato: [9, 12] },
    { f0: 520, f1: 470, time: 0.13, dur: 0.16, type: 'sine', gain: 0.09, vibrato: [7, 10] },
  ],
  // Kade: a cocky rising whistle-note.
  kade: [
    { f0: 380, f1: 560, time: 0, dur: 0.12, type: 'triangle', gain: 0.11, vibrato: [12, 16] },
    { f0: 560, f1: 620, time: 0.12, dur: 0.14, type: 'sine', gain: 0.08 },
  ],

  // --- Expanded roster: reach mid-tiers & wardens (same element recipes) ----
  // Water: misty coos & cold wails.
  // Mistling: a soft misty coo that lifts then fades.
  mistling: [
    { f0: 560, f1: 760, time: 0, dur: 0.16, type: 'sine', gain: 0.12, vibrato: [10, 16] },
    { f0: 760, f1: 600, time: 0.15, dur: 0.18, type: 'sine', gain: 0.08, vibrato: [12, 20] },
  ],
  // Bloomstalker: a sly watery warble breaking into a hiss.
  bloomstalker: [
    { f0: 420, f1: 560, time: 0, dur: 0.14, type: 'triangle', gain: 0.13, vibrato: [22, 28] },
    { f0: 780, f1: 620, time: 0.08, dur: 0.12, type: 'square', gain: 0.05, vibrato: [40, 26] },
  ],
  // Direwisp: a cold rising water-wail.
  direwisp: [
    { f0: 360, f1: 560, time: 0, dur: 0.24, type: 'sine', gain: 0.13, vibrato: [9, 26] },
    { f0: 540, f1: 760, time: 0.06, dur: 0.2, type: 'triangle', gain: 0.05, vibrato: [12, 22] },
  ],
  // Stillguard: a calm, deep water-hum.
  stillguard: [
    { f0: 220, f1: 280, time: 0, dur: 0.28, type: 'sine', gain: 0.14, vibrato: [8, 16] },
    { f0: 330, time: 0.04, dur: 0.2, type: 'triangle', gain: 0.06, vibrato: [10, 12] },
  ],

  // Fire: rough snarls, chants & solemn tolls.
  // Cindermage: a crackling ember-chant with a high spark.
  cindermage: [
    { f0: 260, f1: 360, time: 0, dur: 0.16, type: 'sawtooth', gain: 0.13, vibrato: [30, 24] },
    { f0: 720, f1: 960, time: 0.1, dur: 0.1, type: 'square', gain: 0.05, vibrato: [50, 20] },
  ],
  // Palefire: a pale, flickering flame-wail.
  palefire: [
    { f0: 380, f1: 300, time: 0, dur: 0.24, type: 'triangle', gain: 0.12, vibrato: [16, 26] },
    { f0: 560, f1: 460, time: 0.06, dur: 0.18, type: 'sine', gain: 0.05, vibrato: [22, 20] },
  ],
  // Sporefang: a hissing spark-snarl.
  sporefang: [
    { f0: 300, f1: 460, time: 0, dur: 0.12, type: 'sawtooth', gain: 0.14, vibrato: [36, 28] },
    { f0: 620, f1: 820, time: 0.1, dur: 0.12, type: 'square', gain: 0.06, vibrato: [50, 30] },
  ],
  // Vineraptor: a screeching fiery raptor call.
  vineraptor: [
    { f0: 380, f1: 640, time: 0, dur: 0.12, type: 'sawtooth', gain: 0.15, vibrato: [28, 30] },
    { f0: 640, f1: 500, time: 0.12, dur: 0.18, type: 'sawtooth', gain: 0.11, vibrato: [20, 44] },
  ],
  // Gravecant: a chanting low flame-drone with a dark edge.
  gravecant: [
    { f0: 180, f1: 240, time: 0, dur: 0.28, type: 'sawtooth', gain: 0.13, vibrato: [16, 22] },
    { f0: 360, f1: 300, time: 0.06, dur: 0.2, type: 'sine', gain: 0.05, vibrato: [10, 24] },
  ],
  // Emberward: a warm, steadfast flame-call, lower.
  emberward: [
    { f0: 240, f1: 360, time: 0, dur: 0.2, type: 'sawtooth', gain: 0.15, vibrato: [22, 24] },
    { f0: 150, f1: 200, time: 0.02, dur: 0.24, type: 'square', gain: 0.07, vibrato: [18, 12] },
  ],
  // Vowkeeper: a solemn oath-toll of flame.
  vowkeeper: [
    { f0: 196, f1: 262, time: 0, dur: 0.3, type: 'sine', gain: 0.14, vibrato: [10, 16] },
    { f0: 392, time: 0.02, dur: 0.22, type: 'triangle', gain: 0.06, vibrato: [12, 14] },
    { f0: 147, time: 0.04, dur: 0.24, type: 'sawtooth', gain: 0.05 },
  ],

  // Machine: stepped beeps, motor whirs & arcane drones.
  // Geomote: a grinding pebble-rattle between two beeps.
  geomote: [
    { f0: 200, f1: 160, time: 0, dur: 0.14, type: 'sawtooth', gain: 0.12, glide: 'lin', vibrato: [40, 10] },
    { f0: 340, time: 0.08, dur: 0.05, type: 'square', gain: 0.08 },
    { f0: 260, time: 0.14, dur: 0.05, type: 'square', gain: 0.07 },
  ],
  // Shieldshard: a metallic clang over a short motor.
  shieldshard: [
    { f0: 260, time: 0, dur: 0.08, type: 'square', gain: 0.12 },
    { f0: 150, f1: 180, time: 0.02, dur: 0.22, type: 'sawtooth', gain: 0.09, glide: 'lin', vibrato: [28, 8] },
    { f0: 420, time: 0.1, dur: 0.05, type: 'square', gain: 0.07 },
  ],
  // Prismguard: a resonant crystalline-metal tone with a beep.
  prismguard: [
    { f0: 180, f1: 220, time: 0, dur: 0.24, type: 'sawtooth', gain: 0.12, glide: 'lin', vibrato: [20, 8] },
    { f0: 660, time: 0.06, dur: 0.16, type: 'sine', gain: 0.05, vibrato: [12, 10] },
    { f0: 990, time: 0.12, dur: 0.1, type: 'triangle', gain: 0.04 },
  ],
  // Hexshade: a glitchy arcane-machine warble.
  hexshade: [
    { f0: 300, f1: 220, time: 0, dur: 0.24, type: 'sawtooth', gain: 0.12, glide: 'lin', vibrato: [26, 24] },
    { f0: 600, f1: 460, time: 0.06, dur: 0.16, type: 'square', gain: 0.05, vibrato: [40, 20] },
  ],
  // Nullmancer: a droning, detuned null-tone that sinks.
  nullmancer: [
    { f0: 200, f1: 150, time: 0, dur: 0.3, type: 'square', gain: 0.12, glide: 'lin', vibrato: [8, 12] },
    { f0: 202, f1: 152, time: 0.02, dur: 0.28, type: 'sawtooth', gain: 0.06, glide: 'lin', vibrato: [6, 10] },
  ],
  // Sigilwarden: a deep rune-drone under a metallic chime.
  sigilwarden: [
    { f0: 130, f1: 110, time: 0, dur: 0.32, type: 'sawtooth', gain: 0.14, glide: 'lin', vibrato: [14, 8] },
    { f0: 520, time: 0.1, dur: 0.14, type: 'sine', gain: 0.06, vibrato: [10, 10] },
    { f0: 780, time: 0.16, dur: 0.1, type: 'triangle', gain: 0.04 },
  ],
  // Vaultwarden: a massive vault-door groan, the lowest machine of all.
  vaultwarden: [
    { f0: 80, f1: 66, time: 0, dur: 0.36, type: 'sawtooth', gain: 0.15, glide: 'lin', vibrato: [16, 5] },
    { f0: 160, time: 0.16, dur: 0.06, type: 'square', gain: 0.08 },
    { f0: 54, time: 0.02, dur: 0.32, type: 'square', gain: 0.06 },
  ],

  // Nature: big grove-groans & scything rasps.
  // Ashkeeper: a big ashen grove-groan.
  ashkeeper: [
    { f0: 150, f1: 210, time: 0, dur: 0.3, type: 'sawtooth', gain: 0.15, vibrato: [18, 22] },
    { f0: 96, time: 0.02, dur: 0.28, type: 'square', gain: 0.08 },
    { f0: 320, f1: 260, time: 0.24, dur: 0.14, type: 'triangle', gain: 0.06, vibrato: [16, 26] },
  ],
  // Thornreaper: a huge scything roar-rasp.
  thornreaper: [
    { f0: 130, f1: 200, time: 0, dur: 0.18, type: 'sawtooth', gain: 0.16, vibrato: [24, 28] },
    { f0: 200, f1: 150, time: 0.16, dur: 0.22, type: 'sawtooth', gain: 0.12, vibrato: [16, 40] },
    { f0: 84, time: 0.02, dur: 0.3, type: 'square', gain: 0.07 },
  ],
};

export type MusicTrack = 'hub' | 'dungeon' | 'battle' | 'boss' | 'finalboss' | 'crystal' | 'haunted' | 'jungle' | null;

// ============================ MUSIC DATA ==================================
// Rich tracks are step sequences on a 16th-note grid. A voice's `seq` holds, per
// step: a semitone offset from the track root, a chord (array of offsets), `1`
// for a pitchless percussion hit, or null (rest). Each voice loops by its own
// length, so a 16-step drum can run under a 128-step melody.

type Wave = 'strings' | 'flute' | 'cello';

type Inst =
  | 'pad'
  | 'pluck'
  | 'bass'
  | 'sub'
  | 'bell'
  | 'kick'
  | 'tom'
  | 'hat'
  | 'noise'
  | 'strings'
  | 'flute'
  | 'cello'
  | 'abass'
  | 'harp';

interface Voice {
  inst: Inst;
  gain: number;
  /** Note length in 16th steps (sustained instruments). */
  dur?: number;
  /** Plucks: brighter, more resonant filter. */
  bright?: boolean;
  /** Hats: open (longer) vs closed. */
  open?: boolean;
  seq: (number | number[] | null)[];
}

interface RichTrack {
  rich: true;
  bpm: number;
  root: number;
  /** Layer intermittent randomised bird calls over the loop (see `chirp()`). */
  birds?: boolean;
  voices: Voice[];
}

/** Build a sparse sequence: `{step: note}`, everything else a rest. */
function pmap(len: number, obj: Record<number, number | number[]>): (number | number[] | null)[] {
  const a: (number | number[] | null)[] = new Array(len).fill(null);
  for (const k in obj) a[+k] = obj[k];
  return a;
}
/** Build a percussion sequence: hits at the given steps. */
function phits(len: number, ps: number[]): (number | null)[] {
  const a: (number | null)[] = new Array(len).fill(null);
  for (const p of ps) a[p] = 1;
  return a;
}
/** Repeat a bar pattern `n` times. */
function prep<T>(arr: T[], n: number): T[] {
  let out: T[] = [];
  for (let i = 0; i < n; i++) out = out.concat(arr);
  return out;
}
/** A gentle up-then-down harp arpeggio across one 16-step bar (4 chord tones). */
function harpBar(t: number[]): (number | null)[] {
  const a: (number | null)[] = new Array(16).fill(null);
  const p = [t[0], t[1], t[2], t[3], t[2], t[1], t[0], t[1]];
  for (let i = 0; i < 8; i++) a[i * 2] = p[i];
  return a;
}

// The Everwake (intro town): an 8-bar theme — string bed, cello counter-line,
// harp arpeggios and a flute melody. F major, i–vi–IV–V-ish.
function everwakeVoices(): Voice[] {
  const Sv = [
    [0, 4, 7],
    [-3, 0, 4],
    [0, 5, 9],
    [-1, 2, 7],
    [-3, 0, 4],
    [0, 5, 9],
    [2, 5, 9],
    [-1, 2, 7],
  ];
  const Bv = [-12, -3, -7, -5, -3, -7, -10, -5];
  const Hv = [
    [0, 4, 7, 12],
    [-3, 0, 4, 9],
    [0, 5, 9, 12],
    [-1, 2, 7, 11],
    [-3, 0, 4, 9],
    [0, 5, 9, 12],
    [2, 5, 9, 14],
    [-1, 2, 7, 11],
  ];
  const strings: (number[] | null)[] = new Array(128).fill(null);
  const bass: (number | null)[] = new Array(128).fill(null);
  const harp: (number | null)[] = new Array(128).fill(null);
  for (let b = 0; b < 8; b++) {
    strings[b * 16] = Sv[b];
    bass[b * 16] = Bv[b];
    bass[b * 16 + 8] = Bv[b];
    const hb = harpBar(Hv[b]);
    for (let i = 0; i < 16; i++) if (hb[i] != null) harp[b * 16 + i] = hb[i];
  }
  const flute = pmap(128, {
    0: 19,
    4: 21,
    8: 19,
    12: 16,
    16: 17,
    20: 16,
    24: 14,
    28: 16,
    32: 17,
    38: 19,
    40: 21,
    44: 19,
    48: 16,
    52: 14,
    56: 14,
    60: 12,
    64: 21,
    68: 23,
    72: 21,
    76: 19,
    80: 17,
    84: 19,
    88: 21,
    92: 24,
    96: 23,
    100: 21,
    104: 19,
    108: 17,
    112: 16,
    116: 14,
    120: 12,
  });
  const counter = pmap(128, { 16: 0, 24: 2, 48: 4, 56: 2, 80: 5, 88: 7, 96: 5, 104: 4, 120: 0 });
  return [
    { inst: 'strings', gain: 0.05, dur: 16, seq: strings },
    { inst: 'abass', gain: 0.12, dur: 8, seq: bass },
    { inst: 'harp', gain: 0.09, seq: harp },
    { inst: 'cello', gain: 0.09, dur: 6, seq: counter },
    { inst: 'flute', gain: 0.13, dur: 4, seq: flute },
  ];
}

// Crystal Cavern: bright, airy, major — glassy bells and high harp shimmer over
// an open pad. No beat. E major.
function crystalVoices(): Voice[] {
  const Hv = [
    [7, 12, 16, 19],
    [5, 9, 12, 17],
    [4, 9, 12, 16],
    [6, 11, 14, 18],
  ];
  const harp: (number | null)[] = new Array(64).fill(null);
  for (let b = 0; b < 4; b++) {
    const hb = harpBar(Hv[b]);
    for (let i = 0; i < 16; i++) if (hb[i] != null) harp[b * 16 + i] = hb[i];
  }
  return [
    {
      inst: 'pad',
      gain: 0.05,
      dur: 16,
      seq: pmap(64, { 0: [0, 4, 7], 16: [0, 5, 9], 32: [-3, 0, 4], 48: [-5, -1, 2] }),
    },
    { inst: 'sub', gain: 0.09, dur: 16, seq: pmap(64, { 0: -12, 16: -7, 32: -3, 48: -5 }) },
    { inst: 'harp', gain: 0.085, seq: harp },
    {
      inst: 'bell',
      gain: 0.09,
      dur: 10,
      seq: pmap(64, { 0: 19, 8: 21, 16: 24, 24: 21, 32: 19, 40: 16, 48: 14, 56: 16 }),
    },
  ];
}

// The Overgrowth (jungle): warm and organic — a marimba-like pluck, warm pad, a
// pentatonic flute line and a soft shaker, with ambient birds over the top.
function overgrowthVoices(): Voice[] {
  const pluck16: (number | null)[] = [0, null, 7, null, 3, null, 10, null, 7, null, 5, null, 3, null, 7, null];
  const bassBars = [-12, -12, -7, -5];
  const bass: (number | null)[] = new Array(64).fill(null);
  for (let b = 0; b < 4; b++) {
    bass[b * 16] = bassBars[b];
    bass[b * 16 + 8] = bassBars[b];
  }
  return [
    { inst: 'pluck', gain: 0.09, dur: 2, bright: false, seq: prep(pluck16, 4) },
    { inst: 'abass', gain: 0.11, dur: 6, seq: bass },
    {
      inst: 'pad',
      gain: 0.045,
      dur: 16,
      seq: pmap(64, { 0: [0, 3, 7], 16: [0, 3, 7], 32: [-4, 0, 3], 48: [-2, 2, 5] }),
    },
    {
      inst: 'flute',
      gain: 0.1,
      dur: 4,
      seq: pmap(64, { 0: 12, 8: 15, 16: 19, 24: 15, 32: 17, 40: 19, 48: 22, 56: 19 }),
    },
    { inst: 'hat', gain: 0.03, open: false, seq: prep(phits(16, [4, 12]), 4) },
  ];
}

const TRACKS: Record<Exclude<MusicTrack, null>, RichTrack> = {
  // Intro town — orchestral ensemble arrangement.
  hub: { rich: true, bpm: 78, root: 174.6, voices: everwakeVoices() },
  // The Quiet Crossing (first dungeon) — "Underhush": dark ambient, near-beatless.
  dungeon: {
    rich: true,
    bpm: 60,
    root: 130.8,
    voices: [
      { inst: 'sub', gain: 0.15, dur: 8, seq: pmap(64, { 0: -24, 16: -24, 32: -24, 48: -24 }) },
      { inst: 'pad', gain: 0.05, dur: 64, seq: pmap(64, { 0: [-12, -5] }) },
      { inst: 'noise', gain: 0.06, dur: 24, seq: pmap(64, { 0: 1, 32: 1 }) },
      { inst: 'bell', gain: 0.09, dur: 14, seq: pmap(64, { 10: 18, 30: 13, 44: 22, 58: 15 }) },
    ],
  },
  // Crystal Cavern — bright, shimmering.
  crystal: { rich: true, bpm: 76, root: 164.8, voices: crystalVoices() },
  // Haunted Dungeon — "Bone Rhythm": ritual percussion + a menacing Phrygian bass.
  haunted: {
    rich: true,
    bpm: 96,
    root: 130.8,
    voices: [
      { inst: 'kick', gain: 0.13, seq: prep(phits(16, [0, 6, 10]), 2) },
      { inst: 'tom', gain: 0.11, seq: prep(pmap(16, { 8: 0, 14: -2 }), 2) },
      { inst: 'tom', gain: 0.1, seq: prep(pmap(16, { 3: 7, 11: 5 }), 2) },
      { inst: 'hat', gain: 0.05, open: false, seq: prep(phits(16, [2, 5, 7, 10, 13, 15]), 2) },
      {
        inst: 'bass',
        gain: 0.14,
        dur: 2,
        seq: prep([-12, null, null, -12, null, -11, null, -12, null, null, -4, null, -12, null, -11, null], 2),
      },
      { inst: 'pluck', gain: 0.07, dur: 4, bright: false, seq: pmap(32, { 24: 0, 26: 1, 28: -2, 30: 0 }) },
    ],
  },
  // The Overgrowth — warm, organic, with birds.
  jungle: { rich: true, bpm: 96, root: 130.8, birds: true, voices: overgrowthVoices() },

  // Normal battle — "Onset": heroic, propulsive, running bass + bright lead riff.
  battle: {
    rich: true,
    bpm: 150,
    root: 146.8,
    voices: [
      { inst: 'kick', gain: 0.12, seq: prep(phits(16, [0, 3, 6, 10]), 2) },
      { inst: 'hat', gain: 0.035, open: false, seq: prep(phits(16, [0, 2, 4, 6, 8, 10, 12, 14]), 2) },
      { inst: 'tom', gain: 0.09, seq: pmap(32, { 29: 0, 30: -3, 31: -5 }) },
      {
        inst: 'bass',
        gain: 0.14,
        dur: 2,
        seq: prep([0, null, 0, null, 7, null, 5, null, 0, null, 0, null, 10, null, 5, null], 2),
      },
      {
        inst: 'pad',
        gain: 0.05,
        dur: 3,
        seq: pmap(32, { 0: [0, 3, 7], 8: [0, 3, 7], 16: [-2, 1, 5], 24: [-2, 1, 5] }),
      },
      {
        inst: 'pluck',
        gain: 0.075,
        dur: 1,
        bright: true,
        seq: [
          12,
          null,
          15,
          17,
          null,
          19,
          17,
          15,
          null,
          17,
          19,
          22,
          19,
          17,
          15,
          12,
          12,
          null,
          15,
          19,
          null,
          22,
          19,
          17,
          null,
          15,
          17,
          19,
          22,
          24,
          22,
          19,
        ],
      },
    ],
  },
  // Boss battle — "The Warden": crushing, Phrygian, double-kick + dissonant bell.
  boss: {
    rich: true,
    bpm: 158,
    root: 130.8,
    voices: [
      { inst: 'kick', gain: 0.13, seq: prep(phits(16, [0, 2, 8, 10]), 2) },
      { inst: 'tom', gain: 0.1, seq: prep(pmap(16, { 6: 0, 14: -2 }), 2) },
      { inst: 'hat', gain: 0.04, open: false, seq: prep(phits(16, [4, 12]), 2) },
      {
        inst: 'bass',
        gain: 0.15,
        dur: 2,
        seq: prep([-12, null, -12, -11, null, -12, null, -14, -12, null, -12, -11, null, -14, null, -17], 2),
      },
      { inst: 'pad', gain: 0.05, dur: 16, seq: pmap(32, { 0: [0, 3, 7], 16: [1, 4, 8] }) },
      { inst: 'bell', gain: 0.06, dur: 8, seq: pmap(32, { 6: 13, 22: 18 }) },
      { inst: 'pluck', gain: 0.07, dur: 2, bright: true, seq: pmap(32, { 8: 0, 10: 1, 12: 0, 24: 0, 26: -2, 28: 0 }) },
    ],
  },
  // Final boss — "Everwake's End": fast and cinematic, a churning 16th ostinato
  // under a soaring lead and a choir-like pad. Grander and more tragic than the
  // Warden — reserved for the last reach's boss.
  finalboss: {
    rich: true,
    bpm: 168,
    root: 146.8,
    voices: [
      { inst: 'kick', gain: 0.12, seq: prep(phits(16, [0, 4, 8, 10, 12]), 2) },
      { inst: 'hat', gain: 0.03, open: false, seq: prep(phits(16, [0, 2, 4, 6, 8, 10, 12, 14]), 2) },
      { inst: 'pluck', gain: 0.06, dur: 1, bright: true, seq: prep([0, 3, 7, 12, 7, 3, 0, 3], 4) },
      {
        inst: 'bass',
        gain: 0.14,
        dur: 2,
        seq: prep([0, null, null, 0, null, 0, null, null, -2, null, null, -2, null, -4, null, -5], 2),
      },
      { inst: 'pad', gain: 0.04, dur: 16, seq: pmap(32, { 0: [7, 10, 14], 16: [5, 9, 12] }) },
      {
        inst: 'flute',
        gain: 0.1,
        dur: 4,
        seq: pmap(32, { 0: 19, 6: 22, 8: 21, 12: 19, 16: 24, 22: 22, 24: 21, 28: 19 }),
      },
    ],
  },
};

/** Resting music level. Kept in one place so `duck()` can restore it exactly. */
const MUSIC_LEVEL = 0.34;
/**
 * Monster cries are the one sound meant to grab the ear (a Pokémon-style call),
 * so they are lifted above the rest of the mix. Without this a cry renders at
 * roughly the same peak as the impact sfx it plays under and is masked by it.
 */
const CRY_BOOST = 2;

interface VoiceCfg {
  wave: PeriodicWave;
  voices?: number;
  detune?: number;
  atk?: number;
  rel?: number;
  cutoff?: number;
  vib?: [number, number];
  breath?: boolean;
  pan?: number;
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private timer: number | null = null;
  private track: MusicTrack = null;
  muted = false;
  /** Overall level — placeholder audio should never be loud. */
  volume = 0.5;

  // --- rich-engine (baked sampler) state ---
  private richReady = false;
  private waves: Partial<Record<Wave, PeriodicWave>> = {};
  private harpBuf: AudioBuffer | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private convolver: ConvolverNode | null = null;
  private richDry: GainNode | null = null;
  private ins: Record<'strings' | 'flute' | 'cello' | 'abass', VoiceCfg> | null = null;
  private dangerGain: GainNode | null = null;
  /** When true, an urgent low-HP pulse rides over the current battle track. */
  private danger = false;
  private trackGain: GainNode | null = null;
  private curTrack: RichTrack | null = null;
  private curRoot = 0;
  private curStepDur = 0;
  private nextT = 0;
  private g16 = 0;

  /** Browsers require a user gesture before audio can start. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = MUSIC_LEVEL;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 1;
    this.sfxGain.connect(this.master);
    if (this.track) this.music(this.track);
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
    return this.muted;
  }

  private tone(note: Note, dest: AudioNode, when: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = note.type ?? 'square';
    osc.frequency.setValueAtTime(note.freq, when);
    if (note.f1 !== undefined && note.f1 !== note.freq) {
      if ((note.glide ?? 'exp') === 'exp')
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, note.f1), when + note.dur);
      else osc.frequency.linearRampToValueAtTime(note.f1, when + note.dur);
    }
    const peak = note.gain ?? 0.12;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peak, when + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, when + note.dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(when);
    osc.stop(when + note.dur + 0.02);
  }

  /**
   * A randomised bird call: 1–3 short, high, warbling syllables, each a quick
   * pitch sweep. No two are alike, so an area never sounds like a loop. Routed
   * through `musicGain` so it counts as ambience — it mutes and ducks with the
   * music, never with combat SFX.
   */
  private chirp(when: number) {
    if (!this.ctx || !this.musicGain) return;
    const syllables = 1 + Math.floor(Math.random() * 3);
    const base = 1800 + Math.random() * 1700; // ~1.8–3.5 kHz, songbird range
    let t = when;
    for (let i = 0; i < syllables; i++) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = Math.random() < 0.5 ? 'sine' : 'triangle';
      const dur = 0.05 + Math.random() * 0.08;
      const f0 = base * (0.85 + Math.random() * 0.3);
      const f1 = Math.max(400, f0 * (1 + (Math.random() - 0.35) * 0.7)); // sweep up (usually) or dip
      const peak = 0.07 + Math.random() * 0.06;
      osc.frequency.setValueAtTime(f0, t);
      osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g);
      g.connect(this.musicGain);
      osc.start(t);
      osc.stop(t + dur + 0.02);
      t += dur + 0.03 + Math.random() * 0.06; // small gap between syllables
    }
  }

  sfx(name: SfxName) {
    if (!this.ctx || !this.sfxGain) return;
    const t0 = this.ctx.currentTime;
    for (const n of SFX[name]) this.tone(n, this.sfxGain, t0 + n.time);
  }

  /** One gliding, optionally-vibrato'd oscillator layer of a monster cry. */
  private voiceLayer(l: CryLayer, dest: AudioNode, when: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = l.type ?? 'sawtooth';
    const f1 = l.f1 ?? l.f0;
    osc.frequency.setValueAtTime(l.f0, when);
    if (f1 !== l.f0) {
      if ((l.glide ?? 'exp') === 'exp') osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), when + l.dur);
      else osc.frequency.linearRampToValueAtTime(f1, when + l.dur);
    }
    // Vibrato: a sine LFO summed into the oscillator's frequency.
    if (l.vibrato) {
      const [rate, depth] = l.vibrato;
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(rate, when);
      lfoGain.gain.setValueAtTime(depth, when);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start(when);
      lfo.stop(when + l.dur + 0.02);
    }
    const peak = (l.gain ?? 0.12) * CRY_BOOST;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peak, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + l.dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(when);
    osc.stop(when + l.dur + 0.02);
  }

  /**
   * Play a monster's battle cry — its own voice, the way a Pokémon or Digimon
   * calls out when it appears or strikes. No-op for a species without a cry, so
   * callers can fire it unconditionally.
   */
  cry(speciesId: string) {
    if (!this.ctx || !this.sfxGain) return;
    const voice = CRIES[speciesId];
    if (!voice) return;
    const t0 = this.ctx.currentTime;
    for (const l of voice) this.voiceLayer(l, this.sfxGain, t0 + l.time);
  }

  /** Species ids that currently have an authored cry. */
  hasCry(speciesId: string): boolean {
    return speciesId in CRIES;
  }

  /**
   * The transcendence swell — the soul climbing to a new shape (`evolve`) or
   * settling back to the one it wore (`devolve`). Ethereal glassy sines rather
   * than the chip-square of the menu SFX, to match the rite's mood; scheduled
   * ahead of time so it rides the cinematic's flashes and blooms on the reveal.
   * Returns the swell's length in seconds so a caller can time the reveal to it.
   */
  transcend(mode: 'evolve' | 'devolve'): number {
    if (!this.ctx || !this.sfxGain) return 0;
    const t0 = this.ctx.currentTime;
    const root = 330; // E4 — the "held breath" before the reveal.
    // A pentatonic climb (evolve) or descent (devolve), doubled a fifth up.
    const climb = [0, 3, 5, 7, 10, 12];
    const seq = mode === 'evolve' ? climb : [...climb].reverse();
    const beat = 0.16;
    seq.forEach((semi, i) => {
      const freq = root * 2 ** (semi / 12);
      const when = t0 + i * beat;
      this.tone({ freq, time: 0, dur: 0.34, type: 'sine', gain: 0.09 }, this.sfxGain!, when);
      this.tone({ freq: freq * 1.5, time: 0, dur: 0.3, type: 'triangle', gain: 0.045 }, this.sfxGain!, when + 0.02);
    });
    // The bloom: a shimmering open chord at the climax (the reveal moment).
    const climax = t0 + seq.length * beat + 0.04;
    const chord = mode === 'evolve' ? [12, 16, 19, 24] : [0, 7, 12];
    for (const semi of chord) {
      this.tone({ freq: root * 2 ** (semi / 12), time: 0, dur: 0.7, type: 'sine', gain: 0.08 }, this.sfxGain, climax);
    }
    return seq.length * beat + 0.04;
  }

  /**
   * Briefly dip the music so a foreground moment — the opening roll-call of
   * monster cries — is heard clean, then bring it back. Like a Pokémon battle
   * that quiets under the cry. No-op before audio is unlocked.
   */
  duck(secs = 1.4, depth = 0.35) {
    if (!this.ctx || !this.musicGain) return;
    const g = this.musicGain.gain;
    const t = this.ctx.currentTime;
    const low = MUSIC_LEVEL * depth;
    g.cancelScheduledValues(t);
    g.setValueAtTime(MUSIC_LEVEL, t);
    g.linearRampToValueAtTime(low, t + 0.06);
    g.setValueAtTime(low, t + secs * 0.65);
    g.linearRampToValueAtTime(MUSIC_LEVEL, t + secs);
  }

  // ======================= MUSIC ==========================================

  /**
   * Start a track. `startDelay` (seconds) holds the first note back — used so an
   * encounter's battle music lands exactly on the `encounterSting()` impact.
   */
  music(track: MusicTrack, startDelay = 0) {
    this.track = track;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    // Fade out and release any track that was playing, so the switch
    // crossfades instead of cutting.
    if (this.trackGain && this.ctx) {
      const g = this.trackGain;
      g.gain.cancelScheduledValues(this.ctx.currentTime);
      g.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.06);
      window.setTimeout(() => {
        try {
          g.disconnect();
        } catch {
          /* already released */
        }
      }, 700);
      this.trackGain = null;
    }
    this.curTrack = null;
    this.danger = false; // any track change clears the low-HP pulse
    if (!track || !this.ctx || !this.musicGain) return;
    this.startRich(TRACKS[track], startDelay);
  }

  /**
   * Toggle the low-HP "danger" state — a Pokémon-style urgent pulse laid over the
   * battle track while a fielded ally is critically hurt. Cleared automatically
   * on the next `music()` change (i.e. when the fight ends).
   */
  setDanger(on: boolean) {
    this.danger = on;
  }

  /** One urgent alarm beep of the danger pulse. */
  private beep(when: number) {
    if (!this.ctx || !this.dangerGain) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(1245, when); // a fixed high alarm, above the music
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.06, when + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.11);
    o.connect(g);
    g.connect(this.dangerGain);
    o.start(when);
    o.stop(when + 0.13);
  }

  private startRich(def: RichTrack, startDelay = 0) {
    if (!this.ctx || !this.musicGain) return;
    this.ensureRich();
    this.curTrack = def;
    this.curRoot = def.root;
    this.curStepDur = 60 / def.bpm / 4; // 16th-note grid
    this.g16 = 0;
    const t0 = this.ctx.currentTime + Math.max(0.08, startDelay);
    const tg = this.ctx.createGain();
    tg.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    tg.gain.setValueAtTime(0.0001, t0);
    tg.gain.exponentialRampToValueAtTime(1, t0 + 0.25); // fade in at t0, no click
    tg.connect(this.richDry!);
    tg.connect(this.convolver!);
    this.trackGain = tg;
    this.nextT = t0;
    this.scheduler();
    this.timer = window.setInterval(() => this.scheduler(), 25);
  }

  /** A short-lived gain feeding the rich reverb bus — for one-off flourishes. */
  private richOneShot(): GainNode | null {
    this.ensureRich();
    if (!this.ctx || !this.richDry || !this.convolver) return null;
    const g = this.ctx.createGain();
    g.connect(this.richDry);
    g.connect(this.convolver);
    window.setTimeout(() => {
      try {
        g.disconnect();
      } catch {
        /* already released */
      }
    }, 4000);
    return g;
  }

  /**
   * The Pokémon-style "a battle is starting" cue: a rising run over a whoosh
   * that resolves onto a hard impact. Returns the seconds until that impact, so
   * the caller can start the battle music exactly on the downbeat
   * (`music(track, stingDur)`). Heavier and lower for a boss. No-op if audio is
   * still locked.
   */
  encounterSting(boss = false, final = false): number {
    if (!this.ctx) return 0;
    const bus = this.richOneShot();
    if (!bus) return 0;
    const when = this.ctx.currentTime + 0.05;
    const root = final ? 82.4 : boss ? 110 : 220;
    this.vNoise(bus, when, final ? 0.75 : 0.55, final ? 0.13 : 0.11);
    const run = final ? [0, 2, 3, 5, 7, 8, 10, 12] : boss ? [0, 2, 4, 6, 8, 10, 12] : [12, 15, 17, 19, 22, 24];
    const beat = final ? 0.09 : boss ? 0.08 : 0.07;
    run.forEach((s, i) => {
      this.vPluck(bus, root * 2 ** (s / 12), when + i * beat, 0.12, 0.11, true);
    });
    const hit = when + run.length * beat + 0.02;
    this.vKick(bus, hit, final ? 0.28 : 0.24);
    const chord = final ? [0, 3, 7, 10, 15] : boss ? [0, 3, 7, 10] : [0, 4, 7, 12];
    this.vPad(
      bus,
      chord.map((s) => root * 2 ** (s / 12)),
      hit,
      final ? 0.7 : 0.5,
      0.12,
    );
    this.vBell(bus, root * 2 ** ((boss || final ? 12 : 24) / 12), hit, 0.6, 0.09);
    return hit - this.ctx.currentTime;
  }

  /** A short triumphant flourish for a win, before field music resumes. */
  victoryFanfare(): number {
    if (!this.ctx) return 0;
    const bus = this.richOneShot();
    if (!bus) return 0;
    const when = this.ctx.currentTime + 0.04;
    const root = 349.2; // F4
    const seq: [number, number][] = [
      [7, 0],
      [7, 0.14],
      [7, 0.28],
      [12, 0.44],
      [11, 0.64],
      [12, 0.78],
    ];
    for (const [s, dt] of seq) this.vBell(bus, root * 2 ** (s / 12), when + dt, 0.34, 0.12);
    const end = when + 0.98;
    this.vPad(
      bus,
      [0, 4, 7, 12].map((s) => root * 2 ** (s / 12)),
      end,
      1.2,
      0.11,
    );
    return 1.9;
  }

  /** Lookahead scheduler: queue every 16th-note that falls inside the window. */
  private scheduler() {
    if (!this.ctx || !this.curTrack) return;
    const horizon = this.ctx.currentTime + 0.12;
    while (this.nextT < horizon) {
      if (!this.muted) {
        for (const v of this.curTrack.voices) {
          const note = v.seq[this.g16 % v.seq.length];
          if (note != null) this.fire(v, note, this.nextT);
        }
        // Birds: ~6% per 16th ≈ a call every few seconds.
        if (this.curTrack.birds && Math.random() < 0.06) this.chirp(this.nextT + Math.random() * this.curStepDur);
        // Low-HP danger pulse: a steady alarm on every quarter note.
        if (this.danger && this.g16 % 4 === 0) this.beep(this.nextT);
      }
      this.nextT += this.curStepDur;
      this.g16++;
    }
  }

  private freqOf(n: number): number {
    return this.curRoot * 2 ** (n / 12);
  }

  private fire(v: Voice, note: number | number[], when: number) {
    const tg = this.trackGain;
    if (!tg || !this.ins) return;
    const d = (v.dur ?? 1) * this.curStepDur;
    const acoustic =
      v.inst === 'strings' || v.inst === 'flute' || v.inst === 'cello' || v.inst === 'abass' || v.inst === 'harp';
    let w = when;
    let g = v.gain;
    if (acoustic) {
      w += (Math.random() - 0.5) * 0.012; // humanise timing
      g *= 0.9 + Math.random() * 0.1; //     and dynamics
    }
    const notes = Array.isArray(note) ? note : [note];
    switch (v.inst) {
      case 'pad':
        this.vPad(
          tg,
          notes.map((n) => this.freqOf(n)),
          w,
          d,
          v.gain,
        );
        break;
      case 'strings':
        for (const n of notes) this.voice(tg, this.freqOf(n), w, d, g, this.ins.strings);
        break;
      case 'flute':
        this.voice(tg, this.freqOf(notes[0]), w, d, g, this.ins.flute);
        break;
      case 'cello':
        this.voice(tg, this.freqOf(notes[0]), w, d, g, this.ins.cello);
        break;
      case 'abass':
        this.voice(tg, this.freqOf(notes[0]), w, d, g, this.ins.abass);
        break;
      case 'harp':
        for (const n of notes) this.playHarp(tg, this.freqOf(n), w, g);
        break;
      case 'pluck':
        this.vPluck(tg, this.freqOf(notes[0]), w, d, v.gain, v.bright ?? false);
        break;
      case 'bass':
        this.vBass(tg, this.freqOf(notes[0]), w, d, v.gain);
        break;
      case 'sub':
        this.vSub(tg, this.freqOf(notes[0]), w, d, v.gain);
        break;
      case 'bell':
        this.vBell(tg, this.freqOf(notes[0]), w, d, v.gain);
        break;
      case 'kick':
        this.vKick(tg, w, v.gain);
        break;
      case 'tom':
        this.vTom(tg, this.freqOf(notes[0]), w, v.gain);
        break;
      case 'hat':
        this.vHat(tg, w, v.gain, v.open ?? false);
        break;
      case 'noise':
        this.vNoise(tg, w, d, v.gain);
        break;
    }
  }

  // ---- baked sampler: build the timbres once, in code (no audio files) ----
  private periodic(amps: number[]): PeriodicWave {
    const ctx = this.ctx!;
    const n = amps.length;
    const real = new Float32Array(n + 1);
    const imag = new Float32Array(n + 1);
    for (let i = 1; i <= n; i++) imag[i] = amps[i - 1];
    return ctx.createPeriodicWave(real, imag);
  }

  private ensureRich() {
    if (this.richReady || !this.ctx || !this.musicGain) return;
    const ctx = this.ctx;

    const stringAmps: number[] = [];
    for (let n = 1; n <= 16; n++) stringAmps.push((1 / n) * Math.exp(-0.1 * n)); // warm ensemble
    const celloAmps: number[] = [];
    for (let n = 1; n <= 12; n++) celloAmps.push((1 / n ** 0.75) * Math.exp(-0.09 * n));
    this.waves.strings = this.periodic(stringAmps);
    this.waves.flute = this.periodic([1, 0.22, 0.09, 0.04, 0.02]); // near-pure + breath added live
    this.waves.cello = this.periodic(celloAmps);

    // white-noise buffer (hats, breath, wind)
    const nlen = Math.floor(ctx.sampleRate * 2);
    const nb = ctx.createBuffer(1, nlen, ctx.sampleRate);
    const nd = nb.getChannelData(0);
    for (let i = 0; i < nlen; i++) nd[i] = Math.random() * 2 - 1;
    this.noiseBuf = nb;

    // Karplus-Strong harp: a plucked string rendered straight into a buffer,
    // then pitch-shifted per note via playbackRate.
    const kBase = 220;
    const K = Math.round(ctx.sampleRate / kBase);
    const hlen = Math.floor(ctx.sampleRate * 1.7);
    const hb = ctx.createBuffer(1, hlen, ctx.sampleRate);
    const hd = hb.getChannelData(0);
    const ring = new Float32Array(K);
    for (let i = 0; i < K; i++) ring[i] = Math.random() * 2 - 1;
    let idx = 0;
    const damp = 0.9958;
    for (let i = 0; i < hlen; i++) {
      const cur = ring[idx];
      const nx = (idx + 1) % K;
      hd[i] = cur;
      ring[idx] = (cur + ring[nx]) * 0.5 * damp;
      idx = nx;
    }
    const fade = Math.floor(hlen * 0.06);
    for (let i = hlen - fade; i < hlen; i++) hd[i] *= (hlen - i) / fade;
    this.harpBuf = hb;

    // hall reverb impulse: exponentially-decaying stereo noise
    const ilen = Math.floor(ctx.sampleRate * 2.6);
    const ib = ctx.createBuffer(2, ilen, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ib.getChannelData(c);
      for (let i = 0; i < ilen; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / ilen) ** 3.2;
    }

    // bus: [trackGain] -> dry + (convolver -> wet) -> compressor -> musicGain
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 3;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    comp.connect(this.musicGain);
    const dry = ctx.createGain();
    dry.gain.value = 1.5; // make-up: rich music sits at a comfortable level vs SFX
    dry.connect(comp);
    const conv = ctx.createConvolver();
    conv.buffer = ib;
    const wet = ctx.createGain();
    wet.gain.value = 0.42;
    conv.connect(wet);
    wet.connect(comp);
    this.richDry = dry;
    this.convolver = conv;
    // Danger pulse: dry and present (no reverb), straight into the compressor so
    // the alarm cuts through the battle mix.
    const danger = ctx.createGain();
    danger.gain.value = 1;
    danger.connect(comp);
    this.dangerGain = danger;

    this.ins = {
      strings: {
        wave: this.waves.strings,
        voices: 3,
        detune: 9,
        atk: 0.16,
        rel: 0.5,
        cutoff: 2600,
        vib: [5, 7],
        pan: 0,
      },
      flute: {
        wave: this.waves.flute,
        voices: 1,
        atk: 0.06,
        rel: 0.18,
        cutoff: 3800,
        vib: [5.5, 12],
        breath: true,
        pan: 0.22,
      },
      cello: {
        wave: this.waves.cello,
        voices: 2,
        detune: 5,
        atk: 0.09,
        rel: 0.32,
        cutoff: 1800,
        vib: [4.5, 8],
        pan: -0.28,
      },
      abass: { wave: this.waves.cello, voices: 1, atk: 0.03, rel: 0.22, cutoff: 780, pan: 0 },
    };
    this.richReady = true;
  }

  private noiseSrc(): AudioBufferSourceNode {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    return s;
  }

  // ---- rich instruments ----
  private vPad(dest: AudioNode, freqs: number[], when: number, dur: number, gain: number) {
    const ctx = this.ctx!;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1700;
    f.Q.value = 0.6;
    const g = ctx.createGain();
    const atk = Math.min(0.6, dur * 0.4);
    const rel = 0.8;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(gain, when + atk);
    g.gain.setValueAtTime(gain, Math.max(when + atk + 0.001, when + dur - rel));
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur + rel);
    f.connect(g);
    g.connect(dest);
    for (const fr of freqs) {
      for (const det of [-6, 6]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = fr;
        o.detune.value = det;
        o.connect(f);
        o.start(when);
        o.stop(when + dur + rel + 0.1);
      }
    }
  }

  private voice(dest: AudioNode, fr: number, when: number, dur: number, gain: number, cfg: VoiceCfg) {
    const ctx = this.ctx!;
    const pan = ctx.createStereoPanner();
    pan.pan.value = cfg.pan ?? 0;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = cfg.cutoff ?? 3000;
    filt.Q.value = 0.5;
    const g = ctx.createGain();
    const atk = cfg.atk ?? 0.05;
    const rel = cfg.rel ?? 0.25;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain * 0.82, when + atk);
    g.gain.linearRampToValueAtTime(gain, when + Math.min(dur * 0.6, atk + 0.35)); // swell
    g.gain.setValueAtTime(gain, Math.max(when + atk + 0.002, when + dur - rel));
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur + rel);
    filt.connect(g);
    g.connect(pan);
    pan.connect(dest);
    let lfoGain: GainNode | null = null;
    if (cfg.vib) {
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = cfg.vib[0];
      lfoGain = ctx.createGain();
      lfoGain.gain.value = cfg.vib[1];
      lfo.connect(lfoGain);
      lfo.start(when + 0.12);
      lfo.stop(when + dur + rel + 0.1);
    }
    const n = cfg.voices ?? 1;
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator();
      o.setPeriodicWave(cfg.wave);
      o.frequency.value = fr;
      o.detune.value = n > 1 ? (i - (n - 1) / 2) * (cfg.detune ?? 8) : 0;
      if (lfoGain) lfoGain.connect(o.detune);
      o.connect(filt);
      o.start(when);
      o.stop(when + dur + rel + 0.1);
    }
    if (cfg.breath) {
      const sc = this.noiseSrc();
      const bf = ctx.createBiquadFilter();
      bf.type = 'bandpass';
      bf.frequency.value = fr * 2;
      bf.Q.value = 0.7;
      const bg = ctx.createGain();
      bg.gain.setValueAtTime(0.0001, when);
      bg.gain.exponentialRampToValueAtTime(gain * 0.16, when + atk);
      bg.gain.exponentialRampToValueAtTime(0.0001, when + dur + rel);
      sc.connect(bf);
      bf.connect(bg);
      bg.connect(pan);
      sc.start(when);
      sc.stop(when + dur + rel + 0.05);
    }
  }

  private playHarp(dest: AudioNode, fr: number, when: number, gain: number) {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource();
    s.buffer = this.harpBuf;
    s.playbackRate.value = fr / 220;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + 0.004);
    const p = ctx.createStereoPanner();
    p.pan.value = -0.15;
    s.connect(g);
    g.connect(p);
    p.connect(dest);
    s.start(when);
    s.stop(when + 1.9);
  }

  private vPluck(dest: AudioNode, fr: number, when: number, dur: number, gain: number, bright: boolean) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = bright ? 'sawtooth' : 'triangle';
    o.frequency.value = fr;
    const o2 = ctx.createOscillator();
    o2.type = 'triangle';
    o2.frequency.value = fr;
    o2.detune.value = 5;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = bright ? 6 : 1;
    f.frequency.setValueAtTime(bright ? 5200 : 2600, when);
    f.frequency.exponentialRampToValueAtTime(420, when + dur * 0.9 + 0.02);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur * 0.95 + 0.03);
    o.connect(f);
    o2.connect(f);
    f.connect(g);
    g.connect(dest);
    o.start(when);
    o2.start(when);
    o.stop(when + dur + 0.1);
    o2.stop(when + dur + 0.1);
  }

  private vBass(dest: AudioNode, fr: number, when: number, dur: number, gain: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = fr;
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = fr / 2;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 520;
    f.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + 0.01);
    g.gain.exponentialRampToValueAtTime(gain * 0.6, when + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur * 0.95 + 0.03);
    o.connect(f);
    sub.connect(g);
    f.connect(g);
    g.connect(dest);
    o.start(when);
    sub.start(when);
    o.stop(when + dur + 0.1);
    sub.stop(when + dur + 0.1);
  }

  private vSub(dest: AudioNode, fr: number, when: number, dur: number, gain: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = fr;
    const o2 = ctx.createOscillator();
    o2.type = 'triangle';
    o2.frequency.value = fr;
    o2.detune.value = 4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + 0.03);
    g.gain.setValueAtTime(gain, when + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur + 0.15);
    const g2 = ctx.createGain();
    g2.gain.value = 0.4;
    o.connect(g);
    o2.connect(g2);
    g2.connect(g);
    g.connect(dest);
    o.start(when);
    o2.start(when);
    o.stop(when + dur + 0.2);
    o2.stop(when + dur + 0.2);
  }

  private vBell(dest: AudioNode, fr: number, when: number, dur: number, gain: number) {
    const ctx = this.ctx!;
    const parts: [number, number][] = [
      [1, 1],
      [2.01, 0.5],
      [3.02, 0.28],
      [4.3, 0.14],
    ];
    for (const [mult, amp] of parts) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = fr * mult;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(gain * amp, when + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      o.connect(g);
      g.connect(dest);
      o.start(when);
      o.stop(when + dur + 0.05);
    }
  }

  private vKick(dest: AudioNode, when: number, gain: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(135, when);
    o.frequency.exponentialRampToValueAtTime(45, when + 0.11);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.2);
    o.connect(g);
    g.connect(dest);
    o.start(when);
    o.stop(when + 0.24);
  }

  private vTom(dest: AudioNode, fr: number, when: number, gain: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(fr * 1.5, when);
    o.frequency.exponentialRampToValueAtTime(fr, when + 0.09);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.22);
    o.connect(g);
    g.connect(dest);
    o.start(when);
    o.stop(when + 0.26);
  }

  private vHat(dest: AudioNode, when: number, gain: number, open: boolean) {
    const ctx = this.ctx!;
    const s = this.noiseSrc();
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7200;
    const g = ctx.createGain();
    const d = open ? 0.14 : 0.035;
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + d);
    s.connect(f);
    f.connect(g);
    g.connect(dest);
    s.start(when);
    s.stop(when + d + 0.02);
  }

  private vNoise(dest: AudioNode, when: number, dur: number, gain: number) {
    const ctx = this.ctx!;
    const s = this.noiseSrc();
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 0.8;
    f.frequency.setValueAtTime(300, when);
    f.frequency.linearRampToValueAtTime(1100, when + dur * 0.5);
    f.frequency.linearRampToValueAtTime(300, when + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(gain, when + dur * 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    s.connect(f);
    f.connect(g);
    g.connect(dest);
    s.start(when);
    s.stop(when + dur + 0.05);
  }
}

export const audio = new AudioEngine();
