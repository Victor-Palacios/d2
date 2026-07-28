import { chromium } from 'playwright';

// Story gating: reaches unlock in order. On a fresh run only The Quiet Crossing
// is selectable; The Reliquary is locked until it is cleared; The Unremembered
// and the side-path Overgrowth stay locked until the Reliquary is cleared.
// Reads the rendered world-map cards (locked cards carry the `.locked` class and
// a "clear X first" note) and drives the unlock via the debug flag API — no
// fights, so it is fast and deterministic. See tools/smoke/README.md.

const browser = await chromium.launch({
  executablePath: process.env.CHROME,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
const errs = [];
page.on('pageerror', (e) => errs.push('[pageerror] ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errs.push('[console] ' + m.text()); });

const scene = () => page.evaluate(() => window.hd2dGame.manager.current);
const dlg = () => page.evaluate(() => { const d = document.querySelector('#dialogue'); return !!d && d.style.display !== 'none'; });
const wait = async (n, ms = 30000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await scene()) === n) return true; await page.waitForTimeout(200); } return false; };

// Snapshot the world-map cards: title -> { locked, note }. Locked cards get the
// `.locked` class from CardSelect and a `.danger` note paragraph.
const readCards = () => page.evaluate(() =>
  [...document.querySelectorAll('.card')].map((n) => ({
    title: n.querySelector('h3')?.textContent ?? '',
    tag: n.querySelector('.tag')?.textContent ?? '',
    locked: n.classList.contains('locked'),
    note: n.querySelector('p.danger')?.textContent ?? '',
  })),
);

// Leaving the world map with its picker still open resolves to null and bounces
// to the hub, so transitions go through the city card cleanly: pick The Everwake
// to return, mutate a flag, then re-open the map so cards re-render fresh.
const setFlag = (f) => page.evaluate((flag) => window.hd2dGame.game.set(flag), f);
const goWorldmap = async () => { await page.evaluate(async () => { await window.hd2dGame.manager.go('worldmap'); }); await wait('worldmap'); await page.waitForTimeout(500); };
const backToHub = async () => {
  await page.locator('.card', { hasText: 'The Everwake' }).click();
  await wait('hub'); await page.waitForTimeout(300);
  for (let i = 0; i < 10; i++) { if (await dlg()) await page.keyboard.press('Enter'); await page.waitForTimeout(120); }
};

await page.goto(process.env.URL ?? 'http://localhost:4173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.evaluate(() => { const g = window.hd2dGame, p = g.hd2d.params; p.supersample = 0.4; p.dofEnabled = false; p.bloomEnabled = false; g.hd2d.applyParams(); });

await page.keyboard.press('Enter'); await page.waitForTimeout(700);
await page.locator('.keyboard button', { hasText: /^OK$/ }).click(); await page.waitForTimeout(600);
for (let i = 0; i < 40; i++) { if (await page.locator('.card', { hasText: 'Emberling' }).count()) break; if (await dlg()) await page.keyboard.press('Enter'); await page.waitForTimeout(200); }
await page.locator('.card', { hasText: 'Emberling' }).click();
for (let i = 0; i < 40; i++) { if ((await scene()) === 'hub') break; if (await dlg()) await page.keyboard.press('Enter'); await page.waitForTimeout(200); }
await wait('hub'); await page.waitForTimeout(400);
for (let i = 0; i < 20; i++) { if (await dlg()) await page.keyboard.press('Enter'); await page.waitForTimeout(120); }

const lockOf = (cards, title) => cards.find((c) => c.title === title);

// --- Stage 1: fresh run — only the Quiet Crossing is open ------------------
await goWorldmap();
let cards = await readCards();
for (const c of cards) console.log(`  ${c.title.padEnd(20)} ${c.locked ? 'LOCKED' : 'open  '} [${c.tag}] ${c.note}`);
const s1 =
  !lockOf(cards, 'The Quiet Crossing').locked &&
  lockOf(cards, 'The Reliquary').locked &&
  lockOf(cards, 'The Overgrowth').locked &&
  lockOf(cards, 'The Unremembered').locked &&
  /Quiet Crossing/.test(lockOf(cards, 'The Reliquary').note);
console.log('stage 1 (fresh) — only Quiet Crossing open :', s1);

// --- Stage 2: Quiet Crossing cleared — the Reliquary opens -----------------
await backToHub();
await setFlag('bootDomainCleared');
await goWorldmap();
cards = await readCards();
const s2 =
  !lockOf(cards, 'The Reliquary').locked &&
  lockOf(cards, 'The Overgrowth').locked &&
  lockOf(cards, 'The Unremembered').locked &&
  /Reliquary/.test(lockOf(cards, 'The Overgrowth').note) &&
  /Reliquary/.test(lockOf(cards, 'The Unremembered').note);
console.log('stage 2 (boot cleared) — Reliquary opens   :', s2);

// --- Stage 3: Reliquary cleared — Overgrowth + Unremembered open -----------
await backToHub();
await setFlag('crystalCleared');
await goWorldmap();
cards = await readCards();
const overgrowth = lockOf(cards, 'The Overgrowth');
const s3 =
  !overgrowth.locked && overgrowth.tag === 'Side path' &&
  !lockOf(cards, 'The Unremembered').locked;
console.log('stage 3 (crystal cleared) — both open      :', s3, `(Overgrowth tag: ${overgrowth.tag})`);

const ok = s1 && s2 && s3;
console.log('\nGATES OK :', ok);
console.log('ERRORS:', errs.length ? errs.join('\n') : '(none)');
await browser.close();
process.exit(ok && !errs.length ? 0 : 1);
