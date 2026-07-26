# PixelLab sprite staging

Ad-hoc tooling for generating creature sprites with the
[PixelLab API](https://www.pixellab.ai/pixellab-api). **Nothing here is wired
into the game.** It writes candidate art to `out/` (git-ignored) so we can
review a reimagining *before* deciding whether to hand-convert it into the
`{ palette, rows }` form in `src/assets/art.ts`. The repo stays asset-free —
no generated PNG is committed.

## `reimagine-nightnip.mjs`

Reimagines **Nightnip** (impish bat rookie, assassin / dark) via the pixflux
text-to-image endpoint, forcing the sprite's real 5-colour palette so it stays
on-brand. Produces:

- `out/nightnip-pixellab.png` — the generated sprite (transparent background)
- `out/preview.html` — original 16×16 beside the PixelLab render

### Run it

Needs `PIXEL_LAB_API_KEY`. Node 18+ (global `fetch`), no dependencies.

```bash
PIXEL_LAB_API_KEY=... node tools/pixellab/reimagine-nightnip.mjs
open out/preview.html
```

`SIZE=32` gets closer to a 16×16 drop-in; the default `SIZE=64` is more
detailed. Edit `DESCRIPTION` / `PALETTE` in the script to retune.

### Run it in CI

The **`pixellab-nightnip`** workflow (`.github/workflows/`) runs this on the
`claude/monster-creation-management-x9x72z` branch and on manual dispatch,
reading `PIXEL_LAB_API_KEY` from repository secrets. The result is uploaded as
the **`nightnip-pixellab`** build artifact — download it from the workflow run
to review, then unzip and open `preview.html`.
