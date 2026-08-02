import { chromium } from 'playwright';
const OUT = process.env.OUT ?? new URL('./shots', import.meta.url).pathname;
const browser = await chromium.launch({
  executablePath: process.env.CHROME,
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
await page.waitForTimeout(600);

// Jump straight into the crawl (the Quiet Crossing floor 0) and give the player
// a partner so the HUD builds cleanly.
await page.evaluate(async () => {
  const g = window.hd2dGame;
  if (!g.game.party.length) g.game.captureSpecies('emberling', 5);
  await g.manager.go('dungeon', {});
});
await page.waitForTimeout(800);

// Drive the player's walk cycle deterministically on the live sprite: sample the
// mesh's vertical bounce and side-to-side rock across a step, plus the idle pose.
// Frame-rate independent, so it holds on the GPU-less container.
const report = await page.evaluate(() => {
  const g = window.hd2dGame;
  const scene = g.manager.activeScene;
  const p = scene.player;
  const cam = g.hd2d.camera;
  const sample = (t) => {
    p.setStride(t);
    p.update(1 / 60, cam, 5);
    return { t, y: +p.mesh.position.y.toFixed(4), x: +p.mesh.position.x.toFixed(4), rz: +p.mesh.rotation.z.toFixed(4) };
  };
  return {
    walkBounce: p.walkBounce,
    idle: sample(-1),
    start: sample(0),
    foot1: sample(0.25),
    mid: sample(0.5),
    foot2: sample(0.75),
    end: sample(1),
  };
});

// Kick off a real step and grab a mid-stride screenshot (best effort at ~1 fps).
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(120);
await page.screenshot({ path: `${OUT}/98-walk.png` });

console.log('report:', JSON.stringify(report, null, 2));
const r = report;
const pass =
  r.walkBounce > 0 &&
  // Bounce peaks at each footfall (t=0.25, 0.75) and touches down between them
  // and at both ends of the step.
  r.foot1.y > 0.05 && r.foot2.y > 0.05 &&
  r.mid.y < 0.02 && r.start.y < 0.02 && r.end.y < 0.02 &&
  // Body rocks to opposite sides on the two footfalls.
  r.foot1.rz !== 0 && r.foot2.rz !== 0 && Math.sign(r.foot1.rz) !== Math.sign(r.foot2.rz) &&
  // Idle is a calm breath, not a stride.
  Math.abs(r.idle.y) < 0.03 && r.idle.x === 0 && r.idle.rz === 0;
console.log('VERDICT:', pass ? 'PASS' : 'FAIL');
console.log('ERRORS:', errs.length ? errs.join('\n') : '(none)');
await browser.close();
process.exit(pass && !errs.length ? 0 : 1);
