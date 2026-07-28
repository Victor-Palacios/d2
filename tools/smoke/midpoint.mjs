import { chromium } from 'playwright';

// The midpoint (Act II): with all three reaches cleared, returning to the
// Everwake triggers the unanswerable death — Halden dies, the Keeping cannot
// hold him, the player authors what is preserved, and every philosophy hardens.
// Fires exactly once. See docs/NARRATIVE.md §9-11 and the design framework §11.

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
  midpoint: g.has('midpointDone'), halden: g.has('haldenGone'), mournWork: g.has('mourn:work'),
  actTwo: g.has('actTwo'), serial: g.bag.haldensSerial || 0 }; });

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

// Clear all three reaches and step back into the Everwake to trigger the beat.
await page.evaluate(async () => {
  const g = window.hd2dGame;
  ['crossingCleared', 'crystalCleared', 'hauntedCleared'].forEach((f) => g.game.set(f));
  await g.manager.go('hub', {});
});

// Advance the death dialogue until the farewell choice appears; pick "His work".
let chose = false;
for (let i = 0; i < 80; i++) {
  const work = page.locator('.menu li', { hasText: 'His work' });
  if (await work.count()) { await work.click(); chose = true; break; }
  await page.keyboard.press('Enter'); await page.waitForTimeout(220);
}
// Finish the hardening dialogue — keep advancing until Act II is set (there is
// a brief gap between dialogue blocks, so poll the flag rather than `dlg()`).
for (let i = 0; i < 70; i++) { if ((await flags()).actTwo) break; if (await dlg()) await page.keyboard.press('Enter'); await page.waitForTimeout(230); }
await page.waitForTimeout(500);

const after = await flags();
console.log('farewell chosen    :', chose);
console.log('flags after        :', JSON.stringify(after));

// Re-enter the Everwake: the midpoint must NOT fire again.
await page.evaluate(async () => { await window.hd2dGame.manager.go('hub', {}); });
await page.waitForTimeout(800);
const refired = await page.evaluate(() => !!document.querySelector('.menu li'));
const after2 = await flags();
console.log('fires only once    :', !refired && after2.serial === after.serial);

const ok = chose && after.midpoint && after.halden && after.mournWork && after.actTwo &&
  after.serial === 1 && !refired && after2.serial === 1;
console.log('\nMIDPOINT OK :', ok);
console.log('ERRORS:', errs.length ? errs.join('\n') : '(none)');
await browser.close();
process.exit(ok && !errs.length ? 0 : 1);
