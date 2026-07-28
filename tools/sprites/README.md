# tools/sprites

The no-API way to author creature sprites, in code, as `{ palette, rows }`
PixelArt. Zero dependencies (Node built-ins only). Full recipe and rationale:
[docs/procedural-sprites.md](../../docs/procedural-sprites.md).

```bash
node tools/sprites/build.mjs            # render all -> tools/sprites/out/
node tools/sprites/build.mjs tideling   # just one
```

- `out/<id>.png` — preview to eyeball (git-ignored, never committed).
- `out/<id>.art.txt` — the `{ palette, rows }` block to paste into
  `src/assets/art.ts`.

Add a creature by writing a builder in `creatures.mjs` and registering it in
the `CREATURES` map. Keep it ~64px tall to match the roster.
