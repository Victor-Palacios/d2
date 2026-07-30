import * as THREE from 'three';
import { GameScene, sleep } from '../engine/SceneManager';
import { TileGrid } from '../engine/TileGrid';
import { Billboard } from '../engine/Billboard';
import { ParticleField, Portal, Torch } from '../engine/fx';
import { input } from '../engine/Input';
import { audio } from '../engine/Audio';
import { HUMANS } from '../assets/art';
import { TEAMS, team } from '../data/teams';
import { game } from '../systems/party/gameState';
import { saveAuto } from '../systems/party/saveGame';
import { fullRestore, makeCreature } from '../systems/party/creature';
import { DialogueBox } from '../ui/DialogueBox';
import { Menu } from '../ui/Menu';
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
  arrival?: 'first' | 'reachCleared' | 'towed' | 'teamChosen';
}

/**
 * The Everwake, simplified (plan §2.2, M4/M5).
 *
 * One room, walk-around movement, bump-to-talk NPCs and a portal to the world
 * map. This is also where the post-boss progression beats fire: licence,
 * Guard Team choice, rival intro and the Mission 2 briefing.
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

    // R1 / E / Start (Options) opens the main menu from town too.
    this.unsubInput = input.onAction((a) => {
      if (a === 'menu' || a === 'start') void this.openSoulMenu();
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
      { id: 'soulstore', art: 'soulkeeper', char: '5' },
    ];

    this.grid.forEach((t) => {
      if (t.kind !== 'event') return;
      const entry = roster.find((r) => r.char === t.eventId);
      if (!entry) return;
      // Halden is at his radio until the midpoint takes him.
      if (entry.id === 'mentor' && game.has('haldenGone')) return;
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
          'Halden',
          `This is the Everwake, ${game.playerName} — the last lit room before the dark. Souls gather here who cannot yet cross, and keepers tend them until they can.`,
          'You will not tend them alone. No keeper should — the dark is long, and grief is heavy to carry by yourself.',
        ),
      ]);
      await this.wrenJoin();
      if (this.disposed) return;
      await this.dialogue.play([
        ...say(
          'Halden',
          'Start at the Quiet Crossing, the pair of you. Tend what lingers, keep your light lit, and keep whatever you meet in your Soularium so it is not forgotten twice.',
        ),
        ...narrate('The south portal leads out to the reaches.'),
      ]);
    } else if (kind === 'towed') {
      await this.dialogue.play(
        say(
          'Halden',
          'A guttered lantern is not a failure. It is a debt to the dark, and the dark is patient.',
          'Refill your light, take the map again, and spend it carefully this time.',
        ),
      );
      game.resetCrawl();
      fullRestore(game.party);
    } else if (kind === 'reachCleared') {
      await this.licenseCeremony();
    } else if (kind === 'teamChosen') {
      await this.rivalAndBriefing();
    }

    // Companions join at story beats — on the next return to the Everwake after
    // the reach that earns them. Each fires once (guarded by its flag). Placed
    // before the midpoint so the party is whole when Halden dies.
    if (game.has('crystalCleared') && !game.has('senaJoined')) {
      await this.senaJoin();
      if (this.disposed) return;
    }
    if (game.has('hauntedCleared') && !game.has('kadeJoined')) {
      await this.kadeJoin();
      if (this.disposed) return;
    }

    // The Overgrowth's own aftermath: clearing it unroots the souls Liora Fen
    // kept, and she follows the light home to cross. A self-contained side-beat
    // (fires once), independent of the main-line midpoint below.
    if (game.has('jungleCleared') && !game.has('jungleWakeDone')) {
      await this.jungleAftermath();
      if (this.disposed) return;
    }

    // Midpoint: once all three reaches are quiet, the one death the Keeping
    // cannot answer. Fires once, whenever the player next stands in the Everwake.
    if (
      game.has('crossingCleared') &&
      game.has('crystalCleared') &&
      game.has('hauntedCleared') &&
      !game.has('midpointDone')
    ) {
      await this.midpoint();
    }

    this.busy = false;
    if (this.disposed) return;

    // Autosave point: the city is the one place the run is unambiguously safe,
    // and saving here keeps the out-of-EP tow a real cost rather than something
    // you reload away.
    if (game.has('prologueDone') && saveAuto('hub', 'The Everwake')) {
      toast(this.ctx.ui, '<span class="dim">Game saved</span>', 1400);
    }
  }

  private async licenseCeremony() {
    fullRestore(game.party);
    await this.dialogue.play([
      ...narrate('The Quiet Crossing settles behind you. Your lantern is low, but it is lit.'),
      ...say(
        'Chief Marrow',
        'The Vigil let you pass on your first crossing. That is either talent or mercy, and I will take either.',
        `You keep in full now, ${game.playerName}.`,
      ),
      ...say(
        'Halden',
        'The lantern is yours to carry, and your bonded soul has earned its place in it. Tend the reaches gently. Most of what you meet only wants to be remembered — or let go.',
      ),
    ]);
    game.hasLicense = true;
    game.set('licensed');
    toast(this.ctx.ui, '<span class="accent">Keeper\'s lantern acquired</span>', 2600);
    await sleep(1200);
    await this.dialogue.play([
      ...say(
        'Wren',
        'Two reaches lie open past the Crossing — the Reliquary, all kept light, and the Overgrowth, all patient green. I have a name waiting in each.',
      ),
      ...say(
        'Halden',
        'Go where the grief is loudest. That is always where you are needed — and, if you are honest with yourself, where you are looking.',
      ),
    ]);
  }

  // --- companions: the three keepers who join the journey ------------------

  /** Wren, the Bereaved Witness, joins at the Everwake (opening). */
  private async wrenJoin() {
    game.set('wrenJoined');
    game.joinCompanion(makeCreature('wren', 2));
    await this.dialogue.play([
      ...narrate('A woman looks up from a great ledger, every page filled with names in a small, patient hand.'),
      ...say(
        'Wren',
        `So you are the new keeper. Good. I am Wren — I keep the Book of Names, so the ones who cross are not forgotten a second time.`,
        'You are looking for someone. Everyone who comes here is. I will help you look — and write down everyone we meet on the way. No one leaves this book.',
      ),
      ...narrate('Wren closes the ledger, takes up a lantern of her own, and falls in beside you.'),
    ]);
    toast(this.ctx.ui, '<span class="accent">Wren joins your party</span>', 2600);
  }

  /** Sena Vale, the Defier, joins after the Reliquary — nothing left to guard. */
  private async senaJoin() {
    game.set('senaJoined');
    game.joinCompanion(makeCreature('senaVale', 6));
    await this.dialogue.play([
      ...narrate('Sena Vale is waiting at the wake-fire when you come back from the Reliquary. The frost has gone out of her hands.'),
      ...say(
        'Sena Vale',
        'I have nothing left to guard. You took that from me — or gave it back. I cannot yet tell which.',
        'I kept one soul frozen for years and called it love. I would like to learn the other kind of love before I run out of people to try it on.',
      ),
      ...say('Sena Vale', 'Let me carry a lantern beside yours until I do.'),
    ]);
    toast(this.ctx.ui, '<span class="accent">Sena Vale joins your party</span>', 2600);
  }

  /** Kade, the rival who was always a reach ahead, joins after the Unremembered. */
  private async kadeJoin() {
    game.set('kadeJoined');
    game.joinCompanion(makeCreature('kade', 10));
    await this.dialogue.play([
      ...narrate('Kade is sitting on the Everwake steps — for once not a reach ahead of you. He does not look up straight away.'),
      ...say(
        'Kade',
        'I always ran the next reach first. Fastest keeper they had. You know why? So I never had to stand still long enough to feel any of it.',
        'The Unremembered caught me standing still. There is a name in there I have been outrunning for years, and it finally said mine back.',
      ),
      ...say('Kade', 'I am done running it. Slow me down — I will keep pace with you instead.'),
    ]);
    toast(this.ctx.ui, '<span class="accent">Kade joins your party</span>', 2600);
  }


  /**
   * The midpoint (design framework §11.4 / docs/NARRATIVE.md): the unanswerable
   * death. Halden dies the ordinary way — a whole life the lantern cannot keep —
   * and the player authors what is preserved. Then every philosophy hardens
   * (§11.3): the Defier turns coercive, the Bereaved turns captive, and the
   * Unfinished must face what all their Keeping has really been.
   */
  private async midpoint() {
    game.set('midpointDone');
    game.set('haldenGone');

    await this.dialogue.play([
      ...narrate(
        'You come back to the Everwake with all three reaches quiet behind you. The lanterns are lit. Halden is not at his radio.',
      ),
      ...narrate(
        'You find him in the back, his detective serial still murmuring a chapter from the end. He is not an echo. He is a person, and he is dying the ordinary way.',
      ),
      ...say(
        'Halden',
        `Ah. ${game.playerName}. I hoped it would be you who found me. Sit down. You do not have to fix your face.`,
      ),
    ]);

    await this.dialogue.play([
      ...narrate(
        'Without deciding to, you raise the lantern — the gesture that kept every soul in the reaches. Keep him. Hold him. Do not let him fade.',
      ),
      ...narrate(
        'Nothing happens. The lantern will not take him. He is not a lingering thing to be drawn in; he is a whole life, and a whole life cannot be kept that way.',
      ),
      ...say(
        'Halden',
        'No. Put it down. You cannot syphon a person — only the echo one leaves. I taught you to keep souls. I never taught you this, because I could not do it myself.',
      ),
      ...say(
        'Halden',
        'Keeping was never the same as loving. Some things you honour by holding on. The ones that matter most, you honour by letting go. That is the question the lantern was always asking you.',
      ),
      ...narrate('His hand goes still. The serial plays on to no one.'),
    ]);

    const choice = await this.chooseFarewell();
    if (choice === 'name') {
      game.set('mourn:name');
      await this.dialogue.play([
        ...narrate(
          'You write his name where it will be read, so the second death cannot have him. He will be remembered — held, a little, against his own advice.',
        ),
      ]);
    } else if (choice === 'work') {
      game.set('mourn:work');
      game.addItem('haldensSerial');
      await this.dialogue.play([
        ...narrate(
          'You take his chair, his radio, the serial with its last chapter unread. The duty is yours now. You carry the unfinished story with you.',
        ),
      ]);
      toast(this.ctx.ui, '<span class="accent">Got Halden\'s Serial</span> — a Memento', 2600);
    } else {
      game.set('mourn:letgo');
      await this.dialogue.play([
        ...narrate(
          'You keep nothing. You let the story stay unfinished, the chair stay empty, the name go unwritten. It is the hardest thing he taught you, and the last.',
        ),
      ]);
    }

    await sleep(700);
    await this.dialogue.play([
      ...narrate('Word travels the reaches. Grief does not soften the others. It sharpens them.'),
      ...say(
        'Sena Vale',
        'So you have felt it now. That is why I froze Lire — so I would never have to. Bring me a soul you love and I will do the same for you. You need never lose another.',
      ),
      ...say(
        'Wren',
        'I have added Halden to the Book. I add everyone. If every name is written down, then no one is truly gone — they are not gone — tell me they are not gone.',
      ),
      ...narrate(
        'And you: you have been keeping souls since the first lantern. You wonder, now, whether it was ever tending them — or only refusing, again and again, to let a single one go.',
      ),
    ]);
    game.set('actTwo');
    toast(this.ctx.ui, '<span class="accent">Act II — every philosophy hardens</span>', 3000);
  }

  /** The funeral choice (framework §10.5): the player authors what a life leaves behind. */
  private async chooseFarewell(): Promise<'name' | 'work' | 'letgo'> {
    const host = el('div', 'panel');
    host.style.cssText =
      'position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);min-width:340px;text-align:left;';
    host.appendChild(el('h2', undefined, 'What do you keep of him?'));
    this.ctx.ui.appendChild(host);
    const menu = new Menu(host, [
      { value: 'name', label: 'His name', note: 'write him in the Book of Names' },
      { value: 'work', label: 'His work', note: "take up the keeper's duty" },
      { value: 'letgo', label: 'Let him go', note: 'keep nothing; honour the lesson' },
    ]);
    const v = await menu.open();
    menu.destroy();
    remove(host);
    return (v ?? 'letgo') as 'name' | 'work' | 'letgo';
  }

  /**
   * The Overgrowth's aftermath (docs/NARRATIVE.md §11a): a self-contained
   * side-beat that pays off clearing the jungle. Liora Fen — who rooted other
   * souls so she would never sit alone — is unrooted now, and follows the light
   * to the Everwake to cross. It replays the dramatic question at a smaller,
   * quieter scale than the midpoint: keeping for company is still keeping. The
   * player names the truth of it (either answer is true) and she leaves a
   * Memento of the walk she stopped taking. Fires once.
   */
  private async jungleAftermath() {
    game.set('jungleWakeDone');

    await this.dialogue.play([
      ...narrate(
        'The Overgrowth lets go behind you — root by root, soul by soul, the way you unwound it. By the time you reach the Everwake, one of the freed has followed the light home.',
      ),
      ...narrate(
        'Liora Fen stands unsteady by the wake-fire, learning legs that were roots for longer than she can count. The souls she kept have already crossed. She waited, to watch each one go.',
      ),
      ...say(
        'Liora Fen',
        'They are gone. All of them. I thought that would feel like losing.',
        'It feels like a window opening in a room I had forgotten was shut.',
      ),
      ...say(
        'Liora Fen',
        `I told the ones I caught that I was giving them rest. ${game.playerName}, I was keeping myself company. I could not sit in that green alone, so I made sure I never had to.`,
      ),
    ]);

    const kind = await this.chooseLiora();
    if (kind === 'lonely') {
      game.set('mourn:liora:kind');
      await this.dialogue.play(
        say(
          'Liora Fen',
          'Lonely. Yes. You could have called it something worse and been just as right. Thank you for the gentler true thing.',
        ),
      );
    } else {
      game.set('mourn:liora:true');
      await this.dialogue.play(
        say(
          'Liora Fen',
          'Cruel. Yes — I stole years and called it kindness so I could keep stealing them. You did not look away from that. Good. Neither will I.',
        ),
      );
    }

    game.addItem('lioraStep');
    await this.dialogue.play([
      ...say('Liora Fen', 'Here. The first step of a walk I stopped taking. I have no more use for standing still.'),
      ...narrate(
        'She presses a worn charm into your hand — and then she is walking, at last, toward the dark that is only dark until you reach it.',
      ),
    ]);
    toast(this.ctx.ui, '<span class="accent">Got Liora\'s Step</span> — a Memento', 2600);
  }

  /** Liora's small farewell choice: name the truth of what her keeping was. */
  private async chooseLiora(): Promise<'lonely' | 'true'> {
    const host = el('div', 'panel');
    host.style.cssText =
      'position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);min-width:340px;text-align:left;';
    host.appendChild(el('h2', undefined, 'What do you tell her?'));
    this.ctx.ui.appendChild(host);
    const menu = new Menu(host, [
      { value: 'lonely', label: 'You were lonely', note: 'the gentler truth' },
      { value: 'true', label: 'You were cruel', note: 'the harder truth' },
    ]);
    const v = await menu.open();
    menu.destroy();
    remove(host);
    return (v ?? 'lonely') as 'lonely' | 'true';
  }

  private async rivalAndBriefing() {
    if (!game.has('rivalMet')) {
      game.set('rivalMet');
      await this.dialogue.play([
        ...narrate('Someone is already leaning on the supply bay counter, watching you come in.'),
        ...say(
          'Kade',
          `So you are the one who dropped the Vigil on your first crossing. Kade. Second year.`,
          'Enjoy the licence. The next reach does not hand them out.',
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
          `Briefing, ${game.playerName}. The Cache reach has been letting souls slip through uncrossed for a week now.`,
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
      '<p class="dim">Mission 2 — <span class="accent">the Cache reach</span> — is the hook the slice ends on.<br>' +
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
          'The next reach is your problem. Mine is the paperwork you just made.',
        );
      case 'mentor':
        if (!game.hasLicense) {
          return say(
            'Halden',
            'Ground rules. Attack is free, Techniques cost MP, Guard halves the hit and gives MP back.',
            'Assassin beats Mage. Mage beats Hero. Hero beats Assassin. Element plates buff whoever matches them.',
            'Every step in the reach spends 1 LP. Light shards are worth the detour.',
          );
        }
        return say(
          'Halden',
          'My three are back in their bay and only slightly on fire, so I will call that a success.',
          'Your starter is yours to raise now. Merging creatures comes later — not today.',
        );
      case 'vendor':
        if (!game.hasLicense) {
          return say('Quartermaster Ilsa', 'Supply bay is for licensed Keepers. Come back with a licence and credits.');
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
          'the Cache reach. That is where they are sending you next, right?',
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
      this.player.object.position.lerpVectors(this.moveFrom, this.moveTo, 1 - (1 - t) ** 2.2);
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
