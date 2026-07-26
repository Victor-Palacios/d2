# Boot Domain — a "first hour" HD-2D dungeon-crawler RPG (browser)

A playable vertical slice of a PS1-era dungeon-crawler RPG, rendered in the
Square-Enix-style **HD-2D** look: pixel-art billboard sprites standing inside a
real 3D environment, lit by a shadow-casting point light, finished with a
bloom + depth-of-field + tilt-shift + grade post stack.

Everything is TypeScript + Three.js + `postprocessing`, authored entirely in
code — there is no scene editor, no node graph, and **no binary assets at all**.
Sprites, tile textures and sound effects are all generated procedurally at
runtime from data in `src/assets/` and `src/engine/`.

> **Placeholder content, on purpose.** Every creature, character, technique and
> sound in here is original programmer-art standing in for the real thing. No
> copyrighted sprites, names, music or SFX are used or bundled. See
> [Swapping in real assets](#swapping-in-real-assets).

---

## ▶ Play it

**https://victor-palacios.github.io/d2/**

Nothing to install. Click the page once when it loads — browsers block audio
until you interact with the page.

Two things to know before you click:

- **You need a keyboard.** Menus and dialogue take mouse clicks and taps, but
  moving around the world is keys-only, so this is not playable on a phone yet.
- **You need WebGL2** — that is any browser since ~2017 (Safari 15+). Any GPU
  from roughly the last decade is plenty, including Apple Silicon and integrated
  Intel/AMD; there is no discrete-GPU requirement. The only thing that genuinely
  falls over is a *software* rasterizer with no GPU at all (headless CI, some
  VMs and remote desktops), where the post stack drops to a slideshow. If it
  feels sluggish, press `` ` `` and pull **supersample** down toward 1.0;
  `window.hd2dGame.stats.fps` reports the real frame rate.

Picking this up fresh, or handing it to someone else? See **[HANDOFF.md](HANDOFF.md)**
for current state, the one open bug, and the environment traps. Deeper docs live
in [`docs/`](docs/):

- **[docs/SYSTEMS.md](docs/SYSTEMS.md)** — how the battle numbers actually work
  (classes, elements, damage, guard, EP, rewards), with worked examples.
- **[docs/PLAN_AUDIT.md](docs/PLAN_AUDIT.md)** — the original design plan audited
  section by section: implemented / partial / missing.
- **[docs/ROADMAP.md](docs/ROADMAP.md)** — the path from this first-hour slice
  toward *Digimon World 2*'s first five hours, including the element-count trim.

## Run it locally

```bash
npm install
npm run dev        # http://localhost:5173
```

```bash
npm run build      # typecheck + static build into dist/
npm run preview    # serve the built files
```

The build is fully static and uses relative asset paths (`base: './'`), so
`dist/` can be dropped straight onto GitHub Pages, itch.io, or any static host —
including from a subdirectory.

## Deployment

`.github/workflows/deploy-pages.yml` builds and publishes to GitHub Pages on
every push to the repository's **default branch**, and can also be run by hand
from the Actions tab (`Run workflow`) on any branch. The workflow gates on
`github.event.repository.default_branch`, so renaming the default branch or
merging the work elsewhere does not break it.

`npm run build` runs `tsc --noEmit` first, so a type error fails the deploy
rather than publishing a broken bundle.

There is deliberately no `actions/configure-pages` step: its purpose is to feed
the published base path into the build, and `vite.config.ts` already uses a
relative base (`'./'`) that works from any subpath.

Note for anyone re-creating this setup on a fresh repo: **Pages has to be
enabled once by a repo admin** (Settings → Pages → Source: "GitHub Actions").
CI cannot do it — creating a Pages site needs `administration: write`, which the
Actions token is never granted, so `configure-pages` with `enablement: true`
fails with `Resource not accessible by integration`. Until Pages is on, the
`deploy` job fails with a 404 on the missing Pages site.

## Controls

| Key | Action |
|---|---|
| Arrow keys / WASD | Move one tile, navigate menus |
| Z / Enter / Space | Confirm, advance dialogue |
| X / Esc | Cancel, back out of a menu, **stop auto** |
| Q | **Toggle auto** — auto-read dialogue, or auto-battle in combat |
| E | **Soul menu** — Soularium (capture dex) + Soul Sanctuary (party/reserve) |
| `` ` `` | Toggle the HD-2D debug panel |
| M | Mute / unmute |

Walk **into** an NPC to talk to them. In the crawl, drive into chests, fuel
canisters and portals. Menus also respond to the mouse.

### Using a controller

**There is no setup.** Plug in (or Bluetooth-pair) any controller, open the
game, and **press a button on the pad** — browsers deliberately hide gamepads
until you do, so the first press is what makes it appear. A
"Controller connected" toast confirms it. Nothing to configure, no driver, no
mapping screen.

| Pad | Does |
|---|---|
| D-pad **or** left stick | Move one tile, navigate menus |
| A / ✕ — or Y / △, Start | Confirm, advance dialogue |
| B / ○ — or X / □, Select | Cancel, back out, **stop auto** |
| **L1 / LB** | **Toggle auto** — hands-free dialogue reading, or auto-battle in combat |
| **R1 / RB** | Open the **Soul menu** (Soularium + Soul Sanctuary) |

**Auto, on one button.** `L1` turns hands-free reading on and off while a
dialogue box is up, and starts (or stops) auto-battle during a fight — the same
toggle in both places. The `` ` `` debug panel is still keyboard-only.

Works with Xbox, DualShock/DualSense, and Switch Pro pads — anything the
browser reports in the standard mapping, wired or wireless. The stick is
treated as a d-pad (deadzone 0.55) because movement is grid-based.

Keyboard and pad are live at the same time, so you can mix them freely. The
only thing still keyboard-only is the `` ` `` debug panel.

## What's in the slice

Title → name entry → **pick your partner** → Digital City hub → world map → **The Quiet Crossing**
(3 floors: crawl, chests, element plates, draining EP, scripted fights,
random encounters, and the warden boss) → licence + own vehicle → rival intro →
supply bay → Mission 2 briefing.

- **Crawl**: tile-by-tile movement with wall collision, camera follow, treasure
  chests, five kinds of emissive element floor plates, an EP meter that drains
  one point per step (hit zero and you get towed home), descent portals, and a
  boss floor whose accent walls telegraph what is coming.
- **Battle**: turn-based 3v3. Turn order by Speed with a random tiebreak band.
  Attack / Technique / Guard / **Auto**, MP costs, AoE and heal techniques,
  class triangle (Assassin > Mage > Hero > Assassin, ×1.25 / ×0.8), element-plate
  buffs (×1.2), damage variance, faint / victory / defeat, and an enemy AI that
  prefers advantageous targets and finishes off the wounded.
- **Auto-battle**: pick **Auto** and the party keeps swinging with the free
  basic Attack, targeting the weakest living foe, until you press **Esc**. It
  deliberately never spends MP, uses techniques or touches items, so leaving it
  on cannot burn anything you were saving for the boss.
- **Progression**: choose one of three partner monsters right after New Game
  (Emberling / Glidefang / Nightnip — one per class), then build a team by
  **capturing** more (see below), earning a licence and your own vehicle after
  the warden falls.
- **More domains**: the world map is free-select — beyond The Quiet Crossing it
  offers the **Crystal Cavern** (Water/Machine, warden Glaciark) and the
  **Haunted Dungeon** (Dark/Nature, warden Revenance), each with its own
  monster roster, tile theme and ambience. Adding another is a data file
  registered in `src/data/domains.ts` — no scene code changes.

## Capturing monsters — Soul Syphon

Recruiting works by draining a wild monster's soul over the course of battle:

- Every monster carries a **Soul Syphon** meter (shown on its battle card).
  **Encountering** it primes the meter; **hitting** it fills the rest. Right now
  one encounter + one hit reaches **100%** — and the hit that tops it out
  captures the monster **even if the blow knocks it out**.
- A capture grants a **free copy** (into your party, or the **Soul Sanctuary**
  reserve if the party is full) and logs the species in the **Soularium**, the
  capture dex.
- Once a species is logged it shows a **★** instead of a syphon meter: you can no
  longer capture it in battle, but you can buy more copies from the **Soul
  Store**.

Press **E** / **R1** to open the **Soul menu** anytime in town or the crawl — it
opens the **Soularium** (dex) or the **Soul Sanctuary**, where you move monsters
between your active party and the reserve.

The **Soul Store** (a vendor in Digital City — talk to Soul Broker Vex, the tile
just above where you start) sells copies of any species you've logged (priced by
power) and **party-capacity upgrades**: party size starts at **4** and grows one
slot at a time to **10**. Monsters that don't fit go to the Soul Sanctuary.

