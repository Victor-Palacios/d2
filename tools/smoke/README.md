# Smoke tests

Playwright scripts that drive the **built** game in a real browser. They exist
because typechecking this project proves very little — every bug found so far
(scene softlock, dropped inputs, invisible shadows, a menu that cancelled
itself) was only visible by actually playing it.

## Running

```bash
npm install                # playwright is now a pinned devDependency
npm run build
npm run preview            # serves on :4173 by default

URL=http://localhost:4173/ node tools/smoke/save.mjs
```

Playwright is pinned in `devDependencies`, so `npm install` (or `npm ci`) is all
you need — no ad-hoc install. Chromium itself still comes from Playwright's own
download (or set `CHROME` to a system binary).

Environment variables:

| Var | Meaning |
|---|---|
| `URL` | Where the game is served (default `http://localhost:5199/`) |
| `OUT` | Screenshot directory (default `tools/smoke/shots`) |
| `CHROME` | Path to a Chromium binary; omit to use Playwright's own |

## The scripts

| Script | Covers |
|---|---|
| `walk.mjs` | Title → name entry → hub → world map → dungeon → tutorial fight → back to the crawl |
| `save.mjs` | Autosave, suspend save, Continue, and that a suspend save is **consumed** on load (three simulated sessions across page reloads) |
| `pad.mjs` | Controller support, using a synthetic standard-mapping gamepad injected via `addInitScript` |
| `hud.mjs` | Battle HUD screenshots — class-coloured borders, HP/MP meters, element-tinted techniques |
| `auras.mjs` | Per-monster battle auras (`src/data/battleFx.ts`): enters a first-dungeon fight and asserts every fielded species gets a signature aura, only the Warden carries a glow light, and the auras actively emit. Pumps `scene.update()` at a fixed dt so it holds on the GPU-less container (~1 fps). |
| `moveFx.mjs` | Per-move battle effects (`src/data/moveFx.ts`): drives one move of every delivery archetype (melee / bolt / nova / mend) through the real turn animation and asserts each fires its shaped FX, with the ranged bolt (trail + burst) out-sparking the plain heal. |
| `autosave.mjs` | Focused check that the hub autosave writes (arrival race, resolved) |
| `reaches.mjs` | World map → The Reliquary (floor + boss + clear) and, through the unlock chain, The Unremembered (floor); proves the reach registry, per-reach data/art/music, and the generic clear path. Boosts the party via the debug API so fights resolve deterministically (this checks flow, not balance). |
| `gates.mjs` | Story gating: on a fresh run only The Quiet Crossing is open; clearing it unlocks The Reliquary; clearing that unlocks both The Unremembered and the side-path Overgrowth. Reads the locked/open state of the world-map cards; no fights, so it is fast and deterministic. |
| `terrain.mjs` | Terrain uniqueness. Runs `validateReaches()` over every floor (rectangular rows, one start, reachable events/chests/portals, chest keys on C tiles, decor on walkable tiles); asserts each reach wears its expected terrain skins; then enters every floor (no combat) to confirm the grid + terrain textures + decor build in three.js. Fast and deterministic. |
| `capture.mjs` | Soul Syphon capture loop: R1 → Soul menu → Soularium; an encounter primes syphon to 50%, a hit captures at 100% and grants a free copy; the species logs in the dex. Boosts the party for a deterministic win. |
| `store.mjs` | Soul Store (summon a logged species, buy a party-slot upgrade) and Soul Sanctuary (bench a party member via R1 → Soul menu). Seeds a logged species + obols via the debug API. |
| `grid.mjs` | Grid battle system, all four phases against the live engine: formation cells + melee cover + row damage (A); AoE shapes, reposition, swap, plate-on-cell (B); the Boost gauge (C); Break/stagger, field pulse, and the smarter AI (D). Recruits an extra keeper first so the field cap allows three souls (see the field-cap note below). See [docs/battle-grid.md](../../docs/battle-grid.md). |
| `transcend.mjs` | Magick pass, learnsets and the evolution system against the live headless APIs: level-gated learnsets, the physical/magical (Off/Def vs Mag/Res) damage split, RES/MAG-blended heals, level-10 **branching** evolution with a refusal on ambiguous branches, exact **de-evolution**, the multi-stage Scrapmite→Cogling→Cogknight line, and a sweep that builds every species and resolves every evolution. No scene navigation, so it is fast and deterministic. |
| `transcend-fx.mjs` | The transcendence **cinematic** (`src/ui/TranscendCinematic.ts`) via `window.hd2dGame.playTranscend`: the overlay mounts with both forms (the new one starting as a white silhouette) plus the on-screen skip note, **Start** (keyboard mirror **E**) skips straight to the coloured reveal + caption ("… evolved into Regalion!"), a second press tears the overlay down, and de-evolution reads "returned to". Runs in an isolated host (not scene-driven), so it is fast and deterministic on the GPU-less box. |
| `mechanics.mjs` | The layered battle systems against the live engine: data-driven melee (row modifier + cover), elemental reactions (different-element follow-up detonates), break-chains (escalating bonus + a banked Boost), Commune (a communable foe is pacified and leaves play), and that the injected RNG + smarter AI (Boost timing, grid shifts) are exposed. See [docs/SYSTEMS.md](../../docs/SYSTEMS.md) §9. |
| `stages.mjs` | World-map per-stage level recommendation and the rebalanced progression curve (The Quiet Crossing Lv1 → The Reliquary Lv5 → The Unremembered Lv10). Reads the rendered cards + reach data; no fights, so it is fast and deterministic. |
| `flee.mjs` | The Run action escapes a non-boss fight back to the crawl without consuming the encounter. |
| `menu.mjs` | The grid main menu (R1 / E / Start) renders Party / Gear / Soularium / Sanctuary, and the formation editor repositions a fielded soul from the front line onto the Rear row (editing `game.formation`, not the party order). |
| `items.mjs` | The **Items** menu: the main menu offers an Items card that opens the bag; a Mending Balm heals the chosen soul and is consumed, a Light Shard refills the lantern and is consumed, and a no-effect item (Homing Ember) is listed but disabled. |
| `repeat.mjs` | The **Repeat** battle command: the action menu offers a Repeat item (disabled in round 1, enabled from round 2 once a command exists); it replays the actor's last player-chosen Technique when affordable, and falls back to a normal Attack when the MP is short or nothing was recorded. Drives the live menu, then asserts the replay/fallback logic on the scene. |
| `formation.mjs` | The formation editor end to end: the Party menu opens the 2×3 grid; grabbing the front-centre fighter and dropping it on the Rear moves that slot to row 1; a reserve swapped onto the grid becomes fielded; and a battle launched afterwards deploys every fighter into the saved cells (with one in the Rear). Proves the saved formation reaches combat. |
| `equip.mjs` | The keeper's kit is granted at the start and the Gear screen fits an Arm/Shroud/Memento into a soul's slot (moving it out of the bag). |
| `lastlight.mjs` | The Last Light grief encounter: Comfort → Let Go releases the soul, granting the next Immortality poem piece and a 20× EXP boon; twelve pieces unlock the Immortality Memento. |
| `midpoint.mjs` | The Act-II midpoint: clearing all three reaches triggers the unanswerable death (Halden) once — the Keeping fails, the player authors the farewell, and every philosophy hardens. |
| `jungle.mjs` | The Overgrowth's aftermath: clearing the jungle brings Liora Fen to the Everwake to cross; the player names the truth of her keeping and receives Liora's Step (a Memento). Fires once and does not trigger the midpoint. |
| `companions.mjs` | The keepers who join — and that they are field slots, not fighters. Wren joins at the Everwake, Sena Vale after the Reliquary, Kade after the Unremembered. Verifies each join fires; that `humanCount`/`fieldCap` climbs 2→3→4 as they join; that a launched battle fields souls only (no companion takes the field); the final roster is the four (starter + three companions); and a companion cannot be benched to the Sanctuary. |
| `finale.mjs` | The finale reach (The Last Lantern): gated on the midpoint (`actTwo`), its climax is a choice not a fight. Drives the 'let them cross' ending and asserts `ending:cross` / `gameComplete` / `lastLanternCleared`. |
| `anchored.mjs` | The Anchored (`src/data/anchored.ts`) — optional element super-encounters. Walks the crossing crawl onto The Unquenched's fire mass and proves the three guarantees: engaging does **not** consume the event (re-fightable after a loss/flee), the enemy roster is element-pure, victory consumes it once + grants its Memento + sets `anchored:crossing`, and a non-victory return consumes nothing. |
| `cries.mjs` | Monster battle cries (`audio.cry`): instruments the Web Audio graph to confirm each authored species voice (the starter trio plus every monster in The Quiet Crossing — Mitebug, Sprigling, Scrapmite, Gloomote, Dropletta and the warden Regalion) builds its oscillator layers and pitch glides, and that a species with no cry stays silent. Headless has no speakers, but the synth graph still schedules, so it is fast and deterministic. |

