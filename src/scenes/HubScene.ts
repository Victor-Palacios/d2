import * as THREE from 'three';
import { GameScene, sleep } from '../engine/SceneManager';
import type { SceneContext } from '../engine/SceneManager';
import { TileGrid } from '../engine/TileGrid';
import { Billboard } from '../engine/Billboard';
import { ParticleField, Portal, Torch } from '../engine/fx';
import { input } from '../engine/Input';
import { audio } from '../engine/Audio';
import { HUMANS } from '../assets/art';
import { TEAMS, team } from '../data/teams';
import { game } from '../systems/party/gameState';
import { saveAuto } from '../systems/party/saveGame';
import { fullRestore } from '../systems/party/creature';
import { DialogueBox } from '../ui/DialogueBox';
import { openShop } from '../ui/ShopScreen';
import { openSoulMenu } from '../ui/SoulMenu';
import { openSoulStore } from '../ui/SoulStore';
import { toast } from '../ui/Toast';
import { el, remove } from '../ui/dom';
import { narrate, say } from '../systems/dialogue/script';
import type { DialogueScript } from '../systems/dialogue/script';

type Facing = 'up' | 'down' | 'left' | 'right';

const HUB_ROWS = [
  '#############',
  '#...........#',
  '#..1.....2..#',
  '#.....5.....#',
  '#.....S.....#',
  '#...........#',
  '#..3.....4..#',
  '#.....>.....#',
  '#############',
];

const HUB_THEME = {
  floor: '#3f4763',
  floorAlt: '#353c56',
  wall: '#4d5570',
  wallTop: '#2a2f45',
  accentWall: '#3f5c7a',
};

interface Npc {
  id: string;
  x: number;
  z: number;
  art: string;
  billboard: Billboard;
}

export interface HubSceneParams {
  arrival?: 'first' | 'domainCleared' | 'towed' | 'teamChosen';
}

/**
 * Digital City, simplified (plan §2.2, M4/M5).
 *
 * One room, walk-around movement, bump-to-talk NPCs and a portal to the world
 * map. This is also where the post-boss progression beats fire: licence, own
 * vehicle, Guard Team choice, rival intro and the Mission 2 briefing.
 */
export class HubScene extends GameScene {
  private scene = new THREE.Scene();
  private grid = new TileGrid(HUB_ROWS, HUB_THEME);
  private player!: Billboard;
  private npcs: Npc[] = [];
  private particles!: ParticleField;
  private torches: Torch[] = [];
  private portal!: Portal;
  private dialogue!: DialogueBox;
  private legend!: HTMLElement;
  private banner: HTMLElement | null = null;

  private tileX = 0;
  private tileZ = 0;
  private moving = false;
  private moveFrom = new THREE.Vector3();
  private moveTo = new THREE.Vector3();
  private moveT = 0;
  /** Direction pressed while a step was in flight (input buffering). */
  private buffered: Facing | null = null;
  private busy = false;
  private leaving = false;
  private unsubInput: (() => void) | null = null;

  constructor(ctx: SceneContext) {
    super(ctx);
  }

  async enter(params?: unknown) {
    const p = (params ?? {}) as HubSceneParams;

    this.build();
    this.dialogue = new DialogueBox(this.ctx.ui);
    this.legend = el('div');
    this.legend.id = 'legend';
    this.legend.innerHTML = 'MOVE arrows/WASD · walk into people to talk · south portal = world map';
    this.ctx.ui.appendChild(this.legend);

    this.tileX = this.grid.start.x;
    this.tileZ = this.grid.start.z;
    this.player.object.position.copy(this.grid.worldPos(this.tileX, this.tileZ));

    this.ctx.hd2d.setScene(this.scene);
    this.ctx.hd2d.applyFog(this.scene, 0.7);
    this.ctx.hd2d.snapCamera();
    this.syncCamera();
    audio.music('hub');

    void this.arrival(p.arrival);

    // R1 / E opens the Soul menu (Soularium + Sanctuary) from town too.
    this.unsubInput = input.onAction((a) => {
      if (a === 'menu') void this.openSoulMenu();
    });
  }

  /** R1 / E: Soularium + Sanctuary. Blocks movement while open. */
  private async openSoulMenu() {
    if (this.busy || this.leaving || this.moving) return;
    this.busy = true;
    await openSoulMenu(this.ctx.ui);
    this.busy = false;
  }

  // --- world ---------------------------------------------------------------

