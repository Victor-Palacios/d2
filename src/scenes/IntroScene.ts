import * as THREE from 'three';
import { GameScene, sleep } from '../engine/SceneManager';
import { Billboard } from '../engine/Billboard';
import { ParticleField, Torch } from '../engine/fx';
import { floorTexture, wallTexture } from '../engine/pixel';
import { HUMANS } from '../assets/art';
import { audio } from '../engine/Audio';
import { input } from '../engine/Input';
import { game } from '../systems/party/gameState';
import { makeCreature } from '../systems/party/creature';
import { species, speciesArt } from '../data/creatures';
import { ATTRIBUTES, ELEMENTS } from '../data/elements';
import { el, esc, remove } from '../ui/dom';
import { Menu } from '../ui/Menu';
import type { MenuItem } from '../ui/Menu';
import { CardSelect } from '../ui/CardSelect';
import type { Card } from '../ui/CardSelect';
import { applySave, bestSave, clearSuspend, describeSave } from '../systems/party/saveGame';
import { NameEntry } from '../ui/NameEntry';
import { DialogueBox } from '../ui/DialogueBox';
import { narrate, say } from '../systems/dialogue/script';

/** The three partner monsters offered at the start — one per class. */
const PARTNER_CHOICES = ['emberling', 'glidefang', 'nightnip'];
/** Level a starting partner begins at. */
const PARTNER_LEVEL = 1;

/**
 * Title + name entry (plan §2.1, M4).
 *
 * The title sits over a live HD-2D diorama rather than a flat image, so the
 * look is established before the player presses a single key.
 */
export class IntroScene extends GameScene {
  private scene = new THREE.Scene();
  private billboards: Billboard[] = [];
  private torches: Torch[] = [];
  private particles!: ParticleField;
  private screen: HTMLElement | null = null;
  private nameEntry: NameEntry | null = null;
  private dialogue!: DialogueBox;
  private unsub: (() => void) | null = null;

  async enter() {
    this.buildDiorama();
    this.dialogue = new DialogueBox(this.ctx.ui);

    this.ctx.hd2d.setScene(this.scene);
    this.ctx.hd2d.applyFog(this.scene, 1.4);
    this.ctx.hd2d.cameraTarget.set(0, 0, 0);
    this.ctx.hd2d.lightTarget.set(0, 0, 1);
    this.ctx.hd2d.focusTarget.set(0, 0.8, 0);
    this.ctx.hd2d.snapCamera();

    this.showTitle();
  }

