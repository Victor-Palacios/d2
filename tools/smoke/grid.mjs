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
  // Three extra so the fight deploys 3 and keeps 1 in reserve (for the swap test).
  ['sprigling', 'cogling', 'dropletta'].forEach((id) => g.game.addMonster(JSON.parse(JSON.stringify({ ...g.game.party[0], uid: 'x' + id, speciesId: id, name: id })))); });

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

console.log('== Phase A ==');
console.log('party cells        :', JSON.stringify(r.party));
console.log('enemy cells        :', JSON.stringify(r.enemy));
console.log('default all-front  :', r.partyAllVanguard && r.enemyFrontCentre);
console.log('cover hides rear   :', r.coveredHiddenFromMelee);
console.log('exposed is meleeable:', r.exposedBecomesMelee);
console.log(`front melee > rear : ${r.meleeFrontDealt} > ${r.meleeRearDealt} = ${r.meleeFrontDealt > r.meleeRearDealt}`);
console.log(`vanguard takes more: ${r.takenVanguard} > ${r.takenRear} = ${r.takenVanguard > r.takenRear}`);

const okA = r.partyAllVanguard && r.enemyFrontCentre && r.coveredHiddenFromMelee && r.exposedBecomesMelee &&
  r.meleeFrontDealt > r.meleeRearDealt && r.takenVanguard > r.takenRear;

// --- Phase B: AoE shapes, shift + plate-on-cell, swap --------------------
const r2 = await page.evaluate(() => {
  const b = window.hd2dGame.manager.activeScene.battle;
  const idx = (cell) => cell.row * 3 + cell.col;
  const party = b.side('party');
  const enemy = b.side('enemy')[0];
  const out = {};
  enemy.creature.mp = 999; // let the enemy afford shaped Techniques for the test
  const restore = () => party.forEach((p) => { p.creature.hp = p.creature.maxHp; });

  // Row shape: all three party in row 0 -> a row technique aimed at any hits all 3.
  party[0].cell = { row: 0, col: 0 }; party[1].cell = { row: 0, col: 1 }; party[2].cell = { row: 0, col: 2 };
  restore();
  out.rowHits = b.perform(enemy, { type: 'technique', techniqueId: 'emberWave', targetUid: party[1].creature.uid }).hits.length;

  // Column shape: stack two party in one column -> a column technique hits exactly those 2.
  party[0].cell = { row: 0, col: 0 }; party[1].cell = { row: 1, col: 0 }; party[2].cell = { row: 0, col: 2 };
  restore();
  out.colHits = b.perform(enemy, { type: 'technique', techniqueId: 'boltPierce', targetUid: party[0].creature.uid }).hits.length;

  // Shift onto a plated cell: the moved unit derives that cell's element.
  party[0].cell = { row: 0, col: 0 }; party[1].cell = { row: 0, col: 2 }; party[2].cell = { row: 1, col: 2 };
  b.plates.party[idx({ row: 1, col: 1 })] = 'fire';
  const shiftRes = b.perform(party[0], { type: 'shift', cell: { row: 1, col: 1 } });
  out.shiftMoved = !!shiftRes.moved && party[0].cell.row === 1 && party[0].cell.col === 1;
  out.shiftPlate = party[0].tile === 'fire';

  // Swap: a living reserve tags in, taking the actor's slot; the actor benches.
  const reserve = b.reserves.filter((x) => x.hp > 0)[0];
  out.hadReserve = !!reserve;
  if (reserve) {
    const actor = b.side('party')[1];
    const oldUid = actor.creature.uid;
    const swapRes = b.perform(actor, { type: 'swap', reserveUid: reserve.uid });
    out.swapMoved = !!swapRes.moved && actor.creature.uid === reserve.uid && b.reserves.some((x) => x.uid === oldUid);
  }
  return out;
});

console.log('\n== Phase B ==');
console.log(`row shape hits 3   : ${r2.rowHits} (=3? ${r2.rowHits === 3})`);
console.log(`column shape hits 2: ${r2.colHits} (=2? ${r2.colHits === 2})`);
console.log('shift repositions  :', r2.shiftMoved);
console.log('shift picks up plate:', r2.shiftPlate);
console.log('swap tags in reserve:', r2.hadReserve && r2.swapMoved);

const okB = r2.rowHits === 3 && r2.colHits === 2 && r2.shiftMoved && r2.shiftPlate && r2.hadReserve && r2.swapMoved;

// --- Phase C: Boost gauge -----------------------------------------------
const r3 = await page.evaluate(() => {
  const b = window.hd2dGame.manager.activeScene.battle;
  const party = b.side('party');
  party.forEach((p) => { p.creature.hp = p.creature.maxHp; });
  const out = {};

  // Basic Attack builds a charge.
  b.boost.party = 0;
  const foe = b.meleeTargets('enemy')[0];
  b.perform(party[0], { type: 'attack', targetUid: foe.creature.uid });
  out.attackGain = b.boost.party === 1;

  // Guard builds a charge too.
  b.perform(party[1], { type: 'guard' });
  out.guardGain = b.boost.party === 2;

  // A Technique spends MP but does not feed Boost.
  b.boost.party = 0;
  party[0].creature.mp = 99;
  b.perform(party[0], { type: 'technique', techniqueId: 'emberFang', targetUid: foe.creature.uid });
  out.techNoGain = b.boost.party === 0;

  // Gauge caps, and spend decrements / returns false when empty.
  b.gainBoost('party', 10);
  out.capped = b.boost.party; // expect BOOST_MAX (3)
  const spent = b.spendBoost('party');
  out.spendWorks = spent && b.boost.party === 2;
  b.boost.party = 0;
  out.spendEmptyFails = b.spendBoost('party') === false;

  // requeueFront grants the same actor an immediate extra turn.
  b.beginRound();
  const a1 = b.nextTurn();
  b.requeueFront(a1);
  const a2 = b.nextTurn();
  out.extraTurn = !!a1 && !!a2 && a1.creature.uid === a2.creature.uid;
  return out;
});

