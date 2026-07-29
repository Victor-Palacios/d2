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
 * It is deliberately data — one entry per species — so extending it to the
 * later reaches, or swapping a look, is an edit here and nothing else. Only
 * **The Quiet Crossing** roster is populated for now (the three starters that
 * ride the player's lantern, the five echoes met on its floors, and the
 * Warden). A species with no entry simply has no aura, which is a valid state.
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

export function battleAura(speciesId: string): BattleAura | undefined {
  return BATTLE_AURAS[speciesId];
}
