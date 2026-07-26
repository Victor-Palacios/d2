import { audio } from '../engine/Audio';
import { input } from '../engine/Input';
import { el, esc, remove } from './dom';
import { pixelArtElement } from '../engine/pixel';
import type { PixelArt } from '../engine/pixel';

export interface Card {
  value: string;
  title: string;
  tag?: string;
  tagColor?: string;
  body: string;
  art?: PixelArt;
  artScale?: number;
  disabled?: boolean;
  disabledNote?: string;
}

/**
 * Horizontal card picker used by the world map (plan §2.3) and the Guard Team
 * choice (plan §2.6). Keyboard and mouse both work.
 */
export class CardSelect {
  private root: HTMLElement;
  private nodes: HTMLElement[] = [];
  private index = 0;
  private unsub: (() => void) | null = null;
  private resolve: ((v: string | null) => void) | null = null;
  private done = false;

  constructor(
    private parent: HTMLElement,
    private cards: Card[],
    private opts: { heading?: string; subheading?: string; cancellable?: boolean } = {},
  ) {
    this.root = el('div', 'screen');
    if (opts.heading) this.root.appendChild(el('h1', 'title-main', esc(opts.heading)));
    if (opts.subheading) this.root.appendChild(el('p', 'title-sub', esc(opts.subheading)));

    const wrap = el('div', 'cards');
    this.nodes = cards.map((c, i) => {
      const node = el('div', `panel card${c.disabled ? ' locked' : ''}`);
      node.appendChild(el('h3', undefined, esc(c.title)));
      if (c.tag) {
        const tag = el('span', 'tag', esc(c.tag));
        if (c.tagColor) {
          tag.style.color = c.tagColor;
          tag.style.borderColor = c.tagColor;
        }
        node.appendChild(tag);
      }
      if (c.art) {
        const holder = el('div');
        holder.style.cssText = 'display:flex;justify-content:center;padding:6px 0 2px;';
        holder.appendChild(pixelArtElement(c.art, c.artScale ?? 4));
        node.appendChild(holder);
      }
      node.appendChild(el('p', undefined, c.body));
      if (c.disabled && c.disabledNote) node.appendChild(el('p', 'danger', esc(c.disabledNote)));
      node.addEventListener('mouseenter', () => this.moveTo(i, false));
      node.addEventListener('click', () => {
        this.moveTo(i, false);
        this.choose();
      });
      wrap.appendChild(node);
      return node;
    });
    this.root.appendChild(wrap);
    this.root.appendChild(el('div', 'hint', 'LEFT/RIGHT choose · Z/ENTER confirm'));
    this.parent.appendChild(this.root);

    if (this.cards[this.index]?.disabled) {
      const i = this.cards.findIndex((c) => !c.disabled);
      if (i >= 0) this.index = i;
    }
    this.refresh();
  }

  private refresh() {
    this.nodes.forEach((n, i) => n.classList.toggle('sel', i === this.index));
  }

  private moveTo(i: number, sound = true) {
    if (i === this.index || this.cards[i].disabled) return;
    this.index = i;
    this.refresh();
    if (sound) audio.sfx('blip');
  }

  private step(dir: number) {
    const n = this.cards.length;
    let i = this.index;
    for (let k = 0; k < n; k++) {
      i = (i + dir + n) % n;
      if (!this.cards[i].disabled) break;
    }
    this.moveTo(i);
  }

  private choose() {
    const c = this.cards[this.index];
    if (!c || c.disabled) return;
    audio.sfx('confirm');
    this.finish(c.value);
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
        if (a === 'left') this.step(-1);
        else if (a === 'right') this.step(1);
        else if (a === 'confirm' || a === 'start') this.choose();
        else if (a === 'cancel' && this.opts.cancellable) {
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
