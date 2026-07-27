# PixelLab sprite tooling

Turns a text idea into an on-roster creature sprite. **Nothing here is wired
into the game and no PNG is committed** — the deliverable is a
`{ palette, rows }` map for `src/assets/art.ts` (the repo stays asset-free).
The end-to-end rule lives in [`docs/adding-monsters.md`](../../docs/adding-monsters.md).

## Files

- **`monsters.mjs`** — the registry. Each monster is `{ palette, size, prompt }`.
  Evolution lines are expanded from the standardized `STAGES` ladder
  (Wisp → Shade → Revenant → Beyond) via `line()`; one-off monsters get a
  single hand-written prompt. Add a monster here.
- **`generate.mjs`** — `MONSTER=<id> node generate.mjs` → calls the PixelLab
  pixflux API (forced palette + shared style options) → `out/<id>.png`.
- **`png-to-pixelart.mjs`** — `MONSTER=<id> node png-to-pixelart.mjs [size]` →
  decodes/downscales and derives an adaptive palette via median-cut (up to
  `COLORS`, default 48) → `out/<id>.art.txt` (paste-ready literal) +
  `out/<id>-pixelart.png` (preview).

## Run it

Needs `PIXEL_LAB_API_KEY`. Node 18+ (global `fetch`), no dependencies.

```bash
PIXEL_LAB_API_KEY=... MONSTER=lastlight node tools/pixellab/generate.mjs
MONSTER=lastlight node tools/pixellab/png-to-pixelart.mjs 24
open out/lastlight-pixelart.png
```

## Run it in CI

The **`pixellab-nightnip.yml`** workflow (*PixelLab — monster sprites*) runs
both steps on manual dispatch (pick `monster` + `target`) or on push to the
working branch, reading `PIXEL_LAB_API_KEY` from repository secrets, and uploads
`out/` as the **`pixellab-sprites`** artifact.
