import type { AttributeId } from '../data/elements';
import { ATTRIBUTES } from '../data/elements';

/**
 * Class glyphs (plan §5.1) as inline SVG — one per class, kept asset-free like
 * the rest of the game. Read them as: Hero = shield (armour), Assassin =
 * dagger (the blade that strikes first), Mage = star (the cast spell).
 */
const CLASS_PATHS: Record<AttributeId, string> = {
  hero: 'M8 1 L14 3.2 V8 C14 11.7 11.4 14.2 8 15.4 C4.6 14.2 2 11.7 2 8 V3.2 Z',
  assassin: 'M8 1 L9.6 9 L6.4 9 Z M3.4 9 L12.6 9 L12.6 10.6 L3.4 10.6 Z M7.2 10.6 L8.8 10.6 L8.8 15.2 L7.2 15.2 Z',
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
 * Icon glyphs for the main grid menu. Each mixes a soft `currentColor` fill (a
 * body) with a crisp stroked outline, so the cards read as bold, distinct marks
 * rather than thin line-art. Drawn in `currentColor` so a card can tint them;
 * kept asset-free like the rest of the UI. `f` = translucent fill; `o` = outline.
 */
const f = (d: string) => `<path d="${d}" fill="currentColor" fill-opacity="0.22" stroke="none"/>`;
const MENU_ICONS: Record<string, string> = {
  // Party — three bonded souls, the leader filled, joined by a bond.
  party:
    '<circle cx="7.5" cy="9" r="2.7"/><circle cx="16.5" cy="9" r="2.7"/>' +
    '<circle cx="12" cy="14.5" r="3.1" fill="currentColor" fill-opacity="0.22"/><circle cx="12" cy="14.5" r="3.1"/>' +
    '<path d="M9.6 10.6 L12 14.5 L14.4 10.6"/>',
  // Gear — a kite shield with a blade down the centre (arms & shrouds).
  gear:
    f('M12 3 L19 6 V11 C19 16 16 19 12 21 C8 19 5 16 5 11 V6 Z') +
    '<path d="M12 3 L19 6 V11 C19 16 16 19 12 21 C8 19 5 16 5 11 V6 Z"/>' +
    '<path d="M12 7 V16 M9.2 10 H14.8"/>',
  // Moves — a list of techniques with a toggle switch on the last row.
  moves:
    '<path d="M5 7 H15"/><path d="M5 12 H15"/><path d="M5 17 H11"/>' +
    '<rect x="14" y="15" width="6" height="4" rx="2" fill="currentColor" fill-opacity="0.22"/>' +
    '<rect x="14" y="15" width="6" height="4" rx="2"/><circle cx="18" cy="17" r="1.2" fill="currentColor"/>',
  // Items — a round-bottomed flask with a measure of liquid in it.
  items:
    '<path d="M10 3 H14"/>' +
    f('M8.4 13 H15.6 L17.4 16.6 A3.3 3.3 0 0 1 14.5 21 H9.5 A3.3 3.3 0 0 1 6.6 16.6 Z') +
    '<path d="M11 3.4 V8 L6.6 16.6 A3.3 3.3 0 0 0 9.5 21 H14.5 A3.3 3.3 0 0 0 17.4 16.6 L13 8 V3.4"/>',
  // Soularium — an open book of names, with a spine.
  soularium:
    f('M12 5 C9 3 5 3 3 4 V18 C5 17 9 17 12 19 C15 17 19 17 21 18 V4 C19 3 15 3 12 5 Z') +
    '<path d="M12 5 C9 3 5 3 3 4 V18 C5 17 9 17 12 19 C15 17 19 17 21 18 V4 C19 3 15 3 12 5 Z"/><path d="M12 5 V19"/>',
  // Sanctuary — a keeping-urn with a band.
  sanctuary:
    f('M8 3 H16 V5 A6 6 0 0 1 17 8 V15 A5 5 0 0 1 12 20 A5 5 0 0 1 7 15 V8 A6 6 0 0 1 8 5 Z') +
    '<path d="M8 3 H16 V5 A6 6 0 0 1 17 8 V15 A5 5 0 0 1 12 20 A5 5 0 0 1 7 15 V8 A6 6 0 0 1 8 5 Z"/><path d="M8.5 10 H15.5"/>',
  // Transcend — a soul (filled dot) ascending above two rising wings.
  transcend:
    '<circle cx="12" cy="5" r="1.7" fill="currentColor"/><path d="M6 14 L12 8.5 L18 14"/><path d="M6 19 L12 13.5 L18 19"/>',
};

/** Inline SVG glyph for a grid-menu entry, tinted with `color`. Big and bold. */
export function menuIcon(name: string, color: string, size = 42): string {
  const inner = MENU_ICONS[name] ?? MENU_ICONS.party;
  return (
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" ` +
    `style="color:${color}" fill="none" stroke="currentColor" stroke-width="1.7" ` +
    `stroke-linejoin="round" stroke-linecap="round">${inner}</svg>`
  );
}
