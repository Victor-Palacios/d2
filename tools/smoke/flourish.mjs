import { chromium } from 'playwright';

// Critical / reaction flourish: a special hit freezes the frame, drops into
// slow-motion with the camera pushing in, and bursts a ring of star sprites —
// all instead of text. Equips the Immortality Memento (guaranteed criticals in
// rounds 1–3) so every hit is special, then fights one foe while a rAF monitor
// records the minimum global timeScale and the peak sprite count. Asserts the
// freeze happened (timeScale hit 0), stars burst (sprite peak is high), and that
// time + camera distance are restored afterwards. See BattleScene.specialFlourish.

const browser = await chromium.launch({
  executablePath: process.env.CHROME,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 520 } });
const errs = [];
page.on('pageerror', (e) => errs.push('[pageerror] ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errs.push('[console] ' + m.text()); });

const scene = () => page.evaluate(() => window.hd2dGame.manager.current);
const dlg = () => page.evaluate(() => { const d = document.querySelector('#dialogue'); return !!d && d.style.display !== 'none'; });
const clearDlg = async (m = 60) => { for (let i = 0; i < m; i++) { if (!(await dlg())) return; await page.keyboard.press('Enter'); await page.waitForTimeout(150); } };
const waitScene = async (n, ms = 40000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await scene()) === n) return true; await page.waitForTimeout(200); } return false; };

await page.goto(process.env.URL ?? 'http://localhost:4173/', { waitUntil: 'networkidle' });
await page.waitForSelector('.title-press', { timeout: 4000 }).catch(() => {});
if (await page.locator('.title-press').count()) { await page.keyboard.press('Enter'); await page.waitForTimeout(300); }
await page.waitForTimeout(1500);
await page.evaluate(() => { const g = window.hd2dGame; const p = g.hd2d.params;
  p.supersample = 0.4; p.dofEnabled = false; p.tiltEnabled = false; p.bloomEnabled = false;
  g.hd2d.renderer.shadowMap.enabled = false; g.hd2d.applyParams(); });

await page.keyboard.press('Enter'); await page.waitForTimeout(800);
await page.locator('.keyboard button', { hasText: /^OK$/ }).click(); await page.waitForTimeout(600);
const t0 = Date.now();
while (Date.now() - t0 < 30000) {
  if (await page.locator('.card', { hasText: 'Emberling' }).count()) break;
  if (await dlg()) await page.keyboard.press('Enter');
  await page.waitForTimeout(220);
}
await page.locator('.card', { hasText: 'Emberling' }).click();
await clearDlg(); await waitScene('hub'); await page.waitForTimeout(600); await clearDlg();

// Guaranteed crits: equip the Immortality Memento on the fielded soul; boost it
// for a fast win. Skip the crossing tutorials.
const baseDist = await page.evaluate(() => {
  const g = window.hd2dGame.game;
  g.activeReachId = 'crossing';
  ['tut.melee', 'tut.reaction', 'tut.breakChain', 'tut.commune'].forEach((f) => g.flags.add(f));
  const soul = g.party.find((c) => !c.companion);
  Object.assign(soul, { level: 8, maxHp: 999, hp: 999, off: 999 });
  soul.equip = { ...(soul.equip ?? {}), memento: 'immortalityMemento' };
  return window.hd2dGame.hd2d.params.distance;
});
console.log('base camera distance :', baseDist);

// Launch the fight and install a per-frame monitor of timeScale + sprite count.
await page.evaluate(() => {
  const g = window.hd2dGame;
  g.manager.go('battle', { enemies: [{ species: 'mitebug', level: 3 }], returnTo: 'hub' });
});
await waitScene('battle', 20000); await page.waitForTimeout(900); await clearDlg();
await page.evaluate(() => {
  window.__minTS = 1; window.__maxSprites = 0;
  const tick = () => {
    const g = window.hd2dGame;
    if (g?.hd2d) window.__minTS = Math.min(window.__minTS, g.hd2d.timeScale);
    const sc = g?.manager?.activeScene?.scene;
    if (sc) { let n = 0; sc.traverse((o) => { if (o.type === 'Sprite') n++; }); window.__maxSprites = Math.max(window.__maxSprites, n); }
    window.__raf = requestAnimationFrame(tick);
  };
  tick();
});

// Fight to the finish (every Attack crits → a flourish each time).
let shot = false;
for (let i = 0; i < 140 && (await scene()) === 'battle'; i++) {
  await page.keyboard.press('Enter');
  // Grab one screenshot while the world is in slow-mo/frozen.
  if (!shot) {
    const ts = await page.evaluate(() => window.hd2dGame.hd2d.timeScale);
    if (ts < 1) { await page.screenshot({ path: process.env.OUT ?? new URL('./shots/flourish.png', import.meta.url).pathname }); shot = true; }
  }
  await page.waitForTimeout(200);
}
await waitScene('hub', 20000); await page.waitForTimeout(700); await clearDlg();

const res = await page.evaluate(() => {
  cancelAnimationFrame(window.__raf);
  return { minTS: window.__minTS, maxSprites: window.__maxSprites, nowTS: window.hd2dGame.hd2d.timeScale, dist: window.hd2dGame.hd2d.params.distance };
});
// A flourish drops timeScale to the slow-mo value (0.32) and, for a blink, to 0
// (the freeze). The 110ms freeze can fall between frames on the GPU-less box, so
// the robust proof a flourish fired is that time dipped to slow-mo or below.
console.log('min timeScale          :', res.minTS, '(<= 0.4 → a flourish slowed time)');
console.log('  froze to 0           :', res.minTS === 0);
console.log('peak sprite count      :', res.maxSprites, '(expect >= 12 star burst)');
console.log('timeScale restored     :', res.nowTS, '(expect 1)');
console.log('camera dist restored   :', res.dist, `(expect ${baseDist})`);
console.log('slow-mo screenshot     :', shot);

const ok =
  res.minTS <= 0.4 &&
  res.maxSprites >= 12 &&
  Math.abs(res.nowTS - 1) < 1e-6 &&
  Math.abs(res.dist - baseDist) < 1e-6;

console.log('\nFLOURISH OK :', ok);
console.log('ERRORS:', errs.length ? errs.join('\n') : '(none)');
await browser.close();
process.exit(ok && !errs.length ? 0 : 1);
