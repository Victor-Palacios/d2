# CLAUDE.md

Guidance for AI agents (and humans) working in this repo. Read
[README.md](README.md) for what the project is and how to run it, and
[HANDOFF.md](HANDOFF.md) for current state and hard-won gotchas.

## Git workflow — IMPORTANT

- **Work directly on `main`. Do NOT create branches.** `main` is the default
  branch and what GitHub Pages deploys from. Commit and push straight to
  `main`; do not open feature branches or PRs unless the owner explicitly asks.
- Push with `git push -u origin main`.
- Every push to `main` triggers the Pages deploy
  (`.github/workflows/deploy-pages.yml`). Keep `main` green: `npm run build`
  runs `tsc --noEmit` first, so a type error fails the deploy rather than
  shipping a broken bundle. Build before you push.

## Build & test

```bash
npm install
npm run dev        # local dev server
npm run build      # tsc --noEmit + vite build  (run before every push)
```

Smoke tests drive the built game in a real browser (see
[tools/smoke/README.md](tools/smoke/README.md)). Typechecking proves little
here — behaviour bugs only show up when the game actually runs:

```bash
npm run build && npm run preview          # serves on :4173
npm i -D playwright                        # ad hoc, not a project dependency
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

## Adding a monster

Creating a new creature sprite follows a fixed workflow — define it in the
`tools/pixellab/` registry, generate via the PixelLab CI workflow, convert the
PNG into a `{ palette, rows }` map, and paste that into `src/assets/art.ts`
(never commit the PNG — the repo stays asset-free). The full rule, including how
to write the prompt, is in [docs/adding-monsters.md](docs/adding-monsters.md).
