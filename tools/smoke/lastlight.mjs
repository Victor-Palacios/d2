import { chromium } from 'playwright';

// The Last Light: a grief encounter resolved with the Grief commands, not
// combat. Comfort then Let Go releases it (100% once comforted), granting a
// huge EXP boon and the next Immortality poem piece; twelve pieces unlock the
// Immortality Memento. See tools/smoke/README.md and docs/NARRATIVE.md §6.

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
const clickGrief = async (label, ms = 12000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const loc = page.locator('#action-menu .menu li', { hasText: label });
    if (await loc.count()) { await loc.first().click(); return true; }
    await page.waitForTimeout(250);
  }
  return false;
};

await page.goto(process.env.URL ?? 'http://localhost:4173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.evaluate(() => { const g = window.hd2dGame, p = g.hd2d.params; p.supersample = 0.4; p.dofEnabled = false; p.bloomEnabled = false; g.hd2d.applyParams(); });

await page.keyboard.press('Enter'); await page.waitForTimeout(700);
await page.locator('.keyboard button', { hasText: /^OK$/ }).click(); await page.waitForTimeout(600);
for (let i = 0; i < 40; i++) { if (await page.locator('.card', { hasText: 'Emberling' }).count()) break; if (await dlg()) await page.keyboard.press('Enter'); await page.waitForTimeout(200); }
await page.locator('.card', { hasText: 'Emberling' }).click();
for (let i = 0; i < 40; i++) { if ((await scene()) === 'hub') break; if (await dlg()) await page.keyboard.press('Enter'); await page.waitForTimeout(200); }
await wait('hub'); await page.waitForTimeout(400);

const beforeLv = await page.evaluate(() => window.hd2dGame.game.party[0].level);
console.log('party[0] level     :', beforeLv, '| immortality before:', await page.evaluate(() => window.hd2dGame.game.immortality));

// Force a Last Light encounter (a rare random in The Unremembered), returning to the hub.
await page.evaluate(async () => {
  const g = window.hd2dGame;
  g.game.activeDomainId = 'boot';
  await g.manager.go('battle', { enemies: [{ species: 'lastlight', level: 8 }], returnTo: 'hub' });
});
console.log('reached battle     :', await wait('battle', 15000));
await page.waitForTimeout(1500);

// Comfort it (sets the "comforted" gate), then Let Go (100% once comforted).
// Menu rows carry a note, so match the label as a substring.
console.log('comforted          :', await clickGrief('Comfort'));
await page.waitForTimeout(1800);
console.log('let go              :', await clickGrief('Let Go'));
await wait('hub', 20000); await page.waitForTimeout(600);

const after = await page.evaluate(() => ({
  immortality: window.hd2dGame.game.immortality,
  level: window.hd2dGame.game.party[0].level,
}));
console.log('immortality after  :', after.immortality, '| party[0] level:', after.level);
const gotPiece = after.immortality >= 1;
const boon = after.level > beforeLv;

// The set completes at twelve pieces, unlocking the Immortality Memento.
const memento = await page.evaluate(() => {
  const g = window.hd2dGame;
  while (g.game.immortality < 12) g.game.grantImmortalityPiece();
  return g.game.bag.immortalityMemento > 0;
});
console.log('piece granted      :', gotPiece);
console.log('huge EXP boon      :', boon);
console.log('memento at 12/12   :', memento);

const ok = gotPiece && boon && memento;
console.log('\nLAST LIGHT OK :', ok);
console.log('ERRORS:', errs.length ? errs.join('\n') : '(none)');
await browser.close();
process.exit(ok && !errs.length ? 0 : 1);
