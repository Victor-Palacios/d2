// Procedural creature sprites — the no-API authoring path (docs/procedural-sprites.md).
//
// Each builder returns a { palette, rows } PixelArt ready to drop into
// src/assets/art.ts CREATURES. Target 64px tall to match the existing roster.
//
// The recipe (what separates a "cute sticker" from a game sprite):
//   1. Full, face-forward BODY — head + torso + limbs, not a floating blob.
//   2. A 3-step TONAL RAMP per material (base -> shadow low, highlight upper-left),
//      applied with shadeInto() so it clips to the body instead of spilling.
//   3. Big GLOSSY eyes: white oval, big pupil, a large + a small sparkle.
//   4. A small, un-dominant MUZZLE (an oversized cream muzzle reads as a beard).
//   5. Per-creature INTERNAL DETAIL (fur tufts, jelly bubbles, leaf veins).
//   6. Gentle ASYMMETRY — an off-centre gaze, uneven limbs, a tail on one side —
//      so it doesn't read as a stiff, mirror-perfect mascot.
//   7. A baked contact shadow ('S'), then smooth() + outlineSil() for a clean edge.
import { grid, ellipse, rect, dot, set, smooth, outlineSil, toArt } from './compose.mjs';

export function glossyEyes(g, cx, dx, y, rx, ry, tilt = 0) {
  let i = 0;
  for (const sx of [cx - dx, cx + dx]) {
    const yy = y + (i === 0 ? -tilt : tilt); // a slight tilt breaks the dead-symmetry stare
    ellipse(g, sx, yy, rx, ry, 'w', { mirror: false });
    ellipse(g, sx, yy + ry * 0.15, rx * 0.72, ry * 0.78, 'p', { mirror: false });
    ellipse(g, sx - rx * 0.35, yy - ry * 0.4, rx * 0.34, ry * 0.34, 's', { mirror: false });
    set(g, Math.round(sx + rx * 0.35), Math.round(yy + ry * 0.35), 's');
    i++;
  }
}
// Fill an ellipse only where the grid already holds one of `over` — a poor-man's
// clip so a shadow/highlight hugs the body instead of spilling past its edge.
export function shadeInto(g, cx, cy, rx, ry, k, over) {
  const s = new Set(over);
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1 && g[y] && s.has(g[y][x])) set(g, x, y, k);
    }
}
export const contactShadow = (g, cx, y, rx) => ellipse(g, cx, y, rx, Math.max(2, rx * 0.16), 'S');
export const finish = (g, P) => { smooth(g); outlineSil(g, 'k'); return toArt(g, P); };

// --- Cindercat — fire kitten soul (rookie / fire) --------------------------
export function cindercat() {
  const P = { '.': '', S: '#0d0a14', k: '#2a1420', r: '#c73a22', o: '#ff7a33', y: '#ffb04f',
    f: '#ffd98a', m: '#ffe9c6', d: '#e0a56a', w: '#fff6e8', p: '#241021', s: '#ffffff', c: '#ff8f8f', e: '#e86a6a' };
  const g = grid(60, 64); const cx = 30;
  contactShadow(g, cx, 60, 18);
  ellipse(g, 49, 41, 3.8, 8.5, 'o'); ellipse(g, 51, 33, 3, 6, 'y'); ellipse(g, 52.5, 28, 1.8, 3.6, 'f');
  shadeInto(g, 48, 46, 4, 5, 'r', ['o']);
  ellipse(g, 19, 13, 4.2, 6.5, 'o'); ellipse(g, 41, 11, 4.2, 6.5, 'o');       // right ear raised -> head tilt
  ellipse(g, 19, 14, 2, 3.4, 'e'); ellipse(g, 41, 12, 2, 3.4, 'e');           // inner ear
  ellipse(g, cx, 45, 15, 13, 'o'); ellipse(g, cx, 24, 16.5, 15, 'o');
  shadeInto(g, cx, 16, 15, 12, 'y', ['o']); shadeInto(g, cx - 4, 13, 8, 7, 'f', ['o', 'y']);
  shadeInto(g, cx, 40, 18, 12, 'r', ['o']); shadeInto(g, cx, 54, 14, 8, 'r', ['o']);
  ellipse(g, cx, 29, 6, 4.2, 'm'); shadeInto(g, cx, 31, 6, 2.4, 'd', ['m']);  // small muzzle
  ellipse(g, cx, 48, 6.5, 6.5, 'm'); shadeInto(g, cx, 51, 6, 4, 'd', ['m']);  // separate chest patch
  for (const fy of [45, 48, 51]) set(g, cx, fy, 'f');                          // chest fluff
  set(g, 49, 44, 'r'); set(g, 50, 39, 'r'); set(g, 51, 35, 'y');              // tail bands
  ellipse(g, cx - 8, 56, 4, 3, 'm'); ellipse(g, cx + 8, 56, 4, 3, 'm');
  glossyEyes(g, cx + 1, 8, 23, 4.2, 5, 1);
  dot(g, cx + 1, cx - 10, 27, 'c'); dot(g, cx + 1, cx - 10, 28, 'c');
  set(g, cx + 1, 26, 'r'); set(g, cx, 29, 'p'); set(g, cx + 1, 30, 'p'); set(g, cx + 2, 29, 'p');
  return finish(g, P);
}

