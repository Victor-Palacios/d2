// Evolution-stage sprites for the Quiet Crossing lines. Each evolved form gets
// its OWN sprite that HOLDS its base's palette + silhouette (a grown-up version)
// in the flat house style — so a line reads as one creature maturing, not a
// swap to some unrelated monster. Keyed by new art key for integrate.mjs.
//
// Stage escalation: bigger silhouette, more of the signature feature, a fiercer
// face (personality climbs rookie → clever/fierce → fierce/uncanny), and a
// crown/aura flourish at the final stage.
import { grid, ellipse, rect, dot, set, smooth, outlineSil, toArt } from './compose.mjs';
import { shadeInto, contactShadow } from './creatures.mjs';
import { applyFace } from './personality.mjs';

// Clean silhouette → stamp the family face → outline. Same pipeline as the base
// builders, so an evolved form matches its predecessor's rendering exactly.
function done(g, P, personality, cfg) {
  smooth(g);
  applyFace(personality, g, cfg);
  outlineSil(g, 'k');
  return toArt(g, P);
}

// ============================================================================
// FIRE — Emberling line (ember-golems): emberling → emberforge → ashwarden → pyrelord
// ============================================================================
const EMBER = { '.': '', S: '#100a08', k: '#2a1408', u: '#3a1a10', r: '#c0381c', o: '#ff7a2e', y: '#ffb84f', f: '#ffe08a', w: '#fff6e8', p: '#241021', s: '#ffffff', g: '#ff5a2a' };
function emberGolem(stage) {
  // stage 2..4 — grows taller/wider, more cracks, bigger core, crown at 4.
  const sz = [0, 0, 1.12, 1.24, 1.36][stage];
  const W = Math.round(64 * sz), H = Math.round(72 * sz), cx = Math.round(W / 2);
  const g = grid(W, H);
  const hy = Math.round(H * 0.34), ty = Math.round(H * 0.68);
  contactShadow(g, cx, H - 4, Math.round(W * 0.32));
  // floating embers (more each stage)
  for (let i = 0; i < stage + 1; i++) { ellipse(g, 6 + i * 3, 20 + i * 6, 1.6, 1.6, i % 2 ? 'f' : 'o'); ellipse(g, W - 6 - i * 3, 26 + i * 5, 1.5, 1.5, 'o'); }
  // flame crown (final stage) / crest
  if (stage >= 4) for (const dx of [-10, -4, 2, 8]) { ellipse(g, cx + dx, hy - 15, 2.6, 5, 'o'); ellipse(g, cx + dx, hy - 16, 1.3, 3, 'f'); }
  else { ellipse(g, cx + 6, hy - 13, 2.6, 4.4, 'o'); ellipse(g, cx + 6, hy - 14, 1.3, 2.6, 'f'); }
  // chunky golem body
  const hw = Math.round(W * 0.4), bw = Math.round(W * 0.46);
  rect(g, cx - Math.round(hw / 2), hy - 9, cx + Math.round(hw / 2), hy + 9, 'o');   // head
  rect(g, cx - Math.round(bw / 2), ty - 12, cx + Math.round(bw / 2), ty + 10, 'o'); // torso
  rect(g, cx - Math.round(bw / 2) - 4, ty - 6, cx - Math.round(bw / 2) - 1, ty + 6, 'o'); // arms
  rect(g, cx + Math.round(bw / 2) + 1, ty - 6, cx + Math.round(bw / 2) + 4, ty + 6, 'o');
  rect(g, cx - 9, ty + 10, cx - 2, H - 5, 'o'); rect(g, cx + 2, ty + 10, cx + 9, H - 5, 'o'); // legs
  // ramp
  shadeInto(g, cx - 4, hy - 4, hw, 10, 'y', ['o']); shadeInto(g, cx - 6, hy - 8, 6, 5, 'f', ['o', 'y']);
  shadeInto(g, cx, ty + 4, bw, 9, 'r', ['o']);
  // molten cracks (more each stage)
  const cr = [[cx - 8, ty - 4], [cx + 9, ty - 2], [cx - 10, ty + 6], [cx + 7, ty + 7], [cx - 4, hy + 6], [cx + 5, ty - 8]];
  for (let i = 0; i < Math.min(cr.length, stage * 2); i++) set(g, cr[i][0], cr[i][1], 'y');
  // dark visor + glowing chest core (bigger each stage)
  rect(g, cx - Math.round(hw / 2) + 1, hy - 4, cx + Math.round(hw / 2) - 1, hy + 2, 'u');
  const coreR = 4 + stage;
  ellipse(g, cx, ty, coreR + 1.5, coreR + 2, 'u'); ellipse(g, cx, ty, coreR, coreR + 0.5, 'r');
  ellipse(g, cx, ty, coreR - 1.6, coreR - 1, 'f'); ellipse(g, cx, ty, coreR - 3, coreR - 2.4, 'w'); set(g, cx, ty - 3, 's');
  return done(g, EMBER, 'fierce', { cx, eyeY: hy - 1, dx: 5 + Math.round(stage / 2), rx: 3.2, ry: 3.4, mouthY: null, pal: { skin: 'o' } });
}
export { emberGolem };

