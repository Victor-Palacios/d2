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
(`DW2firsthourHD2Dplan.md`, uploaded by the owner — **not in the repo**, ask them
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
| Full slice | title → name → hub → world map → 3-floor Boot Domain → boss → licence → Guard Team → rival → shop → Mission 2 hook |
| HD-2D rig | shared by crawl and battle; every parameter live-tunable via `` ` `` |
| 3v3 battle | speed order, Attack/Technique/Guard/Auto, class + element multipliers, enemy AI |
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
- Still worth having on hand: the original plan doc `DW2firsthourHD2Dplan.md` is
  **not in the repo** — ask the owner for it if you need to confirm the audit in
  `docs/PLAN_AUDIT.md` against the source text.

---

## 4. Requested docs — delivered

The four items the owner asked for are written and live in [`docs/`](docs/):

1. **Plan audit** — [`docs/PLAN_AUDIT.md`](docs/PLAN_AUDIT.md): the original plan
   walked section by section (reconstructed from the `plan §…` markers in the
   code, since the plan doc itself isn't in the repo), implemented / partial /
   missing.
2. **Roadmap** — [`docs/ROADMAP.md`](docs/ROADMAP.md): a path toward *Digimon
   World 2*'s first ~5 hours (XP loop, recruiting, digivolution, more domains).
3. **Scope trim (five elements → three)** — folded into the roadmap as the first,
   cheapest task, with rationale and an exact edit list.
4. **Systems explainer** — [`docs/SYSTEMS.md`](docs/SYSTEMS.md): types, class
   advantage, damage, guard, EP and rewards with worked numbers.

**Next actual build work** (all code) is the roadmap's M7 onward — start with the
element trim and the XP/level loop. Nothing from the original doc-request list is
outstanding.

---

## 5. Design decisions worth not re-litigating

- **Classes were renamed this session** from Alpha/Beta/Gamma to
  **Assassin > Mage > Hero > Assassin** at the owner's request. Species were also
  re-assigned so the class matches the sprite (the armoured knight is a Hero, the
  wolf an Assassin). The borrowed tutorial trio is deliberately one of each
  class, and the boss is a Hero countered by the party's Mage — the mentor's
  hint text depends on that, so re-balancing classes means re-checking
  `src/data/bootDomain.ts` dialogue.
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

`window.hd2dGame` exposes `{ manager, hd2d, game, debug, stats, saves }` —
current scene and live scene instance, every HD-2D parameter, the run state, a
frame counter, and the save API. It is what the smoke tests drive, and it is the
fastest way to reproduce anything without replaying the slice.

```js
hd2dGame.game.floorIndex = 2;            // jump to the boss floor
await hd2dGame.manager.go('dungeon');
hd2dGame.hd2d.params.supersample = 1;    // then hd2d.applyParams()
```
