# Adding a monster (sprite workflow)

The rule for creating a new creature sprite, end to end. It turns a text idea
into an on-roster sprite in the game, using the PixelLab API for generation but
keeping the repo **asset-free** — the sprite ships as a hand-format
`{ palette, rows }` pixel map in `src/assets/art.ts`, never as a binary file.

Tooling lives in [`tools/pixellab/`](../tools/pixellab/); the API key is the
`PIXEL_LAB_API_KEY` GitHub Actions secret.

## The pipeline

```
define spec  →  generate (CI)  →  convert  →  review  →  integrate  →  build & ship
 monsters.mjs   PixelLab pixflux   PNG→rows    preview    art.ts + …    tsc+vite → Pages
```

### 1. Define the monster in the registry

Add an entry to `MONSTERS` in `tools/pixellab/monsters.mjs`:
`{ palette: string[], size: number, prompt: string }`.

- **palette** — a small (≤6) on-brand hex set. It is *forced* on the API and
  reused to snap the sprite back to clean colours, so the whole line stays
  on-palette. Reuse an existing creature's palette to slot into that family.
- **size** — square generation size; 48–64 is the sweet spot.
- **prompt** — see the prompt rule below.

An evolution line uses the `line(id, theme, palette)` helper, which composes
one prompt per stage from the standardized ladder **Wisp → Shade → Revenant →
Beyond** (`STAGES`). A one-off monster gets a single hand-written `prompt`.

### 2. The prompt rule

Every prompt is composed in this fixed order so sprites read as one roster:

```
<subject + silhouette/size> , <distinctive features> , <STYLE> , <tone clause>
```

- `STYLE` is the shared constant: `clean single-color black outline, flat
  shading, front view, symmetrical`.
- The tone clause ends with `... dark-fantasy RPG <role> sprite` (e.g.
  *cute charming … creature*, *evil … boss monster*).
- The generator always also sends these pixflux fields: `outline: "single
  color black outline"`, `shading: "flat shading"`, `detail: "low detail"`,
  `direction: "south"`, `no_background: true`, and the forced palette as a
  `color_image` swatch. Keep colour words out of the prompt — the palette
  enforces colour.

### 3. Generate (in CI)

Run the **PixelLab — monster sprites** workflow → *Run workflow* → set
`monster` to your id (and optional `target` downscale). A push to the working
branch also runs it for the default monster. The run produces the
**`pixellab-sprites`** artifact containing:

- `out/<id>.png` — the raw sprite
- `out/<id>.art.txt` — the ready-to-paste `{ palette, rows }` literal
- `out/<id>-pixelart.png` — a scaled preview of the converted sprite

To run locally instead:

```bash
PIXEL_LAB_API_KEY=... MONSTER=<id> node tools/pixellab/generate.mjs
MONSTER=<id> node tools/pixellab/png-to-pixelart.mjs 24   # target size
```

### 4. Convert & review

`png-to-pixelart.mjs` decodes the PNG, downscales (default 24×24), and snaps
each pixel to the registry palette. **Look at the preview** — if the downscale
muddied key features (small bright eyes, highlights), bump the target size or
hand-touch a few characters in the literal. 16px suits simple rookies; 24px
keeps small details.

### 5. Integrate into the game

- Paste the `art.txt` block into `CREATURES` in `src/assets/art.ts` under the
  creature's art key. (Reskinning an existing creature? Replace that key's
  entry — e.g. Nightnip's key is `bat`.)
- For a **new** creature, also register a `Species` in `src/data/creatures.ts`
  (`art` must match the key) and, if it should appear, add it to an encounter
  table in a domain file (`src/data/*Domain.ts` etc.). See
  [README.md](../README.md) and `src/data/creatures.ts`.

### 6. Build & ship

`npm run build` (runs `tsc --noEmit` then `vite build`) **must pass** — a green
build is what keeps the Pages deploy from shipping broken. Then commit and push
to `main`; the push deploys the live game.

## Guardrails

- **Asset-free.** Never commit the generated PNG. Only the `{ palette, rows }`
  literal (text) goes into `src/`. `out/` is git-ignored.
- **No copyrighted characters.** Prompts describe an original creature; don't
  name or reproduce another game's characters or art (see `art.ts` header).
- **Palette discipline.** Snap to a small on-brand palette so new sprites match
  the existing roster instead of importing an off-key colour set.
