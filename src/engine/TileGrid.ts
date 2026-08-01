import * as THREE from 'three';
import { elementGlowTexture, elementTileTexture, floorTexture, wallTexture } from './pixel';
import type { TerrainStyle } from './pixel';
import type { ElementId } from '../data/elements';
import { ELEMENTS } from '../data/elements';

/** World size of one dungeon tile. */
export const TILE = 2;

export type TileKind =
  | 'void'
  | 'wall'
  | 'floor'
  | 'start'
  | 'portal'
  | 'exit'
  | 'chest'
  | 'light'
  | 'element'
  | 'event';

export interface Tile {
  x: number;
  z: number;
  kind: TileKind;
  element?: ElementId;
  /** Key into the floor's `events` table for 'event' tiles. */
  eventId?: string;
  /** Set once a chest/light/event has been consumed. */
  used?: boolean;
}

export interface TileTheme {
  floor: string;
  floorAlt: string;
  wall: string;
  wallTop: string;
  /** Marks the boss approach: a second wall colour used for '=' tiles. */
  accentWall: string;
  /**
   * Surface skin for this floor's tiles — see `TerrainStyle`. Purely visual: it
   * changes how floors and walls are drawn, never how the grid is walked.
   * Defaults to 'stone' (the original brick-and-flagstone look).
   */
  terrain?: TerrainStyle;
  /** Wall box height in world units (default 2.6). Taller walls read as caverns/vaults. */
  wallHeight?: number;
  /** Overrides the shared fog colour for this floor, tinting the whole air. */
  fogColor?: string;
}

export const DEFAULT_THEME: TileTheme = {
  floor: '#3a3f57',
  floorAlt: '#2f3449',
  wall: '#4a4560',
  wallTop: '#2b2840',
  accentWall: '#5c3b6e',
};

/**
 * Legend used by the floor layouts in `src/data/quietCrossing.ts`:
 *
 * ```
 *   ' '  nothing (void)          '#'  wall
 *   '='  accent wall (boss)      '.'  floor
 *   'S'  player start            '>'  portal down
 *   '<'  exit portal             'C'  treasure chest
 *   '$'  light shard             'W F N M D'  element floor tiles
 *   '1'-'9'  scripted event tile (looked up in the floor's `events` map)
 * ```
 */
const ELEMENT_CHARS: Record<string, ElementId> = {
  W: 'water',
  F: 'fire',
  N: 'nature',
  M: 'machine',
  D: 'dark',
};

export class TileGrid {
  readonly width: number;
  readonly depth: number;
  readonly tiles: Tile[][] = [];
  readonly theme: TileTheme;
  start = { x: 1, z: 1 };

  /** Wall tiles flagged as "accent" get the boss-approach material. */
  private accent = new Set<string>();

  /** Walkable tiles blocked by solid decor — impassable, but still floor. */
  private blocked = new Set<string>();

  constructor(rows: string[], theme: TileTheme = DEFAULT_THEME) {
    this.theme = theme;
    this.depth = rows.length;
    this.width = rows.reduce((m, r) => Math.max(m, r.length), 0);
    for (let z = 0; z < this.depth; z++) {
      const line = rows[z].padEnd(this.width, ' ');
      const row: Tile[] = [];
      for (let x = 0; x < this.width; x++) {
        row.push(this.parse(line[x], x, z));
      }
      this.tiles.push(row);
    }
  }

  private parse(ch: string, x: number, z: number): Tile {
    if (ch === '#') return { x, z, kind: 'wall' };
    if (ch === '=') {
      this.accent.add(`${x},${z}`);
      return { x, z, kind: 'wall' };
    }
    if (ch === ' ') return { x, z, kind: 'void' };
    if (ch === '.') return { x, z, kind: 'floor' };
    if (ch === 'S') {
      this.start = { x, z };
      return { x, z, kind: 'start' };
    }
    if (ch === '>') return { x, z, kind: 'portal' };
    if (ch === '<') return { x, z, kind: 'exit' };
    if (ch === 'C') return { x, z, kind: 'chest' };
    if (ch === '$') return { x, z, kind: 'light' };
    if (ELEMENT_CHARS[ch]) return { x, z, kind: 'element', element: ELEMENT_CHARS[ch] };
    if (ch >= '1' && ch <= '9') return { x, z, kind: 'event', eventId: ch };
    return { x, z, kind: 'floor' };
  }

  at(x: number, z: number): Tile | undefined {
    if (x < 0 || z < 0 || z >= this.depth || x >= this.width) return undefined;
    return this.tiles[z][x];
  }

  walkable(x: number, z: number): boolean {
    const t = this.at(x, z);
    return !!t && t.kind !== 'wall' && t.kind !== 'void';
  }

  /** Marks a walkable tile as blocked by solid decor. */
  blockTile(x: number, z: number) {
    this.blocked.add(`${x},${z}`);
  }

  /**
   * Whether the party can step onto (x, z): a walkable tile not occupied by
   * solid decor. Use this for movement; `walkable()` is pure grid geometry.
   */
  passable(x: number, z: number): boolean {
    return this.walkable(x, z) && !this.blocked.has(`${x},${z}`);
  }

