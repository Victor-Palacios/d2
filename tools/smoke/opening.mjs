import { chromium } from 'playwright';

// Reworked opening: choose a partner right after New Game (no borrowed trio),
// The Quiet Crossing enemies are Lv1, battle fields at most 3 monsters, and a low-level
// party can clear it (including the Lv3 warden). See tools/smoke/README.md.

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
const party = () => page.evaluate(() => window.hd2dGame.game.party.map((c) => `${c.speciesId} L${c.level}`));
const fielded = () => page.evaluate(() => window.hd2dGame.manager.activeScene?.battle?.side('party').length ?? null);
const clearDlg = async (m = 60) => { for (let i = 0; i < m; i++) { if (!(await dlg())) return; await page.keyboard.press('Enter'); await page.waitForTimeout(150); } };
const waitScene = async (n, ms = 40000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await scene()) === n) return true; await page.waitForTimeout(200); } return false; };
const press = async (k, n = 1, gap = 300) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await page.waitForTimeout(gap); } };
const winBattle = async (ms = 90000) => { const t0 = Date.now(); let sawBattle = false;
  while (Date.now() - t0 < ms && (await scene()) !== 'battle') { await page.keyboard.press('Enter'); await page.waitForTimeout(200); }
  while (Date.now() - t0 < ms && (await scene()) === 'battle') { sawBattle = true; await page.keyboard.press('Enter'); await page.waitForTimeout(320); }
  // A run that never entered battle is not a win — guard against silent false positives.
  return sawBattle && (await scene()) === 'dungeon'; };

await page.goto(process.env.URL ?? 'http://localhost:4195/', { waitUntil: 'networkidle' });
// Lost Souls title: wait for and dismiss the "press any button" splash so the menu is reachable.
await page.waitForSelector('.title-press', { timeout: 4000 }).catch(() => {});
if (await page.locator('.title-press').count()) { await page.keyboard.press('Enter'); await page.waitForTimeout(300); }
await page.waitForTimeout(1500);
await page.evaluate(() => { const g = window.hd2dGame; const p = g.hd2d.params;
  p.supersample = 0.35; p.dofEnabled = false; p.tiltEnabled = false; p.bloomEnabled = false;
  g.hd2d.renderer.shadowMap.enabled = false; g.hd2d.applyParams(); });
await page.waitForTimeout(1200);

// New Game -> name -> prologue -> CHOOSE YOUR PARTNER
await page.keyboard.press('Enter'); await page.waitForTimeout(800);
await page.locator('.keyboard button', { hasText: /^OK$/ }).click(); await page.waitForTimeout(600);
for (let i = 0; i < 40; i++) { if (await page.locator('.card', { hasText: 'Emberling' }).count()) break; if (await dlg()) await page.keyboard.press('Enter'); await page.waitForTimeout(200); }
const cards = await page.evaluate(() => [...document.querySelectorAll('.card h3')].map((n) => n.textContent));
console.log('partner cards :', JSON.stringify(cards));
await page.locator('.card', { hasText: 'Emberling' }).click();
await clearDlg(); await waitScene('hub'); await page.waitForTimeout(600); await clearDlg();

const p0 = await party();
console.log('starting party :', JSON.stringify(p0), '| single Lv1 partner =', p0.length === 1 && p0[0] === 'emberling L1');

// Inflate the party to test the 3-on-screen cap.
await page.evaluate(() => {
  const g = window.hd2dGame;
  ['sprigling', 'cogling', 'dropletta', 'mitebug'].forEach((id) => g.game.addMonster(
    // makeCreature isn't exposed; summon via captureSpecies path is overkill — push minimal clones.
    JSON.parse(JSON.stringify({ ...g.game.party[0], uid: 'x' + id + Math.floor(g.game.party.length), speciesId: id, name: id }))));
});
console.log('party size now :', (await party()).length);

// The Quiet Crossing floor 1 -> walk down into the scripted fight.
await press('ArrowDown', 5); await press('ArrowLeft', 3); await press('ArrowDown', 2);
await waitScene('worldmap'); await page.waitForTimeout(600);
await page.locator('.card', { hasText: 'The Quiet Crossing' }).click();
await waitScene('dungeon'); await page.waitForTimeout(900); await clearDlg();
// Cross the gateway: a radio tip fires, then the first fight is forced.
await press('ArrowDown', 4);
for (let i = 0; i < 8 && (await scene()) === 'dungeon'; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(320); if (await dlg()) await clearDlg(); }
await waitScene('battle', 20000); await page.waitForTimeout(800);
console.log('fielded in battle :', await fielded(), '| capped at 3 =', (await fielded()) === 3);
console.log('floor-1 fight won (Lv1 enemies) :', await winBattle());
await waitScene('dungeon'); await page.waitForTimeout(400); await clearDlg();
const xp = await page.evaluate(() => window.hd2dGame.game.party.slice(0, 3).map((c) => `${c.speciesId} L${c.level} xp${c.xp}`));
console.log('party XP after fight :', JSON.stringify(xp), '| gained XP =', xp.some((s) => !s.endsWith('xp0')));

// Boss winnability at low level: a realistic small party, no god-mode boost.
await page.evaluate(() => {
  const g = window.hd2dGame; const base = JSON.parse(JSON.stringify(g.game.party[0]));
  g.game.party = [
    { ...base, uid: 'b1', speciesId: 'emberling', name: 'Emberling', level: 1 },
    { ...base, uid: 'b2', speciesId: 'nightnip', name: 'Nightnip', level: 1 },
    { ...base, uid: 'b3', speciesId: 'glidefang', name: 'Glidefang', level: 1 },
  ];
  g.game.floorIndex = 2; g.game.crawl.initialized = false;
});
await page.evaluate(async () => { await window.hd2dGame.manager.go('dungeon'); });
await waitScene('dungeon'); await page.waitForTimeout(800); await clearDlg();
// Warden Hall: spawn at (7,11); the inner room's only gap is at x=8, so step
// right first, then climb up through the warning tile into the boss.
await press('ArrowRight', 1);
for (let i = 0; i < 6 && (await scene()) === 'dungeon'; i++) { await page.keyboard.press('ArrowUp'); await page.waitForTimeout(340); if (await dlg()) await clearDlg(); }
console.log('boss (regalion Lv2) beaten by Lv1 party (Attack-only) :', await winBattle(120000));
await waitScene('dungeon'); await page.waitForTimeout(500); await clearDlg();
const afterBoss = await page.evaluate(() => window.hd2dGame.game.party.map((c) => `${c.speciesId} L${c.level} xp${c.xp}`));
console.log('party after boss :', JSON.stringify(afterBoss), '| leveled up =', afterBoss.some((s) => !/ L1 /.test(` ${s} `)));

console.log('\nERRORS:', errs.length ? errs.join('\n') : '(none)');
await browser.close();
