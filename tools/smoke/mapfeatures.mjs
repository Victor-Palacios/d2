import { chromium } from 'playwright';

// Map-features smoke test for the "improve the maps" slice. Deterministic and
// fight-free. Verifies, on crystal-1 (the showcase floor):
//   - elevation: raised/sunken tiles report a non-zero grid.floorY.
//   - scatter: extra passable decor was auto-placed (and none blocks a tile).
//   - hazard: a '^' tile parses as kind 'hazard', is walkable, and stepping onto
//     it drains HAZARD_LP extra light.
// And, on crystal-2: keys & locked doors — a '+' blocks while closed, a 'k'
// pickup sets keysHeld, spending a key opens the door (passable + persisted),
// and the validator's key-aware reachability accepts a keyed floor but flags a
// door with no reachable key.
// And, on crystal-3: switches & toggle-walls — a '%' barrier parses as a solid
// toggleWall (not passable, mesh visible), stepping a '*' switch flips it open
// (passable, mesh hidden), and the toggle-aware validator accepts a
// switch-solvable floor but flags a barrier with no reachable switch.
// Visual-depth atmosphere: ambient dust motes — a persistent in-bounds mote
// cloud that drifts each frame — and torch god-rays — every torch group carries
// an additive light-shaft cone.
// And, on crystal-1: secret walls — a '?' tile parses as a passable secret
// disguised by a false wall; walking into it crumbles the wall and opens the
// way to a chest walled behind it — plus living element plates whose emissive
// glow breathes over time, a '~' liquid pool whose caustic surface scrolls,
// drifting layered ground mist, and floor light pools under emissive decor.

const browser = await chromium.launch({
  executablePath: process.env.CHROME,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 720, height: 405 } });
