import { chromium } from 'playwright';
const browser = await chromium.launch({
  executablePath: process.env.CHROME,  // e.g. /opt/pw-browsers/chromium-*/chrome-linux/chrome; omit to use Playwright's own
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const errs = [];
page.on('pageerror', (e) => errs.push('[pageerror] ' + e.message));

// Fake a standard-mapping gamepad before any script runs.
await page.addInitScript(() => {
  window.__pad = {
    id: 'Fake Standard Pad (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard',
    timestamp: 0, axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
  };
  navigator.getGamepads = () => [window.__pad, null, null, null];
  window.__padPress = (i, on) => { window.__pad.buttons[i].pressed = on; window.__pad.buttons[i].value = on ? 1 : 0; };
  window.__padAxis = (i, v) => { window.__pad.axes[i] = v; };
});

await page.goto((process.env.URL ?? 'http://localhost:5199/'), { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const g = window.hd2dGame; const p = g.hd2d.params;
  p.supersample = 0.35; p.dofEnabled = false; p.tiltEnabled = false; p.bloomEnabled = false;
  g.hd2d.renderer.shadowMap.enabled = false; g.hd2d.applyParams();
});
await page.waitForTimeout(1200);

const scene = () => page.evaluate(() => window.hd2dGame.manager.current);
const tap = async (btn, hold = 260) => {
  await page.evaluate((i) => window.__padPress(i, true), btn);
  await page.waitForTimeout(hold);
  await page.evaluate((i) => window.__padPress(i, false), btn);
  await page.waitForTimeout(320);
};
const tilt = async (axis, v, hold = 700) => {
  await page.evaluate(([a, val]) => window.__padAxis(a, val), [axis, v]);
  await page.waitForTimeout(hold);
  await page.evaluate((a) => window.__padAxis(a, 0), axis);
  await page.waitForTimeout(320);
};

console.log('detected  :', await page.evaluate(() => window.hd2dGame ? 'game up' : 'no game'));
// A button (0) = confirm -> should leave the title screen
await tap(0);
await page.waitForTimeout(900);
console.log('after A   : name entry visible =', await page.evaluate(() => !!document.querySelector('.keyboard')));
console.log('padConnected flag =', await page.evaluate(() => window.hd2dGame.manager.activeScene && document.querySelector('.keyboard') !== null));

// D-pad right (15) then A to type a letter, proving menu nav works
await tap(15);
await tap(0);
const typed = await page.evaluate(() => [...document.querySelectorAll('.name-slots span')].map((s) => s.textContent).join(''));
console.log('after dpad+A: name slots =', JSON.stringify(typed));

// Stick down should also move the keyboard cursor
await tilt(1, 1.0);
console.log('stick moved selection =', await page.evaluate(() => document.querySelector('.keyboard button.sel')?.textContent));

// Click OK and run into the hub, then drive with the stick
await page.locator('.keyboard button', { hasText: /^OK$/ }).click();
await page.waitForTimeout(700);
for (let i = 0; i < 40; i++) {
  const open = await page.evaluate(() => { const d = document.querySelector('#dialogue'); return !!d && d.style.display !== 'none'; });
  if (!open) break;
  await tap(0, 120);
}
// Wait until the hub is actually accepting input (arrival dialogue finished).
for (let i = 0; i < 60; i++) {
  const st = await page.evaluate(() => {
    const s = window.hd2dGame.manager.activeScene;
    const d = document.querySelector('#dialogue');
    return { busy: s.busy, dlg: !!d && d.style.display !== 'none' };
  });
  if (!st.busy && !st.dlg) break;
  if (st.dlg) await tap(0, 120); else await page.waitForTimeout(300);
}
console.log('scene now :', await scene(), '| accepting input =', await page.evaluate(() => !window.hd2dGame.manager.activeScene.busy));
const before = await page.evaluate(() => { const s = window.hd2dGame.manager.activeScene; return `${s.tileX},${s.tileZ}`; });
await tilt(1, 1.0, 1400);   // stick down = walk south
const after = await page.evaluate(() => { const s = window.hd2dGame.manager.activeScene; return `${s.tileX},${s.tileZ}`; });
console.log('stick walk: tile', before, '->', after);
console.log('ERRORS:', errs.length ? errs.join('\n') : '(none)');
await browser.close();
