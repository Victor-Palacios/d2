import { chromium } from 'playwright';

// The prologue cutscene (Option-A memory beats: src/ui/Cutscene.ts +
// src/data/cutscenes.ts). After naming the keeper, a letterboxed 'how they
// lived' flashback plays over the title diorama. Proves: the overlay mounts with
// the first beat's prose, it is skippable (any button tears it down), and the
// New Game flow proceeds to Halden's welcome afterwards. See tools/smoke/README.md.

const browser = await chromium.launch({
  executablePath: process.env.CHROME,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 720, height: 405 } });
const errs = [];
page.on('pageerror', (e) => errs.push('[pageerror] ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errs.push('[console] ' + m.text()); });

const scene = () => page.evaluate(() => window.hd2dGame.manager.current);
const cutsceneUp = () => page.evaluate(() => !!document.querySelector('.cutscene'));
const captionText = () => page.evaluate(() => document.querySelector('.cutscene-cap')?.textContent ?? '');

await page.goto(process.env.URL ?? 'http://localhost:4197/', { waitUntil: 'networkidle' });
await page.waitForSelector('.title-press', { timeout: 4000 }).catch(() => {});
if (await page.locator('.title-press').count()) { await page.keyboard.press('Enter'); await page.waitForTimeout(300); }
await page.waitForTimeout(1500);
await page.evaluate(() => { const g = window.hd2dGame; const p = g.hd2d.params;
  p.supersample = 0.35; p.dofEnabled = false; p.tiltEnabled = false; p.bloomEnabled = false;
  g.hd2d.renderer.shadowMap.enabled = false; g.hd2d.applyParams(); });
await page.waitForTimeout(1000);

// New Game -> name -> OK. The cutscene fires the moment the name is confirmed.
await page.keyboard.press('Enter'); await page.waitForTimeout(700);
await page.locator('.keyboard button', { hasText: /^OK$/ }).click();

// The overlay should appear with the first memory beat's prose.
let up = false;
let firstCap = '';
for (let i = 0; i < 40 && !up; i++) { up = await cutsceneUp(); await page.waitForTimeout(100); }
for (let i = 0; i < 20 && !firstCap; i++) { firstCap = await captionText(); await page.waitForTimeout(120); }
console.log('cutscene overlay mounted   :', up);
console.log('first beat prose           :', JSON.stringify(firstCap));
const hasProse = /there was a life|before the lantern/i.test(firstCap);
console.log('reads the life-before line  :', hasProse);

// Skip it: a single button press must tear the whole overlay down.
await page.keyboard.press('Enter');
let torn = false;
for (let i = 0; i < 30 && !torn; i++) { torn = !(await cutsceneUp()); await page.waitForTimeout(120); }
console.log('skippable (overlay removed) :', torn);

// The New Game flow continues: mash to the partner select, confirming we did not
// softlock behind the cutscene.
let reachedPartner = false;
for (let i = 0; i < 60 && !reachedPartner; i++) {
  if (await page.locator('.card', { hasText: 'Emberling' }).count()) { reachedPartner = true; break; }
  if (await page.locator('.cutscene').count()) await page.keyboard.press('Enter');
  else await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
}
console.log('flow reaches partner select :', reachedPartner);

const ok = up && hasProse && torn && reachedPartner;
console.log('\nCUTSCENE OK :', ok);
console.log('ERRORS:', errs.length ? errs.join('\n') : '(none)');
await browser.close();
process.exit(ok && !errs.length ? 0 : 1);
