import { chromium } from 'playwright';

// New battle mechanics, tested against the live engine in the built bundle via
// window.hd2dGame (same harness style as grid.mjs). Covers, in order:
//   1. Data-driven melee (emberFang now takes row modifiers + respects cover)
//   2. Elemental reactions (a different-element follow-up detonates for bonus)
//   3. Break-chains (escalating bonus + a banked Boost at the chain threshold)
//   4. Commune (a communable foe is pacified and leaves play)
//   5. Injected RNG is exposed; smarter AI uses Boost timing + the grid.
// See tools/smoke/README.md and docs/SYSTEMS.md.

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

await page.goto(process.env.URL ?? 'http://localhost:4173/', { waitUntil: 'networkidle' });
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

// Launch a fight directly from the hub via the scene manager — robust against
// world-map / floor UI changes, and enough to exercise the engine. The reach is
// 'crossing', so the melee tutorial dialogue fires; clear it before poking.
await page.evaluate(() => {
  const g = window.hd2dGame;
  g.game.activeReachId = 'crossing';
  g.manager.go('battle', { enemies: [{ species: 'mitebug', level: 2 }, { species: 'scrapmite', level: 2 }], returnTo: 'hub' });
});
await waitScene('battle', 20000); await page.waitForTimeout(1200);
await clearDlg(); await page.waitForTimeout(500); await clearDlg(); // intro + melee tutorial

const r = await page.evaluate(() => {
  const b = window.hd2dGame.manager.activeScene.battle;
  const out = {};
  const party = b.side('party');
  const enemy = b.side('enemy')[0];
  enemy.creature.mp = 99999;
  b.fieldPulse = 'calm';
  b.round = 5;
  const reset = (u) => { u.stagger = 0; u.staggered = false; u.chain = 0; u.reactionTag = undefined; u.commune = 0; u.pacified = false; u.creature.hp = u.creature.maxHp; };

  // --- 1. Melee is now data-driven: emberFang takes the row modifiers -----
  const T = party[1];
  const atk = (attackerRow, defenderRow, tech) => {
    party[0].cell = { row: attackerRow, col: 0 };
    T.cell = { row: defenderRow, col: 2 }; // col 2 stays uncovered
    let sum = 0; for (let i = 0; i < 10; i++) { reset(T); enemy.cell = { row: attackerRow, col: 1 };
      sum += b.perform(enemy, tech.type === 'attack' ? { type: 'attack', targetUid: T.creature.uid } : { type: 'technique', techniqueId: tech.id, targetUid: T.creature.uid }).hits[0].damage; }
    return sum;
  };
  const fangFront = atk(0, 0, { type: 'technique', id: 'emberFang' });
  const fangRear = atk(1, 0, { type: 'technique', id: 'emberFang' });
  out.meleeTechRowModifier = fangFront > fangRear; // proves emberFang is melee

  // Melee technique respects cover: aim at a covered Rear foe -> lands elsewhere.
  party.forEach(reset);
  party[0].cell = { row: 0, col: 0 }; party[1].cell = { row: 1, col: 0 }; party[2].cell = { row: 0, col: 2 };
  const coveredUid = party[1].creature.uid; // rear, covered by party[0] in col 0
  const fangRes = b.perform(enemy, { type: 'technique', techniqueId: 'emberFang', targetUid: coveredUid });
  out.meleeRespectsCover = fangRes.hits.length > 0 && fangRes.hits.every((h) => h.targetUid !== coveredUid);

  // --- 2. Elemental reactions --------------------------------------------
  party.forEach(reset);
  party[0].cell = { row: 0, col: 0 }; party[1].cell = { row: 0, col: 1 }; party[2].cell = { row: 0, col: 2 };
  const V = party[2];
  // fire mark, then water -> reaction on the water hit.
  reset(V); enemy.cell = { row: 0, col: 1 };
  b.perform(enemy, { type: 'technique', techniqueId: 'emberFang', targetUid: V.creature.uid }); // fire mark
  V.creature.hp = V.creature.maxHp;
  const waterReact = b.perform(enemy, { type: 'technique', techniqueId: 'frostLance', targetUid: V.creature.uid }); // water, cost 7
  out.reactionFires = !!waterReact.hits[0].reaction;
  // control: two water hits in a row -> no reaction (same element refreshes).
  reset(V);
  b.perform(enemy, { type: 'technique', techniqueId: 'frostLance', targetUid: V.creature.uid });
  V.creature.hp = V.creature.maxHp;
  const waterPlain = b.perform(enemy, { type: 'technique', techniqueId: 'frostLance', targetUid: V.creature.uid });
  out.controlNoReaction = !waterPlain.hits[0].reaction;

  // --- 3. Break-chains ----------------------------------------------------
  party.forEach(reset);
  const W = party[0]; W.cell = { row: 0, col: 0 };
  W.staggered = true; W.stagger = 100; W.chain = 0;
  b.boost.enemy = 0;
  const chainDmg = []; const boostAfter = [];
  for (let i = 0; i < 4; i++) { W.creature.hp = W.creature.maxHp; // keep it alive & broken
    const res = b.perform(enemy, { type: 'technique', techniqueId: 'emberFang', targetUid: W.creature.uid });
    W.staggered = true; // stays broken for the test window
    chainDmg.push(res.hits[0].damage); boostAfter.push(b.boost.enemy);
  }
  out.chainCounts = [W.chain]; // ends at 4
  out.chainEscalates = chainDmg[3] > chainDmg[0];
  out.chainBanksBoost = boostAfter[2] > boostAfter[1]; // the 3rd link (CHAIN_BOOST_AT) banks one

  // --- 4. Commune ---------------------------------------------------------
  party.forEach(reset);
  enemy.pacified = false; enemy.commune = 0; enemy.creature.communable = true; enemy.creature.hp = enemy.creature.maxHp;
  out.communeOffered = b.communeTargets('enemy').some((x) => x.creature.uid === enemy.creature.uid);
  let pacifiedFlag = false;
  for (let i = 0; i < 6 && !enemy.pacified; i++) {
    const res = b.perform(party[0], { type: 'commune', targetUid: enemy.creature.uid });
    if (res.pacified) pacifiedFlag = true;
  }
  out.pacified = enemy.pacified && pacifiedFlag;
  out.pacifiedLeavesPlay = !b.living('enemy').some((x) => x.creature.uid === enemy.creature.uid);
  b.beginRound();
  const queue = [];
  let g; while ((g = b.nextTurn())) queue.push(g.creature.uid);
  out.pacifiedSkipsTurns = !queue.includes(enemy.creature.uid);
  enemy.pacified = false; enemy.creature.communable = false; // restore

  // --- 5. RNG exposed + smarter AI ---------------------------------------
  out.rngExposed = typeof b.rng === 'function';
  out.boostFnExposed = typeof b.shouldSpendBoost === 'function';
  b.boost.enemy = 0; out.noBoostNoSpend = b.shouldSpendBoost(enemy) === false;
  // AI grid use: a matching plate on an empty enemy cell should sometimes be sought.
  party.forEach(reset); enemy.creature.hp = enemy.creature.maxHp;
  const idx = (c) => c.row * 3 + c.col;
  enemy.cell = { row: 0, col: 1 }; enemy.tile = undefined;
  b.plates.enemy[idx({ row: 1, col: 1 })] = enemy.creature.element; // a matching plate to step onto
  let sawShift = false;
  for (let i = 0; i < 60; i++) { const a = b.chooseEnemyAction(enemy); if (a.type === 'shift') { sawShift = true; break; } }
  out.aiUsesGrid = sawShift;
  return out;
});

