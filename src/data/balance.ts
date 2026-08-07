import type { DungeonFloor, Reach } from './dungeon';
import { REACHES } from './reaches';

/**
 * Balance harness — a pure, headless read on how a reach *plays* on paper, so
 * floors get tuned with numbers instead of vibes. It never launches the game;
 * it walks the same ASCII grids the crawl does and models the two economies that
 * decide whether a reach is fair: **light** (the lantern that drains one point
 * per step and gutters you home at zero) and **obols** (chest income).
 *
 * The step model is a lower bound: a shortest-path flood over pure walkable
 * geometry (locks, barriers and one-way gates treated as open), so "steps" is
 * the fewest a perfect run spends — real runs spend more. That makes the
 * light-survivability check conservative: if even the shortest path can't be lit,
 * the reach is genuinely under-budgeted. Imports no Three.js/DOM, so it runs in
 * `balance.test.ts` (which prints the report) and anywhere else.
 */

// Mirrors DungeonScene's crawl economy (kept in sync by the balance test).
const LIGHT_PER_STEP = 1;
const HAZARD_LP = 8; // extra drain crossing a '^'
const SHARD_LP = 40; // '$' light shard refill

const WALL = new Set(['#', '=', ' ']);
const DIRS = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
];

export interface FloorBalance {
  id: string;
  /** Fewest steps from the start to the descent (or the floor's depth if terminal). */
  pathSteps: number;
  hazards: number;
  shards: number;
  chestObols: number;
  chestItems: number;
  /** Expected random encounters over the shortest path. */
  expectedEncounters: number;
}

export interface ReachBalance {
  id: string;
  name: string;
  recommendedLevel: number;
  startingLight: number;
  floors: FloorBalance[];
  totalSteps: number;
  totalShards: number;
  totalHazards: number;
  totalObols: number;
  expectedEncounters: number;
  /** Light left after the shortest run, crediting shards, before any hazard drains. */
  lightMargin: number;
  /** …and the worst case, if every hazard on the way is crossed. */
  lightMarginWithHazards: number;
}

function analyzeFloor(floor: DungeonFloor): FloorBalance {
  const rows = floor.rows;
  const at = (x: number, z: number): string =>
    z < 0 || z >= rows.length || x < 0 || x >= rows[z].length ? ' ' : rows[z][x];
  const walkable = (x: number, z: number) => !WALL.has(at(x, z));

  let start: { x: number; z: number } | null = null;
  const portals: { x: number; z: number }[] = [];
  let hazards = 0;
  let shards = 0;
  for (let z = 0; z < rows.length; z++) {
    for (let x = 0; x < rows[z].length; x++) {
      const ch = at(x, z);
      if (ch === 'S') start = { x, z };
      else if (ch === '>' || ch === '<') portals.push({ x, z });
      else if (ch === '^') hazards++;
      else if (ch === '$') shards++;
    }
  }

  // BFS shortest-path distances from the start over walkable geometry.
  const dist = new Map<string, number>();
  if (start) {
    dist.set(`${start.x},${start.z}`, 0);
    const q = [start];
    for (let i = 0; i < q.length; i++) {
      const { x, z } = q[i];
      const d = dist.get(`${x},${z}`)!;
      for (const [dx, dz] of DIRS) {
        const nx = x + dx;
        const nz = z + dz;
        const k = `${nx},${nz}`;
        if (!walkable(nx, nz) || dist.has(k)) continue;
        dist.set(k, d + 1);
        q.push({ x: nx, z: nz });
      }
    }
  }
  // Steps to the nearest descent; a terminal (boss/finale) floor has none, so
  // use the floor's depth (its farthest reachable tile) as the walk length.
  let pathSteps = 0;
  if (portals.length) {
    pathSteps = Math.min(...portals.map((p) => dist.get(`${p.x},${p.z}`) ?? Number.POSITIVE_INFINITY));
    if (!Number.isFinite(pathSteps)) pathSteps = 0;
  } else {
    pathSteps = dist.size ? Math.max(...dist.values()) : 0;
  }

  const chestVals = Object.values(floor.chests ?? {});
  return {
    id: floor.id,
    pathSteps,
    hazards,
    shards,
    chestObols: chestVals.reduce((s, c) => s + (c.obols ?? 0), 0),
    chestItems: chestVals.filter((c) => c.item).length,
    expectedEncounters: +(floor.encounterRate * pathSteps).toFixed(2),
  };
}

export function analyzeReach(reach: Reach): ReachBalance {
  const floors = reach.floors.map(analyzeFloor);
  const totalSteps = floors.reduce((s, f) => s + f.pathSteps, 0);
  const totalShards = floors.reduce((s, f) => s + f.shards, 0);
  const totalHazards = floors.reduce((s, f) => s + f.hazards, 0);
  const totalObols = floors.reduce((s, f) => s + f.chestObols, 0);
  const expectedEncounters = +floors.reduce((s, f) => s + f.expectedEncounters, 0).toFixed(2);
  const lightMargin = reach.startingLight + totalShards * SHARD_LP - totalSteps * LIGHT_PER_STEP;
  return {
    id: reach.id,
    name: reach.name,
    recommendedLevel: reach.recommendedLevel,
    startingLight: reach.startingLight,
    floors,
    totalSteps,
    totalShards,
    totalHazards,
    totalObols,
    expectedEncounters,
    lightMargin,
    lightMarginWithHazards: lightMargin - totalHazards * HAZARD_LP,
  };
}

export function analyzeReaches(reaches: Record<string, Reach> = REACHES): ReachBalance[] {
  return Object.values(reaches).map(analyzeReach);
}

/** A compact one-line-per-reach report, for the balance test / tooling. */
export function balanceReport(reaches: Record<string, Reach> = REACHES): string {
  const rows = analyzeReaches(reaches).map(
    (r) =>
      `${r.id.padEnd(10)} Lv${String(r.recommendedLevel).padStart(2)}  ` +
      `light ${String(r.startingLight).padStart(3)}  steps ${String(r.totalSteps).padStart(3)}  ` +
      `shards ${r.totalShards}  margin ${String(r.lightMargin).padStart(4)} (haz ${String(r.lightMarginWithHazards).padStart(4)})  ` +
      `enc≈${r.expectedEncounters.toFixed(1)}  obols ${r.totalObols}`,
  );
  return rows.join('\n');
}