// ============================================================================
// WATER — Glidefang line (winged sky-water): glidefang → gustwing → tempestrix
// ============================================================================
const WING = { '.': '', S: '#08131a', k: '#123040', D: '#2f7fb0', b: '#4fb0e0', h: '#a6e6ff', w: '#ecffff', p: '#0e2a38', s: '#ffffff', c: '#ff9ab0', t: '#c9f6ff' };
function skywing(stage) {
  const sz = [0, 0, 1.15, 1.3][stage]; const W = Math.round(66 * sz), H = Math.round(54 * sz), cx = Math.round(W / 2);
  const g = grid(W, H); contactShadow(g, cx, H - 4, Math.round(W * 0.18));
  const span = 0.34 + 0.05 * stage;
  // wings (bigger + more lobes each stage), left larger
  for (const dir of [-1, 1]) {
    const wx = cx + dir * Math.round(W * 0.28);
    ellipse(g, wx, H * 0.4, W * span * 0.5, H * 0.3, 'b');
    ellipse(g, wx + dir * 3, H * 0.28, W * span * 0.32, H * 0.2, 'b');
    if (stage >= 3) ellipse(g, wx + dir * 5, H * 0.56, W * span * 0.34, H * 0.22, 'b');
    shadeInto(g, wx - dir * 2, H * 0.32, W * span * 0.42, H * 0.24, 'h', ['b']);
    shadeInto(g, wx + dir * 2, H * 0.5, W * span * 0.4, H * 0.2, 'D', ['b']);
  }
  // body orb (darker so it reads against wings)
  ellipse(g, cx, H * 0.5, W * 0.14, H * 0.34, 'D');
  shadeInto(g, cx - 2, H * 0.4, W * 0.1, H * 0.2, 'b', ['D']); ellipse(g, cx, H * 0.6, W * 0.08, H * 0.16, 'h');
  // ear-fins / crown-fin at final
  ellipse(g, cx - 3, H * 0.24, 2, 3.5, 'D'); ellipse(g, cx + 3, H * 0.24, 2, 3.5, 'D');
  if (stage >= 3) { for (const dx of [-4, 0, 4]) ellipse(g, cx + dx, H * 0.2, 1.6, 4, 'b'); }
  ellipse(g, cx + 7, H * 0.62, 1.4, 2, 't'); ellipse(g, cx - 8, H * 0.56, 1.2, 1.8, 't');
  const pers = stage >= 3 ? 'fierce' : 'clever';
  return done(g, WING, pers, { cx, eyeY: Math.round(H * 0.48), dx: 4, rx: 3.4, ry: 4, mouthY: stage >= 3 ? null : Math.round(H * 0.6), pal: { skin: 'D' } });
}

