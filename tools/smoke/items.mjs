import { chromium } from 'playwright';

// Items menu smoke test, against the built bundle via window.hd2dGame:
//   1. The main menu offers an 'Items' card that opens the bag screen.
//   2. A Mending Balm heals the chosen soul and is consumed (count drops).
//   3. A Light Shard refills the lantern and is consumed.
//   4. A no-effect item (Homing Ember) is shown but disabled (not usable).

const browser = await chromium.launch({
  executablePath: process.env.CHROME,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
const errs = [];
page.on('pageerror', (e) => errs.push('[pageerror] ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errs.push('[console] ' + m.text()); });

const scene = () => page.evaluate(() => window.hd2dGame.manager.current);
const dlg = () => page.evaluate(() => { const d = document.querySelector('#dialogue'); return !!d && d.style.display !== 'none'; });
const waitScene = async (n, ms = 30000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await scene()) === n) return true; await page.waitForTimeout(200); } return false; };
const waitSel = async (sel, ms = 6000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await page.locator(sel).count()) return true; await page.waitForTimeout(150); } return false; };

await page.goto(process.env.URL ?? 'http://localhost:4173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.evaluate(() => { const g = window.hd2dGame, p = g.hd2d.params; p.supersample = 0.4; p.dofEnabled = false; p.bloomEnabled = false; g.hd2d.applyParams(); });

// Lost Souls title: dismiss the "press any button" splash so the menu is reachable.
await page.waitForSelector('.title-press', { timeout: 4000 }).catch(() => {});
if (await page.locator('.title-press').count()) { await page.keyboard.press('Enter'); await page.waitForTimeout(300); }
await page.keyboard.press('Enter'); await page.waitForTimeout(700);
await page.locator('.keyboard button', { hasText: /^OK$/ }).click(); await page.waitForTimeout(600);
for (let i = 0; i < 40; i++) { if (await page.locator('.card', { hasText: 'Emberling' }).count()) break; await page.keyboard.press('Enter'); /* press through the prologue cutscene */ await page.waitForTimeout(200); }
await page.locator('.card', { hasText: 'Emberling' }).click();
await waitScene('hub'); await page.waitForTimeout(500); for (let i = 0; i < 20; i++) { if (await dlg()) await page.keyboard.press('Enter'); await page.waitForTimeout(120); }

const results = [];
const check = (name, cond, extra = '') => { results.push({ name, ok: !!cond, extra }); };

// Stock the bag, hurt the lead soul, and dim the lantern so every item does something.
const setup = await page.evaluate(() => {
  const g = window.hd2dGame;
  g.game.addItem('mendingBalm'); g.game.addItem('focusDraught'); g.game.addItem('lightShard'); g.game.addItem('homingEmber');
  const c = g.game.party[0]; c.hp = Math.max(1, Math.floor(c.maxHp / 2));
  g.game.light = Math.max(0, g.game.maxLight - 40);
  return { uid: c.uid, hp: c.hp, maxHp: c.maxHp, light: g.game.light, maxLight: g.game.maxLight };
});

// Open the main menu (E), clearing any lingering arrival dialogue and retrying
// until the grid appears (the hub's opening lines can still be up).
let menuOpen = false;
for (let i = 0; i < 12 && !menuOpen; i++) {
  if (await dlg()) { await page.keyboard.press('Enter'); await page.waitForTimeout(150); continue; }
  await page.keyboard.press('e'); await page.waitForTimeout(400);
  menuOpen = await waitSel('.grid-menu', 1500);
}
const hasItemsCard = await page.locator('.grid-card', { hasText: 'Items' }).count();
check('main menu offers an Items card', menuOpen && hasItemsCard);
await page.locator('.grid-card', { hasText: 'Items' }).click(); await page.waitForTimeout(400);
await page.mouse.move(0, 0);
const itemsOpen = await waitSel('#items-screen', 4000);
check('Items card opens the bag screen', itemsOpen);

// The no-effect Homing Ember is listed but disabled.
const emberDisabled = await page.evaluate(() => {
  const li = [...document.querySelectorAll('#items-screen .menu li')].find((n) => /Homing Ember/.test(n.textContent || ''));
  return !!li && li.getAttribute('aria-disabled') === 'true';
});
check('a no-effect item (Homing Ember) is shown but disabled', emberDisabled);

// Use the Mending Balm (top of the list by price) on the lead soul.
await page.locator('#items-screen .menu li', { hasText: 'Mending Balm' }).click(); await page.waitForTimeout(300);
await waitSel('#items-screen .menu li'); // target list now showing party
await page.locator('#items-screen .menu li').first().click(); await page.waitForTimeout(300);
const afterHeal = await page.evaluate((uid) => {
  const g = window.hd2dGame; const c = g.game.party.find((m) => m.uid === uid);
  return { hp: c.hp, balm: g.game.itemCount('mendingBalm') };
}, setup.uid);
check('Mending Balm heals the soul', afterHeal.hp > setup.hp, `${setup.hp} -> ${afterHeal.hp}`);
check('Mending Balm is consumed', afterHeal.balm === 0, `count=${afterHeal.balm}`);

// Use the Light Shard — refills the lantern, no target needed.
await page.locator('#items-screen .menu li', { hasText: 'Light Shard' }).click(); await page.waitForTimeout(300);
const afterLight = await page.evaluate(() => {
  const g = window.hd2dGame; return { light: g.game.light, shard: g.game.itemCount('lightShard') };
});
check('Light Shard refills the lantern', afterLight.light > setup.light, `${setup.light} -> ${afterLight.light}`);
check('Light Shard is consumed', afterLight.shard === 0, `count=${afterLight.shard}`);

// --- report ---
let pass = errs.length === 0;
for (const r of results) { if (!r.ok) pass = false; console.log(`${r.ok ? 'ok  ' : 'FAIL'}  ${r.name}${r.extra ? '   [' + r.extra + ']' : ''}`); }
for (const e of errs) console.log(e);
console.log(`\nVERDICT: ${pass ? 'PASS' : 'FAIL'}`);
await browser.close();
process.exit(pass ? 0 : 1);
