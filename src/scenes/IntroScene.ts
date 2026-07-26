import * as THREE from 'three';
import { GameScene, sleep } from '../engine/SceneManager';
import type { SceneContext } from '../engine/SceneManager';
import { Billboard } from '../engine/Billboard';
import { ParticleField, Torch } from '../engine/fx';
import { floorTexture, wallTexture } from '../engine/pixel';
import { HUMANS, VEHICLE } from '../assets/art';
import { audio } from '../engine/Audio';
import { input } from '../engine/Input';
import { game } from '../systems/party/gameState';
import { el, remove } from '../ui/dom';
import { Menu } from '../ui/Menu';
import type { MenuItem } from '../ui/Menu';
import { applySave, bestSave, clearSuspend, describeSave } from '../systems/party/saveGame';
import { NameEntry } from '../ui/NameEntry';
import { DialogueBox } from '../ui/DialogueBox';
import { narrate, say } from '../systems/dialogue/script';

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

  constructor(ctx: SceneContext) {
    super(ctx);
  }

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

    const vehicle = new Billboard(VEHICLE.down, 'veh:down', { height: 1.6 });
    vehicle.object.position.set(0.9, 0, 0.5);
    this.scene.add(vehicle.object);
    this.billboards.push(vehicle);

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
    stack.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:14px;';
    stack.append(
      el('h1', 'title-main', 'BOOT DOMAIN'),
      el('p', 'title-sub', 'a first-hour HD-2D vertical slice'),
      el(
        'div',
        'hint dim',
        'All names, sprites and audio are original placeholders. Click once to enable sound.',
      ),
    );
    this.screen.appendChild(stack);
    this.ctx.ui.appendChild(this.screen);

    // Any input unlocks audio; the menu itself drives the rest.
    this.unsub = input.onAction(() => audio.unlock());
    this.screen.addEventListener('click', () => audio.unlock());
    audio.music('hub');

    void this.titleMenu(stack);
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
        'Digital City. Ground level, licence office, 07:40.',
        'The domains outside the city are open code — and something in them has started biting back.',
      ),
      ...say(
        'Dr. Halden',
        `You must be ${name}. Good. Sit down, sign nothing yet.`,
        'The Guard needs drivers. Drivers need a licence, and a licence needs one clean run through the Boot Domain.',
        'I will lend you three of mine for the trip. Try to bring them back.',
      ),
    ]);

    game.lendTutorialParty();
    game.set('prologueDone');
    await this.ctx.go('hub', { arrival: 'first' });
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