// ============================================================================
// DARK — Nightnip line (bat-shade): nightnip → duskfang → nightmaw → umbranox
// ============================================================================
const BAT = { '.': '', S: '#0a0814', k: '#1a1226', u: '#33265a', v: '#6b4aa0', V: '#9a7ad0', w: '#fff2ff', p: '#160f26', s: '#ffffff', c: '#ff9ab0', f: '#fffbe8', e: '#4a2a5a', g: '#cbb8ff' };
function batShade(stage) {
  const sz = [0, 0, 1.14, 1.26, 1.4][stage]; const W = Math.round(60 * sz), H = Math.round(56 * sz), cx = Math.round(W / 2);
  const g = grid(W, H); contactShadow(g, cx, H - 4, Math.round(W * 0.22));
  // wings (bigger + more scallops each stage)
  for (const dir of [-1, 1]) {
    const wx = cx + dir * Math.round(W * 0.26);
    for (let i = 0; i < stage; i++) ellipse(g, wx + dir * i * 3, H * 0.38 + i * 5, 4.5 - i * 0.4, 8 - i, 'u');
  }
  // body
  ellipse(g, cx, H * 0.55, W * 0.24, H * 0.24, 'v');
  shadeInto(g, cx - 3, H * 0.46, W * 0.16, H * 0.16, 'V', ['v']); shadeInto(g, cx - 4, H * 0.4, 5, 4, 'g', ['v', 'V']);
  // ears (taller each stage)
  const eh = 6 + stage; ellipse(g, cx - 8, H * 0.28 - eh * 0.3, 3.6, eh * 0.5, 'v'); ellipse(g, cx + 8, H * 0.28 - eh * 0.3, 3.6, eh * 0.5, 'v');
  ellipse(g, cx - 8, H * 0.3, 1.6, 3, 'e'); ellipse(g, cx + 8, H * 0.3, 1.6, 3, 'e');
  // fangs + motes
  set(g, cx - 2, Math.round(H * 0.66), 'f'); set(g, cx + 3, Math.round(H * 0.66), 'f');
  ellipse(g, cx - 13, H * 0.34, 1, 1.3, 'g'); ellipse(g, cx + 13, H * 0.3, 1, 1.3, 'g');
  const pers = stage >= 4 ? 'uncanny' : stage >= 3 ? 'fierce' : 'clever';
  return done(g, BAT, pers, { cx, eyeY: Math.round(H * 0.5), dx: 6, rx: 3.6, ry: 4.2, mouthY: pers === 'clever' ? Math.round(H * 0.63) : null, pal: { skin: 'v', white: pers === 'uncanny' ? 'g' : 'w' } });
}

