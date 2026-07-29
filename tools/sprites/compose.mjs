// A tiny char-grid drawing kit for composing cute creature sprites in code,
// then emitting the repo's { palette, rows } PixelArt form (src/engine/pixel.ts).
//
// The repo is asset-free (plan §0.2): every sprite is generated in code, never
// a binary file. This kit is the no-API path for authoring new creatures — see
// docs/procedural-sprites.md.
export function grid(w, h, fill = '.') {
  const g = Array.from({ length: h }, () => Array(w).fill(fill));
  g.w = w; g.h = h;
  return g;
}
const inb = (g, x, y) => x >= 0 && y >= 0 && x < g.w && y < g.h;
export function set(g, x, y, k) { x = Math.round(x); y = Math.round(y); if (inb(g, x, y)) g[y][x] = k; }

// Filled ellipse. If mirror, also plot the x-mirror about cx for perfect symmetry.
export function ellipse(g, cx, cy, rx, ry, k, { mirror = true, only } = {}) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) {
        if (!only || only(x, y)) set(g, x, y, k);
        if (mirror && !only) set(g, 2 * cx - x, y, k);
      }
    }
  }
}
export function rect(g, x0, y0, x1, y1, k) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(g, x, y, k);
}
// Symmetric single dot pair about cx.
export function dot(g, cx, x, y, k) { set(g, x, y, k); set(g, 2 * cx - x, y, k); }

// Replace every transparent cell 4-adjacent to a body cell with the outline key.
// Naive: outlines interior gaps too, and traces every stair-step. Prefer
// smooth()+outlineSil() for a clean silhouette; kept for simple cases.
export function outline(g, k = 'k', bgset = new Set(['.'])) {
  const add = [];
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (!bgset.has(g[y][x])) continue;
    if ((inb(g, x - 1, y) && !bgset.has(g[y][x - 1])) ||
        (inb(g, x + 1, y) && !bgset.has(g[y][x + 1])) ||
        (inb(g, x, y - 1) && !bgset.has(g[y - 1][x])) ||
        (inb(g, x, y + 1) && !bgset.has(g[y + 1][x]))) add.push([x, y]);
  }
  for (const [x, y] of add) g[y][x] = k;
  return g;
}
// --- clean silhouette pipeline ---------------------------------------------
// Background cells reachable from the border (so interior gaps are NOT treated
// as outside — they keep their designed holes and never get an outline).
function exterior(g, bg) {
  const W = g.w, H = g.h, seen = new Set(), st = [];
  const isbg = (x, y) => x >= 0 && y >= 0 && x < W && y < H && bg.has(g[y][x]);
  for (let x = 0; x < W; x++) { st.push([x, 0], [x, H - 1]); }
  for (let y = 0; y < H; y++) { st.push([0, y], [W - 1, y]); }
  while (st.length) {
    const [x, y] = st.pop(), k = x + ',' + y;
    if (seen.has(k) || !isbg(x, y)) continue;
    seen.add(k); st.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  return seen;
}
// Smooth the silhouette: fill 1px exterior notches (a bg cell hugged by >=3 body
// neighbours) with a neighbour colour, then drop 1px spurs (body cell with <=1
// body neighbour). Kills the stair-step roughness that made outlines look ragged.
export function smooth(g, bg = new Set(['.', 'S'])) {
  const W = g.w, H = g.h;
  const body = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !bg.has(g[y][x]);
  const ext = exterior(g, bg), fills = [];
  for (const key of ext) {
    const [x, y] = key.split(',').map(Number);
    if (g[y][x] !== '.') continue;
    const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => body(x + dx, y + dy));
    if (n.length >= 3) fills.push([x, y, g[y + n[0][1]][x + n[0][0]]]);
  }
  for (const [x, y, c] of fills) g[y][x] = c;
  const drops = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (bg.has(g[y][x])) continue;
    const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => body(x + dx, y + dy)).length;
    if (n <= 1) drops.push([x, y]);
  }
  for (const [x, y] of drops) g[y][x] = '.';
  return g;
}
// Outline only the true (exterior) silhouette; never overwrites a contact shadow ('S').
export function outlineSil(g, k = 'k', bg = new Set(['.', 'S'])) {
  const W = g.w, H = g.h;
  const body = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !bg.has(g[y][x]);
  const add = [];
  for (const key of exterior(g, bg)) {
    const [x, y] = key.split(',').map(Number);
    if (g[y][x] !== '.') continue;
    if (body(x + 1, y) || body(x - 1, y) || body(x, y + 1) || body(x, y - 1)) add.push([x, y]);
  }
  for (const [x, y] of add) g[y][x] = k;
  return g;
}

// Trim fully-empty border rows/cols so the sprite is snug.
export function toArt(g, palette) {
  let rows = g.map((r) => r.join(''));
  while (rows.length && /^\.*$/.test(rows[0])) rows.shift();
  while (rows.length && /^\.*$/.test(rows[rows.length - 1])) rows.pop();
  return { palette, rows };
}
