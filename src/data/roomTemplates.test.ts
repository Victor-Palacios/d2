import { describe, expect, it } from 'vitest';
import type { DungeonFloor } from './dungeon';
import { validateFloor } from './validateReaches';
import { ROOMS, TRANSPARENT, blankCanvas, carve, compose, put, room, stamp } from './roomTemplates';
import { REACHES } from './reaches';

// The composer is an authoring aid: it must keep grids rectangular and lay rooms
// down predictably, and a floor built from it must pass the same `validateFloor`
// that guards hand-written rows. These tests lock both.

describe('roomTemplates primitives', () => {
  it('blankCanvas is rectangular and filled', () => {
    const c = blankCanvas(4, 3);
    expect(c).toEqual(['####', '####', '####']);
  });

  it('stamp overlays a block at an offset and stays rectangular', () => {
    const c = stamp(blankCanvas(5, 5), ROOMS.hall, 0, 0);
    expect(c).toEqual(ROOMS.hall);
    expect(new Set(c.map((r) => r.length))).toEqual(new Set([5]));
  });

  it('TRANSPARENT cells see through to the canvas', () => {
    const c = stamp(blankCanvas(3, 1, '.'), [`a${TRANSPARENT}b`], 0, 0);
    expect(c).toEqual(['a.b']);
  });

  it('clips a block that overhangs the canvas edge instead of throwing', () => {
    const c = stamp(blankCanvas(3, 3, '.'), ROOMS.hall, 2, 2);
    // Only the block's top-left corner lands on the canvas (3×3, stamped at 2,2).
    expect(c.map((r) => r.length)).toEqual([3, 3, 3]);
    expect(c[2][2]).toBe('#');
  });

  it('put and carve write single cells', () => {
    let c = blankCanvas(3, 3);
    c = put(c, 1, 1, 'S');
    c = carve(c, 1, 2);
    expect(c[1][1]).toBe('S');
    expect(c[2][1]).toBe('.');
  });

  it('room builds an arbitrary walled box', () => {
    expect(room(4, 3)).toEqual(['####', '#..#', '####']);
    expect(room(5, 4, '=')).toEqual(['=====', '=...=', '=...=', '=====']);
  });

  it('compose throws on an unknown room name', () => {
    expect(() => compose(5, 5, [{ room: 'nope', x: 0, z: 0 }])).toThrow(/unknown room template/);
  });
});

describe('template composition in production', () => {
  it('reproduces the shipped Warden Hall (crossing-3) byte-for-byte', () => {
    // crossing-3's rows are built by wardenHall() via the composer. This locks
    // that output to the exact grid it replaced, so a template change that would
    // silently alter a shipped floor is caught.
    const expected = [
      '=================',
      '=...............=',
      '=...............=',
      '=...=========...=',
      '=...=F.....F=...=',
      '=...=.......=...=',
      '=...=..D.D..=...=',
      '=...=.......=...=',
      '=...=...1...=...=',
      '=...=...2...=...=',
      '=...====.====...=',
      '=......S........=',
      '=================',
    ];
    const crossing3 = REACHES.crossing.floors.find((f) => f.id === 'crossing-3')!;
    expect(crossing3.rows).toEqual(expected);
  });
});

describe('a floor composed from templates validates clean', () => {
  it('two halls joined by a carved doorway, with a start and a portal', () => {
    // Two 5×5 halls sharing their middle wall column (second stamped at x=4),
    // a doorway carved through it, the start in one room and the descent in the
    // other — the canonical "assemble from rooms, then wire them" flow.
    let rows = compose(9, 5, [
      { room: 'hall', x: 0, z: 0 },
      { room: 'hall', x: 4, z: 0 },
    ]);
    rows = carve(rows, 4, 2); // open the shared wall so the rooms connect
    rows = put(rows, 1, 2, 'S'); // start in the left room
    rows = put(rows, 7, 2, '>'); // descent in the right room

    const floor = {
      id: 'composed',
      name: 'Composed',
      theme: {} as never,
      rows,
      events: {},
      encounterRate: 0,
      encounters: [],
    } as unknown as DungeonFloor;

    expect(rows).toHaveLength(5);
    expect(new Set(rows.map((r) => r.length))).toEqual(new Set([9]));
    expect(validateFloor(floor)).toEqual([]);
  });

  it('catches a soft-lock when the doorway is never carved', () => {
    // Same two rooms, but without the connecting doorway the portal is walled off
    // — the composer keeps the grid tidy, but validateFloor still catches the
    // real bug (unreachable descent).
    let rows = compose(9, 5, [
      { room: 'hall', x: 0, z: 0 },
      { room: 'hall', x: 4, z: 0 },
    ]);
    rows = put(rows, 1, 2, 'S');
    rows = put(rows, 7, 2, '>');
    const floor = {
      id: 'stuck',
      name: 'Stuck',
      theme: {} as never,
      rows,
      events: {},
      encounterRate: 0,
      encounters: [],
    } as unknown as DungeonFloor;
    expect(validateFloor(floor).some((e) => /unreachable/.test(e))).toBe(true);
  });
});
