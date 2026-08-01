import { chromium } from 'playwright';

// The three companions who join the journey (party of 4). Wren joins on the
// first arrival at the Everwake; Sena Vale after the Reliquary (crystal); Kade
// after the Unremembered (haunted). Companions are permanent — they cannot be
// benched to the Sanctuary. Drives the hub arrivals via the debug API; no
// fights, so it is fast and deterministic. See docs/NARRATIVE.md §4.

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
const party = () => page.evaluate(() => window.hd2dGame.game.party.map((c) => ({ id: c.speciesId, companion: !!c.companion })));
const hasCompanion = async (id) => (await party()).some((c) => c.id === id && c.companion);
const humanCount = () => page.evaluate(() => window.hd2dGame.game.humanCount);
const fieldCap = () => page.evaluate(() => window.hd2dGame.game.fieldCap);
const flag = (f) => page.evaluate((x) => window.hd2dGame.game.has(x), f);
const advanceUntilFlag = async (f, tries = 60) => {
  for (let i = 0; i < tries; i++) {
    if (await flag(f)) return true;
    if (await dlg()) await page.keyboard.press('Enter');
    await page.waitForTimeout(180);
  }
  return flag(f);
};
// Advance dialogue until `id` is a companion in the party (join scene done).
const advanceUntilJoined = async (id, tries = 90) => {
  for (let i = 0; i < tries; i++) {
    if (await hasCompanion(id)) return true;
    if (await dlg()) await page.keyboard.press('Enter');
    await page.waitForTimeout(180);
  }
  return hasCompanion(id);
};

await page.goto(process.env.URL ?? 'http://localhost:4173/', { waitUntil: 'networkidle' });
await page.waitForSelector('.title-press', { timeout: 4000 }).catch(() => {});
if (await page.locator('.title-press').count()) { await page.keyboard.press('Enter'); await page.waitForTimeout(300); }
await page.waitForTimeout(1500);
await page.evaluate(() => { const g = window.hd2dGame, p = g.hd2d.params; p.supersample = 0.4; p.dofEnabled = false; p.bloomEnabled = false; g.hd2d.applyParams(); });

// New Game → name → partner → hub. Wren joins during the 'first' arrival.
await page.keyboard.press('Enter'); await page.waitForTimeout(700);
await page.locator('.keyboard button', { hasText: /^OK$/ }).click(); await page.waitForTimeout(600);
for (let i = 0; i < 40; i++) { if (await page.locator('.card', { hasText: 'Emberling' }).count()) break; await page.keyboard.press('Enter'); /* press through the prologue cutscene */ await page.waitForTimeout(200); }
await page.locator('.card', { hasText: 'Emberling' }).click();
await wait('hub');

const wren = await advanceUntilJoined('wren');
const afterWren = await party();
// Each human keeper lets you field one more soul: you + Wren = 2.
const capAfterWren = (await humanCount()) === 2 && (await fieldCap()) === 2;
console.log('Wren joins at the Everwake :', wren, JSON.stringify(afterWren));
console.log('field cap = 2 souls (2 humans):', capAfterWren);

// Quiet return with only the Crossing cleared: between-reach party banter fires.
await page.evaluate(async () => { window.hd2dGame.game.set('crossingCleared'); await window.hd2dGame.manager.go('hub', {}); });
const banter = await advanceUntilFlag('banter:search');
console.log('quiet-return banter fires  :', banter);

// Clear the Reliquary and return: Sena Vale joins.
await page.evaluate(async () => { window.hd2dGame.game.set('crystalCleared'); await window.hd2dGame.manager.go('hub', {}); });
const sena = await advanceUntilJoined('senaVale');
const capAfterSena = (await humanCount()) === 3 && (await fieldCap()) === 3;
console.log('Sena joins after Reliquary :', sena);
console.log('field cap = 3 souls (3 humans):', capAfterSena);

// Clear the Unremembered and return: Kade joins.
await page.evaluate(async () => { window.hd2dGame.game.set('hauntedCleared'); await window.hd2dGame.manager.go('hub', {}); });
const kade = await advanceUntilJoined('kade');
const full = await party();
const capAfterKade = (await humanCount()) === 4 && (await fieldCap()) === 4;
console.log('Kade joins after Unremembered:', kade);
console.log('field cap = 4 souls (4 humans):', capAfterKade);
console.log('final party                 :', JSON.stringify(full));

// Companions never take the field: launch a battle and read the fielded side.
// Only souls (non-companions) deploy, and no more than the field cap.
const fielded = await page.evaluate(async () => {
  const g = window.hd2dGame;
  g.game.activeReachId = 'crossing';
  await g.manager.go('battle', { enemies: [{ species: 'mitebug', level: 2 }], returnTo: 'hub' });
  await new Promise((r) => setTimeout(r, 800));
  const b = g.manager.activeScene.battle;
  return b.side('party').map((u) => ({ id: u.creature.speciesId, companion: !!u.creature.companion }));
});
const noHumansOnField = fielded.length > 0 && fielded.every((u) => !u.companion);
console.log('battle fields souls only    :', noHumansOnField, JSON.stringify(fielded));

// Companions are permanent: benching one to the Sanctuary must be refused.
const benchRefused = await page.evaluate(() => {
  const g = window.hd2dGame.game;
  const c = g.party.find((m) => m.speciesId === 'wren');
  return c ? g.partyToSanctuary(c.uid) === false : false;
});
console.log('companion cannot be benched  :', benchRefused);

const ids = full.map((c) => c.id);
const partyOfFour = full.length === 4 && ['wren', 'senaVale', 'kade'].every((id) => ids.includes(id));
const ok =
  wren &&
  banter &&
  sena &&
  kade &&
  partyOfFour &&
  benchRefused &&
  capAfterWren &&
  capAfterSena &&
  capAfterKade &&
  noHumansOnField;
console.log('\nCOMPANIONS OK :', ok);
console.log('ERRORS:', errs.length ? errs.join('\n') : '(none)');
await browser.close();
process.exit(ok && !errs.length ? 0 : 1);
