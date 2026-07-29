# Creature progression — magick, learnsets, and transcendence

A build guide for the three linked systems that govern how a monster fights and
grows: the **magick stat channel**, **level 1–20 learnsets**, and **evolution
(transcendence)** with **de-evolution**. This doc is the "how to extend it"
companion; the runtime maths and worked examples live in
[`docs/SYSTEMS.md`](SYSTEMS.md) §2, §3 and §7 (code is the source of truth).

> Design provenance: the evolution model is a deliberate **Pokémon × Digimon
> hybrid** — level-triggered and identity-preserving like Pokémon, branching and
> reversible like Digimon, without Digimon's "any starter reaches any top form"
> criticism. See the header comment in `systems/party/evolve.ts`.

---

## Where everything lives

| Concern | File |
|---|---|
| Stat shape (`hp mp off def spd mag res`) | `src/data/creatures.ts` — `interface Stats` |
| Per-creature data: base/growth, learnset, evolutions | `src/data/creatures.ts` — `SPECIES` |
| Role growth curves | `src/data/creatures.ts` — `HERO_/MAGE_/ASSASSIN_GROWTH` |
| Move data + physical/magical `category` | `src/data/techniques.ts` |
| Damage channel + heal blend | `src/systems/battle/formula.ts` |
| Instance stats, level-up, move-learning | `src/systems/party/creature.ts` |
| Evolve / de-evolve (headless) | `src/systems/party/evolve.ts` |
| Evolution UI | `src/ui/TranscendScreen.ts` (R1 → menu → Transcend) |
| Save migration for new stats | `src/systems/party/saveGame.ts` |
| Tests | `tools/smoke/transcend.mjs` |

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
- On level-up, `grantXp` teaches anything newly crossed
  (`movesLearnedBetween`).
- The free **Strike** is always available and is **not** in any learnset.

Convention: role/element-shaped, early filler moves, a single-target capstone
(power 58–62) around L11–16, and a big-MP area finisher (16–22 MP) near the top
so a deep MP pool pays off. Keep `techniques.ts` `category`/`melee`/`shape`
correct on any move you add (see §4).

**To add/adjust a move:** edit the species' `learnset`. To add a brand-new
technique, add it to `TECHNIQUES` in `techniques.ts` first (id, `kind`, `power`,
`mpCost`, `element`, and — for damage — `category`; set `melee: true` only for
close-in physical blows, and `shape`/`aoe` for row/column/all).

---

## 3. Transcendence (evolution + de-evolution)

### Data model

```ts
// on Species:
evolutions?: { to: string; level: number; branch?: string }[]
```

- **Level-triggered:** a branch is eligible once `creature.level >= level`.
  Default is 10; some lines differ (Gloomote/Bulwarq/Shardling 12, the
  Scrapmite → Cogling → Cogknight chain's first step 8) and many forms are
  terminal (no `evolutions`).
- **Branching:** list more than one option (e.g. Emberling → Regalion *or*
  Cinderfang). Keep branches thematically bound to the base so identity holds.
- **De-evolution** is derived — `evolve.ts` builds a reverse map from every
  forward branch, so a form always knows its one source. No per-creature or
  per-save data is needed.

### API (`systems/party/evolve.ts`, headless & tested)

- `evolutionOptions(c)` / `canEvolve(c)` — eligible branches now.
- `evolve(c, toId?)` — take a branch (refuses if ambiguous without `toId`).
- `devolveTargetId(c)` / `canDevolve(c)` / `devolve(c)` — step back one form.

The transform keeps level/XP/equipment and the current HP/MP **fraction**, then
recomputes stats and moveset from the new species — so evolve → devolve → evolve
is lossless. Evolution is **out-of-battle and explicit** (never fired from
`grantXp`), which is why it stays reversible and never surprises the player.

### To add an evolution line

1. Author the evolved-form species in `SPECIES` (full `base`/`growth`/`learnset`,
   an `art` key — reuse an existing sprite for now, see below).
2. Add an `evolutions` entry on the base form pointing at it.
3. That's it — de-evolution, the Transcend UI, and the reverse map pick it up
   automatically. Confirm with `tools/smoke/transcend.mjs` (it sweeps every
   species and resolves every branch both directions).

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
- **Element rebalance** — the wild roster is Nature-heavy and Fire-thin; worth
  fixing before the roadmap's "make element a real mechanic" step.
