import { el, esc, meter, remove } from './dom';
import { Menu } from './Menu';
import type { MenuItem } from './Menu';
import type { Battle, BattleAction, Battler } from '../systems/battle/engine';
import { technique } from '../data/techniques';
import { ATTRIBUTES, ELEMENTS } from '../data/elements';
import { audio } from '../engine/Audio';
import { game } from '../systems/party/gameState';

interface FighterCard {
  root: HTMLElement;
  hp: (cur: number, max: number) => void;
  mp: (cur: number, max: number) => void;
  /** Enemy cards only: refresh the Soul Syphon meter / captured star. */
  syphon?: () => void;
}

/** What the action menu can resolve to — a real action, or "go auto". */
export type MenuChoice = BattleAction | { type: 'auto' };

/** Battle DOM overlay: HP/MP panels, turn banner, log and the action menu. */
export class BattleHUD {
  private root: HTMLElement;
  private banner: HTMLElement;
  private log: HTMLElement;
  private enemyWrap: HTMLElement;
  private partyWrap: HTMLElement;
  private menuHost: HTMLElement;
  private autoChip: HTMLElement;
  private cards = new Map<string, FighterCard>();
  private menu: Menu | null = null;

  constructor(private parent: HTMLElement) {
    this.root = el('div');
    this.root.id = 'battle-ui';

    this.banner = el('div', 'panel');
    this.banner.id = 'battle-banner';
    this.log = el('div', 'panel');
    this.log.id = 'battle-log';
    this.enemyWrap = el('div');
    this.enemyWrap.id = 'enemy-hud';
    this.partyWrap = el('div');
    this.partyWrap.id = 'party-hud';
    this.menuHost = el('div', 'panel');
    this.menuHost.id = 'action-menu';
    this.menuHost.style.display = 'none';

    // Shown only while auto-battle is running, so the way out is always visible.
    this.autoChip = el('div', 'panel');
    this.autoChip.id = 'auto-chip';
    this.autoChip.innerHTML = '<span class="accent">AUTO</span> — press ESC or L1 to take over';
    this.autoChip.style.display = 'none';

    this.root.append(this.banner, this.log, this.enemyWrap, this.partyWrap, this.menuHost, this.autoChip);
    this.parent.appendChild(this.root);
  }

  setAuto(on: boolean) {
    this.autoChip.style.display = on ? '' : 'none';
  }

  build(battle: Battle) {
    this.cards.clear();
    this.enemyWrap.innerHTML = '';
    this.partyWrap.innerHTML = '';
    for (const b of battle.side('enemy')) this.enemyWrap.appendChild(this.makeCard(b).root);
    for (const b of battle.side('party')) this.partyWrap.appendChild(this.makeCard(b).root);
    this.refresh(battle);
  }

  /**
   * A fighter card. The class is carried by the card's border colour rather
   * than a text line, and the element by a small dot next to the name — that
   * keeps the card to two lines so the fighters behind it stay visible.
   */
  private makeCard(b: Battler): FighterCard {
    const c = b.creature;
    const attr = ATTRIBUTES[c.attribute];
    const elem = ELEMENTS[c.element];

    const root = el('div', 'panel fighter');
    root.style.setProperty('--class-color', attr.color);
    root.title = `${attr.name} · ${elem.name}${b.tile ? ` · on a ${ELEMENTS[b.tile].name} plate` : ''}`;

    const nm = el('div', 'nm');
    const name = el('span');
    name.innerHTML =
      `<i class="elem-dot" style="background:${elem.color}"></i>${esc(c.name)}` +
      (b.tile
        ? `<i class="plate-mark" style="color:${ELEMENTS[b.tile].color}" title="standing on a ${ELEMENTS[b.tile].name} plate">▲</i>`
        : '');
    nm.append(name, el('span', 'dim', `Lv${c.level}`));
    root.appendChild(nm);

    const hp = meter(root, 'hp', 'HP');
    const mp = meter(root, 'mp', 'MP');

    const card: FighterCard = { root, hp, mp };

    // Enemy cards carry a Soul Syphon meter (or a captured ★) so the player can
    // read how close a wild monster is to being logged in the Soularium.
    if (b.side === 'enemy') {
      const syphon = el('div', 'syphon');
      root.appendChild(syphon);
      card.syphon = () => {
        const e = game.soul(c.speciesId);
        if (e.captured) {
          syphon.className = 'syphon captured';
          syphon.innerHTML = '<span class="star">★</span> Soul logged';
        } else {
          const pct = Math.round(e.syphon);
          syphon.className = 'syphon';
          syphon.innerHTML =
            `<span class="dim">Soul Syphon</span> <b>${pct}%</b>` +
            `<i class="syphon-bar"><i style="width:${pct}%"></i></i>`;
        }
      };
    }

    this.cards.set(c.uid, card);
    return card;
  }

