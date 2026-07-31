// The first-dungeon (The Quiet Crossing) roster, redesigned procedurally.
// Keyed by the art key each Species uses in src/assets/art.ts, so integrating
// is a direct replace of CREATURES[<key>]. Recipe: docs/procedural-sprites.md.
import { grid, ellipse, rect, dot, set, smooth, outlineSil, toArt } from './compose.mjs';
import { glossyEyes, shadeInto, contactShadow, finish } from './creatures.mjs';
import { applyFace } from './personality.mjs';

// Clean the silhouette, stamp the creature's personality face, then outline.
// `cfg` positions the face: { cx, eyeY, dx, rx, ry, mouthY, pal }.
function faced(g, P, personality, cfg) {
  smooth(g);
  applyFace(personality, g, cfg);
  outlineSil(g, 'k');
  return toArt(g, P);
}

// --- lizard — Emberling (fire / hero starter) ------------------------------
// A chunky ember-GOLEM (per the original sprite): visor face, glowing chest
// core, stubby limbs, floating embers. Deliberately NOT a bipedal fire lizard.
export function lizard() {
  const P = { '.': '', S: '#100a08', k: '#2a1408', u: '#3a1a10', r: '#c0381c', o: '#ff7a2e', y: '#ffb84f',
    f: '#ffe08a', w: '#fff6e8', p: '#241021', s: '#ffffff', g: '#ff5a2a' };
  const g = grid(60, 66); const cx = 30;
  contactShadow(g, cx, 62, 18);
  // floating embers (asymmetric)
  ellipse(g, 8, 26, 2, 2, 'f'); ellipse(g, 52, 33, 1.6, 1.6, 'o'); ellipse(g, 11, 40, 1.4, 1.4, 'o'); ellipse(g, 50, 20, 1.4, 1.4, 'f');
  // small flame tuft on the head (offset right)
  ellipse(g, cx + 6, 8, 2.6, 4.2, 'o'); ellipse(g, cx + 6, 7, 1.4, 2.6, 'f');
  // chunky rounded-box head + torso + stubby limbs
  rect(g, cx - 12, 13, cx + 12, 31, 'o');           // head
  rect(g, cx - 14, 34, cx + 14, 56, 'o');           // torso
  rect(g, cx - 18, 39, cx - 15, 51, 'o'); rect(g, cx + 15, 39, cx + 18, 51, 'o'); // arms
  rect(g, cx - 11, 56, cx - 3, 63, 'o'); rect(g, cx + 3, 56, cx + 11, 63, 'o');   // legs
  // knock the hard corners off so smooth() leaves a chunky-but-not-square read
  for (const [bx, by] of [[cx - 12, 13], [cx + 12, 13], [cx - 14, 34], [cx + 14, 34], [cx - 14, 56], [cx + 14, 56], [cx - 11, 63], [cx + 11, 63]]) set(g, bx, by, '.');
  // ramp (top lit, base shadowed)
  shadeInto(g, cx - 3, 20, 13, 11, 'y', ['o']); shadeInto(g, cx - 5, 15, 7, 5, 'f', ['o', 'y']);
  shadeInto(g, cx, 52, 15, 8, 'r', ['o']); shadeInto(g, cx - 15, 48, 4, 5, 'r', ['o']); shadeInto(g, cx + 15, 48, 4, 5, 'r', ['o']);
  // glowing molten cracks on the torso
  for (const [a, b] of [[cx - 7, 37], [cx - 6, 39], [cx + 8, 38], [cx + 7, 40], [cx - 9, 52], [cx + 9, 53]]) set(g, a, b, 'y');
  // dark visor band (eyes/brows come from the fierce family)
  rect(g, cx - 11, 19, cx + 11, 26, 'u');
  set(g, cx - 6, 19, 'g'); set(g, cx + 6, 19, 'g');   // visor glow ticks
  // glowing chest core (a molten heart, framed)
  ellipse(g, cx, 45, 6, 6.5, 'u'); ellipse(g, cx, 45, 4.4, 5, 'r');
  ellipse(g, cx, 45, 2.8, 3.4, 'f'); ellipse(g, cx, 45, 1.3, 1.8, 'w'); set(g, cx, 42, 's');
  return faced(g, P, 'fierce', { cx, eyeY: 22, dx: 6, rx: 3.4, ry: 3.9, mouthY: null, pal: { skin: 'o' } });
}

