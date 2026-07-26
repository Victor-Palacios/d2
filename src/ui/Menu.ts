import { audio } from '../engine/Audio';
import { input } from '../engine/Input';
import { el, esc } from './dom';

export interface MenuItem {
  value: string;
  label: string;
  /** Right-aligned note, e.g. an MP cost. */
  note?: string;
  /** Tints the label — used to colour techniques by their element. */
  color?: string;
  disabled?: boolean;
}

export interface MenuOptions {
  /** Allow cancelling out (resolves null). */
  cancellable?: boolean;
  /** Fired as the highlight moves — used for live previews. */
  onHighlight?: (value: string, index: number) => void;
  startIndex?: number;
  /** Horizontal layouts (world map / team select) use left/right to move. */
  horizontal?: boolean;
  className?: string;
}

/**
 * Keyboard + mouse driven list. `open()` resolves with the chosen value, or
 * null if the player cancels.
 */
export class Menu {
  readonly root: HTMLElement;
  private index: number;
  private unsub: (() => void) | null = null;
  private resolve: ((v: string | null) => void) | null = null;
  private nodes: HTMLElement[] = [];
  private done = false;

  constructor(
    private parent: HTMLElement,
    private items: MenuItem[],
    private opts: MenuOptions = {},
  ) {
    this.root = el('ul', `menu ${opts.className ?? ''}`);
    this.index = opts.startIndex ?? 0;
    if (this.items[this.index]?.disabled) this.index = this.items.findIndex((i) => !i.disabled);
    if (this.index < 0) this.index = 0;
    this.build();
    this.parent.appendChild(this.root);
  }

  private build() {
    this.nodes = this.items.map((item, i) => {
      const li = el('li');
      li.innerHTML =
        (item.color ? `<span style="color:${item.color}">${esc(item.label)}</span>` : esc(item.label)) +
        (item.note ? `<span class="cost">${esc(item.note)}</span>` : '');
      if (item.disabled) li.setAttribute('aria-disabled', 'true');
      li.addEventListener('mouseenter', () => {
        if (!item.disabled) this.moveTo(i, false);
      });
      li.addEventListener('click', () => {
        if (item.disabled) return;
        this.moveTo(i, false);
        this.choose();
      });
      this.root.appendChild(li);
      return li;
    });
    this.refresh();
  }

  private refresh() {
    this.nodes.forEach((n, i) => n.classList.toggle('sel', i === this.index));
  }

  private moveTo(i: number, sound = true) {
    if (i === this.index) return;
    this.index = i;
    this.refresh();
    if (sound) audio.sfx('blip');
    const item = this.items[this.index];
    this.opts.onHighlight?.(item.value, this.index);
  }

  private step(dir: number) {
    const n = this.items.length;
    let i = this.index;
    for (let k = 0; k < n; k++) {
      i = (i + dir + n) % n;
      if (!this.items[i].disabled) break;
    }
    this.moveTo(i);
  }

  private choose() {
    const item = this.items[this.index];
    if (!item || item.disabled) return;
    audio.sfx('confirm');
    this.finish(item.value);
  }

  private finish(v: string | null) {
    if (this.done) return;
    this.done = true;
    this.unsub?.();
    this.unsub = null;
    this.resolve?.(v);
    this.resolve = null;
  }

  /** Highlights an item without firing selection. */
  select(value: string) {
    const i = this.items.findIndex((it) => it.value === value);
    if (i >= 0) this.moveTo(i, false);
  }

  open(): Promise<string | null> {
    return new Promise((resolve) => {
      this.resolve = resolve;
      const prev = this.opts.horizontal ? 'left' : 'up';
      const next = this.opts.horizontal ? 'right' : 'down';
      this.unsub = input.onAction((a) => {
        if (a === prev) this.step(-1);
        else if (a === next) this.step(1);
        else if (a === 'confirm' || a === 'start') this.choose();
        else if (a === 'auto') {
          // L1 shortcut: activate an 'auto' item if this menu offers one
          // (the battle action menu does; other menus simply ignore it).
          const i = this.items.findIndex((it) => it.value === 'auto' && !it.disabled);
          if (i >= 0) { this.moveTo(i, false); this.choose(); }
        } else if (a === 'cancel' && this.opts.cancellable) {
          audio.sfx('cancel');
          this.finish(null);
        }
      });
      this.opts.onHighlight?.(this.items[this.index].value, this.index);
    });
  }

  /** Closes without resolving a selection (scene teardown). */
  cancel() {
    this.finish(null);
  }

  destroy() {
    this.cancel();
    this.root.parentElement?.removeChild(this.root);
  }
}
