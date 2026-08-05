/**
 * Room-template library — an authoring aid for hand-built floors.
 *
 * Floors are ASCII grids (`DungeonFloor.rows`), and the bugs that hurt most are
 * structural: a room left un-enclosed, an opening that doesn't line up with the
 * corridor meant to reach it, a wall miscounted by one so the grid isn't
 * rectangular. This module gives authors a set of known-good room *stamps* and a
 * tiny composer to lay them onto a canvas, so a new floor is assembled from
 * pieces that are already square and already walled — the composer keeps every
 * row the same width, and `validateFloor` (see `validateReaches.ts`) still has
 * the final say on reachability.
 *
 * It is purely optional: authors can still write raw `rows` literals. Nothing
 * here imports Three.js/DOM, so it runs in tests, the preview tool, and the
 * browser alike. The glyphs are the same tile grammar `TileGrid.parse` reads.
 */

/**
 * A cell that "sees through" to whatever is already on the canvas — so a room
 * with a non-rectangular footprint (a cross, an L) leaves the surrounding fill
 * untouched instead of punching walls into it.
 */
export const TRANSPARENT = '~';

/** A rectangular grid of `fill` (walls by default), `w` wide and `h` tall. */
export function blankCanvas(w: number, h: number, fill = '#'): string[] {
  if (w <= 0 || h <= 0) return [];
  return Array.from({ length: h }, () => fill.repeat(w));
}

/**
 * Overlays `block` onto `canvas` with its top-left at (x, z), returning a new
 * grid (immutable — good for chaining). `TRANSPARENT` cells in the block pass
 * through to the canvas; any block cell that falls outside the canvas is
 * dropped, so a stamp near an edge clips instead of throwing. The canvas keeps
 * its dimensions, so the result is always as rectangular as the canvas was.
 */
export function stamp(canvas: string[], block: string[], x: number, z: number): string[] {
  return canvas.map((row, cz) => {
    const bz = cz - z;
    if (bz < 0 || bz >= block.length) return row;
    const bRow = block[bz];
    const cells = row.split('');
    for (let bx = 0; bx < bRow.length; bx++) {
      const cx = x + bx;
      if (cx < 0 || cx >= cells.length) continue;
      const ch = bRow[bx];
      if (ch === TRANSPARENT) continue;
      cells[cx] = ch;
    }
    return cells.join('');
  });
}

/** Writes a single glyph at (x, z) — a 1×1 stamp, for placing S/>/C and doorways. */
export function put(canvas: string[], x: number, z: number, ch: string): string[] {
  return stamp(canvas, [ch], x, z);
}

/** Carves a floor tile at (x, z) — the usual way to punch a doorway in a wall. */
export function carve(canvas: string[], x: number, z: number): string[] {
  return put(canvas, x, z, '.');
}

interface Placement {
  room: string;
  x: number;
  z: number;
}

/**
 * Convenience: a fresh `w × h` canvas with each named room stamped in order.
 * Later placements overwrite earlier ones where they overlap (so shared walls
 * line up). Authors typically follow this with `carve`/`put` to open doorways
 * between rooms and drop the start, portal and loot.
 */
export function compose(w: number, h: number, placements: Placement[], fill = '#'): string[] {
  let canvas = blankCanvas(w, h, fill);
  for (const p of placements) {
    const room = ROOMS[p.room];
    if (!room) throw new Error(`compose: unknown room template '${p.room}'`);
    canvas = stamp(canvas, room, p.x, p.z);
  }
  return canvas;
}

/**
 * Curated, reusable rooms. Each is rectangular and fully walled with `#`; the
 * `.` interior is where the party walks. Rooms deliberately ship *closed* — the
 * author carves the doorways they want with `carve`, so no template can create
 * an accidental opening. `~` marks a see-through footprint (the cross/alcove).
 */
export const ROOMS: Record<string, string[]> = {
  // A plain 5×5 chamber. The building block most rooms start from.
  hall: ['#####', '#...#', '#...#', '#...#', '#####'],

  // A wider 7×5 hall with two pillars — a colonnade for a boss approach or a
  // room that should read as grand without being empty.
  pillars: ['#######', '#.....#', '#.#.#.#', '#.....#', '#######'],

  // A 3×5 dead-end nook, sized for a single reward (drop a 'C' in the middle).
  // Carve its one doorway on whichever side the corridor meets it.
  alcove: ['###', '#.#', '#C#', '#.#', '###'],

  // A +-shaped junction with see-through corners, for wiring four corridors
  // together without boxing in the diagonals.
  cross: ['~#.#~', '#...#', '.....', '#...#', '~#.#~'],

  // A small 5×5 vault fronted by a locked door ('+') — stamp it, then place the
  // key ('k') somewhere reachable elsewhere on the floor.
  vault: ['#####', '#...#', '#.C.#', '#...#', '##+##'],
};
