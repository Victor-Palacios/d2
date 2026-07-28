# Battle systems — how the numbers actually work

A worked explainer of the combat model: attributes, elements, damage, guard, EP
and rewards, with real numbers pulled from real creatures. It exists so you can
tune the game without reverse-engineering the formula first.

**Source of truth** (this doc is a description, the code is the law):

| System | File |
|---|---|
| Classes, elements, multipliers | `src/data/elements.ts` |
| Damage / heal / guard maths | `src/systems/battle/formula.ts` |
| Turn order, targeting, enemy AI | `src/systems/battle/engine.ts` |
| Techniques and their power | `src/data/techniques.ts` |
| Creature base stats and growth | `src/data/creatures.ts` |
| Levelled stats (`base + growth·(level-1)`) | `src/systems/party/creature.ts` |
| Battle rewards, post-fight recovery | `src/scenes/BattleScene.ts` |
| EP drain, refuel, tow | `src/scenes/DungeonScene.ts`, `src/data/bootDomain.ts` |

Every constant named below is a balance knob. Change it and the game changes —
nothing here is hard-coded twice.

---

## 1. Two independent axes: **class** and **element**

These are easy to conflate. They are not the same system, and only one of them
affects damage today.

### Class (the "attribute" triangle) — this *is* the damage lever

Three classes in a rock-paper-scissors ring:

> **Assassin > Mage > Hero > Assassin**

Read it as flavour: an Assassin strikes before the Mage's spell lands, a Mage
outranges the Hero's blade, a Hero's armour turns the Assassin's knife.

| Attacker vs defender | Multiplier | Constant |
|---|---|---|
| Beats it (e.g. Assassin → Mage) | **×1.25** | `ATTRIBUTE_ADVANTAGE` |
| Loses to it (e.g. Hero → Mage) | **×0.8** | `ATTRIBUTE_DISADVANTAGE` |
| Same class, or unrelated | ×1.0 | — |

Computed in `attributeMultiplier()`. This is the single biggest swing a player
controls turn to turn, and the whole tutorial is built to teach it (the boss is
a Hero; the borrowed party's Mage is the intended counter).

### Element (Water / Fire / Nature / Machine / Dark) — mostly cosmetic *today*

Each creature and technique carries an element, but **there is no
element-vs-element advantage chart** in the formula. Element currently does
exactly two things:

1. **Element plates.** A creature standing on a floor plate matching *its own*
   element gets **×1.2 offence** (`ELEMENT_TILE_BONUS`); a creature *hit* while
   on a plate matching *its own* element takes **÷1.2** damage. See
   `computeDamage()` — `attackerTileBonus` / `defenderTileBonus`.
2. **Flavour and FX colour.** A technique's `element` picks the colour of its
   hit effect and log wording. It does **not** interact with the defender's
   element for damage.

This matters for balancing and for the roadmap: because elements carry almost no
mechanical weight, **the count of elements is nearly free to change.** Trimming
five elements to three (a roadmap item) costs some plate art and technique
flavour, not a rebalance. See `docs/ROADMAP.md`.

---

## 2. The damage formula, step by step

From `computeDamage()` in `src/systems/battle/formula.ts`:

```
# stat pair is picked by the technique's category (physical vs magical):
atkStat = magical ? attacker.mag : attacker.off
defStat = magical ? defender.res : defender.def

base   = technique.power × atkStat / (defStat + 40)
amount = base × classMult
         × (1.2 if attacker on its own element plate)
         × (1/1.2 if defender on its own element plate)
         × (0.5 if defender is Guarding)          // GUARD_REDUCTION
         × (1 ± up to 6%)                          // VARIANCE, random
amount = max(1, round(amount))                     // always at least 1
```

**Two damage channels (magick pass).** Every creature has four combat stats in
two pairs: **Offense/Defense** (physical) and **Magick/Resolve** (magical). A
technique's `category` (`physical` | `magical`, defaulting to physical; heals are
always magical) decides which attacker stat drives it and which defender stat
resists it. `techCategory()` in `techniques.ts` resolves it. This is what makes a
Mage a *caster*: Mages carry low `off` but high `mag`, so their spells hit hard
while their fists don't — and an enemy with high `def` but low `res` is a wall to
blades and paper to bolts. The class triangle (below) multiplies *on top* of
whichever channel is in play.

The `+ 40` on the defensive stat is a softening term: it stops low-level values
from making early hits swing wildly, and keeps the curve gentle. `power` values
live in `techniques.ts` (Strike = 30, mid moves 44–52, AoE moves lower per-hit at
34–46, single-target capstones 58–62; the big-MP area finishers cost 16–22 MP so
a deep MP pool finally buys something).

`effectiveness` in the returned breakdown is `'super'` when classMult > 1,
`'weak'` when < 1, else `'normal'` — that is what drives the "it hits hard!" /
"it is resisted" battle-log lines.

### Worked example A — class advantage

