import * as THREE from 'three';
import { GameScene, sleep } from '../engine/SceneManager';
import { TILE, TileGrid } from '../engine/TileGrid';
import type { Tile } from '../engine/TileGrid';
import { Billboard } from '../engine/Billboard';
import { ParticleField, Portal, Torch } from '../engine/fx';
import { input } from '../engine/Input';
import { audio } from '../engine/Audio';
import { DECOR, PROPS, VEHICLE } from '../assets/art';
import { reach } from '../data/reaches';
import type { DungeonFloor, EnemySpec, FloorEvent } from '../data/dungeon';
import { decorIsSolid } from '../data/dungeon';
import { ELEMENTS } from '../data/elements';
import type { ElementId } from '../data/elements';
import { game } from '../systems/party/gameState';
import { fullRestore } from '../systems/party/creature';
import { DungeonHUD } from '../ui/DungeonHUD';
import { DialogueBox } from '../ui/DialogueBox';
import { toast } from '../ui/Toast';
import { Menu } from '../ui/Menu';
import { openSoulMenu } from '../ui/SoulMenu';
import { el } from '../ui/dom';
import { saveSuspend } from '../systems/party/saveGame';
import { say } from '../systems/dialogue/script';
import type { BattleSceneParams } from './BattleScene';

type Facing = 'up' | 'down' | 'left' | 'right';

const STEP_TIME = 0.19;
const FUEL_PER_STEP = 1;

export interface DungeonSceneParams {
  /** Set when returning from a battle so the crawl resumes in place. */
  resume?: boolean;
  battleResult?: 'victory' | 'defeat' | 'flee';
  /** Event id that started the battle, so it can be marked done. */
  eventId?: string;
}

/**
 * The dungeon crawl (plan §2.4, M1/M3). Used by every reach, starting with the
 * Quiet Crossing.
 *
 * Tile-by-tile movement in the dig-vehicle with wall collision, chests,
 * element floor plates, a draining EP meter, descent portals and both scripted
 * and random encounters — all staged in the shared HD-2D rig.
 */
export class DungeonScene extends GameScene {
  private scene = new THREE.Scene();
  private grid!: TileGrid;
  private floor!: DungeonFloor;
  private player!: Billboard;
  private facing: Facing = 'down';
  private tileX = 0;
  private tileZ = 0;

  private moving = false;
  private moveFrom = new THREE.Vector3();
  private moveTo = new THREE.Vector3();
  private moveT = 0;
  /** Direction pressed while a step was in flight (input buffering). */
  private buffered: Facing | null = null;

  private hud!: DungeonHUD;
  private dialogue!: DialogueBox;
  private particles!: ParticleField;
  private torches: Torch[] = [];
  private portals: { portal: Portal; x: number; z: number }[] = [];
  private props = new Map<string, Billboard>();
  private decor: Billboard[] = [];
  private elementLights: THREE.PointLight[] = [];
  private elementMeshes = new Map<string, THREE.Mesh>();

  /** Blocks input while a scripted beat is running. */
  private busy = false;
  private leaving = false;
  private legend!: HTMLElement;
  private unsubInput: (() => void) | null = null;

  // -------------------------------------------------------------------------

  async enter(params?: unknown) {
    const p = (params ?? {}) as DungeonSceneParams;

    const dom = reach(game.activeReachId);
    this.floor = dom.floors[game.floorIndex];
    this.grid = new TileGrid(this.floor.rows, this.floor.theme);

    this.buildScene();
    this.buildUI();

    if (p.resume && game.crawl.initialized) {
      this.tileX = game.crawl.x;
      this.tileZ = game.crawl.z;
      this.facing = game.crawl.facing;
    } else {
      this.tileX = this.grid.start.x;
      this.tileZ = this.grid.start.z;
      this.facing = 'down';
      game.crawl.initialized = true;
    }
    this.placePlayer();
    this.updateFacingArt();
    this.saveCrawl();

    this.ctx.hd2d.setScene(this.scene);
    this.ctx.hd2d.applyFog(this.scene, this.floor.fog ?? 1, this.floor.theme.fogColor);
    this.ctx.hd2d.snapCamera();
    this.syncCamera();
    audio.music(dom.music);

    // Post-battle bookkeeping happens after the fade so the outro reads well.
    if (p.battleResult === 'victory' && p.eventId) {
      void this.afterBattle(p);
    } else if (!p.resume) {
      void this.floorIntro();
    }
  }

