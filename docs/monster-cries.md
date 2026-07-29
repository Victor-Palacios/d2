# Monster battle cries (voices)

Every monster can have its own **cry** — a short procedural "voice" it sounds
in battle, the way a Pokémon or Digimon calls out when it appears and strikes.
Like everything else here, a cry is **asset-free**: a few oscillators and an
envelope, authored as data, never a sampled sound file (plan §0.2).

This doc is the end-to-end rule for giving a monster a voice: the data format,
where cries fire in battle, how to audition and test them, and a small design
cookbook so a new voice reads as *that* creature and not a beep.

## Where it lives

| Piece | File |
|---|---|
| The `CryLayer` format + the `CRIES` registry (one entry per species) | `src/engine/Audio.ts` |
| The synth (`voiceLayer`) and the public `cry()` / `hasCry()` | `src/engine/Audio.ts` |
| Battle hooks (opening roll-call + per-attack call) | `src/scenes/BattleScene.ts` |
| The smoke test | `tools/smoke/cries.mjs` |

A cry is keyed by **species id** (the `id` in `src/data/creatures.ts`). A
species with no `CRIES` entry simply stays silent — `cry()` is a no-op for it,
so callers fire it unconditionally and `hasCry()` gates anything that should
only happen for a monster that *has* a voice (e.g. the roll-call).

## The data format

```ts
interface CryLayer {
  f0: number;          // start frequency (Hz)
  f1?: number;         // glide-to frequency by end of the layer (default: steady)
  time: number;        // start offset within the cry (s)
  dur: number;         // layer duration (s)
  type?: OscillatorType;   // 'sine' | 'square' | 'sawtooth' | 'triangle'
  gain?: number;       // peak level — keep placeholder audio quiet (~0.05–0.18)
  vibrato?: [rate: number, depth: number];  // an LFO on frequency: [Hz, Hz]
  glide?: 'lin' | 'exp';   // pitch-ramp shape; 'exp' (default) is natural, 'lin' mechanical
}
```

A cry is just `CryLayer[]` — a small stack of layers scheduled together. Two
things separate a *voice* from the flat `Note` used by `sfx()`:

- **Pitch glide** (`f0`→`f1`): a layer can slide its pitch over `dur`. This is
  what makes a growl growl and a coo coo, instead of holding one tone.
- **Vibrato** (`[rate, depth]`): a sine LFO summed into the oscillator's
  frequency. A wide fast wobble reads as a growl/screech; a slow narrow one as
  a gentle warble. Vibrato is *character, not required* — some voices (e.g.
  Dropletta's pure bloops) use none.

Layer them: overlap a rough sawtooth with a quiet sub-square for weight; add a
faint high sine for shimmer; stagger `time` so syllables land in sequence.

## The battle hooks

Both live in `src/scenes/BattleScene.ts`:

1. **Opening roll-call** — `cryEnemies()` is called once the fight's banner is
   up. Each *distinct* enemy species that has a voice cries in turn, staggered
   ~220 ms so a mixed pack reads as several creatures rather than one blur.
2. **On attack** — in `animateTurn()`, the acting monster calls out as it
   lunges, layered under the impact sfx. It fires only on an **offensive** move
   (`result.hits.length && !heal && actionLabel !== 'Guard'`), so a Guard or a
   pure heal stays quiet.

Adding a voice needs **no** change to these hooks — they already call
`audio.cry(speciesId)` for whoever is acting/appearing. Authoring a `CRIES`
entry is the whole job.

## Add a voice (the rule)

1. **Pick the species id** from `src/data/creatures.ts` (e.g. `mitebug`).
2. **Add a `CRIES` entry** in `src/engine/Audio.ts` — a `CryLayer[]` matched to
   the creature (see the cookbook below). Keep total gain modest; the whole cry
   should sit *under* the impact sfx, not over it.
3. **Cover it in the smoke test**: add the id to `SPECIES` in
   `tools/smoke/cries.mjs`. Keep `NEGATIVE` pointed at some species that has
   **no** cry (the silent-case assertion).
4. **Build**: `npm run build` (`tsc --noEmit` + `vite build`) must pass.
5. **Verify** (below), then commit and push to `main` — the push deploys.

### The design cookbook

Match the timbre to the creature. The nine authored voices are worked examples
in `CRIES`; the recipes behind them:

| Creature kind | Recipe |
|---|---|
| **Aggressive / fiery** (Emberling) | low **sawtooth** + fast wide `vibrato` = a growl; rising `f0`→`f1`; a short high spit to finish |
| **Airy / serene flier** (Glidefang) | soft **triangle/sine**, a lift then a long descending glide, slow gentle `vibrato` |
| **Small insect** (Mitebug) | very **high**, very **short**, `square` with fast heavy `vibrato` = a clicky buzz; three quick ticks |
| **Plant / organic** (Sprigling) | mid **triangle** warble, up-then-down, slow `vibrato`; a faint sine on top |
| **Machine** (Scrapmite) | stepped `square` beeps (no glide) then a **`glide: 'lin'`** rising whir — linear reads mechanical |
| **Ghost / wisp** (Gloomote) | low **sine**, long, **descending**, slow ghostly `vibrato` = a hollow moan |
| **Water / slime** (Dropletta) | pure **sine** bloops that rise (`f0`→`f1` up), no vibrato = wet |
| **Boss** (Regalion) | **lower and longer** than any rookie — low sawtooth over a sub-square, swell then settle. Size = low fundamental + a sub layer + more `dur` |

Rules of thumb: **lower + longer = bigger**; **fast wide vibrato = rough**;
**linear glide = mechanical, exponential = organic**; keep `gain` in the
~0.05–0.18 band so nothing is loud.

## Audition & test

**By ear**, from the browser console (audio is exposed on the debug hook):

```js
hd2dGame.audio.cry('regalion');   // play any species' voice on demand
hd2dGame.audio.hasCry('bulwarq'); // false — no voice authored yet
```

(Audio needs a user gesture first — click the page once.) In an actual fight,
the enemies cry when the battle opens and each attacker calls out as it swings.

**Automated** — `tools/smoke/cries.mjs` drives the built game in a real
browser. Headless Chromium has no speakers, but the Web Audio graph still
*schedules*, so the test instruments `AudioContext` and asserts each authored
voice builds its oscillator layers and at least one pitch glide, and that a
species with no cry stays silent:

```bash
npm run build && npm run preview -- --port 5263    # serves the built game
npm i -D playwright                                 # ad hoc, not a project dep
URL=http://localhost:5263/ node tools/smoke/cries.mjs
```

It prints a `PASS`/`FAIL` line per species with the oscillator/glide/vibrato
counts and exits non-zero on any failure. See
[`tools/smoke/README.md`](../tools/smoke/README.md) for the shared setup.

## Current coverage

Voiced today (`CRIES` in `src/engine/Audio.ts`):

- **Starter trio** — Emberling, Glidefang, Nightnip.
- **The Quiet Crossing (first dungeon), complete** — the wild table (Mitebug,
  Sprigling, Scrapmite, Gloomote, Dropletta) and the warden boss **Regalion**.

Everything else — the Crystal Cavern, Overgrowth and Haunted Dungeon rosters,
and their wardens — is **not voiced yet** and stays silent. Adding those is
pure data: one `CRIES` entry each, following the cookbook above. A good next
pass is one reach's roster at a time, matched to its element (water = bloops,
dark = moans, machine = whirs, nature = warbles).
