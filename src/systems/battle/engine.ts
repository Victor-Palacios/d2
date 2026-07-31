import type { CreatureInstance } from '../party/creature';
import { isDown, isUp, effSpd, hasEquipEffect, activeMoves } from '../party/creature';
import type { ElementId } from '../../data/elements';
import type { Technique } from '../../data/techniques';
import { technique, techShape } from '../../data/techniques';
import { GUARD_MP_RESTORE, computeDamage, computeHeal } from './formula';
import type { DamageBreakdown } from './formula';

/**
 * Headless 3v3 turn-based battle model (plan §5.3).
 *
 * The model owns rules and state only — no three.js, no DOM. `BattleScene`
 * drives it one action at a time and animates the returned `TurnResult`.
 */

export type Side = 'party' | 'enemy';

/**
 * A cell on a side's 2×3 formation grid (plan: grid battle, Phase A).
 *
 * - `row` 0 is the **Vanguard** (front): melee hits harder and lands harder on
 *   it, and it can be struck by melee.
 * - `row` 1 is the **Rear** (back): shielded from single-target melee while a
 *   living ally holds the Vanguard cell in the same column, deals less melee,
 *   but takes and throws ranged/Ether at full strength.
 * - `col` 0/1/2 map left→right and share the arena's element plates.
 */
export interface Cell {
  row: number;
  col: number;
}

/**
 * Where units drop in when no explicit formation is given: the Vanguard fills
 * left→centre→right first, then the Rear. Three units therefore stand across
 * the front, exactly as before the grid existed — the back row is something the
 * player deploys into deliberately (Phase B), not a default.
 */
export const FORMATION_ORDER: readonly Cell[] = [
  { row: 0, col: 1 },
  { row: 0, col: 0 },
  { row: 0, col: 2 },
  { row: 1, col: 1 },
  { row: 1, col: 0 },
  { row: 1, col: 2 },
];

export function defaultFormation(n: number): Cell[] {
  return FORMATION_ORDER.slice(0, Math.max(0, Math.min(n, FORMATION_ORDER.length))).map((c) => ({ ...c }));
}

/** Row-major index of a cell on the 2×3 grid. */
export function cellIndex(cell: Cell): number {
  return cell.row * 3 + cell.col;
}

export interface Battler {
  creature: CreatureInstance;
  side: Side;
  /** Deploy index (0-based), also indexes into per-slot tile arrays. */
  slot: number;
  /** Formation cell on this side's 2×3 grid. */
  cell: Cell;
  /** Element of the arena plate under this cell (buffs matching creatures). */
  tile?: ElementId;
  /** Stagger meter 0..STAGGER_MAX (Phase D). */
  stagger: number;
  /** Broken: skips the next turn and takes bonus damage until then. */
  staggered: boolean;
  /** Hits landed while Broken — drives the escalating break-chain bonus. */
  chain: number;
  /** Lingering elemental mark left by the last damaging hit, for reactions. */
  reactionTag?: ElementId;
  /** Round the current mark was applied (for its short time-to-live). */
  reactionRound?: number;
  /** Understanding built by Commune, 0..COMMUNE_MAX. */
  commune: number;
  /** Pacified by Commune: it has left the fight in peace (no longer acts or is targetable). */
  pacified: boolean;
}

/**
 * A "melee" action reaches only the enemy Vanguard (and any exposed Rear) and
 * takes the front/back row modifiers; ranged/Ether ignores both. This is now a
 * data property (`Technique.melee`) rather than a hard-coded id, so a whole
 * class of physical Techniques (fangs, slaps, slams, claws) share the melee
 * trade-off with the free basic Attack instead of it being the lone melee move.
 */
export function isMeleeTechnique(tech: Technique): boolean {
  return !!tech.melee;
}

/**
 * Elemental reactions (element as a real second lever, layered on top of the
 * class triangle). A damaging hit leaves a short-lived elemental *mark* on the
 * target; a follow-up of a **different** element detonates it — bonus damage and
 * faster Break — then clears the mark. Same-element hits just refresh it. The
 * whole rule is "switch elements to combo", which is one line to teach.
 */
