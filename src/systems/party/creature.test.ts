import { describe, it, expect } from 'vitest';
import { makeCreature, grantXp, xpToNext, xpFromEnemy, statsAt } from './creature';
import { species } from '../../data/creatures';

describe('xpToNext — the level curve', () => {
  it('follows the 12 * level^1.5 super-linear curve', () => {
    expect(xpToNext(1)).toBe(12);
    expect(xpToNext(4)).toBe(Math.round(12 * 4 ** 1.5)); // 96
  });

  it('is monotonically increasing', () => {
    for (let lvl = 1; lvl < 20; lvl++) {
      expect(xpToNext(lvl + 1)).toBeGreaterThan(xpToNext(lvl));
    }
  });
});

describe('xpFromEnemy — level-gap scaling', () => {
  it('pays the base rate for an even-level kill', () => {
    expect(xpFromEnemy(5, 5)).toBe(5 * 8);
  });

  it('pays a lower-level monster more and a higher-level monster less', () => {
    expect(xpFromEnemy(1, 5)).toBeGreaterThan(xpFromEnemy(5, 5));
    expect(xpFromEnemy(10, 5)).toBeLessThan(xpFromEnemy(5, 5));
  });

  it('never pays less than 1', () => {
    expect(xpFromEnemy(99, 1)).toBeGreaterThanOrEqual(1);
  });
});

describe('makeCreature + grantXp', () => {
  it('builds a full-health creature from species data', () => {
    const c = makeCreature('emberling', 1);
    expect(c.hp).toBe(c.maxHp);
    expect(c.mp).toBe(c.maxMp);
    expect(c.level).toBe(1);
    expect(c.techniques.length).toBeGreaterThan(0);
  });

  it('levels up and raises stats when granted enough XP', () => {
    const c = makeCreature('emberling', 1);
    const startHp = c.maxHp;
    const leveled = grantXp(c, 10000);
    expect(leveled).not.toBeNull();
    expect(c.level).toBeGreaterThan(1);
    expect(c.maxHp).toBeGreaterThan(startHp);
    expect(c.hp).toBe(c.maxHp); // a healthy level-up heals the gained HP
    expect(statsAt(species('emberling'), c.level).off).toBe(c.off);
  });

  it('returns null when the XP is not enough to level', () => {
    const c = makeCreature('emberling', 1);
    expect(grantXp(c, 1)).toBeNull();
    expect(c.level).toBe(1);
  });
});
