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
  | 'auto'
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
  KeyQ: 'auto', // keyboard mirror of the controller's L1 auto toggle
  Backquote: 'debug',
  KeyM: 'mute',
};

const DIRECTIONS: GameAction[] = ['up', 'down', 'left', 'right'];

/**
 * Gamepad button indices in the W3C "standard" mapping, which is what an Xbox,
 * DualShock/DualSense, or Switch Pro pad reports in every current browser.
 * Anything reporting a non-standard mapping still works for the face buttons
 * and d-pad, which is all this game needs.
 */
const PAD_BUTTONS: Record<number, GameAction> = {
  0: 'confirm', // A / cross
  1: 'cancel', // B / circle
  2: 'cancel', // X / square
  3: 'confirm', // Y / triangle
  4: 'auto', // L1 / LB — toggles auto-read (dialogue) and auto-battle (combat)
  8: 'cancel', // select / share
  9: 'confirm', // start / options
  12: 'up',
  13: 'down',
  14: 'left',
  15: 'right',
};

/** Stick travel before it counts as a direction. Grid movement wants digital. */
const STICK_DEADZONE = 0.55;

export class Input {
  private down = new Set<GameAction>();
  private edge = new Set<GameAction>();
  /** Actions currently held on a gamepad, kept apart from keyboard state. */
  private padDown = new Set<GameAction>();
  /** True once any gamepad has reported input. Drives the UI hint. */
  gamepadConnected = false;
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
      this.padDown.clear();
      this.edge.clear();
    });
  }

  private onKey(e: KeyboardEvent, isDown: boolean) {
    const action = this.textMode && e.code.startsWith('Key') ? undefined : KEY_MAP[e.code];
    if (action) {
      // Arrows/space would scroll the page.
      e.preventDefault();
      if (isDown) {
        if (!e.repeat) this.fire(action);
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
    return this.enabled && (this.down.has(a) || this.padDown.has(a));
  }

  /** Raises an action as if a key had just been pressed. */
  private fire(a: GameAction) {
    this.edge.add(a);
    if (!this.enabled) return;
    // Iterate a copy: handlers routinely open a menu, which subscribes another
    // listener. Without the copy that new listener receives the very event that
    // opened it — a pause menu would cancel itself the instant Escape opened it.
    for (const l of [...this.listeners]) l(a);
  }

  /**
   * Reads every connected gamepad and turns it into the same actions the
   * keyboard produces.
   *
   * The Gamepad API has no events for button presses — it must be polled — so
   * `main.ts` calls this once per frame *before* scenes update, and edges are
   * derived by diffing against the previous poll. Because every screen in the
   * game consumes `onAction`/`stepDirection` rather than raw keys, this single
   * function is the whole of controller support: menus, dialogue, name entry
   * and grid movement all start working at once.
   *
   * Note browsers deliberately hide gamepads until the player presses a button
   * on one, so this quietly reads nothing until that happens.
   */
  poll() {
    const getPads = navigator.getGamepads?.bind(navigator);
    if (!getPads) return;

    const now = new Set<GameAction>();
    let present = false;

    for (const pad of getPads()) {
      if (!pad || !pad.connected) continue;
      present = true;

      for (const [index, action] of Object.entries(PAD_BUTTONS)) {
        if (pad.buttons[Number(index)]?.pressed) now.add(action);
      }

      // Left stick doubles as a d-pad.
      const x = pad.axes[0] ?? 0;
      const y = pad.axes[1] ?? 0;
      if (x <= -STICK_DEADZONE) now.add('left');
      else if (x >= STICK_DEADZONE) now.add('right');
      if (y <= -STICK_DEADZONE) now.add('up');
      else if (y >= STICK_DEADZONE) now.add('down');
    }

    this.gamepadConnected = present;
    for (const a of now) {
      if (!this.padDown.has(a)) this.fire(a);
    }
    this.padDown = now;
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
