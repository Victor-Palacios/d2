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
| EP drain, refuel, tow | `src/scenes/DungeonScene.ts`, `src/data/quietCrossing.ts` |

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

### Element (Water / Fire / Nature / Machine / Dark) — a real second lever

There is still **no static element-vs-element advantage chart** (Fire is not
"strong against" Nature). Instead element matters through three live systems:

1. **Element plates.** A creature standing on a floor plate matching *its own*
   element gets **×1.2 offence** (`ELEMENT_TILE_BONUS`); a creature *hit* while
   on a plate matching *its own* element takes **÷1.2** damage. See
   `computeDamage()` — `attackerTileBonus` / `defenderTileBonus`.
2. **Elemental reactions** (see §9). A damaging hit leaves a short-lived
   elemental *mark*; a follow-up of a **different** element detonates it for
   bonus damage and faster Break. This is the dynamic replacement for a static
   chart — the interaction is between *consecutive hits*, not fixed types.
3. **Flavour and FX colour.** A technique's `element` picks the colour of its
   hit effect and log wording.

The reaction rule is uniform across all pairs (same multiplier, different
flavour name), so **the count of elements is still nearly free to change**:
trimming five to three (a roadmap item) drops some plate art, reaction names and
technique flavour, not a rebalance. See `docs/ROADMAP.md`.

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
3. **Grid sense.** ~35% of the time, when it would clearly help, it repositions
   instead of attacking: stepping onto its own element plate for the ×1.2, or —
   if it is an exposed Rear unit being picked off — ducking to the front line
   (`chooseEnemyShift()`).
4. **Technique vs attack.** 72% of the time it uses an affordable damage
   technique (preferring an AoE when two or more targets are alive 60% of the
   time); otherwise it falls back to the free Strike.
5. **Desperation guard.** Below 25% HP with nothing good to do, it sometimes
   guards.
6. **Boost timing.** `shouldSpendBoost()` decides whether to cash a banked Boost
   for an extra turn: it presses an opening (a Broken or <30% HP foe) much more
   readily, and bosses press harder than trash. This lives in the model, not the
   scene, so it is tactical *and* testable.

Everything — targeting, shifts, Boost timing, and the flee / Last Light rolls in
`BattleScene` — is driven by the battle's single injected `rng`. Pass a seeded
`rng` in `BattleSceneParams` and an **entire played fight** is reproducible, not
just the pure model.

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

**XP and level-ups** are wired: on victory each surviving party monster earns
from every defeated enemy, scaled by the level gap (`xpFromEnemy`), and
`grantXp` applies level-ups off the species `growth` curve (`statsAt`), healing
the HP/MP delta. Under-levelled monsters gain more, so the party self-levels
toward each domain's recommended level.

---

## 7. EP (vehicle fuel) — the crawl's real cost

While crawling, EP is the resource that makes the dungeon a place you can lose:

| Thing | Value | Where |
|---|---|---|
| Starting / max EP | **120** | `QUIET_CROSSING.startingFuel` |
| Drain per step | **1** | `FUEL_PER_STEP`, `DungeonScene` |
| Fuel canister pickup | **+40** | `DungeonScene` (crawl `$` tiles) |
| Shop Fuel Canister item | **+40 EP** | `data/items.ts` |
| Hit 0 EP | **towed back to The Everwake** | `DungeonScene` |

EP is why suspend-saves are consumed on load (see `HANDOFF.md` / README): if you
could reload a suspend save, running out of EP would cost nothing. Autosave, by
contrast, only ever happens in town / on the reach map — safe ground — so it
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
| Tune elemental reactions | `REACTION_MULT` / `REACTION_STAGGER` / `REACTION_TTL_ROUNDS` in `engine.ts` |
| Tune break-chains | `CHAIN_STEP` / `CHAIN_DAMAGE_MAX` / `CHAIN_BOOST_AT` in `engine.ts` |
| Tune Commune length | `COMMUNE_GAIN` / `COMMUNE_VARIANCE` in `engine.ts`; `communable` in `creatures.ts` |
| Change which Techniques are melee | the `melee` flag in `techniques.ts` |

---

## 9. Reach, reactions, chains, and Commune (the layered systems)

Four systems sit on top of the base formula. Each is introduced to the player by
a one-time, flag-gated tutorial (`BattleScene.maybeTutorial`) in a different area
so they arrive one at a time, not all at once.

### Melee vs ranged reach — *The Quiet Crossing*

A Technique with `melee: true` (the free Strike, plus physical moves like Ember
Fang, Tidal Slap, Bolt Drive, Quake Core, Sun Claw) takes the Vanguard/Rear row
modifiers **and** is stopped by cover — it cannot reach a Rear foe shielded by a
living Vanguard ally in its column. Everything else is ranged/Ether and ignores
both. `isMeleeTechnique()` now reads the flag instead of hard-coding Strike, so
positioning matters for a whole class of moves, not just the basic Attack.

### Elemental reactions — *The Reliquary*

A damaging hit leaves an elemental **mark** on the target (its `reactionTag`,
live for `REACTION_TTL_ROUNDS` beyond the round it was set). A follow-up hit of a
**different** element detonates a reaction: **×`REACTION_MULT`** damage, **+`REACTION_STAGGER`**
to the Break meter, and the mark is consumed (you must re-establish it). Same
element just refreshes the mark. Pair names (Steam Burst, Wildfire, Short-Circuit
…) are cosmetic — the maths is identical for every pair. The rule is one line:
*switch elements to combo.*

### Break-chains — *The Unremembered*

Every hit landed on a **Broken** target before it recovers extends a chain
(`Battler.chain`). The Break damage bonus escalates `BREAK_DAMAGE_MULT + CHAIN_STEP·(n−1)`
up to `CHAIN_DAMAGE_MAX`, and the `CHAIN_BOOST_AT`-th link banks the attacking
side a Boost charge — so coordinating turns (and spending Boost to fit extra
hits) onto a broken foe pays itself back. `clearStagger()` resets the chain when
the Break ends.

### Commune — *The Unremembered*

Against a `communable` soul (Wispling, for now) the **Commune** action fills an
understanding meter (`+COMMUNE_GAIN` ± `COMMUNE_VARIANCE`) instead of dealing
damage. At `COMMUNE_MAX` the soul is **pacified**: `Battler.pacified` is set, it
leaves play (excluded from `living()`, cover, targeting and the turn queue), and
the scene records it as *understood* (`game.understandSoul`) so it is claimed
like a full Soul Syphon on victory — the gentle, no-damage capture path. Pacify
every foe and the fight is won.