// ============================================================================
// NATURE — Mitebug line (beetle-mon): mitebug → chitterling → carapex
// ============================================================================
const BUG = { '.': '', S: '#0a1208', k: '#1c2a16', r: '#356a2c', o: '#6ab048', y: '#9bd86a', h: '#c4ef9a', w: '#fbffee', p: '#1c2a16', s: '#ffffff', c: '#ff9a9a', a: '#20301a' };
function beetle(stage) {
  const sz = [0, 0, 1.16, 1.32][stage]; const W = Math.round(58 * sz), H = Math.round(52 * sz), cx = Math.round(W / 2);
  const g = grid(W, H); contactShadow(g, cx, H - 4, Math.round(W * 0.28));
  const blk = (x, y, kk) => { set(g, x, y, kk); set(g, x + 1, y, kk); set(g, x, y + 1, kk); set(g, x + 1, y + 1, kk); };
  // legs (more each stage)
  for (let i = 0; i < stage + 1; i++) { const yy = H * 0.5 + i * 4; blk(Math.round(W * 0.24), yy, 'a'); blk(Math.round(W * 0.72), yy, 'a'); }
  // carapace
  ellipse(g, cx, H * 0.56, W * 0.3, H * 0.34, 'o');
  shadeInto(g, cx - 4, H * 0.44, W * 0.22, H * 0.24, 'y', ['o']); shadeInto(g, cx - 5, H * 0.38, 6, 5, 'h', ['o', 'y']);
  shadeInto(g, cx, H * 0.72, W * 0.3, H * 0.18, 'r', ['o']);
  rect(g, cx - 1, Math.round(H * 0.4), cx + 1, Math.round(H * 0.78), 'r'); // seam
  for (const [sx, sy] of [[cx - 8, H * 0.55], [cx + 8, H * 0.55]]) ellipse(g, sx, sy, 3, 4, 'y'); // wing-case highlights
  // horns (grow) + antennae
  if (stage >= 3) { ellipse(g, cx - 5, H * 0.32, 2, 5, 'a'); ellipse(g, cx + 5, H * 0.32, 2, 5, 'a'); }
  for (let i = 0; i < 5; i++) { blk(cx - 4 - i, Math.round(H * 0.34) - i, 'a'); blk(cx + 3 + i, Math.round(H * 0.34) - i, 'a'); }
  ellipse(g, cx - 9, H * 0.24, 2, 2, 'y'); ellipse(g, cx + 9, H * 0.24, 2, 2, 'y');
  const pers = stage >= 3 ? 'fierce' : 'nervous';
  return done(g, BUG, pers, { cx, eyeY: Math.round(H * 0.52), dx: 6, rx: 3.2, ry: 3.8, mouthY: pers === 'fierce' ? null : Math.round(H * 0.64), pal: { skin: 'o' } });
}

// ============================================================================
// NATURE — Sprigling line (sprout): sprigling → bloomkin → thornward → verdammon
// ============================================================================
const PLANT = { '.': '', S: '#0a1208', k: '#1c2a16', L: '#5aa838', l: '#9bd86a', v: '#2f6a2a', m: '#f0e6c2', d: '#ccb98a', o: '#e8d8a8', P: '#ff8fb0', Q: '#ffb8d0', w: '#fbffee', p: '#1c2a16', s: '#ffffff', c: '#ff9ab0', b: '#8a5a3a' };
function sprout(stage) {
  const sz = [0, 0, 1.15, 1.3, 1.44][stage]; const W = Math.round(58 * sz), H = Math.round(68 * sz), cx = Math.round(W / 2);
  const g = grid(W, H); contactShadow(g, cx, H - 4, Math.round(W * 0.26));
  // bulb body
  ellipse(g, cx, H * 0.66, W * 0.26, H * 0.26, 'm');
  shadeInto(g, cx - 4, H * 0.58, W * 0.18, H * 0.16, 'o', ['m']); shadeInto(g, cx, H * 0.76, W * 0.26, H * 0.14, 'd', ['m']);
  // stem
  rect(g, cx - 1, Math.round(H * 0.28), cx + 1, Math.round(H * 0.55), 'b');
  // leaves (more each stage)
  for (let i = 0; i < stage; i++) { const dir = i % 2 ? 1 : -1, yy = H * 0.2 + i * 5; ellipse(g, cx + dir * (5 + i), yy, 6 - i * 0.5, 3.4, 'L'); shadeInto(g, cx + dir * (5 + i), yy - 0.5, 5 - i * 0.5, 2.4, 'l', ['L']); }
  // flower bloom (bigger each stage) at the crown
  const br = 2.6 + stage * 0.8; ellipse(g, cx, H * 0.12, br, br * 0.9, 'P'); ellipse(g, cx, H * 0.11, br * 0.55, br * 0.5, 'Q');
  if (stage >= 4) for (const a of [0, 1.2, 2.4, 3.6, 4.8]) ellipse(g, cx + Math.cos(a) * br * 1.4, H * 0.12 + Math.sin(a) * br * 1.3, 1.6, 1.6, 'P');
  // little feet + arm leaves
  ellipse(g, cx - 7, H - 8, 4, 3, 'm'); ellipse(g, cx + 7, H - 8, 4, 3, 'm');
  ellipse(g, cx - Math.round(W * 0.3), H * 0.6, 3, 4, 'L'); ellipse(g, cx + Math.round(W * 0.3), H * 0.62, 2.6, 3.4, 'L');
  const pers = stage >= 4 ? 'fierce' : 'friendly';
  return done(g, PLANT, pers, { cx, eyeY: Math.round(H * 0.63), dx: 6, rx: 3.6, ry: 4.2, mouthY: pers === 'fierce' ? null : Math.round(H * 0.74), pal: { skin: 'm' } });
}

