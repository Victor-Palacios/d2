import { describe, expect, it } from 'vitest';
import type { DungeonFloor } from './dungeon';
import { REACHES } from './reaches';
import { validateFloor, validateReaches } from './validateReaches';

// The floors are hand-authored ASCII grids, and the validator (also run in the
// browser by tools/smoke/terrain.mjs) imports no Three.js/DOM — so it runs here
// as a fast, headless guard on every grid edit: rectangular rows, one start,
// event map <-> tiles, chest keys on C, reachable targets, decor placement, and
// that chest loot names a real item.
describe('reach floor data', () => {
  it('every floor of every reach validates clean', () => {
    expect(validateReaches(REACHES)).toEqual([]);
  });

  it('flags a chest that grants an item id absent from ITEMS', () => {
    // Regression: a chest granting a renamed/removed item id used to degrade
    // silently to a "keepsake" toast and file an unusable id into the bag.
    const floor = {
      id: 'test',
      name: 'Test',
      theme: {} as never,
      rows: ['#####', '#S.C#', '#..>#', '#####'],
      events: {},
      chests: { '3,1': { item: 'notARealItem' } },
      encounterRate: 0,
      encounters: [],
    } as unknown as DungeonFloor;
    expect(validateFloor(floor)).toContain("chest '3,1' grants unknown item 'notARealItem' (not in ITEMS)");
  });

  const secretFloor = (rows: string[], chests: Record<string, { note: string }> = {}) =>
    ({
      id: 'secret',
      name: 'Secret',
      theme: {} as never,
      rows,
      events: {},
      chests,
      encounterRate: 0,
      encounters: [],
    }) as unknown as DungeonFloor;

  it('accepts a chest hidden behind a secret wall (an optional find)', () => {
    // The chest at (4,1) is walled off except through the secret '?' at (3,1);
    // the portal is reachable without it, so this is a fine optional reward.
    const floor = secretFloor(['######', '#S.?C#', '#..>##', '######'], { '4,1': { note: 'x' } });
    expect(validateFloor(floor)).toEqual([]);
  });

  it('flags a descent portal that can only be reached through a secret', () => {
    // The only path to '>' runs through the secret '?' — a player who never
    // finds it is stuck, so this must be caught.
    const floor = secretFloor(['######', '#S?>##', '######']);
    expect(validateFloor(floor)).toContain('descent portal at 3,1 is only reachable through a secret passage');
  });

  const plateFloor = (rows: string[], chests: Record<string, { note: string }> = {}) =>
    ({
      id: 'plate',
      name: 'Plate',
      theme: {} as never,
      rows,
      events: {},
      chests,
      platePuzzle: true,
      encounterRate: 0,
      encounters: [],
    }) as unknown as DungeonFloor;

  it('accepts a chest behind a plate-puzzle barrier when every plate is reachable', () => {
    // Two reachable plates (W, F); lighting them opens the '%' onto the chest.
    const floor = plateFloor(['########', '#S.W.F.#', '#.....%C', '#.....>#', '########'].map((r) => r.padEnd(8, '#')), {
      '7,2': { note: 'x' },
    });
    expect(validateFloor(floor).filter((e) => /plate|unreachable/.test(e))).toEqual([]);
  });

  it('flags a plate-puzzle whose plate is walled off (barrier can never open)', () => {
    // The 'F' plate is sealed in its own box, so the puzzle is unsolvable.
    const floor = plateFloor(['########', '#S.W..>#', '####.###', '#F#..~##', '########']);
    expect(validateFloor(floor).some((e) => /plate puzzle: element plate at .* is unreachable/.test(e))).toBe(true);
  });

  it('accepts a chest behind a pressure-plate barrier (the plate can open it)', () => {
    // Stepping the '_' plate opens the '%' onto the chest, so it's reachable.
    const floor = {
      id: 'press',
      name: 'Press',
      theme: {} as never,
      rows: ['########', '#S._.%C#', '#....>.#', '########'],
      events: {},
      chests: { '6,1': { note: 'x' } },
      encounterRate: 0,
      encounters: [],
    } as unknown as DungeonFloor;
    expect(validateFloor(floor).filter((e) => /unreachable/.test(e))).toEqual([]);
  });
});
