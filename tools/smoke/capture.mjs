import { chromium } from 'playwright';

// Soul Syphon capture loop: R1 opens the Soularium; encountering a wild species
// primes its syphon; a hit fills it to 100% and captures it (free copy to party
// or Sanctuary) and logs it in the Soularium. See tools/smoke/README.md.

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
    dlg: (() => { const d = document.querySelector('#dialogue'); return !!d && d.style.display !== 'none'; })(),
    soulOpen: !!document.querySelector('#soularium'),
    enemyCards: [...document.querySelectorAll('#enemy-hud .fighter .syphon')].map((n) => n.textContent.trim()),
  };
});
const soul = (id) => page.evaluate((i) => {
  const g = window.hd2dGame;
  return {
    entry: g.game.soularium[i] ?? null,
    party: g.game.party.map((c) => c.speciesId),
    sanctuary: g.game.sanctuary.map((c) => c.speciesId),
    logged: Object.values(g.game.soularium).filter((e) => e.captured).length,
  };
}, id);
const press = async (k, n = 1, gap = 300) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await page.waitForTimeout(gap); } };
const clearDlg = async (m = 60) => { for (let i = 0; i < m; i++) { if (!(await st()).dlg) return; await page.keyboard.press('Enter'); await page.waitForTimeout(160); } };
const waitScene = async (name, ms = 40000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await st()).scene === name) return true; await page.waitForTimeout(200); } console.log('  !! timeout for', name); return false; };

await page.goto(process.env.URL ?? 'http://localhost:4188/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.evaluate(() => { const g = window.hd2dGame; const p = g.hd2d.params;
  p.supersample = 0.35; p.dofEnabled = false; p.tiltEnabled = false; p.bloomEnabled = false;
  g.hd2d.renderer.shadowMap.enabled = false; g.hd2d.applyParams(); });
await page.waitForTimeout(1500);

await page.keyboard.press('Enter'); await page.waitForTimeout(800);
await page.locator('.keyboard button', { hasText: /^OK$/ }).click(); await page.waitForTimeout(600);
await clearDlg(); await waitScene('hub'); await page.waitForTimeout(700); await clearDlg();

// TEST 1: R1 (E key) opens the Soul menu; its first item opens the Soularium.
await page.keyboard.press('e'); await page.waitForTimeout(500);       // Soul menu
await page.keyboard.press('Enter'); await page.waitForTimeout(500);   // -> Soularium
console.log('R1 -> Soularium in hub :', (await st()).soulOpen);
await page.keyboard.press('x'); await page.waitForTimeout(500);
console.log('X closes it            :', !(await st()).soulOpen);

// Head to Crystal Cavern.
await press('ArrowDown', 5); await press('ArrowLeft', 3); await press('ArrowDown', 2);
await waitScene('worldmap'); await page.waitForTimeout(700);
await page.locator('.card', { hasText: 'Crystal Cavern' }).click();
await waitScene('dungeon'); await page.waitForTimeout(900);

// Boost the party so the fight is a deterministic win (this verifies the
// capture loop, not balance).
await page.evaluate(() => window.hd2dGame.game.party.forEach((c) => { c.maxHp = 999; c.hp = 999; c.off = 160; }));

const pre = await soul('shardling');
console.log('\nbefore encounter — shardling entry :', JSON.stringify(pre.entry));

// Walk into event '1' (Shardling + Prismoth). Advance the intro narration.
await press('ArrowRight', 2); await press('ArrowDown', 2);
for (let i = 0; i < 40 && (await st()).scene !== 'battle'; i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(200); }
await page.waitForTimeout(1000);
const mid = await st();
console.log('enemy card syphon meters (primed) :', JSON.stringify(mid.enemyCards));
const primed = await soul('shardling');
console.log('after encounter — shardling syphon :', primed.entry?.syphon);
await page.screenshot({ path: new URL('./shots/capture-battle.png', import.meta.url).pathname });

// Fight to the finish (each Attack lands hits -> fills syphon -> captures).
for (let i = 0; i < 120 && (await st()).scene === 'battle'; i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(320); }
await waitScene('dungeon'); await page.waitForTimeout(600); await clearDlg();

const post = await soul('shardling');
console.log('\nafter battle:');
console.log('  shardling captured :', post.entry?.captured);
console.log('  in party           :', post.party.includes('shardling'));
console.log('  in sanctuary       :', post.sanctuary.includes('shardling'));
console.log('  souls logged       :', post.logged);

// TEST: R1 works mid-crawl too, and the dex now shows a logged soul.
await page.keyboard.press('e'); await page.waitForTimeout(500);       // Soul menu
await page.keyboard.press('Enter'); await page.waitForTimeout(500);   // -> Soularium
const dex = await st();
console.log('R1 -> Soularium in dungeon :', dex.soulOpen);
await page.keyboard.press('x'); await page.waitForTimeout(400);

const captured = post.entry?.captured && (post.party.includes('shardling') || post.sanctuary.includes('shardling'));
console.log('\nRESULT:', captured ? 'PASS — syphon captured Shardling and logged it' : 'FAIL');
console.log('ERRORS:', errs.length ? errs.join('\n') : '(none)');
await browser.close();
