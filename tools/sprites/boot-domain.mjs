// The first-dungeon (Boot Domain) roster, redesigned procedurally.
// Keyed by the art key each Species uses in src/assets/art.ts, so integrating
// is a direct replace of CREATURES[<key>]. Recipe: docs/procedural-sprites.md.
import { grid, ellipse, rect, dot, set } from './compose.mjs';
import { glossyEyes, shadeInto, contactShadow, finish } from './creatures.mjs';

// --- lizard — Emberling (fire / hero starter) ------------------------------
export function lizard() {
  const P = { '.': '', S: '#100a08', k: '#2a1408', r: '#c0381c', o: '#ff7a2e', y: '#ffb84f',
    f: '#ffe08a', m: '#ffe6c6', d: '#e0a060', w: '#fff6e8', p: '#241021', s: '#ffffff', c: '#ff8f7a' };
  const g = grid(62, 66); const cx = 30;
  contactShadow(g, cx, 62, 17);
  // tail sweeping right, flame tip
  ellipse(g, 44, 52, 5, 4.5, 'o'); ellipse(g, 50, 47, 4, 3.6, 'o'); ellipse(g, 55, 41, 3.2, 3.2, 'o');
  ellipse(g, 57, 35, 3, 5, 'o'); ellipse(g, 57, 33, 1.8, 3.6, 'f'); shadeInto(g, 45, 55, 5, 4, 'r', ['o']);
  // body + head
  ellipse(g, cx, 46, 13, 15, 'o'); ellipse(g, cx, 24, 14, 13, 'o');
  // back ridges (little reptile spines, right side)
  for (const [rx, ry] of [[42, 34], [44, 40], [45, 46]]) ellipse(g, rx, ry, 1.8, 2.4, 'r');
  // flame crest
  ellipse(g, cx - 2, 10, 3.4, 5.5, 'o'); ellipse(g, cx - 2, 9, 1.8, 3.6, 'f');
  // arms + feet
  ellipse(g, cx - 13, 45, 3, 4.2, 'o'); ellipse(g, cx + 12, 46, 3, 4, 'o');
  ellipse(g, cx - 7, 61, 4.5, 3, 'o'); ellipse(g, cx + 7, 61, 4.5, 3, 'o');
  // ramp
  shadeInto(g, cx - 3, 15, 13, 11, 'y', ['o']); shadeInto(g, cx - 5, 12, 7, 6, 'f', ['o', 'y']);
  shadeInto(g, cx, 42, 15, 12, 'r', ['o']); shadeInto(g, cx, 56, 12, 8, 'r', ['o']);
  // cream muzzle + belly
  ellipse(g, cx, 30, 6, 4, 'm'); shadeInto(g, cx, 32, 6, 2.2, 'd', ['m']);
  ellipse(g, cx, 48, 7.5, 9, 'm'); shadeInto(g, cx, 52, 7, 5, 'd', ['m']);
  glossyEyes(g, cx + 1, 7.5, 23, 4, 4.8, 1);
  dot(g, cx + 1, cx - 10, 27, 'c'); dot(g, cx + 1, cx - 10, 28, 'c');
  set(g, cx, 30, 'p'); set(g, cx + 1, 31, 'p'); set(g, cx + 2, 30, 'p');
  return finish(g, P);
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
  glossyEyes(g, cx + 1, 7, 30, 4, 4.8, 1);
  dot(g, cx + 1, cx - 9, 35, 'c'); dot(g, cx + 1, cx - 9, 36, 'c');
  set(g, cx, 37, 'p'); set(g, cx + 1, 38, 'p'); set(g, cx + 2, 37, 'p');
  set(g, cx - 1, 39, 'f'); set(g, cx + 3, 39, 'f'); // tiny fangs
  ellipse(g, cx - 12, 22, 1, 1.4, 'g'); ellipse(g, cx + 13, 20, 1, 1.4, 'g'); // floating motes
  return finish(g, P);
}

