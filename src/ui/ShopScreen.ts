import { el, esc, remove } from './dom';
import { Menu } from './Menu';
import type { MenuItem } from './Menu';
import { ITEMS, SHOP_STOCK } from '../data/items';
import { game } from '../systems/party/gameState';
import { audio } from '../engine/Audio';
import { toast } from './Toast';

/**
 * Vendor screen (plan §2.7). Buying deducts obols and files the item into the
 * bag; the bought consumables are then used from the Items menu
 * (`ui/ItemsScreen.ts`).
 */
export async function openShop(parent: HTMLElement): Promise<void> {
  const root = el('div', 'screen');
  root.appendChild(el('h1', 'title-main', 'SUPPLY BAY'));
  root.appendChild(el('p', 'title-sub', 'The Everwake — keepers with leave only'));

  const wrap = el('div', 'shop-wrap');
  const listPanel = el('div', 'panel');
  listPanel.appendChild(el('h2', undefined, 'Stock'));
  const menuHost = el('div');
  listPanel.appendChild(menuHost);

  const info = el('div', 'panel');
  info.appendChild(el('h2', undefined, 'Details'));
  const desc = el('div', 'desc');
  info.appendChild(desc);
  const wallet = el('div', 'row');
  info.appendChild(wallet);

  wrap.append(listPanel, info);
  root.appendChild(wrap);
  root.appendChild(el('div', 'hint', 'UP/DOWN browse · Z/ENTER buy · X leave'));
  parent.appendChild(root);

  const refreshWallet = () => {
    wallet.innerHTML = `<span class="dim">Obols</span> <span class="accent">${game.obols}</span>`;
  };

  const items = (): MenuItem[] =>
    SHOP_STOCK.map((id) => {
      const it = ITEMS[id];
      const owned = game.itemCount(id);
      return {
        value: id,
        label: it.name + (owned ? ` x${owned}` : ''),
        note: `${it.price}c`,
        disabled: game.obols < it.price,
      };
    });

  const showDesc = (id: string) => {
    const it = ITEMS[id];
    desc.innerHTML = `<strong>${esc(it.name)}</strong><br><span class="dim">${esc(it.desc)}</span>`;
  };

  refreshWallet();

  for (;;) {
    const menu = new Menu(menuHost, items(), {
      cancellable: true,
      onHighlight: (v) => showDesc(v),
    });
    const choice = await menu.open();
    menu.destroy();
    if (!choice) break;

    const it = ITEMS[choice];
    if (game.obols < it.price) {
      audio.sfx('cancel');
      toast(parent, '<span class="danger">Not enough obols.</span>', 1400);
      continue;
    }
    game.obols -= it.price;
    game.addItem(it.id);
    audio.sfx('chest');
    toast(parent, `Bought <span class="accent">${esc(it.name)}</span>`, 1400);
    refreshWallet();
  }

  remove(root);
}
