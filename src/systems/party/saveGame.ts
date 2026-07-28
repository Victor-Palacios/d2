import type { CreatureInstance } from './creature';
import { game, START_PARTY_CAP } from './gameState';
import type { AttributeId } from '../../data/elements';

/**
 * Saving.
 *
 * Two kinds, deliberately different in weight:
 *
 * - **Autosave** — written at safe points (arriving in the city, taking the
 *   world map, after the licence/team beats). This is your progress.
 * - **Suspend save** — written on demand *inside* a dungeon so you can stop
 *   mid-crawl, and **deleted the moment it is loaded**. It is a bookmark, not a
 *   checkpoint: you cannot reload it to retry a fight that went badly, which
 *   keeps the run-out-of-EP tow penalty meaningful.
 *
 * `GameState` is plain data by design, so this is a straight field copy. The
 * only wrinkles are the four `Set`s (stored as arrays) and a `version` guard so
 * a future schema change discards stale saves instead of crashing on them.
 */

export const SAVE_VERSION = 6;
/**
 * Oldest save this build can still read. Normally we keep this at 1 because
 * changes are additive, but v5/v6 renamed the tutorial reach's id and clear
 * flag, and the persisted `activeReachId` field. An older save carries an id
 * that no longer resolves and would throw, so this is a genuinely breaking
 * change: drop anything older and start fresh.
 */
export const MIN_SAVE_VERSION = 6;

const AUTO_KEY = 'hd2d.save.auto';
const SUSPEND_KEY = 'hd2d.save.suspend';

export type SaveKind = 'auto' | 'suspend';

export interface SaveData {
  version: number;
  kind: SaveKind;
  savedAt: number;
  /** Scene to resume into. */
  scene: 'hub' | 'dungeon' | 'worldmap';
  label: string;
  state: {
    playerName: string;
    credits: number;
    party: CreatureInstance[];
    bag: Record<string, number>;
    flags: string[];
    fuel: number;
    maxFuel: number;
    hasLicense: boolean;
    hasOwnVehicle: boolean;
    teamId: string | null;
    teamAttribute: AttributeId | null;
    activeReachId: string;
    floorIndex: number;
    crawl: typeof game.crawl;
    usedEvents: string[];
    openedChests: string[];
    takenPickups: string[];
    soularium: typeof game.soularium;
    partyCap: number;
    sanctuary: CreatureInstance[];
    immortality: number;
  };
}

function storage(): Storage | null {
  try {
    // Safari private browsing and some embeds throw on access.
    return window.localStorage;
  } catch {
    return null;
  }
}

export function snapshot(kind: SaveKind, scene: SaveData['scene'], label: string): SaveData {
  return {
    version: SAVE_VERSION,
    kind,
    savedAt: Date.now(),
    scene,
    label,
    state: {
      playerName: game.playerName,
      credits: game.credits,
      party: JSON.parse(JSON.stringify(game.party)) as CreatureInstance[],
      bag: { ...game.bag },
      flags: [...game.flags],
      fuel: game.fuel,
      maxFuel: game.maxFuel,
      hasLicense: game.hasLicense,
      hasOwnVehicle: game.hasOwnVehicle,
      teamId: game.teamId,
      teamAttribute: game.teamAttribute,
      activeReachId: game.activeReachId,
      floorIndex: game.floorIndex,
      crawl: { ...game.crawl },
      usedEvents: [...game.usedEvents],
      openedChests: [...game.openedChests],
      takenPickups: [...game.takenPickups],
      soularium: JSON.parse(JSON.stringify(game.soularium)),
      partyCap: game.partyCap,
      sanctuary: JSON.parse(JSON.stringify(game.sanctuary)) as CreatureInstance[],
      immortality: game.immortality,
    },
  };
}

function write(key: string, data: SaveData): boolean {
  const s = storage();
  if (!s) return false;
  try {
    s.setItem(key, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

function read(key: string): SaveData | null {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    // Migrate forward, don't discard. Every schema change so far has been
    // additive, and `applySave` fills any missing field with a sensible default
    // — so an older save loads fine. Only drop a save that is corrupt/unversioned
    // or was written by a *newer* build than this one (which we can't safely
    // read). Bumping SAVE_VERSION for an additive change must NOT wipe progress.
    const v = data?.version;
    if (typeof v !== 'number' || v < MIN_SAVE_VERSION || v > SAVE_VERSION) {
      s.removeItem(key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function saveAuto(scene: SaveData['scene'], label: string): boolean {
  return write(AUTO_KEY, snapshot('auto', scene, label));
}

export function saveSuspend(scene: SaveData['scene'], label: string): boolean {
  return write(SUSPEND_KEY, snapshot('suspend', scene, label));
}

export const loadAuto = (): SaveData | null => read(AUTO_KEY);
export const loadSuspend = (): SaveData | null => read(SUSPEND_KEY);

export function clearSuspend() {
  storage()?.removeItem(SUSPEND_KEY);
}

export function clearAll() {
  const s = storage();
  s?.removeItem(AUTO_KEY);
  s?.removeItem(SUSPEND_KEY);
}

/**
 * The save the title screen should offer. A suspend save always wins — it is
 * strictly newer than the autosave that preceded it.
 */
export function bestSave(): SaveData | null {
  return loadSuspend() ?? loadAuto();
}

/** Pushes a save back into the live `game` object. */
export function applySave(data: SaveData) {
  const s = data.state;
  game.playerName = s.playerName;
  game.credits = s.credits;
  game.party = s.party;
  game.bag = { ...s.bag };
  game.flags = new Set(s.flags);
  game.fuel = s.fuel;
  game.maxFuel = s.maxFuel;
  game.hasLicense = s.hasLicense;
  game.hasOwnVehicle = s.hasOwnVehicle;
  game.teamId = s.teamId;
  game.teamAttribute = s.teamAttribute;
  game.activeReachId = s.activeReachId ?? 'crossing';
  game.floorIndex = s.floorIndex;
  game.crawl = { ...s.crawl };
  game.usedEvents = new Set(s.usedEvents);
  game.openedChests = new Set(s.openedChests);
  game.takenPickups = new Set(s.takenPickups);
  game.soularium = s.soularium ?? {};
  game.partyCap = s.partyCap ?? START_PARTY_CAP;
  game.sanctuary = s.sanctuary ?? [];
  game.immortality = s.immortality ?? 0;
  // Saves from before the leveling / equipment systems won't have these fields.
  for (const c of [...game.party, ...game.sanctuary]) {
    if (c.xp === undefined) c.xp = 0;
    if (!c.equip) c.equip = {};
  }

  // A suspend save is a bookmark, not a checkpoint: consume it on load so it
  // cannot be reloaded to undo whatever happens next.
  if (data.kind === 'suspend') clearSuspend();
}

/** Human-readable age, for the title screen. */
export function describeSave(data: SaveData): string {
  const mins = Math.floor((Date.now() - data.savedAt) / 60000);
  const when =
    mins < 1 ? 'just now' : mins < 60 ? `${mins} min ago` : `${Math.floor(mins / 60)} h ago`;
  return `${data.label} · ${when}`;
}
