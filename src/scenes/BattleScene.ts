import * as THREE from 'three';
import { GameScene, sleep } from '../engine/SceneManager';
import type { SceneContext } from '../engine/SceneManager';
import { Billboard } from '../engine/Billboard';
import { ParticleField, Torch } from '../engine/fx';
import { audio } from '../engine/Audio';
import { input } from '../engine/Input';
import { elementGlowTexture, elementTileTexture, floorTexture, wallTexture } from '../engine/pixel';
import { speciesArt, species } from '../data/creatures';
import { ELEMENTS } from '../data/elements';
import type { ElementId } from '../data/elements';
import type { EnemySpec } from '../data/bootDomain';
import { technique } from '../data/techniques';
import { Battle } from '../systems/battle/engine';
import type { BattleAction, Battler, TurnResult } from '../systems/battle/engine';
import { makeCreature, isUp, reviveFainted } from '../systems/party/creature';
import type { CreatureInstance } from '../systems/party/creature';
import { game } from '../systems/party/gameState';
import { BattleHUD } from '../ui/BattleHUD';
import { DialogueBox } from '../ui/DialogueBox';
import { toast } from '../ui/Toast';
import type { DialogueScript } from '../systems/dialogue/script';
import type { DungeonSceneParams } from './DungeonScene';

export interface BattleSceneParams {
  enemies: EnemySpec[];
  isBoss?: boolean;
  eventId?: string;
  partyTiles?: (ElementId | undefined)[];
  enemyTiles?: (ElementId | undefined)[];
  intro?: DialogueScript;
  /** Scene to return to on victory. */
  returnTo: string;
}

const SLOT_X = [-2.4, 0, 2.4];
const PARTY_Z = 2.2;
const ENEMY_Z = -3;
/**
 * The camera looks slightly past the party so the near row sits above the
 * bottom-left HUD panels instead of behind them.
 */
const CAMERA_BIAS_Z = 0.9;

/**
 * Depth of a slot. The outer slots are staggered so overlapping billboards
 * still separate visually.
 */
function slotZ(side: 'party' | 'enemy', slot: number): number {
  const base = side === 'party' ? PARTY_Z : ENEMY_Z;
  return base + (slot - 1) * (side === 'party' ? 0.55 : -0.55);
}

/**
 * Turn-based 3v3 battle (plan §5.3, M2).
 *
 * Uses the same HD2DRenderer rig as the crawl: a small 3D arena, billboard
 * fighters, the warm point light casting real shadows, and the full post stack.
 */
export class BattleScene extends GameScene {
  private scene = new THREE.Scene();
  private battle!: Battle;
  private params!: BattleSceneParams;
  private hud!: BattleHUD;
  private dialogue!: DialogueBox;
  private particles!: ParticleField;
  private torches: Torch[] = [];
  private sprites = new Map<string, Billboard>();
  private homePos = new Map<string, THREE.Vector3>();
  private highlight: THREE.PointLight | null = null;
  private finished = false;
  /** Auto-battle: party members take the basic Attack until the player cancels. */
  private autoBattle = false;
  private unsubInput: (() => void) | null = null;

  constructor(ctx: SceneContext) {
    super(ctx);
  }

  async enter(params?: unknown) {
    this.params = params as BattleSceneParams;

    const enemies = this.makeEnemies(this.params.enemies);
    this.battle = new Battle({
      party: game.party,
      enemies,
      partyTiles: this.params.partyTiles,
      enemyTiles: this.params.enemyTiles,
      isBoss: this.params.isBoss,
    });

    // Encountering a wild species primes its Soul Syphon (before the HUD builds
    // so the meter already reads its primed value).
    for (const b of this.battle.side('enemy')) game.noteEncounter(b.creature.speciesId);

    this.buildArena();
    this.buildFighters();

    this.hud = new BattleHUD(this.ctx.ui);
    this.hud.build(this.battle);
    this.dialogue = new DialogueBox(this.ctx.ui);

    this.ctx.hd2d.setScene(this.scene);
    this.ctx.hd2d.applyFog(this.scene, 1.6);
    this.ctx.hd2d.cameraTarget.set(0, 0, CAMERA_BIAS_Z);
    this.ctx.hd2d.lightTarget.set(0, 0, 0.5);
    this.ctx.hd2d.focusTarget.set(0, 0.9, 0.4);
    this.ctx.hd2d.snapCamera();

    audio.music(this.params.isBoss ? 'boss' : 'battle');

    // Escape / L1 drops out of auto-battle. Registered scene-wide rather than on
    // the menu, because while auto is running no menu is open to receive the key.
    // (L1 *starts* auto via the action menu's 'auto' item; here it stops it.)
    this.unsubInput = input.onAction((a) => {
      if ((a === 'cancel' || a === 'auto') && this.autoBattle) this.setAuto(false);
    });

    void this.run();
  }

