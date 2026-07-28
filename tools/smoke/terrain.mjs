import { chromium } from 'playwright';

// Terrain-uniqueness smoke test. Two halves, both deterministic and fight-free:
//
//  1. Data: runs window.hd2dGame.validateDomains() over every floor of every
//     domain (rectangular rows, one start, reachable events/chests/portals,
//     chest keys that land on C tiles, decor on walkable tiles), and checks each
//     domain wears its expected terrain skins.
//  2. Build: enters every floor via the debug API (no combat) and confirms the
//     grid + terrain + decor actually build in three.js — grid size matches the
//     data, every decor spec was placed, and no decor landed on a wall.
//
// See tools/smoke/README.md. Post stack stripped so the loop runs at ~26 fps.

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

const st = () => page.evaluate(() => {
  const g = window.hd2dGame;
  return {
    scene: g.manager.current,
    dlg: (() => { const d = document.querySelector('#dialogue'); return !!d && d.style.display !== 'none'; })(),
  };
});
const press = async (k, n = 1, gap = 250) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await page.waitForTimeout(gap); } };
const clearDlg = async (m = 60) => { for (let i = 0; i < m; i++) { if (!(await st()).dlg) return; await page.keyboard.press('Enter'); await page.waitForTimeout(150); } };
const waitScene = async (name, ms = 30000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if ((await st()).scene === name) return true; await page.waitForTimeout(200); }
  console.log('  !! timeout waiting for', name); return false;
};
const pickPartner = async () => {
  for (let i = 0; i < 60; i++) {
    if (await page.locator('.card', { hasText: 'Emberling' }).count()) { await page.locator('.card', { hasText: 'Emberling' }).click(); await page.waitForTimeout(300); return; }
    await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  }
};

await page.goto(process.env.URL ?? 'http://localhost:4173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.evaluate(() => {
  const g = window.hd2dGame, p = g.hd2d.params;
  p.supersample = 0.35; p.dofEnabled = false; p.tiltEnabled = false; p.bloomEnabled = false;
  g.hd2d.renderer.shadowMap.enabled = false; g.hd2d.applyParams();
});

// --- 1. Data validation -----------------------------------------------------
console.log('\n=== domain data ===');
const problems = await page.evaluate(() => window.hd2dGame.validateDomains());
check('validateDomains reports no problems', problems.length === 0, problems.join(' | '));

const terrains = await page.evaluate(() => {
  const out = {};
  for (const [id, dom] of Object.entries(window.hd2dGame.domains)) {
    out[id] = dom.floors.map((f) => f.theme.terrain ?? 'stone');
  }
  return out;
});
console.log('  terrain skins :', JSON.stringify(terrains));
const expect = {
  crossing: ['stone', 'stone', 'stone'],
  crystal: ['crystal', 'metal', 'crystal'],
  jungle: ['jungle', 'jungle', 'jungle'],
  haunted: ['crypt', 'cave', 'crypt'],
};
for (const [id, exp] of Object.entries(expect)) {
  check(`${id} terrain = ${exp.join('/')}`, JSON.stringify(terrains[id]) === JSON.stringify(exp));
}
// Between-domain uniqueness: no two domains share the same skin sequence.
const seqs = Object.values(terrains).map((t) => t.join(','));
check('every domain has a distinct terrain sequence', new Set(seqs).size === seqs.length);

// --- reach a valid run state, then jump floor by floor -----------------------
await page.keyboard.press('Enter'); await page.waitForTimeout(700);
await page.locator('.keyboard button', { hasText: /^OK$/ }).click(); await page.waitForTimeout(500);
await pickPartner();
await clearDlg(); await waitScene('hub'); await page.waitForTimeout(500); await clearDlg();

// --- 2. Build every floor and inspect its grid + decor ----------------------
const floorList = await page.evaluate(() =>
  Object.entries(window.hd2dGame.domains).flatMap(([id, dom]) => dom.floors.map((_, i) => [id, i])));

for (const [dom, idx] of floorList) {
  await page.evaluate(async ({ dom, idx }) => {
    const g = window.hd2dGame;
    g.game.activeDomainId = dom; g.game.floorIndex = idx; g.game.crawl.initialized = false;
    await g.manager.go('dungeon');
  }, { dom, idx });
  await waitScene('dungeon');
  await page.waitForTimeout(500);

  const info = await page.evaluate(() => {
    const g = window.hd2dGame, s = g.manager.activeScene;
    const floor = g.domains[g.game.activeDomainId].floors[g.game.floorIndex];
    const specs = floor.decor ?? [];
    const onWall = specs.filter((d) => !s.grid.walkable(d.x, d.z)).map((d) => `${d.kind}@${d.x},${d.z}`);
    return {
      id: floor.id,
      terrain: floor.theme.terrain ?? 'stone',
      gridMatches: s.grid.width === floor.rows[0].length && s.grid.depth === floor.rows.length,
      decorPlaced: s.decor.length,
      decorSpecs: specs.length,
      onWall,
    };
  });
  console.log(`\n=== ${info.id} (${info.terrain}) ===`);
  check('grid built at the data\'s size', info.gridMatches);
  check('all decor billboards placed', info.decorPlaced === info.decorSpecs, `${info.decorPlaced}/${info.decorSpecs}`);
  check('no decor on a wall/void tile', info.onWall.length === 0, info.onWall.join(', '));
  await page.screenshot({ path: new URL(`./shots/terrain-${info.id}.png`, import.meta.url).pathname });
}

console.log('\nERRORS:', errs.length ? errs.join('\n') : '(none)');
if (errs.length) failures += errs.length;
console.log(`\nVERDICT: ${failures ? 'FAIL (' + failures + ')' : 'PASS'}`);
await browser.close();
process.exit(failures ? 1 : 0);