  private build() {
    const built = this.grid.build();
    this.scene.add(built.group);

    this.particles = new ParticleField(300);
    this.scene.add(this.particles.points);

    this.player = new Billboard(HUMANS.hero, 'human:hero', { height: 1.55 });
    this.player.bob = 0.02;
    this.player.bobSpeed = 4;
    this.scene.add(this.player.object);

    const roster: { id: string; art: string; char: string }[] = [
      { id: 'chief', art: 'chief', char: '1' },
      { id: 'mentor', art: 'mentor', char: '2' },
      { id: 'vendor', art: 'vendor', char: '3' },
      { id: 'rival', art: 'rival', char: '4' },
      { id: 'soulstore', art: 'soulkeeper', char: '5' },
    ];

    this.grid.forEach((t) => {
      if (t.kind !== 'event') return;
      const entry = roster.find((r) => r.char === t.eventId);
      if (!entry) return;
      // The rival only shows up once you are licensed.
      if (entry.id === 'rival' && !game.has('bootDomainCleared')) return;
      const b = new Billboard(HUMANS[entry.art], `human:${entry.art}`, { height: 1.6 });
      b.bob = 0.025;
      b.object.position.copy(this.grid.worldPos(t.x, t.z));
      this.scene.add(b.object);
      this.npcs.push({ id: entry.id, x: t.x, z: t.z, art: entry.art, billboard: b });
    });

    this.grid.forEach((t) => {
      if (t.kind !== 'portal') return;
      this.portal = new Portal(this.particles, 0x8ff0ff, false);
      this.portal.object.position.copy(this.grid.worldPos(t.x, t.z));
      this.scene.add(this.portal.object);
    });

    for (const [x, z] of [
      [2, 1],
      [10, 1],
    ]) {
      const torch = new Torch(this.particles);
      const p = this.grid.worldPos(x, z);
      torch.object.position.set(p.x, 1.1, p.z - 0.85);
      this.scene.add(torch.object);
      this.torches.push(torch);
    }
  }

  // --- story beats ---------------------------------------------------------

  private async arrival(kind: HubSceneParams['arrival']) {
    await sleep(280);
    if (this.disposed) return;
    this.busy = true;

    if (kind === 'first') {
      await this.dialogue.play([
        ...say(
          'Chief Marrow',
          `${game.playerName}. Halden vouched for you, so here is the short version.`,
          'Take a training beetle into the Quiet Crossing, clear it, come back breathing. Then you get a licence.',
        ),
        ...say('Dr. Halden', `${game.party[0]?.name ?? 'Your partner'} rides with you — and syphon whatever else you meet in there.`),
        ...narrate('The south portal leads to the domain map.'),
      ]);
    } else if (kind === 'towed') {
      await this.dialogue.play(
        say(
          'Dr. Halden',
          'The tow line is not a failure. It is a receipt.',
          'Refuel, take the map again, and mind the EP this time.',
        ),
      );
      game.resetCrawl();
      fullRestore(game.party);
    } else if (kind === 'domainCleared') {
      await this.licenseCeremony();
    } else if (kind === 'teamChosen') {
      await this.rivalAndBriefing();
    }

    this.busy = false;
    if (this.disposed) return;

    // Autosave point: the city is the one place the run is unambiguously safe,
    // and saving here keeps the out-of-EP tow a real cost rather than something
    // you reload away.
    if (game.has('prologueDone') && saveAuto('hub', 'Digital City')) {
      toast(this.ctx.ui, '<span class="dim">Game saved</span>', 1400);
    }
  }

  private async licenseCeremony() {
    fullRestore(game.party);
    await this.dialogue.play([
      ...narrate('The Quiet Crossing closes behind you. The beetle is scorched but intact.'),
      ...say(
        'Chief Marrow',
        'Warden down on a training run. That is either talent or luck, and I take both.',
        `Licence approved, driver ${game.playerName}.`,
      ),
      ...say('Dr. Halden', 'The beetle is yours now, and your partner has earned its keep. Do not make me regret the paperwork.'),
    ]);
    game.hasLicense = true;
    game.hasOwnVehicle = true;
    game.set('licensed');
    toast(this.ctx.ui, '<span class="accent">Licence acquired · Own vehicle acquired</span>', 2600);
    await sleep(1200);

    // The rival is already standing in the room (build() shows them once the
    // Boot Domain is cleared), so go straight into the next story beat.
    await this.rivalAndBriefing();
  }

  private async rivalAndBriefing() {
    if (!game.has('rivalMet')) {
      game.set('rivalMet');
      await this.dialogue.play([
        ...narrate('Someone is already leaning on the supply bay counter, watching you come in.'),
        ...say(
          'Kade',
          `So you are the one who dropped the Boot warden on a training run. Kade. Second year.`,
          'Enjoy the licence. The next domain does not hand them out.',
        ),
        ...say('Kade', 'Try to keep up, rookie.'),
      ]);
    }
    if (!game.has('mission2')) {
      const leader = game.teamId ? team(game.teamId) : TEAMS[0];
      game.set('mission2');
      await this.dialogue.play([
        ...say(
          leader.leaderName,
          `Briefing, ${game.playerName}. Sector two — the Cache Domain — has been dropping packets for a week.`,
          'Refit at the supply bay, then take the map when you are ready. That is your mission.',
        ),
      ]);
      this.showSliceEnd();
    }
  }

  private showSliceEnd() {
    this.banner = el('div', 'panel');
    this.banner.style.cssText =
      'position:absolute;left:50%;top:18%;transform:translateX(-50%);text-align:center;max-width:600px;';
    this.banner.innerHTML =
      '<h2>End of the first hour</h2>' +
      '<p class="dim">Mission 2 — <span class="accent">Cache Domain</span> — is the hook the slice ends on.<br>' +
      'The city, the shop and the Quiet Crossing stay open: walk into the vendor to buy, or take the south portal to crawl again.</p>';
    this.ctx.ui.appendChild(this.banner);
  }