// --- wing — Glidefang (water / mage, hovering) -----------------------------
export function wing() {
  const P = { '.': '', S: '#08131a', k: '#123040', D: '#2f7fb0', b: '#4fb0e0', h: '#a6e6ff',
    n: '#7fd0ee', w: '#ecffff', p: '#0e2a38', s: '#ffffff', c: '#ff9ab0', t: '#c9f6ff' };
  const g = grid(66, 54); const cx = 33;
  contactShadow(g, cx, 50, 11);
  // wings (lighter blue), left larger than right (asymmetry)
  ellipse(g, 15, 21, 12, 8, 'b'); ellipse(g, 21, 16, 7, 4.5, 'b'); ellipse(g, 11, 28, 7, 5, 'b');
  ellipse(g, 51, 23, 10, 7, 'b'); ellipse(g, 47, 18, 6, 4, 'b'); ellipse(g, 56, 29, 5, 4, 'b');
  shadeInto(g, 14, 19, 11, 7, 'h', ['b']); shadeInto(g, 52, 21, 9, 6, 'h', ['b']);   // wing sheen
  shadeInto(g, 16, 26, 11, 6, 'n', ['b']); shadeInto(g, 51, 28, 8, 5, 'n', ['b']);   // wing lower tone
  // 2px membrane veins (survive smooth())
  const vein = (x0, y0, x1, y1) => { const n = 7; for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n; set(g, x, y, 'D'); set(g, x, y + 1, 'D'); } };
  vein(23, 22, 10, 17); vein(23, 27, 11, 31); vein(43, 24, 56, 19); vein(43, 29, 55, 31);
  // body — a darker teal orb so it reads distinctly against the wings
  ellipse(g, cx, 27, 9, 11, 'D');
  shadeInto(g, cx - 3, 22, 6, 6, 'b', ['D']); shadeInto(g, cx - 4, 20, 4, 4, 'h', ['D', 'b']);
  ellipse(g, cx, 32, 5, 5.5, 'b');            // belly
  // ear fins + forked tail
  ellipse(g, cx - 3, 15, 2, 3.5, 'D'); ellipse(g, cx + 3, 15, 2, 3.5, 'D');
  ellipse(g, cx - 2, 40, 1.6, 2.4, 'D'); ellipse(g, cx + 2, 40, 1.6, 2.4, 'D');
  ellipse(g, cx + 6, 33, 1.4, 2, 't'); ellipse(g, cx - 7, 30, 1.2, 1.8, 't');
  glossyEyes(g, cx, 6.5, 26, 3.8, 4.6, 1);
  dot(g, cx, cx - 8, 30, 'c'); dot(g, cx, cx - 8, 31, 'c');
  set(g, cx - 1, 33, 'p'); set(g, cx, 34, 'p'); set(g, cx + 1, 33, 'p');
  return finish(g, P);
}

// --- bat — Nightnip (dark / assassin, hovering) ----------------------------
export function bat() {
  const P = { '.': '', S: '#0a0814', k: '#1a1226', u: '#33265a', v: '#6b4aa0', V: '#9a7ad0',
    w: '#fff2ff', p: '#160f26', s: '#ffffff', c: '#ff9ab0', f: '#fffbe8', e: '#4a2a5a', g: '#cbb8ff' };
  const g = grid(60, 54); const cx = 30;
  contactShadow(g, cx, 50, 14);
  // folded wings at the sides (small, scalloped)
  for (const dir of [-1, 1]) {
    ellipse(g, cx + dir * 15, 30, 4.5, 8, 'u');
    ellipse(g, cx + dir * 17, 26, 2.4, 4, 'u'); ellipse(g, cx + dir * 17, 34, 2.4, 3.5, 'u');
  }
  // body
  ellipse(g, cx, 31, 12.5, 12, 'v');
  shadeInto(g, cx - 3, 25, 9, 8, 'V', ['v']); shadeInto(g, cx - 4, 22, 5, 4, 'g', ['v', 'V']);
  shadeInto(g, cx, 38, 12, 7, 'u', ['v']);
  // ears (left slightly taller)
  ellipse(g, cx - 8, 11, 3.6, 7, 'v'); ellipse(g, cx + 8, 13, 3.6, 6, 'v');
  ellipse(g, cx - 8, 12, 1.6, 3.6, 'e'); ellipse(g, cx + 8, 14, 1.6, 3, 'e');
  ellipse(g, cx - 12, 22, 1, 1.4, 'g'); ellipse(g, cx + 13, 20, 1, 1.4, 'g'); // floating motes
  return faced(g, P, 'clever', { cx: cx + 1, eyeY: 30, dx: 7, rx: 4, ry: 4.8, mouthY: 38, pal: { skin: 'v' } });
}

