import * as THREE from 'three';

/**
 * Frees the GPU resources under an Object3D subtree: the geometry and
 * material(s) of every mesh and points object.
 *
 * Three.js does **not** do this on `scene.remove()` / `scene.clear()` — those
 * only detach from the scene graph. A scene torn down without this leaks its
 * whole environment (floor/wall/element geometry and materials, torches,
 * portals) on every entry, and the game re-enters the dungeon and battle scenes
 * constantly — so it accumulates until the driver evicts and the frame rate
 * randomly drops.
 *
 * Cached *textures* are deliberately left alone: `Material.dispose()` does not
 * touch a material's `.map`/`.emissiveMap`, so the shared sprite and tile
 * texture caches (keyed by id in `pixel.ts`) survive for reuse. Call this right
 * before `scene.clear()` in a scene's `exit()`.
 */
export function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const withGeo = obj as { geometry?: THREE.BufferGeometry; material?: THREE.Material | THREE.Material[] };
    withGeo.geometry?.dispose();
    const mat = withGeo.material;
    if (Array.isArray(mat)) {
      for (const m of mat) m.dispose();
    } else {
      mat?.dispose();
    }
  });
}