export const REACTION_MULT = 1.4;
export const REACTION_STAGGER = 20;
/** A mark set on round R stays live for hits in rounds R and R+1. */
export const REACTION_TTL_ROUNDS = 1;
/** Flavour names per unordered element pair — mechanically all identical. */
const REACTION_NAMES: Record<string, string> = {
  'fire|water': 'Steam Burst',
  'fire|nature': 'Wildfire',
  'nature|water': 'Overgrowth',
  'machine|water': 'Short-Circuit',
  'fire|machine': 'Meltdown',
  'machine|nature': 'Rust Bloom',
  'dark|fire': 'Emberdark',
  'dark|water': 'Blight',
  'dark|nature': 'Wither',
  'dark|machine': 'Corruption',
};

/** The reaction name for an (unordered) pair of distinct elements. */
export function reactionName(a: ElementId, b: ElementId): string {
  const key = [a, b].sort().join('|');
  return REACTION_NAMES[key] ?? 'Elemental Reaction';
}

/**
 * Break chains. Every hit landed on a Broken target before it recovers extends a
 * chain: the Break damage bonus escalates per link. Rewards ordering your turns
 * onto a broken foe.
 */
export const CHAIN_STEP = 0.15;
export const CHAIN_DAMAGE_MAX = 2.25;

/**
 * Commune (empathy as a resolution verb, generalised from the Last Light).
 * Speaking to a gentle `communable` soul fills an understanding meter instead of
 * damaging it; full, the soul is *pacified* — it leaves the fight in peace and
 * is understood (claimed like a full Soul Syphon on victory).
 */
export const COMMUNE_MAX = 100;
export const COMMUNE_GAIN = 34;
export const COMMUNE_VARIANCE = 12;

/**
 * Break / Stagger (grid battle, Phase D). Damaging hits fill a target's stagger
 * meter — faster with class advantage or a plate-amplified hit. At full it
 * Breaks: the target loses its next turn and takes bonus damage until then.
 * Deliberately an *accelerator*, never a damage gate (the Xenosaga II mistake).
 */
export const STAGGER_MAX = 100;
export const STAGGER_HIT = 26;
export const STAGGER_SUPER = 24;
export const STAGGER_PLATE = 16;
export const BREAK_DAMAGE_MULT = 1.5;

/**
 * Field pulse (grid battle, Phase D): a telegraphed per-round condition that
 * favours whoever acts into it, echoing Xenosaga's turn events.
 * - `crit`: damaging actions deal +20% this round.
 * - `calm`: nothing.
 */
export type FieldPulse = 'calm' | 'crit';
export const PULSE_CYCLE: readonly FieldPulse[] = ['calm', 'crit'];
export const CRIT_PULSE_MULT = 1.2;
/** Guaranteed-critical multiplier (Immortality Memento). */
export const CRIT_MULT = 1.5;

export type BattleAction =
  | { type: 'attack'; targetUid: string }
  | { type: 'technique'; techniqueId: string; targetUid: string }
  | { type: 'guard' }
  /** Reposition to an empty cell on your own grid (consumes the turn). */
  | { type: 'shift'; cell: Cell }
  /** Bench the actor and field a reserve in its cell (consumes the turn). */
  | { type: 'swap'; reserveUid: string }
  /** Speak to a gentle `communable` foe to pacify it instead of fighting. */
  | { type: 'commune'; targetUid: string };

export interface Hit {
  targetUid: string;
  damage: number;
  heal: number;
  fainted: boolean;
  /** Guaranteed critical (Immortality Memento) — drives the crit FX/log. */
  crit?: boolean;
  /** Reaction detonated on this hit (element mismatch), for FX/log. */
  reaction?: string;
  /** Chain length this hit landed at, if it struck a Broken target. */
  chain?: number;
  breakdown?: DamageBreakdown;
}

export interface TurnResult {
  actorUid: string;
  actionLabel: string;
  /** Technique used, if any — the scene colours its FX from this. */
  techniqueId?: string;
  hits: Hit[];
  log: string[];
  /** Set when the actor changed cell (shift/swap) so the scene can re-place it. */
  moved?: boolean;
  /** UID of a foe pacified by Commune this turn, so the scene can resolve it. */
  pacified?: string;
}

export type BattleOutcome = 'ongoing' | 'victory' | 'defeat';

