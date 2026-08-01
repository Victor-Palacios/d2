import { chromium } from 'playwright';

// Formation editor smoke test. Verifies, against the built bundle via
// window.hd2dGame:
//   1. The Party menu opens the new 2×3 formation grid (#party-arrange).
//   2. Grabbing the front-centre fighter and dropping it on the Rear row moves
//      that slot's formation cell to row 1 (a real reposition via the UI).
//   3. A battle launched afterwards deploys that fighter into the Rear cell,
//      proving the saved formation actually reaches combat.
//   4. Bench-swap: a reserve swapped onto the grid becomes fielded.
// Mirrors the direct-launch harness in mechanics.mjs.

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
const waitSel = async (sel, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await page.locator(sel).count()) return true; await page.waitForTimeout(150); } return false; };

await page.goto(process.env.URL ?? 'http://localhost:4173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.evaluate(() => { const g = window.hd2dGame; const p = g.hd2d.params;
  p.supersample = 0.35; p.dofEnabled = false; p.tiltEnabled = false; p.bloomEnabled = false;
  g.hd2d.renderer.shadowMap.enabled = false; g.hd2d.applyParams(); });
await page.waitForTimeout(1200);

// Lost Souls title: dismiss the "press any button" splash so the menu is reachable.
await page.waitForSelector('.title-press', { timeout: 4000 }).catch(() => {});
if (await page.locator('.title-press').count()) { await page.keyboard.press('Enter'); await page.waitForTimeout(300); }
// New Game -> name -> partner -> hub, then inflate past the fielded cap so a bench exists.
await page.keyboard.press('Enter'); await page.waitForTimeout(800);
await page.locator('.keyboard button', { hasText: /^OK$/ }).click(); await page.waitForTimeout(600);
for (let i = 0; i < 40; i++) { if (await page.locator('.card', { hasText: 'Emberling' }).count()) break; await page.keyboard.press('Enter'); /* press through the prologue cutscene */ await page.waitForTimeout(200); }
await page.locator('.card', { hasText: 'Emberling' }).click();
await clearDlg(); await waitScene('hub'); await page.waitForTimeout(600); await clearDlg();
await page.evaluate(() => { const g = window.hd2dGame;
  // Field cap = one soul per human keeper. Recruit two more companions so four
  // souls deploy (you + Wren + Sena + Kade), and raise the soul cap + add extras
  // so some souls sit on the bench (reserves) — that is what the editor swaps.
  g.game.partyCap = 8;
  ['senaVale', 'kade'].forEach((id, i) => g.game.joinCompanion(JSON.parse(JSON.stringify({ ...g.game.party[0], uid: 'k' + id, speciesId: id, name: id, companion: true }))));
  ['sprigling', 'cogling', 'dropletta', 'gloomote', 'mitebug'].forEach((id) => g.game.addMonster(JSON.parse(JSON.stringify({ ...g.game.party[0], uid: 'x' + id, speciesId: id, name: id })))); });
// Fielded count comes straight from the game so this test tracks the field cap.
const FIELDED = await page.evaluate(() => window.hd2dGame.game.fieldedCount());

const results = [];
const check = (name, cond, extra = '') => { results.push({ name, ok: !!cond, extra }); };

// --- 1. open the formation screen via the in-game menu (E = 'menu' action) ---
await page.keyboard.press('e'); await page.waitForTimeout(500);
const menuOpen = await waitSel('.grid-menu', 4000);
// Click the Party card directly (default selection can be shifted by a stray
// mouse-hover), then park the mouse — the formation grid is keyboard-only.
await page.locator('.grid-card', { hasText: 'Party' }).click(); await page.waitForTimeout(400);
await page.mouse.move(0, 0);
const gridOpen = await waitSel('#party-arrange .formation-grid', 4000);
check('formation grid opens from the Party menu', menuOpen && gridOpen);

