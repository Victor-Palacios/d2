# Smoke tests

Playwright scripts that drive the **built** game in a real browser. They exist
because typechecking this project proves very little — every bug found so far
(scene softlock, dropped inputs, invisible shadows, a menu that cancelled
itself) was only visible by actually playing it.

## Running

```bash
npm run build
npm run preview            # serves on :4173 by default
npm i -D playwright        # not a project dependency; install ad hoc

URL=http://localhost:4173/ node tools/smoke/save.mjs
```

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
| `autosave.mjs` | Focused check that the hub autosave writes (see the known bug in `HANDOFF.md`) |

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