  // --- setup ---------------------------------------------------------------

  private makeEnemies(specs: EnemySpec[]): CreatureInstance[] {
    const counts = new Map<string, number>();
    for (const s of specs) counts.set(s.species, (counts.get(s.species) ?? 0) + 1);
    const seen = new Map<string, number>();
    return specs.map((s) => {
      const c = makeCreature(s.species, s.level);
      if ((counts.get(s.species) ?? 0) > 1) {
        const n = (seen.get(s.species) ?? 0) + 1;
        seen.set(s.species, n);
        c.name = `${c.name} ${String.fromCharCode(64 + n)}`;
      }
      return c;
    });
  }

  private buildArena() {
    this.particles = new ParticleField(600);
    this.scene.add(this.particles.points);

    const floorGeo = new THREE.PlaneGeometry(2, 2);
    floorGeo.rotateX(-Math.PI / 2);
    const matA = new THREE.MeshStandardMaterial({
      map: floorTexture('arenaA', '#3d3550', 5),
      roughness: 0.9,
    });
    const matB = new THREE.MeshStandardMaterial({
      map: floorTexture('arenaB', '#332c46', 11),
      roughness: 0.9,
    });

    // A 9x9 tile pad — real geometry, so the shadows have something to land on.
    const half = 4;
    const positions: THREE.Vector3[] = [];
    for (let x = -half; x <= half; x++) {
      for (let z = -half; z <= half; z++) {
        // Round the corners for an arena-like footprint.
        if (Math.hypot(x, z) > half + 0.6) continue;
        positions.push(new THREE.Vector3(x * 2, 0, z * 2));
      }
    }
    const buildInst = (list: THREE.Vector3[], mat: THREE.Material) => {
      const inst = new THREE.InstancedMesh(floorGeo, mat, list.length);
      inst.receiveShadow = true;
      const m = new THREE.Matrix4();
      list.forEach((p, i) => {
        m.makeTranslation(p.x, 0, p.z);
        inst.setMatrixAt(i, m);
      });
      inst.instanceMatrix.needsUpdate = true;
      this.scene.add(inst);
    };
    buildInst(positions.filter((p) => ((p.x / 2 + p.z / 2) & 1) === 0), matA);
    buildInst(positions.filter((p) => ((p.x / 2 + p.z / 2) & 1) !== 0), matB);

    // A low perimeter wall gives the arena depth and catches the key light.
    const wallMat = new THREE.MeshStandardMaterial({
      map: wallTexture('arena', '#463a5c', 23),
      roughness: 0.95,
    });
    const wallGeo = new THREE.BoxGeometry(2, 2.2, 2);
    const ring: THREE.Vector3[] = [];
    for (let x = -half - 1; x <= half + 1; x++) {
      for (let z = -half - 1; z <= half + 1; z++) {
        const d = Math.hypot(x, z);
        if (d > half + 0.6 && d < half + 2.2) ring.push(new THREE.Vector3(x * 2, 1.05, z * 2));
      }
    }
    const wallInst = new THREE.InstancedMesh(wallGeo, wallMat, ring.length);
    wallInst.castShadow = true;
    wallInst.receiveShadow = true;
    const m = new THREE.Matrix4();
    ring.forEach((p, i) => {
      m.makeTranslation(p.x, p.y, p.z);
      wallInst.setMatrixAt(i, m);
    });
    wallInst.instanceMatrix.needsUpdate = true;
    this.scene.add(wallInst);

    // Element plates go under the slots that carry a tile buff, using the same
    // staggered positions as the fighters so a plate is always underfoot.
    const plate = (x: number, z: number, element: ElementId) => {
      const def = ELEMENTS[element];
      const geo = new THREE.PlaneGeometry(2, 2);
      geo.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshStandardMaterial({
        map: elementTileTexture(element, '#332c46', def.color),
        emissiveMap: elementGlowTexture(element, def.color),
        emissive: new THREE.Color(def.color),
        emissiveIntensity: 1.3,
        roughness: 0.6,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, 0.012, z);
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      // Kept dim and low: an accent light feeding the bloom, not a second key.
      // Any brighter and it bleaches the sprite standing on top of it.
      const light = new THREE.PointLight(def.light, 0.85, 4, 1.6);
      light.position.set(x, 0.28, z);
      this.scene.add(light);
    };
    for (const b of this.battle.battlers) {
      if (b.tile) plate(SLOT_X[b.slot], slotZ(b.side, b.slot), b.tile);
    }

    // Two torches frame the arena and feed the bloom.
    for (const x of [-7, 7]) {
      const torch = new Torch(this.particles);
      torch.object.position.set(x, 1.4, -5);
      this.scene.add(torch.object);
      this.torches.push(torch);
    }

    this.highlight = new THREE.PointLight(0xffe6a8, 0, 4.5, 2);
    this.scene.add(this.highlight);
  }

  private buildFighters() {
    for (const b of this.battle.battlers) {
      const sp = species(b.creature.speciesId);
      const art = speciesArt(b.creature.speciesId);
      const bb = new Billboard(art, `species:${sp.id}`, {
        height: sp.height,
        hover: sp.hover ?? 0,
        emissive: 0.08,
      });
      const pos = new THREE.Vector3(SLOT_X[b.slot], 0, slotZ(b.side, b.slot));
      bb.object.position.copy(pos);
      this.homePos.set(b.creature.uid, pos.clone());
      this.scene.add(bb.object);
      this.sprites.set(b.creature.uid, bb);
      if (!isUp(b.creature)) {
        bb.setOpacity(0.28);
        bb.mesh.rotation.z = Math.PI * 0.12;
      }
    }
  }

  // --- battle loop ---------------------------------------------------------

  private async run() {
    if (this.params.intro?.length) await this.dialogue.play(this.params.intro);

    this.hud.setBanner(this.params.isBoss ? 'Warden Battle' : 'Battle');
    this.hud.setLog(
      this.params.isBoss
        ? 'The warden blocks the hallway. There is no way past it.'
        : 'Hostile data detected. Defend the beetle!',
    );
    await sleep(900);

    while (this.battle.outcome === 'ongoing' && !this.finished) {
      this.battle.beginRound();
      this.hud.setBanner(`Round ${this.battle.round}`);

      for (;;) {
        const actor = this.battle.nextTurn();
        if (!actor) break;
        if (this.battle.outcome !== 'ongoing') break;

        this.hud.setActive(actor.creature.uid);
        this.pulse(actor);

        let result: TurnResult;
        if (actor.side === 'party') {
          let action: BattleAction;
          if (this.autoBattle) {
            this.hud.setLog(`${actor.creature.name} attacks on its own.`);
            await sleep(320);
            action = this.autoAction();
          } else {
            this.hud.setLog(`${actor.creature.name}'s turn.`);
            const choice = await this.hud.chooseAction(this.battle, actor, (uid) => this.hoverTarget(uid));
            if (choice.type === 'auto') {
              this.setAuto(true);
              await sleep(200);
              action = this.autoAction();
            } else {
              action = choice;
            }
          }
          result = this.battle.perform(actor, action);
          this.syphonFromHits(result);
        } else {
          this.hud.setLog(`${actor.creature.name} is deciding...`);
          await sleep(480);
          result = this.battle.perform(actor, this.battle.chooseEnemyAction(actor));
        }

        await this.animateTurn(actor, result);
        this.hud.refresh(this.battle);
        this.hud.setActive(null);
        if (this.battle.outcome !== 'ongoing') break;
      }
    }

    if (this.battle.outcome === 'victory') await this.onVictory();
    else await this.onDefeat();
  }

  /**
   * Auto-battle (plan-adjacent QoL): the party keeps swinging with the free
   * basic Attack — no MP spent, no techniques, no items — so leaving it on can
   * never burn resources you were saving. It targets the weakest living foe so
   * turns are not wasted overkilling something already on its last legs.
   */
  private autoAction(): BattleAction {
    const foes = this.battle.living('enemy');
    if (!foes.length) return { type: 'guard' };
    const target = foes.reduce((weakest, f) => (f.creature.hp < weakest.creature.hp ? f : weakest), foes[0]);
    return { type: 'attack', targetUid: target.creature.uid };
  }

  /**
   * Soul Syphon: every damaging hit the party lands on a wild (un-logged)
   * species raises its syphon; the hit that reaches 100% captures it and grants
   * a free copy — even if the same hit knocks it out. Logged species (★) are
   * skipped, so you can't re-capture what you already have.
   */
  private syphonFromHits(result: TurnResult) {
    for (const h of result.hits) {
      if (h.damage <= 0) continue;
      const target = this.battle.find(h.targetUid);
      if (!target || target.side !== 'enemy') continue;
      const cap = game.syphonHit(target.creature.speciesId, target.creature.level);
      if (!cap) continue;
      audio.sfx('chest');
      const where = cap.toParty ? 'joined your party' : 'sent to the Soul Sanctuary';
      this.hud.setLog(`Soul Syphon complete — ${cap.creature.name} ${where}!`);
      toast(this.ctx.ui, `<span class="accent">★ ${cap.creature.name} captured</span> — ${where}`, 2800);
    }
  }

  private setAuto(on: boolean) {
    if (this.autoBattle === on) return;
    this.autoBattle = on;
    this.hud.setAuto(on);
    audio.sfx(on ? 'confirm' : 'cancel');
    if (!on) this.hud.setLog('Auto off — you have the controls.');
  }

  private pulse(actor: Battler) {
    const bb = this.sprites.get(actor.creature.uid);
    if (bb) bb.setScale(1.08);
    for (const [uid, s] of this.sprites) if (uid !== actor.creature.uid) s.setScale(1);
  }

  private hoverTarget(uid: string | null) {
    if (!this.highlight) return;
    if (!uid) {
      this.highlight.intensity = 0;
      return;
    }
    const bb = this.sprites.get(uid);
    if (!bb) return;
    this.highlight.position.set(bb.object.position.x, 1.6, bb.object.position.z);
    this.highlight.intensity = 9;
  }

  private screenPos(world: THREE.Vector3): { x: number; y: number } {
    const v = world.clone().project(this.ctx.hd2d.camera);
    return {
      x: ((v.x + 1) / 2) * window.innerWidth,
      y: ((-v.y + 1) / 2) * window.innerHeight,
    };
  }

  private async animateTurn(actor: Battler, result: TurnResult) {
    const bb = this.sprites.get(actor.creature.uid);
    const home = this.homePos.get(actor.creature.uid);

    for (const line of result.log.slice(0, 1)) this.hud.setLog(line);

    if (result.hits.length && bb && home) {
      // Lunge toward the opposing side, then snap back.
      const dir = actor.side === 'party' ? -1 : 1;
      await this.tween(0.16, (t) => {
        bb.object.position.z = home.z + dir * 1.1 * t;
      });
    }

    const heal = result.hits.some((h) => h.heal > 0);
    if (result.actionLabel === 'Guard') audio.sfx('guard');
    else if (heal) audio.sfx('heal');
    else if (result.hits.length) audio.sfx('hit');

    for (const hit of result.hits) {
      const target = this.battle.find(hit.targetUid);
      const tbb = this.sprites.get(hit.targetUid);
      if (!target || !tbb) continue;

      const worldTop = tbb.object.position.clone();
      worldTop.y += species(target.creature.speciesId).height * 0.9;

      if (hit.heal > 0) {
        this.particles.emit(worldTop, { count: 14, color: 0x7bdc8a, speed: 1.4, life: 0.8, gravity: 1.2, upBias: 1 });
        const s = this.screenPos(worldTop);
        this.hud.float(s.x, s.y, `+${hit.heal}`, '#7bdc8a');
      } else {
        tbb.hit(1);
        const tech = technique(result.techniqueId ?? 'strike');
        const color = ELEMENTS[tech.element].color;
        this.particles.emit(worldTop, { count: 18, color, speed: 2.6, life: 0.55, gravity: -3 });
        const s = this.screenPos(worldTop);
        const superEffective = hit.breakdown?.effectiveness === 'super';
        this.hud.float(s.x, s.y, String(hit.damage), superEffective ? '#ffd166' : '#ff9a8a');
        this.ctx.hd2d.addShake(superEffective ? 0.2 : 0.11);
        if (superEffective) audio.sfx('crit');
      }

      if (hit.fainted) {
        audio.sfx('ko');
        await this.tween(0.35, (t) => {
          tbb.setOpacity(1 - t * 0.72);
          tbb.mesh.rotation.z = t * Math.PI * 0.12;
        });
      }
    }

    if (result.hits.length && bb && home) {
      await this.tween(0.14, (t) => {
        const dir = actor.side === 'party' ? -1 : 1;
        bb.object.position.z = home.z + dir * 1.1 * (1 - t);
      });
      bb.object.position.copy(home);
    }

    // Remaining log lines, paced so they can be read.
    for (const line of result.log.slice(1)) {
      this.hud.setLog(line);
      await sleep(620);
    }
    await sleep(260);
  }

  private tween(seconds: number, fn: (t: number) => void): Promise<void> {
    return new Promise((resolve) => {
      const start = performance.now();
      const step = () => {
        const t = Math.min(1, (performance.now() - start) / (seconds * 1000));
        fn(t);
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }

  // --- resolution ----------------------------------------------------------

  private async onVictory() {
    if (this.finished) return;
    this.finished = true;
    audio.sfx('victory');
    this.hud.setActive(null);
    this.hud.setBanner('Victory');

    const reward = this.battle
      .side('enemy')
      .reduce((sum, b) => sum + b.creature.level * (this.params.isBoss ? 40 : 11), 0);
    game.credits += reward;
    reviveFainted(game.party, 0.3);
    // A little breathing room between fights.
    for (const c of game.party) {
      if (isUp(c)) {
        c.hp = Math.min(c.maxHp, c.hp + Math.round(c.maxHp * 0.12));
        c.mp = Math.min(c.maxMp, c.mp + Math.round(c.maxMp * 0.1));
      }
      c.guarding = false;
    }

    this.hud.setLog(`The data dissolves. +${reward} credits.`);
    await sleep(1500);

    const params: DungeonSceneParams = {
      resume: true,
      battleResult: 'victory',
      eventId: this.params.eventId,
    };
    await this.ctx.go(this.params.returnTo, params);
  }

  private async onDefeat() {
    if (this.finished) return;
    this.finished = true;
    audio.sfx('defeat');
    this.hud.setBanner('Defeat');
    this.hud.setLog('The beetle goes dark...');
    await sleep(1600);
    await this.ctx.go('gameover');
  }

  // --- frame ---------------------------------------------------------------

  override update(dt: number, time: number) {
    for (const bb of this.sprites.values()) bb.update(dt, this.ctx.hd2d.camera, time);
    for (const t of this.torches) t.update(dt, this.ctx.hd2d.camera, time);
    this.particles.update(dt);
    // Slow drift keeps the arena from feeling like a static screenshot.
    this.ctx.hd2d.cameraTarget.set(
      Math.sin(time * 0.25) * 0.35,
      0,
      CAMERA_BIAS_Z + Math.cos(time * 0.2) * 0.2,
    );
  }

  async exit() {
    this.finished = true;
    this.unsubInput?.();
    this.unsubInput = null;
    this.hud.destroy();
    this.dialogue.destroy();
    for (const bb of this.sprites.values()) bb.dispose();
    this.particles.dispose();
    this.scene.clear();
  }
}
