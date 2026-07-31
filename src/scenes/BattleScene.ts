import * as THREE from 'three';
import { GameScene, sleep } from '../engine/SceneManager';
import { Billboard } from '../engine/Billboard';
import { ParticleField, Torch, Aura } from '../engine/fx';
import { battleAura } from '../data/battleFx';
import { audio } from '../engine/Audio';
import { input } from '../engine/Input';
import { elementGlowTexture, elementTileTexture, floorTexture, radialTexture, wallTexture } from '../engine/pixel';
import { speciesArt, species } from '../data/creatures';
import { ELEMENTS } from '../data/elements';
import type { ElementId } from '../data/elements';
import type { EnemySpec } from '../data/quietCrossing';
import { technique } from '../data/techniques';
import { moveFx } from '../data/moveFx';
import type { MoveFx } from '../data/moveFx';
import { COMFORT_PHRASES, IMMORTALITY_TOTAL } from '../data/immortality';
import { Battle } from '../systems/battle/engine';
import type { BattleAction, Battler, TurnResult } from '../systems/battle/engine';
import { makeCreature, isUp, reviveFainted, grantXp, xpFromEnemy } from '../systems/party/creature';
import type { CreatureInstance } from '../systems/party/creature';
import { game, MAX_FIELDED } from '../systems/party/gameState';
import { BattleHUD } from '../ui/BattleHUD';
import { DialogueBox } from '../ui/DialogueBox';
import { toast } from '../ui/Toast';
import type { DialogueScript } from '../systems/dialogue/script';
import { say, narrate } from '../systems/dialogue/script';
import type { DungeonSceneParams } from './DungeonScene';

/** Chance a Run attempt succeeds (bosses cannot be fled). */
const FLEE_CHANCE = 0.5;

export interface BattleSceneParams {
  enemies: EnemySpec[];
  isBoss?: boolean;
  eventId?: string;
  partyTiles?: (ElementId | undefined)[];
  enemyTiles?: (ElementId | undefined)[];
  intro?: DialogueScript;
  /** Scene to return to on victory. */
  returnTo: string;
  /** Optional seeded RNG — makes the whole played fight reproducible (tests). */
  rng?: () => number;
}

const SLOT_X = [-2.4, 0, 2.4];
const PARTY_Z = 2.2;
const ENEMY_Z = -3;
/** Depth gap between the Vanguard (front) row and the Rear (back) row. */
const ROW_GAP = 1.6;
/**
 * The camera looks slightly past the party so the near row sits above the
 * bottom-left HUD panels instead of behind them.
 */
const CAMERA_BIAS_Z = 0.9;

/**
 * World position of a formation cell. Columns spread along X; the Rear row sits
 * further from the opposing side (behind the party, deeper for enemies).
 */
function cellPos(side: 'party' | 'enemy', cell: { row: number; col: number }): { x: number; z: number } {
  const front = side === 'party' ? PARTY_Z : ENEMY_Z;
  const dir = side === 'party' ? 1 : -1;
  return { x: SLOT_X[cell.col], z: front + (cell.row === 1 ? dir * ROW_GAP : 0) };
}

