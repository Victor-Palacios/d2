# Adding a reach (a new area)

A practical, systematic guide to building a **reach** — one of the free-select
areas on the world map (The Quiet Crossing, The Reliquary, The Overgrowth, The
Unremembered). It documents the terrain-uniqueness system so a future session
can add an area end to end without rediscovering the invariants.

> **Naming note.** An "area" is a `Reach` in code (`src/data/dungeon.ts`). The
> registry is `src/data/reaches.ts` (`REACHES` + `REACH_ORDER`). "Reach" is the
> only accepted term — the areas were renamed out of an older word; don't
> reintroduce it (a CI check enforces this — see `CLAUDE.md` §Naming).

## The one principle

**Mechanics are shared; the look is bespoke.** Every reach walks the same grid
(tile movement, wall collision, portals, LP, encounters). What makes areas feel
like different *places* is entirely presentational: the terrain skin, wall
height, fog tint, decorative props, layout shape, roster and music. Never fork
crawl logic to make an area distinct — reach for the data levers below.

And: **the repo is asset-free.** Every sprite, tile and sound is generated in
code (`src/assets/art.ts`, `src/engine/pixel.ts`, `src/engine/Audio.ts`). Do not
commit binary assets. Sprite-preview PNGs and smoke screenshots are git-ignored
(`tools/sprites/out/`, `tools/smoke/shots/`).

## The checklist

1. Terrain skin (`TerrainStyle` in `pixel.ts`) + theme (`TileTheme`)
2. Decor art (`DECOR` in `art.ts`) — where the theme really lands
3. Floor layouts (ASCII grids) — validate before you trust them
4. Roster + boss (`creatures.ts`, sprites via `tools/sprites/`)
5. Music track (`Audio.ts`)
6. The reach data file + registration (`reaches.ts`)
7. Validate, build, smoke-test

Steps 1–2 give the biggest perceived-uniqueness jump per line of code. Do them
first.

---

## 1. Terrain skin + theme

Each floor's `TileTheme` (`src/engine/TileGrid.ts`) carries three purely-visual
levers on top of its colours:

```ts
terrain?: TerrainStyle;  // surface generator; default 'stone'
wallHeight?: number;     // world units, default 2.6 — taller = cavern/canopy
fogColor?: string;       // tints the whole air for this floor
ambientColor?: string;   // per-floor mood: tints the ambient light
hemiSky?: string;        // per-floor mood: hemisphere sky tint
hemiGround?: string;     // per-floor mood: hemisphere ground tint
```

And on the `DungeonFloor` itself, two more purely-visual levers:

```ts
elevation?: Record<'x,z', number>;  // per-tile height: +raises a dais, -sinks a
                                     // pit (elevated tiles render as solid
                                     // plinths; movement is unchanged)
scatter?: boolean | number;          // auto-strew flat, passable ground decor
                                     // across empty floor (never blocks)
```

`TerrainStyle` (in `src/engine/pixel.ts`) currently has six skins:

| Style | Floor | Wall | Used by |
|---|---|---|---|
| `stone` | speckled flagstone + grout | brick courses | The Quiet Crossing |
| `crystal` | faceted shards, specular sparkle | vertical crystalline columns | The Reliquary (1,3) |
| `metal` | riveted plating, panel seams | riveted panels, seams+rivets | The Reliquary (2) |
| `crypt` | cracked flagstone, mortar, bone-dust | mortared ashlar blocks + cracks | The Unremembered (1,3) |
| `cave` | organic rock blotches, pebbles | rough mottled rock, no courses | The Unremembered (2) |
| `jungle` | mossy earth, grass tufts, roots | leaf clusters + hanging vines | The Overgrowth (all) |

**To add a new skin:** add the name to the `TerrainStyle` union, then add one
branch to **both** `floorTexture()` and `wallTexture()` in `pixel.ts` (matching
the existing `if (style === '…')` chains). Keep the resolution small (`res = 32`)
— pixels are the point. `TileGrid.build()` also nudges `metalness`/`roughness`
per style; add a case there only if the surface needs shine (see the `metal`
handling).

> **Cache-key discipline (do not regress this).** `floorTexture`/`wallTexture`
> cache by `${style}:${base}:${seed}:${id}`. The `id` alone ('a'/'b'/'std') is
> reused by every reach, so a key that omitted `base`+`style` made the
> first-built area's colours leak into every other area. Any new texture helper
> must fold its colour and style into the cache key.

