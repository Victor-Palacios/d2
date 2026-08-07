import * as THREE from 'three';
import { mistTexture, radialTexture } from './pixel';
import { Billboard } from './Billboard';
import { PROPS } from '../assets/art';
import type { BattleAura } from '../data/battleFx';

/**
 * Particle and light FX for the polish pass (plan §6, M6): torch flicker, hit
 * sparks, element-tile shimmer and portal glow. Everything additive so it
 * lands in the bloom threshold and reads as "HD".
 */

interface Particle {
  life: number;
  maxLife: number;
  vel: THREE.Vector3;
  gravity: number;
  size: number;
  color: THREE.Color;
}

export interface EmitOptions {
  count?: number;
  speed?: number;
  spread?: number;
  life?: number;
  gravity?: number;
  size?: number;
  color?: THREE.ColorRepresentation;
  upBias?: number;
}

export class ParticleField {
  readonly points: THREE.Points;
  private particles: Particle[] = [];
  private positions: Float32Array;
  private colors: Float32Array;
  private sizes: Float32Array;
  private cursor = 0;

  constructor(
    private capacity = 400,
    color = '#ffffff',
    size = 0.18,
  ) {
    const geo = new THREE.BufferGeometry();
    this.positions = new Float32Array(capacity * 3);
    this.colors = new Float32Array(capacity * 3);
    this.sizes = new Float32Array(capacity);
    for (let i = 0; i < capacity; i++) {
      this.positions[i * 3 + 1] = -9999;
      this.sizes[i] = size;
      this.particles.push({
        life: 0,
        maxLife: 1,
        vel: new THREE.Vector3(),
        gravity: 0,
        size,
        color: new THREE.Color(),
      });
    }
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

    const mat = new THREE.PointsMaterial({
      size,
      map: radialTexture('spark', color),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  emit(origin: THREE.Vector3, opts: EmitOptions = {}) {
    const count = opts.count ?? 10;
    const speed = opts.speed ?? 2.2;
    const spread = opts.spread ?? 1;
    const life = opts.life ?? 0.6;
    const color = new THREE.Color(opts.color ?? 0xffffff);
    for (let i = 0; i < count; i++) {
      const idx = this.cursor;
      this.cursor = (this.cursor + 1) % this.capacity;
      const p = this.particles[idx];
      p.maxLife = life * (0.6 + Math.random() * 0.8);
      p.life = p.maxLife;
      p.gravity = opts.gravity ?? -4;
      p.size = opts.size ?? 0.16;
      p.color.copy(color);
      p.vel.set(
        (Math.random() - 0.5) * spread * speed,
        (Math.random() * 0.6 + (opts.upBias ?? 0.5)) * speed,
        (Math.random() - 0.5) * spread * speed,
      );
      this.positions[idx * 3] = origin.x;
      this.positions[idx * 3 + 1] = origin.y;
      this.positions[idx * 3 + 2] = origin.z;
      this.sizes[idx] = p.size;
    }
  }

  update(dt: number) {
    for (let i = 0; i < this.capacity; i++) {
      const p = this.particles[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      const i3 = i * 3;
      if (p.life <= 0) {
        this.positions[i3 + 1] = -9999;
        this.colors[i3] = this.colors[i3 + 1] = this.colors[i3 + 2] = 0;
        continue;
      }
      p.vel.y += p.gravity * dt;
      this.positions[i3] += p.vel.x * dt;
      this.positions[i3 + 1] += p.vel.y * dt;
      this.positions[i3 + 2] += p.vel.z * dt;
      const t = p.life / p.maxLife;
      this.colors[i3] = p.color.r * t;
      this.colors[i3 + 1] = p.color.g * t;
      this.colors[i3 + 2] = p.color.b * t;
    }
    const geo = this.points.geometry;
    geo.getAttribute('position').needsUpdate = true;
    geo.getAttribute('color').needsUpdate = true;
  }

  dispose() {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}

/**
 * A monster's signature battle aura: a continuous trickle of element-tinted
 * motes rising off (or sinking from) the sprite for the whole fight, plus an
 * optional warm glow for wardens. Draws on the shared `ParticleField`, so it
 * costs no new draw call — just a steady handful of additive points.
 *
 * The controller is species-agnostic; the personality is entirely in the
 * `BattleAura` data (`src/data/battleFx.ts`). One instance per fielded
 * fighter, positioned each frame from the sprite's live world position.
 */
export class Aura {
  /** Present only when the config asks for a glow (wardens). Added to the scene by the caller. */
  readonly light: THREE.PointLight | null = null;
  private emitAccum = 0;
  private phase = Math.random() * 10;
  private scratch = new THREE.Vector3();

  constructor(
    private field: ParticleField,
    private cfg: BattleAura,
  ) {
    if (cfg.light) {
      this.light = new THREE.PointLight(cfg.light.color, cfg.light.intensity, cfg.light.range ?? 5, 1.8);
    }
  }

  private spawn(base: THREE.Vector3, height: number) {
    const r = this.cfg.originSpread ?? 0.25;
    this.scratch.set(
      base.x + (Math.random() - 0.5) * 2 * r,
      base.y + height * this.cfg.originY,
      base.z + (Math.random() - 0.5) * 2 * r,
    );
    this.field.emit(this.scratch, {
      count: 1,
      speed: this.cfg.speed ?? 0.4,
      spread: this.cfg.spread ?? 0.7,
      life: this.cfg.life ?? 1,
      gravity: this.cfg.gravity ?? 0.3,
      upBias: this.cfg.upBias ?? 0.5,
      size: this.cfg.size ?? 0.08,
      color: this.cfg.color,
    });
  }

  /**
   * @param base   world position of the sprite's feet
   * @param height sprite height in world units
   * @param active false once the fighter has fainted — the aura goes quiet
   */
  update(dt: number, time: number, base: THREE.Vector3, height: number, active: boolean) {
    if (this.light) {
      this.light.position.set(base.x, base.y + height * 0.55, base.z);
      const flicker = 0.82 + Math.sin(time * 8 + this.phase) * 0.12 + Math.sin(time * 17.7 + this.phase) * 0.06;
      this.light.intensity = active ? (this.cfg.light?.intensity ?? 3) * flicker : 0;
    }
    if (!active) return;
    this.emitAccum += dt;
    const interval = 1 / this.cfg.rate;
    // Cap the catch-up after a long frame so a stall can't dump a burst.
    let budget = 6;
    while (this.emitAccum >= interval && budget-- > 0) {
      this.emitAccum -= interval;
      this.spawn(base, height);
    }
    if (this.emitAccum > interval) this.emitAccum = 0;
  }

  /** A brief swell of the same motes — the tell that this monster is acting. */
  burst(base: THREE.Vector3, height: number) {
    this.scratch.set(base.x, base.y + height * this.cfg.originY, base.z);
    this.field.emit(this.scratch, {
      count: 12,
      speed: (this.cfg.speed ?? 0.4) + 1.4,
      spread: 1,
      life: (this.cfg.life ?? 1) * 0.8,
      gravity: this.cfg.gravity ?? 0.3,
      upBias: this.cfg.upBias ?? 0.5,
      size: this.cfg.size ?? 0.08,
      color: this.cfg.color,
    });
  }

  dispose() {
    this.light?.parent?.remove(this.light);
  }
}

export interface DustBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minY: number;
  maxY: number;
}

/**
 * Ambient dust motes: a persistent, slow-drifting field of fine points that
 * fills the play volume so lit air reads as *volume*, not vacuum. Unlike
 * `ParticleField` (emit-and-die sparks) these live forever — each mote drifts on
 * its own gentle velocity, wraps at the volume's edges so the cloud never
 * depletes, and twinkles on its own phase so the haze shimmers as the key light
 * rakes across it. Additive, so it sits in the bloom threshold and reads as fine
 * suspended dust rather than hard specks.
 */
export class DustMotes {
  readonly points: THREE.Points;
  private positions: Float32Array;
  private colors: Float32Array;
  private vel: Float32Array;
  private phase: Float32Array;
  private base: THREE.Color;
  private min: { x: number; y: number; z: number };
  private span: { x: number; y: number; z: number };

  constructor(
    bounds: DustBounds,
    color: THREE.ColorRepresentation = '#bfe6ff',
    readonly count = 130,
    size = 0.07,
  ) {
    this.base = new THREE.Color(color);
    this.min = { x: bounds.minX, y: bounds.minY, z: bounds.minZ };
    this.span = {
      x: Math.max(0.001, bounds.maxX - bounds.minX),
      y: Math.max(0.001, bounds.maxY - bounds.minY),
      z: Math.max(0.001, bounds.maxZ - bounds.minZ),
    };
    this.positions = new Float32Array(count * 3);
    this.colors = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.phase = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      this.positions[i3] = this.min.x + Math.random() * this.span.x;
      this.positions[i3 + 1] = this.min.y + Math.random() * this.span.y;
      this.positions[i3 + 2] = this.min.z + Math.random() * this.span.z;
      // Slow, mostly-horizontal drift with a faint updraft — dust caught in a
      // draught, not snowfall.
      this.vel[i3] = (Math.random() - 0.5) * 0.14;
      this.vel[i3 + 1] = 0.02 + Math.random() * 0.05;
      this.vel[i3 + 2] = (Math.random() - 0.5) * 0.14;
      this.phase[i] = Math.random() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    const mat = new THREE.PointsMaterial({
      size,
      map: radialTexture('spark', '#ffffff'),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
  }

  /** Retint the motes (e.g. to match a floor's mood) without rebuilding. */
  setColor(color: THREE.ColorRepresentation) {
    this.base.set(color);
  }

  update(dt: number, time: number) {
    const { x: sx, y: sy, z: sz } = this.span;
    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;
      let x = this.positions[i3] + this.vel[i3] * dt;
      let y = this.positions[i3 + 1] + this.vel[i3 + 1] * dt;
      let z = this.positions[i3 + 2] + this.vel[i3 + 2] * dt;
      // Wrap within the volume so the cloud is inexhaustible; motes that rise out
      // the top respawn at the floor.
      if (x < this.min.x) x += sx;
      else if (x > this.min.x + sx) x -= sx;
      if (z < this.min.z) z += sz;
      else if (z > this.min.z + sz) z -= sz;
      if (y > this.min.y + sy) y = this.min.y;
      this.positions[i3] = x;
      this.positions[i3 + 1] = y;
      this.positions[i3 + 2] = z;
      // Twinkle: a slow per-mote sine keeps the cloud alive without strobing.
      const tw = 0.3 + 0.4 * (0.5 + 0.5 * Math.sin(time * 1.3 + this.phase[i]));
      this.colors[i3] = this.base.r * tw;
      this.colors[i3 + 1] = this.base.g * tw;
      this.colors[i3 + 2] = this.base.b * tw;
    }
    const geo = this.points.geometry;
    geo.getAttribute('position').needsUpdate = true;
    geo.getAttribute('color').needsUpdate = true;
  }

  dispose() {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}

/**
 * A soft volumetric light shaft — the cone of glow a torch throws into hazy air.
 * A cheap stand-in for screen-space god-rays (which the software renderer can't
 * afford): an open cone, apex at the flame, widening as it falls, additively
 * blended and faded to nothing at the base via vertex colour (additive = black
 * reads as transparent). Leans slightly into the room and drinks the same dust
 * the motes fill the air with. One extra transparent draw per torch, no post
 * pass. `setOpacity` lets the torch pulse it in sync with its flicker.
 */
export class LightShaft {
  readonly mesh: THREE.Mesh;
  private mat: THREE.MeshBasicMaterial;
  private baseOpacity: number;

  constructor(color: THREE.ColorRepresentation = 0xffb066, height = 2.1, topR = 0.28, botR = 1.15, opacity = 0.14) {
    const geo = new THREE.ConeGeometry(botR, height, 12, 1, true);
    // ConeGeometry apex is at +h/2, base ring at -h/2. Shift so the apex sits at
    // the origin (the flame) and the cone hangs straight down from there.
    geo.translate(0, -height / 2, 0);
    // Narrow the apex toward a point of light: pull the top ring inward.
    const pos = geo.getAttribute('position');
    const warm = new THREE.Color(color);
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i); // 0 at apex, -height at base
      const tTop = y > -0.001; // apex ring
      if (tTop) {
        pos.setX(i, pos.getX(i) * (topR / botR));
        pos.setZ(i, pos.getZ(i) * (topR / botR));
      }
      // Bright at the flame, fading to black (→ invisible) at the floor.
      const k = 1 - Math.min(1, -y / height);
      colors[i * 3] = warm.r * k;
      colors[i * 3 + 1] = warm.g * k;
      colors[i * 3 + 2] = warm.b * k;
    }
    pos.needsUpdate = true;
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.baseOpacity = opacity;
    this.mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    // A slight forward lean so the shaft spills into the room, not down the wall.
    this.mesh.rotation.x = 0.32;
  }

  /** Scale the shaft's glow by the torch's live flicker (1 = base opacity). */
  setOpacity(flicker: number) {
    this.mat.opacity = this.baseOpacity * flicker;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}

/** A wall torch: emissive sprite + flickering point light + rising embers. */
export class Torch {
  readonly object = new THREE.Group();
  readonly light: THREE.PointLight;
  private billboard: Billboard;
  private shaft: LightShaft;
  private phase = Math.random() * 10;
  private emitAccum = 0;

  constructor(
    private field: ParticleField,
    intensity = 6,
  ) {
    this.billboard = new Billboard(PROPS.torch, 'prop:torch', {
      height: 0.85,
      emissive: 1.7,
      castShadow: false,
    });
    this.billboard.bob = 0;
    this.object.add(this.billboard.object);
    this.light = new THREE.PointLight(0xffa64d, intensity, 8.5, 1.8);
    this.light.position.y = 0.75;
    this.object.add(this.light);
    // The visible cone of light hanging off the flame, drinking the haze.
    this.shaft = new LightShaft();
    this.shaft.mesh.position.y = 0.7;
    this.object.add(this.shaft.mesh);
  }

  update(dt: number, camera: THREE.Camera, time: number) {
    this.billboard.update(dt, camera, time);
    const f = 0.72 + Math.sin(time * 11 + this.phase) * 0.14 + Math.sin(time * 23.3 + this.phase) * 0.1;
    this.light.intensity = 6 * f;
    this.billboard.mesh.material.emissiveIntensity = 1.4 + f * 0.6;
    this.shaft.setOpacity(f);
    this.emitAccum += dt;
    if (this.emitAccum > 0.14) {
      this.emitAccum = 0;
      const p = this.object.getWorldPosition(new THREE.Vector3());
      p.y += 0.8;
      this.field.emit(p, { count: 1, speed: 0.55, spread: 0.35, life: 0.9, gravity: 0.35, size: 0.1, color: 0xffb055 });
    }
  }
}

/** Descent / exit portal: emissive disc, rising ring and a coloured light. */
export class Portal {
  readonly object = new THREE.Group();
  readonly light: THREE.PointLight;
  private disc: THREE.Mesh;
  private ring: THREE.Mesh;
  private emitAccum = 0;

  constructor(
    private field: ParticleField,
    color = 0x6fd3ff,
    private isExit = false,
  ) {
    const discGeo = new THREE.CircleGeometry(0.85, 24);
    discGeo.rotateX(-Math.PI / 2);
    const discMat = new THREE.MeshStandardMaterial({
      color: 0x0a1424,
      emissive: new THREE.Color(color),
      emissiveIntensity: 2.4,
      roughness: 0.4,
    });
    this.disc = new THREE.Mesh(discGeo, discMat);
    this.disc.position.y = 0.03;
    this.object.add(this.disc);

    const ringGeo = new THREE.TorusGeometry(0.72, 0.055, 8, 28);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x11203a,
      emissive: new THREE.Color(color),
      emissiveIntensity: 3.2,
      roughness: 0.3,
    });
    this.ring = new THREE.Mesh(ringGeo, ringMat);
    this.ring.position.y = 0.35;
    this.object.add(this.ring);

    this.light = new THREE.PointLight(color, 7, 7, 1.7);
    this.light.position.y = 0.7;
    this.object.add(this.light);
  }

  update(dt: number, time: number) {
    this.ring.rotation.y = time * (this.isExit ? -1.1 : 1.4);
    this.ring.position.y = 0.35 + Math.sin(time * 1.6) * 0.16;
    this.light.intensity = 6 + Math.sin(time * 3.1) * 1.6;
    this.emitAccum += dt;
    if (this.emitAccum > 0.1) {
      this.emitAccum = 0;
      const p = this.object.getWorldPosition(new THREE.Vector3());
      p.x += (Math.random() - 0.5) * 1.2;
      p.z += (Math.random() - 0.5) * 1.2;
      p.y += 0.05;
      this.field.emit(p, {
        count: 1,
        speed: 1.1,
        spread: 0.15,
        life: 1.1,
        gravity: 0.7,
        upBias: 1,
        size: 0.13,
        color: this.isExit ? 0xffd166 : 0x6fd3ff,
      });
    }
  }
}

/**
 * A soft dark ellipse laid flat on the floor to ground a billboard sprite. The
 * single dynamic key light casts one real shadow, but small props read as
 * floating cards without a contact shadow of their own — this is the cheap fake
 * that seats them on the ground. Reuses the cached `radialTexture` blob (one
 * shared texture for every decal), unlit so it looks the same under any floor
 * light. Must live as a scene sibling of the sprite, NOT a child of the
 * billboard — `Billboard.update()` rewrites rotation each frame (camera yaw +
 * pitch lean) and would tilt a parented decal off the floor.
 *
 * `depthWrite: false` + `polygonOffset` (plus a small y-lift by the caller)
 * keep it from z-fighting the floor plane.
 */
export function contactShadow(width: number, opacity = 0.32): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(width, width * 0.6);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    map: radialTexture('contact', '#000000'),
    transparent: true,
    opacity,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = 1;
  return m;
}

/**
 * A soft coloured light pool cast on the floor under a glowing prop — the light
 * an emissive crystal/mushroom/brazier would spill onto the ground. Additive, so
 * it reads as light (not paint) and feeds the bloom pass. Static; laid down once
 * beneath the decor that earns it.
 */
export function glowDecal(radius: number, color: THREE.ColorRepresentation, opacity = 0.55): THREE.Mesh {
  const geo = new THREE.CircleGeometry(radius, 20);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    map: radialTexture('contact', '#ffffff'),
    color: new THREE.Color(color),
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = 2;
  return m;
}

/**
 * Drifting ground mist — a small stack of soft, translucent horizontal layers
 * hovering low over the floor, each scrolling on its own heading, so the room
 * reads as air with depth rather than a vacuum. Distance fog (see
 * `HD2DRenderer.applyFog`) recedes the far walls; this adds the near, low haze
 * banding that distance fog can't. Fog-tinted, normal-blended, low opacity — a
 * handful of transparent quads, no post pass.
 */
export class GroundMist {
  readonly object = new THREE.Group();
  private layers: { mesh: THREE.Mesh; vx: number; vz: number }[] = [];

  constructor(
    bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
    color: THREE.ColorRepresentation = '#8fa6c0',
    count = 3,
  ) {
    const w = bounds.maxX - bounds.minX + 4;
    const d = bounds.maxZ - bounds.minZ + 4;
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cz = (bounds.minZ + bounds.maxZ) / 2;
    const tint = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      const geo = new THREE.PlaneGeometry(w, d);
      geo.rotateX(-Math.PI / 2);
      const tex = mistTexture(`layer${i}`);
      tex.repeat.set(w / 7, d / 7);
      tex.offset.set(i * 0.37, i * 0.61); // stagger so layers don't overlap-align
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        color: tint,
        transparent: true,
        opacity: 0.12 - i * 0.02,
        depthWrite: false,
        blending: THREE.NormalBlending,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(cx, 0.22 + i * 0.3, cz);
      mesh.renderOrder = 4;
      mesh.frustumCulled = false;
      this.object.add(mesh);
      // Alternating headings give a slow parallax drift between bands.
      const dir = i % 2 === 0 ? 1 : -1;
      this.layers.push({ mesh, vx: 0.006 * dir, vz: 0.004 * (i % 2 === 0 ? 1 : -1) * -dir });
    }
  }

  update(dt: number, time: number) {
    this.layers.forEach((l, i) => {
      const tex = (l.mesh.material as THREE.MeshBasicMaterial).map;
      if (tex) {
        tex.offset.x += l.vx * dt;
        tex.offset.y += l.vz * dt;
      }
      // A slow, gentle breathing so the haze isn't a static film.
      const mat = l.mesh.material as THREE.MeshBasicMaterial;
      const base = 0.12 - i * 0.02;
      mat.opacity = Math.max(0, base * (0.7 + 0.3 * Math.sin(time * 0.5 + i * 1.7)));
    });
  }

  dispose() {
    for (const l of this.layers) {
      l.mesh.geometry.dispose();
      (l.mesh.material as THREE.Material).dispose();
    }
  }
}
