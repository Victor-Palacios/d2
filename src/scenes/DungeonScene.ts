import * as THREE from 'three';
import { disposeObject3D } from '../engine/dispose';
import { GameScene, sleep } from '../engine/SceneManager';
import { TILE, TileGrid } from '../engine/TileGrid';
import type { Tile } from '../engine/TileGrid';
import { Billboard } from '../engine/Billboard';
import { artAspect } from '../engine/pixel';
import { DustMotes, ParticleField, Portal, Torch, contactShadow } from '../engine/fx';
import { input } from '../engine/Input';
import { audio } from '../engine/Audio';
import { DECOR, PROPS, HUMANS } from '../assets/art';
import { reach } from '../data/reaches';
import { anchored, anchoredFlag } from '../data/anchored';
import { recruit } from '../data/recruits';
import { equipment } from '../data/equipment';
import { ITEMS } from '../data/items';
import type { DungeonFloor, EnemySpec, FloorEvent } from '../data/dungeon';
import { decorIsSolid } from '../data/dungeon';
import { ELEMENTS } from '../data/elements';
import type { ElementId } from '../data/elements';
import { game, LP_PER_BOSS } from '../systems/party/gameState';
import { fullRestore, makeCreature } from '../systems/party/creature';
import { DungeonHUD } from '../ui/DungeonHUD';
import { DialogueBox } from '../ui/DialogueBox';
import { toast } from '../ui/Toast';
import { Menu } from '../ui/Menu';
import type { MenuItem } from '../ui/Menu';
import { openSoulMenu } from '../ui/SoulMenu';
import { el, remove } from '../ui/dom';
import { saveSuspend } from '../systems/party/saveGame';
import { narrate, say } from '../systems/dialogue/script';
import type { BattleSceneParams } from './BattleScene';

type Facing = 'up' | 'down' | 'left' | 'right';

const STEP_TIME = 0.19;
const LIGHT_PER_STEP = 1;
/** Extra lantern light a hazard tile gutters on entry, beyond the per-step 1. */
const HAZARD_LP = 8;

/**
 * Flat, low ground-dressing decor scattered per terrain skin when a floor opts
 * in with `scatter`. Always placed passable (never blocks) so it can go anywhere
 * without a soft-lock — it's texture, not an obstacle.
 */
const SCATTER_KINDS: Record<string, string[]> = {
  stone: ['rubble'],
  crystal: ['iceShard'],
  crypt: ['mushroomGlow'],
  cave: ['mushroomGlow'],
  jungle: ['jungleFlower'],
  metal: ['rubble'],
};

/**
 * How each element floor plate "breathes" — a per-element emissive animation so
 * the runes read as living energy, not decals. `base` + `amp`·(slow sine on a
 * per-tile phase) gives the pulse; `flick` adds a fast second harmonic for fire
 * and machine. Purely cosmetic; feeds the bloom pass. (Static intensity was 1.6.)
 */
