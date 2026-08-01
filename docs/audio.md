# Audio: sound effects, music & ambience

Everything you hear is **synthesised in code** with the Web Audio API. Nothing is
sampled from a file: the repo stays **asset-free** (plan §0.2), so there are no
`.wav`/`.mp3`/`.ogg` files and none should be added. All of it lives in one file,
[`src/engine/Audio.ts`](../src/engine/Audio.ts), exported as the singleton
`audio` (also on `window.hd2dGame.audio` for the console + smoke tests).

There are three subsystems in that file:

- **SFX** — short oscillator stacks (`sfx(name)` over the `SFX` table).
- **Monster cries** — each creature's voice (`cry(id)`); its own guide is
  [monster-cries.md](monster-cries.md).
- **Music** — a small **baked sampler** driving multi-voice arrangements. This
  doc is mostly about that.

## SFX & the `tone()` primitive

`tone(note, dest, when)` makes an `OscillatorNode` + `GainNode`, sets a waveform
and frequency, applies a fast attack + exponential decay, and schedules
start/stop. `sfx(name)` plays a fixed list of `Note`s from the `SFX` table
(`blip`, `confirm`, `hit`, `victory`, …) through `sfxGain`. These are static and
deterministic — the same name is the same sound every time, which is what you
want for UI blips and hit stings.

## Music: rich tracks

`music(track, startDelay?)` reads `TRACKS[track]` — every entry is a
**`RichTrack`** (the baked-sampler engine). It fades out the previous track's
`trackGain` (a short crossfade, not a cut) and starts the new one; `startDelay`
(seconds) holds the first note back so battle music can land on an encounter
sting's impact (see *Combat transitions* below).

### The baked sampler

"Baked" = instrument timbres are precomputed **in code** at first use
(`ensureRich()`), never loaded from disk:

- **Wavetables** — `strings`, `flute` and `cello` are `PeriodicWave`s built from
  harmonic-amplitude formulas. Played live by `voice()` with ensemble detune,
  a vibrato LFO, an amplitude swell, optional breath noise and a stereo pan.
- **Harp** — a **Karplus-Strong** plucked string rendered straight into an
  `AudioBuffer` once, then pitch-shifted per note via `playbackRate`
  (`playHarp()`). Genuinely string-like, unlike an oscillator "pluck".
- **Percussion / synth voices** — `pad`, `pluck`, `bass`, `sub`, `bell`, `kick`,
  `tom`, `hat`, `noise` are built from oscillators/noise + envelopes.
- **Bus** — every voice runs `trackGain → dry + (convolver → wet) → compressor →
  musicGain → master`. The convolver is a code-generated hall impulse; the
  compressor tames dense tracks; `dry.gain` is the make-up level.

### A rich track's data

A `RichTrack` is `{ rich, bpm, root, birds?, voices[] }`. Each `Voice` is an
instrument plus a **step sequence** on a **16th-note grid**. A `seq` entry is:

- a **number** — a semitone offset from `root` (→ `root * 2^(n/12)`),
- a **number[]** — a chord (for `pad` / `strings`),
- **`1`** — a hit, for pitchless percussion (`kick` / `hat` / `noise`),
- **`null`** — a rest.

Each voice loops **by its own length**, so a 16-step drum runs under a 128-step
melody. `dur` is the note length in steps. The lookahead `scheduler()` queues
every step that falls inside a short window; acoustic instruments get their
timing and dynamics slightly **humanised** so it doesn't sound quantised.

Helpers make patterns readable: `pmap(len, {step: note})` for sparse melodies,
`phits(len, [steps])` for percussion, `prep(bar, n)` to repeat a bar, `harpBar()`
for an arpeggio. Bigger arrangements (the hub, crystal, jungle) are built by a
small function returning `Voice[]`.

## Add a new rich track

1. **Name it** in the `MusicTrack` union.
2. **Add a `RichTrack` to `TRACKS`** — pick `bpm`, `root`, and author `voices`
   (reuse the instruments above; mind that voice `gain`s are small and sum). For
   anything past a few notes, write a `…Voices()` builder like `everwakeVoices()`.