const errs = [];
page.on('pageerror', (e) => errs.push('[pageerror] ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errs.push('[console] ' + m.text()); });

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
};

await page.goto(process.env.URL || 'http://localhost:4173/', { waitUntil: 'load' });
await page.waitForFunction(() => !!window.hd2dGame, null, { timeout: 30000 });

// Validator over all floors (includes the new hazard portal-safety rule).
const problems = await page.evaluate(() => window.hd2dGame.validateReaches());
check('validateReaches reports no problems', problems.length === 0, problems.join(' | '));

// Enter crystal-1 (the showcase floor) via the debug API.
const info = await page.evaluate(async () => {
  const g = window.hd2dGame;
  g.game.activeReachId = 'crystal';
  g.game.floorIndex = 0;
  g.game.crawl.initialized = false;
  await g.manager.go('dungeon');
  const s = g.manager.activeScene;
  const floor = g.reaches.crystal.floors[0];
  // Find a hazard '^' in the rows.
  let haz = null;
  floor.rows.forEach((r, z) => { const x = r.indexOf('^'); if (x >= 0 && !haz) haz = { x, z }; });
  const elevKeys = Object.keys(floor.elevation ?? {});
  const anElev = elevKeys[0]?.split(',').map(Number) ?? null;
  return {
    hazard: haz,
    hazardKind: haz ? s.grid.at(haz.x, haz.z).kind : null,
    hazardWalkable: haz ? s.grid.walkable(haz.x, haz.z) : null,
    elevSample: anElev ? { key: elevKeys[0], y: s.grid.floorY(anElev[0], anElev[1]) } : null,
    scatterAuthored: (floor.decor ?? []).length,
    scatterTotal: s.decor.length,
  };
});

check('elevation: a raised/sunken tile has non-zero floorY',
  !!info.elevSample && info.elevSample.y !== 0, JSON.stringify(info.elevSample));
check('scatter: extra passable decor was auto-placed',
  info.scatterTotal > info.scatterAuthored, `${info.scatterAuthored} -> ${info.scatterTotal}`);
check('hazard: \'^\' parses as a walkable hazard tile',
  info.hazardKind === 'hazard' && info.hazardWalkable === true, JSON.stringify(info));

// Stepping onto the hazard drains extra light. Teleport the party next to it and
// walk on, comparing light before/after (a plain step costs 1; a hazard costs 1+8).
const drain = await page.evaluate(async ({ haz }) => {
  const g = window.hd2dGame;
  const s = g.manager.activeScene;
  await new Promise((r) => setTimeout(r, 400));
  s.busy = false; s.moving = false; s.leaving = false;
  g.game.light = g.game.maxLight;
  s.tileX = haz.x; s.tileZ = haz.z;
  const before = g.game.light;
  // Resolve the tile-entry interaction for the hazard directly.
  await s.onTileEntered(s.grid.at(haz.x, haz.z));
  return { before, after: g.game.light };
}, { haz: info.hazard });

check('hazard: entering it drains extra light',
  drain.after <= drain.before - 8, `${drain.before} -> ${drain.after}`);

// --- keys & locked doors (crystal-2) ----------------------------------------
const kd = await page.evaluate(async () => {
  const g = window.hd2dGame;
  g.game.openedDoors.clear();
  g.game.takenPickups.clear();
  g.game.activeReachId = 'crystal';
  g.game.floorIndex = 1; // crystal-2
  g.game.crawl.initialized = false;
  await g.manager.go('dungeon');
  await new Promise((r) => setTimeout(r, 400));
  const s = g.manager.activeScene;
  const floor = g.reaches.crystal.floors[1];
  const find = (ch) => { for (let z = 0; z < floor.rows.length; z++) { const x = floor.rows[z].indexOf(ch); if (x >= 0) return { x, z }; } return null; };
  const door = find('+');
  const keyT = find('k');
  const out = {
    door, keyT,
    doorKind: door && s.grid.at(door.x, door.z).kind,
    doorClosed: door && s.grid.isDoorClosed(door.x, door.z),
    doorPassableClosed: door && s.grid.passable(door.x, door.z),
    keyKind: keyT && s.grid.at(keyT.x, keyT.z).kind,
  };
  // Pick up the key (resolve its tile-entry directly).
  s.busy = false; s.moving = false; s.leaving = false;
  await s.onTileEntered(s.grid.at(keyT.x, keyT.z));
  out.keysAfterPickup = s.keysHeld;
  // Open the door: stand on a passable neighbour and step into it.
  const nb = [[0, 1], [0, -1], [1, 0], [-1, 0]]
    .map(([dx, dz]) => ({ x: door.x + dx, z: door.z + dz }))
    .find((c) => s.grid.passable(c.x, c.z));
  const dir = nb.z < door.z ? 'down' : nb.z > door.z ? 'up' : nb.x < door.x ? 'right' : 'left';
  s.tileX = nb.x; s.tileZ = nb.z; s.placePlayer();
  s.tryStep(dir);
  out.doorClosedAfter = s.grid.isDoorClosed(door.x, door.z);
  out.doorOpenedPersisted = g.game.openedDoors.has(`${floor.id}:${door.x},${door.z}`);
  out.keysAfterOpen = s.keysHeld;
  return out;
});

check('door: \'+\' parses as a door that blocks while closed',
  kd.doorKind === 'door' && kd.doorClosed === true && kd.doorPassableClosed === false, JSON.stringify(kd));
check('key: \'k\' parses as a key; pickup sets keysHeld',
  kd.keyKind === 'key' && kd.keysAfterPickup === 1, `keysHeld=${kd.keysAfterPickup}`);
check('door: spending a key opens it (passable + persisted, key consumed)',
  kd.doorClosedAfter === false && kd.doorOpenedPersisted === true && kd.keysAfterOpen === 0, JSON.stringify(kd));

// --- validator: key-aware reachability (positive + negative) ----------------
const val = await page.evaluate(() => {
  const base = { id: 't', name: 't', theme: {}, events: {}, encounterRate: 0, encounters: [] };
  const noKey = window.hd2dGame.validateFloor({
    ...base, chests: { '3,1': { note: 'x' } },
    rows: ['#######', '#S+C>.#', '#######'],
  });
  const withKey = window.hd2dGame.validateFloor({
    ...base, chests: { '4,1': { note: 'x' } },
    rows: ['#######', '#Sk+C>#', '#######'],
  });
  return { noKey, withKey };
});
check('validator flags a door with no reachable key',
  val.noKey.some((e) => /locked|unreachable/.test(e)), val.noKey.join(' | '));
check('validator accepts a door whose key is reachable',
  !val.withKey.some((e) => /locked|unreachable/.test(e)), val.withKey.join(' | '));

// --- switches & toggle-walls (crystal-3) ------------------------------------
const sw = await page.evaluate(async () => {
  const g = window.hd2dGame;
  g.game.activeReachId = 'crystal';
  g.game.floorIndex = 2; // crystal-3 (Shivering Gallery)
  g.game.crawl.initialized = false;
  await g.manager.go('dungeon');
  await new Promise((r) => setTimeout(r, 400));
  const s = g.manager.activeScene;
  const floor = g.reaches.crystal.floors[2];
  const find = (ch) => { for (let z = 0; z < floor.rows.length; z++) { const x = floor.rows[z].indexOf(ch); if (x >= 0) return { x, z }; } return null; };
  const barrier = find('%');
  const swi = find('*');
  const meshOf = (c) => s.toggleMeshes.get(`${c.x},${c.z}`);
  const out = {
    barrier, swi,
    barrierKind: barrier && s.grid.at(barrier.x, barrier.z).kind,
    switchKind: swi && s.grid.at(swi.x, swi.z).kind,
    barrierPassableBefore: barrier && s.grid.passable(barrier.x, barrier.z),
    barrierMeshVisibleBefore: barrier && !!meshOf(barrier)?.visible,
  };
  // Step the switch (resolve its tile-entry directly), then re-read the barrier.
  s.busy = false; s.moving = false; s.leaving = false;
  s.tileX = swi.x; s.tileZ = swi.z;
  await s.onTileEntered(s.grid.at(swi.x, swi.z));
  out.barrierPassableAfter = s.grid.passable(barrier.x, barrier.z);
  out.barrierMeshVisibleAfter = !!meshOf(barrier)?.visible;
  return out;
});

check('toggle-wall: \'%\' parses as a toggleWall that blocks (solid) initially',
  sw.barrierKind === 'toggleWall' && sw.barrierPassableBefore === false && sw.barrierMeshVisibleBefore === true,
  JSON.stringify(sw));
check('switch: \'*\' parses as a switch tile',
  sw.switchKind === 'switch', JSON.stringify({ swi: sw.swi, kind: sw.switchKind }));
check('switch: stepping it flips the barrier open (passable + mesh hidden)',
  sw.barrierPassableAfter === true && sw.barrierMeshVisibleAfter === false, JSON.stringify(sw));

// --- validator: toggle-aware reachability (positive + negative) -------------
const tval = await page.evaluate(() => {
  const base = { id: 't', name: 't', theme: {}, events: {}, encounterRate: 0, encounters: [] };
  // A reachable switch opens the barrier onto the chest + portal → solvable.
  const solvable = window.hd2dGame.validateFloor({
    ...base, chests: { '5,1': { note: 'x' } },
    rows: ['########', '#S*.%C>#', '########'],
  });
  // No switch exists, so the barrier never opens → the target is a soft-lock.
  const stuck = window.hd2dGame.validateFloor({
    ...base, chests: { '4,1': { note: 'x' } },
    rows: ['#######', '#S.%C>#', '#######'],
  });
  return { solvable, stuck };
});
check('validator accepts a floor whose switch opens the barrier',
  !tval.solvable.some((e) => /unreachable/.test(e)), tval.solvable.join(' | '));
check('validator flags a barrier with no reachable switch',
  tval.stuck.some((e) => /no reachable switch|unreachable/.test(e)), tval.stuck.join(' | '));

// --- ambient dust motes (visual depth) --------------------------------------
// A persistent, in-bounds mote cloud that drifts each frame. Verify it exists,
// sits inside the floor's footprint, and actually moves when the scene updates.
const dust = await page.evaluate(async () => {
  const g = window.hd2dGame;
  const s = g.manager.activeScene; // still on crystal-3 from the block above
  const d = s.dust;
  if (!d) return { present: false };
  const pos = d.points.geometry.getAttribute('position');
  const n = pos.count;
  // Grid footprint in world units (± a tile of slack, matching the spawn box).
  const halfW = ((s.grid.width - 1) / 2) * 2 + 2;
  const halfD = ((s.grid.depth - 1) / 2) * 2 + 2;
  let inBounds = 0;
  let minY = Infinity;
  let maxY = -Infinity;
  const before = [];
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (Math.abs(x) <= halfW + 0.001 && Math.abs(z) <= halfD + 0.001) inBounds++;
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    if (i < 8) before.push([x, y, z]);
  }
  // Advance a few frames and confirm the cloud drifted (positions changed).
  for (let f = 0; f < 5; f++) d.update(0.2, f * 0.2);
  let moved = 0;
  for (let i = 0; i < 8; i++) {
    if (Math.abs(pos.getX(i) - before[i][0]) + Math.abs(pos.getY(i) - before[i][1]) + Math.abs(pos.getZ(i) - before[i][2]) > 1e-4) moved++;
  }
  return { present: true, n, inBounds, minY, maxY, moved };
});

