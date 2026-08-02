# Creature progression — magick, learnsets, and transcendence

A build guide for the three linked systems that govern how a monster fights and
grows: the **magick stat channel**, **level 1–20 learnsets**, and **evolution
(transcendence)** with **de-evolution**. This doc is the "how to extend it"
companion; the runtime maths and worked examples live in
[`docs/SYSTEMS.md`](SYSTEMS.md) §2, §3 and §7 (code is the source of truth).

> Design provenance: the evolution model is a deliberate **Pokémon × Digimon
> hybrid** — level-triggered and identity-preserving like Pokémon, branching,
> **class-pure**, and reversible like Digimon Cyber Sleuth (the player chooses
> when to evolve or de-evolve), without Digimon's "any starter reaches any top
> form" criticism. See the header comment in `systems/party/evolve.ts`.

> **Evolution schedule.** Gates climb by stage: **base → 2nd form at Lv 3,
> 3rd form at Lv 7, 4th form at Lv 10**. Deeper lines evolve a touch later — a
> branch that leads into a full 4-stage line opens its first gate at **Lv 4**
> instead of 3, and the early-bloomer Scrapmite line takes its first gate a rung
> early at **Lv 2**. The gate is just the `level` field on each `EvolutionOption`.

---

## Where everything lives

| Concern | File |
|---|---|
| Stat shape (`hp mp off def spd mag res`) | `src/data/creatures.ts` — `interface Stats` |
| Per-creature data: base/growth, learnset, evolutions | `src/data/creatures.ts` — `SPECIES` |
| Role growth curves | `src/data/creatures.ts` — `HERO_/MAGE_/ASSASSIN_GROWTH` |
| Move data + physical/magical `category` | `src/data/techniques.ts` |
| Damage channel + heal blend | `src/systems/battle/formula.ts` |
| Instance stats, level-up, move-learning, **known pool + loadout** | `src/systems/party/creature.ts` (`syncMoves`, `activeMoves`, `MAX_ACTIVE_MOVES`) |
| Evolve / de-evolve + **class-purity** (headless) | `src/systems/party/evolve.ts` (`isSameClass`) |
| Evolution UI | `src/ui/TranscendScreen.ts` (R1 → menu → Transcend) |
| Evolution fanfare (cinematic) | `src/ui/TranscendCinematic.ts` + `audio.transcend()` |
| **Move-loadout UI** (toggle the ≤5 active) | `src/ui/MovesScreen.ts` (R1 → menu → Moves) |
| Save migration for new stats/loadout | `src/systems/party/saveGame.ts` |
| Tests | `src/systems/party/evolve.test.ts` (class purity, level schedule, loadout) · `tools/smoke/transcend.mjs` · `tools/smoke/transcend-fx.mjs` |

---

## 1. The magick channel (two attack/defence pairs)

Every creature has four combat stats in two pairs:

- **Offense / Defense** — physical channel.
- **Magick / Resolve** — magical channel.

A `Technique` carries a `category: 'physical' | 'magical'` (defaults to physical;
heals are always magical). `computeDamage` reads `off` vs `def` for physical and
`mag` vs `res` for magical (`techCategory()` resolves it). This is what makes a
Mage a real caster — low `off`, high `mag` — instead of the old model where the
caster class was the weakest attacker.

**Heals** blend both defensive-ish stats: `res × 0.7 + mag × 0.3`, scaled by
`0.4` onto the flat power (`HEAL_RES_WEIGHT` / `HEAL_MAG_WEIGHT` /
`HEAL_STAT_SCALE` in `formula.ts`). So a durable support is the best medic and a
caster still contributes; a glass cannon is poor at it.

**To add mag/res to a creature:** every `base` and `growth` literal in
`creatures.ts` includes `mag` and `res` (TypeScript enforces it via `Stats`).
Pick values by role — Mages: high `mag`, low `off`; Heroes: high `res`+`def`;
Assassins: low both (glassy). The role growth curves already bias this.

---

## 2. Learnsets (levels 1–20)

Each species has `learnset: { level, tech }[]`, authored in learn order.

- A creature made at level L knows every entry with `level ≤ L`
  (`movesKnownAt`), computed in `makeCreature`.
