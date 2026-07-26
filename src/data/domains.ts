import type { Domain } from './dungeon';
import { BOOT_DOMAIN } from './bootDomain';
import { CRYSTAL_CAVERN } from './crystalCavern';
import { HAUNTED_DUNGEON } from './hauntedDungeon';

/**
 * The domain registry. Adding a dungeon = author its data file, export a
 * `Domain`, and register it here. Scenes look domains up by id
 * (`game.activeDomainId`) so nothing else needs to change. See `docs/ROADMAP.md`.
 */
export const DOMAINS: Record<string, Domain> = {
  boot: BOOT_DOMAIN,
  crystal: CRYSTAL_CAVERN,
  haunted: HAUNTED_DUNGEON,
};

/** Order the domains appear on the world map (after Digital City). */
export const DOMAIN_ORDER = ['boot', 'crystal', 'haunted'];

export function domain(id: string): Domain {
  const d = DOMAINS[id];
  if (!d) throw new Error(`Unknown domain: ${id}`);
  return d;
}