// ============================================================================
// MACHINE — Scrapmite line (salvage bot): scrapmite → boltframe → dynamo
// ============================================================================
const SCRAP = { '.': '', S: '#080a10', k: '#14161f', D: '#3a4152', b: '#5f6b82', h: '#9fb0cc', n: '#0e202a', g: '#7fe6ff', y: '#ffce5a', w: '#ffffff', p: '#0e202a', s: '#ffffff', r: '#c85a4a' };
function bot(stage) {
  const sz = [0, 0, 1.16, 1.32][stage]; const W = Math.round(58 * sz), H = Math.round(62 * sz), cx = Math.round(W / 2);
  const g = grid(W, H); contactShadow(g, cx, H - 4, Math.round(W * 0.28));
  // chassis
  ellipse(g, cx, H * 0.62, W * 0.26, H * 0.26, 'b');
  shadeInto(g, cx - 4, H * 0.52, W * 0.18, H * 0.16, 'h', ['b']); shadeInto(g, cx, H * 0.74, W * 0.26, H * 0.14, 'D', ['b']);
  // head + dark screen
  ellipse(g, cx, H * 0.32, W * 0.2, H * 0.17, 'b'); shadeInto(g, cx - 3, H * 0.26, 6, 5, 'h', ['b']);
  ellipse(g, cx, H * 0.34, W * 0.14, H * 0.1, 'n');
  // glow eyes (more each stage) + bolts
  ellipse(g, cx - 3, H * 0.33, 1.8, 2.2, 'g'); ellipse(g, cx + 3, H * 0.33, 1.8, 2.2, 'g');
  if (stage >= 3) ellipse(g, cx, H * 0.27, 1.4, 1.4, 'g');
  for (let x = cx - 2; x <= cx + 2; x++) set(g, x, Math.round(H * 0.4), 'g');
  dot(g, cx, cx - 7, Math.round(H * 0.62), 'y'); dot(g, cx, cx - 7, Math.round(H * 0.7), 'y');
  // antennae (more each stage) + glow core
  const blk = (x, y) => { set(g, x, y, 'D'); set(g, x + 1, y, 'D'); set(g, x, y + 1, 'D'); set(g, x + 1, y + 1, 'D'); };
  for (let a = 0; a < stage; a++) { const dir = a % 2 ? 1 : -1; for (let i = 0; i <= 5; i++) blk(cx + dir * (3 + a * 2) + Math.round(i * 0.3 * dir), Math.round(H * 0.2) - i); ellipse(g, cx + dir * (3 + a * 2) + 2, H * 0.1, 2, 2, 'g'); }
  ellipse(g, cx, H * 0.62, 4 + stage, 4 + stage, 'n'); ellipse(g, cx, H * 0.62, 2.4 + stage * 0.5, 2.4 + stage * 0.5, 'g'); set(g, cx - 1, Math.round(H * 0.58), 'w');
  // arms + tread
  ellipse(g, cx - Math.round(W * 0.3), H * 0.58, 3, 4.5, 'b'); ellipse(g, cx + Math.round(W * 0.3), H * 0.64, 3, 4, 'b');
  ellipse(g, cx, H - 6, W * 0.2, 3, 'D');
  const pers = stage >= 3 ? 'uncanny' : 'clever';
  return done(g, SCRAP, pers, { cx, eyeY: Math.round(H * 0.33), dx: 4, rx: 2.6, ry: 2.8, mouthY: pers === 'uncanny' ? Math.round(H * 0.4) : Math.round(H * 0.42), pal: { skin: 'b', white: 'g', mouth: 'g' } });
}

