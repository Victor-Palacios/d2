# CLAUDE.md

Guidance for AI agents (and humans) working in this repo. Read
[README.md](README.md) for what the project is and how to run it, and
[HANDOFF.md](HANDOFF.md) for current state and hard-won gotchas.

## Git workflow — IMPORTANT

- **Work directly on `main`. Do NOT create branches.** `main` is the default
  branch and what GitHub Pages deploys from. Commit and push straight to
  `main`; do not open feature branches or PRs unless the owner explicitly asks.
- Push with `git push -u origin main`.
- **The Pages deploy is now gated on CI.** A push to `main` runs the `CI`
  workflow (typecheck · lint · unit tests · naming guard · build · a reliable
  smoke subset); `deploy-pages.yml` only publishes a commit for which CI
  **succeeded** (`workflow_run`). So a lint/test/smoke failure no longer ships —
  but it does land on `main` (the deployed branch) until the next green push, so
  still keep `main` green: run the full local gate before every push.

## Naming — IMPORTANT

The crawlable areas are **reaches**, never "domains", and the tutorial area is
**The Quiet Crossing**, never "boot" / "Boot Domain". These words were renamed
out of the whole project on purpose — do not reintroduce them in code,
identifiers, comments, docs, dialogue, or commit messages.

- Areas: type `Reach`, registry `REACHES` / `REACH_ORDER` in
  `src/data/reaches.ts`; ids are `crossing` / `crystal` / `jungle` / `haunted`;
  clear flags are `crossingCleared` etc.
- The only legitimate substring in the tree is the `boots` sprite-colour field in
  `src/assets/art.ts` — that one is fine.
- A guard enforces this: run **`npm run check:naming`** before you push (it is
  also a CI job, `.github/workflows/naming-guard.yml`, that fails on any push
  reintroducing the banned words). This file is the one place the words may
  appear, so the guard skips it.

## Build & test

```bash
npm install
npm run dev          # local dev server
npm run typecheck    # tsc --noEmit
npm run test         # vitest — unit tests for the headless game logic
npm run lint         # biome — lint + format check (no writes)
npm run format       # biome — apply formatting
npm run check:naming # the "reach" naming guard (see above)
npm run build        # tsc --noEmit + vite build  (run before every push)
```

**Before every push, keep `main` green:** `npm run typecheck && npm run lint &&
npm run test && npm run check:naming && npm run build`. CI
(`.github/workflows/ci.yml`) runs the same gate on every push and PR; the deploy
and naming-guard workflows run alongside it.

Unit tests (`vitest`) cover the pure logic — the battle model, damage maths and
progression in `src/systems/`. They stay fast and hermetic because the battle
engine takes an **injected `rng`** (see `Battle`/`computeDamage`), so fights are
fully reproducible. **Never call `Math.random()` directly inside `src/systems/`
— thread `rng` through** so the logic stays deterministic and testable.

Smoke tests drive the *built* game in a real browser (see
[tools/smoke/README.md](tools/smoke/README.md)) and catch what unit tests and
typechecking cannot — behaviour bugs only show up when the game actually runs:

```bash
npm install                               # playwright is a pinned devDependency
npm run build && npm run preview          # serves on :4173
URL=http://localhost:4173/ node tools/smoke/save.mjs
```

## Traps that will bite you

- **Never `pkill` from a Bash tool call** — it can kill your own shell
  (exit 144) and lose work. Start preview servers on a fresh `--port` instead
  of killing the old one.
- **No GPU here.** Headless Chromium falls back to SwiftShader (~0.3 fps with
  the full post stack). Smoke tests strip the post stack to hit ~26 fps.
- **A scene's `enter()` must never await player input**, and detached work must
  check `this.disposed`. See HANDOFF.md §6 for the full invariant list.
- **Keep the repo asset-free** — every sprite/sound is generated procedurally in
  code. No binary assets (plan §0.2).

## Where things live

Source layout, the HD-2D recipe, the debug panel and the asset-swap points are
all documented in [README.md](README.md). Battle maths, the plan audit and the
roadmap are in [docs/](docs/).
