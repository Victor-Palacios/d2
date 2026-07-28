// Smoke test for monster battle cries (audio.cry): confirms each authored
// species voice actually builds a Web Audio graph — oscillators + gain nodes,
// with pitch glides and vibrato LFOs — and that firing them raises no errors.
//
// Headless Chromium has no speakers, but oscillator/param scheduling still runs,
// so we instrument AudioContext to tally what each cry creates.
//
//   URL=http://localhost:5261/ node tools/smoke/cries.mjs
import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext({ viewport: { width: 800, height: 450 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('[pageerror] ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errs.push('[console] ' + m.text()); });

// Instrument audio graph construction BEFORE any AudioContext is made.
await page.addInitScript(() => {
  const w = window;
  w.__cry = { oscs: 0, gains: 0, ramps: 0, lfoConnectsToFreq: 0 };
  const Ctor = w.AudioContext || w.webkitAudioContext;
  const wrap = class extends Ctor {
    createOscillator() {
      const o = super.createOscillator();
      w.__cry.oscs++;
      const ramp = o.frequency.exponentialRampToValueAtTime.bind(o.frequency);
      o.frequency.exponentialRampToValueAtTime = (...a) => { w.__cry.ramps++; return ramp(...a); };
      const lin = o.frequency.linearRampToValueAtTime.bind(o.frequency);
      o.frequency.linearRampToValueAtTime = (...a) => { w.__cry.ramps++; return lin(...a); };
      const conn = o.connect.bind(o);
      o.connect = (dest, ...rest) => {
        // An LFO connecting into another oscillator's frequency AudioParam = vibrato.
        if (dest && typeof dest.value === 'number' && dest.setValueAtTime) w.__cry.lfoConnectsToFreq++;
        return conn(dest, ...rest);
      };
      return o;
    }
    createGain() {
      const g = super.createGain();
      w.__cry.gains++;
      const conn = g.connect.bind(g);
      g.connect = (dest, ...rest) => {
        // A gain node feeding an oscillator's frequency AudioParam = the vibrato
        // depth stage (lfo -> lfoGain -> osc.frequency).
        if (dest && typeof dest.value === 'number' && dest.setValueAtTime) w.__cry.lfoConnectsToFreq++;
        return conn(dest, ...rest);
      };
      return g;
    }
  };
  w.AudioContext = wrap;
  if (w.webkitAudioContext) w.webkitAudioContext = wrap;
});

await page.goto((process.env.URL ?? 'http://localhost:5261/'), { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
// Unlock audio (needs a gesture) — a click, then confirm the context is live.
await page.mouse.click(400, 225);
await page.waitForTimeout(400);
const state = await page.evaluate(() => window.hd2dGame?.audio ? 'ok' : 'no-audio-hook');
console.log('audio hook :', state);

const SPECIES = [
  // starter trio
  'emberling', 'glidefang', 'nightnip',
  // The Quiet Crossing (first dungeon): wild roster + the warden boss
  'mitebug', 'sprigling', 'scrapmite', 'gloomote', 'dropletta', 'regalion',
];
const NEGATIVE = 'bulwarq'; // a monster with no authored cry — must stay silent.

const measure = async (id) => page.evaluate((sp) => {
  const a = window.hd2dGame.audio;
  const before = { ...window.__cry };
  const has = a.hasCry(sp);
  a.cry(sp);
  const after = { ...window.__cry };
  return {
    has,
    oscs: after.oscs - before.oscs,
    gains: after.gains - before.gains,
    ramps: after.ramps - before.ramps,
    vibrato: after.lfoConnectsToFreq - before.lfoConnectsToFreq,
  };
}, id);

console.log('\n=== monster cries ===');
let pass = true;
for (const id of SPECIES) {
  const m = await measure(id);
  // Every voice must build multiple layers with at least one pitch glide.
  // Vibrato is character, not a requirement (e.g. Dropletta is pure bloops).
  const ok = m.has && m.oscs >= 2 && m.gains >= 2 && m.ramps >= 1;
  pass = pass && ok;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${id.padEnd(10)}  hasCry=${m.has}  oscillators=${m.oscs}  gains=${m.gains}  pitch-glides=${m.ramps}  vibrato-LFOs=${m.vibrato}`,
  );
  await page.waitForTimeout(150);
}

const neg = await measure(NEGATIVE);
const negOk = !neg.has && neg.oscs === 0;
pass = pass && negOk;
console.log(`${negOk ? 'PASS' : 'FAIL'}  ${NEGATIVE.padEnd(10)}  hasCry=${neg.has}  oscillators=${neg.oscs}   (expected silent)`);

console.log('\nERRORS:', errs.length ? errs.join('\n') : '(none)');
console.log('RESULT:', pass && !errs.length ? 'ALL PASS' : 'FAILURES');
await browser.close();
process.exit(pass && !errs.length ? 0 : 1);