// --- bug — Mitebug (nature / assassin) -------------------------------------
export function bug() {
  const P = { '.': '', S: '#0a1208', k: '#1c2a16', r: '#356a2c', o: '#6ab048', y: '#9bd86a',
    h: '#c4ef9a', w: '#fbffee', p: '#1c2a16', s: '#ffffff', c: '#ff9a9a', a: '#20301a' };
  const g = grid(58, 54); const cx = 29;
  contactShadow(g, cx, 50, 15);
  const blk = (x, y, k) => { set(g, x, y, k); set(g, x + 1, y, k); set(g, x, y + 1, k); set(g, x + 1, y + 1, k); };
  const limb = (x0, y0, x1, y1, k) => { const n = 5; for (let i = 0; i <= n; i++) blk(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), k); };
  // two antennae with bobbles (the only overtly "insect" cue)
  limb(cx - 4, 14, cx - 9, 4, 'a'); limb(cx + 4, 14, cx + 9, 4, 'a');
  ellipse(g, cx - 9, 3, 2, 2, 'y'); ellipse(g, cx + 9, 3, 2, 2, 'y');
  // rounded body — a friendly "bug-mon" blob, not a realistic beetle
  ellipse(g, cx, 30, 15, 14, 'o');
  shadeInto(g, cx - 4, 23, 11, 10, 'y', ['o']); shadeInto(g, cx - 5, 19, 6, 5, 'h', ['o', 'y']);
  shadeInto(g, cx, 40, 15, 8, 'r', ['o']);
  // soft shell seam + two abstract wing-case highlights
  rect(g, cx - 1, 20, cx + 1, 40, 'r');
  ellipse(g, cx - 7, 28, 3, 4, 'y'); ellipse(g, cx + 7, 28, 3, 4, 'y');
  // just a hint of feet (no spidery legs)
  ellipse(g, cx - 7, 44, 3, 2.4, 'r'); ellipse(g, cx + 7, 44, 3, 2.4, 'r');
  return faced(g, P, 'nervous', { cx, eyeY: 28, dx: 6.5, rx: 3.4, ry: 4, mouthY: 35, pal: { skin: 'o' } });
}

// --- plant — Sprigling (nature / hero) -------------------------------------
export function plant() {
  const P = { '.': '', S: '#0a1208', k: '#1c2a16', L: '#5aa838', l: '#9bd86a', v: '#2f6a2a',
    m: '#f0e6c2', d: '#ccb98a', o: '#e8d8a8', P: '#ff8fb0', Q: '#ffb8d0', w: '#fbffee', p: '#1c2a16', s: '#ffffff', c: '#ff9ab0' };
  const g = grid(56, 66); const cx = 28;
  contactShadow(g, cx, 62, 15);
  // bulb body (little turnip guy)
  ellipse(g, cx, 45, 13, 15, 'm');
  shadeInto(g, cx - 4, 38, 9, 9, 'o', ['m']); shadeInto(g, cx, 52, 13, 8, 'd', ['m']);
  // root feet + leaf arms
  ellipse(g, cx - 7, 61, 4, 3, 'm'); ellipse(g, cx + 7, 61, 4, 3, 'm');
  ellipse(g, cx - 14, 43, 3, 4, 'L'); ellipse(g, cx + 14, 45, 2.6, 3.5, 'L');
  // leaf pair (uneven) + veins
  ellipse(g, cx - 8, 15, 7, 4, 'L'); ellipse(g, cx + 7, 18, 5, 3, 'L');
  shadeInto(g, cx - 8, 14, 6, 3, 'l', ['L']); shadeInto(g, cx + 7, 17, 4, 2, 'l', ['L']);
  for (let i = 0; i < 6; i++) set(g, cx - 12 + i, 15 + Math.floor(i * 0.2), 'v');
  for (let i = 0; i < 4; i++) set(g, cx + 4 + i, 18, 'v');
  rect(g, cx - 1, 18, cx + 1, 30, 'v'); // stem into body
  // flower bud at the crown
  ellipse(g, cx, 9, 3.4, 3, 'P'); ellipse(g, cx, 8, 1.8, 1.8, 'Q'); dot(g, cx, cx - 3, 9, 'P');
  glossyEyes(g, cx, 7, 43, 4, 4.8, 1);
  dot(g, cx, cx - 10, 47, 'c'); dot(g, cx, cx - 10, 48, 'c');
  set(g, cx - 1, 50, 'p'); set(g, cx, 51, 'p'); set(g, cx + 1, 50, 'p');
  return finish(g, P);
}

