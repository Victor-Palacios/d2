# Monster battle FX (signature auras)

How each monster gets a distinct visual presence in a fight, and how to extend
it. Read this before touching `src/data/battleFx.ts` or the aura code in
`src/engine/fx.ts`.

## What this is, and the gap it fills

The battle already had **generic** hit FX — element-tinted sparks, a white
hit-flash, screen shake and floating damage — but those key off the *technique*
that landed, not the *creature*. So every monster read the same while it stood
in the arena: same idle bob, same faint self-illumination, nothing that said
"this is an Emberling" vs. "this is a Gloomote".

A **battle aura** closes that: a quiet, continuous, element-tinted particle
signature a monster wears for the whole fight, that swells briefly when it takes
its turn. It is pure flair (no rules impact), procedural (no assets), and drawn
on the arena's existing shared `ParticleField`, so it costs no new draw call —
just a steady handful of additive points that also feed the bloom.

Wardens additionally carry a small coloured **glow light**. That is deliberately
the boss's privilege only: the HD-2D arena keeps a small light budget (see the
"HD-2D recipe" in [README.md](../README.md)), and a per-fighter point light for
all six on-screen fighters would blow it.

## Where it lives

| Piece | File |
|---|---|
| Aura data — one entry per species | `src/data/battleFx.ts` (`BATTLE_AURAS`) |
| Runtime controller (`Aura` class) | `src/engine/fx.ts` |
| Shared particle system it draws on | `ParticleField` in `src/engine/fx.ts` |
| Wiring (build / update / burst / dispose) | `src/scenes/BattleScene.ts` |
| Browser smoke test | `tools/smoke/auras.mjs` |

## The data model

`BattleAura` (in `battleFx.ts`) is the whole authoring surface. One entry per
species id; a species with **no** entry simply has no aura, which is a valid,
common state.

```ts
interface BattleAura {
  color: number;          // additive tint (feeds bloom)
  rate: number;           // particles per second — how dense the signature is
  originY: number;        // spawn height as a fraction of sprite height (0 feet … 1 crown)
  originSpread?: number;  // radius of the spawn scatter, world units
  speed?: number;         // launch speed
  spread?: number;        // sideways spread of the launch velocity
  upBias?: number;        // upward launch bias (negative sinks)
  gravity?: number;       // downward pull (negative rises — embers curl up, droplets fall)
  life?: number;          // particle lifetime, seconds
  size?: number;          // particle size
  light?: { color; intensity; range? };  // wardens only — a glow riding the sprite
}
```

Everything about a monster's look is these numbers — the runtime is
species-agnostic. Swapping or retuning a look is an edit here and nothing else.

## The runtime, briefly

- **`Aura`** (`fx.ts`) holds the config, an emission accumulator and (for
  wardens) a `PointLight`. `update(dt, time, base, height, active)` trickles
  motes from `base + originY*height` (with a `originSpread` scatter) at `rate`
  per second, flickers the glow, and goes silent when `active` is false (the
  fighter has fainted). `burst(base, height)` fires a brief swell of the same
  motes — the "this monster is acting" tell.
- The accumulator caps its catch-up after a long frame, so a stall (or the
  GPU-less container at ~1 fps) can't dump a burst of hundreds of particles.
- **`BattleScene`** builds one `Aura` per fielded fighter that has a config
  (`buildFighters`), adds the warden glow to the scene, trails each aura from
  its sprite's live position every frame (`update`), calls `burst()` from
  `pulse()` when a fighter takes the floor, and disposes on swap / battle exit.

## Adding an aura (to a new monster or a new reach)

This is the systematic path — do it per reach as each roster is authored.

1. **Pick the look from the creature, not from scratch.** Start from its
   `element` colour in `src/data/elements.ts`, then bias for personality:
   fire/embers rise (`upBias` high, small negative-to-small `gravity`); water
   droplets and dark motes fall (`gravity` positive); machine sputters short and
   sharp (short `life`, strong negative `gravity` so sparks arc down); nature
   drifts slow (`speed` low, long `life`). Match `originY` to where it should
   emanate (crown for hovering wisps, mid-body for grounded beasts).
2. **Add one `BATTLE_AURAS` entry** keyed by the species id.
3. **Glow only for wardens.** Give `light` to bosses only, and keep
   `intensity` modest (≈3) so it feeds bloom without bleaching the sprite it
   rides. Regular echoes stay particle-only to hold the light budget.
4. **Keep it quiet.** `rate` in the 3–6 range for regular monsters (11-ish for a
   warden) reads as a signature, not a fog. Additive colours stack fast on a
   busy field.
5. **Build and smoke-test** (below), then push to `main`.

No code changes are needed to cover a new species — only a data entry. The
`Aura` class and the `BattleScene` wiring already apply to any fighter whose
species has a config.

## Verifying

```bash
npm run build            # tsc --noEmit + vite build — must pass (gates the Pages deploy)
npm run preview -- --port 4188
npm i -D playwright      # ad hoc, not a project dependency
CHROME=/opt/pw-browsers/chromium URL=http://localhost:4188/ node tools/smoke/auras.mjs
```

`auras.mjs` enters a first-dungeon boss fight and asserts every fielded species
gets an aura, only the warden carries a glow light, and the auras actively emit.
It **pumps `scene.update()` at a fixed dt** rather than trusting wall-clock time,
because this container has no GPU and renders at ~1 fps — continuous emission is
otherwise frame-starved and the count looks empty. Prints `VERDICT: PASS/FAIL`.

## Current coverage & next steps

- **Wired up:** The Quiet Crossing roster only — the three starters (Emberling,
  Glidefang, Nightnip), the five echoes (Mitebug, Scrapmite, Sprigling,
  Gloomote, Dropletta) and the warden Regalion.
- **Not yet:** The Reliquary, The Unremembered and The Overgrowth rosters, plus
  the other wardens (Glaciark, Revenance, Verdanox) and the Last Light. Each is
  just more `BATTLE_AURAS` entries — see "Adding an aura" above. The natural next
  step is one reach's roster at a time, mirroring how the reaches were authored.
- **Possible extensions** (design, not wired): a distinct *impact* burst per
  element on the target (today's hit sparks are technique-tinted, which already
  covers most of this); a brief entrance flourish as fighters deploy.
