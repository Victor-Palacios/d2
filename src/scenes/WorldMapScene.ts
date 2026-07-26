import * as THREE from 'three';
import { GameScene } from '../engine/SceneManager';
import type { SceneContext } from '../engine/SceneManager';
import { ParticleField } from '../engine/fx';
import { floorTexture } from '../engine/pixel';
import { audio } from '../engine/Audio';
import { game } from '../systems/party/gameState';
import { BOOT_DOMAIN } from '../data/bootDomain';
import { CardSelect } from '../ui/CardSelect';
import type { Card } from '../ui/CardSelect';

interface Node3D {
  mesh: THREE.Mesh;
  light: THREE.PointLight;
  x: number;
}

/**
 * World map (plan §2.3): a two-node select — the city you are standing in, and
 * the first domain. The 3D layer is a lit relief map so the screen still reads
 * as part of the same game rather than a menu bolted on top.
 */
export class WorldMapScene extends GameScene {
  private scene = new THREE.Scene();
  private particles!: ParticleField;
  private nodes: Node3D[] = [];
  private select: CardSelect | null = null;

  constructor(ctx: SceneContext) {
    super(ctx);
  }

  async enter() {
    this.buildMap();

    this.ctx.hd2d.setScene(this.scene);
    this.ctx.hd2d.applyFog(this.scene, 1.1);
    this.ctx.hd2d.cameraTarget.set(0, 0, 0);
    this.ctx.hd2d.lightTarget.set(0, 0, 2);
    this.ctx.hd2d.focusTarget.set(0, 0.6, 0);
    this.ctx.hd2d.snapCamera();
    audio.music('hub');

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

    makeNode(-4.2, 0x6fd3ff, 1.5);
    makeNode(4.2, 0xffa64d, 2.1);

    // A dotted route between the two nodes.
    const dotGeo = new THREE.SphereGeometry(0.12, 8, 6);
    const dotMat = new THREE.MeshStandardMaterial({
      color: 0x101828,
      emissive: 0x8fb8ff,
      emissiveIntensity: 1.4,
    });
    for (let i = 1; i < 9; i++) {
      const d = new THREE.Mesh(dotGeo, dotMat);
      d.position.set(-4.2 + (8.4 * i) / 9, 0.15, 0);
      this.scene.add(d);
    }
  }

  private async choose() {
    const cards: Card[] = [
      {
        value: 'city',
        title: 'Digital City',
        tag: 'Safe zone',
        tagColor: '#6fd3ff',
        body: 'Licence office, supply bay, and everyone who wants something from you. Go back inside.',
      },
      {
        value: 'boot',
        title: BOOT_DOMAIN.name,
        tag: game.has('bootDomainCleared') ? 'Cleared' : 'Mission 1',
        tagColor: '#ffa64d',
        body: `${BOOT_DOMAIN.blurb}<br><br><span class="dim">3 floors · warden present · EP ${game.maxFuel}</span>`,
      },
    ];

    this.select = new CardSelect(this.ctx.ui, cards, {
      heading: 'DOMAIN MAP',
      subheading: 'Select a destination',
    });
    const choice = await this.select.open();
    this.select.destroy();
    this.select = null;

    if (choice === 'boot') {
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
