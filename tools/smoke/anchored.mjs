import { chromium } from 'playwright';

// The Anchored — optional element super-encounters (src/data/anchored.ts). Drives
// the real crossing crawl onto The Unquenched's fire mass and proves the three
// guarantees the feature rests on:
//   1. engaging it does NOT consume the event (so a lost/fled fight leaves it to
//      face again) — usedEvents is still clear the moment we reach the battle;
//   2. victory DOES consume it, grants its Memento once, and sets the
//      `anchored:crossing` flag;
//   3. a non-victory return (defeat) consumes nothing — checked on a fresh
//      Anchored via the debug API.
// See tools/smoke/README.md.

const browser = await chromium.launch({
  executablePath: process.env.CHROME,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 720, height: 405 } });
const errs = [];
page.on('pageerror', (e) => errs.push('[pageerror] ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errs.push('[console] ' + m.text()); });

const st = () => page.evaluate(() => {
  const g = window.hd2dGame; const s = g.manager.activeScene ?? {};
  return {
    scene: g.manager.current,
    reach: g.game.activeReachId,
    floor: g.game.floorIndex,
    tile: s.tileX !== undefined ? `${s.tileX},${s.tileZ}` : null,
    dlg: (() => { const d = document.querySelector('#dialogue'); return !!d && d.style.display !== 'none'; })(),
  };
});
const used = (key) => page.evaluate((k) => [...window.hd2dGame.game.usedEvents].includes(k), key);
const has = (f) => page.evaluate((f) => window.hd2dGame.game.has(f), f);
const item = (id) => page.evaluate((id) => window.hd2dGame.game.itemCount(id), id);
const press = async (k, n = 1, gap = 300) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await page.waitForTimeout(gap); } };
const clearDlg = async (m = 60) => { for (let i = 0; i < m; i++) { if (!(await st()).dlg) return; await page.keyboard.press('Enter'); await page.waitForTimeout(160); } };
const waitScene = async (name, ms = 40000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if ((await st()).scene === name) return true; await page.waitForTimeout(200); }
  console.log('  !! timeout waiting for', name, JSON.stringify(await st())); return false;
};
const pickPartner = async () => {
  for (let i = 0; i < 50; i++) {
    if (await page.locator('.card', { hasText: 'Emberling' }).count()) { await page.locator('.card', { hasText: 'Emberling' }).click(); await page.waitForTimeout(300); return; }
    await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  }
};
const boost = () => page.evaluate(() => {
  window.hd2dGame.game.party.forEach((c) => { c.maxHp = 999; c.hp = 999; c.maxMp = 999; c.mp = 999; c.off = 160; c.def = 999; });
});
// Win by mashing confirm (advances the intro), then auto-battle (KeyQ), then keep
// confirming through round banners and the post-fight log. Mirrors reaches.mjs.
const winBattle = async (ms = 120000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms && (await st()).scene !== 'battle') { await page.keyboard.press('Enter'); await page.waitForTimeout(250); }
  await page.waitForTimeout(700);
  for (let i = 0; i < 3 && (await st()).scene === 'battle'; i++) { await page.keyboard.press('KeyQ'); await page.waitForTimeout(450); }
  while (Date.now() - t0 < ms && (await st()).scene === 'battle') { await page.keyboard.press('Enter'); await page.waitForTimeout(450); }
  return (await st()).scene === 'dungeon';
};

await page.goto(process.env.URL ?? 'http://localhost:4188/', { waitUntil: 'networkidle' });
await page.waitForSelector('.title-press', { timeout: 4000 }).catch(() => {});
if (await page.locator('.title-press').count()) { await page.keyboard.press('Enter'); await page.waitForTimeout(300); }
await page.waitForTimeout(1500);
await page.evaluate(() => { const g = window.hd2dGame; const p = g.hd2d.params;
  p.supersample = 0.35; p.dofEnabled = false; p.tiltEnabled = false; p.bloomEnabled = false;
  g.hd2d.renderer.shadowMap.enabled = false; g.hd2d.applyParams(); });
await page.waitForTimeout(1200);

