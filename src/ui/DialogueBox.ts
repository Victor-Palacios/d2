import { audio } from '../engine/Audio';
import { input } from '../engine/Input';
import type { DialogueScript } from '../systems/dialogue/script';
import { el, esc, remove } from './dom';

/**
 * Text box with a typewriter reveal. Confirm skips to the full line, then
 * advances. `play()` resolves when the script is exhausted.
 *
 * **Auto mode.** The ▶ button at the box's top-right toggles hands-free
 * reading: each line finishes typing, dwells for a length-scaled beat, then
 * advances on its own — no clicking. Auto is a sticky mode (it stays on across
 * lines and across `play()` calls) and is turned **off** by pressing Esc /
 * Cancel. A manual Confirm still works while auto is on, to hurry a line along.
 */
export class DialogueBox {
  private root: HTMLElement;
  private speakerEl: HTMLElement;
  private bodyEl: HTMLElement;
  private moreEl: HTMLElement;
  private autoBtn: HTMLButtonElement;
  private unsub: (() => void) | null = null;

  /** Characters per second. */
  speed = 62;

  /** Sticky hands-free mode. Toggled by the button, cleared by Esc. */
  private auto = false;
  /** Pending auto-advance timer for the current, fully-revealed line. */
  private autoTimer: ReturnType<typeof setTimeout> | null = null;
  /**
   * Handle on the line currently on screen, so the auto toggle / Esc can act on
   * it. Line-local so overlapping ticks can never interfere (each `typeLine`
   * owns its own state; only the active one is published here).
   */
  private current: LineController | null = null;

  constructor(private parent: HTMLElement) {
    this.root = el('div', 'panel');
    this.root.id = 'dialogue';
    this.speakerEl = el('div', 'speaker');
    this.bodyEl = el('div', 'body');
    this.moreEl = el('div', 'more', '▼');

    this.autoBtn = el('button', 'auto-toggle');
    this.autoBtn.type = 'button';
    this.autoBtn.title = 'Auto-advance text — L1 / Q toggles, Esc stops';
    this.autoBtn.onclick = (e) => {
      e.stopPropagation();
      this.setAuto(!this.auto);
    };

    this.root.append(this.speakerEl, this.bodyEl, this.moreEl, this.autoBtn);
    this.root.style.display = 'none';
    this.syncAutoBtn();
    this.parent.appendChild(this.root);
  }

  get visible(): boolean {
    return this.root.style.display !== 'none';
  }

  private clearAutoTimer() {
    if (this.autoTimer !== null) {
      clearTimeout(this.autoTimer);
      this.autoTimer = null;
    }
  }

  /**
   * How long to dwell on a fully-revealed line before auto-advancing, scaled by
   * the amount of text: a brief beat for a one-liner, proportionally longer for
   * a speech, so the reading pace stays even. The old fixed 1.1–3.6s band was
   * the problem — it lingered on short lines and advanced long ones before you
   * could finish. This dwell is *on top of* the typewriter reveal (during which
   * the line is already being read), so the per-character rate is tuned for the
   * catch-up reading that remains once a line is fully shown.
   */
  private dwellFor(text: string): number {
    return Math.min(8000, Math.max(700, Math.round(400 + text.length * 42)));
  }

  private armAuto(c: LineController) {
    this.clearAutoTimer();
    this.autoTimer = setTimeout(() => c.finish(), this.dwellFor(c.text));
  }

  private syncAutoBtn() {
    this.autoBtn.textContent = this.auto ? '❚❚ Auto' : '▶ Auto';
    this.autoBtn.classList.toggle('on', this.auto);
  }

  /** Turn hands-free mode on/off. Public so a settings UI could bind it later. */
  setAuto(on: boolean) {
    if (this.auto === on) return;
    this.auto = on;
    this.syncAutoBtn();
    if (on) {
      // If a line is already sitting fully revealed, start its beat now.
      const c = this.current;
      if (c?.isComplete()) this.armAuto(c);
    } else {
      this.clearAutoTimer();
    }
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
      let done = false;
      let alive = true;
      let last = performance.now();
      this.moreEl.style.visibility = 'hidden';
      this.clearAutoTimer();

      const finish = () => {
        if (!alive) return;
        alive = false;
        this.unsub?.();
        this.unsub = null;
        this.root.onclick = null;
        this.current = null;
        this.clearAutoTimer();
        resolve();
      };

      const complete = () => {
        if (done) return;
        done = true;
        shown = text.length;
        this.bodyEl.innerHTML = esc(text);
        this.moreEl.style.visibility = '';
        if (this.auto) this.armAuto(controller);
      };

      const controller: LineController = { text, finish, complete, isComplete: () => done };
      this.current = controller;

      this.unsub = input.onAction((a) => {
        // L1 (or Q) toggles hands-free reading on/off.
        if (a === 'auto') {
          this.setAuto(!this.auto);
          return;
        }
        // Esc cancels auto mode rather than skipping the line.
        if (a === 'cancel' && this.auto) {
          this.setAuto(false);
          return;
        }
        if (a !== 'confirm' && a !== 'cancel' && a !== 'start') return;
        if (!done) complete();
        else {
          audio.sfx('blip');
          finish();
        }
      });
      // Clicking the box works too — but not when the click is the auto button.
      this.root.onclick = (e) => {
        if (e.target === this.autoBtn) return;
        if (!done) complete();
        else finish();
      };

      const tick = () => {
        if (!alive) return; // finished — let this line's loop die.
        if (done) {
          // Revealed; idle here until confirm / auto advances the line.
          requestAnimationFrame(tick);
          return;
        }
        const now = performance.now();
        const dt = (now - last) / 1000;
        last = now;
        const before = Math.floor(shown);
        shown = Math.min(text.length, shown + this.speed * dt);
        if (Math.floor(shown) !== before && Math.floor(shown) % 3 === 0) audio.sfx('blip');
        this.bodyEl.innerHTML = esc(text.slice(0, Math.floor(shown)));
        if (shown >= text.length) complete();
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  destroy() {
    this.clearAutoTimer();
    this.unsub?.();
    this.root.onclick = null;
    remove(this.root);
  }
}

/** Per-line handle the box publishes so auto/Esc can act on the live line. */
interface LineController {
  text: string;
  finish: () => void;
  complete: () => void;
  isComplete: () => boolean;
}
