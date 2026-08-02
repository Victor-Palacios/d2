import type { AttributeId, ElementId } from './elements';

/**
 * Per-monster battle visual effects (the polish pass, plan §6 flavour).
 *
 * The battle already has *generic* hit FX — element-tinted sparks, screen
 * shake, a white hit-flash and floating damage — but those key off the
 * *technique*, not the creature, so every monster reads the same while it
 * simply stands in the arena. A `BattleAura` gives each species a quiet,
 * continuous signature it wears the whole fight: emberling smoulders, the
 * dark wisps trail violet smoke, the boss burns with a warm glow.
 *
 * It is deliberately data. **Every** species has an aura: a handful of
 * hand-tuned entries in `BATTLE_AURAS` (the starters, the Crossing echoes and
 * the Warden), and — for everyone else — an element-keyed default from
 * `ELEMENT_AURAS`, lightly modulated by the creature's class. So the roster is
 * fully covered while a bespoke entry stays an easy per-species override.
 *
 * All colours are additive so they land in the bloom threshold and read as
 * "HD", matching the torch / portal / element-plate flair.
 */

export interface BattleAura {
  /** Particle tint (additive). */
  color: number;
  /** Emitted particles per second — the density of the signature. */
  rate: number;
  /** Fraction of the sprite's height the motes spawn from (0 feet … 1 crown). */
  originY: number;
  /** Radius of the spawn scatter around that point, in world units. */
  originSpread?: number;
  /** Launch speed. */
  speed?: number;
  /** Sideways spread of the launch velocity. */
  spread?: number;
  /** Upward launch bias (negative sinks). */
  upBias?: number;
  /** Downward pull (negative rises — embers curl up, droplets fall). */
  gravity?: number;
  /** Particle lifetime, seconds. */
  life?: number;
  /** Particle size. */
  size?: number;
  /**
   * Optional coloured glow riding the sprite. Reserved for wardens: the arena
   * keeps a deliberately small light budget (README, the HD-2D recipe), so a
   * per-fighter light is the boss's privilege, not every echo's.
   */
  light?: { color: number; intensity: number; range?: number };
}

export const BATTLE_AURAS: Record<string, BattleAura> = {
  // --- the three starters (whichever one rides your lantern) --------------
  emberling: {
    color: 0xff7a2d,
    rate: 6,
    originY: 0.45,
    originSpread: 0.28,
    speed: 0.55,
    spread: 0.5,
    upBias: 0.9,
    gravity: 0.5,
    life: 0.9,
    size: 0.09,
  },
  glidefang: {
    color: 0x8fe4ff,
    rate: 4,
    originY: 0.55,
    originSpread: 0.34,
    speed: 0.45,
    spread: 0.9,
    upBias: 0.35,
    gravity: -0.25,
    life: 1.3,
    size: 0.08,
  },
  nightnip: {
    color: 0xb26dff,
    rate: 5,
    originY: 0.55,
    originSpread: 0.3,
    speed: 0.5,
    spread: 0.8,
    upBias: 0.2,
    gravity: 0.7,
    life: 0.9,
    size: 0.08,
  },

  // --- echoes met on the Crossing floors ----------------------------------
  mitebug: {
    color: 0x8fe89a,
    rate: 3,
    originY: 0.4,
    originSpread: 0.22,
    speed: 0.3,
    spread: 0.7,
    upBias: 0.45,
    gravity: 0.3,
    life: 1.0,
    size: 0.06,
  },
  scrapmite: {
    color: 0xbcd4f0,
    rate: 5,
    originY: 0.35,
    originSpread: 0.24,
    speed: 0.9,
    spread: 0.6,
    upBias: 0.7,
    gravity: -3.2,
    life: 0.5,
    size: 0.07,
  },
  sprigling: {
    color: 0x9fe6a6,
    rate: 3,
    originY: 0.5,
    originSpread: 0.3,
    speed: 0.25,
    spread: 0.6,
    upBias: 0.6,
    gravity: 0.12,
    life: 1.4,
    size: 0.07,
  },
  gloomote: {
    color: 0xc77dff,
    rate: 5,
    originY: 0.55,
    originSpread: 0.32,
    speed: 0.35,
    spread: 0.6,
    upBias: 0.5,
    gravity: 0.15,
    life: 1.3,
    size: 0.1,
  },
  dropletta: {
    color: 0x5fd6ff,
    rate: 4,
    originY: 0.4,
    originSpread: 0.28,
    speed: 0.4,
    spread: 0.7,
    upBias: 0.4,
    gravity: 0.9,
    life: 0.9,
    size: 0.08,
  },

  // --- the Warden — grander, and the one fighter granted a glow ------------
  regalion: {
    color: 0xff8a3d,
    rate: 11,
    originY: 0.68,
    originSpread: 0.5,
    speed: 0.9,
    spread: 0.9,
    upBias: 1.0,
    gravity: 0.5,
    life: 1.0,
    size: 0.12,
    light: { color: 0xff7a2d, intensity: 3.2, range: 5.5 },
  },
};

