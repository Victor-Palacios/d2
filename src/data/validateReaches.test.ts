import { describe, expect, it } from 'vitest';
import { REACHES } from './reaches';
import { validateReaches } from './validateReaches';

// The floors are hand-authored ASCII grids, and the validator (also run in the
// browser by tools/smoke/terrain.mjs) imports no Three.js/DOM — so it runs here
// as a fast, headless guard on every grid edit: rectangular rows, one start,
// event map <-> tiles, chest keys on C, reachable targets, decor placement.
describe('reach floor data', () => {
  it('every floor of every reach validates clean', () => {
    expect(validateReaches(REACHES)).toEqual([]);
  });
});
