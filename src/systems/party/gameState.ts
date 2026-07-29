import type { CreatureInstance } from './creature';
import { makeCreature } from './creature';
import { QUIET_CROSSING } from '../../data/quietCrossing';
import type { AttributeId } from '../../data/elements';
import { IMMORTALITY_POEM, IMMORTALITY_TOTAL } from '../../data/immortality';

/**
 * Soul Syphon capture tuning. An *encounter* primes a wild species to
 * SYPHON_PRIME; a *hit* adds SYPHON_HIT. Capture triggers when a hit pushes the
 * total to 100. For now every monster needs one encounter + one hit — later,
 * rarer species can lower these gains so they take more of both. These are the
 * only knobs; nothing else hard-codes the numbers.
 */
export const SYPHON_PRIME = 50;
export const SYPHON_HIT = 50;
/** Party size: starts here, upgradeable one slot at a time up to the cap. */
export const START_PARTY_CAP = 4;
export const MAX_PARTY_CAP = 10;

/** A species' entry in the Soularium (the capture dex). */
export interface SoulEntry {
  /** 0..100. At 100 the species is captured. */
  syphon: number;
  /** Logged: you have syphoned it once and can now buy it at the Soul Store. */
  captured: boolean;
  /** Encountered at least once (shows in the dex even before capture). */
  seen: boolean;
}

/** What a capture produced, so the battle scene can announce it. */
export interface CaptureResult {
  speciesId: string;
  creature: CreatureInstance;
  /** false when the party was full and it went to the Soul Sanctuary. */
  toParty: boolean;
}

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
  fuel = QUIET_CROSSING.startingFuel;
  maxFuel = QUIET_CROSSING.startingFuel;

  hasLicense = false;
  hasOwnVehicle = false;
  teamId: string | null = null;
  teamAttribute: AttributeId | null = null;

  /** Which reach the crawl scene is currently in (key into REACHES). */
  activeReachId = 'crossing';
  /** Floor index inside the active reach. */
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

  /** The Soularium — per-species capture progress (the game's "pokedex"). */
  soularium: Record<string, SoulEntry> = {};
  /** How many monsters fit in the active party. Upgradeable at the Soul Store. */
  partyCap = START_PARTY_CAP;
  /** Reserve monsters (the Soul Sanctuary): captured but not in the party. */
  sanctuary: CreatureInstance[] = [];
  /** Pieces of the Immortality set collected (lines of the elegy), 0..12. */
  immortality = 0;

  // --- Soularium / capture ------------------------------------------------

  /** The entry for a species, creating a blank one on first access. */
  soul(speciesId: string): SoulEntry {
    return (this.soularium[speciesId] ??= { syphon: 0, captured: false, seen: false });
  }

  /** Encountering a wild species primes its syphon (never captures on its own). */
  noteEncounter(speciesId: string) {
    const e = this.soul(speciesId);
    if (e.captured) return;
    e.seen = true;
    e.syphon = Math.max(e.syphon, SYPHON_PRIME);
  }

  /**
   * A hit on a wild species raises its syphon meter. The *capture* itself is
   * only finalized on victory (see `finalizeCaptures`), so losing the fight
   * means you claim nothing. Returns true if this hit just filled the meter to
   * 100% (ready to claim), so the scene can announce it.
   */
  syphonHit(speciesId: string): boolean {
    const e = this.soul(speciesId);
    if (e.captured) return false;
    const was = e.syphon;
    e.seen = true;
    e.syphon = Math.min(100, e.syphon + SYPHON_HIT);
    return was < 100 && e.syphon >= 100;
  }

  /**
   * Commune resolution: a wild soul talked into peace is *understood*, which
   * fills its syphon exactly like a full drain would. The claim itself still
   * happens on victory (`finalizeCaptures`), so this is the gentle, no-damage
   * path to the same reward.
   */
  understandSoul(speciesId: string) {
    const e = this.soul(speciesId);
    if (e.captured) return;
    e.seen = true;
    e.syphon = 100;
  }

  /** True once a wild species' syphon is full but it hasn't been claimed yet. */
  syphonReady(speciesId: string): boolean {
    const e = this.soul(speciesId);
    return !e.captured && e.syphon >= 100;
  }

  /** Logs a species as captured and grants one free copy. */
  captureSpecies(speciesId: string, level: number): CaptureResult {
    const e = this.soul(speciesId);
    e.captured = true;
    e.seen = true;
    e.syphon = 100;
    const creature = makeCreature(speciesId, level);
    const toParty = this.addMonster(creature);
    return { speciesId, creature, toParty };
  }

  /** Adds a creature to the party if there's room, else the Sanctuary. */
  addMonster(c: CreatureInstance): boolean {
    if (this.party.length < this.partyCap) {
      this.party.push(c);
      return true;
    }
    this.sanctuary.push(c);
    return false;
  }

  /** Send a party member to the Sanctuary. Refuses to empty the party. */
  partyToSanctuary(uid: string): boolean {
    if (this.party.length <= 1) return false;
    const i = this.party.findIndex((c) => c.uid === uid);
    if (i < 0) return false;
    this.sanctuary.push(this.party.splice(i, 1)[0]);
    return true;
  }

  /** Bring a Sanctuary member into the party, if there's a free slot. */
  sanctuaryToParty(uid: string): boolean {
    if (this.party.length >= this.partyCap) return false;
    const i = this.sanctuary.findIndex((c) => c.uid === uid);
    if (i < 0) return false;
    this.party.push(this.sanctuary.splice(i, 1)[0]);
    return true;
  }

  /**
   * Move a party member up (delta -1) or down (delta +1) in the party order.
   * Order matters: the first three living members are the ones fielded, in
   * formation order, so this is how the player arranges who fights and where.
   */
  reorderParty(uid: string, delta: number): boolean {
    const i = this.party.findIndex((c) => c.uid === uid);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= this.party.length) return false;
    [this.party[i], this.party[j]] = [this.party[j], this.party[i]];
    return true;
  }

  /**
   * Awards the next Immortality piece (in poem order). Returns the line granted
   * and its number, or null if the set is already complete. Completing the set
   * (all twelve) drops the Immortality Memento into the bag.
   */
  grantImmortalityPiece(): { index: number; line: string } | null {
    if (this.immortality >= IMMORTALITY_TOTAL) return null;
    const index = this.immortality;
    const line = IMMORTALITY_POEM[index];
    this.immortality++;
    if (this.immortality >= IMMORTALITY_TOTAL) this.addItem('immortalityMemento');
    return { index, line };
  }

  /** Buy one more party slot, up to the cap. Returns false if already maxed. */
  gainPartySlot(): boolean {
    if (this.partyCap >= MAX_PARTY_CAP) return false;
    this.partyCap++;
    return true;
  }

  addItem(id: string, n = 1) {
    this.bag[id] = (this.bag[id] ?? 0) + n;
  }

  /** Removes up to `n` of an item; returns true if at least one was taken. */
  takeItem(id: string, n = 1): boolean {
    const have = this.bag[id] ?? 0;
    if (have < 1) return false;
    const left = have - n;
    if (left > 0) this.bag[id] = left;
    else delete this.bag[id];
    return true;
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
