import type { CreatureInstance } from '../party/creature';
import { isDown, isUp } from '../party/creature';
import type { ElementId } from '../../data/elements';
import type { Technique } from '../../data/techniques';
import { technique } from '../../data/techniques';
import { GUARD_MP_RESTORE, computeDamage, computeHeal } from './formula';
import type { DamageBreakdown } from './formula';

/**
 * Headless 3v3 turn-based battle model (plan §5.3).
 *
 * The model owns rules and state only — no three.js, no DOM. `BattleScene`
 * drives it one action at a time and animates the returned `TurnResult`.
 */

export type Side = 'party' | 'enemy';

export interface Battler {
  creature: CreatureInstance;
  side: Side;
  slot: number;
  /** Element of the arena plate under this slot (buffs matching creatures). */
  tile?: ElementId;
}

export type BattleAction =
  | { type: 'attack'; targetUid: string }
  | { type: 'technique'; techniqueId: string; targetUid: string }
  | { type: 'guard' };

export interface Hit {
  targetUid: string;
  damage: number;
  heal: number;
  fainted: boolean;
  breakdown?: DamageBreakdown;
}

export interface TurnResult {
  actorUid: string;
  actionLabel: string;
  /** Technique used, if any — the scene colours its FX from this. */
  techniqueId?: string;
  hits: Hit[];
  log: string[];
}

export type BattleOutcome = 'ongoing' | 'victory' | 'defeat';

export interface BattleConfig {
  party: CreatureInstance[];
  enemies: CreatureInstance[];
  /** Element plate under each party / enemy slot. */
  partyTiles?: (ElementId | undefined)[];
  enemyTiles?: (ElementId | undefined)[];
  /** Boss fights disable fleeing and are flagged in the UI. */
  isBoss?: boolean;
  rng?: () => number;
}

export class Battle {
  readonly battlers: Battler[] = [];
  readonly isBoss: boolean;
  round = 0;
  /** Turn order for the current round; consumed front to back. */
  private queue: Battler[] = [];
  private rng: () => number;

  constructor(cfg: BattleConfig) {
    this.rng = cfg.rng ?? Math.random;
    this.isBoss = !!cfg.isBoss;
    cfg.party.forEach((c, i) =>
      this.battlers.push({ creature: c, side: 'party', slot: i, tile: cfg.partyTiles?.[i] }),
    );
    cfg.enemies.forEach((c, i) =>
      this.battlers.push({ creature: c, side: 'enemy', slot: i, tile: cfg.enemyTiles?.[i] }),
    );
  }

  side(side: Side): Battler[] {
    return this.battlers.filter((b) => b.side === side);
  }

  living(side: Side): Battler[] {
    return this.side(side).filter((b) => isUp(b.creature));
  }

  find(uid: string): Battler | undefined {
    return this.battlers.find((b) => b.creature.uid === uid);
  }

  get outcome(): BattleOutcome {
    if (this.living('enemy').length === 0) return 'victory';
    if (this.living('party').length === 0) return 'defeat';
    return 'ongoing';
  }

  /**
   * Builds the turn order for a new round: by Speed, with a random tiebreak
   * band so a slower creature can occasionally slip ahead (plan §5.2).
   */
  beginRound(): Battler[] {
    this.round++;
    for (const b of this.battlers) b.creature.guarding = false;
    this.queue = this.battlers
      .filter((b) => isUp(b.creature))
      .map((b) => ({ b, roll: b.creature.spd * (0.88 + this.rng() * 0.24) }))
      .sort((a, z) => z.roll - a.roll)
      .map((x) => x.b);
    return this.queue.slice();
  }

  /** The battler whose turn it is, skipping anyone who fainted mid-round. */
  nextTurn(): Battler | null {
    while (this.queue.length) {
      const b = this.queue.shift()!;
      if (isUp(b.creature)) return b;
    }
    return null;
  }

  private targetsFor(actor: Battler, tech: Technique, targetUid: string): Battler[] {
    if (tech.kind === 'heal') {
      const t = this.find(targetUid);
      return t ? [t] : [];
    }
    if (tech.aoe) {
      return this.living(actor.side === 'party' ? 'enemy' : 'party');
    }
    const t = this.find(targetUid);
    return t && isUp(t.creature) ? [t] : this.living(actor.side === 'party' ? 'enemy' : 'party').slice(0, 1);
  }

