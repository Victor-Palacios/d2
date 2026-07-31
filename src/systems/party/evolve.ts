import type { CreatureInstance } from './creature';
import { statsAt, syncMoves } from './creature';
import { SPECIES, species } from '../../data/creatures';
import type { EvolutionOption } from '../../data/creatures';

/**
 * Transcendence — the evolution system (plan §5.6).
 *
 * A **Pokémon × Digimon hybrid**:
 * - **Level-triggered** (Pokémon): a branch unlocks at a set level (usually 10).
 *   Predictable, no items or hidden conditions to reverse-engineer.
 * - **Branching** (Digimon): a species may offer more than one form, and those
 *   forms can belong to *other lines* — so a soul can cross into a different
 *   family the way a Digimon does, not just walk one fixed chain. Branches are
 *   still curated (not "any starter → any top form"), and the class rule below
 *   keeps them coherent.
 * - **Class-pure** (our house rule): every branch stays in the source's
 *   attribute — a Mage only ever becomes another Mage, a Hero a Hero, an
 *   Assassin an Assassin. This is what lets a line cross into another *line*
 *   without losing its identity: the destination may be a different family, but
 *   it is always the same class. `evolutionOptions` filters to same-attribute
 *   branches so a stray cross-class entry in the data can never be offered, and
 *   a unit test (`evolve.test.ts`) fails the build if one is authored.
 * - **Reversible** (Digimon): every evolution can be undone — a soul can always
 *   return to the shape it was, the part of Digimon players love. De-evolution
 *   follows the soul's own **ancestry stack** (`CreatureInstance.evolvedFrom`),
 *   so it is exact even when a form is reachable from several bases (a cross-line
 *   target returns to the base *this* soul actually came from). The static tree
 *   (`DEVOLVE_MAP`) is only a fallback for a soul caught already-evolved or from
 *   a save that predates the stack. Learned moves are *kept* on the way back down
 *   (the known pool only grows), so returning never costs a move.
 *
 * Evolution is **out-of-battle and explicit**: reaching the level makes a creature
 * *eligible*, the player chooses when (and which branch) to take. Nothing here is
 * called from the level-up path, so growth never mutates a species behind the
 * player's back.
 *
 * The transform keeps level, XP, equipment and current HP/MP *fraction*, then
 * recomputes stats and moveset from the new species — so evolve→devolve→evolve is
 * lossless and deterministic.
 */

export interface EvolveResult {
  fromId: string;
  toId: string;
  /** The creature's display name after the transform. */
  name: string;
  /** Moves the new form knows that the old one did not. */
  gainedMoves: string[];
}

/** Reverse of every forward branch: evolvedId → the species it came from. */
const DEVOLVE_MAP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const s of Object.values(SPECIES)) {
    for (const opt of s.evolutions ?? []) {
      // Each evolved form has exactly one authored source (branches converge from
      // one base), so the inverse is well-defined. First writer wins if that ever
      // stops being true.
      if (!(opt.to in map)) map[opt.to] = s.id;
    }
  }
  return map;
})();

/**
 * True if evolving `fromId` into `toId` keeps the class (attribute). The house
 * rule: lines are class-pure. A missing target fails closed.
 */
export function isSameClass(fromId: string, toId: string): boolean {
  const from = SPECIES[fromId];
  const to = SPECIES[toId];
  return !!from && !!to && from.attribute === to.attribute;
}

/** Branches a creature is currently eligible to take (level-gated, class-pure). */
export function evolutionOptions(c: CreatureInstance): EvolutionOption[] {
  const s = SPECIES[c.speciesId];
  if (!s?.evolutions) return [];
  return s.evolutions.filter((o) => c.level >= o.level && isSameClass(c.speciesId, o.to));
}

/** Every branch the species defines, eligible or not (for a "not yet" preview). */
export function allEvolutions(c: CreatureInstance): EvolutionOption[] {
  return SPECIES[c.speciesId]?.evolutions ?? [];
}

export const canEvolve = (c: CreatureInstance): boolean => evolutionOptions(c).length > 0;

/**
 * The species this creature would de-evolve into, or null if it is a base form.
 * Prefers the soul's own ancestry (exact even for cross-line/shared targets),
 * falling back to the static tree for a soul caught already-evolved or loaded
 * from a pre-ancestry save.
 */
export function devolveTargetId(c: CreatureInstance): string | null {
  const stack = c.evolvedFrom;
  if (stack?.length) return stack[stack.length - 1];
  return DEVOLVE_MAP[c.speciesId] ?? null;
}

export const canDevolve = (c: CreatureInstance): boolean => devolveTargetId(c) !== null;

/**
 * Rebuilds a creature as a different species in place, preserving identity
 * (uid/level/xp/equip) and the current HP/MP *fraction*. Recomputes stats and
 * moveset from the target species. Shared by evolve and devolve.
 */
function applyForm(c: CreatureInstance, toId: string): EvolveResult {
  const from = species(c.speciesId);
  const to = species(toId);

  const hpFrac = c.maxHp > 0 ? c.hp / c.maxHp : 1;
  const mpFrac = c.maxMp > 0 ? c.mp / c.maxMp : 1;

  const st = statsAt(to, c.level);

  // Carry a nickname; retitle only if the creature still wore its species name.
  if (c.name === from.name) c.name = to.name;

  c.speciesId = to.id;
  c.attribute = to.attribute;
  c.element = to.element;
  c.maxHp = st.hp;
  c.maxMp = st.mp;
  c.hp = Math.max(1, Math.round(st.hp * hpFrac));
  c.mp = Math.min(st.mp, Math.round(st.mp * mpFrac));
  c.off = st.off;
  c.def = st.def;
  c.spd = st.spd;
  c.mag = st.mag;
  c.res = st.res;
  // Fold the new form's moves into the known pool (never removing any) and
  // auto-fill free loadout slots. De-evolving keeps everything learned, so
  // evolve→devolve→evolve is lossless and only ever grows the known pool.
  const gainedMoves = syncMoves(c);
  c.guarding = false;

  return { fromId: from.id, toId: to.id, name: c.name, gainedMoves };
}

/**
 * Evolves a creature along one branch. With no `toId`, takes the sole eligible
 * branch (and refuses if the choice is ambiguous). Returns the result, or null if
 * the creature can't take that branch right now.
 */
export function evolve(c: CreatureInstance, toId?: string): EvolveResult | null {
  const options = evolutionOptions(c);
  if (!options.length) return null;
  let target = toId;
  if (!target) {
    if (options.length !== 1) return null; // ambiguous — caller must pick a branch
    target = options[0].to;
  }
  if (!options.some((o) => o.to === target)) return null; // not an eligible branch
  const from = c.speciesId;
  const res = applyForm(c, target);
  // Remember exactly where this soul came from, so it can walk back down the
  // same path even if `target` is reachable from other bases too.
  c.evolvedFrom = [...(c.evolvedFrom ?? []), from];
  return res;
}

/** De-evolves a creature one step back toward its base form. */
export function devolve(c: CreatureInstance): EvolveResult | null {
  const stack = c.evolvedFrom;
  const target = devolveTargetId(c);
  if (!target) return null;
  const res = applyForm(c, target);
  // Pop the ancestry we just walked back into. When we were relying on the
  // static fallback (no stack), stay on the fallback for any further steps.
  c.evolvedFrom = stack?.length ? stack.slice(0, -1) : undefined;
  return res;
}
