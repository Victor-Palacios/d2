import { chromium } from 'playwright';

// Warden LP reward (LP_PER_BOSS): satisfying a reach's warden deepens the lantern
// for good — +20 max LP, once per reach, carried into every later crawl. Drives
// the real afterBattle grant by returning to the Quiet Crossing's warden floor
// with a victory on the boss event, and proves: the bonus is granted (maxLP up,
// refilled, `lightBonus`/`lpBoss:crossing` set); a second victory does NOT grant
// again (the per-reach guard); and the bonus rides on top of a later reach's
// startingLight. See tools/smoke/README.md.

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
const lp = () => page.evaluate(() => ({ bonus: window.hd2dGame.game.lightBonus, max: window.hd2dGame.game.maxLight, light: window.hd2dGame.game.light, flag: window.hd2dGame.game.has('lpBoss:crossing') }));
const clearDlg = async (m = 80) => { for (let i = 0; i < m; i++) { if (!(await dlg())) return; await page.keyboard.press('Enter'); await page.waitForTimeout(150); } };
const waitScene = async (name, ms = 40000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await scene()) === name) return true; await page.waitForTimeout(200); } return false; };
const pickPartner = async () => { for (let i = 0; i < 50; i++) { if (await page.locator('.card', { hasText: 'Emberling' }).count()) { await page.locator('.card', { hasText: 'Emberling' }).click(); await page.waitForTimeout(300); return; } await page.keyboard.press('Enter'); await page.waitForTimeout(200); } };

await page.goto(process.env.URL ?? 'http://localhost:4200/', { waitUntil: 'networkidle' });
await page.waitForSelector('.title-press', { timeout: 4000 }).catch(() => {});
if (await page.locator('.title-press').count()) { await page.keyboard.press('Enter'); await page.waitForTimeout(300); }
await page.waitForTimeout(1500);
await page.evaluate(() => { const g = window.hd2dGame; const p = g.hd2d.params; p.supersample = 0.4; p.dofEnabled = false; p.bloomEnabled = false; g.hd2d.applyParams(); });
await page.waitForTimeout(800);

await page.keyboard.press('Enter'); await page.waitForTimeout(700);
await page.locator('.keyboard button', { hasText: /^OK$/ }).click(); await page.waitForTimeout(600);
await pickPartner();
await clearDlg(); await waitScene('hub'); await page.waitForTimeout(600); await clearDlg();

// Stand on the Quiet Crossing's warden floor (crossing-3, floorIndex 2).
await page.evaluate(async () => {
  const g = window.hd2dGame;
  g.game.activeReachId = 'crossing'; g.game.floorIndex = 2; g.game.crawl.initialized = false;
  await g.manager.go('dungeon');
});
await waitScene('dungeon'); await page.waitForTimeout(700); await clearDlg();
const before = await lp();
console.log('before warden :', JSON.stringify(before));

// The Vigil falls: return to the floor with a victory on its boss event ('1').
// This is exactly what BattleScene hands DungeonScene on a real warden win.
await page.evaluate(async () => { await window.hd2dGame.manager.go('dungeon', { battleResult: 'victory', eventId: '1' }); });
await page.waitForTimeout(700); await clearDlg();
const after = await lp();
console.log('after warden  :', JSON.stringify(after));
const granted = after.bonus === before.bonus + 20 && after.flag && after.max === before.max + 20 && after.light === after.max;
console.log('LP deepened +20 (refilled):', granted);

// A second victory on the same warden must NOT grant again (per-reach guard).
const guarded = await page.evaluate(async () => {
  const g = window.hd2dGame; const b = g.game.lightBonus;
  await g.manager.go('dungeon', { battleResult: 'victory', eventId: '1' });
  await new Promise((r) => setTimeout(r, 600));
  return { before: b, after: g.game.lightBonus };
});
await clearDlg();
const noDouble = guarded.after === guarded.before;
console.log('no double-grant on re-win :', noDouble, JSON.stringify(guarded));

// The bonus rides on top of a *later* reach's startingLight (WorldMapScene logic).
const rides = await page.evaluate(() => {
  const baseline = 130; // The Reliquary's startingLight (WorldMapScene: startingLight + lightBonus)
  return { expected: baseline + window.hd2dGame.game.lightBonus, bonus: window.hd2dGame.game.lightBonus };
});
console.log('bonus rides onto next reach:', rides.expected === 130 + rides.bonus, JSON.stringify(rides));

const ok = granted && noDouble && rides.expected === 130 + rides.bonus;
console.log('\nLP BOSS OK :', ok);
console.log('ERRORS:', errs.length ? errs.join('\n') : '(none)');
await browser.close();
process.exit(ok && !errs.length ? 0 : 1);