Assign styles per floor for **between-area** contrast, and optionally vary
within an area for texture (The Reliquary uses `crystal`+`metal`, The
Unremembered `crypt`+`cave`). A cohesive single-skin area (jungle) is also fine.

## 2. Decor

Decor is a scatter of billboards — the cheapest way to make a floor read as a
place. `DungeonFloor.decor?: DecorSpec[]`:

```ts
interface DecorSpec {
  x: number; z: number; kind: string;
  height?: number; emissive?: number;
  solid?: boolean;   // collides? defaults per-kind (see below)
}
```

`kind` indexes the `DECOR` table in `src/assets/art.ts` (small `{palette, rows}`
pixel maps). Current kinds: crystal (`crystalCluster`, `crystalPillar`,
`iceShard`), metal (`machinePylon`, `conduit`), crypt (`gravestone`, `boneheap`,
`deadTree`, `roots`), cave (`rockPile`, `mushroomCluster`, `mushroomGlow`),
jungle (`fern`, `palmTree`, `vineHang`, `jungleFlower`, `bamboo`, `mossLog`,
`totem`), generic (`crate`, `rubble`).

**Collision.** Decor is *solid by default* — the party cannot step onto a tile
holding a solid prop, so rocks/crystals/pillars/trees are real obstacles. The
default is per-kind: `PASSABLE_DECOR_KINDS` in `dungeon.ts` lists the kinds that
*don't* block (flat floor detail you walk over — `mushroomGlow`, `jungleFlower`
— and overhead dressing you walk under — `vineHang`). Override any single
instance with `solid: true`/`false`. `decorIsSolid(spec)` is the one source of
truth (used by the scene, the validator and the smoke test).

Rules:
- **Decor must sit on a walkable floor tile** (not `#`/`=`/void). A billboard on
  a wall clips into the 3D box. The validator enforces this.
- **Solid decor must not block the only path to a target, or sit on a tile the
  party has to stand on** (start, chest, light, portal/exit, element, event). The
  validator flood-fills *through* solid decor and flags both mistakes — a prop
  dropped into a one-wide corridor is a soft-lock. Place solid decor beside
  pillars, in corners, off the main path; keep chokepoints and interactive tiles
  clear (or mark that instance `solid: false`).
- `DungeonScene.placeDecor()` renders/updates/disposes billboards and calls
  `grid.blockTile()` for solid ones; movement checks `grid.passable()`
  (`walkable()` stays pure grid geometry). No scene edits needed to add decor.

Add new decor sprites by appending to `DECOR` (keep them ≤~16px wide, `.` =
transparent). If the new kind is flat/overhead, add it to `PASSABLE_DECOR_KINDS`.

## 3. Floor layouts

Floors are hand-authored ASCII grids (`rows: string[]`). Legend
(`TileGrid.parse`):

```
' ' void      '#' wall        '=' accent wall (boss approach)
'.' floor     'S' start       '>' portal down     '<' exit portal
'C' chest     '$' light       W F N M D  element floor tiles
'^' hazard tile (gutters extra lantern light on entry — a glowing warning plate)
'k' key pickup          '+' locked door (spend a key to open; blocks until then)
'*' switch              '%' toggle-wall barrier (starts solid; a switch flips it)
'?' secret wall (looks solid, is passable — crumbles when the party walks in)
'1'-'9'  scripted event tile (looked up in that floor's `events` map)
```

**Composing from room templates (optional).** Hand-drawing every wall is where
one-off soft-locks and off-by-one row widths creep in. `src/data/roomTemplates.ts`
ships a small library of pre-walled, rectangular room *stamps* (`hall`, `pillars`,
`alcove`, `cross`, `vault`) and a composer that keeps the grid tidy:

```ts
import { compose, carve, put } from './roomTemplates';

let rows = compose(9, 5, [
  { room: 'hall', x: 0, z: 0 },
  { room: 'hall', x: 4, z: 0 },   // shares the middle wall column
]);
rows = carve(rows, 4, 2);         // open a doorway between the rooms
rows = put(rows, 1, 2, 'S');      // start in the left room
rows = put(rows, 7, 2, '>');      // descent in the right room
```

`compose` always returns rectangular rows; you carve the doorways and drop the
`S`/`>`/`C`/`k` yourself. Rooms ship *closed* so no stamp punches an accidental
opening — and `validateFloor` still has the final say on reachability, so a
doorway you forget to carve is caught as a soft-lock. Browse the stamp gallery at
the top of `tools/floor-preview.html`. You can always write raw `rows` instead.

