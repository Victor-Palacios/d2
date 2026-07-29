import { clear, el, esc, remove } from './dom';
import { Menu } from './Menu';
import type { MenuItem } from './Menu';
import { ATTRIBUTES, ELEMENTS } from '../data/elements';
import { game } from '../systems/party/gameState';
import { audio } from '../engine/Audio';
import { toast } from './Toast';
import type { CreatureInstance } from '../systems/party/creature';

/**
 * The Soul Sanctuary — reserve management (plan: recruitment M8). Move monsters
 * between the active party (capped) and the reserve. Selecting a party member
 * benches it; selecting a reserve member calls it up (if there's a free slot).
 * The party can never be emptied.
 */
export async function openSanctuary(parent: HTMLElement): Promise<void> {
  const root = el('div', 'screen');
  root.id = 'sanctuary';
  root.appendChild(el('h1', 'title-main', 'SOUL SANCTUARY'));
  root.appendChild(el('p', 'title-sub', 'Bench a soul, or call one up'));

  const wrap = el('div', 'shop-wrap');
  const listPanel = el('div', 'panel');
  const listTitle = el('h2', undefined, '');
  listPanel.appendChild(listTitle);
  const menuHost = el('div');
  listPanel.appendChild(menuHost);

  const info = el('div', 'panel');
  info.appendChild(el('h2', undefined, 'Detail'));
  const desc = el('div', 'desc');
  info.appendChild(desc);

  wrap.append(listPanel, info);
  root.appendChild(wrap);
  root.appendChild(el('div', 'hint', 'UP/DOWN browse · Z/ENTER move · X close'));
  parent.appendChild(root);

  const byUid = (uid: string): CreatureInstance | undefined =>
    game.party.find((c) => c.uid === uid) ?? game.sanctuary.find((c) => c.uid === uid);

  const items = (): MenuItem[] => {
    const list: MenuItem[] = [];
    list.push({ value: 'h:party', label: `— PARTY  ${game.party.length}/${game.partyCap} —`, disabled: true });
    for (const c of game.party) {
      list.push({ value: `p:${c.uid}`, label: c.name, note: 'bench ▸', color: ATTRIBUTES[c.attribute].color });
    }
    list.push({ value: 'h:res', label: `— SANCTUARY  ${game.sanctuary.length} —`, disabled: true });
    if (!game.sanctuary.length) {
      list.push({ value: 'none', label: 'empty', note: '—', disabled: true });
    }
    for (const c of game.sanctuary) {
      list.push({
        value: `s:${c.uid}`,
        label: c.name,
        note: game.party.length < game.partyCap ? '◂ call up' : 'party full',
        color: ATTRIBUTES[c.attribute].color,
        disabled: game.party.length >= game.partyCap,
      });
    }
    return list;
  };

  const showDesc = (v: string) => {
    clear(desc);
    const uid = v.length > 2 ? v.slice(2) : '';
    const c = byUid(uid);
    if (!c) {
      desc.innerHTML = '<span class="dim">Select a monster to move it between party and reserve.</span>';
      return;
    }
    desc.innerHTML =
      `<strong>${esc(c.name)}</strong> <span class="dim">Lv${c.level} · ${ATTRIBUTES[c.attribute].name} · ${ELEMENTS[c.element].name}</span>` +
      `<br><span class="dim">HP</span> ${c.maxHp} &nbsp; <span class="dim">MP</span> ${c.maxMp}` +
      `<br><span class="dim">OFF</span> ${c.off} &nbsp; <span class="dim">DEF</span> ${c.def} &nbsp; <span class="dim">SPD</span> ${c.spd}` +
      `<br><span class="dim">MAG</span> ${c.mag} &nbsp; <span class="dim">RES</span> ${c.res}`;
  };

  for (;;) {
    listTitle.textContent = 'Roster';
    const menu = new Menu(menuHost, items(), { cancellable: true, onHighlight: (v) => showDesc(v) });
    const choice = await menu.open();
    menu.destroy();
    if (!choice) break;

    if (choice.startsWith('p:')) {
      if (game.partyToSanctuary(choice.slice(2))) audio.sfx('confirm');
      else {
        audio.sfx('cancel');
        toast(parent, '<span class="danger">Your party can’t be empty.</span>', 1600);
      }
    } else if (choice.startsWith('s:')) {
      if (game.sanctuaryToParty(choice.slice(2))) audio.sfx('confirm');
      else {
        audio.sfx('cancel');
        toast(parent, '<span class="danger">Party is full — bench one first.</span>', 1600);
      }
    }
  }

  remove(root);
}