  // --- interaction ---------------------------------------------------------

  private async talkTo(npc: Npc) {
    this.busy = true;
    await this.dialogue.play(this.scriptFor(npc));
    this.busy = false;

    if (npc.id === 'vendor' && game.hasLicense) {
      this.busy = true;
      await openShop(this.ctx.ui);
      this.busy = false;
    }

    if (npc.id === 'soulstore') {
      this.busy = true;
      await openSoulStore(this.ctx.ui);
      this.busy = false;
    }
  }

  private scriptFor(npc: Npc): DialogueScript {
    const leader = game.teamId ? team(game.teamId) : null;
    switch (npc.id) {
      case 'chief':
        if (!game.hasLicense) {
          return say(
            'Chief Marrow',
            'The Quiet Crossing. Three floors, one warden. Take the south portal when you are ready.',
            'And Halden will not stop asking, so: bring his creatures back.',
          );
        }
        return say(
          'Chief Marrow',
          `Licensed and teamed. You are ${leader ? leader.name : 'Guard'} now, ${game.playerName}.`,
          'Sector two is your problem. Mine is the paperwork you just made.',
        );
      case 'mentor':
        if (!game.hasLicense) {
          return say(
            'Dr. Halden',
            'Ground rules. Attack is free, Techniques cost MP, Guard halves the hit and gives MP back.',
            'Assassin beats Mage. Mage beats Hero. Hero beats Assassin. Element plates buff whoever matches them.',
            'Every step in the domain costs 1 EP. Fuel canisters are worth the detour.',
          );
        }
        return say(
          'Dr. Halden',
          'My three are back in their bay and only slightly on fire, so I will call that a success.',
          'Your starter is yours to raise now. Merging creatures comes later — not today.',
        );
      case 'vendor':
        if (!game.hasLicense) {
          return say('Quartermaster Ilsa', 'Supply bay is for licensed drivers. Come back with a licence and credits.');
        }
        return say('Quartermaster Ilsa', 'Licensed, then. Take a look — the bay is open.');
      case 'soulstore':
        return say(
          'Soul Broker Vex',
          'Welcome to the Soul Store. Syphon a soul in the field and I can conjure you a copy — for a price.',
          'I also sell capacity: more room in your active party. Souls you cannot carry rest in the Sanctuary.',
        );
      case 'rival':
        return say(
          'Kade',
          'Cache Domain. That is where they are sending you next, right?',
          'I ran it last season. Bring more than one creature.',
        );
      default:
        return narrate('...');
    }
  }

  // --- movement ------------------------------------------------------------

  private tryStep(dir: Facing) {
    if (this.moving || this.busy || this.leaving) return;
    const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
    const nx = this.tileX + d[0];
    const nz = this.tileZ + d[1];

    const npc = this.npcs.find((n) => n.x === nx && n.z === nz);
    if (npc) {
      audio.sfx('confirm');
      void this.talkTo(npc);
      return;
    }
    if (!this.grid.walkable(nx, nz)) {
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
  }

  private async onArrive() {
    const t = this.grid.at(this.tileX, this.tileZ);
    if (t?.kind === 'portal') {
      if (this.leaving) return;
      this.leaving = true;
      audio.sfx('portal');
      await this.ctx.go('worldmap');
    }
  }

  private syncCamera() {
    const p = this.player.object.position;
    this.ctx.hd2d.cameraTarget.set(p.x * 0.35, 0, p.z * 0.35);
    this.ctx.hd2d.lightTarget.set(p.x, 0, p.z);
    this.ctx.hd2d.focusTarget.set(p.x, 0.8, p.z);
  }

  override update(dt: number, time: number) {
    if (this.leaving) return;
    const pressed = input.stepDirection();
    if (pressed) this.buffered = pressed as Facing;
    if (this.busy || this.dialogue.visible) this.buffered = null;

    if (this.moving) {
      this.moveT += dt / 0.17;
      const t = Math.min(1, this.moveT);
      this.player.object.position.lerpVectors(this.moveFrom, this.moveTo, 1 - Math.pow(1 - t, 2.2));
      if (t >= 1) {
        this.moving = false;
        void this.onArrive();
      }
    } else if (!this.busy && !this.dialogue.visible && this.buffered) {
      const dir = this.buffered;
      this.buffered = null;
      this.tryStep(dir);
    }

    this.player.update(dt, this.ctx.hd2d.camera, time);
    for (const n of this.npcs) n.billboard.update(dt, this.ctx.hd2d.camera, time);
    for (const t of this.torches) t.update(dt, this.ctx.hd2d.camera, time);
    this.portal?.update(dt, time);
    this.particles.update(dt);
    this.syncCamera();
  }

  async exit() {
    this.unsubInput?.();
    this.unsubInput = null;
    this.dialogue.destroy();
    remove(this.legend);
    remove(this.banner);
    this.player.dispose();
    for (const n of this.npcs) n.billboard.dispose();
    this.particles.dispose();
    this.scene.clear();
  }
}