// --- bug — Mitebug (nature / assassin) -------------------------------------
export function bug() {
  const P = { '.': '', S: '#0a1208', k: '#1c2a16', r: '#356a2c', o: '#6ab048', y: '#9bd86a',
    D: '#274a1e', m: '#efe6c4', w: '#fbffee', p: '#1c2a16', s: '#ffffff', c: '#ff9a9a', a: '#20301a' };
  const g = grid(60, 56); const cx = 30;
  contactShadow(g, cx, 51, 16);
  const blk = (x, y, k) => { set(g, x, y, k); set(g, x + 1, y, k); set(g, x, y + 1, k); set(g, x + 1, y + 1, k); };
  const limb = (x0, y0, x1, y1, k) => { const n = 6; for (let i = 0; i <= n; i++) blk(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), k); };
  // six spidery legs (2x2 so smooth() keeps them), drawn before the body
  limb(18, 28, 8, 34, 'a'); limb(18, 33, 7, 42, 'a'); limb(18, 38, 9, 49, 'a');
  limb(42, 28, 52, 34, 'a'); limb(42, 33, 53, 42, 'a'); limb(42, 38, 51, 49, 'a');
  // carapace
  ellipse(g, cx, 30, 15, 14, 'o');
  shadeInto(g, cx - 4, 23, 11, 10, 'y', ['o']); shadeInto(g, cx, 39, 15, 8, 'r', ['o']);
  rect(g, cx - 1, 18, cx + 1, 42, 'D');                                 // wing-case seam
  for (const [sx, sy] of [[20, 27], [40, 27], [22, 37], [38, 37]]) ellipse(g, sx, sy, 2.2, 2.2, 'D'); // spots
  // dark head band + antennae
  ellipse(g, cx, 17, 8, 5, 'D');
  limb(cx - 3, 13, cx - 9, 4, 'a'); limb(cx + 3, 13, cx + 9, 4, 'a');
  ellipse(g, cx - 9, 3, 1.8, 1.8, 'y'); ellipse(g, cx + 9, 3, 1.8, 1.8, 'y');
  glossyEyes(g, cx, 5, 18, 3, 3.4, 0);
  dot(g, cx, cx - 6, 21, 'c'); dot(g, cx, cx - 6, 22, 'c');
  set(g, cx - 1, 22, 'p'); set(g, cx, 23, 'p'); set(g, cx + 1, 22, 'p');
  return finish(g, P);
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
  ellipse(g, cx, 21, 7.5, 6, 'n');
  ellipse(g, cx - 3, 20, 1.8, 2.2, 'g'); ellipse(g, cx + 3, 20, 1.8, 2.2, 'g'); // glowing eyes
  set(g, cx - 3, 19, 's'); set(g, cx + 3, 19, 's');
  for (let x = cx - 2; x <= cx + 2; x++) set(g, x, 24, 'g');  // smile readout
  // antenna (bent, 2x2 so it stays connected), arms (one raised), tread base
  const blk = (x, y, k) => { set(g, x, y, k); set(g, x + 1, y, k); set(g, x, y + 1, k); set(g, x + 1, y + 1, k); };
  for (let i = 0; i <= 5; i++) blk(cx + 4 + i, 12 - i, 'D');
  ellipse(g, cx + 11, 5, 2, 2, 'g'); set(g, cx + 11, 4, 's');
  ellipse(g, cx - 15, 36, 3, 4.5, 'b'); ellipse(g, cx + 15, 42, 3, 4, 'b');
  ellipse(g, cx, 55, 11, 3, 'D'); dot(g, cx, cx - 6, 55, 'h');
  return finish(g, P);
}