check('dust: an ambient mote cloud exists with points', dust.present && dust.n > 0, JSON.stringify({ n: dust.n }));
check('dust: motes sit inside the floor footprint and above the ground',
  dust.present && dust.inBounds === dust.n && dust.minY >= 0, JSON.stringify(dust));
check('dust: motes drift when the scene updates', dust.present && dust.moved > 0, `${dust.moved}/8 moved`);

// --- torch light shafts (god-rays) ------------------------------------------
// Each torch hangs an additive cone of light. Verify the torch-lit floor has
// torches and that each torch group carries an additive-blended cone mesh.
const shafts = await page.evaluate(async () => {
  const g = window.hd2dGame;
  const s = g.manager.activeScene; // crystal-3
  const torches = s.torches.length;
  let withShaft = 0;
  for (const t of s.torches) {
    let found = false;
    t.object.traverse((o) => {
      // AdditiveBlending === 2; the shaft is the only additive cone in the group.
      if (o.isMesh && o.geometry?.type === 'ConeGeometry' && o.material?.blending === 2) found = true;
    });
    if (found) withShaft++;
  }
  return { torches, withShaft };
});
check('god-rays: the floor is torch-lit', shafts.torches > 0, `${shafts.torches} torches`);
check('god-rays: every torch carries an additive light-shaft cone',
  shafts.torches > 0 && shafts.withShaft === shafts.torches, JSON.stringify(shafts));

