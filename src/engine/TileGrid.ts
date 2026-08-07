import * as THREE from 'three';
import { elementGlowTexture, elementTileTexture, floorTexture, liquidCausticTexture, wallTexture } from './pixel';
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
  | 'hazard'
  | 'key'
  | 'door'
  | 'switch'
  | 'toggleWall'
  | 'secret'
  | 'liquid'
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
  /**
   * Per-floor lighting mood — tints the shared ambient/hemisphere lights so a
   * floor sets its own atmosphere, not just its fog. Purely cosmetic. Unset
   * channels fall back to the rig's neutral defaults.
   */
  ambientColor?: string;
  hemiSky?: string;
  hemiGround?: string;
  /** Tint of `~` liquid pools on this floor (water, meltwater, lava…). Cool default. */
  liquidColor?: string;
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
 *   '^'  hazard tile (drains lantern light on entry — a glowing warning plate)
 *   'k'  key pickup              '+'  locked door (blocks until a key is spent)
 *   '*'  switch (flips barriers) '%'  toggle-wall barrier (starts solid)
 *   '?'  secret wall (looks solid, is passable — crumbles when stepped into)
 *   '~'  liquid floor (walkable pool with an animated surface — purely visual)
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

  /** Door tiles that have been unlocked — a closed door blocks like a wall. */
  private doorsOpen = new Set<string>();

  /**
   * Whether the floor's toggle-wall group is open (passable). Every `%` barrier
   * flips together when a `*` switch is stepped on. Starts solid (closed).
   * Transient — not saved; resets to solid when the floor is rebuilt.
   */
  private togglesOpen = false;

  /**
   * Secret walls (`?`) the party has walked into and revealed. A secret is
   * always passable; this only tracks whether its disguising wall still covers
   * it. Transient — not saved; a rebuilt floor re-hides its secrets (harmless,
   * since a revealed secret is just open floor and any chest behind it persists).
   */
  private revealed = new Set<string>();

  /**
   * Element plates (`W F N M D`) the party has stepped and lit. On a plate-puzzle
   * floor, lighting every plate opens the toggle-wall group. Transient.
   */
  private litPlates = new Set<string>();

  /** Per-tile height offset in world units, keyed `"x,z"` (purely visual). */
  private elevation: Record<string, number>;

  constructor(rows: string[], theme: TileTheme = DEFAULT_THEME, elevation: Record<string, number> = {}) {
    this.theme = theme;
    this.elevation = elevation;
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
    if (ch === '^') return { x, z, kind: 'hazard' };
    if (ch === 'k') return { x, z, kind: 'key' };
    if (ch === '+') return { x, z, kind: 'door' };
    if (ch === '*') return { x, z, kind: 'switch' };
    if (ch === '%') return { x, z, kind: 'toggleWall' };
    if (ch === '?') return { x, z, kind: 'secret' };
    if (ch === '~') return { x, z, kind: 'liquid' };
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

  /** Unlocks a door tile (spent a key) so it becomes passable. */
  openDoor(x: number, z: number) {
    this.doorsOpen.add(`${x},${z}`);
  }

  /** Whether a door tile at (x, z) is still locked (closed). */
  isDoorClosed(x: number, z: number): boolean {
    const t = this.at(x, z);
    return t?.kind === 'door' && !this.doorsOpen.has(`${x},${z}`);
  }

  /** Flips the floor's toggle-wall group (all `%` barriers) open↔solid. */
  flipToggles() {
    this.togglesOpen = !this.togglesOpen;
  }

  /** Marks a secret wall (`?`) as discovered, so its false wall stops covering it. */
  revealSecret(x: number, z: number) {
    this.revealed.add(`${x},${z}`);
  }

  /** Whether a secret tile at (x, z) is still disguised as a wall (undiscovered). */
  isSecretHidden(x: number, z: number): boolean {
    const t = this.at(x, z);
    return t?.kind === 'secret' && !this.revealed.has(`${x},${z}`);
  }

  /** Whether a toggle-wall tile at (x, z) is currently a solid barrier. */
  isToggleSolid(x: number, z: number): boolean {
    const t = this.at(x, z);
    return t?.kind === 'toggleWall' && !this.togglesOpen;
  }

  /** Lights an element plate (plate-puzzle). Returns true if it was newly lit. */
  lightPlate(x: number, z: number): boolean {
    const k = `${x},${z}`;
    if (this.litPlates.has(k)) return false;
    this.litPlates.add(k);
    return true;
  }

  /** Whether an element plate at (x, z) has been lit. */
  isPlateLit(x: number, z: number): boolean {
    return this.litPlates.has(`${x},${z}`);
  }

  /** Whether every element plate on the floor has been lit (plate-puzzle solved). */
  allPlatesLit(): boolean {
    let total = 0;
    let lit = 0;
    this.forEach((t) => {
      if (t.kind === 'element') {
        total++;
        if (this.litPlates.has(`${t.x},${t.z}`)) lit++;
      }
    });
    return total > 0 && lit === total;
  }

  /**
   * Whether the party can step onto (x, z): a walkable tile not occupied by
   * solid decor, not a still-locked door, and not a raised toggle-wall barrier.
   * Use this for movement; `walkable()` is pure grid geometry.
   */
  passable(x: number, z: number): boolean {
    const k = `${x},${z}`;
    return this.walkable(x, z) && !this.blocked.has(k) && !this.isDoorClosed(x, z) && !this.isToggleSolid(x, z);
  }

  worldPos(x: number, z: number, y = 0): THREE.Vector3 {
    return new THREE.Vector3((x - (this.width - 1) / 2) * TILE, y, (z - (this.depth - 1) / 2) * TILE);
  }

  /** Per-tile visual height offset (dais > 0 / pit < 0). 0 when unset. */
  floorY(x: number, z: number): number {
    return this.elevation[`${x},${z}`] ?? 0;
  }

  forEach(fn: (t: Tile) => void) {
    for (const row of this.tiles) for (const t of row) fn(t);
  }

  /**
   * Builds the 3D geometry for this floor: real floor quads and real wall boxes
   * so the environment has genuine depth and can receive the key light's
   * shadows (plan §3, "the 3D half").
   */
  build(): {
    group: THREE.Group;
    elementMeshes: Map<string, THREE.Mesh>;
    toggleMeshes: Map<string, THREE.Mesh>;
    secretMeshes: Map<string, THREE.Mesh>;
    liquidMeshes: Map<string, THREE.Mesh>;
  } {
    const group = new THREE.Group();
    const elementMeshes = new Map<string, THREE.Mesh>();
    const toggleMeshes = new Map<string, THREE.Mesh>();
    const secretMeshes = new Map<string, THREE.Mesh>();
    const liquidMeshes = new Map<string, THREE.Mesh>();

    const floors: Tile[] = [];
    const walls: Tile[] = [];
    const accentWalls: Tile[] = [];
    const elements: Tile[] = [];
    const hazards: Tile[] = [];
    const liquids: Tile[] = [];

    this.forEach((t) => {
      if (t.kind === 'void') return;
      if (t.kind === 'wall') {
        (this.accent.has(`${t.x},${t.z}`) ? accentWalls : walls).push(t);
      } else if (t.kind === 'element') {
        elements.push(t);
      } else if (t.kind === 'hazard') {
        hazards.push(t);
      } else if (t.kind === 'liquid') {
        // Liquid tiles get their own animated surface instead of a floor quad.
        liquids.push(t);
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
    // Flat tiles stay cheap planes; elevated tiles become plinths below.
    const flat = floors.filter((t) => this.floorY(t.x, t.z) === 0);
    const raised = floors.filter((t) => this.floorY(t.x, t.z) !== 0);
    // Checkerboard the two floor textures so large rooms don't read as one slab.
    makeFloorInstances(
      flat.filter((t) => (t.x + t.z) % 2 === 0),
      floorMatA,
    );
    makeFloorInstances(
      flat.filter((t) => (t.x + t.z) % 2 !== 0),
      floorMatB,
    );

    // Raised / sunken tiles get real thickness (a plinth) so a dais reads as a
    // solid step with visible sides and a pit reads as a recess — a plain lifted
    // plane would look like it floats. Top = the walkable surface at floorY;
    // sides use the wall skin so the step matches the room's stone/crystal/etc.
    if (raised.length) {
      const PLINTH_H = 0.7;
      const plinthGeo = new THREE.BoxGeometry(TILE, PLINTH_H, TILE);
      const topMat = new THREE.MeshStandardMaterial({
        map: floorTexture('a', this.theme.floor, 7, 32, style),
        roughness,
        metalness,
      });
      const sideMat = new THREE.MeshStandardMaterial({
        map: wallTexture('plinth', this.theme.wall, 13, 32, style),
        roughness: style === 'metal' ? 0.6 : 0.95,
        metalness: style === 'metal' ? 0.35 : 0.03,
      });
      const mats = [sideMat, sideMat, topMat, topMat, sideMat, sideMat];
      const inst = new THREE.InstancedMesh(plinthGeo, mats, raised.length);
      inst.receiveShadow = true;
      inst.castShadow = true;
      const m = new THREE.Matrix4();
      raised.forEach((t, i) => {
        const p = this.worldPos(t.x, t.z);
        // Top face sits at floorY; the box extends PLINTH_H below it.
        m.makeTranslation(p.x, this.floorY(t.x, t.z) - PLINTH_H / 2, p.z);
        inst.setMatrixAt(i, m);
      });
      inst.instanceMatrix.needsUpdate = true;
      group.add(inst);
    }

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
      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      const scl = new THREE.Vector3(1, 1, 1);
      list.forEach((t, i) => {
        const p = this.worldPos(t.x, t.z);
        // Per-tile height raises a wall's top (elevation > 0 → taller box), so a
        // boss room's back wall can tower. The base stays planted at the floor.
        const h = Math.max(0.4, WALL_H + this.floorY(t.x, t.z));
        scl.set(1, h / WALL_H, 1);
        pos.set(p.x, h / 2 - 0.05, p.z);
        m.compose(pos, quat, scl);
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
      mesh.position.set(p.x, this.floorY(t.x, t.z) + 0.01, p.z);
      group.add(mesh);
      elementMeshes.set(`${t.x},${t.z}`, mesh);
    }

    // --- hazard tiles ------------------------------------------------------
    // Walkable, but they gutter the lantern on entry (see DungeonScene). The
    // plate glows a hot warning colour so the danger reads before you step.
    if (hazards.length) {
      const hazGeo = new THREE.PlaneGeometry(TILE, TILE);
      hazGeo.rotateX(-Math.PI / 2);
      const hazMat = new THREE.MeshStandardMaterial({
        map: floorTexture('hazard', this.theme.floor, 23, 32, style),
        emissive: new THREE.Color('#ff4a2a'),
        emissiveIntensity: 0.75,
        roughness: 0.8,
        metalness: 0.05,
      });
      const inst = new THREE.InstancedMesh(hazGeo, hazMat, hazards.length);
      inst.receiveShadow = true;
      const m = new THREE.Matrix4();
      hazards.forEach((t, i) => {
        const p = this.worldPos(t.x, t.z);
        m.makeTranslation(p.x, this.floorY(t.x, t.z) + 0.02, p.z);
        inst.setMatrixAt(i, m);
      });
      inst.instanceMatrix.needsUpdate = true;
      group.add(inst);
    }

    // --- switches & toggle-wall barriers -----------------------------------
    const switches: Tile[] = [];
    const toggles: Tile[] = [];
    this.forEach((t) => {
      if (t.kind === 'switch') switches.push(t);
      else if (t.kind === 'toggleWall') toggles.push(t);
    });
    // Switch: a walkable emissive lever plate; stepping it flips the group.
    if (switches.length) {
      const geo = new THREE.PlaneGeometry(TILE, TILE);
      geo.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshStandardMaterial({
        map: floorTexture('switch', this.theme.floorAlt, 29, 32, style),
        emissive: new THREE.Color('#7bdc8a'),
        emissiveIntensity: 0.7,
        roughness: 0.6,
        metalness: 0.1,
      });
      const inst = new THREE.InstancedMesh(geo, mat, switches.length);
      inst.receiveShadow = true;
      const m = new THREE.Matrix4();
      switches.forEach((t, i) => {
        const p = this.worldPos(t.x, t.z);
        m.makeTranslation(p.x, this.floorY(t.x, t.z) + 0.02, p.z);
        inst.setMatrixAt(i, m);
      });
      inst.instanceMatrix.needsUpdate = true;
      group.add(inst);
    }
    // Toggle-wall: an emissive barrier box, shown when solid and hidden once the
    // switch opens the group. Individual meshes so visibility can flip live.
    if (toggles.length) {
      const bh = WALL_H * 0.9;
      const barGeo = new THREE.BoxGeometry(TILE, bh, TILE);
      const barMat = new THREE.MeshStandardMaterial({
        map: wallTexture('toggle', this.theme.accentWall, 17, 32, style),
        emissive: new THREE.Color('#5fd8ff'),
        emissiveIntensity: 0.6,
        roughness: 0.5,
        metalness: 0.1,
      });
      for (const t of toggles) {
        const mesh = new THREE.Mesh(barGeo, barMat);
        mesh.castShadow = true;
        const p = this.worldPos(t.x, t.z);
        mesh.position.set(p.x, this.floorY(t.x, t.z) + bh / 2 - 0.05, p.z);
        mesh.visible = this.isToggleSolid(t.x, t.z);
        group.add(mesh);
        toggleMeshes.set(`${t.x},${t.z}`, mesh);
      }
    }

    // --- secret walls ------------------------------------------------------
    // A '?' tile is passable floor (rendered above with the other floors) hidden
    // under a wall box that is deliberately IDENTICAL to a real wall — same skin,
    // same height — so it can't be told apart until the party walks into it and
    // it crumbles. One mesh per secret so its visibility can drop on reveal.
    const secrets: Tile[] = [];
    this.forEach((t) => {
      if (t.kind === 'secret') secrets.push(t);
    });
    if (secrets.length) {
      const sideMat = new THREE.MeshStandardMaterial({
        map: wallTexture('std', this.theme.wall, 13, 32, style),
        roughness: style === 'metal' ? 0.6 : 0.95,
        metalness: style === 'metal' ? 0.35 : 0.03,
      });
      const topMat = new THREE.MeshStandardMaterial({
        map: floorTexture('top-std', this.theme.wallTop, 31, 32, style),
        roughness: 1,
      });
      const mats = [sideMat, sideMat, topMat, topMat, sideMat, sideMat];
      for (const t of secrets) {
        const h = Math.max(0.4, WALL_H + this.floorY(t.x, t.z));
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(TILE, h, TILE), mats);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const p = this.worldPos(t.x, t.z);
        mesh.position.set(p.x, h / 2 - 0.05, p.z);
        mesh.visible = this.isSecretHidden(t.x, t.z);
        group.add(mesh);
        secretMeshes.set(`${t.x},${t.z}`, mesh);
      }
    }

    // --- liquid pools ------------------------------------------------------
    // A '~' tile is a walkable pool: a slightly-recessed reflective plane (low
    // roughness so it catches the key light as a sheen) lit by a scrolling
    // caustic emissive net. One shared material across the floor's pools, so the
    // scene can scroll/pulse them all with a single write. Purely visual.
    if (liquids.length) {
      const tint = new THREE.Color(this.theme.liquidColor ?? '#2f7fb8');
      const geo = new THREE.PlaneGeometry(TILE, TILE);
      geo.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshStandardMaterial({
        color: tint.clone().multiplyScalar(0.5), // the still water body, darker
        emissive: tint,
        emissiveMap: liquidCausticTexture(),
        emissiveIntensity: 0.8,
        roughness: 0.18,
        metalness: 0.5,
      });
      for (const t of liquids) {
        const mesh = new THREE.Mesh(geo, mat);
        mesh.receiveShadow = true;
        const p = this.worldPos(t.x, t.z);
        // A shallow dip below the tile's floor so the pool reads as recessed.
        mesh.position.set(p.x, this.floorY(t.x, t.z) - 0.06, p.z);
        group.add(mesh);
        liquidMeshes.set(`${t.x},${t.z}`, mesh);
      }
    }

    return { group, elementMeshes, toggleMeshes, secretMeshes, liquidMeshes };
  }
}
