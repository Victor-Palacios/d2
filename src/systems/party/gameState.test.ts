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