const formation = () => page.evaluate(() => window.hd2dGame.game.formation.map((c) => ({ ...c })));
const before = await formation();
check('default formation puts the first three on the Vanguard', before.slice(0, 3).every((c) => c.row === 0), JSON.stringify(before));

// --- 2. grab the front-centre fighter (cursor starts at row0,col1) and drop it on the Rear ---
await page.keyboard.press('Enter'); await page.waitForTimeout(250); // grab slot 0
await page.keyboard.press('ArrowDown'); await page.waitForTimeout(250); // cursor -> row 1, col 1
await page.keyboard.press('Enter'); await page.waitForTimeout(250); // place
const after = await formation();
check('grabbing the front fighter and dropping on the Rear sets its cell to row 1', after[0].row === 1 && after[0].col === 1, JSON.stringify(after));

// --- 4. bench-swap: navigate to bench and swap the first reserve onto the grid ---
const fieldedBefore = await page.evaluate((n) => ( window.hd2dGame.game.souls().slice(0, n).map((c) => c.uid)), FIELDED);
// Cursor is at grid (1,1) after the place. Go down into the bench, grab reserve 0,
// then drop it onto an OCCUPIED grid cell (the Vanguard, row 0) to field it.
await page.keyboard.press('ArrowDown'); await page.waitForTimeout(200); // into bench
const inBench = await page.evaluate(() => !!document.querySelector('#party-arrange .bench-chip.sel'));
await page.keyboard.press('Enter'); await page.waitForTimeout(200);  // grab reserve
await page.keyboard.press('ArrowUp'); await page.waitForTimeout(200); // up to grid Rear (1,0)
await page.keyboard.press('ArrowUp'); await page.waitForTimeout(200); // up to grid Vanguard (0,0) — occupied
await page.keyboard.press('Enter'); await page.waitForTimeout(250);   // place -> swap the reserve in
const fieldedAfter = await page.evaluate((n) => ( window.hd2dGame.game.souls().slice(0, n).map((c) => c.uid)), FIELDED);
check('a reserve can be swapped onto the grid to become fielded', inBench && JSON.stringify(fieldedBefore) !== JSON.stringify(fieldedAfter), `${fieldedBefore} -> ${fieldedAfter}`);

// Close the screen and the menu.
await page.keyboard.press('x'); await page.waitForTimeout(250);
await page.keyboard.press('x'); await page.waitForTimeout(250);

// --- 3. launch a battle and confirm the fielded party deploys into the saved cells ---
const savedFormation = await formation();
await page.evaluate(() => {
  const g = window.hd2dGame;
  g.game.activeReachId = 'crossing';
  g.manager.go('battle', { enemies: [{ species: 'mitebug', level: 2 }], returnTo: 'hub' });
});
await waitScene('battle', 20000); await page.waitForTimeout(1200);
await clearDlg(); await page.waitForTimeout(400); await clearDlg();

const deployed = await page.evaluate(() =>
  window.hd2dGame.manager.activeScene.battle.side('party').map((b) => ({ slot: b.slot, row: b.cell.row, col: b.cell.col })));
const matches = deployed.every((d) => savedFormation[d.slot] && savedFormation[d.slot].row === d.row && savedFormation[d.slot].col === d.col);
const hasRear = deployed.some((d) => d.row === 1);
check('battlers deploy into the saved formation cells', matches, JSON.stringify(deployed));
check('at least one fighter deployed into the Rear row', hasRear, JSON.stringify(deployed));

// --- report ---
let pass = errs.length === 0;
for (const r of results) { if (!r.ok) pass = false; console.log(`${r.ok ? 'ok  ' : 'FAIL'}  ${r.name}${r.extra ? '   [' + r.extra + ']' : ''}`); }
for (const e of errs) console.log(e);
console.log(`\nVERDICT: ${pass ? 'PASS' : 'FAIL'}`);
await browser.close();
process.exit(pass ? 0 : 1);
