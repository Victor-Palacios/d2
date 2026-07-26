# PixelLab sprite staging

Ad-hoc tooling for generating creature sprites with the
[PixelLab API](https://www.pixellab.ai/pixellab-api). **Nothing here is wired
into the game.** It writes candidate art to `out/` (git-ignored) so we can
review sprites *before* deciding whether to hand-convert them into the
`{ palette, rows }` form in `src/assets/art.ts`. The repo stays asset-free —
no generated PNG is committed.

## `evolve.mjs` — standardized evolution stages

Every creature evolves through the same four-stage ladder:

| stage | role | look |
| ----- | ---- | ---- |
| **Wisp** | rookie (lowest) | small, round, chibi — cute but on-theme |
| **Shade** | middle | lean, upright, mildly menacing |
| **Revenant** | advanced | gaunt towering demon |
| **Beyond** | ultimate | colossal, ornate, godlike final form |

Each prompt is composed the same way so a line stays visually consistent:

```
<STAGE vibe> , <CREATURE theme> , <shared STYLE> , <STAGE tone>
```

- **`STAGES`** hold the stage vibe/tone/size/detail and are creature-agnostic —
  reuse them for any line.
- **`CREATURES`** hold the recurring motif + a forced palette (Nightnip: its
  canonical 5 colours from `art.ts`), so every stage shares colours.

### Run it

Needs `PIXEL_LAB_API_KEY`. Node 18+ (global `fetch`), no dependencies.

```bash
PIXEL_LAB_API_KEY=... CREATURE=nightnip STAGE=wisp node tools/pixellab/evolve.mjs
open out/nightnip-wisp.html
```

Produces `out/<creature>-<stage>.png` (transparent) and a preview `.html`.
`FORCE_PALETTE=0` lets PixelLab pick colours instead of the forced palette.

### Run it in CI

The **`pixellab-nightnip.yml`** workflow runs this on the
`claude/monster-creation-management-x9x72z` branch and on manual dispatch
(where you pick `creature` and `stage`), reading `PIXEL_LAB_API_KEY` from
repository secrets. The result is uploaded as the **`pixellab-sprites`**
artifact — download it, unzip, open the `.html`.