/** Field-pulse announcement line (Phase D). */
const PULSE_TEXT: Record<string, string> = {
  calm: '',
  crit: 'A Crit Field settles in — attacks bite deeper this round.',
};

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
  /** Per-fighter signature aura (only for species with a `BattleAura`). */
  private auras = new Map<string, Aura>();
  /** Shared white radial map, tinted per-flash — the bright pop at an impact. */
  private flashTex = radialTexture('flash', '#ffffff', 64);
  private homePos = new Map<string, THREE.Vector3>();
  private highlight: THREE.PointLight | null = null;
  private finished = false;
  /** Set when the party successfully flees — skips victory/defeat resolution. */
  private fled = false;
  /** Auto-battle: party members take the basic Attack until the player cancels. */
  private autoBattle = false;
  /** Repeat: party members re-issue their last player-chosen command until cancelled. */
  private repeatBattle = false;
  /**
   * The most recent *player-chosen* action per party creature (by uid). Only
   * manual menu picks are recorded — Auto and Repeat never overwrite it — so
   * Repeat always replays what the player actually last commanded, and a
   * technique that recovers its MP resumes instead of being stuck on Attack.
   */
  private lastActions = new Map<string, BattleAction>();
  private unsubInput: (() => void) | null = null;

  async enter(params?: unknown) {
    this.params = params as BattleSceneParams;

    const enemies = this.makeEnemies(this.params.enemies);
    // Only souls fight — the human companions (Wren / Sena / Kade) walk with you
    // but never take the field. Each human keeper instead lets you deploy one
    // more soul, so the field cap is `game.fieldCap` (you + every companion).
    const monsters = game.party.filter((c) => isUp(c) && !c.companion);
    const active = monsters.slice(0, Math.min(game.fieldCap, MAX_FIELDED));
    this.battle = new Battle({
      party: active,
      enemies,
      partyTiles: this.params.partyTiles,
      enemyTiles: this.params.enemyTiles,
      // Deploy each fielded member into the cell the player set in the Party
      // screen (Vanguard/Rear × column); the i-th living member takes slot i.
      partyCells: game.formation.slice(0, active.length).map((c) => ({ ...c })),
      isBoss: this.params.isBoss,
      rng: this.params.rng,
    });
    // Living souls who did not deploy are the swap-in reserves (companions never are).
    this.battle.reserves = monsters.filter((c) => !active.some((a) => a.uid === c.uid));

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

    // The Last Light is a grief encounter, not a fight — leave the dungeon's
    // ambience playing rather than crashing in with a combat sting + theme.
    const isLastLight = this.params.enemies.some((e) => e.species === 'lastlight');
    if (!isLastLight) {
      // Pokémon-style handoff: a sting fires now (the field music is fading out),
      // and the battle theme starts exactly on the sting's impact.
      const stingDur = audio.encounterSting(!!this.params.isBoss);
      audio.music(this.params.isBoss ? 'boss' : 'battle', stingDur);
    }

    // Escape / L1 drops out of auto-battle. Registered scene-wide rather than on
    // the menu, because while auto is running no menu is open to receive the key.
    // (L1 *starts* auto via the action menu's 'auto' item; here it stops it.)
    this.unsubInput = input.onAction((a) => {
      if ((a === 'cancel' || a === 'auto') && this.autoBattle) this.setAuto(false);
      else if (a === 'cancel' && this.repeatBattle) this.setRepeat(false);
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
    buildInst(
      positions.filter((p) => ((p.x / 2 + p.z / 2) & 1) === 0),
      matA,
    );
    buildInst(
      positions.filter((p) => ((p.x / 2 + p.z / 2) & 1) !== 0),
      matB,
    );

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
      if (b.tile) {
        const p = cellPos(b.side, b.cell);
        plate(p.x, p.z, b.tile);
      }
    }

    // Formation grid: a faint outline under every one of the 12 cells so the
    // 2×3 layout reads at a glance; occupied cells glow a little brighter.
    const occupied = new Set(this.battle.battlers.map((b) => `${b.side}:${b.cell.row}:${b.cell.col}`));
    const cellGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(1.7, 1.7));
    for (const side of ['party', 'enemy'] as const) {
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 3; col++) {
          const p = cellPos(side, { row, col });
          const on = occupied.has(`${side}:${row}:${col}`);
          const mat = new THREE.LineBasicMaterial({
            color: side === 'party' ? 0x8fd0ff : 0xff9a8a,
            transparent: true,
            opacity: on ? 0.5 : 0.16,
          });
          const outline = new THREE.LineSegments(cellGeo, mat);
          outline.rotation.x = -Math.PI / 2;
          outline.position.set(p.x, 0.02, p.z);
          this.scene.add(outline);
        }
      }
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
      const cp = cellPos(b.side, b.cell);
      const pos = new THREE.Vector3(cp.x, 0, cp.z);
      bb.object.position.copy(pos);
      this.homePos.set(b.creature.uid, pos.clone());
      this.scene.add(bb.object);
      this.sprites.set(b.creature.uid, bb);

      // A signature aura for the species, if the first-dungeon roster defines
      // one. Only wardens carry a glow — the arena's light budget is small.
      const cfg = battleAura(b.creature.speciesId);
      if (cfg) {
        const aura = new Aura(this.particles, cfg);
        if (aura.light) this.scene.add(aura.light);
        this.auras.set(b.creature.uid, aura);
      }

      if (!isUp(b.creature)) {
        bb.setOpacity(0.28);
        bb.mesh.rotation.z = Math.PI * 0.12;
      }
    }
  }

  /** Tears down and rebuilds all fighter billboards (after a swap changes who is fielded). */
  private rebuildFighters() {
    for (const bb of this.sprites.values()) {
      this.scene.remove(bb.object);
      bb.dispose();
    }
    for (const a of this.auras.values()) a.dispose();
    this.auras.clear();
    this.sprites.clear();
    this.homePos.clear();
    this.buildFighters();
  }

  /**
   * Reflects a reposition or swap in 3D: a shift glides the sprite to its new
   * cell; a swap (the fielded creature changed) rebuilds the fighters and cards.
   */
  private async applyMove(actor: Battler, beforeUid: string) {
    if (actor.creature.uid !== beforeUid) {
      this.rebuildFighters();
      this.hud.build(this.battle);
      audio.sfx('confirm');
      return;
    }
    const cp = cellPos(actor.side, actor.cell);
    const home = new THREE.Vector3(cp.x, 0, cp.z);
    const bb = this.sprites.get(actor.creature.uid);
    if (bb) {
      const from = bb.object.position.clone();
      audio.sfx('blip');
      await this.tween(0.25, (t) => bb.object.position.lerpVectors(from, home, t));
      bb.object.position.copy(home);
    }
    this.homePos.set(actor.creature.uid, home);
  }

  // --- battle loop ---------------------------------------------------------

  private async run() {
    if (this.params.intro?.length) await this.dialogue.play(this.params.intro);

    // The Last Light is not a fight — it is a soul asking to be understood.
    if (this.battle.side('enemy').some((b) => b.creature.speciesId === 'lastlight')) {
      await this.runLastLight();
      return;
    }

    // A single, flag-gated mechanic lesson per fight (see `maybeTutorial`), so
    // the new systems arrive slowly across the three areas rather than at once.
    await this.maybeTutorial();

    // No "Battle" title — it says nothing. A boss still names the threat.
    this.hud.setBanner(this.params.isBoss ? 'Warden' : '');
    this.hud.setLog(
      this.params.isBoss
        ? 'The warden blocks the hallway. There is no way past it.'
        : 'An echo turns to face you. Keep your lantern lit.',
    );
    await sleep(900);

    while (this.battle.outcome === 'ongoing' && !this.finished && !this.fled) {
      this.battle.beginRound();
      // No per-round "Round N" banner — the title set above stays put. A field
      // pulse is the only thing worth announcing, and it goes to the log.
      // As the first round opens, a single foe snarls — one random enemy voice,
      // so the fight *begins* with a creature sound rather than a pre-battle
      // roll-call announcing every species before combat starts.
      if (this.battle.round === 1) this.cryRandomEnemy();
      if (this.battle.fieldPulse !== 'calm') {
        this.hud.setLog(PULSE_TEXT[this.battle.fieldPulse]);
        await sleep(700);
      }

      for (;;) {
        const actor = this.battle.nextTurn();
        if (!actor) break;
        if (this.battle.outcome !== 'ongoing') break;

        // A broken actor loses this turn; the Break then clears.
        if (actor.staggered) {
          this.hud.setActive(actor.creature.uid);
          this.hud.setLog(`${actor.creature.name} is broken and cannot move!`);
          this.battle.clearStagger(actor);
          this.hud.refresh(this.battle);
          audio.sfx('cancel');
          await sleep(1000);
          this.hud.setActive(null);
          continue;
        }

        this.hud.setActive(actor.creature.uid);
        this.pulse(actor);

        let result: TurnResult;
        if (actor.side === 'party') {
          let action: BattleAction | null = null;
          if (this.autoBattle) {
            this.hud.setLog(`${actor.creature.name} attacks on its own.`);
            await sleep(320);
            action = this.autoAction();
          } else if (this.repeatBattle) {
            this.hud.setLog(`${actor.creature.name} repeats its last command.`);
            await sleep(320);
            action = this.repeatAction(actor);
          } else {
            // Repeat is offered once a prior round's commands exist to replay.
            const canRepeat = this.battle.round > 1 && this.lastActions.size > 0;
            const choice = await this.hud.chooseAction(
              this.battle,
              actor,
              (uid) => this.hoverTarget(uid),
              this.battle.reserves.filter(isUp),
              canRepeat,
            );
            if (choice.type === 'flee') {
              // A coin-flip escape; a failed attempt still costs the turn.
              if (this.battle.rng() < FLEE_CHANCE) {
                this.fled = true;
              } else {
                audio.sfx('cancel');
                this.hud.setLog(`${actor.creature.name} tried to run — no way out!`);
                await sleep(1000);
              }
              action = null;
            } else if (choice.type === 'auto') {
              this.setAuto(true);
              await sleep(200);
              action = this.autoAction();
            } else if (choice.type === 'repeat') {
              this.setRepeat(true);
              await sleep(200);
              action = this.repeatAction(actor);
            } else {
              action = choice;
              // Remember this manual command so Repeat can replay it later.
              this.lastActions.set(actor.creature.uid, choice);
            }
          }
          if (this.fled) break;
          if (action) {
            const beforeUid = actor.creature.uid;
            result = this.battle.perform(actor, action);
            this.syphonFromHits(result);
            if (result.pacified) this.resolvePacify(result.pacified);
            if (result.moved) await this.applyMove(actor, beforeUid);
          } else {
            // Failed flee: the turn is spent with no action.
            result = { actorUid: actor.creature.uid, actionLabel: '', hits: [], log: [] };
          }
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

    if (this.fled) await this.onFlee();
    else if (this.battle.outcome === 'victory') await this.onVictory();
    else await this.onDefeat();
  }

  /**
   * Auto-battle (plan-adjacent QoL): the party keeps swinging with the free
   * basic Attack — no MP spent, no techniques, no items — so leaving it on can
   * never burn resources you were saving. It targets the weakest living foe so
   * turns are not wasted overkilling something already on its last legs.
   */
  private autoAction(): BattleAction {
    return this.attackAction();
  }

  /**
   * A basic Attack, targeting `preferredUid` when it is still a living foe,
   * otherwise the weakest one — so turns are not wasted overkilling something
   * already on its last legs. Shared by Auto and by Repeat's MP fallback.
   */
  private attackAction(preferredUid?: string): BattleAction {
    const foes = this.battle.living('enemy');
    if (!foes.length) return { type: 'guard' };
    const keep = preferredUid ? foes.find((f) => f.creature.uid === preferredUid) : undefined;
    const target = keep ?? foes.reduce((weakest, f) => (f.creature.hp < weakest.creature.hp ? f : weakest), foes[0]);
    return { type: 'attack', targetUid: target.creature.uid };
  }

  /**
   * Repeat: replay this actor's last player-chosen command. If it was a
   * Technique the actor can no longer afford, fall back to a normal Attack (as
   * requested); if the actor never issued a command (e.g. it was swapped in),
   * default to a normal Attack too. Stale targets are re-aimed by the engine.
   */
  private repeatAction(actor: Battler): BattleAction {
    const last = this.lastActions.get(actor.creature.uid);
    if (!last) return this.attackAction();
    if (last.type === 'technique' && actor.creature.mp < technique(last.techniqueId).mpCost) {
      return this.attackAction(last.targetUid);
    }
    return last;
  }

  /**
   * One-time mechanic coaching, gated on `game.flags` so each lesson shows
   * exactly once — and at most one per fight, in curriculum order, so the new
   * systems are introduced slowly across the three story areas:
   *
   * - **The Quiet Crossing:** melee vs ranged reach and cover.
   * - **The Reliquary (crystal):** elemental reactions.
   * - **The Unremembered (haunted):** break-chains, then Commune once a gentle
   *   soul is actually on the field.
   */
  private async maybeTutorial() {
    const reach = game.activeReachId;
    const teach = (flag: string, script: DialogueScript) => {
      game.set(flag);
      return this.dialogue.play(script);
    };

    if (reach === 'crossing' && !game.has('tut.melee')) {
      return teach(
        'tut.melee',
        say(
          'Halden',
          'One more thing before the scraps get real. Your basic Attack is melee — it only reaches the front row.',
          'A soul in the Rear is covered while an ally holds the front of its column, so melee cannot touch it. But some invocations can strike souls at a range, cover or no cover.',
          'So keep a fragile caster in the Rear, a sturdy body in the Vanguard ahead of it. Use Move to set your line.',
        ),
      );
    }

    if (reach === 'crystal' && !game.has('tut.reaction')) {
      return teach(
        'tut.reaction',
        say(
          'Halden',
          'The Reliquary runs hot and cold at once — a good place to learn reactions. Hit a soul with one element and it leaves a mark; you will see a ◈ on its card.',
          'Strike that mark with a DIFFERENT element before it fades and the two detonate — Steam, Wildfire, Short-Circuit: bonus damage, and it Breaks faster.',
          'Two casters of different elements can pop a reaction every round. Mix your elements; do not just hammer one.',
        ),
      );
    }

    if (reach === 'haunted') {
      if (!game.has('tut.breakChain')) {
        return teach(
          'tut.breakChain',
          say(
            'Halden',
            'These are already half-gone. Break one and it cannot even shield itself — so when a soul is BROKEN, pile on before it recovers.',
            'Each hit landed on it extends a chain: every link bites harder than the last.',
            'Order your turns onto the broken one — keep the chain alive and it will fall fast.',
          ),
        );
      }
      if (!game.has('tut.commune') && this.battle.communeTargets('enemy').length > 0) {
        return teach('tut.commune', [
          ...say(
            'Halden',
            "Wait — that one isn't attacking. It's just frightened. You don't have to put it down.",
            'Use Commune. Speak to it a few turns, until it understands; it settles and leaves in peace — and you still log its soul if you win the fight.',
          ),
          ...narrate('Some of what waits down here does not need to be beaten. Only heard.'),
        ]);
      }
    }
  }

  /**
   * A soul talked into peace by Commune is *understood* — recorded like a full
   * Soul Syphon so it is claimed on victory (`finalizeCaptures`), same as a
   * drained one, but without a single blow landed.
   */
  private resolvePacify(uid: string) {
    const t = this.battle.find(uid);
    if (t?.side !== 'enemy') return;
    game.understandSoul(t.creature.speciesId);
    audio.sfx('blip');
    this.hud.setLog(`${t.creature.name} is at peace — win the fight to log its soul.`);
  }

  /**
   * Soul Syphon: every damaging hit the party lands on a wild (un-logged)
   * species raises its syphon meter. The capture is *not* granted here — it is
   * finalized only if you win (`finalizeCaptures`), so a wipe claims nothing.
   */
  private syphonFromHits(result: TurnResult) {
    for (const h of result.hits) {
      if (h.damage <= 0) continue;
      const target = this.battle.find(h.targetUid);
      if (target?.side !== 'enemy') continue;
      if (game.syphonHit(target.creature.speciesId)) {
        audio.sfx('blip');
        this.hud.setLog(`${target.creature.name}'s soul is full — win the fight to claim it!`);
      }
    }
  }

  /**
   * Claim every wild species whose syphon filled this battle (a free copy to the
   * party, or the Sanctuary if full). Called on victory only — losing forfeits
   * the souls you drained. Announced after the win banner.
   */
  private finalizeCaptures(): { name: string; where: string }[] {
    const claimed: { name: string; where: string }[] = [];
    for (const b of this.battle.side('enemy')) {
      if (!game.syphonReady(b.creature.speciesId)) continue;
      const cap = game.captureSpecies(b.creature.speciesId, b.creature.level);
      claimed.push({
        name: cap.creature.name,
        where: cap.toParty ? 'joined your party' : 'sent to the Soul Sanctuary',
      });
    }
    return claimed;
  }

  private setAuto(on: boolean) {
    if (this.autoBattle === on) return;
    if (on) this.setRepeat(false); // the two hands-off modes are mutually exclusive
    this.autoBattle = on;
    this.hud.setAuto(on);
    audio.sfx(on ? 'confirm' : 'cancel');
    if (!on) this.hud.setLog('Auto off — you have the controls.');
  }

  private setRepeat(on: boolean) {
    if (this.repeatBattle === on) return;
    if (on) this.setAuto(false); // the two hands-off modes are mutually exclusive
    this.repeatBattle = on;
    this.hud.setRepeat(on);
    audio.sfx(on ? 'confirm' : 'cancel');
    if (!on) this.hud.setLog('Repeat off — you have the controls.');
  }

  private pulse(actor: Battler) {
    const bb = this.sprites.get(actor.creature.uid);
    if (bb) bb.setScale(1.08);
    for (const [uid, s] of this.sprites) if (uid !== actor.creature.uid) s.setScale(1);
    // A swell of the actor's own aura as it takes the floor — a species tell.
    const aura = this.auras.get(actor.creature.uid);
    if (aura && bb) aura.burst(bb.object.position, species(actor.creature.speciesId).height);
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

  /**
   * One foe snarls as combat starts: a single, randomly chosen enemy that has a
   * voice cries once. Deliberately not a roll-call of every species — just one
   * creature sound to open the fight. No-op if none of the foes has a cry.
   */
  private cryRandomEnemy() {
    const voiced = this.battle.side('enemy').filter((b) => audio.hasCry(b.creature.speciesId));
    if (!voiced.length) return;
    const pick = voiced[Math.floor(Math.random() * voiced.length)];
    // Dip the music briefly so the cry reads clearly over the battle theme.
    audio.duck(1);
    audio.cry(pick.creature.speciesId);
  }

  private async animateTurn(actor: Battler, result: TurnResult) {
    const bb = this.sprites.get(actor.creature.uid);
    const home = this.homePos.get(actor.creature.uid);

    for (const line of result.log.slice(0, 1)) this.hud.setLog(line);

    // The move's own signature FX (melee slash / flying bolt / area nova /
    // mending bloom), derived from the technique — see data/moveFx.ts. Guard
    // and other hitless actions get none.
    const tech = technique(result.techniqueId ?? 'strike');
    const cssColor = ELEMENTS[tech.element].color;
    const fx = result.hits.length ? moveFx(tech) : null;
    const heal = result.hits.some((h) => h.heal > 0);

    // Wind-up: a puff of the move's element gathers on the caster the instant
    // before it delivers.
    const casterHeight = species(actor.creature.speciesId).height;
    if (fx && bb) {
      const top = bb.object.position.clone();
      top.y += casterHeight * 0.6;
      this.castTelegraph(top, fx);
    }

    // The attacker calls out as it charges — its own species cry leads the
    // delivery so it is heard clean, a beat before the impact sfx lands under it
    // (firing both at once masked the cry). Offensive move only (not Guard/heal).
    if (result.hits.length && !heal && result.actionLabel !== 'Guard') {
      audio.cry(actor.creature.speciesId);
    }

    // Delivery motion. A melee blow lunges in — trailing a streak of its element
    // so the charge itself reads; a ranged bolt stays put and fires a projectile;
    // area/heal moves gather in place.
    if (fx && bb && home && fx.delivery === 'melee') {
      const dir = actor.side === 'party' ? -1 : 1;
      const trail = new THREE.Vector3();
      await this.tween(0.18, (t) => {
        bb.object.position.z = home.z + dir * 1.4 * t;
        trail.set(bb.object.position.x, bb.object.position.y + casterHeight * 0.5, bb.object.position.z);
        this.particles.emit(trail, {
          count: 3,
          speed: 0.7,
          spread: 0.35,
          life: 0.32,
          gravity: fx.gravity * 0.3,
          upBias: 0.3,
          size: fx.size,
          color: fx.color,
        });
      });
    }

    if (result.actionLabel === 'Guard') audio.sfx('guard');
    else if (heal) audio.sfx('heal');
    else if (result.hits.length) audio.sfx('hit');

    // A ranged bolt streaks from the caster to its target before it detonates.
    if (fx && bb && fx.delivery === 'bolt') {
      const primary = result.hits[0];
      const ptarget = this.battle.find(primary.targetUid);
      const ptbb = this.sprites.get(primary.targetUid);
      if (ptarget && ptbb) {
        const from = bb.object.position.clone();
        from.y += casterHeight * 0.6;
        const to = ptbb.object.position.clone();
        to.y += species(ptarget.creature.speciesId).height * 0.55;
        await this.flyBolt(from, to, fx);
      }
    }

    for (const hit of result.hits) {
      const target = this.battle.find(hit.targetUid);
      const tbb = this.sprites.get(hit.targetUid);
      if (!target || !tbb || !fx) continue;

      const worldTop = tbb.object.position.clone();
      worldTop.y += species(target.creature.speciesId).height * 0.9;

      if (hit.heal > 0) {
        this.particles.emit(worldTop, {
          count: fx.impact.count,
          color: fx.color,
          speed: fx.impact.speed,
          spread: fx.impact.spread,
          life: fx.impact.life,
          gravity: fx.gravity,
          upBias: fx.upBias,
          size: fx.size,
        });
        this.impactFlash(worldTop, fx.color, fx.flash);
        const s = this.screenPos(worldTop);
        this.hud.float(s.x, s.y, `+${hit.heal}`, cssColor);
      } else {
        tbb.hit(1);
        const react = !!hit.reaction;
        this.particles.emit(worldTop, {
          count: react ? Math.round(fx.impact.count * 1.5) : fx.impact.count,
          color: fx.color,
          speed: react ? fx.impact.speed * 1.3 : fx.impact.speed,
          spread: react ? fx.impact.spread * 1.3 : fx.impact.spread,
          life: fx.impact.life,
          gravity: fx.gravity,
          upBias: fx.upBias,
          size: fx.size,
        });
        const s = this.screenPos(worldTop);
        // Combo / effectiveness are inferred from the FX, not labelled: a
        // reaction or super-effective hit reads through a fatter impact burst,
        // more shake and a brighter number — no "Steam!" / "N-chain" text.
        const superEffective = hit.crit || hit.breakdown?.effectiveness === 'super';
        const chained = !!hit.chain && hit.chain >= 2;
        const big = superEffective || react || chained;
        this.impactFlash(worldTop, big ? 0xfff0c0 : fx.color, fx.flash * (big ? 1.5 : 1));
        this.hud.float(s.x, s.y, String(hit.damage), big ? '#ffd166' : '#ff9a8a');
        this.ctx.hd2d.addShake(react ? fx.shake * 1.6 : superEffective ? fx.shake * 1.3 : fx.shake);
        if (react || superEffective) audio.sfx('crit');
      }

      if (hit.fainted) {
        audio.sfx('ko');
        await this.tween(0.35, (t) => {
          tbb.setOpacity(1 - t * 0.72);
          tbb.mesh.rotation.z = t * Math.PI * 0.12;
        });
      }
    }

    // Only a melee lunge needs undoing — ranged/area casters never left home.
    if (fx && bb && home && fx.delivery === 'melee') {
      await this.tween(0.14, (t) => {
        const dir = actor.side === 'party' ? -1 : 1;
        bb.object.position.z = home.z + dir * 1.4 * (1 - t);
      });
      bb.object.position.copy(home);
    }

    // A pacified soul dissolves gently — a soft, upward drift rather than a KO fall.
    if (result.pacified) {
      const tbb = this.sprites.get(result.pacified);
      if (tbb) {
        const worldTop = tbb.object.position.clone();
        worldTop.y += 1.0;
        this.particles.emit(worldTop, { count: 22, color: 0xbfe0ff, speed: 1.2, life: 1.0, gravity: 0.5, upBias: 1 });
        const s = this.screenPos(worldTop);
        this.hud.float(s.x, s.y, 'understood', '#bfe0ff');
        audio.sfx('heal');
        await this.tween(0.5, (t) => tbb.setOpacity(1 - t * 0.85));
      }
    }

    // Remaining log lines, paced so they can be read.
    for (const line of result.log.slice(1)) {
      this.hud.setLog(line);
      await sleep(620);
    }
    await sleep(260);
  }

  /**
   * A bright additive flash sprite at an impact point: pops from small to full
   * and fades in ~0.3s. This is the beat that reads instantly even against the
   * busy painterly arena — the particle burst is the texture, this is the punch.
   */
  private impactFlash(pos: THREE.Vector3, color: number, radius: number) {
    const mat = new THREE.SpriteMaterial({
      map: this.flashTex,
      color: new THREE.Color(color),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(pos);
    sprite.renderOrder = 6;
    this.scene.add(sprite);
    void this.tween(0.3, (t) => {
      const s = radius * (0.35 + t * 0.9);
      sprite.scale.set(s, s, 1);
      mat.opacity = (1 - t) ** 1.4;
    }).then(() => {
      this.scene.remove(sprite);
      mat.dispose();
    });
  }

  /** A puff of the move's element gathering on the caster, just before it lands. */
  private castTelegraph(top: THREE.Vector3, fx: MoveFx) {
    this.particles.emit(top, {
      count: fx.cast.count,
      speed: fx.cast.speed,
      spread: fx.cast.spread,
      life: fx.cast.life,
      gravity: fx.gravity * 0.4,
      upBias: fx.upBias * 0.6,
      size: fx.size,
      color: fx.color,
    });
  }

  /**
   * A ranged projectile: a knot of element-tinted motes streaks from the caster
   * to its target, trailing sparks, then hands off to the impact burst. Duration
   * scales with distance so a far shot doesn't teleport.
   */
  private async flyBolt(from: THREE.Vector3, to: THREE.Vector3, fx: MoveFx) {
    const dist = from.distanceTo(to);
    const dur = Math.min(0.5, Math.max(0.2, dist / fx.boltSpeed));
    const p = new THREE.Vector3();
    await this.tween(dur, (t) => {
      p.lerpVectors(from, to, t);
      // A dense, chunky trail so the projectile itself reads as it crosses.
      this.particles.emit(p, {
        count: 5,
        speed: 0.9,
        spread: 0.3,
        life: 0.34,
        gravity: fx.gravity * 0.3,
        upBias: 0.2,
        size: fx.size * 1.3,
        color: fx.color,
      });
    });
    // A small flash rides the projectile head to the target as it lands.
    this.impactFlash(to, fx.color, fx.flash * 0.7);
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
    // Battle won: fade the combat theme and ring a victory fanfare. Field music
    // resumes when we return to the dungeon.
    audio.music(null);
    audio.victoryFanfare();
    this.hud.setActive(null);
    this.hud.setBanner('Victory');

    const reward = this.battle
      .side('enemy')
      .reduce((sum, b) => sum + b.creature.level * (this.params.isBoss ? 40 : 11), 0);
    game.obols += reward;
    reviveFainted(game.party, 0.3);
    // A little breathing room between fights.
    for (const c of game.party) {
      if (isUp(c)) {
        c.hp = Math.min(c.maxHp, c.hp + Math.round(c.maxHp * 0.12));
        c.mp = Math.min(c.maxMp, c.mp + Math.round(c.maxMp * 0.1));
      }
      c.guarding = false;
    }

    // EXP: each monster that fought earns from every defeated enemy, scaled
    // independently by its own level gap (under-levelled gain more).
    const enemies = this.battle.side('enemy');
    const levelUps: string[] = [];
    for (const b of this.battle.side('party')) {
      const c = b.creature;
      let gained = 0;
      for (const e of enemies) gained += xpFromEnemy(c.level, e.creature.level);
      const nl = grantXp(c, gained);
      if (nl !== null) levelUps.push(`${c.name} → Lv${nl}`);
    }

    this.hud.setLog(`The echo is quieted. +${reward} obols.`);
    await sleep(1500);

    for (const msg of levelUps) {
      audio.sfx('heal');
      this.hud.refresh(this.battle);
      // One announcement only — the battle log carries it (no extra toast).
      this.hud.setLog(`Level up! ${msg}`);
      await sleep(1400);
    }

    // Claim any souls drained to 100% this fight (victory only).
    for (const c of this.finalizeCaptures()) {
      audio.sfx('chest');
      this.hud.setLog(`Soul claimed — ${c.name} ${c.where}!`);
      toast(this.ctx.ui, `<span class="accent">★ ${c.name} captured</span> — ${c.where}`, 2600);
      await sleep(1500);
    }

    const params: DungeonSceneParams = {
      resume: true,
      battleResult: 'victory',
      eventId: this.params.eventId,
    };
    await this.ctx.go(this.params.returnTo, params);
  }

  /**
   * The Last Light (death theme): a soul almost ready to move on. It cannot be
   * fought or kept — only understood and released, within three dimming turns,
   * using the Grief commands. Success grants a huge EXP boon and a piece of the
   * Immortality set; failure lets it slip away with nothing.
   */
  private async runLastLight() {
    const light = this.battle.side('enemy')[0];
    this.hud.setActive(light.creature.uid);
    this.hud.setBanner('A Trembling Light');
    this.hud.setLog(
      'A cracked lantern drifts near, a small flame shivering inside. It cannot fight, and will not be made to. It is trying, gently, to leave.',
    );
    await sleep(1900);

    let turns = 3;
    let comforted = false;
    let rememberStreak = 0;
    let awarded = false;
    let left = false;

    while (turns > 0 && !awarded && !left && !this.finished) {
      this.hud.setBanner(`The flame dims — ${turns} left`);
      const choice = await this.hud.chooseGrief(comforted);

      if (choice === 'remember') {
        rememberStreak += 1;
        const chance = rememberStreak <= 1 ? 0.33 : 0.66; // rises to 66% when pressed consecutively
        this.hud.setLog('You say: "Remember who you are."');
        await sleep(1200);
        if (this.battle.rng() < chance) awarded = true;
        else {
          this.hud.setLog('The flame gutters, reaching for a name it almost has. Not yet.');
          await sleep(1200);
          turns -= 1;
        }
      } else if (choice === 'comfort') {
        rememberStreak = 0;
        comforted = true;
        const phrase = COMFORT_PHRASES[Math.floor(this.battle.rng() * COMFORT_PHRASES.length)];
        this.hud.setLog(`You say: "${phrase}"`);
        await sleep(1300);
        if (this.battle.rng() < 0.1) awarded = true;
        else {
          this.hud.setLog('It leans toward the warmth of your voice, a little steadier now.');
          await sleep(1200);
          turns -= 1;
        }
      } else {
        rememberStreak = 0;
        this.hud.setLog('You say: "You are free."');
        await sleep(1300);
        if (comforted) awarded = true;
        else {
          left = true;
          this.hud.setLog('But it was not ready. Startled, the flame slips away — taking nothing you offered.');
          await sleep(1800);
        }
      }
    }

    if (!awarded && !left) {
      this.hud.setLog('The flame thins to a thread and, with a small sigh, goes out on its own. Peacefully.');
      await sleep(1900);
    }

    if (awarded) await this.onLastLightReleased(light);
    else await this.onLastLightGone();
  }

  private async onLastLightReleased(light: Battler) {
    if (this.finished) return;
    this.finished = true;
    audio.sfx('victory');
    this.hud.setActive(null);
    this.hud.setBanner('At Rest');
    this.hud.setLog('The Last Light understands. It rises, unhurried, and is gone — not lost. Home.');
    await sleep(1700);

    // A huge EXP boon: twenty times what a foe of its level would normally give.
    const enemyLevel = light.creature.level;
    const levelUps: string[] = [];
    for (const b of this.battle.side('party')) {
      const nl = grantXp(b.creature, xpFromEnemy(b.creature.level, enemyLevel) * 20);
      if (nl !== null) levelUps.push(`${b.creature.name} → Lv${nl}`);
    }
    this.hud.setLog('Something it carried passes to you — a great, quiet understanding.');
    await sleep(1500);
    for (const msg of levelUps) {
      audio.sfx('heal');
      toast(this.ctx.ui, `<span class="accent">Level up!</span> ${msg}`, 2200);
      await sleep(1200);
    }

    // A piece of the Immortality elegy, in order — the set completes at twelve.
    const piece = game.grantImmortalityPiece();
    if (piece) {
      audio.sfx('chest');
      this.hud.setLog(`It leaves a line behind: "${piece.line}"`);
      toast(
        this.ctx.ui,
        `<span class="accent">◆ Immortality ${piece.index + 1}/${IMMORTALITY_TOTAL}</span> — "${piece.line}"`,
        3200,
      );
      await sleep(2400);
      if (game.immortality >= IMMORTALITY_TOTAL) {
        this.hud.setLog('The elegy is whole. A life remembered entire — the Immortality Memento is yours.');
        toast(this.ctx.ui, '<span class="accent">★ Immortality complete</span> — a Memento of 100% criticals', 3200);
        await sleep(2400);
      }
    }

    await this.ctx.go(this.params.returnTo, { resume: true, battleResult: 'flee', eventId: this.params.eventId });
  }

  private async onLastLightGone() {
    if (this.finished) return;
    this.finished = true;
    audio.sfx('cancel');
    this.hud.setActive(null);
    this.hud.setBanner('Gone');
    this.hud.setLog('The lantern is empty. You did not get to understand it in time. Some souls you only meet once.');
    await sleep(2000);
    await this.ctx.go(this.params.returnTo, { resume: true, battleResult: 'flee', eventId: this.params.eventId });
  }

  private async onFlee() {
    if (this.finished) return;
    this.finished = true;
    audio.sfx('portal');
    this.hud.setActive(null);
    this.hud.setBanner('Escaped');
    this.hud.setLog('You slip away from the fight — no spoils, but you live.');
    await sleep(1300);
    // Resume the crawl in place; no rewards, no captures claimed.
    const params: DungeonSceneParams = { resume: true, battleResult: 'flee', eventId: this.params.eventId };
    await this.ctx.go(this.params.returnTo, params);
  }

  private async onDefeat() {
    if (this.finished) return;
    this.finished = true;
    audio.sfx('defeat');
    this.hud.setBanner('Defeat');
    this.hud.setLog('The lantern goes dark...');
    await sleep(1600);
    await this.ctx.go('gameover');
  }

  // --- frame ---------------------------------------------------------------

  override update(dt: number, time: number) {
    for (const bb of this.sprites.values()) bb.update(dt, this.ctx.hd2d.camera, time);
    for (const t of this.torches) t.update(dt, this.ctx.hd2d.camera, time);
    // Each monster's signature aura trails its live sprite position; a fainted
    // fighter's aura goes quiet.
    for (const [uid, aura] of this.auras) {
      const bb = this.sprites.get(uid);
      const battler = this.battle.find(uid);
      if (!bb || !battler) continue;
      const height = species(battler.creature.speciesId).height;
      aura.update(dt, time, bb.object.position, height, isUp(battler.creature));
    }
    this.particles.update(dt);
    // Slow drift keeps the arena from feeling like a static screenshot.
    this.ctx.hd2d.cameraTarget.set(Math.sin(time * 0.25) * 0.35, 0, CAMERA_BIAS_Z + Math.cos(time * 0.2) * 0.2);
  }

  async exit() {
    this.finished = true;
    this.unsubInput?.();
    this.unsubInput = null;
    this.hud.destroy();
    this.dialogue.destroy();
    for (const bb of this.sprites.values()) bb.dispose();
    for (const a of this.auras.values()) a.dispose();
    this.particles.dispose();
    this.scene.clear();
  }
}
