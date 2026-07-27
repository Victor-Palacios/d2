# Adding a monster (sprite workflow)

The rule for creating a new creature sprite, end to end. It turns a text idea
into an on-roster sprite in the game, using the PixelLab API for generation but
keeping the repo **asset-free** — the sprite ships as a hand-format
`{ palette, rows }` pixel map in `src/assets/art.ts`, never as a binary file.

Tooling lives in [`tools/pixellab/`](../tools/pixellab/); the API key is the
`PIXEL_LAB_API_KEY` GitHub Actions secret.

## Standing rules

- **Generate everything at 64px.** All new/regenerated art is produced *and*
  converted at 64×64 (`SIZE` in `monsters.mjs`). We are migrating the whole
  roster to PixelLab sprites at this size, so 64px is the standard — do not
  hand-pick smaller sizes for new work.
- **The registry is the canonical prompt record.** Every monster's exact
  prompt + palette lives in `tools/pixellab/monsters.mjs`. Never generate from
  an ad-hoc prompt that isn't recorded there — if you try a prompt, add it as a
  registry entry so anyone can later see how a monster was generated.
- **Wisp-stage / rookie sprites must be cute or charming.** The lowest form of
  any creature (the `wisp` stage, and one-off rookies) must read as an
  endearing little mascot — never generic, realistic, or scary. Its prompt must
  use the cute-creature recipe below and end in the `cute charming … creature`
  tone. (Middle/advanced stages and bosses may be cooler or more menacing.)

## The pipeline

```
define spec  →  generate (CI)  →  convert  →  review  →  integrate  →  build & ship
 monsters.mjs   PixelLab pixflux   PNG→rows    preview    art.ts + …    tsc+vite → Pages
```

### 1. Define the monster in the registry

Add an entry to `MONSTERS` in `tools/pixellab/monsters.mjs`:
`{ palette: string[], size: number, prompt: string }`.

- **palette** — a small (≤6) on-brand hex set, used as a colour *hint* forced
  on the API so the render stays on-brand. The final sprite palette is derived
  adaptively by the converter (up to ~48 colours), so this is a hint, not the
  output palette. Reuse a related creature's hint to keep a family cohesive.
- **size** — square generation size; **64px** is the standard (see `SIZE`).
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

#### The cute-creature recipe (house style)

This is what makes a sprite read as a charming little creature instead of a
generic or too-real object. Required for rookies/Wisp stages; use it as the
default everywhere except deliberately menacing bosses.

1. **Frame it as a *creature*, not the literal object.** Say "a cute round
   beetle-creature", not "a bug/pest"; "a creature with a metal shell", not "a
   robot". Object nouns (robot, lantern, golem, suit of armour) and animal/pest
   nouns (bug, beetle, wolf) make the model render something realistic.
2. **Give it big expressive eyes and a tiny face.** This is the single biggest
   mascot signal. Never substitute "an optic/lens" or leave the face out.
3. **Make the material a surface, not the identity.** "a smooth metal shell",
   "a crystalline body", "a mossy stone body" — a round body wearing the
   material, not a body *made of hard parts* ("boxy", "plating", "boulder").
4. **Round, soft silhouette** + a short **personality** ("shy and gentle",
   "plucky and earnest").
5. **End with `cute charming dark-fantasy RPG creature sprite`.**

Avoid: "boxy", "optic/lens", "pest", "mechanical/robot", "realistic",
anatomical part lists (legs + antennae + mandibles). Those pull toward
realism.

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

`png-to-pixelart.mjs` decodes the PNG, downscales (default **64×64**, the
standard), and derives an **adaptive palette via median-cut** — up to `COLORS`
(default **48**) colours, but fewer when the image has few real hues. Keys stay
within the 62 clean alphanumeric characters, so the literal is always valid.
**Look at the preview** — if a feature dropped out, raise `COLORS` or
hand-touch a few characters in the literal.

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
- **Palette discipline.** Use the palette hint to keep the render on-brand; the
  converter's adaptive median-cut then keeps colour counts sane (≤48, clean
  alphanumeric keys) so sprites stay tidy instead of importing hundreds of colours.
