import { species } from '../../data/creatures';
import type { Species, Stats } from '../../data/creatures';
import type { AttributeId, ElementId } from '../../data/elements';

/** A concrete creature in someone's party (or an enemy formation). */
export interface CreatureInstance {
  uid: string;
  speciesId: string;
  name: string;
  level: number;
  attribute: AttributeId;
  element: ElementId;
  maxHp: number;
  hp: number;
  maxMp: number;
  mp: number;
  off: number;
  def: number;
  spd: number;
  techniques: string[];
  /** Set while the creature is guarding this round. */
  guarding: boolean;
}

let uidCounter = 0;

export function statsAt(s: Species, level: number): Stats {
  const n = Math.max(0, level - 1);
  return {
    hp: Math.round(s.base.hp + s.growth.hp * n),
    mp: Math.round(s.base.mp + s.growth.mp * n),
    off: Math.round(s.base.off + s.growth.off * n),
    def: Math.round(s.base.def + s.growth.def * n),
    spd: Math.round(s.base.spd + s.growth.spd * n),
  };
}

export function makeCreature(speciesId: string, level: number, nickname?: string): CreatureInstance {
  const s = species(speciesId);
  const st = statsAt(s, level);
  return {
    uid: `c${++uidCounter}`,
    speciesId,
    name: nickname ?? s.name,
    level,
    attribute: s.attribute,
    element: s.element,
    maxHp: st.hp,
    hp: st.hp,
    maxMp: st.mp,
    mp: st.mp,
    off: st.off,
    def: st.def,
    spd: st.spd,
    techniques: s.techniques.slice(),
    guarding: false,
  };
}

export const isDown = (c: CreatureInstance): boolean => c.hp <= 0;
export const isUp = (c: CreatureInstance): boolean => c.hp > 0;

export function fullRestore(party: CreatureInstance[]) {
  for (const c of party) {
    c.hp = c.maxHp;
    c.mp = c.maxMp;
    c.guarding = false;
  }
}

/** Small out-of-battle recovery, e.g. after a won fight. */
export function reviveFainted(party: CreatureInstance[], fraction = 0.25) {
  for (const c of party) {
    if (isDown(c)) c.hp = Math.max(1, Math.round(c.maxHp * fraction));
  }
}
