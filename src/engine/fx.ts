import * as THREE from 'three';
import { radialTexture } from './pixel';
import { Billboard } from './Billboard';
import { PROPS } from '../assets/art';

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

  constructor(private capacity = 400, color = '#ffffff', size = 0.18) {
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

/** A wall torch: emissive sprite + flickering point light + rising embers. */
export class Torch {
  readonly object = new THREE.Group();
  readonly light: THREE.PointLight;
  private billboard: Billboard;
  private phase = Math.random() * 10;
  private emitAccum = 0;

  constructor(private field: ParticleField, intensity = 6) {
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
  }

  update(dt: number, camera: THREE.Camera, time: number) {
    this.billboard.update(dt, camera, time);
    const f = 0.72 + Math.sin(time * 11 + this.phase) * 0.14 + Math.sin(time * 23.3 + this.phase) * 0.1;
    this.light.intensity = 6 * f;
    this.billboard.mesh.material.emissiveIntensity = 1.4 + f * 0.6;
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

  constructor(private field: ParticleField, color = 0x6fd3ff, private isExit = false) {
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