Preview any floor (grid + live `validateFloor`, with elevation/hazard badges) at
`tools/floor-preview.html` under `npm run dev` — author with instant feedback
instead of eyeballing coordinates. A hazard must never be the *only* way to the
descent portal (the validator enforces this so you're never forced to take
damage to progress).

**Keys & doors.** A `+` door blocks like a wall until the party spends a `k` key
(keys are fungible — any key opens any door — and persist across suspend/resume
via `game.openedDoors`). Gate an *optional* reward behind a door, not the way
down: the validator runs lock-and-key reachability (open any affordable reachable
door, re-flood, repeat) and flags a target that no reachable key can unlock. Put
`N` keys for `N` doors you want openable; a key sealed behind the only door it
opens is (correctly) a soft-lock.

**Switches & toggle-walls.** A `%` barrier starts solid and blocks like a wall;
stepping any `*` switch flips *every* `%` on the floor between solid and open
(the switch is a global toggle, not a per-door key). Toggle state is transient —
it resets to solid on suspend/resume, and a resume standing on a `%` re-flips so
you're never entombed. Like doors, gate an *optional* reward, not the descent:
the validator runs a toggle-aware search over `(tile, toggleState)` and flags a
target that no reachable switch can open. crystal-3 is the worked example — a
corner chest walled off behind a `%` that a `*` across the gallery grinds aside.

**Secret walls.** A `?` tile is passable floor wearing a wall's skin — it looks
exactly like the surrounding wall until the party walks into it, at which point
the false wall crumbles. Use it to hide an *optional* reward (wall off a `C` so
its only neighbour is the `?`); never gate the descent behind one, since a
player who never probes that wall would be stuck — the validator enforces this,
flagging a `>`/`<` reachable only through a secret. crystal-1 is the worked
example — a corner cache behind a false wall in the bottom-right.

**Invariants the validator checks** (`src/data/validateReaches.ts`):
- rows are all the same width; exactly one `S`.
- every `'1'-'9'` tile has an entry in `events`, and vice-versa.
- every chest key `"x,z"` lands on a `C` tile, and every `C` has a chest entry.
  **Keys are `"col,row"`** (x then z). This is the easiest thing to desync — a
  moved chest with a stale key silently gives "Empty."
- non-boss floors have a `>` (or `<`); boss floors don't need one (the exit
  portal spawns when the warden falls).
- **reachability**: a flood-fill from `S` — treating solid decor as a wall —
  must reach every event, chest, light, portal and element tile. A walled-off
  portal (by geometry *or* by a solid prop) is a soft-lock.
- decor is in-bounds, on a walkable tile, and its `kind` exists in `DECOR`;
  solid decor never sits on an interactive tile (start/chest/light/portal/
  element/event).

**Workflow — validate before you trust ASCII.** Do not eyeball coordinates.
Design each floor in a throwaway Node script that mirrors `validateFloor`
(rows + `events`/`chests`/`decor` + expected anchors), run it until clean, then
transcribe the exact rows into the reach file. This caught a real dead chest key
and several off-by-one decor placements when the existing areas were built.

> **Anchor coordinates.** Some smoke tests navigate a floor with fixed key
> presses (`tools/smoke/reaches.mjs`, `capture.mjs` walk The Reliquary floor 1
> from `S(3,2)` to the event at `(5,4)`; the boss floor from `S(7,7)` up to
> `(7,4)`). If you redesign an existing floor those anchors traverse, keep the
> `S` and event tiles at the same coordinates *or* update the test. A brand-new
> reach has no anchors — lay it out freely.

## 4. Roster + boss

Species live in `src/data/creatures.ts` (`SPECIES`). Each needs `attribute`
(assassin/mage/hero), `element` (water/fire/nature/machine/dark), `art` (a key
into `CREATURES` in `art.ts`), stats, and `techniques` that **already exist** in
`src/data/techniques.ts`. The warden is just a species with a big `height`
(~2.3) and stronger stats; reference it from the boss floor's `kind: 'boss'`
event.

Two ways to give the roster art:
- **Reuse an existing `CREATURES` key** (fast, supported). The Overgrowth does
  this — Frondle=`plant`, Thorncat=`wolf`, Boggle=`slime`, Chitter=`bug`,
  Verdanox=`lion`. Fine when the area's identity rides on terrain+decor.
