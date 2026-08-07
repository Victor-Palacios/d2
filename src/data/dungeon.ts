import type { TileTheme } from '../engine/TileGrid';
import type { MusicTrack } from '../engine/Audio';
import type { DialogueScript } from '../systems/dialogue/script';

/**
 * Shared dungeon/reach data model.
 *
 * A "reach" is a self-contained crawlable dungeon: a list of floors plus the
 * metadata the world map and the crawl scene need. Everything here is plain
 * data — adding a new dungeon is a new file that exports a `Reach`, registered
 * in `reaches.ts`. No scene code changes. See `docs/ROADMAP.md`.
 */

export interface EnemySpec {
  species: string;
  level: number;
}

export type FloorEvent =
  | { kind: 'dialogue'; script: DialogueScript; once?: boolean }
  | { kind: 'battle'; enemies: EnemySpec[]; intro?: DialogueScript; outro?: DialogueScript }
  | { kind: 'boss'; enemies: EnemySpec[]; intro?: DialogueScript; outro?: DialogueScript; finalBoss?: boolean }
  // The finale (The Last Lantern): not a fight but a choice — keep the soul you
  // came for, or let it cross. Handled by `DungeonScene.runFinale`.
  | { kind: 'finale'; intro?: DialogueScript }
  // An Anchored: a soul too heavy with one feeling to cross, sunk into a reach
  // and radiating one element across a great tile mass. A tough, optional
  // super-encounter that is NOT consumed on defeat or flight — you come back
  // with a leveled, element-matched team. `id` indexes `src/data/anchored.ts`.
  // Handled by `DungeonScene.runEvent` / `afterBattle`.
  | { kind: 'anchored'; id: string }
  // A recruit: a story companion met and joined mid-crawl (rather than back at
  // the hub). Plays its scene and calls `joinCompanion`, once. `id` indexes
  // `src/data/recruits.ts`. Handled by `DungeonScene.runEvent`.
  | { kind: 'recruit'; id: string };

export interface EncounterEntry {
  weight: number;
  enemies: EnemySpec[];
}

/**
 * A decorative billboard placed on the floor at grid coords (x, z). Decor
 * dresses a reach's terrain (crystals, gravestones, roots, machine pylons…) and
 * — unless flagged otherwise — is a solid obstacle: the party cannot step onto a
 * tile occupied by solid decor. `kind` indexes the `DECOR` art table in
 * `src/assets/art.ts`.
 *
 * Solidity is per-kind by default (see `PASSABLE_DECOR_KINDS`): chunky physical
 * props (rocks, crystals, pillars, trees…) block, while flat ground detail and
 * overhead dressing (glowing floor mushrooms, flowers, hanging vines) do not.
 * `solid` overrides that default for a single instance.
 */
export interface DecorSpec {
  x: number;
  z: number;
  kind: string;
  /** World height of the sprite (default 1.1). */
  height?: number;
  /** Self-illumination for glowing decor (crystals, braziers). Default 0.1. */
  emissive?: number;
  /**
   * Colour of the light pool a glowing prop casts on the floor. Only applies
   * when `emissive` is bright enough to earn one; defaults per kind. Cosmetic.
   */
  glowColor?: string;
  /**
   * Whether the party collides with this prop. Defaults to the kind's entry in
   * `PASSABLE_DECOR_KINDS` (most props block; flat/overhead detail does not).
   * Set explicitly to force one instance solid or passable.
   */
  solid?: boolean;
}

/**
 * Decor kinds that do NOT block movement by default — flat ground detail you
 * walk over (glowing floor mushrooms, flowers) or overhead dressing you walk
 * under (hanging vines). Every other kind is solid unless a `DecorSpec` opts
 * out with `solid: false`.
 */
export const PASSABLE_DECOR_KINDS = new Set<string>(['mushroomGlow', 'jungleFlower', 'vineHang']);

/** Whether a decor instance blocks the party's movement. */
export function decorIsSolid(d: DecorSpec): boolean {
  return d.solid ?? !PASSABLE_DECOR_KINDS.has(d.kind);
}

export interface DungeonFloor {
  id: string;
  name: string;
  rows: string[];
  theme: TileTheme;
  events: Record<string, FloorEvent>;
  chests: Record<string, { obols?: number; item?: string; note: string }>;
  /** Chance per step of a random encounter (0 disables). */
  encounterRate: number;
  encounters: EncounterEntry[];
  /** Fog density multiplier, so deeper floors feel heavier. */
  fog?: number;
  /** Decorative billboards dressing this floor's terrain (solid by default). */
  decor?: DecorSpec[];
  /**
   * Per-tile height offset in world units, keyed `"x,z"` — purely visual, never
   * changes how the grid is walked. A positive value raises a floor tile into a
   * dais (and props/party riding it rise too); a negative value sinks it into a
   * pit. On a wall tile it raises the wall's top, so a boss room's back wall can
   * tower while corridors stay tight. Absent tiles sit flat at 0.
   */
  elevation?: Record<string, number>;
  /**
   * Auto-scatter a light dressing of passable terrain decor across empty floor
   * tiles (deterministic, never blocking) so rooms don't read as bare. `true`
   * uses a sensible density; a number sets it (every Nth eligible tile).
   */
  scatter?: boolean | number;
  /**
   * Turns the floor's element plates (`W F N M D`) into a puzzle: step every one
   * to light them, and the floor's toggle-wall barriers (`%`) open. Gate an
   * optional reward this way, not the descent — the validator checks the plates
   * are all reachable before the barrier opens.
   */
  platePuzzle?: boolean;
}

/** What happens when the player drives into a reach's exit portal. */
export interface ReachClear {
  /** Flag set on the run when the reach is cleared. */
  flag: string;
  /**
   * The Quiet Crossing only: return through the Vigil's-leave ceremony
   * (`HubScene` arrival 'reachCleared'). Other reaches just restore the party
   * and drop you back in the city.
   */
  leaveCeremony?: boolean;
}

export interface Reach {
  id: string;
  name: string;
  blurb: string;
  /** Accent colour for the world-map node and its card. */
  color: string;
  /** Party level the stage is tuned for — shown on the world-map card. */
  recommendedLevel: number;
  floors: DungeonFloor[];
  startingLight: number;
  /** Ambience track while crawling this reach (boss fights still use 'boss'). */
  music: MusicTrack;
  onClear: ReachClear;
  /**
   * Story gate: a run flag that must be set before this reach can be entered.
   * Until then the world-map card is shown locked (greyed, non-selectable) with
   * a hint naming the reach that unlocks it. Usually another reach's
   * `onClear.flag`, so reaches open in story order. Omit for an always-open
   * reach (the tutorial).
   */
  requires?: string;
  /** A side path off the main line (e.g. The Overgrowth) — tagged as such on the map. */
  side?: boolean;
  /** Only the tutorial lends a party; other reaches use whatever you bring. */
  borrowedParty?: EnemySpec[];
}
