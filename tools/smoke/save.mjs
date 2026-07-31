import { chromium } from 'playwright';
const OUT = process.env.OUT ?? new URL('./shots', import.meta.url).pathname;

const browser = await chromium.launch({
  executablePath: process.env.CHROME,  // e.g. /opt/pw-browsers/chromium-*/chrome-linux/chrome; omit to use Playwright's own
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
// One context so localStorage persists across "sessions" (reloads).
const ctx = await browser.newContext({ viewport: { width: 800, height: 450 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('[pageerror] ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errs.push('[console] ' + m.text()); });

const cheap = async () => {
  await page.evaluate(() => {
    const g = window.hd2dGame; const p = g.hd2d.params;
    p.supersample = 0.35; p.dofEnabled = false; p.tiltEnabled = false; p.bloomEnabled = false;
    g.hd2d.renderer.shadowMap.enabled = false; g.hd2d.applyParams();
  });
};
const st = () => page.evaluate(() => {
  const g = window.hd2dGame;
  const s = g.manager.activeScene ?? {};
  return {
    scene: g.manager.current,
    tile: s.tileX !== undefined ? `${s.tileX},${s.tileZ}` : null,
    floor: g.game.floorIndex, fuel: g.game.fuel, obols: g.game.obols,
    name: g.game.playerName,
    busy: s.busy ?? null,
    dlg: (() => { const d = document.querySelector('#dialogue'); return !!d && d.style.display !== 'none'; })(),
    menuItems: [...document.querySelectorAll('.menu li')].map((n) => n.textContent.trim()),
    saves: { auto: !!localStorage.getItem('hd2d.save.auto'), suspend: !!localStorage.getItem('hd2d.save.suspend') },
  };
});
const idle = async (n = 80) => {
  for (let i = 0; i < n; i++) {
    const s = await st();
    if (!s.busy && !s.dlg) return s;
    if (s.dlg) { await page.keyboard.press('Enter'); await page.waitForTimeout(200); }
    else await page.waitForTimeout(250);
  }
  return st();
};
// Advances dialogue while waiting, and waits for the scene to be idle.
// A scene's arrival() opens with `await sleep(280)` — during that window the
// scene matches but is momentarily idle (busy false, no dialogue yet) before
// its opening dialogue appears. Returning then is a race that skips the
// arrival (and its autosave), so after the scene first matches we give it a
// beat to kick its arrival off before trusting an idle reading.
const waitScene = async (name, ms = 45000) => {
  const t0 = Date.now();
  let settled = false;
  while (Date.now() - t0 < ms) {
    const s = await st();
    if (s.scene === name && !settled) { settled = true; await page.waitForTimeout(500); continue; }
    if (s.scene === name && !s.dlg && !s.busy) return true;
    if (s.dlg) { await page.keyboard.press('Enter'); await page.waitForTimeout(200); }
    else await page.waitForTimeout(220);
  }
  console.log('  !! timeout waiting for', name, JSON.stringify(await st()));
  return false;
};

console.log('=== SESSION 1: fresh start ===');
const pickPartner = async () => {
  for (let i = 0; i < 50; i++) {
    if (await page.locator('.card', { hasText: 'Emberling' }).count()) { await page.locator('.card', { hasText: 'Emberling' }).click(); await page.waitForTimeout(300); return; }
    await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  }
};

await page.goto((process.env.URL ?? 'http://localhost:5199/'), { waitUntil: 'networkidle' });
// Lost Souls title: wait for and dismiss the "press any button" splash so the menu is reachable.
await page.waitForSelector('.title-press', { timeout: 4000 }).catch(() => {});
if (await page.locator('.title-press').count()) { await page.keyboard.press('Enter'); await page.waitForTimeout(300); }
await page.waitForTimeout(1500);
await cheap();
await page.waitForTimeout(1000);
console.log('title menu :', JSON.stringify((await st()).menuItems));

// New Game -> name entry -> accept -> prologue -> hub
await page.keyboard.press('Enter');
await page.waitForTimeout(800);
await page.locator('.keyboard button', { hasText: /^OK$/ }).click();
await page.waitForTimeout(600);
  await pickPartner();
await waitScene('hub');
let s = await st();
console.log('in hub     :', JSON.stringify({ scene: s.scene, saves: s.saves }));

// Walk into the dungeon and take a few steps so the suspend has real state.
await page.evaluate(async () => {
  const g = window.hd2dGame;
  g.game.resetCrawl(); g.game.floorIndex = 1;
  await g.manager.go('dungeon');
});
await waitScene('dungeon');
await page.waitForTimeout(900);
for (let i = 0; i < 3; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(450); }
s = await st();
console.log('in dungeon :', JSON.stringify({ tile: s.tile, floor: s.floor, fuel: s.fuel }));
const beforeTile = s.tile, beforeFuel = s.fuel, beforeFloor = s.floor;

// ESC -> pause menu -> Suspend & quit
await page.keyboard.press('Escape');
await page.waitForTimeout(700);
console.log('pause menu :', JSON.stringify((await st()).menuItems));
await page.screenshot({ path: `${OUT}/80-pause.png` });
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(250);
await page.keyboard.press('Enter');
await waitScene('intro');
await page.waitForTimeout(900);
s = await st();
console.log('suspended  :', JSON.stringify({ scene: s.scene, saves: s.saves, menu: s.menuItems }));
await page.screenshot({ path: `${OUT}/81-title-continue.png` });

console.log('=== SESSION 2: reload the page (simulates coming back later) ===');
await page.reload({ waitUntil: 'networkidle' });
// Lost Souls title: wait for and dismiss the "press any button" splash so the menu is reachable.
await page.waitForSelector('.title-press', { timeout: 4000 }).catch(() => {});
if (await page.locator('.title-press').count()) { await page.keyboard.press('Enter'); await page.waitForTimeout(300); }
await page.waitForTimeout(1500);
await cheap();
await page.waitForTimeout(800);
s = await st();
console.log('title menu :', JSON.stringify(s.menuItems), '| saves', JSON.stringify(s.saves));

// Continue is first -> Enter
await page.keyboard.press('Enter');
await waitScene('dungeon');
await page.waitForTimeout(1200);
s = await st();
console.log('resumed    :', JSON.stringify({ scene: s.scene, tile: s.tile, floor: s.floor, fuel: s.fuel, name: s.name }));
console.log('  expected :', JSON.stringify({ tile: beforeTile, floor: beforeFloor, fuel: beforeFuel }));
console.log('  MATCH    :', s.tile === beforeTile && s.floor === beforeFloor && s.fuel === beforeFuel);
console.log('  suspend consumed on load :', (await st()).saves.suspend === false);

console.log('=== SESSION 3: reload again — suspend must be gone, autosave remains ===');
await page.reload({ waitUntil: 'networkidle' });
// Lost Souls title: wait for and dismiss the "press any button" splash so the menu is reachable.
await page.waitForSelector('.title-press', { timeout: 4000 }).catch(() => {});
if (await page.locator('.title-press').count()) { await page.keyboard.press('Enter'); await page.waitForTimeout(300); }
await page.waitForTimeout(1500);
await cheap();
await page.waitForTimeout(800);
s = await st();
console.log('title menu :', JSON.stringify(s.menuItems), '| saves', JSON.stringify(s.saves));

console.log('ERRORS:', errs.length ? errs.join('\n') : '(none)');
await browser.close();