**Fenrix** (Assassin, Nature) at level 12 uses **Strike** (power 30) on
**Gloomote** (Mage, Dark) at level 11.

Strike is **physical**, so it reads Off vs Def.

- Fenrix `off` = base 18 + growth 2.5 × 11 = **46** (`statsAt`)
- Gloomote `def` = base 11 + growth 1.7 × 10 = **28**
- `base` = 30 × 46 / (28 + 40) = 1380 / 68 = **20.3**
- Assassin **beats** Mage → classMult **×1.25** → 25.4
- No plate, no guard, ±6% variance → **≈ 24–27 damage**, logged *super effective*.

Now stand Fenrix on a **Nature** plate (its own element): × 1.2 →
25.4 × 1.2 = 30.5 → **≈ 29–32 damage**.

### Worked example B — class disadvantage

**Cogling** (Hero) level 10 uses **Bolt Drive** (power 48) on **Dropletta**
(Mage) level 10.

Bolt Drive is **physical** too (Off vs Def).

- Cogling `off` = 15 + 2.1 × 9 = **33.9**
- Dropletta `def` = 14 + 1.7 × 9 = **29.3**
- `base` = 48 × 33.9 / (29.3 + 40) = 1627 / 69.3 = **23.5**
- Mage **beats** Hero → classMult **×0.8** → 18.8
- → **≈ 18–20 damage**, logged *resisted*.

### Worked example C — the magick channel

**Gloomote** (Mage, Dark) level 11 uses **Gloom Lance** (power 50, *magical*) on
**Cogling** (Hero) level 10 — then the same, but Cogling casts nothing back.

- Gloomote `mag` = base 21 + growth 2.6 × 10 = **47**
- Cogling `res` = base 13 + growth 2.1 × 9 = **32**
- `base` = 50 × 47 / (32 + 40) = 2350 / 72 = **32.6**
- Mage **beats** Hero → ×1.25 → 40.8 → **≈ 38–43 damage**.

The same Gloomote throwing a **physical** Strike (off ≈ 13 + 1.6×10 = 29) at that
Cogling's **def** (16 + 2.2×9 ≈ 36) lands ~9 before class — a third as much. The
caster wants spells; the split is doing its job.

Same attacker, same technique — the class matchup alone is a **~30% swing**
between examples A-style advantage and B-style disadvantage (1.25 vs 0.8 =
**1.56× difference**). That ratio is the core of the combat's decision-making.

---

## 3. Healing and Guard

### Heal

From `computeHeal()`:

```
heal = round(technique.power + healer.mag × 0.4)
```

Heals ride **Magick** (they are magical by category), so a Mage mends for more
than a bruiser — the same stat that powers their spells.

Example: **Mist Veil** (power 42) cast by Gloomote (off 35 at level 11) →
42 + 35 × 0.4 = 42 + 14 = **56 HP**, capped at the target's missing HP. Heals
scale with the *healer's* offence, so a strong attacker is also a strong medic —
a deliberate simplification (no separate "magic" stat).

### Guard

Choosing **Guard** (`perform()` in `engine.ts`):

- Sets `guarding = true` for the round, which **halves** all damage the creature
  takes until its next turn (`GUARD_REDUCTION = 0.5`).
- Restores **12%** of max MP (`GUARD_MP_RESTORE = 0.12`), rounded, capped at the
  MP deficit.

Example: Gloomote max MP at level 11 = 26 + 2.6 × 10 = **52** → Guard restores
round(52 × 0.12) = **6 MP**. Guard is the game's MP economy: it is how you refuel
techniques without items, at the cost of a turn and while eating half damage.

`guarding` resets at the top of every round in `beginRound()`, so it is a
one-round commitment, not a stance.

---

## 4. Turn order

`beginRound()` builds the queue each round:

```
roll = creature.spd × (0.88 .. 1.12)   // ±12% random band
sort by roll, descending
```

Fast creatures usually go first, but the ±12% band means a slightly slower
creature can occasionally slip ahead — enough to keep speed meaningful without
making it deterministic. Anyone knocked out mid-round is skipped when their turn
comes up (`nextTurn()` checks `isUp`).

---

## 5. Enemy AI

`chooseEnemyAction()` — deliberately competent, not cruel:

1. **Target scoring.** Each living foe gets `random×0.4`, **+0.6** if it is below
   35% HP (finish the wounded), **+0.5** for a class advantage, **−0.3** for a
   disadvantage. Highest score is the target.
2. **Self-heal.** If it knows a heal it can afford and an ally is under 40% HP,
   it heals them 70% of the time.
3. **Technique vs attack.** 72% of the time it uses an affordable damage
   technique (preferring an AoE when two or more targets are alive 60% of the
   time); otherwise it falls back to the free Strike.
4. **Desperation guard.** Below 25% HP with nothing good to do, it sometimes
   guards.

Everything is driven by the battle's injected `rng`, so a seeded RNG makes fights
reproducible for tests.

---

## 6. Rewards and post-fight recovery

On victory (`BattleScene.finishVictory`):

