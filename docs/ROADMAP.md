# Roadmap — from the first hour to the first five

Where this goes next. The current build is a complete **first-hour vertical
slice** (see `docs/PLAN_AUDIT.md`); this charts the path toward reproducing the
*shape* of a **classic monster-collecting dungeon-crawler**'s first ~5 hours —
multiple domains, a real progression loop, DNA-merge evolution, and recruiting —
without breaking the two
things that make the slice good: it is **fully procedural** (no binary assets)
and its **battle model is headless** (pure rules, no renderer).

Milestones continue the existing `M0–M6` numbering. Each is sized to be a
shippable increment, not a release.

---

## Guiding principles (don't regress these)

1. **Data-driven, not code-driven.** New content is a data edit. Domains,
   creatures, techniques, teams all already live in `src/data/`. Keep it there.
2. **No binary assets** (plan §0.2). Every new creature is a pixel map in
   `art.ts`; every new sound is an oscillator in `Audio.ts`.
3. **The battle model stays headless.** `systems/battle/engine.ts` has no
   Three.js or DOM imports and is unit-testable in Node (the smoke tests drive
   it). New mechanics go through it, not through `BattleScene`.
4. **Respect the invariants in `HANDOFF.md` §6** — `enter()` never awaits input,
   detached work checks `disposed`, `input.fire()` copies its listener array.
   Every one was learned by shipping the bug first.

---

## Scope trim first: **five elements → three** (do this early, it's cheap)

The owner asked to **reduce element types**, and it should land *before* new
content multiplies the art and technique tables.

**Why it's nearly free.** As documented in `docs/SYSTEMS.md` §1, elements carry
almost no mechanical weight today: there is **no element-vs-element damage
chart**. An element only drives (a) the ×1.2 self-plate bonus and (b) FX colour.
So dropping from five (`water / fire / nature / machine / dark`) to three costs
some plate art and flavour — **not a rebalance**.

**Recommended three:** `fire / water / nature` — the classic triangle, and it
pairs cleanly with the three-class ring (Hero / Mage / Assassin), halving the
"two triangles" teaching load. (`machine` and `dark` fold into these; e.g.
machine→fire, dark→water, by feel.)

**Exact edit list** (one focused PR):

| File | Change |
|---|---|
| `src/data/elements.ts` | Narrow `ElementId` to `'fire' \| 'water' \| 'nature'`; trim `ELEMENTS`. |
| `src/data/techniques.ts` | Re-element the ~4 `machine`/`dark` techniques onto the three survivors. |
| `src/data/creatures.ts` | Re-element machine/dark species; keep their sprites. |
| `src/data/bootDomain.ts` | Remove `M`/`D` plate glyphs from floor rows; keep `F`/`W`/`N`. |
| `src/engine/TileGrid.ts` | Drop the retired plate kinds from the legend. |
| `src/assets/art.ts` / `pixel.ts` | Retire the two unused plate colour generators. |
| README "Balance knobs" / legend | Update the tile legend. |

TypeScript makes this safe: narrowing `ElementId` turns every stale reference
into a **compile error**, and `npm run build` runs `tsc --noEmit` first — so the
build won't publish until the last one is fixed. **Do this refactor with the
compiler as your checklist.**

> **Consider going further and making element a real mechanic** while you're in
> here: a small element-vs-element multiplier in `computeDamage()` (mirroring the
> class triangle) would make the surviving three elements *matter* instead of
> being flavour. Optional, but it's the natural payoff of trimming — three
> interacting elements teach better than five inert ones. If you do, update
> `docs/SYSTEMS.md` §1 to retire the "mostly cosmetic" note.

---

## M7 — Progression loop (XP, levels, growth)

The single biggest gap: **there is no XP / level-up today** (`docs/SYSTEMS.md`
§6). Creatures are minted at a fixed level and never grow mid-run.

- Add `xp` + `xpToNext` to `CreatureInstance`; award XP on victory alongside the
  existing credit reward in `BattleScene.finishVictory`.
- On level-up, recompute stats via the **already-existing** `statsAt()` growth
  curve — the data (`growth` per species) is there, unused past creation.
- Level-up toast + a "learns technique X" hook (extend `Species.techniques` to a
  level-keyed list).
- **Test:** extend `tools/smoke/` with a headless "grind N fights, assert level
  and stat deltas" run against `engine.ts`.

*Why first:* every later system (recruiting, evolution, harder domains)
assumes creatures get stronger. Build the spine before the limbs.

## M8 — Recruiting / capturing (Soul Syphon)

The genre fills your roster from the dungeon. This game uses a custom **Soul
Syphon** mechanic instead of a capture item.

- ✅ **Phase 1 done:** Soul Syphon capture — encountering a wild species primes
  its meter, a hit fills it to 100% and captures it (a free copy to the party, or
  the **Soul Sanctuary** reserve if full), even if the hit KOs it. Captures are
  logged in the **Soularium** dex (R1 / E), which shows a ★ for logged species so
  they can't be re-captured. Data + save in `gameState.ts` / `saveGame.ts` (v3);
  battle UI in `BattleHUD.ts`; dex in `ui/SoulariumScreen.ts`. Party cap starts
  at 4 (`START_PARTY_CAP`), max 10 (`MAX_PARTY_CAP`). Covered by
  `tools/smoke/capture.mjs`. Syphon gains (`SYPHON_PRIME` / `SYPHON_HIT`) are the
  tuning knobs — per-species rates later let rarer monsters need more.
