// Transcendence cinematic smoke test. Drives the evolution/de-evolution fanfare
// (src/ui/TranscendCinematic.ts) headlessly via window.hd2dGame.playTranscend to
// prove: the overlay mounts with both forms + the on-screen skip note, Start (the
// keyboard mirror is E) skips straight to the coloured reveal + caption, a second
// press dismisses and the overlay tears down, and de-evolution reads "returned
// to". Runs against an isolated container, so no scene can interfere and it stays
// fast + deterministic on the GPU-less box.
import { chromium } from 'playwright';

const URL = process.env.URL ?? 'http://localhost:5199/';
const browser = await chromium.launch({
  executablePath: process.env.CHROME, // omit to use Playwright's own
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', (e) => errs.push(String(e)));

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!(window.hd2dGame && window.hd2dGame.playTranscend));

const pressE = () =>
  page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' })));

// --- 1. Mount an evolve cinematic in an isolated container -----------------
const mounted = await page.evaluate(() => {
  // Isolate from the title scene: it owns #ui and re-lays-it-out during
  // startup, which can race a probe. Host the cinematic in our own element.
  const app = document.getElementById('app');
  if (app) app.style.visibility = 'hidden';
  const host = document.createElement('div');
  host.id = 'cine-host';
  host.style.cssText = 'position:fixed;inset:0;z-index:99999';
  document.body.appendChild(host);
  window.__cine = window.hd2dGame.playTranscend(host, {
    fromId: 'emberling',
    toId: 'regalion',
    mode: 'evolve',
    displayName: 'Emberling',
    gainedMoves: ['pyreLance'],
  });
  const root = host.querySelector('.transcend-cine');
  return {
    hasRoot: !!root,
    sprites: host.querySelectorAll('.tc-sprite').length,
    canvases: host.querySelectorAll('canvas').length,
    hasAura: !!host.querySelector('.tc-aura'),
    hasFlash: !!host.querySelector('.tc-flash'),
    tint: root ? getComputedStyle(root).getPropertyValue('--tint').trim() : '',
    skipText: (host.querySelector('.tc-skip')?.textContent ?? ''),
    newIsSil: host.querySelectorAll('.tc-sprite')[1]?.classList.contains('sil') ?? false,
  };
});

// --- 2. Skip: Start (E) jumps to the coloured reveal + caption -------------
await pressE();
await page.waitForTimeout(60);
const revealed = await page.evaluate(() => {
  const host = document.getElementById('cine-host');
  const newSprite = host.querySelectorAll('.tc-sprite')[1];
  const cap = host.querySelector('.tc-caption');
  return {
    stillMounted: !!host.querySelector('.transcend-cine'),
    newRevealed: !!newSprite && !newSprite.classList.contains('sil') && newSprite.style.opacity === '1',
    captionShown: !!cap && cap.style.opacity === '1',
    captionText: (cap?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    skipText: (host.querySelector('.tc-skip')?.textContent ?? ''),
  };
});

// --- 3. A second press dismisses; the overlay tears down and resolves ------
await pressE();
const settled = await page.evaluate(async () => {
  await Promise.race([
    window.__cine,
    new Promise((r) => setTimeout(r, 3000)),
  ]);
  const host = document.getElementById('cine-host');
  return { removed: !host.querySelector('.transcend-cine') };
});

// --- 4. De-evolution reads "returned to" and also skips clean --------------
await page.evaluate(() => {
  const host = document.getElementById('cine-host');
  window.__cine2 = window.hd2dGame.playTranscend(host, {
    fromId: 'regalion',
    toId: 'emberling',
    mode: 'devolve',
    displayName: 'Regalion',
    gainedMoves: [],
  });
});
await pressE();
await page.waitForTimeout(60);
const devo = await page.evaluate(async () => {
  const host = document.getElementById('cine-host');
  const cap = host.querySelector('.tc-caption');
  const text = (cap?.textContent ?? '').replace(/\s+/g, ' ').trim();
  return { verb: text };
});
await pressE();
await page.evaluate(() => Promise.race([window.__cine2, new Promise((r) => setTimeout(r, 3000))]));
const devoRemoved = await page.evaluate(() => !document.getElementById('cine-host').querySelector('.transcend-cine'));

const line = (label, ok) => console.log(`${ok ? 'ok ' : 'XX '} ${label}: ${ok}`);
console.log('== Transcendence cinematic ==');
console.log('skip note :', JSON.stringify(mounted.skipText));
console.log('reveal cap:', JSON.stringify(revealed.captionText));
console.log('devolve   :', JSON.stringify(devo.verb));

const checks = {
  'overlay mounts': mounted.hasRoot,
  'both forms rendered (2 sprites)': mounted.sprites === 2 && mounted.canvases >= 2,
  'aura + flash present': mounted.hasAura && mounted.hasFlash,
  'element tint applied': mounted.tint.length > 0,
  'skip note names START': /START/i.test(mounted.skipText) && /skip/i.test(mounted.skipText),
  'new form starts as silhouette': mounted.newIsSil === true,
  'skip reveals coloured new form': revealed.newRevealed,
  'skip shows caption': revealed.captionShown,
  'evolve caption reads "evolved into Regalion"': /evolved into\s*Regalion/i.test(revealed.captionText),
  'note switches to continue after reveal': /continue/i.test(revealed.skipText),
  'second press tears the overlay down': settled.removed,
  'devolve caption reads "returned to Emberling"': /returned to\s*Emberling/i.test(devo.verb),
  'devolve overlay tears down': devoRemoved,
};

let ok = true;
for (const [label, pass] of Object.entries(checks)) { line(label, pass); ok = ok && pass; }

console.log('\nERRORS:', errs.length ? errs.join('\n') : '(none)');
console.log(ok && !errs.length ? '\nPASS' : '\nFAIL');
await browser.close();
process.exit(ok && !errs.length ? 0 : 1);