export interface BattleConfig {
  party: CreatureInstance[];
  enemies: CreatureInstance[];
  /** Element plate under each party / enemy slot. */
  partyTiles?: (ElementId | undefined)[];
  enemyTiles?: (ElementId | undefined)[];
  /** Explicit starting formation; defaults to `defaultFormation`. */
  partyCells?: Cell[];
  enemyCells?: Cell[];
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
  /**
   * The single random source for the whole fight. Public so the scene can route
   * *its* rolls (flee, the Last Light) through it too — with a seeded `rng` in
   * the config that makes an entire played battle reproducible, not just the pure
   * model.
   */
  readonly rng: () => number;

  /** Element plate under each of the 6 cells per side, row-major (row*3+col). */
  private plates: Record<Side, (ElementId | undefined)[]>;
  /** Benched party creatures available to swap in; the scene keeps this current. */
  reserves: CreatureInstance[] = [];
  /** The current round's field pulse (Phase D). */
  fieldPulse: FieldPulse = 'calm';

  constructor(cfg: BattleConfig) {
    this.rng = cfg.rng ?? Math.random;
    this.isBoss = !!cfg.isBoss;
    const partyCells = cfg.partyCells ?? defaultFormation(cfg.party.length);
    const enemyCells = cfg.enemyCells ?? defaultFormation(cfg.enemies.length);

    // Plates belong to cells, not units: laying them by each unit's starting cell
    // means a repositioned creature leaves its plate behind (and can move onto
    // another). The incoming per-slot tiles map to their starting cells.
    this.plates = { party: new Array(6).fill(undefined), enemy: new Array(6).fill(undefined) };
    partyCells.forEach((cell, i) => {
      if (cfg.partyTiles?.[i]) this.plates.party[cellIndex(cell)] = cfg.partyTiles[i];
    });
    enemyCells.forEach((cell, i) => {
      if (cfg.enemyTiles?.[i]) this.plates.enemy[cellIndex(cell)] = cfg.enemyTiles[i];
    });

    cfg.party.forEach((c, i) => {
      this.battlers.push({
        creature: c,
        side: 'party',
        slot: i,
        cell: partyCells[i],
        tile: this.plateAt('party', partyCells[i]),
        stagger: 0,
        staggered: false,
        chain: 0,
        commune: 0,
        pacified: false,
      });
    });
    cfg.enemies.forEach((c, i) => {
      this.battlers.push({
        creature: c,
        side: 'enemy',
        slot: i,
        cell: enemyCells[i],
        tile: this.plateAt('enemy', enemyCells[i]),
        stagger: 0,
        staggered: false,
        chain: 0,
        commune: 0,
        pacified: false,
      });
    });
  }

  /** Element plate under a cell on `side`'s grid, if any. */
  plateAt(side: Side, cell: Cell): ElementId | undefined {
    return this.plates[side][cellIndex(cell)];
  }

  /** All cells with no living occupant (and not the actor's own), for repositioning. */
  emptyCells(side: Side): Cell[] {
    const taken = new Set(this.living(side).map((b) => cellIndex(b.cell)));
    return FORMATION_ORDER.filter((c) => !taken.has(cellIndex(c))).map((c) => ({ ...c }));
  }

  side(side: Side): Battler[] {
    return this.battlers.filter((b) => b.side === side);
  }

  /** A battler still in play: alive and not pacified (a pacified soul has left). */
  private inPlay(b: Battler): boolean {
    return isUp(b.creature) && !b.pacified;
  }

  living(side: Side): Battler[] {
    return this.side(side).filter((b) => this.inPlay(b));
  }

  /**
   * True when a Rear unit is shielded from single-target melee: it sits in
   * row 1 and a living ally holds the Vanguard (row 0) cell in the same column.
   */
  isCovered(b: Battler): boolean {
    if (b.cell.row !== 1) return false;
    return this.side(b.side).some((a) => a !== b && this.inPlay(a) && a.cell.row === 0 && a.cell.col === b.cell.col);
  }

  /** Living, gentle foes on `side` that the Commune action can reach. */
  communeTargets(side: Side): Battler[] {
    return this.living(side).filter((b) => b.creature.communable);
  }

  /** The live elemental mark on a battler, if it hasn't timed out. */
  activeMark(b: Battler): ElementId | undefined {
    if (!b.reactionTag) return undefined;
    if (this.round - (b.reactionRound ?? -99) > REACTION_TTL_ROUNDS) return undefined;
    return b.reactionTag;
  }

