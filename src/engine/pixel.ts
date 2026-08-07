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

/**
 * Terrain "skins". Each reach picks one so a crystal reliquary, a rotting
 * crypt and a machine vault no longer share the same brick-and-flagstone look —
 * only the grid mechanics are shared, never the surfaces. `stone` is the
 * original speckled-flagstone / brick baseline; the rest are new.
 */
export type TerrainStyle = 'stone' | 'crystal' | 'crypt' | 'metal' | 'cave' | 'jungle';

/** Grout / seam border used by several floor skins. */
function floorBorder(ctx: CanvasRenderingContext2D, base: string, res: number, amt = -0.45) {
  ctx.fillStyle = shade(base, amt);
  ctx.fillRect(0, 0, res, 1);
  ctx.fillRect(0, 0, 1, res);
  ctx.fillRect(0, res - 1, res, 1);
  ctx.fillRect(res - 1, 0, 1, res);
}

/**
 * Low-res floor tile, drawn in one of several terrain styles.
 *
 * The cache key folds in `base`, `style` and `seed` as well as `id`: the same
 * `id` ('a'/'b') is reused by every floor, so keying on `id` alone made the
 * first-built reach's colours leak into every other reach. Keying on the
 * inputs keeps each theme's surface its own.
 */
export function floorTexture(
  id: string,
  base: string,
  seed = 7,
  res = 32,
  style: TerrainStyle = 'stone',
): THREE.Texture {
  return cached(`floor:${style}:${base}:${seed}:${id}`, () => {
    const [c, ctx] = canvas(res, res);
    const rnd = mulberry32(seed);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, res, res);

    if (style === 'crystal') {
      // Angular facets: diagonal light/dark shards catching a hard light.
      for (let i = 0; i < 5; i++) {
        const x = Math.floor(rnd() * res);
        const y = Math.floor(rnd() * res);
        const s = 5 + Math.floor(rnd() * 9);
        ctx.fillStyle = shade(base, rnd() < 0.5 ? 0.28 : -0.24);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + s, y + Math.floor(s * 0.4));
        ctx.lineTo(x + Math.floor(s * 0.4), y + s);
        ctx.closePath();
        ctx.fill();
      }
      // A few specular sparkles.
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = shade(base, 0.55);
        ctx.fillRect(Math.floor(rnd() * res), Math.floor(rnd() * res), 1, 1);
      }
      floorBorder(ctx, base, res, -0.3);
    } else if (style === 'crypt') {
      // Four cracked flagstones with mortar between them and hairline cracks.
      ctx.fillStyle = shade(base, -0.42);
      ctx.fillRect(res / 2 - 1, 0, 2, res);
      ctx.fillRect(0, res / 2 - 1, res, 2);
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = shade(base, -0.3);
        let x = Math.floor(rnd() * res);
        let y = Math.floor(rnd() * res);
        const steps = 3 + Math.floor(rnd() * 4);
        for (let s = 0; s < steps; s++) {
          ctx.fillRect(x, y, 1, 1);
          x += rnd() < 0.5 ? 1 : 0;
          y += rnd() < 0.5 ? 1 : -1;
        }
      }
      // Pale bone-dust speckle.
      for (let i = 0; i < 10; i++) {
        ctx.fillStyle = shade(base, 0.14);
        ctx.fillRect(Math.floor(rnd() * res), Math.floor(rnd() * res), 1, 1);
      }
      floorBorder(ctx, base, res);
    } else if (style === 'metal') {
      // Riveted floor plating: a panel cross-seam and corner rivets.
      ctx.fillStyle = shade(base, -0.4);
      ctx.fillRect(res / 2 - 1, 0, 2, res);
      ctx.fillRect(0, res / 2 - 1, res, 2);
      // Brushed horizontal sheen.
      for (let y = 2; y < res; y += 3) {
        if (rnd() < 0.6) {
          ctx.fillStyle = shade(base, 0.1);
          ctx.fillRect(1, y, res - 2, 1);
        }
      }
      const rivets = [4, res / 2 - 4, res / 2 + 3, res - 5];
      for (const rx of rivets) {
        for (const ry of rivets) {
          ctx.fillStyle = shade(base, 0.4);
          ctx.fillRect(rx, ry, 2, 2);
          ctx.fillStyle = shade(base, -0.5);
          ctx.fillRect(rx + 1, ry + 1, 1, 1);
        }
      }
      floorBorder(ctx, base, res, -0.35);
    } else if (style === 'cave') {
      // Organic rock: irregular blotches, rounded pebbles, no hard border.
      for (let y = 0; y < res; y += 4) {
        for (let x = 0; x < res; x += 4) {
          const r = rnd();
          if (r < 0.4) {
            ctx.fillStyle = shade(base, r < 0.16 ? -0.3 : -0.16);
            ctx.fillRect(x, y, 4, 4);
          } else if (r > 0.86) {
            ctx.fillStyle = shade(base, 0.14);
            ctx.fillRect(x, y, 4, 4);
          }
        }
      }
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = shade(base, 0.2);
        ctx.fillRect(Math.floor(rnd() * res), Math.floor(rnd() * res), 2, 2);
      }
    } else if (style === 'jungle') {
      // Mossy earth: soil blotches, moss highlights and little grass tufts.
      for (let y = 0; y < res; y += 3) {
        for (let x = 0; x < res; x += 3) {
          const r = rnd();
          if (r < 0.3) {
            ctx.fillStyle = shade(base, r < 0.14 ? -0.34 : -0.18);
            ctx.fillRect(x, y, 3, 3);
          } else if (r > 0.82) {
            ctx.fillStyle = shade(base, 0.24); // moss patch
            ctx.fillRect(x, y, 3, 3);
          }
        }
      }
      for (let i = 0; i < 10; i++) {
        // grass tufts: short brighter-green vertical strokes
        const x = Math.floor(rnd() * res);
        const y = Math.floor(rnd() * (res - 4));
        ctx.fillStyle = shade(base, 0.42);
        ctx.fillRect(x, y, 1, 3);
        if (rnd() < 0.5) ctx.fillRect(x + 1, y + 1, 1, 2);
      }
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = shade(base, -0.4); // roots / pebbles
        ctx.fillRect(Math.floor(rnd() * res), Math.floor(rnd() * res), 2, 1);
      }
      floorBorder(ctx, base, res, -0.3);
    } else {
      // stone (baseline): chunky 2x2 speckle so it still reads as pixel art.
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
      floorBorder(ctx, base, res);
    }
    return c;
  });
}

