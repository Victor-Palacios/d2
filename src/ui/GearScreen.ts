import { clear, el, esc, remove } from './dom';
import { Menu } from './Menu';
import type { MenuItem } from './Menu';
import { ATTRIBUTES } from '../data/elements';
import { EQUIPMENT, equipment } from '../data/equipment';
import type { EquipSlot } from '../data/equipment';
import { game } from '../systems/party/gameState';
import { equipBonus } from '../systems/party/creature';
import type { CreatureInstance } from '../systems/party/creature';
import { audio } from '../engine/Audio';

const SLOTS: { key: EquipSlot; label: string }[] = [
  { key: 'arms', label: 'Arms' },
  { key: 'shroud', label: 'Shroud' },
  { key: 'memento', label: 'Memento' },
];

/**
 * Gear — fit a soul with what the dead leave behind: Arms, a Shroud, a Memento
 * (one each). Bonuses are flat; a Memento may also carry a battle-special.
 */
export async function openGear(parent: HTMLElement): Promise<void> {
  const root = el('div', 'screen');
  root.id = 'gear';
  root.appendChild(el('h1', 'title-main', 'GEAR'));
  root.appendChild(el('p', 'title-sub', 'What the dead leave behind'));
  const wrap = el('div', 'shop-wrap');
  const listPanel = el('div', 'panel');
  listPanel.appendChild(el('h2', undefined, 'Souls'));
  const menuHost = el('div');
  listPanel.appendChild(menuHost);
  const info = el('div', 'panel');
  info.appendChild(el('h2', undefined, 'Fittings'));
  const desc = el('div', 'desc');
  info.appendChild(desc);
  wrap.append(listPanel, info);
  root.appendChild(wrap);
  root.appendChild(el('div', 'hint', 'UP/DOWN browse · Z/ENTER select · X back'));
  parent.appendChild(root);

  const stat = (c: CreatureInstance) =>
    `<span class="dim">OFF</span> ${c.off}<b>+${equipBonus(c, 'off')}</b> · ` +
    `<span class="dim">DEF</span> ${c.def}<b>+${equipBonus(c, 'def')}</b> · ` +
    `<span class="dim">SPD</span> ${c.spd}<b>+${equipBonus(c, 'spd')}</b>`;

  const showMember = (c: CreatureInstance) => {
    clear(desc);
    desc.innerHTML =
      `<strong>${esc(c.name)}</strong> <span class="dim">Lv${c.level}</span><br>${stat(c)}<br>` +
      SLOTS.map((s) => {
        const id = c.equip?.[s.key];
        return `<span class="dim">${s.label}:</span> ${id ? esc(equipment(id).name) : '—'}`;
      }).join('<br>');
  };

  // Pick a slot on a member, then an item (or remove) for it.
  const editMember = async (c: CreatureInstance) => {
    for (;;) {
      const slotItems: MenuItem[] = SLOTS.map((s) => {
        const id = c.equip?.[s.key];
        return { value: s.key, label: s.label, note: id ? equipment(id).name : 'empty' };
      });
      const slotMenu = new Menu(menuHost, slotItems, {
        cancellable: true,
        onHighlight: () => showMember(c),
      });
      const slot = (await slotMenu.open()) as EquipSlot | null;
      slotMenu.destroy();
      if (!slot) return;

      const owned = Object.keys(EQUIPMENT).filter(
        (id) => equipment(id).slot === slot && game.itemCount(id) > 0,
      );
      const opts: MenuItem[] = [];
      if (c.equip?.[slot]) opts.push({ value: 'remove', label: 'Remove', note: equipment(c.equip[slot]!).name });
      for (const id of owned) {
        const e = equipment(id);
        const bonus = e.off ? `+${e.off} OFF` : e.def ? `+${e.def} DEF` : e.spd ? `+${e.spd} SPD` : e.effect ?? '';
        opts.push({ value: id, label: e.name, note: `${bonus} ×${game.itemCount(id)}` });
      }
      if (!opts.length) opts.push({ value: 'none', label: 'no gear for this slot', disabled: true });

      const itemMenu = new Menu(menuHost, opts, { cancellable: true });
      const pick = await itemMenu.open();
      itemMenu.destroy();
      if (!pick || pick === 'none') continue;

      const cur = c.equip?.[slot];
      if (pick === 'remove') {
        if (cur) { game.addItem(cur); delete c.equip[slot]; audio.sfx('confirm'); }
      } else {
        if (game.takeItem(pick)) {
          if (cur) game.addItem(cur); // the old fitting returns to the bag
          c.equip = { ...c.equip, [slot]: pick };
          audio.sfx('confirm');
        }
      }
      showMember(c);
    }
  };

  for (;;) {
    const members: MenuItem[] = game.party.map((c) => ({
      value: c.uid,
      label: c.name,
      note: `Lv${c.level}`,
      color: ATTRIBUTES[c.attribute].color,
    }));
    const menu = new Menu(menuHost, members, {
      cancellable: true,
      onHighlight: (v) => { const c = game.party.find((x) => x.uid === v); if (c) showMember(c); },
    });
    const choice = await menu.open();
    menu.destroy();
    if (!choice) break;
    const c = game.party.find((x) => x.uid === choice);
    if (c) await editMember(c);
  }

  remove(root);
}
