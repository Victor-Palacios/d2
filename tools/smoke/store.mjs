import { chromium } from 'playwright';

// Soul Store + Soul Sanctuary (recruitment phase 2). Talk to the Soul Store
// keeper to summon a logged species and buy a party-slot upgrade; open the R1
// menu -> Soul Sanctuary to bench a party member. See tools/smoke/README.md.

const browser = await chromium.launch({
  executablePath: process.env.CHROME,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 720, height: 405 } });
const errs = [];
page.on('pageerror', (e) => errs.push('[pageerror] ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errs.push('[console] ' + m.text()); });

const g = () => page.evaluate(() => {
  const s = window.hd2dGame.game;
  return { credits: s.credits, cap: s.partyCap, party: s.party.length, sanctuary: s.sanctuary.length };
});
const has = (sel) => page.evaluate((x) => !!document.querySelector(x), sel);
const dlg = () => page.evaluate(() => { const d = document.querySelector('#dialogue'); return !!d && d.style.display !== 'none'; });
const scene = () => page.evaluate(() => window.hd2dGame.manager.current);
const clearDlg = async (m = 60) => { for (let i = 0; i < m; i++) { if (!(await dlg())) return; await page.keyboard.press('Enter'); await page.waitForTimeout(160); } };
const waitScene = async (n, ms = 40000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await scene()) === n) return true; await page.waitForTimeout(200); } return false; };

await page.goto(process.env.URL ?? 'http://localhost:4193/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.evaluate(() => { const gg = window.hd2dGame; const p = gg.hd2d.params;
  p.supersample = 0.35; p.dofEnabled = false; p.tiltEnabled = false; p.bloomEnabled = false;
  gg.hd2d.renderer.shadowMap.enabled = false; gg.hd2d.applyParams(); });
await page.waitForTimeout(1200);

await page.keyboard.press('Enter'); await page.waitForTimeout(800);
await page.locator('.keyboard button', { hasText: /^OK$/ }).click(); await page.waitForTimeout(600);
await clearDlg(); await waitScene('hub'); await page.waitForTimeout(700); await clearDlg();

// Seed: log a species and give credits so the store has wares.
await page.evaluate(() => {
  const s = window.hd2dGame.game;
  s.soularium.shardling = { syphon: 100, captured: true, seen: true };
  s.credits = 5000;
});
const before = await g();
console.log('before store :', JSON.stringify(before));

// Walk up into the Soul Store keeper (tile directly above the start).
await page.keyboard.press('ArrowUp'); await page.waitForTimeout(500);
await clearDlg();
console.log('soul store opened :', await has('#soul-store'));
await page.waitForTimeout(400);
await page.screenshot({ path: new URL('./shots/soul-store.png', import.meta.url).pathname });

// First item is "Summon Shardling" -> buy it.
await page.keyboard.press('Enter'); await page.waitForTimeout(600);
const afterSummon = await g();
console.log('after summon :', JSON.stringify(afterSummon), '| party+1 =', afterSummon.party === before.party + 1, '| paid =', afterSummon.credits < before.credits);

// Move down to "Party slot +1" and buy it.
await page.keyboard.press('ArrowDown'); await page.waitForTimeout(200);
await page.keyboard.press('Enter'); await page.waitForTimeout(600);
const afterSlot = await g();
console.log('after slot   :', JSON.stringify(afterSlot), '| cap+1 =', afterSlot.cap === before.cap + 1);

// Leave the store.
await page.keyboard.press('x'); await page.waitForTimeout(500);
console.log('store closed :', !(await has('#soul-store')));

// R1 menu -> Soul Sanctuary -> bench a party member.
let menuOpen = false;
for (let i = 0; i < 16; i++) {
  if (i % 6 === 0 && !menuOpen) await page.keyboard.press('e');
  await page.waitForTimeout(150);
  if (await has('#soul-menu')) { menuOpen = true; break; }
}
console.log('soul menu open :', menuOpen);
await page.keyboard.press('ArrowDown'); await page.waitForTimeout(200); // to "Soul Sanctuary"
await page.keyboard.press('Enter'); await page.waitForTimeout(500);
console.log('sanctuary open :', await has('#sanctuary'));
const preBench = await g();
// First selectable row is the first party member (headers are skipped) -> bench it.
await page.keyboard.press('Enter'); await page.waitForTimeout(500);
const postBench = await g();
console.log('after bench  :', JSON.stringify(postBench), '| moved to reserve =', postBench.sanctuary === preBench.sanctuary + 1 && postBench.party === preBench.party - 1);
await page.keyboard.press('x'); await page.waitForTimeout(400);

const pass =
  (await afterSummon).party === before.party + 1 &&
  afterSlot.cap === before.cap + 1 &&
  postBench.sanctuary === preBench.sanctuary + 1;
console.log('\nRESULT:', pass ? 'PASS — summon, slot upgrade, and bench all work' : 'CHECK');
console.log('ERRORS:', errs.length ? errs.join('\n') : '(none)');
await browser.close();