// --- secret walls (crystal-1) -----------------------------------------------
// A '?' tile is passable floor disguised as a wall. Verify it parses as a
// secret, is passable, its false-wall mesh is visible until stepped into, and
// stepping it reveals the tile (mesh hidden) and opens the way to the chest
// walled behind it.
const secret = await page.evaluate(async () => {
  const g = window.hd2dGame;
  g.game.openedChests.clear();
  g.game.activeReachId = 'crystal';
  g.game.floorIndex = 0; // crystal-1 (Glimmer Shelf)
  g.game.crawl.initialized = false;
  await g.manager.go('dungeon');
  await new Promise((r) => setTimeout(r, 400));
  const s = g.manager.activeScene;
  const floor = g.reaches.crystal.floors[0];
  const find = (ch) => { for (let z = 0; z < floor.rows.length; z++) { const x = floor.rows[z].indexOf(ch); if (x >= 0) return { x, z }; } return null; };
  const sec = find('?');
  const chest = { x: 15, z: 9 };
  const meshOf = (c) => s.secretMeshes.get(`${c.x},${c.z}`);
  const out = {
    sec,
    secretKind: sec && s.grid.at(sec.x, sec.z).kind,
    passableBefore: sec && s.grid.passable(sec.x, sec.z), // secrets are always passable
    meshVisibleBefore: sec && !!meshOf(sec)?.visible,
  };
  // Walk into the false wall — it should crumble (mesh hidden).
  s.busy = false; s.moving = false; s.leaving = false;
  s.tileX = sec.x; s.tileZ = sec.z;
  await s.onTileEntered(s.grid.at(sec.x, sec.z));
  out.meshVisibleAfter = !!meshOf(sec)?.visible;
  out.hiddenAfter = s.grid.isSecretHidden(sec.x, sec.z);
  // The chest behind it opens as normal.
  const before = g.game.obols;
  s.tileX = chest.x; s.tileZ = chest.z;
  await s.onTileEntered(s.grid.at(chest.x, chest.z));
  out.chestGained = g.game.obols - before;
  return out;
});
check('secret: \'?\' parses as a secret tile that is passable',
  secret.secretKind === 'secret' && secret.passableBefore === true, JSON.stringify(secret));