3. **Point an area at it** — set `music: '<name>'` on the reach's data file
   (`src/data/<name>.ts`). `DungeonScene` calls `audio.music(reach.music)` on
   enter; the hub/battle/boss keys are triggered by their own scenes. No scene
   code changes needed — only the `TRACKS` definition.

Composition tips: give the arrangement a real **melody + counter-line + harmony
+ bass** rather than one part; keep parts in a scale/mode; make voice lengths
differ so the loop takes longer to repeat; BPM sets the mood (~60–80 calm,
~96–112 driving, ~148+ combat).

## Ambience (birds)

Long loops feel dead, so a track can layer a **randomised** ambience via the
`birds?: boolean` flag. `chirp()` synthesises one bird call — 1–3 high syllables
(~1.8–3.5 kHz) with jittered count, pitch, sweep, waveform, gain and gaps, so no
two are alike. The rich `scheduler()` (and the legacy loop) roll for a chirp each
step at a low probability and fire it at a random off-beat offset. Set
`birds: true` on a track to enable it; add a new flag + `chirp`-style method for
a different ambience (frogs, wind, drips).

## What's wired

| Area | Track key | Style |
|---|---|---|
| Intro town (The Everwake) | `hub` | orchestral ensemble — flute melody, cello counter, harp, strings |
| The Quiet Crossing | `dungeon` | "Underhush" — dark ambient, near-beatless |
| Crystal Cavern | `crystal` | bright, shimmering bells + high harp |
| Haunted Dungeon | `haunted` | "Bone Rhythm" — ritual percussion + Phrygian bass |
| The Overgrowth | `jungle` | warm marimba/flute groove, `birds: true` |
| Normal battle | `battle` | "Onset" — heroic drive, running bass, bright lead |
| Boss battle | `boss` | "The Warden" — crushing, Phrygian, double-kick + dissonant bell |
| Final boss | `finalboss` | "Everwake's End" — fast, cinematic, soaring lead over a churning ostinato |

## Combat transitions

Entering and leaving a fight is bridged the way a Pokémon battle opens, so the
music never hard-cuts:

- **`encounterSting(boss)`** plays a rising sting over a whoosh that resolves on
  a hard impact, and **returns the seconds until that impact**. `BattleScene`
  calls it on enter, then `music(isBoss ? 'boss' : 'battle', stingDur)` so the
  battle theme's first downbeat lands exactly on the impact while the field
  music crossfades out under the sting.
- **`victoryFanfare()`** rings a short flourish on a win (`onVictory` fades the
  battle theme first); field music resumes when the scene returns to the reach.
- The **Last Light** grief encounter is exempt — it keeps the dungeon ambience,
  with no combat sting or theme.

The **final boss** (the last reach's boss, flagged `finalBoss: true` on its
event) gets the `finalboss` theme and a lower, longer sting
(`encounterSting(boss, final)`), routed from `DungeonScene` →
`BattleScene.params.finalBoss`.

### Low-HP danger pulse

`setDanger(on)` lays a fixed high alarm beep over the battle track on every
quarter note — the Pokémon low-HP cue. `BattleScene` calls it after each turn
(on while any fielded ally is ≤25% HP), and any `music()` change clears it, so
it always stops when the fight ends. The beep runs through its own dry gain
straight into the compressor, so it cuts through the mix without reverb.

## Build & verify

Sound can't be asserted headlessly, but the wiring must typecheck **and** the
engine must not throw at runtime. `tsc` covers the first; a quick playwright
smoke covers the second by driving every track through the real build:

```bash
npm run build                       # tsc --noEmit + vite build
npm run preview -- --port 4199      # then, in a headless page:
#   window.hd2dGame.audio.music('hub'|'dungeon'|'crystal'|'haunted'|'jungle'|'battle'|'boss')
# and assert no pageerror/console errors while the scheduler runs.
```

`audio` is exposed on `window.hd2dGame`, so a smoke can start each track
directly without navigating scenes. The actual *sound* is judged by ear in
`npm run preview`.

Follow the repo's git rule (see [CLAUDE.md](../CLAUDE.md)): build before every
push, commit straight to `main`.