  /** Living units on `side` that a melee attack is allowed to reach. */
  meleeTargets(side: Side): Battler[] {
    return this.living(side).filter((b) => !this.isCovered(b));
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
    this.fieldPulse = PULSE_CYCLE[(this.round - 1) % PULSE_CYCLE.length];
    for (const b of this.battlers) b.creature.guarding = false;
    this.queue = this.battlers
      .filter((b) => this.inPlay(b))
      .map((b) => ({ b, roll: effSpd(b.creature) * (0.88 + this.rng() * 0.24) }))
      .sort((a, z) => z.roll - a.roll)
      .map((x) => x.b);
    return this.queue.slice();
  }

  /** The battler whose turn it is, skipping anyone who fainted mid-round. */
  nextTurn(): Battler | null {
    while (this.queue.length) {
      const b = this.queue.shift()!;
      if (this.inPlay(b)) return b;
    }
    return null;
  }

  /** Ends a Break: clears the staggered flag, the chain and empties the meter. */
  clearStagger(b: Battler) {
    b.staggered = false;
    b.stagger = 0;
    b.chain = 0;
  }

  private targetsFor(actor: Battler, tech: Technique, targetUid: string): Battler[] {
    if (tech.kind === 'heal') {
      const t = this.find(targetUid);
      return t ? [t] : [];
    }
    const opposing: Side = actor.side === 'party' ? 'enemy' : 'party';
    const shape = techShape(tech);
    if (shape === 'all') {
      return this.living(opposing);
    }
    const melee = isMeleeTechnique(tech);
    const pool = melee ? this.meleeTargets(opposing) : this.living(opposing);
    const t = this.find(targetUid);
    // The anchor: the chosen target if legal, else the nearest reachable foe.
    const anchor = t && isUp(t.creature) && (!melee || !this.isCovered(t)) ? t : pool[0];
    if (!anchor) return [];
    // Shaped ranged techniques sweep the anchor's rank/file (cover doesn't apply
    // to ranged); `single` hits the anchor alone.
    if (shape === 'row') return this.living(opposing).filter((b) => b.cell.row === anchor.cell.row);
    if (shape === 'column') return this.living(opposing).filter((b) => b.cell.col === anchor.cell.col);
    return [anchor];
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

    if (action.type === 'shift') {
      const blocked = this.living(actor.side).some((b) => b !== actor && cellIndex(b.cell) === cellIndex(action.cell));
      result.actionLabel = 'Move';
      if (blocked) {
        result.log.push(`${c.name} has nowhere to move.`);
        return result;
      }
      actor.cell = { ...action.cell };
      actor.tile = this.plateAt(actor.side, actor.cell);
      result.moved = true;
      result.log.push(`${c.name} repositions.`);
      if (actor.tile) result.log.push(`${c.name} steps onto a ${actor.tile} plate.`);
      return result;
    }

    if (action.type === 'swap') {
      const idx = this.reserves.findIndex((r) => r.uid === action.reserveUid && isUp(r));
      result.actionLabel = 'Swap';
      if (idx < 0) {
        result.log.push(`${c.name} has no one to tag in.`);
        return result;
      }
      const incoming = this.reserves[idx];
      this.reserves[idx] = c; // the benched creature becomes a reserve
      actor.creature = incoming;
      actor.creature.guarding = false;
      actor.tile = this.plateAt(actor.side, actor.cell);
      result.moved = true;
      result.log.push(`${c.name} taps out — ${incoming.name} steps in!`);
      return result;
    }

    if (action.type === 'commune') {
      result.actionLabel = 'Commune';
      const t = this.find(action.targetUid);
      if (!t || !this.inPlay(t) || !t.creature.communable) {
        result.log.push(`${c.name} reaches out — but there is no one there to answer.`);
        return result;
      }
      const gain = COMMUNE_GAIN + Math.floor(this.rng() * COMMUNE_VARIANCE);
      t.commune = Math.min(COMMUNE_MAX, t.commune + gain);
      result.log.push(`${c.name} speaks gently to ${t.creature.name}.`);
      if (t.commune >= COMMUNE_MAX) {
        t.pacified = true;
        result.pacified = t.creature.uid;
        result.log.push(`${t.creature.name} understands. It quiets, and is at peace.`);
      } else {
        result.log.push(`${t.creature.name} is listening — ${t.commune}% understood.`);
      }
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
        melee: isMeleeTechnique(tech),
        attackerRow: actor.cell.row,
        defenderRow: t.cell.row,
        rng: this.rng,
      });
      // Elemental reaction: a mark of a *different* element detonates for bonus
      // damage. Read the live mark before this hit overwrites it.
      const mark = this.activeMark(t);
      const reacts = !!mark && mark !== tech.element;
      const reactName = reacts ? reactionName(mark!, tech.element) : undefined;

