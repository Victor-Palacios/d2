import { clear, el, esc, remove } from './dom';
import { Menu } from './Menu';
import type { MenuItem } from './Menu';
import { ATTRIBUTES, ELEMENTS } from '../data/elements';
import { species } from '../data/creatures';
import { game } from '../systems/party/gameState';
import {
  evolutionOptions,
  allEvolutions,
  canEvolve,
  canDevolve,
  devolveTargetId,
  evolve,
  devolve,
} from '../systems/party/evolve';
import { audio } from '../engine/Audio';
import { toast } from './Toast';
import { playTranscend } from './TranscendCinematic';
import type { CreatureInstance } from '../systems/party/creature';

/**
 * The Transcendence screen (plan §5.6) — evolve a soul into a further form, or
 * let one return to the shape it was (de-evolution). Pokémon × Digimon hybrid:
 * level-gated, branching, and always reversible. See `systems/party/evolve.ts`.
 */
export async function openTranscend(parent: HTMLElement): Promise<void> {
  const root = el('div', 'screen');
  root.id = 'transcend';
  root.appendChild(el('h1', 'title-main', 'TRANSCENDENCE'));
  root.appendChild(el('p', 'title-sub', 'Grow a soul onward — or call it home'));

  const wrap = el('div', 'shop-wrap');
  const listPanel = el('div', 'panel');
  listPanel.appendChild(el('h2', undefined, 'Souls'));
  const menuHost = el('div');
  listPanel.appendChild(menuHost);

  const info = el('div', 'panel');
  info.appendChild(el('h2', undefined, 'Detail'));
  const desc = el('div', 'desc');
  info.appendChild(desc);

  wrap.append(listPanel, info);
  root.appendChild(wrap);
  root.appendChild(el('div', 'hint', 'UP/DOWN browse · Z/ENTER choose · X close'));
  parent.appendChild(root);

  const roster = (): CreatureInstance[] => [...game.party, ...game.sanctuary];
  const byUid = (uid: string) => roster().find((c) => c.uid === uid);

  const items = (): MenuItem[] =>
    roster().map((c) => {
      const note = canEvolve(c) ? 'evolve ▸' : canDevolve(c) ? 'return ◂' : '—';
      return { value: c.uid, label: c.name, note, color: ATTRIBUTES[c.attribute].color };
    });

  const showDesc = (uid: string) => {
    clear(desc);
    const c = byUid(uid);
    if (!c) {
      desc.innerHTML = '<span class="dim">Select a soul to see its paths.</span>';
      return;
    }
    let paths = '';
    const ready = evolutionOptions(c);
    if (ready.length) {
      paths +=
        '<br><span class="ok">Ready to evolve:</span> ' +
        ready
          .map((o) => `${esc(species(o.to).name)}${o.branch ? ` <span class="dim">(${esc(o.branch)})</span>` : ''}`)
          .join(' · ');
    } else {
      const pending = allEvolutions(c).filter((o) => c.level < o.level);
      if (pending.length) {
        paths +=
          '<br><span class="dim">Evolves at </span>' +
          pending.map((o) => `Lv${o.level} → ${esc(species(o.to).name)}`).join(' · ');
      }
    }
    const back = devolveTargetId(c);
    if (back) paths += `<br><span class="dim">Can return to</span> ${esc(species(back).name)}`;
    if (!paths) paths = '<br><span class="dim">A terminal form — it grows no further.</span>';

    desc.innerHTML =
      `<strong>${esc(c.name)}</strong> <span class="dim">Lv${c.level} · ${ATTRIBUTES[c.attribute].name} · ${ELEMENTS[c.element].name}</span>` +
      `<br><span class="dim">HP</span> ${c.maxHp} &nbsp; <span class="dim">MP</span> ${c.maxMp}` +
      `<br><span class="dim">OFF</span> ${c.off} &nbsp; <span class="dim">DEF</span> ${c.def} &nbsp; <span class="dim">SPD</span> ${c.spd}` +
      `<br><span class="dim">MAG</span> ${c.mag} &nbsp; <span class="dim">RES</span> ${c.res}` +
      paths;
  };

  /**
   * Run one transform, then play the transcendence cinematic. The soul's
   * *display* name (its nickname, or the name of the form it is leaving) is
   * captured before the change, because `evolve`/`devolve` may retitle it.
   */
  const perform = async (c: CreatureInstance, mode: 'evolve' | 'devolve', toId?: string) => {
    const fromId = c.speciesId;
    const displayName = c.name === species(fromId).name ? species(fromId).name : c.name;
    const r = mode === 'evolve' ? evolve(c, toId) : devolve(c);
    if (!r) return;
    await playTranscend(parent, { fromId, toId: r.toId, mode, displayName, gainedMoves: r.gainedMoves });
  };

  const act = async (c: CreatureInstance) => {
    const opts: MenuItem[] = [];
    for (const o of evolutionOptions(c)) {
      opts.push({
        value: `evo:${o.to}`,
        label: `Evolve → ${species(o.to).name}`,
        note: o.branch ?? ATTRIBUTES[species(o.to).attribute].name,
        color: ATTRIBUTES[species(o.to).attribute].color,
      });
    }
    const back = devolveTargetId(c);
    if (back) opts.push({ value: 'devo', label: `De-evolve → ${species(back).name}`, note: 'return' });
    if (!opts.length) {
      audio.sfx('cancel');
      toast(parent, `<span class="dim">${esc(c.name)} has no path right now.</span>`, 1600);
      return;
    }
    opts.push({ value: 'cancel', label: 'Back', note: '' });

    const menu = new Menu(menuHost, opts, { cancellable: true });
    const pick = await menu.open();
    menu.destroy();
    if (!pick || pick === 'cancel') return;

    if (pick === 'devo') {
      await perform(c, 'devolve');
    } else if (pick.startsWith('evo:')) {
      await perform(c, 'evolve', pick.slice(4));
    }
  };

  for (;;) {
    const list = items();
    if (!list.length) list.push({ value: 'none', label: 'no souls', note: '—', disabled: true });
    const menu = new Menu(menuHost, list, { cancellable: true, onHighlight: (v) => showDesc(v) });
    const choice = await menu.open();
    menu.destroy();
    if (!choice || choice === 'none') break;
    const c = byUid(choice);
    if (c) await act(c);
  }

  remove(root);
}
