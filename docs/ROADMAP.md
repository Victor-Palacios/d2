# Roadmap — from the first hour to the first five

Where this goes next. The current build is a complete **first-hour vertical
slice** (see `docs/PLAN_AUDIT.md`); this charts the path toward reproducing the
*shape* of **Digimon World 2**'s first ~5 hours — multiple domains, a real
progression loop, DNA digivolution, and recruiting — without breaking the two
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

*Why first:* every later system (recruiting, digivolution, harder domains)
assumes creatures get stronger. Build the spine before the limbs.

## M8 — Recruiting / capturing

DW2 fills your roster from the dungeon.

- Post-battle "recruit?" chance on defeated wild creatures (scaled by remaining
  HP, à la the classic capture curve).
- Party-vs-reserve management UI (the party is already a plain
  `CreatureInstance[]` in `GameState` — add a `reserve[]`).
- A "swap in town" screen, reusing `ui/CardSelect.ts`.

## M9 — DNA Digivolution (cash the §5.6 stub)

The data model is **already there**: `canDigivolveTo` on every `Species`
(`data/creatures.ts`), deliberately carried for exactly this.

- Digivolution screen: pick a creature meeting a requirement (level, and later a
  second creature for DNA-merge), preview the result, confirm.
- Merge rules in a new `systems/party/digivolve.ts` (headless, testable) — level
  reset with carried-over stat bonuses is the DW2 hook that makes the level cap
  interesting.
- Author the evolved-form roster in `creatures.ts` + `art.ts` (Regalion already
  exists as Emberling's target — use it as the reference chain).

## M10 — More domains + procedural floors

One tutorial dungeon becomes several servers/domains.

- `bootDomain.ts` is already a generic `DungeonFloor[]` shape — add 2–3 more
  domain data files behind the existing `WorldMapScene` picker (which already
  supports a node list).
- **Procedural floor generator** for replayable grinding: emit the same `rows`
  string format `TileGrid` already parses, so nothing downstream changes. Gate
  boss floors as hand-authored.
- Per-domain encounter tables, element theming, and a difficulty curve tied to
  the M7 level math.

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
Element trim ──▶ M7 XP ──▶ M8 Recruit ──▶ M9 Digivolve
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
