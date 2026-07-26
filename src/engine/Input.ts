/**
 * Keyboard input. Scenes poll `stepDirection()` for movement and subscribe
 * with `onAction()` for edge-triggered actions; `endFrame()` clears the
 * per-frame edge set.
 */

export type GameAction =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'confirm'
  | 'cancel'
  | 'debug'
  | 'mute';

const KEY_MAP: Record<string, GameAction> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  Enter: 'confirm',
  Space: 'confirm',
  KeyZ: 'confirm',
  Escape: 'cancel',
  KeyX: 'cancel',
  Backspace: 'cancel',
  Backquote: 'debug',
  KeyM: 'mute',
};

const DIRECTIONS: GameAction[] = ['up', 'down', 'left', 'right'];

export class Input {
  private down = new Set<GameAction>();
  private edge = new Set<GameAction>();
  private listeners: ((a: GameAction) => void)[] = [];
  /** Raw printable key presses, for the name-entry screen. */
  private textListeners: ((key: string) => void)[] = [];
  enabled = true;
  /**
   * While true, letter keys are delivered as text only — the name-entry screen
   * sets this so typing "WASD" spells a name instead of moving the cursor.
   */
  textMode = false;

  constructor(target: EventTarget = window) {
    target.addEventListener('keydown', (e) => this.onKey(e as KeyboardEvent, true));
    target.addEventListener('keyup', (e) => this.onKey(e as KeyboardEvent, false));
    window.addEventListener('blur', () => {
      this.down.clear();
      this.edge.clear();
    });
  }

  private onKey(e: KeyboardEvent, isDown: boolean) {
    const action = this.textMode && e.code.startsWith('Key') ? undefined : KEY_MAP[e.code];
    if (action) {
      // Arrows/space would scroll the page.
      e.preventDefault();
      if (isDown) {
        if (!e.repeat) {
          this.edge.add(action);
          if (this.enabled) for (const l of this.listeners) l(action);
        }
        this.down.add(action);
      } else {
        this.down.delete(action);
      }
    }
    if (isDown && this.enabled && e.key.length === 1) {
      for (const l of this.textListeners) l(e.key);
    }
  }

  held(a: GameAction): boolean {
    return this.enabled && this.down.has(a);
  }

  anyDirection(): GameAction | null {
    for (const a of DIRECTIONS) {
      if (this.held(a)) return a;
    }
    return null;
  }

  /**
   * The direction to step this frame: a held key for continuous movement, or a
   * key that was tapped and released between frames so quick taps still count.
   */
  stepDirection(): GameAction | null {
    const held = this.anyDirection();
    if (held) return held;
    if (!this.enabled) return null;
    for (const a of DIRECTIONS) {
      if (this.edge.has(a)) {
        this.edge.delete(a);
        return a;
      }
    }
    return null;
  }

  onAction(cb: (a: GameAction) => void): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  onText(cb: (key: string) => void): () => void {
    this.textListeners.push(cb);
    return () => {
      this.textListeners = this.textListeners.filter((l) => l !== cb);
    };
  }

  endFrame() {
    this.edge.clear();
  }
}

export const input = new Input();