      // Post-multipliers, all multiplicative: a broken target takes extra
      // (escalating with the chain), a reaction detonates, the `crit` field pulse
      // adds +20% to every damaging action this round, and an Immortality Memento
      // makes the wearer's hits guaranteed criticals for the first three rounds.
      let dealt = breakdown.amount;
      let chainN = 0;
      if (t.staggered) {
        t.chain += 1;
        chainN = t.chain;
        const mult = Math.min(CHAIN_DAMAGE_MAX, BREAK_DAMAGE_MULT + CHAIN_STEP * (chainN - 1));
        dealt = Math.round(dealt * mult);
      }
      if (reacts) dealt = Math.round(dealt * REACTION_MULT);
      if (this.fieldPulse === 'crit') dealt = Math.round(dealt * CRIT_PULSE_MULT);
      const critHit = hasEquipEffect(c, 'crit') && this.round <= 3;
      if (critHit) dealt = Math.round(dealt * CRIT_MULT);
      dealt = Math.max(1, dealt);

      t.creature.hp = Math.max(0, t.creature.hp - dealt);
      const fainted = isDown(t.creature);
      result.hits.push({
        targetUid: t.creature.uid,
        damage: dealt,
        heal: 0,
        fainted,
        crit: critHit,
        reaction: reactName,
        chain: chainN || undefined,
        breakdown,
      });

      // Combo effects (elemental reactions, break-chains) and class
      // effectiveness are deliberately NOT narrated — the player reads them off
      // the FX and the fighter cards (impact burst, screen shake, the reaction
      // pip and BROKEN badge), not a line of text.
      if (critHit) result.log.push('A remembered life strikes true');
      if (breakdown.attackerTileBonus) result.log.push(`The ${actor.tile} plate amplifies your power!`);
      if (breakdown.guarded) result.log.push(`${t.creature.name} guards against it.`);
      if (fainted) result.log.push(`${t.creature.name} is knocked out!`);

      // Elemental mark bookkeeping: a reaction consumes the mark (you must
      // re-establish it); otherwise this hit leaves its own element behind.
      if (!fainted) {
        if (reacts) t.reactionTag = undefined;
        else {
          t.reactionTag = tech.element;
          t.reactionRound = this.round;
        }
      }

