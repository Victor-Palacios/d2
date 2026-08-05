import { describe, expect, it } from 'vitest';
import { species } from '../../data/creatures';
import { GameState, KEEPER_KIT, STARTER_LEVEL } from './gameState';

// `startNewGame` is the single source of truth for a fresh run — both the real
// opening (IntroScene.partnerSelect) and the smoke-test harness call it to reach
// a playable state. This locks its output so the harness can't drift from the
// opening (the keeper-kit item ids and party shape have changed before).
describe('startNewGame', () => {
  it('bonds the partner, sets the team, grants the kit, and marks the prologue done', () => {
    const g = new GameState();
    g.startNewGame('emberling', 'ASH');

    expect(g.playerName).toBe('ASH');
    expect(g.party).toHaveLength(1);
    expect(g.party[0].speciesId).toBe('emberling');
    expect(g.party[0].level).toBe(STARTER_LEVEL);
    expect(g.teamAttribute).toBe(species('emberling').attribute);
    for (const item of KEEPER_KIT) {
      expect(g.itemCount(item), `kit item ${item} in the bag`).toBe(1);
    }
    expect(g.has('prologueDone')).toBe(true);
  });

  it('keeps the current name when none is passed', () => {
    const g = new GameState();
    const before = g.playerName;
    g.startNewGame('glidefang');
    expect(g.playerName).toBe(before);
    expect(g.teamAttribute).toBe(species('glidefang').attribute);
  });
});

// A chest's treasure is a one-time reward: once opened it must stay empty for
// good, even after leaving and re-entering the reach (`resetCrawl`), or obols
// could be farmed by re-running a floor. Per-crawl state (events, light shards,
// doors) does reset.
describe('resetCrawl', () => {
  it('keeps opened chests but resets per-crawl progress', () => {
    const g = new GameState();
    g.openedChests.add('crystal-1:15,2');
    g.usedEvents.add('crystal-1:1');
    g.takenPickups.add('crystal-1:7,7');
    g.openedDoors.add('crystal-2:10,3');
    g.floorIndex = 2;

    g.resetCrawl();

    expect(g.openedChests.has('crystal-1:15,2'), 'opened chest persists').toBe(true);
    expect(g.usedEvents.size, 'events reset').toBe(0);
    expect(g.takenPickups.size, 'light shards reset').toBe(0);
    expect(g.openedDoors.size, 'doors reset').toBe(0);
    expect(g.floorIndex, 'rewinds to the first floor').toBe(0);
  });
});
