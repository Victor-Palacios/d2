import { GameScene } from '../engine/SceneManager';
import { audio } from '../engine/Audio';
import { game } from '../systems/party/gameState';
import { fullRestore } from '../systems/party/creature';
import { Menu } from '../ui/Menu';
import { el, remove } from '../ui/dom';

/**
 * Defeat screen (plan M3). Losing costs the run, not the session: your souls are
 * tended, the lantern is relit, and the crawl restarts from the reach entrance.
 */
export class GameOverScene extends GameScene {
  private screen: HTMLElement | null = null;
  private menu: Menu | null = null;

  async enter() {
    // NB: `enter()` must not block on player input. `SceneManager.go()` awaits
    // it, and the manager stays busy (refusing further transitions) until it
    // resolves — so the menu runs detached.
    this.buildScreen();
    void this.run();
  }

  private buildScreen() {
    audio.music(null);
    this.screen = el('div', 'screen');
    this.screen.append(
      el('h1', 'title-main danger', 'THE LIGHT GOES OUT'),
      el('p', 'title-sub', 'Halden carried what was left of you back to The Everwake by lantern-light.'),
    );
    const host = el('div', 'panel');
    this.screen.appendChild(host);
    this.ctx.ui.appendChild(this.screen);

    this.menu = new Menu(host, [
      { value: 'retry', label: 'Relight the lantern and press on' },
      { value: 'hub', label: 'Return to The Everwake' },
    ]);
  }

  private async run() {
    if (!this.menu) return;
    const choice = await this.menu.open();
    this.menu.destroy();
    this.menu = null;

    fullRestore(game.party);
    game.resetCrawl();

    if (choice === 'retry') await this.ctx.go('dungeon');
    else await this.ctx.go('hub', { arrival: 'guttered' });
  }

  async exit() {
    this.menu?.destroy();
    remove(this.screen);
  }
}
