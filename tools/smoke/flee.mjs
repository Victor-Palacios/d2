import { chromium } from 'playwright';

// Run away: from a non-boss fight the player can attempt to flee (50%). Verifies
// the Run action is offered and that repeated attempts eventually escape back to
// the crawl without winning the fight. See tools/smoke/README.md.

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
const clearDlg = async (m = 60) => { for (let i = 0; i < m; i++) { if (!(await dlg())) return; await page.keyboard.press('Enter'); await page.waitForTimeout(150); } };
const waitScene = async (n, ms = 40000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await scene()) === n) return true; await page.waitForTimeout(200); } return false; };
const press = async (k, n = 1, gap = 300) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await page.waitForTimeout(gap); } };
const menuItems = () => page.evaluate(() => [...document.querySelectorAll('#action-menu .menu li')].map((n) => n.textContent.trim()));

await page.goto(process.env.URL ?? 'http://localhost:4173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.evaluate(() => { const g = window.hd2dGame; const p = g.hd2d.params; p.supersample = 0.35; p.dofEnabled = false; p.bloomEnabled = false; g.hd2d.applyParams(); });

await page.keyboard.press('Enter'); await page.waitForTimeout(800);
await page.locator('.keyboard button', { hasText: /^OK$/ }).click(); await page.waitForTimeout(600);
for (let i = 0; i < 40; i++) { if (await page.locator('.card', { hasText: 'Emberling' }).count()) break; if (await dlg()) await page.keyboard.press('Enter'); await page.waitForTimeout(200); }
await page.locator('.card', { hasText: 'Emberling' }).click();
await clearDlg(); await waitScene('hub'); await page.waitForTimeout(600); await clearDlg();

// Into The Quiet Crossing and across the gateway into the first (non-boss) fight.
await press('ArrowDown', 5); await press('ArrowLeft', 3); await press('ArrowDown', 2);
for (let i = 0; i < 12 && (await scene()) !== 'worldmap'; i++) { await page.keyboard.press('ArrowDown'); await page.waitForTimeout(300); if (await dlg()) await page.keyboard.press('Enter'); }
await waitScene('worldmap'); await page.waitForTimeout(600);
await page.locator('.card', { hasText: 'The Quiet Crossing' }).click();
await waitScene('dungeon'); await page.waitForTimeout(900); await clearDlg();
await press('ArrowDown', 4);
for (let i = 0; i < 8 && (await scene()) === 'dungeon'; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(320); if (await dlg()) await clearDlg(); }
await waitScene('battle', 20000);

// Clear the intro, then click Run whenever the menu is up (snapshotting the menu
// the first time it appears) until we escape. The menu can take a while to open
// under software GL, so this drives off the live menu rather than a fixed wait.
let items = [];
for (let i = 0; i < 50 && (await scene()) === 'battle'; i++) {
  if (await dlg()) { await page.keyboard.press('Enter'); await page.waitForTimeout(250); continue; }
  const run = page.locator('#action-menu .menu li', { hasText: /^Run$/ });
  if (await run.count()) {
    if (!items.length) items = await menuItems();
    await run.click(); await page.waitForTimeout(500);
  } else {
    await page.waitForTimeout(300);
  }
}
await page.waitForTimeout(600);
const escaped = (await scene()) === 'dungeon';
console.log('menu items         :', JSON.stringify(items));
console.log('Run offered        :', items.includes('Run'));
console.log('fled to dungeon    :', escaped);
// A flee is not a win: the scripted fight event stays unconsumed.
const eventUnused = await page.evaluate(() => ![...window.hd2dGame.game.usedEvents].some((e) => e.includes('crossing-1:2')));
console.log('fight not consumed :', eventUnused);

// A successful flee (dungeon, event not consumed) is itself proof Run was
// offered and works; the menu scrape above is informational only (it can miss
// the open menu under software-GL timing).
const ok = escaped && eventUnused;
console.log('\nFLEE OK :', ok);
console.log('ERRORS:', errs.length ? errs.join('\n') : '(none)');
await browser.close();
process.exit(ok && !errs.length ? 0 : 1);