check('secret: its false wall is visible until discovered',
  secret.meshVisibleBefore === true, JSON.stringify(secret));
check('secret: walking into it crumbles the wall (mesh hidden, revealed)',
  secret.meshVisibleAfter === false && secret.hiddenAfter === false, JSON.stringify(secret));
check('secret: the chest walled behind it is reachable and loots',
  secret.chestGained > 0, `+${secret.chestGained} obols`);

// --- living element plates (visual depth) -----------------------------------
// Element floor plates breathe: their emissive intensity animates on a per-tile
// phase. Sample one plate at several times and confirm its glow moves and stays
// in a sane range.
const plates = await page.evaluate(async () => {
  const g = window.hd2dGame;
  g.game.activeReachId = 'crystal';
  g.game.floorIndex = 0; // crystal-1 has a block of W (water) plates
  g.game.crawl.initialized = false;
  await g.manager.go('dungeon');
  await new Promise((r) => setTimeout(r, 300));
  const s = g.manager.activeScene;
  const first = [...s.elementMeshes.values()][0];
  if (!first) return { count: 0 };
  const readAt = (t) => {
    s.animateElementPlates(t);
    return (first.material.emissiveIntensity);
  };
  const samples = [0, 0.25, 0.5, 0.9, 1.4].map(readAt);
  const min = Math.min(...samples);
  const max = Math.max(...samples);
  return { count: s.elementMeshes.size, samples, min, max };
});
check('element plates: the floor has animated element meshes', plates.count > 0, `${plates.count} plates`);
check('element plates: emissive glow changes over time (breathing)',
  plates.count > 0 && plates.max - plates.min > 0.05, JSON.stringify(plates.samples));
check('element plates: glow stays in a sane, non-negative range',
  plates.count > 0 && plates.min >= 0.2 && plates.max <= 3, JSON.stringify({ min: plates.min, max: plates.max }));

// --- liquid pools (crystal-1) -----------------------------------------------
// A '~' tile is a walkable animated pool. Verify it parses as liquid, is
// passable, the floor built pool meshes, and their shared caustic emissive map
// scrolls when the surface animates.
const liquid = await page.evaluate(async () => {
  const g = window.hd2dGame;
  g.game.activeReachId = 'crystal';
  g.game.floorIndex = 0; // crystal-1 (Glimmer Shelf) — the meltwater pool
  g.game.crawl.initialized = false;
  await g.manager.go('dungeon');
  await new Promise((r) => setTimeout(r, 300));
  const s = g.manager.activeScene;
  const floor = g.reaches.crystal.floors[0];
  const find = (ch) => { for (let z = 0; z < floor.rows.length; z++) { const x = floor.rows[z].indexOf(ch); if (x >= 0) return { x, z }; } return null; };
  const pool = find('~');
  const mesh = pool && [...s.liquidMeshes.values()][0];
  const off0 = mesh ? { x: mesh.material.emissiveMap.offset.x, y: mesh.material.emissiveMap.offset.y } : null;
  // Animate a few frames and confirm the caustic map scrolled.
  for (let f = 0; f < 5; f++) s.animateLiquid(0.2, f * 0.2);
  const off1 = mesh ? { x: mesh.material.emissiveMap.offset.x, y: mesh.material.emissiveMap.offset.y } : null;
  return {
    pool,
    poolKind: pool && s.grid.at(pool.x, pool.z).kind,
    passable: pool && s.grid.passable(pool.x, pool.z),
    count: s.liquidMeshes.size,
    scrolled: off0 && off1 ? Math.abs(off1.x - off0.x) + Math.abs(off1.y - off0.y) : 0,
  };
});
check('liquid: \'~\' parses as a walkable liquid tile',
  liquid.poolKind === 'liquid' && liquid.passable === true, JSON.stringify(liquid));
