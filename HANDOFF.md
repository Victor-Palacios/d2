# Handoff

Written for whoever picks this up next. Covers where the project stands, the one
bug left mid-investigation, what the owner asked for that is still unbuilt, and
the environment traps that will otherwise waste your first hour.

**Repo:** `Victor-Palacios/d2` · **Working branch:** `main` · **Live:**
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
| GitHub Pages | deploys on push via `.github/workflows/deploy-pages.yml` |

### Known bug — hub autosave does not fire

**Symptom:** after a normal playthrough into Digital City, `localStorage`
`hd2d.save.auto` is never written, so the title screen offers no "Continue"
unless a *suspend* save exists.

**Not the cause:** the save API itself is fine. Called straight from the console
it returns `true` and the entry appears:

```js
hd2dGame.game.set('prologueDone');
hd2dGame.saves.saveAuto('hub', 'Digital City');   // → true, localStorage written
```

**Where it is:** `HubScene.arrival()` (`src/scenes/HubScene.ts`, ~line 200) runs
detached and ends with the autosave call. Something returns before it. The two
candidates are the `if (this.disposed) return;` guards added late in the session,
or `arrival()` never completing its dialogue await.

**Next step:** `tools/smoke/autosave.mjs` already plays into the hub and dwells.
Add a probe for `manager.activeScene.disposed`, `.busy`, and
`game.has('prologueDone')` at that moment — that will pin it in one run. I was
one probe away when the session ended.

**Note:** the suspend save is unaffected and fully working; this is autosave only.

---

## 3. Waiting on the owner

**The default branch is still `claude/new-session-r77q12`.** `main` has all the
work and is what to push to, but the repo default was never flipped, and this is
not cosmetic:

- The `github-pages` environment pins deployments to the default branch, so a
  push to `main` produces a `deploy` job that fails having run **zero steps** —
  an environment rejection, not a build failure. The build job succeeds and
  uploads the artifact; only publishing is blocked.
- Fix: **Settings → Branches → default = `main`**, or
  `gh api -X PATCH repos/Victor-Palacios/d2 -f default_branch=main`. Then delete
  the old branch.
- The workflow already accepts both `main` and the default branch, so nothing in
  CI needs changing afterwards.

This needs repo-admin rights, which neither the Actions token nor the session's
GitHub integration has. Same wall as enabling Pages (which the owner has now
done).

---

## 4. Requested but not built

The owner asked for these, in this order, before the session ran out. Three of
four are documents.

1. **Audit the original plan** — walk `DW2firsthourHD2Dplan.md` section by
   section and report implemented / partial / missing. My read is that §1–§7 and
   milestones M0–M6 are all covered, with §5.6 (digivolution) deliberately a
   data stub (`canDigivolveTo` on each species, no UI) exactly as the plan
   specifies — but this was never written up properly.
2. **A roadmap MD** for extending toward *Digimon World 2*'s first ~5 hours.
3. **Trim scope while doing it** — they explicitly want **fewer element types**
   (currently five: Water/Fire/Nature/Machine/Dark). Worth folding into the
   roadmap: three elements would halve the plate art, the technique table and
   the teaching load, and would pair cleanly with the three-class triangle.
4. **A systems explainer MD** — how types, advantage, damage, guard, EP and
   rewards actually play out, with worked numbers. Source of truth is
   `src/systems/battle/formula.ts` and `src/data/elements.ts`.

Task list state at handoff: #1 controller and #2 saves done (bar the bug above);
#3 audit, #4 roadmap, #5 systems doc not started.

**Update:** #3, #4 and #5 are now written and live in [`docs/`](docs/) —
[`PLAN_AUDIT.md`](docs/PLAN_AUDIT.md) (§4.1), [`ROADMAP.md`](docs/ROADMAP.md)
(§4.2, with the element trim from §4.3 folded in as the first task) and
[`SYSTEMS.md`](docs/SYSTEMS.md) (§4.4). The autosave bug above and the
default-branch flip (§3) are still open.

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
