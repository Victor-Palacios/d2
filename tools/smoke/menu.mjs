import { chromium } from 'playwright';
const OUT = process.env.OUT ?? new URL('./shots', import.meta.url).pathname;

// Main grid menu (opened by R1 / E / Start) and the formation editor. Verifies
// the grid entries render and that grab-and-move on the 2×3 formation grid
// repositions a fielded soul (front → Rear row). See tools/smoke/README.md.

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
const cards = () => page.evaluate(() => [...document.querySelectorAll('.grid-card .grid-text b')].map((n) => n.textContent));
const party = () => page.evaluate(() => window.hd2dGame.game.party.map((c) => c.speciesId));
const formation = () => page.evaluate(() => window.hd2dGame.game.formation.map((c) => ({ ...c })));

await page.goto(process.env.URL ?? 'http://localhost:4173/', { waitUntil: 'networkidle' });
// Lost Souls title: wait for and dismiss the "press any button" splash so the menu is reachable.
await page.waitForSelector('.title-press', { timeout: 4000 }).catch(() => {});
if (await page.locator('.title-press').count()) { await page.keyboard.press('Enter'); await page.waitForTimeout(300); }
await page.waitForTimeout(1500);
await page.evaluate(() => { const g = window.hd2dGame, p = g.hd2d.params; p.supersample = 0.4; p.dofEnabled = false; p.bloomEnabled = false; g.hd2d.applyParams(); });

await page.keyboard.press('Enter'); await page.waitForTimeout(700);
await page.locator('.keyboard button', { hasText: /^OK$/ }).click(); await page.waitForTimeout(600);
for (let i = 0; i < 40; i++) { if (await page.locator('.card', { hasText: 'Emberling' }).count()) break; if (await dlg()) await page.keyboard.press('Enter'); await page.waitForTimeout(200); }
await page.locator('.card', { hasText: 'Emberling' }).click();
for (let i = 0; i < 40; i++) { if ((await scene()) === 'hub') break; if (await dlg()) await page.keyboard.press('Enter'); await page.waitForTimeout(200); }
await wait('hub'); await page.waitForTimeout(500);
for (let i = 0; i < 20; i++) { if (await dlg()) await page.keyboard.press('Enter'); await page.waitForTimeout(120); }

// Give the party three members so reordering is meaningful.
await page.evaluate(() => { const g = window.hd2dGame;
  ['sprigling', 'cogling'].forEach((id) => g.game.addMonster(JSON.parse(JSON.stringify({ ...g.game.party[0], uid: 'x' + id, speciesId: id, name: id })))); });
const before = await party();
console.log('party before       :', JSON.stringify(before));

// Open the main menu (E maps to the same 'menu' action Start fires on a pad).
await page.keyboard.press('e'); await page.waitForTimeout(500);
const entries = await cards();
console.log('grid menu entries  :', JSON.stringify(entries));
await page.screenshot({ path: `${OUT}/menu-grid.png` });
const hasEntries = ['Party', 'Soularium', 'Sanctuary'].every((e) => entries.includes(e));

// Open the formation grid via the Party card (clicked directly — the default
// selection can be shifted by a stray mouse-hover), then park the mouse; the
// grid is keyboard-only. The cursor starts on the front-centre soul; grab it,
// move down onto the Rear row, and drop.
await page.locator('.grid-card', { hasText: 'Party' }).click(); await page.waitForTimeout(500);
await page.mouse.move(0, 0);
await page.screenshot({ path: `${OUT}/menu-party.png` });
const formBefore = await formation();
console.log('formation before   :', JSON.stringify(formBefore));
await page.keyboard.press('Enter'); await page.waitForTimeout(250);   // grab front-centre soul
await page.keyboard.press('ArrowDown'); await page.waitForTimeout(250); // move it to the Rear row
await page.keyboard.press('Enter'); await page.waitForTimeout(250);   // drop
const formAfter = await formation();
const after = await party();
console.log('formation after    :', JSON.stringify(formAfter));
// The move edits the formation (front → Rear), not the party order.
const repositioned = formBefore[0].row === 0 && formAfter[0].row === 1;
const orderIntact = before.length === after.length && before.every((s, i) => s === after[i]);

await page.keyboard.press('Escape'); await page.waitForTimeout(200); // close party
await page.keyboard.press('Escape'); await page.waitForTimeout(200); // close menu

console.log('grid has 3 entries :', hasEntries);
console.log('reposition works   :', repositioned);
console.log('party order intact :', orderIntact);
const ok = hasEntries && repositioned && orderIntact;
console.log('\nMENU OK :', ok);
console.log('ERRORS:', errs.length ? errs.join('\n') : '(none)');
await browser.close();
process.exit(ok && !errs.length ? 0 : 1);
