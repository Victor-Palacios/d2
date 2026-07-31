/**
 * Items. The shop (plan §2.7) lists these; purchasing deducts obols and files
 * the item into the bag. Consumables carry an `effect` and can be used from the
 * Items menu (see `ui/ItemsScreen.ts`); items with no `effect` are held for shop
 * value or a future hook and cannot be used yet.
 */

/** What using a consumable does. HP/MP target one creature; Light refills the lantern. */
export type ItemEffect =
  | { kind: 'hp'; amount: number }
  | { kind: 'mp'; amount: number }
  | { kind: 'light'; amount: number };

export interface ItemDef {
  id: string;
  name: string;
  price: number;
  desc: string;
  /** Present on consumables the Items menu can apply. */
  effect?: ItemEffect;
}

export const ITEMS: Record<string, ItemDef> = {
  repairChip: {
    id: 'repairChip',
    name: 'Mending Balm',
    price: 120,
    desc: 'Restores 60 HP to one creature.',
    effect: { kind: 'hp', amount: 60 },
  },
  bufferCell: {
    id: 'bufferCell',
    name: 'Focus Draught',
    price: 150,
    desc: 'Restores 30 MP to one creature.',
    effect: { kind: 'mp', amount: 30 },
  },
  fuelCanister: {
    id: 'fuelCanister',
    name: 'Light Shard',
    price: 90,
    desc: 'Restores 40 LP to the lantern.',
    effect: { kind: 'light', amount: 40 },
  },
  towBeacon: {
    id: 'towBeacon',
    name: 'Homing Ember',
    price: 200,
    desc: 'Flare it from the crawl pause menu (ESC) for an emergency escape back to The Everwake. Your haul comes with you; one Ember is spent per use.',
  },
  reachMap: {
    id: 'reachMap',
    name: 'Reach Map',
    price: 260,
    desc: 'Marks portals and chests on the crawl HUD. Cosmetic for now.',
  },
};

export const SHOP_STOCK = ['repairChip', 'bufferCell', 'fuelCanister', 'towBeacon', 'reachMap'];