- **Author bespoke sprites** via the procedural pipeline in `tools/sprites/`
  (`node tools/sprites/build.mjs`), then paste the `{palette, rows}` block into
  `CREATURES`. See [procedural-sprites.md](procedural-sprites.md) and
  [adding-monsters.md](adding-monsters.md). Keep them ~64px tall to match.

Wild encounters use `DungeonFloor.encounters` (weighted `EncounterEntry[]`) +
`encounterRate`; scripted fights/boss use `events`.

## 5. Music

Add a `MusicTrack` in `src/engine/Audio.ts`: extend the union type and add one
entry to `TRACKS` (`{ root, bpm, bass[], arp[] }` — semitone offsets). The Reach
references it by name (`music: 'jungle'`). Boss fights always use `'boss'`.

## 6. The reach data file + registration

Model a new file on `src/data/crystalCavern.ts` or `jungleReach.ts`. A `Reach`
(`src/data/dungeon.ts`) is:

```ts
{ id, name, blurb, color /* world-map accent */, recommendedLevel,
  floors: DungeonFloor[], startingLight, music, onClear: { flag } }
```

Annotate the `TileTheme` consts `: TileTheme` (so the `terrain` literal is
type-checked). Then register in `src/data/reaches.ts`:

```ts
export const REACHES = { crossing, crystal, jungle, haunted, /* yours */ };
export const REACH_ORDER = ['crossing', 'crystal', 'jungle', 'haunted', /* yours */];
```

**That's the only wiring.** `WorldMapScene` builds its nodes and cards from
`REACH_ORDER`; the stages/readiness cues come from `recommendedLevel`. No scene
code changes. Order + `recommendedLevel` set where it slots in the progression
(the ladder climbs by two: The Quiet Crossing 1, The Reliquary 3, The Overgrowth
5, The Unremembered 7, The Last Lantern 9).

## 7. Validate, build, smoke-test

- `validateReaches()` runs automatically in dev (`main.ts`, guarded by
  `import.meta.env.DEV`) and logs problems to the console. It is also exposed on
  `window.hd2dGame.validateReaches` for tests.
- **`npm run build`** must pass — it runs `tsc --noEmit` first, and the Pages
  deploy gates on it. Build before every push.
- **Smoke tests** drive the built game in a real browser (see
  [../tools/smoke/README.md](../tools/smoke/README.md)). The two that cover this
  system:
  - `tools/smoke/terrain.mjs` — runs `validateReaches()` over every floor,
    asserts each reach's terrain skins, and enters every floor (no combat) to
    confirm the grid + terrain + decor build in three.js. **Add your reach's
    expected terrain sequence to its `expect` map.** Fast and deterministic.
  - `tools/smoke/stages.mjs` — world-map cards + progression order.

  ```bash
  npm run build && npm run preview -- --port 4176   # serve the built game
  npm i -D playwright                                # ad hoc, not a dependency
  CHROME=<chromium> URL=http://localhost:4176/ node tools/smoke/terrain.mjs
  ```

### Environment traps (will cost you an hour otherwise)
- **No GPU here.** Headless Chromium falls back to SwiftShader (~0.3 fps with
  the full post stack). Logic/terrain tests strip the post stack to hit ~26 fps;
  fights-heavy tests (`reaches.mjs`) can exceed several minutes — verify
  navigation directly instead of waiting on god-mode boss fights.
- **Never `pkill` from a Bash call** — it can kill your own shell (exit 144).
  Start each preview on a fresh `--port` rather than killing the old one.
- **Don't commit** `tools/smoke/shots/` or `tools/sprites/out/` (git-ignored),
  or Playwright (`npm i -D playwright` is ad hoc — revert `package.json`/lock).

## Worked example: The Overgrowth (jungle)

A complete reach to copy from:
- terrain skin `jungle` — `pixel.ts` (`floorTexture`/`wallTexture` jungle branch)
- decor — the jungle `DECOR` entries in `art.ts`
- layouts + theme + roster wiring — `src/data/jungleReach.ts` (three floors:
  Canopy Approach, Tangle Hollow, Heartwood; green fog; tall canopy walls;
  Nature+Water plates; warden Verdanox with a soul-story boss)
- roster — `frondle`/`thorncat`/`boggle`/`chitter`/`verdanox` in `creatures.ts`
- music — the `jungle` track in `Audio.ts`
- registration — `crossing, crystal, jungle, haunted` in `reaches.ts`
- aftermath beat — `docs/NARRATIVE.md` §11a, tested by `tools/smoke/jungle.mjs`
