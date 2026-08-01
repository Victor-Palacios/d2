# Battle systems — how the numbers actually work

A worked explainer of the combat model: attributes, elements, damage, guard, LP
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
| LP drain, refill, guttered return | `src/scenes/DungeonScene.ts`, `src/data/quietCrossing.ts` |

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
stat = healer.res × 0.7 + healer.mag × 0.3      // HEAL_RES_WEIGHT / HEAL_MAG_WEIGHT
heal = round(technique.power + stat × 0.4)        // HEAL_STAT_SCALE
```

A heal blends **Resolve** (mostly) and **Magick** — mending reads as a protective
act with a magical component, so a durable support and a caster both make decent
healers, and neither a glass cannon nor a pure bruiser is great at it. The weights
(and scale) are balance knobs in `formula.ts`.

Example: **Mist Veil** (power 42) cast by Gloomote at level 11 (res 30, mag 47) →
stat = 30 × 0.7 + 47 × 0.3 = **35.1**; heal = 42 + 35.1 × 0.4 = **56 HP**, capped
at the target's missing HP. A durable, high-Resolve support is the strongest
medic, with the caster's Magick topping it up.

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

Everything — targeting, shifts, and the flee / Last Light rolls in
`BattleScene` — is driven by the battle's single injected `rng`. Pass a seeded
`rng` in `BattleSceneParams` and an **entire played fight** is reproducible, not
just the pure model.

---

## 6. Rewards and post-fight recovery

On victory (`BattleScene.finishVictory`):

```
reward = Σ over defeated enemies of  enemy.level × (isBoss ? 40 : 11)   obols
```

- Three level-8 trash mobs → 3 × 8 × 11 = **264 obols**.
- A level-16 boss → 16 × 40 = **640 obols**.

Then a small breather so you are not sent into the next step empty:

- Fainted party members revive to **30%** of max HP (`reviveFainted(0.3)`).
- Everyone still standing gets **+12% max HP** and **+10% max MP**.

**XP and level-ups** are wired: on victory each surviving party monster earns
from every defeated enemy, scaled by the level gap (`xpFromEnemy`), and
`grantXp` applies level-ups off the species `growth` curve (`statsAt`), healing
the HP/MP delta. Under-levelled monsters gain more, so the party self-levels
toward each reach's recommended level. Any learnset move whose level a monster
crosses on the way up is taught then and there (see §7).

---

## 7. Movesets and transcendence (evolution)

> Extending these systems (adding a species, a learnset move, or an evolution
> branch)? See the how-to guide in [`docs/creature-progression.md`](creature-progression.md).

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

## 8. LP (lantern-light) — the crawl's real cost

While crawling, LP (Light Power — the lantern's charge) is the resource that
makes the dungeon a place you can lose:

| Thing | Value | Where |
|---|---|---|
| Starting / max LP | **per reach** | `<reach>.startingLight` |
| Drain per step | **1** | `LIGHT_PER_STEP`, `DungeonScene` |
| Light shard pickup | **+40** | `DungeonScene` (crawl `$` tiles) |
| Shop Light Shard item | **+40 LP** | `data/items.ts` |
| Hit 0 LP | **lantern gutters, returned to The Everwake** | `DungeonScene` |
| Permanent capacity bonus | **`game.lpBonus`** | Oilwright, `WorldMapScene` |

The LP pool is **sized per reach and spans all its floors** — it does *not*
refill between floors, only on entering/exiting a crawl. So `startingLight`
must scale with a reach's floor count: the Crossing (3 floors) starts at 120,
and the deeper reaches step up with their length — Reliquary 175 (4), Overgrowth
215 (5), Unremembered 255 (6), Last Lantern 300 (7) — plus one `$` shard per
mid-floor. Rule of thumb: **~40 LP per floor** of budget, since a floor is ~25
steps to clear plus exploration.

**The Oilwright** (hub NPC, `src/ui/Oilwright.ts`) is the release valve for a
crawl that keeps guttering: render a spare captured soul to lamp-oil and it is
**consumed and lost** in exchange for a permanent `+LP` capacity bonus
(`20 + level*2`). That bonus lives on `game.lpBonus` — the one LP field that
survives the per-reach reset, because `WorldMapScene` sets
`maxLight = reach.startingLight + game.lpBonus` on every descent. It is
persisted in saves. `game.consumeSoul(uid)` does the removal, guarding
companions and the last fighting soul.

LP is why suspend-saves are consumed on load (see `HANDOFF.md` / README): if you
could reload a suspend save, running out of light would cost nothing. Autosave, by
contrast, only ever happens in town / on the reach map — safe ground — so it
never rescues you from a bad crawl.

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
up to `CHAIN_DAMAGE_MAX` — so coordinating your turns onto a broken foe pays
itself back in escalating damage. `clearStagger()` resets the chain when the
Break ends.

### Commune — *The Unremembered*

Against a `communable` soul (Wispling, for now) the **Commune** action fills an
understanding meter (`+COMMUNE_GAIN` ± `COMMUNE_VARIANCE`) instead of dealing
damage. At `COMMUNE_MAX` the soul is **pacified**: `Battler.pacified` is set, it
leaves play (excluded from `living()`, cover, targeting and the turn queue), and
the scene records it as *understood* (`game.understandSoul`) so it is claimed
like a full Soul Syphon on victory — the gentle, no-damage capture path. Pacify
every foe and the fight is won.

---

## 10. Quick tuning cheatsheet

| Want to… | Change |
|---|---|
| Make class matchups swingier | `ATTRIBUTE_ADVANTAGE` / `ATTRIBUTE_DISADVANTAGE` in `elements.ts` |
| Retune a stat channel | a technique's `category` in `techniques.ts`, or a role growth curve in `creatures.ts` |
| Change when a creature evolves | the `level` on its `evolutions` entry in `creatures.ts` |
| Add/adjust a learned move | its `learnset` entry in `creatures.ts` |
| Retune heal weighting | `HEAL_RES_WEIGHT` / `HEAL_MAG_WEIGHT` / `HEAL_STAT_SCALE` in `formula.ts` |
| Make plates matter more | `ELEMENT_TILE_BONUS` in `elements.ts` |
| Make fights longer / shorter | the `+ 40` defence term or technique `power` in `formula.ts` / `techniques.ts` |
| Make Guard stronger | `GUARD_REDUCTION` (lower = tankier) / `GUARD_MP_RESTORE` |
| Reduce fight randomness | `VARIANCE` in `formula.ts`, and the `0.88..1.12` band in `engine.ts` |
| Change how rich the player gets | the `11` / `40` per-level reward in `BattleScene.ts` |
| Make the crawl more punishing | `LIGHT_PER_STEP` up, or `startingLight` down |
| Tune elemental reactions | `REACTION_MULT` / `REACTION_STAGGER` / `REACTION_TTL_ROUNDS` in `engine.ts` |
| Tune break-chains | `CHAIN_STEP` / `CHAIN_DAMAGE_MAX` in `engine.ts` |
| Tune Commune length | `COMMUNE_GAIN` / `COMMUNE_VARIANCE` in `engine.ts`; `communable` in `creatures.ts` |
| Change which Techniques are melee | the `melee` flag in `techniques.ts` |
