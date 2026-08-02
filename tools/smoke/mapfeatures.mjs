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

console.log('\nERRORS:', errs.length ? errs.join('\n') : '(none)');
if (errs.length) failures += errs.length;
console.log(`\nVERDICT: ${failures ? 'FAIL (' + failures + ')' : 'PASS'}`);
await browser.close();
process.exit(failures ? 1 : 0);
