/**
 * Item stubs. The shop (plan §2.7) lists these; purchasing deducts credits and
 * files the item into the bag. Using items in battle is deliberately out of
 * scope for the first hour — the Item action is present but disabled.
 */

export interface ItemDef {
  id: string;
  name: string;
  price: number;
  desc: string;
}

export const ITEMS: Record<string, ItemDef> = {
  repairChip: {
    id: 'repairChip',
    name: 'Repair Chip',
    price: 120,
    desc: 'Restores 60 HP to one creature. (Battle use not wired up yet.)',
  },
  bufferCell: {
    id: 'bufferCell',
    name: 'Buffer Cell',
    price: 150,
    desc: 'Restores 30 MP to one creature.',
  },
  fuelCanister: {
    id: 'fuelCanister',
    name: 'Fuel Canister',
    price: 90,
    desc: 'Refills 40 EP of vehicle fuel while crawling a domain.',
  },
  towBeacon: {
    id: 'towBeacon',
    name: 'Tow Beacon',
    price: 200,
    desc: 'Emergency return to The Everwake without losing your haul.',
  },
  domainMap: {
    id: 'domainMap',
    name: 'Domain Map',
    price: 260,
    desc: 'Marks portals and chests on the crawl HUD. Cosmetic for now.',
  },
};

export const SHOP_STOCK = ['repairChip', 'bufferCell', 'fuelCanister', 'towBeacon', 'domainMap'];
