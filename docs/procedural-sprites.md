# Procedural creature sprites (the no-API path)

This is how we make creature sprites **now**. The repo is asset-free (plan
§0.2) — every sprite is generated in code as a `{ palette, rows }` PixelArt
(see `src/engine/pixel.ts`). This document is the reproducible recipe.

> **PixelLab is retired.** We no longer call the PixelLab API. Its sprites stay
> in `src/assets/art.ts` **for reference**, and its prompt registry stays in
> `tools/pixellab/` for reference, but nothing generates through it anymore
> (the scheduled GitHub Action and the daily ideation routine are gone). New
> creatures are authored with the tool described here.

## Where it lives

```
tools/sprites/
  compose.mjs      char-grid drawing kit (ellipse, rect, smooth, outlineSil, toArt)
  render.mjs       dependency-free PNG encoder + comparison-strip compositor
  creatures.mjs    shared recipe helpers + demo builders + a CREATURES registry
  boot-domain.mjs  the first-dungeon roster, keyed by art key (BOOT registry)
  build.mjs        CLI: render previews to out/ and emit pasteable { palette, rows }
  integrate.mjs    CLI: replace CREATURES[<artKey>] blocks in src/assets/art.ts
```

Everything is plain Node (`.mjs`), zero dependencies (Node's built-in `zlib`
does the PNG). `out/` is git-ignored — previews and `.art.txt` are never
committed, only the code that regenerates them.

## Run it

```bash
node tools/sprites/build.mjs            # all creatures -> tools/sprites/out/
node tools/sprites/build.mjs tideling   # just one
```

Each creature produces `out/<id>.png` (a preview to eyeball) and
`out/<id>.art.txt` (the `{ palette, rows }` block ready to paste).

## The recipe

What separates a "cute sticker" from a sprite that holds up next to the
reference set. Encoded in `creatures.mjs`:

1. **Full, face-forward body** — head + torso + limbs, not a floating blob.
2. **3-step tonal ramp** per material: a base colour, a shadow low/right, a
   highlight upper-left. Apply with `shadeInto()` so the ramp *clips to the
   body* instead of spilling past the edge. Flat fills read cheap; ramps read
   soft and rounded.
3. **Big glossy eyes**: white oval, a big dark pupil, and **two** sparkles (a
   large glint upper-left + a small one lower-right).
4. **Small muzzle.** An oversized cream muzzle reads as a beard and swallows
   the face. Keep it compact and separate it from any chest patch.
5. **Per-creature internal detail** — fur tufts, jelly bubbles + a rim glint,
   leaf veins. This is what the extra 64px of resolution buys you.
6. **Gentle asymmetry** — an off-centre gaze (`tilt` on `glossyEyes`), uneven
   limbs, a tail or accessory on one side. Dead-symmetric front views read as
   stiff mascots.
7. **Clean silhouette**: bake a contact shadow (palette key `'S'`), then
   `smooth()` + `outlineSil()`.

### Conventions

- **64px tall** to match the existing roster. Grid a little larger, `toArt()`
  trims the empty margins.
- Palette key `'S'` = the baked contact shadow; `'.'` = transparent; `'k'` =
  outline. `smooth()`/`outlineSil()` treat `'.'` and `'S'` as background so the
  shadow is never outlined.
- 10–16 colours is plenty. Colour *count* was never the gap vs the reference
  sprites (theirs use 4–6) — placement and silhouette are.

## The clean-silhouette pipeline (why the edges look right)

The naive `outline()` marks every transparent cell touching the body. On a
soft, stair-stepped edge that produces ragged, broken outlines and it also
outlines interior gaps. The replacement:

- `exterior(g)` — flood-fills background inward **from the border**, so
  interior holes are not mistaken for outside and never get outlined.
- `smooth(g)` — morphological cleanup: fill 1px exterior notches with a
  neighbour colour, then drop 1px spurs (body pixels barely attached). This
  removes the stair-step roughness *before* outlining.
- `outlineSil(g)` — outlines only the true exterior silhouette, and never
  paints over the contact shadow.

## Integrate a finished sprite

To **replace an existing art key** (redesign a creature already in the game):

```bash
node tools/sprites/integrate.mjs           # whole BOOT set
node tools/sprites/integrate.mjs lion bat   # specific keys
npm run build                               # tsc --noEmit + vite
```

`integrate.mjs` rewrites the matching `CREATURES[<artKey>]` block in
`src/assets/art.ts` in place, preserving the comment above each entry.

To **add a brand-new creature**:

1. Paste the `out/<id>.art.txt` block into the `CREATURES` object in
   `src/assets/art.ts`.
2. Add a `Species` in `src/data/creatures.ts` with `art: '<id>'`, its
   `attribute`/`element`, stats, techniques, and blurb.
3. Add it to a reach encounter table (e.g. `src/data/hauntedDungeon.ts`) if it
   should appear in the world.
4. `npm run build` before pushing — the deploy runs `tsc --noEmit` first.

> Note: `smooth()` deletes 1px spurs, so thin appendages (antennae, insect legs,
> antennas) must be drawn ≥2px thick or they vanish. See `bug`/`scrap` in
> `boot-domain.mjs` for the 2×2-stamp helper.

## Changelog (for reproducibility)

- **2026-07-28 — pipeline established + first fixes.** Seeded with three 64px
  rookies (Cindercat/fire, Tideling/water, Mossling/nature). Applied four
  fixes over the first 64px pass, after an A/B against the PixelLab reference:
  1. **Outliner rewrite** — exterior flood-fill + `smooth()` morphological
     cleanup replaced the naive body-adjacent outline (was ragged/broken on
     soft edges, and outlined interior gaps).
  2. **Muzzle shrink** — the cream muzzle was dominating the lower face; made
     it compact and split it from the chest patch.
  3. **Internal detail** — ear/tail bands + fur tufts (Cindercat), rim glint +
     inner bubbles + uneven droop (Tideling), veined uneven leaves (Mossling).
  4. **Asymmetry** — off-centre gaze via eye `tilt`, uneven limbs, one-sided
     tail/leaves, to shed the stiff mirror-perfect look.
- **2026-07-28 — first-dungeon roster redesigned + wired in.** Added
  `boot-domain.mjs` (the `BOOT` registry) and `integrate.mjs`. Redesigned all
  nine Boot Domain creatures and replaced their art keys in `art.ts`:
  starters `lizard` (Emberling), `wing` (Glidefang), `bat` (Nightnip); enemies
  `bug` (Mitebug), `plant` (Sprigling), `scrap` (Scrapmite), `wisp` (Gloomote),
  `slime` (Dropletta); boss `lion` (Regalion). Verified in-engine in the HD-2D
  battle scene.
