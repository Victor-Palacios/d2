import { clear, el, esc, remove } from './dom';
import { Menu } from './Menu';
import type { MenuItem } from './Menu';
import { SPECIES, speciesArt } from '../data/creatures';
import { ATTRIBUTES, ELEMENTS } from '../data/elements';
import { game, MAX_PARTY_CAP, START_PARTY_CAP } from '../systems/party/gameState';
import { makeCreature } from '../systems/party/creature';
import { pixelArtElement } from '../engine/pixel';
import { audio } from '../engine/Audio';
import { toast } from './Toast';

/** Level of a summoned copy. */
const SUMMON_LEVEL = 10;
/** Cost of the Nth capacity upgrade: going 4→5, 5→6, … 9→10. */
const SLOT_COSTS = [500, 800, 1200, 1700, 2300, 3000];

/** Summon price, scaled to a species' raw power. */
export function soulPrice(id: string): number {
  const b = SPECIES[id].base;
  return Math.round(b.hp * 2 + b.mp + (b.off + b.def + b.spd + b.mag + b.res) * 6);
}

function nextSlotCost(): number | null {
  const idx = game.partyCap - START_PARTY_CAP;
  return idx >= 0 && idx < SLOT_COSTS.length ? SLOT_COSTS[idx] : null;
}

/**
 * The Soul Store (plan: recruitment M8). Summon copies of any species you have
 * logged in the Soularium — priced by power — and buy party-capacity upgrades
 * (4→10, one slot at a time). Summons that don't fit the party go to the Soul
 * Sanctuary. Reuses the supply-bay vendor shape.
 */
export async function openSoulStore(parent: HTMLElement): Promise<void> {
  const root = el('div', 'screen');
  root.id = 'soul-store';
  root.appendChild(el('h1', 'title-main', 'SOUL STORE'));
  root.appendChild(el('p', 'title-sub', 'Soul Broker Vex — conjures the logged, for a price'));

  const wrap = el('div', 'shop-wrap');
  const listPanel = el('div', 'panel');
  listPanel.appendChild(el('h2', undefined, 'Wares'));
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
  root.appendChild(el('div', 'hint', 'UP/DOWN browse · Z/ENTER buy · X leave'));
  parent.appendChild(root);

  const refreshWallet = () => {
    wallet.innerHTML =
      `<span class="dim">Credits</span> <span class="accent">${game.credits}</span>` +
      ` &nbsp; <span class="dim">Party</span> ${game.party.length}/${game.partyCap}` +
      ` &nbsp; <span class="dim">Sanctuary</span> ${game.sanctuary.length}`;
  };

  const logged = () => Object.keys(SPECIES).filter((id) => game.soul(id).captured);

  const items = (): MenuItem[] => {
    const list: MenuItem[] = logged().map((id) => {
      const price = soulPrice(id);
      return {
        value: `summon:${id}`,
        label: `Summon ${SPECIES[id].name}`,
        note: `${price}c`,
        disabled: game.credits < price,
      };
    });
    if (!list.length) {
      list.push({ value: 'none', label: 'No souls logged yet', note: '—', disabled: true });
    }
    const cost = nextSlotCost();
    list.push(
      cost === null
        ? { value: 'slot', label: `Party at max (${MAX_PARTY_CAP})`, note: '—', disabled: true }
        : {
            value: 'slot',
            label: `Party slot +1  (${game.partyCap}→${game.partyCap + 1})`,
            note: `${cost}c`,
            disabled: game.credits < cost,
          },
    );
    return list;
  };

  const showDesc = (v: string) => {
    clear(desc);
    if (v === 'slot') {
      const cost = nextSlotCost();
      desc.innerHTML =
        '<strong>Party Capacity +1</strong><br>' +
        `<span class="dim">Carry more monsters into battle. Now ${game.partyCap} / ${MAX_PARTY_CAP}.` +
        (cost === null ? ' Already maxed.' : ` Next slot: ${cost}c.`) +
        '</span>';
      return;
    }
    if (!v.startsWith('summon:')) {
      desc.innerHTML = '<span class="dim">Syphon a soul in battle to log it, then summon copies here.</span>';
      return;
    }
    const id = v.slice('summon:'.length);
    const s = SPECIES[id];
    const holder = el('div');
    holder.style.cssText = 'display:flex;justify-content:center;padding:4px 0;';
    holder.appendChild(pixelArtElement(speciesArt(id), 4));
    desc.appendChild(holder);
    desc.appendChild(
      el(
        'div',
        undefined,
        `<strong>${esc(s.name)}</strong> <span class="dim">${ATTRIBUTES[s.attribute].name} · ${ELEMENTS[s.element].name}</span>` +
          `<br><span class="accent">${soulPrice(id)}c</span> · summoned at Lv${SUMMON_LEVEL}` +
          `<br><br><span class="dim">${esc(s.blurb)}</span>`,
      ),
    );
  };

  refreshWallet();

  for (;;) {
    const menu = new Menu(menuHost, items(), { cancellable: true, onHighlight: (v) => showDesc(v) });
    const choice = await menu.open();
    menu.destroy();
    if (!choice) break;

    if (choice === 'slot') {
      const cost = nextSlotCost();
      if (cost === null || game.credits < cost) {
        audio.sfx('cancel');
        continue;
      }
      game.credits -= cost;
      game.gainPartySlot();
      audio.sfx('chest');
      toast(parent, `<span class="accent">Party capacity ${game.partyCap}</span>`, 1600);
      refreshWallet();
      continue;
    }

    if (choice.startsWith('summon:')) {
      const id = choice.slice('summon:'.length);
      const price = soulPrice(id);
      if (game.credits < price) {
        audio.sfx('cancel');
        toast(parent, '<span class="danger">Not enough credits.</span>', 1400);
        continue;
      }
      game.credits -= price;
      const c = makeCreature(id, SUMMON_LEVEL);
      const toParty = game.addMonster(c);
      audio.sfx('chest');
      toast(
        parent,
        `Summoned <span class="accent">${esc(c.name)}</span> — ${toParty ? 'joined your party' : 'sent to the Sanctuary'}`,
        1800,
      );
      refreshWallet();
    }
  }

  remove(root);
}
