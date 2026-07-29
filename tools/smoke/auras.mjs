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
// Cheap render so the software rasteriser can draw at all (see tools/smoke/README.md).
await page.evaluate(() => {
  const g = window.hd2dGame; const p = g.hd2d.params;
  p.supersample = 0.5; p.dofEnabled = false; p.tiltEnabled = false;
  g.hd2d.renderer.shadowMap.enabled = false; g.hd2d.applyParams();
});
await page.waitForTimeout(1000);

// Drop into a first-dungeon battle: a fire starter vs. the Warden and two echoes,
// so both the boss glow and the plain particle auras are exercised.
await page.evaluate(async () => {
  const g = window.hd2dGame;
  g.game.party = [];
  ['emberling', 'glidefang', 'nightnip'].forEach((id) => g.game.captureSpecies(id, 5));
  await g.manager.go('battle', {
    enemies: [{ species: 'regalion', level: 4 }, { species: 'gloomote', level: 3 }, { species: 'dropletta', level: 3 }],
    isBoss: true,
    returnTo: 'dungeon',
  });
});
await page.waitForTimeout(800);

const report = await page.evaluate(() => {
  const g = window.hd2dGame;
  const scene = g.manager.activeScene;
  const auras = scene.auras;       // private, reachable from the live instance
  const particles = scene.particles;
  const countAlive = () => {
    const pos = particles.points.geometry.getAttribute('position').array;
    let n = 0;
    for (let i = 1; i < pos.length; i += 3) if (pos[i] > -9000) n++;
    return n;
  };
  // This container has no GPU (~1 fps), so the real RAF loop barely advances the
  // auras. Pump the scene's own update() with a fixed 60 Hz dt to exercise the
  // exact emission path deterministically, independent of render frame rate.
  for (let f = 0; f < 180; f++) scene.update(1 / 60, 10 + f / 60);
  return {
    auraCount: auras.size,
    glowLights: [...auras.values()].filter((a) => a.light).length,
    aliveParticles: countAlive(),
  };
});

await page.screenshot({ path: `${OUT}/95-auras.png` });

console.log('report:', JSON.stringify(report));
const pass =
  report.auraCount === 6 &&        // 3 party + 3 enemies, all first-dungeon species
  report.glowLights === 1 &&       // only the Warden (regalion) carries a glow
  report.aliveParticles > 30;      // six auras (+ two torches) actively emitting
console.log('VERDICT:', pass ? 'PASS' : 'FAIL');
console.log('ERRORS:', errs.length ? errs.join('\n') : '(none)');
await browser.close();
process.exit(pass && !errs.length ? 0 : 1);