- On level-up, `grantXp` calls `syncMoves`, which folds newly-crossed entries
  into the creature's **known pool** (`techniques`).
- The known pool is **monotonic** — it only ever grows. Evolving folds in the
  new form's moves; de-evolving keeps everything (a soul never forgets).
- The free **Strike** is always available and is **not** in any learnset.

Convention: role/element-shaped, early filler moves, a single-target capstone
(power 58–62) around L11–16, and a big-MP area finisher (16–22 MP) near the top
so a deep MP pool pays off. Keep `techniques.ts` `category`/`melee`/`shape`
correct on any move you add (see §4).

**To add/adjust a move:** edit the species' `learnset`. To add a brand-new
technique, add it to `TECHNIQUES` in `techniques.ts` first (id, `kind`, `power`,
`mpCost`, `element`, and — for damage — `category`; set `melee: true` only for
close-in physical blows, and `shape` for row/column/all).

---

## 3. Transcendence (evolution + de-evolution)

### Data model

```ts
// on Species:
evolutions?: { to: string; level: number; branch?: string }[]
```

- **Level-triggered:** a branch is eligible once `creature.level >= level`.
  The schedule is 3 / 7 / 10 by stage (deepest lines a rung later — see the
  banner above); many forms are terminal (no `evolutions`).
- **Branching (Digimon-style, cross-line):** a species may list more than one
  option, and an option can point at a form in a *different line* — so a soul
  can cross families the way a Digimon does, not just walk one fixed chain.
  Every catchable base offers two paths: its own line, plus one alternate that
  either revives an off-line form or crosses into another line of the same
  class. Because branches converge, a form can be reachable from several bases
  (e.g. `duskfang` from `nightnip`, `prismoth` and `ashmoth`).
- **Class-pure:** every branch must stay in the source's `attribute` — a Mage
  only ever becomes another Mage, a Hero a Hero, an Assassin an Assassin. This
  is exactly what makes cross-*line* branching coherent: the destination may be
  a different family, but it is always the same class. `evolutionOptions`
  filters cross-class branches out (via `isSameClass`) so a stray data entry can
  never be *offered*, and `evolve.test.ts` fails the build if one is *authored*.
- **De-evolution** follows the soul's own **ancestry stack**
  (`CreatureInstance.evolvedFrom`): each evolve pushes the form left behind,
  each de-evolve pops it. So a form shared by several bases returns to the base
  *this* soul came from, at any depth — not a guess. The static reverse map
  (`DEVOLVE_MAP`) is only the fallback for a soul caught already-evolved or from
  a pre-ancestry save.

### API (`systems/party/evolve.ts`, headless & tested)

- `evolutionOptions(c)` / `canEvolve(c)` — eligible branches now.
- `evolve(c, toId?)` — take a branch (refuses if ambiguous without `toId`).
- `devolveTargetId(c)` / `canDevolve(c)` / `devolve(c)` — step back one form.

The transform keeps level/XP/equipment and the current HP/MP **fraction**,
recomputes stats from the new species, and folds the new form's moves into the
known pool (never removing any) — so evolve → devolve → evolve is lossless and
only ever grows the pool. Evolution is **out-of-battle and explicit** (never
fired from `grantXp`), which is why it stays reversible and never surprises the
player.

### To add an evolution line

1. Author the evolved-form species in `SPECIES` (full `base`/`growth`/`learnset`,
   an `art` key — reuse an existing sprite for now, see below).
2. Add an `evolutions` entry on the base form pointing at it. For a **cross-line**
   branch, just point at an existing same-class form — no new species needed, and
   sharing a target across bases is fine (the ancestry stack keeps de-evolution
   exact). Keep it same-class or the guard/test will reject it.
3. That's it — de-evolution, the Transcend UI, the fanfare and the ancestry stack
   pick it up automatically. Confirm with `tools/smoke/transcend.mjs` (it sweeps
   every species and resolves every branch both directions) and
   `evolve.test.ts` (class purity + cross-line de-evolution).

### The fanfare (cinematic)

