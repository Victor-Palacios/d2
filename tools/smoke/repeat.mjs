import { chromium } from 'playwright';

// Repeat command smoke test, against the built bundle via window.hd2dGame.
// Covers:
//   1. The action menu offers a 'Repeat' item, disabled in round 1 (nothing to
//      repeat yet) and enabled from round 2 once a command has been issued.
//   2. Repeat replays the actor's last player-chosen command (a Technique).
//   3. When the actor can no longer afford that Technique, Repeat falls back to
//      a normal Attack (the requested behaviour).
//   4. With nothing recorded, Repeat defaults to a normal Attack.
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
const menuHidden = () => page.evaluate(() => { const m = document.querySelector('#action-menu'); return !m || m.style.display === 'none' || !m.querySelector('li'); });
// The top-level action menu (contains 'Attack'), with the Repeat item's state.
const topMenu = () => page.evaluate(() => {
  const m = document.querySelector('#action-menu');
  if (!m || m.style.display === 'none') return null;
  const lis = [...m.querySelectorAll('li')];
  const labels = lis.map((li) => li.textContent || '');
  if (!labels.some((l) => /Attack/.test(l))) return null; // a submenu, not the root
  const repeat = lis.find((li) => /Repeat/.test(li.textContent || ''));
  return { labels, hasRepeat: !!repeat, repeatDisabled: repeat?.getAttribute('aria-disabled') === 'true' };
});
const waitTop = async (ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const t = await topMenu(); if (t) return t; await page.waitForTimeout(150); } return null; };
const waitHidden = async (ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await menuHidden()) return true; await page.waitForTimeout(120); } return false; };

await page.goto(process.env.URL ?? 'http://localhost:4173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.evaluate(() => { const g = window.hd2dGame; const p = g.hd2d.params;
  p.supersample = 0.35; p.dofEnabled = false; p.tiltEnabled = false; p.bloomEnabled = false;
  g.hd2d.renderer.shadowMap.enabled = false; g.hd2d.applyParams(); });
await page.waitForTimeout(1200);

// Lost Souls title: dismiss the "press any button" splash so the menu is reachable.
await page.waitForSelector('.title-press', { timeout: 4000 }).catch(() => {});
if (await page.locator('.title-press').count()) { await page.keyboard.press('Enter'); await page.waitForTimeout(300); }
// New Game -> name -> partner (Emberling, Lv1, knows emberFang @6 MP) -> hub.
await page.keyboard.press('Enter'); await page.waitForTimeout(800);
await page.locator('.keyboard button', { hasText: /^OK$/ }).click(); await page.waitForTimeout(600);
for (let i = 0; i < 40; i++) { if (await page.locator('.card', { hasText: 'Emberling' }).count()) break; if (await dlg()) await page.keyboard.press('Enter'); await page.waitForTimeout(200); }
await page.locator('.card', { hasText: 'Emberling' }).click();
await clearDlg(); await waitScene('hub'); await page.waitForTimeout(600); await clearDlg();

const results = [];
const check = (name, cond, extra = '') => { results.push({ name, ok: !!cond, extra }); };

// Launch a single-fighter fight directly; skip the melee tutorial for determinism.
await page.evaluate(() => {
  const g = window.hd2dGame;
  g.game.set('tut.melee');
  g.game.activeReachId = 'crossing';
  g.manager.go('battle', { enemies: [{ species: 'mitebug', level: 1 }], returnTo: 'hub' });
});
await waitScene('battle', 20000);
// Make both sides durable so the fight reaches round 2 no matter how many
// party members are fielded (a new game now starts with a companion, so the
// party has more than one actor per round).
await page.evaluate(() => {
  const s = window.hd2dGame.manager.activeScene;
  for (const b of s.battle.side('party')) { b.creature.hp = b.creature.maxHp = 999; }
  for (const b of s.battle.side('enemy')) { b.creature.hp = b.creature.maxHp = 999; b.creature.off = 1; }
});
await clearDlg();
const round = () => page.evaluate(() => window.hd2dGame.manager.activeScene.battle.round);

// --- 1a. Round 1: Repeat is present but disabled (nothing to repeat yet) ---
const t1 = await waitTop();
check('action menu offers a Repeat item', t1 && t1.hasRepeat, t1 ? JSON.stringify(t1.labels) : 'no menu');
check('Repeat is disabled in round 1', t1 && t1.repeatDisabled && (await round()) === 1);

// Guard through every party turn (recording a command each) until round 2 opens.
let t2 = null;
const deadline = Date.now() + 30000;
while (Date.now() < deadline) {
  const t = await topMenu();
  if (!t) { await page.waitForTimeout(150); continue; }
  if ((await round()) >= 2) { t2 = t; break; }
  await page.locator('#action-menu li', { hasText: 'Guard' }).click();
  await waitHidden();
}

// --- 1b. Round 2: Repeat is now enabled ---
check('Repeat is enabled in round 2 (a command exists to replay)', t2 && t2.hasRepeat && !t2.repeatDisabled, t2 ? JSON.stringify(t2.labels) : 'no menu');

// --- 2-4. The replay + MP-fallback logic, exercised directly on the scene ---
const logic = await page.evaluate(() => {
  const s = window.hd2dGame.manager.activeScene;
  const actor = s.battle.side('party')[0];
  const foe = s.battle.side('enemy')[0].creature.uid;
  s.lastActions = new Map([[actor.creature.uid, { type: 'technique', techniqueId: 'emberFang', targetUid: foe }]]);
  actor.creature.mp = 18;                 // can afford Ember Fang (6 MP)
  const affordable = s.repeatAction(actor);
  actor.creature.mp = 5;                  // now cannot
  const broke = s.repeatAction(actor);
  s.lastActions = new Map();              // nothing recorded
  const empty = s.repeatAction(actor);
  return { affordable, broke, empty };
});
check('Repeat replays the recorded Technique when affordable',
  logic.affordable.type === 'technique' && logic.affordable.techniqueId === 'emberFang', JSON.stringify(logic.affordable));
check('Repeat falls back to a normal Attack when MP is short',
  logic.broke.type === 'attack', JSON.stringify(logic.broke));
check('Repeat defaults to Attack when nothing was recorded',
  logic.empty.type === 'attack', JSON.stringify(logic.empty));

// --- report ---
let pass = errs.length === 0;
for (const r of results) { if (!r.ok) pass = false; console.log(`${r.ok ? 'ok  ' : 'FAIL'}  ${r.name}${r.extra ? '   [' + r.extra + ']' : ''}`); }
for (const e of errs) console.log(e);
console.log(`\nVERDICT: ${pass ? 'PASS' : 'FAIL'}`);
await browser.close();
process.exit(pass ? 0 : 1);
