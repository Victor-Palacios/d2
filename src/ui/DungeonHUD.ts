import { bar, el, esc, remove } from './dom';
import type { CreatureInstance } from '../systems/party/creature';
import { game } from '../systems/party/gameState';
import { ATTRIBUTES } from '../data/elements';

/** Crawl HUD: floor, fuel/EP meter, credits and the lent party's condition. */
export class DungeonHUD {
  private root: HTMLElement;
  private floorEl: HTMLElement;
  private epLabel: HTMLElement;
  private setEp: (p: number) => void;
  private partyEl: HTMLElement;
  private creditsEl: HTMLElement;
  private memberBars = new Map<string, { hp: (p: number) => void; mp: (p: number) => void; label: HTMLElement }>();

  constructor(private parent: HTMLElement) {
    this.root = el('div', 'panel');
    this.root.id = 'dungeon-hud';

    this.floorEl = el('h2', undefined, 'Boot Domain');
    this.root.appendChild(this.floorEl);

    const epRow = el('div', 'row');
    epRow.appendChild(el('span', undefined, 'EP'));
    this.epLabel = el('span', 'accent', '0');
    epRow.appendChild(this.epLabel);
    this.root.appendChild(epRow);
    this.setEp = bar(this.root, 'ep');

    const credRow = el('div', 'row');
    credRow.appendChild(el('span', 'dim', 'Credits'));
    this.creditsEl = el('span', undefined, '0');
    credRow.appendChild(this.creditsEl);
    this.root.appendChild(credRow);

    this.partyEl = el('div', 'party');
    this.root.appendChild(this.partyEl);

    this.parent.appendChild(this.root);
  }

  setFloor(name: string) {
    this.floorEl.textContent = name;
  }

  /** Rebuilds the party block (call when the roster changes). */
  buildParty(party: CreatureInstance[]) {
    this.partyEl.innerHTML = '';
    this.memberBars.clear();
    for (const c of party) {
      const wrap = el('div', 'member');
      const nm = el('div', 'nm');
      const label = el('span', undefined, esc(c.name));
      const lv = el('span', 'dim', `${ATTRIBUTES[c.attribute].name} · Lv${c.level}`);
      nm.append(label, lv);
      wrap.appendChild(nm);
      const hp = bar(wrap, 'hp');
      const mp = bar(wrap, 'mp');
      this.partyEl.appendChild(wrap);
      this.memberBars.set(c.uid, { hp, mp, label });
    }
  }

  update(party: CreatureInstance[]) {
    this.epLabel.textContent = `${Math.ceil(game.fuel)} / ${game.maxFuel}`;
    this.setEp(game.fuel / game.maxFuel);
    this.creditsEl.textContent = String(game.credits);
    for (const c of party) {
      const b = this.memberBars.get(c.uid);
      if (!b) continue;
      b.hp(c.hp / c.maxHp);
      b.mp(c.mp / Math.max(1, c.maxMp));
      b.label.innerHTML = c.hp > 0 ? esc(c.name) : `<span class="danger">${esc(c.name)}</span>`;
    }
  }

  destroy() {
    remove(this.root);
  }
}
