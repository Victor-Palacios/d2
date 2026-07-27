import { chromium } from 'playwright';

// Verifies the per-stage level recommendation on the world-map cards and the
// rebalanced progression curve (boot < crystal < haunted), reading the rendered
// cards and the loaded domain data — no fights, so it is fast and deterministic.
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

await page.goto(process.env.URL ?? 'http://localhost:4173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.evaluate(() => { const g = window.hd2dGame, p = g.hd2d.params; p.supersample = 0.4; p.dofEnabled = false; p.bloomEnabled = false; g.hd2d.applyParams(); });

// New Game -> name -> partner -> hub.
await page.keyboard.press('Enter'); await page.waitForTimeout(700);
await page.locator('.keyboard button', { hasText: /^OK$/ }).click(); await page.waitForTimeout(600);
for (let i = 0; i < 40; i++) { if (await page.locator('.card', { hasText: 'Emberling' }).count()) break; if (await dlg()) await page.keyboard.press('Enter'); await page.waitForTimeout(200); }
await page.locator('.card', { hasText: 'Emberling' }).click();
for (let i = 0; i < 40; i++) { if ((await scene()) === 'hub') break; if (await dlg()) await page.keyboard.press('Enter'); await page.waitForTimeout(200); }
await wait('hub'); await page.waitForTimeout(500);
for (let i = 0; i < 20; i++) { if (await dlg()) await page.keyboard.press('Enter'); await page.waitForTimeout(120); }

// Give the party a mid level so the readiness colours differ across stages.
await page.evaluate(() => window.hd2dGame.game.party.forEach((c) => (c.level = 5)));

// To the world map: press down toward the south portal until it opens.
for (let i = 0; i < 12 && (await scene()) !== 'worldmap'; i++) {
  await page.keyboard.press('ArrowDown'); await page.waitForTimeout(300);
  if (await dlg()) await page.keyboard.press('Enter');
}
console.log('reached worldmap   :', await wait('worldmap'));
await page.waitForTimeout(900);

const cards = await page.evaluate(() =>
  [...document.querySelectorAll('.card')].map((n) => ({
    title: n.querySelector('h3')?.textContent ?? '',
    body: n.querySelector('p')?.textContent ?? '',
    recColor: (() => { const s = n.querySelector('p span[style*="color"]'); return s ? s.getAttribute('style') : ''; })(),
  })),
);
for (const c of cards) console.log(`${c.title.padEnd(18)} | ${c.body}`);

const rec = (title) => { const c = cards.find((x) => x.title === title); const m = c && c.body.match(/Recommended Lv (\d+)/); return m ? Number(m[1]) : null; };
const boot = rec('The Quiet Crossing'), crystal = rec('Crystal Cavern'), haunted = rec('Haunted Dungeon');
console.log('\nrecommended levels :', JSON.stringify({ boot, crystal, haunted }));
const cityHasNoRec = !cards.find((x) => x.title === 'The Everwake')?.body.includes('Recommended');
console.log('city has no rec    :', cityHasNoRec);
const ordered = boot != null && crystal != null && haunted != null && boot < crystal && crystal < haunted;
console.log('progression rises  :', ordered, `(${boot} < ${crystal} < ${haunted})`);

const ok = ordered && boot === 1 && crystal === 5 && haunted === 10 && cityHasNoRec;
console.log('\nSTAGES OK :', ok);
console.log('ERRORS:', errs.length ? errs.join('\n') : '(none)');
await browser.close();
process.exit(ok && !errs.length ? 0 : 1);
