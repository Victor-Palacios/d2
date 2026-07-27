import type { AttributeId } from '../data/elements';
import { ATTRIBUTES } from '../data/elements';

/**
 * Class glyphs (plan §5.1) as inline SVG — one per class, kept asset-free like
 * the rest of the game. Read them as: Hero = shield (armour), Assassin =
 * dagger (the blade that strikes first), Mage = star (the cast spell).
 */
const CLASS_PATHS: Record<AttributeId, string> = {
  hero: 'M8 1 L14 3.2 V8 C14 11.7 11.4 14.2 8 15.4 C4.6 14.2 2 11.7 2 8 V3.2 Z',
  assassin:
    'M8 1 L9.6 9 L6.4 9 Z M3.4 9 L12.6 9 L12.6 10.6 L3.4 10.6 Z M7.2 10.6 L8.8 10.6 L8.8 15.2 L7.2 15.2 Z',
  mage: 'M8 0.8 L9.5 6.5 L15.2 8 L9.5 9.5 L8 15.2 L6.5 9.5 L0.8 8 L6.5 6.5 Z',
};

/**
 * Inline SVG glyph for a creature's class, tinted with the class colour. Used on
 * fighter cards and the party roster so the class reads at a glance while the
 * box border carries the element.
 */
export function classIcon(attr: AttributeId, size = 13): string {
  const def = ATTRIBUTES[attr];
  return (
    `<svg class="cls-icon" viewBox="0 0 16 16" width="${size}" height="${size}" ` +
    `role="img" aria-label="${def.name}"><title>${def.name}</title>` +
    `<path fill="${def.color}" d="${CLASS_PATHS[attr]}"/></svg>`
  );
}
