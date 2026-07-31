import { el, esc, meter, remove } from './dom';
import { Menu } from './Menu';
import type { MenuItem } from './Menu';
import type { Battle, BattleAction, Battler } from '../systems/battle/engine';
import { BOOST_MAX, isMeleeTechnique } from '../systems/battle/engine';
import type { CreatureInstance } from '../systems/party/creature';
import { activeMoves } from '../systems/party/creature';
import { technique, techShape } from '../data/techniques';
import { ATTRIBUTES, ELEMENTS } from '../data/elements';
import { classIcon } from './icons';
import { audio } from '../engine/Audio';
import { game } from '../systems/party/gameState';

interface FighterCard {
  root: HTMLElement;
  hp: (cur: number, max: number) => void;
  mp: (cur: number, max: number) => void;
  /** Enemy cards only: refresh the Soul Syphon meter / captured star. */
  syphon?: () => void;
  /** Stagger meter / BROKEN tag (Phase D). */
  staggerEl: HTMLElement;
  /** Lingering elemental-reaction mark pip. */
  markEl: HTMLElement;
}

/** What the action menu can resolve to — a real action, "go auto"/"repeat", "boost", or "flee". */
export type MenuChoice = BattleAction | { type: 'auto' } | { type: 'repeat' } | { type: 'boost' } | { type: 'flee' };

/** How many announcements stay stacked at once, and how long each one dwells (ms). */
const LOG_MAX = 4;
const LOG_DWELL = 2600;

/** Human label for a formation cell, e.g. "Vanguard · Left". */
function cellLabel(row: number, col: number): string {
  return `${row === 0 ? 'Vanguard' : 'Rear'} · ${['Left', 'Centre', 'Right'][col]}`;
}

/** Battle DOM overlay: HP/MP panels, turn banner, log and the action menu. */
export class BattleHUD {
  private root: HTMLElement;
  private banner: HTMLElement;
  private log: HTMLElement;
  private enemyWrap: HTMLElement;
  private partyWrap: HTMLElement;
  private menuHost: HTMLElement;
  private autoChip: HTMLElement;
  private repeatChip: HTMLElement;
  private boostChip!: HTMLElement;
  private cards = new Map<string, FighterCard>();
  private menu: Menu | null = null;

  constructor(private parent: HTMLElement) {
    this.root = el('div');
    this.root.id = 'battle-ui';

    this.banner = el('div', 'panel');
    this.banner.id = 'battle-banner';
    // A stack of transient announcements, newest at the bottom. Each line fades
    // in, dwells long enough to read, then fades out — so nothing lingers on
    // screen forever and a burst of messages can be read one above the other.
    this.log = el('div');
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

    // Shown only while Repeat is running (the party re-issues last round's commands).
    this.repeatChip = el('div', 'panel');
    this.repeatChip.id = 'repeat-chip';
    this.repeatChip.innerHTML = '<span class="accent">REPEAT</span> — press ESC to take over';
    this.repeatChip.style.display = 'none';

    // Party Boost gauge — fills on Attack/Guard, spent to act again.
    this.boostChip = el('div', 'panel');
    this.boostChip.id = 'boost-chip';

    this.root.append(
      this.banner,
      this.log,
      this.enemyWrap,
      this.partyWrap,
      this.menuHost,
      this.autoChip,
      this.repeatChip,
      this.boostChip,
    );
    this.parent.appendChild(this.root);
  }

  setAuto(on: boolean) {
    this.autoChip.style.display = on ? '' : 'none';
  }

