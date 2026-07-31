import { clear, el, esc, remove } from './dom';
import { Menu } from './Menu';
import type { MenuItem } from './Menu';
import { ITEMS } from '../data/items';
import { ATTRIBUTES, ELEMENTS } from '../data/elements';
import { game } from '../systems/party/gameState';
import { classIcon } from './icons';
import { audio } from '../engine/Audio';
import { toast } from './Toast';

/**
 * The Items menu — use a consumable from the bag (plan §2.7, now wired up).
 *
 * HP / MP items ask which soul to use them on; a Light Shard refills the lantern
 * outright. Items with no `effect` (the Homing Ember, the Reach Map) are held
 * but can't be used from here yet. Opens in town and while crawling.
 */
export async function openItems(parent: HTMLElement): Promise<void> {
  const root = el('div', 'screen');
  root.id = 'items-screen';
  root.appendChild(el('h1', 'title-main', 'ITEMS'));
  root.appendChild(el('p', 'title-sub', 'Use a keepsake from your bag'));

  const wrap = el('div', 'shop-wrap');
  const listPanel = el('div', 'panel');
  listPanel.appendChild(el('h2', undefined, 'Bag'));
  const menuHost = el('div');
  listPanel.appendChild(menuHost);

  const info = el('div', 'panel');
  info.appendChild(el('h2', undefined, 'Detail'));
  const desc = el('div', 'desc');
  info.appendChild(desc);

  wrap.append(listPanel, info);
  root.appendChild(wrap);
  const hint = el('div', 'hint', 'UP/DOWN browse · Z/ENTER use · X close');
  root.appendChild(hint);
  parent.appendChild(root);

  /** Owned, defined items with a count, most valuable first for a stable order. */
  const owned = (): string[] =>
    Object.keys(game.bag)
      .filter((id) => ITEMS[id] && game.itemCount(id) > 0)
      .sort((a, b) => ITEMS[b].price - ITEMS[a].price);

  const listItems = (): MenuItem[] => {
    const ids = owned();
    if (!ids.length) return [{ value: '', label: 'Your bag is empty', note: '—', disabled: true }];
    return ids.map((id) => {
      const it = ITEMS[id];
      return { value: id, label: it.name, note: `x${game.itemCount(id)}`, disabled: !it.effect };
    });
  };

  const showDesc = (id: string) => {
    clear(desc);
    const it = ITEMS[id];
    if (!it) {
      desc.innerHTML = '<span class="dim">Nothing to use. Buy supplies at the Supply Bay.</span>';
      return;
    }
    const usable = it.effect
      ? '<span class="ok">Usable now.</span>'
      : "<span class=\"dim\">Can't be used from here yet.</span>";
    desc.innerHTML =
      `<strong>${esc(it.name)}</strong> <span class="dim">x${game.itemCount(it.id)}</span>` +
      `<br><span class="dim">${esc(it.desc)}</span><br>${usable}`;
  };

  /** Pick a party member for an HP/MP item; shows the relevant meter. Null cancels. */
  const pickTarget = async (stat: 'hp' | 'mp'): Promise<string | null> => {
    const items: MenuItem[] = game.party.map((c) => ({
      value: c.uid,
      label: c.name,
      note: stat === 'hp' ? `HP ${c.hp}/${c.maxHp}` : `MP ${c.mp}/${c.maxMp}`,
      color: ELEMENTS[c.element].color,
    }));
    const menu = new Menu(menuHost, items, {
      cancellable: true,
      onHighlight: (uid) => {
        const c = game.party.find((m) => m.uid === uid);
        if (c) {
          const attr = ATTRIBUTES[c.attribute];
          desc.innerHTML =
            `<strong>${classIcon(c.attribute)} ${esc(c.name)}</strong> <span class="dim">Lv${c.level} · ${attr.name}</span>` +
            `<br><span class="dim">HP</span> ${c.hp}/${c.maxHp} &nbsp; <span class="dim">MP</span> ${c.mp}/${c.maxMp}`;
        }
      },
    });
    const uid = await menu.open();
    menu.destroy();
    return uid;
  };

  const useItem = async (id: string): Promise<void> => {
    const it = ITEMS[id];
    const eff = it.effect;
    if (!eff) {
      audio.sfx('cancel');
      toast(parent, `<span class="dim">You can't use ${esc(it.name)} from here.</span>`, 1600);
      return;
    }

    if (eff.kind === 'light') {
      if (game.light >= game.maxLight) {
        audio.sfx('cancel');
        toast(parent, '<span class="dim">Your lantern is already full.</span>', 1600);
        return;
      }
      const before = game.light;
      game.light = Math.min(game.maxLight, game.light + eff.amount);
      game.takeItem(id);
      audio.sfx('pickup');
      toast(parent, `<span class="ok">+${game.light - before} LP</span>`, 1400);
      return;
    }

    // HP / MP: choose who to use it on.
    hint.textContent = 'Use on which soul? · Z/ENTER confirm · X back';
    const uid = await pickTarget(eff.kind);
    hint.textContent = 'UP/DOWN browse · Z/ENTER use · X close';
    if (!uid) return;
    const c = game.party.find((m) => m.uid === uid);
    if (!c) return;

    if (eff.kind === 'hp') {
      const healed = Math.min(eff.amount, c.maxHp - c.hp);
      if (healed <= 0) {
        audio.sfx('cancel');
        toast(parent, `<span class="dim">${esc(c.name)} is already at full HP.</span>`, 1600);
        return;
      }
      c.hp += healed;
      game.takeItem(id);
      audio.sfx('pickup');
      toast(parent, `${esc(c.name)} recovers <span class="ok">${healed} HP</span>.`, 1600);
    } else {
      const gained = Math.min(eff.amount, c.maxMp - c.mp);
      if (gained <= 0) {
        audio.sfx('cancel');
        toast(parent, `<span class="dim">${esc(c.name)} is already at full MP.</span>`, 1600);
        return;
      }
      c.mp += gained;
      game.takeItem(id);
      audio.sfx('pickup');
      toast(parent, `${esc(c.name)} recovers <span class="ok">${gained} MP</span>.`, 1600);
    }
  };

  for (;;) {
    const menu = new Menu(menuHost, listItems(), { cancellable: true, onHighlight: (v) => showDesc(v) });
    const choice = await menu.open();
    menu.destroy();
    if (!choice) break;
    await useItem(choice);
  }

  remove(root);
}
