import { chromium } from 'playwright';

// The dialogue advance-guard. A line's *advance* is briefly withheld right after
// it first reveals (only the first line of each box — see `src/ui/DialogueBox.ts`,
// ADVANCE_GUARD_MS), so a burst of confirm presses meant for the PREVIOUS
// dialogue — e.g. tapping through the tutorial and "An echo" just as the first
// battle and its melee/cover lesson load — cannot reveal-and-skip the fresh line
// in a single frame. Regression test for the "text flashes by, can't read it" bug.
//
// Seeds the first Quiet Crossing battle directly so its mechanic tutorial is the
// dialogue on screen, then fires a rapid double-press and asserts the line is NOT
// skipped, while a paced press still advances it.

const browser = await chromium.launch({
  executablePath: process.env.CHROME,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 720, height: 405 } });
const errs = [];
page.on('pageerror', (e) => errs.push('[pageerror] ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errs.push('[console] ' + m.text()); });

const scene = () => page.evaluate(() => window.hd2dGame.manager.current);
const dlg = () => page.evaluate(() => {
  const d = document.querySelector('#dialogue');
  return { vis: !!d && d.style.display !== 'none', body: d?.querySelector('.body')?.textContent ?? '' };
});
const waitScene = async (n, ms = 40000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await scene()) === n) return true; await page.waitForTimeout(150); } return false; };

await page.goto(process.env.URL ?? 'http://localhost:4173/', { waitUntil: 'networkidle' });
await page.waitForSelector('.title-press', { timeout: 4000 }).catch(() => {});
if (await page.locator('.title-press').count()) { await page.keyboard.press('Enter'); await page.waitForTimeout(300); }
await page.waitForTimeout(1000);
await page.evaluate(() => { const g = window.hd2dGame, p = g.hd2d.params; p.supersample = 0.35; p.dofEnabled = false; p.tiltEnabled = false; p.bloomEnabled = false; g.hd2d.renderer.shadowMap.enabled = false; g.hd2d.applyParams(); });
await page.waitForTimeout(700);

// New game -> hub (party + prologueDone), then seed a crossing battle directly.
await page.keyboard.press('Enter'); await page.waitForTimeout(700);
await page.locator('.keyboard button', { hasText: /^OK$/ }).click(); await page.waitForTimeout(500);
for (let i = 0; i < 40; i++) { if (await page.locator('.card', { hasText: 'Emberling' }).count()) break; await page.keyboard.press('Enter'); /* press through the prologue cutscene */ await page.waitForTimeout(160); }
await page.locator('.card', { hasText: 'Emberling' }).click();
for (let i = 0; i < 40; i++) { if ((await scene()) === 'hub') break; if ((await dlg()).vis) await page.keyboard.press('Enter'); await page.waitForTimeout(160); }
await waitScene('hub'); await page.waitForTimeout(300);
for (let i = 0; i < 20; i++) { if ((await dlg()).vis) await page.keyboard.press('Enter'); await page.waitForTimeout(110); }

await page.evaluate(async () => {
  const g = window.hd2dGame;
  g.game.activeReachId = 'crossing';
  g.game.flags.delete('tut.melee'); // the crossing melee lesson (BattleScene.maybeTutorial)
  await g.manager.go('battle', { enemies: [{ species: 'mistling', level: 1 }], isBoss: false, eventId: 'x', partyTiles: ['fire', 'fire', 'fire'], returnTo: 'dungeon' });
});
await waitScene('battle');

// Wait for the tut.melee dialogue line 1 to appear.
let appeared = false;
for (let i = 0; i < 60; i++) { const d = await dlg(); if (d.vis && /scraps|front row/.test(d.body)) { appeared = true; break; } await page.waitForTimeout(120); }
console.log('mechanic tutorial line 1 shown :', appeared, '|', JSON.stringify((await dlg()).body.slice(0, 40)));

// Fire a rapid double-press (the leak: two confirms milliseconds apart).
await page.keyboard.press('Enter'); // reveals the full line
await page.keyboard.press('Enter'); // within the guard window -> must be IGNORED
await page.waitForTimeout(120);
const afterBurst = await dlg();
// Held if still on line 1 ("front row"), not advanced to line 2 ("Rear is covered").
const heldLine1 = afterBurst.vis && /front row/.test(afterBurst.body) && !/Rear is covered/.test(afterBurst.body);
console.log('rapid double-press does NOT skip:', heldLine1, '|', JSON.stringify(afterBurst.body.slice(0, 50)));

// A paced press (past the guard window) still advances normally.
await page.waitForTimeout(400);
await page.keyboard.press('Enter'); await page.waitForTimeout(250);
const advanced = await dlg();
// Line 2 begins "A soul in the Rear ..."; the typewriter may only have revealed
// its opening. Advancement = we are off line 1 (no longer the "One more thing" text).
const didAdvance = !advanced.vis || (/A soul in the/.test(advanced.body) && !/One more thing/.test(advanced.body));
console.log('paced press still advances      :', didAdvance, '|', JSON.stringify(advanced.body.slice(0, 50)));

const ok = appeared && heldLine1 && didAdvance;
console.log('\nDIALOGUE GUARD OK :', ok);
console.log('ERRORS:', errs.length ? errs.join('\n') : '(none)');
await browser.close();
process.exit(ok && !errs.length ? 0 : 1);