// --- scrap — Scrapmite (machine / hero) ------------------------------------
export function scrap() {
  const P = { '.': '', S: '#080a10', k: '#14161f', D: '#3a4152', b: '#5f6b82', h: '#9fb0cc',
    n: '#0e202a', g: '#7fe6ff', y: '#ffce5a', w: '#ffffff', p: '#0e202a', s: '#ffffff', r: '#c85a4a' };
  const g = grid(58, 60); const cx = 29;
  contactShadow(g, cx, 56, 16);
  // body (rounded chassis)
  ellipse(g, cx, 40, 14, 15, 'b');
  shadeInto(g, cx - 4, 33, 10, 9, 'h', ['b']); shadeInto(g, cx, 47, 14, 8, 'D', ['b']);
  dot(g, cx, cx - 8, 44, 'y'); dot(g, cx, cx - 8, 50, 'y'); // bolts
  rect(g, cx - 6, 38, cx + 6, 39, 'D');                      // panel seam
  // head (rounded) + dark screen face
  ellipse(g, cx, 20, 11, 10, 'b'); shadeInto(g, cx - 3, 15, 6, 5, 'h', ['b']);
  ellipse(g, cx, 21, 7.5, 6, 'n');                            // dark screen (face comes from uncanny)
  // antenna (bent, 2x2 so it stays connected), arms (one raised), tread base
  const blk = (x, y, k) => { set(g, x, y, k); set(g, x + 1, y, k); set(g, x, y + 1, k); set(g, x + 1, y + 1, k); };
  for (let i = 0; i <= 5; i++) blk(cx + 4 + i, 12 - i, 'D');
  ellipse(g, cx + 11, 5, 2, 2, 'g'); set(g, cx + 11, 4, 's');
  ellipse(g, cx - 15, 36, 3, 4.5, 'b'); ellipse(g, cx + 15, 42, 3, 4, 'b');
  ellipse(g, cx, 55, 11, 3, 'D'); dot(g, cx, cx - 6, 55, 'h');
  return faced(g, P, 'uncanny', { cx, eyeY: 20, dx: 4, rx: 2.6, ry: 2.8, mouthY: 24, pal: { white: 'g', mouth: 'g' } });
}