// --- wisp — Gloomote (dark / mage, hovering) -------------------------------
export function wisp() {
  const P = { '.': '', S: '#0a0814', k: '#16112a', u: '#2e2456', v: '#5b46a0', V: '#8f78d8',
    g: '#cbb8ff', w: '#fff2ff', p: '#160f26', s: '#ffffff', c: '#ff9ab0' };
  const g = grid(46, 58); const cx = 23;
  contactShadow(g, cx, 53, 9);
  // teardrop body: dome + tapering flame tip
  ellipse(g, cx, 28, 11, 12, 'v');
  for (let y = 26; y >= 8; y--) { const w = Math.max(0, (y - 8) * 0.5); ellipse(g, cx, y, w, 1.4, 'v', { mirror: false }); }
  // wispy trailing tails at the base
  for (const [tx, amp] of [[cx - 5, 1], [cx, 1.4], [cx + 5, 1]]) for (let i = 0; i < 6; i++) set(g, tx + Math.sin(i) * amp, 40 + i, 'u');
  shadeInto(g, cx - 3, 22, 8, 9, 'V', ['v']); shadeInto(g, cx - 3, 18, 4, 5, 'g', ['v', 'V']);
  shadeInto(g, cx, 34, 11, 6, 'u', ['v']);
  ellipse(g, cx, 30, 3, 4, 'g'); // glowing core
  // little arm nubs
  ellipse(g, cx - 10, 28, 2, 3, 'v'); ellipse(g, cx + 10, 28, 2, 3, 'v');
  glossyEyes(g, cx, 6.5, 27, 3.6, 4.4, 1);
  dot(g, cx, cx - 8, 31, 'c'); dot(g, cx, cx - 8, 32, 'c');
  set(g, cx - 1, 33, 'p'); set(g, cx, 34, 'p'); set(g, cx + 1, 33, 'p');
  ellipse(g, cx - 13, 20, 1, 1.3, 'g'); ellipse(g, cx + 13, 24, 1, 1.3, 'g');
  return finish(g, P);
}

// --- slime — Dropletta (water / mage) --------------------------------------
export function slime() {
  const P = { '.': '', S: '#08131a', k: '#0e2a38', D: '#2f8fc0', b: '#57c0e6', h: '#a6ecff',
    w: '#ecffff', p: '#0e2a38', s: '#ffffff', c: '#ff9ab0', t: '#c9f6ff' };
  const g = grid(54, 62); const cx = 27;
  contactShadow(g, cx, 58, 16);
  // water-drop: round bottom + tapering point up
  ellipse(g, cx, 40, 15, 15, 'b');
  for (let y = 38; y >= 12; y--) { const w = Math.max(0, (y - 12) * 0.42); ellipse(g, cx, y, w, 1.4, 'b', { mirror: false }); }
  shadeInto(g, cx - 4, 30, 10, 11, 'h', ['b']); shadeInto(g, cx, 48, 15, 9, 'D', ['b']);
  // classic droplet shine (upper-left) + bubbles
  for (let i = 0; i < 5; i++) set(g, cx - 7, 30 + i, 'w'); set(g, cx - 8, 32, 'w'); ellipse(g, cx - 6, 26, 1.4, 2, 'w');
  ellipse(g, cx + 7, 44, 2, 2.6, 't'); ellipse(g, cx - 9, 46, 1.4, 2, 't');
  // little arms
  ellipse(g, cx - 15, 42, 2.6, 3.6, 'b'); ellipse(g, cx + 15, 44, 2.6, 3.4, 'b');
  glossyEyes(g, cx, 7, 40, 4, 4.8, 1);
  dot(g, cx, cx - 11, 45, 'c'); dot(g, cx, cx - 11, 46, 'c');
  for (const [mx, my] of [[-2, 48], [-1, 49], [0, 49], [1, 49], [2, 48]]) set(g, cx + mx, my, 'p');
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

export const BOOT = {
  lizard: { species: 'Emberling', element: 'fire', build: lizard },
  wing: { species: 'Glidefang', element: 'water', build: wing },
  bat: { species: 'Nightnip', element: 'dark', build: bat },
  bug: { species: 'Mitebug', element: 'nature', build: bug },
  plant: { species: 'Sprigling', element: 'nature', build: plant },
  scrap: { species: 'Scrapmite', element: 'machine', build: scrap },
  wisp: { species: 'Gloomote', element: 'dark', build: wisp },
  slime: { species: 'Dropletta', element: 'water', build: slime },
  lion: { species: 'Regalion', element: 'fire', build: lion },
};
