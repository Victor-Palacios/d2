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
});
