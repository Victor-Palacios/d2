# Grid battle system

A formation-grid combat model inspired by **classic monster-collecting RPGs** (a
multi-unit front line where target priority matters) and the **Xenosaga**
trilogy (a timing/economy layer on top of turns). The design deliberately keeps
what those systems were praised for and sidesteps what they were criticised for.

## What the research pointed at

- **Monster-collecting party RPGs** — praised: fielding three creatures at once
  made combat feel more tactical than one-on-one; the depth lived in raising and
  recruiting. Criticised: the CPU was often **predictable** and the systems felt
  unchanged between entries, shining mainly in PvP.
- **Xenosaga I / III** — praised: telegraphed per-turn events (echoed here by the
  field pulse).
- **Xenosaga II** — criticised: a mandatory **Break** combo system that *gated*
  damage behind memorised patterns; slow and obtuse.

Two rules fell out of that: make any Break mechanic an **accelerator, never a
damage gate**; and fix predictable AI with position-aware, non-deterministic
targeting.

> **Removed:** an early build had a Xenosaga-style **Boost** gauge (build charges
> with basic attacks, spend for an extra turn). It was cut for reading as too
> close to Octopath Traveler's BP; Guard now simply braces and restores MP.

## The grid

Each side has a **2×3 grid** (`Cell {row, col}`): row 0 is the **Vanguard**
(front), row 1 the **Rear** (back); columns 0–2 map left→right and share the
arena's element plates. As many souls deploy as you have human keepers
(`game.fieldCap` — two at the Quiet Crossing, up to four; see NARRATIVE §11b);
the rest are reserves. Companions never take the field. The default formation
fills the Vanguard left→centre→right, so your souls stand across the front — the
back row is something you deploy into deliberately.

| Rule | Effect |
|---|---|
| Vanguard melee | +15% dealt (`VANGUARD_MELEE_DEALT`) |
| Rear melee | −20% dealt (`REAR_MELEE_DEALT`) |
| Vanguard defence | +15% taken by anyone in the front (`VANGUARD_DAMAGE_TAKEN`) |
| Cover | a Rear unit can't be hit by single-target **melee** while a living ally holds the Vanguard cell in its column (`isCovered` / `meleeTargets`) |
| Reach | the basic **Attack** is melee; every **Technique** is ranged/Ether and ignores cover (`isMeleeTechnique`) — the reason to keep casters in the Rear |

## Phases (each shipped and smoke-verified independently)

- **A — foundation.** Cells, cell-based 3D placement, a rendered 12-cell grid,
  the front/back damage modifiers, and melee cover.
- **B — positioning depth.** Technique `shape` (`single | row | column | all`);
  **Move** (reposition to an empty cell) and **Swap** (bench the actor, field a
  reserve), both consuming the turn; plates belong to cells, so a moved unit
  leaves its plate and can step onto another.
- **C — Boost.** *(Removed — see the note above.)*
- **D — Break, field pulse, smarter AI.** A stagger meter fills on hits (faster
  on class advantage / plate hits); at full the target **Breaks** — loses its
  next turn and takes +50% until then. A per-round **field pulse** rotates
  calm/crit(+20% dmg). The enemy AI scores exposed back-liners,
  plate threats and existing Breaks, draws with a **softmax** (variety, not
  argmax), catches shaped AoE against stacked columns, and feints with Guard.

## Where it lives

- `src/systems/battle/engine.ts` — grid model, cover, shapes, Break, field
  pulse, AI. Headless; no three.js/DOM.
- `src/systems/battle/formula.ts` — row damage modifiers.
- `src/data/techniques.ts` — `shape` / `techShape`.
- `src/scenes/BattleScene.ts` — cell→world placement, grid outlines, the turn
  loop (Break skip, pulse announce), sprite re-placement on move/swap.
- `src/ui/BattleHUD.ts` — Move/Swap menu entries, the per-card stagger meter and
  BROKEN tag.

All the tunable constants (`STAGGER_*`, `BREAK_DAMAGE_MULT`, `PULSE_CYCLE`,
`CRIT_PULSE_MULT`, the row multipliers) are exported and intentionally readable.
`tools/smoke/grid.mjs` exercises the surviving phases against the live engine in
the built bundle.
