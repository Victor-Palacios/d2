import { bar, el, esc, remove } from './dom';
import { Menu } from './Menu';
import type { MenuItem } from './Menu';
import type { Battle, BattleAction, Battler } from '../systems/battle/engine';
import { technique } from '../data/techniques';
import { ATTRIBUTES, ELEMENTS } from '../data/elements';
import { audio } from '../engine/Audio';

interface FighterCard {
  root: HTMLElement;
  hp: (p: number) => void;
  mp: (p: number) => void;
  hpText: HTMLElement;
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
    this.autoChip.innerHTML = '<span class="accent">AUTO</span> — press ESC to take over';
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

  private makeCard(b: Battler): FighterCard {
    const c = b.creature;
    const root = el('div', 'panel fighter');
    const nm = el('div', 'nm');
    nm.append(el('span', undefined, esc(c.name)), el('span', 'dim', `Lv${c.level}`));
    root.appendChild(nm);

    const sub = el('div', 'sub');
    const attr = ATTRIBUTES[c.attribute];
    const elem = ELEMENTS[c.element];
    sub.innerHTML =
      `<span style="color:${attr.color}">${attr.name}</span> · ` +
      `<span style="color:${elem.color}">${elem.name}</span>` +
      (b.tile ? ` · <span style="color:${ELEMENTS[b.tile].color}" title="standing on a ${ELEMENTS[b.tile].name} plate">▲${ELEMENTS[b.tile].name}</span>` : '');
    root.appendChild(sub);

    const hpText = el('div', 'sub');
    root.appendChild(hpText);
    const hp = bar(root, 'hp');
    const mp = bar(root, 'mp');

    const card: FighterCard = { root, hp, mp, hpText };
    this.cards.set(c.uid, card);
    return card;
  }

  refresh(battle: Battle) {
    for (const b of battle.battlers) {
      const card = this.cards.get(b.creature.uid);
      if (!card) continue;
      const c = b.creature;
      card.hp(c.hp / c.maxHp);
      card.mp(c.mp / Math.max(1, c.maxMp));
      card.hpText.textContent = `HP ${c.hp}/${c.maxHp}   MP ${c.mp}/${c.maxMp}`;
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
        { value: 'auto', label: 'Auto', note: 'ESC' },
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
