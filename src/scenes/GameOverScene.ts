import { GameScene } from '../engine/SceneManager';
import type { SceneContext } from '../engine/SceneManager';
import { audio } from '../engine/Audio';
import { game } from '../systems/party/gameState';
import { fullRestore } from '../systems/party/creature';
import { Menu } from '../ui/Menu';
import { el, remove } from '../ui/dom';

/**
 * Defeat screen (plan M3). Losing costs the run, not the session: the party is
 * repaired and the crawl restarts from the domain entrance.
 */
export class GameOverScene extends GameScene {
  private screen: HTMLElement | null = null;
  private menu: Menu | null = null;

  constructor(ctx: SceneContext) {
    super(ctx);
  }

  async enter() {
    audio.music(null);
    this.screen = el('div', 'screen');
    this.screen.append(
      el('h1', 'title-main danger', 'BEETLE DOWN'),
      el(
        'p',
        'title-sub',
        'The tow line pulled what was left of you back to Digital City.',
      ),
    );
    const host = el('div', 'panel');
    this.screen.appendChild(host);
    this.ctx.ui.appendChild(this.screen);

    this.menu = new Menu(host, [
      { value: 'retry', label: 'Repair and try again' },
      { value: 'hub', label: 'Return to Digital City' },
    ]);
    const choice = await this.menu.open();
    this.menu.destroy();
    this.menu = null;

    fullRestore(game.party);
    game.resetCrawl();

    if (choice === 'retry') await this.ctx.go('dungeon');
    else await this.ctx.go('hub', { arrival: 'towed' });
  }

  async exit() {
    this.menu?.destroy();
    remove(this.screen);
  }
}
