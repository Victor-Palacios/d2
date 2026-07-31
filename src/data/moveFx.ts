import type { ElementId } from './elements';
import { ELEMENTS } from './elements';
import type { Technique } from './techniques';
import { techShape } from './techniques';

/**
 * Per-move battle FX (the "what does *this attack* look like" layer).
 *
 * The battle already tints its generic hit-spark by the move's element. This
 * goes a step further: every technique gets a *shaped* effect derived from its
 * data — a melee slash, a flying bolt, an area nova, or a mending bloom — tinted
 * and weighted by its element and power. It reuses the shared `ParticleField`
 * (procedural, additive, feeds the bloom threshold), so a distinct-looking move
 * costs no new draw call and no binary asset.
 *
 * Nothing here is authored per-technique by hand: `moveFx()` reads the fields a
 * technique already carries (`element`, `kind`, `melee`, `shape`, `power`) and
 * composes a profile. A small `MOVE_FX_OVERRIDES` table exists for signature
 * moves (a boss's Sun Claw, say) that deserve a look their archetype wouldn't
 * give them — the same data-driven, optional-override shape as `battleFx.ts`.
 */

/** How a move reaches its target(s) — the single biggest driver of its look. */
export type MoveDelivery =
  | 'melee' // a close slash/bite: a tight, fast fan of sparks at the target
  | 'bolt' //  a ranged single-target projectile that streaks caster → target
  | 'nova' //  a row/column/whole-side sweep: a wide, hard-hitting burst
  | 'mend'; //  a heal: soft motes rising off the mended ally

export interface MoveFx {
  delivery: MoveDelivery;
  /** Additive tint — the move's element colour. */
  color: number;
  /**
   * Vertical pull on impact/trail motes. Follows `ParticleField` physics:
   * negative falls (normal gravity), positive floats upward. Heals rise.
   */
  gravity: number;
  size: number;
  upBias: number;
  /** Projectile travel speed for `bolt`, world units/sec (0 for the rest). */
  boltSpeed: number;
  /** The burst where the move lands. */
  impact: { count: number; speed: number; spread: number; life: number };
  /** The wind-up at the caster the instant before it delivers. */
  cast: { count: number; speed: number; spread: number; life: number };
  /** Camera shake on impact. */
  shake: number;
  /** World-space radius of the bright additive flash sprite at the impact point. */
  flash: number;
}

/** Per-element motion + colour: the "feel" of each element's motes. */
interface ElementLook {
  color: number;
  gravity: number;
  size: number;
  upBias: number;
}
const ELEMENT_LOOK: Record<ElementId, ElementLook> = {
  // Fire leaps up and lingers; water splashes and falls hard; nature drifts;
  // machine throws snappy short sparks; dark hangs as slow heavy smoke. Sizes
  // are deliberately chunky so the bursts read against the painterly arena.
  fire: { color: ELEMENTS.fire.light, gravity: -2.4, size: 0.26, upBias: 1.1 },
  water: { color: ELEMENTS.water.light, gravity: -6, size: 0.23, upBias: 0.5 },
  nature: { color: ELEMENTS.nature.light, gravity: -1.4, size: 0.24, upBias: 0.7 },
  machine: { color: ELEMENTS.machine.light, gravity: -6.5, size: 0.2, upBias: 0.6 },
  dark: { color: ELEMENTS.dark.light, gravity: -0.6, size: 0.3, upBias: 0.35 },
};

/** Per-delivery burst shape, before the element tint and power scaling. */
interface DeliveryBase {
  impact: { count: number; speed: number; spread: number; life: number };
  cast: { count: number; speed: number; spread: number; life: number };
  boltSpeed: number;
  shake: number;
  /** Base radius of the impact flash sprite (scaled by power). */
  flash: number;
}
const DELIVERY: Record<MoveDelivery, DeliveryBase> = {
  melee: {
    impact: { count: 34, speed: 3.4, spread: 1.4, life: 0.7 },
    cast: { count: 14, speed: 1.4, spread: 0.6, life: 0.4 },
    boltSpeed: 0,
    shake: 0.3,
    flash: 1.9,
  },
  bolt: {
    impact: { count: 38, speed: 3, spread: 1, life: 0.7 },
    cast: { count: 16, speed: 1.1, spread: 0.45, life: 0.45 },
    boltSpeed: 15,
    shake: 0.26,
    flash: 1.9,
  },
  nova: {
    impact: { count: 52, speed: 4, spread: 2.4, life: 0.85 },
    cast: { count: 22, speed: 1.6, spread: 0.7, life: 0.5 },
    boltSpeed: 0,
    shake: 0.46,
    flash: 3,
  },
  mend: {
    impact: { count: 28, speed: 1.6, spread: 0.9, life: 1 },
    cast: { count: 12, speed: 0.9, spread: 0.45, life: 0.55 },
    boltSpeed: 0,
    shake: 0,
    flash: 1.5,
  },
};

/**
 * Signature overrides for a handful of moves whose archetype look would sell
 * them short. Anything omitted here is fully derived. Keep this list short —
 * it's for marquee moves (bosses, capstones), not routine ones.
 */
interface MoveFxOverride {
  delivery?: MoveDelivery;
  color?: number;
  boltSpeed?: number;
  /** Multiplies impact count/spread + shake, for a bigger or smaller blow. */
  punch?: number;
}
const MOVE_FX_OVERRIDES: Record<string, MoveFxOverride> = {
  // The Warden's single-target finisher: a blazing rake that should hit harder
  // than a plain fire melee.
  sunClaw: { punch: 1.4 },
  // The Warden's arena-wide roar: a huge fiery nova.
  regalRoar: { punch: 1.45 },
  // The free basic Attack is the move players use most, so it must read clearly
  // rather than fade — its low power would otherwise shrink it. Bump it back up
  // to a full, punchy jab.
  strike: { punch: 1.5 },
};

function deliveryOf(t: Technique): MoveDelivery {
  if (t.kind === 'heal') return 'mend';
  if (t.melee) return 'melee';
  if (techShape(t) !== 'single') return 'nova';
  return 'bolt';
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/**
 * Compose a move's FX profile from its data. Deterministic and pure — the scene
 * calls this once per action and drives the shared particle field from it.
 */
export function moveFx(t: Technique): MoveFx {
  const override = MOVE_FX_OVERRIDES[t.id];
  const delivery = override?.delivery ?? deliveryOf(t);
  const look = ELEMENT_LOOK[t.element];
  const base = DELIVERY[delivery];
  const isMend = delivery === 'mend';

  // Bigger-power moves land with a fuller burst and a harder shake; a normal
  // technique (~power 46) sits at 1.0. Overrides can nudge it further.
  const punch = clamp(t.power / 46, 0.75, 1.5) * (override?.punch ?? 1);

  return {
    delivery,
    color: override?.color ?? look.color,
    gravity: isMend ? 1.4 : look.gravity,
    size: look.size,
    upBias: isMend ? 1 : look.upBias,
    boltSpeed: override?.boltSpeed ?? base.boltSpeed,
    impact: {
      count: Math.round(base.impact.count * punch),
      speed: base.impact.speed,
      spread: base.impact.spread * clamp(punch, 0.85, 1.3),
      life: base.impact.life,
    },
    cast: { ...base.cast },
    shake: base.shake * punch,
    flash: base.flash * clamp(punch, 0.85, 1.4),
  };
}