// --- wisp — Gloomote (dark / mage, hovering) -------------------------------
// A wide-headed wispy SHADE (per the original): bulbous head, body narrows and
// splays into trailing tendrils. Distinct silhouette from the round water slime.
export function wisp() {
  const P = { '.': '', S: '#0a0814', k: '#16112a', u: '#2e2456', v: '#5b46a0', V: '#8f78d8',
    g: '#cbb8ff', w: '#fff2ff', p: '#160f26', s: '#ffffff', c: '#ff9ab0' };
  const g = grid(52, 60); const cx = 26;
  contactShadow(g, cx, 55, 11);
  // wide bulbous head
  ellipse(g, cx, 22, 14, 12, 'v');
  // body narrows below the head
  for (let y = 30; y <= 40; y++) { const w = Math.max(2, 11 - (y - 30) * 0.7); ellipse(g, cx, y, w, 1.6, 'v', { mirror: false }); }
  // three trailing tendrils (2x2 so smooth() keeps them)
  const blk = (x, y) => { set(g, x, y, 'v'); set(g, x + 1, y, 'v'); set(g, x, y + 1, 'v'); set(g, x + 1, y + 1, 'v'); };
  const tail = (x0, y0, x1, y1) => { const n = 6; for (let i = 0; i <= n; i++) blk(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n)); };
  tail(cx - 5, 39, cx - 9, 52); tail(cx, 41, cx, 55); tail(cx + 5, 39, cx + 9, 52);
  shadeInto(g, cx - 4, 17, 10, 9, 'V', ['v']); shadeInto(g, cx - 4, 14, 5, 4, 'g', ['v', 'V']);
  shadeInto(g, cx, 30, 11, 8, 'u', ['v']);
  ellipse(g, cx, 24, 3, 3.5, 'g'); // glow core
  // little arm nubs on the wide head
  ellipse(g, cx - 13, 24, 2.2, 3, 'v'); ellipse(g, cx + 13, 24, 2.2, 3, 'v');
  ellipse(g, cx - 15, 14, 1, 1.3, 'g'); ellipse(g, cx + 15, 18, 1, 1.3, 'g');
  return faced(g, P, 'uncanny', { cx, eyeY: 21, dx: 6.5, rx: 3.8, ry: 4.4, mouthY: 27, pal: { white: 'g', mouth: 'u' } });
}

// --- slime — Dropletta (water / mage) --------------------------------------
// A round BALL slime (per the original), NOT a teardrop — so it reads clearly
// apart from the wispy shade Gloomote.
export function slime() {
  const P = { '.': '', S: '#08131a', k: '#0e2a38', D: '#2f8fc0', b: '#57c0e6', h: '#a6ecff',
    w: '#ecffff', p: '#0e2a38', s: '#ffffff', c: '#ff9ab0', t: '#c9f6ff' };
  const g = grid(56, 56); const cx = 28;
  contactShadow(g, cx, 52, 17);
  // round ball body, slight squash at the base
  ellipse(g, cx, 32, 17, 16, 'b'); ellipse(g, cx, 40, 17, 10, 'b');
  shadeInto(g, cx - 4, 24, 12, 11, 'h', ['b']); shadeInto(g, cx - 5, 20, 7, 6, 'w', ['b', 'h']);
  shadeInto(g, cx, 44, 17, 8, 'D', ['b']);
  // glossy cap arc + inner bubbles
  for (let i = 0; i < 8; i++) set(g, cx - 10 + i, 18 + Math.floor(Math.abs(i - 3.5) * 0.5), 'w');
  ellipse(g, cx + 9, 36, 2.2, 3, 't'); ellipse(g, cx - 10, 40, 1.6, 2.2, 't');
  // little arm nubs + base wobble
  ellipse(g, cx - 16, 36, 2.6, 3.4, 'b'); ellipse(g, cx + 16, 38, 2.6, 3.2, 'b');
  ellipse(g, cx - 8, 49, 3.6, 2.4, 'b'); ellipse(g, cx + 8, 49, 3.6, 2.4, 'b');
  glossyEyes(g, cx, 7, 33, 4, 4.8, 1);
  dot(g, cx, cx - 11, 38, 'c'); dot(g, cx, cx - 11, 39, 'c');
  for (const [mx, my] of [[-2, 41], [-1, 42], [0, 42], [1, 42], [2, 41]]) set(g, cx + mx, my, 'p');
  return finish(g, P);
}