## Saving

Two kinds, deliberately different in weight:

- **Autosave** — written whenever you reach Digital City or the domain map.
  This is your progress; it survives everything.
- **Suspend save** — press **Esc** mid-crawl and pick *Suspend & quit*. It puts
  the run down exactly where you stand, and is **deleted the moment you load
  it**. It is a bookmark for taking a break, not a checkpoint: you cannot reload
  it to retry a fight that went badly, which is what keeps running out of EP a
  real cost.

Both live in `localStorage`, so a save made on the live site is separate from
one made on `localhost`. `src/systems/party/saveGame.ts` carries a `version`
field. Older saves **migrate forward** — `applySave` defaults any field a newer
build added — so shipping additive changes never wipes a player's progress.
Only a save from a *newer* build, or a corrupt one, is discarded; a genuinely
breaking change raises `MIN_SAVE_VERSION`.

## Project layout

```
src/
  engine/
    HD2DRenderer.ts   camera rig, shared light rig, whole post stack
    Billboard.ts      pixel-perfect sprite plane + silhouette shadow
    TileGrid.ts       3D grid geometry, collision, element tiles
    DebugPanel.ts     lil-gui bindings for every HD-2D parameter
    SceneManager.ts   scene FSM + fade transitions
    Input.ts  Audio.ts  fx.ts  pixel.ts
  scenes/             Intro, Hub, WorldMap, Dungeon, Battle, GameOver
  systems/
    battle/           headless battle model + damage formula
    dialogue/         dialogue script data
    party/            creature instances + the run's GameState
  data/               creatures, techniques, elements, teams, items, bootDomain
  ui/                 DOM overlay: dialogue, menus, HUDs, name entry, shop
  assets/art.ts       every sprite, as pixel maps
```