  worldPos(x: number, z: number, y = 0): THREE.Vector3 {
    return new THREE.Vector3((x - (this.width - 1) / 2) * TILE, y, (z - (this.depth - 1) / 2) * TILE);
  }

  forEach(fn: (t: Tile) => void) {
    for (const row of this.tiles) for (const t of row) fn(t);
  }

  /**
   * Builds the 3D geometry for this floor: real floor quads and real wall boxes
   * so the environment has genuine depth and can receive the key light's
   * shadows (plan §3, "the 3D half").
   */
  build(): { group: THREE.Group; elementMeshes: Map<string, THREE.Mesh> } {
    const group = new THREE.Group();
    const elementMeshes = new Map<string, THREE.Mesh>();

    const floors: Tile[] = [];
    const walls: Tile[] = [];
    const accentWalls: Tile[] = [];
    const elements: Tile[] = [];

    this.forEach((t) => {
      if (t.kind === 'void') return;
      if (t.kind === 'wall') {
        (this.accent.has(`${t.x},${t.z}`) ? accentWalls : walls).push(t);
      } else if (t.kind === 'element') {
        elements.push(t);
      } else {
        floors.push(t);
      }
    });

    const style = this.theme.terrain ?? 'stone';
    // Metal reads better with a touch of shine; the rest stay matte stone.
    const metalness = style === 'metal' ? 0.35 : style === 'crystal' ? 0.12 : 0.02;
    const roughness = style === 'metal' ? 0.55 : style === 'crystal' ? 0.6 : 0.92;

    // --- floors ------------------------------------------------------------
    const floorGeo = new THREE.PlaneGeometry(TILE, TILE);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMatA = new THREE.MeshStandardMaterial({
      map: floorTexture('a', this.theme.floor, 7, 32, style),
      roughness,
      metalness,
    });
    const floorMatB = new THREE.MeshStandardMaterial({
      map: floorTexture('b', this.theme.floorAlt, 19, 32, style),
      roughness,
      metalness,
    });

    const makeFloorInstances = (list: Tile[], mat: THREE.Material) => {
      if (!list.length) return;
      const inst = new THREE.InstancedMesh(floorGeo, mat, list.length);
      inst.receiveShadow = true;
      inst.castShadow = false;
      const m = new THREE.Matrix4();
      list.forEach((t, i) => {
        const p = this.worldPos(t.x, t.z);
        m.makeTranslation(p.x, 0, p.z);
        inst.setMatrixAt(i, m);
      });
      inst.instanceMatrix.needsUpdate = true;
      group.add(inst);
    };
    // Checkerboard the two floor textures so large rooms don't read as one slab.
    makeFloorInstances(
      floors.filter((t) => (t.x + t.z) % 2 === 0),
      floorMatA,
    );
    makeFloorInstances(
      floors.filter((t) => (t.x + t.z) % 2 !== 0),
      floorMatB,
    );

    // --- walls -------------------------------------------------------------
    const WALL_H = this.theme.wallHeight ?? 2.6;
    const wallGeo = new THREE.BoxGeometry(TILE, WALL_H, TILE);
    const makeWalls = (list: Tile[], color: string, key: string) => {
      if (!list.length) return;
      const sideMat = new THREE.MeshStandardMaterial({
        map: wallTexture(key, color, 13, 32, style),
        roughness: style === 'metal' ? 0.6 : 0.95,
        metalness: style === 'metal' ? 0.35 : 0.03,
      });
      const topMat = new THREE.MeshStandardMaterial({
        map: floorTexture(`top-${key}`, this.theme.wallTop, 31, 32, style),
        roughness: 1,
      });
      // [+x, -x, +y, -y, +z, -z]
      const mats = [sideMat, sideMat, topMat, topMat, sideMat, sideMat];
      const inst = new THREE.InstancedMesh(wallGeo, mats, list.length);
      inst.castShadow = true;
      inst.receiveShadow = true;
      const m = new THREE.Matrix4();
      list.forEach((t, i) => {
        const p = this.worldPos(t.x, t.z);
        m.makeTranslation(p.x, WALL_H / 2 - 0.05, p.z);
        inst.setMatrixAt(i, m);
      });
      inst.instanceMatrix.needsUpdate = true;
      group.add(inst);
    };
    makeWalls(walls, this.theme.wall, 'std');
    makeWalls(accentWalls, this.theme.accentWall, 'accent');

    // --- element tiles -----------------------------------------------------
    // Emissive rune plates: free HD-2D flair, and they feed the bloom pass.
    for (const t of elements) {
      const def = ELEMENTS[t.element!];
      const geo = new THREE.PlaneGeometry(TILE, TILE);
      geo.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshStandardMaterial({
        map: elementTileTexture(t.element!, this.theme.floorAlt, def.color),
        emissiveMap: elementGlowTexture(t.element!, def.color),
        emissive: new THREE.Color(def.color),
        emissiveIntensity: 1.6,
        roughness: 0.7,
        metalness: 0.1,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.receiveShadow = true;
      const p = this.worldPos(t.x, t.z);
      mesh.position.set(p.x, 0.01, p.z);
      group.add(mesh);
      elementMeshes.set(`${t.x},${t.z}`, mesh);
    }

    return { group, elementMeshes };
  }
}