  setRepeat(on: boolean) {
    this.repeatChip.style.display = on ? '' : 'none';
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
   * A fighter card. The element is carried by the card's border colour and the
   * class by a small glyph next to the name — that keeps the card to two lines
   * so the fighters behind it stay visible.
   */
  private makeCard(b: Battler): FighterCard {
    const c = b.creature;
    const attr = ATTRIBUTES[c.attribute];
    const elem = ELEMENTS[c.element];

    const rowName = b.cell.row === 0 ? 'Vanguard' : 'Rear';
    const root = el('div', 'panel fighter');
    root.style.setProperty('--elem-color', elem.color);
    root.classList.add(b.cell.row === 0 ? 'vanguard' : 'rear');
    root.title = `${attr.name} · ${elem.name} · ${rowName}${b.tile ? ` · on a ${ELEMENTS[b.tile].name} plate` : ''}`;

    const nm = el('div', 'nm');
    const name = el('span');
    name.innerHTML =
      `${classIcon(c.attribute)}${esc(c.name)}` +
      (b.tile
        ? `<i class="plate-mark" style="color:${ELEMENTS[b.tile].color}" title="standing on a ${ELEMENTS[b.tile].name} plate">▲</i>`
        : '');
    nm.append(name, el('span', 'dim', `Lv${c.level}`));
    root.appendChild(nm);

    const hp = meter(root, 'hp', 'HP');
    const mp = meter(root, 'mp', 'MP');

    const staggerEl = el('div', 'stagger-meter');
    root.appendChild(staggerEl);

    // Elemental-reaction mark: a small element-coloured pip appended to the name.
    const markEl = el('i', 'react-mark');
    markEl.style.display = 'none';
    name.appendChild(markEl);

    const card: FighterCard = { root, hp, mp, staggerEl, markEl };

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
        } else if (e.syphon >= 100) {
          // Full, but only claimed if you win the fight.
          syphon.className = 'syphon captured';
          syphon.innerHTML = '<span class="star">◆</span> Soul full — win to claim';
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
      card.root.classList.toggle('broken', b.staggered);
      card.root.classList.toggle('pacified', b.pacified);
      if (c.guarding) card.root.classList.add('guarding');

      // Elemental-reaction mark pip: element-coloured, hidden when none is live.
      const mark = battle.activeMark(b);
      if (mark && !b.pacified) {
        const md = ELEMENTS[mark];
        card.markEl.style.display = '';
        card.markEl.style.color = md.color;
        card.markEl.textContent = '◈';
        card.markEl.title = `Marked ${md.name} — a different element will react`;
      } else {
        card.markEl.style.display = 'none';
      }

      if (b.pacified) {
        card.staggerEl.className = 'stagger-meter pacified';
        card.staggerEl.innerHTML = '<b>AT PEACE</b>';
      } else if (b.staggered) {
        card.staggerEl.className = 'stagger-meter broken';
        card.staggerEl.innerHTML = b.chain >= 2 ? `<b>BROKEN ×${b.chain}</b>` : '<b>BROKEN</b>';
      } else if (b.commune > 0) {
        card.staggerEl.className = 'stagger-meter commune';
        card.staggerEl.innerHTML = `<span class="dim">Understanding</span><i class="stagger-bar"><i style="width:${Math.round(b.commune)}%"></i></i>`;
      } else if (b.stagger > 0) {
        card.staggerEl.className = 'stagger-meter';
        card.staggerEl.innerHTML = `<span class="dim">Stagger</span><i class="stagger-bar"><i style="width:${Math.round(b.stagger)}%"></i></i>`;
      } else {
        card.staggerEl.className = 'stagger-meter';
        card.staggerEl.innerHTML = '';
      }
    }
    const charges = battle.boost.party;
    const pips = Array.from({ length: BOOST_MAX }, (_, i) => `<i class="${i < charges ? 'on' : ''}">▲</i>`).join('');
    this.boostChip.innerHTML = `<span class="dim">BOOST</span> ${pips}`;
    this.boostChip.classList.toggle('ready', charges > 0);
  }

  setActive(uid: string | null) {
    for (const [id, card] of this.cards) card.root.classList.toggle('active', id === uid);
  }

  setBanner(text: string) {
    this.banner.textContent = text;
    // An empty banner hides entirely rather than showing a blank pill.
    this.banner.style.display = text ? '' : 'none';
  }

  /**
   * Push a battle announcement onto the stack. It appears beneath the previous
   * ones, dwells for `LOG_DWELL`, then fades out and removes itself. The stack
   * is capped at `LOG_MAX` so a rapid sequence stays readable without piling up.
   */
  setLog(text: string) {
    const line = el('div', 'panel log-line');
    line.innerHTML = esc(text);
    this.log.appendChild(line);
    while (this.log.childElementCount > LOG_MAX && this.log.firstElementChild) {
      remove(this.log.firstElementChild as HTMLElement);
    }
    requestAnimationFrame(() => line.classList.add('show'));
    setTimeout(() => {
      line.classList.remove('show');
      line.classList.add('gone');
      setTimeout(() => remove(line), 450);
    }, LOG_DWELL);
  }

