# Handoff

Written for whoever picks this up next. Covers where the project stands, what
has recently been resolved, what is left to build, and the environment traps
that will otherwise waste your first hour.

**Repo:** `Victor-Palacios/d2` · **Default & working branch:** `main` (work
directly on it — see [CLAUDE.md](CLAUDE.md)) · **Live:**
https://victor-palacios.github.io/d2/

---

## 1. What this is

A browser dungeon-crawler RPG vertical slice built to a supplied plan
(the owner's uploaded plan doc — **not in the repo**, ask them
for it). It reproduces the shape of a PS1-era dungeon-crawler's opening hour in
the Square-Enix "HD-2D" style: pixel-art billboards inside a real 3D world, one
shadow-casting point light, bloom + DOF + tilt-shift post stack.

`README.md` covers how to run it, the controls, the HD-2D recipe and where to
swap assets. Read that first; this file is only the delta.

Everything visual and audible is generated procedurally at runtime — there are
no binary assets in the repo, by design (the plan forbids ripped/copyrighted
content). Keep it that way.

---

## 2. State of play

### Done and verified in a browser

| Feature | Notes |
|---|---|
| Full slice | title → name → hub → world map → 3-floor Quiet Crossing → boss → licence → Guard Team → rival → shop → Mission 2 hook |
| HD-2D rig | shared by crawl and battle; every parameter live-tunable via `` ` `` |
| 3v3 grid battle | formation/cover, Boost, Break, field pulse, class + element multipliers, softmax AI — **plus the layered systems added this session**: melee-reach, elemental reactions, break-chains, Commune (see §9 and [docs/SYSTEMS.md](docs/SYSTEMS.md) §9) |
| Auto-battle | basic Attack only, weakest target, Esc to stop; verified it spends **no MP** over 14 s hands-off |
| Controller | Gamepad API polled in `Input.poll()`; verified with a synthetic pad |
| Suspend save | verified across three page reloads, and that loading **consumes** it |
| Autosave | **verified** — writes on hub arrival and world map (`tools/smoke/autosave.mjs` passes; see resolved note below) |
| Dialogue auto-read | ▶ button (top-right of the box) toggles hands-free advance; **Esc** stops it. `src/ui/DialogueBox.ts` |
| GitHub Pages | deploys on push to `main` via `.github/workflows/deploy-pages.yml` |

### Resolved — the "hub autosave does not fire" bug was a test race, not a game bug

A full play-through **does** write `hd2d.save.auto`. The earlier symptom came
from the smoke tests, not the game: `HubScene.arrival()` opens with
`await sleep(280)`, during which the scene is already `'hub'` but no dialogue is
up and `busy` is still `false`. The old test loops broke on
"`scene === 'hub' && !dialogue`" in exactly that window, so they stopped
advancing (or jumped to the dungeon) before `arrival()` reached its autosave
call — and then reported `auto:false`.

Fix was in the tests, not the game (game code was correct all along):
`tools/smoke/autosave.mjs` and `save.mjs` now wait for arrival to actually
**start** (dialogue up or `busy` true) and then run it to idle before checking.
Both pass; `autosave.mjs` prints `VERDICT: PASS`. The general lesson is now
recorded in §6.

---

## 3. Owner items

- **Default branch flipped to `main`** ✅ (the old `claude/new-session-r77q12`
  default is gone). Work happens directly on `main` — no feature branches
  (see [CLAUDE.md](CLAUDE.md)).
- **Pages enabled** ✅ (done earlier).
- **⚠️ Pages still not publishing — one owner setting left.** A push to `main`
  now runs the **build** job to success and uploads the artifact, but the
  **deploy** job fails in ~1 s having run **zero steps** (its log 404s — nothing
  ran). That is the `github-pages` *environment* rejecting the deployment: its
  **deployment-branch policy** still doesn't permit `main` (flipping the repo
  default did not update the environment's own allow-list). Fix, owner-only:
  **Settings → Environments → `github-pages` → Deployment branches and tags →**
  set **"No restriction"**, or add `main` and drop the stale old-default entry.
  (Re-selecting Settings → Pages → Source: "GitHub Actions" also resets this.)
  Verified on run #8 for commit `95ad947`: build ✅, deploy ✗ (0 steps). CI itself
  needs no change.
- Still worth having on hand: the original plan doc (the owner's upload) is
  **not in the repo** — ask the owner for it if you need to confirm the audit in
  `docs/PLAN_AUDIT.md` against the source text.

---

## 4. Requested docs — delivered

The four items the owner asked for are written and live in [`docs/`](docs/)
(item 5, the audio guide, was added later alongside the jungle work):

1. **Plan audit** — [`docs/PLAN_AUDIT.md`](docs/PLAN_AUDIT.md): the original plan
   walked section by section (reconstructed from the `plan §…` markers in the
   code, since the plan doc itself isn't in the repo), implemented / partial /
   missing.
2. **Roadmap** — [`docs/ROADMAP.md`](docs/ROADMAP.md): a path toward a full
   monster-collecting crawler's first ~5 hours (XP loop, recruiting, evolution,
   more reaches).
3. **Scope trim (five elements → three)** — folded into the roadmap as the first,
   cheapest task, with rationale and an exact edit list.
4. **Systems explainer** — [`docs/SYSTEMS.md`](docs/SYSTEMS.md): types, class
   advantage, damage, guard, EP and rewards with worked numbers.
5. **Audio guide** — [`docs/audio.md`](docs/audio.md): how the procedural sound
   engine works and, step by step, how to add a music track and a randomised
   ambience layer (the jungle's birds are the reference).

**Next actual build work** (all code) is the roadmap's M7 onward. The **XP/level
loop is now done** (`grantXp`/`xpFromEnemy`, awarded in `BattleScene.onVictory`);
the cheapest remaining item is the **element trim** (five → three), which now
also drops reaction-pair names but is still a data edit, not a rebalance. Nothing
from the original doc-request list is outstanding.

---

## 5. Design decisions worth not re-litigating

- **Classes were renamed this session** from Alpha/Beta/Gamma to
  **Assassin > Mage > Hero > Assassin** at the owner's request. Species were also
  re-assigned so the class matches the sprite (the armoured knight is a Hero, the
  wolf an Assassin). The borrowed tutorial trio is deliberately one of each
  class, and the boss is a Hero countered by the party's Mage — the mentor's
  hint text depends on that, so re-balancing classes means re-checking
  `src/data/quietCrossing.ts` dialogue.
- **Auto-battle uses only the free Attack.** Not an oversight: leaving it on must
  never spend MP you were saving.
- **Suspend saves are consumed on load.** Also deliberate — it is a bookmark, not
  a checkpoint. If it could be reloaded, the out-of-EP tow penalty would stop
  meaning anything.
- **Saving is hub/world-map only** for the same reason.

## 6. Invariants that will bite you

These were each learned by shipping the bug first.

1. **A scene's `enter()` must never await player input.** `SceneManager.go()`
   awaits it; blocking there deadlocked the game-over screen into a softlock.
   Kick interactive flows off detached: `void this.run()`.
2. **Detached work must check `this.disposed`** before touching UI or state. The
   flag is on `GameScene` and set by the manager just before `exit()`. Without it
   a title-screen menu drew itself over a battle.
3. **`input.fire()` iterates a copy of the listener array.** Handlers routinely
   open a menu, which subscribes another listener — without the copy that new
   listener receives the very event that opened it, and the pause menu cancelled
   itself the instant Escape opened it.
4. **`SceneManager.go()` is queued, not dropped.** It used to no-op while busy,
   which silently swallowed transitions.
5. **Grid movement buffers input.** Taps that start and end between frames still
   register; a direction pressed mid-step is remembered.
6. **A scene matching is not a scene being ready** (testing gotcha). `arrival()`
   opens with `await sleep(280)`, so the scene reads `'hub'` while momentarily
   idle *before* its opening dialogue. Wait for arrival to actually start
   (dialogue up or `busy` true) then run it to idle — otherwise you race past it.
   This is what made autosave look broken (see §2). Also: `input.onAction`/
   per-line UI state must be **line-local** — a completed line's `requestAnimation
   Frame` loop can otherwise be resurrected by the next line resetting a shared
   flag (bit the dialogue auto-advance mode until each line kept its own state).

## 7. Environment traps

- **No GPU here.** Chromium falls back to SwiftShader: ~0.3 fps at 720p with the
  full post stack. This is *not* a performance problem in the game — on any real
  GPU, including Apple Silicon and integrated Intel, it is fine. See
  `tools/smoke/README.md` for the cheap-render setup that makes logic tests
  usable (~26 fps).
- **The egress proxy blocks `github.io`** (`CONNECT tunnel failed, 403`) and
  parts of the GitHub API (`/repos/.../pages`, `/environments`). You can verify a
  deploy from the Actions API and the job log, but you cannot load the live page
  from inside the container. Say so rather than implying you checked it.
- **`pkill` from a Bash tool call can kill your own shell** (exit 144). Killing a
  background server that way lost a commit once.

## 8. Debug surface

`window.hd2dGame` exposes `{ manager, hd2d, game, debug, stats, saves, audio }` —
current scene and live scene instance, every HD-2D parameter, the run state, a
frame counter, the save API, and the audio engine (handy for auditioning monster
cries: `hd2dGame.audio.cry('regalion')` — see
[docs/monster-cries.md](docs/monster-cries.md)). It is what the smoke tests
drive, and it is the fastest way to reproduce anything without replaying the
slice.

```js
hd2dGame.game.floorIndex = 2;            // jump to the boss floor
await hd2dGame.manager.go('dungeon');
hd2dGame.hd2d.params.supersample = 1;    // then hd2d.applyParams()
```

---

## 9. Layered battle mechanics (added this session)

Six changes on top of the base 3v3 grid model — three refinements, three new
systems — each introduced to the player **one at a time across the three story
reaches** by a flag-gated tutorial. The numbers reference lives in
[`docs/SYSTEMS.md`](docs/SYSTEMS.md) §9; this section is the *how it's wired and
how to extend it* view. The whole battle model stays headless (no Three.js/DOM in
`systems/battle/`), per the ROADMAP invariant.

### What changed, and where

| Change | Kind | Lives in |
|---|---|---|
| All battle RNG through one injected `rng` (flee, enemy Boost, Last Light); a seeded `rng` in `BattleSceneParams` makes a whole fight reproducible | refinement | `engine.ts` (`rng` now public), `BattleScene.ts` |
| Melee is a data flag (`Technique.melee`), not `id==='strike'` — a class of physical moves get row modifiers + respect cover | refinement | `techniques.ts`, `engine.ts` `isMeleeTechnique`, `BattleHUD.ts` (tag + cover-aware targeting) |
| Enemy AI uses the grid (`chooseEnemyShift`) and times Boost spend (`shouldSpendBoost`) — both in the model | refinement | `engine.ts` |
| **Elemental reactions** — a hit marks a target; a different-element follow-up detonates (bonus dmg + faster Break) | new | `engine.ts` (`REACTION_*`, `activeMark`, `reactionName`), FX in `BattleScene.ts`, mark pip in `BattleHUD.ts` |
| **Break-chains** — hits on a Broken foe escalate the bonus and bank a Boost at the threshold | new | `engine.ts` (`CHAIN_*`, `Battler.chain`) |
| **Commune** — pacify a `communable` foe with words; it leaves play and is understood (claimed like a full Soul Syphon on victory) | new | `engine.ts` (`COMMUNE_*`, `Battler.pacified/commune`, `communeTargets`), `creatures.ts`/`creature.ts` (`communable`), `gameState.ts` (`understandSoul`), `BattleScene.ts` (`resolvePacify` + FX), `BattleHUD.ts` (action + meter) |

### The staged-tutorial pattern (how to add another)

`BattleScene.maybeTutorial()` runs once at the top of each fight (after the intro,
before the first round). It shows **at most one** lesson per fight, gated on
`game.flags` (persisted in saves), keyed by `game.activeReachId`:

- `crossing` → `tut.melee`  ·  `crystal` → `tut.reaction`  ·  `haunted` →
  `tut.breakChain`, then `tut.commune` (only once a `communable` foe is present).

To introduce a new mechanic slowly: pick a reach, add a `!game.has('tut.x')`
branch that `teach('tut.x', say('Halden', …))`. Order matters — earlier branches
win the single per-fight slot, so later mechanics naturally surface in later
fights. The mentor voice is `'Halden'`.

### How to extend each system

- **Make a technique melee:** set `melee: true` in `techniques.ts`. It then takes
  `VANGUARD/REAR_MELEE_DEALT` and can't hit a covered Rear foe. Nothing else needed.
- **Tune reactions:** `REACTION_MULT` / `REACTION_STAGGER` / `REACTION_TTL_ROUNDS`
  in `engine.ts`; add pair flavour in `REACTION_NAMES` (maths is uniform per pair).
- **Tune break-chains:** `CHAIN_STEP` / `CHAIN_DAMAGE_MAX` / `CHAIN_BOOST_AT`.
- **Make a species communable:** set `communable: true` in `creatures.ts`. It is
  copied onto the `CreatureInstance` in `makeCreature` (so the headless engine
  never imports the species table). Commune reward flows through the existing
  Soul Syphon: `resolvePacify` → `game.understandSoul` → `finalizeCaptures` on win.
- **Reproducible fight (tests):** pass `rng` in `BattleSceneParams` — every roll,
  including flee/Boost/Last Light, routes through `battle.rng`.

### Save / compatibility

- New `Battler` fields (`chain`, `reactionTag`, `commune`, `pacified`) are
  **per-battle only** — never serialized, rebuilt each fight in the constructor.
- `communable` on `CreatureInstance` is additive and defaults to `false`, so old
  saves load fine (party monsters aren't communable anyway).

### Smoke tests — and a navigation gotcha worth keeping

- [`tools/smoke/mechanics.mjs`](tools/smoke/README.md) asserts all six changes
  against the live engine; `grid.mjs` still covers the four base grid phases.
- **Both now launch the fight directly** — `manager.go('battle', { enemies,
  returnTo })` from the hub — instead of walking the crawl. The old keystroke
  navigation broke when the world map gained story gating (a locked card whose
  text matched the `.card` selector) and the floor layout shifted. Direct launch
  is immune to that churn; the crawl→battle **transition** is still covered by
  `walk.mjs` (verified passing). If you write a new engine smoke test, copy the
  direct-launch preamble from `mechanics.mjs`, not the old world-map click.

### Still open / natural next steps

- **Element trim (5→3)** now also collapses reaction-pair names — still a data
  edit (ROADMAP). Consider whether a 3-element reaction set wants richer effects
  (status per pair) rather than a uniform multiplier.
- More `communable` species beyond Wispling, and a per-species Commune difficulty
  (`COMMUNE_GAIN` is global today).
- Learn-technique-on-level-up (the one remaining M7 item) would let melee/ranged
  and element coverage grow with a monster.
