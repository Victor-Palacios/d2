import './style.css';
import { HD2DRenderer } from './engine/HD2DRenderer';
import { DebugPanel } from './engine/DebugPanel';
import { SceneManager } from './engine/SceneManager';
import { input } from './engine/Input';
import { audio } from './engine/Audio';
import { IntroScene } from './scenes/IntroScene';
import { HubScene } from './scenes/HubScene';
import { WorldMapScene } from './scenes/WorldMapScene';
import { DungeonScene } from './scenes/DungeonScene';
import { BattleScene } from './scenes/BattleScene';
import { GameOverScene } from './scenes/GameOverScene';
import { toast } from './ui/Toast';
import { game } from './systems/party/gameState';
import * as saves from './systems/party/saveGame';
import { DOMAINS } from './data/domains';
import { validateDomains } from './data/validateDomains';

const canvas = document.getElementById('gl') as HTMLCanvasElement;
const ui = document.getElementById('ui') as HTMLElement;
const fade = document.getElementById('fade') as HTMLElement;

const hd2d = new HD2DRenderer(canvas);
const debug = new DebugPanel(hd2d);

const manager = new SceneManager(hd2d, ui, fade);
manager.register('intro', (ctx) => new IntroScene(ctx));
manager.register('hub', (ctx) => new HubScene(ctx));
manager.register('worldmap', (ctx) => new WorldMapScene(ctx));
manager.register('dungeon', (ctx) => new DungeonScene(ctx));
manager.register('battle', (ctx) => new BattleScene(ctx));
manager.register('gameover', (ctx) => new GameOverScene(ctx));

// Audio needs a user gesture before it can start.
const unlock = () => audio.unlock();
window.addEventListener('pointerdown', unlock, { once: true });
window.addEventListener('keydown', unlock, { once: true });

// Browsers only reveal a gamepad once the player presses something on it.
window.addEventListener('gamepadconnected', (e) => {
  const pad = (e as GamepadEvent).gamepad;
  toast(ui, `Controller connected — <span class="dim">${pad.id.slice(0, 40)}</span>`, 2400);
  audio.unlock();
});

input.onAction((a) => {
  if (a === 'debug') debug.toggle();
  if (a === 'mute') {
    const muted = audio.toggleMute();
    toast(ui, muted ? 'Audio muted' : 'Audio on', 1100);
  }
});

/** Frame counter, surfaced on `window.hd2dGame` for profiling. */
const stats = { frames: 0, fps: 0 };

// Handy for poking at a running build from the console (and for automated
// smoke tests): current scene, run state and every HD-2D parameter. `domains`
// and `validateDomains` let the terrain smoke test check every floor's data.
(window as unknown as Record<string, unknown>).hd2dGame = {
  manager,
  hd2d,
  game,
  debug,
  stats,
  saves,
  domains: DOMAINS,
  validateDomains,
};

// Fail loud in dev if a floor's data drifts out of consistency (dead chest key,
// walled-off portal, orphaned event, floating decor). Silent in a clean build.
if (import.meta.env?.DEV) {
  const problems = validateDomains();
  if (problems.length) console.error('[validateDomains]\n' + problems.join('\n'));
}

void manager.go('intro');

let last = performance.now();
let elapsed = 0;
let fpsWindowStart = last;
let fpsFrames = 0;

function frame(now: number) {
  // Clamp so a backgrounded tab does not teleport the party on return.
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  elapsed += dt;

  // Gamepads are polled, not evented — read them before scenes look at input.
  input.poll();
  manager.update(dt, elapsed);
  hd2d.render(dt);
  input.endFrame();

  stats.frames++;
  fpsFrames++;
  if (now - fpsWindowStart >= 1000) {
    stats.fps = Math.round((fpsFrames * 1000) / (now - fpsWindowStart));
    fpsWindowStart = now;
    fpsFrames = 0;
  }

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
