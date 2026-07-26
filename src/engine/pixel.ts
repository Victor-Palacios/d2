import * as THREE from 'three';

/**
 * Pixel-art helpers.
 *
 * Every visual asset in this project is generated procedurally at runtime from
 * the data in `src/assets/art.ts` — there are no binary art files at all. That
 * keeps the repo free of any third-party/ripped assets (plan §0.2) and makes
 * the whole look tunable from code. To swap in real art later, replace the
 * texture factories here with loaders; nothing else needs to change.
 */

export interface PixelArt {
  /** Single-character key -> CSS color. '.' is always transparent. */
  palette: Record<string, string>;
  /** Rows of single-character palette keys, top row first. */
  rows: string[];
}

/** Pads rows to a uniform width so hand-authored art can't break on a typo. */
export function normalize(art: PixelArt): { w: number; h: number; rows: string[] } {
  const w = art.rows.reduce((m, r) => Math.max(m, r.length), 0);
  return { w, h: art.rows.length, rows: art.rows.map((r) => r.padEnd(w, '.')) };
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

/** Applies the "crisp pixels" sampling settings required by the HD-2D look. */
export function crisp(tex: THREE.Texture, srgb = true): THREE.Texture {
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.anisotropy = 1;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Draws a `PixelArt` onto a canvas at 1 canvas-pixel per art-pixel. */
export function drawPixelArt(art: PixelArt): HTMLCanvasElement {
  const { w, h, rows } = normalize(art);
  const [c, ctx] = canvas(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const key = rows[y][x];
      if (key === '.' || key === ' ') continue;
      const color = art.palette[key];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

/** Renders pixel art into a DOM element (menus, cards) at an integer scale. */
export function pixelArtElement(art: PixelArt, scale = 4): HTMLCanvasElement {
  const c = drawPixelArt(art);
  const { w, h } = normalize(art);
  c.style.width = `${w * scale}px`;
  c.style.height = `${h * scale}px`;
  c.style.imageRendering = 'pixelated';
  return c;
}

const spriteCache = new Map<string, THREE.Texture>();

/** Builds (and caches) a nearest-filtered sprite texture from pixel art. */
export function spriteTexture(id: string, art: PixelArt): THREE.Texture {
  const hit = spriteCache.get(id);
  if (hit) return hit;
  const tex = new THREE.CanvasTexture(drawPixelArt(art));
  crisp(tex);
  spriteCache.set(id, tex);
  return tex;
}

/** Aspect ratio (w/h) of a piece of pixel art — used to size billboards. */
export function artAspect(art: PixelArt): number {
  const { w, h } = normalize(art);
  return w / h;
}

/** Horizontally mirrored copy of a sprite (cheap left/right facing variants). */
export function mirrorTexture(id: string, art: PixelArt): THREE.Texture {
  const hit = spriteCache.get(id);
  if (hit) return hit;
  const src = drawPixelArt(art);
  const [c, ctx] = canvas(src.width, src.height);
  ctx.translate(src.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  crisp(tex);
  spriteCache.set(id, tex);
  return tex;
}

// ---------------------------------------------------------------------------
// Procedural tile textures. Deterministic (seeded) so a rebuild looks the same.
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(Math.min(255, Math.max(0, ((n >> 16) & 255) * (1 + amount))));
  const g = Math.round(Math.min(255, Math.max(0, ((n >> 8) & 255) * (1 + amount))));
  const b = Math.round(Math.min(255, Math.max(0, (n & 255) * (1 + amount))));
  return `rgb(${r},${g},${b})`;
}

const texCache = new Map<string, THREE.Texture>();

function cached(id: string, build: () => HTMLCanvasElement, srgb = true): THREE.Texture {
  const hit = texCache.get(id);
  if (hit) return hit;
  const tex = new THREE.CanvasTexture(build());
  crisp(tex, srgb);
  texCache.set(id, tex);
  return tex;
}

/** Low-res speckled stone floor. `res` stays small on purpose — pixels are the point. */
export function floorTexture(id: string, base: string, seed = 7, res = 32): THREE.Texture {
  return cached(`floor:${id}`, () => {
    const [c, ctx] = canvas(res, res);
    const rnd = mulberry32(seed);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, res, res);
    // Chunky 2x2 speckle so it still reads as "pixel art" up close.
    for (let y = 0; y < res; y += 2) {
      for (let x = 0; x < res; x += 2) {
        const r = rnd();
        if (r < 0.34) {
          ctx.fillStyle = shade(base, r < 0.12 ? -0.28 : -0.12);
          ctx.fillRect(x, y, 2, 2);
        } else if (r > 0.9) {
          ctx.fillStyle = shade(base, 0.16);
          ctx.fillRect(x, y, 2, 2);
        }
      }
    }
    // Grout border so tile seams read as individual flagstones.
    ctx.fillStyle = shade(base, -0.45);
    ctx.fillRect(0, 0, res, 1);
    ctx.fillRect(0, 0, 1, res);
    ctx.fillRect(0, res - 1, res, 1);
    ctx.fillRect(res - 1, 0, 1, res);
    return c;
  });
}

/** Brick wall with alternating courses. */
export function wallTexture(id: string, base: string, seed = 13, res = 32): THREE.Texture {
  return cached(`wall:${id}`, () => {
    const [c, ctx] = canvas(res, res);
    const rnd = mulberry32(seed);
    ctx.fillStyle = shade(base, -0.35);
    ctx.fillRect(0, 0, res, res);
    const bh = 8;
    const bw = 16;
    for (let row = 0, y = 0; y < res; y += bh, row++) {
      const offset = row % 2 ? -bw / 2 : 0;
      for (let x = offset; x < res; x += bw) {
        ctx.fillStyle = shade(base, (rnd() - 0.5) * 0.3);
        ctx.fillRect(x + 1, y + 1, bw - 2, bh - 2);
      }
    }
    // A little grime along the bottom to ground the wall.
    for (let x = 0; x < res; x += 2) {
      if (rnd() < 0.5) {
        ctx.fillStyle = shade(base, -0.5);
        ctx.fillRect(x, res - 2 - Math.floor(rnd() * 3), 2, 4);
      }
    }
    return c;
  });
}

/** Glowing rune plate used for the five element floor tiles. */
export function elementTileTexture(id: string, base: string, glow: string, res = 32): THREE.Texture {
  return cached(`elem:${id}`, () => {
    const [c, ctx] = canvas(res, res);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, res, res);
    ctx.fillStyle = shade(base, -0.5);
    ctx.fillRect(0, 0, res, 2);
    ctx.fillRect(0, 0, 2, res);
    ctx.fillRect(0, res - 2, res, 2);
    ctx.fillRect(res - 2, 0, 2, res);
    ctx.fillStyle = glow;
    // Concentric rune ring.
    ctx.fillRect(6, 6, res - 12, 2);
    ctx.fillRect(6, res - 8, res - 12, 2);
    ctx.fillRect(6, 6, 2, res - 12);
    ctx.fillRect(res - 8, 6, 2, res - 12);
    ctx.fillRect(res / 2 - 3, res / 2 - 3, 6, 6);
    ctx.fillRect(res / 2 - 1, 10, 2, 4);
    ctx.fillRect(res / 2 - 1, res - 14, 2, 4);
    ctx.fillRect(10, res / 2 - 1, 4, 2);
    ctx.fillRect(res - 14, res / 2 - 1, 4, 2);
    return c;
  });
}

/** Emissive mask for element tiles (only the rune glows into bloom). */
export function elementGlowTexture(id: string, glow: string, res = 32): THREE.Texture {
  return cached(`elemGlow:${id}`, () => {
    const [c, ctx] = canvas(res, res);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, res, res);
    ctx.fillStyle = glow;
    ctx.fillRect(6, 6, res - 12, 2);
    ctx.fillRect(6, res - 8, res - 12, 2);
    ctx.fillRect(6, 6, 2, res - 12);
    ctx.fillRect(res - 8, 6, 2, res - 12);
    ctx.fillRect(res / 2 - 3, res / 2 - 3, 6, 6);
    return c;
  });
}

/** Soft radial dot — particles, torch glow, ground decals. */
export function radialTexture(id: string, color: string, res = 64): THREE.Texture {
  const hit = texCache.get(`radial:${id}`);
  if (hit) return hit;
  const [c, ctx] = canvas(res, res);
  const g = ctx.createRadialGradient(res / 2, res / 2, 0, res / 2, res / 2, res / 2);
  g.addColorStop(0, color);
  g.addColorStop(0.4, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, res, res);
  const tex = new THREE.CanvasTexture(c);
  // Particles want smooth sampling, not nearest.
  tex.colorSpace = THREE.SRGBColorSpace;
  texCache.set(`radial:${id}`, tex);
  return tex;
}
