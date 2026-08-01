import { chromium } from 'playwright';

// Reserve EXP share: souls who sit a fight out still earn 25% of the EXP, with
// no level-up announcements, while companions (humans) earn nothing. Sets every
// soul to level 10 and fights one level-10 foe, so the fielded pair each bank a
// clean 80 EXP (< the ~379 to level, so no level-up muddies the delta) and the
// bench + Sanctuary souls bank exactly round(0.25 * 80) = 20. See BattleScene.

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

await page.goto(process.env.URL ?? 'http://localhost:4173/', { waitUntil: 'networkidle' });
await page.waitForSelector('.title-press', { timeout: 4000 }).catch(() => {});
if (await page.locator('.title-press').count()) { await page.keyboard.press('Enter'); await page.waitForTimeout(300); }
await page.waitForTimeout(1500);
await page.evaluate(() => { const g = window.hd2dGame; const p = g.hd2d.params;
  p.supersample = 0.35; p.dofEnabled = false; p.tiltEnabled = false; p.bloomEnabled = false;
  g.hd2d.renderer.shadowMap.enabled = false; g.hd2d.applyParams(); });

// New Game -> name -> partner -> hub (Wren joins; field cap = 2).
await page.keyboard.press('Enter'); await page.waitForTimeout(800);
await page.locator('.keyboard button', { hasText: /^OK$/ }).click(); await page.waitForTimeout(600);
// Advance the (long) opening narration until the partner cards appear, then pick
// Emberling. Break before pressing so we never confirm a card by accident.
const cardWait = Date.now();
while (Date.now() - cardWait < 30000) {
  if (await page.locator('.card', { hasText: 'Emberling' }).count()) break;
  if (await dlg()) await page.keyboard.press('Enter');
  await page.waitForTimeout(220);
}
await page.locator('.card', { hasText: 'Emberling' }).click();
await clearDlg(); await waitScene('hub'); await page.waitForTimeout(600); await clearDlg();

// Build the roster: two fielded souls (boosted to win), one bench reserve, one
// in the Sanctuary — all level 10, xp 0. Skip the melee tutorial.
await page.evaluate(() => {
  const g = window.hd2dGame.game;
  g.activeReachId = 'crossing';
  g.flags.add('tut.melee'); g.flags.add('tut.reaction'); g.flags.add('tut.breakChain'); g.flags.add('tut.commune');
  const base = g.party.find((c) => !c.companion);
  Object.assign(base, { level: 10, xp: 0, maxHp: 999, hp: 999, off: 999, name: 'FieldA' });
  const clone = (uid, name, boost) => {
    const c = JSON.parse(JSON.stringify({ ...base, uid, name }));
    c.level = 10; c.xp = 0;
    if (boost) { c.maxHp = 999; c.hp = 999; c.off = 999; } else { c.off = base.off - 900; }
    return c;
  };
  g.addMonster(clone('sB', 'FieldB', true));  // second fielded soul
  g.addMonster(clone('sC', 'BenchC', false)); // bench reserve (field cap is 2)
  g.sanctuary.push(clone('sD', 'VaultD', false)); // Sanctuary
});

const xpMap = () => page.evaluate(() => {
  const g = window.hd2dGame.game;
  const out = {};
  for (const c of [...g.party, ...g.sanctuary]) out[c.name] = { xp: c.xp, level: c.level, companion: !!c.companion };
  return out;
});
const before = await xpMap();
console.log('before:', JSON.stringify(before));

// Launch a one-foe fight (level 10) and win it by mashing Attack.
await page.evaluate(() => {
  window.hd2dGame.manager.go('battle', { enemies: [{ species: 'mitebug', level: 10 }], returnTo: 'hub' });
});
await waitScene('battle', 20000); await page.waitForTimeout(1000); await clearDlg();
for (let i = 0; i < 140 && (await scene()) === 'battle'; i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(300); }
await waitScene('hub', 20000); await page.waitForTimeout(500); await clearDlg();

const after = await xpMap();
console.log('after :', JSON.stringify(after));

const gain = (n) => (after[n]?.xp ?? 0) + 0 - (before[n]?.xp ?? 0);
// Field souls: full share (80 each). Bench + Sanctuary: 25% (20). Companion: 0.
const fieldA = gain('FieldA'), fieldB = gain('FieldB');
const benchC = gain('BenchC'), vaultD = gain('VaultD'), wren = gain('Wren');
console.log('field A / B gained :', fieldA, fieldB);
console.log('bench C gained     :', benchC, '(expect 25% of field)');
console.log('vault D gained     :', vaultD, '(expect 25% of field)');
console.log('Wren (human) gained:', wren, '(expect 0)');

const fielded = Math.max(fieldA, fieldB);
const quarter = Math.round(fielded * 0.25);
const ok =
  fielded > 0 &&
  benchC === quarter &&
  vaultD === quarter &&
  benchC > 0 &&
  wren === 0 &&
  after.FieldA.level === 10; // no surprise level-up in the measured window

console.log('\nRESERVE XP OK :', ok);
console.log('ERRORS:', errs.length ? errs.join('\n') : '(none)');
await browser.close();
process.exit(ok && !errs.length ? 0 : 1);
