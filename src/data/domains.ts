import type { Domain } from './dungeon';
import { QUIET_CROSSING } from './quietCrossing';
import { CRYSTAL_CAVERN } from './crystalCavern';
import { JUNGLE_DOMAIN } from './jungleDomain';
import { HAUNTED_DUNGEON } from './hauntedDungeon';

/**
 * The domain registry. Adding a dungeon = author its data file, export a
 * `Domain`, and register it here. Scenes look domains up by id
 * (`game.activeDomainId`) so nothing else needs to change. See `docs/ROADMAP.md`.
 */
export const DOMAINS: Record<string, Domain> = {
  crossing: QUIET_CROSSING,
  crystal: CRYSTAL_CAVERN,
  jungle: JUNGLE_DOMAIN,
  haunted: HAUNTED_DUNGEON,
};

/** Order the domains appear on the world map (after The Everwake). */
export const DOMAIN_ORDER = ['crossing', 'crystal', 'jungle', 'haunted'];

export function domain(id: string): Domain {
  const d = DOMAINS[id];
  if (!d) throw new Error(`Unknown domain: ${id}`);
  return d;
}
