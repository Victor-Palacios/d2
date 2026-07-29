import { clear, el, esc, remove } from './dom';
import { classIcon } from './icons';
import { ATTRIBUTES, ELEMENTS } from '../data/elements';
import { game } from '../systems/party/gameState';
import type { Cell } from '../systems/battle/engine';
import { input } from '../engine/Input';
import { audio } from '../engine/Audio';

/**
 * Party & formation — arrange the fielded souls on the 2×3 battle grid.
 *
 * The grid mirrors combat exactly (see `systems/battle/engine.ts`): the
 * **Vanguard** row (front) deals and takes more melee, while the **Rear** row is
 * shielded from single-target melee whenever a living ally holds the Vanguard
 * cell in the same column. Columns line up with the arena's element plates.
 *
 * Pick a soul up with confirm, then drop it on any grid cell to reposition it
 * (front/back, left/right), or onto a reserve to swap who is fielded. The first
 * `ACTIVE_PARTY` party members are the ones deployed; the rest wait on the bench.
 */

type Cursor = { zone: 'grid'; row: number; col: number } | { zone: 'bench'; i: number };
type Grab = { zone: 'grid'; slot: number } | { zone: 'bench'; p: number };

const ROWS = 2;
const COLS = 3;

export function openPartyArrange(parent: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    const root = el('div', 'screen');
    root.id = 'party-arrange';
    root.appendChild(el('h1', 'title-main', 'FORMATION'));
    root.appendChild(el('p', 'title-sub', 'Arrange who fights, and where they stand'));

    const wrap = el('div', 'formation-wrap');
    const left = el('div');
    left.appendChild(el('div', 'formation-foe', '▲ toward the foe'));
    const grid = el('div', 'formation-grid');
    left.appendChild(grid);
    const bench = el('div', 'formation-bench');
    left.appendChild(bench);

    const info = el('div', 'panel formation-info');
    info.appendChild(el('h2', undefined, 'Detail'));
    const desc = el('div', 'desc');
    info.appendChild(desc);

    wrap.append(left, info);
    root.appendChild(wrap);
    const hint = el('div', 'hint', '');
    root.appendChild(hint);
    parent.appendChild(root);

    let cursor: Cursor = { zone: 'grid', row: 0, col: 1 };
    let grabbed: Grab | null = null;

    const fielded = () => game.fieldedCount();
    const benchList = () => game.souls().slice(fielded());

    /** Is a Rear-row slot covered by a living ally in the Vanguard cell ahead? */
    const covered = (slot: number): boolean => {
      const c = game.formation[slot];
      if (!c || c.row !== 1) return false;
      const n = fielded();
      for (let i = 0; i < n; i++) {
        if (i === slot) continue;
        const o = game.formation[i];
        if (o.row === 0 && o.col === c.col) return true;
      }
      return false;
    };

    const roleText = (cell: Cell): string =>
      cell.row === 0
        ? 'Vanguard — melee hits +15% harder, and it takes +15% from blows.'
        : 'Rear — shielded from melee while an ally holds the column ahead; its own melee is −20%. Ranged & Ether unaffected.';

    const showDetail = () => {
      clear(desc);
      if (cursor.zone === 'grid') {
        const cell = { row: cursor.row, col: cursor.col };
        const slot = game.slotAtCell(cell);
        if (slot < 0) {
          desc.innerHTML =
            `<strong>${cell.row === 0 ? 'Vanguard' : 'Rear'} · ${['left', 'centre', 'right'][cell.col]}</strong>` +
            `<br><span class="dim">Empty. ${esc(roleText(cell))}</span>`;
          return;
        }
        const c = game.souls()[slot];
        const cov = cell.row === 1 ? (covered(slot) ? ' · <span class="ok">Covered</span>' : ' · <span class="danger">Exposed</span>') : '';
        desc.innerHTML =
          `<strong>${esc(c.name)}</strong> <span class="dim">Lv${c.level} · ${ATTRIBUTES[c.attribute].name} · ${ELEMENTS[c.element].name}</span>` +
          `<br><span class="dim">HP</span> ${c.maxHp} &nbsp; <span class="dim">MP</span> ${c.maxMp}` +
          `<br><span class="dim">OFF</span> ${c.off} &nbsp; <span class="dim">DEF</span> ${c.def} &nbsp; <span class="dim">SPD</span> ${c.spd}` +
          `<br><span class="dim">MAG</span> ${c.mag} &nbsp; <span class="dim">RES</span> ${c.res}` +
          `<br><span class="tag-slot">${cell.row === 0 ? 'VANGUARD' : 'REAR'}${cov}</span>` +
          `<br><span class="dim">${esc(roleText(cell))}</span>`;
      } else {
        const c = benchList()[cursor.i];
        if (!c) {
          desc.innerHTML = '<span class="dim">No reserves — every soul is fielded.</span>';
          return;
        }
        desc.innerHTML =
          `<strong>${esc(c.name)}</strong> <span class="dim">Lv${c.level} · ${ATTRIBUTES[c.attribute].name} · ${ELEMENTS[c.element].name}</span>` +
          `<br><span class="dim">HP</span> ${c.maxHp} &nbsp; <span class="dim">MP</span> ${c.maxMp}` +
          `<br><span class="dim">OFF</span> ${c.off} &nbsp; <span class="dim">DEF</span> ${c.def} &nbsp; <span class="dim">SPD</span> ${c.spd}` +
          `<br><span class="tag-slot dim">RESERVE</span> <span class="dim">— not fielded. Swap it onto the grid to deploy it.</span>`;
      }
    };

    const grabbedName = (): string | null => {
      if (!grabbed) return null;
      if (grabbed.zone === 'grid') return game.souls()[grabbed.slot]?.name ?? null;
      return game.souls()[grabbed.p]?.name ?? null;
    };

    const render = () => {
      // --- grid ---
      grid.innerHTML = '';
      for (let row = 0; row < ROWS; row++) {
        const rowEl = el('div', 'formation-row');
        rowEl.appendChild(el('div', 'row-tag', row === 0 ? 'VAN' : 'REAR'));
        for (let col = 0; col < COLS; col++) {
          const cellEl = el('div', 'form-cell');
          const slot = game.slotAtCell({ row, col });
          if (cursor.zone === 'grid' && cursor.row === row && cursor.col === col) cellEl.classList.add('sel');
          if (slot >= 0) {
            const c = game.souls()[slot];
            cellEl.classList.add('occupied');
            cellEl.style.setProperty('--elem-color', ELEMENTS[c.element].color);
            if (grabbed?.zone === 'grid' && grabbed.slot === slot) cellEl.classList.add('grabbed');
            cellEl.innerHTML =
              `<span class="who">${classIcon(c.attribute, 13)}${esc(c.name)}</span>` +
              `<span class="dim">Lv${c.level}</span>`;
          } else {
            cellEl.classList.add('empty');
            cellEl.innerHTML = '<span class="dim">· ·</span>';
          }
          rowEl.appendChild(cellEl);
        }
        grid.appendChild(rowEl);
      }

      // --- bench ---
      bench.innerHTML = '';
      const list = benchList();
      const label = el('div', 'row-tag', 'BENCH');
      bench.appendChild(label);
      if (!list.length) {
        bench.appendChild(el('div', 'bench-empty dim', 'No reserves'));
      } else {
        list.forEach((c, i) => {
          const chip = el('div', 'bench-chip');
          chip.style.setProperty('--elem-color', ELEMENTS[c.element].color);
          if (cursor.zone === 'bench' && cursor.i === i) chip.classList.add('sel');
          if (grabbed?.zone === 'bench' && grabbed.p === fielded() + i) chip.classList.add('grabbed');
          chip.innerHTML = `${classIcon(c.attribute, 13)}${esc(c.name)} <span class="dim">Lv${c.level}</span>`;
          bench.appendChild(chip);
        });
      }

      const gn = grabbedName();
      hint.innerHTML = grabbed
        ? `Placing <strong>${esc(gn ?? '')}</strong> · ARROWS choose spot · Z/ENTER place · X cancel`
        : 'ARROWS move · Z/ENTER pick up · X close';
      showDetail();
    };

    const close = () => { unsub(); remove(root); resolve(); };

    // --- navigation ---
    const move = (a: 'up' | 'down' | 'left' | 'right') => {
      const list = benchList();
      if (cursor.zone === 'grid') {
        if (a === 'left') cursor = { zone: 'grid', row: cursor.row, col: Math.max(0, cursor.col - 1) };
        else if (a === 'right') cursor = { zone: 'grid', row: cursor.row, col: Math.min(COLS - 1, cursor.col + 1) };
        else if (a === 'up') cursor = { zone: 'grid', row: Math.max(0, cursor.row - 1), col: cursor.col };
        else if (a === 'down') {
          if (cursor.row < ROWS - 1) cursor = { zone: 'grid', row: cursor.row + 1, col: cursor.col };
          else if (list.length) cursor = { zone: 'bench', i: Math.min(cursor.col, list.length - 1) };
          else return false;
        }
      } else {
        if (a === 'left') cursor = { zone: 'bench', i: Math.max(0, cursor.i - 1) };
        else if (a === 'right') cursor = { zone: 'bench', i: Math.min(list.length - 1, cursor.i + 1) };
        else if (a === 'up') cursor = { zone: 'grid', row: ROWS - 1, col: Math.min(cursor.i, COLS - 1) };
        else return false; // down from bench: nothing
      }
      return true;
    };

    // --- grab / place ---
    const confirm = () => {
      if (!grabbed) {
        if (cursor.zone === 'grid') {
          const slot = game.slotAtCell({ row: cursor.row, col: cursor.col });
          if (slot < 0) { audio.sfx('cancel'); return; }
          grabbed = { zone: 'grid', slot };
          audio.sfx('confirm');
        } else {
          const p = fielded() + cursor.i;
          if (p >= game.souls().length) { audio.sfx('cancel'); return; }
          grabbed = { zone: 'bench', p };
          audio.sfx('confirm');
        }
        render();
        return;
      }

      // Placing.
      if (grabbed.zone === 'grid') {
        const g = grabbed.slot;
        if (cursor.zone === 'grid') {
          game.moveFormationSlot(g, { row: cursor.row, col: cursor.col });
          grabbed = null;
          audio.sfx('confirm');
        } else {
          const p = fielded() + cursor.i;
          if (p < game.souls().length && game.swapSouls(g, p)) {
            cursor = { zone: 'bench', i: p - fielded() };
            grabbed = null;
            audio.sfx('confirm');
          } else { audio.sfx('cancel'); }
        }
      } else {
        const p = grabbed.p;
        if (cursor.zone === 'grid') {
          const tslot = game.slotAtCell({ row: cursor.row, col: cursor.col });
          if (tslot >= 0 && game.swapSouls(p, tslot)) {
            grabbed = null;
            audio.sfx('confirm');
          } else {
            // Empty grid cell has no slot to swap into — reposition an existing
            // fighter there first. Keep the soul in hand.
            audio.sfx('cancel');
          }
        } else {
          const tp = fielded() + cursor.i;
          if (tp !== p && tp < game.souls().length && game.swapSouls(p, tp)) {
            cursor = { zone: 'bench', i: tp - fielded() };
          }
          grabbed = null;
          audio.sfx('confirm');
        }
      }
      render();
    };

    const unsub = input.onAction((a) => {
      if (a === 'up' || a === 'down' || a === 'left' || a === 'right') {
        if (move(a)) { audio.sfx('blip'); render(); }
      } else if (a === 'confirm') {
        confirm();
      } else if (a === 'cancel' || a === 'menu' || a === 'start') {
        if (grabbed) { grabbed = null; audio.sfx('cancel'); render(); }
        else { audio.sfx('cancel'); close(); }
      }
    });

    render();
  });
}
