import { chromium } from 'playwright';

// In-dungeon recruits (src/data/recruits.ts + the `recruit` FloorEvent). The
// cast is now met where their stories live: Sena Vale is met inside the Reliquary
// (a warden who blocks the way and tells you what she did) before you ever fight
// her; Kade — the 4th — is found deep in the Unremembered and joins you there in
// the dark, not back at the hub. Proves: the Sena meeting fires with her story;
// stepping onto Kade joins him (companion aboard, field cap up, `kadeJoined`).
// Both spots are reachable without a fight in the path. See tools/smoke/README.md.

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
const dlgText = () => page.evaluate(() => document.querySelector('#dialogue')?.textContent ?? '');
const tile = () => page.evaluate(() => { const s = window.hd2dGame.manager.activeScene; return s ? `${s.tileX},${s.tileZ}` : '?'; });
const party = () => page.evaluate(() => window.hd2dGame.game.party.map((c) => ({ id: c.speciesId, comp: !!c.companion })));
const fieldCap = () => page.evaluate(() => window.hd2dGame.game.fieldCap);
const flag = (f) => page.evaluate((f) => window.hd2dGame.game.has(f), f);
const press = async (k, n = 1, gap = 300) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await page.waitForTimeout(gap); } };
// Robust step: press until the tile actually changes (software rendering drops
// fast presses), or an event dialogue opens. Stops early on a dialogue/wall.
const step = async (k, n) => {
  for (let i = 0; i < n; i++) {
    const from = await tile();
    let moved = false;
    for (let t = 0; t < 25 && !moved; t++) {
      if (await dlg()) return;
      await page.keyboard.press(k); await page.waitForTimeout(220);
      moved = (await tile()) !== from;
    }
    if (!moved) return; // blocked (wall) — stop
  }
};
const clearDlg = async (m = 90) => { for (let i = 0; i < m; i++) { if (!(await dlg())) return; await page.keyboard.press('Enter'); await page.waitForTimeout(150); } };
const waitScene = async (name, ms = 40000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await scene()) === name) return true; await page.waitForTimeout(200); } return false; };
const pickPartner = async () => { for (let i = 0; i < 50; i++) { if (await page.locator('.card', { hasText: 'Emberling' }).count()) { await page.locator('.card', { hasText: 'Emberling' }).click(); await page.waitForTimeout(300); return; } await page.keyboard.press('Enter'); await page.waitForTimeout(200); } };
const goReach = (id, floor) => page.evaluate(async ({ id, floor }) => {
  const g = window.hd2dGame;
  g.game.activeReachId = id; g.game.floorIndex = floor; g.game.crawl.initialized = false;
  await g.manager.go('dungeon');
}, { id, floor });

await page.goto(process.env.URL ?? 'http://localhost:4201/', { waitUntil: 'networkidle' });
await page.waitForSelector('.title-press', { timeout: 4000 }).catch(() => {});
if (await page.locator('.title-press').count()) { await page.keyboard.press('Enter'); await page.waitForTimeout(300); }
await page.waitForTimeout(1500);
await page.evaluate(() => { const g = window.hd2dGame; const p = g.hd2d.params;
  p.supersample = 0.35; p.dofEnabled = false; p.tiltEnabled = false; p.bloomEnabled = false;
  g.hd2d.renderer.shadowMap.enabled = false; g.hd2d.applyParams(); });
await page.waitForTimeout(1000);

await page.keyboard.press('Enter'); await page.waitForTimeout(700);
await page.locator('.keyboard button', { hasText: /^OK$/ }).click(); await page.waitForTimeout(600);
await pickPartner();
await waitScene('hub');
// Wren joins during the first arrival — advance dialogue until she is aboard, so
// the field cap starts at 2 (you + Wren) as it would in a real run.
for (let i = 0; i < 90 && !(await party()).some((c) => c.id === 'wren'); i++) {
  if (await dlg()) await page.keyboard.press('Enter');
  await page.waitForTimeout(160);
}
console.log('Wren aboard at the Everwake  :', (await party()).some((c) => c.id === 'wren' && c.comp));

// Stop random encounters and make the party unkillable so navigation is clean.
const settle = async () => {
  await page.evaluate(() => {
    const g = window.hd2dGame; const s = g.manager.activeScene;
    if (s && s.floor) s.floor.encounterRate = 0;
    g.game.party.forEach((c) => { c.maxHp = 999; c.hp = 999; });
    g.game.light = g.game.maxLight = 999;
  });
};

// === Part A: meet Sena inside the Reliquary (crystal-1). ===
// S(3,2) -> right to (11,2) -> down to (11,4) -> left to the meeting tile (8,4).
await goReach('crystal', 0);
await waitScene('dungeon'); await page.waitForTimeout(700); await clearDlg(); await settle();
console.log('  crystal start tile        :', await tile());
await step('ArrowRight', 8); await step('ArrowDown', 2); await step('ArrowLeft', 3);
// The tile updates when a step begins; wait for arrive() to fire the meeting.
for (let i = 0; i < 30 && !(await dlg()) && !(await flag('evseen:crystal-1:4')); i++) await page.waitForTimeout(200);
const senaText = await dlgText();
const metSena = /Sena Vale/.test(senaText) || (await flag('evseen:crystal-1:4'));
console.log('meet Sena in the Reliquary  :', metSena, '| tile', await tile(), JSON.stringify(senaText.slice(0, 80)));
await clearDlg();

// === Part B: find and recruit Kade deep in the Unremembered (haunted-2). ===
// S(3,2) -> right to (8,2) -> down col 8 to (8,7) -> left to Kade at (5,7).
await goReach('haunted', 1);
await waitScene('dungeon'); await page.waitForTimeout(700); await clearDlg(); await settle();
const capBefore = await fieldCap();
console.log('field cap before Kade       :', capBefore, '| haunted start tile', await tile());
await step('ArrowRight', 5); await step('ArrowDown', 5); await step('ArrowLeft', 3);
console.log('  tile after nav            :', await tile(), '| dlg=', await dlg());
// Advance the recruit scene; the join lands as it finishes.
for (let i = 0; i < 60 && !(await flag('kadeJoined')); i++) {
  if (await dlg()) await page.keyboard.press('Enter');
  else await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(180);
}
const after = await party();
const capAfter = await fieldCap();
const joined = await flag('kadeJoined');
const hasKade = after.some((c) => c.id === 'kade' && c.comp);
console.log('Kade joins in the dark      :', joined && hasKade);
console.log('field cap after Kade        :', capAfter, '(was', capBefore + ')');
console.log('party                       :', JSON.stringify(after));

const ok = metSena && joined && hasKade && capAfter === capBefore + 1;
console.log('\nRECRUITS OK :', ok);
console.log('ERRORS:', errs.length ? errs.join('\n') : '(none)');
await browser.close();
process.exit(ok && !errs.length ? 0 : 1);