      // Stagger accrual (living, not-yet-broken targets): faster on class
      // advantage, a plate-amplified hit, or an elemental reaction.
      if (!fainted && !t.staggered) {
        let gain = STAGGER_HIT;
        if (breakdown.effectiveness === 'super') gain += STAGGER_SUPER;
        if (breakdown.attackerTileBonus) gain += STAGGER_PLATE;
        if (reacts) gain += REACTION_STAGGER;
        t.stagger = Math.min(STAGGER_MAX, t.stagger + gain);
        // Break onset shows on the card (BROKEN badge + full stagger meter); no line.
        if (t.stagger >= STAGGER_MAX) t.staggered = true;
      }
    }

    return result;
  }

  /**
   * Picks one item weighted by exp(score) — a softmax draw. Unlike a plain
   * argmax it usually takes the strongest option but not always, so the AI
   * stops being perfectly predictable (a common monster-RPG AI criticism).
   */
  private softmaxPick<T>(items: { item: T; score: number }[]): T {
    if (items.length === 1) return items[0].item;
    const weights = items.map((x) => Math.exp(x.score * 1.6));
    const total = weights.reduce((s, w) => s + w, 0);
    let r = this.rng() * total;
    for (let i = 0; i < items.length; i++) {
      r -= weights[i];
      if (r <= 0) return items[i].item;
    }
    return items[items.length - 1].item;
  }

  /**
   * A grid move the enemy AI would want: step onto its own element plate for the
   * ×1.2 offence bonus, or — if it is an exposed Rear unit being picked off —
   * duck to the safety of the front. Null when standing pat is fine.
   */
  private chooseEnemyShift(actor: Battler): BattleAction | null {
    const cells = this.emptyCells(actor.side);
    if (!cells.length) return null;
    // Prefer a matching element plate we are not already standing on.
    if (actor.tile !== actor.creature.element) {
      const plated = cells.find((cell) => this.plateAt(actor.side, cell) === actor.creature.element);
      if (plated) return { type: 'shift', cell: plated };
    }
    // Exposed in the Rear with no cover: move up to the front line.
    if (actor.cell.row === 1 && !this.isCovered(actor)) {
      const front = cells.find((cell) => cell.row === 0);
      if (front) return { type: 'shift', cell: front };
    }
    return null;
  }

  /**
   * Enemy AI (plan §5.3, Phase D). Scores foes on damage, finishing blows, an
   * exposed back-line caster, plate-buffed threats and existing Break state,
   * then draws with a softmax so it is deliberate without being scripted. It
   * repositions on the grid when there is a clear gain, heals when hurt, favours
   * a multi-target shape against a stacked column, and occasionally feints with
   * a Guard.
   */
  chooseEnemyAction(actor: Battler): BattleAction {
    const oppSide: Side = actor.side === 'party' ? 'enemy' : 'party';
    const foes = this.living(oppSide);
    if (!foes.length) return { type: 'guard' };

    const c = actor.creature;

    // Grid sense: occasionally take a clearly-beneficial reposition instead of
    // attacking, so the enemy engages with the formation systems the player does.
    const shift = this.chooseEnemyShift(actor);
    if (shift && this.rng() < 0.35) return shift;
    const scored = foes.map((f) => {
      let score = this.rng() * 0.3;
      if (f.creature.hp / f.creature.maxHp < 0.35) score += 0.6; // finish the wounded
      if (f.staggered) score += 0.7; // press a Break
      if (f.cell.row === 1 && !this.isCovered(f)) score += 0.4; // exposed back-liner
      if (f.tile === f.creature.element) score += 0.3; // a plate-buffed threat
      const mult = computeDamage({ attacker: c, defender: f.creature, technique: technique('strike'), rng: () => 0.5 });
      if (mult.effectiveness === 'super') score += 0.5;
      if (mult.effectiveness === 'weak') score -= 0.3;
      return { item: f, score };
    });
    const target = this.softmaxPick(scored);

    // Heal itself / an ally when badly hurt and the technique is available.
    const moves = activeMoves(c);
    const healTech = moves.map((id) => technique(id)).find((t) => t.kind === 'heal' && c.mp >= t.mpCost);
    if (healTech) {
      const hurt = this.living(actor.side)
        .filter((b) => b.creature.hp / b.creature.maxHp < 0.4)
        .sort((a, b) => a.creature.hp / a.creature.maxHp - b.creature.hp / b.creature.maxHp)[0];
      if (hurt && this.rng() < 0.7) {
        return { type: 'technique', techniqueId: healTech.id, targetUid: hurt.creature.uid };
      }
    }

    const usable = moves.map((id) => technique(id)).filter((t) => t.kind === 'damage' && c.mp >= t.mpCost);

    if (usable.length && this.rng() < 0.72) {
      // Prefer a multi-target shape when it would actually catch two or more.
      const shaped = usable.find((t) => {
        const sh = techShape(t);
        if (sh === 'all') return foes.length >= 2;
        if (sh === 'row') return foes.filter((f) => f.cell.row === target.cell.row).length >= 2;
        if (sh === 'column') return foes.filter((f) => f.cell.col === target.cell.col).length >= 2;
        return false;
      });
      const pick = shaped && this.rng() < 0.65 ? shaped : usable[Math.floor(this.rng() * usable.length)];
      return { type: 'technique', techniqueId: pick.id, targetUid: target.creature.uid };
    }

    // Feint: low on HP with nothing better, brace instead (Guard restores MP).
    if (c.hp / c.maxHp < 0.25 && this.rng() < 0.3) return { type: 'guard' };

    // A basic Attack is melee: it can only reach the Vanguard (and exposed Rear),
    // so retarget to a legal foe if the scored pick is behind cover.
    const meleeFoes = this.meleeTargets(oppSide);
    const meleeTarget = meleeFoes.includes(target) ? target : (meleeFoes[0] ?? target);
    return { type: 'attack', targetUid: meleeTarget.creature.uid };
  }
}
