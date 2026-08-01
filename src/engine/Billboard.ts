import * as THREE from 'three';
import { artAspect, spriteTexture, mirrorTexture } from './pixel';
import type { PixelArt } from './pixel';

/**
 * A pixel-art sprite living in the 3D world (plan §3, "the 2D half").
 *
 * - textured plane, `NearestFilter`, mipmaps off  -> crisp pixels
 * - `alphaTest` instead of transparency           -> the shadow follows the
 *   sprite silhouette rather than the quad, which is what actually sells the
 *   "2D character inside a 3D room" illusion
 * - anchored at its base                          -> the sprite stands *on* the
 *   floor and its shadow grounds it
 */

export type BillboardMode = 'y' | 'full' | 'fixed';

export interface BillboardOptions {
  /** World-space height of the sprite; width follows the art's aspect ratio. */
  height?: number;
  /** 'y' = cardboard standee (default), 'full' = always faces camera exactly. */
  mode?: BillboardMode;
  /** Extra self-illumination, for glowing creatures / effects. */
  emissive?: number;
  /** Casts a shadow from the key light. On by default — this is the money shot. */
  castShadow?: boolean;
  /** Lifts the sprite off the floor (floating creatures). */
  hover?: number;
}

export class Billboard {
  readonly object = new THREE.Group();
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  readonly mode: BillboardMode;

  private baseScale = new THREE.Vector3(1, 1, 1);
  private bobPhase = Math.random() * Math.PI * 2;
  private flash = 0;
  private hoverAmount: number;
  private height: number;

  /** Vertical bob amplitude (0 disables). */
  bob = 0.03;
  /** Bob speed multiplier. */
  bobSpeed = 2.2;
  /**
   * Walk cycle. When `walkBounce > 0` and the owner feeds step progress via
   * `setStride`, the sprite bounces on each footfall and rocks side to side so a
   * tile step reads as a stride rather than a glide. 0 keeps the plain idle bob
   * (every non-walking billboard).
   */
  walkBounce = 0;
  /** Footfalls per tile step — 2 reads as a left-right stride. */
  walkSteps = 2;
  /** Step progress 0..1 fed by the owner while moving; -1 means standing still. */
  private walkT = -1;
  /**
   * How far the sprite leans back toward the camera, 0..1 of the camera's
   * pitch. A pure upright billboard is badly foreshortened under the ¾
   * dungeon-crawler angle; leaning it back keeps the art readable while the
   * base stays planted on the floor (the group pivot is at the sprite's feet).
   */
  tilt = 0.8;

  constructor(art: PixelArt, id: string, opts: BillboardOptions = {}) {
    this.height = opts.height ?? 1.4;
    this.mode = opts.mode ?? 'y';
    this.hoverAmount = opts.hover ?? 0;

    const tex = spriteTexture(id, art);
    const aspect = artAspect(art);
    const geo = new THREE.PlaneGeometry(this.height * aspect, this.height);
    // Anchor at the base: origin sits on the floor.
    geo.translate(0, this.height / 2, 0);

    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      alphaTest: 0.5,
      transparent: false,
      side: THREE.DoubleSide,
      roughness: 0.95,
      metalness: 0,
      emissive: new THREE.Color(0xffffff),
      emissiveMap: tex,
      emissiveIntensity: opts.emissive ?? 0.06,
    });

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = opts.castShadow ?? true;
    this.mesh.receiveShadow = false;
    this.mesh.position.y = this.hoverAmount;
    this.object.add(this.mesh);
  }

  /** Swaps the displayed art (facing changes, chest open/closed, ...). */
  setArt(art: PixelArt, id: string, mirrored = false) {
    this.mesh.material.map = mirrored ? mirrorTexture(id, art) : spriteTexture(id, art);
    this.mesh.material.emissiveMap = this.mesh.material.map;
    this.mesh.material.needsUpdate = true;
  }

  get position(): THREE.Vector3 {
    return this.object.position;
  }

  setScale(s: number) {
    this.baseScale.setScalar(s);
  }

  /** White hit-flash, decays on its own. */
  hit(strength = 1) {
    this.flash = strength;
  }

  setOpacity(o: number) {
    const m = this.mesh.material;
    if (o >= 1) {
      m.transparent = false;
      m.opacity = 1;
    } else {
      m.transparent = true;
      m.opacity = o;
    }
    m.needsUpdate = true;
  }

  setVisible(v: boolean) {
    this.object.visible = v;
  }

  /**
   * Drive the walk cycle. The owner calls this each frame of a tile step with
   * progress in [0,1]; pass a negative value (or omit) to return to idle. The
   * cycle is authored to be zero at both ends of a step, so idle ↔ walk needs no
   * blending.
   */
  setStride(t: number) {
    this.walkT = t;
  }

  update(dt: number, camera: THREE.Camera, time: number) {
    if (this.mode === 'y') {
      // Cardboard-standee billboarding: yaw to the camera, then lean back by a
      // fraction of the camera's pitch. Rotation order YXZ so the lean happens
      // in the sprite's own space after the yaw.
      const dx = camera.position.x - this.object.position.x;
      const dz = camera.position.z - this.object.position.z;
      const dy = camera.position.y - this.object.position.y;
      const pitch = Math.atan2(dy, Math.hypot(dx, dz));
      this.object.rotation.order = 'YXZ';
      this.object.rotation.set(-pitch * this.tilt, Math.atan2(dx, dz), 0);
    } else if (this.mode === 'full') {
      this.object.quaternion.copy(camera.quaternion);
    }

    // Vertical motion: a plain idle bob for most sprites, or — for anything with
    // a walk cycle mid-step — a footfall bounce plus a side-to-side body rock, so
    // it strides instead of floating. The cycle zeroes at t=0 and t=1, so it
    // hands off to the idle pose with no snap.
    let y = this.hoverAmount;
    if (this.walkBounce > 0 && this.walkT >= 0) {
      const t = this.walkT;
      const bounce = Math.abs(Math.sin(t * this.walkSteps * Math.PI)) * this.walkBounce;
      const rock = Math.sin(t * Math.PI * 2);
      y += bounce;
      this.mesh.position.x = rock * this.walkBounce * 0.5;
      this.mesh.rotation.z = -rock * 0.1;
    } else {
      if (this.walkBounce > 0) {
        this.mesh.position.x = 0;
        this.mesh.rotation.z = 0;
      }
      if (this.bob > 0) y += Math.sin(time * this.bobSpeed + this.bobPhase) * this.bob;
    }
    this.mesh.position.y = y;

    this.object.scale.copy(this.baseScale);

    if (this.flash > 0.002) {
      this.flash *= Math.exp(-dt * 9);
      this.mesh.material.emissiveIntensity = 0.06 + this.flash * 2.4;
    } else if (this.flash !== 0) {
      this.flash = 0;
      this.mesh.material.emissiveIntensity = 0.06;
    }
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