// --- lion — Regalion (fire / hero BOSS, warden) ----------------------------
export function lion() {
  const P = { '.': '', S: '#0e0804', k: '#2a1408', r: '#b83a1c', M: '#d8571c', o: '#ff8a34', y: '#ffbf4f',
    f: '#ffe08a', u: '#f0b878', t: '#d89050', m: '#ffe6c6', d: '#d8a060', G: '#ffd23f', j: '#ff5a3a',
    w: '#fff6e8', p: '#241021', s: '#ffffff' };
  const g = grid(78, 80); const cx = 39;
  contactShadow(g, cx, 75, 26);
  // chest / body
  ellipse(g, cx, 62, 20, 16, 'u'); shadeInto(g, cx, 68, 20, 9, 't', ['u']);
  ellipse(g, cx - 12, 74, 6, 4, 'u'); ellipse(g, cx + 12, 74, 6, 4, 'u'); // forepaws
  ellipse(g, cx, 60, 10, 9, 'm'); shadeInto(g, cx, 64, 9, 5, 'd', ['m']);  // chest ruff
  // MANE — layered ring of flame tongues
  ellipse(g, cx, 34, 27, 25, 'M');
  const tongues = 22;
  for (let i = 0; i < tongues; i++) {
    const a = (i / tongues) * Math.PI * 2, rr = 25 + (i % 2 ? 5 : 2);
    ellipse(g, cx + Math.cos(a) * 24, 34 + Math.sin(a) * 22, 3.5, 4.5, i % 3 ? 'o' : 'r', { mirror: false });
    set(g, cx + Math.cos(a) * (rr), 34 + Math.sin(a) * (rr * 0.92), 'y');
  }
  shadeInto(g, cx, 34, 27, 25, 'o', ['M']); shadeInto(g, cx, 46, 26, 12, 'r', ['M', 'o']);
  // face
  ellipse(g, cx, 36, 16, 15, 'u'); shadeInto(g, cx - 5, 30, 9, 8, 'f', ['u']); shadeInto(g, cx, 44, 15, 8, 't', ['u']);
  ellipse(g, cx - 14, 22, 4.5, 4.5, 'u'); ellipse(g, cx + 14, 22, 4.5, 4.5, 'u'); // ears
  ellipse(g, cx - 14, 22, 2.2, 2.2, 'r'); ellipse(g, cx + 14, 22, 2.2, 2.2, 'r');
  // muzzle
  ellipse(g, cx, 44, 9, 7, 'm'); shadeInto(g, cx, 47, 8, 4, 'd', ['m']);
  set(g, cx, 42, 'p'); set(g, cx - 1, 43, 'p'); set(g, cx + 1, 43, 'p');
  for (let x = cx - 3; x <= cx + 3; x++) set(g, x, 46, 'p'); set(g, cx, 47, 'p'); set(g, cx, 48, 'p'); // nose + mouth
  // crown with gem
  rect(g, cx - 9, 15, cx + 9, 17, 'G'); for (const dx2 of [-9, -3, 3, 9]) { set(g, cx + dx2, 13, 'G'); set(g, cx + dx2, 14, 'G'); }
  ellipse(g, cx, 16, 2, 2, 'j'); set(g, cx, 15, 's');
  // fierce amber eyes (smaller, angled) with brow ridges
  for (const dir of [-1, 1]) {
    const ex = cx + dir * 7;
    ellipse(g, ex, 36, 3.4, 3, 'w', { mirror: false });
    ellipse(g, ex, 36.4, 2.2, 2.4, 'y', { mirror: false });
    ellipse(g, ex, 37, 1.2, 1.6, 'p', { mirror: false });
    set(g, ex - dir, 34, 's');
    for (let i = 0; i < 5; i++) set(g, ex - dir * 4 + dir * i, 32 - Math.floor(i * 0.4), 'r'); // brow
  }
  return finish(g, P);
}

// `personality` assigns each creature one of the five families in
// docs/monster-personalities.md. It's the design target for the face/posture
// (via personality.mjs) and keeps the roster varied by the documented rule.
export const CROSSING = {
  lizard: { species: 'Emberling', element: 'fire', personality: 'fierce', build: lizard },
  wing: { species: 'Glidefang', element: 'water', personality: 'friendly', build: wing },
  bat: { species: 'Nightnip', element: 'dark', personality: 'clever', build: bat },
  bug: { species: 'Mitebug', element: 'nature', personality: 'nervous', build: bug },
  plant: { species: 'Sprigling', element: 'nature', personality: 'friendly', build: plant },
  scrap: { species: 'Scrapmite', element: 'machine', personality: 'uncanny', build: scrap },
  wisp: { species: 'Gloomote', element: 'dark', personality: 'uncanny', build: wisp },
  slime: { species: 'Dropletta', element: 'water', personality: 'friendly', build: slime },
  lion: { species: 'Regalion', element: 'fire', personality: 'fierce', build: lion },
};
