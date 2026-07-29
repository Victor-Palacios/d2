# Monster personality families

A design system for keeping the roster **varied in a predictable way**. Every
creature is assigned exactly one of five *personality families*. The family is
not flavour text — it drives the sprite's **face** (eyes, brows, mouth) and its
**body posture**, and it hints at how the creature behaves in a fight. Two
creatures of the same element look different because they carry different
families; the whole roster stays legible because a face reads its family at a
glance.

Implemented in [`tools/sprites/personality.mjs`](../tools/sprites/personality.mjs)
(`applyFace`, `POSTURE`, `lean`). Recipe context:
[procedural-sprites.md](procedural-sprites.md).

## The five families

Each family is a fixed set of facial cues **plus** a posture. The face cues are
the spec `applyFace` implements; the posture cues are applied at author time to
the body (see “Posture” below).

### Friendly
- Large eyes
- Round pupils
- Small mouth
- Soft cheeks (blush)
- Upward curves
- **Posture:** upright, open stance, limbs relaxed at the sides.

### Fierce
- Narrow eyes
- Heavy brows
- Visible teeth
- Forward-facing features
- Angular cheeks
- **Posture:** crouched and leaning at the viewer, limbs forward, wide base.

### Nervous
- Uneven pupils
- Raised brows
- Small or trembling mouth
- Compressed posture
- **Posture:** shrunk silhouette, shoulders up, limbs pulled in tight.

### Clever
- Half-lidded eyes
- Offset smile
- Small pupils
- Asymmetrical features
- **Posture:** weight on one side, one limb relaxed and one raised/behind —
  never a mirrored pose.

### Uncanny
- Missing pupils
- Too many eyes
- Eyes positioned unusually
- Mouth detached from expected anatomy
- **Posture:** unnaturally still or floating/off-axis; a wrong-count limb.

## Posture matters as much as the face

A family is a whole-body read, not just a face swap. `POSTURE[family]` records
the intent (`lean`, `limbs`, `stance`, `note`); the builder applies it when it
lays out the body:

- **Lean** — `lean(grid, POSTURE[family].lean)` shears the sprite: a fierce
  creature (+lean) tips toward the viewer, a nervous one (−lean) pulls back.
- **Silhouette size** — nervous creatures are drawn smaller and rounder with
  limbs tucked in; fierce ones get a wider, lower base.
- **Symmetry** — friendly/fierce read symmetric; clever is deliberately
  lopsided (offset limbs, one raised brow); uncanny breaks one expectation
  (a limb too many, an off-axis tilt, no ground contact).

## How to apply it in a builder

Draw the body, clean the silhouette, **then** stamp the family face (after
`smooth()` so 1px face detail isn't eaten), then outline:

```js
import { applyFace, POSTURE, lean } from './personality.mjs';

const { g, cx } = body();               // author the body per POSTURE[family]
lean(g, POSTURE[family].lean);          // forward/back tip
smooth(g);                              // clean the silhouette (no face yet)
applyFace(family, g, {                  // eyes + brows + mouth for the family
  cx, eyeY: 28, dx: 8, rx: 4.2, ry: 5, mouthY: 40,
  pal: { white: 'w', pupil: 'p', spark: 's', ink: 'k', mouth: 'p', blush: 'c', skin: 'o' },
});
outlineSil(g, 'k');
return toArt(g, PALETTE);
```

`pal` maps the family's face *roles* onto whatever palette keys the creature
already uses, so one face system serves every colour scheme. `skin` is the body
base colour — clever half-lids and uncanny voids paint with it.

## Where the Quiet Crossing roster falls

Assigned for spread (all five families appear) and to fit each creature's
fiction. Stored as `personality` on each entry in
[`quiet-crossing.mjs`](../tools/sprites/quiet-crossing.mjs).

| Creature | Art key | Family | Why |
|---|---|---|---|
| Emberling | `lizard` | **Fierce** | "burned bright and went out angry" — a stern ember-golem |
| Glidefang | `wing` | **Friendly** | a soul at peace, gentle glider |
| Nightnip | `bat` | **Clever** | quick, funny, sly little shade |
| Mitebug | `bug` | **Nervous** | a jittery little mite |
| Sprigling | `plant` | **Friendly** | earnest, gentle sprout |
| Scrapmite | `scrap` | **Uncanny** | a malfunctioning salvage bot, blank readout eyes |
| Gloomote | `wisp` | **Uncanny** | a vacant, drifting fragment of memory |
| Dropletta | `slime` | **Friendly** | a cheery, bouncy water ball |
| Regalion | `lion` | **Fierce** | the imposing warden boss |

Starters deliberately span three families (Fierce / Friendly / Clever) so the
first choice already teaches the system.

## The variety rule

To keep the roster varied *predictably* rather than randomly:

1. **One family per creature**, chosen from fiction + role.
2. **Spread within any group the player sees together** (a reach's roster, the
   starter trio, a boss's minions): cover **≥3 families**, and let no single
   family exceed ~40% of the group.
3. **Bosses are Fierce or Uncanny** — never Friendly.
4. **Soft nudges by kind:** rookies skew Friendly / Nervous / Clever; predators
   skew Fierce / Clever; machines and undead skew Uncanny. Element and attribute
   *nudge* the pick but never dictate it — that's what keeps same-element
   creatures from converging.
5. **Face and posture must agree** — pull both from the same family; a friendly
   face on a forward-leaning crouch reads as a mistake, not a character.

## Migration status

`personality.mjs` and this mapping are in place. The live Quiet Crossing sprites
still carry their original hand-placed faces (mostly Friendly); they are being
migrated to `applyFace` per the table above so the roster gains its intended
range. New creatures should use `applyFace` from the start.
