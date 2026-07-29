// Personality families — a predictable-but-varied face + posture system.
// See docs/monster-personalities.md. Instead of every creature wearing the same
// "big glossy friendly eyes", each is assigned ONE of five families that drives
// its eyes, brows and mouth (via applyFace) and its body posture (via POSTURE).
//
// applyFace draws into a char grid using palette-role keys the creature already
// defines, so it works with any creature's palette:
//   white  eye white        pupil  iris/pupil     spark  glint
//   ink    outline/brows    mouth  mouth/teeth    blush  cheeks
//   skin   the body base colour at the face (needed for half-lids / voids)
import { ellipse, set, dot } from './compose.mjs';

const ROLES = { white: 'w', pupil: 'p', spark: 's', ink: 'k', mouth: 'p', blush: 'c', skin: 'o' };

export const FAMILIES = ['friendly', 'fierce', 'nervous', 'clever', 'uncanny'];

// One eye at (x,y). `shape` tunes the pattern; opts carries palette roles.
function eye(g, x, y, rx, ry, k, { pupilScale = 0.66, pupilDX = 0, pupilDY = 0, glints = 2, blank = false } = {}) {
  ellipse(g, x, y, rx, ry, k.white, { mirror: false });
  if (!blank) {
    ellipse(g, x + pupilDX, y + pupilDY + ry * 0.12, rx * pupilScale, ry * pupilScale, k.pupil, { mirror: false });
    if (glints >= 1) ellipse(g, x - rx * 0.34, y - ry * 0.4, rx * 0.32, ry * 0.32, k.spark, { mirror: false });
    if (glints >= 2) set(g, Math.round(x + rx * 0.36), Math.round(y + ry * 0.34), k.spark);
  }
}

// --- the five families -----------------------------------------------------
function friendly(g, cx, ey, dx, rx, ry, my, k) {
  eye(g, cx - dx, ey, rx, ry, k);
  eye(g, cx + dx, ey, rx, ry, k);
  dot(g, cx, cx - dx - 3, ey + ry + 1, k.blush); dot(g, cx, cx - dx - 3, ey + ry + 2, k.blush);
  set(g, cx - 1, my, k.mouth); set(g, cx, my + 1, k.mouth); set(g, cx + 1, my, k.mouth); // gentle upward curve
}

function fierce(g, cx, ey, dx, rx, ry, my, k) {
  // narrow, forward almonds with small low pupils
  for (const dir of [-1, 1]) {
    const x = cx + dir * dx;
    eye(g, x, ey, rx, ry * 0.62, k, { pupilScale: 0.5, pupilDY: ry * 0.2, glints: 1 });
    // angry slant: dark wedge over the top-outer corner
    for (let i = 0; i < rx * 1.4; i++) set(g, Math.round(x + dir * (rx - i * 0.5)), Math.round(ey - ry * 0.5 + i * 0.5), k.ink);
    // heavy brow sloping down toward centre (2px)
    for (let i = 0; i <= rx * 1.6; i++) { const bx = Math.round(x - dir * i * 0.7), byv = Math.round(ey - ry - 1.5 + i * 0.32); set(g, bx, byv, k.ink); set(g, bx, byv + 1, k.ink); }
  }
  // bared teeth: dark mouth band with white fangs
  for (let x = cx - 4; x <= cx + 4; x++) set(g, x, my, k.ink);
  for (const tx of [cx - 3, cx, cx + 3]) { set(g, tx, my, k.white); set(g, tx, my + 1, k.white); }
}

function nervous(g, cx, ey, dx, rx, ry, my, k) {
  // big whites, small UNEVEN darting pupils, high thin brows, tiny trembling mouth
  eye(g, cx - dx, ey - 0.5, rx, ry, k, { pupilScale: 0.36, pupilDX: rx * 0.3, pupilDY: -ry * 0.2, glints: 1 });
  eye(g, cx + dx, ey + 0.5, rx * 0.92, ry * 1.05, k, { pupilScale: 0.44, pupilDX: -rx * 0.28, pupilDY: ry * 0.25, glints: 1 });
  for (const dir of [-1, 1]) for (let i = 0; i <= rx * 1.2; i++) set(g, Math.round(cx + dir * (dx - rx * 0.6 + i * 0.6)), Math.round(ey - ry - 2 - Math.sin(i / (rx)) * 1.5), k.ink); // raised arcs
  set(g, cx - 1, my, k.mouth); set(g, cx, my + 1, k.mouth); set(g, cx + 1, my, k.mouth); set(g, cx + 2, my + 1, k.mouth); // wobble
  ellipse(g, cx - dx - rx, ey - ry, 1, 1.6, k.spark); // sweat bead
}

