import { chromium } from 'playwright';
const OUT = process.env.OUT ?? new URL('./shots', import.meta.url).pathname;
const browser = await chromium.launch({
  executablePath: process.env.CHROME,  // e.g. /opt/pw-browsers/chromium-*/chrome-linux/chrome; omit to use Playwright's own
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push('[pageerror] ' + e.message));
await page.goto((process.env.URL ?? 'http://localhost:5199/'), { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const g = window.hd2dGame; const p = g.hd2d.params;
  p.supersample = 0.5; p.dofEnabled = false; p.tiltEnabled = false;
  g.hd2d.renderer.shadowMap.enabled = false; g.hd2d.applyParams();
});
await page.waitForTimeout(1200);
await page.evaluate(async () => {
  const g = window.hd2dGame;
  g.game.lendTutorialParty();
  await g.manager.go('battle', {
    enemies: [{ species: 'mitebug', level: 6 }, { species: 'scrapmite', level: 7 }, { species: 'sprigling', level: 7 }],
    partyTiles: ['dark', undefined, 'dark'],
    returnTo: 'dungeon',
  });
});
await page.waitForTimeout(4000);
await page.screenshot({ path: `${OUT}/90-hud-cards.png` });
// Open the Technique submenu to check element colouring.
await page.keyboard.press('ArrowDown'); await page.waitForTimeout(250);
await page.keyboard.press('Enter'); await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/91-hud-techniques.png` });
console.log('cards:', await page.evaluate(() => [...document.querySelectorAll('.fighter')].map((n) => ({
  text: n.innerText.replace(/\n/g, ' | '),
  border: getComputedStyle(n).borderColor,
}))));
console.log('ERRORS:', errs.length ? errs.join('\n') : '(none)');
await browser.close();
