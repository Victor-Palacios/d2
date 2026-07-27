import type { TileTheme } from '../engine/TileGrid';
import type { MusicTrack } from '../engine/Audio';
import type { DialogueScript } from '../systems/dialogue/script';

/**
 * Shared dungeon/domain data model.
 *
 * A "domain" is a self-contained crawlable dungeon: a list of floors plus the
 * metadata the world map and the crawl scene need. Everything here is plain
 * data — adding a new dungeon is a new file that exports a `Domain`, registered
 * in `domains.ts`. No scene code changes. See `docs/ROADMAP.md`.
 */

export interface EnemySpec {
  species: string;
  level: number;
}

export type FloorEvent =
  | { kind: 'dialogue'; script: DialogueScript; once?: boolean }
  | { kind: 'battle'; enemies: EnemySpec[]; intro?: DialogueScript; outro?: DialogueScript }
  | { kind: 'boss'; enemies: EnemySpec[]; intro?: DialogueScript; outro?: DialogueScript };

export interface EncounterEntry {
  weight: number;
  enemies: EnemySpec[];
}

/**
 * A purely-decorative billboard placed on the floor at grid coords (x, z).
 * Decor never collides — it dresses a domain's terrain (crystals, gravestones,
 * roots, machine pylons…) without touching movement. `kind` indexes the `DECOR`
 * art table in `src/assets/art.ts`.
 */
export interface DecorSpec {
  x: number;
  z: number;
  kind: string;
  /** World height of the sprite (default 1.1). */
  height?: number;
  /** Self-illumination for glowing decor (crystals, braziers). Default 0.1. */
  emissive?: number;
}

export interface DungeonFloor {
  id: string;
  name: string;
  rows: string[];
  theme: TileTheme;
  events: Record<string, FloorEvent>;
  chests: Record<string, { credits?: number; item?: string; note: string }>;
  /** Chance per step of a random encounter (0 disables). */
  encounterRate: number;
  encounters: EncounterEntry[];
  /** Fog density multiplier, so deeper floors feel heavier. */
  fog?: number;
  /** Non-colliding decorative billboards dressing this floor's terrain. */
  decor?: DecorSpec[];
}

/** What happens when the player drives into a domain's exit portal. */
export interface DomainClear {
  /** Flag set on the run when the domain is cleared. */
  flag: string;
  /**
   * Boot Domain only: return through the licence + Guard-Team ceremony
   * (`HubScene` arrival 'domainCleared'). Other domains just restore the party
   * and drop you back in the city.
   */
  licenseCeremony?: boolean;
}

export interface Domain {
  id: string;
  name: string;
  blurb: string;
  /** Accent colour for the world-map node and its card. */
  color: string;
  /** Party level the stage is tuned for — shown on the world-map card. */
  recommendedLevel: number;
  floors: DungeonFloor[];
  startingFuel: number;
  /** Ambience track while crawling this domain (boss fights still use 'boss'). */
  music: MusicTrack;
  onClear: DomainClear;
  /** Only the tutorial lends a party; other domains use whatever you bring. */
  borrowedParty?: EnemySpec[];
}