The battle model in `systems/battle/engine.ts` has no Three.js or DOM imports —
it is pure rules, driven one action at a time by `BattleScene`. Crawl logic
(movement, tile interactions, encounters, EP) lives in `scenes/DungeonScene.ts`
alongside its presentation.

One invariant worth knowing: a scene's `enter()` must not await player input.
`SceneManager.go()` awaits it and stays busy until it resolves, so anything
interactive is kicked off detached (`void this.run()`).

## The HD-2D recipe

All of it lives in `src/engine/HD2DRenderer.ts` and is shared unchanged between
the crawl and the battle arena, so the two can never drift apart.

- **Camera** — `PerspectiveCamera` at ~34° FOV, fixed 42° pitch, smoothed
  follow. Low FOV is what gives the flattened diorama read.
- **3D half** — real floor quads and real wall boxes on a grid
  (`InstancedMesh`), `MeshStandardMaterial`, low-res pixel textures,
  `FogExp2` for depth falloff.
- **2D half** — sprites are textured planes with `NearestFilter`, mipmaps off,
  anchored at their base, yaw-billboarded and leaned back by 80 % of the camera
  pitch (a strictly upright billboard is badly foreshortened at this angle).
  They use `alphaTest` rather than transparency, so **the shadow follows the
  sprite's silhouette rather than its quad** — the detail that actually sells
  the illusion.
- **Lighting** — one warm `PointLight` riding above the party with
  `castShadow` and a 2048² shadow map, plus a low ambient/hemisphere fill and a
  dim shadowless back light so sprites never silhouette into mush. Floors and
  walls receive; sprites cast.
