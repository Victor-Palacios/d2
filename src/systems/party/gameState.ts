import type { CreatureInstance } from './creature';
import { makeCreature } from './creature';
import { species } from '../../data/creatures';
import { QUIET_CROSSING } from '../../data/quietCrossing';
import type { AttributeId } from '../../data/elements';
import { IMMORTALITY_POEM, IMMORTALITY_TOTAL } from '../../data/immortality';
import type { Cell } from '../battle/engine';
import { defaultFormation, cellIndex } from '../battle/engine';

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
/**
 * Hard ceiling on souls deployed at once (the 2×3 grid holds more, but the front
 * line is three columns). The live cap is `fieldCap` — one soul per human keeper
 * — and never exceeds this. `formation` is sized to this maximum.
 */
export const MAX_FIELDED = 4;
/**
 * Light Power the lantern gains, for good, each time a reach's warden is
 * satisfied — some of the boundary keeper's own light stays in your flame. This
 * bonus (`lightBonus`) rides on top of every reach's `startingLight`, so a
 * deeper lantern is carried into every crawl that follows. Granted once per
 * reach (see `DungeonScene.afterBattle`).
 */
export const LP_PER_BOSS = 20;

/** The level a freshly-bonded starting partner begins at. */
export const STARTER_LEVEL = 1;
/** The keeper's kit, granted alongside the starting partner. */
export const KEEPER_KIT = ['cinderEdge', 'paleShroud', 'quickLocket'] as const;

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
  obols = 320;
  party: CreatureInstance[] = [];
  bag: Record<string, number> = {};
  flags = new Set<string>();

  /** Light Power (LP) — the lantern's charge while crawling; each step spends 1. */
  light = QUIET_CROSSING.startingLight;
  maxLight = QUIET_CROSSING.startingLight;
  /**
   * Permanent bonus to lantern capacity, added on top of a reach's
   * `startingLight` when it is entered (see `WorldMapScene`), so it survives the
   * per-reach reset that clobbers `maxLight`. Two sources feed it: satisfying a
   * warden (`LP_PER_BOSS` each) and rendering spare souls to lamp-oil at the
   * Oilwright. Persists across reaches and saves — the lantern only grows deeper.
   */
  lightBonus = 0;

  /** Whether the Vigil has given you leave to keep past the Crossing. */
  hasLeave = false;

  /**
   * Where each fielded soul stands on the 2×3 battle grid. `formation[i]` is the
   * cell the i-th deployed soul takes (Vanguard row 0 / Rear row 1, columns
   * left→right). Defaults to the front line; the player edits it in the Party
   * screen to pull squishy casters into the covered Rear. Sized to `MAX_FIELDED`
   * (always distinct cells), so it stays valid however many souls deploy.
   */
  formation: Cell[] = defaultFormation(MAX_FIELDED);
  /** The player's own class, taken from their chosen starter at New Game. */
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
  /** Opened chests, keyed `floorId:x,z`. Permanent — see `resetCrawl`. */
  openedChests = new Set<string>();
  /** Collected light shards, keyed `floorId:x,z`. */
  takenPickups = new Set<string>();
  /** Unlocked doors, keyed `floorId:x,z` — stays open on revisit/resume. */
  openedDoors = new Set<string>();

  /** The Soularium — per-species capture progress (the game's "pokedex"). */
  soularium: Record<string, SoulEntry> = {};
  /** How many monsters fit in the active party. Upgradeable at the Soul Store. */
  partyCap = START_PARTY_CAP;
  /** Reserve monsters (the Soul Sanctuary): captured but not in the party. */
  sanctuary: CreatureInstance[] = [];
  /** Pieces of the Immortality set collected (lines of the elegy), 0..12. */
  immortality = 0;

  /**
   * Humans walking with the keeper: you (always 1) plus every story companion
   * (Wren / Sena / Kade) who has joined. Companions never fight — instead each
   * human lets you field one more soul, so this is exactly the battle field cap.
   * The Quiet Crossing has two humans (you + Wren) → two monsters on the field.
   */
  get humanCount(): number {
    return 1 + [...this.party, ...this.sanctuary].filter((c) => c.companion).length;
  }

  /** How many monsters you may field at once — one per human keeper. */
  get fieldCap(): number {
    return this.humanCount;
  }

  // --- Soularium / capture ------------------------------------------------

  /** The entry for a species, creating a blank one on first access. */
  soul(speciesId: string): SoulEntry {
    // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic lazy-init of the soul entry
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

  /**
   * Apply the state a fresh New Game produces: bond the chosen partner at the
   * starting level, take the team attribute from its species, grant the keeper's
   * kit, and mark the prologue done. This is the single source of truth for a
   * started run — `IntroScene`'s partner-select calls it, and tests/tools can
   * call it (via `window.hd2dGame.game`) to reach a playable state without
   * replaying the opening cutscene and menus.
   */
  startNewGame(partnerId: string, name?: string): void {
    if (name) this.playerName = name;
    this.party = [makeCreature(partnerId, STARTER_LEVEL)];
    this.teamAttribute = species(partnerId).attribute;
    for (const item of KEEPER_KIT) this.addItem(item);
    this.set('prologueDone');
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

  /** Souls (non-companion creatures) currently in the active party. */
  soulsInParty(): number {
    return this.party.filter((c) => !c.companion).length;
  }

  /** Adds a creature to the party if there's room, else the Sanctuary. */
  addMonster(c: CreatureInstance): boolean {
    // `partyCap` counts souls only — companions ride along for free.
    if (this.soulsInParty() < this.partyCap) {
      this.party.push(c);
      return true;
    }
    this.sanctuary.push(c);
    return false;
  }

  /** Send a party member to the Sanctuary. Refuses to bench a companion or the last fighting monster. */
  partyToSanctuary(uid: string): boolean {
    const i = this.party.findIndex((c) => c.uid === uid);
    if (i < 0) return false;
    if (this.party[i].companion) return false; // companions are permanent
    // Keep at least one soul to field — companions do not fight in their place.
    if (this.party.filter((c) => !c.companion).length <= 1) return false;
    this.sanctuary.push(this.party.splice(i, 1)[0]);
    return true;
  }

  /**
   * Permanently remove a soul from the roster — the Oilwright renders it into
   * lamp-oil. Mirrors `partyToSanctuary`'s guards: never a companion, and never
   * the last fighting soul. Checks the party first, then the Sanctuary. Returns
   * the consumed creature (for the UI to report its level), or null if refused.
   */
  consumeSoul(uid: string): CreatureInstance | null {
    const pi = this.party.findIndex((c) => c.uid === uid);
    if (pi >= 0) {
      if (this.party[pi].companion) return null; // companions are never spent for light
      if (this.party.filter((c) => !c.companion).length <= 1) return null; // keep one fighter
      return this.party.splice(pi, 1)[0];
    }
    const si = this.sanctuary.findIndex((c) => c.uid === uid);
    if (si >= 0) {
      if (this.sanctuary[si].companion) return null;
      return this.sanctuary.splice(si, 1)[0];
    }
    return null;
  }

  /**
   * A story companion (Wren / Sena / Kade) joins the party for good. Companions
   * do not fight and do not count against `partyCap` (which governs souls), so
   * they simply fall in — a captured soul is never crowded out. Idempotent by
   * speciesId, so re-firing a join beat is harmless.
   */
  joinCompanion(c: CreatureInstance): void {
    if ([...this.party, ...this.sanctuary].some((m) => m.companion && m.speciesId === c.speciesId)) return;
    c.companion = true;
    this.party.push(c);
  }

  /** Bring a Sanctuary member into the party, if there's a free soul slot. */
  sanctuaryToParty(uid: string): boolean {
    if (this.soulsInParty() >= this.partyCap) return false;
    const i = this.sanctuary.findIndex((c) => c.uid === uid);
    if (i < 0) return false;
    this.party.push(this.sanctuary.splice(i, 1)[0]);
    return true;
  }

  /**
   * Move a party member up (delta -1) or down (delta +1) in the party order.
   * Order matters: the first living souls (up to `fieldCap`, one per human) are
   * the ones fielded, in formation order, so this is how the player arranges who
   * fights and where. Companions hold their place in the roster but never field.
   */
  reorderParty(uid: string, delta: number): boolean {
    const i = this.party.findIndex((c) => c.uid === uid);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= this.party.length) return false;
    [this.party[i], this.party[j]] = [this.party[j], this.party[i]];
    return true;
  }

  // --- Formation ----------------------------------------------------------

  /** The fighting souls (non-companions) in party order — companions never field. */
  souls(): CreatureInstance[] {
    return this.party.filter((c) => !c.companion);
  }

  /**
   * How many souls actually deploy: the field cap (one per human keeper), capped
   * by the hard `MAX_FIELDED` ceiling and by how many souls you actually have.
   */
  fieldedCount(): number {
    return Math.min(this.soulsInParty(), this.fieldCap, MAX_FIELDED);
  }

  /** The fielded slot standing on `cell`, or -1 if that cell is empty. */
  slotAtCell(cell: Cell): number {
    const idx = cellIndex(cell);
    const n = this.fieldedCount();
    for (let i = 0; i < n; i++) if (cellIndex(this.formation[i]) === idx) return i;
    return -1;
  }

  /**
   * Move a fielded `slot` onto `cell`. Whichever slot currently holds that cell
   * trades places — and that is checked across ALL `MAX_FIELDED` slots, not just
   * the fielded ones, so every stored cell stays distinct. That matters because
   * `fieldCap` can grow when a companion joins: a slot that was idle becomes
   * fielded, and it must never share a cell with an already-fielded one.
   */
  moveFormationSlot(slot: number, cell: Cell): boolean {
    if (slot < 0 || slot >= this.fieldedCount()) return false;
    if (cellIndex(this.formation[slot]) === cellIndex(cell)) return false;
    const idx = cellIndex(cell);
    for (let i = 0; i < this.formation.length; i++) {
      if (i !== slot && cellIndex(this.formation[i]) === idx) {
        this.formation[i] = { ...this.formation[slot] };
        break;
      }
    }
    this.formation[slot] = { row: cell.row, col: cell.col };
    return true;
  }

  /**
   * Reorder two souls by their soul-order index (fielding a benched soul, or
   * reordering the reserve), keeping companions in their roster place. Formation
   * cells belong to the slot, not the soul, so a soul that lands in a fielded
   * slot inherits that slot's grid position.
   */
  swapSouls(a: number, b: number): boolean {
    const souls = this.souls();
    if (a === b || a < 0 || b < 0 || a >= souls.length || b >= souls.length) return false;
    const ia = this.party.indexOf(souls[a]);
    const ib = this.party.indexOf(souls[b]);
    [this.party[ia], this.party[ib]] = [this.party[ib], this.party[ia]];
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
    this.light = this.maxLight;
    this.floorIndex = 0;
    this.usedEvents.clear();
    // NOTE: openedChests is deliberately NOT cleared. A chest's treasure is a
    // one-time reward: once looted it stays empty for good, even after leaving
    // and re-entering the reach — otherwise obols could be farmed by re-running
    // a floor. It rides in every autosave (via `snapshot`), so the emptied state
    // persists across sessions. Events, light shards and doors do repeat per
    // crawl (re-fight, re-collect light, re-open the way through), so they reset.
    this.takenPickups.clear();
    this.openedDoors.clear();
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
