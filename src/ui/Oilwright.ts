import { clear, el, esc, remove } from './dom';
import { Menu } from './Menu';
import type { MenuItem } from './Menu';
import { game } from '../systems/party/gameState';
import { audio } from '../engine/Audio';
import { toast } from './Toast';

/**
 * LP capacity a rendered soul is worth, scaled by its level — stronger souls
 * burn longer. Added to `game.lightBonus`, which every reach's lantern draws on.
 */
export function oilFrom(level: number): number {
  return 20 + level * 2;
}

/** A non-companion soul the Oilwright will take, with where it currently sits. */
interface Tradable {
  uid: string;
  name: string;
  level: number;
  where: 'party' | 'sanctuary';
}

function tradables(): Tradable[] {
  const out: Tradable[] = [];
  for (const c of game.party) if (!c.companion) out.push({ uid: c.uid, name: c.name, level: c.level, where: 'party' });
  for (const c of game.sanctuary) if (!c.companion) out.push({ uid: c.uid, name: c.name, level: c.level, where: 'sanctuary' });
  return out;
}

/** Souls that fight from the party — the last one can't be rendered. */
function fightingInParty(): number {
  return game.party.filter((c) => !c.companion).length;
}

/**
 * The Oilwright (hub NPC '4'). Trades captured souls for permanent lantern
 * capacity: each soul is consumed and lost, raising `game.lightBonus` so deeper,
 * longer reaches don't gutter your light. Companions are never spent this way, and the
 * last fighting soul in your party is protected. Mirrors the Soul Store shape.
 */
export async function openOilwright(parent: HTMLElement): Promise<void> {
  const root = el('div', 'screen');
  root.id = 'oilwright';
  root.appendChild(el('h1', 'title-main', 'THE OILWRIGHT'));
  root.appendChild(el('p', 'title-sub', 'Rendell — renders spare souls to lamp-oil'));

  const wrap = el('div', 'shop-wrap');
  const listPanel = el('div', 'panel');
  listPanel.appendChild(el('h2', undefined, 'Souls'));
  const menuHost = el('div');
  listPanel.appendChild(menuHost);

  const info = el('div', 'panel');
  info.appendChild(el('h2', undefined, 'Detail'));
  const desc = el('div', 'desc');
  info.appendChild(desc);
  const wallet = el('div', 'row');
  info.appendChild(wallet);

  wrap.append(listPanel, info);
  root.appendChild(wrap);
  root.appendChild(el('div', 'hint', 'UP/DOWN browse · Z/ENTER render · X leave'));
  parent.appendChild(root);

  const refreshWallet = () => {
    wallet.innerHTML =
      `<span class="dim">Lantern bonus</span> <span class="accent">+${game.lightBonus} LP</span>` +
      ` &nbsp; <span class="dim">Party</span> ${game.soulsInParty()}/${game.partyCap}` +
      ` &nbsp; <span class="dim">Sanctuary</span> ${game.sanctuary.length}`;
  };

  const items = (): MenuItem[] => {
    const list = tradables();
    if (!list.length) {
      return [{ value: 'none', label: 'No spare souls to render', note: '—', disabled: true }];
    }
    return list.map((t) => {
      // The last fighting soul in the party is protected — keep one to field.
      const protectedLast = t.where === 'party' && fightingInParty() <= 1;
      return {
        value: `soul:${t.uid}`,
        label: `${t.name}  Lv${t.level}`,
        note: protectedLast ? 'last soul' : `+${oilFrom(t.level)} LP`,
        disabled: protectedLast,
      };
    });
  };

  const showDesc = (v: string) => {
    clear(desc);
    if (!v.startsWith('soul:')) {
      desc.innerHTML =
        '<span class="dim">The Oilwright takes a soul you carry and renders it to oil. ' +
        'It is gone for good — but your lantern holds more light, on every reach, forever.</span>';
      return;
    }
    const uid = v.slice('soul:'.length);
    const t = tradables().find((x) => x.uid === uid);
    if (!t) return;
    desc.innerHTML =
      `<strong>${esc(t.name)}</strong> <span class="dim">Lv${t.level} · ${t.where}</span>` +
      `<br><span class="accent">+${oilFrom(t.level)} LP</span> lantern capacity` +
      '<br><br><span class="danger">Rendered souls are consumed and lost.</span>';
  };

  refreshWallet();

  for (;;) {
    const menu = new Menu(menuHost, items(), { cancellable: true, onHighlight: (v) => showDesc(v) });
    const choice = await menu.open();
    menu.destroy();
    if (!choice) break;
    if (!choice.startsWith('soul:')) {
      audio.sfx('cancel');
      continue;
    }
    const uid = choice.slice('soul:'.length);
    const t = tradables().find((x) => x.uid === uid);
    const c = game.consumeSoul(uid);
    if (!c || !t) {
      audio.sfx('cancel');
      toast(parent, '<span class="danger">That soul cannot be rendered.</span>', 1400);
      continue;
    }
    const gain = oilFrom(t.level);
    game.lightBonus += gain;
    audio.sfx('chest');
    toast(parent, `Rendered <span class="accent">${esc(c.name)}</span> — lantern +${gain} LP`, 1900);
    refreshWallet();
  }

  remove(root);
}
