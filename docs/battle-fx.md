# Monster battle FX

How a fight gets its visual punch, in **two independent layers**:

1. **Per-monster signature auras** — a quiet, continuous, element-tinted particle
   signature each creature *wears* for the whole fight (data: `src/data/battleFx.ts`).
2. **Per-move effects** — a distinct, shaped effect each *attack* produces when it
   is used: a melee slash, a flying bolt, an area nova, or a mending bloom
   (data: `src/data/moveFx.ts`).

Both are pure flair (no rules impact), procedural (no assets), and drawn on the
arena's existing shared `ParticleField`, so they cost no new draw call — just
additive points that also feed the bloom. Read this before touching either data
file or the FX code in `src/engine/fx.ts` / `src/scenes/BattleScene.ts`.

---

## Layer 1 — Per-monster signature auras

### The gap it fills

The battle had **generic** hit FX, but those key off the *technique* that
landed, not the *creature*. So every monster read the same while it stood in the
arena: same idle bob, nothing that said "this is an Emberling" vs. "this is a
Gloomote". A **battle aura** closes that: a continuous element-tinted particle
signature a monster wears for the whole fight, that swells briefly when it takes
its turn.

Wardens additionally carry a small coloured **glow light**. That is deliberately
the boss's privilege only: the HD-2D arena keeps a small light budget (see the
"HD-2D recipe" in [README.md](../README.md)), and a per-fighter point light for
all six on-screen fighters would blow it.

### Where it lives

| Piece | File |
|---|---|
| Aura data — one entry per species | `src/data/battleFx.ts` (`BATTLE_AURAS`) |
| Runtime controller (`Aura` class) | `src/engine/fx.ts` |
| Shared particle system it draws on | `ParticleField` in `src/engine/fx.ts` |
| Wiring (build / update / burst / dispose) | `src/scenes/BattleScene.ts` |
| Browser smoke test | `tools/smoke/auras.mjs` |

