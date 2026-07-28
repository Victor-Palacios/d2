import { chromium } from 'playwright';

// The Overgrowth's aftermath (a self-contained side-beat): clearing the jungle
// unroots the souls Liora Fen kept, and she follows the light to the Everwake
// to cross. Returning to the hub with `jungleCleared` set fires the beat once —
// the player names the truth of her keeping and she leaves a Memento (Liora's
// Step). It must NOT touch the main-line midpoint. See docs/NARRATIVE.md §11a.

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
const wait = async (n, ms = 30000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await scene()) === n) return true; await page.waitForTimeout(200); } return false; };
const flags = () => page.evaluate(() => { const g = window.hd2dGame.game; return {
  jungleCleared: g.has('jungleCleared'), wakeDone: g.has('jungleWakeDone'),
  mournKind: g.has('mourn:liora:kind'), mournTrue: g.has('mourn:liora:true'),
  midpoint: g.has('midpointDone'), step: g.bag.lioraStep || 0 }; });

await page.goto(process.env.URL ?? 'http://localhost:4173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.evaluate(() => { const g = window.hd2dGame, p = g.hd2d.params; p.supersample = 0.4; p.dofEnabled = false; p.bloomEnabled = false; g.hd2d.applyParams(); });

await page.keyboard.press('Enter'); await page.waitForTimeout(700);
await page.locator('.keyboard button', { hasText: /^OK$/ }).click(); await page.waitForTimeout(600);
for (let i = 0; i < 40; i++) { if (await page.locator('.card', { hasText: 'Emberling' }).count()) break; if (await dlg()) await page.keyboard.press('Enter'); await page.waitForTimeout(200); }
await page.locator('.card', { hasText: 'Emberling' }).click();
for (let i = 0; i < 40; i++) { if ((await scene()) === 'hub') break; if (await dlg()) await page.keyboard.press('Enter'); await page.waitForTimeout(200); }
await wait('hub'); await page.waitForTimeout(400);
for (let i = 0; i < 20; i++) { if (await dlg()) await page.keyboard.press('Enter'); await page.waitForTimeout(120); }

console.log('flags before       :', JSON.stringify(await flags()));

// Clear the Overgrowth and step back into the Everwake to trigger the beat.
await page.evaluate(async () => {
  const g = window.hd2dGame;
  g.game.set('jungleCleared');
  await g.manager.go('hub', {});
});

// Advance the aftermath until the farewell choice appears; pick "You were cruel"
// (the harder truth) so we also exercise the mourn:liora:true branch.
let chose = false;
for (let i = 0; i < 80; i++) {
  const cruel = page.locator('.menu li', { hasText: 'You were cruel' });
  if (await cruel.count()) { await cruel.click(); chose = true; break; }
  await page.keyboard.press('Enter'); await page.waitForTimeout(220);
}
// Finish the parting dialogue — keep advancing until the Memento is in the bag
// (there is a brief gap between blocks, so poll the bag rather than `dlg()`).
for (let i = 0; i < 60; i++) { if ((await flags()).step) break; if (await dlg()) await page.keyboard.press('Enter'); await page.waitForTimeout(230); }
await page.waitForTimeout(400);

const after = await flags();
console.log('farewell chosen    :', chose);
console.log('flags after        :', JSON.stringify(after));

// Re-enter the Everwake: the aftermath must NOT fire again, and must not have
// dragged the midpoint in with it.
await page.evaluate(async () => { await window.hd2dGame.manager.go('hub', {}); });
await page.waitForTimeout(800);
const refired = await page.evaluate(() => !!document.querySelector('.menu li'));
const after2 = await flags();
console.log('fires only once    :', !refired && after2.step === after.step);

const ok = chose && after.jungleCleared && after.wakeDone && after.mournTrue && !after.mournKind &&
  after.step === 1 && !after.midpoint && !refired && after2.step === 1 && !after2.midpoint;
console.log('\nJUNGLE AFTERMATH OK :', ok);
console.log('ERRORS:', errs.length ? errs.join('\n') : '(none)');
await browser.close();
process.exit(ok && !errs.length ? 0 : 1);
