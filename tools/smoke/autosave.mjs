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

await page.goto((process.env.URL ?? 'http://localhost:5199/'), { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.evaluate(() => { const g = window.hd2dGame; const p = g.hd2d.params;
  p.supersample = 0.35; p.dofEnabled = false; p.tiltEnabled = false; p.bloomEnabled = false;
  g.hd2d.renderer.shadowMap.enabled = false; g.hd2d.applyParams(); });
await page.waitForTimeout(1000);

await page.keyboard.press('Enter');           // New Game
await page.waitForTimeout(800);
await page.locator('.keyboard button', { hasText: /^OK$/ }).click();
await page.waitForTimeout(600);
// Play through every line of dialogue, then just stand in the hub.
for (let i = 0; i < 120; i++) {
  if (await dlg()) { await page.keyboard.press('Enter'); await page.waitForTimeout(200); }
  else { const s = await info(); if (s.scene === 'hub') break; await page.waitForTimeout(250); }
}
await page.waitForTimeout(3000);
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
console.log('ERRORS:', errs.length ? errs.join('\n') : '(none)');
await browser.close();