// New game -> hub.
await page.keyboard.press('Enter'); await page.waitForTimeout(800);
await page.locator('.keyboard button', { hasText: /^OK$/ }).click(); await page.waitForTimeout(600);
await pickPartner();
await clearDlg(); await waitScene('hub'); await page.waitForTimeout(600); await clearDlg();

// Drop straight into the Quiet Crossing, floor 1, via the debug API (this smoke
// tests the Anchored, not the tutorial path), and boost the party to win.
await page.evaluate(async () => {
  const g = window.hd2dGame;
  g.game.activeReachId = 'crossing'; g.game.floorIndex = 0; g.game.crawl.initialized = false;
  await g.manager.go('dungeon');
});
await waitScene('dungeon'); await page.waitForTimeout(900); await clearDlg();
await boost();
let s = await st();
console.log('in crossing floor 1 :', JSON.stringify({ reach: s.reach, floor: s.floor, tile: s.tile }));

// The Unquenched sits at (3,8) — straight down 6 tiles from the start (3,2),
// through the fire mass. Walk down until the fight triggers.
for (let i = 0; i < 8 && (await st()).scene === 'dungeon'; i++) { await page.keyboard.press('ArrowDown'); await page.waitForTimeout(320); }

// Guarantee 1: engaging the Anchored (its intro fired the moment we stepped on)
// must NOT consume it. Advance the intro into the arena, and confirm the event
// is still unconsumed at the moment we reach the battle.
let engaged = false;
for (let i = 0; i < 40 && !engaged; i++) {
  if ((await st()).scene === 'battle') { engaged = true; break; }
  await page.keyboard.press('Enter'); await page.waitForTimeout(220);
}
const notConsumedOnEngage = !(await used('crossing-1:3'));
console.log('engaged the Anchored        :', engaged, JSON.stringify(await st()));
console.log('NOT consumed on engage      :', notConsumedOnEngage);
const enemyIsFire = await page.evaluate(() => {
  const b = window.hd2dGame.manager.activeScene?.battle;
  return b ? b.side('enemy').every((u) => u.creature.element === 'fire') : false;
});
console.log('enemy roster is fire        :', enemyIsFire);

// Guarantee 2: win -> consumed once, Memento granted, flag set.
const won = await winBattle();
await waitScene('dungeon'); await page.waitForTimeout(600); await clearDlg();
const consumedOnWin = await used('crossing-1:3');
const gotFlag = await has('anchored:crossing');
const gotMemento = (await item('emberVigil')) === 1;
console.log('won the Anchored            :', won);
console.log('consumed on win             :', consumedOnWin);
console.log('anchored:crossing flag set  :', gotFlag);
console.log('Ember Vigil granted (x1)    :', gotMemento);

// Guarantee 3: a non-victory return consumes nothing. Use a FRESH Anchored (the
// Reliquary's) and re-enter the dungeon with a 'defeat' result on its event —
// afterBattle only runs on victory, so nothing is consumed or granted.
const lossSafe = await page.evaluate(async () => {
  const g = window.hd2dGame;
  g.game.activeReachId = 'crystal'; g.game.floorIndex = 0; g.game.crawl.initialized = false;
  await g.manager.go('dungeon', { battleResult: 'defeat', eventId: '3' });
  await new Promise((r) => setTimeout(r, 500));
  return {
    used: [...g.game.usedEvents].includes('crystal-1:3'),
    flag: g.game.has('anchored:crystal'),
    memento: g.game.itemCount('stillTears'),
  };
});
const lossConsumesNothing = !lossSafe.used && !lossSafe.flag && lossSafe.memento === 0;
console.log('defeat consumes nothing     :', lossConsumesNothing, JSON.stringify(lossSafe));

const ok = engaged && notConsumedOnEngage && enemyIsFire && won && consumedOnWin && gotFlag && gotMemento && lossConsumesNothing;
console.log('\nANCHORED OK :', ok);
console.log('ERRORS:', errs.length ? errs.join('\n') : '(none)');
await browser.close();
process.exit(ok && !errs.length ? 0 : 1);