/**
 * The default aura every species falls back to, keyed by its **element**. Each
 * has its own motion signature so a fire monster never reads like a water one:
 * embers curl up, droplets settle, spores drift, sparks flick and die, dark
 * smoke rises slow. Colours are seeded from the shared element palette
 * (`ELEMENTS[e].light`) so the auras stay in step with the floor plates and UI
 * chips. None carries a `light` — the per-fighter glow stays a warden privilege.
 */
export const ELEMENT_AURAS: Record<ElementId, BattleAura> = {
  fire: {
    color: 0xff8a3d,
    rate: 6,
    originY: 0.45,
    originSpread: 0.26,
    speed: 0.55,
    spread: 0.5,
    upBias: 0.9,
    gravity: 0.45,
    life: 0.85,
    size: 0.08,
  },
  water: {
    color: 0x4ad6ff,
    rate: 4,
    originY: 0.5,
    originSpread: 0.3,
    speed: 0.4,
    spread: 0.9,
    upBias: 0.35,
    gravity: 0.6,
    life: 1.2,
    size: 0.08,
  },
  nature: {
    color: 0x7bdc8a,
    rate: 3,
    originY: 0.5,
    originSpread: 0.3,
    speed: 0.25,
    spread: 0.6,
    upBias: 0.6,
    gravity: 0.08,
    life: 1.5,
    size: 0.07,
  },
  machine: {
    color: 0xc9d4e8,
    rate: 5,
    originY: 0.4,
    originSpread: 0.24,
    speed: 0.85,
    spread: 0.6,
    upBias: 0.7,
    gravity: -1.8,
    life: 0.55,
    size: 0.06,
  },
  dark: {
    color: 0xc77dff,
    rate: 4,
    originY: 0.55,
    originSpread: 0.32,
    speed: 0.3,
    spread: 0.6,
    upBias: 0.45,
    gravity: 0.12,
    life: 1.35,
    size: 0.1,
  },
};

/**
 * A light per-class overlay on top of an element default, so the three
 * attributes read subtly different without authoring 15 combos. Element stays
 * the dominant signal — this only nudges density and motion:
 *   - **assassin** — sharper and quicker (a touch more rate + speed, tighter).
 *   - **hero** — steadier and heavier (bigger motes, a hair slower).
 *   - **mage** — wispier (fewer, longer-lived, floatier motes).
 * Pure: returns a new object, never mutates the shared default.
 */
function withAttribute(base: BattleAura, attribute: AttributeId): BattleAura {
  switch (attribute) {
    case 'assassin':
      return {
        ...base,
        rate: base.rate * 1.25,
        speed: (base.speed ?? 0.4) * 1.2,
        size: (base.size ?? 0.08) * 0.9,
      };
    case 'hero':
      return {
        ...base,
        rate: base.rate * 0.9,
        speed: (base.speed ?? 0.4) * 0.9,
        size: (base.size ?? 0.08) * 1.2,
      };
    case 'mage':
      return {
        ...base,
        rate: base.rate * 0.8,
        life: (base.life ?? 1) * 1.3,
        upBias: (base.upBias ?? 0.5) + 0.15,
      };
  }
}

/**
 * The aura a fielded creature wears. A hand-tuned `BATTLE_AURAS` entry wins;
 * otherwise the creature gets its element's default, nudged by its class. Never
 * undefined for a real species — every species has an element, so every species
 * has an aura.
 */
export function battleAura(speciesId: string, element: ElementId, attribute?: AttributeId): BattleAura {
  const bespoke = BATTLE_AURAS[speciesId];
  if (bespoke) return bespoke;
  const base = ELEMENT_AURAS[element];
  return attribute ? withAttribute(base, attribute) : base;
}
