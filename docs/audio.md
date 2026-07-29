# Audio: sound effects, music & ambience

Everything you hear is **synthesised in code** with the Web Audio API — a few
oscillators and a volume envelope per sound. Like the sprites, nothing is
sampled: the repo stays **asset-free** (plan §0.2), so there are no `.wav`/
`.mp3`/`.ogg` files and none should be added. All of it lives in one file,
[`src/engine/Audio.ts`](../src/engine/Audio.ts), exported as a singleton
`audio`.

If you ever want *real* audio, the seam is the two public methods `sfx()` and
`music()`: swap their bodies for a Howler-backed implementation and every call
site keeps working. That would abandon the asset-free rule, so only do it on the
owner's say-so.

## The shape of it

```
sfx(name)   ─┐
music(track)─┤→  tone(note) / chirp(when)  →  osc → gain → { sfxGain | musicGain } → master → speakers
             │                                                    (env)         (0.34 / 1.0)   (0.5, mute)
```

- **`tone(note, dest, when)`** is the one primitive. It makes an
  `OscillatorNode` + `GainNode`, sets a waveform (`square`/`triangle`/
  `sawtooth`/`sine`) and frequency, applies a fast attack + exponential decay,
  and schedules start/stop. Every musical note and SFX blip goes through it.
- **`sfx(name)`** plays a fixed list of `Note`s from the `SFX` table (one entry
  per effect: `blip`, `confirm`, `hit`, `victory`, …). Routed through
  `sfxGain`.
- **`music(track)`** starts a `setInterval` clocked to the track's BPM and, each
  step, schedules a bass note (on downbeats) and an arp note from the track's
  pattern. Routed through `musicGain` (quieter, `0.34`).
- **`cry(speciesId)`** plays a monster's own voice — a short stack of
  pitch-gliding, vibrato'd oscillator layers from the `CRIES` table (via
  `voiceLayer()`). It's part of `Audio.ts` but is its own subsystem with its own
  guide: [monster-cries.md](monster-cries.md). This doc covers music/SFX/
  ambience; go there for creature voices.
- **`unlock()`** lazily creates the `AudioContext` on first user gesture
  (browsers block audio until then) and, if a track was already requested,
  starts it. Call sites already do this on first input — you rarely touch it.
- **`toggleMute()`** zeroes the master gain.

### Why a sound is identical every time

The `SFX` and `TRACKS` tables are **static data**, and the music loop is
deterministic (`this.step++` walking fixed arrays). There is no randomness, so
the same name → the same waveform, forever. That is fine for menu blips and hit
sounds. It is *not* fine for long-running area ambience, which is why the bird
layer (below) is randomised on purpose.

## Add a new music track

Three edits, all in `Audio.ts`:

1. **Add the name to the union** `MusicTrack`.
2. **Add a pattern to `TRACKS`** — a root frequency, BPM, a `bass` array and an
   `arp` array. Bass/arp values are **semitone offsets from the root**; the loop
   turns them into frequencies with equal-temperament math
   (`root * 2^(semitones/12)`).
3. **Point an area at it** — set `music: '<name>'` on the reach's data file
   (`src/data/<name>.ts`). `DungeonScene` calls `audio.music(reach.music)` on
   enter, so nothing else is needed. (Battle/boss/hub tracks are triggered by
   their own scenes.)

Tips for a pattern that doesn't grate on loop:

- Keep `arp` to a scale/mode so it stays consonant — e.g. **minor pentatonic**
  `[0, 3, 5, 7, 10]` (+12 per octave) reads as "exotic/earthy"; a bright
  **major** arp reads as "airy/crystalline".
- Give `bass` movement (`[0, 0, 7, 5]`) so the harmony shifts across the bar.
- Make `arp` and `bass` different lengths (8 vs 4) so the combined pattern takes
  longer to obviously repeat.
- BPM sets the vibe more than anything: ~72–96 = calm, ~100–120 = driving,
  ~148–160 = combat.

## Add ambience (the bird pattern)

Static loops feel dead over a several-minute dungeon crawl. The fix is a
**randomised layer** on top of the loop, gated by a per-track flag so any track
can opt in without touching others. The jungle's birds are the reference
implementation:

- **`birds?: boolean` on the `TRACKS` value type** — an optional, additive flag.
  Prefer this pattern for future ambience (frogs, dripping water, wind): add a
  flag, not a special-cased track name.
- **`chirp(when)`** synthesises one bird call: 1–3 short, high syllables
  (~1.8–3.5 kHz), each a quick pitch *sweep* via
  `frequency.exponentialRampToValueAtTime`. **Everything is jittered** —
  syllable count, base pitch, sweep direction, waveform (`sine`/`triangle`),
  gain and inter-syllable gaps — so no two calls are alike. Routed through
  `musicGain`, so ambience mutes and ducks with the music, never with combat
  SFX.
- **The trigger** lives in the `music()` loop: once per step, `if (t.birds &&
  Math.random() < 0.12) this.chirp(now + random offset)`. ~12% per step ≈ a
  call every few seconds; the random offset keeps calls off the beat. Tune the
  probability up for a denser soundscape, down for a sparser one.

To give another track ambient birds: set `birds: true` on it — done. To add a
*different* ambient sound, add a new flag + a new `chirp`-style synth method + a
matching roll in the loop.

## What's been built

- **The Overgrowth (jungle)** — `music: 'jungle'` in
  [`src/data/jungleReach.ts`](../src/data/jungleReach.ts); track defined in
  `TRACKS`: a warm, laid-back **minor-pentatonic** groove
  (`root: 130.8, bpm: 92`) with **`birds: true`** ambience.

## Build & verify

Sound can't be asserted headlessly, but the wiring must typecheck and the melody
is judged by ear:

```bash
npm run build        # tsc --noEmit proves the MusicTrack union is exhaustive
npm run preview      # then walk into the area and listen
```

Follow the repo's git rule (see [CLAUDE.md](../CLAUDE.md)): build before every
push, commit straight to `main`.
