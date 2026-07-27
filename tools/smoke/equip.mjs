import { chromium } from 'playwright';

// Equipment: the keeper's kit is granted at the start, and the Gear screen fits
// an item into a soul's slot (moving it out of the bag). Verifies via the live
// game state after driving the real menu → Gear → member → slot → item flow.
// See tools/smoke/README.md.

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
const wait = async (n, ms = 30000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await scene()) === n) return true; await page.waitForTimeout(200); } return false; };
const bag = () => page.evaluate(() => ({ ...window.hd2dGame.game.bag }));
const equip0 = () => page.evaluate(() => ({ ...(window.hd2dGame.game.party[0].equip ?? {}) }));
const menuHas = (label) => page.evaluate((l) => [...document.querySelectorAll('#action-menu .menu li, .menu li')].some((n) => n.textContent.includes(l)), label);
const clickMenu = async (label) => { const loc = page.locator('.menu li', { hasText: label }).first(); if (await loc.count()) { await loc.click(); await page.waitForTimeout(300); return true; } return false; };

await page.goto(process.env.URL ?? 'http://localhost:4173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.evaluate(() => { const g = window.hd2dGame, p = g.hd2d.params; p.supersample = 0.4; p.dofEnabled = false; p.bloomEnabled = false; g.hd2d.applyParams(); });

await page.keyboard.press('Enter'); await page.waitForTimeout(700);
await page.locator('.keyboard button', { hasText: /^OK$/ }).click(); await page.waitForTimeout(600);
for (let i = 0; i < 40; i++) { if (await page.locator('.card', { hasText: 'Emberling' }).count()) break; if (await dlg()) await page.keyboard.press('Enter'); await page.waitForTimeout(200); }
await page.locator('.card', { hasText: 'Emberling' }).click();
for (let i = 0; i < 40; i++) { if ((await scene()) === 'hub') break; if (await dlg()) await page.keyboard.press('Enter'); await page.waitForTimeout(200); }
await wait('hub'); await page.waitForTimeout(500);
for (let i = 0; i < 20; i++) { if (await dlg()) await page.keyboard.press('Enter'); await page.waitForTimeout(120); }

const kit = await bag();
console.log('keeper kit in bag  :', JSON.stringify(kit));
const hasKit = kit.cinderEdge > 0 && kit.paleShroud > 0 && kit.quickLocket > 0;

// Open menu (E), move to Gear (right of Party), open it.
await page.keyboard.press('e'); await page.waitForTimeout(400);
await page.locator('.grid-card', { hasText: 'Gear' }).click(); await page.waitForTimeout(500);
// Member list → pick the first soul.
await clickMenu('Emberling');
// Slot list → Arms.
await clickMenu('Arms');
// Item list → Cinder Edge.
const equipped = await clickMenu('Cinder Edge');
await page.waitForTimeout(300);

const eq = await equip0();
const bagAfter = await bag();
console.log('party[0].equip     :', JSON.stringify(eq));
console.log('bag after equip    :', JSON.stringify(bagAfter));
const armsSet = eq.arms === 'cinderEdge';
const bagSpent = !(bagAfter.cinderEdge > 0);

console.log('kit granted        :', hasKit);
console.log('equip flow ran     :', equipped);
console.log('arms slot fitted   :', armsSet);
console.log('item left the bag  :', bagSpent);

const ok = hasKit && armsSet && bagSpent;
console.log('\nEQUIP OK :', ok);
console.log('ERRORS:', errs.length ? errs.join('\n') : '(none)');
await browser.close();
process.exit(ok && !errs.length ? 0 : 1);
