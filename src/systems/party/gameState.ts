import type { CreatureInstance } from './creature';
import { makeCreature } from './creature';
import { BOOT_DOMAIN } from '../../data/bootDomain';
import type { AttributeId } from '../../data/elements';

/**
 * The single mutable run state. Scenes read and write this; it is deliberately
 * plain data so a save/load layer would be a JSON round-trip.
 */
export class GameState {
  playerName = 'REN';
  credits = 320;
  party: CreatureInstance[] = [];
  bag: Record<string, number> = {};
  flags = new Set<string>();

  /** Vehicle fuel while crawling (plan §5.5). */
  fuel = BOOT_DOMAIN.startingFuel;
  maxFuel = BOOT_DOMAIN.startingFuel;

  hasLicense = false;
  hasOwnVehicle = false;
  teamId: string | null = null;
  teamAttribute: AttributeId | null = null;

  /** Floor index inside the active domain. */
  floorIndex = 0;
  /** Where the crawl resumes after a battle. */
  crawl = {
    floorIndex: 0,
    x: 0,
    z: 0,
    facing: 'down' as 'up' | 'down' | 'left' | 'right',
    initialized: false,
  };
  /** Event ids already consumed, keyed `floorId:eventId`. */
  usedEvents = new Set<string>();
  /** Opened chests, keyed `floorId:x,z`. */
  openedChests = new Set<string>();
  /** Collected fuel cans, keyed `floorId:x,z`. */
  takenPickups = new Set<string>();

  /** Loads the mentor's borrowed trio for the tutorial crawl. */
  lendTutorialParty() {
    this.party = BOOT_DOMAIN.borrowedParty.map((e) => makeCreature(e.species, e.level));
  }

  addItem(id: string, n = 1) {
    this.bag[id] = (this.bag[id] ?? 0) + n;
  }

  itemCount(id: string): number {
    return this.bag[id] ?? 0;
  }

  resetCrawl() {
    this.fuel = this.maxFuel;
    this.floorIndex = 0;
    this.usedEvents.clear();
    this.openedChests.clear();
    this.takenPickups.clear();
    this.crawl.initialized = false;
  }

  set(flag: string) {
    this.flags.add(flag);
  }

  has(flag: string): boolean {
    return this.flags.has(flag);
  }
}

export const game = new GameState();