  private async floorIntro() {
    await sleep(250);
    toast(this.ctx.ui, `<span class="accent">${this.floor.name}</span>`, 2200);
  }

  private async afterBattle(p: DungeonSceneParams) {
    await sleep(220);
    const ev = this.floor.events[p.eventId!];
    this.busy = true;
    if (ev && (ev.kind === 'battle' || ev.kind === 'boss') && ev.outro) {
      await this.dialogue.play(ev.outro);
    }
    if (ev?.kind === 'boss') {
      // The warden's portal home only opens once it is down.
      this.spawnExitPortal();
      game.set('bossDown');
    }
    this.busy = false;
  }

  // --- world building ------------------------------------------------------

  private buildScene() {
    const built = this.grid.build();
    this.scene.add(built.group);
    this.elementMeshes = built.elementMeshes;

    this.particles = new ParticleField(500);
    this.scene.add(this.particles.points);

    // Player vehicle.
    this.player = new Billboard(VEHICLE.down, 'veh:down', { height: 1.5 });
    this.player.bob = 0.02;
    this.player.bobSpeed = 5;
    this.scene.add(this.player.object);

    // Props, portals and torches.
    this.grid.forEach((t) => {
      const key = `${t.x},${t.z}`;
      const world = this.grid.worldPos(t.x, t.z);
      if (t.kind === 'chest') {
        const opened = game.openedChests.has(`${this.floor.id}:${key}`);
        const b = new Billboard(
          opened ? PROPS.chestOpen : PROPS.chestClosed,
          opened ? 'prop:chestOpen' : 'prop:chestClosed',
          {
            height: 0.85,
            emissive: opened ? 0.5 : 0.06,
          },
        );
        b.bob = 0;
        b.object.position.copy(world);
        this.scene.add(b.object);
        this.props.set(key, b);
      } else if (t.kind === 'fuel') {
        if (game.takenPickups.has(`${this.floor.id}:${key}`)) return;
        const b = new Billboard(PROPS.fuelCan, 'prop:fuelCan', { height: 0.7, emissive: 0.25 });
        b.bob = 0.06;
        b.object.position.copy(world);
        this.scene.add(b.object);
        this.props.set(key, b);
      } else if (t.kind === 'portal') {
        const portal = new Portal(this.particles, 0x6fd3ff, false);
        portal.object.position.copy(world);
        this.scene.add(portal.object);
        this.portals.push({ portal, x: t.x, z: t.z });
      } else if (t.kind === 'exit') {
        const portal = new Portal(this.particles, 0xffd166, true);
        portal.object.position.copy(world);
        this.scene.add(portal.object);
        this.portals.push({ portal, x: t.x, z: t.z });
      }
      // Dialogue events are radio calls now — no on-screen NPC to drive into.
      // They fire when the player crosses the tile (placed at map chokepoints).
    });

    this.placeTorches();
    this.placeDecor();

    // Three roaming lights get assigned to whichever element plates are
    // nearest the party — keeps the light count (and cost) fixed.
    for (let i = 0; i < 3; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 6.5, 1.8);
      l.visible = false;
      this.scene.add(l);
      this.elementLights.push(l);
    }
  }

  /**
   * Scatters the floor's decorative billboards. Solid decor (rocks, crystals,
   * pillars, trees…) blocks its tile so the party can't walk through it; flat
   * ground detail and overhead dressing stay passable (see `decorIsSolid`). Each
   * reach's terrain gets its own silhouette without changing floor-to-floor
   * movement.
   */
  private placeDecor() {
    for (const d of this.floor.decor ?? []) {
      const art = DECOR[d.kind];
      if (!art) continue;
      const b = new Billboard(art, `decor:${d.kind}`, {
        height: d.height ?? 1.1,
        emissive: d.emissive ?? 0.1,
      });
      b.bob = 0;
      b.object.position.copy(this.grid.worldPos(d.x, d.z));
      this.scene.add(b.object);
      this.decor.push(b);
      if (decorIsSolid(d)) this.grid.blockTile(d.x, d.z);
    }
  }

  private placeTorches() {
    // Deterministic: every 5th wall-adjacent floor tile gets a torch, so lit
    // corridors read consistently between runs.
    let n = 0;
    this.grid.forEach((t) => {
      if (t.kind === 'wall' || t.kind === 'void') return;
      const wallNorth = !this.grid.walkable(t.x, t.z - 1);
      if (!wallNorth) return;
      if (n++ % 5 !== 0) return;
      const torch = new Torch(this.particles);
      const p = this.grid.worldPos(t.x, t.z);
      torch.object.position.set(p.x, 1.05, p.z - TILE * 0.42);
      this.scene.add(torch.object);
      this.torches.push(torch);
    });
  }

  /**
   * Pause menu. The suspend save exists so a crawl can be put down mid-floor;
   * it is deleted the instant it is loaded, so it is a bookmark rather than a
   * checkpoint you could farm to retry a bad fight.
   */
  private async openPauseMenu() {
    if (this.busy || this.leaving || this.moving) return;
    this.busy = true;
    audio.sfx('confirm');

    const host = el('div', 'panel');
    host.id = 'pause-menu';
    host.appendChild(el('h2', undefined, 'Paused'));
    const menu = new Menu(
      host,
      [
        { value: 'resume', label: 'Resume crawl' },
        { value: 'suspend', label: 'Suspend & quit', note: 'temp' },
      ],
      { cancellable: true },
    );
    this.ctx.ui.appendChild(host);

    const choice = await menu.open();
    menu.destroy();
    host.remove();

    if (choice === 'suspend') {
      this.leaving = true;
      const ok = saveSuspend('dungeon', this.floor.name);
      if (!ok) {
        toast(this.ctx.ui, '<span class="danger">Could not write the save.</span>', 2400);
        this.leaving = false;
        this.busy = false;
        return;
      }
      toast(this.ctx.ui, '<span class="accent">Suspended.</span> Pick Continue on the title.', 2000);
      await sleep(1200);
      await this.ctx.go('intro');
      return;
    }

    this.busy = false;
  }

  private buildUI() {
    this.hud = new DungeonHUD(this.ctx.ui);
    this.hud.setFloor(this.floor.name);
    this.hud.buildParty(game.party);
    this.hud.update(game.party);
    this.dialogue = new DialogueBox(this.ctx.ui);
    this.legend = document.createElement('div');
    this.legend.id = 'legend';
    this.legend.innerHTML = 'MOVE arrows/WASD · ESC pause &amp; suspend · E/R1 Soularium · ` debug · M mute';
    this.ctx.ui.appendChild(this.legend);

    this.unsubInput = input.onAction((a) => {
      if (a === 'cancel') void this.openPauseMenu();
      else if (a === 'menu' || a === 'start') void this.openSoulMenu();
    });
  }

  /** R1 / E: Soularium + Sanctuary mid-crawl. Blocks movement while open. */
  private async openSoulMenu() {
    if (this.busy || this.leaving || this.moving) return;
    this.busy = true;
    await openSoulMenu(this.ctx.ui);
    this.busy = false;
  }

  // --- movement ------------------------------------------------------------

  private placePlayer() {
    const p = this.grid.worldPos(this.tileX, this.tileZ);
    this.player.object.position.copy(p);
  }

  private updateFacingArt() {
    if (this.facing === 'down') this.player.setArt(VEHICLE.down, 'veh:down');
    else if (this.facing === 'up') this.player.setArt(VEHICLE.up, 'veh:up');
    else if (this.facing === 'left') this.player.setArt(VEHICLE.side, 'veh:side');
    else this.player.setArt(VEHICLE.side, 'veh:sideR', true);
  }

  private saveCrawl() {
    game.crawl.x = this.tileX;
    game.crawl.z = this.tileZ;
    game.crawl.facing = this.facing;
    game.crawl.floorIndex = game.floorIndex;
  }

  private tryStep(dir: Facing) {
    if (this.moving || this.busy || this.leaving) return;
    const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
    const nx = this.tileX + d[0];
    const nz = this.tileZ + d[1];
    if (this.facing !== dir) {
      this.facing = dir;
      this.updateFacingArt();
    }
    if (!this.grid.passable(nx, nz)) {
      audio.sfx('bump');
      return;
    }
    this.moveFrom.copy(this.player.object.position);
    this.moveTo.copy(this.grid.worldPos(nx, nz));
    this.tileX = nx;
    this.tileZ = nz;
    this.moving = true;
    this.moveT = 0;
    audio.sfx('step');

    game.fuel = Math.max(0, game.fuel - FUEL_PER_STEP);
    this.hud.update(game.party);
  }

  private finishStep() {
    this.moving = false;
    this.saveCrawl();
    const tile = this.grid.at(this.tileX, this.tileZ);
    if (!tile) return;
    void this.onTileEntered(tile);
  }

  // --- tile interactions ---------------------------------------------------

  private async onTileEntered(tile: Tile) {
    if (game.fuel <= 0) {
      await this.outOfFuel();
      return;
    }

    const key = `${tile.x},${tile.z}`;

    if (tile.kind === 'chest') {
      const id = `${this.floor.id}:${key}`;
      if (!game.openedChests.has(id)) {
        game.openedChests.add(id);
        const loot = this.floor.chests[key];
        const b = this.props.get(key);
        b?.setArt(PROPS.chestOpen, 'prop:chestOpen');
        if (b) b.mesh.material.emissiveIntensity = 0.5;
        audio.sfx('chest');
        this.particles.emit(this.grid.worldPos(tile.x, tile.z, 0.6), {
          count: 22,
          color: 0xffd166,
          speed: 2.4,
          life: 0.9,
        });
        const bits: string[] = [];
        if (loot?.credits) {
          game.credits += loot.credits;
          bits.push(`<span class="accent">+${loot.credits} credits</span>`);
        }
        if (loot?.item) {
          game.addItem(loot.item);
          bits.push('<span class="ok">+1 Repair Chip</span>');
        }
        toast(this.ctx.ui, bits.join(' &nbsp; ') || 'Empty.', 2200);
        this.hud.update(game.party);
      }
      return;
    }

    if (tile.kind === 'fuel') {
      const id = `${this.floor.id}:${key}`;
      if (!game.takenPickups.has(id)) {
        game.takenPickups.add(id);
        const b = this.props.get(key);
        if (b) {
          this.scene.remove(b.object);
          b.dispose();
          this.props.delete(key);
        }
        game.fuel = Math.min(game.maxFuel, game.fuel + 40);
        audio.sfx('pickup');
        toast(this.ctx.ui, '<span class="ok">+40 EP</span>', 1600);
        this.hud.update(game.party);
      }
      return;
    }

    if (tile.kind === 'element') {
      const mesh = this.elementMeshes.get(key);
      if (mesh) {
        this.particles.emit(this.grid.worldPos(tile.x, tile.z, 0.2), {
          count: 6,
          color: ELEMENTS[tile.element!].color,
          speed: 1,
          life: 0.7,
          gravity: 0.4,
          upBias: 0.8,
        });
      }
      // No toast spam: the plate glow and the battle HUD do the talking.
      return;
    }

    if (tile.kind === 'portal') {
      await this.descend();
      return;
    }

    if (tile.kind === 'exit') {
      await this.leaveDungeon();
      return;
    }

    if (tile.kind === 'event') {
      await this.runEvent(tile);
      return;
    }

    // Random encounters only after the tutorial fights have done their job.
    if (this.floor.encounterRate > 0 && Math.random() < this.floor.encounterRate) {
      await this.startBattle(this.rollEncounter(), false);
    }
  }

  private rollEncounter(): EnemySpec[] {
    const table = this.floor.encounters;
    const total = table.reduce((s, e) => s + e.weight, 0);
    let r = Math.random() * total;
    for (const e of table) {
      r -= e.weight;
      if (r <= 0) return e.enemies;
    }
    return table[0].enemies;
  }

  private async runEvent(tile: Tile) {
    const ev: FloorEvent | undefined = this.floor.events[tile.eventId!];
    if (!ev) return;
    const id = `${this.floor.id}:${tile.eventId}`;
    if (game.usedEvents.has(id)) return;

    if (ev.kind === 'dialogue') {
      game.usedEvents.add(id);
      this.busy = true;
      await this.dialogue.play(ev.script);
      this.busy = false;
      return;
    }

    game.usedEvents.add(id);
    this.busy = true;
    if (ev.intro) await this.dialogue.play(ev.intro);
    this.busy = false;
    await this.startBattle(ev.enemies, ev.kind === 'boss', tile.eventId);
  }

  private currentElement(): ElementId | undefined {
    return this.grid.at(this.tileX, this.tileZ)?.element;
  }

  private async startBattle(enemies: EnemySpec[], isBoss: boolean, eventId?: string) {
    if (this.leaving) return;
    this.leaving = true;
    this.saveCrawl();
    audio.sfx('encounter');
    this.ctx.hd2d.addShake(0.25);
    await sleep(520);

    const tileElement = this.currentElement();
    const params: BattleSceneParams = {
      enemies,
      isBoss,
      eventId,
      partyTiles: [tileElement, tileElement, tileElement],
      returnTo: 'dungeon',
    };
    await this.ctx.go('battle', params);
  }

  private async descend() {
    if (this.leaving) return;
    this.leaving = true;
    audio.sfx('portal');
    game.floorIndex = Math.min(reach(game.activeReachId).floors.length - 1, game.floorIndex + 1);
    game.crawl.initialized = false;
    await this.ctx.go('dungeon');
  }

  private spawnExitPortal() {
    // The portal opens a couple of tiles ahead rather than under the player's
    // own wheels, so it has to be driven into like any other portal.
    const candidates = [
      { x: this.tileX, z: this.tileZ - 2 },
      { x: this.tileX, z: this.tileZ - 1 },
      { x: this.tileX, z: this.tileZ + 2 },
      { x: this.tileX, z: this.tileZ },
    ];
    const spot = candidates.find((c) => {
      const t = this.grid.at(c.x, c.z);
      return t && t.kind !== 'wall' && t.kind !== 'void';
    })!;
    const tile = this.grid.at(spot.x, spot.z);
    if (!tile) return;
    tile.kind = 'exit';
    const portal = new Portal(this.particles, 0xffd166, true);
    portal.object.position.copy(this.grid.worldPos(tile.x, tile.z));
    this.scene.add(portal.object);
    this.portals.push({ portal, x: tile.x, z: tile.z });
    audio.sfx('portal');
    toast(this.ctx.ui, '<span class="accent">A portal home opens up the hall.</span>', 2800);
  }

  private async leaveDungeon() {
    if (this.leaving) return;
    this.leaving = true;
    audio.sfx('portal');
    const dom = reach(game.activeReachId);
    game.set(dom.onClear.flag);
    if (dom.onClear.licenseCeremony) {
      // The Quiet Crossing only: the licence + Guard-Team ceremony.
      await this.ctx.go('hub', { arrival: 'reachCleared' });
    } else {
      // Any other reach: you're back in the safe city, patched up.
      fullRestore(game.party);
      await this.ctx.go('hub');
    }
  }

  private async outOfFuel() {
    if (this.leaving) return;
    this.leaving = true;
    this.busy = true;
    await this.dialogue.play(
      say(
        'Halden',
        'Your EP hit zero. Sit tight — I am pulling the beetle back on the tow line.',
        'Nothing lost but time. Refuel and go again.',
      ),
    );
    game.resetCrawl();
    game.crawl.initialized = false;
    await this.ctx.go('hub', { arrival: 'towed' });
  }

  // --- frame ---------------------------------------------------------------

  private syncCamera() {
    const p = this.player.object.position;
    this.ctx.hd2d.cameraTarget.set(p.x, p.y, p.z);
    this.ctx.hd2d.lightTarget.set(p.x, p.y, p.z);
    this.ctx.hd2d.focusTarget.set(p.x, p.y + 0.7, p.z);
  }

  private updateElementLights() {
    const px = this.player.object.position;
    const nearby = [...this.elementMeshes.entries()]
      .map(([key, mesh]) => ({ key, mesh, d: mesh.position.distanceTo(px) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, this.elementLights.length);

    this.elementLights.forEach((light, i) => {
      const hit = nearby[i];
      if (!hit || hit.d > 9) {
        light.visible = false;
        return;
      }
      const tileKey = hit.key.split(',');
      const tile = this.grid.at(Number(tileKey[0]), Number(tileKey[1]));
      const def = tile?.element ? ELEMENTS[tile.element] : null;
      if (!def) {
        light.visible = false;
        return;
      }
      light.visible = true;
      light.color.setHex(def.light);
      light.position.set(hit.mesh.position.x, 0.85, hit.mesh.position.z);
      light.intensity = 5.5 * Math.max(0, 1 - hit.d / 9);
    });
  }

  override update(dt: number, time: number) {
    if (this.leaving) return;

    // Input buffering: a direction tapped mid-step is remembered and applied
    // when the step lands, so quick inputs are never swallowed.
    const pressed = input.stepDirection();
    if (pressed) this.buffered = pressed as Facing;
    if (this.busy || this.dialogue.visible) this.buffered = null;

    if (this.moving) {
      this.moveT += dt / STEP_TIME;
      const t = Math.min(1, this.moveT);
      // Ease-out so each tile step has a little weight.
      const e = 1 - (1 - t) ** 2.2;
      this.player.object.position.lerpVectors(this.moveFrom, this.moveTo, e);
      if (t >= 1) this.finishStep();
    } else if (!this.busy && !this.dialogue.visible && this.buffered) {
      const dir = this.buffered;
      this.buffered = null;
      this.tryStep(dir);
    }

    this.player.update(dt, this.ctx.hd2d.camera, time);
    for (const t of this.torches) t.update(dt, this.ctx.hd2d.camera, time);
    for (const p of this.portals) p.portal.update(dt, time);
    for (const b of this.props.values()) b.update(dt, this.ctx.hd2d.camera, time);
    for (const b of this.decor) b.update(dt, this.ctx.hd2d.camera, time);
    this.particles.update(dt);
    this.updateElementLights();
    this.syncCamera();
  }

  async exit() {
    this.unsubInput?.();
    this.unsubInput = null;
    this.hud.destroy();
    this.dialogue.destroy();
    this.legend.remove();
    this.player.dispose();
    for (const b of this.props.values()) b.dispose();
    for (const b of this.decor) b.dispose();
    this.particles.dispose();
    this.scene.clear();
  }
}
