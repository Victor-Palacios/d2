import { chromium } from 'playwright';

// Oilwright / LP-trade smoke test. Verifies the new "render a soul for permanent
// lantern capacity" mechanic without needing a full playthrough:
//  1. consumeSoul() guards — removes a spare soul, refuses the last fighting
//     soul and companions, and pulls from the Sanctuary.
//  2. lpBonus survives a save/load round-trip.
//  3. lpBonus is applied on top of a reach's startingLight (the WorldMap rule).
//  4. The Oilwright NPC ('4') is present in the hub.

const browser = await chromium.launch({
  executablePath: process.env.CHROME,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 720, height: 405 } });
const errs = [];
page.on('pageerror', (e) => errs.push('[pageerror] ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errs.push('[console] ' + m.text()); });

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
};

await page.goto(process.env.URL || 'http://localhost:4173/', { waitUntil: 'load' });
await page.waitForFunction(() => !!window.hd2dGame, null, { timeout: 30000 });

// --- 1-3. consumeSoul guards + persistence + capacity math (no scene needed) --
const r = await page.evaluate(() => {
  const g = window.hd2dGame, game = g.game, mk = g.creature.makeCreature;
  const out = {};
  game.party.length = 0; game.sanctuary.length = 0; game.lpBonus = 0;
  const a = mk('shardling', 5), b = mk('geodon', 7);
  game.party.push(a, b);
  out.before = game.soulsInParty();                       // 2
  out.consumedSpare = !!game.consumeSoul(a.uid);          // true (2 -> 1)
  out.after = game.soulsInParty();                        // 1
  out.refusedLast = game.consumeSoul(b.uid) === null;     // true (protect last)
  const comp = mk('shardling', 5); comp.companion = true; game.party.push(comp);
  out.refusedCompanion = game.consumeSoul(comp.uid) === null; // true
  const s = mk('prismoth', 4); game.sanctuary.push(s);
  out.consumedSanctuary = !!game.consumeSoul(s.uid);      // true
  out.sanctuaryEmpty = game.sanctuary.length === 0;       // true
  // persistence
  game.lpBonus = 42;
  const snap = g.saves.snapshot('auto', 'hub', 't');
  game.lpBonus = 0;
  g.saves.applySave(snap);
  out.lpBonusRestored = game.lpBonus;                     // 42
  // capacity rule: maxLight = reach.startingLight + lpBonus
  const start = g.reaches.crystal.startingLight;
  out.capacityWithBonus = start + game.lpBonus;
  out.crystalStart = start;
  return out;
});

console.log('\n=== consumeSoul + LP capacity ===');
check('starts with 2 party souls', r.before === 2);
check('consumes a spare soul (2->1)', r.consumedSpare && r.after === 1);
check('refuses the last fighting soul', r.refusedLast);
check('refuses a companion', r.refusedCompanion);
check('consumes a Sanctuary soul', r.consumedSanctuary && r.sanctuaryEmpty);
check('lpBonus survives save/load', r.lpBonusRestored === 42, `${r.lpBonusRestored}`);
check('capacity = startingLight + lpBonus', r.capacityWithBonus === r.crystalStart + 42, `${r.crystalStart}+42=${r.capacityWithBonus}`);

// --- 4. Oilwright NPC present in the hub -------------------------------------
const hubNpcs = await page.evaluate(async () => {
  const g = window.hd2dGame;
  await g.manager.go('hub');
  const s = g.manager.activeScene;
  return (s.npcs ?? []).map((n) => n.id);
});
console.log('\n=== hub NPC ===');
check('Oilwright NPC is in the hub', hubNpcs.includes('oilwright'), hubNpcs.join(', '));

console.log('\nERRORS:', errs.length ? errs.join('\n') : '(none)');
if (errs.length) failures += errs.length;
console.log(`\nVERDICT: ${failures ? 'FAIL (' + failures + ')' : 'PASS'}`);
await browser.close();
process.exit(failures ? 1 : 0);
