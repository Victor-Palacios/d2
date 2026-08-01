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
  p.supersample = 0.6; p.dofEnabled = false; p.tiltEnabled = false;
  g.hd2d.renderer.shadowMap.enabled = false; g.hd2d.applyParams();
});
await page.waitForTimeout(500);
await page.evaluate(async () => {
  const g = window.hd2dGame;
  if (!g.game.party.length) g.game.captureSpecies('emberling', 5);
  await g.manager.go('dungeon', {});
});
await page.waitForTimeout(800);

const report = await page.evaluate(async () => {
  const g = window.hd2dGame;
  const scene = g.manager.activeScene;
  const p = scene.player;
  const ghost = p.ghost;
  const flame = p.revealFlame;
  const THREE_GREATER = 6; // THREE.GreaterDepth

  // Drop an opaque wall-sized box right between the camera and the player, so the
  // player is definitely occluded, then let the reveal draw through it.
  const THREE = ghost.geometry.constructor.name ? null : null; // (not needed)
  const cam = g.hd2d.camera;
  const feet = p.object.position.clone();
  const mid = cam.position.clone().lerp(feet.clone().setY(feet.y + 1), 0.55);
  const box = flame.clone();          // reuse a mesh's constructor via three on the page
  // Build a plain opaque blocker from the scene's own THREE by cloning geometry.
  const blockerGeo = flame.geometry.clone();
  const mat = flame.material.clone();
  mat.map = null; mat.transparent = false; mat.opacity = 1; mat.depthWrite = true;
  mat.depthFunc = 3 /* LessEqualDepth */; mat.blending = 0 /* NoBlending */; mat.color.setHex(0x223047);
  const blocker = new box.constructor(blockerGeo, mat);
  blocker.scale.set(3, 3, 3);
  blocker.position.copy(mid);
  blocker.quaternion.copy(cam.quaternion); // face the camera so it fully covers
  blocker.renderOrder = 0;
  scene.scene.add(blocker);

  // Render one frame with the blocker in place.
  g.hd2d.render(1 / 60);
  await new Promise((r) => setTimeout(r, 60));

  return {
    hasGhost: !!ghost,
    hasFlame: !!flame,
    ghostDepthFunc: ghost.material.depthFunc,
    flameDepthFunc: flame.material.depthFunc,
    ghostDepthWrite: ghost.material.depthWrite,
    flameDepthWrite: flame.material.depthWrite,
    expectGreater: THREE_GREATER,
  };
});

await page.screenshot({ path: `${OUT}/99-reveal.png` });

console.log('report:', JSON.stringify(report));
const pass =
  report.hasGhost && report.hasFlame &&
  report.ghostDepthFunc === report.expectGreater &&
  report.flameDepthFunc === report.expectGreater &&
  report.ghostDepthWrite === false && report.flameDepthWrite === false;
console.log('VERDICT:', pass ? 'PASS' : 'FAIL');
console.log('ERRORS:', errs.length ? errs.join('\n') : '(none)');
await browser.close();
process.exit(pass && !errs.length ? 0 : 1);
