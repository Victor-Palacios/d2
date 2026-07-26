import { audio } from '../engine/Audio';
import { input } from '../engine/Input';
import type { DialogueScript } from '../systems/dialogue/script';
import { el, esc, remove } from './dom';

/**
 * Text box with a typewriter reveal. Confirm skips to the full line, then
 * advances. `play()` resolves when the script is exhausted.
 */
export class DialogueBox {
  private root: HTMLElement;
  private speakerEl: HTMLElement;
  private bodyEl: HTMLElement;
  private moreEl: HTMLElement;
  private unsub: (() => void) | null = null;

  /** Characters per second. */
  speed = 62;

  constructor(private parent: HTMLElement) {
    this.root = el('div', 'panel');
    this.root.id = 'dialogue';
    this.speakerEl = el('div', 'speaker');
    this.bodyEl = el('div', 'body');
    this.moreEl = el('div', 'more', '▼');
    this.root.append(this.speakerEl, this.bodyEl, this.moreEl);
    this.root.style.display = 'none';
    this.parent.appendChild(this.root);
  }

  get visible(): boolean {
    return this.root.style.display !== 'none';
  }

  async play(script: DialogueScript): Promise<void> {
    if (!script.length) return;
    this.root.style.display = '';
    for (const line of script) {
      this.speakerEl.textContent = line.speaker ?? '';
      this.speakerEl.style.display = line.speaker ? '' : 'none';
      await this.typeLine(line.text);
    }
    this.root.style.display = 'none';
  }

  private typeLine(text: string): Promise<void> {
    return new Promise((resolve) => {
      let shown = 0;
      let complete = false;
      let last = performance.now();
      this.moreEl.style.visibility = 'hidden';

      const finish = () => {
        this.unsub?.();
        this.unsub = null;
        this.root.onclick = null;
        resolve();
      };

      this.unsub = input.onAction((a) => {
        if (a !== 'confirm' && a !== 'cancel') return;
        if (!complete) {
          complete = true;
          shown = text.length;
          this.bodyEl.innerHTML = esc(text);
          this.moreEl.style.visibility = '';
        } else {
          audio.sfx('blip');
          finish();
        }
      });
      // Clicking the box works too.
      this.root.onclick = () => {
        if (!complete) {
          complete = true;
          shown = text.length;
          this.bodyEl.innerHTML = esc(text);
          this.moreEl.style.visibility = '';
        } else {
          finish();
        }
      };

      const tick = () => {
        if (complete && shown >= text.length) {
          if (this.unsub) requestAnimationFrame(tick);
          return;
        }
        const now = performance.now();
        const dt = (now - last) / 1000;
        last = now;
        const before = Math.floor(shown);
        shown = Math.min(text.length, shown + this.speed * dt);
        if (Math.floor(shown) !== before && Math.floor(shown) % 3 === 0) audio.sfx('blip');
        this.bodyEl.innerHTML = esc(text.slice(0, Math.floor(shown)));
        if (shown >= text.length) {
          complete = true;
          this.moreEl.style.visibility = '';
        }
        if (this.unsub) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  destroy() {
    this.unsub?.();
    this.root.onclick = null;
    remove(this.root);
  }
}