// ============================================================================
// DARK — Gloomote line (memory-shade): gloomote → gloomshade → oblivion
// ============================================================================
const WISP = { '.': '', S: '#0a0814', k: '#16112a', u: '#2e2456', v: '#5b46a0', V: '#8f78d8', g: '#cbb8ff', w: '#fff2ff', p: '#160f26', s: '#ffffff', c: '#ff9ab0' };
function shade(stage) {
  const sz = [0, 0, 1.16, 1.34][stage]; const W = Math.round(52 * sz), H = Math.round(62 * sz), cx = Math.round(W / 2);
  const g = grid(W, H); contactShadow(g, cx, H - 5, Math.round(W * 0.16));
  // wide bulbous head
  ellipse(g, cx, H * 0.36, W * 0.28, H * 0.2, 'v');
  shadeInto(g, cx - 4, H * 0.28, W * 0.2, H * 0.14, 'V', ['v']); shadeInto(g, cx - 4, H * 0.24, 5, 4, 'g', ['v', 'V']);
  // narrowing body
  for (let y = Math.round(H * 0.48); y <= Math.round(H * 0.66); y++) { const wd = Math.max(2, W * 0.22 * (1 - (y - H * 0.48) / (H * 0.3))); ellipse(g, cx, y, wd, 1.6, 'v', { mirror: false }); }
  // tendrils (more each stage)
  const blk = (x, y) => { set(g, x, y, 'v'); set(g, x + 1, y, 'v'); set(g, x, y + 1, 'v'); set(g, x + 1, y + 1, 'v'); };
  const nt = stage + 1;
  for (let t = 0; t < nt; t++) { const bx = cx + Math.round((t - (nt - 1) / 2) * 6); for (let i = 0; i <= 7; i++) blk(bx + Math.round(Math.sin(i / 2 + t) * 2), Math.round(H * 0.64) + i); }
  ellipse(g, cx, H * 0.4, 3, 3.5, 'g'); // glow core
  // motes
  ellipse(g, cx - Math.round(W * 0.32), H * 0.24, 1, 1.3, 'g'); ellipse(g, cx + Math.round(W * 0.32), H * 0.3, 1, 1.3, 'g');
  const pers = stage >= 3 ? 'uncanny' : 'clever';
  return done(g, WISP, pers, { cx, eyeY: Math.round(H * 0.35), dx: 6, rx: 3.6, ry: 4, mouthY: pers === 'uncanny' ? Math.round(H * 0.44) : Math.round(H * 0.46), pal: { skin: 'v', white: 'g', mouth: 'u' } });
}

