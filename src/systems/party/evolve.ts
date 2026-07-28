import type { CreatureInstance } from './creature';
import { statsAt } from './creature';
import { SPECIES, species, movesKnownAt } from '../../data/creatures';
import type { EvolutionOption } from '../../data/creatures';

/**
 * Transcendence — the evolution system (plan §5.6).
 *
 * A **Pokémon × Digimon hybrid**:
 * - **Level-triggered** (Pokémon): a branch unlocks at a set level (usually 10).
 *   Predictable, no items or hidden conditions to reverse-engineer.
 * - **Branching** (Digimon): a species may offer more than one form. Branches are
 *   authored to stay thematically bound to the base, so a line keeps its identity
 *   — the fix for Digimon's "any starter can become any top form" criticism.
 * - **Reversible** (Digimon): every evolution can be undone — a soul can always
 *   return to the shape it was, the part of Digimon players love. De-evolution is
 *   derived from the forward tree (below), so it is always exact and needs no
 *   extra data on the creature or in the save.
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

/** Branches a creature is currently eligible to take (level-gated). */
export function evolutionOptions(c: CreatureInstance): EvolutionOption[] {
  const s = SPECIES[c.speciesId];
  if (!s?.evolutions) return [];
  return s.evolutions.filter((o) => c.level >= o.level);
}

/** Every branch the species defines, eligible or not (for a "not yet" preview). */
export function allEvolutions(c: CreatureInstance): EvolutionOption[] {
  return SPECIES[c.speciesId]?.evolutions ?? [];
}

export const canEvolve = (c: CreatureInstance): boolean => evolutionOptions(c).length > 0;

/** The species this creature would de-evolve into, or null if it is a base form. */
export function devolveTargetId(c: CreatureInstance): string | null {
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

  const before = new Set(c.techniques);
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
  c.techniques = movesKnownAt(to, c.level);
  c.guarding = false;

  const gainedMoves = c.techniques.filter((t) => !before.has(t));
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
  return applyForm(c, target);
}

/** De-evolves a creature one step back toward its base form. */
export function devolve(c: CreatureInstance): EvolveResult | null {
  const target = devolveTargetId(c);
  if (!target) return null;
  return applyForm(c, target);
}