`TranscendScreen` doesn't just apply the change and toast it — after `evolve()`/
`devolve()` it awaits `playTranscend(...)` (`src/ui/TranscendCinematic.ts`), a
Pokémon Red/Blue-style evolution sequence re-scored for this game's soul-rite
mood: the sprite strobes between its old and new **white silhouettes** faster and
faster, blooms to white, and resolves into the new form in colour, tinted by the
new form's **element** and voiced by `audio.transcend()` (an ethereal swell) plus
the new form's `cry`. De-evolution runs the same beats in reverse.

It is **purely cosmetic** — the creature's data is already transformed before it
plays, so it can never leave a half-applied change — and it is **skippable with
Start** (keyboard mirror **E**; the on-screen note says so), which jumps to the
reveal and then dismisses. No new per-species data is needed: it derives
everything from `speciesArt`, the element colour and the `EvolveResult`. Timings
(gather / strobe / bloom / settle) are the constants at the top of the module;
`audio.transcend(mode)` in `engine/Audio.ts` is the sound. Covered headlessly by
`tools/smoke/transcend-fx.mjs`.

---

## 3½. Battle loadout — the ≤5 active moves

A creature *knows* every move in its pool (`techniques`) but may *field* only
`MAX_ACTIVE_MOVES` (**5**) at once. The active subset is `creature.loadout` — an
ordered list, a subset of `techniques`, that drives the in-battle **Technique**
menu (`ui/BattleHUD.ts`) and the enemy AI (`systems/battle/engine.ts`). Both
read moves through `activeMoves(c)`, so the cap is honoured everywhere; **Basic
Attack is always available and lives outside the loadout.**

- **Player control:** the **Moves** screen (`ui/MovesScreen.ts`, R1 → menu →
  Moves) toggles each known move on/off. Enabling a 6th is blocked until one is
  disabled. Zero active is allowed (you still have Basic Attack). The choice is
  **permanent** — it lives on the instance and is saved.
- **Auto-fill:** `syncMoves` fills *free* slots with *freshly-learned* moves
  only, so a new move is battle-ready by default but a move you deliberately
  benched is never silently re-enabled.
- **Persistence:** `loadout` is a plain field on `CreatureInstance`, so it rides
  the normal save. `saveGame.ts` back-fills it from the known pool for pre-v9
  saves (`SAVE_VERSION` 9, `MIN_SAVE_VERSION` still 8).

---

## 4. Interop with the battle-mechanics layer

The magick pass coexists with the layered battle systems documented in
`SYSTEMS.md` §9:

- `Technique.melee` (cover + row modifiers) is independent of `category`
  (which stat pair). A move can be physical-and-ranged or physical-and-melee.
  Only close-in physical blows are `melee: true`.
- `Species.communable` (the **Commune** pacify path) is orthogonal to
  evolution — a communable rookie can still evolve.
- Elemental reactions key off a technique's `element`, unchanged by the channel
  split.

---

## 5. Debug hooks (for smoke tests / console)

`window.hd2dGame` exposes, in addition to the base handles:

| Handle | What |
|---|---|
| `creature` | the `party/creature` module — `makeCreature`, `statsAt`, `grantXp`, … |
| `evolve` | the `party/evolve` module — `evolve`, `devolve`, `canEvolve`, … |
| `playTranscend` | the evolution **cinematic** — `playTranscend(host, opts)` |
| `formula` | `computeDamage`, `computeHeal` |
| `tech(id)` | technique lookup |
| `roster` | the `data/creatures` module — `SPECIES`, `movesKnownAt`, … |

`tools/smoke/transcend.mjs` drives these headlessly (no scene navigation), so it
is fast and deterministic — the model to copy for further creature-system tests.

---

## 6. Known follow-ups

- **Dedicated sprites** for the ~14 evolved forms — they reuse existing art keys
  today (as the Overgrowth roster does). Use the PixelLab pipeline in
  `docs/adding-monsters.md`; the canonical stage ladder is Wisp → Shade →
  Revenant → Beyond.
- **DNA-merge** branch condition — grow `EvolutionOption` with an optional
  `mergeWith` (consume a second creature) and handle it in `evolve.ts`.
- **Melee capstones** — the new single-target physical capstones (Ember Rend,
  Savage Bite, …) are ranged today; mark them `melee: true` if you want them to
  take cover/row modifiers like Ember Fang.