function clever(g, cx, ey, dx, rx, ry, my, k) {
  // half-lidded, asymmetric: left eye more open than right, small pupils
  const lids = [0.42, 0.6];
  let i = 0;
  for (const dir of [-1, 1]) {
    const x = cx + dir * dx;
    eye(g, x, ey, rx, ry, k, { pupilScale: 0.5, pupilDY: ry * 0.25, glints: 1 });
    const lid = Math.round(ry * 2 * lids[i]);
    for (let dyv = -Math.ceil(ry); dyv < -Math.ceil(ry) + lid; dyv++) for (let dxv = -Math.ceil(rx); dxv <= Math.ceil(rx); dxv++) {
      if ((dxv / rx) ** 2 + (dyv / ry) ** 2 <= 1) set(g, Math.round(x + dxv), Math.round(ey + dyv), k.skin);
    }
    set(g, Math.round(x - rx), Math.round(ey - ry * (0.5 + lids[i] * 0.5)), k.ink); // lid line hint
    i++;
  }
  // offset smirk (rises to one side)
  set(g, cx - 2, my + 1, k.mouth); set(g, cx - 1, my + 1, k.mouth); set(g, cx, my, k.mouth); set(g, cx + 1, my - 1, k.mouth);
}

function uncanny(g, cx, ey, dx, rx, ry, my, k) {
  // blank pupil-less eyes at mismatched heights + a third eye; detached mouth
  eye(g, cx - dx, ey - 1, rx, ry, k, { blank: true });
  eye(g, cx + dx, ey + 2, rx * 0.9, ry * 0.9, k, { blank: true });
  eye(g, cx + Math.round(dx * 0.2), ey - ry - 3, rx * 0.7, ry * 0.7, k, { blank: true }); // third eye, offset
  const mx = cx + Math.round(dx * 0.9), myy = my + 3;      // mouth pulled off-centre & low
  for (let x = mx - 2; x <= mx + 2; x++) set(g, x, myy, k.mouth);
  set(g, mx - 2, myy - 1, k.mouth); set(g, mx + 2, myy + 1, k.mouth);
}

const FN = { friendly, fierce, nervous, clever, uncanny };

// Draw a family's face. o: { cx, eyeY, dx, rx, ry, mouthY, pal }
export function applyFace(personality, g, o) {
  const k = { ...ROLES, ...(o.pal || {}) };
  const rx = o.rx ?? 4, ry = o.ry ?? 4.8;
  (FN[personality] || friendly)(g, o.cx, o.eyeY, o.dx ?? 8, rx, ry, o.mouthY ?? (o.eyeY + ry + 4), k);
}

// --- posture ---------------------------------------------------------------
// Personality drives the body too, at author time. POSTURE encodes the intent;
// the numbers are offsets/hints a builder applies to its body + limbs.
export const POSTURE = {
  friendly: { lean: 0, limbs: 'relaxed at sides', stance: 'upright, open', note: 'symmetric, a touch of bounce' },
  fierce: { lean: +2, limbs: 'forward, low and wide', stance: 'crouched, leaning at the viewer', note: 'widen the base, drop the shoulders' },
  nervous: { lean: -1, limbs: 'pulled in tight to the body', stance: 'compressed, small', note: 'shrink the silhouette, raise the shoulders' },
  clever: { lean: +1, limbs: 'one relaxed, one raised/behind', stance: 'weight on one side', note: 'asymmetric — never mirror the pose' },
  uncanny: { lean: 0, limbs: 'unnaturally still or wrong-count', stance: 'floating / off-axis', note: 'break one expectation (a limb too many, a tilt)' },
};

// Horizontal shear for a forward/back lean: shifts each row by lean*(dist from
// base). Apply to a finished grid before smooth()/outline. Small values only.
export function lean(g, amount) {
  if (!amount) return g;
  const H = g.h;
  for (let y = 0; y < H; y++) {
    const shift = Math.round(amount * ((H - y) / H));
    if (shift === 0) continue;
    const row = g[y].slice();
    for (let x = 0; x < g.w; x++) { const sx = x - shift; g[y][x] = sx >= 0 && sx < g.w ? row[sx] : '.'; }
  }
  return g;
}
