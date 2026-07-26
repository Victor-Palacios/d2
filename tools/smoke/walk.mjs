import { chromium } from 'playwright';
const OUT = process.env.OUT ?? new URL('./shots', import.meta.url).pathname;

const browser = await chromium.launch({
  executablePath: process.env.CHROME,  // e.g. /opt/pw-browsers/chromium-*/chrome-linux/chrome; omit to use Playwright's own
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
// Software GL: run the logic pass small + cheap so the loop hits ~26fps.
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const errs = [];
page.on('pageerror', (e) => errs.push('[pageerror] ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errs.push('[console] ' + m.text()); });

const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` });
const press = async (key, n = 1, gap = 480) => {
  for (let i = 0; i < n; i++) { await page.keyboard.press(key); await page.waitForTimeout(gap); }
};
const state = () => page.evaluate(() => {
  const g = window.hd2dGame;
  const s = g.manager.activeScene ?? {};
  const dlg = document.querySelector('#dialogue');
  return {
    scene: g.manager.current,
    fps: g.stats.fps,
    tile: s.tileX !== undefined ? `${s.tileX},${s.tileZ}` : null,
    floor: g.game.floorIndex,
    fuel: g.game.fuel,
    credits: g.game.credits,
    flags: [...g.game.flags],
    party: g.game.party.map((c) => `${c.name} ${c.hp}/${c.maxHp} mp${c.mp}`),
    dialogueOpen: !!dlg && dlg.style.display !== 'none',
    menu: [...document.querySelectorAll('#action-menu .menu li')].map((n) => n.textContent.trim()),
    banner: document.querySelector('#battle-banner')?.textContent ?? null,
    log: document.querySelector('#battle-log')?.textContent ?? null,
  };
});
const waitScene = async (name, ms = 30000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if ((await state()).scene === name) return true;
    await page.waitForTimeout(200);
  }
  console.log(`!! timeout waiting for '${name}':`, JSON.stringify(await state()));
  return false;
};
const clearDialogue = async (max = 80) => {
  for (let i = 0; i < max; i++) {
    if (!(await state()).dialogueOpen) return;
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
  }
};

await page.goto((process.env.URL ?? 'http://localhost:5199/'), { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const g = window.hd2dGame; const p = g.hd2d.params;
  p.supersample = 0.35; p.dofEnabled = false; p.tiltEnabled = false; p.bloomEnabled = false;
  g.hd2d.renderer.shadowMap.enabled = false; g.hd2d.applyParams();
});
await page.waitForTimeout(2000);
console.log('loop fps:', (await state()).fps);

// --- title / name entry ---------------------------------------------------
await page.keyboard.press('Enter');
await page.waitForTimeout(900);
await shot('10-name-entry');
await page.locator('.keyboard button', { hasText: /^OK$/ }).click();
await page.waitForTimeout(700);
await clearDialogue();
await waitScene('hub');
await page.waitForTimeout(700);
await clearDialogue();
console.log('HUB:', JSON.stringify(await state()));

// --- hub: bump into the mentor, then take the south portal -----------------
await press('ArrowUp', 2);
await press('ArrowRight', 3);
await page.waitForTimeout(400);
await clearDialogue();
console.log('after mentor talk:', JSON.stringify(await state()));

await press('ArrowDown', 5);
await press('ArrowLeft', 3);
await press('ArrowDown', 2);
await waitScene('worldmap');
await page.waitForTimeout(600);
await shot('13-worldmap');

await press('ArrowRight', 1);
await page.keyboard.press('Enter');
await waitScene('dungeon');
await page.waitForTimeout(1200);
console.log('DUNGEON:', JSON.stringify(await state()));

// --- floor 1: mentor tip, then the first scripted battle -------------------
await press('ArrowDown', 2);
await page.waitForTimeout(500);
await clearDialogue();
console.log('after tip:', JSON.stringify(await state()));

await press('ArrowDown', 4);
await page.waitForTimeout(600);
await clearDialogue();
await waitScene('battle');
await page.waitForTimeout(1500);
console.log('BATTLE:', JSON.stringify(await state()));
await shot('17-battle');

for (let i = 0; i < 70; i++) {
  const s = await state();
  if (s.scene !== 'battle') break;
  if (i === 1) { await shot('18-battle-action'); console.log('menu:', JSON.stringify(s.menu)); }
  if (i === 16) console.log('mid battle:', JSON.stringify(s));
  await page.keyboard.press('Enter');
  await page.waitForTimeout(420);
}
await waitScene('dungeon');
await page.waitForTimeout(800);
await clearDialogue();
console.log('AFTER BATTLE:', JSON.stringify(await state()));
await shot('20-after-battle');

console.log('ERRORS:\n' + (errs.join('\n') || '(none)'));
await browser.close();
