import * as THREE from 'three';
import {
  BloomEffect,
  BrightnessContrastEffect,
  DepthOfFieldEffect,
  EffectComposer,
  EffectPass,
  HueSaturationEffect,
  KernelSize,
  RenderPass,
  SMAAEffect,
  TiltShiftEffect,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from 'postprocessing';

/**
 * The HD-2D rendering rig (plan §3).
 *
 * One instance owns the WebGL renderer, the ¾ dungeon-crawler camera, the
 * shared light rig (warm shadow-casting point light + low fill) and the whole
 * post stack. Scenes swap in and out of it; the rendering is never forked, so
 * the dungeon and the battle arena are guaranteed to look like the same game.
 *
 * Every number below is exposed through `params` and driven live by the debug
 * panel (see `DebugPanel.ts`).
 */

export interface HD2DParams {
  // camera
  fov: number;
  pitch: number; // degrees below horizontal
  yaw: number; // degrees around Y
  distance: number;
  height: number; // extra look-at height above the target
  // lighting
  keyIntensity: number;
  keyColor: string;
  keyHeight: number;
  /** Lateral offset of the key light from the party — this is what makes the
   *  shadow fall to one side instead of hiding underneath the sprite. */
  keyOffsetX: number;
  keyOffsetZ: number;
  keyDistance: number;
  keyDecay: number;
  ambientIntensity: number;
  hemiIntensity: number;
  rimIntensity: number;
  shadowBias: number;
  shadowRadius: number;
  // post
  bloomEnabled: boolean;
  bloomIntensity: number;
  bloomThreshold: number;
  bloomSmoothing: number;
  bloomRadius: number;
  dofEnabled: boolean;
  dofFocusRange: number;
  dofBokehScale: number;
  tiltEnabled: boolean;
  tiltFocusArea: number;
  tiltFeather: number;
  vignetteDarkness: number;
  vignetteOffset: number;
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  toneMapping: boolean;
  smaa: boolean;
  supersample: number;
  fogDensity: number;
  fogColor: string;
}

export const DEFAULT_PARAMS: HD2DParams = {
  fov: 34,
  pitch: 42,
  yaw: 0,
  distance: 13.5,
  height: 0.9,

  keyIntensity: 34,
  keyColor: '#ffcc99',
  keyHeight: 4.2,
  keyOffsetX: 2.1,
  keyOffsetZ: -1.5,
  keyDistance: 24,
  keyDecay: 1.45,
  ambientIntensity: 0.62,
  hemiIntensity: 0.55,
  rimIntensity: 0.34,
  shadowBias: -0.0012,
  shadowRadius: 2.4,

  bloomEnabled: true,
  bloomIntensity: 1.15,
  bloomThreshold: 0.62,
  bloomSmoothing: 0.28,
  bloomRadius: 0.72,
  dofEnabled: true,
  dofFocusRange: 6.5,
  dofBokehScale: 3.2,
  tiltEnabled: true,
  tiltFocusArea: 0.62,
  tiltFeather: 0.36,
  vignetteDarkness: 0.62,
  vignetteOffset: 0.33,
  brightness: 0.015,
  contrast: 0.11,
  saturation: 0.14,
  hue: 0,
  toneMapping: true,
  smaa: false,
  supersample: 1.35,
  fogDensity: 0.018,
  fogColor: '#0a0d1c',
};

export class HD2DRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly camera: THREE.PerspectiveCamera;
  readonly params: HD2DParams;

  /** Point the camera rig orbits/looks at. Scenes move this, not the camera. */
  readonly cameraTarget = new THREE.Vector3();
  /** Where the key light wants to be (usually the party). */
  readonly lightTarget = new THREE.Vector3();
  /** World position kept in focus by the depth of field effect. */
  readonly focusTarget = new THREE.Vector3();

  readonly lights: {
    key: THREE.PointLight;
    ambient: THREE.AmbientLight;
    hemi: THREE.HemisphereLight;
    rim: THREE.DirectionalLight;
  };

  readonly effects: {
    bloom: BloomEffect;
    dof: DepthOfFieldEffect;
    tilt: TiltShiftEffect;
    vignette: VignetteEffect;
    grade: BrightnessContrastEffect;
    hueSat: HueSaturationEffect;
    tone: ToneMappingEffect;
    smaa: SMAAEffect;
  };

  private composer: EffectComposer;
  private renderPass: RenderPass;
  private scene: THREE.Scene;
  /** Camera shake state (impact feedback in battle). */
  private shake = { amount: 0, time: 0 };
  private camOffset = new THREE.Vector3();
  private smoothedTarget = new THREE.Vector3();
  private targetInitialised = false;

  constructor(canvas: HTMLCanvasElement, params: Partial<HD2DParams> = {}) {
    this.params = { ...DEFAULT_PARAMS, ...params };

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false, // handled in the post stack / by supersampling
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
    });
    this.renderer.setClearColor(0x05070f, 1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.NoToneMapping; // done in the post stack
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.camera = new THREE.PerspectiveCamera(this.params.fov, 1, 0.1, 220);

    // --- shared light rig (the HD-2D signature) ----------------------------
    const key = new THREE.PointLight(new THREE.Color(this.params.keyColor), this.params.keyIntensity);
    key.castShadow = true;
    key.distance = this.params.keyDistance;
    key.decay = this.params.keyDecay;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 0.4;
    key.shadow.camera.far = 32;
    key.shadow.bias = this.params.shadowBias;
    key.shadow.radius = this.params.shadowRadius;
    key.shadow.normalBias = 0.02;

    const ambient = new THREE.AmbientLight(0x8fa5d8, this.params.ambientIntensity);
    const hemi = new THREE.HemisphereLight(0x9db8ff, 0x241d33, this.params.hemiIntensity);
    // A dim, shadowless back light so billboards never silhouette into mush.
    const rim = new THREE.DirectionalLight(0xbfd4ff, this.params.rimIntensity);
    rim.position.set(-6, 9, -7);

    this.lights = { key, ambient, hemi, rim };

    this.scene = new THREE.Scene();
    this.attachLights(this.scene);

    // --- post stack --------------------------------------------------------
    this.composer = new EffectComposer(this.renderer, {
      frameBufferType: THREE.HalfFloatType,
      multisampling: Math.min(4, this.renderer.capabilities.maxSamples ?? 0),
    });
    this.renderPass = new RenderPass(this.scene, this.camera);

    const bloom = new BloomEffect({
      mipmapBlur: true,
      intensity: this.params.bloomIntensity,
      luminanceThreshold: this.params.bloomThreshold,
      luminanceSmoothing: this.params.bloomSmoothing,
      radius: this.params.bloomRadius,
    });

    const dof = new DepthOfFieldEffect(this.camera, {
      focusDistance: 10,
      focusRange: this.params.dofFocusRange,
      bokehScale: this.params.dofBokehScale,
      resolutionScale: 0.7,
    });
    // Auto-focus: the effect keeps this world position sharp every frame.
    dof.target = this.focusTarget;

    const tilt = new TiltShiftEffect({
      offset: 0,
      rotation: 0,
      focusArea: this.params.tiltFocusArea,
      feather: this.params.tiltFeather,
      kernelSize: KernelSize.SMALL,
      resolutionScale: 0.5,
    });

    const vignette = new VignetteEffect({
      offset: this.params.vignetteOffset,
      darkness: this.params.vignetteDarkness,
    });
    const grade = new BrightnessContrastEffect({
      brightness: this.params.brightness,
      contrast: this.params.contrast,
    });
    const hueSat = new HueSaturationEffect({
      saturation: this.params.saturation,
      hue: this.params.hue,
    });
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.AGX });
    const smaa = new SMAAEffect();

    this.effects = { bloom, dof, tilt, vignette, grade, hueSat, tone, smaa };

    // Split across passes: convolution-style effects don't merge into a single
    // shader, and keeping DOF ahead of the grade preserves the diorama read.
    this.composer.addPass(this.renderPass);
    this.composer.addPass(new EffectPass(this.camera, dof, bloom));
    this.composer.addPass(new EffectPass(this.camera, tilt));
    this.composer.addPass(new EffectPass(this.camera, tone, hueSat, grade, vignette));
    this.composer.addPass(new EffectPass(this.camera, smaa));

    this.applyParams();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  private attachLights(scene: THREE.Scene) {
    scene.add(this.lights.key, this.lights.ambient, this.lights.hemi, this.lights.rim);
  }

  /** Swaps the scene the composer renders, carrying the shared light rig over. */
  setScene(scene: THREE.Scene) {
    if (scene === this.scene) return;
    const { key, ambient, hemi, rim } = this.lights;
    this.scene.remove(key, ambient, hemi, rim);
    this.scene = scene;
    this.attachLights(scene);
    this.renderPass.mainScene = scene;
    this.targetInitialised = false;
  }

  get currentScene(): THREE.Scene {
    return this.scene;
  }

  /** Applies fog to a scene using the shared fog parameters. */
  applyFog(scene: THREE.Scene, densityScale = 1) {
    scene.fog = new THREE.FogExp2(new THREE.Color(this.params.fogColor), this.params.fogDensity * densityScale);
    scene.background = new THREE.Color(this.params.fogColor);
  }

  /** Re-reads `params` into three.js / postprocessing objects. */
  applyParams() {
    const p = this.params;

    this.camera.fov = p.fov;
    this.camera.updateProjectionMatrix();

    const { key, ambient, hemi, rim } = this.lights;
    key.color.set(p.keyColor);
    key.intensity = p.keyIntensity;
    key.distance = p.keyDistance;
    key.decay = p.keyDecay;
    key.shadow.bias = p.shadowBias;
    key.shadow.radius = p.shadowRadius;
    ambient.intensity = p.ambientIntensity;
    hemi.intensity = p.hemiIntensity;
    rim.intensity = p.rimIntensity;

    const e = this.effects;
    e.bloom.intensity = p.bloomIntensity;
    e.bloom.luminanceMaterial.threshold = p.bloomThreshold;
    e.bloom.luminanceMaterial.smoothing = p.bloomSmoothing;
    e.bloom.mipmapBlurPass.radius = p.bloomRadius;
    e.bloom.blendMode.opacity.value = p.bloomEnabled ? 1 : 0;

    e.dof.cocMaterial.focusRange = p.dofFocusRange;
    e.dof.bokehScale = p.dofEnabled ? p.dofBokehScale : 0;

    e.tilt.focusArea = p.tiltFocusArea;
    e.tilt.feather = p.tiltFeather;
    e.tilt.blendMode.opacity.value = p.tiltEnabled ? 1 : 0;

    e.vignette.darkness = p.vignetteDarkness;
    e.vignette.offset = p.vignetteOffset;
    e.grade.brightness = p.brightness;
    e.grade.contrast = p.contrast;
    e.hueSat.saturation = p.saturation;
    e.hueSat.hue = p.hue;
    e.tone.blendMode.opacity.value = p.toneMapping ? 1 : 0;
    e.smaa.blendMode.opacity.value = p.smaa ? 1 : 0;

    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.set(p.fogColor);
      this.scene.background = new THREE.Color(p.fogColor);
    }

    this.resize();
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    // Supersampling: render above native and let the browser downsample. This
    // is what keeps pixel sprites crisp while the post stack stays smooth.
    const ratio = Math.min(window.devicePixelRatio || 1, 2) * this.params.supersample;
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Nudges the camera for impact feedback. */
  addShake(amount: number) {
    this.shake.amount = Math.max(this.shake.amount, amount);
  }

  /** Instantly snap the camera to its target (use on scene entry). */
  snapCamera() {
    this.targetInitialised = false;
  }

  private updateCamera(dt: number) {
    const p = this.params;
    if (!this.targetInitialised) {
      this.smoothedTarget.copy(this.cameraTarget);
      this.targetInitialised = true;
    } else {
      // Critically-damped-ish follow: the camera trails the party slightly,
      // which reads as a hand-held diorama rather than a rigid lock.
      const k = 1 - Math.exp(-dt * 9);
      this.smoothedTarget.lerp(this.cameraTarget, k);
    }

    const pitch = THREE.MathUtils.degToRad(p.pitch);
    const yaw = THREE.MathUtils.degToRad(p.yaw);
    this.camOffset.set(
      Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      Math.cos(yaw) * Math.cos(pitch),
    );
    this.camOffset.multiplyScalar(p.distance);

    this.camera.position.copy(this.smoothedTarget).add(this.camOffset);

    if (this.shake.amount > 0.0005) {
      this.shake.time += dt * 42;
      const a = this.shake.amount;
      this.camera.position.x += Math.sin(this.shake.time) * a;
      this.camera.position.y += Math.cos(this.shake.time * 1.7) * a * 0.6;
      this.shake.amount *= Math.exp(-dt * 7);
    }

    this.camera.lookAt(
      this.smoothedTarget.x,
      this.smoothedTarget.y + p.height,
      this.smoothedTarget.z,
    );
  }

  render(dt: number) {
    this.updateCamera(dt);

    // Key light rides above and to one side of the party, so shadows fan out
    // across the floor toward the camera instead of hiding under the sprites.
    this.lights.key.position.set(
      this.lightTarget.x + this.params.keyOffsetX,
      this.lightTarget.y + this.params.keyHeight,
      this.lightTarget.z + this.params.keyOffsetZ,
    );

    this.composer.render(dt);
  }

  dispose() {
    this.composer.dispose();
    this.renderer.dispose();
  }
}