```
reward = Σ over defeated enemies of  enemy.level × (isBoss ? 40 : 11)   credits
```

- Three level-8 trash mobs → 3 × 8 × 11 = **264 credits**.
- A level-16 boss → 16 × 40 = **640 credits**.

Then a small breather so you are not sent into the next step empty:

- Fainted party members revive to **30%** of max HP (`reviveFainted(0.3)`).
- Everyone still standing gets **+12% max HP** and **+10% max MP**.

Victories grant XP (`grantXp`, `BattleScene.finishVictory`): stats are recomputed
from the species `growth` curve on each level, and any learnset move whose level
was crossed is taught (see §7).

---

## 7. Movesets and transcendence (evolution)

### Learnsets — moves from level 1 to 20

Every species carries a `learnset: { level, tech }[]` (`data/creatures.ts`). A
creature knows every entry whose `level` is ≤ its own; `movesKnownAt()` resolves
that (in learn order, de-duplicated) when a creature is made, and `grantXp()`
teaches anything newly reached on level-up (`movesLearnedBetween()`). The free
**Strike** (physical, power 30) is always available and is not in any learnset.

Movesets are role/element-shaped: Mages lean magical, Heroes mix in tanky
physical hits, Assassins get fast single-target physical finishers. Late entries
are the capstones and the big-MP area finishers — the payoff for a deep MP pool.

### Growth curves

`statsAt()` uses `base + growth × (level − 1)`. Species build on one of three role
curves in `creatures.ts` — `HERO_GROWTH` (hardens def/res), `MAGE_GROWTH`
(deepens mp/mag), `ASSASSIN_GROWTH` (sharpens off/spd) — then may bump a stat or
two. Invest levels in a class and it pays off on that class's own axis.

### Transcendence — a Pokémon × Digimon hybrid

Evolution lives in `systems/party/evolve.ts` (headless) and the `evolutions` field
on each species. It borrows deliberately from both franchises:

- **Level-triggered** (Pokémon): a branch unlocks at a set level — **10 for
  most**, but not all (Gloomote/Bulwarq/Shardling at 12, the Scrapmite → Cogling
  → Cogknight line's first step at 8, several forms terminal).
- **Branching** (Digimon): a species may offer more than one form (Emberling →
  Regalion *or* Cinderfang). Branches stay thematically bound to the base, so a
  line keeps its identity — the fix for the usual Digimon criticism that any
  starter can reach any top form.
- **Reversible** (Digimon): **de-evolution** returns a soul to the shape it was.
  The reverse map is derived from the forward tree, so it is always exact and
  needs no extra data on the creature or in the save.

Evolution is **out-of-battle and explicit** (the **Transcend** screen, R1 → menu):
reaching the level makes a creature *eligible*; the player picks when and which
branch. The transform keeps level/XP/equipment and the current HP/MP *fraction*,
then recomputes stats and moveset from the new species — so evolve → devolve →
evolve is lossless.

---

## 8. EP (vehicle fuel) — the crawl's real cost

While crawling, EP is the resource that makes the dungeon a place you can lose:

| Thing | Value | Where |
|---|---|---|
| Starting / max EP | **120** | `BOOT_DOMAIN.startingFuel` |
| Drain per step | **1** | `FUEL_PER_STEP`, `DungeonScene` |
| Fuel canister pickup | **+40** | `DungeonScene` (crawl `$` tiles) |
| Shop Fuel Canister item | **+40 EP** | `data/items.ts` |
| Hit 0 EP | **towed back to The Everwake** | `DungeonScene` |

EP is why suspend-saves are consumed on load (see `HANDOFF.md` / README): if you
could reload a suspend save, running out of EP would cost nothing. Autosave, by
contrast, only ever happens in town / on the domain map — safe ground — so it
never rescues you from a bad crawl.

---

## 9. Quick tuning cheatsheet

| Want to… | Change |
|---|---|
| Make class matchups swingier | `ATTRIBUTE_ADVANTAGE` / `ATTRIBUTE_DISADVANTAGE` in `elements.ts` |
| Retune a stat channel | a technique's `category` in `techniques.ts`, or a role growth curve in `creatures.ts` |
| Change when a creature evolves | the `level` on its `evolutions` entry in `creatures.ts` |
| Add/adjust a learned move | its `learnset` entry in `creatures.ts` |
| Make plates matter more | `ELEMENT_TILE_BONUS` in `elements.ts` |
| Make fights longer / shorter | the `+ 40` defence term or technique `power` in `formula.ts` / `techniques.ts` |
| Make Guard stronger | `GUARD_REDUCTION` (lower = tankier) / `GUARD_MP_RESTORE` |
| Reduce fight randomness | `VARIANCE` in `formula.ts`, and the `0.88..1.12` band in `engine.ts` |
| Change how rich the player gets | the `11` / `40` per-level reward in `BattleScene.ts` |
| Make the crawl more punishing | `FUEL_PER_STEP` up, or `startingFuel` down |