## Two environment traps that cost real time

**1. Software rendering is ~0.3 fps.** A headless container has no GPU, so
Chromium falls back to SwiftShader and the full post stack renders at a
slideshow. The game logic then crawls too, because `dt` is clamped at 0.05 —
a 0.19 s tile step needs four frames, so at 1 fps it takes four seconds.

Every logic test therefore starts by shrinking the viewport and stripping the
post stack, which gets the loop to ~26 fps:

```js
await page.evaluate(() => {
  const g = window.hd2dGame, p = g.hd2d.params;
  p.supersample = 0.35; p.dofEnabled = false; p.tiltEnabled = false; p.bloomEnabled = false;
  g.hd2d.renderer.shadowMap.enabled = false; g.hd2d.applyParams();
});
```

Use the full stack (1280×720, defaults) only for visual screenshots, and wait on
`window.hd2dGame.stats.frames` rather than wall-clock time.

**2. Waiting for a scene is not the same as waiting for it to be ready.**
Scenes run their opening beats detached, so `manager.current === 'hub'` can be
true while the arrival dialogue is still playing and input is ignored. Several
"bugs" in this suite were really the harness racing that. Always wait for
*idle* — scene matches, no dialogue open, `activeScene.busy` false — and
advance dialogue while you wait. `save.mjs` has the helper worth copying.

**3. The field cap is one soul per human keeper.** Battle deploys only your
souls (never companions), and only as many as you have humans (`game.fieldCap` —
two at the Quiet Crossing: you + Wren). A test that launches a fight and expects
three or four souls on the field must first recruit the extra keepers, e.g.
`g.game.joinCompanion({ ...clone, speciesId: 'senaVale', companion: true })`.
`grid.mjs` and `mechanics.mjs` do exactly this before launching.
