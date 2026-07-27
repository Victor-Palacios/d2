import type { Domain, DungeonFloor } from './dungeon';
import { DOMAINS } from './domains';
import { DECOR } from '../assets/art';

/**
 * Pure structural validator for every domain's floor data.
 *
 * There is no scene editor here — floors are hand-authored ASCII grids, and the
 * bugs that hurt are silent: a chest key that no longer lands on its `C`, an
 * event tile with no entry in the `events` map, a portal walled off from the
 * start, a decor billboard floating inside a wall. This walks the grids and
 * reports all of that. It imports no Three.js/DOM, so it runs anywhere (and is
 * exercised by `tools/smoke/terrain.mjs` against the live, bundled data).
 */

const ELEMENT_CHARS = new Set(['W', 'F', 'N', 'M', 'D']);
const WALL_CHARS = new Set(['#', '=', ' ']);

interface Coord {
  x: number;
  z: number;
}

export function validateFloor(floor: DungeonFloor): string[] {
  const errs: string[] = [];
  const rows = floor.rows;
  if (!rows.length) {
    errs.push('floor has no rows');
    return errs;
  }
  const width = rows[0].length;
  rows.forEach((r, i) => {
    if (r.length !== width) errs.push(`row ${i} width ${r.length} != ${width}`);
  });

  const at = (x: number, z: number): string =>
    z < 0 || z >= rows.length || x < 0 || x >= rows[z].length ? ' ' : rows[z][x];
  const walkable = (x: number, z: number): boolean => !WALL_CHARS.has(at(x, z));

  let start: Coord | null = null;
  let starts = 0;
  const eventTiles: Record<string, Coord> = {};
  const chestTiles: Coord[] = [];
  const reachTargets: Coord[] = [];

  for (let z = 0; z < rows.length; z++) {
    for (let x = 0; x < rows[z].length; x++) {
      const ch = at(x, z);
      if (ch === 'S') {
        start = { x, z };
        starts++;
      } else if (ch >= '1' && ch <= '9') {
        eventTiles[ch] = { x, z };
        reachTargets.push({ x, z });
      } else if (ch === 'C') {
        chestTiles.push({ x, z });
        reachTargets.push({ x, z });
      } else if (ch === '$' || ch === '>' || ch === '<' || ELEMENT_CHARS.has(ch)) {
        reachTargets.push({ x, z });
      }
    }
  }

  if (starts !== 1) errs.push(`expected exactly 1 start tile, found ${starts}`);

  // events map <-> event tiles
  for (const id of Object.keys(floor.events)) {
    if (!eventTiles[id]) errs.push(`event '${id}' in events map has no tile in the grid`);
  }
  for (const id of Object.keys(eventTiles)) {
    if (!floor.events[id]) errs.push(`event tile '${id}' has no entry in the events map`);
  }

  // chest keys must land on C tiles, and every C must have a loot entry
  const chestKeys = new Set(Object.keys(floor.chests ?? {}));
  for (const key of chestKeys) {
    const [x, z] = key.split(',').map(Number);
    if (at(x, z) !== 'C') errs.push(`chest key '${key}' is not a C tile (found '${at(x, z)}')`);
  }
  for (const c of chestTiles) {
    if (!chestKeys.has(`${c.x},${c.z}`)) errs.push(`C tile at ${c.x},${c.z} has no chest entry`);
  }

  // non-boss floors need a way down
  const isBoss = Object.values(floor.events).some((e) => e.kind === 'boss');
  const hasPortal = rows.some((r) => r.includes('>') || r.includes('<'));
  if (!isBoss && !hasPortal) errs.push('non-boss floor has no descent/exit portal');

  // reachability: flood-fill walkable tiles from the start
  if (start) {
    const seen = new Set<string>([`${start.x},${start.z}`]);
    const stack: Coord[] = [start];
    while (stack.length) {
      const { x, z } = stack.pop()!;
      for (const [dx, dz] of [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
      ]) {
        const nx = x + dx;
        const nz = z + dz;
        const k = `${nx},${nz}`;
        if (!seen.has(k) && walkable(nx, nz)) {
          seen.add(k);
          stack.push({ x: nx, z: nz });
        }
      }
    }
    for (const t of reachTargets) {
      if (!seen.has(`${t.x},${t.z}`)) {
        errs.push(`tile at ${t.x},${t.z} ('${at(t.x, t.z)}') is unreachable from the start`);
      }
    }
  }

  // decor: in bounds, on a walkable tile, and a known kind
  for (const d of floor.decor ?? []) {
    if (d.z < 0 || d.z >= rows.length || d.x < 0 || d.x >= width) {
      errs.push(`decor '${d.kind}' at ${d.x},${d.z} is out of bounds`);
    } else if (!walkable(d.x, d.z)) {
      errs.push(`decor '${d.kind}' at ${d.x},${d.z} sits on a non-walkable tile '${at(d.x, d.z)}'`);
    }
    if (!(d.kind in DECOR)) errs.push(`decor kind '${d.kind}' has no art in DECOR`);
  }

  return errs;
}

/**
 * Validates every floor of every domain. Returns a flat list of
 * `"<domain>/<floor>: <error>"` strings — empty means everything is consistent.
 */
export function validateDomains(domains: Record<string, Domain> = DOMAINS): string[] {
  const out: string[] = [];
  for (const [domId, dom] of Object.entries(domains)) {
    dom.floors.forEach((floor) => {
      for (const err of validateFloor(floor)) out.push(`${domId}/${floor.id}: ${err}`);
    });
  }
  return out;
}