const ELEMENT_ANIM: Record<ElementId, { base: number; amp: number; rate: number; flick: number }> = {
  water: { base: 1.3, amp: 0.5, rate: 1.6, flick: 0 }, // slow cool swell
  fire: { base: 1.5, amp: 0.6, rate: 8.0, flick: 0.35 }, // fast hungry flicker
  nature: { base: 1.2, amp: 0.4, rate: 1.1, flick: 0 }, // gentle breathing
  machine: { base: 1.4, amp: 0.3, rate: 3.0, flick: 0.15 }, // steady hum + tick
  dark: { base: 1.1, amp: 0.6, rate: 0.7, flick: 0 }, // deep slow throb
};

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
 * Tile-by-tile movement on foot with wall collision, chests, element floor
 * plates, draining lantern-light (LP), descent portals and both scripted
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
  /** Keys in hand on this floor (picked up minus doors already spent them). */
  private keysHeld = 0;
  /** Direction pressed while a step was in flight (input buffering). */
  private buffered: Facing | null = null;

  private hud!: DungeonHUD;
  private dialogue!: DialogueBox;
  private particles!: ParticleField;
  private dust: DustMotes | null = null;
  private torches: Torch[] = [];
  private portals: { portal: Portal; x: number; z: number }[] = [];
  private props = new Map<string, Billboard>();
  private decor: Billboard[] = [];
  /** Contact-shadow decals for removable props (lightShards), keyed by tile. */
  private propShadows = new Map<string, THREE.Mesh>();
  /** The player's own contact-shadow decal, repositioned each frame. */
  private playerShadow: THREE.Mesh | null = null;
  private elementLights: THREE.PointLight[] = [];
  private elementMeshes = new Map<string, THREE.Mesh>();
  /** Toggle-wall barrier meshes, keyed by tile — visibility flips with switches. */
  private toggleMeshes = new Map<string, THREE.Mesh>();
  /** Secret-wall meshes, keyed by tile — the false wall vanishes once revealed. */
  private secretMeshes = new Map<string, THREE.Mesh>();
  /** Liquid-pool meshes, keyed by tile — their surface caustics scroll each frame. */
  private liquidMeshes = new Map<string, THREE.Mesh>();

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
    this.grid = new TileGrid(this.floor.rows, this.floor.theme, this.floor.elevation);

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
    // Toggle-wall state is transient (resets to solid on rebuild). If the player
    // suspended standing on an open barrier, re-open the group so they don't
    // resume embedded in a re-solidified wall.
    if (p.resume && this.grid.at(this.tileX, this.tileZ)?.kind === 'toggleWall') {
      this.grid.flipToggles();
      this.syncToggleMeshes();
    }
    this.placePlayer();
    this.updateFacingArt();
    this.saveCrawl();

    this.ctx.hd2d.setScene(this.scene);
    this.ctx.hd2d.applyMood(this.floor.theme);
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
      // Some of the boundary keeper's light stays in your lantern, for good —
      // once per reach (guarded so a re-cleared reach can't farm it). The gain
      // fills you now and rides on top of every reach's startingLight after.
      const lpFlag = `lpBoss:${game.activeReachId}`;
      if (!game.has(lpFlag)) {
        game.set(lpFlag);
        game.lightBonus += LP_PER_BOSS;
        game.maxLight += LP_PER_BOSS;
        game.light = game.maxLight;
        this.hud.update(game.party);
        await this.dialogue.play([
          ...narrate(
            'As the warden’s light goes out, some of it does not — it crosses the small dark between you and settles into your lantern. Your flame stands taller than it did.',
          ),
          ...(game.has('haldenGone')
            ? []
            : say(
                'Halden',
                'That is how a keeper deepens. Every boundary you satisfy leaves a little of its light in yours. You will carry more of the dark back now — carry it well.',
              )),
        ]);
        toast(this.ctx.ui, `<span class="accent">Lantern deepened · +${LP_PER_BOSS} LP</span>`, 2600);
      }
    }
    if (ev?.kind === 'anchored') {
      // Victory is the only thing that consumes an Anchored — mark it used now
      // so it will not re-trigger. Its Memento is granted once (guarded by the
      // per-reach flag), so beating it again later is fine but not farmable.
      const a = anchored(ev.id);
      game.usedEvents.add(`${this.floor.id}:${p.eventId}`);
      await this.dialogue.play(narrate(a.victory));
      const flag = anchoredFlag(a.reachId);
      if (!game.has(flag)) {
        game.set(flag);
        game.addItem(a.reward);
        toast(this.ctx.ui, `<span class="accent">${equipment(a.reward).name}</span> — kept from ${a.name}`, 2800);
      }
    }
    this.busy = false;
  }

  // --- world building ------------------------------------------------------

  private buildScene() {
    const built = this.grid.build();
    this.scene.add(built.group);
    this.elementMeshes = built.elementMeshes;
    this.toggleMeshes = built.toggleMeshes;
    this.secretMeshes = built.secretMeshes;
    this.liquidMeshes = built.liquidMeshes;

    this.particles = new ParticleField(500);
    this.scene.add(this.particles.points);

    // Ambient dust motes fill the play volume so the key light has *air* to rake
    // across. Sized to the floor's footprint and tinted from its mood (the same
    // ambient/hemisphere colour the rig uses), so each reach's haze matches its
    // atmosphere; falls back to a pale lift of the floor palette.
    const theme = this.floor.theme;
    const lo = this.grid.worldPos(0, 0);
    const hi = this.grid.worldPos(this.grid.width - 1, this.grid.depth - 1);
    const dustSrc = theme.ambientColor ?? theme.hemiSky ?? theme.floorAlt;
    const dustColor = new THREE.Color(dustSrc).lerp(new THREE.Color('#ffffff'), theme.ambientColor ? 0.25 : 0.55);
    this.dust = new DustMotes(
      {
        minX: Math.min(lo.x, hi.x) - TILE,
        maxX: Math.max(lo.x, hi.x) + TILE,
        minZ: Math.min(lo.z, hi.z) - TILE,
        maxZ: Math.max(lo.z, hi.z) + TILE,
        minY: 0.1,
        maxY: (theme.wallHeight ?? 2.6) * 0.95,
      },
      `#${dustColor.getHexString()}`,
    );
    this.scene.add(this.dust.points);

    // The player, lantern in hand, on foot.
    this.player = new Billboard(HUMANS.hero, 'player', { height: 1.7, reveal: true });
    // A calm idle breath, and a pronounced stride while walking a tile.
    this.player.bob = 0.018;
    this.player.bobSpeed = 2.4;
    this.player.walkBounce = 0.09;
    this.scene.add(this.player.object);

    // A small static decal keeps the hero planted while walking, on top of the
    // dynamic cast shadow. Repositioned to the player's x/z each frame.
    this.playerShadow = contactShadow(1.7 * artAspect(HUMANS.hero), 0.26);
    this.scene.add(this.playerShadow);

    // Props, portals and torches.
    this.grid.forEach((t) => {
      const key = `${t.x},${t.z}`;
      const world = this.grid.worldPos(t.x, t.z, this.grid.floorY(t.x, t.z));
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
        const cs = contactShadow(0.85 * artAspect(opened ? PROPS.chestOpen : PROPS.chestClosed));
        cs.position.set(world.x, world.y + 0.02, world.z);
        this.scene.add(cs);
      } else if (t.kind === 'light') {
        if (game.takenPickups.has(`${this.floor.id}:${key}`)) return;
        const b = new Billboard(PROPS.lightShard, 'prop:lightShard', { height: 0.7, emissive: 0.6 });
        b.bob = 0.06;
        b.object.position.copy(world);
        this.scene.add(b.object);
        this.props.set(key, b);
        // Tracked: the shard is removed on pickup, so its decal must go too.
        const cs = contactShadow(0.7 * artAspect(PROPS.lightShard), 0.22);
        cs.position.set(world.x, world.y + 0.02, world.z);
        this.scene.add(cs);
        this.propShadows.set(key, cs);
      } else if (t.kind === 'key') {
        if (game.takenPickups.has(`${this.floor.id}:${key}`)) return;
        const b = new Billboard(PROPS.key, 'prop:key', { height: 0.7, emissive: 0.35 });
        b.bob = 0.06;
        b.object.position.copy(world);
        this.scene.add(b.object);
        this.props.set(key, b);
        const cs = contactShadow(0.7 * artAspect(PROPS.key), 0.22);
        cs.position.set(world.x, world.y + 0.02, world.z);
        this.scene.add(cs);
        this.propShadows.set(key, cs);
      } else if (t.kind === 'door') {
        if (game.openedDoors.has(`${this.floor.id}:${key}`)) {
          this.grid.openDoor(t.x, t.z); // already unlocked on a prior visit
          return;
        }
        const b = new Billboard(PROPS.door, 'prop:door', { height: 1.7, emissive: 0.08 });
        b.bob = 0;
        b.object.position.copy(world);
        this.scene.add(b.object);
        this.props.set(key, b);
        const cs = contactShadow(1.7 * artAspect(PROPS.door), 0.28);
        cs.position.set(world.x, world.y + 0.02, world.z);
        this.scene.add(cs);
        this.propShadows.set(key, cs);
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
      // Dialogue events are voices in the lantern now — no on-screen NPC to drive into.
      // They fire when the player crosses the tile (placed at map chokepoints).
    });

    // Keys in hand = keys collected minus doors already spent them on this floor.
    // Recomputed from persisted sets, so it survives suspend/resume with no extra
    // saved field.
    let collected = 0;
    let spent = 0;
    this.grid.forEach((t) => {
      const id = `${this.floor.id}:${t.x},${t.z}`;
      if (t.kind === 'key' && game.takenPickups.has(id)) collected++;
      if (t.kind === 'door' && game.openedDoors.has(id)) spent++;
    });
    this.keysHeld = Math.max(0, collected - spent);

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
      const world = this.grid.worldPos(d.x, d.z, this.grid.floorY(d.x, d.z));
      b.object.position.copy(world);
      this.scene.add(b.object);
      this.decor.push(b);
      // Ground it: a soft contact-shadow decal footprint under the sprite. Not
      // tracked — decor is never removed mid-scene, so teardown disposes it.
      const cs = contactShadow((d.height ?? 1.1) * artAspect(art));
      cs.position.set(world.x, world.y + 0.02, world.z);
      this.scene.add(cs);
      if (decorIsSolid(d)) this.grid.blockTile(d.x, d.z);
    }
    this.scatterDecor();
  }

  /**
   * Deterministically scatter flat, passable ground-dressing across plain floor
   * tiles so rooms don't read as bare (opt-in via `floor.scatter`). Never touches
   * interactive tiles (only `kind === 'floor'`), never lands on authored decor,
   * and never blocks — the scatter is always passable, so it can't create a
   * soft-lock. Deterministic in (x,z), so it's identical every run.
   */
  private scatterDecor() {
    const s = this.floor.scatter;
    if (!s) return;
    const every = Math.max(2, typeof s === 'number' ? s : 7);
    const kinds = SCATTER_KINDS[this.floor.theme.terrain ?? 'stone'] ?? [];
    if (!kinds.length) return;
    const taken = new Set<string>((this.floor.decor ?? []).map((d) => `${d.x},${d.z}`));
    this.grid.forEach((t) => {
      if (t.kind !== 'floor') return;
      const key = `${t.x},${t.z}`;
      if (taken.has(key)) return;
      if ((t.x * 7 + t.z * 13) % every !== 0) return;
      const kind = kinds[(t.x + t.z) % kinds.length];
      const art = DECOR[kind];
      if (!art) return;
      const b = new Billboard(art, `decor:${kind}`, { height: 0.5, emissive: 0.14 });
      b.bob = 0;
      const world = this.grid.worldPos(t.x, t.z, this.grid.floorY(t.x, t.z));
      b.object.position.copy(world);
      this.scene.add(b.object);
      this.decor.push(b);
      const cs = contactShadow(0.5 * artAspect(art), 0.18);
      cs.position.set(world.x, world.y + 0.02, world.z);
      this.scene.add(cs);
      // Deliberately no blockTile: scatter is passable ground detail.
    });
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
      torch.object.position.set(p.x, 1.05 + this.grid.floorY(t.x, t.z), p.z - TILE * 0.42);
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
    const embers = game.itemCount('homingEmber');
    const options: MenuItem[] = [{ value: 'resume', label: 'Resume crawl' }];
    if (embers > 0) {
      // The Homing Ember bails you out of a crawl straight to the safety of
      // The Everwake — one is spent per use. Only offered when you hold one.
      options.push({ value: 'ember', label: `Use ${ITEMS.homingEmber.name}`, note: `x${embers}` });
    }
    options.push({ value: 'suspend', label: 'Suspend & quit', note: 'temp' });
    const menu = new Menu(host, options, { cancellable: true });
    this.ctx.ui.appendChild(host);

    const choice = await menu.open();
    menu.destroy();
    host.remove();

    if (choice === 'ember') {
      await this.useHomingEmber();
      return;
    }

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
    this.hud.buildParty(game.souls());
    this.hud.update(game.souls());
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
    const p = this.grid.worldPos(this.tileX, this.tileZ, this.grid.floorY(this.tileX, this.tileZ));
    this.player.object.position.copy(p);
  }

  private updateFacingArt() {
    // Single-pose hero: mirror when walking left, upright otherwise.
    const mirrored = this.facing === 'left';
    this.player.setArt(HUMANS.hero, mirrored ? 'playerL' : 'player', mirrored);
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
    // A locked door: spend a key to open it (then step through), or it blocks.
    if (this.grid.isDoorClosed(nx, nz)) {
      if (this.keysHeld <= 0) {
        audio.sfx('bump');
        toast(this.ctx.ui, '<span class="danger">Locked — you need a key</span>', 1400);
        return;
      }
      this.keysHeld--;
      game.openedDoors.add(`${this.floor.id}:${nx},${nz}`);
      this.grid.openDoor(nx, nz);
      this.clearProp(`${nx},${nz}`);
      audio.sfx('confirm');
      toast(this.ctx.ui, '<span class="ok">Unlocked</span>', 1200);
    }
    if (!this.grid.passable(nx, nz)) {
      audio.sfx('bump');
      return;
    }
    this.moveFrom.copy(this.player.object.position);
    this.moveTo.copy(this.grid.worldPos(nx, nz, this.grid.floorY(nx, nz)));
    this.tileX = nx;
    this.tileZ = nz;
    this.moving = true;
    this.moveT = 0;
    audio.sfx('step');

    game.light = Math.max(0, game.light - LIGHT_PER_STEP);
    this.hud.update(game.souls());
  }

  private finishStep() {
    this.moving = false;
    this.saveCrawl();
    const tile = this.grid.at(this.tileX, this.tileZ);
    if (!tile) return;
    void this.onTileEntered(tile);
  }

  // --- tile interactions ---------------------------------------------------

  /** Removes a tracked prop billboard and its contact-shadow decal at a tile. */
  private clearProp(key: string) {
    const b = this.props.get(key);
    if (b) {
      this.scene.remove(b.object);
      b.dispose();
      this.props.delete(key);
    }
    const cs = this.propShadows.get(key);
    if (cs) {
      this.scene.remove(cs);
      cs.geometry.dispose();
      (cs.material as THREE.Material).dispose();
      this.propShadows.delete(key);
    }
  }

  /** Reflects the grid's toggle-wall state onto the barrier meshes' visibility. */
  private syncToggleMeshes() {
    for (const [k, mesh] of this.toggleMeshes) {
      const [x, z] = k.split(',').map(Number);
      mesh.visible = this.grid.isToggleSolid(x, z);
    }
  }

  /** Reflects revealed secrets onto their false-wall meshes' visibility. */
  private syncSecretMeshes() {
    for (const [k, mesh] of this.secretMeshes) {
      const [x, z] = k.split(',').map(Number);
      mesh.visible = this.grid.isSecretHidden(x, z);
    }
  }

  private async onTileEntered(tile: Tile) {
    // Reaching the way home is honored even if this very step emptied the
    // lantern: arriving at the exit supersedes running out of light, so a player
    // who rolls onto the exit on their last step escapes as intended (the story
    // continues) instead of being sent back to repeat the dungeon.
    if (tile.kind === 'exit') {
      await this.leaveDungeon();
      return;
    }

    if (game.light <= 0) {
      await this.outOfLight();
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
        this.particles.emit(this.grid.worldPos(tile.x, tile.z, this.grid.floorY(tile.x, tile.z) + 0.6), {
          count: 22,
          color: 0xffd166,
          speed: 2.4,
          life: 0.9,
        });
        const bits: string[] = [];
        if (loot?.obols) {
          game.obols += loot.obols;
          bits.push(`<span class="accent">+${loot.obols} obols</span>`);
        }
        if (loot?.item) {
          game.addItem(loot.item);
          bits.push(`<span class="ok">+1 ${ITEMS[loot.item]?.name ?? 'keepsake'}</span>`);
        }
        toast(this.ctx.ui, bits.join(' &nbsp; ') || 'Empty.', 2200);
        this.hud.update(game.souls());
      }
      return;
    }

    if (tile.kind === 'light') {
      const id = `${this.floor.id}:${key}`;
      if (!game.takenPickups.has(id)) {
        game.takenPickups.add(id);
        this.clearProp(key);
        game.light = Math.min(game.maxLight, game.light + 40);
        audio.sfx('pickup');
        toast(this.ctx.ui, '<span class="ok">+40 LP</span>', 1600);
        this.hud.update(game.souls());
      }
      return;
    }

    if (tile.kind === 'key') {
      const id = `${this.floor.id}:${key}`;
      if (!game.takenPickups.has(id)) {
        game.takenPickups.add(id);
        this.clearProp(key);
        this.keysHeld++;
        audio.sfx('pickup');
        toast(this.ctx.ui, `<span class="ok">Picked up a key</span> · ${this.keysHeld} held`, 1600);
      }
      return;
    }

    if (tile.kind === 'hazard') {
      // A trap: it gutters the lantern extra on every entry (not one-time), so
      // routing around it matters. A hot red burst + hurt sfx sell the sting.
      game.light = Math.max(0, game.light - HAZARD_LP);
      audio.sfx('bump');
      this.particles.emit(this.grid.worldPos(tile.x, tile.z, this.grid.floorY(tile.x, tile.z) + 0.3), {
        count: 14,
        color: 0xff4a2a,
        speed: 2.2,
        life: 0.7,
        gravity: -3,
        upBias: 0.7,
      });
      this.ctx.hd2d.addShake(0.35);
      toast(this.ctx.ui, `<span class="danger">-${HAZARD_LP} LP</span>`, 1400);
      this.hud.update(game.souls());
      if (game.light <= 0) {
        await this.outOfLight();
        return;
      }
      return;
    }

    if (tile.kind === 'switch') {
      // Flip the floor's toggle-wall group: every '%' barrier appears/vanishes.
      this.grid.flipToggles();
      this.syncToggleMeshes();
      audio.sfx('confirm');
      this.particles.emit(this.grid.worldPos(tile.x, tile.z, this.grid.floorY(tile.x, tile.z) + 0.3), {
        count: 12,
        color: 0x7bdc8a,
        speed: 1.8,
        life: 0.7,
        gravity: -2,
        upBias: 0.8,
      });
      toast(this.ctx.ui, '<span class="accent">The mechanism grinds — barriers shift.</span>', 1600);
      return;
    }

    if (tile.kind === 'secret') {
      // Only the first step into a false wall crumbles it; after that it's just
      // open floor and re-entering does nothing.
      if (this.grid.isSecretHidden(tile.x, tile.z)) {
        this.grid.revealSecret(tile.x, tile.z);
        this.syncSecretMeshes();
        audio.sfx('chest');
        this.particles.emit(this.grid.worldPos(tile.x, tile.z, this.grid.floorY(tile.x, tile.z) + 0.5), {
          count: 20,
          color: 0xb8a888,
          speed: 2.2,
          life: 0.8,
          gravity: -6,
          spread: 1.2,
        });
        toast(this.ctx.ui, '<span class="accent">A false wall crumbles — a hidden way opens.</span>', 1800);
      }
      return;
    }

    if (tile.kind === 'element') {
      const mesh = this.elementMeshes.get(key);
      if (mesh) {
        this.particles.emit(this.grid.worldPos(tile.x, tile.z, this.grid.floorY(tile.x, tile.z) + 0.2), {
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

    // 'exit' is handled above, before the out-of-light tow, so reaching the way
    // home always counts.

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
      // A `once` announcement (a tutorial / one-time story beat) must never play
      // again once seen — not even on a later visit. `usedEvents` can't carry
      // that: it is wiped by `resetCrawl` every time you leave a dungeon, so it
      // only suppresses a repeat within a single run. Gate `once` events on a
      // persistent flag (flags survive `resetCrawl` and are saved) instead.
      if (ev.once) {
        const seen = `evseen:${id}`;
        if (game.has(seen)) return;
        game.set(seen);
      }
      game.usedEvents.add(id);
      this.busy = true;
      await this.dialogue.play(ev.script);
      this.busy = false;
      return;
    }

    if (ev.kind === 'recruit') {
      // A companion met and joined in the field. Joining persists across runs,
      // so guard on the permanent join flag (not just usedEvents, which
      // resetCrawl wipes). If already aboard — e.g. the hub fallback fired — skip.
      const r = recruit(ev.id);
      if (game.has(r.flag)) {
        game.usedEvents.add(id);
        return;
      }
      game.usedEvents.add(id);
      this.busy = true;
      await this.dialogue.play(r.script);
      game.joinCompanion(makeCreature(r.speciesId, r.level));
      game.set(r.flag);
      this.hud.buildParty(game.party);
      this.busy = false;
      toast(
        this.ctx.ui,
        `<span class="accent">${r.name} joins you — you can now field ${game.fieldCap} souls</span>`,
        3000,
      );
      return;
    }

    if (ev.kind === 'finale') {
      game.usedEvents.add(id);
      await this.runFinale(ev);
      return;
    }

    if (ev.kind === 'anchored') {
      // Deliberately do NOT mark this used: an Anchored survives defeat and
      // flight, so a lost or fled fight must leave it here to face again. Only a
      // win consumes it (see afterBattle). runEvent fires on step-arrive, not on
      // post-battle placement, so standing on the tile after a loss won't
      // re-trigger it until you step off and back on. The fight is drenched in
      // the Anchored's element (a great mass under it), passed as the field.
      const a = anchored(ev.id);
      this.busy = true;
      await this.dialogue.play(a.intro);
      this.busy = false;
      await this.startBattle(a.enemies, false, tile.eventId, a.element);
      return;
    }

    game.usedEvents.add(id);
    this.busy = true;
    if (ev.intro) await this.dialogue.play(ev.intro);
    this.busy = false;
    await this.startBattle(
      ev.enemies,
      ev.kind === 'boss',
      tile.eventId,
      undefined,
      ev.kind === 'boss' && !!ev.finalBoss,
    );
  }

  /**
   * The finale (The Last Lantern): the soul you have searched for since the
   * prologue, and the game's dramatic question made personal — keep it, or let
   * it cross. Not a fight; a choice, then the ending. Routes home to the
   * Everwake, the story complete. See docs/NARRATIVE.md §11c.
   */
  private async runFinale(ev: Extract<FloorEvent, { kind: 'finale' }>) {
    this.busy = true;
    if (ev.intro) await this.dialogue.play(ev.intro);
    await this.dialogue.play([
      ...narrate(
        'A single lantern stands at the heart of the dark, lit by no hand but the one that left it here. Inside it, a small flame — the one you have walked a whole road to find.',
      ),
      ...narrate(
        'You know this light. You have always known it. It is the soul you lost — the reason you ever took up a lantern at all.',
      ),
      ...say('Wren', `Whatever you choose, ${game.playerName}, I will write it down true.`),
      ...say('Sena Vale', 'You have seen what keeping costs now. And what letting go costs. Neither one is free.'),
      ...say('Kade', 'We are here. Whichever way, you do not do this alone.'),
    ]);

    const choice = await this.finaleChoice();
    if (choice === 'keep') {
      game.set('ending:keep');
      await this.dialogue.play([
        ...narrate(
          'You close your hands around the lantern and will it to hold. The flame steadies. It will never gutter now — and it will never cross.',
        ),
        ...narrate(
          'You have them back. You will have them forever, exactly as they are — and they will never change again, because the changing was the living.',
        ),
        ...say(
          'Sena Vale',
          'I know this love. I will sit in it with you, for as long as you need. It is warmer with two.',
        ),
        ...narrate(
          'You carry the lantern up out of the dark. You are not unfinished any longer — you are kept, the way you kept them. The Everwake has one more light that will never go out.',
        ),
      ]);
    } else {
      game.set('ending:cross');
      await this.dialogue.play([
        ...narrate(
          'You open the lantern. It is the hardest thing your hands have ever done — the exact opposite of every gesture that carried you here.',
        ),
        ...narrate(
          'The flame lifts, unhurried, the way Halden lifted. For one whole breath it is brighter than everything. Then it is gone — not lost. Home.',
        ),
        ...say(
          'Wren',
          'I am writing the name now. Not to hold them — so that the letting go was a thing that someone witnessed.',
        ),
        ...narrate(
          'The dark is only dark again. You climb toward the light with empty hands and, for the first time since you took up the lantern, a finished heart.',
        ),
      ]);
    }

    game.set('gameComplete');
    game.set(reach(game.activeReachId).onClear.flag);
    this.busy = false;
    await this.endBanner(choice);
    fullRestore(game.party);
    await this.ctx.go('hub');
  }

  /** The finale temptation: keep the soul, or let it cross. */
  private async finaleChoice(): Promise<'keep' | 'cross'> {
    const host = el('div', 'panel');
    host.style.cssText =
      'position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);min-width:360px;text-align:left;';
    host.appendChild(el('h2', undefined, 'The lantern is open in your hands.'));
    this.ctx.ui.appendChild(host);
    const menu = new Menu(host, [
      { value: 'keep', label: 'Hold them in your lantern', note: 'keep them — forever, unchanging' },
      { value: 'cross', label: 'Open your hands', note: 'let them cross — and be finished' },
    ]);
    const v = await menu.open();
    menu.destroy();
    remove(host);
    return (v ?? 'cross') as 'keep' | 'cross';
  }

  /** A closing "The End" card after the choice. */
  private async endBanner(choice: 'keep' | 'cross') {
    const host = el('div', 'panel');
    host.style.cssText =
      'position:absolute;left:50%;top:30%;transform:translate(-50%,-50%);text-align:center;max-width:560px;';
    host.innerHTML =
      '<h1 class="title-main">The End</h1>' +
      `<p class="dim">${
        choice === 'keep'
          ? 'You kept them. The light never goes out — and never rests.'
          : 'You let them cross. Your hands are empty, and your heart is finished.'
      }<br><br>Thank you for keeping the Everwake.</p>`;
    this.ctx.ui.appendChild(host);
    await sleep(4200);
    remove(host);
  }

  private currentElement(): ElementId | undefined {
    return this.grid.at(this.tileX, this.tileZ)?.element;
  }

  private async startBattle(
    enemies: EnemySpec[],
    isBoss: boolean,
    eventId?: string,
    fieldElement?: ElementId,
    finalBoss = false,
  ) {
    if (this.leaving) return;
    this.leaving = true;
    this.saveCrawl();
    audio.sfx('encounter');
    this.ctx.hd2d.addShake(0.25);
    await sleep(520);

    // An Anchored drenches the whole field in its element (it sits on a great
    // element mass), so pass that through; otherwise the field is whatever plate
    // the party is standing on.
    const tileElement = fieldElement ?? this.currentElement();
    const params: BattleSceneParams = {
      enemies,
      isBoss,
      finalBoss,
      eventId,
      partyTiles: [tileElement, tileElement, tileElement],
      // Tint the whole arena when the ground is elemental (see BattleScene).
      fieldElement: tileElement,
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
    portal.object.position.copy(this.grid.worldPos(tile.x, tile.z, this.grid.floorY(tile.x, tile.z)));
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
    if (dom.onClear.leaveCeremony) {
      // The Quiet Crossing only: the Vigil's-leave ceremony.
      await this.ctx.go('hub', { arrival: 'reachCleared' });
    } else {
      // Any other reach: you're back in the safe city, patched up.
      fullRestore(game.party);
      await this.ctx.go('hub');
    }
  }

  /**
   * The Homing Ember (an escape item): flare it mid-crawl to fold straight back
   * to the safety of The Everwake. Spends one Ember and drops the reach — you do
   * NOT clear it, so re-entering starts the crawl fresh — but your haul (obols,
   * items, captured souls) is kept. Unlike a guttered lantern there's no penalty
   * beyond the Ember itself.
   */
  private async useHomingEmber() {
    if (this.leaving) return;
    this.leaving = true;
    game.takeItem('homingEmber');
    audio.sfx('portal');
    this.ctx.hd2d.addShake(0.2);
    toast(this.ctx.ui, '<span class="accent">The Homing Ember flares — the dark folds you home.</span>', 2400);
    await sleep(900);
    // resetCrawl refills light and rewinds to the first floor without touching
    // your haul, so the reach is simply un-entered rather than cleared.
    game.resetCrawl();
    await this.ctx.go('hub');
  }

  private async outOfLight() {
    if (this.leaving) return;
    this.leaving = true;
    this.busy = true;
    // Halden dies at the midpoint, but the Last Lantern (only reachable after) can
    // gutter you out too — so once he is gone, Wren walks you home by the Book's
    // light instead. Without this he would speak from beyond the grave.
    await this.dialogue.play(
      game.has('haldenGone')
        ? say(
            'Wren',
            'Your lantern guttered out. We have you — I am walking you back by the light of the Book.',
            'Nothing lost but time. Gather more light and go again.',
          )
        : say(
            'Halden',
            'Your lantern guttered out. Sit tight — I am walking you back by the last of mine.',
            'Nothing lost but time. Gather more light and go again.',
          ),
    );
    game.resetCrawl();
    game.crawl.initialized = false;
    await this.ctx.go('hub', { arrival: 'guttered' });
  }

  // --- frame ---------------------------------------------------------------

  private syncCamera() {
    const p = this.player.object.position;
    this.ctx.hd2d.cameraTarget.set(p.x, p.y, p.z);
    this.ctx.hd2d.lightTarget.set(p.x, p.y, p.z);
    this.ctx.hd2d.focusTarget.set(p.x, p.y + 0.7, p.z);
  }

  /**
   * Breathes every element plate's emissive glow on a per-element rhythm and a
   * stable per-tile phase, so a room of runes shimmers out of sync instead of
   * pulsing in lockstep. Cheap: a handful of meshes, one material write each.
   */
  private animateElementPlates(time: number) {
    for (const [key, mesh] of this.elementMeshes) {
      const [x, z] = key.split(',').map(Number);
      const el = this.grid.at(x, z)?.element;
      if (!el) continue;
      const a = ELEMENT_ANIM[el];
      const phase = x * 1.3 + z * 2.7; // deterministic, decorrelates neighbours
      let v = a.base + a.amp * (0.5 + 0.5 * Math.sin(time * a.rate + phase));
      if (a.flick) v += a.flick * Math.sin(time * 23.3 + phase * 2);
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = Math.max(0.2, v);
    }
  }

  /**
   * Flows the liquid pools: scrolls the shared caustic emissive map (so the
   * light on the water drifts) and breathes its intensity. All pools on a floor
   * share one material, so this is a single texture-offset write per frame.
   */
  private animateLiquid(dt: number, time: number) {
    const first = this.liquidMeshes.values().next().value as THREE.Mesh | undefined;
    if (!first) return;
    const mat = first.material as THREE.MeshStandardMaterial;
    const caustic = mat.emissiveMap;
    if (caustic) {
      // Offset is a shader uniform — scrolling it needs no texture re-upload.
      caustic.offset.x = (caustic.offset.x + dt * 0.035) % 1;
      caustic.offset.y = (caustic.offset.y + dt * 0.02) % 1;
    }
    mat.emissiveIntensity = 0.65 + 0.3 * (0.5 + 0.5 * Math.sin(time * 1.4));
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
      // Linear progress (not the eased position) drives an even footfall cadence.
      this.player.setStride(t);
      if (t >= 1) this.finishStep();
    } else if (!this.busy && !this.dialogue.visible && this.buffered) {
      const dir = this.buffered;
      this.buffered = null;
      this.tryStep(dir);
    }
    if (!this.moving) this.player.setStride(-1);

    this.player.update(dt, this.ctx.hd2d.camera, time);
    if (this.playerShadow) {
      // Track x/z only — keep it flat on the floor, ignoring the walk-bob.
      this.playerShadow.position.x = this.player.object.position.x;
      this.playerShadow.position.y = this.player.object.position.y + 0.02;
      this.playerShadow.position.z = this.player.object.position.z;
    }
    for (const t of this.torches) t.update(dt, this.ctx.hd2d.camera, time);
    for (const p of this.portals) p.portal.update(dt, time);
    for (const b of this.props.values()) b.update(dt, this.ctx.hd2d.camera, time);
    for (const b of this.decor) b.update(dt, this.ctx.hd2d.camera, time);
    this.particles.update(dt);
    this.dust?.update(dt, time);
    this.animateElementPlates(time);
    this.animateLiquid(dt, time);
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
    this.dust?.dispose();
    this.dust = null;
    // Contact-shadow decals are plain scene children; disposeObject3D frees
    // their geometry+material (the shared radial texture is intentionally kept).
    this.propShadows.clear();
    this.playerShadow = null;
    disposeObject3D(this.scene);
    this.scene.clear();
  }
}
