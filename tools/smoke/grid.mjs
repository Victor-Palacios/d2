import { chromium } from 'playwright';

// Phase A of the grid battle: verifies the 2×3 formation model, melee cover
// (a Rear unit is untargetable by melee while a Vanguard ally holds its column),
// and the front/back damage modifiers — all against the live engine in the
// built bundle via window.hd2dGame. See tools/smoke/README.md.

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
const press = async (k, n = 1, gap = 300) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await page.waitForTimeout(gap); } };

await page.goto(process.env.URL ?? 'http://localhost:4195/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.evaluate(() => { const g = window.hd2dGame; const p = g.hd2d.params;
  p.supersample = 0.35; p.dofEnabled = false; p.tiltEnabled = false; p.bloomEnabled = false;
  g.hd2d.renderer.shadowMap.enabled = false; g.hd2d.applyParams(); });
await page.waitForTimeout(1200);

// New Game -> name -> partner -> hub, then inflate to a 3-strong party.
await page.keyboard.press('Enter'); await page.waitForTimeout(800);
await page.locator('.keyboard button', { hasText: /^OK$/ }).click(); await page.waitForTimeout(600);
for (let i = 0; i < 40; i++) { if (await page.locator('.card', { hasText: 'Emberling' }).count()) break; if (await dlg()) await page.keyboard.press('Enter'); await page.waitForTimeout(200); }
await page.locator('.card', { hasText: 'Emberling' }).click();
await clearDlg(); await waitScene('hub'); await page.waitForTimeout(600); await clearDlg();
await page.evaluate(() => { const g = window.hd2dGame;
  ['sprigling', 'cogling'].forEach((id) => g.game.addMonster(JSON.parse(JSON.stringify({ ...g.game.party[0], uid: 'x' + id, speciesId: id, name: id })))); });

// Into The Quiet Crossing floor 1 and across the gateway into the first fight.
await press('ArrowDown', 5); await press('ArrowLeft', 3); await press('ArrowDown', 2);
await waitScene('worldmap'); await page.waitForTimeout(600);
await page.locator('.card', { hasText: 'The Quiet Crossing' }).click();
await waitScene('dungeon'); await page.waitForTimeout(900); await clearDlg();
await press('ArrowDown', 4);
for (let i = 0; i < 8 && (await scene()) === 'dungeon'; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(320); if (await dlg()) await clearDlg(); }
await waitScene('battle', 20000); await page.waitForTimeout(1200);

const r = await page.evaluate(() => {
  const b = window.hd2dGame.manager.activeScene.battle;
  const cellStr = (x) => `${x.creature.speciesId} r${x.cell.row}c${x.cell.col}`;
  const out = { party: b.side('party').map(cellStr), enemy: b.side('enemy').map(cellStr) };
  const party = b.side('party');
  const enemy = b.side('enemy')[0];

  // Default formation: everyone in the Vanguard (row 0), enemy front-centre.
  out.partyAllVanguard = party.every((p) => p.cell.row === 0);
  out.enemyFrontCentre = enemy.cell.row === 0;

  // Cover: put party[2] in the Rear behind party[0]'s column.
  party[2].cell = { row: 1, col: party[0].cell.col };
  const uids = (list) => list.map((x) => x.creature.uid);
  const rearUid = party[2].creature.uid;
  out.coveredHiddenFromMelee =
    uids(b.living('party')).includes(rearUid) && !uids(b.meleeTargets('party')).includes(rearUid);

  // Expose it: drop the Vanguard ally holding the column -> now meleeable.
  const frontHp = party[0].creature.hp;
  party[0].creature.hp = 0;
  out.exposedBecomesMelee = uids(b.meleeTargets('party')).includes(rearUid);
  party[0].creature.hp = frontHp;
  party[2].cell = { row: 0, col: party[2].cell.col }; // restore to front for cleanliness

  // Row damage: same attacker/target, front vs (exposed) rear.
  const T = party[1].creature;
  const atkFrom = (attackerRow, defenderRow) => {
    party[0].cell = { row: attackerRow, col: 0 };
    T._savedCell = party[1].cell; party[1].cell = { row: defenderRow, col: 2 }; // col 2 = uncovered
    const hpBefore = T.hp; T.hp = T.maxHp;
    const res = b.perform(party[0], { type: 'attack', targetUid: T.uid });
    const dmg = res.hits[0] ? res.hits[0].damage : 0;
    T.hp = hpBefore;
    return dmg;
  };
  // Attacker in Vanguard vs Rear (defender fixed in Vanguard so "taken" is constant).
  out.meleeFrontDealt = atkFrom(0, 0);
  out.meleeRearDealt = atkFrom(1, 0);
  // Defender in Vanguard vs Rear (attacker fixed in Vanguard).
  out.takenVanguard = atkFrom(0, 0);
  out.takenRear = atkFrom(0, 1);
  return out;
});

console.log('party cells        :', JSON.stringify(r.party));
console.log('enemy cells        :', JSON.stringify(r.enemy));
console.log('default all-front  :', r.partyAllVanguard && r.enemyFrontCentre);
console.log('cover hides rear   :', r.coveredHiddenFromMelee);
console.log('exposed is meleeable:', r.exposedBecomesMelee);
console.log(`front melee > rear : ${r.meleeFrontDealt} > ${r.meleeRearDealt} = ${r.meleeFrontDealt > r.meleeRearDealt}`);
console.log(`vanguard takes more: ${r.takenVanguard} > ${r.takenRear} = ${r.takenVanguard > r.takenRear}`);

const ok = r.partyAllVanguard && r.enemyFrontCentre && r.coveredHiddenFromMelee && r.exposedBecomesMelee &&
  r.meleeFrontDealt > r.meleeRearDealt && r.takenVanguard > r.takenRear;
console.log('\nPHASE A OK :', ok);
console.log('ERRORS:', errs.length ? errs.join('\n') : '(none)');
await browser.close();
process.exit(ok && !errs.length ? 0 : 1);
