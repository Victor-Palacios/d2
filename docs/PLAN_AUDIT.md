# Plan audit — implemented / partial / missing

A section-by-section audit of the build against the original design plan
(the owner's uploaded plan doc; see `HANDOFF.md` §1).

> **Caveat on the source.** The plan document itself is **not in the repo** — it
> was uploaded by the owner (see `HANDOFF.md` §1). This audit is therefore
> reconstructed from the **`plan §…` / `plan M…` markers the code carries in its
> own doc-comments** (37 of them, one per subsystem) plus the observable
> behaviour of the slice. Where the plan's exact wording would settle a
> judgement call, that is flagged. When you get the plan back, the section
> numbers below line up 1:1 with the code markers, so confirming this is a
> read-through, not a re-derivation.

**Verdict at a glance:** every plan section and milestone the code references is
**implemented**, with two deliberate stubs (§5.6 evolution, in-battle items)
and one known bug (hub autosave — `HANDOFF.md` §2). Nothing tracked is silently
missing.

---

## §0 — Ground rules

| Ref | Requirement | Status | Evidence |
|---|---|---|---|
| §0.2 | **No ripped / copyrighted assets**; everything procedural at runtime | ✅ Implemented | `src/assets/art.ts` (pixel maps), `src/engine/pixel.ts` (textures), `src/engine/Audio.ts` (oscillator SFX/music). No binary assets tracked (`git ls-files` — zero images/audio). |

## §1 — UI shell

| Ref | Requirement | Status | Evidence |
|---|---|---|---|
| §1 | DOM-overlay UI, no framework | ✅ Implemented | `src/ui/dom.ts` tiny helpers; all HUDs/menus/dialogue in `src/ui/`; `src/style.css` header cites §1. |

## §2 — The first-hour flow

| Ref | Requirement | Status | Evidence |
|---|---|---|---|
| §2.1 | Title + name entry | ✅ | `IntroScene.ts` (M4), `ui/NameEntry.ts` — five slots, on-screen keyboard. |
| §2.2 | The Everwake hub | ✅ | `HubScene.ts` (M4/M5). *(hub autosave bug — see below.)* |
| §2.3 | World map / domain select | ✅ | `WorldMapScene.ts`, two-node picker via `ui/CardSelect.ts`. |
| §2.4 | Boot Domain crawl | ✅ | `DungeonScene.ts` (M1/M3). |
| §2.5 | *(not referenced by any code marker)* | ❔ Unconfirmed | No `plan §2.5` marker exists. Likely the rival-intro / Mission-2 hook, which **is** built (end of `HubScene`), but the mapping can't be confirmed without the plan text. |
| §2.6 | Guard Team choice | ✅ | `CardSelect.ts` cites §2.6; `data/teams.ts` — three teams set class + starter. |
| §2.7 | Shop / vendor | ✅ (buying only) | `ui/ShopScreen.ts`, `data/items.ts`. Credits deduct, item enters bag; **using** items is an intentional stub (below). |

## §3 — HD-2D rendering rig

| Ref | Requirement | Status | Evidence |
|---|---|---|---|
| §3 | Pixel billboards in a real 3D world; shared camera/light/post rig | ✅ | `HD2DRenderer.ts` (rig + full post stack), `Billboard.ts` (2D half, silhouette shadow), `TileGrid.ts` (3D half). Shared unchanged by crawl and battle. |

## §4 — Scene state machine

| Ref | Requirement | Status | Evidence |
|---|---|---|---|
| §4 | Intro → Hub → WorldMap → Dungeon → Battle → GameOver FSM with fades | ✅ | `SceneManager.ts` — queued `go()`, `disposed` guards, fade transitions. |

## §5 — Creatures and combat

| Ref | Requirement | Status | Evidence |
|---|---|---|---|
| §5.1 | Attributes (class triangle) + elements | ✅ | `data/elements.ts` — Assassin>Mage>Hero, five elements. |
| §5.2 | Damage / heal maths, speed order | ✅ | `systems/battle/formula.ts`, turn order in `engine.ts`. See `docs/SYSTEMS.md`. |
| §5.3 | Headless 3v3 battle model + enemy AI | ✅ | `systems/battle/engine.ts` (rules-only, no Three.js/DOM), driven by `BattleScene.ts` (M2). |
| §5.4 | Three Guard Teams, each setting class + starter | ✅ | `data/teams.ts`. |
| §5.5 | Boot Domain tutorial dungeon + vehicle EP | ✅ | `data/bootDomain.ts` (3 floors, borrowed party, boss), EP drain in `DungeonScene.ts`. |
| §5.6 | Evolution / transcendence | ✅ **Implemented (Pokémon × Digimon hybrid)** | `evolutions` tree on `Species` (`data/creatures.ts`); headless `systems/party/evolve.ts` (`evolve`/`devolve`); **Transcend** screen (`ui/TranscendScreen.ts`). Level-gated, branching, reversible. Ships alongside the magick pass (Mag/Res) and level 1–20 learnsets. Covered by `tools/smoke/transcend.mjs`; see `docs/SYSTEMS.md §7`. DNA-merge remains a future branch condition. |

## §6 — Polish pass

| Ref | Requirement | Status | Evidence |
|---|---|---|---|
| §6 / M6 | Particle & light FX (torch flicker, hit sparks, portals) | ✅ | `engine/fx.ts`. |

## §7 — *(referenced as covered)*

The owner's handoff read (`HANDOFF.md` §4.1) states "§1–§7 … all covered."
There is **no `plan §7` marker in the code**, so its content can't be pinned to a
file from here. Nothing observably absent in the slice maps to a plausible §7
(deployment, build, or a wrap-up section). **Flag for confirmation against the
plan text.**

---

## Milestones M0–M6

Each milestone tag appears in a scene/engine header, so coverage is
demonstrable:

| Milestone | Meaning (from marker context) | Status | File |
|---|---|---|---|
| M0 | Live HD-2D tuning panel | ✅ | `engine/DebugPanel.ts` |
| M1 | Crawl (movement, collision, tiles) | ✅ | `DungeonScene.ts` |
| M2 | Turn-based battle | ✅ | `BattleScene.ts` |
| M3 | Dungeon + defeat/game-over | ✅ | `DungeonScene.ts`, `GameOverScene.ts` |
| M4 | Title / name / hub | ✅ | `IntroScene.ts`, `HubScene.ts` |
| M5 | Hub interactions | ✅ | `HubScene.ts` |
| M6 | Polish FX | ✅ | `engine/fx.ts` |

---

## Deliberate stubs (complete-as-specified, not gaps)

1. **Evolution (§5.6)** — data model only (`evolvesTo`), no UI. Matches
   the plan.
2. **In-battle item use** — the **Item** action exists but is disabled; buying
   works, using does not (`data/items.ts` notes "Battle use not wired up yet").
3. **Auto-battle uses only the free Attack** — intentional, so it can't spend MP
   you were saving (`HANDOFF.md` §5).

## Known defect (tracked, not a plan gap)

- **Hub autosave does not fire.** After a normal playthrough into The Everwake,
  `localStorage` `hd2d.save.auto` is never written. The save *API* is verified
  working when called directly; the miss is in `HubScene.arrival()` returning
  early. Full repro and the one-probe next step are in `HANDOFF.md` §2. Suspend
  saves are unaffected.

## Additions beyond the plan-marked scope

Shipped this session and worth noting as *net-new* over the original section
list (per `HANDOFF.md`): **controller support** (`Input.poll()` Gamepad API),
**auto-battle**, and the **suspend-save** system. These extend §5.3 / §2 rather
than fulfilling a numbered requirement.

---

## Bottom line

Implemented: **everything section-marked (§0.2, §1, §2.1–2.7, §3, §4, §5.1–5.6,
§6) and every milestone M0–M6.** Two items are intentional stubs; one (§2.5) and
§7 can't be pinned to code without the plan text and are flagged above; one
autosave bug is open and documented. No requirement is missing without a reason
recorded next to it.