console.log('== Mechanics ==');
console.log('melee tech row modifier :', r.meleeTechRowModifier);
console.log('melee respects cover    :', r.meleeRespectsCover);
console.log('reaction fires          :', r.reactionFires);
console.log('control has no reaction :', r.controlNoReaction);
console.log('chain reaches 4         :', r.chainCounts[0] === 4);
console.log('chain escalates damage  :', r.chainEscalates);
console.log('chain banks a boost     :', r.chainBanksBoost);
console.log('commune offered         :', r.communeOffered);
console.log('commune pacifies         :', r.pacified);
console.log('pacified leaves play    :', r.pacifiedLeavesPlay);
console.log('pacified skips turns    :', r.pacifiedSkipsTurns);
console.log('rng exposed             :', r.rngExposed);
console.log('boost fn exposed        :', r.boostFnExposed);
console.log('no boost -> no spend    :', r.noBoostNoSpend);
console.log('ai uses the grid        :', r.aiUsesGrid);

const ok = r.meleeTechRowModifier && r.meleeRespectsCover && r.reactionFires && r.controlNoReaction &&
  r.chainCounts[0] === 4 && r.chainEscalates && r.chainBanksBoost && r.communeOffered && r.pacified &&
  r.pacifiedLeavesPlay && r.pacifiedSkipsTurns && r.rngExposed && r.boostFnExposed && r.noBoostNoSpend && r.aiUsesGrid;

console.log('\nMECHANICS OK :', ok);
console.log('ERRORS:', errs.length ? errs.join('\n') : '(none)');
await browser.close();
process.exit(ok && !errs.length ? 0 : 1);
