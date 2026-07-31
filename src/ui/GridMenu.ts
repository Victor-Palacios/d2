import { audio } from '../engine/Audio';
import { input } from '../engine/Input';
import { el, esc, remove } from './dom';

export interface GridItem {
  value: string;
  label: string;
  sublabel?: string;
  /** Inline SVG markup for the icon (tinted with `color`). */
  icon: string;
  color: string;
  disabled?: boolean;
}

/**
 * A two-column icon + label grid picker — the main "system" menu, in the style
 * of a modern handheld RPG (big tappable cards, an icon and a name each).
 * Keyboard, mouse and gamepad navigable in both axes.
 */
export class GridMenu {
  private root: HTMLElement;
  private nodes: HTMLElement[] = [];
  private index = 0;
  private readonly cols = 2;
  private unsub: (() => void) | null = null;
  private resolve: ((v: string | null) => void) | null = null;
  private done = false;

  constructor(
    private parent: HTMLElement,
    private items: GridItem[],
    opts: { heading?: string; subheading?: string } = {},
  ) {
    this.root = el('div', 'screen grid-menu');
    if (opts.heading) this.root.appendChild(el('h1', 'title-main', esc(opts.heading)));
    if (opts.subheading) this.root.appendChild(el('p', 'title-sub', esc(opts.subheading)));

    const grid = el('div', 'grid-menu-cards');
    this.nodes = items.map((it, i) => {
      const card = el('div', `panel grid-card${it.disabled ? ' locked' : ''}`);
      card.style.setProperty('--card-color', it.color);
      card.innerHTML =
        `<span class="grid-icon">${it.icon}</span>` +
        `<span class="grid-text"><b>${esc(it.label)}</b>${it.sublabel ? `<i>${esc(it.sublabel)}</i>` : ''}</span>`;
      card.addEventListener('mouseenter', () => this.moveTo(i));
      card.addEventListener('click', () => {
        this.moveTo(i);
        this.choose();
      });
      grid.appendChild(card);
      return card;
    });
    this.root.appendChild(grid);
    this.root.appendChild(el('div', 'hint', 'ARROWS choose · Z/ENTER open · X / Start close'));
    this.parent.appendChild(this.root);

    if (this.items[this.index]?.disabled)
      this.index = Math.max(
        0,
        this.items.findIndex((i) => !i.disabled),
      );
    this.refresh();
  }

  private refresh() {
    this.nodes.forEach((n, i) => {
      n.classList.toggle('sel', i === this.index);
    });
  }

  private moveTo(i: number) {
    if (i < 0 || i >= this.items.length || this.items[i].disabled || i === this.index) return;
    this.index = i;
    this.refresh();
    audio.sfx('blip');
  }

  /** Move within the grid by (rowDelta, colDelta), clamped, skipping disabled. */
  private move(dr: number, dc: number) {
    const n = this.items.length;
    const rows = Math.ceil(n / this.cols);
    let r = Math.floor(this.index / this.cols) + dr;
    let c = (this.index % this.cols) + dc;
    r = Math.max(0, Math.min(rows - 1, r));
    c = Math.max(0, Math.min(this.cols - 1, c));
    let ni = r * this.cols + c;
    if (ni >= n) ni = n - 1;
    // If the target is disabled, scan forward/back for the nearest enabled cell.
    if (this.items[ni]?.disabled) {
      const dir = dr + dc >= 0 ? 1 : -1;
      for (let k = 1; k < n; k++) {
        const j = ni + dir * k;
        if (j >= 0 && j < n && !this.items[j].disabled) {
          ni = j;
          break;
        }
      }
    }
    this.moveTo(ni);
  }

  private choose() {
    const it = this.items[this.index];
    if (!it || it.disabled) return;
    audio.sfx('confirm');
    this.finish(it.value);
  }

  private finish(v: string | null) {
    if (this.done) return;
    this.done = true;
    this.unsub?.();
    this.unsub = null;
    this.resolve?.(v);
    this.resolve = null;
  }

  open(): Promise<string | null> {
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.unsub = input.onAction((a) => {
        if (a === 'left') this.move(0, -1);
        else if (a === 'right') this.move(0, 1);
        else if (a === 'up') this.move(-1, 0);
        else if (a === 'down') this.move(1, 0);
        else if (a === 'confirm') this.choose();
        // Start / R1 toggles the menu shut again, matching how it opened.
        else if (a === 'cancel' || a === 'menu' || a === 'start') {
          audio.sfx('cancel');
          this.finish(null);
        }
      });
    });
  }

  destroy() {
    this.finish(null);
    remove(this.root);
  }
}