### The data model

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
  gravity?: number;       // vertical pull over time (positive rises, negative falls)
  life?: number;          // particle lifetime, seconds
  size?: number;          // particle size
  light?: { color; intensity; range? };  // wardens only — a glow riding the sprite
}
```

Everything about a monster's look is these numbers — the runtime is
species-agnostic. Swapping or retuning a look is an edit here and nothing else.

### The runtime, briefly

- **`Aura`** (`fx.ts`) holds the config, an emission accumulator and (for
  wardens) a `PointLight`. `update(dt, time, base, height, active)` trickles
  motes from `base + originY*height` (with a `originSpread` scatter) at `rate`
  per second, flickers the glow, and goes silent when `active` is false (the
  fighter has fainted). `burst(base, height)` fires a brief swell — the "this
  monster is acting" tell.
- The accumulator caps its catch-up after a long frame, so a stall (or the
  GPU-less container at ~1 fps) can't dump a burst of hundreds of particles.
- **`BattleScene`** builds one `Aura` per fielded fighter that has a config
  (`buildFighters`), adds the warden glow to the scene, trails each aura from its
  sprite's live position every frame (`update`), calls `burst()` from `pulse()`
  when a fighter takes the floor, and disposes on swap / battle exit.

### Adding an aura (to a new monster or a new reach)

1. **Pick the look from the creature, not from scratch.** Start from its
   `element` colour in `src/data/elements.ts`, then bias for personality:
   fire/embers rise, water droplets and dark motes fall, machine sputters short
   and sharp, nature drifts slow. Match `originY` to where it should emanate.
2. **Add one `BATTLE_AURAS` entry** keyed by the species id.
3. **Glow only for wardens.** Give `light` to bosses only, `intensity` ≈3.
4. **Keep it quiet.** `rate` in the 3–6 range for regular monsters (11-ish for a
   warden) reads as a signature, not a fog.
5. **Build and smoke-test** (below), then push to `main`.

No code changes are needed to cover a new species — only a data entry.

---

## Layer 2 — Per-move effects

### What this is

The generic hit FX only tinted a single fixed spark by the move's element — so a
melee bite, a ranged bolt and an arena-wide roar all looked like the same little
puff in a different colour. The **per-move** layer gives every technique a
*shaped* effect derived from its data:

- **`melee`** — a close, fast, wide fan of sparks at the target (bites, slams,
  claws). The caster lunges in as before.
- **`bolt`** — a ranged single-target projectile: a knot of motes streaks from
  the caster to the target, trailing sparks, then detonates. The caster stays
  home and fires.
- **`nova`** — a row / column / whole-side sweep: a wider, harder burst with more
  shake.
- **`mend`** — a heal: soft motes rising off the mended ally.

On top of the delivery shape, the **element** sets the colour and motion feel
(fire leaps and lingers, water splashes and falls, machine throws snappy short
sparks, dark hangs as slow smoke), and the move's **power** scales the burst size
and shake, so a level-1 jab and a boss finisher of the same element read
differently. A short wind-up puff (the *cast telegraph*) gathers on the caster
the instant before every move lands.

### Where it lives

| Piece | File |
|---|---|
| Move-FX derivation + overrides | `src/data/moveFx.ts` (`moveFx`, `MOVE_FX_OVERRIDES`) |
| Wiring (telegraph / bolt flight / shaped impact) | `src/scenes/BattleScene.ts` (`animateTurn`, `castTelegraph`, `flyBolt`) |
| Shared particle system it draws on | `ParticleField` in `src/engine/fx.ts` |
| Browser smoke test | `tools/smoke/moveFx.mjs` |

### The data model

Unlike auras, **nothing here is authored per-technique by hand.** `moveFx(t)`
reads the fields a technique already carries and composes a `MoveFx` profile:

- **delivery** ← `t.kind === 'heal'` → `mend`; else `t.melee` → `melee`; else a
  non-`single` `shape` → `nova`; else → `bolt`.
- **colour + motion** ← `ELEMENT_LOOK[t.element]`.
- **burst size + shake** ← `t.power` (a ~power-46 technique sits at 1.0).

So adding a brand-new technique needs **no FX edit at all** — it inherits a look
from its element, delivery and power automatically. A small
`MOVE_FX_OVERRIDES` table exists only for marquee moves (a boss's Sun Claw, the
arena-wide Regal Roar) that deserve a bigger `punch` than their archetype would
give them — the same optional-override shape as the auras.

### The runtime, briefly

`animateTurn` (in `BattleScene`) calls `moveFx(technique)` once per action, then:

1. **`castTelegraph`** emits the wind-up puff on the caster.
2. **Delivery motion:** `melee` lunges the caster in (trailing a streak of its
   element so the charge itself reads) and back out after; `bolt` calls
   **`flyBolt`**, tweening a chunky trailing projectile caster → target;
   `nova` / `mend` gather in place.
3. **Impact:** the per-hit loop emits the shaped burst (`fx.impact`, `fx.color`,
   `fx.gravity`, …) **and fires `impactFlash`** — a bright additive flash sprite
   that pops from small to full and fades in ~0.3s, tinted by element (near-white
   and larger on a crit/reaction). The flash is the beat that reads instantly
   against the busy painterly arena; the particles are its texture. Reactions and
   crits scale both up, alongside the damage float, sfx and camera shake.

The whole layer is tuned **loud on purpose** — chunky particle sizes, ~30–50
motes per hit, a full-strength basic Attack (its low power is overridden back up
so the move players use most still reads), and a real screen-flash — because the
painterly background washes out anything subtle. `impactFlash` reuses a single
cached white radial texture (`radialTexture('flash', …)`), tinted per-flash via
the sprite's material, so it adds no asset.

### Extending it

Because the profile is derived, the usual answer is **"do nothing"** — new
moves are covered automatically. Reach for the data files only to:

- **Retune an element's feel** → edit `ELEMENT_LOOK` in `moveFx.ts` (affects
  every move of that element at once).
- **Give a signature move a special look** → add a `MOVE_FX_OVERRIDES` entry
  (bump `punch`, force a `delivery`, or recolour it).
- **Add a new delivery archetype** (e.g. a beam) → add it to `MoveDelivery` +
  `DELIVERY`, teach `deliveryOf()` when to pick it, and handle it in
  `animateTurn`.

---

## Verifying

```bash
npm run build            # tsc --noEmit + vite build — must pass (gates the Pages deploy)
npm run preview -- --port 4188
npm i -D playwright      # ad hoc, not a project dependency
CHROME=/opt/pw-browsers/chromium URL=http://localhost:4188/ node tools/smoke/auras.mjs
CHROME=/opt/pw-browsers/chromium URL=http://localhost:4188/ node tools/smoke/moveFx.mjs
```

- **`auras.mjs`** enters a first-dungeon boss fight and asserts every fielded
  species gets an aura, only the warden carries a glow, and the auras actively
  emit.
- **`moveFx.mjs`** drives one move of every delivery archetype (melee / bolt /
  nova / mend) through the real turn animation and asserts each fires its FX,
  with the bolt (trail + burst) out-sparking the plain heal — i.e. the shaping
  really differs per move.

Both **pump `scene.update()` / drive the real loop** rather than trusting
wall-clock time, because this container has no GPU and renders at ~1 fps —
continuous emission is otherwise frame-starved. Each prints `VERDICT: PASS/FAIL`.

## Current coverage & next steps

- **Per-move effects** apply to **every technique in the game already** — they're
  derived from technique data, so the Reliquary / Unremembered / Overgrowth moves
  and every boss move are covered the moment they exist. Tuning (element feel,
  signature overrides) is optional polish.
- **Per-monster auras** are wired for **The Quiet Crossing roster only** — the
  three starters (Emberling, Glidefang, Nightnip), the five echoes (Mitebug,
  Scrapmite, Sprigling, Gloomote, Dropletta) and the warden Regalion. Still to do:
  the Reliquary, Unremembered and Overgrowth rosters, plus the wardens Glaciark,
  Revenance, Verdanox and the Last Light — each just more `BATTLE_AURAS` entries.