// ============================================================================
// WATER — Dropletta line (droplet): dropletta → wellspring → tidalby → maelstrom
// ============================================================================
const SLIME = { '.': '', S: '#08131a', k: '#0e2a38', D: '#2f8fc0', b: '#57c0e6', h: '#a6ecff', w: '#ecffff', p: '#0e2a38', s: '#ffffff', c: '#ff9ab0', t: '#c9f6ff' };
function droplet(stage) {
  const sz = [0, 0, 1.14, 1.28, 1.42][stage]; const W = Math.round(56 * sz), H = Math.round(58 * sz), cx = Math.round(W / 2);
  const g = grid(W, H); contactShadow(g, cx, H - 4, Math.round(W * 0.3));
  // round ball body (a little squash)
  ellipse(g, cx, H * 0.56, W * 0.32, H * 0.32, 'b'); ellipse(g, cx, H * 0.7, W * 0.32, H * 0.2, 'b');
  shadeInto(g, cx - 4, H * 0.42, W * 0.24, H * 0.22, 'h', ['b']); shadeInto(g, cx - 5, H * 0.36, 7, 6, 'w', ['b', 'h']);
  shadeInto(g, cx, H * 0.76, W * 0.32, H * 0.16, 'D', ['b']);
  // droplet crown spikes (more each stage)
  for (let i = 0; i < stage; i++) { const dx = (i - (stage - 1) / 2) * 7; for (let j = 0; j < 4 + i; j++) set(g, cx + dx, Math.round(H * 0.28) - j, 'b'); ellipse(g, cx + dx, H * 0.24, 1.6, 2.4, 'h'); }
  // inner bubbles (more each stage)
  for (let i = 0; i < stage + 1; i++) ellipse(g, cx + (i % 2 ? 8 : -9) + i, H * 0.6 + i * 2, 1.8, 2.4, 't');
  // arm nubs
  ellipse(g, cx - Math.round(W * 0.32), H * 0.6, 2.8, 3.6, 'b'); ellipse(g, cx + Math.round(W * 0.32), H * 0.64, 2.8, 3.4, 'b');
  const pers = stage >= 4 ? 'fierce' : stage >= 3 ? 'clever' : 'friendly';
  return done(g, SLIME, pers, { cx, eyeY: Math.round(H * 0.56), dx: 6, rx: 3.6, ry: 4.4, mouthY: pers === 'fierce' ? null : Math.round(H * 0.68), pal: { skin: 'b' } });
}

export { skywing, batShade, beetle, sprout, bot, shade, droplet };

// --- registries -------------------------------------------------------------
// New art key -> builder. Art key == species id for every evolved form.
export const EVO = {
  emberforge: () => emberGolem(2), ashwarden: () => emberGolem(3), pyrelord: () => emberGolem(4),
  gustwing: () => skywing(2), tempestrix: () => skywing(3),
  duskfang: () => batShade(2), nightmaw: () => batShade(3), umbranox: () => batShade(4),
  chitterling: () => beetle(2), carapex: () => beetle(3),
  bloomkin: () => sprout(2), thornward: () => sprout(3), verdammon: () => sprout(4),
  boltframe: () => bot(2), dynamo: () => bot(3),
  gloomshade: () => shade(2), oblivion: () => shade(3),
  wellspring: () => droplet(2), tidalby: () => droplet(3), maelstrom: () => droplet(4),
};
// base species id -> ordered [stageId, DisplayName, evolveLevel] for the linear line.
export const LINES = {
  emberling: [['emberforge', 'Emberforge', 10], ['ashwarden', 'Ashwarden', 20], ['pyrelord', 'Pyrelord', 30]],
  glidefang: [['gustwing', 'Gustwing', 10], ['tempestrix', 'Tempestrix', 22]],
  nightnip: [['duskfang', 'Duskfang', 10], ['nightmaw', 'Nightmaw', 20], ['umbranox', 'Umbranox', 30]],
  mitebug: [['chitterling', 'Chitterling', 9], ['carapex', 'Carapex', 20]],
  sprigling: [['bloomkin', 'Bloomkin', 10], ['thornward', 'Thornward', 20], ['verdammon', 'Verdammon', 30]],
  scrapmite: [['boltframe', 'Boltframe', 9], ['dynamo', 'Dynamo', 20]],
  gloomote: [['gloomshade', 'Gloomshade', 10], ['oblivion', 'Oblivion', 22]],
  dropletta: [['wellspring', 'Wellspring', 10], ['tidalby', 'Tidalby', 20], ['maelstrom', 'Maelstrom', 30]],
};