console.log('\n== Phase C ==');
console.log('attack builds boost:', r3.attackGain);
console.log('guard builds boost :', r3.guardGain);
console.log('technique no boost :', r3.techNoGain);
console.log(`gauge caps at 3    : ${r3.capped} (=3? ${r3.capped === 3})`);
console.log('spend decrements   :', r3.spendWorks);
console.log('empty spend fails  :', r3.spendEmptyFails);
console.log('boost -> extra turn:', r3.extraTurn);

const okC = r3.attackGain && r3.guardGain && r3.techNoGain && r3.capped === 3 &&
  r3.spendWorks && r3.spendEmptyFails && r3.extraTurn;

// --- Phase D: Break / stagger, field pulse, smarter AI -------------------
const r4 = await page.evaluate(() => {
  const b = window.hd2dGame.manager.activeScene.battle;
  const party = b.side('party');
  const enemy = b.side('enemy')[0];
  enemy.creature.mp = 999;
  b.fieldPulse = 'calm';
  const out = {};
  const reset = (u) => { u.stagger = 0; u.staggered = false; u.creature.hp = u.creature.maxHp; };

  // Repeated hits fill the stagger meter and eventually Break the target.
  const T = party[0]; reset(T); T.cell = { row: 0, col: 2 };
  let hits = 0;
  while (!T.staggered && hits < 12) { b.perform(enemy, { type: 'attack', targetUid: T.creature.uid }); T.creature.hp = T.creature.maxHp; hits++; }
  out.staggerBroke = T.staggered && T.stagger >= 100;

  // A broken target takes more than a non-broken one.
  const U = party[1]; reset(U); U.cell = { row: 0, col: 0 };
  T.creature.hp = T.creature.maxHp; // T remains broken
  const dmgBroken = b.perform(enemy, { type: 'attack', targetUid: T.creature.uid }).hits[0].damage;
  const dmgNormal = b.perform(enemy, { type: 'attack', targetUid: U.creature.uid }).hits[0].damage;
  out.brokenTakesMore = dmgBroken > dmgNormal;

  // clearStagger resets the meter.
  b.clearStagger(T); out.clearWorks = !T.staggered && T.stagger === 0;

  // Field pulse rotates with a period of 3 across rounds.
  const pulses = []; for (let i = 0; i < 6; i++) { b.beginRound(); pulses.push(b.fieldPulse); }
  out.pulsePeriodic = new Set(pulses).size === 3 && pulses[0] === pulses[3] && pulses[1] === pulses[4] && pulses[2] === pulses[5];

  // Crit pulse deals more than calm; summed over rolls so the +20% edge beats
  // per-hit variance/rounding.
  const V = party[2]; V.cell = { row: 0, col: 1 };
  let dc = 0, dcr = 0;
  b.fieldPulse = 'calm'; for (let i = 0; i < 12; i++) { reset(V); dc += b.perform(enemy, { type: 'attack', targetUid: V.creature.uid }).hits[0].damage; }
  b.fieldPulse = 'crit'; for (let i = 0; i < 12; i++) { reset(V); dcr += b.perform(enemy, { type: 'attack', targetUid: V.creature.uid }).hits[0].damage; }
  out.critPulseMore = dcr > dc;
  reset(V); b.fieldPulse = 'surge'; b.boost.enemy = 0;
  b.perform(enemy, { type: 'attack', targetUid: V.creature.uid });
  out.surgeBoost = b.boost.enemy >= 2; // +1 Attack, +1 Surge

  // Smarter AI: softmax gives variety, and it focuses a broken, low-HP threat.
  b.fieldPulse = 'calm';
  party.forEach(reset);
  party[0].cell = { row: 0, col: 0 }; party[1].cell = { row: 0, col: 1 }; party[2].cell = { row: 0, col: 2 };
  const picks = []; for (let i = 0; i < 60; i++) { const a = b.chooseEnemyAction(enemy); if (a.targetUid) picks.push(a.targetUid); }
  out.aiDistinct = new Set(picks).size;
  party[0].creature.hp = 1; party[0].staggered = true;
  let focus = 0, n = 0; for (let i = 0; i < 60; i++) { const a = b.chooseEnemyAction(enemy); if (a.targetUid) { n++; if (a.targetUid === party[0].creature.uid) focus++; } }
  out.aiFocus = n > 0 && focus / n > 0.5;
  return out;
});

console.log('\n== Phase D ==');
console.log('hits build to Break :', r4.staggerBroke);
console.log('broken takes more   :', r4.brokenTakesMore);
console.log('clearStagger resets :', r4.clearWorks);
console.log('field pulse cycles  :', r4.pulsePeriodic);
console.log('crit pulse > calm   :', r4.critPulseMore);
console.log('surge banks boost   :', r4.surgeBoost);
console.log(`AI target variety   : ${r4.aiDistinct} distinct (>=2? ${r4.aiDistinct >= 2})`);
console.log('AI focuses threat   :', r4.aiFocus);

const okD = r4.staggerBroke && r4.brokenTakesMore && r4.clearWorks && r4.pulsePeriodic &&
  r4.critPulseMore && r4.surgeBoost && r4.aiDistinct >= 2 && r4.aiFocus;

const ok = okA && okB && okC && okD;
console.log('\nPHASE A OK :', okA, '| B :', okB, '| C :', okC, '| D :', okD);
console.log('ERRORS:', errs.length ? errs.join('\n') : '(none)');
await browser.close();
process.exit(ok && !errs.length ? 0 : 1);