check('liquid: the floor built animated pool meshes', liquid.count > 0, `${liquid.count} pool tiles`);
check('liquid: the caustic surface scrolls when animated', liquid.scrolled > 0.001, `Δoffset=${liquid.scrolled}`);

// --- ground mist + emissive glow pools (crystal-1) --------------------------
const atmos = await page.evaluate(async () => {
  const g = window.hd2dGame;
  g.game.activeReachId = 'crystal';
  g.game.floorIndex = 0; // crystal-1 has 4 emissive decor (crystals + ice shards)
  g.game.crawl.initialized = false;
  await g.manager.go('dungeon');
  await new Promise((r) => setTimeout(r, 300));
  const s = g.manager.activeScene;
  // Ground mist: layered drifting planes.
  const mistLayers = s.mist ? s.mist.object.children.length : 0;
  const layer = s.mist?.object.children[0];
  const off0 = layer ? { x: layer.material.map.offset.x, y: layer.material.map.offset.y } : null;
  for (let f = 0; f < 6; f++) s.mist?.update(0.3, f * 0.3);
  const off1 = layer ? { x: layer.material.map.offset.x, y: layer.material.map.offset.y } : null;
  const mistDrift = off0 && off1 ? Math.abs(off1.x - off0.x) + Math.abs(off1.y - off0.y) : 0;
  // Glow pools: additive circle decals under emissive decor.
  let glowPools = 0;
  s.scene.traverse((o) => {
    if (o.isMesh && o.geometry?.type === 'CircleGeometry' && o.material?.blending === 2) glowPools++;
  });
  const emissiveDecor = (g.reaches.crystal.floors[0].decor ?? []).filter((d) => (d.emissive ?? 0.1) >= 0.3).length;
  return { mistLayers, mistDrift, glowPools, emissiveDecor };
});
check('ground mist: the floor has layered drifting mist planes', atmos.mistLayers >= 2, `${atmos.mistLayers} layers`);
check('ground mist: the mist drifts over time', atmos.mistDrift > 0.001, `Δoffset=${atmos.mistDrift}`);
check('glow pools: every bright decor casts a floor light pool',
  atmos.emissiveDecor > 0 && atmos.glowPools >= atmos.emissiveDecor, JSON.stringify(atmos));

// --- element-plate puzzle (crystal-2) ---------------------------------------
// Lighting every element plate opens the floor's toggle-wall barrier onto a
// chest. Verify the barrier is solid until the last plate, then opens + loots.
const puzzle = await page.evaluate(async () => {
  const g = window.hd2dGame;
  g.game.openedChests.clear();
  g.game.activeReachId = 'crystal';
  g.game.floorIndex = 1; // crystal-2 (Frozen Vault) — platePuzzle:true
  g.game.crawl.initialized = false;
  await g.manager.go('dungeon');
  await new Promise((r) => setTimeout(r, 300));
  const s = g.manager.activeScene;
  const floor = g.reaches.crystal.floors[1];
  const barrier = (() => { for (let z = 0; z < floor.rows.length; z++) { const x = floor.rows[z].indexOf('%'); if (x >= 0) return { x, z }; } return null; })();
  const plates = [];
  floor.rows.forEach((row, z) => { [...row].forEach((ch, x) => { if ('WFNMD'.includes(ch)) plates.push({ x, z }); }); });
  const out = { platePuzzle: floor.platePuzzle === true, plateCount: plates.length, barrier };
  s.busy = false; s.moving = false; s.leaving = false;
  out.solidBefore = s.grid.isToggleSolid(barrier.x, barrier.z);
  // Light all but the last plate — barrier should still be solid.
  for (let i = 0; i < plates.length - 1; i++) { s.tileX = plates[i].x; s.tileZ = plates[i].z; await s.onTileEntered(s.grid.at(plates[i].x, plates[i].z)); }
  out.solidMidway = s.grid.isToggleSolid(barrier.x, barrier.z);
  // Light the last plate — barrier opens.
  const last = plates[plates.length - 1];
  s.tileX = last.x; s.tileZ = last.z; await s.onTileEntered(s.grid.at(last.x, last.z));
  out.solidAfter = s.grid.isToggleSolid(barrier.x, barrier.z);
  // Loot the chest behind it.
  const chest = { x: 15, z: 9 };
  const before = g.game.obols;
  s.tileX = chest.x; s.tileZ = chest.z; await s.onTileEntered(s.grid.at(chest.x, chest.z));
  out.chestGained = g.game.obols - before;
  return out;
});
check('plate puzzle: crystal-2 is a plate-puzzle floor with plates',
  puzzle.platePuzzle && puzzle.plateCount >= 2, JSON.stringify({ platePuzzle: puzzle.platePuzzle, plates: puzzle.plateCount }));