  refresh(battle: Battle) {
    for (const b of battle.battlers) {
      const card = this.cards.get(b.creature.uid);
      if (!card) continue;
      const c = b.creature;
      card.hp(c.hp, c.maxHp);
      card.mp(c.mp, c.maxMp);
      card.syphon?.();
      card.root.classList.toggle('down', c.hp <= 0);
      if (c.guarding) card.root.classList.add('guarding');
    }
  }

  setActive(uid: string | null) {
    for (const [id, card] of this.cards) card.root.classList.toggle('active', id === uid);
  }

  setBanner(text: string) {
    this.banner.textContent = text;
  }

  setLog(text: string) {
    this.log.innerHTML = esc(text);
  }

  /** Floating damage / heal number at a screen position. */
  float(x: number, y: number, text: string, color: string) {
    const node = el('div', 'dmg-float');
    node.textContent = text;
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    node.style.color = color;
    this.root.appendChild(node);
    setTimeout(() => remove(node), 950);
  }

  private async runMenu(items: MenuItem[], opts: { cancellable?: boolean; onHighlight?: (v: string) => void } = {}) {
    this.menuHost.style.display = '';
    this.menu?.destroy();
    this.menu = new Menu(this.menuHost, items, {
      cancellable: opts.cancellable,
      onHighlight: opts.onHighlight,
    });
    const v = await this.menu.open();
    this.menu.destroy();
    this.menu = null;
    this.menuHost.style.display = 'none';
    return v;
  }

  /**
   * Runs the player's action selection for one battler.
   * `onTargetHover` lets the scene highlight the targeted sprite in 3D.
   *
   * Resolves either a concrete action, or `{ type: 'auto' }` when the player
   * hands the fight over to auto-battle.
   */
  async chooseAction(
    battle: Battle,
    actor: Battler,
    onTargetHover?: (uid: string | null) => void,
  ): Promise<MenuChoice> {
    const c = actor.creature;

    for (;;) {
      const root = await this.runMenu([
        { value: 'attack', label: 'Attack' },
        { value: 'technique', label: 'Technique', disabled: c.techniques.length === 0 },
        { value: 'guard', label: 'Guard' },
        { value: 'auto', label: 'Auto', note: 'L1' },
        { value: 'item', label: 'Item', disabled: true, note: '—' },
      ]);

      if (root === 'auto') return { type: 'auto' };

      if (root === 'guard') return { type: 'guard' };

      if (root === 'attack') {
        const uid = await this.pickTarget(battle, actor, 'enemy', onTargetHover);
        if (!uid) continue;
        return { type: 'attack', targetUid: uid };
      }

      if (root === 'technique') {
        const items: MenuItem[] = c.techniques.map((id) => {
          const t = technique(id);
          return {
            value: id,
            label: t.name,
            // Techniques are tinted by their element so the plate bonus and the
            // resistance you are about to hit are readable at a glance.
            color: ELEMENTS[t.element].color,
            note: `${t.mpCost} MP`,
            disabled: c.mp < t.mpCost,
          };
        });
        const techId = await this.runMenu(items, { cancellable: true });
        if (!techId) continue;
        const t = technique(techId);
        if (t.aoe) return { type: 'technique', techniqueId: techId, targetUid: battle.living('enemy')[0].creature.uid };
        const uid = await this.pickTarget(battle, actor, t.kind === 'heal' ? 'party' : 'enemy', onTargetHover);
        if (!uid) continue;
        return { type: 'technique', techniqueId: techId, targetUid: uid };
      }
      // 'item' is disabled, and cancel at the root loops back around.
    }
  }

  private async pickTarget(
    battle: Battle,
    actor: Battler,
    side: 'party' | 'enemy',
    onTargetHover?: (uid: string | null) => void,
  ): Promise<string | null> {
    const candidates = battle.living(side);
    if (!candidates.length) return null;
    const items: MenuItem[] = candidates.map((b) => ({
      value: b.creature.uid,
      label: b.creature.name,
      note: `${b.creature.hp}/${b.creature.maxHp}`,
    }));
    // Default to the actor when healing, otherwise the first foe.
    const startIndex = Math.max(
      0,
      side === 'party' ? candidates.findIndex((b) => b.creature.uid === actor.creature.uid) : 0,
    );
    this.menuHost.style.display = '';
    this.menu?.destroy();
    this.menu = new Menu(this.menuHost, items, {
      cancellable: true,
      startIndex,
      onHighlight: (v) => onTargetHover?.(v),
    });
    const v = await this.menu.open();
    this.menu.destroy();
    this.menu = null;
    this.menuHost.style.display = 'none';
    onTargetHover?.(null);
    if (!v) audio.sfx('cancel');
    return v;
  }

  destroy() {
    this.menu?.destroy();
    remove(this.root);
  }
}
