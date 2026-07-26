import { bar, el, esc, meter, remove } from './dom';
import type { CreatureInstance } from '../systems/party/creature';
import { game } from '../systems/party/gameState';
import { ATTRIBUTES, ELEMENTS } from '../data/elements';

/** Crawl HUD: floor, fuel/EP meter, credits and the lent party's condition. */
export class DungeonHUD {
  private root: HTMLElement;
  private floorEl: HTMLElement;
  private epLabel: HTMLElement;
  private setEp: (p: number) => void;
  private partyEl: HTMLElement;
  private creditsEl: HTMLElement;
  private memberBars = new Map<
    string,
    { hp: (cur: number, max: number) => void; mp: (cur: number, max: number) => void; label: HTMLElement }
  >();

  constructor(private parent: HTMLElement) {
    this.root = el('div', 'panel');
    this.root.id = 'dungeon-hud';

    this.floorEl = el('h2', undefined, 'The Quiet Crossing');
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
      const attr = ATTRIBUTES[c.attribute];
      const elem = ELEMENTS[c.element];
      // Class rides on the border colour, element on the dot — no text line.
      const wrap = el('div', 'member');
      wrap.style.setProperty('--class-color', attr.color);
      wrap.title = `${attr.name} · ${elem.name}`;
      const nm = el('div', 'nm');
      const label = el('span');
      label.innerHTML = `<i class="elem-dot" style="background:${elem.color}"></i>${esc(c.name)}`;
      const lv = el('span', 'dim', `Lv${c.level}`);
      nm.append(label, lv);
      wrap.appendChild(nm);
      const hp = meter(wrap, 'hp', 'HP');
      const mp = meter(wrap, 'mp', 'MP');
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
      b.hp(c.hp, c.maxHp);
      b.mp(c.mp, c.maxMp);
      const dot = `<i class="elem-dot" style="background:${ELEMENTS[c.element].color}"></i>`;
      b.label.innerHTML =
        c.hp > 0 ? `${dot}${esc(c.name)}` : `${dot}<span class="danger">${esc(c.name)}</span>`;
    }
  }

  destroy() {
    remove(this.root);
  }
}
