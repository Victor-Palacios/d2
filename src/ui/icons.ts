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

/**
 * Line-art glyphs for the main grid menu, drawn in `currentColor`/stroke so the
 * card can tint them. Kept asset-free like the rest of the UI.
 */
const MENU_ICONS: Record<string, string> = {
  // Party — three bonded souls.
  party: '<circle cx="7" cy="9" r="3.4"/><circle cx="17" cy="9" r="3.4"/><circle cx="12" cy="15" r="3.8"/>',
  // Soularium — an open book of names.
  soularium:
    '<path d="M12 5 C9 3 5 3 3 4 V19 C5 18 9 18 12 20 Z"/><path d="M12 5 C15 3 19 3 21 4 V19 C19 18 15 18 12 20 Z"/>',
  // Sanctuary — a keeping-urn.
  sanctuary: '<path d="M8 3 H16 V5 A6 6 0 0 1 17 8 V16 A4 4 0 0 1 13 20 H11 A4 4 0 0 1 7 16 V8 A6 6 0 0 1 8 5 Z"/>',
  // Arrange — reorder up / down.
  arrange: '<path d="M12 2 L7 8 H17 Z"/><path d="M12 22 L7 16 H17 Z"/>',
};

/** Inline SVG glyph for a grid-menu entry, tinted with `color`. */
export function menuIcon(name: string, color: string, size = 30): string {
  const inner = MENU_ICONS[name] ?? MENU_ICONS.party;
  return (
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" ` +
    `fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round">${inner}</svg>`
  );
}