  private buildDiorama() {
    this.particles = new ParticleField(300);
    this.scene.add(this.particles.points);

    const floorGeo = new THREE.PlaneGeometry(2, 2);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTexture('intro', '#3a3f57', 3),
      roughness: 0.92,
    });
    for (let x = -3; x <= 3; x++) {
      for (let z = -3; z <= 3; z++) {
        const m = new THREE.Mesh(floorGeo, floorMat);
        m.position.set(x * 2, 0, z * 2);
        m.receiveShadow = true;
        this.scene.add(m);
      }
    }

    const wallMat = new THREE.MeshStandardMaterial({
      map: wallTexture('intro', '#4a4560', 9),
      roughness: 0.95,
    });
    const wallGeo = new THREE.BoxGeometry(2, 2.6, 2);
    for (let x = -3; x <= 3; x++) {
      const m = new THREE.Mesh(wallGeo, wallMat);
      m.position.set(x * 2, 1.25, -8);
      m.castShadow = true;
      m.receiveShadow = true;
      this.scene.add(m);
    }

    const mentor = new Billboard(HUMANS.mentor, 'human:mentor', { height: 1.7 });
    mentor.object.position.set(-1.9, 0, -0.4);
    this.scene.add(mentor.object);
    this.billboards.push(mentor);

    for (const x of [-4, 4]) {
      const torch = new Torch(this.particles);
      torch.object.position.set(x, 1.3, -5.6);
      this.scene.add(torch.object);
      this.torches.push(torch);
    }
  }

  private showTitle() {
    this.screen = el('div', 'screen transparent');
    const stack = el('div');
    stack.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:16px;';
    stack.append(
      el('h1', 'title-main title-game', 'LOST SOULS'),
      el('p', 'title-sub', 'A keeper and the souls that lingered'),
    );
    this.screen.appendChild(stack);
    this.screen.appendChild(
      el(
        'div',
        'hint dim title-note',
        'All names, sprites and audio are original placeholders. Press any button to begin.',
      ),
    );
    this.ctx.ui.appendChild(this.screen);

    audio.music('hub');
    void this.titleFlow(stack);
  }

  /**
   * Digimon-World-2-style title: the game name fills the screen and waits for
   * any button; only then does the Continue / New Game menu appear. Kept
   * detached because it awaits player input — a scene's `enter()` must never
   * block on the player (see HANDOFF §6).
   */
  private async titleFlow(stack: HTMLElement) {
    if (this.disposed) return;
    const prompt = el('div', 'title-press', 'PRESS ANY BUTTON');
    stack.appendChild(prompt);

    await this.waitForAnyButton();
    if (this.disposed) return;
    audio.unlock();
    audio.sfx('confirm');
    remove(prompt);

    await this.titleMenu(stack);
  }

  /**
   * Resolves on the first mapped action (key or pad) or a click on the title.
   * The listener iterates a copy inside `input.fire`, and the menu opened next
   * subscribes afterwards, so the revealing press is never also consumed as a
   * menu selection (HANDOFF §6, invariant 3).
   */
  private waitForAnyButton(): Promise<void> {
    return new Promise((resolve) => {
      const finish = () => {
        this.unsub?.();
        this.unsub = null;
        this.screen?.removeEventListener('click', onClick);
        resolve();
      };
      const onClick = () => {
        audio.unlock();
        finish();
      };
      this.unsub = input.onAction(() => {
        audio.unlock();
        finish();
      });
      this.screen?.addEventListener('click', onClick);
    });
  }

  private async titleMenu(stack: HTMLElement) {
    if (this.disposed) return;
    const save = bestSave();
    const host = el('div', 'panel');
    host.style.minWidth = '260px';
    stack.appendChild(host);

    const items: MenuItem[] = [{ value: 'new', label: 'New Game' }];
    if (save) {
      items.unshift({
        value: 'continue',
        label: save.kind === 'suspend' ? 'Continue (suspended)' : 'Continue',
        note: describeSave(save),
      });
    }

    const menu = new Menu(host, items);
    const choice = await menu.open();
    menu.destroy();
    if (this.disposed) return;
    this.unsub?.();
    this.unsub = null;

    if (choice === 'continue' && save) {
      audio.unlock();
      // Loading a suspend save consumes it — see saveGame.ts.
      applySave(save);
      await this.ctx.go(save.scene, save.scene === 'dungeon' ? { resume: true } : undefined);
      return;
    }

    audio.unlock();
    // A fresh run must not leave a stale bookmark behind.
    clearSuspend();
    void this.beginNameEntry();
  }

  private async beginNameEntry() {
    if (this.disposed) return;
    remove(this.screen);
    this.screen = null;
    this.nameEntry = new NameEntry(this.ctx.ui, game.playerName);
    const name = await this.nameEntry.open();
    this.nameEntry.destroy();
    this.nameEntry = null;
    if (this.disposed) return;
    game.playerName = name;

    await sleep(200);
    await this.dialogue.play([
      ...narrate(
        'The Everwake: a house of lanterns that never goes dark, kept for the souls who cannot yet cross.',
        'You came here certain you understood loss. You have carried it a long way. You are about to learn how little you have actually held.',
      ),
      ...say(
        'Halden',
        `You must be ${name}. Come in out of the dark. Warm your hands.`,
        'We are keepers, you and I. The reaches beyond the Everwake are thick with souls that lingered — grief made them stay, or being forgotten. Someone has to tend them.',
        'Every keeper carries a lantern, and bonds one soul to ride in it. It answers for you in the dark; you decide how.',
      ),
      ...say(
        'Halden',
        'And I know why you really took the lantern. You are looking for someone. Keepers always are, at first.',
      ),
    ]);

    await this.partnerSelect();

    game.set('prologueDone');
    await this.ctx.go('hub', { arrival: 'first' });
  }

  /** Choose the starting partner monster — one per class. Sets the party. */
  private async partnerSelect() {
    if (this.disposed) return;
    const cards: Card[] = PARTNER_CHOICES.map((id) => {
      const s = species(id);
      const attr = ATTRIBUTES[s.attribute];
      const elem = ELEMENTS[s.element];
      return {
        value: id,
        title: s.name,
        tag: `${attr.name} · ${elem.name}`,
        tagColor: attr.color,
        body: `<em>${esc(s.blurb)}</em><br><br><span class="dim">${attr.blurb}</span>`,
        art: speciesArt(id),
        artScale: 4,
      };
    });
    const select = new CardSelect(this.ctx.ui, cards, {
      heading: 'BOND A SOUL',
      subheading: 'The first to ride your lantern',
    });
    const choice = (await select.open()) ?? PARTNER_CHOICES[0];
    select.destroy();
    if (this.disposed) return;

    const s = species(choice);
    game.party = [makeCreature(choice, PARTNER_LEVEL)];
    game.teamAttribute = s.attribute;

    // A keeper's kit: the dead leave things behind, and a keeper carries them.
    game.addItem('cinderEdge');
    game.addItem('paleShroud');
    game.addItem('quickLocket');

    await this.dialogue.play([
      ...say(
        'Halden',
        `${s.name}. It chose you as much as you chose it. Keep it well — a bonded soul does not fade while it rides with you.`,
      ),
      ...narrate(`${s.name} settles into your lantern.`),
      ...say(
        'Halden',
        'Take these, too. A blade, a shroud, a locket — what the dead leave behind. Fit them to your souls from the menu. Small comforts, but the dark is long.',
      ),
    ]);
  }

  override update(dt: number, time: number) {
    for (const b of this.billboards) b.update(dt, this.ctx.hd2d.camera, time);
    for (const t of this.torches) t.update(dt, this.ctx.hd2d.camera, time);
    this.particles.update(dt);
    // Slow push-in keeps the title screen alive.
    this.ctx.hd2d.cameraTarget.set(Math.sin(time * 0.14) * 0.6, 0, 0);
  }

  async exit() {
    this.unsub?.();
    this.nameEntry?.destroy();
    remove(this.screen);
    this.dialogue.destroy();
    for (const b of this.billboards) b.dispose();
    this.particles.dispose();
    this.scene.clear();
  }
}
