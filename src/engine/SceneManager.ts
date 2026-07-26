import type { HD2DRenderer } from './HD2DRenderer';

/**
 * Scene finite-state machine (plan §4): Intro -> Hub -> WorldMap -> Dungeon ->
 * Battle -> ... Every scene owns its own THREE.Scene (if it has one) and its
 * own DOM overlay nodes, and is fully torn down on exit.
 */

export interface SceneContext {
  hd2d: HD2DRenderer;
  /** The DOM overlay root (#ui). */
  ui: HTMLElement;
  go(name: string, params?: unknown): Promise<void>;
  /** Fades the screen to black and back around a callback. */
  transition(fn: () => Promise<void> | void, ms?: number): Promise<void>;
}

export abstract class GameScene {
  constructor(protected ctx: SceneContext) {}
  abstract enter(params?: unknown): Promise<void> | void;
  abstract exit(): Promise<void> | void;
  /** Called every frame while active. */
  update(_dt: number, _time: number): void {}
}

export type SceneFactory = (ctx: SceneContext) => GameScene;

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export class SceneManager {
  private scenes = new Map<string, SceneFactory>();
  private active: GameScene | null = null;
  private activeName = '';
  private fadeEl: HTMLElement;
  private ctx: SceneContext;
  private busy = false;

  constructor(hd2d: HD2DRenderer, ui: HTMLElement, fadeEl: HTMLElement) {
    this.fadeEl = fadeEl;
    this.ctx = {
      hd2d,
      ui,
      go: (name, params) => this.go(name, params),
      transition: (fn, ms) => this.transition(fn, ms),
    };
  }

  register(name: string, factory: SceneFactory) {
    this.scenes.set(name, factory);
  }

  get current(): string {
    return this.activeName;
  }

  /** The live scene instance — exposed for debugging and smoke tests. */
  get activeScene(): GameScene | null {
    return this.active;
  }

  private async fade(on: boolean, ms = 360) {
    this.fadeEl.classList.toggle('on', on);
    await sleep(ms);
  }

  async transition(fn: () => Promise<void> | void, ms = 360) {
    await this.fade(true, ms);
    await fn();
    await this.fade(false, ms);
  }

  async go(name: string, params?: unknown) {
    if (this.busy) return;
    const factory = this.scenes.get(name);
    if (!factory) throw new Error(`Unknown scene: ${name}`);
    this.busy = true;
    try {
      await this.fade(true);
      if (this.active) await this.active.exit();
      this.active = factory(this.ctx);
      this.activeName = name;
      await this.active.enter(params);
      await this.fade(false);
    } finally {
      this.busy = false;
    }
  }

  update(dt: number, time: number) {
    this.active?.update(dt, time);
  }
}
