import { clear, el, esc, remove } from './dom';
import { Menu } from './Menu';
import type { MenuItem } from './Menu';
import { ATTRIBUTES, ELEMENTS } from '../data/elements';
import { technique } from '../data/techniques';
import { game } from '../systems/party/gameState';
import { MAX_ACTIVE_MOVES } from '../systems/party/creature';
import type { CreatureInstance } from '../systems/party/creature';
import { audio } from '../engine/Audio';
import { toast } from './Toast';

/**
 * Moves — the battle loadout manager. A soul remembers every move it has ever
 * learned (its known pool, `creature.techniques`), but may field only
 * `MAX_ACTIVE_MOVES` at once. Here the player toggles which known moves are
 * active; the choice is permanent (persisted in the save) and drives the
 * Invoke menu in battle. Basic Attack is always available and is not listed.
 */
export async function openMoves(parent: HTMLElement): Promise<void> {
  const root = el('div', 'screen');
  root.id = 'moves';
  root.appendChild(el('h1', 'title-main', 'MOVES'));
  root.appendChild(el('p', 'title-sub', `Field up to ${MAX_ACTIVE_MOVES} — the rest wait in memory`));

  const wrap = el('div', 'shop-wrap');
  const listPanel = el('div', 'panel');
  listPanel.appendChild(el('h2', undefined, 'Souls'));
  const menuHost = el('div');
  listPanel.appendChild(menuHost);

  const info = el('div', 'panel');
  info.appendChild(el('h2', undefined, 'Loadout'));
  const desc = el('div', 'desc');
  info.appendChild(desc);

  wrap.append(listPanel, info);
  root.appendChild(wrap);
  root.appendChild(el('div', 'hint', 'UP/DOWN browse · Z/ENTER toggle · X back'));
  parent.appendChild(root);

  const roster = (): CreatureInstance[] => [...game.party, ...game.sanctuary];

  const isActive = (c: CreatureInstance, id: string) => (c.loadout ?? []).includes(id);
  const activeCount = (c: CreatureInstance) => (c.loadout ?? []).length;

  const showDesc = (c: CreatureInstance) => {
    clear(desc);
    const load = c.loadout ?? [];
    const active = load.length
      ? load.map((id) => esc(technique(id).name)).join(' · ')
      : '<span class="dim">none — only Basic Attack</span>';
    desc.innerHTML =
      `<strong>${esc(c.name)}</strong> <span class="dim">Lv${c.level} · ${ATTRIBUTES[c.attribute].name}</span>` +
      `<br><span class="dim">Active ${load.length}/${MAX_ACTIVE_MOVES}:</span> ${active}` +
      `<br><span class="dim">Knows ${c.techniques.length} move${c.techniques.length === 1 ? '' : 's'} total.</span>`;
  };

  // Toggle a soul's known moves on/off, enforcing the ≤MAX_ACTIVE_MOVES cap.
  const editMoves = async (c: CreatureInstance) => {
    let cursor = 0;
    for (;;) {
      showDesc(c);
      const full = activeCount(c) >= MAX_ACTIVE_MOVES;
      const items: MenuItem[] = c.techniques.map((id) => {
        const t = technique(id);
        const on = isActive(c, id);
        return {
          value: id,
          // ● active / ○ benched, so state reads at a glance.
          label: `${on ? '●' : '○'} ${t.name}`,
          color: on ? ELEMENTS[t.element].color : undefined,
          note: `${t.mpCost} MP · ${t.kind === 'heal' ? 'heal' : ELEMENTS[t.element].name}`,
          // A benched move can't be enabled while the loadout is full — grey it.
          disabled: !on && full,
        };
      });
      if (!items.length) items.push({ value: 'none', label: 'no moves learned yet', disabled: true });

      const menu = new Menu(menuHost, items, { cancellable: true, startIndex: Math.min(cursor, items.length - 1) });
      const pick = await menu.open();
      cursor = items.findIndex((i) => i.value === pick);
      if (cursor < 0) cursor = 0;
      menu.destroy();
      if (!pick || pick === 'none') return;

      if (!c.loadout) c.loadout = [];
      const load = c.loadout;
      if (isActive(c, pick)) {
        c.loadout = load.filter((id) => id !== pick);
        audio.sfx('cancel');
      } else if (load.length >= MAX_ACTIVE_MOVES) {
        audio.sfx('cancel');
        toast(parent, `<span class="dim">${MAX_ACTIVE_MOVES} moves max — disable one first.</span>`, 1600);
      } else {
        load.push(pick);
        audio.sfx('confirm');
      }
    }
  };

  for (;;) {
    const list: MenuItem[] = roster().map((c) => ({
      value: c.uid,
      label: c.name,
      note: `${activeCount(c)}/${MAX_ACTIVE_MOVES}`,
      color: ATTRIBUTES[c.attribute].color,
    }));
    if (!list.length) list.push({ value: 'none', label: 'no souls', disabled: true });
    const menu = new Menu(menuHost, list, {
      cancellable: true,
      onHighlight: (v) => {
        const c = roster().find((x) => x.uid === v);
        if (c) showDesc(c);
      },
    });
    const choice = await menu.open();
    menu.destroy();
    if (!choice || choice === 'none') break;
    const c = roster().find((x) => x.uid === choice);
    if (c) await editMoves(c);
  }

  remove(root);
}