// --- Tideling — water jelly (rookie / water) -------------------------------
export function tideling() {
  const P = { '.': '', S: '#08131a', k: '#0e2a38', d: '#2f9fc4', b: '#57c6e6', h: '#a6ecff',
    w: '#ecffff', p: '#0e2a38', s: '#ffffff', c: '#ff9ab0', t: '#c9f6ff' };
  const g = grid(60, 60); const cx = 30;
  contactShadow(g, cx, 55, 19);
  ellipse(g, cx, 30, 18, 17, 'b'); ellipse(g, cx, 40, 18, 12, 'b');
  ellipse(g, cx - 13, 47, 5.5, 5, 'b'); ellipse(g, cx + 1, 49, 6, 5.5, 'b'); ellipse(g, cx + 13, 46, 4.5, 4.5, 'b'); // uneven feet
  shadeInto(g, cx - 4, 20, 12, 10, 'h', ['b']); shadeInto(g, cx - 5, 16, 7, 6, 'w', ['b', 'h']);
  shadeInto(g, cx, 44, 18, 10, 'd', ['b']);
  shadeInto(g, cx - 13, 49, 5, 4, 'd', ['b']); shadeInto(g, cx + 1, 51, 5, 4, 'd', ['b']); shadeInto(g, cx + 13, 48, 4, 3, 'd', ['b']);
  ellipse(g, cx + 9, 34, 2.4, 3.2, 't'); ellipse(g, cx - 10, 38, 1.8, 2.6, 't'); ellipse(g, cx + 4, 43, 1.4, 2, 't'); // inner bubbles
  for (let i = 0; i < 6; i++) set(g, cx - 8 + i, 12 + Math.floor(i * 0.5), 'w'); // rim glint
  glossyEyes(g, cx, 8, 30, 4, 4.8, 1);
  dot(g, cx, cx - 12, 35, 'c'); dot(g, cx, cx - 12, 36, 'c');
  for (const [mx, my] of [[-2, 38], [-1, 39], [0, 39], [1, 39], [2, 38]]) set(g, cx + mx, my, 'p');
  return finish(g, P);
}

// --- Mossling — nature sprout (rookie / nature) ----------------------------
export function mossling() {
  const P = { '.': '', S: '#0a1208', k: '#1c2a16', r: '#3f7a34', o: '#5aa845', y: '#8ed36a',
    f: '#c4ef9a', m: '#efe6c4', d: '#c9b98a', w: '#fbffee', p: '#1c2a16', s: '#ffffff', c: '#ff9a9a',
    L: '#7bd06a', l: '#b6ef8f', v: '#3f7a34', b: '#8a5a3a' };
  const g = grid(58, 62); const cx = 29;
  contactShadow(g, cx, 58, 17);
  rect(g, cx - 1, 6, cx + 1, 21, 'b');                                         // stem runs into the body
  ellipse(g, cx - 7, 7, 6, 3.6, 'L'); ellipse(g, cx + 5, 11, 4, 2.6, 'L');     // uneven leaves
  shadeInto(g, cx - 7, 6, 5, 2.6, 'l', ['L']); shadeInto(g, cx + 5, 10, 3, 1.8, 'l', ['L']);
  for (let i = 0; i < 5; i++) set(g, cx - 10 + i, 7 + Math.floor(i * 0.2), 'v'); // leaf veins
  for (let i = 0; i < 3; i++) set(g, cx + 3 + i, 11, 'v');
  ellipse(g, cx, 36, 17, 17, 'o');
  shadeInto(g, cx - 4, 27, 12, 11, 'y', ['o']); shadeInto(g, cx - 5, 23, 7, 6, 'f', ['o', 'y']);
  shadeInto(g, cx, 46, 17, 11, 'r', ['o']);
  for (const [px, py, kk] of [[18, 44, 'r'], [41, 41, 'r'], [22, 30, 'f'], [39, 31, 'f'], [30, 50, 'r'], [14, 37, 'r'], [44, 35, 'y'], [26, 46, 'f']]) set(g, px, py, kk);
  ellipse(g, cx, 43, 6.5, 5, 'm'); shadeInto(g, cx, 46, 6, 3, 'd', ['m']);     // small muzzle
  ellipse(g, cx - 17, 31, 3, 4.5, 'o'); ellipse(g, cx + 16, 40, 3, 4, 'o');    // one arm up, one down
  ellipse(g, cx - 8, 54, 4, 3, 'y'); ellipse(g, cx + 8, 54, 4, 3, 'y');
  glossyEyes(g, cx, 8, 36, 4.2, 5, 1);
  dot(g, cx, cx - 12, 41, 'c'); dot(g, cx, cx - 12, 42, 'c');
  set(g, cx - 1, 45, 'p'); set(g, cx, 46, 'p'); set(g, cx + 1, 45, 'p');
  return finish(g, P);
}

// id -> { element, build }. Element is metadata for wiring into creatures.ts.
export const CREATURES = {
  cindercat: { element: 'fire', build: cindercat },
  tideling: { element: 'water', build: tideling },
  mossling: { element: 'nature', build: mossling },
};
