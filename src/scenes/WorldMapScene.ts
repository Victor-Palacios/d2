import * as THREE from 'three';
import { GameScene } from '../engine/SceneManager';
import { ParticleField } from '../engine/fx';
import { floorTexture } from '../engine/pixel';
import { audio } from '../engine/Audio';
import { game } from '../systems/party/gameState';
import { saveAuto } from '../systems/party/saveGame';
import { REACH_ORDER, reach } from '../data/reaches';
import { CardSelect } from '../ui/CardSelect';
import type { Card } from '../ui/CardSelect';

interface Node3D {
  mesh: THREE.Mesh;
  light: THREE.PointLight;
  x: number;
}

/** Rough party strength for the readiness cue: the average party level, min 1. */
function partyLevel(): number {
  const p = game.party;
  if (!p.length) return 1;
  return Math.max(1, Math.round(p.reduce((s, c) => s + c.level, 0) / p.length));
}

/**
 * World map (plan §2.3): a two-node select — the city you are standing in, and
 * the first reach. The 3D layer is a lit relief map so the screen still reads
 * as part of the same game rather than a menu bolted on top.
 */
export class WorldMapScene extends GameScene {
  private scene = new THREE.Scene();
  private particles!: ParticleField;
  private nodes: Node3D[] = [];
  private select: CardSelect | null = null;

  async enter() {
    this.buildMap();

    this.ctx.hd2d.setScene(this.scene);
    this.ctx.hd2d.applyFog(this.scene, 1.1);
    this.ctx.hd2d.cameraTarget.set(0, 0, 0);
    this.ctx.hd2d.lightTarget.set(0, 0, 2);
    this.ctx.hd2d.focusTarget.set(0, 0.6, 0);
    this.ctx.hd2d.snapCamera();
    audio.music('hub');
    // Safe zone, so it is an autosave point like the city.
    if (game.has('prologueDone')) saveAuto('worldmap', 'Reach map');

    void this.choose();
  }

  private buildMap() {
    this.particles = new ParticleField(240);
    this.scene.add(this.particles.points);

    const plateGeo = new THREE.PlaneGeometry(2, 2);
    plateGeo.rotateX(-Math.PI / 2);
    const plateMat = new THREE.MeshStandardMaterial({
      map: floorTexture('map', '#26304a', 41),
      roughness: 0.95,
    });
    for (let x = -5; x <= 5; x++) {
      for (let z = -3; z <= 3; z++) {
        const m = new THREE.Mesh(plateGeo, plateMat);
        m.position.set(x * 2, -0.2, z * 2);
        m.receiveShadow = true;
        this.scene.add(m);
      }
    }

    const makeNode = (x: number, color: number, height: number) => {
      const geo = new THREE.CylinderGeometry(0.9, 1.15, height, 8);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x1b2440,
        emissive: new THREE.Color(color),
        emissiveIntensity: 1.6,
        roughness: 0.5,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, height / 2 - 0.2, 0);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      const light = new THREE.PointLight(color, 6, 9, 1.7);
      light.position.set(x, height + 0.6, 0);
      this.scene.add(light);
      this.nodes.push({ mesh, light, x });
    };

    // One node for The Everwake, then one per registered reach.
    const count = REACH_ORDER.length + 1;
    const span = 9;
    const xAt = (i: number) => (count > 1 ? -span / 2 + (span * i) / (count - 1) : 0);
    makeNode(xAt(0), 0x6fd3ff, 1.5);
    REACH_ORDER.forEach((id, i) => {
      const color = parseInt(reach(id).color.slice(1), 16);
      makeNode(xAt(i + 1), color, 1.7 + (i % 2) * 0.4);
    });

    // A dotted route running through all the nodes.
    const dotGeo = new THREE.SphereGeometry(0.12, 8, 6);
    const dotMat = new THREE.MeshStandardMaterial({
      color: 0x101828,
      emissive: 0x8fb8ff,
      emissiveIntensity: 1.4,
    });
    const x0 = xAt(0);
    const x1 = xAt(count - 1);
    for (let i = 1; i < 12; i++) {
      const d = new THREE.Mesh(dotGeo, dotMat);
      d.position.set(x0 + ((x1 - x0) * i) / 12, 0.15, 0);
      this.scene.add(d);
    }
  }

  private async choose() {
    const cards: Card[] = [
      {
        value: 'city',
        title: 'The Everwake',
        tag: 'Safe zone',
        tagColor: '#6fd3ff',
        body: 'The supply bay, the keepers’ hall, and everyone who wants something from you. Go back inside.',
      },
      ...REACH_ORDER.map((id): Card => {
        const d = reach(id);
        const cleared = game.has(d.onClear.flag);
        // Story gate: a reach stays locked until its prerequisite flag is set.
        const locked = !!d.requires && !game.has(d.requires);
        const tag = locked
          ? 'Locked'
          : id === 'crossing' && !cleared
            ? 'Mission 1'
            : cleared
              ? 'Cleared'
              : d.side
                ? 'Side path'
                : 'Open';
        // Readiness cue: green if your party meets the recommendation, amber if
        // close, red if under-levelled — so the intended order reads at a glance.
        const rec = d.recommendedLevel;
        const partyLv = partyLevel();
        const recColor = partyLv >= rec ? '#7bdc8a' : partyLv >= rec - 2 ? '#ffd166' : '#ff6b6b';
        // Name the reach whose clearing unlocks this one, for the locked hint.
        // The finale is gated on a story flag, not a reach clear, so hint that.
        const gate = REACH_ORDER.map(reach).find((x) => x.onClear.flag === d.requires);
        const gateNote = d.requires === 'actTwo' ? 'Locked · it opens only after your darkest hour' : null;
        return {
          value: id,
          title: d.name,
          tag,
          tagColor: locked ? '#8a90a6' : d.color,
          disabled: locked,
          disabledNote: locked ? (gateNote ?? (gate ? `Locked · clear ${gate.name} first` : 'Locked')) : undefined,
          body:
            `<span style="color:${recColor}">◆ Recommended Lv ${rec}</span>` +
            `<span class="dim"> · your party ~Lv ${partyLv}</span><br><br>` +
            `${d.blurb}<br><br><span class="dim">${d.floors.length} floors · LP ${d.startingLight}</span>`,
        };
      }),
    ];

    this.select = new CardSelect(this.ctx.ui, cards, {
      heading: 'REACH MAP',
      subheading: 'Select a destination',
    });
    const choice = await this.select.open();
    this.select.destroy();
    this.select = null;

    if (choice && choice !== 'city') {
      game.activeReachId = choice;
      const d = reach(choice);
      game.maxLight = d.startingLight;
      game.resetCrawl();
      await this.ctx.go('dungeon');
    } else {
      await this.ctx.go('hub');
    }
  }

  override update(dt: number, time: number) {
    this.particles.update(dt);
    this.nodes.forEach((n, i) => {
      n.mesh.rotation.y = time * (0.35 + i * 0.12);
      n.light.intensity = 5.5 + Math.sin(time * 2 + i) * 1.4;
    });
    this.ctx.hd2d.cameraTarget.set(Math.sin(time * 0.2) * 1.2, 0, 0);
  }

  async exit() {
    this.select?.destroy();
    this.particles.dispose();
    this.scene.clear();
  }
}
