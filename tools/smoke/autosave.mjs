import { chromium } from 'playwright';
const browser = await chromium.launch({
  executablePath: process.env.CHROME,  // e.g. /opt/pw-browsers/chromium-*/chrome-linux/chrome; omit to use Playwright's own
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const ctx = await browser.newContext({ viewport: { width: 800, height: 450 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('[pageerror] ' + e.message));
const dlg = () => page.evaluate(() => { const d = document.querySelector('#dialogue'); return !!d && d.style.display !== 'none'; });
const info = () => page.evaluate(() => ({
  scene: window.hd2dGame.manager.current,
  auto: JSON.parse(localStorage.getItem('hd2d.save.auto') || 'null'),
}));

const pickPartner = async () => {
  for (let i = 0; i < 50; i++) {
    if (await page.locator('.card', { hasText: 'Emberling' }).count()) { await page.locator('.card', { hasText: 'Emberling' }).click(); await page.waitForTimeout(300); return; }
    await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  }
};

await page.goto((process.env.URL ?? 'http://localhost:5199/'), { waitUntil: 'networkidle' });
// Lost Souls title: wait for and dismiss the "press any button" splash so the menu is reachable.
await page.waitForSelector('.title-press', { timeout: 4000 }).catch(() => {});
if (await page.locator('.title-press').count()) { await page.keyboard.press('Enter'); await page.waitForTimeout(300); }
await page.waitForTimeout(1500);
await page.evaluate(() => { const g = window.hd2dGame; const p = g.hd2d.params;
  p.supersample = 0.35; p.dofEnabled = false; p.tiltEnabled = false; p.bloomEnabled = false;
  g.hd2d.renderer.shadowMap.enabled = false; g.hd2d.applyParams(); });
await page.waitForTimeout(1000);

await page.keyboard.press('Enter');           // New Game
await page.waitForTimeout(800);
await page.locator('.keyboard button', { hasText: /^OK$/ }).click();
await page.waitForTimeout(600);
  await pickPartner();
// Advance the intro prologue and get into the hub, advancing every line.
// NOTE: the hub's arrival() opens with `await sleep(280)` during which the
// scene is 'hub' but no dialogue is up yet and busy is still false. Breaking on
// "scene===hub && !dlg" here is the classic race that made autosave *look*
// broken — you leave (or stop advancing) before arrival() reaches its save
// call. So: first wait for arrival to actually START, then run it to idle.
const busy = () => page.evaluate(() => !!window.hd2dGame.manager.activeScene?.busy);
let started = false;
for (let i = 0; i < 200; i++) {
  const s = await info();
  if (s.scene === 'hub' && (await dlg() || await busy())) { started = true; break; }
  if (await dlg()) { await page.keyboard.press('Enter'); await page.waitForTimeout(150); }
  else await page.waitForTimeout(150);
}
if (!started) console.log('!! hub arrival never started');
// Now advance the arrival dialogue to completion (busy clears, no box open).
for (let i = 0; i < 200; i++) {
  if (!(await dlg()) && !(await busy())) break;
  if (await dlg()) { await page.keyboard.press('Enter'); await page.waitForTimeout(150); }
  else await page.waitForTimeout(120);
}
await page.waitForTimeout(800);
const probe = await page.evaluate(() => {
  const sc = window.hd2dGame.manager.activeScene;
  return { disposed: sc.disposed, busy: sc.busy, hasFlag: window.hd2dGame.game.has('prologueDone'),
           flags: [...window.hd2dGame.game.flags] };
});
console.log('hub probe     :', JSON.stringify(probe));
const s = await info();
console.log('scene         :', s.scene);
console.log('autosave kind :', s.auto?.kind, '| label:', s.auto?.label, '| scene:', s.auto?.scene);
console.log('name/credits  :', s.auto?.state?.playerName, s.auto?.state?.credits);
console.log('party saved   :', s.auto?.state?.party?.map((c) => `${c.name} ${c.attribute}`).join(', '));
console.log('flags         :', s.auto?.state?.flags?.join(','));
console.log('VERDICT       :', s.auto ? 'PASS — hub autosave written' : 'FAIL — no autosave after arrival');
console.log('ERRORS:', errs.length ? errs.join('\n') : '(none)');
await browser.close();
