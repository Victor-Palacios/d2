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
  compose.mjs        char-grid drawing kit (ellipse, rect, smooth, outlineSil, toArt)
  paint.mjs          hex-canvas VOLUMETRIC renderer (form-shading, dithered ramps)
  render.mjs         dependency-free PNG encoder + comparison-strip compositor
  personality.mjs    face+posture families (applyFace, POSTURE, lean)
  creatures.mjs      shared recipe helpers + demo builders + a CREATURES registry
  quiet-crossing.mjs reach-1 roster, flat house style (CROSSING registry)
  crystal-cavern.mjs reach-2 roster, painterly style (CAVERN registry)
  build.mjs          CLI: render previews to out/ and emit pasteable { palette, rows }
  integrate.mjs      CLI: replace CREATURES[<artKey>] blocks in src/assets/art.ts
```

## Styles: one per area + one for people

The world gets visual variety by giving **each reach its own sprite style**, and
**humans a style of their own** — so where you are is legible at a glance.

| Group | Style | Engine |
|---|---|---|
| Reach 1 · The Quiet Crossing | flat, bold, graphic house style | `compose.mjs` |
| Reach 2 · The Crystal Cavern | painterly, dithered, volumetric | `paint.mjs` |
| Reach 3 · The Overgrowth | *(planned — its own style)* | TBD |
| Reach 4 · Haunted Dungeon | *(planned — its own style)* | TBD |
| **Humans (all NPCs + hero)** | cel-shaded "storybook" people | `humans.mjs` |

**Human style** (`humans.mjs`): taller, properly-proportioned characters (~30×48,
vs the old 14×18 blobs), clean lineart, and **warm-cool cel shading** — a warm
key light from screen-left (the lantern motif) with a cool shadow to the right,
in flat bands (no dithering). Each character is an individual: a muted wardrobe
with **one saturated accent** colour, a distinct hairstyle (short / long / spiky
/ cap / hood), and an expression (neutral / smile / stern). Deliberately unlike
the creatures — people should not read as monsters. Parametric `human(opts)`
builds the whole cast; `integrate-humans.mjs` writes them into `art.ts`.

## Two creature rendering styles

There are **two** ways to build a creature sprite; pick per creature (or per reach):

- **`compose.mjs` — flat house style.** Single-char palette keys, ellipse
  shapes, 2–3 flat tonal bands, hard single-colour outline. Crisp, graphic,
  cohesive; cheap. Used for **The Quiet Crossing** (`quiet-crossing.mjs`).
- **`paint.mjs` — painterly / volumetric.** Works in raw hex on a canvas, then
  assigns palette keys at the end (`toPixelArt`, auto-quantizing under the ~90
  key ceiling). Each part is shaded as an implied **sphere** — a fake normal
  `z = √(1 − r²)`, a Lambert term, a dark→light `ramp()`, and **ordered
  dithering** between steps so the gradient reads smooth at low res. Adds rim
  light, specular, and a **coloured** (not black) outline. Reads much closer to
  generated / hand-painted pixel art. Used for **The Crystal Cavern**
  (`crystal-cavern.mjs`). More colours, softer volume, better for gems/ice/
  metal/translucency — at the cost of the crisp graphic look.

Mixing styles across reaches is intentional: it gives the world visual variety
as the player descends.

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
node tools/sprites/integrate.mjs           # whole CROSSING set
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
> `quiet-crossing.mjs` for the 2×2-stamp helper.

## Evolution lines

`tools/sprites/evolutions.mjs` builds the Quiet Crossing evolution stages. Each
base grows into a **linear 3–4 stage line** whose every stage is its OWN sprite
that **holds the base's palette + silhouette** (a grown-up version — bigger,
more of the signature feature, a fiercer face, a crown/aura at the top), in the
flat house style. `EVO` maps new art key → builder; `LINES` maps base → ordered
`[stageId, Name, evolveLevel]`. Integrate with `integrate-evolutions.mjs` (art)
and the data is authored in `src/data/creatures.ts` (`evolutions` chains; the
`evolve.ts` system + Transcendence screen drive the actual level-gated,
reversible transform). Bosses (Regalion, etc.) stay standalone, not evo targets.

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
  `quiet-crossing.mjs` (the `CROSSING` registry) and `integrate.mjs`. Redesigned all
  nine Quiet Crossing creatures and replaced their art keys in `art.ts`:
  starters `lizard` (Emberling), `wing` (Glidefang), `bat` (Nightnip); enemies
  `bug` (Mitebug), `plant` (Sprigling), `scrap` (Scrapmite), `wisp` (Gloomote),
  `slime` (Dropletta); boss `lion` (Regalion). Verified in-engine in the HD-2D
  battle scene.
- **2026-07-28 — four redesigns from feedback + the original sprites.** Pulled
  the first-commit programmer-art sprites for reference and reworked four that
  read as look-alikes: `lizard` (Emberling) → a chunky ember-GOLEM (visor +
  molten chest core), away from a Charmander-ish fire lizard; `bug` (Mitebug) →
  a rounded friendly "bug-mon" instead of a realistic beetle with legs; and to
  split two teardrops, `slime` (Dropletta) → a round BALL and `wisp` (Gloomote)
  → a wide-headed SHADE with trailing tendrils. Each honors the original
  silhouette. Re-integrated and re-verified in-engine.
- **2026-07-28 — personality families.** Added the face+posture system
  (`personality.mjs`, [monster-personalities.md](monster-personalities.md)) and
  a `faced()` finisher. Migrated five Quiet Crossing builders to their assigned
  family (`lizard`→fierce, `bat`→clever, `bug`→nervous, `scrap`/`wisp`→uncanny);
  the three Friendly creatures keep `glossyEyes` and `lion` keeps its bespoke
  fierce face. Integrated into `art.ts` and shipped.
- **2026-07-28 — painterly engine + Crystal Cavern (reach 2).** Added
  `paint.mjs` (volumetric hex-canvas renderer: `form()` sphere-shading with
  dithered `ramp()`s, `spec`, coloured `outline`, auto-quantizing `toPixelArt`)
  and `crystal-cavern.mjs` (`CAVERN`). Redesigned the four Crystal Cavern
  creatures in this richer style to add world variety vs the flat reach-1 look:
  `crystalSlime` (glassy gem slime), `prismMoth` (iridescent rainbow wings),
  `geodeGolem` (matte stone + glowing amethyst core), `crystalWarden`
  (faceted ice boss). `integrate.mjs` now merges `CROSSING` + `CAVERN`.
  Integrated and verified in-engine.
- **2026-07-28 — Quiet Crossing evolution lines.** Gave all 8 first-dungeon
  creatures linear 3–4 stage evolution lines, each stage a NEW own-art sprite
  holding the base's style (`evolutions.mjs`, `integrate-evolutions.mjs`, 20 new
  species in `creatures.ts`). Replaced the earlier borrowed-art / boss-linked
  branches per the "hold predecessor's style" direction; bosses stay standalone.
- **2026-07-28 — human style (third style) + all NPCs redesigned.** Added
  `humans.mjs` (parametric cel-shaded "storybook" people, warm-cool lantern
  light) and `integrate-humans.mjs`. Replaced the legacy 14×18 shared-silhouette
  `human()` generator and redrew all nine characters (hero, mentor, chief,
  rival, vendor, soulkeeper, three leaders), each an individual. Establishes the
  "distinct style per area + humans" plan in the table above.