  /**
   * The Grief command set — the only actions against The Last Light. Not
   * cancellable: you must choose how to meet it.
   */
  async chooseGrief(comforted: boolean): Promise<'remember' | 'comfort' | 'letgo'> {
    const v = await this.runMenu([
      { value: 'remember', label: 'Remember', note: 'recall who they are' },
      { value: 'comfort', label: 'Comfort', note: 'speak gently' },
      { value: 'letgo', label: 'Let Go', note: comforted ? 'release them' : 'they may not be ready' },
    ]);
    return (v ?? 'remember') as 'remember' | 'comfort' | 'letgo';
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
    reserves: CreatureInstance[] = [],
    canRepeat = false,
  ): Promise<MenuChoice> {
    const c = actor.creature;

    for (;;) {
      // Only the loadout (≤5 active moves) is fieldable; Technique is greyed out
      // unless the creature can afford at least one of them.
      const moves = activeMoves(c);
      const canTechnique = moves.some((id) => c.mp >= technique(id).mpCost);
      const canMove = battle.emptyCells(actor.side).length > 0;
      const canSwap = reserves.length > 0;
      const canCommune = battle.communeTargets('enemy').length > 0;
      const charges = battle.boost.party;
      const items: MenuItem[] = [
        { value: 'attack', label: 'Attack' },
        { value: 'technique', label: 'Technique', disabled: !canTechnique, note: canTechnique ? undefined : 'no MP' },
        {
          value: 'boost',
          label: 'Boost',
          disabled: charges < 1,
          note: charges > 0 ? `act again · ▲${charges}` : 'empty',
        },
        { value: 'move', label: 'Move', disabled: !canMove, note: canMove ? undefined : 'no room' },
        { value: 'swap', label: 'Swap', disabled: !canSwap, note: canSwap ? undefined : '—' },
        { value: 'guard', label: 'Guard' },
        { value: 'run', label: 'Run', disabled: battle.isBoss, note: battle.isBoss ? "can't flee" : '50%' },
        { value: 'auto', label: 'Auto', note: 'L1' },
        { value: 'repeat', label: 'Repeat', disabled: !canRepeat, note: canRepeat ? 'last commands' : '—' },
      ];
      // Commune only appears when a gentle soul is present to hear it.
      if (canCommune) items.splice(6, 0, { value: 'commune', label: 'Commune', note: 'reach out' });
      const root = await this.runMenu(items);

      if (root === 'auto') return { type: 'auto' };

      if (root === 'repeat') return { type: 'repeat' };

      if (root === 'boost') return { type: 'boost' };

      if (root === 'run') return { type: 'flee' };

      if (root === 'guard') return { type: 'guard' };

      if (root === 'commune') {
        const uid = await this.pickTarget(actor, battle.communeTargets('enemy'), onTargetHover);
        if (!uid) continue;
        return { type: 'commune', targetUid: uid };
      }

      if (root === 'attack') {
        // A basic Attack is melee: it cannot reach a covered Rear foe.
        const uid = await this.pickTarget(actor, battle.meleeTargets('enemy'), onTargetHover);
        if (!uid) continue;
        return { type: 'attack', targetUid: uid };
      }

      if (root === 'move') {
        const items: MenuItem[] = battle.emptyCells(actor.side).map((cell) => ({
          value: `${cell.row}:${cell.col}`,
          label: cellLabel(cell.row, cell.col),
          note: battle.plateAt(actor.side, cell) ? `${battle.plateAt(actor.side, cell)} plate` : undefined,
        }));
        const pick = await this.runMenu(items, { cancellable: true });
        if (!pick) continue;
        const [row, col] = pick.split(':').map(Number);
        return { type: 'shift', cell: { row, col } };
      }

      if (root === 'swap') {
        const items: MenuItem[] = reserves.map((r) => ({
          value: r.uid,
          label: r.name,
          note: `${r.hp}/${r.maxHp}`,
        }));
        const uid = await this.runMenu(items, { cancellable: true });
        if (!uid) continue;
        return { type: 'swap', reserveUid: uid };
      }

      if (root === 'technique') {
        const items: MenuItem[] = moves.map((id) => {
          const t = technique(id);
          const shape = techShape(t);
          // Note reads: "6 MP · melee" / "10 MP · row" — so reach and shape are
          // both legible before committing.
          const tags = [shape === 'single' ? '' : shape, isMeleeTechnique(t) ? 'melee' : ''].filter(Boolean);
          return {
            value: id,
            label: t.name,
            // Techniques are tinted by their element so the plate bonus and the
            // resistance you are about to hit are readable at a glance.
            color: ELEMENTS[t.element].color,
            note: `${t.mpCost} MP${tags.length ? ` · ${tags.join(' · ')}` : ''}`,
            disabled: c.mp < t.mpCost,
          };
        });
        const techId = await this.runMenu(items, { cancellable: true });
        if (!techId) continue;
        const t = technique(techId);
        // 'all' needs no aim; row/column/single all aim at an anchor foe.
        if (techShape(t) === 'all')
          return { type: 'technique', techniqueId: techId, targetUid: battle.living('enemy')[0].creature.uid };
        // Melee Techniques respect cover (front line only); ranged/Ether reach any
        // living foe. Heals aim at the party.
        const candidates =
          t.kind === 'heal'
            ? battle.living('party')
            : isMeleeTechnique(t)
              ? battle.meleeTargets('enemy')
              : battle.living('enemy');
        const uid = await this.pickTarget(actor, candidates, onTargetHover);
        if (!uid) continue;
        return { type: 'technique', techniqueId: techId, targetUid: uid };
      }
    }
  }

  private async pickTarget(
    actor: Battler,
    candidates: Battler[],
    onTargetHover?: (uid: string | null) => void,
  ): Promise<string | null> {
    if (!candidates.length) return null;
    const items: MenuItem[] = candidates.map((b) => ({
      value: b.creature.uid,
      label: b.creature.name,
      note: `${b.creature.hp}/${b.creature.maxHp}`,
    }));
    // Default to the actor when it is a valid target (self-heal), otherwise the first.
    const startIndex = Math.max(
      0,
      candidates.findIndex((b) => b.creature.uid === actor.creature.uid),
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
