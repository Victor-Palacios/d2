import { describe, it, expect } from 'vitest';
import { Battle, cellIndex, defaultFormation, BOOST_MAX } from './engine';
import type { BattleConfig } from './engine';
import { GUARD_MP_RESTORE } from './formula';
import { mkCreature, seededRng } from './testkit';

function makeBattle(over: Partial<BattleConfig> = {}): Battle {
  return new Battle({
    party: over.party ?? [mkCreature({ name: 'Hero', spd: 20 })],
    enemies: over.enemies ?? [mkCreature({ name: 'Foe', spd: 10 })],
    rng: over.rng ?? seededRng(1),
    ...over,
  });
}

describe('formation geometry', () => {
  it('fills the Vanguard centre-out before the Rear', () => {
    expect(defaultFormation(3)).toEqual([
      { row: 0, col: 1 },
      { row: 0, col: 0 },
      { row: 0, col: 2 },
    ]);
  });

  it('indexes cells row-major on the 2x3 grid', () => {
    expect(cellIndex({ row: 0, col: 0 })).toBe(0);
    expect(cellIndex({ row: 1, col: 2 })).toBe(5);
  });

  it('reports the empty cells left on a side', () => {
    const b = makeBattle({ party: [mkCreature()], partyCells: [{ row: 0, col: 1 }] });
    const empties = b
      .emptyCells('party')
      .map(cellIndex)
      .sort((a, z) => a - z);
    expect(empties).toEqual([0, 2, 3, 4, 5]); // every cell except the occupied centre-front
  });
});

describe('battle outcome', () => {
  it('is ongoing while both sides have someone standing', () => {
    expect(makeBattle().outcome).toBe('ongoing');
  });

  it('is victory when every enemy is down', () => {
    const enemy = mkCreature({ hp: 0 });
    expect(makeBattle({ enemies: [enemy] }).outcome).toBe('victory');
  });

  it('is defeat when every party member is down', () => {
    const ally = mkCreature({ hp: 0 });
    expect(makeBattle({ party: [ally] }).outcome).toBe('defeat');
  });
});

describe('beginRound', () => {
  it('cycles the field pulse calm -> crit -> surge', () => {
    const b = makeBattle();
    b.beginRound();
    expect(b.fieldPulse).toBe('calm');
    b.beginRound();
    expect(b.fieldPulse).toBe('crit');
    b.beginRound();
    expect(b.fieldPulse).toBe('surge');
  });

  it('clears guarding at the start of a round', () => {
    const ally = mkCreature({ guarding: true });
    const b = makeBattle({ party: [ally] });
    b.beginRound();
    expect(ally.guarding).toBe(false);
  });

  it('orders faster creatures first (seeded, so deterministic)', () => {
    const fast = mkCreature({ name: 'Fast', spd: 100 });
    const slow = mkCreature({ name: 'Slow', spd: 5 });
    const b = new Battle({ party: [slow], enemies: [fast], rng: seededRng(7) });
    const order = b.beginRound().map((x) => x.creature.name);
    expect(order[0]).toBe('Fast');
  });
});

describe('perform — guard', () => {
  it('sets the guard flag, restores MP and banks Boost', () => {
    const ally = mkCreature({ mp: 10, maxMp: 20 });
    const b = makeBattle({ party: [ally] });
    const actor = b.side('party')[0];
    const res = b.perform(actor, { type: 'guard' });
    expect(ally.guarding).toBe(true);
    expect(ally.mp).toBe(10 + Math.round(20 * GUARD_MP_RESTORE));
    expect(b.boost.party).toBe(1);
    expect(res.actionLabel).toBe('Guard');
  });
});

describe('perform — attack', () => {
  it('damages the target and banks Boost for the free Attack', () => {
    const b = makeBattle();
    b.beginRound(); // round 1 => calm pulse, no crit/surge interference
    const actor = b.side('party')[0];
    const foe = b.side('enemy')[0];
    const before = foe.creature.hp;
    const res = b.perform(actor, { type: 'attack', targetUid: foe.creature.uid });
    expect(res.hits).toHaveLength(1);
    expect(res.hits[0].damage).toBeGreaterThan(0);
    expect(foe.creature.hp).toBe(before - res.hits[0].damage);
    expect(b.boost.party).toBe(1);
  });
});

describe('cover — the front/back trade-off', () => {
  it('shields a Rear unit while a living ally holds the column, and exposes it when that ally falls', () => {
    const front = mkCreature({ name: 'Front' });
    const back = mkCreature({ name: 'Back' });
    const b = new Battle({
      party: [front, back],
      enemies: [mkCreature()],
      partyCells: [
        { row: 0, col: 0 },
        { row: 1, col: 0 },
      ],
      rng: seededRng(1),
    });
    const backBattler = b.side('party')[1];
    expect(b.isCovered(backBattler)).toBe(true);
    expect(b.meleeTargets('party').map((x) => x.creature.name)).toEqual(['Front']);

    front.hp = 0; // the cover falls
    expect(b.isCovered(backBattler)).toBe(false);
    expect(b.meleeTargets('party').map((x) => x.creature.name)).toEqual(['Back']);
  });
});

describe('Boost charges', () => {
  it('caps at BOOST_MAX and spends down to empty', () => {
    const b = makeBattle();
    for (let i = 0; i < BOOST_MAX + 2; i++) b.gainBoost('party');
    expect(b.boost.party).toBe(BOOST_MAX);
    for (let i = 0; i < BOOST_MAX; i++) expect(b.spendBoost('party')).toBe(true);
    expect(b.spendBoost('party')).toBe(false); // nothing left
  });
});

describe('determinism', () => {
  it('reproduces an identical fight from the same seed', () => {
    const run = () => {
      const b = new Battle({
        party: [mkCreature({ name: 'A', spd: 20 })],
        enemies: [mkCreature({ name: 'B', spd: 10 })],
        rng: seededRng(12345),
      });
      const damages: number[] = [];
      for (let i = 0; i < 5; i++) {
        b.beginRound();
        const actor = b.side('party')[0];
        const foe = b.side('enemy')[0];
        foe.creature.hp = foe.creature.maxHp; // reset so damage is comparable each round
        const res = b.perform(actor, { type: 'attack', targetUid: foe.creature.uid });
        damages.push(res.hits[0].damage);
      }
      return damages;
    };
    expect(run()).toEqual(run());
  });
});

describe('enemy AI', () => {
  it('returns a legal action targeting a living foe', () => {
    const b = makeBattle();
    const enemy = b.side('enemy')[0];
    const action = b.chooseEnemyAction(enemy);
    expect(['attack', 'technique', 'guard', 'shift', 'swap']).toContain(action.type);
    if (action.type === 'attack' || action.type === 'technique') {
      expect(b.find(action.targetUid)?.side).toBe('party');
    }
  });

  it('is deterministic under a fixed seed', () => {
    // uids differ between fixture builds, so compare the choice by target *name*
    // (stable identity) rather than the uid string.
    const choose = () => {
      const b = new Battle({
        party: [mkCreature({ name: 'P1' }), mkCreature({ name: 'P2', hp: 5 })],
        enemies: [mkCreature({ name: 'E' })],
        rng: seededRng(999),
      });
      const action = b.chooseEnemyAction(b.side('enemy')[0]);
      const targetName =
        action.type === 'attack' || action.type === 'technique' ? b.find(action.targetUid)?.creature.name : undefined;
      return { type: action.type, targetName };
    };
    expect(choose()).toEqual(choose());
  });
});
