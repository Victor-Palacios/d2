import { chromium } from 'playwright';
const OUT = process.env.OUT ?? new URL('./shots', import.meta.url).pathname;

// Main grid menu (opened by R1 / E / Start) and party reordering ("move monster
// positions"). Verifies the grid entries render and that grab-and-move reorders
// the fielded party. See tools/smoke/README.md.

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

// Party is the first card — open it, grab the top soul, move it down, drop.
await page.keyboard.press('Enter'); await page.waitForTimeout(500); // open Party
await page.screenshot({ path: `${OUT}/menu-party.png` });
await page.keyboard.press('Enter'); await page.waitForTimeout(250);   // grab party[0]
await page.keyboard.press('ArrowDown'); await page.waitForTimeout(250); // move it to slot 2
await page.keyboard.press('Enter'); await page.waitForTimeout(250);   // drop
const after = await party();
console.log('party after move   :', JSON.stringify(after));
const reordered = before.length === after.length && before[0] === after[1] && after[0] === before[1];

await page.keyboard.press('Escape'); await page.waitForTimeout(200); // close party
await page.keyboard.press('Escape'); await page.waitForTimeout(200); // close menu

console.log('grid has 3 entries :', hasEntries);
console.log('reorder works      :', reordered);
const ok = hasEntries && reordered;
console.log('\nMENU OK :', ok);
console.log('ERRORS:', errs.length ? errs.join('\n') : '(none)');
await browser.close();
process.exit(ok && !errs.length ? 0 : 1);
