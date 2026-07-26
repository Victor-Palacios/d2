import { audio } from '../engine/Audio';
import { input } from '../engine/Input';
import { el, remove } from './dom';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-.'.split('');
const COLS = 10;
const MAX_LEN = 5;

/**
 * Name entry (plan §2.1): five slots, an on-screen keyboard driven by the
 * d-pad, and physical typing for anyone who would rather just type it.
 */
export class NameEntry {
  private root: HTMLElement;
  private slots: HTMLElement[] = [];
  private keys: HTMLElement[] = [];
  private index = 0;
  private value: string;
  private unsubs: (() => void)[] = [];
  private resolve: ((v: string) => void) | null = null;

  constructor(private parent: HTMLElement, defaultName = 'REN') {
    this.value = defaultName.toUpperCase().slice(0, MAX_LEN);

    this.root = el('div', 'screen');
    this.root.append(el('h2', 'title-sub', 'Register your licence name'));

    const slotWrap = el('div', 'name-slots');
    for (let i = 0; i < MAX_LEN; i++) {
      const s = el('span');
      slotWrap.appendChild(s);
      this.slots.push(s);
    }
    this.root.appendChild(slotWrap);

    const kb = el('div', 'keyboard');
    for (const ch of CHARS) {
      const b = el('button', undefined, ch);
      b.addEventListener('click', () => {
        this.index = this.keys.indexOf(b);
        this.press();
      });
      kb.appendChild(b);
      this.keys.push(b);
    }
    for (const [label, cls] of [
      ['DEL', 'wide'],
      ['OK', 'wide'],
    ] as const) {
      const b = el('button', cls, label);
      b.addEventListener('click', () => {
        this.index = this.keys.indexOf(b);
        this.press();
      });
      kb.appendChild(b);
      this.keys.push(b);
    }
    this.root.appendChild(kb);
    this.root.appendChild(el('div', 'hint', 'ARROWS move · Z/ENTER select · X deletes · or just type'));
    this.parent.appendChild(this.root);
    this.refresh();
  }

  private label(i: number): string {
    return this.keys[i].textContent ?? '';
  }

  private refresh() {
    for (let i = 0; i < MAX_LEN; i++) {
      this.slots[i].textContent = this.value[i] ?? '';
      this.slots[i].classList.toggle('cur', i === this.value.length);
    }
    this.keys.forEach((k, i) => k.classList.toggle('sel', i === this.index));
  }

  private move(dx: number, dy: number) {
    const n = this.keys.length;
    let i = this.index + dx + dy * COLS;
    if (i < 0) i += n;
    if (i >= n) i -= n;
    this.index = i;
    audio.sfx('blip');
    this.refresh();
  }

  private type(ch: string) {
    if (this.value.length >= MAX_LEN) return;
    this.value += ch;
    audio.sfx('blip');
    this.refresh();
  }

  private backspace() {
    this.value = this.value.slice(0, -1);
    audio.sfx('cancel');
    this.refresh();
  }

  private press() {
    const label = this.label(this.index);
    if (label === 'DEL') this.backspace();
    else if (label === 'OK') this.confirm();
    else this.type(label);
    this.refresh();
  }

  private confirm() {
    const name = this.value.trim() || 'REN';
    audio.sfx('confirm');
    this.resolve?.(name);
    this.resolve = null;
  }

  open(): Promise<string> {
    return new Promise((resolve) => {
      this.resolve = resolve;
      input.textMode = true;
      this.unsubs.push(
        input.onAction((a) => {
          if (a === 'left') this.move(-1, 0);
          else if (a === 'right') this.move(1, 0);
          else if (a === 'up') this.move(0, -1);
          else if (a === 'down') this.move(0, 1);
          else if (a === 'confirm') this.press();
          else if (a === 'cancel') this.backspace();
        }),
      );
      this.unsubs.push(
        input.onText((key) => {
          const up = key.toUpperCase();
          if (CHARS.includes(up)) this.type(up);
        }),
      );
    });
  }

  destroy() {
    input.textMode = false;
    for (const u of this.unsubs) u();
    this.unsubs = [];
    this.resolve = null;
    remove(this.root);
  }
}