- ✅ **Phase 2 done:**
  - **Soul Store** vendor in the hub (Soul Broker Vex, a new NPC): summon logged
    species (priced by power, `soulPrice`) into the party/Sanctuary, and buy **+1
    party-slot** upgrades 4→10 (`ui/SoulStore.ts`).
  - **Soul Sanctuary** management (`ui/SanctuaryScreen.ts`): move monsters between
    party (capped) and reserve; the party can't be emptied.
  - **Soul menu** (`ui/SoulMenu.ts`) on R1 / E gathers the Soularium + Sanctuary.
  - Covered by `tools/smoke/store.mjs`.
- **Still to do (polish):** float the syphon meter / ★ above the sprite's head
  (project the billboard's world position to screen) rather than only on the HUD
  card; and battle should draw at most 3 active party monsters (3-on-screen).

## M9 — Evolution / transcendence (§5.6)

- ✅ **Done — a Pokémon × Digimon hybrid.** The stub is cashed: `evolutions` (a
  branching, level-gated tree) on `Species`; a headless, tested
  `systems/party/evolve.ts` with `evolve`/`devolve`; and a **Transcend** screen
  (`ui/TranscendScreen.ts`, R1 → menu). Level-triggered (10 for most, not all),
  **branching** (identity-preserving), and **reversible** (de-evolution). ~14
  evolved forms authored in `creatures.ts` (art reused from the roster's
  bigger/cooler sprites, per `docs/adding-monsters.md`). Covered by
  `tools/smoke/transcend.mjs`. See `docs/SYSTEMS.md §7`.
- ✅ **Also landed — the magick pass + learnsets.** Two damage channels
  (Offense/Defense physical, Magick/Resolve magical) so Mages are real casters;
  and level 1–20 `learnset`s on every species, taught on level-up.
- **Still to do (polish):** dedicated sprites for the evolved forms (they reuse
  existing art today); a **DNA-merge** branch condition (consume a second
  creature) — the `evolutions` model can grow a `mergeWith` field for it; and
  evolution-driven encounter tables so evolved forms appear in the wild.

## M10 — More domains + procedural floors

One tutorial dungeon becomes several servers/domains.

- ✅ **Done (partial):** the singleton `BOOT_DOMAIN` is now a **registry**
  (`src/data/domains.ts` + `domain(id)`); `game.activeDomainId` drives the crawl,
  and the world map free-selects any registered domain. Two hand-authored
  domains shipped — **Crystal Cavern** (`crystalCavern.ts`) and **Haunted
  Dungeon** (`hauntedDungeon.ts`) — each with its own roster, theme and ambience
  track. Adding another is a data file + one registry line; no scene changes.
  Covered by `tools/smoke/domains.mjs`.
- **⚠️ Depends on M8 (recruiting).** These domains are wired and winnable, but a
  post-boot party is a **single starter**, which cannot realistically clear a
  3-enemy floor or a warden. Until recruiting/party-building lands, they are
  balanced only for a full party (e.g. the borrowed trio). Recruiting is the
  gating feature that makes the extra domains actually playable — do M8 next.
- **Still to do:** a **procedural floor generator** for replayable grinding
  (emit the same `rows` format `TileGrid` parses; hand-author boss floors), and
  a difficulty curve tied to the M7 level math.

## M11 — Story + tamer battles across missions

- Extend the `dialogue/script.ts` + `HubScene` mission-hook pattern (Mission 2 is
  already stubbed) into a Mission 2–5 chain with flag-gated NPCs.
- **Tamer battles**: enemy *parties* with fixed rosters and simple scripted AI
  variants (the enemy AI in `engine.ts` already takes a party, not just mobs).
- Wire **in-battle item use** (the disabled **Item** action) — small, high-value,
  and it makes the shop matter.

## M12 — Systems depth + economy pass

- Status effects (poison/stun) through the headless model.
- Rebalance rewards/prices across five hours of content (the `11`/`40`
  per-level reward constant will need a curve, not a flat rate).
- Fix the **hub autosave bug** (`HANDOFF.md` §2) before shipping multi-hour runs
  — a five-hour game that can't autosave is not shippable. This is small and
  should arguably jump the queue the moment runs get long.

---

## Sequencing rationale

```
Element trim ──▶ M7 XP ──▶ M8 Recruit ──▶ M9 Evolve
                    │                          │
                    └────────▶ M10 Domains ◀───┘ ──▶ M11 Story ──▶ M12 Depth
```

- **Element trim** is the cheapest win and shrinks every table the later
  milestones touch — do it first.
- **M7** unblocks everything; nothing else is meaningful without growth.
- **M8/M9/M10** can proceed in parallel once M7 lands; they share the roster and
  domain data layers but touch different UI.
- **Autosave fix (in M12)** is the one item that should be pulled *forward* the
  instant a playthrough exceeds a few minutes.

## What stays out of scope (still, on purpose)

Multiplayer, a real save-slot manager (the suspend/auto split is deliberate —
`HANDOFF.md` §5), and importing licensed assets. The data layer is built so the
last one is a swap, not a rewrite (README, "Swapping in real assets") — but the
repo stays asset-free.
