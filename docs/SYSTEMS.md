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
base   = technique.power × attacker.off / (defender.def + 40)
amount = base × classMult
         × (1.2 if attacker on its own element plate)
         × (1/1.2 if defender on its own element plate)
         × (0.5 if defender is Guarding)          // GUARD_REDUCTION
         × (1 ± up to 6%)                          // VARIANCE, random
amount = max(1, round(amount))                     // always at least 1
```

The `+ 40` on defence is a softening term: it stops low-level defence values
from making early hits swing wildly, and keeps the curve gentle. `power` values
live in `techniques.ts` (Strike = 30, most signature moves 44–52, AoE moves
lower per-hit at 34–40, the boss's Sun Claw a spike at 62).

`effectiveness` in the returned breakdown is `'super'` when classMult > 1,
`'weak'` when < 1, else `'normal'` — that is what drives the "it hits hard!" /
"it is resisted" battle-log lines.

### Worked example A — class advantage

**Fenrix** (Assassin, Nature) at level 12 uses **Strike** (power 30) on
**Gloomote** (Mage, Dark) at level 11.

- Fenrix `off` = base 18 + growth 2.5 × 11 = **46** (`statsAt`)
- Gloomote `def` = base 11 + growth 1.9 × 10 = **30**
- `base` = 30 × 46 / (30 + 40) = 1380 / 70 = **19.7**
- Assassin **beats** Mage → classMult **×1.25** → 24.6
- No plate, no guard, ±6% variance → **≈ 23–26 damage**, logged *super effective*.

Now stand Fenrix on a **Nature** plate (its own element): × 1.2 →
24.6 × 1.2 = 29.6 → **≈ 28–31 damage**.

### Worked example B — class disadvantage

**Cogling** (Hero) level 10 uses **Bolt Drive** (power 48) on **Dropletta**
(Mage) level 10.

- Cogling `off` = 15 + 2.2 × 9 = **34.8**
- Dropletta `def` = 14 + 1.9 × 9 = **31.1**
- `base` = 48 × 34.8 / (31.1 + 40) = 1670 / 71.1 = **23.5**
- Mage **beats** Hero → classMult **×0.8** → 18.8
- → **≈ 18–20 damage**, logged *resisted*.

Same attacker, same technique — the class matchup alone is a **~30% swing**
between examples A-style advantage and B-style disadvantage (1.25 vs 0.8 =
**1.56× difference**). That ratio is the core of the combat's decision-making.

---

## 3. Healing and Guard

### Heal

From `computeHeal()`:

```
heal = round(technique.power + healer.off × 0.4)
```

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

There is **no XP / level-up loop yet** — creatures are created at a fixed level
(`makeCreature`) and `growth` only feeds `statsAt()` when a creature is *made* at
a level. Wiring victories to XP is the first big roadmap item; the stat-growth
curve it needs already exists.

---

## 7. EP (vehicle fuel) — the crawl's real cost

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

## 8. Quick tuning cheatsheet

| Want to… | Change |
|---|---|
| Make class matchups swingier | `ATTRIBUTE_ADVANTAGE` / `ATTRIBUTE_DISADVANTAGE` in `elements.ts` |
| Make plates matter more | `ELEMENT_TILE_BONUS` in `elements.ts` |
| Make fights longer / shorter | the `+ 40` defence term or technique `power` in `formula.ts` / `techniques.ts` |
| Make Guard stronger | `GUARD_REDUCTION` (lower = tankier) / `GUARD_MP_RESTORE` |
| Reduce fight randomness | `VARIANCE` in `formula.ts`, and the `0.88..1.12` band in `engine.ts` |
| Change how rich the player gets | the `11` / `40` per-level reward in `BattleScene.ts` |
| Make the crawl more punishing | `FUEL_PER_STEP` up, or `startingFuel` down |
