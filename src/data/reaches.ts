import type { Reach } from './dungeon';
import { QUIET_CROSSING } from './quietCrossing';
import { CRYSTAL_CAVERN } from './crystalCavern';
import { JUNGLE_REACH } from './jungleReach';
import { HAUNTED_DUNGEON } from './hauntedDungeon';

/**
 * The reach registry. Adding a dungeon = author its data file, export a
 * `Reach`, and register it here. Scenes look reaches up by id
 * (`game.activeReachId`) so nothing else needs to change. See `docs/ROADMAP.md`.
 */
export const REACHES: Record<string, Reach> = {
  crossing: QUIET_CROSSING,
  crystal: CRYSTAL_CAVERN,
  jungle: JUNGLE_REACH,
  haunted: HAUNTED_DUNGEON,
};

/** Order the reaches appear on the world map (after The Everwake). */
export const REACH_ORDER = ['crossing', 'crystal', 'jungle', 'haunted'];

export function reach(id: string): Reach {
  const d = REACHES[id];
  if (!d) throw new Error(`Unknown reach: ${id}`);
  return d;
}
