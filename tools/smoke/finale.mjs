import { chromium } from 'playwright';

// The finale reach (The Last Lantern, Act III). It is gated on the midpoint
// (requires 'actTwo'); its climax is not a fight but a choice — keep the soul
// you came for, or let it cross. This drives the 'let them cross' ending and
// asserts the ending flags + reach clear. See docs/NARRATIVE.md §11c.

const browser = await chromium.launch({
  executablePath: process.env.CHROME,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 720, height: 405 } });
const errs = [];
page.on('pageerror', (e) => errs.push('[pageerror] ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errs.push('[console] ' + m.text()); });

const scene = () => page.evaluate(() => window.hd2dGame.manager.current);
const dlg = () => page.evaluate(() => { const d = document.querySelector('#dialogue'); return !!d && d.style.display !== 'none'; });
const flag = (f) => page.evaluate((x) => window.hd2dGame.game.has(x), f);
const wait = async (n, ms = 30000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await scene()) === n) return true; await page.waitForTimeout(200); } return false; };

await page.goto(process.env.URL ?? 'http://localhost:4173/', { waitUntil: 'networkidle' });
await page.waitForSelector('.title-press', { timeout: 4000 }).catch(() => {});
if (await page.locator('.title-press').count()) { await page.keyboard.press('Enter'); await page.waitForTimeout(300); }
await page.waitForTimeout(1500);
await page.evaluate(() => { const g = window.hd2dGame, p = g.hd2d.params; p.supersample = 0.4; p.dofEnabled = false; p.bloomEnabled = false; g.hd2d.applyParams(); });

// New Game → hub.
await page.keyboard.press('Enter'); await page.waitForTimeout(700);
await page.locator('.keyboard button', { hasText: /^OK$/ }).click(); await page.waitForTimeout(600);
for (let i = 0; i < 40; i++) { if (await page.locator('.card', { hasText: 'Emberling' }).count()) break; await page.keyboard.press('Enter'); /* press through the prologue cutscene */ await page.waitForTimeout(200); }
await page.locator('.card', { hasText: 'Emberling' }).click();
for (let i = 0; i < 40; i++) { if ((await scene()) === 'hub') break; if (await dlg()) await page.keyboard.press('Enter'); await page.waitForTimeout(200); }
await wait('hub'); await page.waitForTimeout(400);
for (let i = 0; i < 20; i++) { if (await dlg()) await page.keyboard.press('Enter'); await page.waitForTimeout(120); }

const gated = await page.evaluate(() => window.hd2dGame.reaches.lantern?.requires === 'actTwo');
console.log('finale gated on actTwo     :', gated);

// Enter the finale floor directly (Act II reached), god-mode light so LP never runs out.
await page.evaluate(async () => {
  const g = window.hd2dGame;
  g.game.set('actTwo');
  g.game.activeReachId = 'lantern';
  g.game.maxLight = 999; g.game.light = 999;
  g.game.floorIndex = 2; // The Flame (finale floor)
  g.game.crawl.initialized = false;
  await g.manager.go('dungeon');
});
await wait('dungeon'); await page.waitForTimeout(900);

// Walk up into the finale tile; advance the lost-soul scene; choose to let it cross.
let chose = false;
for (let i = 0; i < 70; i++) {
  const cross = page.locator('.menu li', { hasText: 'Open your hands' });
  if (await cross.count()) { await cross.click(); chose = true; break; }
  if (await dlg()) await page.keyboard.press('Enter');
  else if ((await scene()) === 'dungeon') await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(220);
}
console.log('reached the finale choice   :', chose);

// Finish the ending; poll the completion flag (banner/scene change follows).
for (let i = 0; i < 70; i++) { if (await flag('gameComplete')) break; if (await dlg()) await page.keyboard.press('Enter'); await page.waitForTimeout(200); }
await page.waitForTimeout(500);

const cross = await flag('ending:cross');
const complete = await flag('gameComplete');
const cleared = await flag('lastLanternCleared');
console.log('ending:cross set            :', cross);
console.log('gameComplete set            :', complete);
console.log('lastLanternCleared set      :', cleared);

const ok = gated && chose && cross && complete && cleared;
console.log('\nFINALE OK :', ok);
console.log('ERRORS:', errs.length ? errs.join('\n') : '(none)');
await browser.close();
process.exit(ok && !errs.length ? 0 : 1);