  /** Applies one action and returns everything the scene needs to animate it. */
  perform(actor: Battler, action: BattleAction): TurnResult {
    const c = actor.creature;
    const result: TurnResult = { actorUid: c.uid, actionLabel: '', hits: [], log: [] };

    if (action.type === 'guard') {
      c.guarding = true;
      const restored = Math.min(c.maxMp - c.mp, Math.round(c.maxMp * GUARD_MP_RESTORE));
      c.mp += restored;
      result.actionLabel = 'Guard';
      result.log.push(`${c.name} braces for impact.`);
      if (restored > 0) result.log.push(`${c.name} recovers ${restored} MP.`);
      return result;
    }

    const tech = technique(action.type === 'attack' ? 'strike' : action.techniqueId);
    result.actionLabel = tech.name;
    result.techniqueId = tech.id;

    if (action.type === 'technique') {
      if (c.mp < tech.mpCost) {
        result.log.push(`${c.name} does not have the MP for ${tech.name}!`);
        return result;
      }
      c.mp -= tech.mpCost;
    }

    const targets = this.targetsFor(actor, tech, action.targetUid);
    result.log.push(`${c.name} uses ${tech.name}!`);

    for (const t of targets) {
      if (tech.kind === 'heal') {
        const amount = computeHeal(c, tech);
        const healed = Math.min(amount, t.creature.maxHp - t.creature.hp);
        t.creature.hp += healed;
        result.hits.push({ targetUid: t.creature.uid, damage: 0, heal: healed, fainted: false });
        result.log.push(`${t.creature.name} recovers ${healed} HP.`);
        continue;
      }

      const breakdown = computeDamage({
        attacker: c,
        defender: t.creature,
        technique: tech,
        attackerTile: actor.tile,
        defenderTile: t.tile,
        rng: this.rng,
      });
      t.creature.hp = Math.max(0, t.creature.hp - breakdown.amount);
      const fainted = isDown(t.creature);
      result.hits.push({ targetUid: t.creature.uid, damage: breakdown.amount, heal: 0, fainted, breakdown });

      if (breakdown.attackerTileBonus) result.log.push(`The ${actor.tile} plate amplifies it!`);
      if (breakdown.effectiveness === 'super') result.log.push('Attribute advantage — it hits hard!');
      else if (breakdown.effectiveness === 'weak') result.log.push('Attribute disadvantage — it is resisted.');
      if (breakdown.guarded) result.log.push(`${t.creature.name} guards against it.`);
      if (fainted) result.log.push(`${t.creature.name} is knocked out!`);
    }

    return result;
  }

  /**
   * Enemy AI (plan §5.3): pick a living target and use a technique when the MP
   * allows, otherwise fall back to a basic attack. Slightly biased toward
   * targets it has an attribute advantage over, and toward finishing off
   * anything already hurt — enough to feel deliberate without being cruel.
   */
  chooseEnemyAction(actor: Battler): BattleAction {
    const foes = this.living(actor.side === 'party' ? 'enemy' : 'party');
    if (!foes.length) return { type: 'guard' };

    const c = actor.creature;
    const scored = foes.map((f) => {
      let score = this.rng() * 0.4;
      if (f.creature.hp / f.creature.maxHp < 0.35) score += 0.6;
      const mult = computeDamage({
        attacker: c,
        defender: f.creature,
        technique: technique('strike'),
        rng: () => 0.5,
      });
      if (mult.effectiveness === 'super') score += 0.5;
      if (mult.effectiveness === 'weak') score -= 0.3;
      return { f, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const target = scored[0].f;

    // Heal itself / an ally when badly hurt and the technique is available.
    const healTech = c.techniques
      .map((id) => technique(id))
      .find((t) => t.kind === 'heal' && c.mp >= t.mpCost);
    if (healTech) {
      const hurt = this.living(actor.side)
        .filter((b) => b.creature.hp / b.creature.maxHp < 0.4)
        .sort((a, b) => a.creature.hp / a.creature.maxHp - b.creature.hp / b.creature.maxHp)[0];
      if (hurt && this.rng() < 0.7) {
        return { type: 'technique', techniqueId: healTech.id, targetUid: hurt.creature.uid };
      }
    }

    const usable = c.techniques
      .map((id) => technique(id))
      .filter((t) => t.kind === 'damage' && c.mp >= t.mpCost);

    if (usable.length && this.rng() < 0.72) {
      // Prefer an AoE when it would hit two or more.
      const aoe = usable.find((t) => t.aoe);
      const pick = aoe && foes.length >= 2 && this.rng() < 0.6
        ? aoe
        : usable[Math.floor(this.rng() * usable.length)];
      return { type: 'technique', techniqueId: pick.id, targetUid: target.creature.uid };
    }

    // Low on HP with nothing good to do: guard.
    if (c.hp / c.maxHp < 0.25 && this.rng() < 0.3) return { type: 'guard' };

    return { type: 'attack', targetUid: target.creature.uid };
  }
}