/** Wall tile, drawn in one of several terrain styles (see `TerrainStyle`). */
export function wallTexture(
  id: string,
  base: string,
  seed = 13,
  res = 32,
  style: TerrainStyle = 'stone',
): THREE.Texture {
  return cached(`wall:${style}:${base}:${seed}:${id}`, () => {
    const [c, ctx] = canvas(res, res);
    const rnd = mulberry32(seed);

    if (style === 'crystal') {
      // Vertical crystalline columns of varying shade with bright edges.
      ctx.fillStyle = shade(base, -0.4);
      ctx.fillRect(0, 0, res, res);
      for (let x = 0; x < res; ) {
        const w = 3 + Math.floor(rnd() * 4);
        ctx.fillStyle = shade(base, (rnd() - 0.4) * 0.5);
        ctx.fillRect(x, 0, w, res);
        ctx.fillStyle = shade(base, 0.45);
        ctx.fillRect(x, 0, 1, res); // lit left edge of the facet
        x += w;
      }
      return c;
    }
    if (style === 'crypt') {
      // Big mortared ashlar blocks, two courses, with cracks and grime.
      ctx.fillStyle = shade(base, -0.5);
      ctx.fillRect(0, 0, res, res);
      const bh = 15;
      const bw = 15;
      for (let row = 0, y = 0; y < res; y += bh, row++) {
        const offset = row % 2 ? -bw / 2 : 0;
        for (let x = offset; x < res; x += bw) {
          ctx.fillStyle = shade(base, (rnd() - 0.5) * 0.22);
          ctx.fillRect(x + 1, y + 1, bw - 2, bh - 2);
          if (rnd() < 0.5) {
            // hairline crack across the block
            ctx.fillStyle = shade(base, -0.45);
            ctx.fillRect(x + 3 + Math.floor(rnd() * 6), y + 2, 1, bh - 4);
          }
        }
      }
      return c;
    }
    if (style === 'metal') {
      // Riveted metal panels: horizontal seams, a vertical divider, rivets.
      ctx.fillStyle = shade(base, -0.2);
      ctx.fillRect(0, 0, res, res);
      for (let y = 0; y < res; y += 10) {
        ctx.fillStyle = shade(base, -0.5);
        ctx.fillRect(0, y, res, 1);
        for (let x = 3; x < res; x += 7) {
          ctx.fillStyle = shade(base, 0.4);
          ctx.fillRect(x, y + 1, 1, 1);
        }
      }
      ctx.fillStyle = shade(base, -0.5);
      ctx.fillRect(res / 2 - 1, 0, 1, res);
      // faint vertical brushed sheen
      for (let x = 0; x < res; x += 3) {
        if (rnd() < 0.4) {
          ctx.fillStyle = shade(base, 0.12);
          ctx.fillRect(x, 0, 1, res);
        }
      }
      return c;
    }
    if (style === 'cave') {
      // Rough rock: no courses, just mottled patches and a heavy grimy base.
      ctx.fillStyle = shade(base, -0.32);
      ctx.fillRect(0, 0, res, res);
      for (let y = 0; y < res; y += 3) {
        for (let x = 0; x < res; x += 3) {
          const r = rnd();
          if (r < 0.4) {
            ctx.fillStyle = shade(base, r < 0.18 ? -0.5 : 0.12);
            ctx.fillRect(x, y, 3, 3);
          }
        }
      }
      for (let x = 0; x < res; x += 2) {
        if (rnd() < 0.6) {
          ctx.fillStyle = shade(base, -0.55);
          ctx.fillRect(x, res - 2 - Math.floor(rnd() * 4), 2, 5);
        }
      }
      return c;
    }

    if (style === 'jungle') {
      // Dense foliage over a dark trunk: leaf clusters and hanging vines.
      ctx.fillStyle = shade(base, -0.5);
      ctx.fillRect(0, 0, res, res);
      for (let i = 0; i < 22; i++) {
        const x = Math.floor(rnd() * res);
        const y = Math.floor(rnd() * res);
        const s = 3 + Math.floor(rnd() * 4);
        ctx.fillStyle = shade(base, (rnd() - 0.35) * 0.6);
        ctx.fillRect(x, y, s, s);
      }
      for (let i = 0; i < 10; i++) {
        ctx.fillStyle = shade(base, 0.42); // bright leaf catches
        ctx.fillRect(Math.floor(rnd() * res), Math.floor(rnd() * res), 2, 2);
      }
      for (let v = 0; v < 4; v++) {
        // hanging vines: thin full-height strands with a leaf node
        const x = Math.floor(rnd() * res);
        ctx.fillStyle = shade(base, -0.32);
        ctx.fillRect(x, 0, 1, res);
        ctx.fillStyle = shade(base, 0.3);
        ctx.fillRect(x, Math.floor(rnd() * res), 2, 2);
      }
      return c;
    }

    // stone (baseline): brick with alternating courses.
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

/**
 * A soft, tileable cloud-of-mist alpha texture — white blobs on transparent, for
 * the drifting ground-mist layers. Each blob is drawn with its wrap-around copies
 * (a 3×3 neighbourhood) so the texture tiles seamlessly under `RepeatWrapping`.
 * The white carries the shape; the material's colour tints it to the fog.
 */
export function mistTexture(id = 'default', res = 128): THREE.Texture {
  const key = `mist:${id}`;
  const hit = texCache.get(key);
  if (hit) return hit;
  const [c, ctx] = canvas(res, res);
  // Deterministic blob field (no Math.random — stable across builds/replays).
  const blobs = 14;
  for (let i = 0; i < blobs; i++) {
    // Cheap hash-ish spread over the tile.
    const bx = ((i * 71) % res) + ((i * 29) % 13);
    const by = ((i * 113) % res) + ((i * 17) % 11);
    const r = res * (0.12 + (((i * 37) % 100) / 100) * 0.16);
    const a = 0.12 + (((i * 53) % 100) / 100) * 0.16;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const cx = bx + dx * res;
        const cy = by + dy * res;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, `rgba(255,255,255,${a})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, tex);
  return tex;
}

/**
 * A tileable caustic net — grayscale bright ridges on black, for animated liquid
 * surfaces. Used as an `emissiveMap` (the tint comes from the material's emissive
 * colour) and scrolled by offset each frame so the light on the water flows. The
 * wave frequencies are integer multiples of the texture period, so it tiles
 * seamlessly under `RepeatWrapping`. Smooth-sampled — water wants soft light.
 */
export function liquidCausticTexture(id = 'default', res = 64): THREE.Texture {
  const key = `caustic:${id}`;
  const hit = texCache.get(key);
  if (hit) return hit;
  const [c, ctx] = canvas(res, res);
  const img = ctx.createImageData(res, res);
  const TAU = Math.PI * 2;
  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) {
      const u = x / res;
      const v = y / res;
      let n =
        Math.sin(TAU * u + Math.cos(TAU * 2 * v)) +
        Math.sin(TAU * 2 * v + Math.cos(TAU * u)) +
        Math.sin(TAU * 3 * (u + v));
      n = (n + 3) / 6; // -3..3 → 0..1
      const b = Math.round(255 * Math.pow(Math.max(0, n), 3)); // thin bright ridges
      const i = (y * res + x) * 4;
      img.data[i] = b;
      img.data[i + 1] = b;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, tex);
  return tex;
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

/**
 * A soft flame/teardrop glow — pointed at the top, bulbous at the base — with a
 * hot pale core fading through orange to transparent. Used as the shape of the
 * lantern-flame occlusion reveal (see `Billboard`'s `reveal` option), so a
 * player hidden behind a wall shows through as a flame rather than a plain disc.
 * Smooth-sampled (not the pixel-art nearest filter) so the glow reads clean.
 */
export function flameTexture(id = 'default', res = 128): THREE.Texture {
  const key = `flame:${id}`;
  const hit = texCache.get(key);
  if (hit) return hit;
  const [c, ctx] = canvas(res, res);
  const cx = res / 2;
  const wide = res * 0.3;

  const flamePath = () => {
    ctx.beginPath();
    ctx.moveTo(cx, res * 0.08); // hot tip
    ctx.bezierCurveTo(cx + wide * 0.7, res * 0.28, cx + wide, res * 0.6, cx + wide * 0.5, res * 0.82);
    ctx.quadraticCurveTo(cx + wide * 0.28, res * 0.92, cx, res * 0.92);
    ctx.quadraticCurveTo(cx - wide * 0.28, res * 0.92, cx - wide * 0.5, res * 0.82);
    ctx.bezierCurveTo(cx - wide, res * 0.6, cx - wide * 0.7, res * 0.28, cx, res * 0.08);
    ctx.closePath();
  };

  // Soft outer halo so the flame bleeds a little warmth past its edge.
  const halo = ctx.createRadialGradient(cx, res * 0.62, 0, cx, res * 0.62, res * 0.5);
  halo.addColorStop(0, 'rgba(255,180,90,0.45)');
  halo.addColorStop(0.5, 'rgba(255,120,40,0.15)');
  halo.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, res, res);

  // The flame body, clipped to the silhouette.
  ctx.save();
  flamePath();
  ctx.clip();
  const body = ctx.createLinearGradient(0, res * 0.08, 0, res * 0.92);
  body.addColorStop(0, 'rgba(255,244,210,0.98)');
  body.addColorStop(0.35, 'rgba(255,190,90,0.96)');
  body.addColorStop(0.7, 'rgba(255,120,40,0.92)');
  body.addColorStop(1, 'rgba(200,60,20,0.72)');
  ctx.fillStyle = body;
  ctx.fillRect(0, 0, res, res);
  const core = ctx.createRadialGradient(cx, res * 0.6, 0, cx, res * 0.6, res * 0.22);
  core.addColorStop(0, 'rgba(255,255,238,0.95)');
  core.addColorStop(1, 'rgba(255,255,238,0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, res, res);
  ctx.restore();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, tex);
  return tex;
}

/**
 * A five-pointed star with a soft glowing core — the sprite that bursts out on a
 * critical/reaction flourish (additive-blended, so any tint reads). Cached by id.
 */
export function starTexture(id: string, color = '#ffffff', res = 64): THREE.Texture {
  const key = `star:${id}`;
  const cached = texCache.get(key);
  if (cached) return cached;
  const [c, ctx] = canvas(res, res);
  const cx = res / 2;
  const cy = res / 2;
  const outer = res * 0.46;
  const inner = outer * 0.42;
  // Soft glow behind the star so it doesn't read as a hard sticker.
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, outer);
  glow.addColorStop(0, color);
  glow.addColorStop(0.5, 'rgba(255,255,255,0.25)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, res, res);
  // The star itself.
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, tex);
  return tex;
}

/**
 * A painted flat battle backdrop (FF-style): a dusk threshold in the dark with a
 * warm horizon glow, silhouetted broken arches, a fog band and drifting motes —
 * all procedural, tinted by `accent`. Used as `scene.background` behind the
 * fighters in the side-view prototype. Smooth-sampled (not pixel-nearest).
 */
export function backdropTexture(id: string, accent = '#ff8a3d'): THREE.Texture {
  const key = `backdrop:${id}`;
  const hit = texCache.get(key);
  if (hit) return hit;
  const w = 640;
  const h = 480;
  const horizon = h * 0.62;
  const [c, ctx] = canvas(w, h);

  // Sky: cold indigo up top easing to a warmer band at the horizon.
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#080a18');
  sky.addColorStop(0.55, '#141c3e');
  sky.addColorStop(1, '#26264a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizon);
  // Ground: dark, fading down.
  const ground = ctx.createLinearGradient(0, horizon, 0, h);
  ground.addColorStop(0, '#241f39');
  ground.addColorStop(1, '#0a0912');
  ctx.fillStyle = ground;
  ctx.fillRect(0, horizon, w, h - horizon);

  // Warm horizon glow — a distant kept lantern.
  const glow = ctx.createRadialGradient(w * 0.5, horizon, 0, w * 0.5, horizon, w * 0.42);
  glow.addColorStop(0, hexA(accent, 0.5));
  glow.addColorStop(0.4, hexA(accent, 0.16));
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // Silhouetted broken arches along the horizon.
  ctx.fillStyle = '#05060e';
  const arch = (cx: number, bw: number, bh: number) => {
    ctx.beginPath();
    ctx.moveTo(cx - bw / 2, horizon);
    ctx.lineTo(cx - bw / 2, horizon - bh * 0.55);
    ctx.quadraticCurveTo(cx, horizon - bh, cx + bw / 2, horizon - bh * 0.55);
    ctx.lineTo(cx + bw / 2, horizon);
    ctx.closePath();
    ctx.fill();
  };
  arch(w * 0.16, 120, 150);
  arch(w * 0.83, 150, 190);
  arch(w * 0.33, 70, 90);
  // A broken pillar stub.
  ctx.fillRect(w * 0.62, horizon - 70, 26, 70);

  // Soft fog band hugging the horizon.
  const fog = ctx.createLinearGradient(0, horizon - 40, 0, horizon + 40);
  fog.addColorStop(0, 'rgba(160,180,220,0)');
  fog.addColorStop(0.5, 'rgba(150,170,215,0.14)');
  fog.addColorStop(1, 'rgba(160,180,220,0)');
  ctx.fillStyle = fog;
  ctx.fillRect(0, horizon - 40, w, 80);

  // Faint motes / stars in the upper dark (deterministic scatter).
  ctx.fillStyle = 'rgba(200,214,255,0.5)';
  let seed = 7;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = 0; i < 60; i++) {
    const x = rnd() * w;
    const y = rnd() * horizon * 0.9;
    const r = rnd() * 1.3 + 0.3;
    ctx.globalAlpha = 0.25 + rnd() * 0.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, tex);
  return tex;
}

/** CSS hex (#rrggbb) → rgba() string at the given alpha. */
function hexA(hex: string, a: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
