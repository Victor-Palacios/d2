import GUI from 'lil-gui';
import type { HD2DRenderer } from './HD2DRenderer';
import { DEFAULT_PARAMS } from './HD2DRenderer';

/**
 * Live tuning panel for the whole HD-2D look (plan M0).
 *
 * Every number the renderer uses is exposed here, so the art direction can be
 * dialled in at runtime instead of through edit-reload cycles. Toggle with `.
 */
export class DebugPanel {
  private gui: GUI;
  private visible = false;

  constructor(private hd2d: HD2DRenderer) {
    this.gui = new GUI({ title: 'HD-2D rig  (` to hide)', width: 300 });
    const p = hd2d.params;
    const apply = () => hd2d.applyParams();

    const cam = this.gui.addFolder('Camera');
    cam.add(p, 'fov', 18, 70, 1).onChange(apply);
    cam.add(p, 'pitch', 15, 80, 1);
    cam.add(p, 'yaw', -45, 45, 1);
    cam.add(p, 'distance', 6, 28, 0.1);
    cam.add(p, 'height', -1, 3, 0.05);

    const light = this.gui.addFolder('Lighting');
    light.addColor(p, 'keyColor').onChange(apply);
    light.add(p, 'keyIntensity', 0, 160, 1).onChange(apply);
    light.add(p, 'keyHeight', 0.5, 10, 0.1);
    light.add(p, 'keyOffsetX', -6, 6, 0.1);
    light.add(p, 'keyOffsetZ', -6, 6, 0.1);
    light.add(p, 'keyDistance', 5, 60, 1).onChange(apply);
    light.add(p, 'keyDecay', 0.5, 3, 0.05).onChange(apply);
    light.add(p, 'ambientIntensity', 0, 2.5, 0.01).onChange(apply);
    light.add(p, 'hemiIntensity', 0, 2.5, 0.01).onChange(apply);
    light.add(p, 'rimIntensity', 0, 2.5, 0.01).onChange(apply);
    light.add(p, 'shadowBias', -0.01, 0.002, 0.0001).onChange(apply);
    light.add(p, 'shadowRadius', 0, 8, 0.1).onChange(apply);

    const bloom = this.gui.addFolder('Bloom');
    bloom.add(p, 'bloomEnabled').onChange(apply);
    bloom.add(p, 'bloomIntensity', 0, 4, 0.01).onChange(apply);
    bloom.add(p, 'bloomThreshold', 0, 1.5, 0.01).onChange(apply);
    bloom.add(p, 'bloomSmoothing', 0, 1, 0.01).onChange(apply);
    bloom.add(p, 'bloomRadius', 0, 1, 0.01).onChange(apply);

    const dof = this.gui.addFolder('Depth of field');
    dof.add(p, 'dofEnabled').onChange(apply);
    dof.add(p, 'dofFocusRange', 0.5, 25, 0.1).onChange(apply);
    dof.add(p, 'dofBokehScale', 0, 8, 0.1).onChange(apply);

    const grade = this.gui.addFolder('Tilt-shift / grade');
    grade.add(p, 'tiltEnabled').onChange(apply);
    grade.add(p, 'tiltFocusArea', 0.05, 1, 0.01).onChange(apply);
    grade.add(p, 'tiltFeather', 0, 1, 0.01).onChange(apply);
    grade.add(p, 'vignetteDarkness', 0, 1.5, 0.01).onChange(apply);
    grade.add(p, 'vignetteOffset', 0, 1, 0.01).onChange(apply);
    grade.add(p, 'brightness', -0.5, 0.5, 0.005).onChange(apply);
    grade.add(p, 'contrast', -0.5, 0.6, 0.005).onChange(apply);
    grade.add(p, 'saturation', -1, 1, 0.01).onChange(apply);
    grade.add(p, 'hue', -Math.PI, Math.PI, 0.01).onChange(apply);
    grade.add(p, 'toneMapping').onChange(apply);

    const world = this.gui.addFolder('World / output');
    world.addColor(p, 'fogColor').onChange(apply);
    world.add(p, 'fogDensity', 0, 0.09, 0.001).onChange(() => {
      const fog = hd2d.currentScene.fog;
      if (fog && 'density' in fog) (fog as { density: number }).density = p.fogDensity;
    });
    world.add(p, 'supersample', 0.5, 2, 0.05).onChange(apply);
    world.add(p, 'smaa').onChange(apply);

    this.gui
      .add(
        {
          reset: () => {
            Object.assign(p, DEFAULT_PARAMS);
            apply();
            this.gui.controllersRecursive().forEach((c) => {
              c.updateDisplay();
            });
          },
        },
        'reset',
      )
      .name('Reset to defaults');

    this.setVisible(false);
  }

  setVisible(v: boolean) {
    this.visible = v;
    this.gui.domElement.style.display = v ? '' : 'none';
  }

  toggle() {
    this.setVisible(!this.visible);
  }

  /** Keeps the panel honest when code changes params behind its back. */
  refresh() {
    this.gui.controllersRecursive().forEach((c) => {
      c.updateDisplay();
    });
    this.hd2d.applyParams();
  }
}
