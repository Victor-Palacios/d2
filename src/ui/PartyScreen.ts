import { el, esc, remove } from './dom';
import { classIcon } from './icons';
import { ATTRIBUTES, ELEMENTS } from '../data/elements';
import { game } from '../systems/party/gameState';
import { input } from '../engine/Input';
import { audio } from '../engine/Audio';

/**
 * Party arrangement — move monster positions. Order is meaning: the first three
 * living members are the ones fielded, in formation order (see the grid battle).
 * Grab a soul with confirm, move it up/down, drop it with confirm again.
 */
export function openPartyArrange(parent: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    const root = el('div', 'screen');
    root.id = 'party-arrange';
    root.appendChild(el('h1', 'title-main', 'PARTY'));
    root.appendChild(el('p', 'title-sub', 'The first three are fielded — arrange who fights, and where'));
    const list = el('div', 'panel party-list');
    root.appendChild(list);
    const hint = el('div', 'hint', '');
    root.appendChild(hint);
    parent.appendChild(root);

    const active = 3; // the first three living members are fielded (grid battle)
    let index = 0;
    let grabbedUid: string | null = null;

    const render = () => {
      list.innerHTML = '';
      game.party.forEach((c, i) => {
        const attr = ATTRIBUTES[c.attribute];
        const row = el('div', 'party-row');
        row.style.setProperty('--elem-color', ELEMENTS[c.element].color);
        if (i === index) row.classList.add('sel');
        if (c.uid === grabbedUid) row.classList.add('grabbed');
        if (i < active) row.classList.add('fielded');
        row.innerHTML =
          `<span class="slot">${i < active ? `F${i + 1}` : '—'}</span>` +
          `<span class="who">${classIcon(c.attribute, 14)}${esc(c.name)}</span>` +
          `<span class="dim">Lv${c.level} · ${attr.name}</span>`;
        list.appendChild(row);
      });
      hint.innerHTML = grabbedUid
        ? 'UP/DOWN move · Z/ENTER drop · X cancel'
        : 'UP/DOWN choose · Z/ENTER grab · X close';
    };

    const close = () => {
      unsub();
      remove(root);
      resolve();
    };

    const unsub = input.onAction((a) => {
      if (a === 'up' || a === 'down') {
        const dir = a === 'up' ? -1 : 1;
        if (grabbedUid) {
          if (game.reorderParty(grabbedUid, dir)) {
            index += dir;
            audio.sfx('blip');
          }
          index = Math.max(0, Math.min(game.party.length - 1, index));
        } else {
          index = Math.max(0, Math.min(game.party.length - 1, index + dir));
          audio.sfx('blip');
        }
        render();
      } else if (a === 'confirm') {
        if (grabbedUid) {
          grabbedUid = null;
          audio.sfx('confirm');
        } else {
          grabbedUid = game.party[index]?.uid ?? null;
          audio.sfx('confirm');
        }
        render();
      } else if (a === 'cancel' || a === 'menu' || a === 'start') {
        if (grabbedUid) {
          grabbedUid = null;
          audio.sfx('cancel');
          render();
        } else {
          audio.sfx('cancel');
          close();
        }
      }
    });

    render();
  });
}
