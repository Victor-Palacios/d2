import { chromium } from 'playwright';

// Drives the two free-select domains end to end: world-map selection, floor
// loading, a scripted fight, descent, and the boss + exit-portal on Crystal
// Cavern; world-map selection + a fight on Haunted Dungeon. Proves the domain
// registry, per-domain data/art/music, and the generic clear path all hold up
// in a real browser. See tools/smoke/README.md.

const browser = await chromium.launch({
  executablePath: process.env.CHROME,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 720, height: 405 } });
const errs = [];
page.on('pageerror', (e) => errs.push('[pageerror] ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errs.push('[console] ' + m.text()); });

const st = () => page.evaluate(() => {
  const g = window.hd2dGame; const s = g.manager.activeScene ?? {};
  return {
    scene: g.manager.current,
    domain: g.game.activeDomainId,
    floor: g.game.floorIndex,
    tile: s.tileX !== undefined ? `${s.tileX},${s.tileZ}` : null,
    busy: s.busy ?? null,
    dlg: (() => { const d = document.querySelector('#dialogue'); return !!d && d.style.display !== 'none'; })(),
    floorName: document.querySelector('#dungeon-hud h2')?.textContent ?? null,
  };
});
const press = async (k, n = 1, gap = 300) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await page.waitForTimeout(gap); } };
const clearDlg = async (m = 60) => { for (let i = 0; i < m; i++) { if (!(await st()).dlg) return; await page.keyboard.press('Enter'); await page.waitForTimeout(160); } };
const waitScene = async (name, ms = 40000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if ((await st()).scene === name) return true; await page.waitForTimeout(200); }
  console.log('  !! timeout waiting for', name, JSON.stringify(await st())); return false;
};
// Win a battle by mashing confirm: this both advances the event's intro
// dialogue (still in the dungeon scene) and, once in battle, picks
// Attack -> first target every turn until the fight resolves.
const winBattle = async (ms = 90000) => {
  const t0 = Date.now();
  // Phase 1: advance into the battle (intro narration plays in the dungeon).
  while (Date.now() - t0 < ms && (await st()).scene !== 'battle') {
    await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  }
  // Phase 2: fight until the scene leaves the arena.
  while (Date.now() - t0 < ms && (await st()).scene === 'battle') {
    await page.keyboard.press('Enter'); await page.waitForTimeout(340);
  }
  // A genuine win returns to the crawl; a loss drops to the game-over screen.
  return (await st()).scene === 'dungeon';
};

await page.goto(process.env.URL ?? 'http://localhost:4185/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.evaluate(() => { const g = window.hd2dGame; const p = g.hd2d.params;
  p.supersample = 0.35; p.dofEnabled = false; p.tiltEnabled = false; p.bloomEnabled = false;
  g.hd2d.renderer.shadowMap.enabled = false; g.hd2d.applyParams(); });
await page.waitForTimeout(1500);

// Prologue -> hub -> world map.
await page.keyboard.press('Enter'); await page.waitForTimeout(800);
await page.locator('.keyboard button', { hasText: /^OK$/ }).click(); await page.waitForTimeout(600);
await clearDlg(); await waitScene('hub'); await page.waitForTimeout(700); await clearDlg();
await press('ArrowDown', 5); await press('ArrowLeft', 3); await press('ArrowDown', 2);
await waitScene('worldmap'); await page.waitForTimeout(800);

const cardTitles = await page.evaluate(() => [...document.querySelectorAll('.card h3')].map((n) => n.textContent));
console.log('world-map cards :', JSON.stringify(cardTitles));
const hasBoth = cardTitles.includes('Crystal Cavern') && cardTitles.includes('Haunted Dungeon');
console.log('both new domains selectable :', hasBoth);

// === CRYSTAL CAVERN: full run ===
console.log('\n=== Crystal Cavern ===');
await page.locator('.card', { hasText: 'Crystal Cavern' }).click();
await waitScene('dungeon'); await page.waitForTimeout(1000);
let s = await st();
console.log('entered :', JSON.stringify({ domain: s.domain, floor: s.floor, floorName: s.floorName }));

// This smoke verifies WIRING/FLOW, not balance — a post-boot party can be a
// single starter, which cannot solo a warden. Boost the party via the debug
// API so fights resolve deterministically here. (Real balance rides on the
// recruitment system — a next-iteration feature; see the plan/roadmap.)
await page.evaluate(() => {
  window.hd2dGame.game.party.forEach((c) => { c.maxHp = 999; c.hp = 999; c.maxMp = 999; c.mp = 999; c.off = 140; });
});

// Floor 1: S at 3,2 ; event '1' at 5,4. Right 2, down 2 -> fight.
await press('ArrowRight', 2); await press('ArrowDown', 2);
// Advance into the arena, screenshot the new monsters, then win.
for (let i = 0; i < 40 && (await st()).scene !== 'battle'; i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(200); }
await page.waitForTimeout(1200);
await page.screenshot({ path: new URL('./shots/crystal-battle.png', import.meta.url).pathname });
console.log('floor-1 battle won :', await winBattle());
await waitScene('dungeon'); await page.waitForTimeout(600); await clearDlg();

// Jump to the boss floor via the debug API, then walk up into the warden.
await page.evaluate(async () => { const g = window.hd2dGame; g.game.floorIndex = 2; g.game.crawl.initialized = false; await g.manager.go('dungeon'); });
await waitScene('dungeon'); await page.waitForTimeout(800);
s = await st(); console.log('boss floor :', JSON.stringify({ floor: s.floor, floorName: s.floorName }));
await press('ArrowUp', 3);           // S 7,7 -> boss 7,4
console.log('boss won :', await winBattle(90000));
await waitScene('dungeon'); await page.waitForTimeout(800); await clearDlg();
// Exit portal spawns ~2 tiles up; drive into it.
await press('ArrowUp', 3);
const clearedCrystal = await waitScene('hub');
console.log('cleared -> returned to city :', clearedCrystal);
const crystalFlag = await page.evaluate(() => window.hd2dGame.game.has('crystalCleared'));
console.log('crystalCleared flag set :', crystalFlag);

// === HAUNTED DUNGEON: enter + one fight ===
console.log('\n=== Haunted Dungeon ===');
await clearDlg(); await page.waitForTimeout(600);
await press('ArrowDown', 5); await press('ArrowLeft', 3); await press('ArrowDown', 2);
await waitScene('worldmap'); await page.waitForTimeout(700);
await page.locator('.card', { hasText: 'Haunted Dungeon' }).click();
await waitScene('dungeon'); await page.waitForTimeout(1000);
s = await st();
console.log('entered :', JSON.stringify({ domain: s.domain, floor: s.floor, floorName: s.floorName }));
await press('ArrowRight', 2); await press('ArrowDown', 2);
console.log('floor-1 battle won :', await winBattle());
await waitScene('dungeon'); await page.waitForTimeout(500);

await page.screenshot({ path: new URL('./shots/domains.png', import.meta.url).pathname });
console.log('\nERRORS:', errs.length ? errs.join('\n') : '(none)');
await browser.close();