- **Post stack** — render → DOF (auto-focused on the party) + bloom →
  tilt-shift → AgX tone map → hue/saturation → brightness/contrast → vignette →
  optional SMAA, plus supersampled rendering that is downsampled on output.
- **Element plates** double as free flair: emissive rune tiles that feed the
  bloom, with a pool of three coloured point lights that follow the party so
  the light count stays fixed.

### The debug panel

Press `` ` `` to open it. Every knob is live:

| Folder | What you can tune |
|---|---|
| Camera | fov, pitch, yaw, distance, look-at height |
| Lighting | key colour / intensity / height / range / decay, ambient, hemisphere, rim, shadow bias & radius |
| Bloom | on/off, intensity, luminance threshold, smoothing, radius |
| Depth of field | on/off, focus range, bokeh scale |
| Tilt-shift / grade | tilt focus area & feather, vignette, brightness, contrast, saturation, hue, tone mapping |
| World / output | fog colour & density, supersample factor, SMAA |

"Reset to defaults" restores `DEFAULT_PARAMS`. Whatever you land on can be
pasted straight back into `DEFAULT_PARAMS` in `HD2DRenderer.ts`.

**Performance**: `supersample` is the big lever. It defaults to 1.35×; drop it
toward 1.0 on integrated graphics, or raise it for screenshots. Depth of field
and tilt-shift are the next most expensive effects.

## Swapping in real assets

Everything is behind a data layer, so swapping art is a data edit:

| To replace | Edit |
|---|---|
| A creature's sprite | the pixel map in `src/assets/art.ts` (`CREATURES`) |
| A creature's stats, class, element, techniques | `src/data/creatures.ts` |
| Techniques / damage numbers | `src/data/techniques.ts`, `src/systems/battle/formula.ts` |
| NPCs and the vehicle | `HUMANS` / `VEHICLE` in `src/assets/art.ts` |
| A whole new dungeon | a new `src/data/<name>.ts` exporting a `Domain`, registered in `src/data/domains.ts` |
| Dungeon layouts, encounters, dialogue | `src/data/bootDomain.ts`, `crystalCavern.ts`, `hauntedDungeon.ts` |
| Guard teams and starters | `src/data/teams.ts` |
| Shop stock | `src/data/items.ts` |
| Tile / wall textures | the generators in `src/engine/pixel.ts` |
| Sound effects and music | `src/engine/Audio.ts` |

To use image files instead of procedural pixel maps, replace `spriteTexture()`
in `src/engine/pixel.ts` with a `TextureLoader` call and keep the `crisp()`
sampling settings — nothing else needs to change.

Floor layouts use this legend (see `src/engine/TileGrid.ts`):

```
' ' void        '#' wall          '=' accent wall (boss approach)
'.' floor       'S' start         '>' portal down      '<' exit portal
'C' chest       '$' fuel canister  W F N M D  element floor tiles
'1'-'9' scripted event, looked up in that floor's `events` map
```

## Balance knobs

| Constant | Where |
|---|---|
| Class advantage / disadvantage (×1.25 / ×0.8) | `data/elements.ts` |
| Element plate bonus (×1.2) | `data/elements.ts` |
| Guard damage reduction & MP refund | `systems/battle/formula.ts` |
| Damage curve and variance | `systems/battle/formula.ts` |
| EP per step, pickup value | `scenes/DungeonScene.ts`, `data/bootDomain.ts` |
| Encounter rates and tables | `data/bootDomain.ts` |

## Debug hooks

A running build exposes `window.hd2dGame` with `{ manager, hd2d, game, debug,
stats }` — the scene FSM, the renderer and all its parameters, the live run
state, and a frame counter. Handy from the console, and it is what the
automated smoke tests drive.

## Not in scope

Digivolution / DNA-merge is a **data stub only** (`canDigivolveTo` on each
species) — the data model leaves room for it, but there is no UI. Item use in
battle is likewise present as a disabled menu entry. Both are deliberate: the
slice is the crawl-and-fight loop plus its framing, not a complete game.