check('plate puzzle: the barrier stays solid until the last plate is lit',
  puzzle.solidBefore === true && puzzle.solidMidway === true, JSON.stringify(puzzle));
check('plate puzzle: lighting every plate opens the barrier',
  puzzle.solidAfter === false, JSON.stringify(puzzle));
check('plate puzzle: the chest behind the barrier then loots',
  puzzle.chestGained > 0, `+${puzzle.chestGained} obols`);

// --- pressure plate (jungle-4) ----------------------------------------------
// Stepping the '_' plate opens the toggle-walls; they re-seal a few seconds
// later. Verify open-on-step, then re-seal after the hold elapses.
const press = await page.evaluate(async () => {
  const g = window.hd2dGame;
  g.game.activeReachId = 'jungle';
  g.game.floorIndex = 3; // jungle-4 (Sunken Boughs)
  g.game.crawl.initialized = false;
  await g.manager.go('dungeon');
  await new Promise((r) => setTimeout(r, 300));
  const s = g.manager.activeScene;
  const floor = g.reaches.jungle.floors[3];
  const find = (ch) => { for (let z = 0; z < floor.rows.length; z++) { const x = floor.rows[z].indexOf(ch); if (x >= 0) return { x, z }; } return null; };
  const plate = find('_');
  const barrier = find('%');
  const out = { plate, barrier, plateKind: plate && s.grid.at(plate.x, plate.z).kind };
  s.busy = false; s.moving = false; s.leaving = false;
  out.solidBefore = s.grid.isToggleSolid(barrier.x, barrier.z);
  // Step the plate.
  s.tileX = plate.x; s.tileZ = plate.z;
  await s.onTileEntered(s.grid.at(plate.x, plate.z));
  out.solidAfterStep = s.grid.isToggleSolid(barrier.x, barrier.z);
  // Stand on the plate (not in the doorway) and let the hold elapse.
  s.tileX = plate.x; s.tileZ = plate.z;
  for (let i = 0; i < 10; i++) s.tickPressurePlate(1); // >> PLATE_HOLD seconds
  out.solidAfterHold = s.grid.isToggleSolid(barrier.x, barrier.z);
  return out;
});
check('pressure plate: \'_\' parses as a pressure tile', press.plateKind === 'pressure', JSON.stringify({ plate: press.plate, kind: press.plateKind }));
check('pressure plate: the barrier is solid until the plate is stepped',
  press.solidBefore === true && press.solidAfterStep === false, JSON.stringify(press));
check('pressure plate: the barrier re-seals after the hold elapses',
  press.solidAfterHold === true, JSON.stringify(press));

console.log('\nERRORS:', errs.length ? errs.join('\n') : '(none)');
if (errs.length) failures += errs.length;
console.log(`\nVERDICT: ${failures ? 'FAIL (' + failures + ')' : 'PASS'}`);
await browser.close();
process.exit(failures ? 1 : 0);
